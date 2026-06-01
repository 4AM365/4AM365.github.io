---
title: Tuning themes
tags: [tuning]
description: The major ideas that pushed this build's tuning to a new level.
---

Each of these is a theme I've discovered that changed how I tune — written as a
high-level view, with the full first-principles work and data linked back to the
[tuning notes repo](https://github.com/4AM365/emu-black-tuning-notes).

- [[ignition-advance-mbt|Dialing MBT ignition by cam, fuel & load]] — finding and safely
  approaching MBT in every region of the map, accounting for cam overlap, fuel chemistry,
  and operating point.
- [[ai-smoothed-maps-cov|AI-smoothed fuel & ignition maps to cut CoV]] — using AI to
  produce perfectly smooth surfaces, with knock-sensor proof that smoother maps burn more
  repeatably.
- [[dbw-thermal-expansion|DBW thermal expansion at extreme charge temps]] — why a hot
  throttle body leaks more air at idle, and how to compensate it as a temperature-indexed
  correction.
- [[cammed-idle|Protecting & perfecting a cammed idle]] — the control architecture and
  principles that make a high-overlap idle stable instead of stall-prone.
- [[cylinder-trims-3d|Structuring 3D per-cylinder trims]] — building load-shaped,
  EGT-anchored per-cylinder fuel trims to correct intake maldistribution.

*First pass — the framing and ordering will evolve.*
