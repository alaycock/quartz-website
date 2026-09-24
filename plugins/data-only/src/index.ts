import fs from "node:fs"
import path from "node:path"
import { parse as parseYaml } from "yaml"
import { slugifyFilePath } from "@quartz-community/utils/path"
import type { BuildCtx, FilePath, FullSlug } from "@quartz-community/types"

/**
 * Data-only notes: every note is synced to the repo, but only notes with
 * `publish: true` are real pages. The rest (e.g. trip logs) are still parsed
 * so bases can query them, but:
 *
 * - they're marked `unlisted`, which hides them from the content index, sitemap,
 *   RSS, search, graph, explorer, backlinks, and folder/tag listings
 * - they're marked `dataOnly`, which the page dispatcher uses to skip emitting
 *   them (core patch in quartz/plugins/pageTypes/dispatcher.ts)
 * - their slugs are removed from `ctx.allSlugs`, so links to them render as
 *   broken links instead of pointing at pages that don't exist
 */
interface Options {
  /** Frontmatter key that must be `true` for a note to be published as a page */
  publishKey: string
}

const defaultOptions: Options = {
  publishKey: "publish",
}

function readFrontmatter(filePath: string): Record<string, unknown> | undefined {
  const text = fs.readFileSync(filePath, "utf8")
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return undefined
  try {
    return parseYaml(match[1]!) ?? undefined
  } catch {
    console.warn(`[data-only] could not parse frontmatter of ${filePath}; treating it as published`)
    return { unparseable: true }
  }
}

const isPublished = (frontmatter: Record<string, unknown> | undefined, opts: Options) =>
  frontmatter?.[opts.publishKey] === true || frontmatter?.unparseable === true

// Slugs are computed once per content directory, but must be removed from every
// ctx.allSlugs array: parsing runs in worker threads, each with its own copy.
const dataOnlySlugsByDirectory = new Map<string, Set<FullSlug>>()
const hiddenSlugArrays = new WeakSet<FullSlug[]>()

function dataOnlySlugs(ctx: BuildCtx, opts: Options): Set<FullSlug> {
  const directory = ctx.argv.directory
  let slugs = dataOnlySlugsByDirectory.get(directory)
  if (!slugs) {
    slugs = new Set()
    for (const fp of ctx.allFiles) {
      if (!fp.endsWith(".md")) continue
      if (!isPublished(readFrontmatter(path.join(directory, fp)), opts)) {
        slugs.add(slugifyFilePath(fp as FilePath))
      }
    }
    dataOnlySlugsByDirectory.set(directory, slugs)
  }
  return slugs
}

function hideDataOnlySlugs(ctx: BuildCtx, opts: Options) {
  const allSlugs = ctx.allSlugs
  if (hiddenSlugArrays.has(allSlugs)) return
  const hidden = dataOnlySlugs(ctx, opts)
  // Mutate in place: other plugins may already hold a reference to this array
  const visible = allSlugs.filter((slug) => !hidden.has(slug))
  allSlugs.splice(0, allSlugs.length, ...visible)
  hiddenSlugArrays.add(allSlugs)
}

export default (userOpts?: Partial<Options>) => {
  const opts: Options = { ...defaultOptions, ...userOpts }
  return {
    name: "DataOnly",
    // Transformer: runs in each parsing worker, before links are crawled
    markdownPlugins(ctx: BuildCtx) {
      hideDataOnlySlugs(ctx, opts)
      return []
    },
    htmlPlugins(ctx: BuildCtx) {
      hideDataOnlySlugs(ctx, opts)
      return [
        () => (_tree: unknown, file: { data: Record<string, unknown> }) => {
          const frontmatter = file.data.frontmatter as Record<string, unknown> | undefined
          if (!isPublished(frontmatter, opts)) {
            file.data.unlisted = true
            file.data.dataOnly = true
          }
        },
      ]
    },
    // Filter: runs in the main thread before emitting. Keeps every note (bases
    // need them), but hides data-only slugs from the emitters' ctx.allSlugs.
    shouldPublish(ctx: BuildCtx) {
      hideDataOnlySlugs(ctx, opts)
      return true
    },
  }
}

declare module "vfile" {
  interface DataMap {
    dataOnly?: boolean
  }
}
