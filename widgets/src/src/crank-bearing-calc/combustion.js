// combustion.js — slider-crank volume, flame-propagation burn timing, single-zone cylinder pressure.
// Dependency-free ES module. SI inside (m, kg, s, Pa, K); angles in crank degrees, theta = 0 at firing TDC.
// Contract: ../API.md. Knock is not modelled.

const D2R = Math.PI / 180;
const N = 1440;
const STEP = 0.5;
export const THETA = Float64Array.from({ length: N }, (_, i) => -360 + STEP * i);

const R_GAS = 287;          // J/kg/K, one gas constant for charge and products (shortcut: no composition shift)
const CP_AIR = 1005;        // J/kg/K, for charge-cooling estimate
const T_WALL = 450;         // K

// ---- fuels ------------------------------------------------------------------------------------------------
// slCoef: Metghalchi-Keck form S_L0 = Bm + Bphi (phi - phim)^2 [m/s at 298 K, 1 atm] (Heywood Eq. 9.38, Table 9.2, p. 705; Heywood prints
//   the quadratic as Bm - Bphi(...)^2 with Bphi < 0, a sign slip: the curve must peak at phim, so the code adds the negative Bphi);
//   alpha = alpha0 + alphaPhi (phi-1), beta = beta0 + betaPhi (phi-1)  (Eq. 9.37a,b, pp. 704-705: alpha 2.18 - 0.8(phi-1), beta -0.16 + 0.22(phi-1),
//   stated to hold for propane, isooctane, ethanol and methanol alike).
// gas: weight of the gasoline T/p-exponent fit alpha_g = 2.4 - 0.271 phi^3.51, beta_g = -0.357 + 0.14 phi^2.77 (Heywood Eq. 9.39, p. 705,
//   reference gasoline MW 107, H/C 1.69; Rhodes & Keck). 1 for gasoline, 0 for the alcohols, mass-weighted in blends.
// Table 9.2 (p. 705), cm/s -> m/s: gasoline phim 1.21, Bm 30.5, Bphi -55; isooctane 1.13, 26.3, -85; ethanol 1.10, 40.0, -200;
//   methanol 1.11, 36.9, -140 (Bphi -1.405 here is the Metghalchi-Keck 1982 value, -140 rounded in Heywood).
// 91/93 use the gasoline row (changed from isooctane, 2026-11-21: Heywood gives gasoline its own fit, ~15 % faster than isooctane at phi 1.2).
// octane = RON (as in project.py "on"); not used by the combustion model. hvap in J/kg.
const GAS_SL = { Bm: 0.305, Bphi: -0.55, phim: 1.21, alpha: 2.18, beta: -0.16, alphaPhi: -0.8, betaPhi: 0.22, gas: 1 };
const ETOH_SL = { Bm: 0.40, Bphi: -2.0, phim: 1.10, alpha: 2.18, beta: -0.16, alphaPhi: -0.8, betaPhi: 0.22, gas: 0 };   // Heywood Table 9.2 ethanol row, p. 705
const MEOH_SL = { Bm: 0.369, Bphi: -1.405, phim: 1.11, alpha: 2.18, beta: -0.16, alphaPhi: -0.8, betaPhi: 0.22, gas: 0 };

const GAS = { lhv: 43.0e6, afrSt: 14.7, hvap: 350e3 };
const ETOH = { lhv: 26.8e6, afrSt: 8.95, hvap: 920e3 };
const blend = (w) => {   // w = ethanol mass fraction; mass-weighted properties and flame coefficients
  const o = { lhv: 0, afrSt: 0, hvap: 0 }, sl = {};
  for (const k in o) o[k] = w * ETOH[k] + (1 - w) * GAS[k];
  for (const k in GAS_SL) sl[k] = w * ETOH_SL[k] + (1 - w) * GAS_SL[k];
  return { ...o, slCoef: sl };
};

export const FUELS = {
  "91":  { label: "91 gasoline (AKI)", ...GAS, octane: 96, slCoef: { ...GAS_SL } },
  "93":  { label: "93 gasoline (AKI)", ...GAS, octane: 98, slCoef: { ...GAS_SL } },   // same flame data as 91
  // E60 (v0.4): 60 % ethanol by volume = 0.614 by mass (0.6 x 0.789 / (0.6 x 0.789 + 0.4 x 0.745), densities kg/L; the same arithmetic gives
  // E85 = 0.857). Mass blend of the verified ethanol and gasoline rows, like E85. octane is an interpolated RON, not used by the model.
  "E60": { label: "E60 (60 % ethanol by volume, 0.614 by mass)", ...blend(0.614), octane: 102 },
  "E85": { label: "E85 (85 % ethanol by volume, 0.857 by mass)", ...blend(0.857), octane: 106 },
  "E100": { label: "E100 ethanol", ...ETOH, octane: 109, slCoef: { ...ETOH_SL } },
  "M100": { label: "M100 methanol", lhv: 19.9e6, afrSt: 6.43, hvap: 1100e3, octane: 109, slCoef: { ...MEOH_SL } },
};

// ---- calibration constants (see calibration block at the bottom of the check script) --------------------------
// Reference case: 91, lambda 0.85, 3000 rpm, MAP 100 kPa, 5 % dilution, tCharge 318 K, tumble 1, q 1, 1FZ, spark 25 BTDC.
const KD = 4.102;    // ignition-delay constant: t_d = KD nu^(1/3) L^(2/3) / (S_L S_T)^(2/3), L = TDC clearance height;
//   S_T enters (as a geometric mean with S_L) so turbulence shortens the kernel stage and delay in degrees does not run away with rpm
const KB = 0.4056;   // rapid-burn constant:     t_b = KB (bore/2) / S_T,  S_T = Zimont (see cylinderPressure)
export const CAL = { get KD() { return KD; }, get KB() { return KB; } };

// ---- geometry -----------------------------------------------------------------------------------------------
// g: {bore, stroke, rod, cr, offset} m. offset = combined desaxe + pin offset: sin(phi) = (r sin(th) - e)/l.
// Piston height above crank axis x = r cos(th) + l cos(phi). V = vc + A (xTdc - x), xTdc = max x = sqrt((l+r)^2 - e^2).
// dV is dV/dtheta in m^3/rad (analytic): A r sin(th+phi)/cos(phi).
function kin(g) {
  const r = g.stroke / 2, l = g.rod, e = g.offset || 0, A = Math.PI * g.bore * g.bore / 4;
  const xTdc = Math.sqrt((l + r) ** 2 - e * e), xBdc = Math.sqrt((l - r) ** 2 - e * e);
  const vd = A * (xTdc - xBdc), vc = vd / (g.cr - 1);
  return {
    vd, vc, A, r, l, e,
    V(th) { const s = (r * Math.sin(th) - e) / l; return vc + A * (xTdc - r * Math.cos(th) - l * Math.sqrt(1 - s * s)); },
    dV(th) { const s = (r * Math.sin(th) - e) / l, c = Math.sqrt(1 - s * s); return A * r * Math.sin(th + Math.asin(s)) / c; },
  };
}

export function geometry(g) {
  const k = kin(g), V = new Float64Array(N), dV = new Float64Array(N);
  for (let i = 0; i < N; i++) { const t = THETA[i] * D2R; V[i] = k.V(t); dV[i] = k.dV(t); }
  return { vd: k.vd, vc: k.vc, area: k.A, V, dV };
}

// ---- laminar flame speed -------------------------------------------------------------------------------------
// Metghalchi-Keck: S_L = S_L0(phi) (Tu/298)^alpha (p/101325)^beta (1 - 2.06 x^0.77)
function laminarSpeed(c, phi, Tu, p, xDil) {
  const sl0 = c.Bm + c.Bphi * (phi - c.phim) ** 2;
  const g = c.gas || 0;   // gasoline-form exponents (Eq. 9.39) weight; the rest use Eq. 9.37
  const a = (1 - g) * (c.alpha + c.alphaPhi * (phi - 1)) + g * (2.4 - 0.271 * phi ** 3.51);
  const b = (1 - g) * (c.beta + c.betaPhi * (phi - 1)) + g * (-0.357 + 0.14 * phi ** 2.77);
  return Math.max(sl0, 0.02) * (Tu / 298) ** a * (p / 101325) ** b * (1 - 2.06 * xDil ** 0.77);
}

// Heywood p. 683: measured mass-fraction-burned curves are fitted with a = 5, m = 2 (was a = 6.9, the "99.9 % at the end" convention).
// The burn law is parameterised by the 10-90 % duration, so a only rescales the total duration dthTot; angles and CA10/50/90 are unchanged.
const WIEBE_A = 5, WIEBE_M = 2;
// Wiebe fractions where x = 10 % and 90 % in u = (th - th0)/dth_total
const U10 = (-Math.log(0.9) / WIEBE_A) ** (1 / (WIEBE_M + 1));
const U90 = (-Math.log(0.1) / WIEBE_A) ** (1 / (WIEBE_M + 1));

const gammaT = (T) => Math.min(1.40, 1.38 - 0.12 * (T - 300) / 2200);   // 1.38 at 300 K, 1.26 at 2500 K

// ---- cylinder pressure ---------------------------------------------------------------------------------------
// op: {fuel, lambda, dilution, mixing, tumble, spark, rpm, map, tCharge, ve, backRatio, ivc, evo}
export function cylinderPressure(op, g) {
  const f = FUELS[op.fuel], K = kin(g), w = op.rpm * Math.PI / 30, rpmDeg = 6 * op.rpm;   // rad/s, deg/s
  const lam = op.lambda, phi = 1 / lam, dil = op.dilution, q = op.mixing, B = g.bore;
  const Sp = 2 * g.stroke * op.rpm / 60;

  // Trapped mass. VE is referenced to manifold density at tCharge on the swept volume (air only).
  // Residual/EGR displaces fresh charge (2026-11-21). VE (cam curve or manual) is read as fresh-air VE at the reference
  // dilution X_REF = 5 % (the default, and close to the stock-cam residual estimate), so fresh air scales by
  // (1 - x)/(1 - X_REF) and total trapped mass stays near what the cylinder holds. At 5 % nothing changes.
  const X_REF = 0.05;
  const mAir = op.ve * op.map / (R_GAS * op.tCharge) * K.vd * (1 - dil) / (1 - X_REF);
  const mFuel = mAir / (lam * f.afrSt);
  const mTot = (mAir + mFuel) / (1 - dil);          // residual/EGR mass rides on top of the fresh charge
  // Charge cooling: 35 % of the fuel's heat of vaporisation is drawn from the air stream (rest from walls/ports);
  // the cooled charge then mixes with hot residual (900 K) at the dilution fraction. tCharge is the charge-air
  // temperature BEFORE these two effects.
  const tMix = op.tCharge - 0.35 * mFuel * f.hvap / (mAir * CP_AIR);
  const Tivc = (1 - dil) * tMix + dil * 900;

  const i0 = Math.round((op.ivc + 360) / STEP), i1 = Math.round((op.evo + 360) / STEP);
  const Vivc = K.V(THETA[i0] * D2R);
  const pIvc = mTot * R_GAS * Tivc / Vivc;

  // Heat release totals. Rich mixtures: O2-limited, excess fuel only partly oxidised to CO/H2, so release falls
  // 1.2 % of fuel energy per 1 % of enrichment (chemistry gives ~1.4, H2 preference and water-gas shift less).
  const etaLam = lam >= 1 ? 1 : Math.max(0.5, 1 - 1.2 * (1 - lam));
  const etaQ = 0.98 - 0.10 * (1 - q);               // mixing quality: 0.98 at q=1, 0.93 at q=0.5
  const combEff = etaLam * etaQ;
  const Qtot = mFuel * f.lhv * combEff;

  const vis = (T) => 1.458e-6 * T ** 1.5 / (T + 110.4);   // Sutherland, air
  const uPrime = 0.75 * Sp * op.tumble;

  // Closed-cycle integrator. burn = null -> motored (compression stage used to find spark-time unburned state).
  const Pm = (V) => pIvc * (Vivc / V) ** 1.3;       // motored-pressure reference for Woschni (shortcut: polytropic)
  const Cref = K.vd * Tivc / (pIvc * Vivc);
  function rhs(th, p, burn) {                       // dp/dtheta [Pa/rad]; th in rad
    const V = K.V(th), dV = K.dV(th), T = p * V / (mTot * R_GAS), gm = gammaT(T);
    const comb = burn && th / D2R > burn.th0;
    const wv = 2.28 * Sp + (comb ? 3.24e-3 * Cref * (p - Pm(V)) : 0);   // Woschni, no swirl: C1 = 2.28
    const h = 3.26 * B ** -0.2 * (p / 1e3) ** 0.8 * T ** -0.55 * Math.max(wv, 0.1) ** 0.8;
    const Aw = Math.PI * B * B / 2 + 4 * V / B;     // flat head + piston + liner
    const dQw = h * Aw * (T - T_WALL) / w;          // J/rad
    let dQc = 0;
    if (comb) {
      const u = (th / D2R - burn.th0) / burn.dthTot;
      dQc = Qtot * WIEBE_A * (WIEBE_M + 1) * u ** WIEBE_M * Math.exp(-WIEBE_A * u ** (WIEBE_M + 1)) / burn.dthTot / D2R;
    }
    return ((gm - 1) * (dQc - dQw) - gm * p * dV) / V;
  }
  function integrate(burn) {
    const p = new Float64Array(N), h = STEP * D2R;
    p[i0] = pIvc;
    for (let i = i0; i < i1; i++) {                 // Heun (RK2)
      const th = THETA[i] * D2R, k1 = rhs(th, p[i], burn), k2 = rhs(th + h, p[i] + h * k1, burn);
      p[i + 1] = p[i] + h * 0.5 * (k1 + k2);
    }
    return p;
  }

  // Burn timing: unburned state at spark from the compression computed so far.
  const thS = -op.spark, mot = integrate(null);
  const fi = (thS + 360) / STEP, ia = Math.min(Math.max(Math.floor(fi), i0), i1 - 1), fr = fi - ia;
  const pS = mot[ia] + (mot[ia + 1] - mot[ia]) * fr;
  const VS = K.V(thS * D2R), TuS = pS * VS / (mTot * R_GAS);
  const sl = laminarSpeed(f.slCoef, phi, TuS, pS, dil);
  // Zimont turbulent flame speed S_T = A u'^(3/4) S_L^(1/2) alpha_u^(-1/4) L_t^(1/4), floored at S_L.
  // alpha_u = k/(rho cp) of the unburned gas at the spark-time state (air-like k(T), cp 1100), so alpha ~ 1/p: boost
  // thins the flame (delta_L = alpha_u/S_L) and raises S_T roughly as p^0.15 even though S_L falls.
  // A = 0.5 (Zimont), L_t = full TDC clearance height vc/area (no fraction). KB absorbs any error in A.
  const L = K.vc / K.A;
  const alphaU = 0.0262 * (TuS / 300) ** 0.8 / (pS / (R_GAS * TuS) * 1100);
  const st = Math.max(sl, 0.5 * uPrime ** 0.75 * sl ** 0.5 * alphaU ** -0.25 * L ** 0.25);
  const deltaL = alphaU / sl;
  const nu = vis(TuS) / (pS / (R_GAS * TuS));
  const delay = rpmDeg * KD * nu ** (1 / 3) * L ** (2 / 3) / (sl * st) ** (2 / 3);   // uses the Zimont S_T     // spark -> 10 %, deg
  const burnDur = rpmDeg * KB * (B / 2) / st / (0.5 + 0.5 * q);                // 10 -> 90 %, deg
  const dthTot = burnDur / (U90 - U10);
  const ca10 = thS + delay, th0 = ca10 - U10 * dthTot;
  const burn = { th0, dthTot };

  const pc = integrate(burn);
  const p = new Float64Array(N), xb = new Float64Array(N);
  const pExh = op.backRatio * op.map;
  for (let i = 0; i < N; i++) {
    const t = THETA[i];
    if (i < i0) p[i] = op.map;
    else if (i <= i1) p[i] = pc[i];
    else p[i] = pExh + (pc[i1] - pExh) * Math.min(1, Math.max(0, 1 - (t - op.evo) / 60));   // 60 deg blowdown ramp
    const u = (t - th0) / dthTot;
    xb[i] = u > 0 ? 1 - Math.exp(-WIEBE_A * u ** (WIEBE_M + 1)) : 0;
  }
  let ip = 0, W = 0;
  for (let i = 0; i < N; i++) {
    if (p[i] > p[ip]) ip = i;
    const j = (i + 1) % N;
    W += 0.5 * (p[i] + p[j]) * (K.V(THETA[j] * D2R) - K.V(THETA[i] * D2R));
  }
  const at = (x) => th0 + dthTot * (-Math.log(1 - x) / WIEBE_A) ** (1 / (WIEBE_M + 1));
  return {
    p, xb, mTrapped: mTot, mFuel, ca10, ca50: at(0.5), ca90: at(0.9), delay, burn: burnDur,
    pmax: p[ip], thetaPmax: THETA[ip], imepGross: W / K.vd, sl, uPrime, st, alphaU, deltaL, combEff,
  };
}

// Spark advance (deg BTDC) maximising imepGross, golden-section on [0, 50]. tol (deg, default 0.02) is the final bracket width.
export function findMBT(op, g, tol = 0.02) {
  const J = (s) => cylinderPressure({ ...op, spark: s }, g).imepGross, gr = (Math.sqrt(5) - 1) / 2;
  let a = 0, b = 50, c = b - gr * (b - a), d = a + gr * (b - a), fc = J(c), fd = J(d);
  while (b - a > tol) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = J(c); }
    else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = J(d); }
  }
  return 0.5 * (a + b);
}
