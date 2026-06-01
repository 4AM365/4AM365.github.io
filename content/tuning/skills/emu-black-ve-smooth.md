---
title: Smooth a VE / fuel map
tags: [tuning, ecu, ai, skills]
description: Clean the steps out of an autotuned VE table while keeping the trusted cells pinned.
---

A log-based autotune only corrects the cells the car actually visited, so the VE /
fuel-dose table ends up with sharp steps between corrected and untouched cells. This
skill smooths those steps **without disturbing the cells you trust**: the corrected
("anchor") cells keep their exact value and everything else gets pulled onto a
low-order polynomial surface, bounded to the region around the anchors so it never
extrapolates wildly into territory the autotune never saw.

**Fastest path — paste the autotuned map into the chat.** No tune file, no setup:
copy the autotuned table out of EMU, paste the grid in, and ask for it smoothed. The
model reads the grid, treats the cells the autotune moved as anchors (paste a
hit-count/weight grid too and that's fully automatic), smooths, and hands back the
cleaned grid in the same shape plus a move report. Or **attach** your tune export
(`.xml.emub3`) and tell the model which cells came from autotune (those become the
anchors).

## Copy-paste block

```text
You are my ECUMaster EMU Black VE-map smoothing assistant. Authoritative method is
here — fetch and follow it if you can:
https://raw.githubusercontent.com/4AM365/emu-black-tuning-notes/master/skills/emu-black-ve-smooth/SKILL.md

I want to smooth my VE / fuel-dose table. I'll usually just PASTE the autotuned table
straight into the chat as a text grid (or attach the tune export — decode veTable, and
veTable2 if I run flex). Read the pasted grid directly, strip any RPM/load axis labels,
and orient it as a 2D grid with ROW 0 = HIGHEST RPM and load increasing left→right;
confirm the orientation with me before smoothing, because smoothing a flipped table
ruins it.

Anchor-weighted polynomial smooth, per the script in the skill:
- ANCHORS are the cells the autotune actually corrected / that I trust; they keep their
  EXACT original value and must never move. Auto-detect them when you can: if I paste a
  hit-count/weight grid alongside, anchor every cell with non-zero hits; if I paste only
  values, anchor the cells that differ from the seed/flat value. Ask me once only if it's
  ambiguous — otherwise proceed automatically.
- For each column (RPM) then each row (load): take the anchor span on that line, fit a
  degree-3 weighted polynomial (anchors weight 100, others weight 1), and replace ONLY
  the non-anchor cells with the curve. Re-snap anchors to original. Repeat 3 passes.
- Leave cells outside the anchor span untouched (no extrapolation). Round to 0.1.

Then show me: the smoothed table, an anchor-marked view, and a DELTA table with max
move and mean-abs move. If any anchor moved, you got the anchor set wrong — fix it.
If the max move is more than a few %, say so — it usually means too few anchors or
too high a degree. This is fuel: I'll re-verify cells in EMU and re-log before
trusting it. When it looks right, offer to write it out as an importable .emubt.

Here is my table / tune, and here are the anchor cells: [...]
```

---

Full skill source:
[skills/emu-black-ve-smooth/SKILL.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/skills/emu-black-ve-smooth/SKILL.md)
