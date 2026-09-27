import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types"
import { pathToRoot } from "@quartz-community/utils/path"
import { classNames } from "@quartz-community/utils/lang"
import { getActivityId, getGpxFile, getLocations, mapSlug } from "../locations"

// Sidebar map for pages the emitter generated a map for; links to Google Maps
export default (() => {
  const ActivityMap: QuartzComponent = ({
    ctx,
    fileData,
    allFiles,
    displayClass,
  }: QuartzComponentProps) => {
    const frontmatter = fileData.frontmatter as Record<string, unknown> | undefined
    if (!frontmatter || !fileData.slug) return null

    const locations = getLocations(fileData, allFiles)
    const contentFiles = (ctx as { allFiles?: string[] })?.allFiles ?? []
    const hasTrack = getActivityId(frontmatter) || getGpxFile(frontmatter, contentFiles)
    if (locations.length === 0 && !hasTrack) return null

    const slug = fileData.slug as string
    const [first] = locations
    const query = first
      ? `${first[0]}%2C${first[1]}`
      : encodeURIComponent(String(frontmatter.title ?? ""))
    const title = String(frontmatter.title ?? "")

    return (
      <div class={classNames(displayClass, "map")}>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${query}`}
          target="_blank"
          rel="noopener"
        >
          {/* The map may be missing if a download failed; hide the box rather than show a broken image */}
          <img
            src={`${pathToRoot(slug as never)}/${mapSlug(slug)}.jpg`}
            alt={`Map of ${title}`}
            onError={"this.closest('.map').remove()" as never}
          />
        </a>
      </div>
    )
  }

  ActivityMap.css = `
.map a:hover {
  filter: none;
}
`

  return ActivityMap
}) satisfies QuartzComponentConstructor
