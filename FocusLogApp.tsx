import * as React from "react";
import { NOTION_LOGO } from "./notionLogo";
import { SkyView } from "./SkyView";
import { ReflectPanel } from "./ReflectPanel";
const { useState, useEffect, useRef, useCallback } = React;

// Focus Log UI. `api` bridge from the plugin:
//   settings, getInitial(), saveSessions, savePending, saveTasks, sync, writeAct, notify(msg,ms), celebrate(), timer
// Scoring is enjoyment-based: expected enjoyment BEFORE, actual enjoyment AFTER.
// A higher actual is the good outcome (green); a lower actual is worse (red).

// Subscribe to the plugin-level timer engine. The engine is the single source of
// truth (it survives this panel closing and is shared with the floating window),
// so this panel just re-renders whenever the engine emits a change.
function useTimer(api: any) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!api.timer) return;
    return api.timer.subscribe(() => force((x: number) => x + 1));
  }, []);
  return api.timer ? api.timer.getState() : { secs: 0, total: 0, running: false, paused: false, lengthMin: 25, taskName: "", startedAt: null };
}

// CognitiveLoad letter shown before the task name: A red (high), B yellow (medium), C green (low).
const LOAD_COLOR: any = { A: "#b4533a", B: "#c79a2e", C: "#5b8c5a" };
const LOAD_LABEL: any = { A: "A — high load", B: "B — medium load", C: "C — low load" };
// ExecutionPower colour code: pink = Must Today, yellow = Aim Today (default), green = Bonus If Done.
const POWER_COLOR: any = { P: "#c96f86", Y: "#cda32f", G: "#6f9461" };
const POWER_LABEL: any = { P: "Must Today", Y: "Aim Today", G: "Bonus If Done" };

const WEEKDAY: any = {
  1: { h: 140, s: 42, name: "Mon" },
  2: { h: 210, s: 50, name: "Tue" },
  3: { h: 6, s: 58, name: "Wed" },
  4: { h: 32, s: 64, name: "Thu" },
  5: { h: 282, s: 40, name: "Fri" },
  6: { h: 0, s: 0, name: "Sat" },
  0: { h: 0, s: 0, name: "Sun" },
};
const BAND_L = [72, 52, 36];
const BAND_NAME = ["morning", "afternoon", "evening"];

const C: any = {
  paper: "#fdfbf6", card: "#fffefc", ink: "#2b2723", muted: "#8a8175",
  faint: "#cfc7b8", line: "#e4ddcf", better: "#5b8c5a", worse: "#b4533a", neutral: "#a59c8c",
};

// Work / Relax mode accents — orange marks a working day, dark green a rest day.
// `solid` paints the toggle + the schedule buttons; `fill`/`border` tint the relax routine rows.
export const MODE_COLORS = {
  work: { solid: "#d98324", fill: "#fbe7d4", border: "#e3a45f" },
  relax: { solid: "#2f6f4f", fill: "#e4efe8", border: "#6aa386" },
};

const DAY = 86400000;
const startOfDay = (d: any) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
function weekStartOf(d: any, sundayStart?: boolean) { const x = startOfDay(d); const k = sundayStart ? x.getDay() : (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; }
// Hours to shift a timestamp before taking its calendar date. A morning start (0–12)
// pushes the boundary later into the morning, so late-night work stays on the previous
// day (subtract). An evening start (13–23) rolls the day over that night, so the late
// hours fall on the next date (add).
const dayShift = (s: any) => { const h = (s.dayStart || 0) / 60; return h <= 12 ? h : h - 24; };
const logicalDay = (ts: any, s: any) => startOfDay(new Date(ts).getTime() - dayShift(s) * 3600000);
const logicalWeekStart = (ts: any, s: any) => weekStartOf(logicalDay(ts, s), s.weekStartsSunday);
function bandOf(ts: any, s: any) {
  const d = new Date(ts);
  const m = d.getHours() * 60 + d.getMinutes();
  const ds = s.dayStart || 0;
  if (ds <= 720 && m < ds) return 2; // pre-dawn tail of a morning-offset day reads as evening
  if (m < s.morningEnd) return 0;
  if (m < s.afternoonEnd) return 1;
  return 2;
}
function timeColor(ts: any, s: any) {
  const w = WEEKDAY[logicalDay(ts, s).getDay()];
  return `hsl(${w.h} ${w.s}% ${BAND_L[bandOf(ts, s)]}%)`;
}
const weekdayInk = (wd: number) => { const w = WEEKDAY[wd]; return `hsl(${w.h} ${Math.max(w.s, 4)}% 40%)`; };
const sameLogicalDay = (a: any, b: any, s: any) => logicalDay(a, s).getTime() === logicalDay(b, s).getTime();
// Day/time settings are stored as minutes-from-midnight; show/edit them as HH:MM.
export const fmtHM = (min: number) => { const m = Math.max(0, Math.round(min || 0)); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
export const parseHM = (str: string): number | null => { const m = String(str).trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/); if (!m) return null; return Math.min(23, parseInt(m[1], 10) || 0) * 60 + Math.min(59, parseInt(m[2] || "0", 10) || 0); };
const fmtDate = (d: any) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtTime = (d: any) => new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
// enjoyment: higher actual than expected is better (green)
function gapColor(expected: number, actual: number) {
  if (actual > expected) return C.better;
  if (actual < expected) return C.worse;
  return C.neutral;
}
function verdictOf(expected: number, actual: number) {
  if (actual > expected) return "better than expected";
  if (actual < expected) return "worse than expected";
  return "as expected";
}
const hierarchyText = (t: any) => {
  if (!t.ancestor) return "";
  if (t.parent && t.ancestor && t.parent !== t.ancestor) return `${t.ancestor} \u00B7 ${t.parent}`;
  return t.ancestor || t.parent || "";
};

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Drop a single leading [tag] or #tag token (used when a category chip already shows the area).
function stripLeadingTag(title: string): string {
  const s = (title || "").trim();
  const m = s.match(/^(\[[^\]]*\]|#\S+)\s+/);
  return m ? s.slice(m[0].length) : s;
}

function Stat({ label, value, color, big }: any) {
  return (
    <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ fontFamily: "var(--fl-mono)", fontSize: big ? 34 : 20, color: color || C.ink }}>{value}</span>
      <span style={{ color: C.muted, fontSize: 11, letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}
function TomatoPips({ vivid, grey }: any) {
  const items: any[] = [];
  for (let i = 0; i < vivid; i++) items.push(<span key={"v" + i} style={{ fontSize: 13 }}>{"\u{1F345}"}</span>);
  for (let i = 0; i < grey; i++) items.push(<span key={"g" + i} style={{ fontSize: 13, opacity: 0.28 }}>{"\u{1F345}"}</span>);
  if (!items.length) return <span style={{ fontSize: 11, color: C.muted }}>{"\u2014"}</span>;
  return <span style={{ letterSpacing: 1 }}>{items}</span>;
}
const btn = (color: string, ghost?: boolean): any => ({
  padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${color}`, background: ghost ? "transparent" : color,
  color: ghost ? color : "#fff", fontSize: 13, cursor: "pointer", fontFamily: "var(--fl-display)",
});

function GroupChart({ group, sessions, settings }: any) {
  const [active, setActive] = useState<any>(null);
  const ordered = [...sessions].sort((a: any, b: any) => +new Date(a.ts) - +new Date(b.ts));
  const n = ordered.length;
  const dotMode = n > 8;
  const padL = 30, padR = 14, padT = 16, padB = dotMode ? 56 : 64;
  const step = dotMode ? 34 : 56;
  const W = padL + Math.max(n * step, 60) + padR;
  const H = 250;
  const plotT = padT, plotB = H - padB;
  const yOf = (s: number) => plotB - ((s - 1) / 4) * (plotB - plotT);
  const xOf = (i: number) => padL + i * step + step / 2;

  let trend: any = null;
  if (n >= 3) {
    const ys = ordered.map((d: any) => d.expected);
    const mx = (n - 1) / 2;
    const my = ys.reduce((a: number, b: number) => a + b, 0) / n;
    let num = 0, den = 0;
    ys.forEach((y: number, i: number) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
    const slope = den ? num / den : 0;
    const intc = my - slope * mx;
    trend = { x1: xOf(0), y1: yOf(intc), x2: xOf(n - 1), y2: yOf(intc + slope * (n - 1)) };
  }
  const avg = (k: string) => (n ? ordered.reduce((a: number, d: any) => a + d[k], 0) / n : 0);
  const avgGap = avg("actual") - avg("expected");

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 0" }}>
        <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0 }}>{group}</h3>
        <span style={{ color: C.muted, fontSize: 12, fontFamily: "var(--fl-mono)" }}>{n} {"\u{1F345}"}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", borderBottom: `1px solid ${C.line}` }}>
        <Stat label="avg expected" value={avg("expected").toFixed(1)} color={settings.beginColor} />
        <Stat label="avg actual" value={avg("actual").toFixed(1)} color={settings.endColor} />
        <Stat label="avg gap" value={(avgGap >= 0 ? "+" : "") + avgGap.toFixed(1)} color={avgGap > 0 ? C.better : avgGap < 0 ? C.worse : C.neutral} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ position: "relative", width: Math.max(W, 220) }}>
          <svg width={W} height={H} style={{ display: "block" }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <g key={s}>
                <line x1={padL} y1={yOf(s)} x2={W - padR} y2={yOf(s)} stroke={C.line} />
                <text x={6} y={yOf(s) + 4} fontSize={11} fill={C.muted} fontFamily="var(--fl-mono)">{s}</text>
              </g>
            ))}
            {trend && <line x1={trend.x1} y1={trend.y1} x2={trend.x2} y2={trend.y2} stroke={settings.beginColor} strokeWidth={1.5} strokeDasharray="2 4" opacity={0.55} />}
            {ordered.map((d: any, i: number) => {
              const x = xOf(i), yE = yOf(d.expected), yA = yOf(d.actual), on = active === d.id;
              return (
                <g key={d.id} onMouseEnter={() => setActive(d.id)} onMouseLeave={() => setActive((a: any) => (a === d.id ? null : a))} onClick={() => setActive((a: any) => (a === d.id ? null : d.id))} style={{ cursor: "pointer" }}>
                  <rect x={x - step / 2} y={plotT} width={step} height={plotB - plotT} fill="transparent" />
                  <line x1={x} y1={yE} x2={x} y2={yA} stroke={gapColor(d.expected, d.actual)} strokeWidth={on ? 4 : 2.5} />
                  <circle cx={x} cy={yE} r={on ? 6 : 4.5} fill={settings.beginColor} />
                  <circle cx={x} cy={yA} r={on ? 6 : 4.5} fill={settings.endColor} />
                  {dotMode ? (
                    <circle cx={x} cy={plotB + 18} r={6} fill={timeColor(d.ts, settings)} />
                  ) : (
                    <text x={x} y={plotB + 16} fontSize={9.5} fill={C.muted} textAnchor="end" fontFamily="var(--fl-mono)" transform={`rotate(-42 ${x} ${plotB + 16})`}>{fmtDate(d.ts)} {fmtTime(d.ts)}</text>
                  )}
                </g>
              );
            })}
          </svg>
          {active && (() => {
            const d = ordered.find((s: any) => s.id === active);
            if (!d) return null;
            const i = ordered.indexOf(d), x = xOf(i), tipW = 200, wrapW = Math.max(W, 220);
            const left = Math.max(4, Math.min(x - tipW / 2, wrapW - tipW - 4));
            const top = Math.max(2, Math.min(yOf(d.expected), yOf(d.actual)) - 64);
            return (
              <div style={{ position: "absolute", left, top, width: tipW, background: C.ink, color: "#fff", borderRadius: 6, padding: "8px 10px", lineHeight: 1.35, pointerEvents: "none", zIndex: 5, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
                <div style={{ fontFamily: "var(--fl-mono)", fontSize: 10.5, color: "#cfc7b8", marginBottom: 2 }}>{fmtDate(d.ts)} {fmtTime(d.ts)}</div>
                <div style={{ fontSize: 13, marginBottom: 3, wordBreak: "break-word" }}>{d.task}</div>
                <div style={{ fontFamily: "var(--fl-mono)", fontSize: 12.5 }}>
                  <span style={{ color: settings.beginColor }}>{d.expected}</span>
                  <span> {"\u2192"} </span>
                  <span style={{ color: settings.endColor }}>{d.actual}</span>
                  <span style={{ color: gapColor(d.expected, d.actual) }}> {verdictOf(d.expected, d.actual)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function Heatmap({ sessions, monthRef, settings }: any) {
  const year = monthRef.getFullYear(), month = monthRef.getMonth();
  const byDay: any = {};
  sessions.forEach((x: any) => {
    const d = logicalDay(x.ts, settings);
    if (d.getFullYear() === year && d.getMonth() === month) (byDay[d.getDate()] = byDay[d.getDate()] || []).push(x);
  });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = settings.weekStartsSunday ? new Date(year, month, 1).getDay() : (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: any[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const headers = settings.weekStartsSunday ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {headers.map((h) => (<div key={h} style={{ textAlign: "center", fontSize: 11, color: C.muted, fontFamily: "var(--fl-mono)", paddingBottom: 2 }}>{h}</div>))}
        {cells.map((d, idx) => {
          if (d === null) return <div key={"b" + idx} />;
          const date = new Date(year, month, d);
          const wd = date.getDay();
          const list = (byDay[d] || []).sort((a: any, b: any) => +new Date(a.ts) - +new Date(b.ts));
          return (
            <div key={d} style={{ minHeight: 56, border: `1px solid ${C.line}`, borderRadius: 6, padding: 4, background: C.paper }}>
              <div style={{ fontSize: 10.5, fontFamily: "var(--fl-mono)", color: weekdayInk(wd), marginBottom: 3 }}>{d}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                {list.map((x: any) => (<span key={x.id} title={`${x.task} \u00B7 ${BAND_NAME[bandOf(x.ts, settings)]}`} style={{ width: 9, height: 9, borderRadius: 2, background: timeColor(x.ts, settings) }} />))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 12, fontSize: 11, color: C.muted }}>
        {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
          <span key={wd} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: `hsl(${WEEKDAY[wd].h} ${WEEKDAY[wd].s}% 52%)` }} />{WEEKDAY[wd].name}
          </span>
        ))}
        <span style={{ marginLeft: 8 }}>lightness = time:</span>
        {BAND_L.map((L, i) => (<span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: `hsl(32 50% ${L}%)` }} />{BAND_NAME[i]}</span>))}
      </div>
    </div>
  );
}

function Scale({ value, onChange, color, label }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ color: C.muted, fontSize: 12 }}>{label}</label>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => onChange(s)} style={{ width: 38, height: 38, borderRadius: 8, border: `1.5px solid ${value === s ? color : C.faint}`, background: value === s ? color : "transparent", color: value === s ? "#fff" : C.ink, fontFamily: "var(--fl-mono)", cursor: "pointer" }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

// Last-6-months contributions heatmap: weeks as columns, Mon–Sun as rows, coloured by the day's
// pomodoro count. Computed from sessions grouped by logical day (so it respects the day-start).
const HEAT = ["#f3d9bf", "#ecbf8e", "#e09a55", "#d0703e", "#b94a2e", "#9a3420"]; // 6 levels, light → deep
const HEAT_EMPTY = "#e8e0cf"; // a day with 0 pomodoros
const DEFAULT_HEAT_TH = [1, 2, 4, 6, 9, 11]; // min pomodoros for each of the 6 colours
// Parse the settings string into six ascending positive thresholds (else the default).
function parseHeatTh(s: string): number[] {
  const nums = (s || "").split(/[^0-9]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length !== 6) return DEFAULT_HEAT_TH.slice();
  for (let i = 1; i < 6; i++) if (nums[i] <= nums[i - 1]) return DEFAULT_HEAT_TH.slice();
  return nums;
}
function ContribHeatmap({ sessions, settings }: any) {
  const CELL = 13, GAP = 3, MONTH_H = 14, HEAD_GAP = 4;
  const ymd = (d: any) => { const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const counts: any = {};
  sessions.forEach((s: any) => { const k = ymd(logicalDay(s.ts, settings)); counts[k] = (counts[k] || 0) + 1; });
  const now = startOfDay(new Date());
  const startMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const sun = !!settings.weekStartsSunday;
  const gridStart = weekStartOf(startMonth, sun);
  const weeks = Math.round((+weekStartOf(end, sun) - +gridStart) / (7 * DAY)) + 1;
  const TH = parseHeatTh(settings.heatThresholds);
  const heat = (n: number) => { if (!n) return HEAT_EMPTY; let lvl = 0; for (let i = 0; i < TH.length; i++) if (n >= TH[i]) lvl = i; return HEAT[lvl]; };
  const lvlLabel = (i: number) => { const lo = TH[i]; if (i === TH.length - 1) return lo + "+"; const hi = TH[i + 1] - 1; return hi <= lo ? String(lo) : lo + "-" + hi; };

  const cells: any[] = [];
  for (let dow = 0; dow < 7; dow++) for (let w = 0; w < weeks; w++) {
    const day = new Date(+gridStart + (w * 7 + dow) * DAY);
    const inRange = day >= startMonth && day <= end;
    const k = ymd(day), n = counts[k] || 0;
    cells.push(<div key={dow + "-" + w} title={inRange ? `${k}: ${n}${"\u{1F345}"}` : ""} style={{ width: CELL, height: CELL, borderRadius: 2, boxSizing: "border-box", background: inRange ? heat(n) : "transparent", border: `1px solid ${inRange ? C.line : "transparent"}` }} />);
  }
  const monthLabels: any[] = [];
  let cur = new Date(startMonth);
  while (cur <= end) {
    const col = Math.round((+weekStartOf(cur, sun) - +gridStart) / (7 * DAY));
    if (col >= 0 && col < weeks) monthLabels.push(<span key={+cur} style={{ position: "absolute", left: col * (CELL + GAP), fontSize: 10, color: C.muted, fontFamily: "var(--fl-mono)" }}>{cur.toLocaleDateString(undefined, { month: "short" })}</span>);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  const wdNames = sun ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const wd = wdNames.map((n, i) => (i === 0 || i === 2 || i === 4 ? n : ""));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, overflowX: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", paddingTop: MONTH_H + HEAD_GAP, gap: GAP, flexShrink: 0 }}>
          {wd.map((label, i) => (<div key={i} style={{ height: CELL, lineHeight: CELL + "px", fontSize: 9, color: C.muted, fontFamily: "var(--fl-mono)", textAlign: "right" }}>{label}</div>))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: HEAD_GAP }}>
          <div style={{ position: "relative", height: MONTH_H, width: weeks * (CELL + GAP) }}>{monthLabels}</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, ${CELL}px)`, gridTemplateRows: `repeat(7, ${CELL}px)`, gap: GAP, gridAutoFlow: "row" }}>{cells}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        {[{ c: HEAT_EMPTY, label: "0" }, ...HEAT.map((c, i) => ({ c, label: lvlLabel(i) }))].map((it: any, i: number) => (
          <span key={i} title={`${it.label} pomodoro${it.label === "1" ? "" : "s"}`} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ width: CELL, height: CELL, borderRadius: 2, background: it.c, border: `1px solid ${C.line}`, boxSizing: "border-box" }} />
            <span style={{ fontSize: 9, color: C.muted, fontFamily: "var(--fl-mono)" }}>{it.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const PIE = ["#b4533a", "#cda32f", "#5b8c5a", "#4e7d9c", "#9a6f9c", "#c0772e", "#6f9461", "#847bb2"];
// 12 macaron colours, assigned by name so an area/tag keeps the same colour in the list and the pie.
// 12 colours, each a {fill, border} pair, assigned to areas/tags by index.
export const MACARON = [
  { fill: "rgb(238, 201, 201)", border: "rgb(213, 144, 144)" }, // Rose
  { fill: "rgb(238, 219, 201)", border: "rgb(213, 179, 144)" }, // Apricot
  { fill: "rgb(238, 238, 201)", border: "rgb(213, 213, 144)" }, // Lemon
  { fill: "rgb(219, 238, 201)", border: "rgb(179, 213, 144)" }, // Lime
  { fill: "rgb(201, 238, 201)", border: "rgb(144, 213, 144)" }, // Green
  { fill: "rgb(201, 238, 219)", border: "rgb(144, 213, 179)" }, // Mint
  { fill: "rgb(201, 238, 238)", border: "rgb(144, 213, 213)" }, // Teal
  { fill: "rgb(201, 219, 238)", border: "rgb(144, 179, 213)" }, // Sky
  { fill: "rgb(201, 201, 238)", border: "rgb(144, 144, 213)" }, // Blue
  { fill: "rgb(219, 201, 238)", border: "rgb(179, 144, 213)" }, // Violet
  { fill: "rgb(238, 201, 238)", border: "rgb(213, 144, 213)" }, // Magenta
  { fill: "rgb(238, 201, 219)", border: "rgb(213, 144, 179)" }, // Pink
];
// A darker shade of a colour (for readable label text on a light fill).
export function darken(rgb: any, f: number): string {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(String(rgb));
  if (!m) return String(rgb);
  return `rgb(${Math.round(+m[1] * f)}, ${Math.round(+m[2] * f)}, ${Math.round(+m[3] * f)})`;
}
// Bare hover-reveal icon button (no box), like the Today-view lock toggle. Used for
// edit (pencil) / delete (trash) on every manager and session row.
const ICON_BTN: any = { background: "transparent", border: "none", boxShadow: "none", padding: 2, height: "auto", cursor: "pointer", color: "#8a8175", display: "inline-flex", flexShrink: 0 };
// The terracotta add button.
const ADD_BTN: any = { padding: "7px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "var(--fl-display)", background: "#C57B5A", border: "1px solid #C57B5A", color: "rgb(251, 248, 241)" };
// Small uppercase heading for the today-view groups (Work / Personal) and routine blocks.
const SECTION_HEAD: any = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#8a8175", margin: "2px 0 4px 2px", fontFamily: "var(--fl-display)" };
function polarPt(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function PieChart({ data, empty }: any) {
  const total = data.reduce((a: number, d: any) => a + d.value, 0);
  if (!total) return <p style={{ color: C.muted, fontSize: 13 }}>{empty || "Nothing logged yet."}</p>;
  const cx = 80, cy = 80, r = 70;
  let angle = -90;
  const slices = data.map((d: any) => {
    const frac = d.value / total, a0 = angle, a1 = angle + frac * 360;
    angle = a1;
    const large = frac > 0.5 ? 1 : 0;
    const p0 = polarPt(cx, cy, r, a0), p1 = polarPt(cx, cy, r, a1);
    const path = frac >= 1
      ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
      : `M ${cx} ${cy} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
    return { ...d, path, frac };
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <svg width={160} height={160} style={{ flexShrink: 0 }}>
        {slices.map((s: any, i: number) => (<path key={i} d={s.path} fill={s.color} stroke={C.card} strokeWidth={1.5} />))}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {slices.map((s: any, i: number) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 11, height: 11, borderRadius: 2, background: s.color }} />{s.label}
            <span style={{ color: C.muted, fontFamily: "var(--fl-mono)" }}>{s.value} ({Math.round(s.frac * 100)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Pause-tag categories: internal = the impulse came from you (yellow); external =
// something outside interrupted you (blue). Fills are soft; borders are the strong
// hue used for the left bar, the pill, and the pie slices.
const PAUSE_CAT: any = {
  internal: { fill: "#FBEFC9", border: "#D9A521" },
  external: { fill: "#DCEAF6", border: "#3E78B2" },
};
const catOf = (cat: any): string => (cat === "external" ? "external" : "internal");
const catColor = (cat: any) => PAUSE_CAT[catOf(cat)].fill;
const catBorder = (cat: any) => PAUSE_CAT[catOf(cat)].border;

// Lucide "rotate-ccw", inline so it renders inside the React panel (used for reset).
function RotateCcwIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function LockIcon({ size = 13, open = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      {open ? <path d="M7 11V7a5 5 0 0 1 9.9-1" /> : <path d="M7 11V7a5 5 0 0 1 10 0v4" />}
    </svg>
  );
}
function PencilIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
function TrashIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}
function PlayIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" style={{ display: "block" }}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}
function PauseIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" style={{ display: "block" }}>
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}
function CheckIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function ArrowRightIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ListPlusIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M11 12H3" />
      <path d="M16 6H3" />
      <path d="M16 18H3" />
      <path d="M18 9v6" />
      <path d="M21 12h-6" />
    </svg>
  );
}

function SquarePenIcon({ size = 15 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

function SaveIcon({ size = 15 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function CircleXIcon({ size = 15 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function RefreshCwIcon({ size = 14, spin = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={spin ? "fl-spin" : undefined} style={{ display: "block" }}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function BriefcaseIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function UserIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CopyIcon({ size = 13 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function WandSparklesIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z" />
      <path d="m14 7 3 3" />
      <path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" />
    </svg>
  );
}

function Rows4Icon({ size = 15 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M21 7.5H3" /><path d="M21 12H3" /><path d="M21 16.5H3" />
    </svg>
  );
}

function TimelineIcon({ size = 15 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M4 12h.01" /><path d="M4 16h.01" /><path d="M4 20h.01" /><path d="M4 4h.01" /><path d="M4 8h.01" />
      <path d="M9.414 13.414a2 2 0 0 0 1.414.586H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 12z" />
      <path d="M9.414 21.414a2 2 0 0 0 1.414.586H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 20z" />
      <path d="M9.414 5.414A2 2 0 0 0 10.828 6H19a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 4z" />
    </svg>
  );
}

// A textarea that starts at one line and grows to fit its content as the text wraps.
function AutoTextarea({ value, onChange, placeholder, style }: any) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return <textarea ref={ref} value={value} onChange={onChange} placeholder={placeholder} rows={1} style={style} />;
}

function LogForm({ tasks, preset, onAdd, settings, secs, running, paused, resetTimer, pomoMin, changePomo, stepPomo, chooseNext, setChooseNext, nextTask, setNextTask, onStart, onPause, pauseActive, pauseTags, pauseTag, setPauseTag, tagColor, tagBorder, floatOn, setFloatOn, lenLocked, finished, onSetExpected, autoLogDefault, onAutoLogChange }: any) {
  const [task, setTask] = useState(preset || (tasks[0] && tasks[0].task) || "");
  const [exp, setExp] = useState(3);
  const [act, setAct] = useState(3);
  const [note, setNote] = useState("");
  const [markDone, setMarkDone] = useState(false);
  const [autoLog, setAutoLog] = useState(autoLogDefault !== false);
  const [showManual, setShowManual] = useState(false);
  // Press-and-hold the −/+ length buttons to repeat, accelerating the longer you hold.
  const holdRef = useRef<any>(null);
  const beginHold = (delta: number) => {
    stepPomo(delta);
    let delay = 300;
    const run = () => { stepPomo(delta); delay = Math.max(45, delay - 35); holdRef.current = setTimeout(run, delay); };
    holdRef.current = setTimeout(run, delay);
  };
  const endHold = () => { if (holdRef.current) { clearTimeout(holdRef.current); holdRef.current = null; } };
  useEffect(() => () => endHold(), []);

  useEffect(() => setTask(preset || (tasks[0] && tasks[0].task) || ""), [preset, tasks]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const meta: any = tasks.find((t: any) => t.task === task) || {};
  // Build and log the session with explicit ratings (so a tap-to-log doesn't race React state).
  const buildAndAdd = (actualVal: number, expectedVal: number) => {
    if (!task.trim()) return;
    // Minutes actually worked, from the countdown's progress (pauses freeze it, so
    // elapsed = work time): stopping a 25-min pomodoro with 10:00 left logs 15 min.
    // An untouched timer (a manual log) still records the full length.
    const workedSecs = pomoMin * 60 - secs;
    const workedMin = workedSecs > 0 ? Math.max(1, Math.round(workedSecs / 60)) : pomoMin;
    onAdd({ id: Date.now(), task: task.trim(), group: meta.group || task.trim(), hierarchy: hierarchyText(meta), load: meta.load || null, category: meta.category || null, url: meta.url || null, pageId: meta.id || null, ts: new Date().toISOString(), expected: expectedVal, actual: actualVal, note: note.trim(), minutes: workedMin }, markDone);
    setNote("");
    setMarkDone(false);
  };
  const submit = () => buildAndAdd(act, exp);
  // The "before" rating also rides on the timer engine, so a float quick-log carries it.
  const setExpected = (v: number) => { setExp(v); onSetExpected && onSetExpected(v); };
  // The "after" rating: with auto-log on, picking a number logs immediately — no button press.
  const rateActual = (v: number) => { setAct(v); if (autoLog) buildAndAdd(v, exp); };
  const toggleAuto = (v: boolean) => { setAutoLog(v); onAutoLogChange && onAutoLogChange(v); };
  const inputStyle: any = { border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 14, width: "100%", borderRadius: 6, padding: "8px 12px", boxSizing: "border-box", lineHeight: 1.5 };
  const logBtn = <button onClick={submit} style={{ ...btn(C.ink), width: "100%", padding: "10px" }}>log pomodoro + write Act</button>;
  const markDoneLabel = (
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13, color: C.ink, cursor: "pointer" }}>
      <input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.better, cursor: "pointer" }} />
      also set this task's status to Done in Notion
    </label>
  );
  const chooseNextControls = (
    <>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: chooseNext ? 8 : 14, fontSize: 12.5, color: C.ink, cursor: "pointer" }}>
        <input type="checkbox" checked={chooseNext} onChange={(e) => setChooseNext(e.target.checked)} style={{ width: 15, height: 15, accentColor: C.ink, cursor: "pointer" }} />
        pick the next task now (the log reopens to it after the break)
      </label>
      {chooseNext && (
        <select value={nextTask} onChange={(e) => setNextTask(e.target.value)} style={{ ...inputStyle, marginBottom: 14, padding: "10px 12px", lineHeight: 1.6, height: "auto", minHeight: 44 }}>
          <option value="">{"— next pomodoro: decide later —"}</option>
          {tasks.map((t: any) => (<option key={t.task} value={t.task}>{t.task}{t.king ? " \u{1F451}" : ""}</option>))}
        </select>
      )}
    </>
  );
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.line}` }}>
        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 30, color: secs === 0 ? C.better : C.ink }}>{mm}:{ss}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={lenLocked || pomoMin <= 5} onMouseDown={() => beginHold(-1)} onMouseUp={endHold} onMouseLeave={endHold} title={lenLocked ? "length is locked while a pomodoro is running" : "shorter — hold to speed up (min 5)"} style={{ ...btn(C.muted, true), padding: "6px 10px", opacity: (lenLocked || pomoMin <= 5) ? 0.4 : 1, cursor: lenLocked ? "not-allowed" : "pointer" }}>{"−"}</button>
          <button onClick={running ? onPause : () => onStart(task)} style={{ ...btn(C.ink), minWidth: 104 }}>{running ? "pause" : `${(paused || pauseActive) ? "resume" : "start"} ${pomoMin}m`}</button>
          <button disabled={lenLocked || pomoMin >= 30} onMouseDown={() => beginHold(1)} onMouseUp={endHold} onMouseLeave={endHold} title={lenLocked ? "length is locked while a pomodoro is running" : "longer — hold to speed up (max 30)"} style={{ ...btn(C.muted, true), padding: "6px 10px", opacity: (lenLocked || pomoMin >= 30) ? 0.4 : 1, cursor: lenLocked ? "not-allowed" : "pointer" }}>{"+"}</button>
          <button onClick={resetTimer} title="reset" aria-label="reset" style={{ ...btn(C.muted, true), padding: "7px 11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><RotateCcwIcon size={15} /></button>
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, fontSize: 12.5, color: C.muted, cursor: "pointer" }}>
        <input type="checkbox" checked={!!floatOn} onChange={(e) => setFloatOn(e.target.checked)} style={{ width: 15, height: 15, accentColor: C.ink, cursor: "pointer" }} />
        floating timer window — a small window that stays on top of your other apps
      </label>
      {pauseActive && (
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 8, background: C.paper, border: `1px solid ${C.faint}` }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: C.muted }}>Paused — why? Pick a tag; it's written to your note when you resume.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {pauseTags.length === 0 ? <span style={{ fontSize: 12, color: C.muted }}>No pause tags — add some in the Pause tab.</span> :
              pauseTags.map((pt: any) => {
                const on = pauseTag === pt.name;
                return <button key={pt.id} onClick={() => setPauseTag(on ? "" : pt.name)} style={{ padding: "5px 11px", borderRadius: 8, border: `${on ? 2 : 1.5}px solid ${catBorder(pt.category)}`, background: catColor(pt.category), color: C.ink, opacity: on ? 1 : 0.5, fontWeight: on ? 700 : 500, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--fl-display)", whiteSpace: "normal", maxWidth: "100%", height: "auto", minHeight: 0, lineHeight: 1.35 }}>{on ? "✓ " : ""}{pt.name}</button>;
              })}
          </div>
        </div>
      )}

      {/* The task picker stays visible in both phases — it's the page Act +1 writes to. */}
      <label style={{ color: C.muted, fontSize: 12 }}>task (Act +1 writes to this page)</label>
      <select value={task} onChange={(e) => setTask(e.target.value)} style={{ ...inputStyle, marginTop: 4, marginBottom: 12, padding: "10px 12px", lineHeight: 1.6, height: "auto", minHeight: 44 }}>
        {task && !tasks.some((t: any) => t.task === task) && <option value={task}>{task}</option>}
        {tasks.map((t: any) => (<option key={t.task} value={t.task}>{t.task}{t.king ? " \u{1F451}" : ""}</option>))}
      </select>

      {finished ? (
        /* ---------- AFTER the pomodoro: decide Done + next task first; the rating is the
             final tap — with auto-log on, it logs the moment you pick it. ---------- */
        <div style={{ marginTop: 4, padding: 14, borderRadius: 8, background: C.paper, border: `1px solid ${C.better}` }}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontFamily: "var(--fl-display)", color: C.ink }}>{"\u{1F389}"} Pomodoro done — how did it go?</p>
          {markDoneLabel}
          {chooseNextControls}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="quick note (optional)" style={{ ...inputStyle, marginBottom: 14, marginTop: 4 }} />
          <Scale label="after: how enjoyable was it actually? (1 dull ... 5 great)" value={act} onChange={rateActual} color={settings.endColor} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12.5, color: C.ink, cursor: "pointer" }}>
            <input type="checkbox" checked={autoLog} onChange={(e) => toggleAuto(e.target.checked)} style={{ width: 15, height: 15, accentColor: C.better, cursor: "pointer" }} />
            log to Obsidian automatically when I pick a rating
          </label>
          {autoLog
            ? <p style={{ fontSize: 12, color: C.muted, margin: "4px 0 0" }}>Set the options above first — picking a rating logs straight to Obsidian, no button needed.</p>
            : logBtn}
        </div>
      ) : (
        /* ---------- BEFORE the pomodoro: set the expectation, then start the timer ---------- */
        <div>
          <Scale label="before: how enjoyable do I expect this to be? (1 dull ... 5 great)" value={exp} onChange={setExpected} color={settings.beginColor} />
          <p style={{ fontSize: 12, color: C.muted, margin: "0 0 12px" }}>Start the timer; when it finishes you'll be asked to rate how it actually went.</p>
          <button onClick={() => setShowManual((s) => !s)} style={{ ...btn(C.muted, true), fontSize: 12.5, padding: "6px 10px" }}>{showManual ? "− hide manual log" : "+ log a pomodoro manually"}</button>
          {showManual && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
              <p style={{ fontSize: 12, color: C.muted, margin: "0 0 10px" }}>Logs the task above with the "before" rating as the expectation, and the timer's elapsed time (a full {pomoMin}m if the timer wasn't used).</p>
              <Scale label="after: how enjoyable was it actually? (1 dull ... 5 great)" value={act} onChange={setAct} color={settings.endColor} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="quick note (optional)" style={{ ...inputStyle, marginBottom: 14, marginTop: 4 }} />
              {markDoneLabel}
              {chooseNextControls}
              {logBtn}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionRow({ s, settings, onEdit, onDelete }: any) {
  const d = new Date(s.ts);
  return (
    <div className="fl-act-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: C.paper, border: `1px solid ${C.line}` }}>
      <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11, color: C.muted, minWidth: 96 }}>{fmtDate(d)} {fmtTime(d)}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.ink, overflowWrap: "anywhere" }}>{s.task}</div>
      <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, whiteSpace: "nowrap" }}>
        <span style={{ color: settings.beginColor }}>{s.expected}</span>
        <span style={{ color: C.muted }}> {"→"} </span>
        <span style={{ color: settings.endColor }}>{s.actual}</span>
      </span>
      <button onClick={() => onEdit(s)} className="fl-rowact" title="edit" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
      <button onClick={() => onDelete(s)} className="fl-rowact fl-rowdel" title="delete" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
    </div>
  );
}

function SessionEditRow({ draft, setDraft, settings, onSave, onCancel }: any) {
  const inputStyle: any = { border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "6px 10px", boxSizing: "border-box", fontFamily: "var(--fl-display)" };
  return (
    <div style={{ padding: 12, borderRadius: 6, background: C.card, border: `1.5px solid ${C.ink}`, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <label style={{ fontSize: 11, color: C.muted, display: "flex", flexDirection: "column", gap: 2 }}>
          time
          <input type="datetime-local" value={draft.ts} onChange={(e) => setDraft({ ...draft, ts: e.target.value })} style={{ ...inputStyle, paddingLeft: 14, minWidth: 220 }} />
        </label>
        <label style={{ fontSize: 11, color: C.muted, flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 2 }}>
          task
          <input type="text" value={draft.task} onChange={(e) => setDraft({ ...draft, task: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
        </label>
      </div>
      <Scale label="expected (before)" value={draft.expected} onChange={(v: number) => setDraft({ ...draft, expected: v })} color={settings.beginColor} />
      <Scale label="actual (after)" value={draft.actual} onChange={(v: number) => setDraft({ ...draft, actual: v })} color={settings.endColor} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={btn(C.muted, true)}>cancel</button>
        <button onClick={onSave} style={btn(C.ink)}>save</button>
      </div>
    </div>
  );
}

export default function FocusLogApp({ api }: any) {
  const init = api.getInitial();
  const [sessions, setSessions] = useState<any[]>(init.sessions);
  const [tasks, setTasks] = useState<any[]>(init.tasks);
  const [pending, setPending] = useState<any[]>(init.pending);
  const [doneSess, setDoneSess] = useState<any>({});
  const [view, setView] = useState("today");
  // Status view bundles the old week/month/totals; its right-side vertical control picks the sub-view.
  const [statusSub, setStatusSub] = useState("totals");
  const [preset, setPreset] = useState("");
  const [weekOff, setWeekOff] = useState(0);
  const [monthOff, setMonthOff] = useState(0);
  const [sync, setSync] = useState("idle");
  const [flash, setFlash] = useState("");
  const settings = api.settings;
  const [goal, setGoal] = useState<number>(Number(settings.dailyGoal) || 8);
  const [editingGoal, setEditingGoal] = useState(false);
  const saveGoal = (n: number) => { const g = Math.max(1, Math.min(99, Math.round(n) || 1)); setGoal(g); api.patchSettings && api.patchSettings({ dailyGoal: g }); setEditingGoal(false); };

  // The "pick the next task before a break" option. (Pomodoro length now lives in
  // the plugin-level timer engine — see useTimer below.)
  const [chooseNext, setChooseNextState] = useState<boolean>(settings.chooseNextTask !== false);
  const setChooseNext = (v: boolean) => { setChooseNextState(v); api.patchSettings && api.patchSettings({ chooseNextTask: v }); };
  const [nextTask, setNextTask] = useState<string>("");

  // Frozen (pinned) tasks, matched by NAME — Notion daily tasks are re-created with a
  // fresh id each day, so the name is the only stable handle.
  const [frozenNames, setFrozenNames] = useState<string[]>(Array.isArray(settings.frozenTaskNames) ? settings.frozenTaskNames : []);
  const toggleFreeze = (name: string) => {
    const next = frozenNames.includes(name) ? frozenNames.filter((n) => n !== name) : [...frozenNames, name];
    setFrozenNames(next);
    api.patchSettings && api.patchSettings({ frozenTaskNames: next });
  };
  // Display order: frozen first (in the sequence they were locked), then king, then
  // everyone else in the user's own drag order. Urgency (Must → Aim → Bonus) is only the
  // DEFAULT rank applied to newly arrived tasks at sync time — it never fights a drag.
  const tierOf = (t: any) => (frozenNames.includes(t.task) ? 0 : t.king ? 1 : 2);
  const orderedTasks = tasks.map((t, i) => ({ t, i })).sort((a, b) => {
    const ta = tierOf(a.t), tb = tierOf(b.t);
    if (ta !== tb) return ta - tb;
    if (ta === 0) return frozenNames.indexOf(a.t.task) - frozenNames.indexOf(b.t.task);
    return a.i - b.i;
  }).map((x) => x.t);

  // Group assignment: a task is Personal if pinned-to-personal by name, or its Area is
  // listed as a personal area in settings; everything else is Work. Personal pins are by
  // name (like freeze pins) so they survive daily Notion re-creation.
  const [personalNames, setPersonalNames] = useState<string[]>(Array.isArray(settings.personalTaskNames) ? settings.personalTaskNames : []);
  const togglePersonal = (name: string) => {
    const next = personalNames.includes(name) ? personalNames.filter((n) => n !== name) : [...personalNames, name];
    setPersonalNames(next);
    api.patchSettings && api.patchSettings({ personalTaskNames: next });
  };
  const personalAreas = Array.isArray(settings.personalAreas) ? settings.personalAreas : [];
  const isPersonal = (t: any) => personalNames.includes(t.task) || (!!t.category && personalAreas.includes(t.category));
  const workTasks = orderedTasks.filter((t) => !isPersonal(t));
  const personalTasks = orderedTasks.filter((t) => isPersonal(t));

  // Floating-window on/off, controllable right from the log view. The checkbox
  // tracks whether the window is actually open (synced via onFloatChange), so it
  // never gets stuck "on" after the window is closed with its own X — one click
  // always reopens it. Toggling on also enables auto-open on a fresh start.
  const [floatOn, setFloatOnState] = useState<boolean>(!!(api.floatingOpen && api.floatingOpen()));
  useEffect(() => {
    if (!api.onFloatChange) return;
    return api.onFloatChange(() => setFloatOnState(!!(api.floatingOpen && api.floatingOpen())));
  }, []);
  const setFloatOn = (v: boolean) => {
    setFloatOnState(v);
    api.patchSettings && api.patchSettings({ floatOnStart: v });
    if (v) { api.openFloating && api.openFloating(); }
    else { api.closeFloating && api.closeFloating(); }
  };
  // Pause state (pauseStart / pauseTag) now lives in the plugin-level timer engine,
  // shared with the floating window — see the timer block below.

  // Break activities + the post-log break timer.
  const [activities, setActivities] = useState<any[]>(init.activities || []);
  const saveActivities = (next: any[]) => { setActivities(next); api.saveActivities && api.saveActivities(next); };
  const [breaks, setBreaks] = useState<any[]>(init.breaks || []);
  const saveBreaks = (next: any[]) => { setBreaks(next); api.saveBreaks && api.saveBreaks(next); };
  // Personal routines (morning + night): fixed local lists, editable inline, with a
  // per-day check-off and an optional "run a pomodoro" on any item.
  const [morningRoutine, setMorningRoutine] = useState<any[]>(init.morningRoutine || []);
  const saveMorning = (next: any[]) => { setMorningRoutine(next); api.saveMorningRoutine && api.saveMorningRoutine(next); };
  const [nightRoutine, setNightRoutine] = useState<any[]>(init.nightRoutine || []);
  const saveNight = (next: any[]) => { setNightRoutine(next); api.saveNightRoutine && api.saveNightRoutine(next); };
  const [routineDone, setRoutineDone] = useState<any>(init.routineDone || {});
  // Relax-mode routines: a separate morning + night set shown on rest days / when the switch is Relax.
  const [relaxMorning, setRelaxMorning] = useState<any[]>(init.relaxMorningRoutine || []);
  const saveRelaxMorning = (next: any[]) => { setRelaxMorning(next); api.saveRelaxMorningRoutine && api.saveRelaxMorningRoutine(next); };
  const [relaxNight, setRelaxNight] = useState<any[]>(init.relaxNightRoutine || []);
  const saveRelaxNight = (next: any[]) => { setRelaxNight(next); api.saveRelaxNightRoutine && api.saveRelaxNightRoutine(next); };
  const [modeOverride, setModeOverride] = useState<any>(init.modeOverride || {});
  const [editRoutineId, setEditRoutineId] = useState<string | null>(null);
  const [editRoutineName, setEditRoutineName] = useState("");
  const [newMorning, setNewMorning] = useState("");
  const [newNight, setNewNight] = useState("");
  const [routineDrag, setRoutineDrag] = useState<{ w: string; i: number } | null>(null);
  const [routineOver, setRoutineOver] = useState<{ w: string; i: number } | null>(null);
  // Timeline (daily plan): timelineMode swaps the today list for the time axis.
  const [timelineMode, setTimelineModeState] = useState(false);
  const [plans, setPlans] = useState<any>(init.plans || {});
  const [tlDrag, setTlDrag] = useState<{ id: string; grab: number } | null>(null);
  const [editBlockId, setEditBlockId] = useState<string | null>(null);
  const [blockDraft, setBlockDraft] = useState<{ name: string; dur: number }>({ name: "", dur: 30 });
  const tlRef = useRef<HTMLDivElement | null>(null);
  const [longEvery, setLongEveryState] = useState<number>(settings.longBreakEvery || 3);
  const nowRef = useRef<HTMLDivElement | null>(null);
  const tlScrollRef = useRef<HTMLDivElement | null>(null);
  // On opening the timeline, scroll its own scroll area so the current time is centred.
  useEffect(() => {
    if (!timelineMode || !tlScrollRef.current) return;
    const { items } = tlLayout(todayBlocks());
    const d = new Date();
    const nmClock = d.getHours() * 60 + d.getMinutes();
    const nm = nmClock < (settings.dayStart ?? 240) ? nmClock + 1440 : nmClock;
    let nowY = 0;
    if (items.length) {
      const last = items[items.length - 1];
      if (nm <= items[0].t0) nowY = 0;
      else if (nm >= last.t1) nowY = last.topY + last.height;
      else for (const it of items) if (nm >= it.t0 && nm <= it.t1) { nowY = it.topY + (it.t1 > it.t0 ? (nm - it.t0) / (it.t1 - it.t0) * it.height : 0); break; }
    }
    tlScrollRef.current.scrollTop = Math.max(0, nowY - tlScrollRef.current.clientHeight / 2);
  }, [timelineMode]);
  const [expandedPast, setExpandedPast] = useState<Set<string>>(new Set());
  // The logged-history lists (All sessions / breaks / pauses) start folded.
  const [foldedHistory, setFoldedHistory] = useState<Set<string>>(new Set(["sessions", "breaks", "pauses"]));
  const toggleFold = (k: string) => setFoldedHistory((s: Set<string>) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  // The break is now owned by the shared timer engine (so the panel and the floating
  // window stay in lock-step). `brk` below is derived from the engine state; these
  // handlers just drive it through the api. The engine writes the finished break to the
  // log itself (commitBreak), and the panel re-reads activities/breaks via onBreaksChange.
  const [newAct, setNewAct] = useState<any>({ name: "", area: "" });
  const startBreak = (mins?: number) => api.timer.startBreak && api.timer.startBreak(mins);
  const togglePick = (id: string) => api.timer.toggleBreakPick && api.timer.toggleBreakPick(id);
  const endBreak = () => {
    api.timer.endBreak && api.timer.endBreak();
    if (chooseNext && nextTask) { setPreset(nextTask); setNextTask(""); resetTimer(); setView("log"); }
    else setView("today");
  };
  const addActivity = () => {
    const name = (newAct.name || "").trim();
    if (!name) return;
    saveActivities([...activities, { id: "a" + Date.now(), name, area: (newAct.area || "").trim() || "Other", count: 0, lastUsed: null }]);
    setNewAct({ name: "", area: "" });
  };
  const removeActivity = (id: string) => saveActivities(activities.filter((a) => a.id !== id));
  const [editActId, setEditActId] = useState<any>(null);
  const [editActDraft, setEditActDraft] = useState<any>({ name: "", area: "" });
  const startEditAct = (a: any) => { setEditActId(a.id); setEditActDraft({ name: a.name, area: a.area || "" }); };
  const saveEditAct = () => {
    const name = (editActDraft.name || "").trim();
    if (!name) return;
    saveActivities(activities.map((a) => a.id === editActId ? { ...a, name, area: (editActDraft.area || "").trim() || "Other" } : a));
    setEditActId(null);
  };
  const [actDrag, setActDrag] = useState<number | null>(null);
  const [actOver, setActOver] = useState<number | null>(null);
  const moveActivity = (from: number | null, to: number) => {
    if (from == null || from === to) return;
    const a = [...activities]; const [m] = a.splice(from, 1); a.splice(to, 0, m);
    saveActivities(a);
  };

  // Pause tags + recorded pause events.
  const [pauseTags, setPauseTags] = useState<any[]>(init.pauseTags || []);
  const savePauseTags = (next: any[]) => { setPauseTags(next); api.savePauseTags && api.savePauseTags(next); };
  const [pauses, setPauses] = useState<any[]>(init.pauses || []);
  const savePauses = (next: any[]) => { setPauses(next); api.savePauses && api.savePauses(next); };
  const [newPauseTag, setNewPauseTag] = useState("");
  const [newPauseCat, setNewPauseCat] = useState("internal");
  const [editTagId, setEditTagId] = useState<any>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagCat, setEditTagCat] = useState("internal");
  const addPauseTag = () => { const n = newPauseTag.trim(); if (!n) return; savePauseTags([...pauseTags, { id: "pt" + Date.now(), name: n, category: catOf(newPauseCat) }]); setNewPauseTag(""); };
  const removePauseTag = (id: string) => savePauseTags(pauseTags.filter((t) => t.id !== id));
  const saveEditTag = () => { const n = editTagName.trim(); if (!n) return; savePauseTags(pauseTags.map((t) => t.id === editTagId ? { ...t, name: n, category: catOf(editTagCat) } : t)); setEditTagId(null); };
  const [tagDrag, setTagDrag] = useState<number | null>(null);
  const [tagOver, setTagOver] = useState<number | null>(null);
  const moveTag = (from: number | null, to: number) => {
    if (from == null || from === to) return;
    const a = [...pauseTags]; const [m] = a.splice(from, 1); a.splice(to, 0, m);
    savePauseTags(a);
  };
  // One pause-tag row, shared by both category groups. `i` is the index in the full
  // pauseTags array so drag-reorder still works; drops are limited to same category.
  const renderTagRow = (t: any, i: number) => {
    const cat = catOf(t.category);
    if (editTagId === t.id) {
      return (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 10px", background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 6 }}>
          <select value={editTagCat} onChange={(e) => setEditTagCat(e.target.value)} style={{ border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 8px" }}>
            <option value="internal">internal</option>
            <option value="external">external</option>
          </select>
          <input value={editTagName} onChange={(e) => setEditTagName(e.target.value)} style={{ flex: 1, minWidth: 120, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 8px" }} />
          <button onClick={saveEditTag} title="save" aria-label="save" style={{ ...btn(C.ink), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SaveIcon size={15} /></button>
          <button onClick={() => setEditTagId(null)} title="cancel" aria-label="cancel" style={{ ...btn(C.muted, true), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><CircleXIcon size={15} /></button>
        </div>
      );
    }
    return (
      <div key={t.id}
        className="fl-act-row"
        onDragOver={(e) => { e.preventDefault(); if (tagOver !== i) setTagOver(i); }}
        onDrop={(e) => { e.preventDefault(); if (tagDrag != null && catOf(pauseTags[tagDrag] && pauseTags[tagDrag].category) === cat) moveTag(tagDrag, i); setTagDrag(null); setTagOver(null); }}
        style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 10px", background: "#fbf8f1", border: `1px solid ${C.line}`, borderLeft: `4px solid ${catBorder(cat)}`, borderRadius: 6, color: C.ink, opacity: tagDrag === i ? 0.4 : 1, boxShadow: tagOver === i && tagDrag !== null && tagDrag !== i ? `inset 0 2px 0 ${C.ink}` : "none" }}>
        <span draggable onDragStart={(e) => { setTagDrag(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }} onDragEnd={() => { setTagDrag(null); setTagOver(null); }} title="drag to reorder" style={{ display: "grid", gridTemplateColumns: "3px 3px", gap: 3, cursor: "grab", flexShrink: 0, padding: "2px 1px" }}>
          {Array.from({ length: 6 }).map((_, k) => (<span key={k} style={{ width: 3, height: 3, borderRadius: "50%", background: C.faint }} />))}
        </span>
        {!tinyPanel && <span style={{ minWidth: 88, flexShrink: 0, display: "flex", alignItems: "center" }}><span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", padding: "1px 8px", borderRadius: 999, background: catColor(cat), border: `1px solid ${catBorder(cat)}`, color: darken(catBorder(cat), 0.5), whiteSpace: "nowrap" }}>{cat}</span></span>}
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{t.name}</span>
        <button onClick={() => { setEditTagId(t.id); setEditTagName(t.name); setEditTagCat(cat); }} className="fl-rowact" title="edit" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
        <button onClick={() => removePauseTag(t.id)} className="fl-rowact fl-rowdel" title="delete" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
      </div>
    );
  };

  // Edit/delete for logged pause and break events (the "all sessions" lists).
  const [editPauseId, setEditPauseId] = useState<any>(null);
  const [pauseDraft, setPauseDraft] = useState<any>({ ts: "", tag: "" });
  const startEditPause = (p: any) => { setEditPauseId(p.id); setPauseDraft({ ts: toLocalDatetime(p.ts), tag: p.tag }); };
  const saveEditPause = () => {
    const t = pauseDraft.ts ? new Date(pauseDraft.ts).getTime() : NaN;
    savePauses(pauses.map((p) => p.id === editPauseId ? { ...p, ts: isNaN(t) ? p.ts : t, tag: pauseDraft.tag || p.tag } : p));
    setEditPauseId(null);
  };
  const deletePause = (id: string) => { savePauses(pauses.filter((p) => p.id !== id)); if (editPauseId === id) setEditPauseId(null); };
  const [editBreakId, setEditBreakId] = useState<any>(null);
  const [breakDraft, setBreakDraft] = useState<any>({ start: "", end: "", feeling: null });
  const startEditBreak = (b: any) => { setEditBreakId(b.id); setBreakDraft({ start: toLocalDatetime(b.start), end: toLocalDatetime(b.end), feeling: b.feeling ?? null }); };
  const saveEditBreak = () => {
    const s = breakDraft.start ? new Date(breakDraft.start).getTime() : NaN;
    const e = breakDraft.end ? new Date(breakDraft.end).getTime() : NaN;
    saveBreaks(breaks.map((b) => b.id === editBreakId ? { ...b, start: isNaN(s) ? b.start : s, end: isNaN(e) ? b.end : e, feeling: breakDraft.feeling ?? null } : b));
    setEditBreakId(null);
  };
  const deleteBreak = (id: string) => { saveBreaks(breaks.filter((b) => b.id !== id)); if (editBreakId === id) setEditBreakId(null); };

  // The timer is owned by the plugin-level engine (it survives this panel closing
  // and is shared, live, with the floating window). This panel reads its state and
  // drives it through the api — the milestone alerts and the finish celebration now
  // fire from the engine, so they happen no matter which window is in front.
  const timer = useTimer(api);
  const secs = timer.secs;
  const running = timer.running;
  const pomoMin = timer.lengthMin;
  const lenLocked = timer.running || timer.paused; // freeze −/+ while a pomodoro is active
  // Pause-with-reason state is owned by the engine (shared with the floating window);
  // the engine writes the pause event + daily-note block itself on resume/log/reset.
  const pauseActive = timer.pauseStart != null;
  const pauseTag = timer.pauseTag || "";
  const setPauseTag = (t: string) => api.timer.setPauseTag(t);
  const [reflections, setReflections] = useState<any[]>(init.reflections || []);
  const reflectFeelings = init.feelings && Object.keys(init.feelings).length ? init.feelings : {};
  const onSaveReflection = (r: any) => {
    const entry = { id: "rf" + Date.now(), ts: new Date().toISOString(), tag: pauseTag || "", thoughts: r.thoughts || [], body: r.body || [], mood: r.mood || [] };
    const next = [...reflections, entry];
    setReflections(next);
    api.saveReflections && api.saveReflections(next);
    api.notify && api.notify("Reflection saved", 1500);
  };

  const resetTimer = () => api.timer.reset();
  const changePomo = (n: number) => api.timer.setLength(n);
  const stepPomo = (delta: number) => api.timer.step(delta);
  const onStart = (taskName?: string) => api.timer.start(typeof taskName === "string" ? taskName : undefined);
  const onPause = () => api.timer.pause();
  const setExpectedRating = (n: number) => api.timer.setExpected && api.timer.setExpected(n);
  // A finished, not-yet-logged pomodoro: the countdown hit 0 but the timer hasn't been
  // reset (logging or reset clears startedAt). This drives the "after" rating section.
  const finished = timer.startedAt != null && !timer.running && !timer.paused && timer.secs === 0;

  // Break state, read straight off the engine (shared with the floating window).
  const brk = {
    active: !!timer.breakActive, secs: timer.breakSecs || 0, running: !!timer.breakRunning,
    finished: !!timer.breakFinished, picked: timer.breakPicked || [], feeling: timer.breakFeeling ?? null,
  };
  // During a break, the Break-activities rows double as the picker (tap to toggle).
  const isPicked = (a: any) => brk.active && brk.picked.includes(a.id);
  // Follow the engine into the break view whenever a break begins (e.g. one started from
  // the floating window), and refresh activities/breaks when the engine commits one.
  useEffect(() => { if (brk.active) setView("break"); }, [brk.active]);
  useEffect(() => {
    if (!api.onBreaksChange) return;
    return api.onBreaksChange(() => {
      const fresh = api.getInitial();
      setActivities([...(fresh.activities || [])]);
      setBreaks([...(fresh.breaks || [])]);
    });
  }, []);

  // Keep the local pauses list in sync when the engine writes one (e.g. paused +
  // resumed from the floating window while this panel was open), and let the float
  // celebration pull us to the log tab.
  useEffect(() => {
    if (!api.onPausesChange) return;
    return api.onPausesChange(() => setPauses([...(api.getPauses ? api.getPauses() : [])]));
  }, []);
  useEffect(() => {
    if (!api.onRequestLogView) return;
    return api.onRequestLogView(() => setView("log"));
  }, []);
  // A float quick-log adds a session (and may mark a task Done or choose the next task)
  // outside React; re-read everything it can touch, and adopt its next-task pick as the
  // log form's preset (the quick-log parks it on the engine's taskName).
  useEffect(() => {
    if (!api.onSessionsChange) return;
    return api.onSessionsChange(() => {
      const fresh = api.getInitial();
      setSessions([...(fresh.sessions || [])]);
      setTasks([...(fresh.tasks || [])]);
      setPending([...(fresh.pending || [])]);
      const tn = api.timer ? (api.timer.getState().taskName || "") : "";
      if (tn) setPreset(tn);
    });
  }, []);
  // When a pomodoro completes, pull the panel to the log tab so its "how did it go?" rating
  // is right there to fill in.
  useEffect(() => { if (finished) setView("log"); }, [finished]);

  // Session edit/delete state for Totals view.
  const [editingId, setEditingId] = useState<any>(null);
  const [editDraft, setEditDraft] = useState<any>(null);

  // Drag-to-reorder for the Today list. The order persists; on sync, queryToday keeps
  // already-ranked tasks in place and floats brand-new ones to the top.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const moveTask = (from: number | null, to: number) => {
    if (from == null || from === to) return;
    // Indices refer to the displayed (tier-sorted) list; the result is saved as the new
    // base order. The tier sort re-applies on render, so a drag across tiers snaps back
    // while a drag within a tier sticks.
    const a = [...orderedTasks];
    const [m] = a.splice(from, 1);
    a.splice(to, 0, m);
    setTasks(a);
    api.saveTasks(a);
    // Frozen tasks display in lock order, so a drag within the frozen group re-records
    // that sequence too.
    const nf = Array.from(new Set(a.filter((t) => frozenNames.includes(t.task)).map((t) => t.task)));
    if (nf.join(" ") !== frozenNames.join(" ")) {
      setFrozenNames(nf);
      api.patchSettings && api.patchSettings({ frozenTaskNames: nf });
    }
  };

  const persist = useCallback((next: any[]) => { setSessions(next); api.saveSessions(next); }, [api]);
  const savePending = useCallback((next: any[]) => { setPending(next); api.savePending(next); }, [api]);

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setEditDraft({ ts: toLocalDatetime(s.ts), task: s.task, expected: s.expected, actual: s.actual });
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };
  const saveEdit = () => {
    if (!editDraft) return;
    const trimmedTask = (editDraft.task || "").trim();
    const next = sessions.map((s) => {
      if (s.id !== editingId) return s;
      const tsIso = editDraft.ts ? new Date(editDraft.ts).toISOString() : s.ts;
      return { ...s, ts: tsIso, task: trimmedTask || s.task, expected: editDraft.expected, actual: editDraft.actual };
    });
    persist(next);
    cancelEdit();
  };
  const deleteSession = (s: any) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete this session?\n${s.task}`)) return;
    persist(sessions.filter((x) => x.id !== s.id));
    if (editingId === s.id) cancelEdit();
  };

  const doSync = async () => {
    setSync("loading");
    try { const fresh = await api.sync(); setTasks(fresh); setDoneSess({}); setSync("ok"); setFlash(fresh.length + " tasks loaded from Notion."); }
    catch (e: any) { setSync("error"); setFlash("Sync failed: " + (e?.message || e)); }
  };

  const logPomodoro = async (s: any, markDone?: boolean) => {
    persist([...sessions, s]);
    api.timer.commitPendingPause(); // write any open pause before clearing the timer
    resetTimer();
    const key = s.pageId || s.task;
    setDoneSess((m: any) => ({ ...m, [key]: (m[key] || 0) + 1 }));
    if (settings.breakEnabled) { startBreak(); setView("break"); } else { setView("today"); }
    let msg = "Logged.";
    if (s.pageId) {
      try { const act = await api.writeAct(s.pageId); msg += " Act" + (act != null ? " = " + act : " +1") + " written."; }
      catch (e: any) { savePending([...pending, { sessionId: s.id, pageId: s.pageId, task: s.task }]); msg += " Act write queued."; }
    } else { msg += " No Notion page linked."; }
    if (markDone && s.pageId && api.setDone) {
      try {
        const name = await api.setDone(s.pageId);
        const nt = tasks.filter((t) => t.id !== s.pageId);
        setTasks(nt); api.saveTasks(nt);
        msg += " Status set to " + name + ".";
      } catch (e: any) { msg += " Mark-done failed: " + (e?.message || e); }
    }
    if (api.appendDaily) {
      try { await api.appendDaily({ ts: +new Date(s.ts), minutes: s.minutes, task: s.task, hierarchy: s.hierarchy || "", note: s.note || "", category: s.category || null }); msg += " Added to daily note."; }
      catch (e: any) { msg += " Daily note skipped: " + (e?.message || e); }
    }
    setFlash(msg);
  };
  const retryPending = async () => {
    if (!pending.length) return;
    setFlash("Retrying " + pending.length + "\u2026");
    const still: any[] = [];
    for (const p of pending) { try { await api.writeAct(p.pageId); } catch (e) { still.push(p); } }
    savePending(still);
    setFlash(still.length ? still.length + " still pending." : "All pending writes pushed.");
  };

  const weekStart = new Date(logicalWeekStart(Date.now(), settings).getTime() + weekOff * 7 * DAY);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY);
  const weekSessions = sessions.filter((s) => { const d = logicalDay(s.ts, settings); return d >= weekStart && d < weekEnd; });
  // Week view groups by Area (the Notion select), merging every task that shares an
  // area into one chart. Sessions with no area are left out, so empty areas never
  // get a plot. First-seen order is kept.
  const weekAreas = Array.from(new Set(weekSessions.map((s) => s.category).filter(Boolean)));

  const nowLD = logicalDay(Date.now(), settings);
  const wkStartNow = logicalWeekStart(Date.now(), settings);
  const inWeek = sessions.filter((s) => { const d = logicalDay(s.ts, settings); return d >= wkStartNow && d < new Date(wkStartNow.getTime() + 7 * DAY); });
  const inMonth = sessions.filter((s) => { const d = logicalDay(s.ts, settings); return d.getMonth() === nowLD.getMonth() && d.getFullYear() === nowLD.getFullYear(); });
  const inYear = sessions.filter((s) => logicalDay(s.ts, settings).getFullYear() === nowLD.getFullYear());
  const countWeek = inWeek.length;
  const countMonth = inMonth.length;
  const countYear = inYear.length;
  const countToday = sessions.filter((s) => sameLogicalDay(s.ts, Date.now(), settings)).length;
  const sumMin = (arr: any[]) => arr.reduce((a, s) => a + (Number(s.minutes) || 25), 0);
  const hrsOf = (mins: number) => (Math.round(mins / 6) / 10).toFixed(1);
  const monthRef = new Date(nowLD.getFullYear(), nowLD.getMonth() + monthOff, 1);

  // Rating summary: how often the actual beat the expected, the average gap, and the biggest
  // positive surprises (dreaded but enjoyed).
  const rated = sessions.length;
  const betterCount = sessions.filter((s) => s.actual > s.expected).length;
  const betterPct = rated ? Math.round((100 * betterCount) / rated) : 0;
  const avgGapAll = rated ? sessions.reduce((a, s) => a + (s.actual - s.expected), 0) / rated : 0;
  const surprises = [...sessions]
    .filter((s) => s.actual > s.expected)
    .sort((a, b) => (b.actual - b.expected) - (a.actual - a.expected) || +new Date(b.ts) - +new Date(a.ts))
    .slice(0, 3);
  // Best time of day: average actual enjoyment per time band.
  const bandStats = [0, 1, 2].map((b) => {
    const list = sessions.filter((s) => bandOf(s.ts, settings) === b);
    return { band: b, name: BAND_NAME[b], count: list.length, avg: list.length ? list.reduce((a, s) => a + s.actual, 0) / list.length : null };
  });
  const bestBand = bandStats.filter((b) => b.avg != null).sort((a: any, b: any) => b.avg - a.avg)[0];

  // Break-feeling insights: only rated breaks (feeling 1-5) feed these; legacy/unrated breaks
  // (feeling null/undefined) are excluded everywhere.
  const ratedBreaks = breaks.filter((b: any) => b.feeling != null);
  // Per-activity restorative score: average feeling across every break whose activities include it.
  const actScore = activities.map((a: any) => {
    const list = ratedBreaks.filter((b: any) => (b.activities || []).includes(a.name));
    const n = list.length;
    return { id: a.id, name: a.name, area: a.area || "Other", n, avg: n ? list.reduce((x: number, b: any) => x + b.feeling, 0) / n : null };
  }).filter((x: any) => x.n > 0).sort((p: any, q: any) => (q.avg as number) - (p.avg as number) || q.n - p.n);
  // Best time of day for breaks — mirrors the pomodoro bandStats above.
  const breakBandStats = [0, 1, 2].map((b) => {
    const list = ratedBreaks.filter((x: any) => bandOf(x.start, settings) === b);
    return { band: b, name: BAND_NAME[b], count: list.length, avg: list.length ? list.reduce((a: number, x: any) => a + x.feeling, 0) / list.length : null };
  });
  const bestBreakBand = breakBandStats.filter((b) => b.avg != null).sort((a: any, b: any) => b.avg - a.avg)[0];
  // Falling-enjoyment nudge: average actual of today's last two pomodoros dropped >=1 vs the prior two.
  const todaySess = sessions.filter((s: any) => sameLogicalDay(s.ts, Date.now(), settings)).sort((a: any, b: any) => +new Date(a.ts) - +new Date(b.ts));
  const fallingEnjoyment = (() => {
    const n = todaySess.length;
    if (n < 4) return false;
    const last2 = (todaySess[n - 1].actual + todaySess[n - 2].actual) / 2;
    const prev2 = (todaySess[n - 3].actual + todaySess[n - 4].actual) / 2;
    return last2 <= prev2 - 1;
  })();

  // Break activity stats: most-reached-for (top 3), least (bottom 2), and the Area distribution.
  const actByCount = [...activities].sort((a, b) => (b.count || 0) - (a.count || 0));
  const favs = actByCount.filter((a) => (a.count || 0) > 0).slice(0, 3);
  const disliked = actByCount.slice().reverse().slice(0, 2);
  const areaAgg: any = {};
  activities.forEach((a) => { if ((a.count || 0) > 0) areaAgg[a.area || "Other"] = (areaAgg[a.area || "Other"] || 0) + (a.count || 0); });
  // Distinct areas/tags each take the next macaron colour (unique until there are more than 12).
  const areaNames = Array.from(new Set(activities.map((a) => a.area || "Other"))).sort();
  const areaIdx = (a: any) => Math.max(0, areaNames.indexOf(a)) % MACARON.length;
  const areaColor = (a: any) => MACARON[areaIdx(a)].fill;
  const areaBorder = (a: any) => MACARON[areaIdx(a)].border;
  const pieData = Object.keys(areaAgg).map((k) => ({ label: k, value: areaAgg[k], color: areaColor(k) }));

  // Pause stats: most common this week / month, and each tag's typical time of day over all history.
  const topPauseOf = (list: any[]) => { const c: any = {}; list.forEach((p) => (c[p.tag] = (c[p.tag] || 0) + 1)); const e = Object.entries(c).sort((a: any, b: any) => b[1] - a[1])[0]; return e ? { tag: e[0], n: e[1] as number } : null; };
  const pauseWeek = pauses.filter((p) => { const d = logicalDay(p.ts, settings); return d >= wkStartNow && d < new Date(wkStartNow.getTime() + 7 * DAY); });
  const pauseMonth = pauses.filter((p) => { const d = logicalDay(p.ts, settings); return d.getMonth() === nowLD.getMonth() && d.getFullYear() === nowLD.getFullYear(); });
  const topPauseWeek = topPauseOf(pauseWeek);
  const topPauseMonth = topPauseOf(pauseMonth);
  // Internal vs external pause counts per time band (a pause inherits its tag's category).
  const bandSplit = [0, 1, 2].map((bi) => {
    let internal = 0, external = 0;
    pauses.forEach((p: any) => {
      if (bandOf(p.ts, settings) !== bi) return;
      const tag = pauseTags.find((t: any) => t.name === p.tag);
      if (tag && catOf(tag.category) === "external") external++; else internal++;
    });
    return { internal, external };
  });
  const tagNamesSorted = pauseTags.map((t: any) => t.name).slice().sort();
  const tagIdx = (n: any) => Math.max(0, tagNamesSorted.indexOf(n)) % MACARON.length;
  const tagColor = (n: any) => MACARON[tagIdx(n)].fill;
  const tagBorder = (n: any) => MACARON[tagIdx(n)].border;
  const openLog = (leafTask: string) => { setPreset(leafTask); setView("log"); };

  // Panel width, so manager rows can shed metadata on narrow panels: below 520px
  // drop the count and last-used date; below 400px drop the tag pill too — the
  // activity name always keeps enough room to read.
  const rootRef = useRef<any>(null);
  const [panelW, setPanelW] = useState(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => { for (const e of entries) setPanelW(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrowPanel = panelW > 0 && panelW < 520;
  const tinyPanel = panelW > 0 && panelW < 400;

  const renderActRow = (a: any, i: number) => (
    editActId === a.id ? (
      <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap", padding: "6px 10px", background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 6 }}>
        <input value={editActDraft.area} onChange={(e) => setEditActDraft({ ...editActDraft, area: e.target.value })} placeholder="area" style={{ flex: 1, minWidth: 70, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 8px" }} />
        <AutoTextarea value={editActDraft.name} onChange={(e: any) => setEditActDraft({ ...editActDraft, name: e.target.value })} style={{ flex: 2, minWidth: 110, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 8px", fontFamily: "var(--fl-display)", lineHeight: 1.4, resize: "none", overflow: "hidden", boxSizing: "border-box" }} />
        <button onClick={saveEditAct} title="save" aria-label="save" style={{ ...btn(C.ink), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SaveIcon size={15} /></button>
        <button onClick={() => setEditActId(null)} title="cancel" aria-label="cancel" style={{ ...btn(C.muted, true), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><CircleXIcon size={15} /></button>
      </div>
    ) : (
      <div key={a.id}
        className="fl-act-row"
        onClick={brk.active ? () => togglePick(a.id) : undefined}
        onDragOver={(e) => { e.preventDefault(); if (actOver !== i) setActOver(i); }}
        onDrop={(e) => { e.preventDefault(); moveActivity(actDrag, i); setActDrag(null); setActOver(null); }}
        style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 10px", background: isPicked(a) ? areaColor(a.area) : "#fbf8f1", border: `1px solid ${C.line}`, borderLeft: `${isPicked(a) ? 6 : 4}px solid ${areaBorder(a.area)}`, borderRadius: 6, color: C.ink, cursor: brk.active ? "pointer" : "default", opacity: actDrag === i ? 0.4 : 1, boxShadow: actOver === i && actDrag !== null && actDrag !== i ? `inset 0 2px 0 ${C.ink}` : "none" }}>
        <span draggable onClick={(e) => e.stopPropagation()} onDragStart={(e) => { setActDrag(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }} onDragEnd={() => { setActDrag(null); setActOver(null); }} title="drag to reorder" style={{ display: "grid", gridTemplateColumns: "3px 3px", gap: 3, cursor: "grab", flexShrink: 0, padding: "2px 1px" }}>
          {Array.from({ length: 6 }).map((_, k) => (<span key={k} style={{ width: 3, height: 3, borderRadius: "50%", background: C.faint }} />))}
        </span>
        {!tinyPanel && <span style={{ minWidth: 88, flexShrink: 0, display: "flex", alignItems: "center" }}><span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", padding: "1px 8px", borderRadius: 999, background: isPicked(a) ? "#fff" : areaColor(a.area), border: `1px solid ${areaBorder(a.area)}`, color: darken(areaBorder(a.area), 0.62), whiteSpace: "nowrap" }}>#{a.area}</span></span>}
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", fontWeight: isPicked(a) ? 700 : 400 }}>{isPicked(a) ? "✓ " : ""}{a.name}</span>
        {!narrowPanel && <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: C.muted }}>{a.count || 0}{"×"}</span>}
        {!narrowPanel && <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: C.muted, minWidth: 48, textAlign: "right" }}>{a.lastUsed ? fmtDate(a.lastUsed) : "—"}</span>}
        <button onClick={(e) => { e.stopPropagation(); startEditAct(a); }} className="fl-rowact" title="edit" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
        <button onClick={(e) => { e.stopPropagation(); removeActivity(a.id); }} className="fl-rowact fl-rowdel" title="delete" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
      </div>
    )
  );

  // One Notion task row in the today list. Index is resolved against the master
  // orderedTasks so drag-reorder works the same whether the row sits in Work or Personal.
  const renderTaskRow = (t: any) => {
    const i = orderedTasks.indexOf(t);
    const key = t.id || t.task;
    const done = doneSess[key] || 0;
    const est = t.pomodoros || 0;
    const completed = (t.act || 0) + done;
    const remaining = Math.max(0, est - completed);
    const hier = hierarchyText(t);
    const showCat = !!t.category && settings.showCategoryInView !== false;
    const cat = showCat ? t.category : null;
    const titleText = showCat ? stripLeadingTag(t.task) : t.task;
    const isDragging = dragIndex === i;
    const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
    const isFrozen = frozenNames.includes(t.task);
    const personal = isPersonal(t);
    return (
      <div
        key={key}
        className="fl-task-row fl-act-row"
        onDragOver={(e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i); }}
        onDrop={(e) => { e.preventDefault(); moveTask(dragIndex, i); setDragIndex(null); setOverIndex(null); }}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 6, background: C.card, border: `1px solid ${isOver ? C.ink : C.line}`, boxShadow: isOver ? `inset 0 2px 0 ${C.ink}` : "none", opacity: isDragging ? 0.4 : 1 }}
      >
        <span
          draggable
          onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
          onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
          title="drag to reorder"
          style={{ display: "grid", gridTemplateColumns: "3px 3px", gap: 3, cursor: "grab", flexShrink: 0, padding: "2px 1px" }}
        >
          {Array.from({ length: 6 }).map((_, k) => (<span key={k} style={{ width: 3, height: 3, borderRadius: "50%", background: C.faint }} />))}
        </span>
        <span style={{ width: 14, height: 14, borderRadius: 4, background: POWER_COLOR[t.power] || POWER_COLOR.Y, flexShrink: 0 }} title={POWER_LABEL[t.power] || POWER_LABEL.Y} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, lineHeight: 1.3, overflowWrap: "anywhere" }}><span style={{ color: LOAD_COLOR[t.load] || LOAD_COLOR.B, fontFamily: "var(--fl-mono)", fontWeight: 700, marginRight: 6 }} title={LOAD_LABEL[t.load] || LOAD_LABEL.B}>{t.load || "B"}</span>{cat && <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: C.muted, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, padding: "1px 5px", marginRight: 6, whiteSpace: "nowrap" }}>{cat}</span>}{titleText}{t.king ? " \u{1F451}" : ""}</div>
          {hier && <div style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hier}</div>}
        </div>
        <button onClick={() => togglePersonal(t.task)} className="fl-rowact" title={personal ? "move to Work" : "move to Personal"} aria-label={personal ? "move to Work" : "move to Personal"} style={ICON_BTN}>{personal ? <BriefcaseIcon size={14} /> : <UserIcon size={14} />}</button>
        <button
          onClick={() => toggleFreeze(t.task)}
          className={"fl-lock" + (isFrozen ? " is-locked" : "")}
          title={isFrozen ? "unpin from the top" : "pin to the top (by name, so it survives daily re-created Notion tasks)"}
          style={{ background: "transparent", border: "none", boxShadow: "none", height: "auto", cursor: "pointer", padding: 2, color: isFrozen ? C.ink : C.muted, flexShrink: 0, display: "inline-flex" }}
        >
          <LockIcon size={13} open={!isFrozen} />
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <TomatoPips vivid={done} grey={remaining} />
          <span style={{ fontSize: 10.5, color: C.muted, fontFamily: "var(--fl-mono)" }}>{completed} done</span>
        </div>
        <button onClick={() => openLog(t.task)} className="fl-rowact" title="log" aria-label="log" style={ICON_BTN}><SquarePenIcon size={15} /></button>
      </div>
    );
  };

  // Routine block helpers. `which` is "morning" or "night"; everything routes to the
  // matching list + saver so the two blocks share one implementation.
  const todayKey = String(logicalDay(Date.now(), settings).getTime());
  // Work / Relax mode: auto from today's weekday in the active schedule, with a per-day manual override.
  const workDays: boolean[] = settings.workDays || [true, true, true, true, true, true, true];
  const todayWeekday = (logicalDay(Date.now(), settings).getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  const autoMode: "work" | "relax" = workDays[todayWeekday] === false ? "relax" : "work";
  const dayMode: "work" | "relax" = (modeOverride[todayKey] === "work" || modeOverride[todayKey] === "relax") ? modeOverride[todayKey] : autoMode;
  const toggleDayMode = () => { const next = dayMode === "work" ? "relax" : "work"; const obj = { ...modeOverride, [todayKey]: next }; setModeOverride(obj); api.saveModeOverride && api.saveModeOverride(obj); };
  const activeMorning = dayMode === "relax" ? relaxMorning : morningRoutine;
  const activeNight = dayMode === "relax" ? relaxNight : nightRoutine;
  const isRoutineDone = (id: string) => (routineDone[todayKey] || []).includes(id);
  const toggleRoutineDone = (id: string) => {
    const cur = routineDone[todayKey] || [];
    const nextList = cur.includes(id) ? cur.filter((x: string) => x !== id) : [...cur, id];
    const next = { ...routineDone, [todayKey]: nextList };
    setRoutineDone(next);
    api.saveRoutineDone && api.saveRoutineDone(next);
  };
  const routineSaver = (which: string) => (dayMode === "relax" ? (which === "morning" ? saveRelaxMorning : saveRelaxNight) : (which === "morning" ? saveMorning : saveNight));
  const routineList = (which: string) => (which === "morning" ? activeMorning : activeNight);
  const addRoutine = (which: string) => {
    const name = (which === "morning" ? newMorning : newNight).trim();
    if (!name) return;
    routineSaver(which)([...routineList(which), { id: "r" + Date.now(), name }]);
    if (which === "morning") setNewMorning(""); else setNewNight("");
  };
  const saveEditRoutine = (which: string) => {
    const n = editRoutineName.trim();
    if (!n) { setEditRoutineId(null); return; }
    routineSaver(which)(routineList(which).map((x: any) => (x.id === editRoutineId ? { ...x, name: n } : x)));
    setEditRoutineId(null);
  };
  const removeRoutine = (which: string, id: string) => routineSaver(which)(routineList(which).filter((x: any) => x.id !== id));
  const moveRoutine = (which: string, from: number, to: number) => {
    if (from === to) return;
    const a = [...routineList(which)];
    const [m] = a.splice(from, 1);
    a.splice(to, 0, m);
    routineSaver(which)(a);
  };
  const renderRoutineBlock = (which: string) => {
    const list = routineList(which);
    const relax = dayMode === "relax";
    const label = which === "morning" ? "\u{1F305} Morning" : "\u{1F319} Night";
    const newVal = which === "morning" ? newMorning : newNight;
    const setNewVal = which === "morning" ? setNewMorning : setNewNight;
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ ...SECTION_HEAD, ...(relax ? { color: MODE_COLORS.relax.solid } : {}) }}>{label}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.length === 0 && <p style={{ color: C.muted, fontSize: 12.5, margin: "0 0 0 2px" }}>None yet — add one below.</p>}
          {list.map((it: any, i: number) => {
            const done = isRoutineDone(it.id);
            const dragging = !!routineDrag && routineDrag.w === which && routineDrag.i === i;
            const over = !!routineOver && routineOver.w === which && routineOver.i === i && !!routineDrag && !(routineDrag.w === which && routineDrag.i === i);
            if (editRoutineId === it.id) {
              return (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 6 }}>
                  <input value={editRoutineName} onChange={(e) => setEditRoutineName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEditRoutine(which); if (e.key === "Escape") setEditRoutineId(null); }} autoFocus style={{ flex: 1, minWidth: 80, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 8px", fontFamily: "var(--fl-display)" }} />
                  <button onClick={() => saveEditRoutine(which)} title="save" aria-label="save" style={{ ...btn(C.ink), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SaveIcon size={15} /></button>
                  <button onClick={() => setEditRoutineId(null)} title="cancel" aria-label="cancel" style={{ ...btn(C.muted, true), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><CircleXIcon size={15} /></button>
                </div>
              );
            }
            return (
              <div key={it.id} className="fl-act-row"
                onDragOver={(e) => { e.preventDefault(); if (!routineOver || routineOver.w !== which || routineOver.i !== i) setRoutineOver({ w: which, i }); }}
                onDrop={(e) => { e.preventDefault(); if (routineDrag && routineDrag.w === which) moveRoutine(which, routineDrag.i, i); setRoutineDrag(null); setRoutineOver(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "7px 10px", background: relax ? MODE_COLORS.relax.fill : C.card, border: `1px solid ${relax ? MODE_COLORS.relax.border : C.line}`, borderRadius: 6, color: C.ink, opacity: dragging ? 0.4 : 1, boxShadow: over ? `inset 0 2px 0 ${C.ink}` : "none" }}>
                <span draggable onDragStart={(e) => { setRoutineDrag({ w: which, i }); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setRoutineDrag(null); setRoutineOver(null); }} title="drag to reorder" style={{ display: "grid", gridTemplateColumns: "3px 3px", gap: 3, cursor: "grab", flexShrink: 0, padding: "2px 1px" }}>
                  {Array.from({ length: 6 }).map((_, k) => (<span key={k} style={{ width: 3, height: 3, borderRadius: "50%", background: C.faint }} />))}
                </span>
                <button onClick={() => toggleRoutineDone(it.id)} title={done ? "mark not done" : "mark done"} aria-label={done ? "mark not done" : "mark done"} style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 5, border: `1.5px solid ${done ? C.better : C.faint}`, background: done ? C.better : "transparent", color: "#fff", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{done && <CheckIcon size={12} />}</button>
                <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", textDecoration: done ? "line-through" : "none", color: done ? C.muted : C.ink }}>{it.name}</span>
                <button onClick={() => openLog(it.name)} className="fl-rowact" title="run a pomodoro" aria-label="run a pomodoro" style={ICON_BTN}><PlayIcon size={13} /></button>
                <button onClick={() => { setEditRoutineId(it.id); setEditRoutineName(it.name); }} className="fl-rowact" title="edit" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
                <button onClick={() => removeRoutine(which, it.id)} className="fl-rowact fl-rowdel" title="delete" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input value={newVal} onChange={(e) => setNewVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addRoutine(which); }} placeholder={which === "morning" ? "add a morning step" : "add a night step"} style={{ flex: 1, minWidth: 0, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "7px 10px", fontFamily: "var(--fl-display)" }} />
          <button onClick={() => addRoutine(which)} title="add" aria-label="add" style={{ ...ADD_BTN, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><ListPlusIcon size={16} /></button>
        </div>
      </div>
    );
  };

  // ---------- Timeline (daily plan) ----------
  const PX_PER_MIN = 1.5;
  const tlStart = settings.morningBegins ?? 480;
  // The day ends where the next one starts: the bottom of the Timeline is the rollover, one full day below the top.
  const tlEnd = (settings.dayStart ?? 240) + 1440;
  const MIN_BLOCK_H = 28;
  const GAP_PXM = 0.4;
  // Lay blocks out as a stack — each at least MIN_BLOCK_H tall (so short tasks stay
  // readable), gaps compressed. Items carry both a pixel band (topY..+height) and a time
  // band (t0..t1), which drive the render, the now-line, and drag mapping. Busy stretches
  // grow; quiet ones don't (no even hourly grid).
  const tlLayout = (blocks: any[]) => {
    const sorted = blocks.slice().sort((a: any, b: any) => a.start - b.start);
    const items: any[] = [];
    let y = 0, prevEnd: number | null = null;
    sorted.forEach((b: any) => {
      if (prevEnd != null && b.start > prevEnd) {
        const gh = Math.max(7, (b.start - prevEnd) * GAP_PXM);
        items.push({ type: "gap", t0: prevEnd, t1: b.start, minutes: b.start - prevEnd, topY: y, height: gh });
        y += gh;
      }
      const h = Math.max(MIN_BLOCK_H, b.dur * PX_PER_MIN);
      items.push({ type: "block", b, t0: b.start, t1: b.start + b.dur, topY: y, height: h });
      y += h;
      prevEnd = b.start + b.dur;
    });
    return { items, totalH: Math.max(80, y) };
  };
  const yToMin = (items: any[], y: number) => {
    if (!items.length) return tlStart;
    if (y <= items[0].topY) return items[0].t0;
    for (const it of items) if (y >= it.topY && y <= it.topY + it.height) return it.t0 + (it.height > 0 ? (y - it.topY) / it.height * (it.t1 - it.t0) : 0);
    return items[items.length - 1].t1;
  };
  const snap5 = (m: number) => Math.round(m / 5) * 5;
  const fmtClock = (m: number) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(Math.round(m) % 60).padStart(2, "0");
  const clampStart = (m: number, dur: number) => Math.max(tlStart, Math.min(tlEnd - dur, m));
  const todayBlocks = () => (plans[todayKey] || []);
  const setTodayBlocks = (blocks: any[]) => { setPlans((p: any) => ({ ...p, [todayKey]: blocks })); api.savePlan && api.savePlan(todayKey, blocks); };
  // Prevent overlaps: in start order, any block that begins before the previous one ends
  // is pushed down. Free-time gaps are left untouched. When a pushed block is a task that
  // follows another task, a break is inserted between them — short, but a long break after
  // every `longEvery` short ones (the rhythm you set in the toolbar).
  const resolveOverlaps = (blocks: any[]) => {
    const shortB = settings.breakMinutes || 5;
    let cursor = -Infinity, prevTask = false;
    return blocks.slice().sort((a: any, c: any) => a.start - c.start).map((b: any) => {
      const isTask = b.kind === "task";
      let start = b.start;
      if (start < cursor) {
        const gap = isTask && prevTask ? shortB : 0;
        start = cursor + gap;
      }
      cursor = start + b.dur;
      prevTask = isTask;
      return start === b.start ? b : { ...b, start };
    });
  };
  // One task block per Work+Personal task from the day start, with short breaks between
  // and a long break every N pomodoros (and once across noon). Saved as the day's plan.
  const ROUTINE_MIN = 15;
  const buildInitialPlan = () => {
    const pomo = settings.pomodoroMinutes || 25;
    const shortB = settings.breakMinutes || 5;
    const longB = settings.longBreakMinutes || 20;
    const every = longEvery;
    const blocks: any[] = [];
    let t = tlStart, count = 0, noon = false, seq = 0;
    // Morning routine first (back-to-back, no pomodoro breaks), then a short break. Each
    // item keeps its own length (it.dur) so a rebuild preserves edited routine lengths.
    if (!settings.skipMorningRoutine) (activeMorning || []).forEach((it: any) => {
      const dur = it.dur || ROUTINE_MIN;
      blocks.push({ id: "r" + Date.now() + "_" + (seq++), kind: "routine", name: it.name, start: t, dur, refId: it.id });
      t += dur;
    });
    if (blocks.length) t += shortB;
    // Work + Personal pomodoros with short/long breaks.
    const pomos = [...workTasks, ...personalTasks];
    pomos.forEach((task: any, idx: number) => {
      blocks.push({ id: "b" + Date.now() + "_" + (seq++), kind: "task", name: task.task, start: t, dur: pomo, pageId: task.id || null, category: task.category || null, load: task.load || null, power: task.power || null });
      t += pomo; count++;
      if (idx === pomos.length - 1) return;
      const crossNoon = !noon && t >= 12 * 60;
      if (count >= every || crossNoon) { blocks.push({ id: "lb" + Date.now() + "_" + (seq++), kind: "longbreak", name: "Long break", start: t, dur: longB }); t += longB; count = 0; if (crossNoon) noon = true; }
      else t += shortB;
    });
    // Night routine last.
    if (!settings.skipNightRoutine && (activeNight || []).length) {
      if (pomos.length) t += shortB;
      (activeNight || []).forEach((it: any) => {
        const dur = it.dur || ROUTINE_MIN;
        blocks.push({ id: "r" + Date.now() + "_" + (seq++), kind: "routine", name: it.name, start: t, dur, refId: it.id });
        t += dur;
      });
    }
    return blocks;
  };
  const setTimelineMode = (on: boolean) => {
    const hasInput = [...workTasks, ...personalTasks].length || (!settings.skipMorningRoutine && (activeMorning || []).length) || (!settings.skipNightRoutine && (activeNight || []).length);
    if (on && !plans[todayKey] && hasInput) setTodayBlocks(buildInitialPlan());
    setTimelineModeState(on);
  };
  const duplicateBlock = (id: string) => {
    const blocks = todayBlocks();
    const b = blocks.find((x: any) => x.id === id);
    if (!b) return;
    const shortB = settings.breakMinutes || 5;
    const shift = b.dur + shortB;
    // Drop the copy into the next slot right after the original, and push every block that
    // starts after the original down by the copy's footprint, so nothing overlaps.
    const shifted = blocks.map((x: any) => (x.id !== id && x.start >= b.start + b.dur ? { ...x, start: x.start + shift } : x));
    setTodayBlocks(resolveOverlaps([...shifted, { ...b, id: "b" + Date.now(), start: b.start + b.dur + shortB }]));
  };
  const deleteBlock = (id: string) => setTodayBlocks(todayBlocks().filter((b: any) => b.id !== id));
  const addMeeting = () => {
    const last = todayBlocks().reduce((m: number, b: any) => Math.max(m, b.start + b.dur), tlStart);
    setTodayBlocks(resolveOverlaps([...todayBlocks(), { id: "m" + Date.now(), kind: "meeting", name: "Unavailable", start: clampStart(snap5(last + 10), 30), dur: 30 }]));
  };
  // Wand: re-flow the plan into a clean break rhythm — a short break (settings.breakMinutes)
  // between consecutive tasks and a long-break BLOCK (settings.longBreakMinutes) after every
  // N pomodoros (N = the in-view picker). Routines/unavailable stay back-to-back in order.
  const autoBreaks = () => {
    const shortB = settings.breakMinutes || 5;
    const longB = settings.longBreakMinutes || 20;
    const N = Math.max(2, longEvery || 3);
    const src = todayBlocks().filter((b: any) => b.kind !== "longbreak").slice().sort((a: any, b: any) => a.start - b.start);
    if (!src.length) return;
    const out: any[] = [];
    let t = src[0].start, count = 0;
    src.forEach((b: any, i: number) => {
      out.push({ ...b, start: t });
      t += b.dur;
      if (b.kind === "task") count++;
      const next = src[i + 1];
      if (!next) return;
      if (b.kind === "task" && count >= N) { out.push({ id: "lb" + Date.now() + "_" + i, kind: "longbreak", name: "Long break", start: t, dur: longB }); t += longB; count = 0; }
      else if (b.kind === "task" && next.kind === "task") t += shortB;
    });
    setTodayBlocks(out);
  };
  const saveBlockEdit = () => {
    const blk = todayBlocks().find((b: any) => b.id === editBlockId);
    const name = blockDraft.name.trim() || "Untitled";
    const dur = Math.max(5, Math.min(480, Math.round(blockDraft.dur) || 30));
    setTodayBlocks(todayBlocks().map((b: any) => (b.id === editBlockId ? { ...b, name, dur } : b)));
    // A routine block writes its length (and name) back to the routine item, so a rebuild
    // keeps the edited length.
    if (blk && blk.kind === "routine" && blk.refId) {
      const upd = (list: any[]) => list.map((it: any) => (it.id === blk.refId ? { ...it, name, dur } : it));
      if ((activeMorning || []).some((it: any) => it.id === blk.refId)) routineSaver("morning")(upd(activeMorning));
      else if ((activeNight || []).some((it: any) => it.id === blk.refId)) routineSaver("night")(upd(activeNight));
    }
    setEditBlockId(null);
  };
  const onTimelineDrop = (e: any) => {
    e.preventDefault();
    if (!tlDrag || !tlRef.current) { setTlDrag(null); return; }
    const rect = tlRef.current.getBoundingClientRect();
    const blocks = todayBlocks();
    const b = blocks.find((x: any) => x.id === tlDrag.id);
    if (!b) { setTlDrag(null); return; }
    const target = snap5(yToMin(tlLayout(blocks).items, e.clientY - rect.top - tlDrag.grab));
    // With "move the whole day" on, dragging the first task shifts it + everything after.
    const firstTask = blocks.filter((x: any) => x.kind === "task").sort((a: any, c: any) => a.start - c.start)[0];
    if (settings.anchorShift && firstTask && b.id === firstTask.id) {
      const delta = Math.max(tlStart - b.start, target - b.start);
      setTodayBlocks(blocks.map((x: any) => (x.start >= b.start ? { ...x, start: x.start + delta } : x)));
    } else {
      const moved = blocks.map((x: any) => (x.id === b.id ? { ...x, start: Math.max(tlStart, target) } : x));
      setTodayBlocks(resolveOverlaps(moved));
    }
    setTlDrag(null);
  };
  const renderBlock = (b: any, topY: number, h: number) => {
    const isTask = b.kind === "task";
    if (editBlockId === b.id) {
      return (
        <div key={b.id} style={{ position: "absolute", left: 56, right: 4, top: topY, minHeight: h, boxSizing: "border-box", background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 6, padding: "4px 6px", display: "flex", alignItems: "center", gap: 6, zIndex: 5 }}>
          <input value={blockDraft.name} autoFocus onChange={(e) => setBlockDraft({ ...blockDraft, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveBlockEdit(); if (e.key === "Escape") setEditBlockId(null); }} style={{ flex: 1, minWidth: 0, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 12.5, borderRadius: 5, padding: "3px 6px", fontFamily: "var(--fl-display)" }} />
          <input type="number" value={blockDraft.dur} onChange={(e) => setBlockDraft({ ...blockDraft, dur: Number(e.target.value) })} title="minutes" style={{ width: 50, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 12.5, borderRadius: 5, padding: "3px 6px" }} />
          <button onClick={saveBlockEdit} title="save" aria-label="save" style={{ ...btn(C.ink), padding: "4px 7px", display: "inline-flex" }}><SaveIcon size={13} /></button>
          <button onClick={() => setEditBlockId(null)} title="cancel" aria-label="cancel" style={{ ...btn(C.muted, true), padding: "4px 7px", display: "inline-flex" }}><CircleXIcon size={13} /></button>
        </div>
      );
    }
    return (
      <div key={b.id} className="fl-act-row" draggable
        onDragStart={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setTlDrag({ id: b.id, grab: e.clientY - r.top }); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", b.id); }}
        onDragEnd={() => setTlDrag(null)}
        style={{ position: "absolute", left: 56, right: 4, top: topY, height: h, boxSizing: "border-box", background: isTask ? "#fff" : (b.kind === "longbreak" ? "#eef2f6" : "#fbf8f1"), border: `1px solid ${C.line}`, borderLeft: `4px solid ${isTask ? (POWER_COLOR[b.power] || POWER_COLOR.Y) : (b.kind === "routine" ? C.better : b.kind === "longbreak" ? C.neutral : C.muted)}`, borderRadius: 6, padding: "2px 8px", cursor: "grab", display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.ink, opacity: tlDrag && tlDrag.id === b.id ? 0.4 : 1, overflow: "hidden" }}>
        {isTask && <span style={{ color: LOAD_COLOR[b.load] || LOAD_COLOR.B, fontFamily: "var(--fl-mono)", fontWeight: 700, fontSize: 12.5, flexShrink: 0 }} title={LOAD_LABEL[b.load] || LOAD_LABEL.B}>{b.load || "B"}</span>}
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isTask ? stripLeadingTag(b.name) : b.name}</span>
        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 10, color: C.muted, flexShrink: 0 }}>{b.dur}m</span>
        {(isTask || b.kind === "routine") && <button onClick={() => openLog(b.name)} className="fl-rowact" title="run a pomodoro" aria-label="run" style={ICON_BTN}><PlayIcon size={12} /></button>}
        {isTask
          ? <button onClick={() => duplicateBlock(b.id)} className="fl-rowact" title="duplicate (add a pomodoro)" aria-label="duplicate" style={ICON_BTN}><CopyIcon size={13} /></button>
          : <button onClick={() => { setEditBlockId(b.id); setBlockDraft({ name: b.name, dur: b.dur }); }} className="fl-rowact" title="edit" aria-label="edit" style={ICON_BTN}><PencilIcon size={13} /></button>}
        <button onClick={() => deleteBlock(b.id)} className="fl-rowact fl-rowdel" title="delete" aria-label="delete" style={ICON_BTN}><TrashIcon size={13} /></button>
      </div>
    );
  };
  const renderTimeline = () => {
    const blocks = todayBlocks();
    const { items, totalH } = tlLayout(blocks);
    const now = new Date();
    const nowClock = now.getHours() * 60 + now.getMinutes();
    // Before the rollover (early morning) the "now" line lives at the day's tail, below the evening.
    const nowMin = nowClock < (settings.dayStart ?? 240) ? nowClock + 1440 : nowClock;
    let nowY = -1;
    if (items.length) {
      if (nowMin <= items[0].t0) nowY = 0;
      else if (nowMin >= items[items.length - 1].t1) nowY = totalH;
      else for (const it of items) if (nowMin >= it.t0 && nowMin <= it.t1) { nowY = it.topY + (it.t1 > it.t0 ? (nowMin - it.t0) / (it.t1 - it.t0) * it.height : 0); break; }
    }
    return (
      <div style={{ marginTop: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={SECTION_HEAD}>{"\u{1F5D3}️"} Timeline</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: C.muted, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>long break /
              <select value={longEvery} onChange={(e) => { const n = parseInt(e.target.value, 10) || 3; setLongEveryState(n); api.patchSettings && api.patchSettings({ longBreakEvery: n }); }} style={{ border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 12, borderRadius: 6, padding: "2px 4px", fontFamily: "var(--fl-mono)", cursor: "pointer" }}>
                <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
              </select>
            </label>
            <button onClick={autoBreaks} title="auto-fix breaks: a short break between tasks and a long-break block every N pomodoros" aria-label="auto-fix breaks" style={{ ...btn(C.muted, true), padding: "4px 9px", display: "inline-flex", alignItems: "center" }}><WandSparklesIcon size={14} /></button>
            <button onClick={() => setTodayBlocks(buildInitialPlan())} title="rebuild the plan from your tasks + routines" style={{ ...btn(C.muted, true), padding: "4px 9px", display: "inline-flex", alignItems: "center" }}><RotateCcwIcon size={13} /></button>
            <button onClick={addMeeting} style={{ ...btn(C.ink, true), padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}><ListPlusIcon size={14} /> unavailable</button>
          </div>
        </div>
        {blocks.length === 0 && <p style={{ color: C.muted, fontSize: 13, margin: "0 0 8px" }}>No blocks yet — sync some tasks and re-open the timeline, or add a meeting.</p>}
        <div ref={tlScrollRef} style={{ maxHeight: "62vh", overflowY: "auto", overflowX: "hidden" }}>
        <div ref={tlRef} onDragOver={(e) => e.preventDefault()} onDrop={onTimelineDrop} style={{ position: "relative", height: totalH }}>
          <div style={{ position: "absolute", left: 48, top: 0, bottom: 0, width: 2, background: C.line }} />
          {items.map((it: any, i: number) => it.type === "gap" ? (
            <span key={"g" + i} style={{ position: "absolute", left: 56, top: it.topY + Math.max(0, (it.height - 11) / 2), fontSize: 9, color: C.faint, fontFamily: "var(--fl-mono)" }}>{it.minutes}m {it.minutes >= (settings.longBreakMinutes || 20) - 1 ? "long break" : it.minutes <= (settings.breakMinutes || 5) + 1 ? "break" : "free"}</span>
          ) : (
            <React.Fragment key={it.b.id}>
              <span style={{ position: "absolute", left: 0, top: it.topY + 3, width: 44, textAlign: "right", fontSize: 10, color: C.muted, fontFamily: "var(--fl-mono)" }}>{fmtClock(it.b.start)}</span>
              {renderBlock(it.b, it.topY, it.height)}
            </React.Fragment>
          ))}
          {nowY >= 0 && (
            <div ref={nowRef} style={{ position: "absolute", left: 0, right: 0, top: nowY, height: 0, zIndex: 6, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: 46, right: 0, top: 0, borderTop: `2px solid ${C.worse}` }} />
              <span style={{ position: "absolute", left: 0, top: -7, width: 40, textAlign: "right", fontSize: 10, color: C.worse, fontFamily: "var(--fl-mono)", fontWeight: 700 }}>{fmtClock(nowMin)}</span>
            </div>
          )}
        </div>
        </div>
      </div>
    );
  };

  // Time-aware list ordering: the phase you're in now (morning routine / work+personal /
  // night routine) sits on top; finished phases collapse to an expandable header. Phase
  // boundaries come from today's timeline plan if you made one, else from the morning
  // routine length (morning) and Afternoon-ends (work/personal).
  const phaseRankNow = (() => {
    const d = new Date();
    const nowM = d.getHours() * 60 + d.getMinutes();
    const sumMorning = (activeMorning || []).reduce((s: number, it: any) => s + (it.dur || ROUTINE_MIN), 0);
    const planB = plans[todayKey];
    let morningEnd: number, workEnd: number;
    if (planB && planB.length) {
      const mIds = new Set((activeMorning || []).map((it: any) => it.id));
      const mEnds = planB.filter((b: any) => b.kind === "routine" && mIds.has(b.refId)).map((b: any) => b.start + b.dur);
      const tEnds = planB.filter((b: any) => b.kind === "task").map((b: any) => b.start + b.dur);
      morningEnd = mEnds.length ? Math.max(...mEnds) : tlStart;
      workEnd = tEnds.length ? Math.max(...tEnds) : (settings.afternoonEnd || 1080);
    } else {
      morningEnd = tlStart + sumMorning;
      workEnd = settings.afternoonEnd || 1080;
    }
    return nowM < morningEnd ? 0 : nowM < workEnd ? 1 : 2;
  })();
  const renderFullSection = (key: string) => {
    if (key === "morning") return renderRoutineBlock("morning");
    if (key === "night") return renderRoutineBlock("night");
    if (key === "work") return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {workTasks.length > 0 && <div style={SECTION_HEAD}>{"\u{1F31E}"} Work</div>}
        {workTasks.map((t: any) => renderTaskRow(t))}
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={SECTION_HEAD}>{"\u{1F3E1}"} Personal</div>
        {personalTasks.map((t: any) => renderTaskRow(t))}
      </div>
    );
  };
  const renderTodaySections = () => {
    const defs = [
      { key: "morning", label: "\u{1F305} Morning", rank: 0, on: !settings.skipMorningRoutine },
      { key: "work", label: "\u{1F31E} Work", rank: 1, on: true },
      { key: "personal", label: "\u{1F3E1} Personal", rank: 1, on: personalTasks.length > 0 },
      { key: "night", label: "\u{1F319} Night", rank: 2, on: !settings.skipNightRoutine },
    ].filter((s) => s.on);
    const future = defs.filter((s) => s.rank >= phaseRankNow);
    const past = defs.filter((s) => s.rank < phaseRankNow);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {future.map((s) => <div key={s.key}>{renderFullSection(s.key)}</div>)}
        {past.length > 0 && (
          <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: 0.6 }}>earlier today</div>
            {past.map((s) => (
              <div key={s.key}>
                <button onClick={() => setExpandedPast((e) => { const n = new Set(e); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })} style={{ ...SECTION_HEAD, margin: 0, background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 0" }}>{expandedPast.has(s.key) ? "▾" : "▸"} {s.label}</button>
                {expandedPast.has(s.key) && <div style={{ marginTop: 4 }}>{renderFullSection(s.key)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const seg = (on: boolean): any => ({ padding: "6px 14px", borderRadius: 9, border: "none", background: on ? C.card : "transparent", color: on ? C.ink : C.muted, fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", textTransform: "capitalize", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.14)" : "none", fontFamily: "var(--fl-display)", whiteSpace: "nowrap" });
  const segV = (on: boolean): any => ({ padding: "8px 16px", borderRadius: 8, border: "none", background: on ? C.card : "transparent", color: on ? C.ink : C.muted, fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.14)" : "none", fontFamily: "var(--fl-display)", whiteSpace: "nowrap", width: "100%", textAlign: "center" });

  return (
    <div ref={rootRef} style={{ background: C.paper, minHeight: "100%", color: C.ink, fontFamily: "var(--fl-display)", fontVariantNumeric: "tabular-nums" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700&display=swap');
        :root{ --fl-display:'Baloo 2',Georgia,'Iowan Old Style',serif; --fl-mono:'Baloo 2',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; }
      `}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 16px 60px" }}>
        <h1 style={{ fontFamily: "var(--fl-display)", fontSize: 26, fontWeight: 600, letterSpacing: -0.5, margin: "0 0 6px" }}>Focus Log</h1>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 14, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px" }}>
            <span>Square = ExecutionPower:</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: POWER_COLOR.P }} />Must Today</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: POWER_COLOR.Y }} />Aim Today (default)</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: POWER_COLOR.G }} />Bonus If Done</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px" }}>
            <span>Letter = CognitiveLoad:</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><b style={{ color: LOAD_COLOR.A, fontFamily: "var(--fl-mono)" }}>A</b> high</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><b style={{ color: LOAD_COLOR.B, fontFamily: "var(--fl-mono)" }}>B</b> medium</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><b style={{ color: LOAD_COLOR.C, fontFamily: "var(--fl-mono)" }}>C</b> low</span>
            <span style={{ marginLeft: 4 }}>{"\u{1F451}"} = King {"·"} day starts at {fmtHM(settings.dayStart)}</span>
          </div>
        </div>

        {flash && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16, color: C.ink, fontSize: 12.5 }}>
            {flash}
            {pending.length > 0 && <button onClick={retryPending} style={{ ...btn(C.worse, true), marginLeft: 10, padding: "3px 10px" }}>retry {pending.length}</button>}
          </div>
        )}

        <div style={{ marginBottom: 20, overflowX: "auto" }}>
          <div style={{ display: "inline-flex", gap: 2, background: C.line, borderRadius: 12, padding: 4 }}>
            {([["log", "Focus"], ["break", "Break"], ["pause", "Pause"], ["reflect", "Reflect"], ["today", "Plan"], ["status", "Status"], ["sky", "Sky"]] as [string, string][]).map(([t, lab]) => (<button key={t} onClick={() => setView(t)} style={seg(view === t)}>{lab}</button>))}
          </div>
        </div>

        {view === "sky" && <SkyView sessions={sessions} C={C} />}

        {view === "reflect" && (
          <div>
            <p style={{ fontSize: 12.5, color: C.muted, margin: "2px 0 8px" }}>A quiet moment: name what's pulling at you and place how it feels. It's saved to your reflections.</p>
            <ReflectPanel feelings={reflectFeelings} C={C} onSave={onSaveReflection} />
          </div>
        )}

        {view === "today" && (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px 12px", marginBottom: 12 }}>
              <span style={{ color: C.ink, fontSize: 16, fontWeight: 700, display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                {tasks.length} tasks {"\u00B7"} {countToday} /
                {editingGoal ? (
                  <input
                    type="text" inputMode="numeric" autoFocus defaultValue={goal}
                    onBlur={(e) => saveGoal(Number(e.target.value))}
                    onKeyDown={(e) => { if (e.key === "Enter") saveGoal(Number((e.target as HTMLInputElement).value)); if (e.key === "Escape") setEditingGoal(false); }}
                    style={{ width: 32, height: 32, fontSize: 16, fontWeight: 700, padding: 0, textAlign: "center", border: `1.5px solid ${C.ink}`, borderRadius: 6, fontFamily: "var(--fl-mono)", boxSizing: "border-box" }}
                  />
                ) : (
                  <button onClick={() => setEditingGoal(true)} title="click to set today's goal" style={{ width: 32, height: 32, border: `1.5px solid ${C.faint}`, background: "transparent", color: C.ink, fontFamily: "var(--fl-mono)", fontSize: 16, fontWeight: 700, cursor: "pointer", borderRadius: 6, padding: 0, boxSizing: "border-box" }}>{goal}</button>
                )}
                {"\u{1F345}"} today
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title={dayMode === "work" ? "Work mode — tap to switch to Relax" : "Relax mode — tap to switch to Work"}>
                  {!narrowPanel && <span style={{ fontSize: 11.5, fontWeight: 600, color: dayMode === "work" ? MODE_COLORS.work.solid : MODE_COLORS.relax.solid }}>{dayMode === "work" ? "Work" : "Relax"}</span>}
                  <button onClick={toggleDayMode} aria-label="toggle work or relax mode" style={{ position: "relative", width: 46, height: 26, borderRadius: 13, border: "none", background: dayMode === "work" ? MODE_COLORS.work.solid : MODE_COLORS.relax.solid, cursor: "pointer", padding: 0, flexShrink: 0, transition: "background .15s" }}>
                    <span style={{ position: "absolute", top: 3, left: dayMode === "work" ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.35)" }} />
                  </button>
                </span>
                <button onClick={() => setTimelineMode(!timelineMode)} title={timelineMode ? "back to the list" : "plan on a timeline"} aria-label={timelineMode ? "list view" : "timeline view"} style={{ ...btn(C.ink, !timelineMode), padding: "6px 12px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{timelineMode ? <Rows4Icon size={15} /> : <TimelineIcon size={15} />}</button>
                <button onClick={doSync} disabled={sync === "loading"} style={{ ...btn(C.ink, true), display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <RefreshCwIcon size={14} spin={sync === "loading"} />
                  {sync === "loading" ? "syncing\u2026" : <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>Sync from <img src={NOTION_LOGO} alt="Notion" style={{ width: 15, height: 15 }} />{!narrowPanel && "Notion"}</span>}
                </button>
              </div>
            </div>
            {fallingEnjoyment && (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.worse}`, borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: C.ink, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 200 }}>Enjoyment is dipping over your last few pomodoros \u2014 consider an extra break.</span>
                <button onClick={() => { startBreak(); setView("break"); }} style={{ ...btn(C.ink, true), padding: "3px 10px" }}>take a break</button>
              </div>
            )}
            {tasks.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>No tasks yet. Set your Notion token in settings, then press sync.</p>}
            {!timelineMode && tasks.length > 1 && <p style={{ color: C.muted, fontSize: 11, margin: "0 0 8px" }}>Pinned tasks stay on top, then {"\u{1F451}"} King. New tasks arrive ranked Must {"→"} Aim {"→"} Bonus; drag the grip to reorder freely. Hover a row to pin it or move it between Work and Personal.</p>}
            {timelineMode ? renderTimeline() : renderTodaySections()}
          </div>
        )}

        {view === "status" && (
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
        {statusSub === "week" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => setWeekOff((w) => w - 1)} style={btn(C.muted, true)}>{"\u2190"}</button>
              <span style={{ fontFamily: "var(--fl-mono)", fontSize: 13 }}>{fmtDate(weekStart)} {"\u2013"} {fmtDate(new Date(+weekEnd - DAY))}</span>
              <button onClick={() => setWeekOff((w) => Math.min(0, w + 1))} style={btn(C.muted, true)}>{"\u2192"}</button>
            </div>
            {weekAreas.length === 0 ? <p style={{ color: C.muted, textAlign: "center", padding: "40px 0" }}>{weekSessions.length ? "No pomodoros with an Area this week." : "No pomodoros this week."}</p> :
              weekAreas.map((a) => (<GroupChart key={a} group={a} sessions={weekSessions.filter((x) => x.category === a)} settings={settings} />))}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 11, color: C.muted }}>
              <span><span style={{ color: settings.beginColor }}>{"\u25CF"}</span> expected</span>
              <span><span style={{ color: settings.endColor }}>{"\u25CF"}</span> actual</span>
              <span><span style={{ color: C.better }}>{"\u2014"}</span> better than expected</span>
              <span><span style={{ color: C.worse }}>{"\u2014"}</span> worse than expected</span>
            </div>
          </div>
        )}

        {statusSub === "month" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => setMonthOff((m) => m - 1)} style={btn(C.muted, true)}>{"\u2190"}</button>
              <span style={{ fontFamily: "var(--fl-mono)", fontSize: 13 }}>{monthRef.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
              <button onClick={() => setMonthOff((m) => Math.min(0, m + 1))} style={btn(C.muted, true)}>{"\u2192"}</button>
            </div>
            <Heatmap sessions={sessions} monthRef={monthRef} settings={settings} />
          </div>
        )}

        {statusSub === "totals" && (
          <div>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 4px" }}>Pomodoro totals</h3>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>All pomodoros, every project combined.</p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-around" }}>
                <Stat label="this week" value={countWeek} big />
                <Stat label="this month" value={countMonth} big />
                <Stat label="this year" value={countYear} big />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-around", borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 4 }}>
                <Stat label="hours, week" value={hrsOf(sumMin(inWeek))} color={C.muted} />
                <Stat label="hours, month" value={hrsOf(sumMin(inMonth))} color={C.muted} />
                <Stat label="hours, year" value={hrsOf(sumMin(inYear))} color={C.muted} />
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginTop: 20 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 4px" }}>Six-month heatmap</h3>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>Last 6 months — pomodoros per day.</p>
              <ContribHeatmap sessions={sessions} settings={settings} />
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginTop: 20 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 4px" }}>Expected vs actual</h3>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>Expected vs actual enjoyment.</p>
              {rated === 0 ? (
                <p style={{ color: C.muted, fontSize: 13 }}>No ratings yet. Log a few pomodoros to see your calibration.</p>
              ) : (
                <>
                  <div style={{ fontSize: 15, lineHeight: 1.5, marginBottom: surprises.length ? 14 : 0 }}>
                    <span style={{ fontFamily: "var(--fl-mono)", fontSize: 22, color: C.better }}>{betterPct}%</span> of your pomodoros turned out <span style={{ color: C.better }}>more enjoyable</span> than you expected
                    <span style={{ color: C.muted }}> (avg gap <span style={{ color: avgGapAll > 0 ? C.better : avgGapAll < 0 ? C.worse : C.neutral, fontFamily: "var(--fl-mono)" }}>{(avgGapAll >= 0 ? "+" : "") + avgGapAll.toFixed(1)}</span>).</span>
                  </div>
                  {surprises.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Biggest surprises — dreaded, then enjoyed</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {surprises.map((s) => (
                          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                            <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, color: C.better, minWidth: 28 }}>+{s.actual - s.expected}</span>
                            <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{s.task}</span>
                            <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, whiteSpace: "nowrap" }}><span style={{ color: settings.beginColor }}>{s.expected}</span><span style={{ color: C.muted }}>{" → "}</span><span style={{ color: settings.endColor }}>{s.actual}</span></span>
                            <span style={{ color: C.muted, fontSize: 11, fontFamily: "var(--fl-mono)", whiteSpace: "nowrap" }}>{fmtDate(s.ts)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginTop: 20 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 4px" }}>Best time of day</h3>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>Average enjoyment per band.</p>
              {!bestBand ? (
                <p style={{ color: C.muted, fontSize: 13 }}>Not enough data yet.</p>
              ) : (
                <>
                  <div style={{ fontSize: 15, marginBottom: 12 }}>Your highest-enjoyment band is <b style={{ color: C.ink }}>{bestBand.name}</b> <span style={{ color: C.muted, fontFamily: "var(--fl-mono)", fontSize: 13 }}>({(bestBand.avg as number).toFixed(1)} / 5)</span>.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {bandStats.map((b) => {
                      const pct = b.avg != null ? ((b.avg as number) / 5) * 100 : 0;
                      const isBest = bestBand && b.band === bestBand.band;
                      return (
                        <div key={b.band} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 70, fontSize: 12, color: C.muted, textTransform: "capitalize" }}>{b.name}</span>
                          <div style={{ flex: 1, height: 14, background: C.paper, borderRadius: 7, overflow: "hidden", border: `1px solid ${C.line}` }}>
                            <div style={{ width: pct + "%", height: "100%", background: isBest ? C.better : C.neutral }} />
                          </div>
                          <span style={{ width: 64, textAlign: "right", fontFamily: "var(--fl-mono)", fontSize: 12, color: C.muted }}>{b.avg != null ? (b.avg as number).toFixed(1) : "—"} · {b.count}{"\u{1F345}"}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 onClick={() => toggleFold("sessions")} style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>{foldedHistory.has("sessions") ? "▸" : "▾"} All sessions</h3>
                <span style={{ color: C.muted, fontSize: 12, fontFamily: "var(--fl-mono)" }}>{sessions.length} logged</span>
              </div>
              {foldedHistory.has("sessions") ? null : sessions.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13 }}>No sessions yet. Log a pomodoro to see it here.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...sessions].sort((a, b) => +new Date(b.ts) - +new Date(a.ts)).map((s) => (
                    editingId === s.id ? (
                      <SessionEditRow key={s.id} draft={editDraft} setDraft={setEditDraft} settings={settings} onSave={saveEdit} onCancel={cancelEdit} />
                    ) : (
                      <SessionRow key={s.id} s={s} settings={settings} onEdit={startEdit} onDelete={deleteSession} />
                    )
                  ))}
                </div>
              )}
              {!foldedHistory.has("sessions") && <p style={{ color: C.muted, fontSize: 11, marginTop: 10 }}>
                Edits and deletes only change the local log; they do not undo the Act write-back on Notion.
              </p>}
            </div>
          </div>
        )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 11, padding: 4 }}>
              {([["week", "Week"], ["month", "Month"], ["totals", "Total"]] as [string, string][]).map(([k, lab]) => (
                <button key={k} onClick={() => setStatusSub(k)} style={segV(statusSub === k)}>{lab}</button>
              ))}
            </div>
          </div>
        )}

        {view === "log" && <LogForm tasks={orderedTasks} preset={preset} onAdd={logPomodoro} settings={settings} secs={secs} running={running} resetTimer={resetTimer} pomoMin={pomoMin} changePomo={changePomo} stepPomo={stepPomo} chooseNext={chooseNext} setChooseNext={setChooseNext} nextTask={nextTask} setNextTask={setNextTask} onStart={onStart} onPause={onPause} pauseActive={pauseActive} paused={timer.paused} pauseTags={pauseTags} pauseTag={pauseTag} setPauseTag={setPauseTag} tagColor={tagColor} tagBorder={tagBorder} floatOn={floatOn} setFloatOn={setFloatOn} lenLocked={lenLocked} finished={finished} onSetExpected={setExpectedRating} autoLogDefault={settings.autoLogOnRate !== false} onAutoLogChange={(v: boolean) => api.patchSettings && api.patchSettings({ autoLogOnRate: v })} />}

        {view === "break" && (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <span style={SECTION_HEAD}>start a break</span>
              <button onClick={() => startBreak(settings.breakMinutes)} style={{ ...btn(C.ink, true), padding: "5px 12px" }}>short · {settings.breakMinutes}m</button>
              <button onClick={() => startBreak(settings.longBreakMinutes)} style={{ ...btn(C.ink, true), padding: "5px 12px" }}>long · {settings.longBreakMinutes}m</button>
            </div>
            {brk.active && (
              <div style={{ background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--fl-mono)", fontSize: 30, color: brk.finished ? C.better : C.ink }}>{String(Math.floor(brk.secs / 60)).padStart(2, "0")}:{String(brk.secs % 60).padStart(2, "0")}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                    {!brk.finished && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 4 }}>
                        <button onClick={() => api.timer.stepBreak(-1)} style={{ ...btn(C.muted, true), padding: "4px 9px" }}>{"−"}</button>
                        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, color: C.muted, minWidth: 34, textAlign: "center" }}>{Math.round(brk.secs / 60)}m</span>
                        <button onClick={() => api.timer.stepBreak(1)} style={{ ...btn(C.muted, true), padding: "4px 9px" }}>{"+"}</button>
                      </span>
                    )}
                    {!brk.finished && <button onClick={() => api.timer.toggleBreakRun()} title={brk.running ? "pause" : "start"} aria-label={brk.running ? "pause" : "start"} style={{ ...btn(C.ink), display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "7px 13px" }}>{brk.running ? <PauseIcon size={16} /> : <PlayIcon size={16} />}</button>}
                    <button onClick={endBreak} title={brk.finished ? "go back to my task" : "end break"} aria-label={brk.finished ? "go back to my task" : "end break"} style={{ ...btn(C.muted, true), display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "7px 13px" }}>{brk.finished ? <ArrowRightIcon size={16} /> : <CheckIcon size={16} />}</button>
                  </div>
                </div>
                <p style={{ color: C.muted, fontSize: 12, margin: "0 0 8px" }}>Pick up to 3 — tap an activity ({brk.picked.length}/3):</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {activities.length === 0 ? <span style={{ color: C.muted, fontSize: 13 }}>No activities yet — end the break to add some.</span> :
                    activities.map((a, i) => renderActRow(a, i))}
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                  <Scale label="how do you feel now? (1 worse than no rest … 5 a lot better)" value={brk.feeling} onChange={(v: number) => api.timer.setBreakFeeling(v)} color={settings.endColor} />
                </div>
              </div>
            )}

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 20, display: brk.active ? "none" : undefined }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 10px" }}>Break activities</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {activities.length === 0 && <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>None yet. Add an activity and an area below.</p>}
                {activities.map((a, i) => renderActRow(a, i))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                <input value={newAct.area} onChange={(e) => setNewAct({ ...newAct, area: e.target.value })} placeholder="area / tag" style={{ flex: 1, minWidth: 90, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "7px 10px", fontFamily: "var(--fl-display)", boxSizing: "border-box" }} />
                <AutoTextarea value={newAct.name} onChange={(e: any) => setNewAct({ ...newAct, name: e.target.value })} placeholder="activity name" style={{ flex: 2, minWidth: 140, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "7px 10px", fontFamily: "var(--fl-display)", lineHeight: 1.4, resize: "none", overflow: "hidden", boxSizing: "border-box" }} />
                <button onClick={addActivity} title="add" aria-label="add" style={{ ...ADD_BTN, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><ListPlusIcon size={16} /></button>
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 4px" }}>Break stats</h3>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>What you reach for on breaks.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Favourites</p>
                  {favs.length === 0 ? <span style={{ color: C.muted, fontSize: 13 }}>{"—"}</span> : favs.map((a) => (
                    <div key={a.id} style={{ fontSize: 13 }}>{a.name} <span style={{ color: C.muted, fontFamily: "var(--fl-mono)", fontSize: 11 }}>{a.count}{"×"}</span></div>
                  ))}
                </div>
                <div>
                  <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Least chosen</p>
                  {disliked.length === 0 ? <span style={{ color: C.muted, fontSize: 13 }}>{"—"}</span> : disliked.map((a) => (
                    <div key={a.id} style={{ fontSize: 13, color: C.muted }}>{a.name} <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11 }}>{a.count || 0}{"×"}</span></div>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>By area</p>
              <PieChart data={pieData} />
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 4px" }}>Break insights</h3>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>What actually leaves you feeling restored.</p>
              {ratedBreaks.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Rate a few breaks to see what restores you best.</p>
              ) : (
                <>
                  <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 8px" }}>Most restorative activities</p>
                  {actScore.length === 0 ? <p style={{ color: C.muted, fontSize: 13 }}>No rated breaks had activities yet.</p> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
                      {actScore.slice(0, 3).map((x: any, i: number) => (
                        <div key={x.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13 }}>
                          <span style={{ width: 16, color: C.muted, fontFamily: "var(--fl-mono)", fontSize: 12 }}>{i + 1}.</span>
                          <span style={{ flex: 1, color: C.ink, overflowWrap: "anywhere" }}>{x.name}{x.n < 3 && <span style={{ fontSize: 10, color: C.muted }}> (low sample)</span>}</span>
                          <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, color: C.muted }}>{x.avg.toFixed(1)} / 5</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 8px" }}>Best time for breaks</p>
                  {bestBreakBand ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {breakBandStats.map((b) => {
                        const isBest = bestBreakBand && b.band === bestBreakBand.band;
                        return (
                          <div key={b.band} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13 }}>
                            <span style={{ flex: 1, textTransform: "capitalize", color: isBest ? C.ink : C.muted, fontWeight: isBest ? 700 : 400 }}>{b.name}{isBest ? " — best" : ""}</span>
                            <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, color: C.muted }}>{b.avg != null ? (b.avg as number).toFixed(1) + " / 5" : "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Not enough rated breaks yet.</p>}
                </>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 onClick={() => toggleFold("breaks")} style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>{foldedHistory.has("breaks") ? "▸" : "▾"} All breaks</h3>
                <span style={{ color: C.muted, fontSize: 12, fontFamily: "var(--fl-mono)" }}>{breaks.length} logged</span>
              </div>
              {foldedHistory.has("breaks") ? null : breaks.length === 0 ? <p style={{ color: C.muted, fontSize: 13 }}>No breaks logged yet.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...breaks].sort((a, b) => b.start - a.start).map((b) => (
                    editBreakId === b.id ? (
                      <div key={b.id} style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap", padding: "8px 12px", background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 6 }}>
                        <label style={{ fontSize: 11, color: C.muted, display: "flex", flexDirection: "column", gap: 2 }}>start<input type="datetime-local" value={breakDraft.start} onChange={(e) => setBreakDraft({ ...breakDraft, start: e.target.value })} style={{ border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 8px" }} /></label>
                        <label style={{ fontSize: 11, color: C.muted, display: "flex", flexDirection: "column", gap: 2 }}>end<input type="datetime-local" value={breakDraft.end} onChange={(e) => setBreakDraft({ ...breakDraft, end: e.target.value })} style={{ border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 8px" }} /></label>
                        <div style={{ flexBasis: "100%", display: "flex", alignItems: "flex-end", gap: 8 }}>
                          <Scale label="feeling" value={breakDraft.feeling} onChange={(v: number) => setBreakDraft({ ...breakDraft, feeling: v })} color={settings.endColor} />
                          <button onClick={() => setBreakDraft({ ...breakDraft, feeling: null })} style={{ ...btn(C.muted, true), padding: "2px 8px", fontSize: 11, marginBottom: 12 }}>clear</button>
                        </div>
                        <button onClick={saveEditBreak} title="save" aria-label="save" style={{ ...btn(C.ink), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SaveIcon size={15} /></button>
                        <button onClick={() => setEditBreakId(null)} title="cancel" aria-label="cancel" style={{ ...btn(C.muted, true), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><CircleXIcon size={15} /></button>
                      </div>
                    ) : (
                      <div key={b.id} className="fl-act-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 13, padding: "8px 12px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 }}>
                        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{fmtDate(b.start)} {fmtTime(b.start)}{"–"}{fmtTime(b.end)}</span>
                        <span style={{ flex: 1, minWidth: 120, overflowWrap: "anywhere" }}>{(b.activities && b.activities.length) ? b.activities.join(", ") : "—"}</span>
                        <span style={{ fontSize: 11, color: C.muted, fontFamily: "var(--fl-mono)", minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>{(b.areas && b.areas.length) ? b.areas.join(" · ") : ""}</span>
                        {b.feeling != null && <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: settings.endColor, whiteSpace: "nowrap" }}>{b.feeling}/5</span>}
                        <button onClick={() => startEditBreak(b)} className="fl-rowact" title="edit" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
                        <button onClick={() => deleteBreak(b.id)} className="fl-rowact fl-rowdel" title="delete" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === "pause" && (
          <div>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 6px" }}>Pause tags</h3>
              <p style={{ color: C.muted, fontSize: 12, margin: "0 0 10px" }}>Reasons you can tag a pause with, grouped by whether the interruption was <b style={{ color: PAUSE_CAT.internal.border }}>internal</b> (your own impulse) or <b style={{ color: PAUSE_CAT.external.border }}>external</b> (from outside). Picked from the log view when you pause.</p>
              {pauseTags.length === 0 && <p style={{ color: C.muted, fontSize: 13, margin: "0 0 12px" }}>None yet. Add one below.</p>}
              {(["internal", "external"] as const).map((cat) => {
                const rows = pauseTags.map((t: any, i: number) => ({ t, i })).filter((x: any) => catOf(x.t.category) === cat);
                return (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, color: catBorder(cat), textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--fl-display)" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: catBorder(cat), display: "inline-block" }} />{cat} interrupt
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {rows.length === 0 ? <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>None.</p> : rows.map((x: any) => renderTagRow(x.t, x.i))}
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <select value={newPauseCat} onChange={(e) => setNewPauseCat(e.target.value)} style={{ border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "7px 10px", fontFamily: "var(--fl-display)" }}>
                  <option value="internal">internal</option>
                  <option value="external">external</option>
                </select>
                <input value={newPauseTag} onChange={(e) => setNewPauseTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addPauseTag(); }} placeholder="new pause reason" style={{ flex: 1, minWidth: 140, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "7px 10px" }} />
                <button onClick={addPauseTag} title="add" aria-label="add" style={{ ...ADD_BTN, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><ListPlusIcon size={16} /></button>
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 4px" }}>Pause stats</h3>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>When and why you pause.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16 }}>
                <Stat label="pauses this week" value={pauseWeek.length} />
                <Stat label="pauses this month" value={pauseMonth.length} />
                <div style={{ padding: "8px 12px" }}>
                  <div style={{ fontSize: 12, color: C.muted }}>top this week</div>
                  <div style={{ fontSize: 14, color: C.ink }}>{topPauseWeek ? `${topPauseWeek.tag} (${topPauseWeek.n})` : "—"}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>top this month</div>
                  <div style={{ fontSize: 14, color: C.ink }}>{topPauseMonth ? `${topPauseMonth.tag} (${topPauseMonth.n})` : "—"}</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Typical time of day (all history)</p>
              {pauses.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13 }}>No pauses recorded yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {BAND_NAME.map((band, bi) => {
                    const s = bandSplit[bi];
                    const total = s.internal + s.external;
                    return (
                      <div key={band}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", fontSize: 11, marginBottom: 3, fontFamily: "var(--fl-mono)" }}>
                          <span style={{ color: C.muted, textTransform: "capitalize" }}>{band}</span>
                          <span><span style={{ color: PAUSE_CAT.internal.border }}>internal {s.internal}</span><span style={{ color: C.faint }}> · </span><span style={{ color: PAUSE_CAT.external.border }}>external {s.external}</span></span>
                        </div>
                        <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: C.line }}>
                          {total > 0 && <div title={`internal ${s.internal}/${total}`} style={{ width: `${(s.internal / total) * 100}%`, background: PAUSE_CAT.internal.border }} />}
                          {total > 0 && <div title={`external ${s.external}/${total}`} style={{ width: `${(s.external / total) * 100}%`, background: PAUSE_CAT.external.border }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 onClick={() => toggleFold("pauses")} style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>{foldedHistory.has("pauses") ? "▸" : "▾"} All pauses</h3>
                <span style={{ color: C.muted, fontSize: 12, fontFamily: "var(--fl-mono)" }}>{pauses.length} logged</span>
              </div>
              {foldedHistory.has("pauses") ? null : pauses.length === 0 ? <p style={{ color: C.muted, fontSize: 13 }}>No pauses logged yet.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...pauses].sort((a, b) => (+new Date(b.ts)) - (+new Date(a.ts))).map((p) => (
                    editPauseId === p.id ? (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 12px", background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 6 }}>
                        <input type="datetime-local" value={pauseDraft.ts} onChange={(e) => setPauseDraft({ ...pauseDraft, ts: e.target.value })} style={{ border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 8px" }} />
                        <select value={pauseDraft.tag} onChange={(e) => setPauseDraft({ ...pauseDraft, tag: e.target.value })} style={{ border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 8px" }}>
                          {pauseTags.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                        <button onClick={saveEditPause} title="save" aria-label="save" style={{ ...btn(C.ink), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SaveIcon size={15} /></button>
                        <button onClick={() => setEditPauseId(null)} title="cancel" aria-label="cancel" style={{ ...btn(C.muted, true), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><CircleXIcon size={15} /></button>
                      </div>
                    ) : (
                      <div key={p.id} className="fl-act-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 13, padding: "8px 12px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 }}>
                        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{fmtDate(p.ts)} {fmtTime(p.ts)}</span>
                        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, minWidth: 34 }}>{p.mins != null ? p.mins + "m" : "—"}</span>
                        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{p.tag}</span>
                        <button onClick={() => startEditPause(p)} className="fl-rowact" title="edit" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
                        <button onClick={() => deletePause(p.id)} className="fl-rowact fl-rowdel" title="delete" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
