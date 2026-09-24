#!/usr/bin/env node
// Builds every local plugin in plugins/<name>/ into plugins/<name>/dist.
//
// Quartz only symlinks local plugins into .quartz/plugins and never builds them,
// so this must run before `npx quartz build` (see the `prequartz` npm script).
// This mirrors the quartz-community plugin template's tsup config using plain
// esbuild, resolving dependencies from the site's root node_modules.
//
// Usage: node plugins/build.mjs [plugin-name ...] [--watch]
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"

const pluginsDir = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const watch = args.includes("--watch")
const only = args.filter((a) => !a.startsWith("--"))

// Packages that must be the same instance across all plugins and the Quartz host
const SINGLETON_EXTERNALS = [
  "preact",
  "preact/hooks",
  "preact/jsx-runtime",
  "preact/compat",
  "@jackyzha0/quartz",
  "@jackyzha0/quartz/*",
  "vfile",
  "vfile/*",
  "unified",
]

// .scss → CSS string, .inline.ts → bundled browser JS string (same as the plugin template)
const inlineAssetsPlugin = {
  name: "inline-assets",
  setup(build) {
    build.onLoad({ filter: /\.scss$/ }, async (args) => {
      const sass = await import("sass")
      return { contents: sass.compile(args.path).css, loader: "text" }
    })

    build.onLoad({ filter: /\.inline\.ts$/ }, async (args) => {
      const text = (await fs.promises.readFile(args.path, "utf8"))
        .replace(/^export default /gm, "")
        .replace(/^export /gm, "")
      const result = await esbuild.build({
        stdin: { contents: text, loader: "ts", resolveDir: path.dirname(args.path) },
        write: false,
        bundle: true,
        minify: true,
        platform: "browser",
        format: "esm",
        target: "es2020",
        external: ["http://*", "https://*"],
      })
      return { contents: result.outputFiles[0].text, loader: "text" }
    })
  },
}

const plugins = fs
  .readdirSync(pluginsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(pluginsDir, e.name, "package.json")))
  .map((e) => e.name)
  .filter((name) => only.length === 0 || only.includes(name))

for (const name of plugins) {
  const dir = path.join(pluginsDir, name)
  // Entry points come from package.json exports: "./dist/<x>.js" is built from src/<x>.ts(x)
  const { exports } = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
  const entryPoints = {}
  for (const target of Object.values(exports)) {
    const out = typeof target === "object" ? target.import : undefined
    const entry = out?.match(/^\.\/dist\/(.+)\.js$/)?.[1]
    if (!entry) continue
    const src = ["ts", "tsx"].map((ext) => path.join(dir, `src/${entry}.${ext}`)).find(fs.existsSync)
    if (!src) throw new Error(`${name}: no source for export ${out}`)
    entryPoints[entry] = src
  }

  const options = {
    entryPoints,
    outdir: path.join(dir, "dist"),
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2022",
    sourcemap: true,
    jsx: "automatic",
    jsxImportSource: "preact",
    external: SINGLETON_EXTERNALS,
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
    },
    plugins: [inlineAssetsPlugin],
    logLevel: "warning",
  }

  fs.rmSync(options.outdir, { recursive: true, force: true })
  if (watch) {
    const ctx = await esbuild.context(options)
    await ctx.watch()
    console.log(`watching ${name}`)
  } else {
    await esbuild.build(options)
    console.log(`built ${name}`)
  }
}
