import type { BasesEntry, ViewRenderer, ViewTypeRegistration } from "../../types";
import type { FullSlug } from "@quartz-community/types";
import { i18n } from "../../i18n";
import { entryCountMessage } from "../shared/count";
import {
  formatValue,
  getColumnLabel,
  getColumns,
  isEmptyValue,
  renderCellValue,
  resolveEntryPropertyValue,
} from "../shared/cell";
import { computeSummary } from "../shared/summary";
import { transformLink } from "@quartz-community/utils";

function groupEntries(
  entries: BasesEntry[],
  groupProperty: string | undefined,
  emptyLabel: string,
): Map<string, BasesEntry[]> | null {
  if (!groupProperty) return null;
  const groups = new Map<string, BasesEntry[]>();
  for (const entry of entries) {
    const rawValue = resolveEntryPropertyValue(groupProperty, entry);
    const label = isEmptyValue(rawValue) ? emptyLabel : formatValue(rawValue);
    const key = label || emptyLabel;
    const existing = groups.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }
  return groups.size > 0 ? groups : null;
}

function renderRow(
  entry: BasesEntry,
  columns: string[],
  view: Parameters<ViewRenderer>[0]["view"],
  slug: string,
  allSlugs: string[],
  linkResolution: "absolute" | "relative" | "shortest",
) {
  const transformOpts = { strategy: linkResolution, allSlugs: allSlugs as FullSlug[] };
  const ctx = { slug, allSlugs, linkResolution };
  return (
    <tr>
      {columns.map((column) => {
        const value = resolveEntryPropertyValue(column, entry);
        const display = formatValue(value);
        const isPrimary = column === "file.name" || column === "title";
        // Site patch: no columnSize widths; the content sets the column width
        return (
          <td data-value={display}>
            {isPrimary && !allSlugs.includes(entry.slug) ? (
              // Site patch: entries without a page (data-only notes) aren't linked
              <a class="internal broken">{display || entry.title}</a>
            ) : isPrimary ? (
              <a
                href={transformLink(slug as FullSlug, entry.slug, transformOpts)}
                class="internal internal-link"
                data-slug={entry.slug}
              >
                {display || entry.title}
              </a>
            ) : (
              renderCellValue(value, ctx)
            )}
          </td>
        );
      })}
    </tr>
  );
}

const TableView: ViewRenderer = ({
  entries,
  view,
  basesData,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution,
}) => {
  const columns = getColumns(view, basesData, entries);
  const summaries = view.summaries ?? {};
  const hasSummary = Object.keys(summaries).length > 0;
  const localeStrings = i18n(locale).components.bases;
  const groupProperty = view.groupBy?.property;
  const groupPropertyLabel = groupProperty ? getColumnLabel(groupProperty, basesData) : "";
  const groups = groupEntries(entries, groupProperty, localeStrings.uncategorized);

  return (
    <div class="bases-table-wrapper">
      <div class="bases-view-meta">
        {entryCountMessage(localeStrings, entries.length, total)}
      </div>
      <table class="bases-table" data-view-type="table">
        <thead>
          <tr>
            {columns.map((column) => {
              // Site patch: no columnSize widths; the content sets the column width
              return (
                <th data-column={column} data-sortable="true">
                  <span class="bases-table-header">{getColumnLabel(column, basesData)}</span>
                  <span class="bases-table-header-sort" aria-hidden="true" />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {groups
            ? Array.from(groups.entries()).map(([label, groupEntries]) => (
                <>
                  <tr class="bases-table-group-header">
                    <td colSpan={columns.length}>
                      {groupPropertyLabel && (
                        <span class="bases-table-group-property">{groupPropertyLabel} </span>
                      )}
                      <span class="bases-table-group-label">{label}</span>
                      <span class="bases-table-group-count">{groupEntries.length}</span>
                    </td>
                  </tr>
                  {groupEntries.map((entry) =>
                    renderRow(entry, columns, view, slug, allSlugs, linkResolution),
                  )}
                </>
              ))
            : entries.map((entry) =>
                renderRow(entry, columns, view, slug, allSlugs, linkResolution),
              )}
        </tbody>
        {hasSummary && (
          <tfoot>
            <tr class="bases-summary-row">
              {columns.map((column) => {
                const summary = summaries[column];
                if (!summary) return <td />;
                const values = entries.map((entry) => resolveEntryPropertyValue(column, entry));
                // Site patch: custom summary formulas from the .base's top-level `summaries`
                return <td>{computeSummary(values, summary, basesData.summaries)}</td>;
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export const tableViewRegistration: ViewTypeRegistration = {
  id: "table",
  name: "Table",
  icon: "table",
  render: TableView,
};

export { TableView };
