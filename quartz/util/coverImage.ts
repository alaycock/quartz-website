import { FullSlug, isFilePath, transformLink, unWikilink } from "./path"
import { hashCode } from "./hash"

const palette = ["#fdf6f2", "#e18a7a", "#c0d8e3", "#a78d8a", "#eeb9a2"]

// TODO: This util should be part of frontmatter parsing
export type Cover = {
  type: "image" | "color"
  value: string
}
export function resolveCover(
  baseSlug: FullSlug,
  cover: string | undefined,
  allSlugs: FullSlug[],
): Cover {
  if (cover) {
    const coverLink = unWikilink(cover)
    if (isFilePath(coverLink)) {
      return {
        type: "image",
        value: transformLink(baseSlug, coverLink, {
          strategy: "shortest",
          allSlugs,
        }),
      }
    }

    if (cover.startsWith("#") && (cover.length === 4 || cover.length === 7)) {
      return {
        type: "color",
        value: cover,
      }
    }
  }

  return {
    type: "color",
    value: palette[hashCode(baseSlug) % palette.length],
  }
}
