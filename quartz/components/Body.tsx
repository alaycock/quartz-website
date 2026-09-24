import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const Body: QuartzComponent = ({ children, fileData }: QuartzComponentProps) => {
  // Site patch: list pages (wide tables) move the right sidebar under the content on desktop
  const tags = (fileData.frontmatter?.tags ?? []) as string[]
  const className = tags.includes("list") ? "collapse-sidebar-desktop" : undefined
  return (
    <div id="quartz-body" class={className}>
      {children}
    </div>
  )
}

export default (() => Body) satisfies QuartzComponentConstructor
