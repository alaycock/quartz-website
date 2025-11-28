import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative } from "../util/path"
import { resolveCover, Cover } from "../util/coverImage"
import { classNames } from "../util/lang"
import { Date } from "./Date"
import style from "./styles/cardList.scss"

type Frontmatter = QuartzComponentProps["fileData"]["frontmatter"]
const getTitle = (frontmatter: Frontmatter): string | undefined => {
  if (frontmatter?.title && !frontmatter.title.match(/\d\d\d\d-\d\d-\d\d/)) {
    return frontmatter.title
  }

  return undefined
}

// Inspo: https://toolbox.socratica.info/
export const CardList: QuartzComponent = ({
  allFiles,
  cfg,
  displayClass,
  fileData,
  ctx,
  limit,
}: QuartzComponentProps) => {
  let postFiles = allFiles
    .filter(
      (file) =>
        file.frontmatter?.tags?.includes("post") || file.frontmatter?.tags?.includes("trip"),
    )
    .sort((a, b) => (b.dates?.published.getTime() ?? 0) - (a.dates?.published.getTime() ?? 0))

  let limitedFiles = postFiles
  let hasViewMore = false
  if (limit) {
    limitedFiles = postFiles.slice(0, limit)
    hasViewMore = limitedFiles.length < postFiles.length
  }

  return (
    <div class={classNames(displayClass, "card-list")}>
      {limitedFiles.map(({ dates, frontmatter, slug }) => (
        <Card
          date={dates?.published!}
          title={getTitle(frontmatter)}
          cover={resolveCover(
            fileData.slug!,
            frontmatter?.cover as string | undefined,
            ctx.allSlugs,
          )}
          link={resolveRelative(fileData.slug!, slug!)}
          cfg={cfg}
        />
      ))}
      {hasViewMore ? (
        <Card
          title="View all..."
          cover={resolveCover(fileData.slug!, undefined, ctx.allSlugs)}
          link="/notes"
          cfg={cfg}
        />
      ) : null}
    </div>
  )
}

CardList.css = style

type CardProps = {
  cfg: QuartzComponentProps["cfg"]
  date?: Date
  title?: string
  cover: Cover
  link?: string
}
const Card = ({ date, cfg, cover, link, title }: CardProps) => {
  return (
    <a
      href={link}
      class={cover.type}
      style={cover?.type === "color" ? { backgroundColor: cover.value } : undefined}
    >
      {cover.type === "image" ? <img src={cover.value} /> : null}
      <div class="content">
        {title ? <p>{title}</p> : null}
        {date ? <Date date={date} locale={cfg.locale} /> : null}
      </div>
    </a>
  )
}

type CardListOptions = {
  limit?: number
}
export default (({ limit }: CardListOptions) => {
  const CardListComponent = (props: QuartzComponentProps) => <CardList {...props} limit={limit} />
  CardListComponent.css = CardList.css
  return CardListComponent
}) satisfies QuartzComponentConstructor<CardListOptions>
