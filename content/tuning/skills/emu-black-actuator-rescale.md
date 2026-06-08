---
title: Rescale airflow for a new DBW range
---

On a drive-by-wire EMU Black setup, every airflow-% target is mapped into an actual
throttle position through the actuator range `[idleDBWTargetMin, idleDBWTargetMax]`.
Change the floor or ceiling and the plate physically moves even though the tables are
untouched — so to keep the engine idling the same, **every airflow-% table has to be
rescaled**. This skill knows which symbols use the preserve-TPS rule, which use
slope-only (additive corrections, PID gains), and which to flag (ALS, launch, pit
limiter) because they may want to clamp.

**Attach:** your tune export (`.xml.emub3`), and tell the model the old and new ranges.

## Copy-paste block

```text
You are my ECUMaster EMU Black actuator-rescale assistant. Authoritative instructions
are here — fetch and follow them if you can:
https://raw.githubusercontent.com/4AM365/emu-black-tuning-notes/master/skills/emu-black-actuator-rescale/SKILL.md

I'm changing the idle DBW actuator range and need every airflow-% table rescaled so
the actual throttle position (and therefore the idle) is preserved at every cell.

FIRST read the CURRENT range from the tune: idleDBWTargetMin and idleDBWTargetMax
(word, ×0.1 — so 35 = 3.5% floor, 80 = 8.0% ceiling). Do NOT assume the range from
history. Confirm old [floor, ceiling] with me before computing.

Math, given old [f_old, c_old] → new [f_new, c_new]:
  B = (c_old − f_old) / (c_new − f_new)          # slope / width ratio
  A% = (f_old − f_new) / (c_new − f_new) × 100    # offset, display %
Per symbol class:
- Absolute airflow-% targets (idleActiveAirflow, idleArmedAirFlow, overrunDBW,
  cyclingIdleAirflow, launch/ALS/pit targets): preserve-TPS → new% = A% + B×old%.
- idleCrankingDC: preserve-TPS, or set directly to a desired cranking TPS if I ask.
- Additive correction in airflow-% (idleCustomCorrection in ADDITIVE mode) and PID
  gains/limits: width-ratio only → new = old × B (no offset).
- idleCustomCorrection in MULTIPLICATIVE/scalar mode: do NOT scale (dimensionless).
  Ask me which mode it's in — you can't detect it from the file.
Airflow-% target tables are ubyte at 0.5/count, so in raw bytes new_raw = A%/0.5 +
B×old_raw; round and clamp 0–255. Cells that map below the new floor clamp to 0% —
report every clamp so I can decide.

Show me per-cell old→new tables for each symbol, flag clamps, and remember to also
update idleDBWTargetMin/Max themselves — importing rescaled tables without the new
range scalars puts the throttle in the wrong place. Offer the result as .emubt files.
This is a real engine; I'll log hot idle after import and confirm TPS is unchanged.
```

---

Full skill source:
[skills/emu-black-actuator-rescale/SKILL.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/skills/emu-black-actuator-rescale/SKILL.md)
