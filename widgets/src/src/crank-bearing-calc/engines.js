// engines.js -- engine presets (v0.4): journals, FSM clearances, display-unit defaults, cam set, VE basis, EMU table bins.
// Pure data, no imports. calc.js merges `defaults` over its shared defaults (engineDefaults(key)).
// Source tags in `tags` (2JZ): FSM = 1997 Supra RM502U service specifications, build notes = Will's own files,
// catalogue = retailer figure, forum = owner-posted weights (GTE parts), web = unverified web page, est. = estimate.
// Sources: ../supra-2jz-preset.md, ../emu-table-conventions.md, ../API.md v0.4.

// ---- 1FZ-FE (FJ80): today's DEFAULTS, unchanged ---------------------------------------------------------------
const FZ = {
  label: "1FZ-FE", car: "FJ80 Land Cruiser",
  journals: { main: 69, rod: 57 },                                              // mm, manual journals
  clr: { rod: { min: 0.032, mid: 0.041, max: 0.050 }, main: { min: 0.042, mid: 0.051, max: 0.060 } },   // FSM EG-172, diametral mm
  defaults: {
    rpm: 3500, mapKPa: 200, targetTorqueLbft: 600, spark: 20, fuel: "E85", lambda: 0.8,
    // Rod: Manley 14005-1 H-beam (Build Notes/manley-14005-rods.md): C-C 153.95 [Manley], 800 g [Manley] split 0.26 small end /
    // 0.54 big end (est.); mRec = piston group 0.64 (est.) + 0.26.
    bore: 100, stroke: 95, rod: 153.95, cr: 9.0, mRec: 0.90, mRot: 0.54,
    rodClrCustom: 0.041, mainClrCustom: 0.051,
    rodWidth: 21.4, mainWidth: 23.4, mainPitch: 114,
    oil: "15W-50", sumpC: 110, oilPsi: 60, feedMain: 6, feedRod: 5,
    // v0.2 -- wrist pin and rod column (all estimates except pinOD, FSM)
    mPistonGroup: 0.64, pinOD: 26.0, pinID: 15.0, pinLength: 66, smallEndWidth: 22, bossLength: 18,
    // Manley H-beam section, photo estimates: plates at +-z, depth (z) 21, plate width (x) 32, plates 3.5, web 6 (x). 4340 Q&T typ.
    rodOrient: "H", beamHeight: 21, flangeWidth: 32, flangeThk: 3.5, webThk: 6.0, rodYield: 950,
    // ARP 2000 3/8 cap screws (Manley 42351-1): preload from 0.006 in stretch ~50 kN (range 44-56), shank dia ~7.9 mm (est.)
    boltPreloadKN: 50, boltShankD: 7.9,
    cam: "Stock", backRatio: 1.2,
  },
  camSet: "1FZ-FE",
  veBasis: { kind: "project.py", set: "1FZ-FE", cam: "Stock", note: "turbo-dyno-projection/project.py stock VE curve, other grinds by flow-integral ratio (cams.js)" },
  // FJ80 table bins are PROPOSED (the real tune is an encrypted binary): emu-table-conventions.md
  tables: {
    ignRpm: [500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000],
    ignMap: [20, 35, 50, 65, 80, 100, 125, 150, 175, 200, 230, 260, 290, 325, 360, 400],
    boostRpm: [2000, 2500, 3000, 4000, 5000, 6000, 6500, 7000],
    boostPedal: [0, 15, 30, 45, 60, 75, 90, 100],
  },
  targetLbft: 600, rpmMax: 7000,
  tags: {},
};

// ---- 2JZ-GE block, VVT-i head (MKIV Supra), stock bottom end --------------------------------------------------
// Masses: piston 407 g + pin 132 g [forum, GTE parts; the GE 10:1 piston is not the GTE piston] + rings 30 g (est.) = 0.569 kg.
// Stock GTE rod 761 g stripped / 800 g with bearing [forum]. Small-end share 0.245 of the stripped rod = 187 g, from the centre of
// mass of the photo-derived envelope (photos/gte_rod_envelope.py, stock-gte-rod.md); the bearing (39 g) rides the big end.
// mRec = 0.569 + 0.187 = 0.756, mRot = 0.574 + 0.039 = 0.613. (Before 2026-11-21: 1/3 split est., 0.836 / 0.533.)
// Cross-check: piston 407 + pin 132 + rings 30 + rod 800 = 1369 g against the 1342 g complete GTE assembly figure (+2 %).
// Pin: OD 22.0 [FSM]. ID 13.0 and length 68 are back-solved/estimated together: a 22 mm OD steel pin 68 mm long weighs 132 g
// (the forum figure) at ID 13.0 mm.
// Oil pressure: 5.8 bar hot at 3000-3500 rpm [build notes, notes/oil_pressure.md] = 84 psi.
// Boost 135 kPa gauge = MAP 236 kPa abs (101.3 + 135, as the SUPRA note's PR 2.34). Spark 20 deg: the 2026-09-19 tune's
// E0 table reads 6.5 deg and its E100 table 21.5 deg at 5632 rpm / 240 kPa. The flex blend's 14 % table 1 is at 62.5 % ethanol
// (19.4 deg); at 60 % the tune's tblsFFIgnBlend gives 18.2 % table 1, i.e. 18.8 deg [tune, derived; corrected 2026-11-21, this
// line said 14 % at 60 %]. Default kept at 20; supra-maps-stress.md uses the interpolated table value instead.
// backRatio 0.9: measured EMAP/MAP, 0.87-0.91 at MAP > 165 kPa and 5-6k rpm [build notes, emap_map_ratio_cam_overlap.md s.2].
const JZ = {
  label: "2JZ-GE block / VVT-i head", car: "MKIV Supra",
  journals: { main: 62, rod: 52 },                                              // mm, FSM std (61.984-62.000 / 51.982-52.000)
  clr: { rod: { min: 0.023, mid: 0.032, max: 0.041 }, main: { min: 0.026, mid: 0.033, max: 0.040 } },   // FSM std, diametral mm
  defaults: {
    rpm: 5500, mapKPa: 236, targetTorqueLbft: 475, spark: 20, fuel: "E60", lambda: 0.8,
    bore: 86, stroke: 86, rod: 142, cr: 10.0, mRec: 0.756, mRot: 0.613,
    rodClrCustom: 0.032, mainClrCustom: 0.033,
    rodWidth: 19.3, mainWidth: 20.0, mainPitch: 98,
    oil: "10W-40", sumpC: 100, oilPsi: 84, feedMain: 5, feedRod: 4,
    mPistonGroup: 0.569, pinOD: 22.0, pinID: 13.0, pinLength: 68, smallEndWidth: 22, bossLength: 20,
    // Stock 2JZ-GTE I-beam rod, reverse-engineered from a photo (stock-gte-rod.md): rails at the swing-plane edges (x).
    // Measured on the photo, scaled from the 55.03 mm housing bore and 22.01 mm bushing ID: shank width 19.5 mm at mid-length,
    // rail 6.6 (x). Not visible face-on, solved so the envelope x 7.85 g/cm3 = 761 g: forged depth 16.9 (z), web 5.1 (z) at
    // tw = 0.3 B (est.). Stock forged steel, yield 650 MPa (est.).
    rodLabel: "Stock 2JZ-GTE I-beam (photo-measured, depth mass-solved to 761 g)",
    rodOrient: "I", beamHeight: 19.5, flangeWidth: 16.9, flangeThk: 6.6, webThk: 5.1, rodYield: 650,
    boltPreloadKN: 28, boltShankD: 8.0,                                         // stock cap bolts, both est.
    cam: "BC0311-S2", backRatio: 0.9,
  },
  camSet: "2JZ",
  // VE basis: Will's measured EMU VE table 1 ("autotune-filtered + smoothed 20260629" CSV, supra/exports), for the installed BC0311 S2.
  // VE(rpm) = mean of the three highest-load MAP columns (211, 225, 240 kPa abs), 20 rpm bins, / 100. The default boost (236 kPa abs)
  // sits in that band; the 240 column alone is an edge cell bent upward by the smoothing. Other grinds: cams.js flow-integral scaling.
  // valveD 34.5 mm (est.) only sets the lift/D flow curve used for that ratio.
  veBasis: {
    kind: "table", set: "2JZ", cam: "BC0311-S2", valveD: 34.5,
    rpm: [500, 842, 1184, 1526, 1868, 2211, 2553, 2895, 3237, 3579, 3921, 4263, 4605, 4947, 5289, 5632, 5974, 6316, 6658, 7000],
    ve: [0.7123, 0.7263, 0.7403, 0.7550, 0.7697, 0.7843, 0.7987, 0.8127, 0.8253, 0.8377, 0.8490, 0.8587, 0.8670, 0.8733, 0.8783, 0.8810, 0.8817, 0.8793, 0.8747, 0.8670],
    source: "emu-black-tuning-notes/supra/exports/VE table 1 autotune-filtered + smoothed 20260629.csv, columns 211/225/240 kPa averaged",
  },
  tables: {
    ignRpm: [500, 842, 1184, 1526, 1868, 2211, 2553, 2895, 3237, 3579, 3921, 4263, 4605, 4947, 5289, 5632, 5974, 6316, 6658, 7000],
    ignMap: [20, 35, 49, 64, 79, 93, 108, 123, 137, 152, 167, 181, 196, 211, 225, 240],
    boostRpm: [3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000],
    boostPedal: [0, 6, 28, 42, 58, 72, 86, 98],
  },
  targetLbft: 475, rpmMax: 7000,
  tags: {
    bore: "FSM", stroke: "typ (web)", rod: "catalogue (Eagle)", cr: "build notes", fuel: "build notes (E60 mid blend)", lambda: "est.",
    mapKPa: "build notes (135 kPa gauge)", rpm: "est. operating point", spark: "build notes (tune blend, derived)", targetTorqueLbft: "build notes",
    mRec: "forum (GTE piston 407 g, pin 132 g) + est. rings 30 g + small end 187 g (photo envelope CG)", mRot: "forum (761 g rod + 39 g bearing) / photo envelope CG split",
    mPistonGroup: "forum + est. rings", pinOD: "FSM", pinID: "est. (back-solved from 132 g)", pinLength: "est.", smallEndWidth: "est.", bossLength: "est.",
    rodWidth: "catalogue (ACL 6B8100)", mainWidth: "est. (prior code)", mainPitch: "est. (typ JZ-family bore spacing, not cited)",
    journals: "FSM", clr: "FSM", oilPsi: "build notes (5.8 bar hot, 3000-3500 rpm)", oil: "est.", sumpC: "est. (82 C thermostat plate, CLT 95-111 C)",
    feedMain: "est.", feedRod: "est.", rodOrient: "photo", beamHeight: "photo (stock GTE rod)", flangeWidth: "mass-solved (761 g, tw = 0.3 B est.)", flangeThk: "photo", webThk: "mass-solved (tw = 0.3 B est.)", rodYield: "est.",
    boltPreloadKN: "est.", boltShankD: "est.", backRatio: "build notes (measured EMAP/MAP)", cam: "build notes (BC0311 S2)",
    veBasis: "build notes (measured EMU VE table 1, 2026-06-29 CSV)", stockCam: "est., unverified (web)",
  },
};

export const ENGINES = { "1FZ-FE": FZ, "2JZ": JZ };
