---
title: AI tuning skills
---

I keep a public library of **"skills"** for working on an ECUMaster EMU Black tune
with an AI assistant — each one is a structured set of instructions (and, where it
helps, a Python script) that teaches the model how to do a specific tuning job
correctly: decode a tune file, diagnose a data log, rescale airflow tables, smooth
a VE map, audit a whole calibration, and so on.

The skills live here:
[github.com/4AM365/emu-black-tuning-notes](https://github.com/4AM365/emu-black-tuning-notes/tree/master/skills)

This page makes them usable **without installing anything**. Each skill below has a
**copy-paste block** you can drop straight into a [Claude](https://claude.ai) or
[ChatGPT](https://chatgpt.com) chat window, attach your file, and let the model do
the work. The block points the model at the authoritative instructions in the
public repo *and* carries the critical safety rules inline, so it still behaves even
if the model can't fetch the URL.

## How to use a block

1. Pick the task below that matches what you want to do.
2. Copy its prompt block (use the copy button on the code box).
3. Paste it into a fresh Claude or ChatGPT conversation.
4. **Attach the file it asks for** — your tune export (`.xml.emub3`), a data log
   (`.csv`), or a table file (`.emubt`).
5. Send. The model follows the skill's procedure and hands back decoded values, a
   diagnosis, or a new importable table.

> [!warning] This is a real engine
> These prompts read and propose changes to live engine calibration — fueling,
> idle, cranking, ignition, boost. Always re-verify a few cells in EMU Black after
> any import, work on a copy of your tune, and never trust a number you haven't
> sanity-checked. The AI is a fast assistant, not a tuner with skin in the game.

## The skills

| Skill | Use it to… | Attach |
|---|---|---|
| [Read & edit a tune file](skills/emu-black-tune) | Decode symbols/tables, understand scaling, change values safely | `.xml.emub3` |
| [Diagnose a data log](skills/emu-black-log) | Find why it stalled, ran lean, lost boost, knocked | `.csv` log |
| [Smooth a VE map](skills/emu-black-ve-smooth) | Clean the steps out of an autotuned fuel map, keep trusted cells | `.xml.emub3` or table |
| [Rescale airflow for a new DBW range](skills/emu-black-actuator-rescale) | Move the idle throttle floor/ceiling without changing how it idles | `.xml.emub3` |
| [Export a table as .emubt](skills/emu-black-emubt-export) | Turn computed values into a file EMU can import | values / table |
| [Audit a whole tune](skills/emu-black-tune-review) | Get a best-practice review across idle, fuel, ignition, boost | `.xml.emub3` |
| [Street-tune VVT-i cams](skills/emu-black-vvti-street-tune) | Find the best cam advance without a dyno | log(s) `.csv` |
| [Parse a binary log](skills/emu-black-log-emublog3) | Read a `.emublog3` directly, skip the CSV export step | `.emublog3` + one `.csv` |

Each page has the full background plus its copy-paste block.
