# HANDOFF — 4AM365.github.io (Quartz blog)

Stable — no open handoff. Both `/kitchen` calculators are quality-driven and live.

## Calculator widgets — sync rules
The two widgets use **different** setups right now:

**focaccia** — sourced from the standalone `foccaciabot` repo as a git dependency
(`focaccia-widget` = `github:4AM365/foccaciabot#master`). `widgets/src/focaccia.jsx`
is a one-line re-export shim; there is **no copy**. To ship a focaccia change:
```
# in playground/foccaciabot: edit, commit, push
cd ventures/4AM365.github.io
npm update focaccia-widget        # pull the new commit
npm run build:widgets             # rebundle quartz/static/widgets/focaccia.js
git commit -am ... && git push    # push auto-deploys
```

**cookie** — still a **verbatim copy** of the playground build sheet, model
mirrored under `widgets/src/src/cookie-model.js`. To update:
```
cp playground/cookiebot/cookie-build-sheet.jsx  ventures/4AM365.github.io/widgets/src/cookie.jsx
cp playground/cookiebot/src/cookie-model.js      ventures/4AM365.github.io/widgets/src/src/cookie-model.js
cd ventures/4AM365.github.io && npm run build:widgets && git commit -am ... && git push
```
(Migrating cookie to the same git-dependency pattern as focaccia is a good follow-up.)

`build:widgets` (esbuild, React→preact/compat) bundles `widgets/src/<name>.jsx`
→ `quartz/static/widgets/<name>.js`. Pages embed via `data-widget="<name>"`.

## Parity note
The cookie calculator lists ingredients **by physical step**; focaccia still uses
its component-grouped table (a quick follow-up to reach full parity — attach an
`ing[]` to focaccia's `buildSteps` and swap the table, mirroring cookie).
