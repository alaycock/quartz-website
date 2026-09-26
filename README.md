# Adam Laycock

This repo is templated off of [Quartz](https://quartz.jzhao.xyz/) and is the code for my personal website https://adamlaycock.ca

If you are trying to use this as a template for your own personal site through Obsidian, you will run into challenges when it comes to Obsidian's bases feature. Bases aren't supported by Quartz yet, so I had to fork [Quartz-syncer](https://github.com/alaycock/quartz-syncer) to shoehorn-in a customer renderer for bases. If you want to try out the Obsidian plugin, be sure to disable caching when publishing your vault, otherwise your bases will be out of date.

If you are exploring this repo from a code-quality perspective, keep in mind that this is built off of a template and I haven't put in much effort to keep things tidy, eg, no linting or prettier. Maybe someday, but I'm currently prioritizing function over form!

## Environment Variables

This project uses the Strava API to get GPX routes and Maps for trips on Strava. See STRAVA_SETUP.md for more setup details.

Additionally, this project uses Mapbox to render maps. You can create a Mapbox token here: https://account.mapbox.com/access-tokens

Once you have all those details, create a `.env` file in the project root with the following variables:

```bash
# Strava API Configuration
STRAVA_CLIENT_ID=your_client_id_here
STRAVA_CLIENT_SECRET=your_client_secret_here
STRAVA_BOOTSTRAP_REFRESH_TOKEN=your_bootstrap_refresh_token_here

# Mapbox Configuration (for maps)
MAPBOX_TOKEN=your_mapbox_token_here
```

## Importing Strava activities

`npm run strava:import` creates trip notes in the Obsidian vault for recent Strava activities (`scripts/strava-import.mjs`). It refreshes the Strava token (same as the build), lists your activities since the newest trip note with a `strava` id, and creates a note for each new hike, trail run, ski tour, cross-country ski, mountain bike ride or climb through the Obsidian CLI, from the "Trip Template".

```bash
npm run strava:import -- --dry-run            # show what would be created
npm run strava:import                         # create the notes
npm run strava:import -- --since 2026-08-01   # choose the start date
```

- Filled in: `date` (and `end date` for multi-day activities), `distance`, `gain`, `strava`, `tags` (`trip` + activity), `people: [Adam]`, and `title` when the activity has a real name (not "Morning Hike" etc.). Left for you: `route`, other `people`, `cover`, and the write-up. Notes start as `publish: false`.
- Skipped: activities already in the vault (by `strava` id), and days that already have a trip note without a `strava` id (listed so you can link them by hand).
- Requires Obsidian to be running with its CLI working: a current installer from [obsidian.md/download](https://obsidian.md/download) (old installers only print "installer is out of date", even when the app itself is updated) and the CLI enabled in Settings → General. The script calls `/Applications/Obsidian.app/Contents/MacOS/obsidian`; override with `OBSIDIAN_CLI`. `OBSIDIAN_VAULT` / `OBSIDIAN_VAULT_PATH` override the vault (default `adamlaycock.ca` in `~/Documents/notes`).

## Quartz v5 migration

The `v5` branch is a fresh start from [upstream Quartz v5](https://github.com/jackyzha0/quartz/tree/v5) (upstream commit `97a2d05f`). The old site is tagged `v4-final`. It was forked from upstream v4 at `0a57d032`, which is the base to diff against when porting customizations.

Status key: `[ ]` todo · `[~]` in progress. Done items are removed; see git history.

### 1. Bases (main goal)

How it works: bases are rendered by a vendored copy of [bases-page](https://github.com/quartz-community/bases-page) in `plugins/bases-page` (upstream 1.0.0, `5c729d1`). Every change is marked `// Site patch:`, and the first commit touching that folder is the unmodified upstream code, so `git diff` against it shows every patch. Notes without `publish: true` are handled by `plugins/data-only`.

- [ ] **Days total on Year pages is empty**: the Days formula ends in `.toString().title()`, so the column is text ("3 Days") and the `Days` summary can't add it up (same in Obsidian). Make the formula return the duration (`date - (if(note["end date"], note["end date"], date) + "1d")`, displays "3 days") to get the total back.
- [ ] By Year: trips on the same day can come out in a different order (the view only sorts by `formula.Date`). Add a secondary sort in the `.base` if it matters.
- [ ] Year pages: remove the summary ("sum") from the Date column. The By Year view sets `formula.Date: Filled` in `Trips.base`.
- [ ] bases-page list, gallery and board views still link entries without pages (only table and cards are patched; the site doesn't use the others yet)
- [ ] Offer the bases-page fixes upstream as PRs (see "Upstream candidates" below)
- Note: with `allNotesPublishableByDefault` on, Quartz Syncer writes `publish: true` into notes that have no `publish` key, so Quartz can't tell "missing" from "true". Notes need an explicit `publish: false` (the Trip Template has one) to stay data-only.

### 2. Strava static maps

- [ ] GPX times are anchored at build time (`Date.now()`), inherited from v4: Strava streams only have offsets from the start. Fetch the activity's `start_date` if accurate times matter.

### 3. Layout and components

- [x] Card order differs from Obsidian: the Index view sorts by `file.ctime`, which in Obsidian is the vault file's creation time on disk; the site only has the `created` frontmatter. Sort by `date` in the `.base` for the same order in both.

### 4. Core patches (check each; re-apply only if still needed)

### 5. CI and cutover

- [ ] (later) The Strava "download previous token" step never finds a token (`download-artifact` only sees the current run without `run-id`/`github-token`), so every build refreshes from `STRAVA_BOOTSTRAP_REFRESH_TOKEN`. Same as v4; fine as long as that refresh token stays valid.

### Upstream candidates

Changes made locally that could become PRs. Each is marked `// Site patch:` in the code.

**[quartz-community/bases-page](https://github.com/quartz-community/bases-page)** (`plugins/bases-page`; diff against commit `290938d9` to see every patch):

- [ ] View name matching for embeds (`pageType.ts`, `renderBasesInline`): OFM slugifies the `#block` of `![[X.base#View]]` with github-slugger, but `normalize()` only lowercases and dashes spaces, so views with punctuation ("Don't waste your time") aren't found. Fix: normalize with github-slugger. Watch the naming: `slug` is shadowed by a local variable there.
- [ ] `link(this.file)` in embedded bases (`compiler/functions.ts`): `this.file` is a plain `{name, path, folder, ext}` object, not a full file value, so `link()` returned `[[[object Object]]]`. Fix: accept any object with a `path`.
- [ ] `list.contains(link)` (`compiler/functions.ts`): compare wikilinks by target note, so `[[Routes/Mount Bourgeau]]` matches `[[Mount Bourgeau]]` (Obsidian resolves links before comparing).
- [ ] Bare column names (`components/shared/cell.tsx`, `views/table.tsx`): `properties.note.x.displayName` and `columnSize.note.x` should apply when a view's `order` lists `x`, as in Obsidian.
- [ ] Date-typed frontmatter (`resolver.ts`): Quartz parses YAML with js-yaml's JSON schema, so dates are strings and `date.year`, `.format()`, date sorting and date arithmetic don't work. Fix: convert ISO date strings to `Date`s; sort `Date`s by time (`compareSort`); render `Date` cells (`cell.tsx`). Upstream may prefer reading property types from `.obsidian/types.json` over pattern matching.
- [ ] `date + "8h"` / `date - "1d"` (`compiler/interpreter.ts`): Obsidian accepts a duration string on the right of a date.
- [ ] `==` / `!=` between numbers and numeric strings (`compiler/interpreter.ts`): Obsidian compares by value (`date.year == this.file.name`).
- [ ] `#`-prefixed `tags` property (`resolver.ts`): matches Obsidian, but inferred (see above). Confirm before proposing.
- [ ] Links to entries that have no page (`components/shared/links.tsx`, `cell.tsx`, `views/table.tsx`, `views/cards.tsx`): render as `<a class="internal broken">` instead of linking to a 404. Still to do for list, gallery and board views.
- [ ] Opt-in for querying `unlisted` pages (`resolver.ts`): we include notes with `dataOnly`. Upstream would need a general option (e.g. `includeUnlisted`, or a per-page flag).
- [ ] Regex literals (`compiler/lexer.ts`, `parser.ts`): `/pattern/flags` wherever an operand can start (so `a / b` is still division); `replace()` accepts a RegExp
- [ ] Durations (`compiler/duration.ts`, `interpreter.ts`, `functions.ts`): date − date is a duration; date ± duration, duration ± duration, × and ÷ by numbers, unary minus, comparisons; `.days`/`.hours`/… fields; `toString()` humanized like Obsidian/moment ("a day", "3 days"); `duration()` returns a duration; cells render humanized and sort by length
- [ ] `list.reduce(expression, initial)` with `value`, `acc` and `index`
- [ ] Custom summary formulas: a view summary naming an entry in the top-level `summaries` is evaluated with `values` bound to the column's values; built-in summaries of durations stay durations
- [ ] `file.hasTag(a, b)` (`compiler/functions.ts`) required all tags; Obsidian matches any (fixed, site patch)
- [ ] Cards view: values that are links (e.g. a `link()` title formula) rendered as `<a>` inside the card's `<a>`, which browsers split apart, leaving the title outside the card; render card values as text (fixed, site patch)
- [ ] Entry count: "58 entries" / "1 entry" instead of "Showing 58 of 58 entries" when every entry is shown (`components/shared/count.ts`, all views)
- [ ] List values (`bases.scss`): `.bases-list` as `inline-flex` with a 4px gap puts a space before each comma; render inline
- [ ] `standalonePages` option (`pageType.ts`): `false` stops emitting a page per `.base` file, so bases only appear where embedded (standalone pages also add backlinks to every page they list)
- [ ] Sum and Range summaries (`components/shared/summary.tsx`): round to the inputs' decimal places to hide floating-point noise (`55.300000000000004`)
- [ ] Card and gallery images (`bases.scss`): Quartz's global `img { margin: 1rem 0 }` leaves a gap above them; reset the margin
- [ ] Cards view: a `data-placeholder` slot on cards without an image, so sites can colour them (this site uses the v4 palette in `custom.scss`)
- [ ] List separators inherit the text colour instead of `var(--gray)`
- [ ] (site-specific) Tables use the site's table styles: bases-page's own width, border, cell padding and font size removed, and `columnSize` widths ignored so the content sets column widths
- [ ] Cards view (`components/views/cards.tsx`): `imageAspectRatio` is height/width in Obsidian but was used as CSS `aspect-ratio` (width/height), so 0.5 gave tall images; cards should show the `order` properties (values only) rather than the title plus labelled properties; keep an empty image area when a card has no image.

**[quartz-community/folder-page](https://github.com/quartz-community/folder-page)** (`plugins/folder-page`; diff against `b5059fa4`):

- [ ] `showDates` / `showTags` options for the page listing (`components/PageList.tsx`, `FolderContent.tsx`)
- [ ] `hideListingWithIndex` option: folder pages with their own index content don't show the generated listing (`FolderContent.tsx`)

**[quartz-community/content-index](https://github.com/quartz-community/content-index)** (`plugins/content-index`; diff against `ae1b32b8`):

- [ ] `includeDates` option to keep page dates in `contentIndex.json` (useful for Explorer sort functions)

**[quartz-community/explorer](https://github.com/quartz-community/explorer)** (`plugins/explorer`; diff against `2b7e7ca1`):

- [ ] Bug: the client script ignores `folderDefaultState` (always collapsed) and `useSavedState` (always reads localStorage)
- [ ] Bug (not patched): the client script ignores `order` (always filter → map → sort)
- [ ] Options: `showTitle`, `showHomePage`, `folderLimits` ("View more" link), `backButtonTag` (mobile back button; relies on the core `spa` `previousPage` patch, so upstream would need that too)
- [ ] Highlight the folder whose page is open
- [ ] `overscroll-behavior: contain` on `ul.explorer-ul` blocks mouse-wheel page scrolling over the explorer when the list doesn't scroll on its own (non-height-limited sidebar). Overridden in `custom.scss` except on mobile; upstream could scope it to the mobile drawer.

**Quartz core / other plugins:**

- [ ] Explorer `sortFn`/`filterFn`/`mapFn` are serialized with `Function.toString()`, so any named inner function in a `quartz.ts` override breaks in the browser (`__name is not defined`, from esbuild `keepNames`). Document it, or strip `keepNames` when transpiling `quartz.ts`.

- [ ] "Data-only" pages as a concept (`plugins/data-only` + `quartz/plugins/pageTypes/dispatcher.ts`): parse a note so plugins like bases can query it, but never emit a page or link to it. Currently a local plugin plus a one-line dispatcher patch; upstream this could be a core `file.data` flag the dispatcher and crawl-links respect.
- [ ] crawl-links: `disableBrokenWikilinks` adds a `broken` class but keeps the `href`, so broken links still go to a 404. Option to drop the `href` (we do it in `plugins/data-only`).

### Backlog

- [ ] Map views in `Lists.base` (`type: map`), e.g. via `external-quartz-leaflet-map-plugin`
