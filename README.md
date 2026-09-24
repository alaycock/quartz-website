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

- [x] Publish `.base` files (Syncer → `content/templates/bases/`) and remove `templates` from `ignorePatterns`
- [ ] **Trip data is unpublished.** `Trips.base#Trip reports` (483 route pages) and `Trips.base#By Year` (7 year pages) query trip notes, but only 9 of 314 trip notes are published. The old tables were pre-rendered from the whole vault. Decide how trip data reaches Quartz (see below).
- [ ] bases-page bug: embeds whose view name has an apostrophe fail with "View not found" (`Lists.base#Don't waste your time`). OFM slugifies the `#block` (`dont-waste-your-time`), but bases-page's `normalize()` only lowercases and dashes spaces. Fix upstream in `pageType.ts`.
- [ ] bases-page bug: `link(this.file)` returns `[[[object Object]]]` because the embedding page's `this.file` is a plain object, not a file value. Breaks `route.contains(link(this.file))` (Trips `Trip reports`). `route.contains(this.file)` works, so either fix upstream or change the formula.
- [ ] Formula: `tags.filter(value.startsWith("#kane"))` and the equivalents for `#dwyt` and `#nugara` return nothing. Quartz tags don't have the `#` prefix. Affects the Kane, DWYT and Nugara columns.
- [ ] Column display names from `properties: note.x` don't apply when the view's `order` uses the bare name `x` (e.g. `Elevation (m)` shows as `Elevation`). Probably a bases-page bug.
- [ ] `Nugara Scrambles` shows 115 rows vs 117 before. Investigate.
- [ ] Verify in a real build once trip data is available: `date.year == this.file.name` (By Year), `(date + "8h").format(...)`, `date - (... + "1d")` durations, the regex literal in `formula.tags` (`replace(/^#/, "")`), `file(list(route)[0]).properties.region`, and the custom summary `Days: -values.reduce(...)` (bases-page only implements built-in summaries).
- [ ] Standalone base pages are emitted at `/templates/bases/*.base`. Hide or unlist them, or drop them from backlinks.
- [-] "No attempts" row for empty tables (v4 OFM patch). Dropped.
- Note: the `Completed` column now renders as a checkbox instead of ✅.

### 2. Strava static maps

- [ ] Port `ActivityMap` emitter, `Map` component and `assetCache` into the site plugin (`plugins/site`)
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

- [ ] New deploy workflow: plugin install, `.quartz/plugins` cache, Strava token steps, map/GPX caches
- [ ] Compare against the v4 build and check old (mixed-case) URLs redirect
- [ ] Switch GitHub default branch to `v5`

### Backlog

- [ ] Map views in `Lists.base` (`type: map`), e.g. via `external-quartz-leaflet-map-plugin`
