---
title: Combustion-Stability (CoV) Calculator
tags:
  - cars
  - engine
  - calculator
status: growing
---

Drop an ECUMaster **EMU Black** CSV log and this reads combustion-stability
proxies per load region — **idle, cruise, high-load**. There is no cylinder-pressure
trace in an EMU log, so true `COV_imep` isn't computable; instead it derives
detrended crank-speed jitter (**CoV<sub>RPM</sub>**) and an operating-point-detrended
**per-cylinder knock-voltage scatter index**. The log is parsed entirely in your
browser — nothing is uploaded. Region bounds are editable; idle is the cleanest read.

<div data-widget="combustion-cov"></div>
