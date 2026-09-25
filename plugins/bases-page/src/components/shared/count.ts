// Site patch: "58 entries" / "1 entry" when every entry is shown, otherwise
// "Showing 8 of 12 entries"
type CountStrings = { showingCount: string; entriesCount: string; entryCount: string };

export function entryCountMessage(strings: CountStrings, count: number, total: number): string {
  const template =
    count !== total ? strings.showingCount : count === 1 ? strings.entryCount : strings.entriesCount;
  return template.replace("{count}", String(count)).replace("{total}", String(total));
}
