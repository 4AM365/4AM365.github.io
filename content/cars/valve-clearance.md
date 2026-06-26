---
title: Piston-to-Valve Clearance Calculator
tags:
  - cars
  - engine
  - calculator
status: growing
---

When you mill a head, stack a thinner gasket, fit oversized valves, or degree in a
big cam with VVT, the question that decides whether the engine survives is the
same: **how close does a valve get to the piston through the overlap?** Get it
wrong and the piston kisses a valve at the worst possible moment — right around
TDC, where they're both fighting for the same space.

This calculator builds that picture from the geometry. The piston follows an exact
slider-crank from your stroke and rod length; each cam lobe is a raised-cosine
profile set by lift, duration and centerline; and the tool scans the whole overlap
window for the tightest gap — separately for the intake and exhaust valves.

Every lever that matters is on the panel, and each one reads as a **deviation from
a stock baseline** so you can see exactly what your change cost you:

- **Deck height** — milling the block or head drops the piston toward the valves.
- **Head gasket thickness** — a thicker gasket buys it back.
- **Cam timing & VVT** — intake advance and exhaust retard both widen overlap and
  tighten clearance, which is precisely the high-load phasing that bends valves.
- **Valve seat angle & head diameter** — engine-specific geometry; a bigger valve
  hangs its rim lower into the bore.
- **VTEC** — flip to the high-lift, long-duration lobe above the crossover RPM and
  watch the gap close as the cam comes on.

A schematic cross-section shows the slice at the tightest crank angle, a second
chart traces clearance through overlap against the stock curve, and a third shows
the active lift profile. Presets for a Honda B16, a 2JZ-GTE and a Chevy LS get you
in the ballpark fast.

It's a first-order, **directional** model — it won't catch piston-side edge
interference or valve-to-valve proximity, and the lobes are idealized. Trust the
*deviation from stock*, treat the absolute number as a guide, and **clay the
engine** before you turn the key.

<div data-widget="valve-clearance"></div>

The same calculator also runs as a single self-contained HTML page you can open
offline — no build, no server.
