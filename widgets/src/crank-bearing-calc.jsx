// Copied from Hobbies/Cars/Projects/engine-stress-analyzer (canonical); model files copied to ./src/crank-bearing-calc/.
// Crank bearing stress calculator - UI. Imports ONLY analyze/torqueSweep/DEFAULTS/OPTIONS from the model glue.
// Runs standalone (index.html) and as a blog widget (default export, Preact-compatible hooks only).
import React, { useState, useMemo, useEffect, useRef } from "react";
import * as calc from "./src/crank-bearing-calc/calc.js";
const { analyze, torqueSweep, DEFAULTS, OPTIONS, engineDefaults, camsFor, solvePoint, ignRow, emuTables } = calc;

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const THEMES = {
  dark: { bg: "#14101e", panel: "#1e1830", panel2: "#272040", ink: "#f5f3fc", soft: "#9b95b5", line: "#3a3358", accent: "#a78bfa", deep: "#7c3aed",
    c: ["#a78bfa", "#60a5fa", "#f87171", "#4ade80", "#fbbf24", "#f472b6"], ok: "#4ade80", warn: "#fbbf24", bad: "#f87171" },
  light: { bg: "#f7f6fb", panel: "#ffffff", panel2: "#f1eefa", ink: "#1a1730", soft: "#6b6688", line: "#d8d2ec", accent: "#7c3aed", deep: "#6d28d9",
    c: ["#7c3aed", "#2563eb", "#dc2626", "#16a34a", "#d97706", "#db2777"], ok: "#16a34a", warn: "#d97706", bad: "#dc2626" },
};
const BIND = { rodLoad: "rod load", mainLoad: "main load", rodFilm: "rod film", mainFilm: "main film", edgeFilm: "edge film" };
const BCOL = { rodLoad: 2, mainLoad: 4, rodFilm: 1, mainFilm: 3, edgeFilm: 5 };

const CSS = `
.bsc-root{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);padding:18px 16px;box-sizing:border-box}
.bsc-root *{box-sizing:border-box}
.bsc-emb{padding:4px 0 0}
.bsc-wrap{max-width:1280px;margin:0 auto}
.bsc-h1{font-size:24px;margin:0 0 2px}
.bsc-sub{color:var(--soft);font-size:13.5px;margin:0 0 16px;max-width:780px}
.bsc-main{display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:16px;align-items:start}
@media(max-width:900px){.bsc-main{grid-template-columns:minmax(0,1fr)}}
.bsc-panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:14px}
.bsc-panel h3{margin:0 0 2px;font-size:15px}
.bsc-note{font-size:12px;color:var(--soft);margin:2px 0 10px}
.bsc-det{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:10px}
.bsc-det>summary{cursor:pointer;padding:10px 14px;font-weight:700;font-size:14px;list-style:none}
.bsc-det>summary::-webkit-details-marker{display:none}
.bsc-det>summary:before{content:"\\25B8";display:inline-block;width:1.1em;color:var(--accent)}
.bsc-det[open]>summary:before{content:"\\25BE"}
.bsc-body{padding:0 14px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
.bsc-f{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--soft);min-width:0}
.bsc-f input,.bsc-f select{width:100%;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:5px 7px;font-family:${MONO};font-size:13px;min-width:0}
.bsc-f input:disabled{opacity:.45}
.bsc-est{font-size:9.5px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:0 5px;margin-left:4px;color:var(--soft);font-family:${MONO}}
.bsc-row{display:flex;gap:8px;align-items:flex-end;grid-column:1/-1;flex-wrap:wrap}
.bsc-btn{background:var(--deep);color:#fff;border:0;border-radius:8px;padding:7px 14px;font-weight:700;font-size:13px;cursor:pointer}
.bsc-btn.sm{padding:5px 9px;font-size:12px}.bsc-btn.alt{background:var(--panel2);color:var(--ink);border:1px solid var(--line)}
.bsc-btn:disabled{opacity:.5;cursor:default}
.bsc-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px;margin-bottom:14px}
.bsc-tile{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:9px 11px;border-left-width:4px}
.bsc-tile .l{font-size:11px;color:var(--soft)}
.bsc-tile .v{font-family:${MONO};font-size:20px;font-weight:700;margin-top:2px}
.bsc-tile .v small{font-size:11px;font-weight:400;color:var(--soft)}
.bsc-tile .s{font-size:11px;color:var(--soft);font-family:${MONO}}
.bsc-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:14px}
.bsc-charts>.bsc-panel{margin:0}
.bsc-wide{grid-column:1/-1}
.bsc-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.bsc-chip{font-size:11.5px;border:1px solid var(--line);background:var(--bg);color:var(--soft);border-radius:14px;padding:2px 9px;cursor:pointer}
.bsc-chip.on{color:var(--ink);font-weight:700}
.bsc-warn{border:1px solid var(--warn);background:rgba(251,191,36,.12);border-radius:10px;padding:8px 12px;font-size:12.5px;margin-bottom:12px}
.bsc-tbl{width:100%;border-collapse:collapse;font-family:${MONO};font-size:12px}
.bsc-tbl th,.bsc-tbl td{padding:4px 6px;text-align:right;border-bottom:1px solid var(--line)}
.bsc-tbl th:first-child,.bsc-tbl td:first-child{text-align:left}
.bsc-tblw{overflow-x:auto}
.bsc-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--line);margin-bottom:12px}
.bsc-tab{flex:0 0 auto;background:none;border:0;border-bottom:3px solid transparent;color:var(--soft);padding:8px 12px;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.bsc-tab.on{color:var(--ink);border-bottom-color:var(--accent)}
.bsc-eqs{padding:0 14px 12px}
.bsc-eqs h4{margin:12px 0 4px;font-size:12.5px;color:var(--accent);text-transform:uppercase;letter-spacing:.04em}
.bsc-eq{padding:5px 0;border-bottom:1px dotted var(--line)}
.bsc-eq .m{font-family:Cambria,"Cambria Math","STIX Two Math",Georgia,"Times New Roman",serif;font-size:15px;line-height:1.5;overflow-x:auto;white-space:nowrap}
.bsc-eq .d{font-size:12px;color:var(--soft);margin-top:1px}
.bsc-foot{color:var(--soft);font-size:11.5px;margin-top:14px;line-height:1.6}
.bsc-svg{width:100%;height:auto;display:block;touch-action:pan-y}
`;

const ENGINE_LABELS = { "1FZ-FE": "1FZ-FE · FJ80 Land Cruiser", "2JZ": "2JZ · MKIV Supra" };
const enginesList = ((OPTIONS && OPTIONS.engines) || []).map((e) => (typeof e === "string" ? { key: e, label: ENGINE_LABELS[e] || e } : { key: e.key || e.name, label: e.label || ENGINE_LABELS[e.key] || e.key }));
// EMU axes (emu-table-conventions.md); boost rpm bins double as the torque-target points
const MAPAX = {
  "1FZ-FE": { ignRpm: [500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000], ignMap: [20, 35, 50, 65, 80, 100, 125, 150, 175, 200, 230, 260, 290, 325, 360, 400], boostRpm: [2000, 2500, 3000, 4000, 5000, 6000, 6500, 7000] },
  "2JZ": { ignRpm: [500, 842, 1184, 1526, 1868, 2211, 2553, 2895, 3237, 3579, 3921, 4263, 4605, 4947, 5289, 5632, 5974, 6316, 6658, 7000], ignMap: [20, 35, 49, 64, 79, 93, 108, 123, 137, 152, 167, 181, 196, 211, 225, 240], boostRpm: [3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000] },
};
const TABS = [["overview", "Overview"], ["maps", "Maps"], ["mains", "Mains"], ["rod", "Rod bearing"], ["pin", "Wrist pin"], ["buck", "Rod buckling"], ["cam", "Camshaft"]];
const fmt = (n, dp = 1) => (n == null || !isFinite(n) ? "-" : Number(n).toFixed(dp));
const deg = "°", mu = "µ";

function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(+v.toPrecision(10));
  return out;
}
const rangeOf = (arrs) => { let lo = Infinity, hi = -Infinity; for (const a of arrs) for (let i = 0; i < a.length; i++) { const v = a[i]; if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; };
const tickFmt = (v) => (Math.abs(v) >= 1000 ? v.toFixed(0) : String(+v.toPrecision(4)));

// ---------- generic line chart ----------
// series: [{y, color, name, dash, axis:"r"}] ; vlines:[{x,label,color}] ; hlines:[{y,label,color}]
function LineChart({ x, series, xlabel, ylabel, y2label, y2scale, dots = [], bands = [], vlines = [], hlines = [], xdom, ydom, xticks, H = 250, C }) {
  const W = 560, pl = 52, pr = y2label ? 48 : 14, pt = 12, pb = 38;
  const [hover, setHover] = useState(null);
  const L = series.filter((s) => s.axis !== "r"), R = series.filter((s) => s.axis === "r");
  const [x0, x1] = xdom || rangeOf([x]);
  const ext = (S, dom) => { if (dom) return dom; const [lo, hi] = rangeOf(S.map((s) => s.y)); const pad = (hi - lo) * 0.06 || 1; return [lo - pad, hi + pad]; };
  let [yl0, yl1] = ext(L.length ? L : R, ydom);
  hlines.forEach((h) => { yl0 = Math.min(yl0, h.y - (yl1 - yl0) * 0.02); yl1 = Math.max(yl1, h.y + (yl1 - yl0) * 0.02); });
  const [yr0, yr1] = y2scale ? [yl0 * y2scale, yl1 * y2scale] : R.length ? ext(R) : [0, 1];
  const X = (v) => pl + ((v - x0) / (x1 - x0)) * (W - pl - pr);
  const YL = (v) => pt + (1 - (v - yl0) / (yl1 - yl0)) * (H - pt - pb);
  const YR = (v) => pt + (1 - (v - yr0) / (yr1 - yr0)) * (H - pt - pb);
  const path = (s) => { const f = s.axis === "r" ? YR : YL; let d = "", pen = false;
    for (let i = 0; i < x.length; i++) { if (x[i] < x0 || x[i] > x1) { pen = false; continue; } d += (pen ? "L" : "M") + X(x[i]).toFixed(1) + " " + f(s.y[i]).toFixed(1); pen = true; } return d; };
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    const xv = x0 + ((px - pl) / (W - pl - pr)) * (x1 - x0); if (xv < x0 || xv > x1) return setHover(null);
    let bi = 0, bd = Infinity; for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - xv); if (d < bd) { bd = d; bi = i; } } setHover(bi);
  };
  const xt = xticks || niceTicks(x0, x1, 6);
  return (
    <svg className="bsc-svg" viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {niceTicks(yl0, yl1, 5).map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={YL(v)} y2={YL(v)} stroke={C.line} strokeWidth="0.6" />
        <text x={pl - 5} y={YL(v) + 3} textAnchor="end" fontSize="10" fill={C.soft} fontFamily={MONO}>{tickFmt(v)}</text></g>)}
      {(R.length > 0 || y2scale) && niceTicks(yr0, yr1, 5).map((v) => <text key={v} x={W - pr + 5} y={YR(v) + 3} fontSize="10" fill={C.soft} fontFamily={MONO}>{tickFmt(v)}</text>)}
      {xt.map((v) => <g key={v}><line x1={X(v)} x2={X(v)} y1={pt} y2={H - pb} stroke={C.line} strokeWidth="0.4" />
        <text x={X(v)} y={H - pb + 13} textAnchor="middle" fontSize="10" fill={C.soft} fontFamily={MONO}>{tickFmt(v)}</text></g>)}
      {vlines.filter((v) => v.x >= x0 && v.x <= x1).map((v, i) => <g key={i}><line x1={X(v.x)} x2={X(v.x)} y1={pt} y2={H - pb} stroke={v.color} strokeWidth="1" strokeDasharray="4 3" />
        <text x={X(v.x) + 2} y={pt + 9 + (i % 4) * 10} fontSize="9.5" fill={v.color} fontFamily={MONO}>{v.label}</text></g>)}
      {hlines.map((h, i) => <g key={i}><line x1={pl} x2={W - pr} y1={YL(h.y)} y2={YL(h.y)} stroke={h.color} strokeWidth="1.2" strokeDasharray="5 3" />
        <text x={W - pr - 2} y={YL(h.y) - 3} textAnchor="end" fontSize="9.5" fill={h.color} fontFamily={MONO}>{h.label}</text></g>)}
      {bands.map((b, i) => <path key={"b" + i} d={b.x.map((xv, j) => (j ? "L" : "M") + X(xv).toFixed(1) + " " + YL(b.y0[j]).toFixed(1)).join("") + b.x.map((xv, j) => "L" + X(b.x[b.x.length - 1 - j]).toFixed(1) + " " + YL(b.y1[b.x.length - 1 - j]).toFixed(1)).join("") + "Z"} fill={b.color} opacity="0.22" stroke="none" />)}
      {series.map((s, i) => <path key={i} d={path(s)} fill="none" stroke={s.color} strokeWidth="1.8" strokeDasharray={s.dash} opacity={s.faint ? 0.55 : 1} />)}
      {dots.map((d, i) => <circle key={"d" + i} cx={X(d.x)} cy={YL(d.y)} r="4.5" fill={d.bad ? C.bad : d.color} stroke={C.bg} strokeWidth="1" />)}
      <rect x={pl} y={pt} width={W - pl - pr} height={H - pt - pb} fill="none" stroke={C.line} />
      <text x={(pl + W - pr) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill={C.soft}>{xlabel}</text>
      <text transform={`translate(12 ${(pt + H - pb) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill={C.soft}>{ylabel}</text>
      {y2label && <text transform={`translate(${W - 8} ${(pt + H - pb) / 2}) rotate(90)`} textAnchor="middle" fontSize="11" fill={C.soft}>{y2label}</text>}
      {hover != null && (() => { const hx = X(x[hover]); const lx = hx > W / 2 ? hx - 6 : hx + 6, anc = hx > W / 2 ? "end" : "start";
        return <g><line x1={hx} x2={hx} y1={pt} y2={H - pb} stroke={C.ink} strokeWidth="0.8" opacity="0.6" />
          <text x={lx} y={pt + 22} textAnchor={anc} fontSize="10.5" fontFamily={MONO} fill={C.ink}>{fmt(x[hover], 1)}</text>
          {series.map((s, i) => <text key={i} x={lx} y={pt + 34 + i * 11} textAnchor={anc} fontSize="10.5" fontFamily={MONO} fill={s.color}>{s.name}: {tickFmt(+s.y[hover].toFixed(3))}</text>)}</g>; })()}
    </svg>
  );
}
const Legend = ({ items }) => <div className="bsc-chips">{items.map((s, i) => <span key={i} style={{ fontSize: 11.5, color: s.color, fontFamily: MONO }}>{"●"} {s.name}</span>)}</div>;

// ---------- polar load diagram, equal axes ----------
function Polar({ pts, C, color, label, unit = "kN" }) {
  const S = 320, c = S / 2, n = pts.x.length;
  let m = 0, pk = 0; for (let i = 0; i < n; i++) { const r = Math.hypot(pts.x[i], pts.y[i]); if (r > m) { m = r; pk = i; } }
  const rings = niceTicks(0, m * 1.05, 4).filter((v) => v > 0), R = rings.length ? rings[rings.length - 1] : 1, sc = (c - 22) / Math.max(R, m);
  const P = (i) => `${(c + pts.x[i] * sc).toFixed(1)} ${(c - pts.y[i] * sc).toFixed(1)}`;
  let d = ""; for (let i = 0; i < n; i++) d += (i ? "L" : "M") + P(i); d += "Z";
  return (
    <svg className="bsc-svg" viewBox={`0 0 ${S} ${S + 16}`}>
      {rings.map((v) => <g key={v}><circle cx={c} cy={c} r={v * sc} fill="none" stroke={C.line} strokeWidth="0.6" />
        <text x={c + 3} y={c - v * sc - 2} fontSize="9" fill={C.soft} fontFamily={MONO}>{tickFmt(v)}</text></g>)}
      <line x1="6" x2={S - 6} y1={c} y2={c} stroke={C.line} /><line y1="6" y2={S - 6} x1={c} x2={c} stroke={C.line} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
      <circle cx={c + pts.x[pk] * sc} cy={c - pts.y[pk] * sc} r="4" fill={C.bad} />
      <text x={S - 8} y={c - 4} textAnchor="end" fontSize="10" fill={C.soft}>x ({unit})</text>
      <text x={c + 5} y="14" fontSize="10" fill={C.soft}>y ({unit})</text>
      <text x={c} y={S + 12} textAnchor="middle" fontSize="11" fill={C.ink}>{label} - peak {fmt(m, 1)} {unit} (red dot)</text>
    </svg>
  );
}

// ---------- main-bearing bars ----------
function MainBars({ mains, rating, worst, C }) {
  const W = 560, H = 230, pl = 52, pr = 14, pt = 14, pb = 38;
  const ymax = Math.max(rating * 1.15, ...mains.map((m) => m.peakMPa * 1.08));
  const Y = (v) => pt + (1 - v / ymax) * (H - pt - pb), bw = (W - pl - pr) / mains.length;
  return (
    <svg className="bsc-svg" viewBox={`0 0 ${W} ${H}`}>
      {niceTicks(0, ymax, 5).map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke={C.line} strokeWidth="0.6" />
        <text x={pl - 5} y={Y(v) + 3} textAnchor="end" fontSize="10" fill={C.soft} fontFamily={MONO}>{tickFmt(v)}</text></g>)}
      {mains.map((m, i) => { const col = m.peakMPa > rating ? C.bad : m.peakMPa > 0.85 * rating ? C.warn : C.ok;
        return <g key={i}><rect x={pl + i * bw + bw * 0.18} width={bw * 0.64} y={Y(m.peakMPa)} height={H - pb - Y(m.peakMPa)} fill={col} opacity={i === worst ? 1 : 0.65} stroke={i === worst ? C.ink : "none"} />
          <text x={pl + i * bw + bw / 2} y={Y(m.peakMPa) - 3} textAnchor="middle" fontSize="10" fill={C.ink} fontFamily={MONO}>{fmt(m.peakMPa, 0)}</text>
          <text x={pl + i * bw + bw / 2} y={H - pb + 13} textAnchor="middle" fontSize="10.5" fill={C.soft}>{i + 1}</text></g>; })}
      <line x1={pl} x2={W - pr} y1={Y(rating)} y2={Y(rating)} stroke={C.bad} strokeWidth="1.3" strokeDasharray="5 3" />
      <text x={W - pr - 2} y={Y(rating) - 4} textAnchor="end" fontSize="9.5" fill={C.bad} fontFamily={MONO}>rating {rating} MPa</text>
      <text x={(pl + W - pr) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill={C.soft}>main bearing no. (front = 1)</text>
      <text transform={`translate(12 ${(pt + H - pb) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill={C.soft}>peak unit load (MPa)</text>
    </svg>
  );
}

// ---------- inputs ----------
function Num({ k, ui, set, label, unit, step = "any", est, disabled, shown }) {
  const [txt, setTxt] = useState(String(ui[k]));
  useEffect(() => { if (Number(txt) !== ui[k]) setTxt(String(ui[k])); }, [ui[k]]);
  return (
    <label className="bsc-f"><span>{label}{unit ? ` (${unit})` : ""}{est && <span className="bsc-est" title={est === true ? "estimated default - measure/tune" : "from the factory service manual"}>{est === true ? "est." : est}</span>}</span>
      <input type="number" step={step} value={shown != null ? shown : txt} disabled={disabled}
        onChange={(e) => { setTxt(e.target.value); const v = parseFloat(e.target.value); if (isFinite(v)) set(k, v); }} /></label>
  );
}
function Sel({ k, ui, set, label, opts, est }) {
  return (
    <label className="bsc-f"><span>{label}{est && <span className="bsc-est">est.</span>}</span>
      <select value={ui[k]} onChange={(e) => set(k, e.target.value)}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
  );
}
const Det = ({ title, open, children }) => <details className="bsc-det" open={open}><summary>{title}</summary><div className="bsc-body">{children}</div></details>;

function Tile({ label, value, unit, sub, color }) {
  return <div className="bsc-tile" style={{ borderLeftColor: color || "var(--line)" }}><div className="l">{label}</div>
    <div className="v" style={color ? { color } : null}>{value}{unit && <small> {unit}</small>}</div>{sub && <div className="s">{sub}</div>}</div>;
}

// ---------- app ----------
export default function BearingStress() {
  const [dark, setDark] = useState(() => {
    try { const s = document.documentElement.getAttribute("saved-theme"); if (s) return s === "dark";
      return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch { return true; }
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

  const initUi = useMemo(() => {
    let k = null; try { k = localStorage.getItem("bsc-engine"); } catch {}
    const ks = enginesList.map((e) => e.key);
    if (engineDefaults && k && ks.includes(k)) { try { return { ...engineDefaults(k), engine: k }; } catch {} }
    return { ...DEFAULTS };
  }, []);
  const baseRef = useRef(initUi);
  const [ui, setUi] = useState(initUi);
  const [applied, setApplied] = useState(ui);
  const preset = useMemo(() => { try { return engineDefaults && ui.engine ? engineDefaults(ui.engine) : null; } catch { return null; } }, [ui.engine]);
  const camList = (camsFor && ui.engine ? camsFor(ui.engine) : OPTIONS.cams) || [];
  const [mcfg, setMcfg] = useState(() => { const c = { flat: initUi.engine === "2JZ" ? 475 : 600, ratingFrac: 1.0, maxMap: 400, spool: 60 }; for (let i = 0; i < 8; i++) c["t" + i] = c.flat; return c; });
  const setM = (k, v) => setMcfg((c) => ({ ...c, [k]: v }));
  const [maps, setMaps] = useState(null), [mprog, setMprog] = useState(null);
  const switchEngine = (k) => {
    if (k === ui.engine || !engineDefaults) return;
    if (JSON.stringify(ui) !== JSON.stringify(baseRef.current) && !window.confirm("Switching engine replaces your edited inputs with the preset. Continue?")) return;
    const d = { ...engineDefaults(k), engine: k }; baseRef.current = d; setUi(d); setApplied(d); setSweep(null); setMaps(null);
    const f = k === "2JZ" ? 475 : 600; setMcfg((c) => { const n = { ...c, flat: f }; for (let i = 0; i < 8; i++) n["t" + i] = f; return n; });
    try { localStorage.setItem("bsc-engine", k); } catch {}
  };
  const set = (k, v) => setUi((u) => ({ ...u, [k]: v }));
  useEffect(() => { const t = setTimeout(() => setApplied(ui), 250); return () => clearTimeout(t); }, [ui]);
  const pending = applied !== ui;

  const [res, err] = useMemo(() => { try { return [analyze(applied), null]; } catch (e) { return [null, String((e && e.message) || e)]; } }, [applied]);
  const last = useRef(null); if (res) last.current = res;
  const r = res || last.current;

  const [fsel, setFsel] = useState({ fGas: true, fInertia: true, fRod: true, fSide: true, fAxial: false });
  const [tab, setTab] = useState(() => { try { const t = localStorage.getItem("bsc-tab"); return TABS.some((x) => x[0] === t) ? t : "overview"; } catch { return "overview"; } });
  const chooseTab = (k) => { setTab(k); try { localStorage.setItem("bsc-tab", k); } catch {} };
  const [full, setFull] = useState(false);
  const [cmp, setCmp] = useState(false), [norm, setNorm] = useState(false);
  const cmpKey = JSON.stringify({ ...applied, mapKPa: 0 });
  const [cmpRes] = useMemo(() => { if (!cmp) return [null]; try { return [analyze({ ...applied, mapKPa: 101.3, useTarget: false })]; } catch (e) { return [null]; } }, [cmp, cmpKey]);
  const [sweep, setSweep] = useState(null);       // {pts, ui, error?}
  const [prog, setProg] = useState(null);         // null | {i,n}
  const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);
  const runSweep = () => {
    const rpms = []; for (let v = 1500; v <= 7000; v += 500) rpms.push(v);
    const snap = applied, pts = []; setProg({ i: 0, n: rpms.length });
    const step = (i) => {
      if (!alive.current) return;
      if (i >= rpms.length) { setSweep({ pts, ui: snap }); setProg(null); return; }
      try { pts.push(...torqueSweep(snap, [rpms[i]])); } catch (e) { setProg(null); setSweep({ pts, ui: snap, error: String((e && e.message) || e) }); return; }
      setProg({ i: i + 1, n: rpms.length }); setTimeout(() => step(i + 1), 20);
    };
    setTimeout(() => step(0), 30);
  };

  const MAPAX_ = MAPAX[applied.engine || "1FZ-FE"] || MAPAX["1FZ-FE"];
  const runMaps = () => {
    const snap = applied, ax = MAPAX_, opts = { ratingFrac: mcfg.ratingFrac, maxMapKPa: mcfg.maxMap, spoolKPa: mcfg.spool }, pts = [], rows = [];
    const N1 = ax.boostRpm.length, N2 = ax.ignRpm.length; setMprog({ phase: "solving points", i: 0, n: N1 + N2 + 1 });
    const step = (k) => {
      if (!alive.current) return;
      try {
        if (k < N1) pts.push(solvePoint(snap, ax.boostRpm[k], mcfg["t" + k], opts));
        else if (k < N1 + N2) rows.push(ignRow(snap, ax.ignRpm[k - N1], ax.ignMap, opts));
        else { const tables = emuTables(snap, pts, rows, opts); setMaps({ pts, tables, ui: snap }); setMprog(null); return; }
      } catch (e) { setMprog(null); setMaps({ pts, error: String((e && e.message) || e), ui: snap }); return; }
      setMprog({ phase: k + 1 < N1 ? "solving points" : k + 1 < N1 + N2 ? "ignition rows" : "tables", i: k + 1, n: N1 + N2 + 1 }); setTimeout(() => step(k + 1), 20);
    };
    setTimeout(() => step(0), 30);
  };
  const mp = maps && maps.pts;
  const rating = applied.ratingMPa, minFilm = applied.minFilmUm;
  const pctCol = (p) => (p > 100 ? C.bad : p > 85 ? C.warn : C.ok);
  const filmCol = (h) => (h < minFilm ? C.bad : h < 1.5 * minFilm ? C.warn : C.ok);

  const mapShown = ui.useTarget && r && r.cyl.mapKPa ? r.cyl.mapKPa : ui.mapKPa, boostPsi = (mapShown - 101.3) / 6.895;
  let body = null;
  if (r) {
    const th = r.theta, cy = r.cyl, f = r.forces, wm = r.mains[r.worstMain], lim = r.limits;
    const starved = r.rod.starved || r.mains.some((m) => m.starved);
    const xlo = full ? -360 : -120, xhi = full ? 360 : 180;
    const fdefs = [["fGas", "gas", 1], ["fInertia", "inertia", 4], ["fAxial", "axial", 5], ["fRod", "rod", 2], ["fSide", "side thrust", 3]];
    const fser = fdefs.filter(([k]) => fsel[k]).map(([k, n, ci]) => ({ y: f[k], color: C.c[ci], name: n }));
    const marks = [[cy.spark, "spark", C.c[4]], [cy.ca10, "CA10", C.c[1]], [cy.ca50, "CA50", C.c[3]], [cy.ca90, "CA90", C.c[5]]].map(([x, label, color]) => ({ x, label, color }));
    const sw = sweep && sweep.pts, rb = r.rodBrg, pn = r.pin, bk = r.buckling, cm = r.cam;
    const sfCol = (v) => (v < 1 ? C.bad : v < 1.5 ? C.warn : C.ok);
    const nz = (a, m) => (norm ? Array.from(a, (v) => v / m) : a);
    const pm = Math.max(...cy.p), cc = cmpRes && cmpRes.cyl, cpm = cc ? Math.max(...cc.p) : 1;
    const pser = [{ y: nz(cy.p, pm), color: C.c[0], name: norm ? "p/pmax" : "p bar" }, { y: cy.xb, color: C.c[3], name: "MFB", axis: "r", dash: "4 3" }];
    if (cc) pser.push({ y: nz(cc.p, cpm), color: C.c[0], name: "N/A p", dash: "2 3", faint: true }, { y: cc.xb, color: C.c[3], name: "N/A MFB", axis: "r", dash: "1 3", faint: true });
    body = (<>
      {(starved || r.warnings.length > 0) && <div className="bsc-warn">
        {starved && <div><b>Oil supply warning:</b> the feed hole cannot pass the mean oil demand at the available pressure ({[r.rod.starved ? "rod" : null, ...r.mains.map((m, i) => (m.starved ? "main " + (i + 1) : null))].filter(Boolean).join(", ")}).</div>}
        {r.warnings.map((w, i) => <div key={i}>{w}</div>)}</div>}
      <div className="bsc-tiles">
        <Tile label="Torque" value={fmt(r.torque.meanLbft, 0)} unit="lb-ft" sub={`${fmt(r.torque.meanNm, 0)} Nm`} />
        <Tile label="Power" value={fmt(r.torque.powerHp, 0)} unit="hp" sub={`${fmt(r.torque.powerKw, 0)} kW`} />
        <Tile label="Peak cyl. pressure" value={fmt(cy.pmaxBar, 0)} unit="bar" sub={`@ ${fmt(cy.thetaPmax, 0)}${deg} ATDC`} />
        <Tile label="CA50" value={fmt(cy.ca50, 1)} unit={deg + " ATDC"} sub={`10-90: ${fmt(cy.ca90 - cy.ca10, 0)}${deg} / MBT ${fmt(cy.mbt, 0)}${deg}`} />
        <Tile label="Rod peak unit load" value={fmt(r.rod.peakMPa, 1)} unit="MPa" sub={`${fmt(r.rod.pctRating, 0)}% of ${rating}`} color={pctCol(r.rod.pctRating)} />
        <Tile label={`Worst main (no. ${r.worstMain + 1})`} value={fmt(wm.peakMPa, 1)} unit="MPa" sub={`${fmt(wm.pctRating, 0)}% of ${rating}`} color={pctCol(wm.pctRating)} />
        <Tile label="Rod min film" value={fmt(r.rod.hMin, 2)} unit={mu + "m"} sub={`eps max ${fmt(r.rod.eps, 2)}`} color={filmCol(r.rod.hMin)} />
        <Tile label="Worst-main min film" value={fmt(wm.hMin, 2)} unit={mu + "m"} color={filmCol(wm.hMin)} />
        <Tile label="Worst-main edge film" value={fmt(wm.edgeFilm, 2)} unit={mu + "m"} sub={wm.edgeFilm <= 0 ? "EDGE CONTACT" : `slope ${fmt(wm.slopeMrad, 2)} mrad`} color={filmCol(wm.edgeFilm)} />
        <Tile label="Peak side thrust" value={fmt(Math.abs(f.sidePeak), 2)} unit="kN" sub={`${f.sidePeak >= 0 ? "major (+)" : "minor (-)"} @ ${fmt(f.sidePeakTheta, 0)}${deg}`} />
        <Tile label="Rod film temp / visc." value={fmt(r.rod.tFilmC, 0)} unit={deg + "C"} sub={`${fmt(r.rod.muFilm, 2)} mPa.s / ${fmt(r.rod.qLmin, 1)} L/min`} />
        <Tile label="Main film temp / visc." value={fmt(wm.tFilmC, 0)} unit={deg + "C"} sub={`${fmt(wm.muFilm, 2)} mPa.s`} />
        <Tile label="Oil supply" value={starved ? "STARVED" : "OK"} sub={`feed-hole margin ${fmt(Math.min(r.rod.supplyMargin ?? Infinity, ...r.mains.map((m) => m.supplyMargin ?? Infinity)), 0)}×`} color={starved ? C.bad : C.ok} />
        <Tile label="Binding limit" value={BIND[lim.binding] || lim.binding} sub={Object.entries(lim.margins).map(([k, v]) => `${BIND[k] || k} ${v >= 0 ? "+" : ""}${fmt(v * 100, 0)}%`).join(" / ")} color={C.accent} />
      </div>

      <div className="bsc-tabs">{TABS.map(([k, n]) => <button key={k} className={"bsc-tab" + (tab === k ? " on" : "")} onClick={() => chooseTab(k)}>{n}</button>)}</div>
      {tab === "overview" && <div className="bsc-charts">
        <div className="bsc-panel"><h3>Cylinder pressure and burn</h3>
          <div className="bsc-chips"><span className={"bsc-chip" + (full ? "" : " on")} onClick={() => setFull(false)}>-120..180{deg}</span><span className={"bsc-chip" + (full ? " on" : "")} onClick={() => setFull(true)}>full 720{deg}</span></div>
          <LineChart C={C} x={th} xdom={[xlo, xhi]} xlabel={`crank angle (${deg} ATDC firing)`} ylabel={norm ? "p / p_max" : "pressure (bar)"} y2label="mass fraction burned"
            series={pser} vlines={marks} />
          <div className="bsc-chips"><label className="bsc-chip"><input type="checkbox" checked={cmp} onChange={(e) => setCmp(e.target.checked)} /> Compare with N/A</label>
            <label className="bsc-chip"><input type="checkbox" checked={norm} onChange={(e) => setNorm(e.target.checked)} /> normalise p/p_max</label></div>
          <div className="bsc-tiles" style={{ margin: "4px 0 6px" }}>
            <Tile label="S_L" value={fmt(cy.slCm, 0)} unit="cm/s" /><Tile label={"δ_L"} value={fmt(cy.deltaLum, 1)} unit={mu + "m"} />
            <Tile label="S_T" value={fmt(cy.st, 1)} unit="m/s" /><Tile label={"u′"} value={fmt(cy.uPrime, 1)} unit="m/s" />
            <Tile label="Ign. delay" value={fmt(cy.delay, 1)} unit={deg} /><Tile label="Burn 10-90" value={fmt(cy.burn, 1)} unit={deg} />
            <Tile label="Peak dp/dθ" value={fmt(cy.dpMax, 2)} unit={"bar/" + deg} /></div>
          <div className="bsc-note">spark {fmt(-cy.spark, 0)}{deg} / delay {fmt(cy.delay, 0)}{deg} / burn {fmt(cy.burn, 0)}{deg} / S<sub>L</sub> {fmt(cy.slCm, 0)} cm/s / IMEP {fmt(cy.imepBar, 1)} bar</div></div>

        <div className="bsc-panel"><h3>Forces over 720{deg}</h3>
          <div className="bsc-chips">{fdefs.map(([k, n, ci]) => <span key={k} className={"bsc-chip" + (fsel[k] ? " on" : "")} style={fsel[k] ? { borderColor: C.c[ci], color: C.c[ci] } : null} onClick={() => setFsel((s) => ({ ...s, [k]: !s[k] }))}>{n}</span>)}</div>
          <LineChart C={C} x={th} xlabel={`crank angle (${deg} ATDC firing)`} ylabel="force (kN)" series={fser.length ? fser : [{ y: f.fGas, color: "transparent", name: "" }]} xticks={[-360, -180, 0, 180, 360]} />
          <div className="bsc-note">side thrust peak {fmt(f.sidePeak, 2)} kN at {fmt(f.sidePeakTheta, 0)}{deg}</div></div>

        <div className="bsc-panel bsc-wide"><h3>Torque ceiling vs rpm</h3>
          <div className="bsc-note">Raises MAP at the current fuel and spark (or MBT at each point when Track MBT is on) until the first bearing limit binds. Slow - runs one rpm at a time.</div>
          <div className="bsc-row" style={{ marginBottom: 8 }}>
            <button className="bsc-btn" disabled={!!prog} onClick={runSweep}>{prog ? `computing ${prog.i}/${prog.n}...` : sweep ? "Re-run sweep" : "Run sweep"}</button>
            {sweep && sweep.ui !== applied && !prog && <span className="bsc-note" style={{ margin: 0 }}>inputs changed since this sweep</span>}
            {sweep && sweep.error && <span style={{ color: C.bad, fontSize: 12 }}>{sweep.error}</span>}</div>
          {sw && sw.length > 0 && <SweepChart pts={sw} C={C} />}</div>
        <Eqs items={EQ.overview} />
      </div>}
      {tab === "maps" && <div className="bsc-charts">
        <div className="bsc-panel bsc-wide"><h3>Torque target and solver</h3>
          <div className="bsc-note">Ignition is MBT with bearing-limited retard only (no knock model). Run with the fuel the table is for: table 1 (E0) → 91, table 2 (E100) → E100. Fuel in use: <b>{applied.fuel}</b>.</div>
          {!(solvePoint && ignRow && emuTables) ? <Missing what="map solver (solvePoint / ignRow / emuTables)" /> : <>
            <div className="bsc-body" style={{ padding: 0, gridTemplateColumns: "repeat(auto-fill,minmax(92px,1fr))" }}>
              {MAPAX_.boostRpm.map((rpm, i) => <Num key={rpm} k={"t" + i} ui={mcfg} set={setM} label={`${rpm} rpm`} unit="lb-ft" step="5" />)}</div>
            <div className="bsc-body" style={{ padding: "10px 0 0", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))" }}>
              <Num k="flat" ui={mcfg} set={setM} label="Flat target" unit="lb-ft" step="5" />
              <div className="bsc-f"><span>&nbsp;</span><button className="bsc-btn sm alt" onClick={() => setMcfg((c) => { const n = { ...c }; MAPAX_.boostRpm.forEach((_, i) => { n["t" + i] = c.flat; }); return n; })}>Flat quick-fill</button></div>
              <Num k="ratingFrac" ui={mcfg} set={setM} label="Rating fraction" step="0.05" />
              <Num k="maxMap" ui={mcfg} set={setM} label="Max MAP (abs)" unit="kPa" />
              <Num k="spool" ui={mcfg} set={setM} label="Spool boost (gauge)" unit="kPa" /></div>
            <div className="bsc-row" style={{ marginTop: 10, alignItems: "center" }}>
              <button className="bsc-btn" disabled={!!mprog} onClick={runMaps}>{mprog ? "solving..." : maps ? "Re-solve maps" : "Solve maps"}</button>
              {mprog && <div style={{ flex: 1, minWidth: 160 }}><div style={{ height: 8, background: "var(--panel2)", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${(100 * mprog.i) / mprog.n}%`, background: "var(--accent)" }} /></div>
                <div className="bsc-note" style={{ margin: "2px 0 0" }}>{mprog.phase} {mprog.i}/{mprog.n}</div></div>}
              {maps && maps.ui !== applied && !mprog && <span className="bsc-note" style={{ margin: 0 }}>inputs changed since this solve</span>}
              {maps && maps.error && <span style={{ color: C.bad, fontSize: 12 }}>{maps.error}</span>}</div></>}</div>
        {mp && mp.length > 0 && (() => {
          const x = mp.map((p) => p.rpm), col = (p) => (p.feasible ? C.ok : C.bad), g = (k) => mp.map((p) => p[k]);
          const ok = (p) => p.feasible, rf = maps.ui.ratingFrac ?? mcfg.ratingFrac;
          return <>
            <div className="bsc-panel"><h3>Target vs achieved torque</h3>
              <LineChart C={C} x={x} xlabel="engine speed (rpm)" ylabel="torque (lb-ft)" series={[{ y: g("targetLbft"), color: C.soft, name: "target", dash: "5 3" }, { y: g("achievedLbft"), color: C.c[0], name: "achieved" }]}
                dots={mp.map((p) => ({ x: p.rpm, y: p.achievedLbft, color: col(p), bad: !p.feasible }))} />
              <Legend items={[{ color: C.soft, name: "target" }, { color: C.c[0], name: "achieved" }, { color: C.bad, name: "red dot = infeasible" }]} />
              <div className="bsc-note">{mp.filter((p) => !ok(p)).map((p) => `${p.rpm}: ${p.note || p.binding}`).join(" / ") || "all points feasible"}</div></div>
            <div className="bsc-panel"><h3>Required boost</h3>
              <LineChart C={C} x={x} xlabel="engine speed (rpm)" ylabel="boost (kPa gauge)" y2label="boost (psi)" y2scale={1 / 6.895} series={[{ y: g("boostGauge"), color: C.c[1], name: "kPa gauge" }]}
                dots={mp.map((p) => ({ x: p.rpm, y: p.boostGauge, color: C.c[1], bad: !p.feasible }))} />
              <div className="bsc-note">MAP abs = {mp.map((p) => `${p.rpm}: ${fmt(p.mapKPa, 0)}`).join(" / ")} kPa</div></div>
            <div className="bsc-panel"><h3>Spark vs MBT</h3>
              <LineChart C={C} x={x} xlabel="engine speed (rpm)" ylabel={`spark (${deg} BTDC)`} series={[{ y: g("mbt"), color: C.c[3], name: "MBT", dash: "5 3" }, { y: g("spark"), color: C.c[2], name: "spark" }]}
                bands={[{ x, y0: g("spark"), y1: g("mbt"), color: C.c[2] }]} />
              <Legend items={[{ color: C.c[3], name: "MBT" }, { color: C.c[2], name: "spark used (shaded = retard)" }]} /></div>
            <div className="bsc-panel"><h3>Bearing load at the solution</h3>
              <LineChart C={C} x={x} xlabel="engine speed (rpm)" ylabel="% of rating" series={[{ y: g("rodPct"), color: C.c[2], name: "rod" }, { y: g("mainPct"), color: C.c[1], name: "main" }]}
                hlines={[{ y: 100 * rf, label: `limit ${fmt(100 * rf, 0)}%`, color: C.bad }]} />
              <Legend items={[{ color: C.c[2], name: "rod" }, { color: C.c[1], name: "worst main" }]} /></div>
          </>;
        })()}
        {maps && maps.tables && <>
          <div className="bsc-panel bsc-wide"><h3>EMU ignition table (deg BTDC)</h3><div className="bsc-note">MAP kPa absolute across, rpm down (descending). Colour: advance, low (amber) to high (green).</div>
            <Grid t={maps.tables.ign} colKey="mapBins" kind="ign" dp={1} C={C} /><CsvBar id="ign" csv={maps.tables.ign.csv} /></div>
          <div className="bsc-panel bsc-wide"><h3>Boost target table (kPa gauge)</h3><div className="bsc-note">Pedal % across, rpm down (descending). Spool retention ramps from {maps.ui.spoolKPa ?? mcfg.spool} kPa at 0 % pedal.</div>
            <Grid t={maps.tables.boost} colKey="pedalBins" kind="boost" dp={0} C={C} /><CsvBar id="boost" csv={maps.tables.boost.csv} /></div></>}
        <Eqs items={EQ.maps} />
      </div>}
      {tab === "mains" && <div className="bsc-charts">
        <div className="bsc-panel"><h3>Polar load - worst main (no. {r.worstMain + 1})</h3><div className="bsc-note">block frame, x across engine, y up the bore</div>
          <Polar pts={r.mainPolar} C={C} color={C.c[1]} label={`main ${r.worstMain + 1}`} /></div>

        <div className="bsc-panel"><h3>Oil film - worst main (no. {r.worstMain + 1})</h3>
          <LineChart C={C} x={th} xlabel={`crank angle (${deg} ATDC firing)`} ylabel={`film thickness (${mu}m)`} ydom={[0, Math.max(rangeOf([r.mainH])[1] * 1.05, minFilm * 2)]}
            series={[{ y: r.mainH, color: C.c[1], name: "main " + (r.worstMain + 1) }]} hlines={[{ y: minFilm, label: `min ${minFilm} ${mu}m`, color: C.bad }]} xticks={[-360, -180, 0, 180, 360]} /></div>
        <div className="bsc-panel"><h3>Main bearings 1-7</h3>
          <MainBars mains={r.mains} rating={rating} worst={r.worstMain} C={C} />
          <div className="bsc-tblw"><table className="bsc-tbl"><thead><tr><th>#</th><th>MPa</th><th>%</th><th>h min {mu}m</th><th>edge {mu}m</th><th>slope mrad</th><th>p film MPa</th></tr></thead>
            <tbody>{r.mains.map((m, i) => <tr key={i} style={i === r.worstMain ? { fontWeight: 700 } : null}><td>{i + 1}{i === r.worstMain ? " *" : ""}</td>
              <td style={{ color: pctCol(m.pctRating) }}>{fmt(m.peakMPa, 1)}</td><td>{fmt(m.pctRating, 0)}</td><td style={{ color: filmCol(m.hMin) }}>{fmt(m.hMin, 2)}</td>
              <td style={{ color: filmCol(m.edgeFilm) }}>{fmt(m.edgeFilm, 2)}</td><td>{fmt(m.slopeMrad, 2)}</td><td>{fmt(m.pFilmPeak, 0)}</td></tr>)}</tbody></table></div></div>

        <div className="bsc-panel"><h3>Crank deflection at peak main load</h3>
          <LineChart C={C} x={r.deflection.z} xlabel="position along crank (mm)" ylabel={`deflection (${mu}m)`}
            series={[{ y: r.deflection.wV, color: C.c[1], name: "vertical" }, { y: r.deflection.wH, color: C.c[4], name: "horizontal" }]} />
          <Legend items={[{ color: C.c[1], name: "vertical" }, { color: C.c[4], name: "horizontal" }]} />
          <div className="bsc-note">instant of peak main load: {fmt(r.deflection.theta, 0)}{deg} ATDC firing</div></div>

        <Eqs items={EQ.mains} />
      </div>}
      {tab === "rod" && (rb ? <div className="bsc-charts">
        <div className="bsc-tiles bsc-wide" style={{ margin: 0 }}>
          <Tile label="Peak unit load" value={fmt(r.rod.peakMPa, 1)} unit="MPa" sub={`${fmt(r.rod.pctRating, 0)}% of ${rating}`} color={pctCol(r.rod.pctRating)} />
          <Tile label="Peak film pressure" value={fmt(rb.pFilmPeak, 0)} unit="MPa" sub={`@ ${fmt(rb.pFilmPeakTheta, 0)}${deg}`} />
          <Tile label="Film / unit ratio" value={fmt(rb.ratioPeak, 1)} unit="x" />
          <Tile label="h min" value={fmt(r.rod.hMin, 2)} unit={mu + "m"} sub={`eps max ${fmt(r.rod.eps, 2)}`} color={filmCol(r.rod.hMin)} />
          <Tile label="Film temp / visc." value={fmt(r.rod.tFilmC, 0)} unit={deg + "C"} sub={`${fmt(r.rod.muFilm, 2)} mPa.s`} />
          <Tile label="Oil flow" value={fmt(r.rod.qLmin, 2)} unit="L/min" />
          <Tile label="Oil supply" value={r.rod.starved ? "STARVED" : "OK"} sub={r.rod.supplyMargin != null ? `pin feed ${fmt(r.rod.pFeedKPa / 6.89476, 0)} psi, hole ${fmt(r.rod.qOrificeLmin, 1)} vs ${fmt(r.rod.qDemandLmin, 2)} L/min` : ""} color={r.rod.starved ? C.bad : C.ok} /></div>
        <div className="bsc-panel"><h3>Unit load and peak film pressure</h3>
          <LineChart C={C} x={th} xlabel={`crank angle (${deg} ATDC firing)`} ylabel="MPa" series={[{ y: rb.unit, color: C.c[2], name: "unit load" }, { y: rb.pFilm, color: C.c[4], name: "film pressure" }]}
            hlines={[{ y: rating, label: `rating ${rating} MPa`, color: C.bad }]} xticks={[-360, -180, 0, 180, 360]} />
          <Legend items={[{ color: C.c[2], name: "unit load (load / projected area)" }, { color: C.c[4], name: "peak film pressure" }]} /></div>
        <div className="bsc-panel"><h3>Rod bearing oil film</h3>
          <LineChart C={C} x={th} xlabel={`crank angle (${deg} ATDC firing)`} ylabel={`film thickness (${mu}m)`} ydom={[0, Math.max(rangeOf([r.rod.h])[1] * 1.05, minFilm * 2)]}
            series={[{ y: r.rod.h, color: C.c[2], name: "rod" }]} hlines={[{ y: minFilm, label: `min ${minFilm} ${mu}m`, color: C.bad }]} xticks={[-360, -180, 0, 180, 360]} /></div>
        <div className="bsc-panel"><h3>Polar load - rod bearing</h3><div className="bsc-note">rod frame (rotates with the rod), equal axes</div>
          <Polar pts={r.rod.polar} C={C} color={C.c[2]} label="rod pin" /></div>
        <div className="bsc-panel"><h3>Journal orbit</h3><div className="bsc-note">eccentricity ratio inside the clearance circle (outer ring = 1.0, contact)</div>
          <Orbit orbit={rb.orbit} C={C} /></div>
        <Eqs items={EQ.rod} />
      </div> : <Missing what="rod-bearing fields (rodBrg)" />)}
      {tab === "pin" && (pn ? <div className="bsc-charts">
        <div className="bsc-tiles bsc-wide" style={{ margin: 0 }}>
          <Tile label={"σ bend"} value={fmt(pn.sigmaBend, 0)} unit="MPa" />
          <Tile label={"σ oval"} value={fmt(pn.sigmaOval, 0)} unit="MPa" />
          <Tile label={"τ shear"} value={fmt(pn.tauShear, 0)} unit="MPa" />
          <Tile label="Ovalization" value={fmt(pn.ovalUm, 1)} unit={mu + "m"} />
          <Tile label="Boss pressure" value={fmt(pn.pBoss, 0)} unit="MPa" />
          <Tile label="Small-end pressure" value={fmt(pn.pSmallEnd, 0)} unit="MPa" />
          <Tile label="Static SF" value={fmt(pn.sfStatic, 2)} color={sfCol(pn.sfStatic)} />
          <Tile label="Fatigue SF" value={fmt(pn.sfFatigue, 2)} color={sfCol(pn.sfFatigue)} />
          <Tile label="Peak comp / tens" value={fmt(pn.peakComp, 1)} unit="kN" sub={`tension ${fmt(pn.peakTens, 1)} kN`} /></div>
        <div className="bsc-panel"><h3>Pin axial load</h3><div className="bsc-note">compression +, tension -</div>
          <LineChart C={C} x={th} xlabel={`crank angle (${deg} ATDC firing)`} ylabel="pin load (kN)" series={[{ y: pn.load, color: C.c[1], name: "pin load" }]} hlines={[{ y: 0, label: "", color: C.soft }]} xticks={[-360, -180, 0, 180, 360]} /></div>
        <div className="bsc-panel"><h3>Pin, bosses and small end</h3><PinSchematic u={applied} C={C} /></div>
        <Eqs items={EQ.pin} />
      </div> : <Missing what="wrist-pin fields (pin)" />)}
      {tab === "buck" && (bk ? <div className="bsc-charts">
        <div className="bsc-tiles bsc-wide" style={{ margin: 0 }}>
          <Tile label="Peak compression" value={fmt(bk.peakComp, 1)} unit="kN" sub={`@ ${fmt(bk.peakCompTheta, 0)}${deg}`} />
          <Tile label="Peak tension" value={fmt(bk.peakTens, 1)} unit="kN" />
          <Tile label="Section area" value={fmt(bk.areaMm2, 0)} unit="mm2" />
          <Tile label={"σ comp"} value={fmt(bk.sigmaComp, 0)} unit="MPa" sub={`tension ${fmt(bk.sigmaTens, 0)} MPa`} />
          <Tile label="Slenderness in-plane" value={fmt(bk.inPlane.slender, 0)} sub={`out-of-plane ${fmt(bk.outPlane.slender, 0)}`} />
          <Tile label="Pcr in-plane" value={fmt(bk.inPlane.pcr, 0)} unit="kN" sub={`L eff ${fmt(bk.inPlane.leff, 0)} mm`} />
          <Tile label="Pcr out-of-plane" value={fmt(bk.outPlane.pcr, 0)} unit="kN" sub={`L eff ${fmt(bk.outPlane.leff, 0)} mm`} />
          <Tile label="SF in-plane" value={fmt(bk.inPlane.sf, 2)} color={sfCol(bk.inPlane.sf)} />
          <Tile label="SF out-of-plane" value={fmt(bk.outPlane.sf, 2)} color={sfCol(bk.outPlane.sf)} />
          <Tile label="Governing plane" value={String(bk.governing)} color={C.accent} />
          {bk.bolts && <>
            <Tile label="Bolts: cap load" value={fmt(bk.bolts.capLoadKN, 1)} unit="kN" sub="2 bolts share" />
            <Tile label="Per-bolt load" value={fmt(bk.bolts.perBoltKN, 1)} unit="kN" />
            <Tile label="Bolt preload" value={fmt(bk.bolts.preloadKN, 1)} unit="kN" />
            <Tile label="Separation SF" value={fmt(bk.bolts.sfSeparation, 2)} color={sfCol(bk.bolts.sfSeparation)} />
            <Tile label="Shank preload stress" value={fmt(bk.bolts.preloadStressMPa, 0)} unit="MPa" /></>}</div>
        <div className="bsc-panel"><h3>Rod axial load</h3><div className="bsc-note">compression +; dashed = critical load, both planes</div>
          <LineChart C={C} x={th} xlabel={`crank angle (${deg} ATDC firing)`} ylabel="rod load (kN)" series={[{ y: bk.load, color: C.c[2], name: "rod load" }]}
            hlines={[{ y: bk.inPlane.pcr, label: "pcr in-plane", color: C.c[4] }, { y: -bk.inPlane.pcr, label: "-pcr in-plane", color: C.c[4] }, { y: bk.outPlane.pcr, label: "pcr out-of-plane", color: C.c[5] }, { y: -bk.outPlane.pcr, label: "-pcr out-of-plane", color: C.c[5] }]} xticks={[-360, -180, 0, 180, 360]} /></div>
        <div className="bsc-panel"><h3>Rod section</h3><SectionSchematic u={applied} C={C} /></div>
        <Eqs items={EQ.buck} />
      </div> : <Missing what="rod-buckling fields (buckling)" />)}
      {tab === "cam" && (cm ? (() => {
        const ev = cm.events || {}, W = (a) => ((a % 720) + 720) % 720, tx = (a) => W(a) - 360;
        const order = Array.from({ length: 1440 }, (_, i) => i).sort((a, b) => W(th[a]) - W(th[b]));
        const cx = order.map((i) => tx(th[i])), pick = (a) => order.map((i) => a[i]);
        const rel = (k, v) => { if (v == null) return "-"; const x = tx(v), d = k === "ivc" ? x - 180 : k === "evo" ? x + 180 : x; const lab = { ivo: ["BTDC", "ATDC"], evc: ["BTDC", "ATDC"], ivc: ["BBDC", "ABDC"], evo: ["BBDC", "ABDC"] }[k]; return `${fmt(Math.abs(d), 1)}${deg} ${d < 0 ? lab[0] : lab[1]}`; };
        const evl = [["ivo", "IVO", C.c[1]], ["ivc", "IVC", C.c[1]], ["evo", "EVO", C.c[2]], ["evc", "EVC", C.c[2]]];
        const pair = (v) => (v && typeof v === "object" ? `${v.in ?? v[0]}/${v.ex ?? v[1]}` : v == null ? "-" : typeof v === "number" ? fmt(v, 1) : String(v));
        return <div className="bsc-charts">
          <div className="bsc-tiles bsc-wide" style={{ margin: 0 }}>
            {evl.map(([k, n]) => <Tile key={k} label={n + " @ 1 mm"} value={rel(k, ev[k])} />)}
            <Tile label="Overlap @ 1 mm" value={fmt(ev.overlap1, 1)} unit={deg} sub={`@ 0.1 mm ${fmt(ev.overlap01, 1)}${deg}`} />
            <Tile label="LSA" value={fmt(ev.lsa, 1)} unit={deg} />
            <Tile label="Effective CR" value={fmt(cm.effCR, 2)} sub={`static ${fmt(applied.cr, 1)}`} />
            <Tile label="VE" value={fmt(cm.ve, 3)} sub={applied.veMode === "cam" ? "in use" : "manual VE in use"} />
            <Tile label="Residual" value={fmt(cm.residual <= 1 ? cm.residual * 100 : cm.residual, 1)} unit="%" sub={applied.dilMode === "cam" ? "in use" : "not used (manual dilution)"} /></div>
          <div className="bsc-panel bsc-wide"><h3>Valve lift and piston position - {cm.name}</h3><div className="bsc-note">Gas-exchange cycle centred on overlap TDC (0). Dashed lines: 1 mm and 0.1 mm lift. Vertical marks: 1 mm events.</div>
            <LineChart C={C} x={cx} xdom={[-360, 360]} xlabel={`crank angle from overlap TDC (${deg}; - before, + after)`} ylabel="valve lift (mm)" y2label="piston below TDC (mm)"
              series={[{ y: pick(cm.liftIn), color: C.c[1], name: "intake" }, { y: pick(cm.liftEx), color: C.c[2], name: "exhaust" }, { y: pick(cm.piston), color: C.soft, name: "piston", axis: "r", dash: "4 3" }]}
              hlines={[{ y: 1, label: "1 mm", color: C.c[4] }, { y: 0.1, label: "0.1 mm", color: C.c[5] }]} vlines={evl.map(([k, n, color]) => ({ x: tx(ev[k]), label: n, color }))} xticks={[-360, -180, 0, 180, 360]} />
            <Legend items={[{ color: C.c[1], name: "intake lift" }, { color: C.c[2], name: "exhaust lift" }, { color: C.soft, name: "piston (right axis)" }]} /></div>
          <div className="bsc-panel bsc-wide"><h3>Grind comparison</h3>
            <div className="bsc-tblw"><table className="bsc-tbl"><thead><tr><th>grind</th><th>use</th><th>adv @0.1</th><th>dur @1 mm</th><th>lift mm</th><th>CL</th><th>IVO</th><th>IVC</th><th>EVO</th><th>EVC</th><th>springs</th><th>status / source</th></tr></thead>
              <tbody>{(cm.table || []).map((t, i) => { const src = typeof t.source === "string" ? (t.source.match(/\((https?:[^)]+)\)/) || t.source.match(/(https?:\S+)/) || [])[1] : null;
                return <tr key={i} style={t.grind === cm.name ? { fontWeight: 700 } : null}><td>{t.grind}</td><td style={{ textAlign: "left" }}>{t.use}</td><td>{pair(t.adv)}</td><td>{pair(t.dur1)}</td><td>{pair(t.lift)}</td><td>{pair(t.cl)}</td>
                  <td>{pair(t.ivo)}</td><td>{pair(t.ivc)}</td><td>{pair(t.evo)}</td><td>{pair(t.evc)}</td><td style={{ textAlign: "left" }}>{t.springs || "-"}</td>
                  <td style={{ textAlign: "left" }}>{t.verified === false && <span className="bsc-est" style={{ color: C.warn, borderColor: C.warn }}>unverified</span>}{src && <> <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>source</a></>}</td></tr>; })}</tbody></table></div>
            <div className="bsc-note" style={{ marginTop: 8 }}>Kelford figures from retailer listings; Kelford's own spec sheets were not read. Stock timing is an estimate.</div></div>
          <Eqs items={EQ.cam} />
        </div>;
      })() : <Missing what="camshaft fields (cam)" />)}
    </>);
  }

  return (
    <div ref={rootRef} className={"bsc-root" + (embedded ? " bsc-emb" : "")}
      style={{ "--bg": C.bg, "--panel": C.panel, "--panel2": C.panel2, "--ink": C.ink, "--soft": C.soft, "--line": C.line, "--accent": C.accent, "--deep": C.deep, "--warn": C.warn, colorScheme: dark ? "dark" : "light", minHeight: embedded ? "auto" : "100vh" }}>
      <style>{CSS}</style>
      <div className="bsc-wrap">
        {!embedded && <h1 className="bsc-h1">Crank Bearing Stress Calculator</h1>}
        {!embedded && <p className="bsc-sub">Peak bearing unit load, minimum oil film, the torque ceiling they set, and the boost and timing maps for a torque target. Presets: 1FZ-FE and 2JZ. A comparison tool: trust differences between settings more than any absolute figure.</p>}
        {enginesList.length > 1 && engineDefaults && <div className="bsc-tabs" style={{ marginBottom: 14 }}>{enginesList.map((e) => <button key={e.key} className={"bsc-tab" + (ui.engine === e.key ? " on" : "")} onClick={() => switchEngine(e.key)}>{e.label}</button>)}</div>}
        <div className="bsc-main">
          <div>
            <Det title="Operating point" open>
              <div className="bsc-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span>Boost{ui.useTarget ? " (solved)" : ""}</span>
                  <span style={{ fontFamily: MONO, color: "var(--accent)" }}>{fmt(boostPsi, 1)} psi / {fmt(mapShown, 0)} kPa abs</span></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="range" min="0" max="45" step="0.5" style={{ flex: 1, accentColor: C.accent }} value={Math.min(45, Math.max(0, boostPsi))} disabled={ui.useTarget}
                    onChange={(e) => set("mapKPa", +(101.3 + parseFloat(e.target.value) * 6.895).toFixed(1))} />
                  <input type="number" step="0.5" min="0" max="45" disabled={ui.useTarget} value={+boostPsi.toFixed(1)} style={{ width: 70, background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, padding: "4px 6px", fontFamily: MONO }}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) set("mapKPa", +(101.3 + v * 6.895).toFixed(1)); }} /></div></div>
              <div className="bsc-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span>Engine speed</span>
                  <span style={{ fontFamily: MONO, color: "var(--accent)" }}>{fmt(ui.rpm, 0)} rpm</span></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="range" min="800" max="7500" step="50" style={{ flex: 1, accentColor: C.accent }} value={Math.min(7500, Math.max(800, ui.rpm))}
                    onChange={(e) => set("rpm", parseFloat(e.target.value))} />
                  <input type="number" step="50" min="500" max="9000" value={ui.rpm} style={{ width: 70, background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, padding: "4px 6px", fontFamily: MONO }}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v) && v > 0) set("rpm", v); }} /></div></div>
              <div className="bsc-row"><button className={"bsc-btn sm" + (ui.useTarget ? " alt" : "")} onClick={() => set("useTarget", false)}>MAP</button>
                <button className={"bsc-btn sm" + (ui.useTarget ? "" : " alt")} onClick={() => set("useTarget", true)}>Target torque</button></div>
              <Num k="mapKPa" ui={ui} set={set} label="MAP (abs)" unit="kPa" disabled={ui.useTarget} />
              <Num k="targetTorqueLbft" ui={ui} set={set} label="Target torque" unit="lb-ft" disabled={!ui.useTarget} />
              <div className="bsc-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span>Spark advance{ui.sparkMbt ? " (MBT)" : ""}</span>
                  <span style={{ fontFamily: MONO, color: "var(--accent)" }}>{fmt(r && ui.sparkMbt ? r.cyl.mbt : ui.spark, 1)}{deg} BTDC{r ? ` / ${(() => { const d = (ui.sparkMbt ? r.cyl.mbt : ui.spark) - r.cyl.mbt; return Math.abs(d) < 0.25 ? "at MBT" : `${fmt(Math.abs(d), 1)}${deg} ${d < 0 ? "retarded" : "advanced"} from MBT`; })()}` : ""}</span></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="range" min="-10" max="50" step="0.5" style={{ flex: 1, accentColor: C.accent }} value={Math.min(50, Math.max(-10, ui.spark))} disabled={ui.sparkMbt}
                    onChange={(e) => set("spark", parseFloat(e.target.value))} />
                  <input type="number" step="0.5" min="-10" max="50" disabled={ui.sparkMbt} value={ui.spark} style={{ width: 70, background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6, padding: "4px 6px", fontFamily: MONO }}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) set("spark", v); }} /></div>
                <div className="bsc-row"><button className="bsc-btn sm alt" disabled={!r || ui.sparkMbt} onClick={() => r && set("spark", +r.cyl.mbt.toFixed(1))}>Snap to MBT{r ? ` (${fmt(r.cyl.mbt, 1)}${deg})` : ""}</button>
                  <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!ui.sparkMbt} onChange={(e) => set("sparkMbt", e.target.checked)} />Track MBT</label></div></div>
              <Sel k="fuel" ui={ui} set={set} label="Fuel" opts={OPTIONS.fuels} />
              <Num k="lambda" ui={ui} set={set} label="Lambda" step="0.01" />
              <Num k="dilution" ui={ui} set={set} label={ui.dilMode === "cam" ? "Dilution (cam residual)" : "Dilution (EGR+residual)"} unit="%" disabled={ui.dilMode === "cam"} shown={ui.dilMode === "cam" && r && r.cam ? +(r.cam.residual <= 1 ? r.cam.residual * 100 : r.cam.residual).toFixed(1) : undefined} />
              <Num k="mixing" ui={ui} set={set} label="Mixing quality 0-1" step="0.05" />
              <Num k="tumble" ui={ui} set={set} label="Tumble factor" step="0.05" />
              <Num k="tCharge" ui={ui} set={set} label="Charge temp at IVC" unit={deg + "C"} />
              <Num k="backRatio" ui={ui} set={set} label="Exhaust/intake pressure ratio" step="0.05" est />
              <Num k="ve" ui={ui} set={set} label={ui.veMode === "cam" ? "Volumetric eff. (cam)" : "Volumetric eff."} step="0.01" disabled={ui.veMode === "cam"} shown={ui.veMode === "cam" && r && r.cam ? +r.cam.ve.toFixed(3) : undefined} />
            </Det>
            <Det title="Geometry">
              <Num k="bore" ui={ui} set={set} label="Bore" unit="mm" /><Num k="stroke" ui={ui} set={set} label="Stroke" unit="mm" />
              <Num k="rod" ui={ui} set={set} label="Rod length c-c" unit="mm" est="Manley" /><Num k="cr" ui={ui} set={set} label="Compression ratio" step="0.1" />
              <Num k="pinOffset" ui={ui} set={set} label="Pin offset" unit="mm" step="0.1" /><Num k="desaxe" ui={ui} set={set} label={"Desaxé"} unit="mm" step="0.1" />
              <Num k="mRec" ui={ui} set={set} label="Recip. mass" unit="kg" step="0.01" est={ui.engine === "2JZ" ? "GTE rod 761 g, photo CG split" : "Manley 800 g, split est."} /><Num k="mRot" ui={ui} set={set} label="Rotating mass" unit="kg" step="0.01" est={ui.engine === "2JZ" ? "GTE rod 761 g, photo CG split" : "Manley 800 g, split est."} />
            </Det>
            <Det title="Bearings">
              <Sel k="rodClr" ui={ui} set={set} label="Rod clearance" opts={OPTIONS.clearance} />
              <Num k="rodClrCustom" ui={ui} set={set} label="Rod custom (diametral)" unit="mm" step="0.001" disabled={ui.rodClr !== "custom"} />
              <Sel k="mainClr" ui={ui} set={set} label="Main clearance" opts={OPTIONS.clearance} />
              <Num k="mainClrCustom" ui={ui} set={set} label="Main custom (diametral)" unit="mm" step="0.001" disabled={ui.mainClr !== "custom"} />
              <Num k="rodWidth" ui={ui} set={set} label="Rod shell width" unit="mm" step="0.1" /><Num k="mainWidth" ui={ui} set={set} label="Main shell width" unit="mm" step="0.1" />
              <Num k="grooveWidth" ui={ui} set={set} label="Groove width" unit="mm" step="0.1" />
              <Num k="ratingMPa" ui={ui} set={set} label="Unit-load rating" unit="MPa" /><Num k="minFilmUm" ui={ui} set={set} label="Min film accepted" unit={mu + "m"} step="0.1" />
              <label className="bsc-note" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}><input type="checkbox" checked={!!ui.edgeInLimit} onChange={(e) => set("edgeInLimit", e.target.checked)} />
                <span>Count main edge film (journal slope × half width) toward the limit and ceiling. Off by default: it treats the shell as rigid, ignores housing tilt, and rests on the estimated web factor and cap stiffness. Always shown in the mains table.</span></label>
            </Det>
            <Det title="Camshaft">
              <label className="bsc-f" style={{ gridColumn: "1/-1" }}><span>Grind</span>
                <select value={ui.cam} onChange={(e) => set("cam", e.target.value)}>{camList.map((o) => { const n = typeof o === "string" ? o : o.name; return <option key={n} value={n}>{n === "Stock" ? "Stock (est.)" : n}</option>; })}</select></label>
              {[["inAdv", "Intake cam-gear advance"], ["exAdv", "Exhaust cam-gear advance"]].map(([k, l]) => <div key={k} className="bsc-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span>{l}</span><span style={{ fontFamily: MONO, color: "var(--accent)" }}>{ui[k] > 0 ? "+" : ""}{fmt(ui[k], 1)}{deg} (+ = earlier)</span></div>
                <input type="range" min="-10" max="10" step="0.5" style={{ width: "100%", accentColor: C.accent }} value={ui[k]} onChange={(e) => set(k, parseFloat(e.target.value))} /></div>)}
              <div className="bsc-row"><span style={{ fontSize: 12 }}>VE</span><button className={"bsc-btn sm" + (ui.veMode === "cam" ? "" : " alt")} onClick={() => set("veMode", "cam")}>cam</button><button className={"bsc-btn sm" + (ui.veMode === "cam" ? " alt" : "")} onClick={() => set("veMode", "manual")}>manual</button>
                <span style={{ fontSize: 12, marginLeft: 8 }}>Dilution</span><button className={"bsc-btn sm" + (ui.dilMode === "cam" ? "" : " alt")} onClick={() => set("dilMode", "cam")}>cam</button><button className={"bsc-btn sm" + (ui.dilMode === "cam" ? " alt" : "")} onClick={() => set("dilMode", "manual")}>manual</button></div>
              <div className="bsc-note" style={{ gridColumn: "1/-1", margin: 0 }}>VE and dilution boxes in Operating point follow these modes. Manual enables the box; cam shows the computed value.</div>
            </Det>
            <Det title="Wrist pin">
              <Num k="mPistonGroup" ui={ui} set={set} label="Piston group mass" unit="kg" step="0.01" est /><Num k="pinOD" ui={ui} set={set} label="Pin OD" unit="mm" step="0.1" est="FSM" />
              <Num k="pinID" ui={ui} set={set} label="Pin ID" unit="mm" step="0.1" est /><Num k="pinLength" ui={ui} set={set} label="Pin length" unit="mm" est />
              <Num k="smallEndWidth" ui={ui} set={set} label="Small-end width" unit="mm" step="0.1" est="photo est." /><Num k="bossLength" ui={ui} set={set} label="Boss length (each)" unit="mm" step="0.1" est />
              <Num k="pinYield" ui={ui} set={set} label="Pin yield" unit="MPa" est /><Num k="pinFatigue" ui={ui} set={set} label="Pin fatigue limit" unit="MPa" est />
            </Det>
            <Det title="Rod section">
              <div className="bsc-note" style={{ gridColumn: "1/-1", margin: 0 }}>{preset && preset.rodLabel ? <b>{preset.rodLabel}</b> : !ui.engine || ui.engine === "1FZ-FE" ? <><b>Manley 14005-1 H-beam</b> (4340, ARP 2000 3/8 bolts)</> : <b>Rod section (preset estimates)</b>}</div>
              <div className="bsc-row"><button className={"bsc-btn sm" + (ui.rodOrient === "I" ? " alt" : "")} onClick={() => set("rodOrient", "H")}>H-beam</button>
                <button className={"bsc-btn sm" + (ui.rodOrient === "I" ? "" : " alt")} onClick={() => set("rodOrient", "I")}>I-beam</button></div>
              <Num k="beamHeight" ui={ui} set={set} label={ui.rodOrient === "I" ? "Beam height (x)" : "Depth along crank axis (z)"} unit="mm" step="0.5" est="photo est." />
              <Num k="flangeWidth" ui={ui} set={set} label={ui.rodOrient === "I" ? "Flange width (z)" : "Plate width in swing plane (x)"} unit="mm" step="0.5" est="photo est." />
              <Num k="flangeThk" ui={ui} set={set} label={ui.rodOrient === "I" ? "Flange thickness" : "Plate thickness"} unit="mm" step="0.1" est="photo est." />
              <Num k="webThk" ui={ui} set={set} label={ui.rodOrient === "I" ? "Web thickness (z)" : "Web thickness (x)"} unit="mm" step="0.1" est="photo est." />
              <Num k="rodE" ui={ui} set={set} label="Rod E" unit="GPa" est="typ 4340" /><Num k="rodYield" ui={ui} set={set} label="Rod yield" unit="MPa" est="typ 4340" />
              <div className="bsc-note" style={{ gridColumn: "1/-1", margin: "4px 0 0" }}><b>Rod bolts</b></div>
              <Num k="boltPreloadKN" ui={ui} set={set} label="Preload per bolt" unit="kN" step="0.5" est="ARP stretch est." /><Num k="boltShankD" ui={ui} set={set} label="Shank Ø" unit="mm" step="0.1" est="photo est." />
            </Det>
            <Det title="Crank & block">
              <Num k="crankE" ui={ui} set={set} label="Crank E" unit="GPa" /><Num k="webFactor" ui={ui} set={set} label="Web stiffness factor" step="0.05" est />
              <Num k="mainPitch" ui={ui} set={set} label="Main pitch" unit="mm" est />
              <Num k="capKV" ui={ui} set={set} label="Cap stiffness vertical" unit="GN/m" step="0.1" est /><Num k="capKH" ui={ui} set={set} label="Cap stiffness horizontal" unit="GN/m" step="0.1" est />
            </Det>
            <Det title="Oil">
              <Sel k="oil" ui={ui} set={set} label="Grade" opts={OPTIONS.oils} />
              <Num k="sumpC" ui={ui} set={set} label="Sump temp" unit={deg + "C"} /><Num k="oilPsi" ui={ui} set={set} label="Gallery pressure" unit="psi" />
              <Num k="feedMain" ui={ui} set={set} label={"Main feed hole Ø"} unit="mm" step="0.5" est /><Num k="feedRod" ui={ui} set={set} label={"Rod feed hole Ø"} unit="mm" step="0.5" est />
            </Det>
            <div className="bsc-note">{err ? <span style={{ color: C.bad }}>Model error: {err}</span> : pending ? "recomputing..." : "up to date"} / "est." = estimated default, measure or tune.</div>
          </div>
          <div>{body}</div>
        </div>
        <p className="bsc-foot"><b style={{ color: C.ink }}>Not modelled:</b> knock, bearing elasticity (EHD), thermal distortion, torsional vibration, aeration.
          Comparison tool - trust differences between settings more than absolute numbers.</p>
      </div>
    </div>
  );
}

const Missing = ({ what }) => <div className="bsc-warn">Model not loaded: result has no {what}. The model needs the v0.2 rodpin module.</div>;

function Orbit({ orbit, C }) {
  const S = 320, c = S / 2, sc = c - 20, n = orbit.x.length;
  let d = ""; for (let i = 0; i < n; i++) d += (i ? "L" : "M") + (c + orbit.x[i] * sc).toFixed(1) + " " + (c - orbit.y[i] * sc).toFixed(1);
  return (
    <svg className="bsc-svg" viewBox={`0 0 ${S} ${S + 16}`}>
      {[0.25, 0.5, 0.75].map((v) => <circle key={v} cx={c} cy={c} r={v * sc} fill="none" stroke={C.line} strokeWidth="0.5" />)}
      <circle cx={c} cy={c} r={sc} fill="none" stroke={C.bad} strokeWidth="1.2" strokeDasharray="5 3" />
      <line x1="6" x2={S - 6} y1={c} y2={c} stroke={C.line} /><line y1="6" y2={S - 6} x1={c} x2={c} stroke={C.line} />
      <path d={d} fill="none" stroke={C.c[2]} strokeWidth="1.8" />
      <text x={c + 4} y={c - sc - 3} fontSize="9.5" fill={C.bad} fontFamily={MONO}>{"ε = 1"}</text>
      <text x={c} y={S + 12} textAnchor="middle" fontSize="11" fill={C.ink}>x, y: eccentricity ratio (bearing frame)</text>
    </svg>
  );
}

function PinSchematic({ u, C }) {
  const W = 520, H = 240, L = u.pinLength, k = 440 / L, x0 = 40, cy = 90, od = u.pinOD * k * 2.2, id = u.pinID * k * 2.2;
  const bl = u.bossLength * k, se = u.smallEndWidth * k, cx = W / 2;
  const dim = (xa, xb, y, t) => <g><line x1={xa} x2={xb} y1={y} y2={y} stroke={C.soft} strokeWidth="1" /><line x1={xa} x2={xa} y1={y - 4} y2={y + 4} stroke={C.soft} /><line x1={xb} x2={xb} y1={y - 4} y2={y + 4} stroke={C.soft} />
    <text x={(xa + xb) / 2} y={y - 5} textAnchor="middle" fontSize="10.5" fill={C.ink} fontFamily={MONO}>{t}</text></g>;
  return (
    <svg className="bsc-svg" viewBox={`0 0 ${W} ${H}`}>
      <rect x={x0} y={cy - od / 2 - 22} width={bl} height={od + 44} fill={C.panel2} stroke={C.line} /><rect x={x0 + L * k - bl} y={cy - od / 2 - 22} width={bl} height={od + 44} fill={C.panel2} stroke={C.line} />
      <rect x={cx - se / 2} y={cy - od / 2 - 16} width={se} height={od + 32} fill={C.panel2} stroke={C.c[4]} />
      <rect x={x0} y={cy - od / 2} width={L * k} height={od} fill={C.c[1]} opacity="0.35" stroke={C.c[1]} strokeWidth="1.5" />
      <rect x={x0} y={cy - id / 2} width={L * k} height={id} fill={C.bg} stroke={C.c[1]} strokeDasharray="3 3" />
      <text x={x0 + bl / 2} y={cy - od / 2 - 26} textAnchor="middle" fontSize="10" fill={C.soft}>boss</text><text x={x0 + L * k - bl / 2} y={cy - od / 2 - 26} textAnchor="middle" fontSize="10" fill={C.soft}>boss</text>
      <text x={cx} y={cy - od / 2 - 20} textAnchor="middle" fontSize="10" fill={C.c[4]}>small end</text>
      {dim(x0, x0 + L * k, cy + od / 2 + 40, `length ${u.pinLength} mm`)}{dim(x0, x0 + bl, cy + od / 2 + 64, `boss ${u.bossLength}`)}{dim(cx - se / 2, cx + se / 2, cy + od / 2 + 88, `small end ${u.smallEndWidth}`)}
      <text x={W - 8} y={H - 4} textAnchor="end" fontSize="10.5" fill={C.ink} fontFamily={MONO}>OD {u.pinOD} / ID {u.pinID} mm (diameter exaggerated)</text>
    </svg>
  );
}

function SectionSchematic({ u, C }) {
  const I = u.rodOrient === "I", Hh = u.beamHeight, B = u.flangeWidth, tf = u.flangeThk, tw = u.webThk, hw = Math.max(Hh - 2 * tf, 0);
  // drawn in the (x swing plane, z crank axis) end view: x horizontal, z vertical
  const ex = I ? Hh : B, ez = I ? B : Hh, k = 150 / Math.max(ex, ez), cx = 150, cz = 112;
  const rect = (x0, z0, w, h, key) => <rect key={key} x={cx + (x0 - ex / 2) * k} y={cz + (z0 - ez / 2) * k} width={w * k} height={h * k} fill={C.c[1]} opacity="0.45" stroke={C.c[1]} strokeWidth="1.2" />;
  const parts = I ? [rect(0, 0, tf, B, "a"), rect(Hh - tf, 0, tf, B, "b"), rect(tf, (B - tw) / 2, hw, tw, "w")]
                  : [rect(0, 0, B, tf, "a"), rect(0, Hh - tf, B, tf, "b"), rect((B - tw) / 2, tf, tw, hw, "w")];
  const lab = (t, xx, yy, a = "middle") => <text x={xx} y={yy} textAnchor={a} fontSize="10.5" fill={C.ink} fontFamily={MONO}>{t}</text>;
  const left = cx - ex * k / 2, right = cx + ex * k / 2, top = cz - ez * k / 2, bot = cz + ez * k / 2;
  const lines = I ? [`beam height ${Hh} (x)`, `flange width ${B} (z)`, `flange thk ${tf}`, `web thk ${tw} (z)`] : [`depth ${Hh} (z)`, `plate width ${B} (x)`, `plate thk ${tf}`, `web thk ${tw} (x)`];
  return (
    <svg className="bsc-svg" viewBox="0 0 320 300">
      {parts}
      <defs><marker id="bsc-ar" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7Z" fill={C.soft} /></marker></defs>
      <line x1={left - 6} y1={bot + 14} x2={left + 40} y2={bot + 14} stroke={C.soft} markerEnd="url(#bsc-ar)" />{lab("x (swing plane)", left + 44, bot + 18, "start")}
      <line x1={left - 14} y1={bot + 6} x2={left - 14} y2={bot - 40} stroke={C.soft} markerEnd="url(#bsc-ar)" />{lab("z (crank axis)", left - 18, bot - 44, "start")}
      {lines.map((t, i) => lab(t, 160, bot + 40 + i * 14))}
      {lab(`${I ? "I" : "H"}-beam as modelled, mm, to scale`, 160, 292)}
    </svg>
  );
}

// ---------- equations panels (formulas as implemented in model/*.js) ----------
// Mini markup: _{sub} and ^{sup}. Items: {h: "heading"} or [equation, plain-English note].
const M = (s) => String(s).split(/([_^]\{[^}]*\}|_[^\s{]|\^[0-9])/).map((t, i) => (t[0] === "_" && t.length > 1 ? <sub key={i}>{t[1] === "{" ? t.slice(2, -1) : t[1]}</sub> : t[0] === "^" && t.length > 1 ? <sup key={i}>{t[1] === "{" ? t.slice(2, -1) : t[1]}</sup> : t));
function Eqs({ items }) {
  return (
    <details className="bsc-det bsc-wide"><summary>Equations</summary>
      <div className="bsc-eqs">{items.map((it, i) => it.h ? <h4 key={i}>{it.h}</h4> : <div className="bsc-eq" key={i}><div className="m">{M(it[0])}</div><div className="d">{M(it[1])}</div></div>)}</div></details>
  );
}
const EQ = {
  overview: [
    { h: "Geometry and kinematics" },
    ["r = stroke/2;  e = desaxé + pin offset;  sin φ = (r sin θ − e) / l", "φ = rod angle. θ = 0 at firing TDC. Exact slider-crank with offset, no series expansion."],
    ["x = r cos θ + l cos φ;  V = V_c + A (x_{TDC} − x);  x_{TDC} = √((l + r)^{2} − e^{2})", "Piston height above the crank axis and cylinder volume. A = πB^{2}/4."],
    ["V_d = A (x_{TDC} − x_{BDC});  V_c = V_d / (CR − 1);  dV/dθ = A r sin(θ + φ) / cos φ", "Swept and clearance volume; analytic volume rate."],
    { h: "Charge at IVC" },
    ["m_{air} = VE · MAP · V_d / (R T_c) · (1 − x_d)/(1 − 0.05);  m_{fuel} = m_{air} / (λ · AFR_{st});  m_{tot} = (m_{air} + m_{fuel}) / (1 − x_d)", "R = 287 J/kg·K for everything (shortcut: no composition shift). T_c = charge temperature input. x_d = dilution mass fraction. Residual/EGR displaces fresh air: VE is read as fresh-air VE at 5 % dilution, so more dilution means less air."],
    ["T_{mix} = T_c − 0.35 m_{fuel} h_{fg} / (m_{air} c_p);  T_{IVC} = (1 − x_d) T_{mix} + x_d · 900 K;  p_{IVC} = m_{tot} R T_{IVC} / V_{IVC}", "35 % of the fuel's heat of vaporisation cools the air (c_p = 1005 J/kg·K); residual/EGR enters at 900 K. IVC and EVO come from the cam's 1 mm events."],
    { h: "Cylinder pressure, single zone, closed cycle IVC to EVO" },
    ["dp/dθ = [ (γ − 1)(dQ_c/dθ − dQ_w/dθ) − γ p dV/dθ ] / V;   T = p V / (m_{tot} R)", "First law per 0.5° step, Heun (RK2). Gas-exchange: p = MAP before IVC; after EVO it ramps linearly over 60° to BR · MAP, BR = exhaust/intake pressure ratio input (default 1.2); the exhaust stroke at BR · MAP sets pumping work."],
    ["γ(T) = min(1.40, 1.38 − 0.12 (T − 300) / 2200)", "Linear fit: 1.38 at 300 K, 1.26 at 2500 K."],
    ["x_b = 1 − exp(−5 u^{3});  u = (θ − θ_0)/Δθ;   dQ_c/dθ = Q_{tot} · 5 · 3 u^{2} exp(−5 u^{3}) / Δθ", "Wiebe, a = 5, m = 2 (Heywood p. 683). The 10–90 % angle sets the burn, so a only rescales the total duration."],
    ["Q_{tot} = m_{fuel} · LHV · η_c;  η_c = η_λ η_q;  η_λ = 1 (λ ≥ 1), else max(0.5, 1 − 1.2 (1 − λ));  η_q = 0.98 − 0.10 (1 − q)", "Rich mixtures lose 1.2 % of fuel energy per 1 % enrichment; q = mixing quality. LHV: gasoline 43.0, ethanol 26.8, methanol 19.9 MJ/kg."],
    ["dQ_w/dθ = h A_w (T − 450 K) / ω;   A_w = πB^{2}/2 + 4V/B", "Wall heat loss, wall at 450 K, flat head + piston + liner area."],
    ["h = 3.26 B^{−0.2} (p/1000)^{0.8} T^{−0.55} w^{0.8};   w = 2.28 S_p + 3.24×10^{−3} (V_d T_{IVC}/(p_{IVC} V_{IVC})) (p − p_m) [burning only]", "Woschni (no swirl), p in Pa, B in m. Motored reference p_m = p_{IVC}(V_{IVC}/V)^{1.3} (polytropic shortcut). S_p = 2 · stroke · N/60."],
    { h: "Flame speed and burn timing" },
    ["S_L = S_{L0} (T_u/298)^{α} (p/101325)^{β} (1 − 2.06 x_d^{0.77});   S_{L0} = B_m + B_φ (φ − φ_m)^{2};  φ = 1/λ", "Metghalchi–Keck form; T_u, p from the motored compression at spark; floor on S_{L0} of 0.02 m/s."],
    ["α = 2.18 − 0.8 (φ − 1);   β = −0.16 + 0.22 (φ − 1)   (gasoline: α = 2.4 − 0.271 φ^{3.51},  β = −0.357 + 0.14 φ^{2.77})", "Heywood Eq. 9.37 and 9.39 (p. 705). Table 9.2: gasoline B_m 0.305, B_φ −0.55 m/s, φ_m 1.21; isooctane 0.263, −0.85, 1.13; methanol 0.369, −1.40, 1.11. 91/93 use the gasoline row."],
    ["Ethanol: B_m 0.40, B_φ −2.00 m/s, φ_m 1.10, α 2.18, β −0.16;   E85 = 0.857·ethanol + 0.143·gasoline (mass-weighted)", "Heywood Table 9.2 ethanol row, p. 705 (verified against the PDF). The blend rule for E85 is a shortcut."],
    ["u′ = 0.75 S_p · tumble;   α_u = 0.0262 (T_u/300)^{0.8} / (ρ_u · 1100);   ρ_u = p/(R T_u);   δ_L = α_u / S_L", "Turbulence intensity at TDC (Heywood). α_u = thermal diffusivity of the unburned gas (air-like conductivity, c_p 1100): it falls as 1/p, so boost thins the flame."],
    ["S_T = max( S_L, 0.5 u′^{3/4} S_L^{1/2} α_u^{−1/4} L_t^{1/4} );   L_t = V_c / A", "Zimont turbulent flame speed, A = 0.5, L_t = full TDC clearance height."],
    ["Δθ_d = 6N · K_D ν^{1/3} L_t^{2/3} / (S_L S_T)^{2/3};   K_D = 4.011", "Spark to 10 % burned, in crank degrees. ν = μ/ρ_u, μ from Sutherland 1.458×10^{−6} T^{1.5}/(T + 110.4)."],
    ["Δθ_b = 6N · K_B (B/2) / S_T / (0.5 + 0.5 q);   K_B = 0.4011", "10–90 % duration. K_D, K_B are calibration constants (SPEC reference case: 91, λ 0.85, 3000 rpm, 100 kPa: ~15° delay, ~30° burn)."],
    ["Δθ = Δθ_b / (u_{90} − u_{10});  u_{x} = (−ln(1 − x) / 5)^{1/3};  θ_{10} = θ_s + Δθ_d;  θ_0 = θ_{10} − u_{10} Δθ;  CA50 = θ_0 + Δθ u_{50}", "Converts the two correlations into the Wiebe start and total duration. θ_s = −spark advance."],
    ["MBT = spark ∈ [0°, 50°] BTDC that maximises IMEP_g (golden section);   IMEP_g = ∮ p dV / V_{d,cyl}", "Gross IMEP over 720°. Knock is not modelled."],
    { h: "Forces on the piston and crank" },
    ["F_{gas} = (p − 1 bar) A;   F_{inertia} = m_{rec} ẍ;   F_{axial} = F_{gas} + F_{inertia};   ẍ = ω^{2} d^{2}x/dθ^{2}", "Positive = toward the crank, so inertia is negative near TDC (relieves the pin). m_{rec} = piston group + small end."],
    ["F_{rod} = F_{axial} / cos φ;   F_{side} = F_{axial} tan φ;   τ_{cyl} = F_{rod} r sin(θ + φ)", "Rod force, wall (side) thrust, driving torque of one cylinder."],
    ["τ_{ind}(θ) = Σ_{cyl} τ_{cyl}(θ − 120°·k);   order 1-5-3-6-2-4", "Six cylinders, same trace shifted by the firing phasing."],
    { h: "Brake torque and FMEP" },
    ["T_{brake} = [ IMEP_g (1 − 0.02) − FMEP ] · V_{d,total} / 4π;   FMEP = (0.6 + 0.1 N/1000 + 0.02 (N/1000)^{2}) bar", "N in rpm; 2 % load-proportional friction plus the speed polynomial (as project.py). Power = T_{brake} ω."],
    ["Target torque mode: bisect MAP on 30–700 kPa (30 steps, 0.2 kPa) until T_{brake} = target", "Spark and fuel rule held fixed while MAP moves."],
    { h: "Torque ceiling sweep (Run sweep)" },
    ["margin_{rodLoad} = rating / σ_{rod,pk} − 1;  margin_{mainLoad} likewise;  margin_{film} = h_{min} / h_{accept} − 1 (rod, main)", "σ = peak load / (d (l − groove)). Edge-film margin counts only if the 'edge film' box is ticked."],
    ["per rpm: bisect MAP on 60–650 kPa (9 halvings, ~1 kPa) for the largest MAP with min(margins) ≥ 0", "Spark per the slider, or MBT at each point if 'Track MBT' is on. The binding limit is the smallest margin just above the ceiling. Wrist pin, buckling and film pressure are reported but are not limits."],
  ],
  mains: [
    { h: "Load share: crank as a beam on elastic supports" },
    ["EI = f_{web} · E · π d_j^{4} / 64;   d_j = 69 mm, f_{web} default 0.45", "Equivalent crank bending stiffness. f_{web} is an estimate (throws are far softer than a round bar)."],
    ["13 nodes at pitch/2; Euler–Bernoulli element matrix (EI/L_e^{3})[12, 6L_e, −12, 6L_e; …];  K x = F;  K = K_{beam} + k at the 7 main nodes", "Six pin loads applied at the mid-span nodes, solved by Cholesky at every 0.5°, separately for x (horizontal, k_H) and y (vertical, k_V). Pitch and cap stiffness are estimates."],
    ["main load_m = k · w_m;   slope_m = (θ_x, θ_y) → √(θ_x^{2} + θ_y^{2})", "Reaction = spring force of the support. Journal slope from the shared rotation DOF."],
    ["F_{pin,beam} = rod force on the pin, WITHOUT the big-end centrifugal term", "Rotating masses are taken as balanced by the counterweights (as in the earlier Python script); the rod bearing carries the centrifugal load."],
    ["Caveat: on rigid supports the reactions do not depend on EI (statically indeterminate); half-each is only the pin-jointed limit", "Results rest on the estimated web factor and cap stiffness; compare settings, do not read absolutes."],
    { h: "Oil film (short bearing, Booker mobility)" },
    ["ξ = ε·ê_F;  η = ε·ê_⊥;  q = 1 − ξ;  M_∥ = q^{2.5} / (π (l/d)^{2});  M_⊥ = −4 η q^{1.5} / (π^{2} (l/d)^{2})", "ε = eccentricity vector (units of c), ê_F = unit vector of the load, ê_⊥ perpendicular to it."],
    ["dε/dt = F (c/R)^{2} / (μ l d) · (M_∥ ê_F + M_⊥ ê_⊥) + ω̄ (−ε_y, ε_x);   h = c (1 − |ε|)", "Journal-centre velocity. ω̄ = (ω_{journal} + ω_{sleeve})/2: main −ω/2. c = radial clearance. Dormand–Prince 5(4), rtol 1e−6, two cycles, the second reported. Grooved shells: two lands, each carries F/2 on width (l − g)/2."],
    { h: "Oil" },
    ["log_{10} log_{10}(ν + 0.7) = A − B log_{10} T;   μ = ν ρ;   ρ = 860 − 0.65 (T − 288.15) kg/m^{3}", "Walther / ASTM D341 through the grade's KV40 and KV100 (typical values per grade, not a specific product)."],
    ["μ_{film} = μ(T) · HTHS_{150} / μ(150 °C)", "Shear-thinning scale so the curve meets the grade's typical HTHS viscosity at 150 °C."],
    { h: "Film temperature, flow and oil supply" },
    ["T_{film} = T_{sup} + P_f / (ρ c_p Q);   c_p = 2000 J/kg·K (rise capped at 150 K)", "Fixed point on T (relaxed 0.5, stop at 0.1 K): hotter → thinner → more friction."],
    ["P_f = mean_θ [ μ π d l_e n U^{2} / (c √(1 − ε^{2})) ];   U = |ω_{journal} − ω_{sleeve}| d/2", "Petroff friction with an eccentricity factor over the full circumference (biased hot)."],
    ["Q = Q_{feed} + Q_{side};   Q_{feed} = min( π d c^{3} p_s (1 + 1.5 ε^{2}) / (6 μ L_e),  0.6 · (π/4) d_f^{2} √(2 p_s/ρ) )", "Martin-form land flow capped by the feed-hole orifice (C_d 0.6, no passage losses). L_e = (l − groove)/2; mean ε^{2} over the cycle. p_s = gallery pressure."],
    ["Q_{side} = n_{lands} · mean( c l_e d |M| )", "Squeeze-out through both ends from the film solution."],
    ["Q_{hole} = 0.6 · (π/4) d_f^{2} √(2 p_{feed}/ρ);   Q_{demand} = mean Q_{side} + π d c^{3} p_{feed} (1 + 1.5 ε^{2}) / (6 μ L_e)", "Oil the feed hole can pass at the available pressure, against the bearing's cycle-mean demand. The journal pumps its own side leakage as long as the hole is flooded, so demand is a mean, not the peak-instant squeeze-out."],
    ["supply margin = Q_{hole} / Q_{demand};   starved ⇔ p_{feed} ≤ 0 or margin < 1", "p_{feed} = gallery pressure for mains; for the rod, gallery + ρω^{2}(r^{2} − (d_{main}/2)^{2})/2 (cross-drilling head). Not modelled: pump capacity, passage losses, aeration — OK means the feed hole is not the limit."],
    { h: "Edge film and ratings" },
    ["h_{edge}(θ) = h(θ) − |slope(θ)| · l/2;   edge film = min_θ h_{edge}", "Rigid shell tilted by the journal slope. Ignores shell conformability and housing tilt, so it reads pessimistic; ≤ 0 flags edge contact."],
    ["unit load = max|F| / (d (l − groove));   worst main = smallest of (rating/σ − 1, h_{min}/h_{accept} − 1 [, edge])", "Main journal 69 mm. Peak film pressure per main uses the rod-bearing method (see Rod bearing tab)."],
  ],
  rod: [
    { h: "Loads on the crank pin" },
    ["F_{pin,x} = F_{rod} sin φ + m_{rot} r ω^{2} sin θ;   F_{pin,y} = −F_{axial} + m_{rot} r ω^{2} cos θ", "Rod force on the pin plus the big-end centrifugal load m_{rot} r ω^{2} (block frame: x across, y up the bore)."],
    ["rod frame:  F_{∥} = F_{rod} − m_{rot} r ω^{2} cos(θ + φ);   F_⊥ = m_{rot} r ω^{2} sin(θ + φ)", "Polar diagram. Load applied to the journal = minus this."],
    ["ω̄ = (−ω + φ̇)/2;   sliding speed = ω + φ̇;   φ̇ = ω r cos θ / (l cos φ)", "Mean of journal and rod (sleeve) speeds for the film; sliding speed for friction."],
    { h: "Film, temperature and flow" },
    ["Same mobility solution, Walther viscosity, T_{film}, Q_{feed} and Q_{side} as on the Mains tab", "Single land, no groove. d = 57 mm; c = radial clearance (FSM 0.032–0.050 diametral)."],
    ["p_{rod} = p_{gallery} + ½ ρ ω^{2} (r^{2} − (d_{main}/2)^{2})", "Rod feed pressure from the main-journal cross-drilling, centrifugal head. 1FZ assumption: drilling reaches radius ≈ throw r; passage losses ignored."],
    ["unit load = |F_{pin}| / (d l);   ratio = p_{max,film} / peak unit load", "Peak unit load includes the centrifugal term."],
    { h: "Peak oil-film pressure (steady short-bearing shape)" },
    ["p(θ, z) = A s(θ) (L^{2}/4 − z^{2});   s = ε sin θ / (1 + ε cos θ)^{3};   θ ∈ [0, π]", "Ocvirk. Only the converging half carries pressure; the diverging half is cavitated at ambient."],
    ["W = A L^{3} R M / 6;   M = |∫ s (cos θ, sin θ) dθ|;   A = 6W / (L^{3} R M)", "Fixes the amplitude from the load."],
    ["p_{max} = 1.5 W s_{max} / (L R M)   (ε → 0: (6/π) W / (d L));   ε clamped to [10^{−3}, 0.9995]", "Steady wedge applied at every crank angle with the dynamic ε. Ignores squeeze film, so it understates the transient spike. Reported only; not a limit."],
  ],
  pin: [
    { h: "Load" },
    ["F_{pin} = (F_{gas} + m_{pg} ẍ) / cos φ", "Piston-group inertia only (piston + rings + pin, m_{pg}); the small end's share of m_{rec} is excluded. Positive = compression."],
    { h: "Stresses (floating hollow pin: d = OD, k = ID/OD, L, boss b each, small end a)" },
    ["g = max(a, L − 2b);   σ_b = F (L + 2g − 1.5a) / (1.2 d^{3} (1 − k^{4}))", "Kolchin/Mahle bending form, g = gap between the bosses. Coefficients written from memory of Kolchin & Demidov: verify. A uniform-load beam model gives about 1.7× more (shown as σ_{bBeam} in the model, not used)."],
    ["K = max(1, 1.5 − 15 (k − 0.4)^{3})   (Schlaefer thick-pin correction, clamped ≥ 1)", "Multiplies the ovalization stresses."],
    ["σ_{o,outer,0°} = (F/(L d)) K [0.19 (2 + k)(1 + k)/(1 − k)^{2} − 1/(1 − k)]", "Ovalization hoop stress, four fibres (from memory of the same text, unverified):"],
    ["σ_{o,inner,0°} = −(F/(L d)) K [0.19 (1 + 2k)(1 + k)/((1 − k)^{2} k) + 1/(1 − k)]", "inner fibre in the load plane."],
    ["σ_{o,outer,90°} = −(F/(L d)) K [0.174 (2 + k)(1 + k)/(1 − k)^{2} + 0.636/(1 − k)]", "outer fibre at 90°."],
    ["σ_{o,inner,90°} = (F/(L d)) K [0.174 (1 + 2k)(1 + k)/((1 − k)^{2} k) − 0.636/(1 − k)]", "inner fibre at 90°. The tile shows the largest magnitude of the four."],
    ["Δd = 1.35 F/(E L) ((1 + k)/(1 − k))^{3} [0.1 − (k − 0.4)^{3}]", "Diametral ovalization; E = 205 GPa."],
    ["τ = (4/3)(V/A)(r_o^{2} + r_o r_i + r_i^{2}) / (r_o^{2} + r_i^{2});   V = F/2;   A = π(d^{2} − d_i^{2})/4", "Peak shear of a hollow circle at the boss/small-end gap."],
    ["p_{boss} = F / (2 d b);   p_{small end} = F / (d a)", "Projected-area bearing pressures."],
    { h: "Combination and safety factors" },
    ["σ_{e,0°} = √(σ_b^{2} + σ_b σ_{o,0°} + σ_{o,0°}^{2});   σ_{e,90°} = √(σ_{o,90°}^{2} + 3τ^{2});   σ_{eq} = max", "Von Mises with the worse sign at the bending fibre (0°) and with shear at 90° (conservative)."],
    ["SF_{static} = σ_y / (c · max|F|);   c = σ_{eq} per unit F", "σ_y = pin yield input (1100 MPa, estimate)."],
    ["σ_a = c (F_{max} − F_{min})/2;   σ_m = c (F_{max} + F_{min})/2;   1/SF_{fat} = σ_a/S_e + max(σ_m, 0)/S_{ut};   S_{ut} = σ_y / 0.85", "Goodman. S_e = pin fatigue limit input (500 MPa, estimate); S_{ut} is an estimate. Colours: < 1.0 red, < 1.5 amber."],
  ],
  buck: [
    { h: "Section (x = swing plane, z = crank axis)" },
    ["h_w = H − 2 t_f;   A = 2 t_f B + h_w t_w", "Same area either way. H = depth, B = plate/flange width, t_f = thickness, t_w = web thickness (Manley 14005-1 is an H-beam; dimensions are photo estimates)."],
    ["I-beam (plates at the x edges, t_f in x, B in z):   I_{x-bend} = 2 (B t_f^{3}/12 + B t_f ((H − t_f)/2)^{2}) + t_w h_w^{3}/12;   I_{z-bend} = 2 t_f B^{3}/12 + h_w t_w^{3}/12", "I_{x-bend} resists swing-plane deflection (in-plane); I_{z-bend} resists deflection along the crank axis."],
    ["H-beam (plates at ±z, B in x, t_f in z):   I_{in} = 2 t_f B^{3}/12 + h_w t_w^{3}/12;   I_{out} = 2 (B t_f^{3}/12 + B t_f ((H − t_f)/2)^{2}) + t_w h_w^{3}/12", "Same section turned 90°: the two second moments swap (in-plane = about z, out-of-plane = about x). r = √(I/A), λ = L_{eff}/r."],
    { h: "End conditions (assumed, not measured)" },
    ["in-plane: pinned–pinned, L_{eff} = L (c-c);   out-of-plane: fixed–fixed, L_{eff} = 0.5 L", "Pins rotate freely in the swing plane; bosses and the big-end width restrain the other plane."],
    { h: "Critical stress" },
    ["λ_t = √(2π^{2} E / S_y)", "Transition slenderness; E = rod modulus, S_y = rod yield (estimates)."],
    ["σ_{cr} = S_y − S_y^{2} λ^{2} / (4π^{2} E)   (λ ≤ λ_t, Johnson);   σ_{cr} = π^{2} E / λ^{2}   (λ > λ_t, Euler)", "Both equal S_y/2 at λ_t."],
    ["P_{cr} = σ_{cr} A;   SF = P_{cr} / F_c;   governing = plane with the lower SF", "F_c = peak compressive rod force."],
    { h: "Loads" },
    ["F_{rod} = (F_{gas} + m_{rec} ẍ) / cos φ;   σ_{comp} = F_c / A;   σ_{tens} = F_t / A", "Includes the small-end inertia (m_{rec}); excludes the big-end rotating mass, which the crank pin carries. F_t = peak tension (overspeed/exhaust-stroke inertia)."],
    ["Screening only: no imperfection, bending from offset loads, or fatigue", "Reported; not part of the torque ceiling."],
    { h: "Rod bolts (cap separation)" },
    ["F_{sep} = F_{tens,max} + m_{rot} r ω^{2};   per bolt = F_{sep} / 2", "Cap pulled off by the peak rod tension plus the big-end centrifugal load, conservatively with the whole rotating mass (cap mass unknown). Two bolts share it equally; no joint-stiffness load-sharing."],
    ["SF_{sep} = F_{preload} / (F_{sep}/2);   σ_{shank} = F_{preload} / A_{shank};   A_{shank} = π D^{2} / 4", "Separation margin: the preload that must be overcome before the joint opens. Colours: < 1.0 red, < 1.5 amber."],
    ["F_{preload} ≈ δ E A / L", "ARP stretch method: δ = 0.006 in (0.152 mm), E = 207 GPa steel, reduced-shank area and stressed length are guesses (~0.31 in, ~1.2 in) giving ~50 kN. Input is the preload; this is how the default was estimated. Install spec is stretch 0.0058–0.0062 in (torque 65 ft-lb)."],
  ],
  maps: [
    { h: "Map solver (calc.js: solvePoint, ignRow, emuTables)" },
    ["for each rpm bin: find MAP such that T_{brake}(MAP, spark) = target;   spark = MBT", "MAP by bisection on the same brake-torque model as the Overview tab (fuel, lambda, cam, VE as set). The torque target is brake lb-ft."],
    ["if peak unit load > ratingFrac · rating (rod or main): retard spark, re-solving MAP for the target each time, until it fits", "Retard searched in [MBT − 25°, MBT]. Bearing limit only: there is no knock model, so detonation margin is not part of the answer."],
    ["infeasible ⇔ no spark in [MBT − 25°, MBT] meets both bearing limits, or MAP > max MAP", "Infeasible points are drawn red; achieved torque there is the best the limits allow."],
    ["ignition row at an rpm: for each MAP bin, MBT with bearing-limited retard; advance never higher than the bin below (EMU monotone rule); 0.5° resolution", "Cells are degrees BTDC, 16 MAP bins (absolute kPa) × 20 rpm bins, rpm descending down the rows."],
    ["boost (kPa gauge) = MAP_{abs} − 101.3;  full-pedal column = solved line interpolated to the boost rpm bins", "EMU v3 boost target is gauge. 8 × 8: pedal % across, rpm down."],
    ["lower pedal columns: linear ramp from spool kPa at pedal 0 to the full value at the second-highest pedal bin", "Spool retention keeps low-pedal cells non-zero (default 60 kPa). The ramp shape is a convention, not a tuned response."],
    ["Table 1 = E0 (run with 91), table 2 = E100 (run with E100)", "Flex blending between the two tables is left to the ECU; this solver gives one fuel at a time."],
  ],
  cam: [
    { h: "Lift shape" },
    ["h(t) = L · cos^{n}(π t / (2 t_0)),   |t| < t_0", "t = crank degrees from the lobe centre, L = net valve lift. C1 at the ends since n > 1."],
    ["n = ln(1/L) / ln cos(π d / (2 t_0));   t_0 solved (bisection) so h = 0.1 mm at |t| = adv/2", "Fitted so lift is exactly 1.0 mm at |t| = dur_1/2 (d = dur_1/2) and 0.1 mm at half the 0.1 mm duration."],
    ["centre_{in} = −360 + cl_{in} − adv_{gear};   centre_{ex} = 360 − cl_{ex} − adv_{gear}", "Firing frame (overlap TDC at ±360). Gear advance, + = earlier. The 'adv' field is the duration at 0.1 mm."],
    { h: "Events" },
    ["IVO = c_i − dur/2;  IVC = c_i + dur/2;  EVO = c_e − dur/2;  EVC = c_e + dur/2", "At 1 mm (dur = dur_1) and at 0.1 mm. Displayed as BTDC/ABDC/BBDC/ATDC from these."],
    ["overlap = max(0, EVC − IVO − 720);   LSA = (cl_{in} + cl_{ex}) / 2", "IVC (1 mm) and EVO (1 mm) feed the combustion model; effective CR = V(IVC)/V_c."],
    { h: "Volumetric efficiency" },
    ["VE(N) = VE_{stock}(N · TA_{stock} / TA_{cam});   N clamped to 1000–7000 rpm", "Stock VE curve stretched by the ratio of intake time-area. Depends on the intake lobe only; cam-gear advance does not change VE (the integral is shift-invariant, ram and IVC effects are not modelled)."],
    ["TA = ∫ Q(h(t)) dt over the intake event;   Q from a PCHIP of (h/D = 0, .1, .2, .25, .3, .35, 1) → (0, .42, .78, .90, .97, 1, 1) × 245 cfm", "D = 37 mm valve (assumed). The flow curve and 245 cfm peak are as in project.py."],
    ["VE_{stock} = [ (T_q · 1.3558 · 4π / V_d + FMEP + 0.15 bar) / (1 − 0.02) ] / (ρ_{ref} Q_{gas} η_{gas})", "Back-calculated from an assumed stock torque curve (shape assumed, extrapolated above 4600 rpm): ρ_{ref} = 99 kPa/(287 · 298.15), Q_{gas} = 2.93 MJ/kg, η = 0.37, V_d = 4.477 L. An estimate."],
    { h: "Residual gas" },
    ["x_{res} = (1/r_c) BR^{1/γ} / [1 + 9.3 (r_c − 1) / r_c^{γ}]^{1/γ} + 0.09 (BR − 1) t_{ov};   γ = 1.3;   t_{ov} [ms] = overlap_{mean} / (6N) · 1000;   clamp 2–15 %", "First term: clearance-gas residual, Heywood Eq. 5.35 (p. 310), 3.1 % at r_c 9 and BR 1. Second term: overlap backflow; Heywood gives only an integral (Eq. 6.20), so the 0.09 per ms is a judgement figure. BR = exhaust/intake pressure ratio input."],
    ["Dilution mode 'cam': x_d = x_{res} (EGR = 0), otherwise the manual dilution %", "Feeds the charge-temperature mix and the flame-speed dilution factor on the Overview tab."],
  ],
};

// ---------- EMU map grids ----------
function Grid({ t, colKey, kind, dp, C }) {
  const cols = t[colKey], rows = t.rpmBins, order = rows.map((_, i) => i).sort((a, b) => rows[b] - rows[a]);
  let lo = Infinity, hi = -Infinity; t.cells.forEach((r) => r.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; }));
  const bg = (v) => { const f = hi > lo ? (v - lo) / (hi - lo) : 0.5; return kind === "ign" ? `hsla(${40 + 100 * f},65%,50%,0.45)` : `hsla(215,70%,50%,${0.08 + 0.5 * f})`; };
  return (
    <div className="bsc-tblw"><table className="bsc-tbl"><thead><tr><th>rpm \ {kind === "ign" ? "MAP" : "pedal %"}</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{order.map((i) => <tr key={i}><td><b>{rows[i]}</b></td>{t.cells[i].map((v, j) => <td key={j} style={{ background: bg(v) }}>{fmt(v, dp)}</td>)}</tr>)}</tbody></table></div>
  );
}

function CsvBar({ csv }) {
  const [msg, setMsg] = useState(""), [show, setShow] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(csv); setMsg("copied"); setShow(false); } catch { setShow(true); setMsg("clipboard blocked: select and copy below"); } };
  return <div style={{ marginTop: 8 }}><button className="bsc-btn sm alt" onClick={copy}>Copy CSV</button> <span className="bsc-note">{msg}</span>
    {show && <textarea readOnly value={csv} rows={8} onFocus={(e) => e.target.select()} style={{ width: "100%", fontFamily: MONO, fontSize: 11, background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 6 }} />}</div>;
}

function SweepChart({ pts, C }) {
  const x = pts.map((p) => p.rpm), y = pts.map((p) => p.torqueLbft);
  const W = 560, H = 260, pl = 52, pr = 14, pt = 22, pb = 38;
  const [x0, x1] = [Math.min(...x) - 100, Math.max(...x) + 100], [y0, y1] = [Math.min(0, ...y), Math.max(...y) * 1.1];
  const X = (v) => pl + ((v - x0) / (x1 - x0)) * (W - pl - pr), Y = (v) => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);
  const used = [...new Set(pts.map((p) => p.binding))];
  return (<>
    <svg className="bsc-svg" viewBox={`0 0 ${W} ${H}`}>
      {niceTicks(y0, y1, 5).map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke={C.line} strokeWidth="0.6" /><text x={pl - 5} y={Y(v) + 3} textAnchor="end" fontSize="10" fill={C.soft} fontFamily={MONO}>{tickFmt(v)}</text></g>)}
      {x.map((v) => <text key={v} x={X(v)} y={H - pb + 13} textAnchor="middle" fontSize="9.5" fill={C.soft} fontFamily={MONO}>{v}</text>)}
      <path d={pts.map((p, i) => (i ? "L" : "M") + X(p.rpm).toFixed(1) + " " + Y(p.torqueLbft).toFixed(1)).join("")} fill="none" stroke={C.soft} strokeWidth="1" />
      {pts.map((p, i) => <g key={i}><circle cx={X(p.rpm)} cy={Y(p.torqueLbft)} r="5" fill={C.c[BCOL[p.binding] ?? 0]}><title>{`${p.rpm} rpm: ${fmt(p.torqueLbft, 0)} lb-ft, MAP ${fmt(p.mapKPa, 0)} kPa, ${BIND[p.binding] || p.binding}`}</title></circle>
        {i % 2 === 0 && <text x={X(p.rpm)} y={Y(p.torqueLbft) - 9} textAnchor="middle" fontSize="9" fill={C.ink} fontFamily={MONO}>{fmt(p.torqueLbft, 0)}</text>}</g>)}
      <rect x={pl} y={pt} width={W - pl - pr} height={H - pt - pb} fill="none" stroke={C.line} />
      <text x={(pl + W - pr) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill={C.soft}>engine speed (rpm)</text>
      <text transform={`translate(12 ${(pt + H - pb) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill={C.soft}>torque ceiling (lb-ft)</text>
    </svg>
    <Legend items={used.map((b) => ({ color: C.c[BCOL[b] ?? 0], name: "binding: " + (BIND[b] || b) }))} />
  </>);
}
