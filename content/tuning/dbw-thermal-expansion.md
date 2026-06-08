---
title: DBW thermal expansion at extreme charge temps
---

> [!abstract] The discovery
> At idle a drive-by-wire throttle sits nearly closed, and the only flow path is the
> thin clearance around the plate edge. The bore (aluminum) and the plate (stainless or
> nickel-silver) **expand at different rates**, so that clearance *grows as the assembly
> heats* — the closed throttle leaks more air when hot. Under extreme charge-temp swings
> this is a real, predictable airflow error, and it's best corrected as a
> temperature-indexed offset, not left for the idle PID to chase.

## The physics

At small idle throttle angles (~3–5°), the plate still blocks nearly all of its disc
area; the open area is **dominated by the radial clearance** around the edge. That
clearance is set by the difference in thermal expansion between bore and plate:

| Part | Material | α (×10⁻⁶/°C) |
|---|---|---|
| Bore | A356 aluminum | 21.5 |
| Plate | 304 stainless | 17.0 |
| **Differential** | | **4.5** |

The aluminum bore outruns the steel plate, so the gap **opens monotonically with
temperature** (designed-in anti-seize — it never binds, at the cost of a
temperature-varying leak). For a 73 mm bore the diametral clearance grows ~16 µm at
ΔT 50 °C, ~26 µm at ΔT 80 °C. Because idle flow is choked, **mass flow is proportional
to that area** — so the leak scales directly with the clearance growth.

## Why it's RPM-dependent (the elegant part)

The same fixed clearance growth is a **larger fraction** of a smaller opening. At lower
idle-target RPM the airflow command is smaller, the plate angle is smaller, and the
flow area is more dominated by radial clearance — so the *fractional* airflow increase
from heating is bigger. Worked out for this build at ΔT 50 °C:

| Idle target RPM | airflow increase when hot |
|---|---|
| 1500 | +8.0% |
| 1200 | +10.1% |
| 1000 | +11.3% |

That's exactly the shape of the implemented correction: **more negative at lower RPM.**
At the actuator floor under an extreme hot-soak (ΔT ≈ 80 °C) the prediction reaches
~−21 to −28%, which matches the table's worst-case cells almost exactly — the
correction is right-sized for the stall-margin corner where the plate is closest to its
floor.

## How to apply it

- Compensate idle/closed-throttle airflow as a **CLT/IAT-indexed offset**, not a fixed
  DBW floor — the leak is a function of temperature, so the correction must be too.
- Charge-air temp (CAT) is a *proxy* for throttle-body body temp; it leads/lags during
  transients, so **bias toward under-correction** and let the PID ease in the rest.
- First-principles thermal growth justifies roughly 50–100% of the implemented
  correction depending on the cell — anything beyond the physics-pure bound needs a
  logged reason, not extrapolation.
- Removing the hood dropped intake charge temp ~5–8 °C at idle but **didn't** change the
  manifold conduction soak — context for how much CAT swing to design around.

## Dig into the notes

- [notes/throttle_body_thermal_growth.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/throttle_body_thermal_growth.md) — full butterfly-flow + differential-expansion derivation, per-RPM tables, physics-pure reference correction
- [notes/hood_removal_charge_temps.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/hood_removal_charge_temps.md) — measured charge-temp behavior the correction has to span
- [supra/notes/airflow_actuator.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/supra/notes/airflow_actuator.md) — live actuator range, airflow tables, the custom-correction table
- On-site: [[emu-black-actuator-rescale|rescaling airflow when the DBW range changes]], [[emu-black-tune|the airflow↔TPS math]]

Repo: [github.com/4AM365/emu-black-tuning-notes](https://github.com/4AM365/emu-black-tuning-notes)
