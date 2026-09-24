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

## Quartz v5 migration

The `v5` branch is a fresh start from [upstream Quartz v5](https://github.com/jackyzha0/quartz/tree/v5) (upstream commit `97a2d05f`). The old site is tagged `v4-final`. It was forked from upstream v4 at `0a57d032`, which is the base to diff against when porting customizations.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped

### 1. Bases (main goal)

How it works: bases are rendered by a vendored copy of [bases-page](https://github.com/quartz-community/bases-page) in `plugins/bases-page` (upstream 1.0.0, `5c729d1`). Every change is marked `// Site patch:`, and the first commit touching that folder is the unmodified upstream code, so `git diff` against it shows every patch. Notes without `publish: true` are handled by `plugins/data-only`.

Comparing against the v4 live site's pre-rendered tables (Trip reports: 474/483 route pages identical; the other 9 differ only because of trips logged since January):

- [x] Publish `.base` files (Syncer → `content/templates/bases/`) and remove `templates` from `ignorePatterns`
- [x] **Trip data ("data-only" notes).** Syncer publishes every note. `plugins/data-only` marks notes without `publish: true` as `unlisted` + `dataOnly`:
  - [x] hidden from the content index, sitemap, RSS, search, graph, explorer, backlinks, and folder/tag listings (via `unlisted`)
  - [x] never emitted as pages (core patch in `quartz/plugins/pageTypes/dispatcher.ts`)
  - [x] removed from `ctx.allSlugs`, so wikilinks to them are broken links; broken links lose their `href` so nothing links to an unpublished page
  - [x] bases-page still queries them (the only consumer that sees them)
  - [x] Site has 0 dead internal links
- [x] bases-page fixes (vendored, `// Site patch:`):
  - [x] embeds whose view name has punctuation (`Lists.base#Don't waste your time`) failed with "View not found"
  - [x] `link(this.file)` returned `[[[object Object]]]` for embedded bases, so `route.contains(link(this.file))` matched nothing; wikilinks in `contains()` now compare by target note
  - [x] `properties: note.x` display names and `columnSize: note.x` widths weren't applied to bare `x` columns
  - [x] frontmatter dates were strings: now `Date`s, so `date.year`, `date + "8h"`, `.format()` and date sorting work; dates render as `YYYY-MM-DD`
  - [x] `==` compares numbers and numeric strings by value (`date.year == this.file.name`)
  - [x] the `tags` property has a `#` prefix, so `tags.filter(value.startsWith("#kane"))` works. **Inferred** from your formulas and the old Syncer output (Obsidian's bases engine); `file.tags`/`hasTag()` are unchanged. Revert in `resolver.ts` (`withObsidianValues`) if wrong.
  - [x] links to entries without a page (data-only notes) render as broken text in table/cards views and cells
- [ ] **Regex literals aren't supported (`Activity` column, By Year).** `Trips.base` `formula.tags` is `tags.filter(value != '#trip')[0].toString().replace(/^#/, '')`. bases-page's lexer reads `/` as division, so the formula fails and the column shows `—` on every Year page. Options:
  - change the `.base` to `replace('#', '')` (works in Obsidian and Quartz; quickest)
  - add regex literals to bases-page's lexer/parser (`src/compiler/lexer.ts`, `parser.ts`), with `replace()` accepting a RegExp. Upstream candidate.
- [ ] **Durations (later): `Days` column and summary (By Year).** bases-page has no duration type:
  - `date - (if(note["end date"], note["end date"], date) + "1d")` returns milliseconds (`-86400000`) where Obsidian returns a duration displayed as "a day"
  - the custom summary `Days: -values.reduce(value + acc, duration('0s')).days.ceil()` needs `reduce()`, duration arithmetic and `.days`, and bases-page only supports built-in summaries (Sum, Average, …)
  - Fix: a duration type in bases-page (Date − Date, `duration()`, `+`/`-`, `.days`/`.hours`/…, humanized rendering like "2 days"), `list.reduce()`, and custom formula summaries. Upstream candidate.
- [ ] By Year: trips on the same day can come out in a different order (the view only sorts by `formula.Date`). Add a secondary sort in the `.base` if it matters.
- [ ] Standalone base pages are emitted at `/templates/bases/*.base` (unlinked, but public). Hide them. They also show raw `#`-prefixed tags.
- [ ] bases-page list, gallery and board views still link entries without pages (only table and cards are patched; the site doesn't use the others yet)
- [ ] Offer the bases-page fixes upstream as PRs (see "Upstream candidates" below)
- [x] `Nugara Scrambles` 117 → 115 rows: the old pre-rendered table was stale. It still listed "Loaf Mountain north/south" and "Mount Rowe southeast/via lakes", route notes deleted from the site on 2025-11-27 (`ed1dcb7f`) and merged into `Loaf Mountain` and `Mount Rowe`. The new table lists the merged notes. Not a bug.
- [-] "No attempts" row for empty tables (v4 OFM patch). Dropped.
- Content: `Notes/2026-09-24.md` in the vault is an unfilled template (`"{ date }"` placeholders), which causes an invalid-date warning on every build.

### 2. Strava static maps

- [x] `plugins/activity-map`: emitter + `ActivityMap` sidebar component (right, above backlinks). For every published page with a `location`, a `route` to located routes, or a `strava` activity, it writes `<slug>-strava.gpx` and `<slug>-map.jpg`.
  - Cache is content-addressed (`quartz/.quartz-cache/gpx/strava-<activity>.gpx`, `maps/map-<hash>.jpg`), so renames and v5's lowercased slugs don't cause refetches. Download failures are logged and skipped; the build carries on.
  - Fixed v4 bugs: `emit` never yielded its files, and map output broke with an absolute `-o`. Dropped the `cheerio` dependency.
  - Data-only notes get no map.
  - If a map is missing (failed download), the sidebar box removes itself (`onerror`).
- [x] Migrated the local v4 cache: 489 of 490 files reused via the v4 manifests, 1 new map downloaded
- [ ] **Remove the v4 cache fallback** (`plugins/activity-map/src/cache.ts`, "v4 cache migration") after the CI cache has been migrated, then delete the old `Notes/`, `Routes/` and `.manifest.json` entries from both cache folders
- [x] Strava token refreshed; all 514 maps/GPX files now build from cache
- [x] `plugins/trip-meta` replaces community `content-meta` (date, routes, people, stats, DWYT/Kane, Strava + GPX links). Header text identical to v4 on all 512 pages the two builds share.
- [x] `.env` loading without `dotenv` (`process.loadEnvFile`), `node-fetch` dropped from `scripts/refresh-token.js`; `prequartz` runs the plugin build and the Strava token refresh
- [ ] GPX times are anchored at build time (`Date.now()`), inherited from v4: Strava streams only have offsets from the start. Fetch the activity's `start_date` if accurate times matter.

### 3. Layout and components

- [x] Explorer options (`quartz.ts`, `componentRegistry.setOptionOverrides`): v4 sort (Notes/Lists/Years, newest first), hide `routes`/`templates`/`tags`, open folders, no saved state. Dates come from `contentIndex.json` via the vendored `plugins/content-index` (`includeDates`, the v4 patch). Functions are stringified for the browser, so no named inner functions (esbuild's keepNames adds `__name()`).
- [ ] **Explorer fork** (needs the real source: the npm package's inline script is minified): mobile back button on route pages, homepage entry first, Notes capped at 5 with "View more", active folder highlight, no desktop "Explorer" title button. Needs the `spa` `previousPage` patch below for the back button.
- [ ] **Table of contents fork** (also needs the real source): page-title entry, highlight on scroll end instead of IntersectionObserver. Sticky is done in `custom.scss`.
- [x] CardList (`plugins/card-list`): home page (`afterBody`, limit 7, via the `is-index` condition registered in `quartz.ts`) and the Notes folder page. Skips data-only notes. Default cover colours differ from v4 because v5 slugs changed; v4 also left some cards without a colour (negative hash index), now fixed.
- [x] Folder pages: vendored `plugins/folder-page` (rebuilt from the npm source maps; unmodified in `3adeebab`). No "Folder:" prefix (upstream default), `showFolderCount: false`, new `showDates`/`showTags`/`cardFolders` options, `<hr />` above the listing.
- [x] Footer social icons (`plugins/site-footer`)
- [x] Page title logo (`plugins/site-title`). As in v4, the mobile styles expect a text `<span>` that the component never rendered, so mobile shows no title; add one if wanted.
- [x] Map component in the right sidebar (`plugins/activity-map`)
- [x] Body class `collapse-sidebar-desktop` for pages tagged `list` (core patch, `quartz/components/Body.tsx`)
- [x] Force dark theme: `saved-theme="dark"` on `<html>` (core patch, `quartz/components/renderPage.tsx`); darkmode plugin disabled
- [x] Styles: v4 changes to `base.scss`, `custom.scss` and `variables.scss` applied onto v5 (one conflict in `html {}` merged by hand). Dropped the `.empty-table-cell` rule. Component styles live in each plugin.
- [ ] Visual check of every page type (desktop, tablet, mobile) against the live site
- [x] Icon, OG image and logo in `quartz/static`

### 4. Core patches (check each; re-apply only if still needed)

- [x] `spa`: `previousPage` history state (for the Explorer back button), hide the loading bar on file downloads (core patch, `quartz/components/scripts/spa.inline.ts`)
- [x] Content index: keep `date` (vendored `plugins/content-index`, `includeDates` option). The v4 client-side `Date` parsing isn't needed; the sort function parses the date itself.
- [x] Assets: resize jpg/png with sharp (max width 1200, jpeg quality 80), core patch in `quartz/plugins/emitters/assets.ts`. Output assets 13 MB (same as v4) from 114 MB of originals.
- [x] Slugs: v4 dropped commas and collapsed repeated dashes; v5 emits e.g. `amesthst-lakes--and--surprise-point`. Matching v4's rules isn't practical (every community plugin bundles its own copy of the slug function), so `plugins/legacy-redirects` writes redirects at the 52 v4 URLs that differ by more than case. `alias-redirects` covers case-only changes, but only on case-sensitive filesystems (it skips on macOS, runs in CI).
- [x] Core patch (`processors/emit.ts`, `build.ts`): emitters other than the page dispatcher never see data-only notes (otherwise alias-redirects would emit ~295 case redirects to pages that don't exist).
- [-] Google Fonts `display=swap` removal and JPEG favicon: dropped. The reason for the v4 change isn't recorded and `swap` is the recommended default; v5 writes a standard PNG favicon. Easy to restore if they mattered.
- [ ] Fonts are loaded twice: core (`quartz/util/theme.ts`) and the `quartz-fonts` plugin both add a Google Fonts stylesheet. Pick one.

### 5. CI and cutover

- [x] Deploy workflow for v5 (`.github/workflows/deploy.yml`): triggers on push to `v5` and manually. Builds local plugins (`npm run plugins:build`), links them (`plugin install --from-config`), same Strava token steps, then `npx quartz build`. Tested on a fresh clone: same output as a local build.
- [x] Map/GPX caches: separate `maps` and `gpx` caches keyed per run and restored by prefix, so new files are cached (the v4 fixed keys were saved once and never updated). The first v5 run restores the v4 caches and `activity-map` migrates them.
- [x] `quartz.lock.json` untracked: it only lists local plugins, by machine-specific absolute path
- [ ] The Strava "download previous token" step never finds a token (`download-artifact` only sees the current run without `run-id`/`github-token`), so every build refreshes from `STRAVA_BOOTSTRAP_REFRESH_TOKEN`. Same as v4; fine as long as that refresh token stays valid.
- [ ] Check old URLs after the first deploy: `alias-redirects` case redirects only run on case-sensitive filesystems (CI yes, macOS no), and `legacy-redirects` covers the 52 URLs that changed beyond case
- [ ] Switch GitHub default branch to `v5` and re-enable deploys

### Upstream candidates

Changes made locally that could become PRs. Each is marked `// Site patch:` in the code.

**[quartz-community/bases-page](https://github.com/quartz-community/bases-page)** (`plugins/bases-page`; diff against commit `af59d8d3` to see every patch):

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
- [ ] Regex literals and a duration type (see the Bases section).

**[quartz-community/folder-page](https://github.com/quartz-community/folder-page)** (`plugins/folder-page`; diff against `3adeebab`):

- [ ] `showDates` / `showTags` options for the page listing (`components/PageList.tsx`, `FolderContent.tsx`)
- [ ] (site-specific, not for upstream) `cardFolders` renders a folder's listing with `plugins/card-list`

**[quartz-community/content-index](https://github.com/quartz-community/content-index)** (`plugins/content-index`; diff against `64e6361f`):

- [ ] `includeDates` option to keep page dates in `contentIndex.json` (useful for Explorer sort functions)

**Quartz core / other plugins:**

- [ ] Explorer `sortFn`/`filterFn`/`mapFn` are serialized with `Function.toString()`, so any named inner function in a `quartz.ts` override breaks in the browser (`__name is not defined`, from esbuild `keepNames`). Document it, or strip `keepNames` when transpiling `quartz.ts`.

- [ ] "Data-only" pages as a concept (`plugins/data-only` + `quartz/plugins/pageTypes/dispatcher.ts`): parse a note so plugins like bases can query it, but never emit a page or link to it. Currently a local plugin plus a one-line dispatcher patch; upstream this could be a core `file.data` flag the dispatcher and crawl-links respect.
- [ ] crawl-links: `disableBrokenWikilinks` adds a `broken` class but keeps the `href`, so broken links still go to a 404. Option to drop the `href` (we do it in `plugins/data-only`).

### Backlog

- [ ] Map views in `Lists.base` (`type: map`), e.g. via `external-quartz-leaflet-map-plugin`
