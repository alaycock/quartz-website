import type {
  FullSlug,
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
  QuartzPluginData,
  SortFn,
} from "@quartz-community/types";
import { PageList } from "./PageList";
import { htmlToJsx } from "@quartz-community/utils/jsx";
import type { ComponentChildren } from "preact";
import type { Root } from "hast";
import { i18n } from "../i18n";
import style from "./styles/listPage.scss";
// Site patch: card listings
import CardListComponent from "../../../card-list/src/components/CardList";

interface FolderContentOptions {
  showFolderCount: boolean;
  showSubfolders: boolean;
  sort?: SortFn;
  // Site patch: show each page's date and tags in the listing
  showDates: boolean;
  showTags: boolean;
  // Site patch: folders (top-level slug segment, e.g. "notes") listed as cards (plugins/card-list)
  cardFolders: string[];
}

const defaultOptions: FolderContentOptions = {
  showFolderCount: true,
  showSubfolders: true,
  showDates: true,
  showTags: true,
  cardFolders: [],
};

const CardList = CardListComponent();

interface TrieNode {
  isFolder: boolean;
  children: TrieNode[];
  data: unknown;
  slug: string;
  displayName: string;
  findNode(path: string[]): TrieNode | undefined;
}

type PageEntry = QuartzPluginData & Record<string, unknown>;

function concatenateResources(
  ...resources: (string | string[] | undefined)[]
): string | string[] | undefined {
  const result = resources.filter((r): r is string | string[] => r !== undefined).flat();
  return result.length === 0 ? undefined : result;
}

function pagesFromTrie(folder: TrieNode, showSubfolders: boolean): PageEntry[] {
  return folder.children
    .map((node) => {
      const nodeData = node.data as PageEntry | null;
      if (nodeData) {
        if (nodeData.unlisted === true) return undefined;
        return nodeData;
      }

      if (node.isFolder && showSubfolders) {
        return {
          slug: node.slug as FullSlug,
          dates: mostRecentDatesFromChildren(node.children),
          frontmatter: { title: node.displayName, tags: [] },
        };
      }
      return undefined;
    })
    .filter((page): page is PageEntry => page !== undefined);
}

export function pagesFromAllFiles(
  allFiles: unknown[],
  folderSlug: string,
  showSubfolders: boolean,
): PageEntry[] {
  const folderPrefix = folderSlug.endsWith("/index")
    ? folderSlug.slice(0, -"index".length)
    : folderSlug.endsWith("/")
      ? folderSlug
      : folderSlug + "/";

  const directChildren: PageEntry[] = [];
  const subfolderFiles = new Map<string, PageEntry[]>();

  for (const file of allFiles as PageEntry[]) {
    if (file.unlisted === true) continue;
    const fileSlug = file.slug;
    if (!fileSlug || !fileSlug.startsWith(folderPrefix)) continue;

    const relativePath = fileSlug.slice(folderPrefix.length);
    if (!relativePath || relativePath === "index") continue;

    const segments = relativePath.split("/");

    if (segments.length === 1) {
      directChildren.push(file);
    } else if (showSubfolders) {
      const subfolderName = segments[0]!;
      if (!subfolderFiles.has(subfolderName)) {
        subfolderFiles.set(subfolderName, []);
      }
      subfolderFiles.get(subfolderName)!.push(file);
    }
  }

  for (const [subfolderName, files] of subfolderFiles) {
    const indexFile = files.find((f) => f.slug === `${folderPrefix}${subfolderName}/index`);
    if (indexFile) continue;

    directChildren.push({
      slug: `${folderPrefix}${subfolderName}/index` as FullSlug,
      dates: mostRecentDatesFromEntries(files),
      frontmatter: { title: subfolderName, tags: [] },
    });
  }

  return directChildren;
}

function mostRecentDatesFromChildren(children: TrieNode[]): PageEntry["dates"] {
  let maybeDates: PageEntry["dates"] | undefined;
  for (const child of children) {
    const childDates = (child.data as { dates?: PageEntry["dates"] } | null)?.dates;
    if (childDates) {
      if (!maybeDates) {
        maybeDates = { ...childDates };
      } else {
        if (childDates.created > maybeDates.created) maybeDates.created = childDates.created;
        if (childDates.modified > maybeDates.modified) maybeDates.modified = childDates.modified;
        if (childDates.published > maybeDates.published)
          maybeDates.published = childDates.published;
      }
    }
  }
  return maybeDates ?? { created: new Date(), modified: new Date(), published: new Date() };
}

function mostRecentDatesFromEntries(entries: PageEntry[]): PageEntry["dates"] {
  let maybeDates: PageEntry["dates"] | undefined;
  for (const entry of entries) {
    if (entry.dates) {
      if (!maybeDates) {
        maybeDates = { ...entry.dates };
      } else {
        if (entry.dates.created > maybeDates.created) maybeDates.created = entry.dates.created;
        if (entry.dates.modified > maybeDates.modified) maybeDates.modified = entry.dates.modified;
        if (entry.dates.published > maybeDates.published)
          maybeDates.published = entry.dates.published;
      }
    }
  }
  return maybeDates ?? { created: new Date(), modified: new Date(), published: new Date() };
}

export default ((opts?: Partial<FolderContentOptions>) => {
  const options: FolderContentOptions = { ...defaultOptions, ...opts };

  const FolderContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { tree, fileData, allFiles, cfg } = props;
    const ctx = props.ctx as { trie?: TrieNode } | undefined;
    const slug = (fileData as { slug?: string } | undefined)?.slug;

    if (!slug) return null;

    const trie = ctx?.trie;
    let allPagesInFolder: PageEntry[];

    if (trie) {
      const folder = trie.findNode(slug.split("/"));
      if (!folder) return null;
      allPagesInFolder = pagesFromTrie(folder, options.showSubfolders);
    } else {
      allPagesInFolder = pagesFromAllFiles(allFiles ?? [], slug, options.showSubfolders);
    }

    const cssClasses =
      ((fileData as { frontmatter?: { cssclasses?: string[] } } | undefined)?.frontmatter
        ?.cssclasses as string[] | undefined) ?? [];
    const classes = cssClasses.join(" ");
    const listProps = {
      ...props,
      sort: options.sort,
      showDates: options.showDates,
      showTags: options.showTags,
      allFiles: allPagesInFolder,
    };

    const hastRoot = tree as Root;
    const content =
      hastRoot.children.length === 0
        ? (fileData as { description?: unknown } | undefined)?.description
        : htmlToJsx(hastRoot);

    const asCards = options.cardFolders.includes(slug.split("/")[0]!);
    const pageListContent = (
      asCards ? CardList(listProps) : PageList(listProps)
    ) as unknown as ComponentChildren;

    return (
      <div class="popover-hint">
        <article class={classes}>
          <div class="markdown-preview-view markdown-rendered">{content}</div>
        </article>
        <div class="page-listing">
          {options.showFolderCount && (
            <p>
              {i18n(
                (cfg as { locale?: string } | undefined)?.locale ?? "en-US",
              ).pages.folderContent.itemsUnderFolder({
                count: allPagesInFolder.length,
              })}
            </p>
          )}
          {/* Site patch: rule between the folder's own content and its listing */}
          <hr />
          <div>{pageListContent}</div>
        </div>
      </div>
    );
  };

  FolderContent.css = concatenateResources(style, PageList.css, CardList.css);
  return FolderContent;
}) satisfies QuartzComponentConstructor;
