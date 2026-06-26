# Widgets — interactive tool components for the blog

Self-contained React/JSX "tool" widgets (calculators, simulators, visualizers)
that render inside a normal Quartz markdown page. This is the **general guide to
the mechanism**; per-widget sync rules (which source is canonical, how to ship an
update) live in [`../HANDOFF.md`](../HANDOFF.md).

## The whole pipeline in one picture

```
widgets/src/<name>.jsx        ← you write this (a default-export React component)
        │  npm run build:widgets   (tools/build-widgets.mjs, esbuild)
        ▼
quartz/static/widgets/<name>.js   ← committed bundle, exposes mount(el)
        │  loaded on demand by quartz/components/scripts/widgets.inline.ts
        ▼
content/**/<page>.md   contains:  <div data-widget="<name>"></div>
```

## How it works

1. **Source** — `widgets/src/<name>.jsx` is an ordinary React component with a
   **default export**. Write plain React (`import React, { useState } from "react"`).
   You may import sibling helper modules (e.g. `./src/<name>-model.js`).

2. **Build** — `npm run build:widgets` runs [`tools/build-widgets.mjs`](../tools/build-widgets.mjs),
   which esbuilds every `widgets/src/*.jsx` into `quartz/static/widgets/<name>.js`.
   It wraps your default export in a `mount(el)` entry point, bundles + minifies,
   and **aliases `react` → `preact/compat`** (JSX runtime `preact/jsx-runtime`) so
   each bundle reuses the Preact already in Quartz's deps (~15 KB, not full React).

3. **Mount** — [`quartz/components/WidgetLoader.tsx`](../quartz/components/WidgetLoader.tsx)
   carries [`scripts/widgets.inline.ts`](../quartz/components/scripts/widgets.inline.ts)
   and is registered in [`quartz.layout.ts`](../quartz.layout.ts) under
   `afterBody`, so it runs on **every page**. On Quartz's `nav` event (first load
   *and* SPA navigation) it finds each `[data-widget]`, dynamically imports
   `/static/widgets/<name>.js`, and calls `mount(el)`. It's idempotent via a
   `data-mounted` flag.

4. **Embed** — drop `<div data-widget="<name>"></div>` anywhere in a
   `content/**/*.md` page. The `<name>` must match the source filename.

## Adding a new widget

1. Write `widgets/src/<name>.jsx` (default export). Look at
   [`src/cookie.jsx`](src/cookie.jsx) for a full, self-contained example.
2. `npm run build:widgets`.
3. Add `<div data-widget="<name>"></div>` to a `content/**/*.md` page (give the
   page normal frontmatter + a paragraph of intro prose above the div).
4. **Commit the built bundle too** — see "Gotchas".

## Gotchas — read before you ship

- **The built bundle is committed to git.** `quartz/static/widgets/*.js` is *not*
  gitignored; GitHub Pages serves exactly what's in the repo. If you change a
  source `.jsx` you **must** re-run `npm run build:widgets` and commit the
  regenerated bundle, or the live site keeps the old code. (`npm run build:widgets`
  is **not** part of `npx quartz build` — it's a separate, manual step.)
- **Preact, not React, at runtime.** Because `react` is aliased to `preact/compat`,
  stick to what compat supports. Avoid React-18-only concurrent APIs
  (`useTransition`, `useId` quirks, Suspense data-fetching). Hooks, context,
  `useMemo`/`useEffect`/`useRef` are fine.
- **No global CSS leakage.** A widget shares the page's DOM. Scope styles with
  inline styles or a unique class prefix; don't emit bare `body`/`h1` rules.
  Injecting a `<style>` with `!important` site-overrides is how `cookie.jsx`
  themes itself — keep selectors namespaced.
- **Keep deps tiny.** Every import is bundled into the page payload. Prefer
  hand-rolled SVG/`d3`-free charts over pulling a charting lib.
- **Self-contained = portable.** Widgets here are authored to also run as a
  standalone HTML page in their origin repo (React via CDN), then copied/depended
  in. A widget that only touches its own props and React state ports cleanly; one
  that reaches for `window`/page globals does not.

## Keeping a widget in sync with its source repo

Widgets are usually authored in a **standalone repo** (so they double as a
double-click-to-run HTML page) and brought in here one of two ways:

- **git dependency** — a one-line re-export shim (see `src/focaccia.jsx`).
- **verbatim copy** — the source is copied in and rebuilt (see `src/cookie.jsx`).

The exact, per-widget "how to ship a change" commands live in
[`../HANDOFF.md`](../HANDOFF.md). Update that file when you add or re-wire a widget.
