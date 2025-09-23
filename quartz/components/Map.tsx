import { QuartzComponent, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { findNearestSlug, unWikilink } from "../util/path";

const getLocationFromProperty = (location: unknown) => {
  if (location && typeof location === 'string') {
    const [lat, lng] = location.split(',').map(part => part.trim());
    if (lat && lng) {
      return [lat, lng];
    }
  }
  return null;
}

const getLocations = (
  frontmatter: NonNullable<QuartzComponentProps['fileData']['frontmatter']>,
  allSlugs: QuartzComponentProps['ctx']['allSlugs'],
  allFiles: QuartzComponentProps['allFiles']
) => {
  const { route } = frontmatter;
  const location = getLocationFromProperty(frontmatter.location)
  if (location) {
    return [location];
  }

  if (route && Array.isArray(route)) {
    return route.map((routeName) => {
      const linkText = unWikilink(routeName);
      const routeSlug = findNearestSlug(linkText, allSlugs)
      const matchedRoute = allFiles.find(searchRoute => searchRoute.slug === routeSlug);
      return getLocationFromProperty(matchedRoute?.frontmatter?.location);
    }).filter(Boolean) as string[][];
  }

  return [];
}

export default (() => {
  const Map: QuartzComponent = ({ allFiles, displayClass, fileData, ctx }: QuartzComponentProps) => {

    if (!fileData.frontmatter) {
      return null;
    }

    const imgSrc = `/${fileData.slug}-map.jpg`;

    // Dedupe this with maps.ts
    const routes = allFiles.filter(file => file.frontmatter?.tags?.includes('route'));
    const locations = getLocations(fileData.frontmatter, ctx.allSlugs, routes);
    if (locations.length === 0 && !fileData.frontmatter?.strava) {
      return null;
    }

    // Just use the first one
    const location = locations[0];

    // https://developers.google.com/maps/documentation/urls/get-started#search-action
    // TODO: The title can be wrong, it'd be ideal for the Strava location to be baked into the frontmatter...
    let linkHref = `https://www.google.com/maps/search/?api=1&query=${fileData.frontmatter?.title}`
    if (location) {
      linkHref = `https://www.google.com/maps/search/?api=1&query=${location[0]}%2C${location[1]}`;
    }

    return (
      <div class={classNames(displayClass, "map")}>
        <a href={linkHref} target="_blank">
          <img src={imgSrc} />
        </a>
      </div>
    )
  }

  Map.css = `
  .map a:hover {
    filter: none;
  }
  `

  return Map;
});
