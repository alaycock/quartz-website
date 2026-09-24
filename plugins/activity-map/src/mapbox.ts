import type { LatLng } from "./locations"

/** Static 256×256@2x Mapbox outdoors map with a pin per location and an optional track */
export async function downloadMap(
  locations: LatLng[],
  encodedPolyline: string | undefined,
  accessToken: string,
): Promise<Buffer> {
  const pins = locations.map(([lat, lng]) => `pin-l-mountain+f74e4e(${lng},${lat})`)
  const overlays = [
    ...(encodedPolyline ? [`path-4+f74e4e-1(${encodeURIComponent(encodedPolyline)})`] : []),
    ...pins,
  ]
  const overlay = overlays.join(",") || "[]"

  let extent = "auto"
  let padding = "&padding=20"
  if (!encodedPolyline) {
    // Centre on the average of the pins
    const lat = locations.reduce((sum, [lat]) => sum + parseFloat(lat), 0) / locations.length
    const lng = locations.reduce((sum, [, lng]) => sum + parseFloat(lng), 0) / locations.length
    extent = `${lng},${lat},10,0,0`
    padding = ""
  }

  const url = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${overlay}/${extent}/256x256@2x?access_token=${accessToken}${padding}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Mapbox error ${res.status}: ${await res.text()}`)
  }
  return Buffer.from(await res.arrayBuffer())
}
