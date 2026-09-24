import fs from "node:fs/promises"
import path from "node:path"
import type { BuildCtx, ChangeEvent, FilePath, ProcessedContent } from "@quartz-community/types"
import { resolveRelative, simplifySlug } from "@quartz-community/utils/path"
import { legacySlug } from "./legacySlug"

/**
 * v5 lowercases URLs; alias-redirects' case redirects cover that. But the v4 site also
 * dropped commas and collapsed repeated dashes, so some v4 URLs differ by more than case
 * (e.g. "Notes/2025-04-15-Grand-Canyon" is now "notes/2025-04-15---grand-canyon").
 * This writes a redirect page at each of those v4 URLs.
 */
const redirectHtml = (title: string, url: string) => `<!DOCTYPE html>
<html lang="en-us">
<head>
<title>${title}</title>
<link rel="canonical" href="${url}">
<meta name="robots" content="noindex">
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${url}">
</head>
</html>
`

async function* redirects(ctx: BuildCtx, content: ProcessedContent[]): AsyncGenerator<FilePath> {
  for (const [, file] of content) {
    const { relativePath, slug } = file.data as { relativePath?: string; slug?: string }
    if (!relativePath?.endsWith(".md") || !slug) continue

    const from = legacySlug(relativePath)
    if (from.toLowerCase() === slug.toLowerCase()) continue // unchanged, or a case redirect

    const to = simplifySlug(slug as never)
    const fp = path.join(ctx.argv.output, `${from}.html`) as FilePath
    await fs.mkdir(path.dirname(fp), { recursive: true })
    await fs.writeFile(fp, redirectHtml(to, resolveRelative(from as never, to)))
    yield fp
  }
}

export default () => ({
  name: "LegacyRedirects",
  emit(ctx: BuildCtx, content: ProcessedContent[]) {
    return redirects(ctx, content)
  },
  partialEmit(
    ctx: BuildCtx,
    _content: ProcessedContent[],
    _resources: unknown,
    changeEvents: ChangeEvent[],
  ) {
    const changed = changeEvents.flatMap((event) =>
      event.type !== "delete" && event.file
        ? [[undefined, event.file] as unknown as ProcessedContent]
        : [],
    )
    return redirects(ctx, changed)
  },
})
