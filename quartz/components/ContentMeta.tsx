import { Date, getDate } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { FullSlug, resolveRelative, FilePath, slugifyFilePath } from "../util/path"
import { Fragment, JSX } from "preact"
import style from "./styles/contentMeta.scss"

type ArbitraryFrontmatter = Record<string, string | string[]>

export default (() => {
  function ContentMetadata({ allFiles, cfg, fileData, displayClass }: QuartzComponentProps) {
    const text = fileData.text

    if (text) {
      const segments: (string | JSX.Element)[] = []

      if (fileData.dates && (fileData.frontmatter?.tags?.includes('post') || fileData.frontmatter?.tags?.includes('trip'))) {
        segments.push(<Date date={getDate(cfg, fileData)!} locale={cfg.locale} />)
      }

      if (fileData.frontmatter?.tags?.includes('trip')) {
        // TODO: Prettier rendering
        const { route, activity, people, gain, distance } = fileData.frontmatter as ArbitraryFrontmatter;

        if(route) {
          const routes = Array.isArray(route) ? route : [route];
          routes.forEach(route => {
            const strippedRoute = route.replace(/(\[{2})|(\]{2})/g, '');
            const absPath = `Routes/${slugifyFilePath(strippedRoute as FilePath)}`;
            const linkDest = resolveRelative(fileData.slug!, absPath as FullSlug)
            if (allFiles.some(file => file.slug === absPath)) {
              segments.push(
                <a href={linkDest} class="internal">
                  {strippedRoute}
                </a>
              )
            } else {
              segments.push(
                <a href={linkDest} class="internal broken">
                  {strippedRoute}
                </a>
              )
            }
          })
        }

        segments.push(...[
          activity,
          (people as string[]).join(', '),
          gain ? `${gain} m gain` : null,
          distance ? `${distance} km` : null
        ].filter(Boolean) as string[]);
      }

      if (fileData.frontmatter?.tags?.includes('route')) {
        // TODO: Prettier rendering
        const { elevation, region, DWYT, Kane, completed } = fileData.frontmatter as ArbitraryFrontmatter;
        const completeText = completed ? 'Done! ✅' : null;
        segments.push(...[
          elevation ? `${elevation} m` : null,
          region,
          DWYT ? `DWYT rated "${DWYT}"` : null,
          Kane ? `Kane "${Kane}"` : null,
          completeText
        ].filter(Boolean) as string[]);
      }

      if (segments.length === 0) {
        return null
      }

      const joinedSegments = segments
        .flatMap((segment, index) => index === segments.length -1 ? segment : [segment, ', ']);

      return (
        <p class={classNames(displayClass, "content-meta")}>
          {joinedSegments}
        </p>
      )
    } else {
      return null
    }
  }

  ContentMetadata.css = style

  return ContentMetadata
}) satisfies QuartzComponentConstructor
