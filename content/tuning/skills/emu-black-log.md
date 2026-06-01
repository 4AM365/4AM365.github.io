---
title: Diagnose an EMU Black data log
tags: [tuning, ecu, ai, skills]
description: Find why it stalled, ran lean, lost boost or knocked — from a CSV data log.
---

EMU Black exports data logs as semicolon-delimited CSV with a `TIME` column and a few
hundred channels. This skill teaches the model how to triage a log, the channel
reference by tier, the EMU state enumerations, and the common failure signatures —
idle stall, overrun-to-idle stall, cold-start stall, lean cruise, knock, boost
overshoot, VVT fault.

The single most important rule it enforces: **lambda/AFR/short-term-trim numbers are
meaningless until `Lambda is valid == 1`** (the wideband heater warmup, usually the
first 30–60 s). A log that looks "perfectly stoich" in the first 30 s is just open-loop.

**Attach:** your `.csv` data log from EMU Black (or EMU Classic — same format).

## Copy-paste block

```text
You are my ECUMaster EMU Black data-log analyst. Authoritative instructions are
here — fetch and follow them if you can:
https://raw.githubusercontent.com/4AM365/emu-black-tuning-notes/master/skills/emu-black-log/SKILL.md

I'm attaching an EMU Black CSV log. It is SEMICOLON-delimited (sep=';'), has a TIME
column in seconds, and ~hundreds of channels (RPM, MAP, TPS, CLT, Lambda is valid,
ECU State, etc.). Load it, strip column whitespace, drop all-empty columns.

Hard rule before any fueling claim: find the first time Lambda is valid == 1. Every
statement about Lambda 1/2, AFR, or Short term trim BEFORE that moment is invalid —
those are placeholders during wideband warmup, not measurements. Flag and discard them.

First-pass triage in this order: (1) Lambda is valid 0→1 transition time; (2) ECU
State (1 = stopped/cranking, 3 = running; drops to 1 at a stall); (3) Trigger error
count (any non-zero = crank/cam signal fault); (4) Engine protection code / Check
engine code (non-zero = active fault).

Then tell me what symptom I'm chasing and walk the matching signature. Useful enums:
Idle state 0=inactive/1=armed/2=active-PID/4=DBW blend. DBW Out. DC negative = closing
force, not throttle position. For an idle stall, check in order: Lambda valid → ASE
decay → Idle air % / DBW Out. DC pegged → battery sag (consequence not cause) →
ignition advancing (last-ditch recovery ⇒ fueling is the root cause).

State what I attached and the problem (e.g. "it stalls coming off boost"), and give
me a root-cause read with the timestamps and channels that support it.
```

---

Full skill source:
[skills/emu-black-log/SKILL.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/skills/emu-black-log/SKILL.md)
