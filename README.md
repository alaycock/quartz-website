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
- [ ] **Formula: `Activity` column (`Trips.base` `formula.tags`, By Year).** `replace(/^#/, '')` uses a regex literal, which bases-page's parser doesn't support. Easiest fix is in the `.base`: `replace('#', '')` works in both Obsidian and Quartz.
- [ ] **Formula: `Days` column and summary (By Year).** bases-page has no duration type: `date - (end + "1d")` gives milliseconds (`-86400000`) instead of Obsidian's duration ("a day"), and the custom summary `-values.reduce(...).days.ceil()` isn't supported (only built-in summaries). Needs a duration type in bases-page, or a simpler formula (e.g. a day count as a number).
- [ ] By Year: trips on the same day can come out in a different order (the view only sorts by `formula.Date`). Add a secondary sort in the `.base` if it matters.
- [ ] Standalone base pages are emitted at `/templates/bases/*.base` (unlinked, but public). Hide them. They also show raw `#`-prefixed tags.
- [ ] bases-page list, gallery and board views still link entries without pages (only table and cards are patched; the site doesn't use the others yet)
- [ ] Offer the bases-page fixes upstream as PRs
- [x] `Nugara Scrambles` 117 → 115 rows: the old table had four rows for variant notes that don't exist ("Loaf Mountain north/south", "Mount Rowe southeast/via lakes"); the new one lists the two real route notes. Not a bug.
- [-] "No attempts" row for empty tables (v4 OFM patch). Dropped.
- Note: `Completed` renders as a checkbox instead of ✅. Two Kane elevations the old renderer left blank now show values.
- Content: `Notes/2026-09-24.md` in the vault is an unfilled template (`"{ date }"` placeholders), which causes an invalid-date warning on every build.

### 2. Strava static maps

- [ ] Port `ActivityMap` emitter, `Map` component and `assetCache` into a local plugin (`plugins/activity-map`)
- [ ] Fix v4 bugs while porting: `emit` never yielded generated files (`length === 0` check), and map output used `"." + output`, which breaks with absolute `-o` paths
- [ ] Map/GPX URLs must follow v5 slugs (lowercased), not hard-coded `/${slug}-map.jpg`
- [ ] ContentMeta Strava/GPX links and trip stats (custom ContentMeta)
- [ ] `dotenv` loading and `prequartz` Strava token refresh

### 3. Layout and components

- [ ] Explorer: sort, filter and order options (`quartz.ts` override); mobile back button on routes; homepage entry first; Notes capped at 5 with "View more"; active folder highlight
- [ ] Table of contents: page-title entry, sticky, highlight on scroll end
- [ ] CardList: index page (`afterBody`, limit 7) and the Notes folder page
- [ ] Folder pages: title without the "Folder:" prefix, no count, PageList without dates or tags
- [ ] Footer social icons (currently shows "Created with Quartz")
- [ ] Page title logo (`static/logo.jpg`)
- [ ] Map component in the right sidebar
- [ ] Body class `collapse-sidebar-desktop` for pages tagged `list`
- [ ] Force dark theme (v4 set `saved-theme="dark"`, no toggle)
- [ ] Styles: `custom.scss`, `base.scss`, component styles
- [ ] Icon, OG image and logo in `quartz/static`

### 4. Core patches (check each; re-apply only if still needed)

- [ ] `spa`: `previousPage` history state (used by the Explorer back button), hide the loading bar on file downloads
- [ ] Content index: keep `date` and parse it client-side
- [ ] Assets: resize jpg/png with sharp (max width 1200, jpeg quality 80)
- [ ] Slugs: v4 dropped commas and collapsed repeated dashes; v5 emits e.g. `amesthst-lakes--and--surprise-point`
- [ ] Google Fonts `display=swap` removal, favicon format

### 5. CI and cutover

- [ ] New deploy workflow: `npm run plugins:build` (local plugins in `plugins/` are symlinked, never built by Quartz), plugin install, `.quartz/plugins` cache, Strava token steps, map/GPX caches
- [ ] `quartz.lock.json` records local plugins with an absolute `resolved` path. Check that `npx quartz plugin install` works in CI.
- [ ] Compare against the v4 build and check old (mixed-case) URLs redirect
- [ ] Switch GitHub default branch to `v5`

### Backlog

- [ ] Map views in `Lists.base` (`type: map`), e.g. via `external-quartz-leaflet-map-plugin`
