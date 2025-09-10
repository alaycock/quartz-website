import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

type ConditionalRenderConfig = {
  component: QuartzComponent
  elseComponent?: QuartzComponent
  condition: (props: QuartzComponentProps) => boolean
}

export default ((config: ConditionalRenderConfig) => {
  const ConditionalRender: QuartzComponent = (props: QuartzComponentProps) => {
    if (config.condition(props)) {
      return <config.component {...props} />
    } else if (config.elseComponent) {
      return <config.elseComponent {...props} />
    }

    return null
  }

  ConditionalRender.afterDOMLoaded = config.component.afterDOMLoaded
  ConditionalRender.beforeDOMLoaded = config.component.beforeDOMLoaded
  ConditionalRender.css = config.component.css

  return ConditionalRender
}) satisfies QuartzComponentConstructor<ConditionalRenderConfig>
