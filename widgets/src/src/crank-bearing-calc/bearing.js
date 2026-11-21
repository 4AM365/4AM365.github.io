// bearing.js — crank bearing loads, load share, oil film, oil flow/temperature. Dependency-free ES module, SI inside.
// Does not import combustion.js; takes a cylinder-pressure array p (Pa) on THETA.
//
// inp (SI) for bearingAnalysis(inp, p):
//   geom:     { bore, stroke, rod, offset }          m; offset = desaxe + wrist-pin offset, + toward major-thrust side
//   mass:     { rec, rot }                           kg; reciprocating, rotating big-end share
//   rpm
//   bearings: { rod:{d,l,c,feedD,groove}, main:{d,l,c,feedD,groove} }   m; c = RADIAL clearance; groove = circumferential
//                                                    groove width (0 = none; >0 splits the land into two of (l-groove)/2)
//   rating:   Pa peak unit load (on projected area d*(l-groove));  hMinAccept: m
//   crank:    { E, factor, dJournal, pitch, kV, kH } Pa, -, m, m, N/m (vertical = bore axis, horizontal = across engine)
//   oil:      { grade, tSupplyK, pSupplyPa, muOverride? }   muOverride (Pa.s) fixes film viscosity, skips temperature iteration
// Frame: block frame x across engine, y up the bore; theta = 0 firing TDC, crank turns with theta increasing.
// Piston-axial load is positive toward the crank, so fInertia = +m_rec*xdd (negative near TDC, where it relieves the pin).
// Main bearings: rotating masses are taken as balanced by the counterweights (as bearing_limits.py), so the beam is
// loaded with the rod force WITHOUT the big-end centrifugal term; the rod bearing carries it.

const PI = Math.PI, D2R = PI / 180, N = 1440, DTH = 0.5;
export const THETA = Float64Array.from({ length: N }, (_, i) => -360 + DTH * i);
const P_CASE = 1e5;
const LBFT = 1.3558179483314;

// ---------------------------------------------------------------- oil
// Typical published values for mainstream oils (not a specific product): KV40, KV100 cSt, HTHS 150 C mPa.s.
export const OILS = {
  "0W-20": { kv40: 45, kv100: 8.5, hths150: 2.6, label: "0W-20 (typical)" },
  "5W-30": { kv40: 65, kv100: 10.8, hths150: 3.1, label: "5W-30 (typical)" },
  "10W-30": { kv40: 72, kv100: 10.8, hths150: 3.0, label: "10W-30 (typical)" },
  "10W-40": { kv40: 92, kv100: 14.2, hths150: 3.7, label: "10W-40 (typical)" },
  "15W-40": { kv40: 107, kv100: 14.4, hths150: 4.1, label: "15W-40 (typical)" },
  "15W-50": { kv40: 120, kv100: 17.5, hths150: 4.6, label: "15W-50 (typical)" },
  "20W-50": { kv40: 165, kv100: 18.2, hths150: 4.8, label: "20W-50 (typical)" },
  "10W-60": { kv40: 155, kv100: 23.2, hths150: 5.7, label: "10W-60 (typical)" },
};
const density = (tK) => 860 - 0.65 * (tK - 288.15);
// Walther / ASTM D341: log10 log10(nu + 0.7) = A - B log10 T, fitted through KV40 and KV100.
function kvAt(o, tK) {
  const ll = (nu) => Math.log10(Math.log10(nu + 0.7));
  const B = (ll(o.kv40) - ll(o.kv100)) / (Math.log10(373.15) - Math.log10(313.15));
  const A = ll(o.kv40) + B * Math.log10(313.15);
  return Math.pow(10, Math.pow(10, A - B * Math.log10(tK))) - 0.7;
}
export function oilViscosity(grade, tK) {
  const o = OILS[grade], rho = density(tK);
  const mu = kvAt(o, tK) * 1e-6 * rho;
  // Shear thinning: scale the low-shear curve so it meets HTHS at 150 C (multigrade polymer sheared in the film).
  const muFilm = mu * (o.hths150 * 1e-3) / (kvAt(o, 423.15) * 1e-6 * density(423.15));
  return { mu, muFilm, rho };
}

// ---------------------------------------------------------------- kinematics
// sin(phi) = (r sin(th) - e)/l ; x = r cos th + l cos phi (up the bore from crank centre). Exact derivatives, no series.
export function kinematics(g, rpm) {
  const r = g.stroke / 2, l = g.rod, e = g.offset || 0, w = rpm * PI / 30;
  const x = new Float64Array(N), v = new Float64Array(N), a = new Float64Array(N), phi = new Float64Array(N), phiDot = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const th = THETA[i] * D2R, s = (r * Math.sin(th) - e) / l, cp = Math.sqrt(1 - s * s), ph = Math.asin(s);
    const dph = r * Math.cos(th) / (l * cp);                  // dphi/dtheta
    const D = -r * Math.sin(th + ph) / cp;                    // dx/dtheta
    const dD = -r * (Math.cos(th + ph) * (1 + dph) * cp + Math.sin(th + ph) * s * dph) / (cp * cp);   // d2x/dtheta2
    x[i] = r * Math.cos(th) + l * cp; v[i] = w * D; a[i] = w * w * dD; phi[i] = ph; phiDot[i] = w * dph;
  }
  return { x, v, a, phi, phiDot };
}

// ---------------------------------------------------------------- cylinder forces
export function cylinderForces(g, m, rpm, p) {
  const r = g.stroke / 2, w = rpm * PI / 30, A = PI / 4 * g.bore ** 2, k = kinematics(g, rpm);
  const o = {};
  for (const n of ["fGas", "fInertia", "fAxial", "fRod", "fPin", "fSide", "pinX", "pinY", "torque", "loadX", "loadY", "rodX", "rodY", "wbar", "wRod", "slideRod"]) o[n] = new Float64Array(N);
  const cf = m.rot * r * w * w;
  for (let i = 0; i < N; i++) {
    const th = THETA[i] * D2R, ph = k.phi[i], cp = Math.cos(ph);
    const fg = (p[i] - P_CASE) * A, fi = m.rec * k.a[i], fa = fg + fi, fr = fa / cp;
    o.fGas[i] = fg; o.fInertia[i] = fi; o.fAxial[i] = fa; o.fRod[i] = fr;
    // Wrist-pin load: piston-group inertia only (m.pg = piston + rings + pin; falls back to m.rec), along the rod (/cos phi).
    o.fPin[i] = (fg + (m.pg ?? m.rec) * k.a[i]) / cp;
    o.fSide[i] = fa * Math.tan(ph);                           // wall reaction on the piston, +x
    o.loadX[i] = fr * Math.sin(ph); o.loadY[i] = -fa;         // rod force on the crank pin (no centrifugal)
    o.pinX[i] = o.loadX[i] + cf * Math.sin(th); o.pinY[i] = o.loadY[i] + cf * Math.cos(th);
    o.torque[i] = fr * r * Math.sin(th + ph);                 // + = driving; (pin position x force)
    // pin load in the rod frame: y along the rod toward the big end (compression +), x across it
    o.rodX[i] = cf * Math.sin(th + ph); o.rodY[i] = fr - cf * Math.cos(th + ph);
    o.wRod[i] = k.phiDot[i];                                  // rod angular speed, + anticlockwise (journal is -w)
    o.wbar[i] = (-w + k.phiDot[i]) / 2;                       // mean of journal (-w) and sleeve (rod) speeds, as bearing_limits.py
    o.slideRod[i] = w + k.phiDot[i];                          // |journal - sleeve| sliding speed
  }
  return o;
}

// ---------------------------------------------------------------- firing phasing
export const FIRING_ORDER = [1, 5, 3, 6, 2, 4];               // inline six, 120 deg apart
export const roll = (a, s) => { const o = new Float64Array(N); for (let i = 0; i < N; i++) o[i] = a[(((i - s) % N) + N) % N]; return o; };
// Cylinder n (1..6, axial order) fires FIRING_ORDER.indexOf(n)*120 deg after cylinder 1, so its curve is cylinder 1's
// rolled by that many grid steps (np.roll equivalent). Returns six arrays in axial order.
export const phaseCylinders = (a) => [1, 2, 3, 4, 5, 6].map((c) => roll(a, FIRING_ORDER.indexOf(c) * 120 / DTH));

// ---------------------------------------------------------------- crank beam on elastic supports
function chol(K, n) {
  const L = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = K[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    L[i][j] = i === j ? Math.sqrt(s) : s / L[j][j];
  }
  return L;
}
function cholSolve(L, b, n) {
  const y = new Float64Array(n), x = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
  return x;
}
// 13 nodes at pitch/2 (even = mains 0..6, odd = mid-span load points of cylinders 1..6). DOFs: w at node n = index n;
// slopes follow, one per node, or (crank.hinged) one per element end at the interior mains so spans are simply supported.
function makeBeam(c) {
  const EI = c.factor * c.E * PI * c.dJournal ** 4 / 64, Le = c.pitch / 2, nn = 13;
  const k = [[12, 6 * Le, -12, 6 * Le], [6 * Le, 4 * Le * Le, -6 * Le, 2 * Le * Le], [-12, -6 * Le, 12, -6 * Le], [6 * Le, 2 * Le * Le, -6 * Le, 4 * Le * Le]];
  let nd = nn; const rot = []; for (let n = 0; n < nn; n++) rot.push(nd++);
  const el = []; // per element: [wL, thL, wR, thR] global DOFs
  for (let e = 0; e < 12; e++) el.push([e, rot[e], e + 1, rot[e + 1]]);
  if (c.hinged) for (let m = 1; m < 6; m++) el[2 * m][1] = nd++;     // element to the right of main m gets its own end rotation
  const fac = (spr) => {
    const K = Array.from({ length: nd }, () => new Float64Array(nd));
    el.forEach((d, e) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K[d[i]][d[j]] += EI / Le ** 3 * k[i][j]; });
    for (let m = 0; m < 7; m++) K[2 * m][2 * m] += spr;
    return chol(K, nd);
  };
  // journal slope at main m: shared DOF, or mean of the two sides when hinged
  const slopeIdx = (m) => (c.hinged && m > 0 && m < 6 ? [rot[2 * m], el[2 * m][1]] : [rot[2 * m]]);
  return { LV: fac(c.kV), LH: fac(c.kH), nd, slopeIdx, z: Array.from({ length: nn }, (_, i) => i * Le) };
}
// Support reaction = main load (force of the journal on the bearing, same sign as the applied pin loads).
// LIMITS: a continuous beam on RIGID supports is not half-each: it is statically indeterminate and its reactions do not
// depend on EI at all, so no choice of EI/stiffness ratio produces half-each (checked against the three-moment theorem).
// Half-each is the pin-jointed limit, every span simply supported, available here as crank.hinged = true.
export function mainLoads(pin6, crank, rpm) {
  void rpm;
  const B = makeBeam(crank), mains = Array.from({ length: 7 }, () => ({ x: new Float64Array(N), y: new Float64Array(N) }));
  const slope = Array.from({ length: 7 }, () => new Float64Array(N)), b = new Float64Array(B.nd), sl = [new Float64Array(7), new Float64Array(7)];
  const sIdx = Array.from({ length: 7 }, (_, m) => B.slopeIdx(m));
  for (let i = 0; i < N; i++) {
    [["x", B.LH, crank.kH], ["y", B.LV, crank.kV]].forEach(([ax, L, spr], pl) => {
      b.fill(0); for (let cyl = 0; cyl < 6; cyl++) b[2 * cyl + 1] = pin6[cyl][ax][i];
      const x = cholSolve(L, b, B.nd);
      for (let m = 0; m < 7; m++) { mains[m][ax][i] = spr * x[2 * m]; sl[pl][m] = sIdx[m].reduce((a, j) => a + x[j], 0) / sIdx[m].length; }
    });
    for (let m = 0; m < 7; m++) slope[m][i] = Math.hypot(sl[0][m], sl[1][m]);
  }
  return { mains, slope };
}
// Node deflections (z mm, wV/wH um) of the crank at grid index i.
export function crankDeflection(pin6, crank, i) {
  const B = makeBeam(crank), out = { z: B.z.map((z) => z * 1e3), wV: [], wH: [] };
  for (const [ax, L, key] of [["x", B.LH, "wH"], ["y", B.LV, "wV"]]) {
    const b = new Float64Array(B.nd); for (let cyl = 0; cyl < 6; cyl++) b[2 * cyl + 1] = pin6[cyl][ax][i];
    const x = cholSolve(L, b, B.nd); for (let n = 0; n < 13; n++) out[key].push(x[n] * 1e6);
  }
  return out;
}

// ---------------------------------------------------------------- film (Booker mobility, short bearing)
// Dormand-Prince 5(4), step-size control; steps are cut to land on every 0.5 deg grid point so output needs no interpolation.
// DP.a[s] = coefficients of stage s (0-based); DP.a[6] are the 5th-order solution weights (FSAL: stage 7 = f(new y)).
const DP = {
  a: [[], [1 / 5], [3 / 40, 9 / 40], [44 / 45, -56 / 15, 32 / 9], [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656], [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]],
  c: [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1],
  e: [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40],
};
// load: force applied to the journal {x,y} (N); wbar: mean journal/sleeve angular speed (+ anticlockwise); brg {d,l,c}; mu Pa.s.
// Returns h (m, last cycle on THETA), hMin, epsMax, plus eps(theta), qSide(theta) (m3/s out of both ends, this land).
export function film(load, wbar, brg, mu, rpm, opts = {}) {
  const { d, l, c } = brg, cycles = opts.cycles || 2, rtol = 1e-6, atol = 1e-8;
  const k1 = (c / (d / 2)) ** 2 / (mu * l * d), ld2 = (l / d) ** 2, n6 = 6 * rpm;
  const ext = (a) => { const o = new Float64Array(N + 1); o.set(a); o[N] = a[0]; return o; };
  const fx = ext(load.x), fy = ext(load.y), wb = ext(wbar), K = Array.from({ length: 7 }, () => new Float64Array(2)), o2 = new Float64Array(3);
  function rhs(th, ex, ey, o) {
    let t = th + 360; t -= 720 * Math.floor(t / 720); t /= DTH;
    const i = Math.min(Math.floor(t), N - 1), u = t - i;
    const Fx = fx[i] + u * (fx[i + 1] - fx[i]), Fy = fy[i] + u * (fy[i + 1] - fy[i]), om = wb[i] + u * (wb[i + 1] - wb[i]);
    const fm = Math.hypot(Fx, Fy) + 1e-9, efx = Fx / fm, efy = Fy / fm, epx = -efy, epy = efx;
    const xi = Math.min(ex * efx + ey * efy, 0.99999), eta = ex * epx + ey * epy, q = 1 - xi;
    const mf = q ** 2.5 / (PI * ld2), mp = -4 * eta * q ** 1.5 / (PI * PI * ld2);   // mobility along load / across it
    const mx_ = fm * k1 * (mf * efx + mp * epx), my_ = fm * k1 * (mf * efy + mp * epy);
    o[0] = (mx_ - om * ey) / n6; o[1] = (my_ + om * ex) / n6; o[2] = Math.hypot(mx_, my_);   // d/dtheta (deg); |M| in 1/s
  }
  const th0 = -360, nGrid = Math.round(720 * cycles / DTH);
  let ex = 0, ey = 0, hStep = 0.05;
  const eps = new Float64Array(N), qs = new Float64Array(N), epsX = new Float64Array(N), epsY = new Float64Array(N);
  // Squeeze-out through the ends: with p = 6 mu h_t (z^2 - l^2/4)/h^3 the side flow per unit length is -h_t l/2 where
  // h_t < 0, and h_t = -c M.n(alpha) with M the mobility velocity, so total = 2 c |M| l R (both ends, half the circle).
  const rec = (j) => {
    const jj = j - (nGrid - N); if (jj < 0 || jj >= N) return;
    rhs(th0 + j * DTH, ex, ey, o2); eps[jj] = Math.hypot(ex, ey); epsX[jj] = ex; epsY[jj] = ey; qs[jj] = c * l * d * o2[2];
  };
  rec(0);
  for (let j = 0; j < nGrid; j++) {
    const tb = th0 + (j + 1) * DTH; let t = th0 + j * DTH;
    rhs(t, ex, ey, K[0]);
    while (t < tb - 1e-12) {
      let h = Math.min(hStep, tb - t);
      for (;;) {
        let yx = ex, yy = ey;
        for (let s = 1; s < 7; s++) {
          yx = ex; yy = ey; const as = DP.a[s];
          for (let m = 0; m < s; m++) { yx += h * as[m] * K[m][0]; yy += h * as[m] * K[m][1]; }
          rhs(t + (s < 6 ? DP.c[s] : 1) * h, yx, yy, K[s]);
        }
        // after s = 6, (yx, yy) is the 5th-order solution and K[6] = f(solution)
        let ax = 0, ay = 0; for (let m = 0; m < 7; m++) { ax += h * DP.e[m] * K[m][0]; ay += h * DP.e[m] * K[m][1]; }
        const err = Math.max(Math.abs(ax) / (atol + rtol * Math.max(Math.abs(ex), Math.abs(yx))), Math.abs(ay) / (atol + rtol * Math.max(Math.abs(ey), Math.abs(yy))));
        const fac = Math.min(5, Math.max(0.2, 0.9 * Math.pow(Math.max(err, 1e-10), -0.2)));
        if (err <= 1 || h < 1e-9) { t += h; ex = yx; ey = yy; K[0].set(K[6]); hStep = Math.max(1e-6, Math.min(0.5, h * fac)); break; }
        h *= fac;
      }
    }
    rec(j + 1);
  }
  let epsMax = 0, hm = Infinity; const h = new Float64Array(N);
  for (let i = 0; i < N; i++) { h[i] = c * (1 - eps[i]); epsMax = Math.max(epsMax, eps[i]); hm = Math.min(hm, h[i]); }
  return { h, hMin: hm, epsMax, eps, qSide: qs, epsX, epsY };
}

// ---------------------------------------------------------------- oil flow and film temperature
const CP_OIL = 2000, CD_HOLE = 0.6;
// Rod feed pressure, 1FZ assumption: rod journal fed from the main journal through a cross-drilling reaching radius ~ the
// throw r. Oil in the drilling turns with the crank: p_rod = p_gallery + rho w^2 (r^2 - (dMain/2)^2)/2, a head that adds
// when the throw radius exceeds the main-journal radius and subtracts otherwise. Passage viscous loss ignored.
export const rodFeedPressure = (pGallery, r, dMain, rpm, tK) => { const w = rpm * PI / 30; return pGallery + 0.5 * density(tK) * w * w * (r * r - (dMain / 2) ** 2); };
const landsOf = (b) => { const g = b.groove || 0; return g > 0 ? { n: 2, le: (b.l - g) / 2 } : { n: 1, le: b.l }; };

// Pressure-fed flow, Martin (1983) form for a groove/hole fed plain bearing: oil crosses the lands to the ends as a
// concentric annulus (Poiseuille, pi d c^3 dp/(12 mu L) per land, L = land length from the feed), and journal eccentricity
// raises c^3 by (1 + 1.5 eps^2). A grooved shell feeds from the groove edge (land (l-g)/2 each side); a plain shell is
// treated as fed at mid-width (land l/2), i.e. the feed hole is assumed to spread over the circumference through the
// unloaded, wide-gap half. Capped by the feed-hole orifice flow.
// shortcut: Cd 0.6, no passage losses; a single feed hole really supplies less than a full groove would.
function feedFlow(brg, feedD, pS, mu, eps2, tK) {
  const { d, c } = brg, g = brg.groove || 0, Le = (brg.l - g) / 2;
  const qGap = PI * d * c ** 3 * pS * (1 + 1.5 * eps2) / (6 * mu * Le);
  const qOr = CD_HOLE * PI / 4 * feedD ** 2 * Math.sqrt(2 * Math.max(pS, 0) / density(tK));
  return Math.min(qGap, qOr);
}
// brg {d,l,c,groove} full shell; filmFn(mu) -> film() result for ONE land carrying load/nLands (or a film result, held
// fixed); slide: |journal - sleeve| angular speed array (rad/s) for friction. Deviation from API.md: the 9th argument is
// slide, not loadMag (side leakage comes from the film solution's own squeeze flow, which needs no load magnitude).
export function oilFlowAndTemp(brg, filmFn, pS, feedD, oil, tSupplyK, rpm, isRod, slide) {
  void rpm; void isRod;
  const { n, le } = landsOf(brg), fixed = typeof filmFn !== "function", ov = oil.muOverride != null;
  let T = tSupplyK, res;
  for (let it = 0; it < 40; it++) {
    const mu = ov ? oil.muOverride : oilViscosity(oil.grade, T).muFilm, rho = density(T);
    const f = fixed ? filmFn : filmFn(mu);
    let pf = 0, qs = 0, e2 = 0, iMax = 0;
    for (let i = 0; i < N; i++) {
      const eps = Math.min(f.eps[i], 0.995), U = slide[i] * brg.d / 2;
      // Petroff with the 1/sqrt(1-eps^2) eccentricity correction over the full circumference: hot-biased (cavitated arc shears less).
      pf += mu * PI * brg.d * le * n * U * U / (brg.c * Math.sqrt(1 - eps * eps));
      qs += f.qSide[i]; e2 += f.eps[i] ** 2; if (f.eps[i] > f.eps[iMax]) iMax = i;
    }
    pf /= N; qs = qs / N * n; e2 /= N;
    const qFeed = feedFlow(brg, feedD, pS, mu, e2, T), q = qFeed + qs;
    const qFeedPk = feedFlow(brg, feedD, pS, mu, f.eps[iMax] ** 2, T), qSidePk = f.qSide[iMax] * n;
    const Tn = ov ? tSupplyK : tSupplyK + Math.min(pf / (rho * CP_OIL * q), 150);   // T_film = T_supply + P/(rho cp Q)
    res = { tFilm: Tn, muFilm: mu, q, qFeed, qSide: qs, starved: qFeedPk < qSidePk, pFric: pf, film: f, iterations: it + 1 };
    if (ov || fixed || Math.abs(Tn - T) < 0.1) break;
    T = 0.5 * (T + Tn);        // relaxed: hotter -> thinner -> more eccentric -> more friction can run away undamped
  }
  // the film (and mu) in res were computed at the last T tried; converged to < 0.1 K so tFilm and muFilm agree
  return res;
}

// ---------------------------------------------------------------- full analysis
const mag = (x, y) => { const o = new Float64Array(N); for (let i = 0; i < N; i++) o[i] = Math.hypot(x[i], y[i]); return o; };
const scale = (a, s) => a.map((v) => v * s);
const amax = (a) => { let m = 0; for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; };
function oneBearing(b, loadX, loadY, wbar, slide, pS, oil, rpm) {
  const { n, le } = landsOf(b), ld = { x: scale(loadX, 1 / n), y: scale(loadY, 1 / n) };   // lands share the load
  return oilFlowAndTemp(b, (mu) => film(ld, wbar, { d: b.d, l: le, c: b.c }, mu, rpm), pS, b.feedD, oil, oil.tSupplyK, rpm, false, slide);
}

export function bearingAnalysis(inp, p) {
  const { geom, mass, rpm, bearings: B, crank, oil, rating, hMinAccept } = inp, w = rpm * PI / 30, r = geom.stroke / 2;
  const F = cylinderForces(geom, mass, rpm, p), warnings = [], um = 1e6;
  const inst = new Float64Array(N); for (const t of phaseCylinders(F.torque)) for (let i = 0; i < N; i++) inst[i] += t[i];
  let mean = 0; for (let i = 0; i < N; i++) mean += inst[i] / N;
  let sidePk = 0, sideTh = 0; for (let i = 0; i < N; i++) if (Math.abs(F.fSide[i]) > Math.abs(sidePk)) { sidePk = F.fSide[i]; sideTh = THETA[i]; }
  // ---- rod bearing (film load is the force applied to the journal = minus the force of the rod on the pin, as in the Python)
  const rb = B.rod, pRod = rodFeedPressure(oil.pSupplyPa, r, B.main.d, rpm, oil.tSupplyK);
  const rr = oneBearing(rb, F.pinX.map((v) => -v), F.pinY.map((v) => -v), F.wbar, F.slideRod, pRod, oil, rpm);
  const pkRod = amax(mag(F.pinX, F.pinY)), aRod = (rb.l - (rb.groove || 0)) * rb.d;
  const rod = { polar: { x: scale(F.rodX, 1e-3), y: scale(F.rodY, 1e-3) }, peakKN: pkRod / 1e3, peakMPa: pkRod / aRod / 1e6, pctRating: pkRod / aRod / rating * 100,
    h: scale(rr.film.h, um), hMin: rr.film.hMin * um, eps: rr.film.epsMax, tFilmC: rr.tFilm - 273.15, muFilm: rr.muFilm * 1e3, qLmin: rr.q * 6e4, qFeedLmin: rr.qFeed * 6e4, qSideLmin: rr.qSide * 6e4, starved: rr.starved };
  // ---- mains: beam load share, then a film per main
  const pin6x = phaseCylinders(F.loadX), pin6y = phaseCylinders(F.loadY), pin6 = pin6x.map((x, i) => ({ x, y: pin6y[i] }));
  const ml = mainLoads(pin6, crank, rpm), mb = B.main, aMain = (mb.l - (mb.groove || 0)) * mb.d;
  const wMain = new Float64Array(N).fill(-w / 2), slideMain = new Float64Array(N).fill(w);
  const mains = [], films = [], mainsRaw = [], peakAt = { v: 0, i: 0 };
  for (let m = 0; m < 7; m++) {
    const L = ml.mains[m], lm = mag(L.x, L.y), pk = amax(lm);
    const t = oneBearing(mb, L.x, L.y, wMain, slideMain, oil.pSupplyPa, oil, rpm), f = t.film;
    // edge film = h - |slope| l/2 taken at the same instant, minimised over the cycle
    let edge = Infinity, sMax = 0;
    for (let i = 0; i < N; i++) { edge = Math.min(edge, f.h[i] - ml.slope[m][i] * mb.l / 2); sMax = Math.max(sMax, ml.slope[m][i]); if (lm[i] > peakAt.v) { peakAt.v = lm[i]; peakAt.i = i; } }
    mains.push({ peakKN: pk / 1e3, peakMPa: pk / aMain / 1e6, pctRating: pk / aMain / rating * 100, hMin: f.hMin * um, edgeFilm: edge * um, slopeMrad: sMax * 1e3,
      tFilmC: t.tFilm - 273.15, muFilm: t.muFilm * 1e3, qLmin: t.q * 6e4, qFeedLmin: t.qFeed * 6e4, qSideLmin: t.qSide * 6e4, starved: t.starved });
    films.push(f); mainsRaw.push({ load: { x: L.x, y: L.y }, eps: f.eps, ...landsOf(mb) });
    if (edge <= 0) warnings.push(`Main ${m + 1}: edge film ${(edge * um).toFixed(2)} um, journal slope puts the shell edge in contact`);
    if (t.starved) warnings.push(`Main ${m + 1}: pressure-fed supply below side leakage at peak eccentricity (starvation risk)`);
  }
  if (rod.starved) warnings.push("Rod bearing: pressure-fed supply below side leakage at peak eccentricity (starvation risk)");
  // worst main: smallest of its load, film and edge-film margins
  // (edge film enters only when inp.edgeInLimit is set; calc.js leaves it off by default)
  const mm = (q) => Math.min(rating / (q.peakMPa * 1e6) - 1, q.hMin * 1e-6 / hMinAccept - 1, inp.edgeInLimit ? q.edgeFilm * 1e-6 / hMinAccept - 1 : Infinity);
  let worst = 0; mains.forEach((q, i) => { if (mm(q) < mm(mains[worst])) worst = i; });
  const mw = ml.mains[worst];
  const margins = { rodLoad: rating / (pkRod / aRod) - 1, mainLoad: rating / (Math.max(...mains.map((q) => q.peakMPa)) * 1e6) - 1,
    rodFilm: rod.hMin * 1e-6 / hMinAccept - 1, mainFilm: Math.min(...mains.map((q) => q.hMin)) * 1e-6 / hMinAccept - 1,
    edgeFilm: Math.min(...mains.map((q) => q.edgeFilm)) * 1e-6 / hMinAccept - 1 };
  const binding = Object.keys(margins).reduce((a, k) => (margins[k] < margins[a] ? k : a));
  for (const [k, v] of Object.entries(margins)) if (v < 0) warnings.push(`Limit exceeded: ${k} (margin ${(v * 100).toFixed(0)} %)`);
  if (oil.muOverride != null) warnings.push("Viscosity fixed by muOverride; temperature iteration skipped");
  const dfl = crankDeflection(pin6, crank, peakAt.i);
  return {
    theta: THETA,
    forces: { fGas: scale(F.fGas, 1e-3), fInertia: scale(F.fInertia, 1e-3), fAxial: scale(F.fAxial, 1e-3), fRod: scale(F.fRod, 1e-3), fSide: scale(F.fSide, 1e-3), sidePeak: sidePk / 1e3, sidePeakTheta: sideTh },
    torque: { meanNm: mean, meanLbft: mean / LBFT, inst, powerKw: mean * w / 1e3, powerHp: mean * w / 745.7 },
    rod, mains, worstMain: worst,
    mainPolar: { x: scale(mw.x, 1e-3), y: scale(mw.y, 1e-3) }, mainH: scale(films[worst].h, um),
    deflection: { z: dfl.z, wV: dfl.wV, wH: dfl.wH, theta: THETA[peakAt.i] },
    limits: { binding, margins }, warnings,
    // Un-scaled arrays for rodpin.js / calc.js (N, SI): pin and rod axial forces (+ toward crank / compression), the rod-bearing
    // journal load and its film orbit (eccentricity-ratio components, block frame), and each main's load, eps and land layout.
    raw: { fPin: F.fPin, fRod: F.fRod, rodLoad: { x: scale(F.pinX, -1), y: scale(F.pinY, -1) }, rodFilm: { eps: rr.film.eps, epsX: rr.film.epsX, epsY: rr.film.epsY }, mains: mainsRaw },
  };
}
