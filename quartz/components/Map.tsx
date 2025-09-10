import { QuartzComponent, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { FilePath, slugifyFilePath } from "../util/path";

const getLocationFromProperty = (location: unknown) => {
  if (location && typeof location === 'string') {
    const [lat, lng] = location.split(',').map(part => part.trim());
    if (lat && lng) {
      return [lat, lng];
    }
  }
  return null;
}

const getLocations = (frontmatter: NonNullable<QuartzComponentProps['fileData']['frontmatter']>, allRoutes: QuartzComponentProps['allFiles']) => {
  const { route } = frontmatter;
  const location = getLocationFromProperty(frontmatter.location)
  if (location) {
    return [location];
  }

  if (route && Array.isArray(route)) {
    return route.map((routeName) => {
      const strippedRoute = routeName.replace(/(\[{2})|(\]{2})/g, '');
      const routeSlug = `Routes/${slugifyFilePath(strippedRoute as FilePath)}`;
      const matchedRoute = allRoutes.find(searchRoute => searchRoute.slug === routeSlug);
      return getLocationFromProperty(matchedRoute?.frontmatter?.location);
    }).filter(Boolean) as string[][];
  }

  return [];
}

export default (() => {
  const Map: QuartzComponent = ({ allFiles, displayClass, fileData }: QuartzComponentProps) => {

    if (!fileData.frontmatter) {
      return null;
    }

    const imgSrc = `/${fileData.slug}-map.jpg`;

    // Dedupe this with maps.ts
    const routes = allFiles.filter(file => file.frontmatter?.tags?.includes('route'));
    const locations = getLocations(fileData.frontmatter, routes);
    if (locations.length === 0) {
      return null;
    }

    // Dedupe this with maps.ts
    type ReducedLocations = [number, number]; 
    const [latSum, lngSum] = locations.reduce(([accLat, accLng], [lat, lng]): ReducedLocations => {
      return [accLat + parseFloat(lat), accLng + parseFloat(lng)];
    }, [0, 0] as ReducedLocations);
    const centre = [latSum / locations.length, lngSum / locations.length] as const;

    // https://developers.google.com/maps/documentation/urls/get-started#search-action
    const linkHref = `https://www.google.com/maps/search/?api=1&query=${centre[0]}%2C${centre[1]}`;

    return (
      <div class={classNames(displayClass, "map")}>
        <a href={linkHref} target="_blank">
          <img src={imgSrc} class="map-image" />
        </a>
      </div>
    )
  }

  return Map;
});
