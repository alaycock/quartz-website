import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { Content } from "./Content"

const IndexContent: QuartzComponent = (props: QuartzComponentProps) => {
  // TODO: Remove table from obsidian, generate it here based on most recent posts and trips
  // Make a card view, that uses the "cover" frontmatter field has the image.
  // Inspo: https://toolbox.socratica.info/
  return (
    <>
      <Content {...props} />
    </>
  );
}

export default (() => IndexContent) satisfies QuartzComponentConstructor
