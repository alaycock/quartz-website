/**
 * The v4 site's slugifyFilePath, including its patches (drop commas, collapse repeated
 * dashes) and without v5's lowercasing: "Notes/2025-04-15 - Grand Canyon.md" →
 * "Notes/2025-04-15-Grand-Canyon".
 */
export function legacySlug(relativePath: string): string {
  return relativePath
    .replace(/\.md$/, "")
    .split("/")
    .map((segment) =>
      segment
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, "")
        .replace(/,/g, "")
        .replace(/-+/g, "-"),
    )
    .join("/")
    .replace(/\/$/, "")
    .replace(/_index$/, "index")
}
