type LatLngPoint = [lat: number, lng: number]

export type ActivityStreams = {
  latlng?: { data: LatLngPoint[] }
  time?: { data: number[] }
  altitude?: { data: number[] }
}

export async function fetchActivityStreams(
  activityId: string,
  accessToken: string,
): Promise<ActivityStreams> {
  const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=latlng,time,altitude&key_by_type=true`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    throw new Error(
      `Strava API error for activity ${activityId}: ${res.status} ${await res.text()}`,
    )
  }
  return (await res.json()) as ActivityStreams
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function toGpx(name: string, streams: ActivityStreams): string | null {
  const latlng = streams.latlng?.data ?? []
  if (latlng.length === 0) return null

  const times = streams.time?.data ?? []
  const altitudes = streams.altitude?.data ?? []
  // Stream times are seconds from the start of the activity. Matches the v4 site:
  // relative times are anchored at "now" since the streams don't include the start date.
  const start = (times[0] ?? 0) === 0 ? Date.now() : 0

  const points = latlng.map(([lat, lng], i) => {
    const ele = altitudes[i]
    const seconds = times[i]
    const children = [
      Number.isFinite(ele) ? `<ele>${ele}</ele>` : "",
      Number.isFinite(seconds)
        ? `<time>${new Date(start + seconds! * 1000).toISOString()}</time>`
        : "",
    ].join("")
    return `<trkpt lat="${lat}" lon="${lng}">${children}</trkpt>`
  })

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="Quartz" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    `<trk><name>${escapeXml(name)}</name><trkseg>${points.join("")}</trkseg></trk>`,
    `</gpx>`,
  ].join("\n")
}

/** Track points from a GPX file (ours, or one cached by the v4 site) */
export function parseGpxTrack(gpx: string): LatLngPoint[] {
  const points: LatLngPoint[] = []
  for (const [, attrs] of gpx.matchAll(/<trkpt\b([^>]*)>/g)) {
    const lat = parseFloat(attrs!.match(/\blat="([^"]+)"/)?.[1] ?? "")
    const lng = parseFloat(attrs!.match(/\blon="([^"]+)"/)?.[1] ?? "")
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) points.push([lat, lng])
  }
  return points
}

export function samplePointsEvenly<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points
  const step = (points.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, i) => points[Math.round(i * step)]!)
}

// Google encoded polyline format, as used by Mapbox path overlays
function encodeSignedNumber(num: number): string {
  let value = num < 0 ? ~(num << 1) : num << 1
  let encoded = ""
  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63)
    value >>= 5
  }
  return encoded + String.fromCharCode(value + 63)
}

export function encodePolyline(points: LatLngPoint[]): string {
  let lastLat = 0
  let lastLng = 0
  let result = ""
  for (const [lat, lng] of points) {
    const iLat = Math.round(lat * 1e5)
    const iLng = Math.round(lng * 1e5)
    result += encodeSignedNumber(iLat - lastLat) + encodeSignedNumber(iLng - lastLng)
    lastLat = iLat
    lastLng = iLng
  }
  return result
}
