# HANDOFF — 4AM365.github.io (Quartz blog)

Stable — no open handoff. Both `/kitchen` calculators are quality-driven and live.

## Calculator widgets — sync rule
The cookie & focaccia widgets are **verbatim copies** of the playground build
sheets, with each model mirrored under `widgets/src/src/` so the import path
needs no editing. To update after changing a playground source:
```
cp playground/cookiebot/cookie-build-sheet.jsx     ventures/4AM365.github.io/widgets/src/cookie.jsx
cp playground/cookiebot/src/cookie-model.js         ventures/4AM365.github.io/widgets/src/src/cookie-model.js
cp playground/foccaciabot/focaccia-build-sheet.jsx  ventures/4AM365.github.io/widgets/src/focaccia.jsx
cp playground/foccaciabot/src/focaccia-model.js     ventures/4AM365.github.io/widgets/src/src/focaccia-model.js
cd ventures/4AM365.github.io && npm run build:widgets && git commit -am ... && git push   # push auto-deploys
```
`build:widgets` (esbuild, React→preact/compat) bundles `widgets/src/<name>.jsx`
→ `quartz/static/widgets/<name>.js`. Pages embed via `data-widget="<name>"`.

## Parity note
The cookie calculator lists ingredients **by physical step**; focaccia still uses
its component-grouped table (a quick follow-up to reach full parity — attach an
`ing[]` to focaccia's `buildSteps` and swap the table, mirroring cookie).
