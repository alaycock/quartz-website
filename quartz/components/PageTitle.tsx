import { pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const PageTitle: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const baseDir = pathToRoot(fileData.slug!)
  return (
    <div class="page-title">
      <a href={baseDir}><img src="/static/logo.jpg" /></a>
    </div>
  )
}

PageTitle.css = `
.page-title {
  display: flex;
  max-width: 14rem;
}
.page-title a {
  border-radius: 50%;
  border: 4px solid var(--dark);
  width: 8rem;
  height: 8rem;
  margin: auto;
  overflow: hidden;
}
.page-title a:hover {
  filter: none;
}

.page-title img {
  margin: 0;
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
