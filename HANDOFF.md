# HANDOFF — 4AM365.github.io (Quartz blog)

Stable — no open handoff. Both `/kitchen` calculators are quality-driven and live.

## Calculator widgets — sync rules
> New to widgets? Read [`widgets/README.md`](widgets/README.md) first — it covers
> the general build/mount/embed pipeline. This section is only the per-widget
> "how to ship a change" specifics.

The two widgets use **different** setups right now:

**focaccia** — sourced from the standalone `foccaciabot` repo as a git dependency
(`focaccia-widget` = `github:4AM365/foccaciabot#master`). `widgets/src/focaccia.jsx`
is a one-line re-export shim; there is **no copy**. The model-equations page at
`content/kitchen/focaccia-model.md` is a synced copy of foccaciabot's canonical
`docs/focaccia-model.md`. To ship a focaccia change, run the pipeline from the
foccaciabot repo — it does both repos end to end:
```
cd playground/foccaciabot
npm run publish:blog -- "your change"   # commits+pushes foccaciabot, then rebuilds
                                        # the widget + syncs the doc here, commits, pushes
```

**cookie** — still a **verbatim copy** of the `home-projects/cookiebot` build sheet, model
mirrored under `widgets/src/src/cookie-model.js`. To update:
```
cp home-projects/cookiebot/cookie-build-sheet.jsx  ventures/4AM365.github.io/widgets/src/cookie.jsx
cp home-projects/cookiebot/src/cookie-model.js      ventures/4AM365.github.io/widgets/src/src/cookie-model.js
cd ventures/4AM365.github.io && npm run build:widgets && git commit -am ... && git push
```
(Migrating cookie to the same git-dependency pattern as focaccia is a good follow-up.)

**valve-clearance** — a **verbatim copy** like cookie. Canonical source is the
standalone `car-projects/valve-clearance` repo (`index.html`); its
`tools/sync-widget.mjs` emits the ESM `valve-clearance.jsx`. To update:
```
cd car-projects/valve-clearance && node tools/sync-widget.mjs
cp valve-clearance.jsx  ventures/4AM365.github.io/widgets/src/valve-clearance.jsx
cd ventures/4AM365.github.io && npm run build:widgets && git commit -am ... && git push
```
Embedded at `content/cars/valve-clearance.md`.

**combustion-cov** — a **verbatim copy** like valve-clearance. Canonical source is
the standalone `car-projects/combustion-cov` repo (`index.html`, a client-side port
of `emu-black-tuning-notes/tools/emub_analysis/cov.py`); its `tools/sync-widget.mjs`
emits the ESM `combustion-cov.jsx`, and `tools/verify-parity.mjs` asserts the JS math
still matches the Python. To update:
```
cd car-projects/combustion-cov && node tools/verify-parity.mjs && node tools/sync-widget.mjs
cp combustion-cov.jsx  ventures/4AM365.github.io/widgets/src/combustion-cov.jsx
cd ventures/4AM365.github.io && npm run build:widgets && git commit -am ... && git push
```
Embedded at `content/cars/combustion-cov.md`.

**crank-bearing-calc** — a **verbatim copy**. Canonical source is the standalone
`Hobbies/Cars/Land Cruiser/bearing-stress-calc` repo (`bearing-stress.jsx` + `model/*.js`,
checks in `model/check-*.mjs`). The jsx is copied with its import repointed to
`./src/crank-bearing-calc/calc.js`; the model files go to `widgets/src/src/crank-bearing-calc/`.
`build-one.mjs` in the source repo builds only this bundle with the same esbuild settings.
To update:
```
cd "Hobbies/Cars/Land Cruiser/bearing-stress-calc/model" && for f in check-*.mjs; do node $f; done
cp model/{calc,combustion,bearing,rodpin,cams}.js  <blog>/widgets/src/src/crank-bearing-calc/
sed 's#"./model/calc.js"#"./src/crank-bearing-calc/calc.js"#' bearing-stress.jsx > <blog>/widgets/src/crank-bearing-calc.jsx
cd <blog> && node "<source>/build-one.mjs" crank-bearing-calc && git commit ... && git push
```
Embedded at `content/tuning/crank-bearing-calc.md`.

`build:widgets` (esbuild, React→preact/compat) bundles `widgets/src/<name>.jsx`
→ `quartz/static/widgets/<name>.js`. Pages embed via `data-widget="<name>"`.

## Parity note
The cookie calculator lists ingredients **by physical step**; focaccia still uses
its component-grouped table (a quick follow-up to reach full parity — attach an
`ing[]` to focaccia's `buildSteps` and swap the table, mirroring cookie).
