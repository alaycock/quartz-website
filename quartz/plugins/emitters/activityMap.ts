import { QuartzEmitterPlugin } from "../types"
import { FilePath, FullSlug, joinSegments, slugifyFilePath, unWikilink } from "../../util/path"
import { Readable } from "stream"
import path from "path"
import { BuildCtx, BuildTimeTrieData } from "../../util/ctx"
import { QuartzPluginData } from "../vfile"
import fs from "node:fs/promises"
import { write } from "./helpers"
import { AssetCache } from "../../util/assetCache"
import * as cheerio from "cheerio"
import { buffer as streamToBuffer } from "node:stream/consumers"

type Frontmatter = NonNullable<BuildTimeTrieData["frontmatter"]>

type ActivityStreams = { latlng?: StreamLatLng; time?: StreamNumber; altitude?: StreamNumber }
type StreamLatLng = { data: [number, number][] }
type StreamNumber = { data: number[] }

async function fetchActivityStreams(activityId: string | number): Promise<ActivityStreams> {
  const token = process.env.STRAVA_ACCESS_TOKEN
  if (!token) {
    throw new Error("STRAVA_ACCESS_TOKEN is not set")
  }

  const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=latlng,time,altitude&key_by_type=true`
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava API error ID ${activityId} : ${res.status} : ${text}`)
  }
  return (await res.json()) as {
    latlng?: StreamLatLng
    time?: StreamNumber
    altitude?: StreamNumber
  }
}

function toGpxXml(
  slug: FullSlug,
  streams: { latlng?: StreamLatLng; time?: StreamNumber; altitude?: StreamNumber },
): string | null {
  const latlng = streams.latlng?.data ?? []
  if (latlng.length === 0) return null

  const times = streams.time?.data ?? []
  const alts = streams.altitude?.data ?? []

  const $ = cheerio.load("", { xml: true })

  const gpx = $("<gpx>")
    .attr("version", "1.1")
    .attr("creator", "Quartz")
    .attr("xmlns", "http://www.topografix.com/GPX/1/1")
    .attr("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
    .attr(
      "xsi:schemaLocation",
      "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
    )

  const trk = $("<trk>")
  const name = $("<name>").text(slug)
  trk.append(name)

  const trkseg = $("<trkseg>")

  for (let i = 0; i < latlng.length; i++) {
    const [lat, lon] = latlng[i]
    const ele = alts[i]
    const timeSec = times[i]
    const isoTime = Number.isFinite(timeSec)
      ? new Date((times[0] ?? 0) === 0 ? Date.now() + timeSec * 1000 : timeSec * 1000).toISOString()
      : undefined

    const trkpt = $("<trkpt>").attr("lat", lat.toString()).attr("lon", lon.toString())

    if (Number.isFinite(ele)) {
      trkpt.append($("<ele>").text(ele.toString()))
    }

    if (isoTime) {
      trkpt.append($("<time>").text(isoTime))
    }

    trkseg.append(trkpt)
  }

  trk.append(trkseg)
  gpx.append(trk)
  $.root().append(gpx)

  return $.xml()
}

function encodeSignedNumber(num: number) {
  let sgnNum = num < 0 ? ~(num << 1) : num << 1
  let encoded = ""
  while (sgnNum >= 0x20) {
    encoded += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63)
    sgnNum >>= 5
  }
  encoded += String.fromCharCode(sgnNum + 63)
  return encoded
}

function encodePolyline(points: [number, number][]) {
  let lastLat = 0
  let lastLng = 0
  let result = ""
  for (const [lat, lng] of points) {
    const ilat = Math.round(lat * 1e5)
    const ilng = Math.round(lng * 1e5)
    const dlat = ilat - lastLat
    const dlng = ilng - lastLng
    lastLat = ilat
    lastLng = ilng
    result += encodeSignedNumber(dlat) + encodeSignedNumber(dlng)
  }
  return result
}

function samplePointsEvenly<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points
  const sampled: T[] = []
  const step = (points.length - 1) / (maxPoints - 1)
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step)
    sampled.push(points[idx])
  }
  return sampled
}

const getLocationFromProperty = (location: unknown) => {
  if (location && typeof location === "string") {
    const [lat, lng] = location.split(",").map((part) => part.trim())
    if (lat && lng) {
      return [lat, lng]
    }
  }
  return null
}

const getLocations = (frontmatter: Frontmatter, allRoutes: [FullSlug, Frontmatter][]) => {
  const { route } = frontmatter
  const location = getLocationFromProperty(frontmatter.location)
  if (location) {
    return [location]
  }

  if (route && Array.isArray(route)) {
    return route
      .map((routeName) => {
        const strippedRoute = unWikilink(routeName)
        const routeSlug = `Routes/${slugifyFilePath(strippedRoute as FilePath)}`
        const matchedRoute = allRoutes.find(([slug]) => slug === routeSlug)
        return getLocationFromProperty(matchedRoute?.[1].location)
      })
      .filter(Boolean) as string[][]
  }

  return []
}

async function downloadMap(locations: string[][], encodedPolyline?: string): Promise<Readable> {
  type ReducedLocations = [string, number, number]
  const [locationsString, latSum, lngSum] = locations.reduce(
    ([accPinString, accLat, accLng], [lat, lng]): ReducedLocations => {
      const pinString = `pin-l-mountain+f74e4e(${lng},${lat})`
      const newPinString = accPinString.length > 0 ? `${accPinString},${pinString}` : pinString

      return [newPinString, accLat + parseFloat(lat), accLng + parseFloat(lng)]
    },
    ["", 0, 0] as ReducedLocations,
  )
  const centre =
    locations.length > 0
      ? ([latSum / locations.length, lngSum / locations.length] as const)
      : ([0, 0] as const)

  const mapboxToken = process.env.MAPBOX_TOKEN
  const overlayParts: string[] = []
  if (encodedPolyline && encodedPolyline.length > 0) {
    overlayParts.push(`path-4+f74e4e-1(${encodeURIComponent(encodedPolyline)})`)
  }
  if (locationsString.length > 0) {
    overlayParts.push(locationsString)
  }
  const overlay = overlayParts.join(",") || "[]"

  const extent =
    encodedPolyline && encodedPolyline.length > 0 ? "auto" : `${centre[1]},${centre[0]},10,0,0`

  const padding = encodedPolyline && encodedPolyline.length > 0 ? "&padding=20" : ""
  const url = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${overlay}/${extent}/256x256@2x?access_token=${mapboxToken}${padding}`
  const response = await fetch(url)
  if (!response.ok) {
    console.log(url)
    console.error(await response.text())
    throw new Error(`Could not fetch: ${url}`)
  }
  return response.body as unknown as Readable
}

const mapsCacheDir = "./quartz/.quartz-cache/maps"
const gpxCacheDir = "./quartz/.quartz-cache/gpx"

// Create cache instances
const mapsCache = new AssetCache(mapsCacheDir)
const gpxCache = new AssetCache(gpxCacheDir)

async function processActivityMap(
  ctx: BuildCtx,
  allFiles: QuartzPluginData[],
  fileData: QuartzPluginData,
): Promise<FilePath[]> {
  const newFileSlug = `${fileData.slug}-map`
  const newFileExtension = ".jpg"
  const mapCacheFileName = newFileSlug + newFileExtension
  const generatedFiles: FilePath[] = []

  // No frontmatter = no map to generate
  if (!fileData.frontmatter) {
    return generatedFiles
  }

  // Attempt to fetch Strava streams and write GPX if configured
  let encodedPathFromStrava: string | undefined
  const fm = fileData.frontmatter as unknown as { strava?: string | number } | undefined
  const activityId = fm?.strava
  let activityStreams: ActivityStreams

  const routeEntries = allFiles
    .filter((file) => file.frontmatter?.tags?.includes("route"))
    .map((file) => [file.slug!, file.frontmatter!] satisfies [FullSlug, Frontmatter])

  const locations = getLocations(fileData.frontmatter, routeEntries)

  // No locations and no Strava data = no map to generate
  if (locations.length === 0 && !activityId) {
    return generatedFiles
  }

  if (activityId) {
    const gpxSlug = `${fileData.slug}-strava`
    const gpxCacheFileName = gpxSlug + ".gpx"

    // Check cache with strava dependency
    const gpxDependencies = { activityId }
    let gpxCacheContent = await gpxCache.readCachedTextFile(gpxCacheFileName, gpxDependencies)

    if (!gpxCacheContent) {
      // Cache miss or invalid, fetch from Strava
      activityStreams = await fetchActivityStreams(activityId)
      if (activityStreams.latlng?.data && activityStreams.latlng.data.length > 0) {
        const MAX_POINTS = 600
        const sampled = samplePointsEvenly(activityStreams.latlng.data, MAX_POINTS)
        encodedPathFromStrava = encodePolyline(sampled)
      }
      const gpx = toGpxXml(fileData.slug as FullSlug, activityStreams)
      if (gpx) {
        // Cache the GPX file with dependencies
        await gpxCache.writeCachedFile(gpxCacheFileName, gpx, gpxDependencies)

        // Write to output
        await write({ ctx, slug: gpxSlug as FullSlug, ext: ".gpx", content: gpx })
        generatedFiles.push(joinSegments(".", ctx.argv.output, gpxSlug + ".gpx") as FilePath)
      }
    } else {
      // Use cached GPX content
      await write({ ctx, slug: gpxSlug as FullSlug, ext: ".gpx", content: gpxCacheContent })
      generatedFiles.push(joinSegments(".", ctx.argv.output, gpxSlug + ".gpx") as FilePath)

      // Extract track points from GPX to create encoded path
      const $ = cheerio.load(gpxCacheContent, { xml: true })
      const trackPoints: [number, number][] = []
      $("trkpt").each((_, elem) => {
        const lat = parseFloat($(elem).attr("lat") || "0")
        const lon = parseFloat($(elem).attr("lon") || "0")
        if (!isNaN(lat) && !isNaN(lon)) {
          trackPoints.push([lat, lon])
        }
      })

      if (trackPoints.length > 0) {
        const MAX_POINTS = 600
        const sampled = samplePointsEvenly(trackPoints, MAX_POINTS)
        encodedPathFromStrava = encodePolyline(sampled)
      }
    }
  }

  // Build dependencies for map cache
  const mapDependencies: Record<string, unknown> = {}
  mapDependencies.strava = activityId
  mapDependencies.location = locations

  // Check map cache first
  let cacheContent: Buffer | null = await mapsCache.readCachedFile(
    mapCacheFileName,
    mapDependencies,
  )

  if (!cacheContent) {
    const stream: Readable = await downloadMap(locations, encodedPathFromStrava)
    const buffer = await streamToBuffer(stream)

    // Cache the map file with dependencies
    await mapsCache.writeCachedFile(mapCacheFileName, buffer, mapDependencies)

    // Use the buffer for copying to output
    cacheContent = buffer
  }

  // Copy the map file to output directory
  const pathToMap = joinSegments(".", ctx.argv.output, newFileSlug + newFileExtension)
  const dir = path.dirname(pathToMap)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(pathToMap, cacheContent)

  generatedFiles.push(pathToMap as FilePath)
  return generatedFiles
}

export const ActivityMapEmitterName = "ActivityMap"
export const ActivityMap: QuartzEmitterPlugin = () => {
  return {
    name: ActivityMapEmitterName,
    getQuartzComponents() {
      return []
    },
    async *emit(ctx, content, _resources) {
      for (const [_tree, vfile] of content) {
        const allFiles = content.map((c) => c[1].data)
        const generatedFiles = await processActivityMap(ctx, allFiles, vfile.data)
        if (generatedFiles.length === 0) {
          for (const filePath of generatedFiles) {
            yield filePath
          }
        }
      }
    },
    async *partialEmit(_ctx, _content, _resources, changeEvents) {
      for (const changeEvent of changeEvents) {
        // TODO: Implement partial emitting
        if (!changeEvent.file) continue
      }
    },
    externalResources: (_ctx) => {
      return {}
    },
  }
}
