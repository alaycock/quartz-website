import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/disqus.inline"

export default (() => {
  const Disqus: QuartzComponent = ({ fileData }) => {
      return (
      <div 
        data-url={fileData.slug}
        data-identifier={fileData.slug}
        id="disqus_thread" />
      )
  }

  Disqus.afterDOMLoaded = script

  return Disqus
}) satisfies QuartzComponentConstructor
