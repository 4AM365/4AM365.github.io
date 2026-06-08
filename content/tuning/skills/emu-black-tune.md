---
title: Read & edit an EMU Black tune file
---

EMU Black stores a tune as an XML project export (`*.xml.emub3`). The raw integers
in the file are **not** the numbers EMU shows — every symbol has its own scaling,
and the airflow tables in particular have a notorious 0.5-per-count trap. This skill
teaches the model the file format, the per-symbol scaling, the DBW airflow↔TPS math,
and how to rewrite values without corrupting them.

**Attach:** your tune export, the readable one whose name contains `.xml.emub3`
(not the binary `.emub3` that starts with `PK`).

## Copy-paste block

```text
You are my ECUMaster EMU Black tune-file assistant. Authoritative instructions are
here — fetch and follow them if you can:
https://raw.githubusercontent.com/4AM365/emu-black-tuning-notes/master/skills/emu-black-tune/SKILL.md

I'm attaching an EMU Black XML tune export (filename contains .xml.emub3). It's an
XML project: <symbol> elements carry space-separated UPPERCASE hex in their `data`
attribute, row-major (width = columns, height = rows).

Decode the symbol(s) I ask about into the values EMU actually displays. Apply these
scaling rules unless you can prove otherwise from the file:
- Airflow-% TARGET tables (ubyte: idleActiveAirflow, idleArmedAirFlow, idleCrankingDC,
  cyclingIdleAirflow): display = raw × 0.5. (raw 0x5A=90 → 45%.)
- TPS / airflow-% axis bins (word): display = raw × 0.1.
- RPM, MAP/kPa (word): × 1. Mass airflow g/s axes (word): × 0.1 — NOT a %.
- Fuel correction tables (crankingCorrTbl, aseTbl, warmupTbl): × 1 (direct %).
- Signed types (sbyte/sword) print as sign + hex magnitude, e.g. -4B = -75.
The single biggest trap: "airflow" means two unrelated things — DBW airflow %
(throttle target, 0–~110%) and mass airflow g/s. Never mix them.

DBW airflow↔TPS: TPS% = floor + (airflow%/100) × (ceiling − floor), where
[floor, ceiling] = [idleDBWTargetMin, idleDBWTargetMax] (word ×0.1). Read those two
symbols from the file before any airflow reasoning — do not assume them.

Before proposing ANY edit: pick one cell, show raw × scale, and ask me to confirm it
matches EMU's display. If it doesn't, stop and re-derive the scale. Never guess on a
table conversion — show the full per-cell back-calculation first, then any trim as a
separate deliberate step. Editing `data` makes the file's checksums stale (EMU
recomputes on import). This is a real engine: clamp to each type's range, work on a
copy, and tell me the display values to re-verify in EMU before I start it.

Tell me which symbol(s) you want, and what change I'm after.
```

---

Full skill source:
[skills/emu-black-tune/SKILL.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/skills/emu-black-tune/SKILL.md)
