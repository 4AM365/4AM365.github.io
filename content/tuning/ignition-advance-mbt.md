---
title: Dialing MBT ignition by cam, fuel & load
---

> [!abstract] The discovery
> The "right" ignition advance is not one number, or even one curve — it's a surface
> that bends with **cam overlap, fuel chemistry, and the local operating point.** Once
> you understand *why* MBT moves where it does, you can place timing deliberately in
> every cell instead of chasing a dyno number you can't see on the street.

## The core idea

The goal of timing is to put **CA50** — the crank angle where half the charge has
burned — at the point of maximum mechanical advantage on the crank. That's MBT
(maximum brake torque). Everything else is a correction to land CA50 in the right
place as the things that govern burn rate change underneath you.

Three levers move MBT, and they interact:

- **Cam overlap.** More duration/overlap means more residual gas in the charge. A
  diluted charge burns slower, so it needs the spark **earlier**. On a turbo engine
  this is load-dependent: at light load exhaust pressure exceeds intake pressure, so
  overlap *adds* residual dilution (MBT → more advance); under boost the fresh charge
  scavenges residuals out (MBT → less advance).
- **Fuel.** Octane sets knock resistance; the fuel's *burn rate* sets how much timing
  you need. Ethanol burns in a way that wants **~3–8° more advance** to reach MBT, and
  its charge-cooling makes it very hard to knock — so on E60 the constraint flips from
  "don't detonate" to "don't make so much torque you break parts."
- **Operating point.** Across MAP you lose roughly **2° per 30 kPa** (peaking near
  20 kPa); across RPM you *add* timing as the piston starts to outrun the flame front.
  MBT traces a U-shape versus load.

## What this looks like in practice

- **Idle (cammed):** more overlap → diluted charge → needs more advance. Rough guide:
  pump/stock 10–12°, ethanol/big-cam 19–22°. But on a 264° cam the engine barely
  responds to timing at idle — so it's run **flat (~16°)** and airflow owns RPM, with
  the ignition PID as a fast ±4° trim only.
- **Cruise (40–80 kPa):** MBT is typically 30–36° on pump, 34–40° on E60. You find it
  with an **EGT probe** (lower EGT = closer to MBT) and confirm with MAP rising at
  constant pedal. Then you **flatten timing into a shallow plateau** across the cruise
  band so small MAP wobbles don't become torque wobbles.
- **Boost:** substantially less advance — each ~4 psi wants ~2–3° less on a given fuel.
  Low-20s°BTDC is typical for a 4-valve inline-six near MBT under boost.
- **Flex fuel:** two ignition tables (E0 conservative, E100 aggressive) blended by
  ethanol %. The blend curve is front-loaded (most knock-resistance gain is in the
  first 50% ethanol). **You tune timing by moving the Table 2 values, never by bending
  the blend curve** — the blend just multiplies your delta.

## The VVT coupling that catches people

Cam advance and the ignition table are **coupled**. Moving the cam changes residual
fraction and effective compression, which moves MBT at that cell — so any time you
retune cam advance you have to re-verify ignition there. The repo carries the full
mechanism breakdown plus theoretical MBT surfaces (238°/264°/272° cams, E0 and E100)
to use *for shape, not as safe-to-run values.*

## Notes

- [notes/timing.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/timing.md) — full principles, cam/fuel timing tables, theoretical MBT surfaces, flex-fuel blend, cruise plateau method
- [notes/vvti.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/vvti.md) — how intake cam advance shifts MBT (overlap vs. effective compression)
- [supra/notes/timing_targets.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/supra/notes/timing_targets.md) — build-specific E60 targets by boost
- On-site: [[emu-black-vvti-street-tune|street-tuning VVT without a dyno]], [[emu-black-tune|reading & editing the ignition tables]]

Repo: [github.com/4AM365/emu-black-tuning-notes](https://github.com/4AM365/emu-black-tuning-notes)
