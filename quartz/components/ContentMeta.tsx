import { Date, getDate } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { findNearestSlug, resolveRelative, unWikilink } from "../util/path"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"

type ArbitraryFrontmatter = Record<string, string | string[]>

function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

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

    const { route, people, gain, distance, elevation, region, tags, strava } = fileData.frontmatter as ArbitraryFrontmatter;

    const dwytTag = (tags as string[])
      ?.find(tag => tag.startsWith('dwyt/'))
      ?.replace('dwyt/', '')
      ?.replace(/-/g, ' ')
    const dwyt = dwytTag ? toTitleCase(dwytTag) : undefined;

    const kaneTag = (tags as string[])
      ?.find(tag => tag.startsWith('kane/'))
      ?.replace('kane/', '')
      ?.replace(/-/g, ' ')
    const kane = kaneTag ? toTitleCase(kaneTag) : undefined;

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
    if (dwyt) {
      statSegments.push(<Stat value={dwyt as string} statName="DWYT rating" />);
    }
    if (kane) {
      statSegments.push(<Stat value={kane as string} statName="Kane difficulty" />);
    }
    if (strava) {
      const stravaValue = String(strava);
      const stravaHref = stravaValue.startsWith("http") ? stravaValue : `https://www.strava.com/activities/${stravaValue}`;
      statSegments.push(
        <a class="meta-stat" href={stravaHref} target="_blank" rel="noopener" aria-label="Strava">
          <StravaIcon className="meta-stat-value" />
          <span class="meta-stat-name">Strava</span>
        </a>
      );

      const gpxHref = `/${fileData.slug}-strava.gpx`;
      statSegments.push(
        <a class="meta-stat" href={gpxHref} target="_blank" rel="noopener" aria-label="GPX file">
          <GpxIcon className="meta-stat-value" />
          <span class="meta-stat-name">GPX file</span>
        </a>
      );
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

// Icons
const StravaIcon = ({ className }: { className: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" class={className}>
    <path fill="currentColor" d="M286.4 64L135 356L224.2 356L286.4 239.9L348.1 356L436.6 356L286.4 64zM436.6 356L392.7 444.2L348.1 356L280.5 356L392.7 576L504.2 356L436.6 356z"/>
  </svg>
);

const GpxIcon = ({ className }: { className: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={className}>
    <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/>
    <path d="M15 5.764v15"/>
    <path d="M9 3.236v15"/>
  </svg>
);
