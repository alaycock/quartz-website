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
  function ContentMetadata({ cfg, displayClass, fileData, ctx }: QuartzComponentProps) {
    // Only render frontmatter for posts, trips, and routes
    if (!fileData.frontmatter?.tags?.includes('post') && !fileData.frontmatter?.tags?.includes('trip') && !fileData.frontmatter?.tags?.includes('route')) {
      return null;
    }

    const rowSegments: (string | JSX.Element)[] = [];
    const statSegments: JSX.Element[] = [];

    // Only show dates for posts and trips
    if (fileData.dates && (fileData.frontmatter?.tags?.includes('post') || fileData.frontmatter?.tags?.includes('trip'))) {
      rowSegments.push(<Date date={getDate(cfg, fileData)!} locale={cfg.locale} />)
    }

    const { route, people, gain, distance, elevation, region, DWYT, Kane } = fileData.frontmatter as ArbitraryFrontmatter;

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

    // Don't show the 'people' if it's just me
    if (people && (people.length > 1 || people[0].toLowerCase() !== 'adam')) {
      rowSegments.push((people as string[]).join(', '))
    }
    if (distance) {
      statSegments.push(<Stat value={distance as string} unit="km" statName="Distance" />);
    }
    if (gain) {
      statSegments.push(<Stat value={gain as string} unit="m" statName="Elevation gain" />);
    }
    if (elevation) {
      statSegments.push(<Stat value={elevation as string} unit="m" statName="Summit elevation" />);
    }
    if (region) {
      statSegments.push(<Stat value={region as string} statName="Region" />);
    }
    if (DWYT) {
      statSegments.push(<Stat value={DWYT as string} statName="DWYT rating" />);
    }
    if (Kane) {
      statSegments.push(<Stat value={Kane as string} statName="Kane difficulty" />);
    }

    const joinedSegments = rowSegments
      .flatMap((segment, index) => index === rowSegments.length -1 ? segment : [segment, ' • ']);

    return (
      <>
        <div class={classNames(displayClass, "content-meta")}>
          {joinedSegments.length > 0 ? (
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
  }

  ContentMetadata.css = style

  return ContentMetadata
}) satisfies QuartzComponentConstructor
