---
title: AI-smoothed fuel & ignition maps to cut CoV
tags: [tuning, ai, ve, smoothing, combustion, cov]
description: Using AI to produce perfectly smooth fuel and ignition surfaces — and the proof, from knock-sensor scatter, that smoother maps burn more repeatably.
---

> [!abstract] The discovery
> A log-based autotune only corrects the cells you actually drove through, leaving the
> map full of steps. Those steps don't just look ugly — they raise the **cycle-to-cycle
> variability of combustion** every time you interpolate across them. Smoothing the map
> with an anchor-aware fit (keep the trusted cells, pull the rest onto a clean surface)
> measurably **lowers combustion CoV.** I have the knock-sensor data to prove it.

## Why steps hurt

A speed-density map is interpolated continuously as RPM and load move. Where two
adjacent cells disagree by a few percent, every transit across that boundary is a
small mixture/torque discontinuity. Accelerating through RPM or ramping into boost,
you're *always* interpolating — so a ragged map shows up as roughness exactly when the
engine is working.

## The method

Smooth, but **don't throw away what you know.** The approach:

1. Mark the cells the autotune actually corrected as **anchors** — they keep their
   exact value.
2. For each row and column, fit a low-order (degree-3) weighted polynomial where the
   anchors dominate the fit, and replace only the non-anchor cells.
3. Bound the fit to the region around the anchors so it never extrapolates wildly into
   map regions you never visited.

The same idea applies to the ignition surface (e.g. flattening the cruise plateau) and
to the VE/fuel-dose table. The on-site skill packages it so you can hand a map to an AI
and get a clean surface back.

## The proof: smoother maps burn tighter

I read **combustion stability from knock-sensor "chatter."** On no-knock cycles, the
cycle-to-cycle scatter of the per-event knock-band energy proxies CoV — but only after
two corrections: detrend within fine RPM×MAP cells (the raw signal climbs with RPM and
load, which otherwise dominates), and restrict to transitions (smoothness only bites
while interpolating). Comparing the hand-built map against the machine-smoothed one,
operating-point-corrected CoV (lower = more stable):

| RPM bin | hand-made | machine-smoothed |
|---|---|---|
| 3.5–4k | 30.8% | **11.5%** |
| 4–4.5k | 24.1% | **17.2%** |
| 4.5–5k | 24.7% | **21.3%** |
| 5–5.5k | 28.9% | **16.4%** |
| overall | 25.9% | **19.0%** |

The machine-smoothed map is tighter in **every** overlapping bin — a clean confirmation
that the algorithm-smoothed surface runs with less knock-sensor chatter and more
repeatable combustion than the hand-built one.

The hand-built VE surface versus the machine-smoothed one — the steps that drove the
extra combustion variability show up as ridged texture that the smoother removes:

![[old vs new ve1 map for machine ve map smoothing.png]]

The same two maps compared in the logs the CoV metric was computed from:

![[log_comparison for machine ve map smoothing.png]]

## Dig into the notes

- [notes/knock_voltage_cov_combustion_stability.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/knock_voltage_cov_combustion_stability.md) — the CoV-from-knock-scatter method, the two traps, and the full result
- [notes/ve_correctness_from_log_method.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/ve_correctness_from_log_method.md) — how to derive the corrections (the anchors) from a log: STFT in steady cells, lambda error in accel cells, coverage everywhere
- On-site: [[emu-black-ve-smooth|the VE-smoothing skill]] (anchor-weighted polynomial smoother) and [[emu-black-log|log-based VE correction]]

Repo: [github.com/4AM365/emu-black-tuning-notes](https://github.com/4AM365/emu-black-tuning-notes)
