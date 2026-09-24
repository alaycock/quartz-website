import type { ViewRenderer, ViewTypeRegistration } from "../../types";
import type { FullSlug } from "@quartz-community/types";
import { i18n } from "../../i18n";
import {
  formatValue,
  isEmptyValue,
  resolveEntryPropertyValue,
} from "../shared/cell";
import { transformLink } from "@quartz-community/utils";

function formatMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}){1,2}$/i;
const WIKILINK_RE = /^\[\[(.+?)(?:\|.*)?\]\]$/;

export interface ResolveImageOpts {
  slug: string;
  allSlugs: string[];
  linkResolution: "absolute" | "relative" | "shortest";
}

export function resolveImageSrc(
  raw: string,
  opts: ResolveImageOpts,
): { src: string; isColor: boolean } {
  if (!raw) return { src: "", isColor: false };

  if (HEX_COLOR_RE.test(raw)) {
    return { src: raw, isColor: true };
  }

  const wikiMatch = WIKILINK_RE.exec(raw);
  if (wikiMatch?.[1]) {
    const target = wikiMatch[1].trim();
    const resolved = transformLink(opts.slug as FullSlug, target, {
      strategy: opts.linkResolution,
      allSlugs: opts.allSlugs as FullSlug[],
    });
    return { src: String(resolved), isColor: false };
  }

  return { src: raw, isColor: false };
}

// Site patch: the whole card is a link, and links can't nest, so card values render as text:
// "[[Notes/2025-04-15|Grand Canyon]]" → "Grand Canyon", "[[Mount Bourgeau]]" → "Mount Bourgeau"
function cardText(value: unknown): string {
  return formatValue(value)
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_, target: string) => target.split("/").pop() ?? target);
}

const CardsView: ViewRenderer = ({
  entries,
  view,
  basesData,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution,
}) => {
  const imageProperty = typeof view.image === "string" ? view.image : undefined;
  // Site patch: like Obsidian, a card shows the view's `order` properties (values only, the
  // first as the card title) instead of the note title plus labelled properties. With no
  // `order`, it shows the note title.
  const cardColumns =
    view.order && view.order.length > 0
      ? view.order.filter((column) => column !== imageProperty)
      : [];
  const localeStrings = i18n(locale).components.bases;
  const cardSize = view.cardSize;
  const aspectRatio = view.imageAspectRatio ?? view.cardAspect;
  const imageFit = view.imageFit === "contain" ? "contain" : "cover";
  const gridStyle =
    typeof cardSize === "number" && cardSize > 0
      ? { gridTemplateColumns: `repeat(auto-fit, minmax(${cardSize}px, 1fr))` }
      : undefined;
  const imageOpts: ResolveImageOpts = { slug, allSlugs, linkResolution };
  const transformOpts = { strategy: linkResolution, allSlugs: allSlugs as FullSlug[] };

  return (
    <div class="bases-cards-wrapper">
      <div class="bases-view-meta">
        {formatMessage(localeStrings.showingCount, {
          count: entries.length,
          total,
        })}
      </div>
      <div class="bases-cards" style={gridStyle}>
        {entries.map((entry) => {
          const imageValue = imageProperty
            ? resolveEntryPropertyValue(imageProperty, entry)
            : undefined;
          const rawImage = imageValue ? String(imageValue) : "";
          const { src: imageSrc, isColor } = resolveImageSrc(rawImage, imageOpts);
          // Site patch: Obsidian's imageAspectRatio is height / width (0.5 = wide); CSS
          // aspect-ratio is width / height
          const imageAspect =
            typeof aspectRatio === "number" && aspectRatio > 0
              ? { aspectRatio: String(1 / aspectRatio) }
              : undefined;
          // Site patch: entries without a page (data-only notes) aren't linked
          const hasPage = allSlugs.includes(entry.slug);
          const href = hasPage ? transformLink(slug as FullSlug, entry.slug, transformOpts) : undefined;
          return (
            <a
              href={href}
              class={hasPage ? "internal internal-link bases-card" : "internal broken bases-card"}
              data-slug={entry.slug}
            >
              {imageSrc && !isColor && (
                <div class="bases-card-image" style={imageAspect}>
                  <img
                    src={imageSrc}
                    alt={entry.title}
                    loading="lazy"
                    style={{ objectFit: imageFit }}
                  />
                </div>
              )}
              {imageSrc && isColor && (
                <div
                  class="bases-card-image bases-card-color"
                  style={{ ...imageAspect, backgroundColor: imageSrc }}
                />
              )}
              {/* Site patch: keep an empty image area when a card has no image, like Obsidian */}
              {imageProperty && !imageSrc && (
                <div class="bases-card-image bases-card-no-image" style={imageAspect} />
              )}
              <div class="bases-card-body">
                {cardColumns.length === 0 ? (
                  <span class="bases-card-title">{entry.title}</span>
                ) : (
                  cardColumns.map((column, index) => {
                    const value = resolveEntryPropertyValue(column, entry);
                    if (isEmptyValue(value)) return null;
                    return (
                      <span class={index === 0 ? "bases-card-title" : "bases-card-value"}>
                        {column === "file.name" ? entry.title : cardText(value)}
                      </span>
                    );
                  })
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
};

export const cardsViewRegistration: ViewTypeRegistration = {
  id: "cards",
  name: "Cards",
  icon: "layout-grid",
  render: CardsView,
};

export { CardsView };
