import type { JSX } from "preact"
import type {
  FullSlug,
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types"
import { classNames } from "@quartz-community/utils/lang"
import { formatDate } from "@quartz-community/utils/date"
import { pathToRoot, resolveRelative } from "@quartz-community/utils/path"
import { getActivityId, gpxSlug } from "../../../activity-map/src/locations"
import style from "./tripMeta.scss"

type Frontmatter = Record<string, unknown>
type FileData = QuartzComponentProps["fileData"]

const SHOWN_FOR = ["post", "trip", "route"]
const DATED = ["post", "trip"]

const toTitleCase = (s: string) =>
  s.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

// "dwyt/dont-do" → "Dont Do"
function tagRating(tags: string[], prefix: string): string | undefined {
  const tag = tags.find((t) => t.startsWith(`${prefix}/`))
  return tag ? toTitleCase(tag.slice(prefix.length + 1).replace(/-/g, " ")) : undefined
}

const baseName = (p: string) => (p.split("/").pop() ?? p).replace(/\.md$/, "").toLowerCase()

// Route name → slug of its page, built once per allFiles array
const routeSlugsCache = new WeakMap<FileData[], Map<string, string>>()

function routeSlugs(allFiles: FileData[]): Map<string, string> {
  let slugs = routeSlugsCache.get(allFiles)
  if (!slugs) {
    slugs = new Map()
    for (const file of allFiles) {
      const filePath = (file.relativePath ?? file.filePath) as string | undefined
      const tags = (file.frontmatter as Frontmatter | undefined)?.tags
      if (file.dataOnly || !filePath || !file.slug) continue
      if (Array.isArray(tags) && tags.includes("route")) slugs.set(baseName(filePath), file.slug)
    }
    routeSlugsCache.set(allFiles, slugs)
  }
  return slugs
}

type StatProps = { value: string; unit?: string; name: string }
const Stat = ({ value, unit, name }: StatProps) => (
  <div class="meta-stat">
    <span class="meta-stat-value">
      {value}
      {unit ? <span>{unit}</span> : null}
    </span>
    <span class="meta-stat-name">{name}</span>
  </div>
)

export default (() => {
  const TripMeta: QuartzComponent = ({
    cfg,
    fileData,
    allFiles,
    displayClass,
  }: QuartzComponentProps) => {
    const frontmatter = (fileData.frontmatter ?? {}) as Frontmatter
    const tags = (Array.isArray(frontmatter.tags) ? frontmatter.tags : []) as string[]
    if (!tags.some((tag) => SHOWN_FOR.includes(tag))) return null

    const slug = fileData.slug as FullSlug
    const row: (string | JSX.Element)[] = []
    const stats: JSX.Element[] = []

    const dateType = (fileData.defaultDateType as string | undefined) ?? "published"
    const date = (fileData.dates as Record<string, Date> | undefined)?.[dateType]
    if (date && tags.some((tag) => DATED.includes(tag))) {
      row.push(<time datetime={date.toISOString()}>{formatDate(date, cfg.locale)}</time>)
    }

    // Linked routes that have a page
    const routes = Array.isArray(frontmatter.route)
      ? frontmatter.route
      : frontmatter.route
        ? [frontmatter.route]
        : []
    const routeLinks = routes.flatMap((route) => {
      const name = String(route).replace(/\[\[|\]\]/g, "").split("|")[0]!
      const routeSlug = routeSlugs(allFiles).get(baseName(name))
      if (!routeSlug) return []
      return [
        <a href={resolveRelative(slug, routeSlug as FullSlug)} class="internal">
          {name.split("/").pop()}
        </a>,
      ]
    })
    if (routeLinks.length > 0) {
      row.push(<>{routeLinks.flatMap((link, i) => (i === 0 ? [link] : [", ", link]))}</>)
    }

    // Don't show the people if it's just me
    const people = (Array.isArray(frontmatter.people) ? frontmatter.people : []) as string[]
    if (people.length > 1 || (people[0] && people[0].toLowerCase() !== "adam")) {
      row.push(people.join(", "))
    }

    const { distance, gain, elevation, region } = frontmatter
    if (distance) stats.push(<Stat value={String(distance)} unit="km" name="Distance" />)
    if (gain) stats.push(<Stat value={String(gain)} unit="m" name="Elevation gain" />)
    if (elevation) stats.push(<Stat value={String(elevation)} unit="m" name="Summit elevation" />)
    if (region) stats.push(<Stat value={String(region)} name="Region" />)
    const dwyt = tagRating(tags, "dwyt")
    if (dwyt) stats.push(<Stat value={dwyt} name="DWYT rating" />)
    const kane = tagRating(tags, "kane")
    if (kane) stats.push(<Stat value={kane} name="Kane difficulty" />)

    const activityId = getActivityId(frontmatter)
    if (activityId) {
      stats.push(
        <a
          class="meta-stat"
          href={`https://www.strava.com/activities/${activityId}`}
          target="_blank"
          rel="noopener"
          aria-label="Strava"
        >
          <StravaIcon className="meta-stat-value" />
          <span class="meta-stat-name">Strava</span>
        </a>,
        <a
          class="meta-stat"
          href={`${pathToRoot(slug)}/${gpxSlug(slug)}.gpx`}
          target="_blank"
          rel="noopener"
          aria-label="GPX file"
        >
          <GpxIcon className="meta-stat-value" />
          <span class="meta-stat-name">GPX file</span>
        </a>,
      )
    }

    return (
      <>
        <div class={classNames(displayClass, "content-meta")}>
          {row.length > 0 ? (
            <div class="meta-row">{row.flatMap((item, i) => (i === 0 ? [item] : [" • ", item]))}</div>
          ) : null}
          {stats.length > 0 ? <div class="meta-stats">{stats}</div> : null}
        </div>
        <hr />
      </>
    )
  }

  TripMeta.css = style
  return TripMeta
}) satisfies QuartzComponentConstructor

const StravaIcon = ({ className }: { className: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" class={className}>
    <path
      fill="currentColor"
      d="M286.4 64L135 356L224.2 356L286.4 239.9L348.1 356L436.6 356L286.4 64zM436.6 356L392.7 444.2L348.1 356L280.5 356L392.7 576L504.2 356L436.6 356z"
    />
  </svg>
)

const GpxIcon = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
    <path d="M15 5.764v15" />
    <path d="M9 3.236v15" />
  </svg>
)
