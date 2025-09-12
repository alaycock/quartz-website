import { Date, getDate } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { findNearestSlug, resolveRelative, unWikilink } from "../util/path"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"

type ArbitraryFrontmatter = Record<string, string | string[]>

export default (() => {
  function ContentMetadata({ cfg, fileData, displayClass, ctx }: QuartzComponentProps) {
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
            const linkText = unWikilink(route);
            const destSlug = findNearestSlug(linkText, ctx.allSlugs)
            const destLink = resolveRelative(fileData.slug!, destSlug);
            
            const exists = ctx.allSlugs.includes(destSlug);
            const href = exists ? destLink : undefined;
            const cn = classNames(undefined, 'internal', exists ? '' : 'broken')

            segments.push(
              <a href={href} class={cn}>
                {linkText}
              </a>
            )
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
