import { pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import styles from "./styles/pageTitle.scss"

const PageTitle: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const baseDir = pathToRoot(fileData.slug!)
  return (
    <div class="page-title">
      <a href={baseDir}>
        <img src="/static/logo.jpg" />
      </a>
    </div>
  )
}

PageTitle.css = styles

export default (() => PageTitle) satisfies QuartzComponentConstructor
