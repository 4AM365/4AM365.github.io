---
title: Parse a binary .emublog3 log
tags: [tuning, ecu, ai, skills]
description: Read EMU Black's binary log format directly, skipping the CSV export step.
---

EMU Black stores binary data logs as `.emublog3` — a gzip-compressed record stream
with **no embedded channel schema** (channel order, count and scaling live in the
ECU's log configuration, not the file). This skill parses them directly so you can
skip the manual "Export to CSV" round-trip. It needs a **one-time bootstrap**: pair a
`.emublog3` with one matching CSV export so the binary layout can be locked, after
which the schema is reusable for every log from that ECU configuration. Once parsed,
the output is the same DataFrame the [[emu-black-log|log-diagnosis skill]] works on.

A practical caveat the skill documents honestly: fast, high-dynamic-range channels
(RPM, MAP, TPS, boost…) decode reliably, but slow/monotonic ones (**EGT, IAT, battery**)
do not auto-decode from a single log — for those, trust the CSV or pin them from the
EMU logger channel order.

**Attach:** your `.emublog3`, plus one matching `.csv` export the first time (for the
bootstrap).

## Copy-paste block

```text
You are my ECUMaster EMU Black binary-log (.emublog3) parsing assistant. Authoritative
instructions are here — fetch and follow them if you can:
https://raw.githubusercontent.com/4AM365/emu-black-tuning-notes/master/skills/emu-black-log-emublog3/SKILL.md

.emublog3 is gzip (magic 1F 8B) wrapping fixed-size contiguous records:
record size = (logged channel count) × (1/2/4 bytes per value). There is NO channel
schema in the file — it must come from outside.

Bootstrap (one time per ECU log config): I'll attach a .emublog3 AND its matching CSV
export. Gunzip the binary, read channel/sample counts from the CSV, find the record
size, and map CSV channels to byte offsets/types/scales by correlating decoded binary
against the CSV. THEN linear-refit y = a·raw + b vs the CSV and check R² — do not
trust a correlation-reported scale (correlation is scale-invariant). Save the schema.

Reliability rule the skill proved: fast, high-dynamic-range channels (RPM, MAP, TPS,
PPS, Boost, Boost Target, Vehicle Speed, Ignition Angle, VE, Injectors PW, Short term
trim) decode well. Slow/monotonic channels — EGT 1/2, IAT, Charge temp, Battery — do
NOT reliably auto-decode from a single log; they track the warmup ramp and the search
latches onto a timer field. For those, either read the channel ORDER from EMU's
"Select logged parameters" dialog and walk it deterministically, or take the value
from the CSV. (On the reference build EGT was pinned at u16 °C, scale 1, via the
adjacency constraint EGT1 immediately followed by EGT2.)

After parsing to a DataFrame, hand off to the EMU Black log-diagnosis workflow (same
channel reference and triage). Verify a few cells visually in EMU before trusting the
decode.
```

---

Full skill source:
[skills/emu-black-log-emublog3/SKILL.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/skills/emu-black-log-emublog3/SKILL.md)
