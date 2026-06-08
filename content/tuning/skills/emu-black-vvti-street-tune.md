---
title: Street-tune VVT-i cams
---

A dyno gives direct torque feedback; on the street you use proxies. This skill is the
protocol for tuning the VVT-i intake cam advance table without one — using **MAP at
fixed TPS** as the primary torque proxy (higher MAP at the same throttle = more air
per cycle = more torque) and EGT as a corroborating signal. It generates a sweep
plan, analyses the resulting log to rank cam positions per cell, and proposes a
smoothed `cam1AdvTbl`. It's honest about its limits: cruise and light-boost cells are
trustworthy; WOT cells stay flagged as dyno-verification gaps.

**Attach:** a `.csv` log from a cam-override sweep (the block tells you how to drive it).

## Copy-paste block

```text
You are my ECUMaster EMU Black VVT-i street-tuning assistant. Authoritative protocol
is here — fetch and follow it if you can:
https://raw.githubusercontent.com/4AM365/emu-black-tuning-notes/master/skills/emu-black-vvti-street-tune/SKILL.md

Help me optimise my intake VVT-i cam advance table without a dyno, using MAP at fixed
TPS as the torque proxy (higher MAP at the same TPS = more cylinder filling = more
torque) and EGT as a corroborating signal (lower EGT at the same lambda + commanded
ignition = more work extracted).

If I haven't driven the sweep yet, give me a plan: steady-state on a flat road (cruise
control), engine fully warm, and wait until Lambda is valid == 1 (60s+ of driving)
before any STFT-based step. At the target cell, use EMU's VVT advance override to lock
the cam at each position (e.g. 0→40° in 5° steps), hold each 15s+ logging everything,
let MAP settle between steps, and RE-TEST the first position at the end as a drift
check (if MAP differs >~2 kPa, conditions changed — redo).

When I attach the sweep log, for the cell I name (RPM±tol, MAP±tol): segment each
cam-override hold, compute mean MAP and EGT per hold, rank positions, and pick the
best (MAP peak; EGT minimum should agree). Report the drift-check result.

Across several cells, build a proposed cam1AdvTbl: place each measured optimum in its
nearest cell, interpolate between measured cells, smooth out step discontinuities, and
hold WOT/unmeasured cells unchanged with a verification-gap flag. Prioritise cells in
this order: light cruise (40–80 kPa, 2000–3500) → off-idle (30–60 kPa, 1200–2000) →
low boost (100–140 kPa, 3000–5000). Flag high-load WOT as still wanting a dyno.

Note that after a cam change the VE table is wrong at those cells — that's a separate
STFT-driven re-correction step, not part of this.
```

---

Full skill source:
[skills/emu-black-vvti-street-tune/SKILL.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/skills/emu-black-vvti-street-tune/SKILL.md)
