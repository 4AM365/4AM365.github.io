// Piston-to-Valve (P2V) clearance calculator — blog widget module.
//
// GENERATED from index.html by tools/sync-widget.mjs. Do not edit by hand —
// edit index.html (the canonical standalone app) and re-run the sync.

import React, { useState, useMemo } from "react";

// =============================================================================
// Piston-to-Valve (P2V) clearance — physics
// -----------------------------------------------------------------------------
// Everything in mm and crank degrees. The overlap-TDC (exhaust→intake top dead
// centre) is our zero: negative angles are BTDC on the exhaust stroke, positive
// are ATDC on the intake stroke. P2V is the minimum gap between a valve head and
// the piston crown swept through the overlap window — it is NOT valvetrain lash.
//
// This is a first-order, directional model for *comparing against stock*, not a
// substitute for claying the engine. The headline number is the deviation from
// the stock baseline, which is robust even where the absolute calibration is soft.
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
// centerline. `centerline` is the crank angle (our TDC=0 frame) of peak lift;
// `duration` is the full open duration in crank degrees.
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

// P2V clearance at one crank angle for one valve.
function clearanceAt(theta, block, cam) {
  const gapPistonToDeck = block.deckClear + block.gasket + pistonDescent(theta, block.stroke, block.rod);
  const lift = valveLift(theta, cam.centerline, cam.duration, cam.maxLift);
  return gapPistonToDeck + block.pocket - valveDrop(lift, cam);
}

// Scan the overlap window for the tightest clearance.
function scanMin(block, cam, lo = -110, hi = 110, step = 0.5) {
  let best = Infinity, bestT = 0;
  for (let t = lo; t <= hi; t += step) {
    const c = clearanceAt(t, block, cam);
    if (c < best) { best = c; bestT = t; }
  }
  return { clearance: best, theta: bestT };
}

// ---- Self-test (fails loudly in console if the physics regress) -------------
(function selfTest() {
  console.assert(Math.abs(pistonDescent(0, 80, 130)) < 1e-9, "piston at TDC must be 0");
  console.assert(pistonDescent(90, 80, 130) > 0, "piston descends after TDC");
  const cam = { centerline: 100, duration: 240, maxLift: 10, recess: 1, dia: 30, diaStock: 30, angle: 20 };
  console.assert(Math.abs(valveLift(100, 100, 240, 10) - 10) < 1e-9, "peak lift at centerline");
  console.assert(valveLift(-30, 100, 240, 10) === 0, "no lift outside duration");
  const b = { stroke: 80, rod: 130, deckClear: 0.5, gasket: 0.7, pocket: 2 };
  const tight = scanMin(b, cam).clearance;
  const looser = scanMin({ ...b, deckClear: 1.5 }, cam).clearance;
  console.assert(looser > tight, "raising the deck (more deck clearance) must increase P2V");
})();

// =============================================================================
// Configuration assembly — stock baseline vs the modified ("current") engine
// =============================================================================

// Build the {block, intake, exhaust} geometry for a given spec + mods + cam state.
function buildConfig(stock, mods, vtecActive) {
  const block = {
    stroke: stock.stroke,
    rod: stock.rod,
    deckClear: stock.deckClear - mods.deckMill, // milling the deck drops the head
    gasket: mods.gasket,                          // a thicker gasket lifts it back
    pocket: mods.pocket,                          // valve-relief depth in the piston
  };
  const intake = {
    angle: stock.intake.angle,
    dia: mods.intakeDia, diaStock: stock.intake.dia,
    recess: stock.intake.recess,
    maxLift: vtecActive ? stock.vtec.intLift : stock.intake.lift,
    duration: vtecActive ? stock.vtec.intDur : stock.intake.duration,
    centerline: stock.intake.cl - mods.intakeAdvance, // advance = earlier = more overlap
  };
  const exhaust = {
    angle: stock.exhaust.angle,
    dia: mods.exhaustDia, diaStock: stock.exhaust.dia,
    recess: stock.exhaust.recess,
    maxLift: vtecActive ? stock.vtec.exhLift : stock.exhaust.lift,
    duration: vtecActive ? stock.vtec.exhDur : stock.exhaust.duration,
    centerline: -stock.exhaust.cl + mods.exhaustRetard, // retard = later = more overlap
  };
  return { block, intake, exhaust };
}

// The untouched factory engine — the yardstick everything is measured against.
function stockConfig(stock) {
  const mods = {
    deckMill: 0, gasket: stock.gasket, pocket: stock.pocket,
    intakeDia: stock.intake.dia, exhaustDia: stock.exhaust.dia,
    intakeAdvance: 0, exhaustRetard: 0,
  };
  return buildConfig(stock, mods, false);
}

// =============================================================================
// Defaults — a Honda B16-flavoured VTEC four (so VTEC actually does something)
// =============================================================================
const DEFAULT_STOCK = {
  stroke: 77.4, rod: 134.0,
  deckClear: 0.50, gasket: 0.70, pocket: 2.00,
  intake:  { angle: 22, dia: 33, recess: 1.2, lift: 10.3, duration: 230, cl: 110 },
  exhaust: { angle: 22, dia: 28, recess: 1.4, lift: 9.4,  duration: 230, cl: 110 },
  vtec: { intLift: 11.5, intDur: 252, exhLift: 10.5, exhDur: 248 },
};
const DEFAULT_MODS = {
  deckMill: 0, gasket: 0.70, pocket: 2.00,
  intakeDia: 33, exhaustDia: 28,
  intakeAdvance: 0, exhaustRetard: 0,
};

const PRESETS = {
  "Honda B16 (VTEC I4)": DEFAULT_STOCK,
  "Toyota 2JZ-GTE (I6 turbo)": {
    stroke: 86.0, rod: 142.0, deckClear: 0.40, gasket: 1.30, pocket: 2.20,
    intake:  { angle: 21.5, dia: 33.5, recess: 1.3, lift: 8.7, duration: 224, cl: 114 },
    exhaust: { angle: 21.5, dia: 29.0, recess: 1.5, lift: 8.3, duration: 236, cl: 114 },
    vtec: { intLift: 8.7, intDur: 224, exhLift: 8.3, exhDur: 236 }, // no VTEC, hi=stock
  },
  "Chevy LS (pushrod V8)": {
    stroke: 92.0, rod: 154.0, deckClear: 0.25, gasket: 1.00, pocket: 1.50,
    intake:  { angle: 15, dia: 54, recess: 1.0, lift: 13.5, duration: 196, cl: 110 },
    exhaust: { angle: 15, dia: 41.5, recess: 1.2, lift: 13.0, duration: 207, cl: 116 },
    vtec: { intLift: 13.5, intDur: 196, exhLift: 13.0, exhDur: 207 },
  },
};

// Safe-minimum guidance (mm). Exhaust runs hotter and stretches, so it wants more.
const THRESH = { cautionInt: 1.3, dangerInt: 0.9, cautionExh: 1.5, dangerExh: 1.0 };
function statusFor(clear, caution, danger) {
  if (clear < danger) return { key: "danger", label: "INTERFERENCE RISK", color: "#dc2626" };
  if (clear < caution) return { key: "caution", label: "tight — verify", color: "#d97706" };
  return { key: "ok", label: "clear", color: "#16a34a" };
}

// =============================================================================
// Theme
// =============================================================================
const C = {
  bg: "#14101e", panel: "#1e1830", panel2: "#272040", ink: "#f5f3fc",
  inkSoft: "#9b95b5", line: "#3a3358", accent: "#a78bfa", accentDeep: "#7c3aed",
  intake: "#60a5fa", exhaust: "#f87171", piston: "#cbb58b", mono: "'IBM Plex Mono', ui-monospace, monospace",
};

// =============================================================================
// Small UI pieces
// =============================================================================
function NumField({ label, value, onChange, step = 0.1, min, max, unit, w = 88 }) {
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

function Slider({ label, value, min, max, step, onChange, unit, color = C.accent, readout }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span style={{ color: C.ink }}>{label}</span>
        <span style={{ fontFamily: C.mono, color, fontWeight: 600 }}>
          {readout != null ? readout : `${value}${unit || ""}`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color }} />
    </div>
  );
}

function Section({ title, sub, children }) {
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
      {/* danger / caution bands for reference */}
      <line x1={padL} y1={Y(THRESH.cautionExh)} x2={W - padR} y2={Y(THRESH.cautionExh)} stroke="#d97706" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
      <line x1={padL} y1={Y(THRESH.dangerExh)} x2={W - padR} y2={Y(THRESH.dangerExh)} stroke="#dc2626" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
      {/* TDC marker + current angle */}
      <line x1={X(0)} y1={padT} x2={X(0)} y2={H - padB} stroke={C.inkSoft} strokeWidth="0.8" opacity="0.5" />
      <text x={X(0)} y={H - padB + 14} textAnchor="middle" fontSize="9.5" fill={C.inkSoft} fontFamily={C.mono}>TDC</text>
      <line x1={X(theta)} y1={padT} x2={X(theta)} y2={H - padB} stroke={C.accent} strokeWidth="1.2" opacity="0.9" />
      {/* stock (faded) vs current */}
      <path d={path(stockIntake)} fill="none" stroke={C.intake} strokeWidth="1" opacity="0.35" strokeDasharray="4 3" />
      <path d={path(stockExhaust)} fill="none" stroke={C.exhaust} strokeWidth="1" opacity="0.35" strokeDasharray="4 3" />
      <path d={path(intakeCurve)} fill="none" stroke={C.intake} strokeWidth="2.2" />
      <path d={path(exhaustCurve)} fill="none" stroke={C.exhaust} strokeWidth="2.2" />
      <text x={W - padR} y={H - 4} textAnchor="end" fontSize="10" fill={C.inkSoft} fontFamily={C.mono}>crank° (TDC overlap = 0)</text>
    </svg>
  );
}

function LiftChart({ intake, exhaust }) {
  const W = 520, H = 150, padL = 30, padR = 12, padT = 10, padB = 24;
  const data = [];
  for (let t = -140; t <= 140; t += 2) {
    data.push({ t, i: valveLift(t, intake.centerline, intake.duration, intake.maxLift),
      e: valveLift(t, exhaust.centerline, exhaust.duration, exhaust.maxLift) });
  }
  const yMax = Math.max(intake.maxLift, exhaust.maxLift) * 1.1;
  const X = (t) => padL + ((t + 140) / 280) * (W - padL - padR);
  const Y = (v) => padT + (1 - v / yMax) * (H - padT - padB);
  const path = (key) => data.map((p, idx) => `${idx ? "L" : "M"}${X(p.t).toFixed(1)} ${Y(p[key]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <line x1={padL} y1={Y(0)} x2={W - padR} y2={Y(0)} stroke={C.line} />
      <line x1={X(0)} y1={padT} x2={X(0)} y2={H - padB} stroke={C.inkSoft} strokeWidth="0.8" opacity="0.5" />
      <text x={X(0)} y={H - padB + 13} textAnchor="middle" fontSize="9.5" fill={C.inkSoft} fontFamily={C.mono}>TDC</text>
      <path d={path("e")} fill="none" stroke={C.exhaust} strokeWidth="2" />
      <path d={path("i")} fill="none" stroke={C.intake} strokeWidth="2" />
      <text x={padL} y={padT + 8} fontSize="10" fill={C.inkSoft} fontFamily={C.mono}>lift (mm)</text>
    </svg>
  );
}

// =============================================================================
// Cross-section — a schematic engine slice at the selected crank angle
// =============================================================================
function CrossSection({ cfg, theta }) {
  const pp = 7.5;             // px per mm (vertical scale)
  const W = 360, H = 340;
  const yDeck = 78;          // fire-deck line
  const bore = { l: 58, r: 302, center: 180 };
  const seatI = 132, seatE = 228;

  const gapPH = cfg.block.deckClear + cfg.block.gasket + pistonDescent(theta, cfg.block.stroke, cfg.block.rod);
  const pistonY = yDeck + gapPH * pp;

  const valve = (seatX, cam, tiltSign) => {
    const lift = valveLift(theta, cam.centerline, cam.duration, cam.maxLift);
    const drop = valveDrop(lift, cam);                 // vertical mm below deck
    const tilt = tiltSign * cam.angle;                 // visual lean
    const faceR = clamp((cam.dia / 2) * pp * 0.42, 10, 40);
    const axialPx = drop * pp / Math.cos(rad(cam.angle));
    return { lift, drop, tilt, faceR, axialPx, seatX,
      faceCenterY: yDeck + drop * pp,
      open: lift > 0.05 };
  };
  const vi = valve(seatI, cfg.intake, -1);
  const ve = valve(seatE, cfg.exhaust, +1);

  const clearI = clearanceAt(theta, cfg.block, cfg.intake);
  const clearE = clearanceAt(theta, cfg.block, cfg.exhaust);

  // piston crown path with two relief notches under the valves
  const notchW = 30, notchD = cfg.block.pocket * pp;
  const crown = (x) => {
    const half = notchW / 2;
    return `M${bore.l} ${pistonY}
      L${x - half} ${pistonY} Q${x - half + 5} ${pistonY} ${x - half + 5} ${pistonY + notchD}
      L${x + half - 5} ${pistonY + notchD} Q${x + half} ${pistonY} ${x + half} ${pistonY}
      L${bore.r} ${pistonY} L${bore.r} ${H} L${bore.l} ${H} Z`;
  };

  const dim = (x, y1, y2, val, color) => (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth="1.2" markerEnd="url(#ar)" markerStart="url(#ar)" />
      <rect x={x + 4} y={(y1 + y2) / 2 - 8} width="52" height="16" rx="3" fill={C.panel} stroke={color} strokeWidth="0.7" />
      <text x={x + 30} y={(y1 + y2) / 2 + 3.5} textAnchor="middle" fontSize="10" fill={color} fontFamily={C.mono}>{fmt(val)}mm</text>
    </g>
  );

  const Valve = ({ v, color, label }) => (
    <g transform={`translate(${v.seatX} ${yDeck}) rotate(${v.tilt})`}>
      <line x1="0" y1="-46" x2="0" y2={v.axialPx} stroke={color} strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
      <rect x="-3.2" y="-46" width="6.4" height="8" rx="2" fill={color} />
      <path d={`M${-v.faceR} ${v.axialPx} L${v.faceR} ${v.axialPx} L${v.faceR * 0.62} ${v.axialPx + 7} L${-v.faceR * 0.62} ${v.axialPx + 7} Z`}
        fill={color} opacity="0.9" />
      <text x="0" y="-52" textAnchor="middle" fontSize="10" fill={color} fontFamily={C.mono} fontWeight="600">{label}</text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: C.bg, borderRadius: 12 }}>
      <defs>
        <marker id="ar" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">
          <path d="M1 1 L6 3.5 L1 6" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </marker>
      </defs>

      {/* cylinder head */}
      <rect x={bore.l - 12} y={20} width={bore.r - bore.l + 24} height={yDeck - 20} fill={C.panel2} stroke={C.line} />
      <text x={bore.center} y={36} textAnchor="middle" fontSize="10.5" fill={C.inkSoft} fontFamily={C.mono}>cylinder head</text>
      {/* gasket band */}
      <rect x={bore.l} y={yDeck} width={bore.r - bore.l} height={Math.max(2, cfg.block.gasket * pp)} fill={C.accentDeep} opacity="0.55" />
      {/* fire-deck line */}
      <line x1={bore.l} y1={yDeck} x2={bore.r} y2={yDeck} stroke={C.accent} strokeWidth="1.5" />
      {/* bore walls */}
      <line x1={bore.l} y1={yDeck} x2={bore.l} y2={H} stroke={C.line} strokeWidth="2" />
      <line x1={bore.r} y1={yDeck} x2={bore.r} y2={H} stroke={C.line} strokeWidth="2" />

      {/* piston */}
      <path d={crown(seatI < seatE ? seatI : seatE)} fill="none" />
      <path d={`M${bore.l} ${pistonY} L${bore.r} ${pistonY} L${bore.r} ${H} L${bore.l} ${H} Z`} fill={C.piston} opacity="0.18" />
      {/* notches */}
      {[ [seatI, cfg.intake], [seatE, cfg.exhaust] ].map(([x], i) => (
        <rect key={i} x={x - notchW / 2} y={pistonY} width={notchW} height={notchD} rx="4" fill={C.piston} opacity="0.28" />
      ))}
      <line x1={bore.l} y1={pistonY} x2={bore.r} y2={pistonY} stroke={C.piston} strokeWidth="2.5" />
      <text x={bore.center} y={H - 12} textAnchor="middle" fontSize="10.5" fill={C.piston} fontFamily={C.mono}>piston crown</text>

      <Valve v={vi} color={C.intake} label="IN" />
      <Valve v={ve} color={C.exhaust} label="EX" />

      {/* clearance dimensions */}
      <g style={{ color: C.intake }}>{dim(seatI - 6, vi.faceCenterY, pistonY + notchD, clearI, C.intake)}</g>
      <g style={{ color: C.exhaust }}>{dim(seatE - 6, ve.faceCenterY, pistonY + notchD, clearE, C.exhaust)}</g>
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

  const vtecActive = vtecOn && rpm >= vtecRpm;
  const cfg = useMemo(() => buildConfig(stock, mods, vtecActive), [stock, mods, vtecActive]);
  const stockCfg = useMemo(() => stockConfig(stock), [stock]);

  const result = useMemo(() => {
    const i = scanMin(cfg.block, cfg.intake);
    const e = scanMin(cfg.block, cfg.exhaust);
    const si = scanMin(stockCfg.block, stockCfg.intake);
    const se = scanMin(stockCfg.block, stockCfg.exhaust);
    const curve = (block, cam) => {
      const a = []; for (let t = -70; t <= 70; t += 1) a.push({ theta: t, clear: clearanceAt(t, block, cam) }); return a;
    };
    return {
      i, e, si, se,
      intakeCurve: curve(cfg.block, cfg.intake),
      exhaustCurve: curve(cfg.block, cfg.exhaust),
      stockIntakeCurve: curve(stockCfg.block, stockCfg.intake),
      stockExhaustCurve: curve(stockCfg.block, stockCfg.exhaust),
    };
  }, [cfg, stockCfg]);

  // crank angle shown in the cross-section: the governing (tightest) valve's angle
  const critTheta = result.i.clearance <= result.e.clearance ? result.i.theta : result.e.theta;
  const shownTheta = autoCrit ? critTheta : theta;

  const overlap = useMemo(() => {
    const intakeOpen = cfg.intake.centerline - cfg.intake.duration / 2;
    const exhaustClose = cfg.exhaust.centerline + cfg.exhaust.duration / 2;
    return exhaustClose - intakeOpen;
  }, [cfg]);
  const lsa = (stock.intake.cl + stock.exhaust.cl) / 2;

  const setS = (path, v) => setStock((s) => {
    const n = structuredClone(s);
    const ks = path.split("."); let o = n;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = v; return n;
  });
  const setM = (k, v) => setMods((m) => ({ ...m, [k]: v }));

  const applyPreset = (name) => {
    const p = PRESETS[name];
    setStock(p);
    setMods({ deckMill: 0, gasket: p.gasket, pocket: p.pocket,
      intakeDia: p.intake.dia, exhaustDia: p.exhaust.dia, intakeAdvance: 0, exhaustRetard: 0 });
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
    <div style={{ background: C.bg, color: C.ink, minHeight: "100vh", padding: "22px 18px",
      fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, margin: "0 0 2px" }}>Piston-to-Valve Clearance Calculator</h1>
        <p style={{ color: C.inkSoft, fontSize: 13.5, margin: "0 0 18px", maxWidth: 760 }}>
          How close does a valve come to the piston through the overlap, and how do your
          changes move it relative to stock? Mill the deck, swap the gasket, fit bigger valves,
          dial in cam advance/VTEC — the gap updates live. Directional model for comparison —
          always confirm the real number with modelling clay.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(420px, 1.25fr)", gap: 16, alignItems: "start" }}>
          {/* ---- LEFT: inputs ---- */}
          <div>
            <Section title="Stock baseline" sub="The factory engine — your yardstick.">
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: C.inkSoft }}>Preset: </span>
                {Object.keys(PRESETS).map((n) => (
                  <button key={n} onClick={() => applyPreset(n)}
                    style={{ fontSize: 11, margin: "0 6px 6px 0", padding: "5px 9px", cursor: "pointer",
                      background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 7 }}>{n}</button>
                ))}
              </div>
              <div style={grid(2)}>
                <NumField label="Stroke" value={stock.stroke} onChange={(v) => setS("stroke", v)} unit="mm" />
                <NumField label="Rod length" value={stock.rod} onChange={(v) => setS("rod", v)} unit="mm" />
                <NumField label="Deck clearance" value={stock.deckClear} onChange={(v) => setS("deckClear", v)} unit="mm" step={0.05} />
                <NumField label="Gasket (stock)" value={stock.gasket} onChange={(v) => setS("gasket", v)} unit="mm" step={0.05} />
                <NumField label="Relief depth" value={stock.pocket} onChange={(v) => setS("pocket", v)} unit="mm" step={0.1} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                {[["intake", "Intake", C.intake], ["exhaust", "Exhaust", C.exhaust]].map(([k, lbl, col]) => (
                  <div key={k} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: col, marginBottom: 8 }}>{lbl} valve</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <NumField label="Seat angle" value={stock[k].angle} onChange={(v) => setS(`${k}.angle`, v)} unit="°" w={64} />
                      <NumField label="Head dia" value={stock[k].dia} onChange={(v) => setS(`${k}.dia`, v)} unit="mm" w={64} />
                      <NumField label="Seat recess" value={stock[k].recess} onChange={(v) => setS(`${k}.recess`, v)} unit="mm" step={0.1} w={64} />
                      <NumField label="Lift" value={stock[k].lift} onChange={(v) => setS(`${k}.lift`, v)} unit="mm" step={0.1} w={64} />
                      <NumField label="Duration" value={stock[k].duration} onChange={(v) => setS(`${k}.duration`, v)} unit="°" w={64} />
                      <NumField label={k === "intake" ? "ICL (ATDC)" : "ECL (BTDC)"} value={stock[k].cl} onChange={(v) => setS(`${k}.cl`, v)} unit="°" w={64} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 10, fontFamily: C.mono }}>
                LSA {fmt(lsa, 1)}° · overlap ≈ {fmt(overlap, 0)}°
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
                <NumField label="Piston relief depth" value={mods.pocket} onChange={(v) => setM("pocket", v)} unit="mm" />
              </div>
            </Section>

            <Section title="Cam timing — VVT" sub="Intake advance and exhaust retard both widen overlap and tighten P2V.">
              <Slider label="Intake cam advance" value={mods.intakeAdvance} min={-20} max={20} step={1}
                onChange={(v) => setM("intakeAdvance", v)} unit="°" color={C.intake}
                readout={`${mods.intakeAdvance >= 0 ? "+" : ""}${mods.intakeAdvance}° adv`} />
              <div style={{ height: 10 }} />
              <Slider label="Exhaust cam retard" value={mods.exhaustRetard} min={-20} max={20} step={1}
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

            <Section title="Cross-section" sub={`Schematic slice at ${fmt(shownTheta, 0)}° ${shownTheta < 0 ? "BTDC" : "ATDC"}${autoCrit ? " — the tightest moment" : ""}.`}>
              <CrossSection cfg={cfg} theta={shownTheta} />
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={autoCrit} onChange={(e) => setAutoCrit(e.target.checked)} />
                  Snap to the tightest crank angle
                </label>
                {!autoCrit && (
                  <Slider label="Crank angle" value={theta} min={-70} max={70} step={1}
                    onChange={(v) => setTheta(v)} unit="°" readout={`${theta >= 0 ? "+" : ""}${theta}° ${theta < 0 ? "BTDC" : "ATDC"}`} />
                )}
              </div>
            </Section>

            <Section title="Clearance through the overlap" sub="Solid = current, dashed = stock. Dashed orange/red lines mark the caution/interference thresholds.">
              <ClearanceChart intakeCurve={result.intakeCurve} exhaustCurve={result.exhaustCurve}
                stockIntake={result.stockIntakeCurve} stockExhaust={result.stockExhaustCurve} theta={shownTheta} />
            </Section>

            <Section title="Valve lift" sub="The active cam profile (high lobe when VTEC is engaged).">
              <LiftChart intake={cfg.intake} exhaust={cfg.exhaust} />
            </Section>
          </div>
        </div>

        <p style={{ color: C.inkSoft, fontSize: 11.5, marginTop: 16, lineHeight: 1.6 }}>
          <strong style={{ color: C.ink }}>Model notes.</strong> Lobes are approximated as raised-cosine
          profiles; the piston follows an exact slider-crank. Clearance is the vertical gap between the
          valve's piston-side edge and the relief floor beneath it. Valve diameter enters through the
          rim drop (Δr·sin θ<sub>seat</sub>); the lateral piston-edge interference and any valve-to-valve
          proximity are not modelled. Treat absolute numbers as directional and the <em>deviation from
          stock</em> as the trustworthy signal — then clay it.
        </p>
      </div>
    </div>
  );
}

export default App;
