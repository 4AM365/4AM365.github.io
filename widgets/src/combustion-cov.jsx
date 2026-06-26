// Combustion-stability (CoV) calculator — blog widget module.
//
// GENERATED from index.html by tools/sync-widget.mjs. Do not edit by hand —
// edit index.html (the canonical standalone app) and re-run the sync.

import React, { useState, useMemo, useEffect, useRef, useContext } from "react";

// =============================================================================
// Combustion-stability (CoV) model — client-side port of
// emu-black-tuning-notes/tools/emub_analysis/cov.py.
// Parity with the Python is asserted by tools/verify-parity.mjs against a real
// log. Keep this prelude in step with that test if you touch the math.
// -----------------------------------------------------------------------------
// We cannot compute textbook COV_imep (std/mean of indicated mean effective
// pressure — Heywood §9.4.3) because EMU logs carry no cylinder-pressure trace.
// Two physical proxies are derived instead:
//   CoV_RPM      crank-speed jitter: std(RPM - 1 s trend)/mean(RPM). Drive/idle
//                QUALITY, NOT COV_imep — at 25 Hz a 6-cyl fires ~50 Hz (above
//                Nyquist) so per-firing content aliases in. Banded vs Heywood's
//                2-5% COV_imep driveability guide for orientation only.
//   knock index  operating-point-detrended cycle-to-cycle scatter of
//                'Knock voltage peak cyl N' on no-knock samples (binned
//                RPM 250 x MAP 10 kPa, mean-subtracted). A COMPARATIVE metric
//                (region / cylinder / tune-vs-tune), not pass/failed vs 2-5%.
// =============================================================================

const DEFAULT_REGIONS = {
  idle:      { label: "Idle",      rpm_min: 550,  rpm_max: 1300, map_min: 0,   map_max: 70,  tps_min: 0,  tps_max: 5,   primary: "rpm" },
  cruise:    { label: "Cruise",    rpm_min: 1300, rpm_max: 3500, map_min: 0,   map_max: 100, tps_min: 3,  tps_max: 35,  primary: "rpm" },
  high_load: { label: "High load", rpm_min: 2000, rpm_max: 8000, map_min: 140, map_max: 400, tps_min: 60, tps_max: 100, primary: "knock" },
};
const COV_GOOD = 2.0;          // <2 % smooth (Heywood COV_imep driveability band)
const COV_MARGINAL = 5.0;      // 2-5 % marginal; >5 % intolerable in production
const RPM_DETREND_WINDOW_S = 1.0;
const KNOCK_RPM_BIN = 250, KNOCK_MAP_BIN = 10;
const MIN_CELL_COUNT = 8, MIN_REGION_SAMPLES = 50;

// pandas Series.std() is sample std (ddof=1) — match it so numbers line up.
function sampleStd(a) {
  const n = a.length;
  if (n < 2) return NaN;
  let m = 0; for (let i = 0; i < n; i++) m += a[i]; m /= n;
  let s = 0; for (let i = 0; i < n; i++) { const d = a[i] - m; s += d * d; }
  return Math.sqrt(s / (n - 1));
}
function mean(a) { let m = 0; for (let i = 0; i < a.length; i++) m += a[i]; return a.length ? m / a.length : NaN; }
function median(a) {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y), h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
function covVerdict(cov) {
  if (cov == null || Number.isNaN(cov)) return "n/a";
  if (cov < COV_GOOD) return "smooth";
  if (cov < COV_MARGINAL) return "marginal";
  return "rough";
}

// Sample rate from the median TIME step.
function rateHz(cols) {
  const t = cols.TIME;
  if (!t || t.length < 3) return 25.0;
  const d = []; for (let i = 1; i < t.length; i++) { const dt = t[i] - t[i - 1]; if (dt > 0) d.push(dt); }
  const dt = median(d);
  return dt && dt > 0 ? Math.round((1 / dt) * 100) / 100 : 25.0;
}

// Centered rolling-mean high-pass on RPM → residual jitter. Mirrors pandas
// rolling(win, center=True, min_periods=win): NaN until a full window exists.
function rpmResidual(rpm, rate) {
  const n = rpm.length, res = new Array(n).fill(NaN);
  if (!rpm || n === 0) return res;
  let win = Math.max(3, Math.round(RPM_DETREND_WINDOW_S * rate));
  if (win % 2 === 0) win += 1;            // odd window stays centered
  const half = (win - 1) / 2;
  // prefix sums for an O(n) centered mean
  const pre = new Array(n + 1); pre[0] = 0;
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + rpm[i];
  for (let i = half; i < n - half; i++) {
    const sum = pre[i + half + 1] - pre[i - half];
    res[i] = rpm[i] - sum / win;
  }
  return res;
}

// Per-cylinder operating-point-detrended knock-voltage residual fraction.
// Returns { "1": Float[](NaN where undefined), ... } or null if no knock data.
function knockResidualByCyl(cols, colNames) {
  const cylCols = colNames.filter((c) => c.startsWith("Knock voltage peak cyl"));
  if (!cylCols.length || !cols.RPM || !cols.MAP) return null;
  const n = cols.RPM.length;

  // no-knock mask: Knocking cylinders == 0 (if present) AND per-cyl retard ~0.
  const retardCols = colNames.filter((c) => c.startsWith("Knock ign retard cyl"));
  const noKnock = new Array(n).fill(true);
  if (cols["Knocking cylinders"]) {
    const kc = cols["Knocking cylinders"];
    for (let i = 0; i < n; i++) if (!(((kc[i] || 0) === 0))) noKnock[i] = false;
  }
  for (const rc of retardCols) {
    const r = cols[rc];
    for (let i = 0; i < n; i++) if (!(Math.abs(r[i] || 0) < 0.01)) noKnock[i] = false;
  }

  const rpmBin = new Array(n), mapBin = new Array(n);
  for (let i = 0; i < n; i++) { rpmBin[i] = Math.floor(cols.RPM[i] / KNOCK_RPM_BIN); mapBin[i] = Math.floor(cols.MAP[i] / KNOCK_MAP_BIN); }

  const out = {};
  for (const col of cylCols) {
    const raw = cols[col];
    // valid sample := no-knock AND positive (drops dead/zero cylinders, e.g. 7-8 on a 2JZ)
    const valid = new Array(n).fill(false);
    let validCount = 0;
    for (let i = 0; i < n; i++) { if (noKnock[i] && raw[i] > 0 && !Number.isNaN(raw[i])) { valid[i] = true; validCount++; } }
    if (validCount < MIN_CELL_COUNT) continue;

    const sum = new Map(), cnt = new Map();
    for (let i = 0; i < n; i++) {
      if (!valid[i]) continue;
      const k = rpmBin[i] + "|" + mapBin[i];
      sum.set(k, (sum.get(k) || 0) + raw[i]);
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    const resid = new Array(n).fill(NaN);
    for (let i = 0; i < n; i++) {
      if (!valid[i]) continue;
      const k = rpmBin[i] + "|" + mapBin[i];
      const c = cnt.get(k), m = sum.get(k) / c;
      if (c >= MIN_CELL_COUNT && m > 0) resid[i] = (raw[i] - m) / m;
    }
    out[col.split(" ").pop()] = resid;
  }
  return Object.keys(out).length ? out : null;
}

function regionMask(cols, r) {
  const n = (cols.RPM || cols.MAP || cols.TPS || []).length;
  const m = new Array(n).fill(true);
  const between = (arr, lo, hi) => { if (!arr) return; for (let i = 0; i < n; i++) if (!(arr[i] >= lo && arr[i] <= hi)) m[i] = false; };
  between(cols.RPM, r.rpm_min, r.rpm_max);
  between(cols.MAP, r.map_min, r.map_max);
  between(cols.TPS, r.tps_min, r.tps_max);
  return m;
}

function computeCov(cols, colNames, regions) {
  regions = regions || DEFAULT_REGIONS;
  const rate = rateHz(cols);
  const rpmRes = cols.RPM ? rpmResidual(cols.RPM, rate) : null;
  const knockByCyl = knockResidualByCyl(cols, colNames);

  const out = [];
  for (const key of Object.keys(regions)) {
    const r = regions[key];
    const mask = regionMask(cols, r);
    let nSamp = 0; for (let i = 0; i < mask.length; i++) if (mask[i]) nSamp++;

    const entry = {
      key, label: r.label, primary: r.primary, samples: nSamp,
      low_confidence: nSamp < MIN_REGION_SAMPLES,
      bounds: { rpm_min: r.rpm_min, rpm_max: r.rpm_max, map_min: r.map_min, map_max: r.map_max, tps_min: r.tps_min, tps_max: r.tps_max },
      cov_rpm_pct: null, knock_index_pct: null, knock_by_cyl: {}, mean_rpm: null,
    };

    if (cols.RPM && nSamp >= 2) {
      const reg = []; for (let i = 0; i < mask.length; i++) if (mask[i]) reg.push(cols.RPM[i]);
      entry.mean_rpm = Math.round(mean(reg));
    }

    // CoV_RPM — Heywood-banded jitter proxy
    if (rpmRes && nSamp >= MIN_REGION_SAMPLES) {
      const res = [], rpmReg = [];
      for (let i = 0; i < mask.length; i++) if (mask[i]) { rpmReg.push(cols.RPM[i]); if (!Number.isNaN(rpmRes[i])) res.push(rpmRes[i]); }
      const mRpm = mean(rpmReg);
      if (res.length >= MIN_REGION_SAMPLES && mRpm > 0)
        entry.cov_rpm_pct = round2(sampleStd(res) / mRpm * 100);
    }

    // Knock scatter index — comparative, per cylinder + pooled
    if (knockByCyl) {
      const pooled = [];
      for (const cyl of Object.keys(knockByCyl).sort()) {
        const arr = knockByCyl[cyl], res = [];
        for (let i = 0; i < mask.length; i++) if (mask[i] && !Number.isNaN(arr[i])) res.push(arr[i]);
        if (res.length >= MIN_REGION_SAMPLES) { entry.knock_by_cyl[cyl] = round2(sampleStd(res) * 100); for (const v of res) pooled.push(v); }
      }
      if (pooled.length) entry.knock_index_pct = round2(sampleStd(pooled) * 100);
    }

    entry.cov_pct = entry.cov_rpm_pct;            // headline tracks CoV_RPM only
    entry.verdict = covVerdict(entry.cov_rpm_pct);
    out.push(entry);
  }
  return { rate_hz: rate, knock_available: !!knockByCyl, band: { good: COV_GOOD, marginal: COV_MARGINAL }, regions: out };
}
const round2 = (x) => Math.round(x * 100) / 100;

// ---- CSV parsing (semicolon-delimited EMU Black export, UTF-8/UTF-16) -------
function decodeBuffer(buf) {
  const b = new Uint8Array(buf);
  let label = "utf-8";
  if (b[0] === 0xff && b[1] === 0xfe) label = "utf-16le";
  else if (b[0] === 0xfe && b[1] === 0xff) label = "utf-16be";
  return new TextDecoder(label).decode(buf);
}
// Parse only the columns the model needs (TIME/RPM/MAP/TPS + knock channels).
function parseEmuCsv(text) {
  const lines = text.split(/\r\n|\r|\n/);
  let h = 0; while (h < lines.length && lines[h].trim() === "") h++;
  const header = lines[h].split(";").map((s) => s.trim());
  const want = new Set(["TIME", "RPM", "MAP", "TPS", "Knocking cylinders"]);
  const keep = [];
  header.forEach((name, idx) => {
    if (want.has(name) || name.startsWith("Knock voltage peak cyl") || name.startsWith("Knock ign retard cyl")) keep.push({ name, idx });
  });
  const cols = {}, colNames = keep.map((k) => k.name);
  for (const k of keep) cols[k.name] = [];
  for (let i = h + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "" || line.trim() === "") continue;
    const f = line.split(";");
    for (const k of keep) { const v = parseFloat(f[k.idx]); cols[k.name].push(Number.isNaN(v) ? NaN : v); }
  }
  return { cols, colNames, rows: cols.TIME ? cols.TIME.length : (cols.RPM ? cols.RPM.length : 0) };
}

// ---- self-test (fails loudly in console if the math regresses) --------------
(function selfTest() {
  // constant RPM → zero jitter
  const flat = { RPM: new Array(300).fill(800), MAP: new Array(300).fill(30), TPS: new Array(300).fill(0), TIME: Array.from({ length: 300 }, (_, i) => i * 0.04) };
  const r = computeCov(flat, ["TIME", "RPM", "MAP", "TPS"]);
  console.assert(r.rate_hz === 25, "rate from 0.04 s step should be 25 Hz, got " + r.rate_hz);
  const idle = r.regions.find((x) => x.key === "idle");
  console.assert(idle.cov_rpm_pct === 0, "flat RPM → CoV_RPM 0, got " + idle.cov_rpm_pct);
  console.assert(!r.knock_available, "no knock cols → knock unavailable");
  // sampleStd matches a hand value: std([1,2,3,4]) ddof1 = 1.290994...
  console.assert(Math.abs(sampleStd([1, 2, 3, 4]) - 1.2909944487358056) < 1e-9, "sampleStd ddof=1");
  // knock residual: two cells, perfectly flat within cell → zero scatter
  const N = 200;
  const kc = { RPM: [], MAP: [], TPS: [], TIME: [], "Knock voltage peak cyl 1": [], "Knock ign retard cyl 1": [], "Knocking cylinders": [] };
  for (let i = 0; i < N; i++) { kc.RPM.push(i < 100 ? 900 : 1600); kc.MAP.push(30); kc.TPS.push(0); kc.TIME.push(i * 0.04); kc["Knock voltage peak cyl 1"].push(i < 100 ? 0.5 : 1.0); kc["Knock ign retard cyl 1"].push(0); kc["Knocking cylinders"].push(0); }
  const rk = computeCov(kc, Object.keys(kc), { idle: { ...DEFAULT_REGIONS.idle, rpm_min: 800, rpm_max: 2000 } });
  console.assert(rk.knock_available, "knock cols present → available");
  console.assert(rk.regions[0].knock_index_pct === 0, "flat-within-cell knock → 0 scatter, got " + rk.regions[0].knock_index_pct);
})();

// =============================================================================
// Theme — light & dark; inherits the host Quartz blog (saved-theme/themechange),
// standalone falls back to the OS preference.
// =============================================================================
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const THEMES = {
  dark:  { bg: "#14101e", panel: "#1e1830", panel2: "#272040", ink: "#f5f3fc", inkSoft: "#9b95b5", line: "#3a3358",
           accent: "#a78bfa", good: "#4ade80", marginal: "#fbbf24", rough: "#f87171", knock: "#38bdf8", mono: MONO },
  light: { bg: "#f7f6fb", panel: "#ffffff", panel2: "#f1eefa", ink: "#1a1730", inkSoft: "#6b6688", line: "#d8d2ec",
           accent: "#7c3aed", good: "#16a34a", marginal: "#d97706", rough: "#dc2626", knock: "#0284c7", mono: MONO },
};
const ThemeCtx = React.createContext(THEMES.dark);
const useC = () => useContext(ThemeCtx);
const vColor = (C, v) => v === "smooth" ? C.good : v === "marginal" ? C.marginal : v === "rough" ? C.rough : C.inkSoft;

// =============================================================================
// Small UI pieces
// =============================================================================
function Section({ title, sub, children }) {
  const C = useC();
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
function NumCell({ value, onChange }) {
  const C = useC();
  return (
    <input type="number" value={value}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      style={{ width: 64, background: C.bg, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 6,
        padding: "4px 6px", fontFamily: C.mono, fontSize: 12.5, textAlign: "center" }} />
  );
}

// Heywood band bar with a marker at the region's CoV_RPM (0..7% scale).
function BandBar({ cov }) {
  const C = useC();
  const pos = cov == null ? null : Math.min((cov / 7) * 100, 99);
  return (
    <div style={{ margin: "12px 0 4px" }}>
      <div style={{ position: "relative", height: 8, borderRadius: 4,
        background: `linear-gradient(90deg, ${C.good} 0%, ${C.good} 28.5%, ${C.marginal} 28.5%, ${C.marginal} 71.4%, ${C.rough} 71.4%)` }}>
        {pos != null && <div style={{ position: "absolute", top: -4, left: `${pos}%`, width: 2, height: 16, background: C.ink, borderRadius: 1 }} />}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.inkSoft, fontFamily: C.mono, marginTop: 2 }}>
        <span>0</span><span>2% smooth</span><span>5%</span><span>7%+</span>
      </div>
    </div>
  );
}

function KnockBars({ byCyl, pooled }) {
  const C = useC();
  const keys = Object.keys(byCyl);
  if (!keys.length) return null;
  const maxv = Math.max(...keys.map((k) => byCyl[k]));
  const worst = keys.reduce((a, b) => byCyl[a] >= byCyl[b] ? a : b);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>
        <span>Knock scatter index (per cyl, comparative)</span>
        <span style={{ fontFamily: C.mono, color: C.knock }}>pooled {pooled != null ? pooled.toFixed(1) : "—"}%</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {keys.map((c) => (
          <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: C.mono }}>
            <span style={{ color: C.inkSoft, width: 38 }}>cyl {c}</span>
            <span style={{ flex: 1, height: 7, background: C.panel2, borderRadius: 4, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${(byCyl[c] / maxv) * 100}%`, background: c === worst ? C.marginal : C.knock, borderRadius: 4 }} />
            </span>
            <span style={{ width: 46, textAlign: "right", color: C.ink }}>{byCyl[c].toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegionCard({ reg }) {
  const C = useC();
  const v = reg.verdict, col = vColor(C, v);
  const covTxt = reg.cov_rpm_pct == null ? "—" : reg.cov_rpm_pct.toFixed(2) + "%";
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${col}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{reg.label}</span>
        <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: col, background: col + "22",
          border: `1px solid ${col}`, borderRadius: 20, padding: "2px 9px", textTransform: "uppercase" }}>{v}</span>
      </div>
      <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>CoV<sub>RPM</sub> — crank-speed jitter</div>
      <div style={{ fontFamily: C.mono, fontSize: 32, fontWeight: 700, color: col, lineHeight: 1.1 }}>{covTxt}</div>
      <BandBar cov={reg.cov_rpm_pct} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 8, marginTop: 8, borderTop: `1px solid ${C.line}` }}>
        <span style={{ color: C.inkSoft }}>Mean RPM</span><span style={{ fontFamily: C.mono, color: C.ink }}>{reg.mean_rpm ?? "—"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span style={{ color: C.inkSoft }}>Samples in region</span><span style={{ fontFamily: C.mono, color: C.ink }}>{reg.samples.toLocaleString()}</span>
      </div>
      {reg.knock_index_pct != null && <KnockBars byCyl={reg.knock_by_cyl} pooled={reg.knock_index_pct} />}
      {reg.low_confidence && (
        <div style={{ marginTop: 10, fontSize: 11, color: C.marginal, background: C.marginal + "1a", border: `1px solid ${C.marginal}`, borderRadius: 6, padding: "6px 9px" }}>
          ⚠ Only {reg.samples.toLocaleString()} samples in this region — indicative only.
        </div>
      )}
    </div>
  );
}

// =============================================================================
// App
// =============================================================================
function App() {
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

  const [regions, setRegions] = useState(() => structuredClone(DEFAULT_REGIONS));
  const [data, setData] = useState(null);     // { cols, colNames, rows, filename }
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState(false);

  const result = useMemo(() => data ? computeCov(data.cols, data.colNames, regions) : null, [data, regions]);

  const onFile = (file) => {
    if (!file) return;
    setStatus(`Parsing ${file.name} (${(file.size / 1048576).toFixed(1)} MB)…`);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = decodeBuffer(reader.result);
        const parsed = parseEmuCsv(text);
        if (!parsed.cols.RPM) { setStatus("No RPM column found — is this an EMU Black CSV?"); return; }
        setData({ ...parsed, filename: file.name });
        setStatus("");
      } catch (err) { setStatus("Parse error: " + err.message); }
    };
    reader.onerror = () => setStatus("Could not read file.");
    reader.readAsArrayBuffer(file);
  };

  const setBound = (key, field, val) => setRegions((r) => ({ ...r, [key]: { ...r[key], [field]: val } }));
  const resetRegions = () => setRegions(structuredClone(DEFAULT_REGIONS));

  const fileInput = useRef(null);
  const COLS = ["rpm_min", "rpm_max", "map_min", "map_max", "tps_min", "tps_max"];

  return (
    <ThemeCtx.Provider value={C}>
    <div ref={rootRef} style={{ background: C.bg, color: C.ink, colorScheme: dark ? "dark" : "light",
      minHeight: embedded ? "auto" : "100vh", padding: embedded ? "4px 0 0" : "22px 18px",
      fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {!embedded && <h1 style={{ fontSize: 24, margin: "0 0 2px" }}>Combustion-Stability (CoV) Calculator</h1>}
        {!embedded && (
          <p style={{ color: C.inkSoft, fontSize: 13.5, margin: "0 0 16px", maxWidth: 820 }}>
            Drop an ECUMaster EMU Black CSV log to read combustion-stability proxies per load region.
            Everything runs in your browser — the file never leaves your machine.
          </p>
        )}

        <Section title="How this reads CoV"
          sub="EMU logs carry no cylinder-pressure trace, so true COV_imep (Heywood §9.4.3) is not computable. Two physical proxies are derived instead.">
          <div style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.7 }}>
            <b style={{ color: C.ink }}>CoV<sub>RPM</sub></b> — <span style={{ fontFamily: C.mono }}>std(RPM − 1 s trend) / mean RPM</span>:
            detrended crank-speed jitter. This is drive/idle <i>quality</i>, <b>not</b> COV<sub>imep</sub> — at 25 Hz a 6-cyl fires
            ~50 Hz (above Nyquist), so per-firing content aliases in. Banded against Heywood's 2–5% COV<sub>imep</sub> driveability
            guide for orientation only; idle is the cleanest read.<br />
            <b style={{ color: C.ink }}>Knock scatter index</b> — operating-point-detrended (250 rpm × 10 kPa) cycle-to-cycle
            scatter of <span style={{ fontFamily: C.mono }}>Knock voltage peak cyl N</span> on no-knock samples, pooled and per
            cylinder. A <b>comparative</b> metric (region / cylinder / tune-vs-tune) — not pass/failed against 2–5%.
          </div>
        </Section>

        {/* ---- Upload ---- */}
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
          onClick={() => fileInput.current && fileInput.current.click()}
          style={{ border: `2px dashed ${drag ? C.accent : C.line}`, borderRadius: 12, padding: 28, textAlign: "center",
            cursor: "pointer", background: drag ? C.panel2 : C.panel, marginBottom: 14 }}>
          <div style={{ fontSize: 28 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{data ? data.filename : "Drop an EMU Black log (.csv) here"}</div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
            {data ? `${data.rows.toLocaleString()} rows · ${result.rate_hz} Hz · knock channels ${result.knock_available ? "present" : "absent"} · click to replace` : "Semicolon-delimited CSV exported from ECUMaster software"}
          </div>
          <input ref={fileInput} type="file" accept=".csv" style={{ display: "none" }}
            onChange={(e) => onFile(e.target.files[0])} />
        </div>
        {status && <div style={{ textAlign: "center", color: C.inkSoft, fontFamily: C.mono, fontSize: 13, marginBottom: 14 }}>{status}</div>}

        {result && (
          <>
            {/* ---- Region editor ---- */}
            <Section title="Region bounds" sub="Defaults tuned for the 2JZ Supra — edit any cell to re-bin live.">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ color: C.inkSoft }}>
                      {["Region", "RPM min", "RPM max", "MAP min", "MAP max", "TPS min", "TPS max", "Primary"].map((h) => (
                        <th key={h} style={{ textAlign: h === "Region" ? "left" : "center", padding: "6px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${C.line}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(regions).map((key) => (
                      <tr key={key}>
                        <td style={{ padding: "6px 8px", fontWeight: 600, color: C.ink, borderBottom: `1px solid ${C.line}` }}>{regions[key].label}</td>
                        {COLS.map((f) => (
                          <td key={f} style={{ textAlign: "center", padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>
                            <NumCell value={regions[key][f]} onChange={(v) => setBound(key, f, v)} />
                          </td>
                        ))}
                        <td style={{ textAlign: "center", padding: "6px 8px", fontFamily: C.mono, fontSize: 10.5, color: C.inkSoft, borderBottom: `1px solid ${C.line}` }}>
                          {regions[key].primary === "rpm" ? "CoV_RPM" : "knock"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={resetRegions}
                style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, padding: "7px 14px", cursor: "pointer", borderRadius: 8,
                  background: C.panel2, color: C.ink, border: `1px solid ${C.line}` }}>Reset to defaults</button>
            </Section>

            {/* ---- Result cards ---- */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14, marginBottom: 14 }}>
              {result.regions.map((reg) => <RegionCard key={reg.key} reg={reg} />)}
            </div>

            {/* ---- Caveats ---- */}
            <div style={{ fontSize: 12, color: C.inkSoft, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px", lineHeight: 1.7 }}>
              <b style={{ color: C.ink }}>How to read this.</b>
              <ul style={{ margin: "6px 0 0 18px" }}>
                <li><b>CoV<sub>RPM</sub></b> is the roughness number; the 2–5% band is the Heywood COV<sub>imep</sub> guide shown for orientation — read it as "smoother is better," not a calibrated pass/fail. <b>Idle is cleanest</b>; a free-driving cruise box also captures shifts and throttle, so compare cruise like-for-like.</li>
                <li><b>Knock scatter index</b> is relative — use the per-cylinder bars to spot an odd-one-out cylinder, and compare regions or two tune revisions of like-for-like logs.</li>
                <li>Knock scatter bites hardest while interpolating across map cells (accel / ramp into boost); a steady region partly washes it out, though the high-load box is usually transitional anyway.</li>
                <li>At 25 Hz the engine fires faster than the log samples, so this is windowed jitter, not true per-combustion-event CoV.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
    </ThemeCtx.Provider>
  );
}

export default App;
