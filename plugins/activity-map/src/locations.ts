import type { QuartzPluginData } from "@quartz-community/types"

/** [lat, lng] as written in frontmatter (`location: 49.16, -114.00`) */
export type LatLng = [lat: string, lng: string]

type Frontmatter = Record<string, unknown>
type FileData = QuartzPluginData & Record<string, unknown>

export function parseLocation(value: unknown): LatLng | null {
  if (typeof value !== "string") return null
  const [lat, lng] = value.split(",").map((part) => part.trim())
  return lat && lng ? [lat, lng] : null
}

/** Strava activity ID from `strava:` frontmatter (an ID or an activity URL) */
export function getActivityId(frontmatter: Frontmatter | undefined): string | null {
  const value = frontmatter?.strava
  if (typeof value === "number") return String(value)
  if (typeof value !== "string" || !value.trim()) return null
  return value.match(/activities\/(\d+)/)?.[1] ?? value.trim()
}

const baseName = (filePath: string) =>
  (filePath.split("/").pop() ?? filePath).replace(/\.md$/, "").toLowerCase()

// "[[Routes/Mount Bourgeau|Bourgeau]]" → "mount bourgeau"
const linkTargetName = (link: string) => baseName(link.replace(/\[\[|\]\]/g, "").split("|")[0]!)

// Route name → `location`, built once per allFiles array
const routeLocationsCache = new WeakMap<FileData[], Map<string, unknown>>()

function routeLocations(allFiles: FileData[]): Map<string, unknown> {
  let locations = routeLocationsCache.get(allFiles)
  if (!locations) {
    locations = new Map()
    for (const file of allFiles) {
      const frontmatter = file.frontmatter as Frontmatter | undefined
      const tags = frontmatter?.tags
      const filePath = (file.relativePath ?? file.filePath) as string | undefined
      if (!filePath || !Array.isArray(tags) || !tags.includes("route")) continue
      locations.set(baseName(filePath), frontmatter?.location)
    }
    routeLocationsCache.set(allFiles, locations)
  }
  return locations
}

/** A page's own `location`, or the locations of the routes listed in its `route` property */
export function getLocations(fileData: FileData, allFiles: FileData[]): LatLng[] {
  const frontmatter = fileData.frontmatter as Frontmatter | undefined
  if (!frontmatter) return []

  const own = parseLocation(frontmatter.location)
  if (own) return [own]

  if (!Array.isArray(frontmatter.route)) return []
  const routes = routeLocations(allFiles)
  return frontmatter.route
    .map((route) => parseLocation(routes.get(linkTargetName(String(route)))))
    .filter((location): location is LatLng => location !== null)
}

/** Output path (without extension) for a page's generated files, e.g. `routes/mount-bourgeau-map` */
export const mapSlug = (slug: string) => `${slug}-map`
export const gpxSlug = (slug: string) => `${slug}-strava`
