import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { componentRegistry } from "./quartz/components/registry"

// Everything here must run before loadQuartzConfig()

// Explorer options that can't be expressed in YAML. These functions are stringified and
// run in the browser, so they must be self-contained. `node.data.date` comes from
// contentIndex.json (plugins/content-index `includeDates`).
type ExplorerNode = {
  isFolder: boolean
  slugSegment?: string
  slugSegments?: string[]
  displayName?: string
  data: { date?: string } | null
}

componentRegistry.setOptionOverrides("@quartz-community/explorer", {
  folderClickBehavior: "link",
  folderDefaultState: "open",
  useSavedState: false,
  // Folders first (Notes, Lists, Years), then pages newest first (except in Lists), then by name
  sortFn: (a: ExplorerNode, b: ExplorerNode) => {
    if (a.isFolder && b.isFolder) {
      const ordering: Record<string, number> = { notes: 0, lists: 1, years: 2 }
      return (ordering[a.slugSegment ?? ""] ?? 999) - (ordering[b.slugSegment ?? ""] ?? 999)
    }

    if (!a.isFolder && !b.isFolder) {
      // No helper functions here: esbuild's keepNames would wrap them in __name(), which
      // doesn't exist in the browser
      const inLists = a.slugSegments?.includes("lists") || b.slugSegments?.includes("lists")
      if (a.data?.date && b.data?.date && !inLists) {
        const aDate = new Date(a.data.date)
        const bDate = new Date(b.data.date)
        const sameDay = aDate.toDateString() === bDate.toDateString()
        if (!sameDay) return bDate.getTime() - aDate.getTime()
      }

      return (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
        numeric: true,
        sensitivity: "base",
      })
    }

    return !a.isFolder && b.isFolder ? 1 : -1
  },
  // Routes are only reachable from lists and trips; templates hold the .base files
  filterFn: (node: ExplorerNode) =>
    !node.isFolder || !["routes", "templates", "tags"].includes(node.slugSegment ?? ""),
  order: ["sort", "filter", "map"],
})

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()
