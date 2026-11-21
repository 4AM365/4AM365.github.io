// cams.js -- camshaft data, valve-lift curves, event angles, VE and overlap-residual estimates (v0.3).
// Pure, dependency-free ES module. Angles: firing frame, theta = 0 at firing TDC, overlap TDC at +/-360.
// Lobe fields: adv = duration at 0.1 mm, dur1 = duration at 1 mm (crank deg), lift = net valve lift (mm),
// cl = centreline (deg ATDC-overlap for intake, BTDC-overlap for exhaust). Source: kelford-1fz-cams.md.

export const THETA = Float64Array.from({ length: 1440 }, (_, i) => -360 + 0.5 * i);

const L = (side, adv, dur1, lift, cl) => ({ side, adv, dur1, lift, cl });
const KELFORD = "Kelford via CJ Motor retailer page (Kelford site itself returned 403)";

export const CAMS = {
  "Stock": {
    label: "Stock 1FZ-FE", use: "Factory",
    in: L("in", 246, 208, 8.5, 108), ex: L("ex", 246, 208, 8.5, 108),
    springs: "Stock (48-53 lbf on seat)",
    source: "ESTIMATE ONLY: manual gives lobe height 50.61-50.71 mm, no timing. dur1 208 and lift 8.5 mm are assumed; " +
            "0.1 mm duration set to dur1 + 38. A forum post (ih8mud, unverified) quotes cam lift 8.3 in / 8.7 ex mm.",
    verified: false,
  },
  "225-A": {
    label: "Kelford 225-A", use: "Stage 1",
    in: L("in", 264, 225, 9.70, 107), ex: L("ex", 264, 225, 9.65, 107),
    springs: "not published",
    source: KELFORD + "; events 5.5/39.5/39.5/5.5 add up to 225. A Park Auto snippet says IVO 25.5 BTDC (inconsistent, rejected). " +
            "CJ page description mentions a 3RZ-FE.",
    verified: true,
  },
  "225-B": {
    label: "Kelford 225-B", use: "Stage 2",
    in: L("in", 270, 232, 9.65, 107), ex: L("ex", 270, 232, 9.65, 107),
    springs: "KVS17X (unconfirmed; one summary says that listing was a different engine)",
    source: KELFORD + "; stage name from search title only.",
    verified: true,
  },
  "225-C": {
    label: "Kelford 225-C", use: "Stage 3",
    in: L("in", 284, 246, 10.60, 104), ex: L("ex", 284, 246, 10.55, 107),
    springs: "not published (KVS04 per a search snippet)",
    source: KELFORD + "; Kelford's own 225-C page not read.",
    verified: true,
  },
  "225-T1": {
    label: "Kelford 225-T1", use: "Stage 3 turbo, 76 mm+ turbo",
    in: L("in", 276, 238, 10.35, 110), ex: L("ex", 284, 246, 10.55, 115),
    springs: "KVS04 (sold separately)",
    source: "snippet: 276/284 and lift from Evasive Motorsports (fetched; page does not say which lift is intake - " +
            "10.35 assumed intake). 238/246 @1 mm and IVO 9 BTDC / IVC 49 ABDC / EVO 58 BBDC / EVC 8 ATDC from a Speed Science " +
            "search snippet only. Centrelines 110 in / 115 ex are DERIVED from that timing, not published.",
    verified: false,
  },
};

// ---- lift shape: g(t) = cos^n(pi t / (2 t0)), |t| < t0 (t = crank deg from lobe centre) -------------------
// Fitted so lift = 0.1 mm at |t| = adv/2 and 1.0 mm at |t| = dur1/2 (exact). C1 at the ends since n > 1.
const shapeCache = new Map();
export function fitShape(lobe) {
  const key = `${lobe.adv}|${lobe.dur1}|${lobe.lift}`;
  if (shapeCache.has(key)) return shapeCache.get(key);
  const a = lobe.adv / 2, d = lobe.dur1 / 2, Lf = lobe.lift;
  const nOf = (t0) => Math.log(1 / Lf) / Math.log(Math.cos((Math.PI * d) / (2 * t0)));
  const res = (t0) => nOf(t0) * Math.log(Math.cos((Math.PI * a) / (2 * t0))) - Math.log(0.1 / Lf);
  let lo = a * 1.0000001, hi = a * 50; // t0 must exceed a (the 0.1 mm point is inside the lobe)
  const rl = res(lo);
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    (res(mid) > 0) === (rl > 0) ? (lo = mid) : (hi = mid);
  }
  const t0 = 0.5 * (lo + hi), n = nOf(t0);
  const s = { n, t0 };
  shapeCache.set(key, s);
  return s;
}

/** Valve lift (mm) at crank angle t from the lobe centre. */
export function lobeLift(lobe, t) {
  const { n, t0 } = fitShape(lobe);
  return Math.abs(t) >= t0 ? 0 : lobe.lift * Math.pow(Math.cos((Math.PI * t) / (2 * t0)), n);
}

const wrap720 = (x) => ((((x + 360) % 720) + 720) % 720) - 360;

/** Lobe centre in the firing frame (deg). Advance (+ = earlier) subtracts. */
export function centre(lobe, advance = 0) {
  return (lobe.side === "ex" ? 360 - lobe.cl : -360 + lobe.cl) - advance;
}

/** Valve lift (m) on THETA (1440 pts, firing frame). Lobe wraps across the +/-360 seam. Side comes from lobe.side. */
export function liftCurve(lobe, advance = 0) {
  const c = centre(lobe, advance), out = new Float64Array(THETA.length);
  for (let i = 0; i < THETA.length; i++) out[i] = lobeLift(lobe, wrap720(THETA[i] - c)) * 1e-3;
  return out;
}

/** Event angles (firing-frame deg) at 1 mm and 0.1 mm, overlap (deg, >= 0) and lobe separation angle. */
export function camEvents(cam, inAdv = 0, exAdv = 0) {
  const ci = centre(cam.in, inAdv), ce = centre(cam.ex, exAdv);
  const o = {};
  for (const [sfx, key] of [["", "dur1"], ["01", "adv"]]) {
    const hi = cam.in[key] / 2, he = cam.ex[key] / 2;
    o["ivo" + sfx] = ci - hi; o["ivc" + sfx] = ci + hi;
    o["evo" + sfx] = ce - he; o["evc" + sfx] = ce + he;
    o["overlap" + (sfx || "1")] = Math.max(0, o["evc" + sfx] - o["ivo" + sfx] - 720);
  }
  o.lsa = (cam.in.cl + cam.ex.cl) / 2;
  return o;
}

// ---- VE: port of turbo-dyno-projection/project.py (stock VE curve stretched by flow-integral ratio) ----
function pchip(x, y) { // scipy PchipInterpolator derivatives (Fritsch-Carlson), evaluated with clamping
  const n = x.length, h = [], dl = [], d = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h.push(x[i + 1] - x[i]); dl.push((y[i + 1] - y[i]) / h[i]); }
  for (let i = 1; i < n - 1; i++) {
    if (dl[i - 1] * dl[i] > 0) {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      d[i] = (w1 + w2) / (w1 / dl[i - 1] + w2 / dl[i]);
    }
  }
  const edge = (h0, h1, m0, m1) => {
    let v = ((2 * h0 + h1) * m0 - h0 * m1) / (h0 + h1);
    if (Math.sign(v) !== Math.sign(m0)) v = 0;
    else if (Math.sign(m0) !== Math.sign(m1) && Math.abs(v) > 3 * Math.abs(m0)) v = 3 * m0;
    return v;
  };
  d[0] = edge(h[0], h[1], dl[0], dl[1]);
  d[n - 1] = edge(h[n - 2], h[n - 3], dl[n - 2], dl[n - 3]);
  return (xv) => {
    const xc = Math.min(Math.max(xv, x[0]), x[n - 1]);
    let i = 0; while (i < n - 2 && xc > x[i + 1]) i++;
    const t = (xc - x[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h[i] * d[i] +
           (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h[i] * d[i + 1];
  };
}

const VD = 4.477e-3, BAR = 1e5, RHO_REF = 99e3 / (287 * 298.15), Q_GAS = 2.93e6, ETA_GAS = 0.37, FRIC_LOAD = 0.02;
const STOCK_RPM = [1000, 1500, 2000, 2500, 3200, 4000, 4600, 5000, 5500, 6000, 6500, 7000];
const STOCK_TQ = [215, 240, 255, 266, 275, 264, 242, 222, 197, 170, 143, 115]; // assumed shape; >4600 extrapolated
const fmep = (n) => (0.6 + 0.1 * (n / 1000) + 0.02 * (n / 1000) ** 2) * BAR;
const veStock = pchip(STOCK_RPM, STOCK_RPM.map((n, i) =>
  ((STOCK_TQ[i] * 1.3558 * 4 * Math.PI / VD + fmep(n) + 0.15 * BAR) / (1 - FRIC_LOAD)) / (RHO_REF * Q_GAS * ETA_GAS)));

const HEAD_CFM = 245, VALVE_D = 37.0; // peak port flow (Will); valve head diameter assumed (as project.py)
const flowLift = pchip([0, .1, .2, .25, .3, .35, 1].map((v) => v * VALVE_D), [0, .42, .78, .90, .97, 1, 1].map((v) => v * HEAD_CFM));

const taCache = new Map();
/** Port flow integrated over the intake event (cfm x crank deg), using THIS module's fitted lobe shape. */
export function timeArea(lobe) {
  const key = `${lobe.adv}|${lobe.dur1}|${lobe.lift}`;
  if (taCache.has(key)) return taCache.get(key);
  const { t0 } = fitShape(lobe), dt = 0.25;
  let s = 0;
  for (let t = -t0 + dt / 2; t < t0; t += dt) s += flowLift(lobeLift(lobe, t)) * dt;
  taCache.set(key, s);
  return s;
}

/**
 * VE at rpm: stock VE curve evaluated at rpm * TA_stock / TA_cam (VE as a function of inlet Mach index).
 * Depends on the INTAKE lobe only. Cam advance does NOT change VE here: the flow integral is shift-invariant
 * and IVC-timing/ram effects are not modelled (project.py doesn't either).
 */
export function camVE(cam, inAdv, exAdv, rpm) {
  const ratio = timeArea(CAMS.Stock.in) / timeArea(cam.in);
  return veStock(Math.min(Math.max(rpm * ratio, 1000), 7000));
}

/**
 * Residual gas mass fraction, ESTIMATE (not a gas-exchange simulation), after Heywood Eq. 6.21 (p. 414): x = x_IVO + x_backflow.
 *   x_IVO = clearance-gas residual of the ideal cycle, Eq. 5.35 (p. 310):
 *     (1/rc) (pe/pi)^(1/g) / [1 + Q* / (cv T1 rc^(g-1))]^(1/g),  g = 1.3, Q* / (cv T1) = 9.3 (rc - 1)/rc (Heywood's cycle values, p. 312);
 *     backRatio = pe/pi. (Ex. 5.1, rc 6, pe/pi 2: 0.082 reproduced.) Gives 3.1 % at rc 9, pe/pi 1.
 *   x_backflow: Heywood Eq. 6.20 is an integral of the overlap backflow mass flow, with no closed form or correlation in the book (Fig. 6.26,
 *   p. 415, is data only). Kept as a judgement figure: K (backRatio - 1) t_ov, t_ov = overlap time (ms) from the mean of the 0.1 mm and
 *   1 mm overlaps, K = 0.09 per ms (picked so 225-T1 at 1.2 back-pressure and 3500 rpm adds about 2 points); <= 1 adds nothing.
 * Clamped 2-15 %. cr defaults to 9 (the project engine).
 */
export function residualEstimate(events, backRatio, rpm, cr = 9) {
  const ovDeg = 0.5 * (events.overlap1 + events.overlap01);
  const tMs = (ovDeg / (6 * rpm)) * 1000;
  const g = 1.3, qStar = 9.3 * (cr - 1) / cr;
  const xIvo = (1 / cr) * backRatio ** (1 / g) / (1 + qStar / cr ** (g - 1)) ** (1 / g);   // Eq. 5.35
  const x = xIvo + 0.09 * Math.max(0, backRatio - 1) * tMs;
  return Math.min(0.15, Math.max(0.02, x));
}
