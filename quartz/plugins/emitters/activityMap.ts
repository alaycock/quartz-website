import { QuartzEmitterPlugin } from "../types"
import { FilePath, FullSlug, joinSegments, slugifyFilePath, unWikilink } from "../../util/path"
import { Readable } from "stream"
import path from 'path';
import { BuildCtx, BuildTimeTrieData } from "../../util/ctx"
import { QuartzPluginData } from "../vfile"
import fs from "node:fs/promises"
import { write } from "./helpers"

type Frontmatter = NonNullable<BuildTimeTrieData['frontmatter']>;

type StreamLatLng = { data: [number, number][] }
type StreamNumber = { data: number[] }

async function fetchActivityStreams(activityId: string | number) {
  const token = process.env.STRAVA_ACCESS_TOKEN
  if (!token) {
    throw new Error("STRAVA_ACCESS_TOKEN is not set")
  }

  const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=latlng,time,altitude&key_by_type=true`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava API error ${res.status}: ${text}`)
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

  const header =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" creator="Quartz" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n'
  const name = `<trk><name>${escapeXml(slug)}</name><trkseg>`

  const points: string[] = []
  for (let i = 0; i < latlng.length; i++) {
    const [lat, lon] = latlng[i]
    const ele = alts[i]
    const timeSec = times[i]
    const isoTime = Number.isFinite(timeSec)
      ? new Date((times[0] ?? 0) === 0 ? Date.now() + timeSec * 1000 : timeSec * 1000).toISOString()
      : undefined
    const eleTag = Number.isFinite(ele) ? `<ele>${ele}</ele>` : ""
    const timeTag = isoTime ? `<time>${isoTime}</time>` : ""
    points.push(`<trkpt lat="${lat}" lon="${lon}">${eleTag}${timeTag}</trkpt>`)
  }

  const footer = "</trkseg></trk></gpx>\n"
  return header + name + points.join("") + footer
}

function escapeXml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function encodeSignedNumber(num: number) {
  let sgnNum = num < 0 ? ~(num << 1) : (num << 1)
  let encoded = ''
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
  let result = ''
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
  if (location && typeof location === 'string') {
    const [lat, lng] = location.split(',').map(part => part.trim());
    if (lat && lng) {
      return [lat, lng];
    }
  }
  return null;
}

const getLocations = (frontmatter: Frontmatter, allRoutes: [FullSlug, Frontmatter][]) => {
  const { route } = frontmatter;
  const location = getLocationFromProperty(frontmatter.location)
  if (location) {
    return [location];
  }

  if (route && Array.isArray(route)) {
    return route.map((routeName) => {
      const strippedRoute = unWikilink(routeName);
      const routeSlug = `Routes/${slugifyFilePath(strippedRoute as FilePath)}`;
      const matchedRoute = allRoutes.find(([slug]) => slug === routeSlug);
      return getLocationFromProperty(matchedRoute?.[1].location);
    }).filter(Boolean) as string[][];
  }

  return [];
}

async function downloadMap(
  locations: string[][],
  encodedPolyline?: string,
): Promise<Readable> {
  type ReducedLocations = [string, number, number]; 
  const [locationsString, latSum, lngSum] = locations.reduce(([accPinString, accLat, accLng], [lat, lng]): ReducedLocations => {
    const pinString = `pin-l-mountain+f74e4e(${lng},${lat})`;
    const newPinString = accPinString.length > 0 ? `${accPinString},${pinString}` : pinString;

    return [newPinString, accLat + parseFloat(lat), accLng + parseFloat(lng)];
  }, ['', 0, 0] as ReducedLocations);
  const centre = locations.length > 0 ? [latSum / locations.length, lngSum / locations.length] as const : [0, 0] as const;

  const mapboxToken = process.env.MAPBOX_TOKEN;
  const overlayParts: string[] = [];
  if (encodedPolyline && encodedPolyline.length > 0) {
    overlayParts.push(`path-4+f74e4e-1(${encodeURIComponent(encodedPolyline)})`)
  }
  if (locationsString.length > 0) {
    overlayParts.push(locationsString)
  }
  const overlay = overlayParts.join(',') || '[]'

  const extent = encodedPolyline && encodedPolyline.length > 0
    ? 'auto'
    : `${centre[1]},${centre[0]},10,0,0`;

  const padding = encodedPolyline && encodedPolyline.length > 0 ? '&padding=20' : ''
  const url = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${overlay}/${extent}/256x256@2x?access_token=${mapboxToken}${padding}`
  const response = await fetch(url);
  if (!response.ok) {
    console.log(url);
    console.error(await response.text())
    throw new Error(`Could not fetch: ${url}`);
  }
  return response.body as unknown as Readable;
}

const mapsCacheDir = "./quartz/.quartz-cache/maps";
const gpxCacheDir = "./quartz/.quartz-cache/gpx";
async function processActivityMap(
  ctx: BuildCtx,
  allFiles: QuartzPluginData[],
  fileData: QuartzPluginData,
): Promise<FilePath[] | null> {
  const newFileSlug = `${fileData.slug}-map`;
  const newFileExtension = '.jpg'
  const pathToCache = joinSegments(mapsCacheDir, newFileSlug + newFileExtension) as FilePath

  let cacheContent;
  try {
    cacheContent = await fs.readFile(pathToCache)
  } catch (e) {
  }

  if (!fileData.frontmatter) {
    return null;
  }

  const generatedFiles: FilePath[] = [];

  // Attempt to fetch Strava streams and write GPX if configured
  let encodedPathFromStrava: string | undefined
  const fm = fileData.frontmatter as unknown as { strava?: string | number } | undefined
  const activityId = fm?.strava
  if (activityId) {
    try {
      const gpxSlug = `${fileData.slug}-strava`;
      const gpxPathToCache = joinSegments(gpxCacheDir, gpxSlug + '.gpx') as FilePath
      
      let gpxCacheContent;
      try {
        gpxCacheContent = await fs.readFile(gpxPathToCache, 'utf-8')
      } catch (e) {
        // Cache miss, fetch from Strava
      }

      if (!gpxCacheContent) {
        const streams = await fetchActivityStreams(activityId)
        if (streams.latlng?.data && streams.latlng.data.length > 0) {
          const MAX_POINTS = 600
          const sampled = samplePointsEvenly(streams.latlng.data, MAX_POINTS)
          encodedPathFromStrava = encodePolyline(sampled)
        }
        const gpx = toGpxXml(fileData.slug as FullSlug, streams)
        if (gpx) {
          // Cache the GPX file
          const dir = path.dirname(gpxPathToCache)
          await fs.mkdir(dir, { recursive: true })
          await fs.writeFile(gpxPathToCache, gpx, 'utf-8')
          
          // Write to output
          await write({ ctx, slug: gpxSlug as FullSlug, ext: ".gpx", content: gpx })
          generatedFiles.push(joinSegments('.', ctx.argv.output, gpxSlug + '.gpx') as FilePath)
        }
      } else {
        // Use cached GPX content
        await write({ ctx, slug: gpxSlug as FullSlug, ext: ".gpx", content: gpxCacheContent })
        generatedFiles.push(joinSegments('.', ctx.argv.output, gpxSlug + '.gpx') as FilePath)
        
        // Still need to generate polyline for map if not cached
        if (!cacheContent) {
          const streams = await fetchActivityStreams(activityId)
          if (streams.latlng?.data && streams.latlng.data.length > 0) {
            const MAX_POINTS = 600
            const sampled = samplePointsEvenly(streams.latlng.data, MAX_POINTS)
            encodedPathFromStrava = encodePolyline(sampled)
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const routeEntries = allFiles
    .filter(file => file.frontmatter?.tags?.includes('route'))
    .map(file => [file.slug!, file.frontmatter!] satisfies [FullSlug, Frontmatter])

  const locations = getLocations(fileData.frontmatter, routeEntries ?? []);
  if (locations.length === 0 && !encodedPathFromStrava && !cacheContent) {
    return generatedFiles.length > 0 ? generatedFiles : null;
  }

  const stream = cacheContent ?? await downloadMap(locations, encodedPathFromStrava);
  if (!stream) {
    return generatedFiles.length > 0 ? generatedFiles : null;
  }

  if (!cacheContent) {
    const dir = path.dirname(pathToCache)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(pathToCache, stream)
  }

  // Always copy the map file to output directory (whether cached or newly generated)
  const pathToMap = joinSegments('.', ctx.argv.output, newFileSlug + newFileExtension);
  const dir = path.dirname(pathToMap)
  await fs.mkdir(dir, { recursive: true })
  await fs.copyFile(pathToCache, pathToMap)
  
  generatedFiles.push(pathToMap as FilePath);
  return generatedFiles;
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
        if (generatedFiles) {
          for (const filePath of generatedFiles) {
            yield filePath;
          }
        }
      }
    },
    async *partialEmit(_ctx, _content, _resources, changeEvents) {
      for (const changeEvent of changeEvents) {
        if (!changeEvent.file) continue
      }
    },
    externalResources: (_ctx) => {
      return {};
    },
  }
}


