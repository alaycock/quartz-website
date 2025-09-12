import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative, unWikilink, isFilePath, transformLink, FullSlug } from "../util/path";
import { classNames } from "../util/lang"
import { Date } from "./Date"
import style from "./styles/cardList.scss"

// TODO: This util should be part of frontmatter parsing
type Cover = {
  type: 'image' | 'color',
  value: string
}
const resolveCover = (baseSlug: FullSlug, cover: string | undefined, allSlugs: FullSlug[]): Cover => {
  if (cover) {
    const coverLink = unWikilink(cover);
    console.log(coverLink)
    if (isFilePath(coverLink)) {
      return {
        type: 'image',
        value: transformLink(baseSlug, coverLink, {
          strategy: 'shortest',
          allSlugs
        })
      };
    }

    if (cover.startsWith('#') && (cover.length === 4 || cover.length === 7)) {
      return {
        type: 'color',
        value: cover
      }
    }
  }

  return {
    type: 'color',
    value: '#c0ffee'
  }
}

type Frontmatter = QuartzComponentProps['fileData']['frontmatter'];
const getTitle = (frontmatter: Frontmatter): string | undefined => {
  if (frontmatter?.title && !frontmatter.title.match(/\d\d\d\d-\d\d-\d\d/)) {
    return frontmatter.title
  }

  return undefined;
}

// TODO:  Make a card view, that uses the "cover" frontmatter field has the image.
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
    <a href={link}>
      {cover.type === 'image' ? 
        <img src={cover.value} />
        : null
      }
      {cover.type === 'color' ?
        <div class="color" style={{ backgroundColor: cover.value }} />
        : null
      }
      <div class="content">
        {title ? <p>{title}</p> : null}
        <Date date={date} locale={cfg.locale} />
      </div>
    </a>
  )
};
