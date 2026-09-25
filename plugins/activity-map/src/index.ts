import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import type {
  BuildCtx,
  ChangeEvent,
  FilePath,
  ProcessedContent,
  QuartzPluginData,
} from "@quartz-community/types"
import { FileCache, hashKey, legacySlug, readLegacy } from "./cache"
import { getActivityId, getLocations, gpxSlug, mapSlug } from "./locations"
import { downloadMap } from "./mapbox"
import {
  encodePolyline,
  fetchActivityStreams,
  parseGpxTrack,
  samplePointsEvenly,
  toGpx,
} from "./strava"

/**
 * For every published page with a `location`, a `route` pointing at located routes,
 * or a `strava` activity, emits:
 * - `<slug>-strava.gpx`: the Strava activity track (needs STRAVA_ACCESS_TOKEN)
 * - `<slug>-map.jpg`: a static Mapbox map with the track and pins (needs MAPBOX_TOKEN)
 *
 * Downloads are cached in `cacheDir` (kept across CI runs) so builds rarely hit the APIs.
 */
interface Options {
  cacheDir: string
  /** Max track points drawn on a map (Mapbox URLs have a length limit) */
  maxTrackPoints: number
}

const defaultOptions: Options = {
  cacheDir: "quartz/.quartz-cache",
  maxTrackPoints: 600,
}

// Bump when the map rendering changes, to invalidate cached maps
const MAP_VERSION = 1

type FileData = QuartzPluginData & Record<string, unknown>

// Tokens come from the environment or .env (CI sets MAPBOX_TOKEN directly and writes
// STRAVA_ACCESS_TOKEN to .env). loadEnvFile doesn't overwrite variables that are already set.
function loadEnv() {
  if (fs.existsSync(".env")) process.loadEnvFile(".env")
}

async function writeOutput(ctx: BuildCtx, slug: string, content: Buffer | string) {
  const fp = path.join(ctx.argv.output, slug) as FilePath
  await fsp.mkdir(path.dirname(fp), { recursive: true })
  await fsp.writeFile(fp, content)
  return fp
}

export default (userOpts?: Partial<Options>) => {
  const opts: Options = { ...defaultOptions, ...userOpts }
  const mapsDir = path.join(opts.cacheDir, "maps")
  const gpxDir = path.join(opts.cacheDir, "gpx")
  const maps = new FileCache(mapsDir)
  const gpxs = new FileCache(gpxDir)
  const stats = { cached: 0, migrated: 0, downloaded: 0, failed: 0 }

  async function getGpx(fileData: FileData, activityId: string): Promise<string | null> {
    const key = `strava-${activityId}.gpx`
    const cached = await gpxs.read(key)
    if (cached) {
      stats.cached++
      return cached.toString("utf8")
    }

    const rawId = (fileData.frontmatter as Record<string, unknown>).strava
    const legacyKey = `${legacySlug(fileData.relativePath as string)}-strava.gpx`
    const legacy = await readLegacy(gpxDir, legacyKey, { activityId: rawId })
    if (legacy) {
      stats.migrated++
      await gpxs.write(key, legacy)
      return legacy.toString("utf8")
    }

    const token = process.env.STRAVA_ACCESS_TOKEN
    if (!token) throw new Error("STRAVA_ACCESS_TOKEN is not set")
    const gpx = toGpx(fileData.slug as string, await fetchActivityStreams(activityId, token))
    stats.downloaded++
    if (gpx) await gpxs.write(key, gpx)
    return gpx
  }

  async function getMap(
    fileData: FileData,
    locations: ReturnType<typeof getLocations>,
    activityId: string | null,
    polyline: string | undefined,
  ): Promise<Buffer> {
    const key = `map-${hashKey({ v: MAP_VERSION, activityId, locations, polyline: !!polyline })}.jpg`
    const cached = await maps.read(key)
    if (cached) {
      stats.cached++
      return cached
    }

    const rawId = (fileData.frontmatter as Record<string, unknown>).strava
    const legacyKey = `${legacySlug(fileData.relativePath as string)}-map.jpg`
    const legacy = await readLegacy(mapsDir, legacyKey, { strava: rawId, location: locations })
    if (legacy) {
      stats.migrated++
      await maps.write(key, legacy)
      return legacy
    }

    const token = process.env.MAPBOX_TOKEN
    if (!token) throw new Error("MAPBOX_TOKEN is not set")
    const map = await downloadMap(locations, polyline, token)
    stats.downloaded++
    await maps.write(key, map)
    return map
  }

  async function* processFile(
    ctx: BuildCtx,
    fileData: FileData,
    allFiles: FileData[],
  ): AsyncGenerator<FilePath> {
    if (fileData.dataOnly || !fileData.frontmatter || !fileData.slug) return
    const slug = fileData.slug as string
    const activityId = getActivityId(fileData.frontmatter as Record<string, unknown>)
    const locations = getLocations(fileData, allFiles)
    if (locations.length === 0 && !activityId) return

    try {
      let polyline: string | undefined
      if (activityId) {
        const gpx = await getGpx(fileData, activityId)
        if (gpx) {
          yield await writeOutput(ctx, `${gpxSlug(slug)}.gpx`, gpx)
          const track = samplePointsEvenly(parseGpxTrack(gpx), opts.maxTrackPoints)
          if (track.length > 0) polyline = encodePolyline(track)
        }
      }

      if (locations.length === 0 && !polyline) return
      const map = await getMap(fileData, locations, activityId, polyline)
      yield await writeOutput(ctx, `${mapSlug(slug)}.jpg`, map)
    } catch (err) {
      stats.failed++
      console.warn(`[activity-map] ${slug}: ${(err as Error).message}`)
    }
  }

  function logStats() {
    const { cached, migrated, downloaded, failed } = stats
    console.log(
      `[activity-map] ${cached} cached, ${migrated} migrated from v4 cache, ${downloaded} downloaded, ${failed} failed`,
    )
    Object.assign(stats, { cached: 0, migrated: 0, downloaded: 0, failed: 0 })
  }

  return {
    name: "ActivityMap",
    async *emit(ctx: BuildCtx, content: ProcessedContent[]) {
      loadEnv()
      const allFiles = content.map(([, file]) => file.data as FileData)
      for (const fileData of allFiles) {
        yield* processFile(ctx, fileData, allFiles)
      }
      logStats()
    },
    async *partialEmit(
      ctx: BuildCtx,
      content: ProcessedContent[],
      _resources: unknown,
      changeEvents: ChangeEvent[],
    ) {
      loadEnv()
      const allFiles = content.map(([, file]) => file.data as FileData)
      for (const event of changeEvents) {
        if (event.type === "delete" || !event.file?.data) continue
        yield* processFile(ctx, event.file.data as FileData, allFiles)
      }
    },
  }
}
