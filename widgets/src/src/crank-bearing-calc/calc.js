// calc.js — glue between the UI (display units) and the two model modules (SI). The UI imports only this file.
import { cylinderPressure, findMBT, FUELS } from "./combustion.js";
import { bearingAnalysis, OILS, THETA } from "./bearing.js";
import { wristPin, rodColumn, peakFilmPressure } from "./rodpin.js";
import { CAMS, liftCurve, camEvents, camVE, residualEstimate } from "./cams.js";

const LBFT = 1.3558179483314, BAR = 1e5;
// Fixed, not exposed: exhaust/intake pressure ratio (as bearing_limits.py), friction (project.py).
// IVC/EVO come from the selected cam's 1 mm events (v0.3); stock gives IVC -148, as the prior fixed value.
const FRIC_LOAD = 0.02;   // exhaust/intake pressure ratio is the backRatio input (2026-11-21; was fixed 1.2)
const fmep = (n) => (0.6 + 0.1 * n / 1000 + 0.02 * (n / 1000) ** 2) * BAR;
const CLR = { rod: { min: 0.032, mid: 0.041, max: 0.050 }, main: { min: 0.042, mid: 0.051, max: 0.060 } };   // FSM EG-172, diametral mm

export const OPTIONS = { fuels: Object.keys(FUELS), oils: Object.keys(OILS), clearance: ["min", "mid", "max", "custom"], cams: Object.keys(CAMS) };
export const DEFAULTS = {
  rpm: 3500, mapKPa: 200, useTarget: false, targetTorqueLbft: 600, spark: 20, sparkMbt: false, fuel: "E85", lambda: 0.8,
  dilution: 5, mixing: 0.9, tumble: 1.0, tCharge: 45, ve: 0.9,
  // Rod: Manley 14005-1 H-beam (Build Notes/manley-14005-rods.md): C-C 153.95 [Manley], 800 g [Manley] split 0.26 small end /
  // 0.54 big end (est.); mRec = piston group 0.64 (est.) + 0.26.
  bore: 100, stroke: 95, rod: 153.95, cr: 9.0, pinOffset: 0, desaxe: 0, mRec: 0.90, mRot: 0.54,
  rodClr: "mid", rodClrCustom: 0.041, mainClr: "mid", mainClrCustom: 0.051,
  rodWidth: 21.4, mainWidth: 23.4, grooveWidth: 0, ratingMPa: 70, minFilmUm: 1.0, edgeInLimit: false,
  crankE: 207, webFactor: 0.45, mainPitch: 114, capKV: 1.5, capKH: 1.0,
  oil: "15W-50", sumpC: 110, oilPsi: 60, feedMain: 6, feedRod: 5,
  // v0.2 — wrist pin and rod column (all estimates except pinOD, FSM); mPistonGroup = piston + rings + pin, small end = mRec - mPistonGroup
  mPistonGroup: 0.64, pinOD: 26.0, pinID: 15.0, pinLength: 66, smallEndWidth: 22, bossLength: 18, pinYield: 1100, pinFatigue: 500,
  // Manley H-beam section, photo estimates: plates at +-z, depth (z) 21, plate width (x) 32, plates 3.5, web 6 (x). 4340 Q&T typ.
  rodOrient: "H", beamHeight: 21, flangeWidth: 32, flangeThk: 3.5, webThk: 6.0, rodE: 205, rodYield: 950,
  // ARP 2000 3/8 cap screws (Manley 42351-1): preload from 0.006 in stretch ~50 kN (range 44-56), shank dia ~7.9 mm (est.)
  boltPreloadKN: 50, boltShankD: 7.9,
  // v0.3 — camshaft: grind, cam-gear advance (deg, + earlier), VE from cam or manual box, dilution manual or overlap residual
  cam: "Stock", inAdv: 0, exAdv: 0, veMode: "cam", dilMode: "manual", backRatio: 1.2,
};

const mm = (v) => v / 1000;
function geomOf(u) {
  return { bore: mm(u.bore), stroke: mm(u.stroke), rod: mm(u.rod), cr: u.cr, offset: mm(u.pinOffset + u.desaxe) };
}
function camState(u) {
  const cam = CAMS[u.cam] || CAMS.Stock, ev = camEvents(cam, u.inAdv, u.exAdv);
  const ve = u.veMode === "manual" ? u.ve : camVE(cam, u.inAdv, u.exAdv, u.rpm);
  const residual = residualEstimate(ev, u.backRatio, u.rpm);
  return { cam, ev, ve, residual, dilution: u.dilMode === "cam" ? residual : u.dilution / 100 };
}
function opOf(u, mapKPa, spark) {
  const cs = camState(u);
  return { fuel: u.fuel, lambda: u.lambda, dilution: cs.dilution, mixing: u.mixing, tumble: u.tumble, spark, rpm: u.rpm,
    map: mapKPa * 1000, tCharge: u.tCharge + 273.15, ve: cs.ve, backRatio: u.backRatio, ivc: cs.ev.ivc, evo: cs.ev.evo };
}
// Camshaft tab payload: lift curves, piston position, events, effective CR from the cylinder volume at IVC (1 mm).
function camResult(u) {
  const cs = camState(u), g = geomOf(u), r = g.stroke / 2, l = g.rod, e = g.offset;
  const xAt = (deg) => { const t = deg * Math.PI / 180, s = (r * Math.sin(t) - e) / l; return r * Math.cos(t) + l * Math.sqrt(1 - s * s); };
  const xTdc = Math.max(...Array.from(THETA, xAt));
  const piston = Float64Array.from(THETA, (th) => (xTdc - xAt(th)) * 1e3);
  const A = Math.PI / 4 * g.bore ** 2, vc = A * g.stroke / (g.cr - 1), vIvc = vc + A * (xTdc - xAt(cs.ev.ivc));
  const mmArr = (a) => Float64Array.from(a, (v) => v * 1e3);
  const table = Object.entries(CAMS).map(([k, c]) => {
    const ev = camEvents(c, 0, 0);
    return { grind: c.label, key: k, use: c.use, adv: { in: c.in.adv, ex: c.ex.adv }, dur1: { in: c.in.dur1, ex: c.ex.dur1 },
      lift: { in: c.in.lift, ex: c.ex.lift }, cl: { in: c.in.cl, ex: c.ex.cl },
      ivo: -360 - ev.ivo, ivc: ev.ivc + 180, evo: 180 - ev.evo, evc: ev.evc - 360, springs: c.springs, verified: c.verified, source: c.source };
  });
  return { name: cs.cam.label, events: cs.ev, liftIn: mmArr(liftCurve(cs.cam.in, u.inAdv)), liftEx: mmArr(liftCurve(cs.cam.ex, u.exAdv)),
    piston, ve: cs.ve, residual: cs.residual, effCR: vIvc / vc, table };
}
function bearingInp(u) {
  const clr = (kind) => (u[kind + "Clr"] === "custom" ? u[kind + "ClrCustom"] : CLR[kind][u[kind + "Clr"]]);
  return {
    geom: geomOf(u), mass: { rec: u.mRec, rot: u.mRot, pg: Math.min(u.mPistonGroup, u.mRec) }, rpm: u.rpm,
    bearings: {
      rod: { d: mm(57), l: mm(u.rodWidth), c: mm(clr("rod")) / 2, feedD: mm(u.feedRod), groove: 0 },
      main: { d: mm(69), l: mm(u.mainWidth), c: mm(clr("main")) / 2, feedD: mm(u.feedMain), groove: mm(u.grooveWidth) },
    },
    rating: u.ratingMPa * 1e6, hMinAccept: u.minFilmUm * 1e-6, edgeInLimit: !!u.edgeInLimit,
    crank: { E: u.crankE * 1e9, factor: u.webFactor, dJournal: mm(69), pitch: mm(u.mainPitch), kV: u.capKV * 1e9, kH: u.capKH * 1e9 },
    oil: { grade: u.oil, tSupplyK: u.sumpC + 273.15, pSupplyPa: u.oilPsi * 6894.76 },
  };
}
// Brake torque from gross IMEP, same friction as project.py: (imep (1 - 0.02) - fmep) Vd / 4 pi.
const vdOf = (g) => 6 * Math.PI / 4 * g.bore ** 2 * g.stroke;
const brakeNm = (imep, n, vd) => (imep * (1 - FRIC_LOAD) - fmep(n)) * vd / (4 * Math.PI);

// Combustion at a MAP: spark from the slider or MBT. Returns the trace, spark used and MBT.
function burn(u, g, mapKPa) {
  const mbt = findMBT(opOf(u, mapKPa, 20), g);
  const spark = u.sparkMbt ? mbt : u.spark;
  return { c: cylinderPressure(opOf(u, mapKPa, spark), g), spark, mbt };
}
// MAP for a brake torque target (bisection; torque rises monotonically with MAP at fixed lambda/spark rule).
function mapForTorque(u, g, tqNm) {
  const vd = vdOf(g);
  let lo = 30, hi = 700;
  for (let k = 0; k < 30 && hi - lo > 0.2; k++) {
    const mid = 0.5 * (lo + hi);
    if (brakeNm(burn(u, g, mid).c.imepGross, u.rpm, vd) < tqNm) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// Wrist pin, rod column and film peak pressures (v0.2). Reported only; none of it enters limits.margins / the torque ceiling.
// Pin load = (gas + piston-group inertia)/cos phi. Rod column load = bearing.js fRod = (gas + mRec a)/cos phi, i.e. the pin load
// plus the small-end share (mRec - mPistonGroup) of inertia; big-end (rotating) mass is excluded, as it is carried by the crank pin.
const PIN_E = 205e9;     // steel pin modulus, not exposed
function extras(u, raw, b) {
  const warnings = [], kN = (a) => Float64Array.from(a, (v) => v / 1e3);
  if (u.mPistonGroup > u.mRec) warnings.push("mPistonGroup exceeds mRec; piston-group mass capped at mRec for the pin load");
  // rod bearing film pressure (single land)
  const rb = bearingInp(u).bearings, d = rb.rod.d, l = rb.rod.l;
  const W = Float64Array.from(raw.rodLoad.x, (x, i) => Math.hypot(x, raw.rodLoad.y[i]));
  const pFilm = peakFilmPressure(W, raw.rodFilm.eps, { d, l });
  const unit = Float64Array.from(W, (w) => w / (d * l) / 1e6);
  let ip = 0, up = 0; for (let i = 1; i < pFilm.length; i++) if (pFilm[i] > pFilm[ip]) ip = i;
  for (const v of unit) if (v > up) up = v;
  const rodBrg = { unit, pFilm, pFilmPeak: pFilm[ip], pFilmPeakTheta: THETA[ip], orbit: { x: raw.rodFilm.epsX, y: raw.rodFilm.epsY }, ratioPeak: pFilm[ip] / up };
  b.mains.forEach((m, i) => {
    const q = raw.mains[i], Wm = Float64Array.from(q.load.x, (x, j) => Math.hypot(x, q.load.y[j]) / q.n);
    m.pFilmPeak = Math.max(...peakFilmPressure(Wm, q.eps, { d: rb.main.d, l: q.le }));
  });
  // wrist pin
  const wp = wristPin(raw.fPin, { od: mm(u.pinOD), id: mm(u.pinID), length: mm(u.pinLength), smallEndWidth: mm(u.smallEndWidth), bossLength: mm(u.bossLength) },
    { E: PIN_E, yield: u.pinYield * 1e6, fatigue: u.pinFatigue * 1e6 });
  const pin = { load: kN(raw.fPin), peakComp: wp.peakComp / 1e3, peakTens: wp.peakTens / 1e3, peakCompTheta: THETA[wp.peakCompIdx],
    sigmaBend: wp.sigmaBend / 1e6, sigmaOval: wp.sigmaOval / 1e6, tauShear: wp.tauShear / 1e6, sigmaEq: wp.sigmaEq / 1e6, sigmaBendBeam: wp.sigmaBendBeam / 1e6,
    bendAmp: wp.bendAmp / 1e6, bendMean: wp.bendMean / 1e6, pBoss: wp.pBoss / 1e6, pSmallEnd: wp.pSmallEnd / 1e6, ovalUm: wp.ovalD * 1e6,
    sfStatic: wp.sfStatic, sfFatigue: wp.sfFatigue };
  if (pin.sfStatic < 1) warnings.push(`Wrist pin: static safety factor ${pin.sfStatic.toFixed(2)} < 1 (not in the torque ceiling)`);
  if (pin.sfFatigue < 1) warnings.push(`Wrist pin: fatigue safety factor ${pin.sfFatigue.toFixed(2)} < 1 (not in the torque ceiling)`);
  // rod column
  const rc = rodColumn(raw.fRod, { orient: u.rodOrient, length: mm(u.rod), beamHeight: mm(u.beamHeight), flangeWidth: mm(u.flangeWidth), flangeThk: mm(u.flangeThk), webThk: mm(u.webThk),
    pinD: mm(u.pinOD), bigEndD: mm(57) }, { E: u.rodE * 1e9, yield: u.rodYield * 1e6 });
  const sec = (q) => ({ leff: q.leff * 1e3, slender: q.slender, pcr: q.pcr / 1e3, sf: q.sf, regime: q.regime });
  const buckling = { load: kN(raw.fRod), peakComp: rc.peakComp / 1e3, peakCompTheta: THETA[rc.peakCompIdx], peakTens: rc.peakTens / 1e3, areaMm2: rc.area * 1e6,
    sigmaComp: rc.sigmaComp / 1e6, sigmaTens: rc.sigmaTens / 1e6, inPlane: sec(rc.inPlane), outPlane: sec(rc.outPlane), governing: rc.governing };
  // Rod bolts / cap separation: the cap is pulled by the peak rod tension (exhaust TDC inertia) plus the big-end
  // centrifugal load, taken conservatively as the whole rotating mass (cap mass unknown); two bolts share it.
  const w = u.rpm * Math.PI / 30, fSep = rc.peakTens + u.mRot * (mm(u.stroke) / 2) * w * w, perBolt = fSep / 2;
  const aShank = Math.PI / 4 * mm(u.boltShankD) ** 2;
  buckling.bolts = { capLoadKN: fSep / 1e3, perBoltKN: perBolt / 1e3, preloadKN: u.boltPreloadKN, sfSeparation: u.boltPreloadKN * 1e3 / perBolt,
    preloadStressMPa: u.boltPreloadKN * 1e3 / aShank / 1e6 };
  if (buckling.bolts.sfSeparation < 1.5) warnings.push(`Rod bolts: preload only ${buckling.bolts.sfSeparation.toFixed(2)}x the per-bolt separating load`);
  const sfb = Math.min(buckling.inPlane.sf, buckling.outPlane.sf);
  if (sfb < 1) warnings.push(`Rod buckling: safety factor ${sfb.toFixed(2)} < 1 (not in the torque ceiling)`);
  return { rodBrg, pin, buckling, warnings };
}

function evaluate(u, mapKPa) {
  const g = geomOf(u), vd = vdOf(g);
  const { c, spark, mbt } = burn(u, g, mapKPa);
  const { raw, ...b } = bearingAnalysis(bearingInp(u), c.p);
  const tq = brakeNm(c.imepGross, u.rpm, vd), w = u.rpm * Math.PI / 30;
  let dpMax = 0;
  for (let i = 1; i < c.p.length; i++) {
    const th = b.theta[i];
    if (th > -30 && th < 90) dpMax = Math.max(dpMax, (c.p[i] - c.p[i - 1]) / BAR / 0.5);
  }
  // Edge film (rigid shell, journal slope from estimated stiffnesses) counts toward the limit only when asked:
  // it ignores shell conformability and housing tilt, so it reads pessimistic. It is always reported.
  const margins = { ...b.limits.margins };
  if (!u.edgeInLimit) delete margins.edgeFilm;
  const binding = Object.keys(margins).reduce((a, k) => (margins[k] < margins[a] ? k : a));
  b.limits = { binding, margins, edgeFilm: b.limits.margins.edgeFilm };
  const edgeMains = b.mains.map((m, i) => (m.edgeFilm <= 0 ? i + 1 : 0)).filter(Boolean);
  const warnings = b.warnings.filter((s) => !/edge film|edgeFilm/.test(s));
  if (edgeMains.length) warnings.unshift(`Edge film ≤ 0 at main${edgeMains.length > 1 ? "s" : ""} ${edgeMains.join(", ")} (worst ${Math.min(...b.mains.map((m) => m.edgeFilm)).toFixed(1)} µm)` +
    (u.edgeInLimit ? "" : " — not counted toward the limit; see Bearings"));
  if (c.ca50 > 30) warnings.push(`CA50 ${c.ca50.toFixed(0)}° ATDC: very late combustion, exhaust temperature not modelled`);
  const ext = extras(u, raw, b);
  warnings.push(...ext.warnings);
  return {
    ...b, rodBrg: ext.rodBrg, pin: ext.pin, buckling: ext.buckling, cam: camResult(u),
    cyl: { p: Float64Array.from(c.p, (v) => v / BAR), xb: c.xb, ca10: c.ca10, ca50: c.ca50, ca90: c.ca90, spark: -spark,
      delay: c.delay, burn: c.burn, pmaxBar: c.pmax / BAR, thetaPmax: c.thetaPmax, imepBar: c.imepGross / BAR,
      slCm: c.sl * 100, st: c.st, uPrime: c.uPrime, deltaLum: c.deltaL * 1e6, dpMax, mbt, mapKPa },
    // Mean torque shown is brake (IMEP less friction); torque.inst stays the indicated crank trace from bearing.js.
    torque: { ...b.torque, indicatedNm: b.torque.meanNm, meanNm: tq, meanLbft: tq / LBFT, powerKw: tq * w / 1e3, powerHp: tq * w / 745.7 },
    warnings,
  };
}

export function analyze(ui) {
  const u = { ...DEFAULTS, ...ui };
  const map = u.useTarget ? mapForTorque(u, geomOf(u), u.targetTorqueLbft * LBFT) : u.mapKPa;
  return evaluate(u, map);
}

// Torque ceiling: at each rpm raise MAP (spark per the slider or MBT) until the smallest bearing margin reaches zero.
const minMargin = (r) => Math.min(...Object.values(r.limits.margins));
export function torqueSweep(ui, rpms) {
  return rpms.map((rpm) => {
    const u = { ...DEFAULTS, ...ui, rpm, useTarget: false };
    let lo = 60, hi = 650, rLo = evaluate(u, lo);
    if (minMargin(rLo) < 0) return { rpm, torqueLbft: rLo.torque.meanLbft, mapKPa: lo, binding: rLo.limits.binding + " (already at low MAP)" };
    let rHi = evaluate(u, hi);
    if (minMargin(rHi) >= 0) return { rpm, torqueLbft: rHi.torque.meanLbft, mapKPa: hi, binding: "none below " + hi + " kPa" };
    for (let k = 0; k < 9; k++) {                       // ~1 kPa resolution
      const mid = 0.5 * (lo + hi), r = evaluate(u, mid);
      if (minMargin(r) >= 0) { lo = mid; rLo = r; } else { hi = mid; rHi = r; }
    }
    return { rpm, torqueLbft: rLo.torque.meanLbft, mapKPa: lo, binding: rHi.limits.binding };
  });
}
