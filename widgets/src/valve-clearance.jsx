// Piston-to-Valve (P2V) clearance calculator — blog widget module.
//
// GENERATED from index.html by tools/sync-widget.mjs. Do not edit by hand —
// edit index.html (the canonical standalone app) and re-run the sync.

import React, { useState, useMemo, useEffect, useRef, useContext } from "react";

// =============================================================================
// Piston-to-Valve (P2V) clearance — physics
// -----------------------------------------------------------------------------
// Lengths in mm, angles in crank degrees. A four-stroke is a 720° cycle; we use
// a frame where the *overlap* TDC (exhaust→intake) is 0. Positive angles run
// ATDC into the intake stroke (BDC at +180), negative run BTDC back through the
// exhaust stroke (its BDC at −180). The firing TDC sits at ±360, where both
// valves are shut — so P2V interference can only happen near 0 (overlap).
//
// The piston follows an exact slider-crank (360°-periodic). The valves live
// across the full 720°: intake opens just after 0 and shuts past +180; exhaust
// opens before −180 and shuts just past 0. That separation is why a 360-only
// view makes the exhaust look mistimed — it isn't, it's a stroke away.
//
// First-order, directional model for *comparing against stock* — not a substitute
// for claying the engine. Trust the deviation from stock; clay the absolute.
// =============================================================================

const rad = (d) => (d * Math.PI) / 180;
const mmToIn = (mm) => mm / 25.4;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const fmt = (n, dp = 2) => (Math.round(n * 10 ** dp) / 10 ** dp).toFixed(dp);

// Slider-crank: how far the piston has descended below TDC at crank angle theta.
function pistonDescent(theta, stroke, rod) {
  const R = stroke / 2;
  const t = rad(theta);
  return R + rod - (R * Math.cos(t) + Math.sqrt(rod * rod - R * R * Math.sin(t) * Math.sin(t)));
}

// Half-cosine valve-lift lobe: 0 at the open/close points, peak at the
// centerline. `centerline` is the crank angle of peak lift; `duration` is the
// full open duration in crank degrees.
function valveLift(theta, centerline, duration, maxLift) {
  const half = duration / 2;
  const d = theta - centerline;
  if (d <= -half || d >= half) return 0;
  return maxLift * 0.5 * (1 + Math.cos(Math.PI * (d / half)));
}

// Vertical drop of the valve's closest-to-piston edge below the fire deck.
// A bigger valve head at seat angle `angle` hangs its rim lower by
// (Δradius)·sin(angle) — that's how valve diameter eats into clearance.
function valveDrop(lift, cam) {
  const recessEff = cam.recess + (Math.max(0, cam.dia - cam.diaStock) / 2) * Math.sin(rad(cam.angle));
  return recessEff + lift * Math.cos(rad(cam.angle));
}

// P2V clearance at one crank angle for one valve. `cam.pocket` is the valve-relief
// depth machined into the piston on THIS side (intake or exhaust).
function clearanceAt(theta, block, cam) {
  const gapPistonToDeck = block.deckClear + block.gasket + pistonDescent(theta, block.stroke, block.rod);
  const lift = valveLift(theta, cam.centerline, cam.duration, cam.maxLift);
  return gapPistonToDeck + cam.pocket - valveDrop(lift, cam);
}

// Scan the overlap window for the tightest clearance. ±180 covers even very long
// cams; the firing TDC at ±360 is excluded but the valves are shut there anyway.
function scanMin(block, cam, lo = -180, hi = 180, step = 0.5) {
  let best = Infinity, bestT = 0;
  for (let t = lo; t <= hi; t += step) {
    const c = clearanceAt(t, block, cam);
    if (c < best) { best = c; bestT = t; }
  }
  return { clearance: best, theta: bestT };
}

// ---- Cam timing from the four valve events --------------------------------
// Inputs follow the user's reference convention:
//   intake:  IO = °ATDC,  IC = °ABDC
//   exhaust: EO = °BBDC,  EC = °BTDC
// Converted into our overlap-TDC=0 frame, then phased by VVT.
function intakeCam(intake, advance) {
  const phiIO = intake.io;                 // ATDC
  const phiIC = 180 + intake.ic;           // ABDC, past +180 BDC
  const centerline = (phiIO + phiIC) / 2 - advance; // advance pulls it earlier
  return { centerline, duration: phiIC - phiIO };
}
function exhaustCam(exhaust, retard) {
  const phiEO = -180 - exhaust.eo;         // BBDC, before −180 BDC
  const phiEC = -exhaust.ec;               // BTDC, before 0
  const centerline = (phiEO + phiEC) / 2 + retard;  // retard pushes it later
  return { centerline, duration: phiEC - phiEO };
}

// ---- Self-test (fails loudly in console if the physics regress) -------------
(function selfTest() {
  console.assert(Math.abs(pistonDescent(0, 80, 130)) < 1e-9, "piston at TDC must be 0");
  console.assert(pistonDescent(90, 80, 130) > 0 && Math.abs(pistonDescent(360, 80, 130)) < 1e-9, "piston 360-periodic");
  console.assert(Math.abs(valveLift(100, 100, 240, 10) - 10) < 1e-9, "peak lift at centerline");
  console.assert(valveLift(-30, 100, 240, 10) === 0, "no lift outside duration");
  const ic = intakeCam({ io: -5, ic: 45 }, 0);
  console.assert(Math.abs(ic.centerline - 110) < 1e-9 && Math.abs(ic.duration - 230) < 1e-9, "intake event→centerline/duration");
  const ec = exhaustCam({ eo: 45, ec: -5 }, 0);
  console.assert(Math.abs(ec.centerline + 110) < 1e-9, "exhaust centerline is BTDC (negative)");
  const cam = { centerline: 110, duration: 230, maxLift: 10, recess: 1, dia: 30, diaStock: 30, angle: 20, pocket: 2 };
  const b = { stroke: 80, rod: 130, deckClear: 0.5, gasket: 0.7 };
  console.assert(scanMin({ ...b, deckClear: 1.5 }, cam).clearance > scanMin(b, cam).clearance, "more deck clearance → more P2V");
  console.assert(scanMin(b, { ...cam, pocket: 3 }).clearance > scanMin(b, cam).clearance, "deeper relief → more P2V");
})();

// =============================================================================
// Configuration assembly — stock baseline vs the modified ("current") engine
// =============================================================================
function buildConfig(stock, mods, vtecActive) {
  const block = {
    stroke: stock.stroke, rod: stock.rod, bore: stock.bore,
    deckClear: stock.deckClear - mods.deckMill, // milling the deck drops the head
    gasket: mods.gasket,                          // a thicker gasket lifts it back
  };
  const ic = intakeCam(stock.intake, mods.intakeAdvance);
  const ec = exhaustCam(stock.exhaust, mods.exhaustRetard);
  const intake = {
    angle: stock.intake.angle, dia: mods.intakeDia, diaStock: stock.intake.dia,
    recess: stock.intake.recess, pocket: stock.pocketInt, // piston relief is a fixed piston property
    maxLift: vtecActive ? stock.vtec.intLift : stock.intake.lift,
    duration: vtecActive ? stock.vtec.intDur : ic.duration,
    centerline: ic.centerline,
  };
  const exhaust = {
    angle: stock.exhaust.angle, dia: mods.exhaustDia, diaStock: stock.exhaust.dia,
    recess: stock.exhaust.recess, pocket: stock.pocketExh,
    maxLift: vtecActive ? stock.vtec.exhLift : stock.exhaust.lift,
    duration: vtecActive ? stock.vtec.exhDur : ec.duration,
    centerline: ec.centerline,
  };
  return { block, intake, exhaust, ic, ec };
}

// The untouched factory engine — the yardstick everything is measured against.
// (Relief depth lives on `stock`, so it's shared by both configs: changing it
// moves the real clearance rather than only the hidden baseline.)
function stockConfig(stock) {
  return buildConfig(stock, {
    deckMill: 0, gasket: stock.gasket,
    intakeDia: stock.intake.dia, exhaustDia: stock.exhaust.dia,
    intakeAdvance: 0, exhaustRetard: 0,
  }, false);
}

// =============================================================================
// Defaults — a Honda B16-flavoured VTEC four (so VTEC actually does something)
// =============================================================================
// Cam cards quote advertised duration + centerline; we derive our seat-to-seat
// event convention (IO °ATDC, IC °ABDC, EO °BBDC, EC °BTDC) from those.
const camEvents = (clIn, durIn, clEx, durEx) => ({
  io: clIn - durIn / 2,
  ic: clIn + durIn / 2 - 180,
  eo: clEx + durEx / 2 - 180,
  ec: clEx - durEx / 2,
});

// ---- Engines ---------------------------------------------------------------
// Geometry + factory piston valve-relief depths (iPocket/ePocket, per side — the
// 2JZ runs famously deep reliefs) + an OEM-ish stockCam. `fam` tags which cams
// bolt up. `vtec` (when present) is the high lobe a VTEC engine switches to.
const ENGINES = {
  "Honda B16 — VTEC I4": { bore: 81, stroke: 77.4, rod: 134, deck: 0.5, gasket: 0.7, angle: 22, iDia: 33, eDia: 28, iRec: 1.2, eRec: 1.4, iPocket: 2.0, ePocket: 2.0, fam: "b",
    vtec: { intLift: 11.5, intDur: 252, exhLift: 10.5, exhDur: 248 }, stockCam: { iLift: 10.3, iDur: 230, iCL: 110, eLift: 9.4, eDur: 230, eCL: 110 } },
  "Honda K20A2 / Z3 — VTEC I4": { bore: 86, stroke: 86, rod: 139, deck: 0.4, gasket: 0.7, angle: 23, iDia: 35, eDia: 30, iRec: 1.0, eRec: 1.2, iPocket: 1.8, ePocket: 1.8, fam: "k",
    vtec: { intLift: 11.5, intDur: 238, exhLift: 10.5, exhDur: 235 }, stockCam: { iLift: 10.7, iDur: 226, iCL: 112, eLift: 10.2, eDur: 222, eCL: 112 } },
  "Toyota 1JZ-GTE": { bore: 86, stroke: 71.5, rod: 138.6, deck: 0.5, gasket: 1.2, angle: 21, iDia: 34, eDia: 29.5, iRec: 1.3, eRec: 1.5, iPocket: 2.0, ePocket: 2.0, fam: "1j-nonvvti",
    stockCam: { iLift: 8.2, iDur: 224, iCL: 115, eLift: 8.2, eDur: 228, eCL: 115 } },
  "Toyota 1JZ-GTE VVTi": { bore: 86, stroke: 71.5, rod: 138.6, deck: 0.5, gasket: 1.2, angle: 21, iDia: 34, eDia: 29.5, iRec: 1.3, eRec: 1.5, iPocket: 2.0, ePocket: 2.0, fam: "jz-vvti", vvti: true,
    stockCam: { iLift: 8.7, iDur: 232, iCL: 110, eLift: 8.4, eDur: 236, eCL: 114 } },
  "Toyota 2JZ-GTE": { bore: 86, stroke: 86, rod: 142, deck: 0.4, gasket: 1.3, angle: 21.5, iDia: 33.5, eDia: 29, iRec: 1.3, eRec: 1.5, iPocket: 6.6, ePocket: 5.35, fam: "2j-nonvvti",
    stockCam: { iLift: 8.25, iDur: 224, iCL: 115, eLift: 8.25, eDur: 236, eCL: 115 } },
  "Toyota 2JZ-GTE VVTi": { bore: 86, stroke: 86, rod: 142, deck: 0.4, gasket: 1.3, angle: 21.5, iDia: 33.5, eDia: 29, iRec: 1.3, eRec: 1.5, iPocket: 6.6, ePocket: 5.35, fam: "jz-vvti", vvti: true,
    stockCam: { iLift: 8.7, iDur: 232, iCL: 110, eLift: 8.4, eDur: 236, eCL: 114 } },
  "Toyota 2JZ-GE VVTi": { bore: 86, stroke: 86, rod: 142, deck: 0.4, gasket: 1.2, angle: 21.5, iDia: 33.5, eDia: 29, iRec: 1.3, eRec: 1.5, iPocket: 7.0, ePocket: 9.0, fam: "jz-vvti", vvti: true,
    stockCam: { iLift: 8.4, iDur: 228, iCL: 112, eLift: 8.2, eDur: 232, eCL: 114 } },
  "Chevy LS — pushrod V8": { bore: 101.6, stroke: 92, rod: 154, deck: 0.25, gasket: 1.0, angle: 15, iDia: 54, eDia: 41.5, iRec: 1.0, eRec: 1.2, iPocket: 1.5, ePocket: 1.5, fam: "ls",
    stockCam: { iLift: 13.5, iDur: 196, iCL: 110, eLift: 13.0, eDur: 207, eCL: 116 } },
};

// ---- Aftermarket cams ------------------------------------------------------
// `fits` lists the engine families a cam bolts into. BC0311/BC0312/BC0331/BC0332
// and the GSC VVTi cores fit any of the JZ VVTi engines (`jz-vvti`).
const CAMS = {
  "BC0331 — 1JZGTE Stage 2": { iLift: 8.74, iDur: 264, iCL: 110, eLift: 8.74, eDur: 264, eCL: 118, fits: ["1j-nonvvti", "jz-vvti"] },
  "BC0332 — 1JZGTE Stage 3": { iLift: 9.52, iDur: 272, iCL: 110, eLift: 9.65, eDur: 272, eCL: 118, fits: ["1j-nonvvti", "jz-vvti"] },
  "BC0311 — 2JZGE VVTi Stage 2": { iLift: 8.74, iDur: 264, iCL: 110, eLift: 8.74, eDur: 264, eCL: 118, fits: ["jz-vvti"] },
  "BC0312 — 2JZGE VVTi Stage 3": { iLift: 9.52, iDur: 272, iCL: 110, eLift: 9.65, eDur: 272, eCL: 118, fits: ["jz-vvti"] },
  "GSC 7031 S2 — 2JZ VVTi billet": { iLift: 10.20, iDur: 274, iCL: 109, eLift: 10.50, eDur: 274, eCL: 118, fits: ["jz-vvti"] },
  "BC0302 — 2JZGTE Stage 3": { iLift: 9.52, iDur: 272, iCL: 110, eLift: 9.65, eDur: 272, eCL: 118, fits: ["2j-nonvvti"] },
  "GSC 7030 S1 — 2JZGTE billet": { iLift: 9.90, iDur: 269, iCL: 108, eLift: 9.90, eDur: 269, eCL: 114, fits: ["2j-nonvvti"] },
  "GSC S2 — 2JZGTE billet": { iLift: 10.20, iDur: 274, iCL: 109, eLift: 10.20, eDur: 274, eCL: 119, fits: ["2j-nonvvti"] },
  "BC0042-2 — K20A2/Z3 Stage 2": { iLift: 13.34, iDur: 304, iCL: 101, eLift: 11.99, eDur: 300, eCL: 109, fits: ["k"] },
};

// Cam picklist for an engine: its OEM cam first, then every compatible aftermarket cam.
function camsForEngine(engKey) {
  const eng = ENGINES[engKey];
  const opts = { "OEM / stock": eng.stockCam };
  for (const [name, cam] of Object.entries(CAMS)) if (cam.fits.includes(eng.fam)) opts[name] = cam;
  return opts;
}

// Compose a full stock config from an engine + a cam spec.
function composeStock(eng, cam) {
  const e = camEvents(cam.iCL, cam.iDur, cam.eCL, cam.eDur);
  return {
    bore: eng.bore, stroke: eng.stroke, rod: eng.rod, deckClear: eng.deck, gasket: eng.gasket,
    pocketInt: eng.iPocket, pocketExh: eng.ePocket,
    intake:  { angle: eng.angle, dia: eng.iDia, recess: eng.iRec, lift: cam.iLift, io: e.io, ic: e.ic },
    exhaust: { angle: eng.angle, dia: eng.eDia, recess: eng.eRec, lift: cam.eLift, eo: e.eo, ec: e.ec },
    vtec: eng.vtec || { intLift: cam.iLift, intDur: cam.iDur, exhLift: cam.eLift, exhDur: cam.eDur },
  };
}

const DEFAULT_ENGINE = "Honda B16 — VTEC I4";
const DEFAULT_CAM = "OEM / stock";
const DEFAULT_STOCK = composeStock(ENGINES[DEFAULT_ENGINE], ENGINES[DEFAULT_ENGINE].stockCam);
const DEFAULT_MODS = {
  deckMill: 0, gasket: DEFAULT_STOCK.gasket,
  intakeDia: DEFAULT_STOCK.intake.dia, exhaustDia: DEFAULT_STOCK.exhaust.dia, intakeAdvance: 0, exhaustRetard: 0,
};

// Safe-minimum guidance (mm). Exhaust runs hotter and stretches, so it wants more.
const THRESH = { cautionInt: 1.3, dangerInt: 0.9, cautionExh: 1.5, dangerExh: 1.0 };
function statusFor(clear, caution, danger) {
  if (clear < danger) return { key: "danger", label: "INTERFERENCE RISK", color: "#dc2626" };
  if (clear < caution) return { key: "caution", label: "tight — verify", color: "#d97706" };
  return { key: "ok", label: "clear", color: "#16a34a" };
}

// =============================================================================
// Theme — light & dark, inherited from the host Quartz blog (`saved-theme` /
// `themechange`) like the focaccia calc; standalone falls back to the OS
// preference. Same keys in both palettes; mono is shared.
// =============================================================================
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const THEMES = {
  dark: {
    bg: "#14101e", panel: "#1e1830", panel2: "#272040", ink: "#f5f3fc",
    inkSoft: "#9b95b5", line: "#3a3358", accent: "#a78bfa", accentDeep: "#7c3aed",
    intake: "#60a5fa", exhaust: "#f87171", piston: "#cbb58b", mono: MONO,
  },
  light: {
    bg: "#f7f6fb", panel: "#ffffff", panel2: "#f1eefa", ink: "#1a1730",
    inkSoft: "#6b6688", line: "#d8d2ec", accent: "#7c3aed", accentDeep: "#6d28d9",
    intake: "#2563eb", exhaust: "#dc2626", piston: "#9a7730", mono: MONO,
  },
};
const ThemeCtx = React.createContext(THEMES.dark);
const useC = () => useContext(ThemeCtx);

// =============================================================================
// Small UI pieces
// =============================================================================
function NumField({ label, value, onChange, step = 0.1, min, max, unit, w = 88 }) {
  const C = useC();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: C.inkSoft }}>
      <span>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <input type="number" value={value} step={step} min={min} max={max}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          style={{ width: w, background: C.bg, color: C.ink, border: `1px solid ${C.line}`,
            borderRadius: 6, padding: "5px 7px", fontFamily: C.mono, fontSize: 13 }} />
        {unit && <span style={{ fontFamily: C.mono, fontSize: 11 }}>{unit}</span>}
      </span>
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, unit, color, readout, disabled }) {
  const C = useC();
  const col = color || C.accent;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, opacity: disabled ? 0.45 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span style={{ color: C.ink }}>{label}</span>
        <span style={{ fontFamily: C.mono, color: col, fontWeight: 600 }}>
          {readout != null ? readout : `${value}${unit || ""}`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: col }} />
    </div>
  );
}

function Section({ title, sub, children }) {
  const C = useC();
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: 0.2 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

const grid = (cols) => ({ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 10 });

// =============================================================================
// Charts (hand-rolled SVG — no chart lib)
// =============================================================================
function ClearanceChart({ intakeCurve, exhaustCurve, stockIntake, stockExhaust, theta }) {
  const C = useC();
  const W = 520, H = 230, padL = 44, padR = 12, padT = 12, padB = 28;
  const xs = intakeCurve.map((p) => p.theta);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const allY = [...intakeCurve, ...exhaustCurve, ...stockIntake, ...stockExhaust].map((p) => p.clear);
  const yMax = Math.max(6, Math.ceil(Math.max(...allY)));
  const yMin = Math.min(0, Math.floor(Math.min(...allY)));
  const X = (t) => padL + ((t - xMin) / (xMax - xMin)) * (W - padL - padR);
  const Y = (c) => padT + (1 - (c - yMin) / (yMax - yMin)) * (H - padT - padB);
  const path = (curve) => curve.map((p, i) => `${i ? "L" : "M"}${X(p.theta).toFixed(1)} ${Y(p.clear).toFixed(1)}`).join(" ");
  const yticks = []; for (let v = yMin; v <= yMax; v += yMax <= 8 ? 1 : 2) yticks.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {yticks.map((v) => (
        <g key={v}>
          <line x1={padL} y1={Y(v)} x2={W - padR} y2={Y(v)} stroke={C.line} strokeWidth={v === 0 ? 1.4 : 0.6} />
          <text x={padL - 6} y={Y(v) + 3} textAnchor="end" fontSize="10" fill={C.inkSoft} fontFamily={C.mono}>{v}</text>
        </g>
      ))}
      <line x1={padL} y1={Y(THRESH.cautionExh)} x2={W - padR} y2={Y(THRESH.cautionExh)} stroke="#d97706" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
      <line x1={padL} y1={Y(THRESH.dangerExh)} x2={W - padR} y2={Y(THRESH.dangerExh)} stroke="#dc2626" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
      <line x1={X(0)} y1={padT} x2={X(0)} y2={H - padB} stroke={C.inkSoft} strokeWidth="0.8" opacity="0.5" />
      <text x={X(0)} y={H - padB + 14} textAnchor="middle" fontSize="9.5" fill={C.inkSoft} fontFamily={C.mono}>TDC</text>
      <line x1={X(theta)} y1={padT} x2={X(theta)} y2={H - padB} stroke={C.accent} strokeWidth="1.2" opacity="0.9" />
      <path d={path(stockIntake)} fill="none" stroke={C.intake} strokeWidth="1" opacity="0.35" strokeDasharray="4 3" />
      <path d={path(stockExhaust)} fill="none" stroke={C.exhaust} strokeWidth="1" opacity="0.35" strokeDasharray="4 3" />
      <path d={path(intakeCurve)} fill="none" stroke={C.intake} strokeWidth="2.2" />
      <path d={path(exhaustCurve)} fill="none" stroke={C.exhaust} strokeWidth="2.2" />
      <text x={W - padR} y={H - 4} textAnchor="end" fontSize="10" fill={C.inkSoft} fontFamily={C.mono}>crank° (TDC overlap = 0)</text>
    </svg>
  );
}

// Full 720° valve-event view: exhaust on the up-stroke into overlap, intake on
// the down-stroke out of it. Marks both TDCs and both BDCs so the timing reads.
function LiftChart({ intake, exhaust, theta }) {
  const C = useC();
  const W = 520, H = 168, padL = 30, padR = 12, padT = 12, padB = 26;
  const data = [];
  for (let t = -360; t <= 360; t += 3) {
    data.push({ t, i: valveLift(t, intake.centerline, intake.duration, intake.maxLift),
      e: valveLift(t, exhaust.centerline, exhaust.duration, exhaust.maxLift) });
  }
  const yMax = Math.max(intake.maxLift, exhaust.maxLift) * 1.12;
  const X = (t) => padL + ((t + 360) / 720) * (W - padL - padR);
  const Y = (v) => padT + (1 - v / yMax) * (H - padT - padB);
  const path = (key) => data.map((p, idx) => `${idx ? "L" : "M"}${X(p.t).toFixed(1)} ${Y(p[key]).toFixed(1)}`).join(" ");
  const marks = [[-360, "TDC"], [-180, "BDC"], [0, "TDC·overlap"], [180, "BDC"], [360, "TDC"]];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* overlap shading near 0 */}
      <rect x={X(-60)} y={padT} width={X(60) - X(-60)} height={H - padT - padB} fill={C.accent} opacity="0.07" />
      <line x1={padL} y1={Y(0)} x2={W - padR} y2={Y(0)} stroke={C.line} />
      {marks.map(([t, lbl]) => (
        <g key={t}>
          <line x1={X(t)} y1={padT} x2={X(t)} y2={H - padB} stroke={C.inkSoft} strokeWidth="0.7" opacity={t === 0 ? 0.6 : 0.3} />
          <text x={X(t)} y={H - padB + 13} textAnchor="middle" fontSize="9" fill={C.inkSoft} fontFamily={C.mono}>{lbl}</text>
        </g>
      ))}
      <line x1={X(theta)} y1={padT} x2={X(theta)} y2={H - padB} stroke={C.accent} strokeWidth="1.2" />
      <path d={path("e")} fill="none" stroke={C.exhaust} strokeWidth="2" />
      <path d={path("i")} fill="none" stroke={C.intake} strokeWidth="2" />
      <text x={padL} y={padT + 6} fontSize="10" fill={C.inkSoft} fontFamily={C.mono}>lift (mm) · full 720° cycle</text>
    </svg>
  );
}

// =============================================================================
// Cross-section — a schematic slice at the selected crank angle
// =============================================================================
// Isometric slice: ONE px-per-mm scale for both axes, keyed to the real bore, so
// the bore, the full stroke, the valve heads and the canted valve-angle reliefs
// are all drawn to scale. The view is tall enough to show the whole stroke, so
// the piston stays on-screen TDC→BDC.
function CrossSection({ cfg, theta }) {
  const C = useC();
  const W = 360, marginX = 22, headTop = 16, headH = 30, bottomPad = 34;
  const bore = cfg.block.bore;
  const pp = (W - 2 * marginX) / bore;     // fit the bore diameter to the width
  const cx = W / 2, yDeck = headTop + headH;
  const X = (mm) => cx + mm * pp;          // bore-centered x (mm) → px
  const Y = (depth) => yDeck + depth * pp; // depth below deck (mm) → px

  // full stroke in view: BDC sits at the bottom of the bore, to scale
  const bdcDepth = cfg.block.deckClear + cfg.block.gasket + cfg.block.stroke;
  const H = Math.round(yDeck + bdcDepth * pp + bottomPad);
  const boreBottom = H - bottomPad;

  // seat the two valves inside the bore; split the leftover into gap + walls
  const iDia = cfg.intake.dia, eDia = cfg.exhaust.dia;
  const wall = Math.max(1, bore - iDia - eDia) * 0.35;
  const xI = -bore / 2 + wall + iDia / 2, xE = bore / 2 - wall - eDia / 2;

  const pistonDepth = cfg.block.deckClear + cfg.block.gasket + pistonDescent(theta, cfg.block.stroke, cfg.block.rod);
  const pistonY = Y(pistonDepth);
  const boreL = X(-bore / 2), boreR = X(bore / 2);

  const mkValve = (xc, cam, tiltSign) => {
    const lift = valveLift(theta, cam.centerline, cam.duration, cam.maxLift);
    const drop = valveDrop(lift, cam);
    return { lift, drop, tilt: tiltSign * cam.angle, xc, dia: cam.dia, pocket: cam.pocket,
      faceR: (cam.dia / 2) * pp, axialPx: (drop * pp) / Math.cos(rad(cam.angle)), faceCenterY: Y(drop),
      clear: clearanceAt(theta, cfg.block, cam) };
  };
  const vi = mkValve(xI, cfg.intake, -1);
  const ve = mkValve(xE, cfg.exhaust, +1);

  // canted, to-scale relief: a valve-diameter-wide, pocket-deep slot cut into the
  // crown along the valve axis (rotate by the same tilt as the valve).
  // A valve relief is a fly-cut at the valve angle — in section a right triangle
  // whose hypotenuse lies flat along the piston crown. The base (floor) is
  // perpendicular to the valve stem (parallel to the valve face) and the adjacent
  // leg is parallel to the stem, meeting at the right angle below the crown. A
  // flat hypotenuse fixes the aspect ratio (small angle = valve angle), so we
  // scale it so the base (floor) leg = the valve width; the adjacent leg is then
  // width·tan(angle). (The clearance math still uses the true relief depth.)
  const Relief = ({ v }) => {
    const s = v.tilt < 0 ? -1 : 1;
    const a = rad(Math.max(1, Math.abs(v.tilt)));
    const tan = Math.tan(a), cot = 1 / tan;
    const P = v.dia * pp * Math.sin(a);              // altitude → base (floor) leg = valve width
    const cX = X(v.xc) - s * P * (tan - cot) / 2;     // center the opening under the valve
    const Ax = cX - s * P * cot;                      // floor lip (base ⊥ stem)
    const Bx = cX + s * P * tan;                      // wall lip (adjacent ∥ stem)
    const pts = `${Ax.toFixed(1)},${pistonY.toFixed(1)} ${Bx.toFixed(1)},${pistonY.toFixed(1)} ${cX.toFixed(1)},${(pistonY + P).toFixed(1)}`;
    return <polygon points={pts} fill={C.bg} stroke={C.piston} strokeWidth="1.5" opacity="0.9" />;
  };
  const Valve = ({ v, color, label }) => (
    <g transform={`translate(${X(v.xc)} ${yDeck}) rotate(${v.tilt})`}>
      <line x1="0" y1="-32" x2="0" y2={v.axialPx} stroke={color} strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
      <rect x="-3.2" y="-32" width="6.4" height="8" rx="2" fill={color} />
      <path d={`M${-v.faceR} ${v.axialPx} L${v.faceR} ${v.axialPx} L${v.faceR - 5} ${v.axialPx + 6} L${-v.faceR + 5} ${v.axialPx + 6} Z`}
        fill={color} opacity="0.92" />
      <text x="0" y="-37" textAnchor="middle" fontSize="10" fill={color} fontFamily={C.mono} fontWeight="600">{label}</text>
    </g>
  );
  const dim = (x, yTop, len, color) => (len > 4 && yTop > yDeck - 2 && yTop + len < boreBottom) ? (
    <g>
      <line x1={x} y1={yTop} x2={x} y2={yTop + len} stroke={color} strokeWidth="1.2" markerEnd="url(#ar)" markerStart="url(#ar)" />
      <rect x={x + 4} y={yTop + len / 2 - 8} width="50" height="16" rx="3" fill={C.panel} stroke={color} strokeWidth="0.7" />
      <text x={x + 29} y={yTop + len / 2 + 3.5} textAnchor="middle" fontSize="10" fill={color} fontFamily={C.mono}>{fmt(color === C.intake ? vi.clear : ve.clear)}mm</text>
    </g>
  ) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: C.bg, borderRadius: 12 }}>
      <defs>
        <marker id="ar" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">
          <path d="M1 1 L6 3.5 L1 6" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </marker>
        <clipPath id="bore"><rect x={boreL} y={yDeck} width={boreR - boreL} height={boreBottom - yDeck} /></clipPath>
      </defs>

      <rect x={boreL - 12} y={headTop - 4} width={boreR - boreL + 24} height={headH + 4} fill={C.panel2} stroke={C.line} />
      <text x={cx} y={headTop + 11} textAnchor="middle" fontSize="10" fill={C.inkSoft} fontFamily={C.mono}>{fmt(pp, 1)} px/mm · bore {fmt(bore, 0)} × stroke {fmt(cfg.block.stroke, 0)} (to scale)</text>
      <rect x={boreL} y={yDeck} width={boreR - boreL} height={Math.max(2, cfg.block.gasket * pp)} fill={C.accentDeep} opacity="0.55" />
      <line x1={boreL} y1={yDeck} x2={boreR} y2={yDeck} stroke={C.accent} strokeWidth="1.5" />
      <line x1={boreL} y1={yDeck} x2={boreL} y2={boreBottom} stroke={C.line} strokeWidth="2" />
      <line x1={boreR} y1={yDeck} x2={boreR} y2={boreBottom} stroke={C.line} strokeWidth="2" />
      <line x1={boreL} y1={boreBottom} x2={boreR} y2={boreBottom} stroke={C.line} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
      <text x={boreR} y={boreBottom - 4} textAnchor="end" fontSize="9" fill={C.inkSoft} fontFamily={C.mono}>BDC</text>

      <g clipPath="url(#bore)">
        <rect x={boreL} y={pistonY} width={boreR - boreL} height={Math.max(0, boreBottom - pistonY)} fill={C.piston} opacity="0.18" />
        {pistonY < boreBottom && <line x1={boreL} y1={pistonY} x2={boreR} y2={pistonY} stroke={C.piston} strokeWidth="2.5" />}
        <Relief v={vi} /><Relief v={ve} />
        <Valve v={vi} color={C.intake} label="IN" />
        <Valve v={ve} color={C.exhaust} label="EX" />
        {dim(X(vi.xc) - vi.faceR - 4, vi.faceCenterY, vi.clear * pp, C.intake)}
        {dim(X(ve.xc) + 4, ve.faceCenterY, ve.clear * pp, C.exhaust)}
      </g>

      <text x={boreL + 2} y={H - 22} fontSize="11" fill={C.intake} fontFamily={C.mono}>IN {fmt(vi.clear)}mm</text>
      <text x={boreR - 2} y={H - 22} textAnchor="end" fontSize="11" fill={C.exhaust} fontFamily={C.mono}>EX {fmt(ve.clear)}mm</text>
      <text x={cx} y={H - 6} textAnchor="middle" fontSize="9.5" fill={C.inkSoft} fontFamily={C.mono}>
        {fmt(Math.abs(theta), 0)}° {theta < 0 ? "BTDC" : "ATDC"} · piston {fmt(pistonDepth - cfg.block.deckClear - cfg.block.gasket)}mm down
      </text>
    </svg>
  );
}

// =============================================================================
// App
// =============================================================================
function App() {
  const [stock, setStock] = useState(DEFAULT_STOCK);
  const [mods, setMods] = useState(DEFAULT_MODS);
  const [vtecOn, setVtecOn] = useState(true);
  const [vtecRpm, setVtecRpm] = useState(5800);
  const [rpm, setRpm] = useState(3000);
  const [theta, setTheta] = useState(8);
  const [autoCrit, setAutoCrit] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [animTheta, setAnimTheta] = useState(0);

  // Light/dark inherits from the host Quartz blog (saved-theme / themechange);
  // standalone falls back to the OS preference. `embedded` hides the widget's own
  // title block when it's mounted inside a blog page (the page supplies the title).
  const [dark, setDark] = useState(() => {
    try {
      const s = document.documentElement.getAttribute("saved-theme");
      if (s) return s === "dark";
      return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch { return true; }
  });
  const C = dark ? THEMES.dark : THEMES.light;
  const rootRef = useRef(null);
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    setEmbedded(!!(rootRef.current && rootRef.current.closest("[data-widget]")));
    const onTheme = (e) => { if (e && e.detail && e.detail.theme) setDark(e.detail.theme === "dark"); };
    document.addEventListener("themechange", onTheme);
    return () => document.removeEventListener("themechange", onTheme);
  }, []);

  const vtecActive = vtecOn && rpm >= vtecRpm;
  const cfg = useMemo(() => buildConfig(stock, mods, vtecActive), [stock, mods, vtecActive]);
  const stockCfg = useMemo(() => stockConfig(stock), [stock]);

  const result = useMemo(() => {
    const i = scanMin(cfg.block, cfg.intake);
    const e = scanMin(cfg.block, cfg.exhaust);
    const si = scanMin(stockCfg.block, stockCfg.intake);
    const se = scanMin(stockCfg.block, stockCfg.exhaust);
    const curve = (block, cam) => {
      const a = []; for (let t = -90; t <= 90; t += 1) a.push({ theta: t, clear: clearanceAt(t, block, cam) }); return a;
    };
    return { i, e, si, se,
      intakeCurve: curve(cfg.block, cfg.intake), exhaustCurve: curve(cfg.block, cfg.exhaust),
      stockIntakeCurve: curve(stockCfg.block, stockCfg.intake), stockExhaustCurve: curve(stockCfg.block, stockCfg.exhaust) };
  }, [cfg, stockCfg]);

  // Animate the crank through a full 720° cycle (−360…+360) so the piston sweeps
  // both strokes and the valves fire in time.
  const raf = useRef(0), last = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const SPEED = 320; // crank°/sec
    last.current = 0;
    const tick = (ts) => {
      if (!last.current) last.current = ts;
      const dt = (ts - last.current) / 1000; last.current = ts;
      setAnimTheta((a) => { let n = a + SPEED * dt; if (n > 360) n -= 720; return n; });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const critTheta = result.i.clearance <= result.e.clearance ? result.i.theta : result.e.theta;
  const shownTheta = playing ? animTheta : (autoCrit ? critTheta : theta);

  // effective (post-VVT) events & overlap, in the user's reference convention
  const tim = useMemo(() => {
    const ci = cfg.ic, ce = cfg.ec;
    const io = ci.centerline - ci.duration / 2;          // ATDC
    const icl = ci.centerline + ci.duration / 2 - 180;    // ABDC
    const eo = -180 - (ce.centerline - ce.duration / 2);  // BBDC
    const ec = -(ce.centerline + ce.duration / 2);        // BTDC
    const overlap = (ce.centerline + ce.duration / 2) - (ci.centerline - ci.duration / 2);
    const lsa = (ci.centerline - ce.centerline) / 2;
    return { io, ic: icl, eo, ec, overlap, lsa, durI: ci.duration, durE: ce.duration };
  }, [cfg]);

  const setS = (path, v) => setStock((s) => {
    const n = structuredClone(s); const ks = path.split("."); let o = n;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = v; return n;
  });
  const setM = (k, v) => setMods((m) => ({ ...m, [k]: v }));

  const [engineKey, setEngineKey] = useState(DEFAULT_ENGINE);
  const [camKey, setCamKey] = useState(DEFAULT_CAM);
  const camOptions = camsForEngine(engineKey);

  const applyStock = (p) => {
    setStock(p);
    setMods({ deckMill: 0, gasket: p.gasket,
      intakeDia: p.intake.dia, exhaustDia: p.exhaust.dia, intakeAdvance: 0, exhaustRetard: 0 });
  };
  const applyEngine = (key) => {
    const eng = ENGINES[key];
    setEngineKey(key); setCamKey(DEFAULT_CAM);              // reset to the OEM cam
    applyStock(composeStock(eng, eng.stockCam));
    setVtecOn(!!eng.vtec);
  };
  const applyCam = (key) => {
    const eng = ENGINES[engineKey];
    setCamKey(key);
    applyStock(composeStock(eng, camsForEngine(engineKey)[key]));
  };

  const ResultCard = ({ title, color, cur, stk, caution, danger }) => {
    const st = statusFor(cur.clearance, caution, danger);
    const delta = cur.clearance - stk.clearance;
    return (
      <div style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color }}>{title}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, background: st.color + "22",
            border: `1px solid ${st.color}`, borderRadius: 20, padding: "2px 8px" }}>{st.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: C.mono, fontSize: 30, fontWeight: 700, color: st.color }}>{fmt(cur.clearance)}</span>
          <span style={{ fontSize: 13, color: C.inkSoft }}>mm</span>
          <span style={{ fontFamily: C.mono, fontSize: 12, color: C.inkSoft }}>({fmt(mmToIn(cur.clearance), 3)}″)</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 4, fontFamily: C.mono }}>
          stock {fmt(stk.clearance)} · Δ{" "}
          <span style={{ color: delta < 0 ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
            {delta >= 0 ? "+" : ""}{fmt(delta)}mm
          </span>{" "}· min @ {fmt(cur.theta, 0)}°
        </div>
      </div>
    );
  };

  return (
    <ThemeCtx.Provider value={C}>
    <div ref={rootRef} style={{ background: C.bg, color: C.ink, colorScheme: dark ? "dark" : "light",
      minHeight: embedded ? "auto" : "100vh", padding: embedded ? "4px 0 0" : "22px 18px",
      fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {!embedded && <h1 style={{ fontSize: 24, margin: "0 0 2px" }}>Piston-to-Valve Clearance Calculator</h1>}
        {!embedded && (
          <p style={{ color: C.inkSoft, fontSize: 13.5, margin: "0 0 18px", maxWidth: 760 }}>
            How close does a valve come to the piston through the overlap, and how do your
            changes move it relative to stock? Mill the deck, swap the gasket, fit bigger valves,
            deepen the reliefs, dial in cam timing/VTEC — the gap updates live across the full
            720° cycle. Directional model for comparison — always confirm with modelling clay.
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(420px, 1.25fr)", gap: 16, alignItems: "start" }}>
          {/* ---- LEFT: inputs ---- */}
          <div>
            <Section title="Stock baseline" sub="The factory engine — your yardstick.">
              <div style={{ ...grid(1), marginBottom: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: C.inkSoft }}>
                  <span>Engine</span>
                  <select value={engineKey} onChange={(e) => applyEngine(e.target.value)}
                    style={{ background: C.bg, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 7,
                      padding: "7px 9px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                    {Object.keys(ENGINES).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: C.inkSoft }}>
                  <span>Camshaft <span style={{ opacity: 0.7 }}>· cams that fit this engine</span></span>
                  <select value={camKey} onChange={(e) => applyCam(e.target.value)}
                    style={{ background: C.bg, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 7,
                      padding: "7px 9px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                    {Object.keys(camOptions).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
              <div style={grid(2)}>
                <NumField label="Bore" value={stock.bore} onChange={(v) => setS("bore", v)} unit="mm" />
                <NumField label="Stroke" value={stock.stroke} onChange={(v) => setS("stroke", v)} unit="mm" />
                <NumField label="Rod length" value={stock.rod} onChange={(v) => setS("rod", v)} unit="mm" />
                <NumField label="Deck clearance" value={stock.deckClear} onChange={(v) => setS("deckClear", v)} unit="mm" step={0.05} />
                <NumField label="Gasket (stock)" value={stock.gasket} onChange={(v) => setS("gasket", v)} unit="mm" step={0.05} />
                <NumField label="Relief — intake" value={stock.pocketInt} onChange={(v) => setS("pocketInt", v)} unit="mm" step={0.1} />
                <NumField label="Relief — exhaust" value={stock.pocketExh} onChange={(v) => setS("pocketExh", v)} unit="mm" step={0.1} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                {[["intake", "Intake", C.intake, [["io", "IO (°ATDC)"], ["ic", "IC (°ABDC)"]]],
                  ["exhaust", "Exhaust", C.exhaust, [["eo", "EO (°BBDC)"], ["ec", "EC (°BTDC)"]]]].map(([k, lbl, col, evs]) => (
                  <div key={k} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: col, marginBottom: 8 }}>{lbl} valve</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <NumField label="Seat angle" value={stock[k].angle} onChange={(v) => setS(`${k}.angle`, v)} unit="°" w={64} />
                      <NumField label="Head dia" value={stock[k].dia} onChange={(v) => setS(`${k}.dia`, v)} unit="mm" w={64} />
                      <NumField label="Seat recess" value={stock[k].recess} onChange={(v) => setS(`${k}.recess`, v)} unit="mm" step={0.1} w={64} />
                      <NumField label="Lift" value={stock[k].lift} onChange={(v) => setS(`${k}.lift`, v)} unit="mm" step={0.1} w={64} />
                      <NumField label={evs[0][1]} value={stock[k][evs[0][0]]} onChange={(v) => setS(`${k}.${evs[0][0]}`, v)} unit="°" w={64} />
                      <NumField label={evs[1][1]} value={stock[k][evs[1][0]]} onChange={(v) => setS(`${k}.${evs[1][0]}`, v)} unit="°" w={64} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 10, fontFamily: C.mono, lineHeight: 1.7 }}>
                effective: IO {fmt(tim.io, 0)}° ATDC · IC {fmt(tim.ic, 0)}° ABDC · EO {fmt(tim.eo, 0)}° BBDC · EC {fmt(tim.ec, 0)}° BTDC<br />
                dur {fmt(tim.durI, 0)}/{fmt(tim.durE, 0)}° · LSA {fmt(tim.lsa, 1)}° · overlap {fmt(tim.overlap, 0)}°
              </div>
            </Section>

            <Section title="Modifications" sub="Deviations from stock — the whole point.">
              <Slider label="Deck milled (block + head)" value={mods.deckMill} min={0} max={2} step={0.05}
                onChange={(v) => setM("deckMill", v)} unit="mm" readout={`−${fmt(mods.deckMill)} mm`} color="#dc2626" />
              <div style={{ height: 10 }} />
              <Slider label="Head gasket thickness" value={mods.gasket} min={0.3} max={2.5} step={0.05}
                onChange={(v) => setM("gasket", v)} unit=" mm" color="#16a34a" />
              <div style={{ height: 10 }} />
              <div style={grid(2)}>
                <NumField label="Intake valve dia" value={mods.intakeDia} onChange={(v) => setM("intakeDia", v)} unit="mm" />
                <NumField label="Exhaust valve dia" value={mods.exhaustDia} onChange={(v) => setM("exhaustDia", v)} unit="mm" />
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>
                Piston valve-relief depth is set per side under <em>Stock baseline</em> — it drives the clearance directly.
              </div>
            </Section>

            <Section title="Cam timing — VVT" sub="Intake advance and exhaust retard both widen overlap and tighten P2V. Up to 30° of cam authority.">
              <Slider label="Intake cam advance" value={mods.intakeAdvance} min={-20} max={30} step={1}
                onChange={(v) => setM("intakeAdvance", v)} unit="°" color={C.intake}
                readout={`${mods.intakeAdvance >= 0 ? "+" : ""}${mods.intakeAdvance}° adv`} />
              <div style={{ height: 10 }} />
              <Slider label="Exhaust cam retard" value={mods.exhaustRetard} min={-20} max={30} step={1}
                onChange={(v) => setM("exhaustRetard", v)} unit="°" color={C.exhaust}
                readout={`${mods.exhaustRetard >= 0 ? "+" : ""}${mods.exhaustRetard}° ret`} />
            </Section>

            <Section title="VTEC" sub="High-lobe cam profile above the crossover RPM.">
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}>
                <input type="checkbox" checked={vtecOn} onChange={(e) => setVtecOn(e.target.checked)} />
                <span style={{ fontSize: 13 }}>Engine has VTEC</span>
                {vtecOn && (
                  <span style={{ marginLeft: "auto", fontFamily: C.mono, fontSize: 11.5, fontWeight: 700,
                    color: vtecActive ? "#16a34a" : C.inkSoft }}>
                    {vtecActive ? "● VTEC ENGAGED" : "○ low cam"}
                  </span>
                )}
              </label>
              {vtecOn && (
                <>
                  <Slider label="Engine speed" value={rpm} min={800} max={9000} step={100}
                    onChange={(v) => setRpm(v)} unit=" rpm" color={vtecActive ? "#16a34a" : C.accent} readout={`${rpm} rpm`} />
                  <div style={{ height: 10 }} />
                  <Slider label="VTEC crossover" value={vtecRpm} min={3000} max={8500} step={100}
                    onChange={(v) => setVtecRpm(v)} unit=" rpm" color={C.accent} readout={`${vtecRpm} rpm`} />
                  <div style={{ height: 10 }} />
                  <div style={grid(2)}>
                    <NumField label="Hi intake lift" value={stock.vtec.intLift} onChange={(v) => setS("vtec.intLift", v)} unit="mm" step={0.1} />
                    <NumField label="Hi exhaust lift" value={stock.vtec.exhLift} onChange={(v) => setS("vtec.exhLift", v)} unit="mm" step={0.1} />
                    <NumField label="Hi intake dur" value={stock.vtec.intDur} onChange={(v) => setS("vtec.intDur", v)} unit="°" />
                    <NumField label="Hi exhaust dur" value={stock.vtec.exhDur} onChange={(v) => setS("vtec.exhDur", v)} unit="°" />
                  </div>
                </>
              )}
            </Section>
          </div>

          {/* ---- RIGHT: outputs ---- */}
          <div style={{ position: "sticky", top: 14 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <ResultCard title="INTAKE → PISTON" color={C.intake} cur={result.i} stk={result.si}
                caution={THRESH.cautionInt} danger={THRESH.dangerInt} />
              <ResultCard title="EXHAUST → PISTON" color={C.exhaust} cur={result.e} stk={result.se}
                caution={THRESH.cautionExh} danger={THRESH.dangerExh} />
            </div>

            <Section title="Cross-section"
              sub={playing ? "Animating the full 720° cycle — watch the valves fire in time." :
                `Slice at ${fmt(Math.abs(shownTheta), 0)}° ${shownTheta < 0 ? "BTDC" : "ATDC"}${autoCrit ? " — the tightest moment" : ""}.`}>
              <CrossSection cfg={cfg} theta={shownTheta} />
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setPlaying((p) => !p)}
                    style={{ fontSize: 13, fontWeight: 700, padding: "8px 16px", cursor: "pointer", borderRadius: 8,
                      background: playing ? C.exhaust : C.accentDeep, color: "#fff", border: "none" }}>
                    {playing ? "⏸ Pause" : "▶ Animate piston"}
                  </button>
                  {!playing && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={autoCrit} onChange={(e) => setAutoCrit(e.target.checked)} />
                      Snap to the tightest crank angle
                    </label>
                  )}
                </div>
                {!playing && !autoCrit && (
                  <Slider label="Crank angle" value={theta} min={-360} max={360} step={1}
                    onChange={(v) => setTheta(v)} unit="°"
                    readout={`${fmt(Math.abs(theta), 0)}° ${theta < 0 ? "BTDC" : "ATDC"}`} />
                )}
              </div>
            </Section>

            <Section title="Clearance through the overlap" sub="Solid = current, dashed = stock. Orange/red dashes are the caution/interference thresholds.">
              <ClearanceChart intakeCurve={result.intakeCurve} exhaustCurve={result.exhaustCurve}
                stockIntake={result.stockIntakeCurve} stockExhaust={result.stockExhaustCurve} theta={clamp(shownTheta, -90, 90)} />
            </Section>

            <Section title="Valve lift — full 720° cycle" sub="Exhaust closes as intake opens across the overlap; they're a stroke apart, not simultaneous.">
              <LiftChart intake={cfg.intake} exhaust={cfg.exhaust} theta={shownTheta} />
            </Section>
          </div>
        </div>

        <p style={{ color: C.inkSoft, fontSize: 11.5, marginTop: 16, lineHeight: 1.6 }}>
          <strong style={{ color: C.ink }}>Model notes.</strong> Lobes are approximated as raised-cosine
          profiles; the piston follows an exact slider-crank. Clearance is the vertical gap between the
          valve's piston-side edge and the relief floor beneath it (intake and exhaust reliefs set
          separately). Valve diameter enters through the rim drop (Δr·sin θ<sub>seat</sub>); lateral
          piston-edge interference and valve-to-valve proximity are not modelled. Treat absolute numbers
          as directional and the <em>deviation from stock</em> as the trustworthy signal — then clay it.
        </p>
      </div>
    </div>
    </ThemeCtx.Provider>
  );
}

export default App;
