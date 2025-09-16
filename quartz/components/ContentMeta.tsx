import { Date, getDate } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { findNearestSlug, resolveRelative, unWikilink } from "../util/path"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"

type ArbitraryFrontmatter = Record<string, string | string[]>

type StatProps = { value: string, unit?: string, statName: string };
const Stat = ({ value, unit, statName }: StatProps) => {
  return (
    <div class="meta-stat">
      <span class="meta-stat-value">
        {value}{unit ? <span>{unit}</span> : null}
      </span>
      <span class="meta-stat-name">{statName}</span>
    </div>
  )
};

export default (() => {
  function ContentMetadata({ cfg, fileData, displayClass, ctx }: QuartzComponentProps) {
    const text = fileData.text

    if (text) {
      const rowSegments: (string | JSX.Element)[] = [];
      const statSegments: JSX.Element[] = [];

      if (fileData.dates && (fileData.frontmatter?.tags?.includes('post') || fileData.frontmatter?.tags?.includes('trip'))) {
        rowSegments.push(<Date date={getDate(cfg, fileData)!} locale={cfg.locale} />)
      }

      if (fileData.frontmatter?.tags?.includes('trip')) {
        // TODO: Prettier rendering
        const { route, activity, people, gain, distance } = fileData.frontmatter as ArbitraryFrontmatter;

        if(route) {
          const routes = Array.isArray(route) ? route : [route];

          const initialValue = <></>;
          const routeElements = routes.reduce<JSX.Element>((acc, route, index) => {
            const linkText = unWikilink(route);
            const destSlug = findNearestSlug(linkText, ctx.allSlugs)
            const destLink = resolveRelative(fileData.slug!, destSlug);
            
            const exists = ctx.allSlugs.includes(destSlug);
            if (!exists) {
              return acc;
            }
            return (
              <>
                {acc}
                <a href={destLink} class={'internal'}>
                  {linkText}
                </a>
                {index === routes.length - 1 ? '' : ', '}
              </>
            );
          }, initialValue);
          if (routeElements !== initialValue) {
            rowSegments.push(routeElements);
          }
        }

        if (people && (people.length > 1 || people[0].toLowerCase() !== 'adam')) {
          rowSegments.push((people as string[]).join(', '))
        }

        
        if (distance) {
          statSegments.push(<Stat value={distance as string} unit="km" statName="Distance" />);
        }
        if (gain) {
          statSegments.push(<Stat value={gain as string} unit="m" statName="Elevation gain" />);
        }
        // if (activity) {
        //   statSegments.push(<Stat value={activity as string} statName="Activity" />);
        // }
      }

      if (fileData.frontmatter?.tags?.includes('route')) {
        // TODO: Prettier rendering
        const { elevation, region, DWYT, Kane, completed } = fileData.frontmatter as ArbitraryFrontmatter;
        const completeText = completed ? 'Done! ✅' : null;
        rowSegments.push(...[
          elevation ? `${elevation} m` : null,
          region,
          DWYT ? `DWYT rated "${DWYT}"` : null,
          Kane ? `Kane "${Kane}"` : null,
          completeText
        ].filter(Boolean) as string[]);
      }

      const joinedSegments = rowSegments
        .flatMap((segment, index) => index === rowSegments.length -1 ? segment : [segment, ' • ']);

      return (
        <>
          <div class={classNames(displayClass, "content-meta")}>
            {joinedSegments ? (
              <div class="meta-row">
                {joinedSegments}
              </div>
            ) : null}
            {statSegments.length > 0 ? (
              <div class="meta-stats">
                {statSegments}
              </div>
            ) : null}
            
          </div>
          <hr />
        </>
      )
    } else {
      return null
    }
  }

  ContentMetadata.css = style

  return ContentMetadata
}) satisfies QuartzComponentConstructor
