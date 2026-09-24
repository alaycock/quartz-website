import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"

export { legacySlug } from "../../legacy-redirects/src/legacySlug"

/**
 * Content-addressed file cache: a key is derived from everything that affects the
 * file, so an existing file is always valid and renames never cause refetches.
 */
export class FileCache {
  constructor(private dir: string) {}

  async read(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(this.dir, key))
    } catch {
      return null
    }
  }

  async write(key: string, content: Buffer | string): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true })
    await fs.writeFile(path.join(this.dir, key), content)
  }
}

export const hashKey = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16)

// --- v4 cache migration ------------------------------------------------------
// TODO(v5 migration): delete this section once the local and CI caches have been
// migrated. The v4 site cached files under v4 slugs (e.g. "Routes/Mount-Bourgeau-map.jpg")
// with a .manifest.json recording a hash of the inputs. On a cache miss, a matching v4
// entry is copied into the new cache instead of calling Strava/Mapbox again.

type LegacyManifest = { entries: Record<string, { dependencyHash: number }> }
const legacyManifests = new Map<string, Promise<LegacyManifest | null>>()

function legacyManifest(dir: string): Promise<LegacyManifest | null> {
  let manifest = legacyManifests.get(dir)
  if (!manifest) {
    manifest = fs
      .readFile(path.join(dir, ".manifest.json"), "utf8")
      .then((text) => JSON.parse(text) as LegacyManifest)
      .catch(() => null)
    legacyManifests.set(dir, manifest)
  }
  return manifest
}

// v4 quartz/util/hash.ts + assetCache.computeDependencyHash
function legacyDependencyHash(dependencies: Record<string, unknown>): number {
  const serialized = Object.keys(dependencies)
    .sort()
    .map((key) => `${key}:${JSON.stringify(dependencies[key])}`)
    .join("|")
  return serialized.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, 0)
}

export async function readLegacy(
  dir: string,
  legacyKey: string,
  dependencies: Record<string, unknown>,
): Promise<Buffer | null> {
  const entry = (await legacyManifest(dir))?.entries[legacyKey]
  if (!entry || entry.dependencyHash !== legacyDependencyHash(dependencies)) return null
  try {
    return await fs.readFile(path.join(dir, legacyKey))
  } catch {
    return null
  }
}
