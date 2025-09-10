import { QuartzEmitterPlugin } from "../types"
import { FilePath, FullSlug, joinSegments, slugifyFilePath } from "../../util/path"
import { Readable } from "stream"
import path from 'path';
import { BuildCtx, BuildTimeTrieData } from "../../util/ctx"
import { QuartzPluginData } from "../vfile"
import fs from "node:fs/promises"

type Frontmatter = NonNullable<BuildTimeTrieData['frontmatter']>;

let imagesToGenerate = 100;

async function downloadMap(
  locations: string[][]
): Promise<Readable> {
  type ReducedLocations = [string, number, number]; 
  const [locationsString, latSum, lngSum] = locations.reduce(([accPinString, accLat, accLng], [lat, lng]): ReducedLocations => {
    const pinString = `pin-l-mountain+f74e4e(${lng},${lat})`;
    const newPinString = accPinString.length > 0 ? `${accPinString},${pinString}` : pinString;

    return [newPinString, accLat + parseFloat(lat), accLng + parseFloat(lng)];
  }, ['', 0, 0] as ReducedLocations);
  const centre = [latSum / locations.length, lngSum / locations.length] as const;

  // https://docs.mapbox.com/api/maps/static-images
  const mapboxToken = process.env.MAPBOX_TOKEN;
  const urlWithoutToken = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${locationsString}/${centre[1]},${centre[0]},10,0,0/256x256@2x?access_token=`
  const response = await fetch(`${urlWithoutToken}${mapboxToken}`);
  if (!response.ok) {
    console.log(urlWithoutToken, mapboxToken?.length);
    console.error(await response.text())
    throw new Error(`Could not fetch: ${urlWithoutToken}`);
  }
  return response.body as unknown as Readable;
}

const getLocationFromProperty = (location: unknown) => {
  if (location && typeof location === 'string') {
    const [lat, lng] = location.split(',').map(part => part.trim());
    if (lat && lng) {
      return [lat, lng];
    }
  }
  return null;
}

const getLocations = (frontmatter: Frontmatter, allRoutes: [FullSlug, Frontmatter][]) => {
  const { route } = frontmatter;
  const location = getLocationFromProperty(frontmatter.location)
  if (location) {
    return [location];
  }

  if (route && Array.isArray(route)) {
    return route.map((routeName) => {
      const strippedRoute = routeName.replace(/(\[{2})|(\]{2})/g, '');
      const routeSlug = `Routes/${slugifyFilePath(strippedRoute as FilePath)}`;
      const matchedRoute = allRoutes.find(([slug]) => slug === routeSlug);
      return getLocationFromProperty(matchedRoute?.[1].location);
    }).filter(Boolean) as string[][];
  }

  return [];
}

const cacheDir = "./quartz/.quartz-cache/maps";
async function processMap(
  ctx: BuildCtx,
  fileData: QuartzPluginData,
) {
  const newFileSlug = `${fileData.slug}-map`;
  const newFileExtension = '.jpg'
  const pathToCache = joinSegments(cacheDir, newFileSlug + newFileExtension) as FilePath

  // TODO: Add reading to helpers.ts
  let cacheContent;
  try {
    cacheContent = await fs.readFile(pathToCache)
  } catch (e) {
    // Cache miss, ignore error
  }

  if (!fileData.frontmatter) {
    return null;
  }

  const routeEntries = ctx.trie?.entries()
    .filter(([_name, node]) => node.data?.frontmatter?.tags?.includes('route'))
    .map(([_name, node]) => [node.slug, node.data!.frontmatter!] satisfies [FullSlug, Frontmatter]);

  const locations = getLocations(fileData.frontmatter, routeEntries ?? []);
  if (locations.length === 0) {
    return null;
  }
  
  const stream = cacheContent ?? await downloadMap(locations);
  if (!stream) {
    return null;
  }

  // Write cache
  if (!cacheContent) {
    // TODO: Add to helpers.ts
    const dir = path.dirname(pathToCache)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(pathToCache, stream)
  }

  // TODO: Add copying to helpers.ts
  const pathToMap = joinSegments('.', ctx.argv.output, newFileSlug + newFileExtension);
  const dir = path.dirname(pathToMap)
  await fs.mkdir(dir, { recursive: true })
  return fs.copyFile(pathToCache, pathToMap);
}

export const MapsEmitterName = "Maps"
export const Maps: QuartzEmitterPlugin = () => {
  return {
    name: MapsEmitterName,
    getQuartzComponents() {
      return []
    },
    async *emit(ctx, content, _resources) {
      for (const [_tree, vfile] of content) {
        // TODO: Remove when caching is working
        if (imagesToGenerate === 0) {
          continue;
        }

        const pathToMap = await processMap(ctx, vfile.data)
        if (pathToMap) {
          imagesToGenerate--;
          yield pathToMap;
        }
      }
    },
    async *partialEmit(ctx, _content, _resources, changeEvents) {
      // find all slugs that changed or were added
      for (const changeEvent of changeEvents) {
        if (!changeEvent.file) continue
        // TODO: Enable
        // yield processMap(ctx, changeEvent.file.data)
      }
    },
    externalResources: (ctx) => {
      return {};
      if (!ctx.cfg.configuration.baseUrl) {
        return {}
      }

      // TODO: Don't think I need this, but double check later
      // const baseUrl = ctx.cfg.configuration.baseUrl
      // return {
      //   additionalHead: [
      //     (pageData) => {
      //       const isRealFile = pageData.filePath !== undefined
      //       let userDefinedOgImagePath = pageData.frontmatter?.socialImage

      //       if (userDefinedOgImagePath) {
      //         userDefinedOgImagePath = isAbsoluteURL(userDefinedOgImagePath)
      //           ? userDefinedOgImagePath
      //           : `https://${baseUrl}/static/${userDefinedOgImagePath}`
      //       }

      //       const generatedOgImagePath = isRealFile
      //         ? `https://${baseUrl}/${pageData.slug!}-og-image.webp`
      //         : undefined
      //       const defaultOgImagePath = `https://${baseUrl}/static/og-image.png`
      //       const ogImagePath = userDefinedOgImagePath ?? generatedOgImagePath ?? defaultOgImagePath
      //       const ogImageMimeType = `image/${getFileExtension(ogImagePath) ?? "png"}`
      //       return (
      //         <>
      //           {!userDefinedOgImagePath && (
      //             <>
      //               <meta property="og:image:width" content={fullOptions.width.toString()} />
      //               <meta property="og:image:height" content={fullOptions.height.toString()} />
      //             </>
      //           )}

      //           <meta property="og:image" content={ogImagePath} />
      //           <meta property="og:image:url" content={ogImagePath} />
      //           <meta name="twitter:image" content={ogImagePath} />
      //           <meta property="og:image:type" content={ogImageMimeType} />
      //         </>
      //       )
      //     },
      //   ],
      // }
    },
  }
}
