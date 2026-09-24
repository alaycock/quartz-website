import type {
  FilePath,
  FullSlug,
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types"
import { classNames } from "@quartz-community/utils/lang"
import { formatDate } from "@quartz-community/utils/date"
import {
  isFilePath,
  pathToRoot,
  resolveRelative,
  transformLink,
} from "@quartz-community/utils/path"
import style from "./cardList.scss"

// Inspo: https://toolbox.socratica.info/

type FileData = QuartzComponentProps["fileData"]
type Frontmatter = Record<string, unknown>

const CARD_TAGS = ["post", "trip"]
const PALETTE = ["#fdf6f2", "#e18a7a", "#c0d8e3", "#a78d8a", "#eeb9a2"]

const hashCode = (s: string) =>
  s.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, 0)

type Cover = { type: "image" | "color"; value: string }

// `cover:` frontmatter is an image (wikilink or path) or a hex colour; otherwise
// a palette colour picked from the page slug so it's stable between builds
function resolveCover(baseSlug: FullSlug, cover: unknown, allSlugs: FullSlug[]): Cover {
  if (typeof cover === "string" && cover) {
    const link = cover.replace(/\[\[|\]\]/g, "")
    if (isFilePath(link)) {
      return {
        type: "image",
        value: transformLink(baseSlug, link as FilePath, { strategy: "shortest", allSlugs }),
      }
    }
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cover)) return { type: "color", value: cover }
  }
  return { type: "color", value: PALETTE[Math.abs(hashCode(baseSlug)) % PALETTE.length]! }
}

// Dated notes are titled by their date; only show real titles
const cardTitle = (frontmatter: Frontmatter | undefined) => {
  const title = frontmatter?.title
  return typeof title === "string" && !/\d{4}-\d{2}-\d{2}/.test(title) ? title : undefined
}

const publishedTime = (file: FileData) =>
  (file.dates as { published?: Date } | undefined)?.published?.getTime() ?? 0

type CardProps = { href: string; cover: Cover; title?: string; date?: Date; locale: string }
const Card = ({ href, cover, title, date, locale }: CardProps) => (
  <a
    href={href}
    class={cover.type}
    style={cover.type === "color" ? { backgroundColor: cover.value } : undefined}
  >
    {cover.type === "image" ? <img src={cover.value} alt="" /> : null}
    <div class="content">
      {title ? <p>{title}</p> : null}
      {date ? <time datetime={date.toISOString()}>{formatDate(date, locale)}</time> : null}
    </div>
  </a>
)

interface Options {
  /** Show at most this many cards, followed by a "View more" card linking to `moreFolder` */
  limit?: number
  /** Folder the "View more" card links to */
  moreFolder: string
}

const defaultOptions: Options = {
  moreFolder: "notes",
}

/** Posts and trips from `allFiles` (all pages, or a folder's pages on folder pages), newest first */
export default ((userOpts?: Partial<Options>) => {
  const opts: Options = { ...defaultOptions, ...userOpts }

  const CardList: QuartzComponent = ({
    allFiles,
    cfg,
    ctx,
    displayClass,
    fileData,
  }: QuartzComponentProps) => {
    const slug = fileData.slug as FullSlug
    const allSlugs = ((ctx as { allSlugs?: FullSlug[] })?.allSlugs ?? []) as FullSlug[]
    const posts = allFiles
      .filter((file) => {
        const tags = (file.frontmatter as Frontmatter | undefined)?.tags
        return (
          !file.dataOnly &&
          file.unlisted !== true &&
          Array.isArray(tags) &&
          tags.some((tag) => CARD_TAGS.includes(tag))
        )
      })
      .sort((a, b) => publishedTime(b) - publishedTime(a))

    const shown = opts.limit ? posts.slice(0, opts.limit) : posts
    const locale = cfg.locale ?? "en-US"

    return (
      <div class={classNames(displayClass, "card-list")}>
        {shown.map((file) => {
          const frontmatter = file.frontmatter as Frontmatter | undefined
          return (
            <Card
              href={resolveRelative(slug, file.slug as FullSlug)}
              cover={resolveCover(slug, frontmatter?.cover, allSlugs)}
              title={cardTitle(frontmatter)}
              date={(file.dates as { published?: Date } | undefined)?.published}
              locale={locale}
            />
          )
        })}
        {shown.length < posts.length ? (
          <Card
            href={`${pathToRoot(slug)}/${opts.moreFolder}/`}
            cover={resolveCover(slug, undefined, allSlugs)}
            title="View more..."
            locale={locale}
          />
        ) : null}
      </div>
    )
  }

  CardList.css = style
  return CardList
}) satisfies QuartzComponentConstructor<Partial<Options>>
