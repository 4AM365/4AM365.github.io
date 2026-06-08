---
title: Structuring 3D per-cylinder trims
---

> [!abstract]
> A front-feed intake manifold doesn't fuel every cylinder equally — air-mass inertia
> carries mixture past the front runners and the rear cylinders run lean. The fix isn't
> a single global number; it's a set of **3D trim tables shaped across load**, anchored
> to EGT, and confirmed by the knock sensor going *quiet* once the cylinders are matched.

## The distribution model

On a front-feed log manifold the throttle sits at the front; air travels down the
plenum and the front cylinders fill richest, with the lean trend accelerating toward the
rear (cyl 5/6). Typical spread is ~15% richest-to-leanest, and the mid-rear cylinders
(4/5) often run hottest — not always the very last one. EMU Black implements this as **4
trim tables** (`fuelTrim1..4Table`), each a 5×5 RPM×load grid, with assignment scalars
mapping each cylinder to a table (so two cylinders can share one).

## Shaping across load — not a flat offset

The key structural insight: **maldistribution is worst at cruise and eases under boost.**
At light/cruise load the filling is inertia/resonance-dominated and uneven; boost forces
even filling and the gap closes. So each table gets a mild **cruise-peaked load shape**
(roughly `+[-1,+1,0,0,-1]` across the load axis — a small bump at ~75 kPa, tapering at
idle and full boost).

The proof that it's *real airflow* maldistribution and not a fixed sensor offset: the
pre-trim EGT delta **shrank with load** (cruise +44 °C → boost +12 °C). A sensor offset
would be load-constant; a shrinking delta is distribution closing up under pressure.

## Anchoring with limited probes

With only two EGT probes (cyl 3 and cyl 6) you anchor what you can and extrapolate the
rest along the front-to-rear curve, **biasing the unmeasured mid-rear cylinders rich** for
safety. A validated on-car result landed near cyl1/2 at 0%, cyl3 ~+2%, cyl6 ~+9%, with
4/5 in between — the +10% cyl6-vs-cyl3 relationship holding at every load cell because the
tables share one load shape. The next step is always *measure more cylinders* (an
EGT-to-CAN module) before trusting an extrapolated trim.

## Knock-baseline validation

After the trims went in, the **knock-sensor baseline went dead smooth at full boost —
even with more timing.** There were never knock *spikes*; what changed was that the
baseline noise floor stopped walking around. Lean cylinders burn faster and sit closer to
the autoignition edge, lifting and jittering the windowed knock-band energy. Equalize the
mixture and every cylinder presents the same pressure-rise signature, so the measurement
repeats instead of sawtoothing. **Watch knock-channel *variance*, not just spike count,
as a cylinder-uniformity health metric** — it reveals maldistribution before any spike
appears.

> [!warning] Don't double-correct
> Per-cylinder trims fix *distribution.* The global lambda/VE target must **not** be
> over-enriched to protect the lean cylinder — that's what the trims are for. Enriching
> globally just drowns the cylinders that were already fine.

## Notes

- [notes/per_cylinder_trim_ffim_distribution.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/per_cylinder_trim_ffim_distribution.md) — the table structure, distribution model, load shape, and the validated trim profile
- [notes/knock_sensor_baseline_vs_cylinder_uniformity.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/knock_sensor_baseline_vs_cylinder_uniformity.md) — why matched AFR flattens the knock-sensor baseline
- On-site: [[emu-black-log|reading per-cylinder EGT & knock channels from a log]], [[emu-black-emubt-export|writing the trim tables back out]]

Repo: [github.com/4AM365/emu-black-tuning-notes](https://github.com/4AM365/emu-black-tuning-notes)
