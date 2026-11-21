// rodpin.js — wrist-pin stress, connecting-rod column buckling, rod/main bearing peak film pressure.
// Pure functions, SI (N, m, Pa). Dependency-free ES module; imports nothing from the other model files.
// All three are screening estimates for comparing settings, not substitutes for FEA.

const PI = Math.PI;
const maxOf = (a) => { let m = -Infinity; for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; };
const minOf = (a) => { let m = Infinity; for (let i = 0; i < a.length; i++) if (a[i] < m) m = a[i]; return m; };
const argmax = (a) => { let j = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[j]) j = i; return j; };

// ================================================================ wrist pin
// Floating hollow pin, d = od, k = id/od, L = pin length, b = boss length (each), a = small-end width, F = pin load.
//
// Pin load. The caller passes the force the pin transmits between piston and rod (bore-axis gas force + piston-group
// inertia, divided by cos(phi) to give the force along the rod). It is linear in F below, so every stress scales with F.
//
// (1) Bending, Kolchin / Mahle floating-pin form (as quoted in Kolchin & Demidov, "Raschet avtomobilnykh i traktornykh
//     dvigatelei", and the Mahle piston handbook):
//         sigma_b = F (L + 2b - 1.5a) / (1.2 d^3 (1 - k^4))
//     L = pin length, b = boss length each side, a = small-end (bush) width. NOTE: I could not re-verify the coefficient
//     1.2 or the exact meaning of "b" against the original text offline; the form follows the brief. A uniform-pressure
//     beam model (M = F (L - b - a/2)/4, W = pi d^3 (1-k^4)/32) gives a ~1.7x larger value for the default pin and is
//     returned as sigmaBendBeam for comparison; it is NOT used in the safety factors.
//
// (2) Ovalization stress. Kolchin's closed-form coefficients could not be re-verified offline, so this is the thin-ring
//     derivation they are fitted to: a ring of mean radius R = (d + id)/4, wall t = (d - id)/2, loaded by F/l per unit
//     length with a cos(phi) radial pressure over the 180 deg loaded by the small end (top) and by the bosses (bottom),
//     inextensible (Castigliano; slope zero at the symmetry planes). Moments (per unit length, F/l = line load):
//         M(phi) = (F R / (pi l)) [ phi sin(phi) - (1 - cos(phi)) - (4/pi - 1) ],   phi from the load axis
//         M(0) = -0.0870 F R / l, M(90 deg) = +0.0947 F R / l (the two extremes; M is monotonic between them).
//     (Cross-checked against the Fourier-series ring solution in check-rodpin.mjs.)
//     Fibre stress = K * 6 M / t^2, with the Schlaefer thick-pin correction K = 1.5 - 15 (k - 0.4)^3 as the brief
//     specifies; K is clamped at >= 1 (the empirical cubic falls below 1 for k > ~0.72, which would be non-conservative).
//     l = min(a, 2b): the section carrying the higher line load (small end F/a, bosses F/(2b)). Hoop force ignored.
//
// (3) Ovalization, diametral increase in the horizontal plane (thin ring, same derivation):
//         d_oval = (3 I_c / pi) ((1 + k)/(1 - k))^3 F / (E l),  I_c = 0.09514 (numerical integral below)
//     which has the same scaling as the Kolchin/Mahle Delta-d expression.
//
// (4) Shear at the boss/small-end gap: V = F/2 on one tube section; hollow-circle peak shear
//         tau = (4/3)(V/A)(ro^2 + ro ri + ri^2)/(ro^2 + ri^2)
// (5) Boss bearing pressure F/(2 d b); small-end (bush) pressure F/(d a) (projected areas).
//
// Combination (stated, conservative):
//   fibre at 0 deg (load plane, extreme bending fibre): biaxial, sigma_b longitudinal + sigma_oval(0) hoop, signs taken
//       aligned, sigma_e0 = sqrt(sb^2 + sb*so0 + so0^2)  (von Mises with the worse sign);
//   fibre at 90 deg (neutral axis in bending, max shear): sigma_e90 = sqrt(so90^2 + 3 tau^2).
//   combined = max(sigma_e0, sigma_e90), evaluated at the largest |F|;  sfStatic = yield / combined.
// Fatigue: all stresses are linear in F, so the equivalent stress at the governing fibre swings with F:
//   amplitude = c (Fmax - Fmin)/2, mean = c (Fmax + Fmin)/2, c = sigma_e per unit F of the governing fibre.
//   Goodman 1/sf = sa/Se + max(sm, 0)/Sut with Se = mat.fatigue, Sut = yield/0.85 (estimate).
const I_C = (() => {                       // integral of [g - mu0][2/pi - cos] over 0..pi/2, midpoint rule
  const n = 20000, mu0 = 4 / PI - 1; let s = 0;
  for (let i = 0; i < n; i++) { const p = (i + 0.5) / n * PI / 2; s += (p * Math.sin(p) - (1 - Math.cos(p)) - mu0) * (2 / PI - Math.cos(p)) * (PI / 2 / n); }
  return s;
})();
export const RING = { mu0: 4 / PI - 1, mu90: PI / 2 - 1 - (4 / PI - 1), dCoef: 3 * I_C / PI };   // moment / (F R/(pi l)); diametral coeff

export function wristPin(F, pin, mat) {
  const d = pin.od, di = pin.id, L = pin.length, a = pin.smallEndWidth, b = pin.bossLength, k = di / d;
  const K = Math.max(1, 1.5 - 15 * (k - 0.4) ** 3);
  const E = mat.E || 205e9, Sut = mat.yield / 0.85;
  // 2026-11-21 (main session): replaced the thin-ring ovalization (applied over min(a, 2b)) with the Kolchin & Demidov
  // closed forms over the full pin length, and use Kolchin's bending form with b = GAP between the bosses
  // (L - 2 bossLength), not the boss length. Coefficients written from memory of the text: verify against the book.
  //   bending   sigma_b = F (L + 2 gap - 1.5 a) / (1.2 d^3 (1 - k^4))
  //   oval, outer 0 deg   ( F/(L d)) [0.19 (2+k)(1+k)/(1-k)^2 - 1/(1-k)] K
  //   oval, inner 0 deg  -( F/(L d)) [0.19 (1+2k)(1+k)/((1-k)^2 k) + 1/(1-k)] K
  //   oval, outer 90 deg -( F/(L d)) [0.174 (2+k)(1+k)/(1-k)^2 + 0.636/(1-k)] K
  //   oval, inner 90 deg  ( F/(L d)) [0.174 (1+2k)(1+k)/((1-k)^2 k) - 0.636/(1-k)] K
  //   diametral ovalization  Delta d = 1.35 F/(E L) ((1+k)/(1-k))^3 [0.1 - (k - 0.4)^3]
  const gap = Math.max(a, L - 2 * b);
  const cb = (L + 2 * gap - 1.5 * a) / (1.2 * d ** 3 * (1 - k ** 4));
  const cbBeam = (L - b - a / 2) / 4 / (PI * d ** 3 * (1 - k ** 4) / 32);
  const f1 = (2 + k) * (1 + k) / (1 - k) ** 2, f2 = (1 + 2 * k) * (1 + k) / ((1 - k) ** 2 * k), q = K / (L * d);
  const ovals = { o0: q * (0.19 * f1 - 1 / (1 - k)), i0: -q * (0.19 * f2 + 1 / (1 - k)), o90: -q * (0.174 * f1 + 0.636 / (1 - k)), i90: q * (0.174 * f2 - 0.636 / (1 - k)) };
  // worst fibre in each plane (magnitude): 0 deg combines with bending, 90 deg with shear
  const co0 = Math.max(Math.abs(ovals.o0), Math.abs(ovals.i0)), co90 = Math.max(Math.abs(ovals.o90), Math.abs(ovals.i90));
  const A = PI / 4 * (d * d - di * di), ro = d / 2, ri = di / 2;
  const cTau = 0.5 / A * (4 / 3) * (ro * ro + ro * ri + ri * ri) / (ro * ro + ri * ri);
  const ce0 = Math.sqrt(cb * cb + cb * co0 + co0 * co0), ce90 = Math.sqrt(co90 * co90 + 3 * cTau * cTau);
  const ce = Math.max(ce0, ce90);
  const iC = argmax(F), Fc = F[iC], Fmax = Fc, Fmin = minOf(F), Fabs = Math.max(Fmax, -Fmin);
  const sa = ce * (Fmax - Fmin) / 2, sm = ce * (Fmax + Fmin) / 2;
  const sfFatigue = 1 / (sa / mat.fatigue + Math.max(sm, 0) / Sut);
  return {
    peakComp: Fmax, peakCompIdx: iC, peakTens: Math.max(0, -Fmin),
    sigmaBend: cb * Fc, sigmaBendBeam: cbBeam * Fc, sigmaOval: Math.max(co0, co90) * Fc, sigmaOval0: co0 * Fc, sigmaOval90: co90 * Fc,
    tauShear: cTau * Fc, sigmaEq: Math.max(ce0, ce90) * Fc,
    bendAmp: cb * (Fmax - Fmin) / 2, bendMean: cb * (Fmax + Fmin) / 2,
    pBoss: Fc / (2 * d * b), pSmallEnd: Fc / (d * a),
    ovalD: 1.35 * Fc / (E * L) * ((1 + k) / (1 - k)) ** 3 * (0.1 - (k - 0.4) ** 3),
    K, k, governingFibre: ce0 >= ce90 ? "0deg" : "90deg",
    sfStatic: mat.yield / (ce * Fabs), sfFatigue,
  };
}

// ================================================================ rod column
// Section: H-beam, defined in the end view (looking along the rod). Axes: y along the rod, x in the plane of crank
// rotation (swing plane), z along the crank axis.
//   beamHeight H : overall extent in x. Two flanges (rails) at the x extremes, each flangeThk (x) by flangeWidth B (z).
//   web          : spans x between the flanges, thickness webThk (z), centred.
// I_in  = I about z = bending in the swing plane (deflection in x); I_out = I about x = bending along the crank axis.
// End conditions are conventional assumptions, not measured:
//   in-plane   : pinned-pinned (small-end pin and big-end journal rotate freely in the swing plane), L_eff = c-c length;
//   out-of-plane: both ends restrained by the pin bosses / the big-end width, taken fixed-fixed, L_eff = 0.5 L.
// Critical stress: Johnson parabola below the transition slenderness lam_t = sqrt(2 pi^2 E / Sy), Euler above;
//   Johnson: s = Sy - Sy^2 lam^2/(4 pi^2 E);  Euler: s = pi^2 E/lam^2;  both equal Sy/2 at lam_t.
export function criticalStress(lam, E, Sy) {
  const lt = Math.sqrt(2 * PI * PI * E / Sy);
  return lam <= lt ? Sy - Sy * Sy * lam * lam / (4 * PI * PI * E) : PI * PI * E / (lam * lam);
}
export function rodSection(rod) {
  const H = rod.beamHeight, B = rod.flangeWidth, tf = rod.flangeThk, tw = rod.webThk, hw = Math.max(H - 2 * tf, 0);
  const area = 2 * tf * B + hw * tw;
  const arm = (H - tf) / 2;
  const Iin = 2 * (B * tf ** 3 / 12 + B * tf * arm * arm) + tw * hw ** 3 / 12;
  const Iout = 2 * tf * B ** 3 / 12 + hw * tw ** 3 / 12;
  // rod.orient "I": plates (rails) at the swing-plane edges +-x, as above. "H" (2026-11-21, Manley 14005 H-beam): the same
  // section turned 90 deg -- face plates at +-z (along the crank axis), web thin in x -- so beamHeight is the z depth,
  // flangeWidth the plate width in x, and the two second moments swap.
  if (rod.orient === "H") return { area, Iin: Iout, Iout: Iin, rIn: Math.sqrt(Iout / area), rOut: Math.sqrt(Iin / area) };
  return { area, Iin, Iout, rIn: Math.sqrt(Iin / area), rOut: Math.sqrt(Iout / area) };
}
export function rodColumn(F, rod, mat) {
  const s = rodSection(rod), iC = argmax(F), Fc = Math.max(F[iC], 0), Ft = Math.max(0, -minOf(F));
  const ax = (leff, r) => {
    const lam = leff / r, pcr = criticalStress(lam, mat.E, mat.yield) * s.area;
    return { leff, slender: lam, pcr, sf: Fc > 0 ? pcr / Fc : Infinity, regime: lam <= Math.sqrt(2 * PI * PI * mat.E / mat.yield) ? "Johnson" : "Euler" };
  };
  const inPlane = ax(rod.length, s.rIn), outPlane = ax(0.5 * rod.length, s.rOut);
  return { area: s.area, Iin: s.Iin, Iout: s.Iout, rIn: s.rIn, rOut: s.rOut, peakComp: Fc, peakCompIdx: iC, peakTens: Ft,
    sigmaComp: Fc / s.area, sigmaTens: Ft / s.area, inPlane, outPlane, governing: inPlane.sf <= outPlane.sf ? "inPlane" : "outPlane" };
}

// ================================================================ peak film pressure (short bearing)
// Steady short-bearing (Ocvirk) pressure at eccentricity ratio eps, angle theta from the max-film line:
//     p(theta, z) = A s(theta) (L^2/4 - z^2),   s = eps sin(theta) / (1 + eps cos(theta))^3,  theta in [0, pi]
// (pressure positive only on the converging half; the diverging half is cavitated at ambient). Load components
//     W_r, W_t = A (L^3/6) R * integral s (cos, sin) dtheta,   W = A L^3 R M / 6,  M = |integral s (cos, sin) dtheta|
// so A = 6 W / (L^3 R M) and p_max (at z = 0) = A s_max L^2/4 = 1.5 W s_max / (L R M).
// It uses the steady wedge shape for the whole cycle and ignores the squeeze-film shape: during fast load swings the real
// peak pressure and its angle differ (squeeze action adds pressure where the load reverses, so treat as a lower estimate
// of the transient spike). Limit eps -> 0: s ~ eps sin(theta), M -> eps pi/2, p_max -> 3W/(pi L R) = (6/pi) W/(d L).
// eps is clamped to [1e-3, 0.9995]. brg = {d, l} (one land: l is the land width and W the load that land carries).
const NT = 180, TH = Float64Array.from({ length: NT }, (_, j) => (j + 0.5) * PI / NT), SIN = TH.map(Math.sin), COS = TH.map(Math.cos);
export function peakFilmPressure(W, eps, brg) {
  const Lw = brg.l, R = brg.d / 2, out = new Float64Array(W.length), dth = PI / NT;
  for (let i = 0; i < W.length; i++) {
    const e = Math.min(Math.max(eps[i], 1e-3), 0.9995);
    let mc = 0, ms = 0, smax = 0, jm = 0;
    for (let j = 0; j < NT; j++) {
      const h = 1 + e * COS[j], s = e * SIN[j] / (h * h * h);
      mc += s * COS[j]; ms += s * SIN[j]; if (s > smax) { smax = s; jm = j; }
    }
    // parabolic refinement of the peak between grid points
    if (jm > 0 && jm < NT - 1) {
      const f = (j) => { const h = 1 + e * COS[j]; return e * SIN[j] / (h * h * h); };
      const y0 = f(jm - 1), y1 = smax, y2 = f(jm + 1), den = y0 - 2 * y1 + y2;
      if (den < 0) { const o = 0.5 * (y0 - y2) / den; smax = y1 - 0.25 * (y0 - y2) * o; }
    }
    const M = Math.hypot(mc, ms) * dth;
    out[i] = 1.5 * Math.abs(W[i]) * smax / (Lw * R * M) / 1e6;
  }
  return out;
}
export { argmax, maxOf, minOf };
