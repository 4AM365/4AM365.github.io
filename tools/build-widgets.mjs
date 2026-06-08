// Builds interactive React/JSX "tool" widgets into self-contained ESM bundles
// that the blog loads on demand. Each file in widgets/src/<name>.jsx becomes
// quartz/static/widgets/<name>.js, served at /static/widgets/<name>.js and
// mounted into a <div data-widget="<name>"> by quartz/components/WidgetLoader.
//
// React is aliased to preact/compat so we reuse the Preact already in Quartz's
// deps — each bundle is ~15KB instead of pulling in full React.
//
// Usage: npm run build:widgets   (run before committing when a widget changes)

import { build } from "esbuild"
import { readdirSync, mkdirSync } from "node:fs"
import { join, basename, resolve } from "node:path"

const SRC = resolve("widgets/src")
const OUT = resolve("quartz/static/widgets")
mkdirSync(OUT, { recursive: true })

const files = readdirSync(SRC).filter((f) => /\.[jt]sx$/.test(f))
if (files.length === 0) {
  console.warn("[widgets] no sources found in widgets/src")
}

for (const file of files) {
  const name = basename(file).replace(/\.[jt]sx$/, "")
  const entryPath = join(SRC, file)

  await build({
    stdin: {
      // Wrap the tool's default-exported component in a mount(el) entry point.
      contents: `
        import { render, h } from "preact"
        import Component from ${JSON.stringify(entryPath)}
        export function mount(el) {
          if (!el) return
          render(h(Component, {}), el)
        }
      `,
      resolveDir: SRC,
      loader: "js",
    },
    bundle: true,
    format: "esm",
    minify: true,
    outfile: join(OUT, `${name}.js`),
    jsx: "automatic",
    jsxImportSource: "preact",
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react-dom/client": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
    target: "es2020",
    logLevel: "warning",
  })

  console.log(`[widgets] built ${name} -> quartz/static/widgets/${name}.js`)
}
