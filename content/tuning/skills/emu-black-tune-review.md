---
title: Audit a whole tune
---

A full-tune sanity check against the practitioner and academic literature (Banish,
Hartman, Heywood) plus EMU Black's own architecture conventions. The review walks
idle/cranking, lambda targets, ignition, boost, acceleration enrichment, sensors, and
VVT, and sorts every finding into **Validated / Worth-discussing / Verification-gap**
— it flags divergence from documented best practice and explains the trade-off rather
than prescribing one "correct" tune. A short report is a good sign.

**Attach:** your tune export (`.xml.emub3`).

## Copy-paste block

```text
You are my ECUMaster EMU Black tune-review assistant. Authoritative checklist is here
— fetch and follow it if you can:
https://raw.githubusercontent.com/4AM365/emu-black-tuning-notes/master/skills/emu-black-tune-review/SKILL.md

I'm attaching an EMU Black XML tune export (.xml.emub3). Review it against best
practice and EMU architecture, and categorise every finding as:
- Validated as solid (passes the check),
- Worth discussing (fails a soft check, may be intentional — flag for my judgement),
- Verification gap (needs dyno or log data; you can't decide alone).

Cover these areas, citing the reference for each finding (Banish p.X / Hartman p.Y /
Heywood ch.Z / "EMU Black architecture"):
- Idle/cranking: idleAirPIDOutMin/Max symmetry, integral limit narrower than PID
  output, idle ignition reserve above base cells, cranking airflow within 1.0–1.75×
  idle airflow, armed-state airflow taper, cranking enrichment decaying to ~0 by warm
  CLT, brake-switch lockout risk (flag for log review).
- Lambda: cruise (40–80 kPa, 2500–4000) λ≈1.0–1.05; idle λ 0.85–1.0; WOT/boost
  λ 0.78–0.86 (E0); smooth monotonic flex blend curves.
- Ignition: idle 8–20° BTDC, knockActionMinTps ≤ 25%, sane retard/restore rates,
  per-cylinder knock gains matched on active cylinders / zero on disabled slots.
- Boost: boostPIDEnable vs control type, non-zero gains, overboost protection present,
  sane wastegate frequency.
- Accel enrichment, sensor/safety limits (rpmLimit, fuel pressure failsafe, MAP valid
  voltage, injector dead-time row variance), and VVT smoothness.

Decode values with EMU scaling before judging them (airflow-% ubyte tables are
×0.5). Produce a prioritised, concise report — when the tune is clean, keep it short.
Do not prescribe a single "correct" tune; flag and explain. Pair findings with a log
review where you note one would help.
```

---

Full skill source:
[skills/emu-black-tune-review/SKILL.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/skills/emu-black-tune-review/SKILL.md)
