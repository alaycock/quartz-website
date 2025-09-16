import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative, resolveCover, Cover } from "../util/path";
import { classNames } from "../util/lang"
import { Date } from "./Date"
import style from "./styles/cardList.scss"

type Frontmatter = QuartzComponentProps['fileData']['frontmatter'];
const getTitle = (frontmatter: Frontmatter): string | undefined => {
  if (frontmatter?.title && !frontmatter.title.match(/\d\d\d\d-\d\d-\d\d/)) {
    return frontmatter.title
  }

  return undefined;
}

// Inspo: https://toolbox.socratica.info/
export default (() => {
  const CardList: QuartzComponent = ({ allFiles, cfg, displayClass, fileData, ctx }: QuartzComponentProps) => {  
    const postFiles = allFiles.filter(
      file => file.frontmatter?.tags?.includes('post') || file.frontmatter?.tags?.includes('trip'))
      .sort((a, b) => (b.dates?.published.getTime() ?? 0) - (a.dates?.published.getTime() ?? 0) )


    return (
      <div class={classNames(displayClass, "card-list")}>
        {postFiles.map(({ dates, frontmatter, slug }) => 
          <Card
            date={dates?.published!}
            title={getTitle(frontmatter)}
            cover={resolveCover(fileData.slug!, frontmatter?.cover as string | undefined, ctx.allSlugs)}
            link={resolveRelative(fileData.slug!, slug!)}
            cfg={cfg}
          />
        )}
      </div>
    )
  };


  CardList.css = style

  return CardList
}) satisfies QuartzComponentConstructor

type CardProps = {
  cfg: QuartzComponentProps['cfg']
  date: Date
  title?: string
  cover: Cover
  link?: string
};
const Card = ({ date, cfg, cover, link, title }: CardProps) => {  
  return (
    <a
      href={link}
      class={cover.type}
      style={cover?.type === 'color' ? { backgroundColor: cover.value } : undefined }>
      <div class='clip'>
        {cover.type === 'image' ?
          <img src={cover.value} />
          : null
        }
        <div class="content">
          {title ? <p>{title}</p> : null}
          <Date date={date} locale={cfg.locale} />
        </div>
      </div>
    </a>
  )
};
