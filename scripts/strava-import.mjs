#!/usr/bin/env node
// Creates trip notes in the Obsidian vault for recent Strava activities.
//
// Usage: npm run strava:import -- [--since YYYY-MM-DD] [--dry-run]
//
// - Activities come from the Strava API (STRAVA_ACCESS_TOKEN, refreshed by scripts/prebuild.js).
// - Notes are created through the Obsidian CLI from the "Trip Template", then each property is
//   set with `property:set`, so Obsidian writes the frontmatter itself. Needs a current Obsidian
//   installer (the CLI isn't functional in old installers, even with an updated app) and the CLI
//   enabled in Settings → General.
// - The vault is only read directly, to find activities that are already imported.
//
// By default it imports everything since the newest trip note with a `strava` id. Activities
// that are already imported are skipped, as are days that already have a hand-made trip note
// without a `strava` id (reported so they can be linked by hand).
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { parse as parseYaml } from "yaml"

if (fs.existsSync(".env")) process.loadEnvFile(".env")

const VAULT = process.env.OBSIDIAN_VAULT ?? "adamlaycock.ca"
const VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH ?? path.join(os.homedir(), "Documents/notes/adamlaycock.ca")
const OBSIDIAN = process.env.OBSIDIAN_CLI ?? "/Applications/Obsidian.app/Contents/MacOS/obsidian"
const NOTES_FOLDER = "Notes"
const TEMPLATE = "Trip Template"

// Strava sport_type → trip activity tag. Other sport types aren't trips.
const SPORT_TAGS = {
  Hike: "hike",
  Walk: "hike",
  TrailRun: "trail-run",
  BackcountrySki: "ski-tour",
  NordicSki: "cross-country",
  MountainBikeRide: "mountain-bike",
  RockClimbing: "climb",
}

// Names Strava generates, e.g. "Morning Hike"; these aren't useful as a title
const DEFAULT_NAME = /^(Morning|Lunch|Afternoon|Evening|Night) /

function parseArgs(argv) {
  const args = { dryRun: false, since: undefined }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") args.dryRun = true
    else if (argv[i] === "--since") args.since = argv[++i]
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  if (args.since && !/^\d{4}-\d{2}-\d{2}$/.test(args.since)) {
    throw new Error("--since must be YYYY-MM-DD")
  }
  return args
}

// Dates in frontmatter may be YAML strings ("2026-08-23") or full ISO timestamps
const toDay = (value) => (value ? String(value).slice(0, 10) : undefined)

/** Trip notes in the vault: imported Strava ids, notes without an id by date, newest import */
function scanVault() {
  const dir = path.join(VAULT_PATH, NOTES_FOLDER)
  const importedIds = new Set()
  const unlinkedByDate = new Map()
  let newestImported

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md")) continue
    const text = fs.readFileSync(path.join(dir, file), "utf8")
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) continue
    let frontmatter
    try {
      frontmatter = parseYaml(match[1]) ?? {}
    } catch {
      continue
    }
    if (!Array.isArray(frontmatter.tags) || !frontmatter.tags.includes("trip")) continue

    const date = toDay(frontmatter.date)
    const id = frontmatter.strava ? String(frontmatter.strava).match(/\d+/)?.[0] : undefined
    if (id) {
      importedIds.add(id)
      if (date && (!newestImported || date > newestImported)) newestImported = date
    } else if (date) {
      unlinkedByDate.set(date, [...(unlinkedByDate.get(date) ?? []), `${NOTES_FOLDER}/${file}`])
    }
  }
  return { importedIds, unlinkedByDate, newestImported }
}

async function fetchActivities(since, token) {
  const after = Math.floor(new Date(`${since}T00:00:00`).getTime() / 1000)
  const perPage = 100
  const activities = []
  for (let page = 1; ; page++) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&page=${page}&per_page=${perPage}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Strava API error ${res.status}: ${await res.text()}`)
    const batch = await res.json()
    activities.push(...batch)
    if (batch.length < perPage) break
  }
  // Oldest first, so notes are created in order
  return activities.sort((a, b) => a.start_date.localeCompare(b.start_date))
}

/** Frontmatter for a trip note, from a Strava SummaryActivity */
function tripProperties(activity) {
  // start_date_local is local wall-clock time with a "Z" suffix; keep it in UTC to read it as-is
  const start = new Date(activity.start_date_local)
  const end = new Date(start.getTime() + activity.elapsed_time * 1000)
  const date = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)
  return {
    date,
    endDate: endDate > date ? endDate : undefined,
    distance: Math.round(activity.distance / 100) / 10,
    gain: Math.round(activity.total_elevation_gain),
    strava: String(activity.id),
    tags: ["trip", SPORT_TAGS[activity.sport_type]],
    people: ["Adam"],
    title: DEFAULT_NAME.test(activity.name) ? undefined : activity.name,
  }
}

function obsidian(...args) {
  return execFileSync(OBSIDIAN, [`vault=${VAULT}`, ...args], { encoding: "utf8" }).trim()
}

function createTripNote(props) {
  const output = obsidian("create", `path=${NOTES_FOLDER}/${props.date}`, `template=${TEMPLATE}`)
  const notePath = output.match(/^(?:Created|Overwrote): (.+)$/m)?.[1]
  if (!notePath) throw new Error(`Unexpected output from obsidian create: ${output}`)

  const set = (name, value, type) =>
    obsidian(
      "property:set",
      `path=${notePath}`,
      `name=${name}`,
      `value=${value}`,
      ...(type ? [`type=${type}`] : []),
    )
  set("date", props.date, "date")
  if (props.endDate) set("end date", props.endDate, "date")
  set("distance", String(props.distance), "number")
  set("gain", String(props.gain), "number")
  set("strava", props.strava)
  set("tags", JSON.stringify(props.tags))
  set("people", JSON.stringify(props.people))
  if (props.title) set("title", props.title)
  return notePath
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const token = process.env.STRAVA_ACCESS_TOKEN
  if (!token) throw new Error("STRAVA_ACCESS_TOKEN is not set (run via `npm run strava:import`)")

  if (!args.dryRun) {
    // Old installers exit 0 but only print an "installer is out of date" notice
    let version = ""
    try {
      version = obsidian("version")
    } catch {}
    if (!/^\d+\.\d+\.\d+/m.test(version) || /installer is out of date/i.test(version)) {
      throw new Error(
        `The Obsidian CLI (${OBSIDIAN}) isn't working. Install the latest Obsidian from ` +
          `https://obsidian.md/download, enable the CLI in Settings → General, and keep Obsidian open. ` +
          `Set OBSIDIAN_CLI to use a different path.`,
      )
    }
  }

  const { importedIds, unlinkedByDate, newestImported } = scanVault()
  const since = args.since ?? newestImported
  if (!since) throw new Error("No imported trips found; pass --since YYYY-MM-DD")
  console.log(`Strava activities since ${since}${args.dryRun ? " (dry run)" : ""}`)

  const skipped = { sport: [], imported: [], existing: [] }
  const created = []
  for (const activity of await fetchActivities(since, token)) {
    const label = `${activity.start_date_local.slice(0, 10)} ${activity.sport_type} "${activity.name}" (${activity.id})`
    if (!SPORT_TAGS[activity.sport_type]) {
      skipped.sport.push(label)
      continue
    }
    if (importedIds.has(String(activity.id))) {
      skipped.imported.push(label)
      continue
    }
    const props = tripProperties(activity)
    const existing = unlinkedByDate.get(props.date)
    if (existing) {
      skipped.existing.push(`${label} → already has ${existing.join(", ")}`)
      continue
    }

    const summary = `${props.tags[1]}, ${props.distance} km, ${props.gain} m${props.title ? `, "${props.title}"` : ""}`
    if (args.dryRun) {
      console.log(`  would create ${NOTES_FOLDER}/${props.date}: ${summary}`)
    } else {
      const notePath = createTripNote(props)
      console.log(`  created ${notePath}: ${summary}`)
      importedIds.add(props.strava)
    }
    created.push(label)
  }

  console.log(
    `\n${created.length} ${args.dryRun ? "to create" : "created"}, ` +
      `${skipped.imported.length} already imported, ${skipped.sport.length} not trips, ` +
      `${skipped.existing.length} on days with an existing trip note`,
  )
  for (const line of skipped.existing) console.log(`  skipped: ${line}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
