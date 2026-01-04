import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { type Options } from "./quartz/components/Explorer"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.ConditionalRender({
      component: Component.CardList({ limit: 7 }),
      condition: (page) => page.fileData.slug === "index",
    }),
  ],
  footer: Component.Footer(),
}

const explorerOptions: Partial<Options> = {
  folderClickBehavior: "link",
  folderDefaultState: "open",
  useSavedState: false,
  sortFn: (a, b) => {
    if (a.isFolder && b.isFolder) {
      var ordering: Record<string, number> = { Notes: 0, Lists: 1, Years: 2 }
      return (ordering[a.displayName] ?? 999) - (ordering[b.displayName] ?? 999)
    }

    if (!a.isFolder && !b.isFolder) {
      if (
        a.data?.date &&
        b.data?.date &&
        !a.allSlugSegments.includes("Lists") &&
        !b.allSlugSegments.includes("Lists")
      ) {
        const aDate = new Date(a.data.date)
        const bDate = new Date(b.data.date)
        aDate.setHours(0, 0, 0, 0)
        bDate.setHours(0, 0, 0, 0)
        const difference = bDate.getTime() - aDate.getTime()
        if (difference != 0) {
          return b.data?.date.getTime() - a.data?.date.getTime()
        }
      }

      return a.displayName.localeCompare(b.displayName, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    }

    if (!a.isFolder && b.isFolder) {
      return 1
    } else {
      return -1
    }
  },
  filterFn: (node) => {
    if (node.isFolder) {
      return !["Routes"].includes(node.displayName)
    }
    return true
  },
  order: ["sort", "filter", "map"],
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
      ],
    }),
    Component.Explorer(explorerOptions),
    Component.DesktopOnly(Component.TableOfContents()),
  ],
  right: [Component.Map(), Component.Backlinks()],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
      ],
    }),
    Component.Explorer(explorerOptions),
  ],
  right: [],
}
