import fs from "node:fs/promises"
import path from "node:path"
import { hashCode } from "./hash"

/**
 * Manifest entry for a cached asset
 */
export interface CacheManifestEntry {
  /** Path to the cached file (relative to cache directory) */
  filePath: string
  /** Hash of the dependency values */
  dependencyHash: number
}

/**
 * Manifest structure that tracks all cached assets
 */
export interface CacheManifest {
  entries: Record<string, CacheManifestEntry>
}

/**
 * Asset cache manager that tracks cached files and their dependencies.
 * Each instance manages a single cache directory.
 */
export class AssetCache {
  private cacheDir: string
  private manifestFileName: string
  private manifest: CacheManifest | null = null
  private manifestLoaded = false

  /**
   * Create a new asset cache instance for the given cache directory
   * @param cacheDir The cache directory path
   * @param manifestFileName The filename for the manifest file (default: ".manifest.json")
   */
  constructor(cacheDir: string, manifestFileName: string = ".manifest.json") {
    this.cacheDir = cacheDir
    this.manifestFileName = manifestFileName
  }

  /**
   * Get the path to the manifest file
   */
  private getManifestPath(): string {
    return path.join(this.cacheDir, this.manifestFileName)
  }

  /**
   * Compute a hash of the dependency values
   */
  private computeDependencyHash(dependencies: Record<string, unknown>): number {
    // Sort keys to ensure consistent hashing regardless of order
    const sortedKeys = Object.keys(dependencies).sort()
    const serialized = sortedKeys
      .map((key) => `${key}:${JSON.stringify(dependencies[key])}`)
      .join("|")
    return hashCode(serialized)
  }

  /**
   * Load the manifest from disk (or cache), or return an empty manifest if it doesn't exist
   */
  private async loadManifest(): Promise<CacheManifest> {
    // Return cached manifest if already loaded
    if (this.manifestLoaded && this.manifest !== null) {
      return this.manifest
    }

    // Load from disk
    const manifestPath = this.getManifestPath()
    let manifest: CacheManifest
    try {
      const content = await fs.readFile(manifestPath, "utf-8")
      manifest = JSON.parse(content) as CacheManifest
    } catch {
      manifest = { entries: {} }
    }

    // Cache it
    this.manifest = manifest
    this.manifestLoaded = true
    return manifest
  }

  /**
   * Save the manifest to disk and update the cache
   */
  private async saveManifest(manifest: CacheManifest): Promise<void> {
    const manifestPath = this.getManifestPath()
    await fs.mkdir(this.cacheDir, { recursive: true })
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8")

    // Update the cache
    this.manifest = manifest
    this.manifestLoaded = true
  }

  /**
   * Check if a cached file is valid based on its dependencies
   * @param filePath Path to the cached file (relative to cacheDir)
   * @param dependencies Current dependency values
   * @returns true if cache is valid, false if it should be invalidated
   */
  async isCacheValid(filePath: string, dependencies: Record<string, unknown>): Promise<boolean> {
    const manifest = await this.loadManifest()
    const entry = manifest.entries[filePath]

    if (!entry) {
      return false
    }

    const currentHash = this.computeDependencyHash(dependencies)
    return entry.dependencyHash === currentHash
  }

  /**
   * Update the manifest with a new cache entry
   * @param filePath Path to the cached file (relative to cacheDir)
   * @param dependencies Dependency values used to generate this cache entry
   */
  async updateCacheEntry(filePath: string, dependencies: Record<string, unknown>): Promise<void> {
    const manifest = await this.loadManifest()
    const dependencyHash = this.computeDependencyHash(dependencies)

    manifest.entries[filePath] = {
      filePath,
      dependencyHash,
    }

    await this.saveManifest(manifest)
  }

  /**
   * Remove a cache entry from the manifest
   * @param filePath Path to the cached file (relative to cacheDir)
   */
  async removeCacheEntry(filePath: string): Promise<void> {
    const manifest = await this.loadManifest()
    delete manifest.entries[filePath]
    await this.saveManifest(manifest)
  }

  /**
   * Read a cached file if it's valid, or return null if invalid or missing
   * @param filePath Path to the cached file (relative to cacheDir)
   * @param dependencies Current dependency values
   * @returns Buffer if cache is valid, null otherwise
   */
  async readCachedFile(
    filePath: string,
    dependencies: Record<string, unknown>,
  ): Promise<Buffer | null> {
    const isValid = await this.isCacheValid(filePath, dependencies)
    if (!isValid) {
      console.log(`Cache invalid ${filePath}`)
      return null
    }

    const fullPath = path.join(this.cacheDir, filePath)
    try {
      return await fs.readFile(fullPath)
    } catch {
      console.log(`No cached file ${filePath}`)
      return null
    }
  }

  /**
   * Read a cached text file if it's valid, or return null if invalid or missing
   * @param filePath Path to the cached file (relative to cacheDir)
   * @param dependencies Current dependency values
   * @returns string if cache is valid, null otherwise
   */
  async readCachedTextFile(
    filePath: string,
    dependencies: Record<string, unknown>,
  ): Promise<string | null> {
    const isValid = await this.isCacheValid(filePath, dependencies)
    if (!isValid) {
      console.log(`Cache invalid ${filePath}`)
      return null
    }

    const fullPath = path.join(this.cacheDir, filePath)
    try {
      return await fs.readFile(fullPath, "utf-8")
    } catch {
      console.log(`No cached file ${filePath}`)
      return null
    }
  }

  /**
   * Write a file to cache and update the manifest
   * @param filePath Path to the cached file (relative to cacheDir)
   * @param content Content to write (Buffer or string)
   * @param dependencies Dependency values used to generate this cache entry
   */
  async writeCachedFile(
    filePath: string,
    content: Buffer | string,
    dependencies: Record<string, unknown>,
  ): Promise<void> {
    const fullPath = path.join(this.cacheDir, filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })

    if (typeof content === "string") {
      await fs.writeFile(fullPath, content, "utf-8")
    } else {
      await fs.writeFile(fullPath, content)
    }

    await this.updateCacheEntry(filePath, dependencies)
  }
}
