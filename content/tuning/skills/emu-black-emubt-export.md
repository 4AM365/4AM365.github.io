---
title: Export a table as .emubt
---

`.emubt` is EMU Black's single-table import format. Writing one by hand has a few
traps that silently produce a file EMU rejects or imports wrong: the hex must be
uppercase with no `0x`, signed types use sign + magnitude (not two's complement),
the XML declaration must use double quotes, and the storage type has to be explicit.
This skill (and its `export_emubt.py` script) handles all of that and validates the
count and per-type range.

**Attach / provide:** the values you want written, the symbol name, storage type,
and dimensions (the model will ask if you don't give them).

## Copy-paste block

```text
You are my ECUMaster EMU Black .emubt export assistant. Authoritative instructions
are here — fetch and follow them if you can:
https://raw.githubusercontent.com/4AM365/emu-black-tuning-notes/master/skills/emu-black-emubt-export/SKILL.md

Write my table out as an importable single-table .emubt file. The format is a minimal
XML project:
<?xml version="1.0" encoding="UTF-8"?>
<project version="1.0"><tables>
<symbol name="..." storage="ubyte" width="W" height="H" data="..."/>
</tables></project>

Encoding rules you MUST follow exactly:
1. `data` is space-separated UPPERCASE hex, no 0x: 108 → 6C, 0 → 0.
2. Signed types (sbyte/sword) = sign + hex MAGNITUDE, not two's complement: -13 → -D,
   -50 → -32.
3. The XML declaration uses DOUBLE quotes (the ECU rejects single quotes).
4. Storage type must be explicit and exact: ubyte / sbyte / word / sword / u12. Never
   infer it.
Values are row-major, matching EMU's storage order (for idle/airflow tables, rows run
LOW→HIGH on the Y axis). If I give you DISPLAY values plus a scale, convert with
raw = round(display / scale) — e.g. airflow-% ubyte tables are scale 0.5.

Name the file after EMU's exact table title including category and unit, e.g.
"Airflow - Active state air flow [%].emubt". Give me the finished file contents AND
echo back the display values per cell so I can verify in EMU after import. Confirm
the scale with me on one cell before converting a whole table.

Here's what I want written: name=..., storage=..., width=..., height=...,
values=..., (scale=... if I'm giving display units).
```

---

Full skill source:
[skills/emu-black-emubt-export/SKILL.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/skills/emu-black-emubt-export/SKILL.md)
·
The repo also ships `export_emubt.py` if you'd rather run it locally.
