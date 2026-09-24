import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types"
import { pathToRoot } from "@quartz-community/utils/path"
import style from "./siteTitle.scss"

const SiteTitle: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => {
  const baseDir = pathToRoot(fileData.slug as never)
  return (
    <div class="page-title">
      <a href={baseDir}>
        <img src={`${baseDir}/static/logo.jpg`} alt={cfg.pageTitle} />
      </a>
    </div>
  )
}

SiteTitle.css = style

export default (() => SiteTitle) satisfies QuartzComponentConstructor
