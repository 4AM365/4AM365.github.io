// calc.js — glue between the UI (display units) and the two model modules (SI). The UI imports only this file.
import { cylinderPressure, findMBT, FUELS } from "./combustion.js";
import { bearingAnalysis, cylinderForces, mainLoads, phaseCylinders, OILS, THETA } from "./bearing.js";
import { wristPin, rodColumn, peakFilmPressure } from "./rodpin.js";
import { CAMS, CAM_SETS, liftCurve, camEvents, camVE, residualEstimate } from "./cams.js";
import { ENGINES } from "./engines.js";

const LBFT = 1.3558179483314, BAR = 1e5;
// Fixed, not exposed: exhaust/intake pressure ratio (as bearing_limits.py), friction (project.py).
// IVC/EVO come from the selected cam's 1 mm events (v0.3); stock gives IVC -148, as the prior fixed value.
const FRIC_LOAD = 0.02;   // exhaust/intake pressure ratio is the backRatio input (2026-11-21; was fixed 1.2)
const fmep = (n) => (0.6 + 0.1 * n / 1000 + 0.02 * (n / 1000) ** 2) * BAR;

// v0.4: journals, FSM clearances and everything that differs by engine live in engines.js; BASE is what the presets share.
// mPistonGroup = piston + rings + pin, small end = mRec - mPistonGroup. Pin/rod section/bolt values are per engine (estimates unless tagged).
const BASE = {
  useTarget: false, sparkMbt: false, dilution: 5, mixing: 0.9, tumble: 1.0, tCharge: 45, ve: 0.9,
  pinOffset: 0, desaxe: 0, rodClr: "mid", mainClr: "mid", grooveWidth: 0, ratingMPa: 70, minFilmUm: 1.0, edgeInLimit: false,
  crankE: 207, webFactor: 0.45, capKV: 1.5, capKH: 1.0, pinYield: 1100, pinFatigue: 500, rodE: 205,
  // v0.3 — camshaft: cam-gear advance (deg, + earlier; intake VVT on the 2JZ), VE from cam or manual box, dilution manual or overlap residual
  inAdv: 0, exAdv: 0, veMode: "cam", dilMode: "manual",
};
const engineKey = (k) => (ENGINES[k] ? k : "1FZ-FE");
export const camsFor = (engine) => Object.keys(CAM_SETS[ENGINES[engineKey(engine)].camSet]);   // grind names, like OPTIONS.cams
/** Full display-unit defaults for an engine preset ("1FZ-FE" | "2JZ"). */
export function engineDefaults(key) {
  const k = engineKey(key);
  return { ...BASE, ...ENGINES[k].defaults, engine: k };
}
const resolve = (ui) => { const k = engineKey(ui && ui.engine); return { ...engineDefaults(k), ...ui, engine: k }; };
const engOf = (u) => ENGINES[engineKey(u.engine)];
const camSetOf = (u) => CAM_SETS[engOf(u).camSet];

export const OPTIONS = { fuels: Object.keys(FUELS), oils: Object.keys(OILS), clearance: ["min", "mid", "max", "custom"], cams: Object.keys(CAMS), engines: Object.keys(ENGINES) };
export const DEFAULTS = engineDefaults("1FZ-FE");

const mm = (v) => v / 1000;
function geomOf(u) {
  return { bore: mm(u.bore), stroke: mm(u.stroke), rod: mm(u.rod), cr: u.cr, offset: mm(u.pinOffset + u.desaxe) };
}
function camState(u) {
  const set = camSetOf(u), cam = set[u.cam] || Object.values(set)[0], ev = camEvents(cam, u.inAdv, u.exAdv);
  const ve = u.veMode === "manual" ? u.ve : camVE(cam, u.inAdv, u.exAdv, u.rpm, engOf(u).veBasis);
  const residual = residualEstimate(ev, u.backRatio, u.rpm, u.cr);
  return { cam, ev, ve, residual, dilution: u.dilMode === "cam" ? residual : u.dilution / 100 };
}
function opOf(u, mapKPa, spark, cs = camState(u)) {
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
  const table = Object.entries(camSetOf(u)).map(([k, c]) => {
    const ev = camEvents(c, 0, 0);
    return { grind: c.label, key: k, use: c.use, adv: { in: c.in.adv, ex: c.ex.adv }, dur1: { in: c.in.dur1, ex: c.ex.dur1 },
      lift: { in: c.in.lift, ex: c.ex.lift }, cl: { in: c.in.cl, ex: c.ex.cl }, pts: { in: c.in.pts, ex: c.ex.pts },
      ivo: -360 - ev.ivo, ivc: ev.ivc + 180, evo: 180 - ev.evo, evc: ev.evc - 360, springs: c.springs, verified: c.verified, source: c.source };
  });
  return { name: cs.cam.label, events: cs.ev, liftIn: mmArr(liftCurve(cs.cam.in, u.inAdv)), liftEx: mmArr(liftCurve(cs.cam.ex, u.exAdv)),
    piston, ve: cs.ve, residual: cs.residual, effCR: vIvc / vc, table };
}
function bearingInp(u) {
  const eng = engOf(u), CLR = eng.clr, J = eng.journals;
  const clr = (kind) => (u[kind + "Clr"] === "custom" ? u[kind + "ClrCustom"] : CLR[kind][u[kind + "Clr"]]);
  return {
    geom: geomOf(u), mass: { rec: u.mRec, rot: u.mRot, pg: Math.min(u.mPistonGroup, u.mRec) }, rpm: u.rpm,
    bearings: {
      rod: { d: mm(J.rod), l: mm(u.rodWidth), c: mm(clr("rod")) / 2, feedD: mm(u.feedRod), groove: 0 },
      main: { d: mm(J.main), l: mm(u.mainWidth), c: mm(clr("main")) / 2, feedD: mm(u.feedMain), groove: mm(u.grooveWidth) },
    },
    rating: u.ratingMPa * 1e6, hMinAccept: u.minFilmUm * 1e-6, edgeInLimit: !!u.edgeInLimit,
    crank: { E: u.crankE * 1e9, factor: u.webFactor, dJournal: mm(J.main), pitch: mm(u.mainPitch), kV: u.capKV * 1e9, kH: u.capKH * 1e9 },
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
    pinD: mm(u.pinOD), bigEndD: mm(engOf(u).journals.rod) }, { E: u.rodE * 1e9, yield: u.rodYield * 1e6 });
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
  const u = resolve(ui);
  const map = u.useTarget ? mapForTorque(u, geomOf(u), u.targetTorqueLbft * LBFT) : u.mapKPa;
  return evaluate(u, map);
}

// Torque ceiling: at each rpm raise MAP (spark per the slider or MBT) until the smallest bearing margin reaches zero.
const minMargin = (r) => Math.min(...Object.values(r.limits.margins));
export function torqueSweep(ui, rpms) {
  return rpms.map((rpm) => {
    const u = { ...resolve(ui), rpm, useTarget: false };
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

// ================================================================ v0.4 map solver =====================================================
// Combustion-only torque at (MAP, spark), plus a loads-only bearing check (peak rod and main unit load against the rating; no film, no
// temperature iteration). Rod and main peak loads rise with MAP at fixed spark, and fall as spark is retarded at fixed MAP.
const P0 = 101.325;            // kPa, boost gauge = MAP abs - P0
const MAP_LO = 25;             // kPa, lowest MAP the torque solve looks at
const HALF = (x) => Math.round(x * 2) / 2;     // spark resolution 0.5 deg

function solverCtx(ui, rpm) {
  const u = { ...resolve(ui), rpm, useTarget: false }, g = geomOf(u), bi = bearingInp(u), cs = camState(u);
  const rb = bi.bearings.rod, mb = bi.bearings.main, aRod = (rb.l - (rb.groove || 0)) * rb.d, aMain = (mb.l - (mb.groove || 0)) * mb.d;
  const peak = (x, y) => { let m = 0; for (let i = 0; i < x.length; i++) { const v = Math.hypot(x[i], y[i]); if (v > m) m = v; } return m; };
  return {
    u, g, vd: vdOf(g), cs,
    mbt: (map, tol = 0.1) => findMBT(opOf(u, map, 20, cs), g, tol),
    burn: (map, spark) => cylinderPressure(opOf(u, map, spark, cs), g),
    // peak unit load as % of the rating: rod bearing, worst main
    loads(c) {
      const F = cylinderForces(bi.geom, bi.mass, u.rpm, c.p);
      const px = phaseCylinders(F.loadX), py = phaseCylinders(F.loadY), ml = mainLoads(px.map((x, i) => ({ x, y: py[i] })), bi.crank, u.rpm);
      const rod = peak(F.pinX, F.pinY) / aRod / bi.rating * 100, main = Math.max(...ml.mains.map((L) => peak(L.x, L.y))) / aMain / bi.rating * 100;
      return { rodPct: rod, mainPct: main };
    },
  };
}

// Root of tq(map) = target on [lo, hi]; tq rises monotonically with MAP. Illinois regula falsi, stops inside tolFrac of the target.
function mapForTq(tq, target, lo, hi, tolFrac = 0.002) {
  let a = lo, b = hi, fa = tq(a) - target, fb = tq(b) - target;
  if (fa >= 0) return { map: a, status: "low" };
  if (fb < 0) return { map: b, status: "high" };
  let m = b, side = 0;
  for (let k = 0; k < 40; k++) {
    m = (a * fb - b * fa) / (fb - fa);
    const fm = tq(m) - target;
    if (Math.abs(fm) <= tolFrac * target || b - a < 0.05) break;
    if (fm * fb > 0) { b = m; fb = fm; if (side === -1) fa /= 2; side = -1; } else { a = m; fa = fm; if (side === 1) fb /= 2; side = 1; }
  }
  return { map: m, status: "ok" };
}

/**
 * Operating point for a brake-torque target at one rpm: the MAP (and spark) that makes lbft within the rating.
 * Spark starts at MBT; if the rod or main peak unit load exceeds ratingFrac x rating, spark is retarded in 1 deg steps (re-solving MAP for the
 * torque each time), then the last step is refined by 0.5 deg. Infeasible if no spark in [MBT - 25, MBT] fits, or MAP would exceed maxMapKPa.
 */
export function solvePoint(ui, rpm, lbft, opts = {}) {
  const ratingFrac = opts.ratingFrac ?? 1.0, maxMap = opts.maxMapKPa ?? 400, lim = ratingFrac * 100;
  const S = solverCtx(ui, rpm), target = lbft * LBFT, tq = (c) => brakeNm(c.imepGross, S.u.rpm, S.vd);
  const mk = (map, spark, mbt, extra) => {
    const c = S.burn(map, spark), L = S.loads(c), achieved = tq(c) / LBFT;
    return { rpm, targetLbft: lbft, achievedLbft: achieved, mapKPa: map, boostGauge: map - P0, spark, mbt, retard: mbt - spark, ca50: c.ca50,
      pmaxBar: c.pmax / BAR, rodPct: L.rodPct, mainPct: L.mainPct, binding: "none", feasible: true, note: "", ...extra };
  };
  // 1. MAP for the torque at MBT spark
  const r0 = mapForTq((m) => tq(S.burn(m, S.mbt(m))), target, MAP_LO, maxMap);
  const mbt0 = S.mbt(r0.map);
  const p0 = mk(r0.map, mbt0, mbt0);
  if (r0.status === "high") return { ...p0, binding: "map", feasible: false, note: `${lbft} lb-ft needs more than ${maxMap} kPa MAP (${p0.achievedLbft.toFixed(0)} lb-ft at the limit)` };
  const fits = (p) => p.rodPct <= lim && p.mainPct <= lim;
  if (fits(p0)) return { ...p0, note: r0.status === "low" ? `target below the ${MAP_LO} kPa torque; clamped` : "" };
  // 2. retard until both peak unit loads fit
  const bind = p0.rodPct >= p0.mainPct ? "rod" : "main";
  const loadOf = (p) => Math.max(p.rodPct, p.mainPct);
  const at = (ret) => {
    const spark = mbt0 - ret, r = mapForTq((m) => tq(S.burn(m, spark)), target, r0.map, maxMap);
    return r.status === "high" ? null : mk(r.map, spark, mbt0);
  };
  let best = p0, worse = 0, hit = 0;
  for (let k = 1; k <= 25 && !hit; k++) {
    const p = at(k);
    if (!p) return { ...best, binding: "map", feasible: false, note: `retarding ${k} deg needs more than ${maxMap} kPa MAP; rod ${best.rodPct.toFixed(0)} %, main ${best.mainPct.toFixed(0)} % of rating at best` };
    if (fits(p)) { hit = k; best = p; break; }
    if (loadOf(p) < loadOf(best)) { best = p; worse = 0; } else if (++worse >= 4) break;   // past the minimum: more retard needs more MAP and loads climb again
  }
  if (hit) {
    const half = at(hit - 0.5), p = half && fits(half) ? half : best;
    return { ...p, binding: bind, note: `retarded ${p.retard.toFixed(1)} deg from MBT to hold ${bind} bearing load at ${lim.toFixed(0)} % of rating` };
  }
  return { ...best, binding: bind, feasible: false, note: `no spark in [MBT-25, MBT] holds the ${bind} bearing under ${lim.toFixed(0)} % of rating (best ${loadOf(best).toFixed(0)} %)` };
}

/**
 * Ignition table row, deg BTDC per MAP bin (EMU convention): MBT per bin (combustion only), retarded where the peak rod or main unit load
 * would exceed ratingFrac x rating, never more advance at higher MAP than the bin below, 0.5 deg resolution, clamped to [minSpark, maxSpark].
 * The returned array carries .mbt (deg per bin, unrounded) and .limited (true where bearing retard applies) for display.
 * opts: {ratingFrac = 1, minSpark = -10, maxSpark = 45, retardMax = 25}.
 */
export function ignRow(ui, rpm, mapBins, opts = {}) {
  const ratingFrac = opts.ratingFrac ?? 1.0, lim = ratingFrac * 100, minSp = opts.minSpark ?? -10, maxSp = opts.maxSpark ?? 45, retMax = opts.retardMax ?? 25;
  const S = solverCtx(ui, rpm), n = mapBins.length;
  const mbt = mapBins.map((m) => S.mbt(m, 0.1));
  // Monotone MBT: least-squares non-increasing fit (pool adjacent violators), not a running minimum. The model's MBT dips at the lowest MAP bins
  // at high rpm (17.6 deg at 20 kPa against 27 at 125 kPa, 1FZ 7000 rpm), and a running minimum would pin the whole row to that dip.
  const blocks = [];
  mbt.forEach((v) => {
    blocks.push({ sum: v, n: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n < blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n) {
      const t = blocks.pop(); blocks[blocks.length - 1].sum += t.sum; blocks[blocks.length - 1].n += t.n;
    }
  });
  const iso = blocks.flatMap((bl) => new Array(bl.n).fill(bl.sum / bl.n));
  const base = iso.map((v) => Math.min(Math.max(HALF(v), minSp), maxSp));          // non-increasing stays non-increasing under clamp and rounding
  const fitAt = (i, spark) => { const L = S.loads(S.burn(mapBins[i], spark)); return L.rodPct <= lim && L.mainPct <= lim; };
  const val = base.slice(), limited = new Array(n).fill(false);
  for (let i = n - 1; i >= 0; i--) {                                              // every bin is checked (a check costs a few ms)
    if (fitAt(i, base[i])) continue;
    limited[i] = true;
    const lowest = Math.max(base[i] - retMax, minSp);
    if (!fitAt(i, lowest)) { val[i] = lowest; continue; }                       // cannot be met inside the retard range; keep the lowest allowed
    let lo = 0, hi = Math.round((base[i] - lowest) * 2);                         // half-degree steps of retard: lo does not fit, hi fits
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (fitAt(i, base[i] - mid / 2)) hi = mid; else lo = mid; }
    val[i] = base[i] - hi / 2;
  }
  let run = Infinity;
  for (let i = 0; i < n; i++) { run = Math.min(run, val[i]); val[i] = run; }   // a retarded bin carries up to the bins above
  val.mbt = mbt; val.limited = limited;
  return val;
}

const csvOf = (corner, xBins, rpmBins, cells, fmt) =>
  [corner + "," + xBins.join(","), ...rpmBins.map((r, i) => [r, ...cells[i].map(fmt)].join(",")).reverse()].join("\n");   // rpm DESCENDING down the rows

/**
 * EMU Black tables for the selected engine's bins (engines.js tables).
 * linePts: solved points [{rpm, boostGauge}] (solvePoint output), any rpm spacing. ignCells: optional rows from ignRow, one per ignition rpm bin
 *   in ascending rpm; a missing/null row is computed with ignRow (about 1 s each), so a UI can pass rows it has already solved.
 * ign.cells[rpmIdx][mapIdx] deg BTDC; boost.cells[rpmIdx][pedalIdx] kPa GAUGE (integer); rpm bins ascending in the arrays, DESCENDING in the csv.
 * boost: full-pedal column = line boost interpolated (linear, ends clamped) to the boost rpm bins, floored at 0; lower pedal bins ramp linearly from
 *   min(opts.spoolKPa = 60, full) at pedal 0 to the full value at the second-highest pedal bin.
 */
export function emuTables(ui, linePts, ignCells, opts = {}) {
  const u = resolve(ui), T = engOf(u).tables, spool = opts.spoolKPa ?? 60;
  const icells = T.ignRpm.map((rpm, i) => (ignCells && ignCells[i]) || ignRow(u, rpm, T.ignMap, opts));
  const pts = [...linePts].sort((a, b) => a.rpm - b.rpm);
  const line = (rpm) => {
    if (!pts.length) return 0;
    if (rpm <= pts[0].rpm) return pts[0].boostGauge;
    for (let i = 1; i < pts.length; i++) if (rpm <= pts[i].rpm) { const f = (rpm - pts[i - 1].rpm) / (pts[i].rpm - pts[i - 1].rpm); return pts[i - 1].boostGauge + f * (pts[i].boostGauge - pts[i - 1].boostGauge); }
    return pts[pts.length - 1].boostGauge;
  };
  const P = T.boostPedal, knee = P[P.length - 2];
  const bcells = T.boostRpm.map((rpm) => {
    const full = Math.max(0, line(rpm)), start = Math.min(spool, full);
    return P.map((p) => Math.round(start + (full - start) * Math.min(1, p / knee)));
  });
  return {
    ign: { rpmBins: T.ignRpm, mapBins: T.ignMap, cells: icells, csv: csvOf("RPM\\MAP", T.ignMap, T.ignRpm, icells, (v) => v.toFixed(1)) },
    boost: { rpmBins: T.boostRpm, pedalBins: P, cells: bcells, csv: csvOf("RPM\\PEDAL", P, T.boostRpm, bcells, (v) => String(v)) },
  };
}
