import * as React from "react";
import { NOTION_LOGO } from "./notionLogo";
import { SkyView } from "./SkyView";
import { newestStarName } from "./skymap";
import { ReflectPanel } from "./ReflectPanel";
import { InfoHover } from "./icons";
import breakShortIcon from "./assets/break-short.png";
import breakLongIcon from "./assets/break-long.png";
import blindsImg from "./assets/blinds.png";
import tableLampImg from "./assets/table-lamp.png";
import dogImg from "./assets/dog.png";
import sketchImg from "./assets/sketch.png";
import rateRain from "./assets/rate-rain.png";
import rateClouds from "./assets/rate-clouds.png";
import ratePartly from "./assets/rate-partly-sunny.png";
import rateSun from "./assets/rate-sun.png";
import crownImg from "./assets/crown.png";
import starImg from "./assets/star.png";
import treeSpring from "./assets/tree-spring.png";
import treeSummer from "./assets/tree-summer.png";
import treeAutumn from "./assets/tree-autumn.png";
import treeWinter from "./assets/tree-winter.png";
const { useState, useEffect, useRef, useCallback } = React;
// Break-block palette: short break = blue, long break = teal (the note icons match the text colour).
const BREAK_BG = "#edf3f8", BREAK_STRIPE = "#9bb4c8", BREAK_TEXT = "#5e7d96";
const LBREAK_BG = "#e3eef0", LBREAK_STRIPE = "#5e93a8", LBREAK_TEXT = "#3d6b80";
// Meal-block palette (lunch / dinner): a warm food tone, distinct from breaks and routines.
const MEAL_BG = "#f6ece1", MEAL_STRIPE = "#cf9a5a", MEAL_TEXT = "#8a5a22";

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
// Little PNG icon for the Plan view's section headers (blinds/lamp/dog/sketch).
const SectionIcon = ({ src }: any) => (<img src={src} alt="" draggable={false} style={{ width: 15, height: 15, verticalAlign: "-3px", marginRight: 2 }} />);
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
const OVERNIGHT_COLOR = "#FFD400"; // bright yellow: a pomodoro after the day-start but before "morning begins"
// Calendar square palettes (user-picked): the day type sets the hue, the band sets the shade.
const WORK_SQUARES = ["#f5b1a0", "#e05a3a", "#9c2010"];   // work-day pomodoros: morning / afternoon / evening
const RELAX_SQUARES = ["#c9ec9d", "#4e9a35", "#1c4a12"];  // relax-day pomodoros: morning / afternoon / evening
const DATE_BROWN = { note: "#6b4423", plain: "#b59b7f" }; // date numbers: darker brown = the day has a daily note
// Row palette (user-picked, "swapped V3"): routine rows tint by day mode under FIXED sidebars
// (orange morning, slate-blue night); Area tags wear coffee — Project dark mocha with light
// words, Personal light oat-milk with dark words. Task-row backgrounds stay as they are.
const ROUTINE_THEME: any = {
  morning: { bar: "#d98324", work: "#faf3dd", relax: "#f8ecee" },
  night: { bar: "#6a86a8", work: "#e6f0ef", relax: "#ece9f2" },
};
const TAG_COFFEE = {
  project: { bg: "#7a5230", text: "#f6efe4", border: "#7a5230" },
  personal: { bg: "#efe7da", text: "#6b4423", border: "#d9c9b2" },
};
const ACCENT = "#6b4423"; // warm chocolate-brown accent: the year in the month header + today's outlined cell
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; // fixed 3-letter month labels ("Sep", not the locale's "Sept"), uniform width
// True for a pomodoro done in the pre-morning stretch [dayStart, morningBegins) — the overnight grind
// before the active day starts. The window wraps past midnight when the day-start is in the evening
// (e.g. dayStart 20:00, morningBegins 06:00 → 20:00 through 06:00); no wrap when both are in the
// morning (e.g. dayStart 04:00, morningBegins 09:00 → 04:00 through 09:00).
function isOvernight(ts: any, s: any) {
  const d = new Date(ts);
  const m = d.getHours() * 60 + d.getMinutes();
  const a = s.dayStart || 0, b = s.morningBegins ?? 480;
  if (a === b) return false;
  return a < b ? (m >= a && m < b) : (m >= a || m < b);
}
function timeColor(ts: any, s: any, ov?: any) {
  if (isOvernight(ts, s)) return OVERNIGHT_COLOR;
  const day = logicalDay(ts, s);
  // A saved per-day flip (the Work/Relax pill or the calendar's right-click) wins; otherwise the
  // weekly schedule decides. Override keys are the logical day's epoch ms, same as todayKey.
  const o = ov ? ov[String(day.getTime())] : null;
  const relax = (o === "relax" || o === "work") ? o === "relax" : (Array.isArray(s.workDays) && s.workDays[(day.getDay() + 6) % 7] === false);
  return (relax ? RELAX_SQUARES : WORK_SQUARES)[bandOf(ts, s)];
}
// Time-of-day label for tooltips: the overnight stretch reads "night", else the morning/afternoon/evening band.
const bandLabel = (ts: any, s: any) => (isOvernight(ts, s) ? "night" : BAND_NAME[bandOf(ts, s)]);
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
  boxShadow: "none",   // Obsidian's default button shadow reads as a second border layer
});

function GroupChart({ group, sessions, settings, override }: any) {
  const [active, setActive] = useState<any>(null);
  const ordered = [...sessions].sort((a: any, b: any) => +new Date(a.ts) - +new Date(b.ts));
  const n = ordered.length;
  const dotMode = n > 8;
  const padL = 30, padR = 14, padT = 16, padB = dotMode ? 56 : 64;
  const step = dotMode ? 34 : 56;
  const W = padL + Math.max(n * step, 60) + padR;
  const H = 250;
  const plotT = padT, plotB = H - padB;
  const yOf = (s: number) => plotB - ((s - 1) / 3) * (plotB - plotT);
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
        <Stat label="avg expected" value={avg("expected").toFixed(1)} color={C.ink} />
        <Stat label="avg actual" value={avg("actual").toFixed(1)} color={C.ink} />
        <Stat label="avg gap" value={(avgGap >= 0 ? "+" : "") + avgGap.toFixed(1)} color={avgGap > 0 ? C.better : avgGap < 0 ? C.worse : C.neutral} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ position: "relative", width: Math.max(W, 220) }}>
          <svg width={W} height={H} style={{ display: "block" }}>
            {[1, 2, 3, 4].map((s) => (
              <g key={s}>
                <line x1={padL} y1={yOf(s)} x2={W - padR} y2={yOf(s)} stroke={C.line} />
                <text x={6} y={yOf(s) + 4} fontSize={11} fill={C.muted} fontFamily="var(--fl-mono)">{s}</text>
              </g>
            ))}
            {trend && <line x1={trend.x1} y1={trend.y1} x2={trend.x2} y2={trend.y2} stroke={C.muted} strokeWidth={1.5} strokeDasharray="2 4" opacity={0.55} />}
            {ordered.map((d: any, i: number) => {
              const x = xOf(i), yE = yOf(d.expected), yA = yOf(d.actual), on = active === d.id;
              return (
                <g key={d.id} onMouseEnter={() => setActive(d.id)} onMouseLeave={() => setActive((a: any) => (a === d.id ? null : a))} onClick={() => setActive((a: any) => (a === d.id ? null : d.id))} style={{ cursor: "pointer" }}>
                  <rect x={x - step / 2} y={plotT} width={step} height={plotB - plotT} fill="transparent" />
                  <line x1={x} y1={yE} x2={x} y2={yA} stroke={gapColor(d.expected, d.actual)} strokeWidth={on ? 4 : 2.5} />
                  <circle cx={x} cy={yE} r={on ? 6 : 4.5} fill="none" stroke={C.ink} strokeWidth={1.5} />
                  <circle cx={x} cy={yA} r={on ? 6 : 4.5} fill={C.ink} />
                  {dotMode ? (
                    <circle cx={x} cy={plotB + 18} r={6} fill={timeColor(d.ts, settings, override)} />
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
                  <span style={{ color: "#fff" }}>{d.expected}</span>
                  <span> {"\u2192"} </span>
                  <span style={{ color: "#fff" }}>{d.actual}</span>
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

function Heatmap({ sessions, monthRef, settings, onOpenDay, activeTs, hasNote, override, onDayMenu }: any) {
  const year = monthRef.getFullYear(), month = monthRef.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // The chocolate outline sits on the daily note currently focused in the workspace; with no
  // daily note open it falls back to the real calendar today.
  const todayK = keyOf(startOfDay(new Date()));
  const activeK = activeTs != null ? keyOf(startOfDay(new Date(activeTs))) : todayK;
  // Group every session by its logical day, keyed by full date, so any cell can be filled, including
  // the previous/next-month "spillover" days that pad the first and last weeks of the grid.
  const byKey: any = {};
  sessions.forEach((x: any) => { const k = keyOf(logicalDay(x.ts, settings)); (byKey[k] = byKey[k] || []).push(x); });
  const first = new Date(year, month, 1);
  const lead = settings.weekStartsSunday ? first.getDay() : (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const trail = (7 - ((lead + daysInMonth) % 7)) % 7; // next-month days that complete the final week
  // Walk a whole number of weeks: prev-month tail (lead), this month, next-month head (trail). JS
  // Date normalises the out-of-range day-of-month, so day 0 = last of prev month, etc.
  const cells: Date[] = [];
  for (let i = 0; i < lead + daysInMonth + trail; i++) cells.push(new Date(year, month, 1 - lead + i));
  const headers = settings.weekStartsSunday ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {headers.map((h) => (<div key={h} style={{ textAlign: "left", fontSize: 11, color: C.muted, fontFamily: "var(--fl-mono)", paddingLeft: 4 }}>{h}</div>))}
        {cells.map((date, idx) => {
          const inMonth = date.getMonth() === month && date.getFullYear() === year;
          const isToday = inMonth && keyOf(date) === activeK;
          const wd = date.getDay();
          const list = (byKey[keyOf(date)] || []).sort((a: any, b: any) => +new Date(a.ts) - +new Date(b.ts));
          return (
            <div key={idx} className="fl-calday" onClick={() => onOpenDay && onOpenDay(date)}
              onContextMenu={(e: any) => { e.preventDefault(); onDayMenu && onDayMenu(date, e); }}
              aria-label={`Open daily note for ${date.toLocaleDateString()} (right-click for actions)`}
              style={{ minHeight: 56, boxSizing: "border-box", border: isToday ? `2.5px solid ${ACCENT}` : `1px solid ${C.line}`, borderRadius: 6, padding: 4, background: C.paper, cursor: "pointer", opacity: inMonth ? 1 : 0.5 }}>
              <div style={{ fontSize: 10.5, fontFamily: "var(--fl-mono)", color: inMonth ? (hasNote && hasNote(date) ? DATE_BROWN.note : DATE_BROWN.plain) : C.faint, fontWeight: hasNote && hasNote(date) ? 700 : 400, marginBottom: 3 }}>{date.getDate()}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                {list.map((x: any) => (<span key={x.id} aria-label={`${x.task} \u00B7 ${bandLabel(x.ts, settings)}`} style={{ width: 9, height: 9, borderRadius: 2, background: timeColor(x.ts, settings, override) }} />))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 12, fontSize: 11, color: C.muted }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {WORK_SQUARES.map((c) => (<span key={c} style={{ width: 9, height: 9, borderRadius: 2, background: c }} />))}work day
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {RELAX_SQUARES.map((c) => (<span key={c} style={{ width: 9, height: 9, borderRadius: 2, background: c }} />))}relax day
        </span>
        <span>light {"→"} dark = morning {"→"} evening</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ color: DATE_BROWN.note, fontWeight: 700, fontFamily: "var(--fl-mono)" }}>7</span>= has a daily note</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: OVERNIGHT_COLOR }} />night (before morning begins)</span>
      </div>
    </div>
  );
}

// Break feeling: four season trees, deliberately WITHOUT a good/bad axis — sometimes it's hard
// to tell. They capture the flavour instead: did the break cool you down (Winter) or leave you
// energised (Summer)? Shared with the float window's break screen.
export const BREAK_SEASONS = [
  { v: 1, img: treeSpring, name: "Spring" },
  { v: 2, img: treeSummer, name: "Summer" },
  { v: 3, img: treeAutumn, name: "Autumn" },
  { v: 4, img: treeWinter, name: "Winter" },
];
// Enjoyment rating: a 4-step weather scale (rain to sun), each its own colour. Same look before/after.
const RATE_SCALE = [
  { v: 1, img: rateRain, bg: "#BCBCBC" },
  { v: 2, img: rateClouds, bg: "#E3EBF1" },
  { v: 3, img: ratePartly, bg: "#C9EAFF" },
  { v: 4, img: rateSun, bg: "#89D2FF" },
];
function Scale({ value, onChange, label, weather, seasons, color }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ color: C.muted, fontSize: 12 }}>{label}</label>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {seasons ? BREAK_SEASONS.map((sn) => (
          <button key={sn.v} onClick={() => onChange(sn.v)} aria-pressed={value === sn.v} aria-label={sn.name} style={{ width: 48, height: 48, borderRadius: 10, border: value === sn.v ? `2.5px solid ${C.ink}` : `1.5px solid ${C.faint}`, background: C.card, cursor: "default", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 5, boxSizing: "border-box" }}>
            <img src={sn.img} alt={sn.name} draggable={false} style={{ width: 32, height: 32, display: "block" }} />
          </button>
        )) : weather ? RATE_SCALE.map((w) => (
          <button key={w.v} onClick={() => onChange(w.v)} aria-pressed={value === w.v} style={{ width: 48, height: 48, borderRadius: 10, border: value === w.v ? `2.5px solid ${C.ink}` : `1.5px solid ${C.faint}`, background: w.bg, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 5, boxSizing: "border-box" }}>
            <img src={w.img} alt={"rating " + w.v} draggable={false} style={{ width: 32, height: 32, display: "block" }} />
          </button>
        )) : [1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => onChange(s)} style={{ width: 38, height: 38, borderRadius: 8, border: `1.5px solid ${value === s ? (color || C.ink) : C.faint}`, background: value === s ? (color || C.ink) : "transparent", color: value === s ? "#fff" : C.ink, fontFamily: "var(--fl-mono)", cursor: "pointer" }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

// Last-6-months contributions heatmap: weeks as columns, Mon–Sun as rows, coloured by the day's
// pomodoro count. Computed from sessions grouped by logical day (so it respects the day-start).
const HEAT = ["#f3d9bf", "#ecbf8e", "#e09a55", "#d0703e", "#b94a2e", "#9a3420"]; // 6 levels, light → deep
const HEAT_EMPTY = "#e8e0cf"; // a day with 0 pomodoros
const DEFAULT_HEAT_TH = [1, 2, 4, 6, 8, 10]; // min pomodoros for each colour, fallback for invalid input
// Parse the settings string into 3 to 6 ascending positive thresholds (else the default).
function parseHeatTh(s: string): number[] {
  const nums = (s || "").split(/[^0-9]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length < 3 || nums.length > 6) return DEFAULT_HEAT_TH.slice();
  for (let i = 1; i < nums.length; i++) if (nums[i] <= nums[i - 1]) return DEFAULT_HEAT_TH.slice();
  return nums;
}
// Resample the 6-colour ramp down to n bands (3-6) so the first band is always the lightest and
// the last is always the deepest, however many thresholds the user gave (full light-to-deep range).
function heatPalette(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(HEAT[Math.round((i * (HEAT.length - 1)) / (n - 1))]);
  return out;
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
  const PAL = heatPalette(TH.length);
  const heat = (n: number) => { if (!n) return HEAT_EMPTY; let lvl = 0; for (let i = 0; i < TH.length; i++) if (n >= TH[i]) lvl = i; return PAL[lvl]; };
  const lvlLabel = (i: number) => { const lo = TH[i]; if (i === TH.length - 1) return lo + "+"; const hi = TH[i + 1] - 1; return hi <= lo ? String(lo) : lo + "-" + hi; };

  const cells: any[] = [];
  for (let dow = 0; dow < 7; dow++) for (let w = 0; w < weeks; w++) {
    const day = new Date(+gridStart + (w * 7 + dow) * DAY);
    const inRange = day >= startMonth && day <= end;
    const k = ymd(day), n = counts[k] || 0;
    cells.push(<div key={dow + "-" + w} aria-label={inRange ? `${k}: ${n}${"\u{1F345}"}` : undefined} style={{ width: CELL, height: CELL, borderRadius: 2, boxSizing: "border-box", background: inRange ? heat(n) : "transparent", border: `1px solid ${inRange ? C.line : "transparent"}` }} />);
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
        {[{ c: HEAT_EMPTY, label: "0" }, ...PAL.map((c, i) => ({ c, label: lvlLabel(i) }))].map((it: any, i: number) => (
          <span key={i} aria-label={`${it.label} pomodoro${it.label === "1" ? "" : "s"}`} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
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
function InfoIcon({ size = 16 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>);
}
function ChevronLeftIcon({ size = 16 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="m15 18-6-6 6-6" /></svg>);
}
function ChevronRightIcon({ size = 16 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="m9 18 6-6-6-6" /></svg>);
}
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
function MinusIcon({ size = 16 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M5 12h14" /></svg>);
}
function PlusIcon({ size = 16 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M5 12h14" /><path d="M12 5v14" /></svg>);
}
function BookmarkIcon({ size = 13, filled = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />
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
function PinIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}
function ClockIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l-4 2" />
    </svg>
  );
}
function ListTodoIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M13 5h8" />
      <path d="M13 12h8" />
      <path d="M13 19h8" />
      <path d="m3 17 2 2 4-4" />
      <rect x="3" y="4" width="6" height="6" rx="1" />
    </svg>
  );
}
function BriefcaseBusinessIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M12 12h.01" />
      <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M22 13a18.15 18.15 0 0 1-20 0" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </svg>
  );
}
function LeafIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}
function UtensilsIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
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

function LogForm({ tasks, preset, onAdd, settings, secs, running, paused, resetTimer, pomoMin, changePomo, stepPomo, chooseNext, setChooseNext, nextTask, setNextTask, onStart, onPickTask, onPause, pauseActive, pauseTags, pauseTag, setPauseTag, tagColor, tagBorder, floatOn, setFloatOn, lenLocked, finished, expected, onSetExpected, autoLogDefault, onAutoLogChange }: any) {
  const [task, setTask] = useState(preset || "");
  const [act, setAct] = useState(0);   // 0 = not rated yet: no weather button pre-highlighted
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

  useEffect(() => setTask(preset || ""), [preset, tasks]);

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
    setAct(0);   // clear the rating so the next pomodoro's finish panel starts unhighlighted
  };
  const submit = () => buildAndAdd(act, expected);
  // The "before" rating lives on the timer engine (single source of truth), so the panel, the
  // float, and a quick-log all agree — and resetting the timer clears it for the next pomodoro.
  const setExpected = (v: number) => { onSetExpected && onSetExpected(v); };
  // The "after" rating just records the score; committing is the deliberate "Light up a star" tap
  // below (which needs a rating first), so finishing a pomodoro never auto-logs or jumps to a break.
  const rateActual = (v: number) => setAct(v);
  const toggleAuto = (v: boolean) => { setAutoLog(v); onAutoLogChange && onAutoLogChange(v); };
  const inputStyle: any = { border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 14, width: "100%", borderRadius: 6, padding: "8px 12px", boxSizing: "border-box", lineHeight: 1.5 };
  const rated = expected >= 1 && expected <= 5;
  const hasTask = !!(task && task.trim());
  const canLog = rated && hasTask;
  const blockStart = !running && !paused && !pauseActive && !canLog;
  const logBtn = <button onClick={submit} disabled={!canLog} aria-label={canLog ? undefined : "pick a task and an expected rating first"} style={{ ...btn(C.ink), width: "100%", padding: "10px", opacity: canLog ? 1 : 0.5, cursor: canLog ? "pointer" : "not-allowed" }}>log pomodoro + write Act</button>;
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
          <InfoHover C={C} label="how the Focus form works" width={360}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Focus</div>
            <div>Pick a task, set your expected feeling, and run the timer; when it finishes you rate how it actually went and the pomodoro is logged.</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              <li><b>Task</b>: today's tasks from the Plan; "Act +1" writes back to this task's Notion page.</li>
              <li><b>Feeling</b>: the four weathers, rain to full sun; your before and after ratings are both saved.</li>
              <li><b>Timer</b>: the round buttons set 5 to 30 minutes (hold to speed up); the length locks while a pomodoro runs; the circle arrow resets the timer and task.</li>
              <li><b>Pause</b>: pausing asks for a reason, yellow for internal, blue for external; it is recorded in the Pause view.</li>
              <li><b>Log manually</b>: adds a pomodoro without running the timer.</li>
            </ul>
          </InfoHover>
          <button disabled={lenLocked || pomoMin <= 5} onMouseDown={() => beginHold(-1)} onMouseUp={endHold} onMouseLeave={endHold} aria-label={lenLocked ? "length is locked while a pomodoro is running" : "shorter — hold to speed up (min 5)"} style={{ width: 24, height: 24, padding: 0, borderRadius: 999, border: `1.5px solid ${C.ink}`, background: "transparent", color: C.ink, boxShadow: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: (lenLocked || pomoMin <= 5) ? 0.4 : 1, cursor: lenLocked ? "not-allowed" : "pointer" }}><MinusIcon size={14} /></button>
          <button onClick={running ? onPause : () => onStart(task)} disabled={blockStart} aria-label={blockStart ? "pick a task and an expected rating first" : undefined} style={{ ...btn(C.ink), borderRadius: 999, height: 32, padding: "0 21px", minWidth: 84, opacity: blockStart ? 0.5 : 1, cursor: blockStart ? "not-allowed" : "pointer" }}>{running ? "pause" : <>{(paused || pauseActive) ? "resume" : "start"}<span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12.5, marginLeft: 5 }}>{pomoMin}m</span></>}</button>
          <button disabled={lenLocked || pomoMin >= 30} onMouseDown={() => beginHold(1)} onMouseUp={endHold} onMouseLeave={endHold} aria-label={lenLocked ? "length is locked while a pomodoro is running" : "longer — hold to speed up (max 30)"} style={{ width: 24, height: 24, padding: 0, borderRadius: 999, border: `1.5px solid ${C.ink}`, background: "transparent", color: C.ink, boxShadow: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: (lenLocked || pomoMin >= 30) ? 0.4 : 1, cursor: lenLocked ? "not-allowed" : "pointer" }}><PlusIcon size={14} /></button>
          <button onClick={() => { resetTimer(); setTask(""); onPickTask && onPickTask(""); }} aria-label="reset" style={{ width: 24, height: 24, padding: 0, borderRadius: 999, border: `1.5px solid ${C.faint}`, background: "transparent", color: C.muted, boxShadow: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RotateCcwIcon size={12} /></button>
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, fontSize: 12.5, color: C.muted, cursor: "pointer" }}>
        <input type="checkbox" checked={!!floatOn} onChange={(e) => setFloatOn(e.target.checked)} style={{ width: 15, height: 15, accentColor: C.ink, cursor: "pointer" }} />
        open floating window
      </label>
      {pauseActive && (
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 8, background: C.paper, border: `1px solid ${C.faint}` }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: C.muted }}>Paused — why? Pick a tag; it's written to your note when you resume.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {pauseTags.length === 0 ? <span style={{ fontSize: 12, color: C.muted }}>No pause tags — add some in the Pause tab.</span> :
              pauseTags.map((pt: any) => {
                const on = pauseTag === pt.name;
                return <button key={pt.id} onClick={() => setPauseTag(on ? "" : pt.name)} style={{ padding: "5px 12px", borderRadius: 999, border: `${on ? 2 : 1.5}px solid ${catBorder(pt.category)}`, background: catColor(pt.category), color: C.ink, boxShadow: "none", fontWeight: on ? 700 : 500, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--fl-display)", whiteSpace: "normal", maxWidth: "100%", height: "auto", minHeight: 0, lineHeight: 1.35 }}>{on ? "✓ " : ""}{pt.name}</button>;
              })}
          </div>
        </div>
      )}

      {/* The task picker stays visible in both phases — it's the page Act +1 writes to. */}
      <select value={task} onChange={(e) => { setTask(e.target.value); onPickTask && onPickTask(e.target.value); }} style={{ ...inputStyle, marginTop: 4, marginBottom: 12, padding: "10px 12px", lineHeight: 1.6, height: "auto", minHeight: 44 }}>
        <option value="">{tasks.length ? "— pick a task —" : "— no tasks (sync first) —"}</option>
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
          <Scale label="after: how enjoyable was it actually?" value={act} onChange={rateActual} weather />
          <button onClick={submit} disabled={!act || !canLog}
            aria-label={!act ? "pick a rating first" : (canLog ? undefined : "pick a task first")}
            style={{ ...btn(C.ink), width: "100%", padding: "10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: (act && canLog) ? 1 : 0.5, cursor: (act && canLog) ? "pointer" : "not-allowed" }}>
            <img src={starImg} alt="" draggable={false} style={{ width: 16, height: 16 }} /> Light up a star in my Sky
          </button>
        </div>
      ) : (
        /* ---------- BEFORE the pomodoro: set the expectation, then start the timer ---------- */
        <div>
          <Scale label="Feeling" value={expected} onChange={setExpected} weather />
          <button onClick={() => setShowManual((s) => !s)} style={{ ...btn(C.ink), borderRadius: 999, fontSize: 12.5, padding: "6px 14px" }}>{showManual ? "− hide manual log" : "+ log a pomodoro manually"}</button>
          {showManual && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
              <p style={{ fontSize: 12, color: C.muted, margin: "0 0 10px" }}>Logs the task above with the "before" rating as the expectation, and the timer's elapsed time (a full {pomoMin}m if the timer wasn't used).</p>
              <Scale label="after: how enjoyable was it actually?" value={act} onChange={setAct} weather />
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
        <span style={{ color: C.ink }}>{s.expected}</span>
        <span style={{ color: C.muted }}> {"→"} </span>
        <span style={{ color: C.ink }}>{s.actual}</span>
      </span>
      <button onClick={() => onEdit(s)} className="fl-rowact" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
      <button onClick={() => onDelete(s)} className="fl-rowact fl-rowdel" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
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
      <Scale label="expected (before)" value={draft.expected} onChange={(v: number) => setDraft({ ...draft, expected: v })} weather />
      <Scale label="actual (after)" value={draft.actual} onChange={(v: number) => setDraft({ ...draft, actual: v })} weather />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={btn(C.muted, true)}>cancel</button>
        <button onClick={onSave} style={btn(ACCENT)}>save</button>
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
  const [statusSub, setStatusSub] = useState("month");
  // The daily note focused in the workspace (ms timestamp), null when none: drives the calendar outline.
  const [activeDaily, setActiveDaily] = useState<number | null>(api.getActiveDaily ? api.getActiveDaily() : null);
  useEffect(() => { if (!api.onActiveDaily) return; return api.onActiveDaily((ts: number | null) => setActiveDaily(ts)); }, []);
  const [preset, setPreset] = useState("");
  const [weekOff, setWeekOff] = useState(0);
  const [monthOff, setMonthOff] = useState(0);
  const [introOpen, setIntroOpen] = useState(false);   // the Timeline's formatted how-it-works hover card
  // Scroll the wheel over the "Mon Year" label to spin through months (down = next, up = previous).
  // React's onWheel is passive, so a native non-passive listener is needed to preventDefault the page
  // scroll. A SIGNED, keep-the-remainder distance accumulator drives stepping: one month per ~60px of
  // scroll, so a small movement moves ~1 month and a big one moves proportionally more. It is never
  // reset on a direction change (a stray opposite-sign trackpad "bounce" only nudges it, never wipes it,
  // so it can't stick), and a real idle gap starts a fresh gesture. No per-gesture cap or cooldown, so a
  // continuous scroll never stalls waiting for a pause.
  const monthLabelRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = monthLabelRef.current;
    if (!el) return;
    let acc = 0, lastT = 0;
    const STEP = 60;             // accumulated scroll (px) per one-month step
    const IDLE = 250;            // ms; a pause this long starts a fresh gesture
    const onWheel = (e: WheelEvent) => {
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;         // line mode -> approx pixels
      else if (e.deltaMode === 2) dy *= 400;   // page mode -> one firm push
      if (!dy) return;
      e.preventDefault();
      const now = e.timeStamp;
      if (now - lastT > IDLE) acc = 0;   // a real pause starts a fresh gesture
      lastT = now;
      acc += dy;
      if (Math.abs(acc) < STEP) return;
      const dir = acc > 0 ? 1 : -1;
      setMonthOff((m: number) => m + dir);
      acc -= dir * STEP;                 // keep the remainder: reversible, no cap -> never stalls mid-scroll
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view, statusSub]);
  const [sync, setSync] = useState("idle");
  const [pendingSyncRebuild, setPendingSyncRebuild] = useState(false); // sync also rebuilds the timeline (subsumes the old restart), deferred until the fresh tasks land in state
  const [flash, setFlash] = useState("");
  const settings = api.settings;

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

  // Floating-window preference, controllable right from the log view. The checkbox
  // mirrors the floatOnStart setting (a persistent "open the float when I start" choice),
  // not the live window state — so an untouched box never silently opens the float on start.
  // Ticking it opens the window now and on every fresh start; unticking closes it and keeps
  // starts quiet.
  const [floatOn, setFloatOnState] = useState<boolean>(!!settings.floatOnStart);
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
  const [editRoutineDur, setEditRoutineDur] = useState<number>(15);
  const [newMorning, setNewMorning] = useState("");
  const [newNight, setNewNight] = useState("");
  const [routineDrag, setRoutineDrag] = useState<{ w: string; i: number } | null>(null);
  const [routineOver, setRoutineOver] = useState<{ w: string; i: number } | null>(null);
  // Timeline (daily plan): timelineMode swaps the today list for the time axis.
  const [timelineMode, setTimelineModeState] = useState(false);
  const [plans, setPlans] = useState<any>(init.plans || {});
  const [tlDrag, setTlDrag] = useState<{ id: string; grab: number; button: number; y: number; tlTop: number; downY?: number } | null>(null);
  const [planUndo, setPlanUndo] = useState<any[] | null>(null);
  useEffect(() => { if (!planUndo) return; const tm = window.setTimeout(() => setPlanUndo(null), 8000); return () => window.clearTimeout(tm); }, [planUndo]);
  const [editBlockId, setEditBlockId] = useState<string | null>(null);
  const [blockDraft, setBlockDraft] = useState<{ name: string; dur: number; start?: string; power?: string; load?: string; category?: string }>({ name: "", dur: 30 });
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
          <button onClick={saveEditTag} aria-label="save" style={{ ...btn(C.ink), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SaveIcon size={15} /></button>
          <button onClick={() => setEditTagId(null)} aria-label="cancel" style={{ ...btn(C.muted, true), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><CircleXIcon size={15} /></button>
        </div>
      );
    }
    return (
      <div key={t.id}
        className="fl-act-row"
        onDragOver={(e) => { e.preventDefault(); if (tagOver !== i) setTagOver(i); }}
        onDrop={(e) => { e.preventDefault(); if (tagDrag != null && catOf(pauseTags[tagDrag] && pauseTags[tagDrag].category) === cat) moveTag(tagDrag, i); setTagDrag(null); setTagOver(null); }}
        style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 10px", background: "#fbf8f1", border: `1px solid ${C.line}`, borderLeft: `4px solid ${catBorder(cat)}`, borderRadius: 6, color: C.ink, opacity: tagDrag === i ? 0.4 : 1, boxShadow: tagOver === i && tagDrag !== null && tagDrag !== i ? `inset 0 2px 0 ${C.ink}` : "none" }}>
        <span draggable onDragStart={(e) => { setTagDrag(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }} onDragEnd={() => { setTagDrag(null); setTagOver(null); }} aria-label="drag to reorder" style={{ display: "grid", gridTemplateColumns: "3px 3px", gap: 3, cursor: "grab", flexShrink: 0, padding: "2px 1px" }}>
          {Array.from({ length: 6 }).map((_, k) => (<span key={k} style={{ width: 3, height: 3, borderRadius: "50%", background: C.faint }} />))}
        </span>
        {!tinyPanel && <span style={{ minWidth: 88, flexShrink: 0, display: "flex", alignItems: "center" }}><span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", padding: "1px 8px", borderRadius: 999, background: catColor(cat), border: `1px solid ${catBorder(cat)}`, color: "#2b2723", whiteSpace: "nowrap" }}>{cat}</span></span>}
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{t.name}</span>
        <button onClick={() => { setEditTagId(t.id); setEditTagName(t.name); setEditTagCat(cat); }} className="fl-rowact" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
        <button onClick={() => removePauseTag(t.id)} className="fl-rowact fl-rowdel" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
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
  // Keep the panel's task on whatever the engine is running, so the Focus view matches the float
  // and doesn't snap to the first task on a re-render. We only adopt the engine task once we've
  // seen a genuinely-live run (running === true) during THIS panel's lifetime — a pause that began
  // in this session keeps the task (sawRun stays true), but a paused pomodoro left over from before
  // a restart/reopen is never adopted, so a fresh panel shows "— pick a task —" instead of it.
  const sawRun = useRef(false);
  if (timer.running) sawRun.current = true;
  useEffect(() => { if (sawRun.current && (timer.running || timer.paused) && timer.taskName) setPreset(timer.taskName); }, [timer.taskName, timer.running, timer.paused]);
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
  useEffect(() => {
    if (!api.onRequestSkyView) return;
    return api.onRequestSkyView(() => setView("sky"));
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
    try { const fresh = await api.sync(); setTasks(fresh); setDoneSess({}); setSync("ok"); setPendingSyncRebuild(true); setFlash(fresh.length + " tasks loaded from Notion, timeline rebuilt."); }
    catch (e: any) { setSync("error"); setFlash("Sync failed: " + (e?.message || e)); }
  };

  const logPomodoro = async (s: any, markDone?: boolean) => {
    persist([...sessions, s]);
    api.timer.commitPendingPause(); // write any open pause before clearing the timer
    resetTimer();
    const key = s.pageId || s.task;
    setDoneSess((m: any) => ({ ...m, [key]: (m[key] || 0) + 1 }));
    // Clicking "Light up a star" logs the pomodoro, then jumps to the break as before. A notice (which
    // stays up in the break view) names the exact star this pomodoro lit; a left-click on it jumps to
    // the Sky (Pomodoros) to see the star.
    const starName = newestStarName(sessions.length + 1);
    if (settings.breakEnabled) { startBreak(); setView("break"); } else { setView("today"); }
    if (starName) {
      const msg = "You lit up " + starName + " ✨  Click to see it in your Sky.";
      if (api.notifyClickable) api.notifyClickable(msg, () => setView("sky"));
      else if (api.notify) api.notify(msg, 9000);
    }
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

  // "Today" for the month grid and the this-month / this-year totals is the real CALENDAR date, not
  // the day-start-shifted logical day. Otherwise, past the day-start (e.g. 20:00) the reference rolls
  // into tomorrow and the calendar jumps to next month while the wall clock still says today.
  const nowCal = startOfDay(new Date());
  const wkStartNow = logicalWeekStart(Date.now(), settings);
  const inWeek = sessions.filter((s) => { const d = logicalDay(s.ts, settings); return d >= wkStartNow && d < new Date(wkStartNow.getTime() + 7 * DAY); });
  const inMonth = sessions.filter((s) => { const d = logicalDay(s.ts, settings); return d.getMonth() === nowCal.getMonth() && d.getFullYear() === nowCal.getFullYear(); });
  const inYear = sessions.filter((s) => logicalDay(s.ts, settings).getFullYear() === nowCal.getFullYear());
  const countWeek = inWeek.length;
  const countMonth = inMonth.length;
  const countYear = inYear.length;
  const countToday = sessions.filter((s) => sameLogicalDay(s.ts, Date.now(), settings)).length;
  const sumMin = (arr: any[]) => arr.reduce((a, s) => a + (Number(s.minutes) || 25), 0);
  const hrsOf = (mins: number) => (Math.round(mins / 6) / 10).toFixed(1);
  const monthRef = new Date(nowCal.getFullYear(), nowCal.getMonth() + monthOff, 1);

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
  const pauseMonth = pauses.filter((p) => { const d = logicalDay(p.ts, settings); return d.getMonth() === nowCal.getMonth() && d.getFullYear() === nowCal.getFullYear(); });
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
        <button onClick={saveEditAct} aria-label="save" style={{ ...btn(C.ink), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SaveIcon size={15} /></button>
        <button onClick={() => setEditActId(null)} aria-label="cancel" style={{ ...btn(C.muted, true), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><CircleXIcon size={15} /></button>
      </div>
    ) : (
      <div key={a.id}
        className="fl-act-row"
        onClick={brk.active ? () => togglePick(a.id) : undefined}
        onDragOver={(e) => { e.preventDefault(); if (actOver !== i) setActOver(i); }}
        onDrop={(e) => { e.preventDefault(); moveActivity(actDrag, i); setActDrag(null); setActOver(null); }}
        style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 10px", background: isPicked(a) ? areaColor(a.area) : "#fbf8f1", border: `1px solid ${C.line}`, borderLeft: `${isPicked(a) ? 6 : 4}px solid ${areaBorder(a.area)}`, borderRadius: 6, color: C.ink, cursor: brk.active ? "pointer" : "default", opacity: actDrag === i ? 0.4 : 1, boxShadow: actOver === i && actDrag !== null && actDrag !== i ? `inset 0 2px 0 ${C.ink}` : "none" }}>
        <span draggable onClick={(e) => e.stopPropagation()} onDragStart={(e) => { setActDrag(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }} onDragEnd={() => { setActDrag(null); setActOver(null); }} aria-label="drag to reorder" style={{ display: "grid", gridTemplateColumns: "3px 3px", gap: 3, cursor: "grab", flexShrink: 0, padding: "2px 1px" }}>
          {Array.from({ length: 6 }).map((_, k) => (<span key={k} style={{ width: 3, height: 3, borderRadius: "50%", background: C.faint }} />))}
        </span>
        {!tinyPanel && <span style={{ minWidth: 88, flexShrink: 0, display: "flex", alignItems: "center" }}><span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", padding: "1px 8px", borderRadius: 999, background: isPicked(a) ? "#fff" : areaColor(a.area), border: `1px solid ${areaBorder(a.area)}`, color: "#2b2723", whiteSpace: "nowrap" }}>{a.area}</span></span>}
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", fontWeight: isPicked(a) ? 700 : 400 }}>{isPicked(a) ? "✓ " : ""}{a.name}</span>
        {!narrowPanel && <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: C.muted }}>{a.count || 0}{"×"}</span>}
        {!narrowPanel && <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: C.muted, minWidth: 48, textAlign: "right" }}>{a.lastUsed ? fmtDate(a.lastUsed) : "—"}</span>}
        <button onClick={(e) => { e.stopPropagation(); startEditAct(a); }} className="fl-rowact" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
        <button onClick={(e) => { e.stopPropagation(); removeActivity(a.id); }} className="fl-rowact fl-rowdel" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
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
        aria-label={POWER_LABEL[t.power] || POWER_LABEL.Y}
        onDragOver={(e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i); }}
        onDrop={(e) => { e.preventDefault(); moveTask(dragIndex, i); setDragIndex(null); setOverIndex(null); }}
        style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 6, background: "#fff", border: `1px solid ${isOver ? C.ink : C.line}`, borderLeft: `4px solid ${POWER_COLOR[t.power] || POWER_COLOR.Y}`, boxShadow: isOver ? `inset 0 2px 0 ${C.ink}` : "none", opacity: isDragging ? 0.4 : 1 }}
      >
        <span
          draggable
          onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
          onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
          aria-label="drag to reorder"
          style={{ display: "grid", gridTemplateColumns: "3px 3px", gap: 3, cursor: "grab", flexShrink: 0, padding: "2px 1px" }}
        >
          {Array.from({ length: 6 }).map((_, k) => (<span key={k} style={{ width: 3, height: 3, borderRadius: "50%", background: C.faint }} />))}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, lineHeight: 1.3, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 6, rowGap: 2 }}><span style={{ color: LOAD_COLOR[t.load] || LOAD_COLOR.B, fontFamily: "var(--fl-mono)", fontWeight: 700, flexShrink: 0 }} aria-label={LOAD_LABEL[t.load] || LOAD_LABEL.B}>{t.load || "B"}</span>{cat && <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: personal ? TAG_COFFEE.personal.text : TAG_COFFEE.project.text, background: personal ? TAG_COFFEE.personal.bg : TAG_COFFEE.project.bg, border: `1px solid ${personal ? TAG_COFFEE.personal.border : TAG_COFFEE.project.border}`, borderRadius: 999, height: 16, boxSizing: "border-box", display: "inline-flex", alignItems: "center", padding: "0 7px", whiteSpace: "nowrap", flexShrink: 0 }}>{cat}</span>}<span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{titleText}</span>{t.king ? <img src={crownImg} alt="king" draggable={false} style={{ width: 13, height: 13, flexShrink: 0 }} /> : null}</div>
          {hier && <div style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hier}</div>}
        </div>
        <button onClick={() => togglePersonal(t.task)} className="fl-rowact" aria-label={personal ? "move to Project" : "move to Personal"} style={ICON_BTN}>{personal ? <BriefcaseIcon size={14} /> : <UserIcon size={14} />}</button>
        <button
          onClick={() => toggleFreeze(t.task)}
          className={"fl-lock" + (isFrozen ? " is-locked" : "")}
          aria-label={isFrozen ? "unpin from the top" : "pin to the top (by name, so it survives daily re-created Notion tasks)"}
          style={{ background: "transparent", border: "none", boxShadow: "none", height: "auto", cursor: "pointer", padding: 2, color: isFrozen ? C.ink : C.muted, flexShrink: 0, display: "inline-flex" }}
        >
          <BookmarkIcon size={13} filled={isFrozen} />
        </button>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }} aria-label={`${completed} of ${est} done for this task`}>
          <TomatoPips vivid={done} grey={remaining} />
        </div>
        <button onClick={() => openLog(t.task)} className="fl-rowact" aria-label="run a pomodoro" style={ICON_BTN}><PlayIcon size={14} /></button>
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
    const dur = Math.max(1, Math.min(480, Math.round(editRoutineDur) || 15));
    const updated = routineList(which).map((x: any) => (x.id === editRoutineId ? { ...x, name: n, dur } : x));
    routineSaver(which)(updated);
    // Keep the timeline in step: refresh any block referencing this routine item — a legacy
    // single-step block directly, or a grouped block via refIds (its length becomes the sum of its
    // steps' updated lengths, and its step labels refresh) — then re-flow.
    const byId: any = {}; updated.forEach((x: any) => { byId[x.id] = x; });
    const tb = todayBlocks();
    const touches = (b: any) => b.refId === editRoutineId || (Array.isArray(b.refIds) && b.refIds.indexOf(editRoutineId) !== -1);
    if (tb.some(touches)) setTodayBlocks(autoBreaksOf(tb.map((b: any) => {
      if (b.refId === editRoutineId) return { ...b, name: n, dur };
      if (Array.isArray(b.refIds) && b.refIds.indexOf(editRoutineId) !== -1) {
        const steps = b.refIds.map((id: string) => byId[id]).filter(Boolean);
        return { ...b, dur: steps.reduce((s: number, x: any) => s + (x.dur || ROUTINE_MIN), 0) || b.dur, steps: steps.map((x: any) => x.name) };
      }
      return b;
    })));
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
  const renderRoutineBlock = (which: string, hideHeader?: boolean) => {
    const list = routineList(which);
    const relax = dayMode === "relax";
    const label = which === "morning" ? <><SectionIcon src={blindsImg} /> Morning</> : <><SectionIcon src={tableLampImg} /> Night</>;
    const newVal = which === "morning" ? newMorning : newNight;
    const setNewVal = which === "morning" ? setNewMorning : setNewNight;
    return (
      <div>
        {!hideHeader && <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 10px" }}>{label}</h3>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.length === 0 && <p style={{ color: C.muted, fontSize: 12.5, margin: "0 0 0 2px" }}>None yet — add one below.</p>}
          {(() => {
          const groups = groupRoutine(list, settings.routineGroupMinutes || 25);
          let flat = -1;
          const renderStepRow = (it: any, i: number) => {
            const done = isRoutineDone(it.id);
            const dragging = !!routineDrag && routineDrag.w === which && routineDrag.i === i;
            const over = !!routineOver && routineOver.w === which && routineOver.i === i && !!routineDrag && !(routineDrag.w === which && routineDrag.i === i);
            if (editRoutineId === it.id) {
              return (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 6 }}>
                  <input value={editRoutineName} onChange={(e) => setEditRoutineName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEditRoutine(which); if (e.key === "Escape") setEditRoutineId(null); }} autoFocus style={{ flex: 1, minWidth: 80, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 8px", fontFamily: "var(--fl-display)" }} />
                  <input type="number" value={editRoutineDur} onChange={(e) => setEditRoutineDur(Number(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") saveEditRoutine(which); if (e.key === "Escape") setEditRoutineId(null); }} aria-label="length in minutes" style={{ width: 52, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "5px 6px" }} />
                  <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>min</span>
                  <button onClick={() => saveEditRoutine(which)} aria-label="save" style={{ ...btn(ACCENT), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SaveIcon size={15} /></button>
                  <button onClick={() => setEditRoutineId(null)} aria-label="cancel" style={{ ...btn(C.muted, true), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><CircleXIcon size={15} /></button>
                </div>
              );
            }
            return (
              <div key={it.id} className="fl-act-row"
                onDragOver={(e) => { e.preventDefault(); if (!routineOver || routineOver.w !== which || routineOver.i !== i) setRoutineOver({ w: which, i }); }}
                onDrop={(e) => { e.preventDefault(); if (routineDrag && routineDrag.w === which) moveRoutine(which, routineDrag.i, i); setRoutineDrag(null); setRoutineOver(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "7px 10px", background: ROUTINE_THEME[which][relax ? "relax" : "work"], border: `1px solid ${C.line}`, borderLeft: `4px solid ${ROUTINE_THEME[which].bar}`, borderRadius: 6, color: C.ink, opacity: dragging ? 0.4 : 1, boxShadow: over ? `inset 0 2px 0 ${C.ink}` : "none" }}>
                <span draggable onDragStart={(e) => { setRoutineDrag({ w: which, i }); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setRoutineDrag(null); setRoutineOver(null); }} aria-label="drag to reorder" style={{ display: "grid", gridTemplateColumns: "3px 3px", gap: 3, cursor: "grab", flexShrink: 0, padding: "2px 1px" }}>
                  {Array.from({ length: 6 }).map((_, k) => (<span key={k} style={{ width: 3, height: 3, borderRadius: "50%", background: C.faint }} />))}
                </span>
                <button onClick={() => toggleRoutineDone(it.id)} aria-label={done ? "mark not done" : "mark done"} style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 5, border: `1.5px solid ${done ? (relax ? C.better : MODE_COLORS.work.solid) : C.faint}`, background: done ? (relax ? C.better : MODE_COLORS.work.solid) : "transparent", color: "#fff", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{done && <CheckIcon size={12} />}</button>
                <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", textDecoration: done ? "line-through" : "none", color: done ? C.muted : C.ink }}>{it.name}</span>
                <button onClick={() => openLog(it.name)} className="fl-rowact" aria-label="run a pomodoro" style={ICON_BTN}><PlayIcon size={13} /></button>
                <button onClick={() => { setEditRoutineId(it.id); setEditRoutineName(it.name); setEditRoutineDur(it.dur || 15); }} className="fl-rowact" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
                <button onClick={() => removeRoutine(which, it.id)} className="fl-rowact fl-rowdel" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
              </div>
            );
          };
          // One header row per pomodoro-sized group, with a play that runs the whole group as a
          // single pomodoro (named like the timeline block), then the group's step rows.
          return groups.map((g: any, gi: number) => {
            const gname = routineGroupName(which, gi, groups.length);
            return (
              <React.Fragment key={"g" + gi}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: gi ? 6 : 0, padding: "0 2px" }}>
                  <button onClick={() => openLog(gname)} aria-label={`run "${gname}" as one pomodoro (${g.dur}m of steps)`} style={{ ...ICON_BTN, color: relax ? MODE_COLORS.relax.solid : MODE_COLORS.work.solid }}><PlayIcon size={14} /></button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, fontFamily: "var(--fl-display)" }}>{gname}</span>
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: "var(--fl-mono)" }}>{g.dur}m</span>
                </div>
                {g.steps.map((it: any) => { flat++; return renderStepRow(it, flat); })}
              </React.Fragment>
            );
          });
          })()}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input value={newVal} onChange={(e) => setNewVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addRoutine(which); }} placeholder={which === "morning" ? "add a morning step" : "add a night step"} style={{ flex: 1, minWidth: 0, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "7px 10px", fontFamily: "var(--fl-display)" }} />
          <button onClick={() => addRoutine(which)} aria-label="add" style={{ ...ADD_BTN, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><ListPlusIcon size={16} /></button>
        </div>
      </div>
    );
  };

  // ---------- Timeline (daily plan) ----------
  const PX_PER_MIN = 1.5;
  const tlStart = settings.morningBegins ?? 480;
  // The day ends where the next one starts: the bottom of the Timeline is the rollover, one full day below the top.
  const tlEnd = (settings.dayStart ?? 240) + 1440;
  // While the EARLIEST block itself is being dragged, one extra half-hour slot opens above it
  // (clamped at midnight): with a 6:15 start the 6:00 and 5:30 lines become visible and droppable,
  // so the morning can be pulled earlier. Dragging any other block leaves the layout untouched.
  const tlLeadOf = (blocks: any[]) => { if (!blocks.length) return tlStart; const first = Math.min(...blocks.map((b: any) => b.start)); return Math.max(0, Math.floor(first / 30) * 30 - 30); };
  const MIN_BLOCK_H = 28;
  const SHORT_BREAK_H = 36, LONG_BREAK_H = 54;   // break blocks: short ≈ a task block, long = 1.5×
  const GAP_PXM = 0.4;
  // Lay blocks out as a stack — each at least MIN_BLOCK_H tall (so short tasks stay
  // readable), gaps compressed. Items carry both a pixel band (topY..+height) and a time
  // band (t0..t1), which drive the render, the now-line, and drag mapping. Busy stretches
  // grow; quiet ones don't (no even hourly grid).
  const tlLayout = (blocks: any[]) => {
    const sorted = blocks.slice().sort((a: any, b: any) => a.start - b.start);
    const items: any[] = [];
    let y = 8, prevEnd: number | null = null;   // top pad: ruler labels centre on their line, so the first one needs headroom
    if (sorted.length && tlDrag && tlDrag.id === sorted[0].id) {
      const lead = tlLeadOf(sorted);
      if (sorted[0].start > lead) {
        const lh = (sorted[0].start - lead) * PX_PER_MIN;   // real scale: drops in it stay precise
        items.push({ type: "lead", t0: lead, t1: sorted[0].start, minutes: sorted[0].start - lead, topY: y, height: lh });
        y += lh;
      }
    }
    sorted.forEach((b: any) => {
      if (prevEnd != null && b.start > prevEnd) {
        // A tiny buffer gap (within the short-break setting) keeps its honest times but renders as
        // a 2px hairline, so blocks read as adjacent instead of showing an awkward sliver of blank.
        const gapMins = b.start - prevEnd;
        const gh = gapMins <= (settings.breakMinutes || 5) ? 2 : Math.max(7, gapMins * GAP_PXM);
        items.push({ type: "gap", t0: prevEnd, t1: b.start, minutes: b.start - prevEnd, topY: y, height: gh });
        y += gh;
      }
      const h = b.kind === "break" ? SHORT_BREAK_H : b.kind === "longbreak" ? LONG_BREAK_H : (b.kind === "meal" || (b.kind === "task" && !b.pageId)) ? Math.max(MIN_BLOCK_H, 25 * PX_PER_MIN) : Math.max(MIN_BLOCK_H, b.dur * PX_PER_MIN);
      items.push({ type: "block", b, t0: b.start, t1: b.start + b.dur, topY: y, height: h });
      y += h;
      prevEnd = b.start + b.dur;
    });
    return { items, totalH: Math.max(80, y + 8) };
  };
  const yToMin = (items: any[], y: number) => {
    if (!items.length) return tlStart;
    if (y <= items[0].topY) return items[0].t0;
    for (const it of items) if (y >= it.topY && y <= it.topY + it.height) return it.t0 + (it.height > 0 ? (y - it.topY) / it.height * (it.t1 - it.t0) : 0);
    return items[items.length - 1].t1;
  };
  const snap5 = (m: number) => Math.round(m / 5) * 5;
  // Drop snapping: 5-minute steps, with a MAGNET onto the half-hours — within 4 minutes of an
  // XX:00 / XX:30 the block lands exactly on it (matching the ruler and the live drag label).
  const snapDrop = (m: number) => { const half = Math.round(m / 30) * 30; return Math.abs(m - half) <= 4 ? half : snap5(m); };
  const fmtClock = (m: number) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(Math.round(m) % 60).padStart(2, "0");
  const clampStart = (m: number, dur: number) => Math.max(Math.min(tlStart, tlLeadOf(todayBlocks())), Math.min(tlEnd - dur, m));
  // Meals are hard-fixed anchors: no dragged block may occupy their minutes. avoidMeals returns the
  // free start nearest the requested one, trying the slot before and after each meal (chained meals
  // and the day-end clamp are handled by dropping candidates that still overlap). Overlaps left by a
  // cascade or a break edit are cleaned up separately by resolveOverlaps, which also pins meals.
  const avoidMeals = (start: number, dur: number, blocks: any[], selfId?: string) => {
    // A dropped block may not land on ANY anchor: meals, meetings, commitments (lock) or placed
    // tasks (pin). It slides to the nearest free spot beside the anchor instead.
    const anchors = blocks.filter((m: any) => (m.kind === "meal" || m.kind === "meeting" || (m.kind === "task" && (m.locked || m.placed))) && m.id !== selfId);
    const overlapsAnchor = (s: number) => anchors.some((m: any) => s < m.start + m.dur && s + dur > m.start);
    const base = clampStart(start, dur);
    if (!overlapsAnchor(base)) return base;
    const cands: number[] = [clampStart(tlStart, dur), clampStart(tlEnd - dur, dur)];
    anchors.forEach((m: any) => { cands.push(clampStart(m.start - dur, dur)); cands.push(clampStart(m.start + m.dur, dur)); });
    const free = cands.filter((c) => !overlapsAnchor(c)).sort((a, b) => Math.abs(a - start) - Math.abs(b - start));
    return free.length ? free[0] : base;
  };
  // Every blank span between consecutive blocks becomes a fixed-height break block (kind "break",
  // gap:true) whose length equals the gap, so manually opened blank time reads as a break.
  // Inverse of yToMin: the pixel y where a clock minute falls in the laid-out (non-linear) day —
  // drives the half-hour ruler and the now-time in the new left column.
  const minToY = (items: any[], m: number) => {
    if (!items.length) return -1;
    if (m < items[0].t0 || m > items[items.length - 1].t1) return -1;
    for (const it of items) if (m >= it.t0 && m <= it.t1) return it.topY + (it.t1 > it.t0 ? ((m - it.t0) / (it.t1 - it.t0)) * it.height : 0);
    return -1;
  };
  const todayBlocks = () => (plans[todayKey] || []);
  // Every plan mutation flows through here, so it also invalidates the undo snapshot — the only
  // caller that wants undo kept (the left-drag) re-sets planUndo right AFTER calling this.
  const setTodayBlocks = (blocks: any[]) => { setPlans((p: any) => ({ ...p, [todayKey]: blocks })); api.savePlan && api.savePlan(todayKey, blocks); setPlanUndo(null); };
  // Header day-summary: the pomodoro count comes from the timeline (task blocks; duplicates add up),
  // falling back to remaining task estimates when there's no plan. "ends" is the last block's end;
  // it overflows when that runs past your day-end (settings.dayEnds).
  const planBlocks0 = todayBlocks();
  const plannedPomos = planBlocks0.length
    ? planBlocks0.filter((b: any) => b.kind === "task").length
    : [...workTasks, ...personalTasks].reduce((s: number, t: any) => s + (t.pomodoros || 0), 0);
  const planEndMin = planBlocks0.reduce((m: number, b: any) => Math.max(m, b.start + b.dur), 0);
  const planOverflow = planBlocks0.length && planEndMin > (settings.dayEnds || 1380) ? Math.round(planEndMin - (settings.dayEnds || 1380)) : 0;
  // Prevent overlaps: in start order, any block that begins before the previous one ends
  // is pushed down. Free-time gaps are left untouched. When a pushed block is a task that
  // follows another task, a break is inserted between them — short, but a long break after
  // every `longEvery` short ones (the rhythm you set in the toolbar).
  const resolveOverlaps = (blocks: any[]) => {
    const shortB = settings.breakMinutes || 5;
    const meals = blocks.filter((m: any) => m.kind === "meal").slice().sort((a: any, c: any) => a.start - c.start);
    let cursor = -Infinity, prevTask = false;
    return blocks.slice().sort((a: any, c: any) => a.start - c.start).map((b: any) => {
      const isTask = b.kind === "task";
      if (b.kind === "meeting" || b.kind === "meal" || (b.kind === "task" && (b.locked || b.placed))) { cursor = Math.max(cursor, b.start + b.dur); prevTask = false; return b; }   // fixed anchors: never moved; everything else flows around them
      let start = b.start;
      if (start < cursor) start = cursor + (isTask && prevTask ? shortB : 0);
      for (const m of meals) if (start < m.start + m.dur && start + b.dur > m.start) start = m.start + m.dur;   // never sit on a meal (sorted, so one pass clears chained meals)
      cursor = start + b.dur;
      prevTask = isTask;
      return start === b.start ? b : { ...b, start };
    });
  };
  // One task block per Work+Personal task from the day start, with short breaks between
  // and a long break every N pomodoros (and once across noon). Saved as the day's plan.
  const ROUTINE_MIN = 15;
  // Pack consecutive routine steps into pomodoro-sized groups: each group's steps total at most one
  // pomodoro length (a single longer step gets a group of its own). The groups are what the Timeline
  // shows and what the play buttons run — one pomodoro per group, named e.g. "Morning routine 2/3".
  const groupRoutine = (list: any[], pomo: number) => {
    const groups: { steps: any[]; dur: number }[] = [];
    let cur: any[] = [], dur = 0;
    (list || []).forEach((it: any) => {
      const d = it.dur || ROUTINE_MIN;
      if (cur.length && dur + d > pomo) { groups.push({ steps: cur, dur }); cur = []; dur = 0; }
      cur.push(it); dur += d;
    });
    if (cur.length) groups.push({ steps: cur, dur });
    return groups;
  };
  const routineGroupName = (which: string, i: number, n: number) => (which === "morning" ? "Morning routine" : "Night routine") + (n > 1 ? " " + (i + 1) + "/" + n : "");
  // Smart rule: a plan never ends on a break — drop any break/long-break left at the tail.
  const mkBreak = (start: number, k: string) => ({ id: (k === "longbreak" ? "lb" : "sb") + Date.now() + "_" + Math.round(start), kind: k, name: k === "longbreak" ? "Long break" : "Break", start, dur: k === "longbreak" ? (settings.longBreakMinutes || 20) : (settings.breakMinutes || 5) });
  const buildInitialPlan = () => {
    const pomo = settings.pomodoroMinutes || 25;
    // A sync rebuild carries over only the day's SURVIVORS: meals keep their (possibly edited)
    // time and length, and manual commitment blocks (locked, not from Notion) stay fixed with
    // their lengths. Everything else is rebuilt fresh: Notion task blocks arrive unlocked and
    // unpinned (Notion re-creates them), routine groups regroup, and ALL breaks are deleted —
    // none are auto-inserted either (insertBreaks: false); press auto-fix to add the rhythm.
    const survivors = todayBlocks()
      .filter((b: any) => b.kind === "meal" || (b.kind === "task" && b.locked && !b.pageId))
      .map((b: any) => { const nb: any = { ...b }; delete nb.placed; return nb; });
    const blocks: any[] = [...survivors];
    let t = tlStart, seq = 0;
    // Morning routine, then the work + personal pomodoros back-to-back, then the night routine.
    // Breaks, the long-break rhythm, and the lunch/dinner meals are all added by autoBreaksOf, so
    // a rebuild and the auto-fix wand produce the same shape.
    const groupLen = settings.routineGroupMinutes || 25;
    if (!settings.skipMorningRoutine) { const gs = groupRoutine(activeMorning || [], groupLen); gs.forEach((g: any, gi: number) => {
      blocks.push({ id: "r" + Date.now() + "_" + (seq++), kind: "routine", name: routineGroupName("morning", gi, gs.length), start: t, dur: g.dur, refIds: g.steps.map((s: any) => s.id), steps: g.steps.map((s: any) => s.name) });
      t += g.dur;
    }); }
    // LOCAL (add-block) tasks come back from the task list too; skip any whose name already
    // survives as a locked manual block, so a commitment isn't duplicated.
    [...workTasks, ...personalTasks].filter((task: any) => !survivors.some((s: any) => s.kind === "task" && !s.pageId && s.name === task.task)).forEach((task: any) => {
      // Task blocks are always the standard 25 minutes on the timeline; the current Focus length
      // is recorded (pomoLen) without shaping the block.
      blocks.push({ id: "b" + Date.now() + "_" + (seq++), kind: "task", name: task.task, start: t, dur: 25, pomoLen: pomo, pageId: task.id || null, category: task.category || null, load: task.load || null, power: task.power || null });
      t += 25;
    });
    // Seed the night routine at its dinner anchor (dinner end + gap): the engine's anchor only
    // applies to night blocks whose start is at/after dinner, so a fresh build must start there —
    // otherwise a short day would seed them pre-dinner and they would flow before dinner. Use the
    // SURVIVING dinner block's (possibly edited) time when there is one, else the settings.
    const survDinner = survivors.find((b: any) => b.kind === "meal" && b.meal === "dinner");
    if (survDinner) t = Math.max(t, survDinner.start + survDinner.dur + (settings.nightRoutineGap ?? 60));
    else if (settings.dinnerEnabled) t = Math.max(t, (settings.dinnerStart ?? 1110) + (settings.dinnerMinutes ?? 45) + (settings.nightRoutineGap ?? 60));
    if (!settings.skipNightRoutine) { const gs = groupRoutine(activeNight || [], groupLen); gs.forEach((g: any, gi: number) => {
      blocks.push({ id: "r" + Date.now() + "_" + (seq++), kind: "routine", name: routineGroupName("night", gi, gs.length), start: t, dur: g.dur, refIds: g.steps.map((s: any) => s.id), steps: g.steps.map((s: any) => s.name), night: true });
      t += g.dur;
    }); }
    return autoBreaksOf(blocks, { insertBreaks: false });
  };
  // Sync now subsumes the old restart: once a sync has loaded fresh tasks into state, rebuild the
  // day's timeline from them (no prompt). Deferred to an effect so buildInitialPlan sees fresh tasks.
  useEffect(() => {
    if (!pendingSyncRebuild) return;
    setTodayBlocks(buildInitialPlan());
    setPendingSyncRebuild(false);
  }, [tasks, pendingSyncRebuild]);
  const setTimelineMode = (on: boolean) => {
    const hasInput = [...workTasks, ...personalTasks].length || (!settings.skipMorningRoutine && (activeMorning || []).length) || (!settings.skipNightRoutine && (activeNight || []).length);
    if (on && !plans[todayKey] && hasInput) setTodayBlocks(buildInitialPlan());
    else if (on && plans[todayKey]) {
      // A lunch/dinner toggle in settings only takes effect through autoBreaksOf; if the plan's
      // meals no longer match the settings, re-flow once on open so the change applies.
      const cur = plans[todayKey];
      const hasLunch = cur.some((b: any) => b.meal === "lunch"), hasDinner = cur.some((b: any) => b.meal === "dinner");
      if (!!settings.lunchEnabled !== hasLunch || !!settings.dinnerEnabled !== hasDinner) setTodayBlocks(autoBreaksOf(cur));
    }
    setTimelineModeState(on);
  };
  const duplicateBlock = (id: string) => {
    const blocks = todayBlocks();
    const b = blocks.find((x: any) => x.id === id);
    if (!b) return;
    const shift = b.dur;
    // Drop the copy DIRECTLY after the original (no gap), and push every block that starts
    // after the original down by the copy's footprint, so nothing overlaps.
    const shifted = blocks.map((x: any) => (x.id !== id && x.kind !== "meal" && !(x.kind === "task" && (x.locked || x.placed)) && x.start >= b.start + b.dur ? { ...x, start: x.start + shift } : x));
    // The copy is a fresh, casual block: it must not inherit the original's placed anchor.
    const copy: any = { ...b, id: "b" + Date.now(), start: b.start + b.dur };
    delete copy.placed;
    setTodayBlocks(resolveOverlaps([...shifted, copy]));
  };
  const deleteBlock = (id: string) => {
    const blk = todayBlocks().find((b: any) => b.id === id);
    setTodayBlocks(todayBlocks().filter((b: any) => b.id !== id));
    // Deleting a manual task block also removes its mirrored LOCAL task from the Task view.
    if (blk && blk.kind === "task" && !blk.pageId) {
      const nt = tasks.filter((t: any) => !(t.local && t.task === blk.name));
      if (nt.length !== tasks.length) { setTasks(nt); api.saveTasks && api.saveTasks(nt); }
    }
  };
  // Add a blank task block at the end and open it for naming. Lock it (the lock icon before its
  // name) if it's a fixed commitment, then auto-fix won't move it.
  const addBlock = () => {
    const pomo = settings.pomodoroMinutes || 25;
    const last = todayBlocks().reduce((m: number, b: any) => Math.max(m, b.start + b.dur), tlStart);
    const id = "b" + Date.now();
    setTodayBlocks([...todayBlocks(), { id, kind: "task", name: "New task", start: clampStart(snap5(last + (settings.breakMinutes || 5)), pomo), dur: pomo, power: "Y", load: "B" }]);
    setEditBlockId(id); setBlockDraft({ name: "New task", dur: pomo, power: "Y", load: "B", category: "" });
  };
  const toggleLock = (id: string) => setTodayBlocks(todayBlocks().map((b: any) => (b.id === id ? { ...b, locked: !b.locked } : b)));
  // Lunch/dinner blocks from settings: kept if already in the plan (so a dragged meal stays put),
  // added at the configured time when missing, dropped when their setting is turned off.
  const ensureMeals = (blocks: any[]) => {
    const keep = blocks.filter((b: any) => b.kind !== "meal" || (b.meal === "lunch" ? settings.lunchEnabled : b.meal === "dinner" ? settings.dinnerEnabled : false));
    const have = new Set(keep.filter((b: any) => b.kind === "meal").map((b: any) => b.meal));
    const add: any[] = [];
    if (settings.lunchEnabled && !have.has("lunch")) add.push({ id: "ml" + Date.now(), kind: "meal", meal: "lunch", name: "Lunch", start: settings.lunchStart ?? 750, dur: settings.lunchMinutes ?? 45 });
    if (settings.dinnerEnabled && !have.has("dinner")) add.push({ id: "md" + Date.now(), kind: "meal", meal: "dinner", name: "Dinner", start: settings.dinnerStart ?? 1110, dur: settings.dinnerMinutes ?? 45 });
    return add.length ? [...keep, ...add] : keep;
  };
  // Re-flow the day. BREAKS ARE PERSISTENT blocks the user owns: the engine never deletes or
  // resizes one — it re-classifies each by length (longer than the short-break setting = long
  // break, which restarts the pomodoro count) and glues it to the end of the block before it.
  // Tasks/routines pack in their CURRENT ORDER around the anchors (meals, locked commitments,
  // placed tasks), compacting into genuinely blank space; blank space that remains stays blank.
  // Missing rests are inserted only where no break/meal already provides one: a short break
  // between bare tasks, the every-N long break — never parked against a meal. Meals reset the
  // count; a locked commitment earns a long break after it; evening (after-dinner) tasks stay
  // after dinner and each gets a break, with the long-break rhythm off there.
  const autoBreaksOf = (blocksIn: any[], opts?: { insertBreaks?: boolean }) => {
    const insert = opts?.insertBreaks !== false;   // sync rebuilds pass false: pack only, add NO breaks
    const blocks = ensureMeals(blocksIn);
    const shortB = settings.breakMinutes || 5;
    const longB = settings.longBreakMinutes || 20;
    const N = Math.max(3, longEvery || 3);
    const fixed = blocks.filter((b: any) => b.kind === "meal" || b.kind === "meeting" || (b.kind === "task" && (b.locked || b.placed))).slice().sort((a: any, c: any) => a.start - c.start);
    const flow = blocks.filter((b: any) => (b.kind === "task" && !b.locked && !b.placed) || b.kind === "routine" || b.kind === "break" || b.kind === "longbreak").slice().sort((a: any, c: any) => a.start - c.start);
    const dinnerBlock = blocks.find((b: any) => b.kind === "meal" && b.meal === "dinner");
    const nightAnchor = dinnerBlock ? dinnerBlock.start + dinnerBlock.dur + (settings.nightRoutineGap ?? 60) : null;   // night routine starts nightRoutineGap (default 60) min after dinner
    const isBreak = (b: any) => b.kind === "break" || b.kind === "longbreak";
    // A break's KIND follows its length: within the short-break setting = short, longer = long.
    const classify = (b: any) => { const long = b.dur > shortB; const kind = long ? "longbreak" : "break"; return b.kind === kind ? b : { ...b, kind, name: long ? "Long break" : "Break" }; };
    if (!flow.length) {
      // Nothing to flow, but locked commitments still earn a long break in a free gap after them.
      const lts = fixed.filter((f: any) => f.kind === "task").slice().sort((a: any, c: any) => a.start - c.start);
      const extra: any[] = [];
      if (insert) for (let i = 0; i < lts.length - 1; i++) { const end = lts[i].start + lts[i].dur; if (lts[i + 1].start - end >= longB && !fixed.some((f: any) => f.id !== lts[i].id && end < f.start + f.dur && end + longB > f.start)) extra.push(mkBreak(end, "longbreak")); }
      return [...blocks, ...extra];
    }
    const overlapsFixed = (s: number, dur: number) => fixed.some((f: any) => s < f.start + f.dur && s + dur > f.start);
    // Advance past anchors. Meals are a rest in themselves; a locked commitment earns a long break
    // after it (when there's room), reported in `lb`; a placed task is a pure position anchor.
    const skipFixed = (s: number, dur: number, isBreakBlock = false) => {
      let moved = true, hitMeal = false, pins = 0; const lb: number[] = []; const sb: number[] = [];
      while (moved) {
        moved = false;
        for (const f of fixed) if (s < f.start + f.dur && s + dur > f.start) {
          const end = f.start + f.dur;
          if (f.kind === "meal") { s = end; hitMeal = true; }
          else if (f.kind === "task" && f.placed && !f.locked) {
            // A pinned task is still work: it COUNTS toward the every-N rhythm (pins), and a block
            // packing in behind it gets a SHORT break first (unless that block is itself a break,
            // or there is no room against the next anchor).
            pins++;
            if (insert && !isBreakBlock && !overlapsFixed(end, shortB)) { sb.push(end); s = end + shortB; }
            else s = end;
          }
          else if (f.kind === "task" && f.locked && insert && !overlapsFixed(end, longB)) { lb.push(end); s = end + longB; }
          else s = end;
          moved = true;
        }
      }
      return { s, hitMeal, lb, sb, pins };
    };
    const rest = (r: any) => r.hitMeal || r.lb.length > 0;
    const dinnerStart = dinnerBlock ? dinnerBlock.start : null;
    const dinnerEnd = dinnerBlock ? dinnerBlock.start + dinnerBlock.dur : null;
    const out: any[] = [...fixed];
    let t = flow[0].start, count = 0;
    let lastFlow: any = null;   // the chronologically previous placed block (for long-break merging)
    for (let i = 0; i < flow.length; i++) {
      let b = flow[i];
      if (isBreak(b)) {
        // Glue the user's break to whatever was just placed, keeping ITS length; a long one rests
        // the rhythm. It still may not sit on an anchor, so it skips past meals etc. like any block.
        b = classify(b);
        const r = skipFixed(t, b.dur, true);
        if (r.hitMeal) count = 0;
        count += r.pins;   // crossed pinned tasks are pomodoros: they count toward every-N
        r.lb.forEach((ls: number) => { const nb = mkBreak(ls, "longbreak"); out.push(nb); lastFlow = nb; count = 0; });
        t = r.s;
        // A LONG break parked against lunch or dinner (before or after, within the short-break
        // window) is DELETED outright — the meal is the rest — and everything later moves up in
        // order because the cursor does not advance.
        if (b.kind === "longbreak" && fixed.some((f: any) => f.kind === "meal" && t + b.dur >= f.start - shortB && t <= f.start + f.dur + shortB)) { count = 0; continue; }
        // Two long breaks back to back merge into ONE long break of the combined length (a + b).
        if (b.kind === "longbreak" && lastFlow && lastFlow.kind === "longbreak" && lastFlow.start + lastFlow.dur === t) {
          lastFlow.dur += b.dur;
          t += b.dur;
          count = 0;
          continue;
        }
        const placedB = { ...b, start: t };
        out.push(placedB); lastFlow = placedB;
        t += b.dur;
        if (b.kind === "longbreak") count = 0;
        continue;
      }
      // Night routine waits for the dinner-to-night gap ONLY while the user keeps it after dinner;
      // a night group moved before dinner flows in normal order instead of being shoved back.
      if (b.night && nightAnchor != null && dinnerStart != null && b.start >= dinnerStart && t < nightAnchor) t = nightAnchor;
      // Evening cohort: a task the user positioned at/after dinner STAYS after dinner — without
      // this, the pack pulls evening tasks back into the afternoon.
      if (dinnerStart != null && dinnerEnd != null && b.kind === "task" && b.start >= dinnerStart && t < dinnerEnd) t = dinnerEnd;
      const r = skipFixed(t, b.dur);
      if (r.hitMeal) count = 0;
      count += r.pins;   // crossed pinned tasks are pomodoros: they count toward every-N
      r.sb.forEach((ls: number) => { const nb = mkBreak(ls, "break"); out.push(nb); lastFlow = nb; });   // short break after a pinned task
      r.lb.forEach((ls: number) => { const nb = mkBreak(ls, "longbreak"); out.push(nb); lastFlow = nb; count = 0; });   // long break after a locked commitment
      t = r.s;
      const placed = { ...b, start: t };
      out.push(placed); lastFlow = placed;
      t += b.dur;
      if (b.kind === "task") count++;
      const next = flow[i + 1];
      if (!next || b.kind !== "task") continue;
      if (isBreak(next)) continue;   // the user's own break follows: it IS the rest (classified on its turn)
      if (!insert) continue;         // sync rebuild: pack only, never add breaks
      if (rest(skipFixed(t, next.dur))) { count = 0; continue; }   // a meal/commitment provides the rest
      const evening = dinnerEnd != null && t >= dinnerEnd;   // after dinner: a break after EVERY task, long-break rhythm off
      if (!evening && count >= N) {
        const lb = skipFixed(t, longB, true);
        if (rest(lb)) { count = 0; continue; }
        // Never park a long break against a meal — the meal itself is the rest.
        if (fixed.some((f: any) => f.kind === "meal" && lb.s + longB > f.start - shortB && lb.s < f.start + f.dur + shortB)) { count = 0; continue; }
        const nb = mkBreak(lb.s, "longbreak"); out.push(nb); lastFlow = nb; t = lb.s + longB; count = 0;
      }
      else if (next.kind === "task" || evening) { const sb = skipFixed(t, shortB, true); if (rest(sb)) { count = 0; continue; } const nb = mkBreak(sb.s, "break"); out.push(nb); lastFlow = nb; t = sb.s + shortB; }
    }
    return out;
  };
  // The wand: Notion task blocks ALWAYS keep the standard 25-minute size on the timeline — the
  // Focus view's current pomodoro length is only RECORDED on each task (pomoLen), never applied
  // to the block, so a shortened test pomodoro can't shrink the planned day.
  const autoBreaks = () => {
    const prev = todayBlocks();
    const pomo = settings.pomodoroMinutes || 25;
    const sized = prev.map((b: any) => (b.kind === "task" && b.pageId ? { ...b, dur: 25, pomoLen: pomo } : b));
    setTodayBlocks(autoBreaksOf(sized));
    setPlanUndo(prev);
  };
  const saveBlockEdit = () => {
    const blk = todayBlocks().find((b: any) => b.id === editBlockId);
    const name = blockDraft.name.trim() || "Untitled";
    const dur = Math.max(5, Math.min(480, Math.round(blockDraft.dur) || 30));
    if (blk && blk.kind === "meal") {
      // Re-time today's meal in place (the settings keep their defaults for future days); the meal
      // stays a hard anchor, so auto-fix flows everything around the edited time and never undoes it.
      const st = parseHM(String(blockDraft.start ?? ""));
      setTodayBlocks(autoBreaksOf(todayBlocks().map((b: any) => (b.id === editBlockId ? { ...b, name, dur, ...(st != null ? { start: st } : {}) } : b))));
      setEditBlockId(null);
      return;
    }
    if (blk && (blk.kind === "break" || blk.kind === "longbreak")) {
      // Editing a break's length: cap growth so the break never crosses a pinned meal (which would make
      // resolveOverlaps fling it past the meal), then shift everything after it by the delta (meals stay
      // pinned) and re-derive gap fillers. Mark it manual so auto-fix keeps the chosen length.
      const mealCap = todayBlocks().filter((m: any) => m.kind === "meal" && m.start >= blk.start).reduce((mn: number, m: any) => Math.min(mn, m.start - blk.start), Infinity);
      const bDur = Math.max(5, Math.min(dur, mealCap));
      const delta = bDur - blk.dur, end = blk.start + blk.dur;
      const shifted = todayBlocks().map((b: any) => (b.id === editBlockId ? { ...b, name, dur: bDur, manual: true } : (b.kind !== "meal" && b.start >= end ? { ...b, start: b.start + delta } : b)));
      setTodayBlocks(autoBreaksOf(shifted));   // re-glue: breaks are persistent, the engine keeps their lengths
      setEditBlockId(null);
      return;
    }
    setTodayBlocks(todayBlocks().map((b: any) => (b.id === editBlockId ? { ...b, name, dur, ...(b.kind === "task" && !b.pageId ? { power: blockDraft.power || b.power || "Y", load: blockDraft.load || b.load || "B", category: (blockDraft.category ?? "").trim() || null } : {}) } : b)));
    // A manual (add-block) task is a first-class task: mirror it into the Task view's list as a
    // LOCAL task, grouped Work/Personal by its Area tag, so the plugin also works without Notion.
    if (blk && blk.kind === "task" && !blk.pageId) {
      const entry = { id: null, local: true, task: name, category: (blockDraft.category ?? "").trim() || null, load: blockDraft.load || blk.load || "B", power: blockDraft.power || blk.power || "Y" };
      const nt = tasks.filter((t: any) => !(t.local && (t.task === blk.name || t.task === name)));
      if (!nt.some((t: any) => t.task === name)) nt.push(entry);   // never shadow a Notion task of the same name
      if (nt.length !== tasks.length || !tasks.some((t: any) => t.local && t.task === name)) { setTasks(nt); api.saveTasks && api.saveTasks(nt); }
    }
    // A routine block writes its length (and name) back to the routine item, so a rebuild
    // keeps the edited length.
    if (blk && blk.kind === "routine" && blk.refId) {
      const upd = (list: any[]) => list.map((it: any) => (it.id === blk.refId ? { ...it, name, dur } : it));
      if ((activeMorning || []).some((it: any) => it.id === blk.refId)) routineSaver("morning")(upd(activeMorning));
      else if ((activeNight || []).some((it: any) => it.id === blk.refId)) routineSaver("night")(upd(activeNight));
    }
    setEditBlockId(null);
  };
  // Drop a dragged block. LEFT-drag (button 0): move just this block, then auto-fix the break
  // rhythm (saving the prior plan so it's undoable). RIGHT-drag (button 2): cascade — move this
  // block and everything starting at/after it by the same delta, keeping their spacing, no auto-fix.
  const onTlDrop = (b: any, clientY: number) => {
    const d = tlDrag;
    const blocks = todayBlocks();
    const cur = blocks.find((x: any) => x.id === b.id);
    if (!d || !cur) { setTlDrag(null); return; }
    // A press-and-release without real vertical movement is a CLICK, not a drag: change nothing.
    if (d.downY != null && Math.abs(clientY - d.downY) < 4) { setTlDrag(null); return; }
    const tlTop = tlRef.current ? tlRef.current.getBoundingClientRect().top : d.tlTop;
    const target = snapDrop(yToMin(tlLayout(blocks).items, clientY - tlTop - d.grab));
    const newStart = avoidMeals(clampStart(target, cur.dur), cur.dur, blocks, cur.id);
    if (d.button === 2) {
      // cascade: shift this block + everything after it by one bounded delta, keeping internal
      // spacing (no auto-fix). Auto-generated + gap breaks are dropped and re-derived from the new
      // gaps; meals, meetings, and locked tasks are never part of the group and are never crossed.
      // Breaks are persistent blocks now: they travel with the cascade like everything else.
      const moving = blocks.filter((x: any) => x.start >= cur.start && (x.id === cur.id || (x.kind !== "meeting" && x.kind !== "meal" && !(x.kind === "task" && (x.locked || x.placed)))));
      const minStart = Math.min(...moving.map((x: any) => x.start));
      const maxEnd = Math.max(...moving.map((x: any) => x.start + x.dur));
      const delta = Math.max(Math.min(tlStart, tlLeadOf(blocks)) - minStart, Math.min(newStart - cur.start, tlEnd - maxEnd));
      const ids = new Set(moving.map((x: any) => x.id));
      // A right-drag is the deliberate "place this here" gesture: the GRABBED task becomes a
      // placed anchor that auto-fix will keep in position (the tail moved only to keep spacing,
      // so it is not marked). Release = click the pin on the block; Sync/rebuild clears all.
      const shifted = resolveOverlaps(blocks.map((x: any) => {
        if (!ids.has(x.id)) return x;
        const nb: any = { ...x, start: x.start + delta };
        if (x.id === cur.id && x.kind === "task" && !x.locked) nb.placed = true;
        return nb;
      }));
      // The gap the drag opened IN FRONT of the grabbed task hardens into a persistent break the
      // user owns: auto-fix keeps its length; longer than the short-break setting reads as long.
      const outBlocks = shifted.slice();
      const curNew = shifted.find((x: any) => x.id === cur.id);
      if (curNew) {
        const prevEnd = shifted.reduce((m: number, x: any) => (x.id !== cur.id && x.start + x.dur <= curNew.start ? Math.max(m, x.start + x.dur) : m), -1);
        const gap = prevEnd >= 0 ? curNew.start - prevEnd : 0;
        if (gap > 0) {
          const shortB = settings.breakMinutes || 5;
          outBlocks.push({ id: "gb" + Date.now(), kind: gap > shortB ? "longbreak" : "break", name: gap > shortB ? "Long break" : "Break", start: prevEnd, dur: gap });
        }
      }
      setTodayBlocks(outBlocks);
    } else {
      // Left-drag: pure reordering, NEVER a break. The dropped task always CONNECTS to the end of
      // the previous block (any blank in front is closed by pulling the task earlier — never later
      // than the drop; if an anchor sits there, it glues right after the anchor). Whatever it lands
      // on is pushed to start at its end, chaining forward gaplessly. Anchors never move. Gaps and
      // breaks are made with the RIGHT-drag only.
      const isAnchor = (x: any) => x.kind === "meal" || x.kind === "meeting" || (x.kind === "task" && (x.locked || x.placed));
      const movedArr = blocks.map((x: any) => (x.id === cur.id ? { ...x, start: newStart } : x));
      const D: any = movedArr.find((x: any) => x.id === cur.id);
      const anchors = movedArr.filter(isAnchor);
      const prevEnd = movedArr.reduce((m: number, x: any) => (x.id !== cur.id && x.start + x.dur <= D.start ? Math.max(m, x.start + x.dur) : m), -1);
      if (prevEnd >= 0 && D.start > prevEnd) {
        let s = prevEnd, guard = 0;
        while (guard++ < 30) { const hit = anchors.find((f: any) => s < f.start + f.dur && s + D.dur > f.start); if (!hit) break; s = hit.start + hit.dur; }
        if (s < D.start) D.start = s;
      }
      const moved = movedArr.sort((a: any, c: any) => a.start - c.start);
      let cursor = D.start + D.dur;
      const resolved = moved.map((x: any) => {
        if (x.id === cur.id || isAnchor(x)) return x;
        if (x.start + x.dur <= D.start) return x;   // entirely before the drop: untouched
        if (x.start >= cursor) return x;            // clear of the drop and its chain: untouched
        let s = cursor, guard = 0;
        while (guard++ < 30) { const hit = anchors.find((f: any) => s < f.start + f.dur && s + x.dur > f.start); if (!hit) break; s = hit.start + hit.dur; }
        cursor = s + x.dur;
        return { ...x, start: s };
      });
      setTodayBlocks(resolved);
      setPlanUndo(blocks);
    }
    setTlDrag(null);
  };
  const renderBlock = (b: any, topY: number, h: number) => {
    const isTask = b.kind === "task";
    if (editBlockId === b.id) {
      return (
        <div key={b.id} style={{ position: "absolute", left: 108, right: 4, top: topY, minHeight: h, boxSizing: "border-box", background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 6, padding: "4px 6px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, zIndex: 5 }}>
          <input value={blockDraft.name} autoFocus onChange={(e) => setBlockDraft({ ...blockDraft, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveBlockEdit(); if (e.key === "Escape") setEditBlockId(null); }} style={{ flex: 1, minWidth: 90, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 12.5, borderRadius: 5, padding: "3px 6px", fontFamily: "var(--fl-display)" }} />
          {b.kind === "task" && !b.pageId && <>
            <span style={{ display: "inline-flex", gap: 3, flexShrink: 0 }}>
              {["P", "Y", "G"].map((p) => (
                <button key={p} onClick={() => setBlockDraft({ ...blockDraft, power: p })} aria-pressed={blockDraft.power === p} aria-label={"ExecutionPower: " + POWER_LABEL[p]} style={{ width: 20, height: 20, borderRadius: 6, border: blockDraft.power === p ? `2px solid ${C.ink}` : `1px solid ${C.faint}`, background: POWER_COLOR[p], padding: 0, boxSizing: "border-box" }} />
              ))}
            </span>
            <span style={{ display: "inline-flex", gap: 3, flexShrink: 0 }}>
              {["A", "B", "C"].map((l) => (
                <button key={l} onClick={() => setBlockDraft({ ...blockDraft, load: l })} aria-pressed={blockDraft.load === l} aria-label={"CognitiveLoad: " + LOAD_LABEL[l]} style={{ width: 20, height: 20, borderRadius: 6, border: blockDraft.load === l ? `2px solid ${LOAD_COLOR[l]}` : `1px solid ${C.faint}`, background: "transparent", color: LOAD_COLOR[l], fontFamily: "var(--fl-mono)", fontWeight: 700, fontSize: 11, padding: 0, boxSizing: "border-box" }}>{l}</button>
              ))}
            </span>
            <input value={blockDraft.category ?? ""} onChange={(e) => setBlockDraft({ ...blockDraft, category: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveBlockEdit(); if (e.key === "Escape") setEditBlockId(null); }} placeholder="Area tag" aria-label="Area tag, like a Notion Area" style={{ width: 76, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 12, borderRadius: 5, padding: "3px 6px", fontFamily: "var(--fl-display)", flexShrink: 0 }} />
          </>}
          {b.kind === "meal" && <input value={blockDraft.start ?? ""} onChange={(e) => setBlockDraft({ ...blockDraft, start: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveBlockEdit(); if (e.key === "Escape") setEditBlockId(null); }} aria-label="start time (24h HH:MM)" placeholder="18:30" style={{ width: 58, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 12.5, borderRadius: 5, padding: "3px 6px", fontFamily: "var(--fl-mono)" }} />}
          <input type="number" value={blockDraft.dur} onChange={(e) => setBlockDraft({ ...blockDraft, dur: Number(e.target.value) })} aria-label="minutes" style={{ width: 50, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 12.5, borderRadius: 5, padding: "3px 6px" }} />
          <button onClick={saveBlockEdit} aria-label="save" style={{ ...btn(ACCENT), padding: "4px 7px", display: "inline-flex" }}><SaveIcon size={13} /></button>
          <button onClick={() => setEditBlockId(null)} aria-label="cancel" style={{ ...btn(C.muted, true), padding: "4px 7px", display: "inline-flex" }}><CircleXIcon size={13} /></button>
        </div>
      );
    }
    const dragging = !!(tlDrag && tlDrag.id === b.id);
    const blkTop = (dragging && tlDrag) ? Math.max(0, tlDrag.y - tlDrag.grab) : topY;
    // Personal tasks (by pinned name or Area tag, manual blocks included) read as Personal through
    // their coffee Area chip alone: light oat-milk, against the Project tasks' dark mocha.
    const personalBlk = isTask && (personalNames.includes(b.name) || (!!b.category && personalAreas.includes(b.category)));
    return (
      <div key={b.id} className="fl-act-row"
        onPointerDown={(e) => {
          if (b.kind === "meeting" || b.kind === "break" || b.kind === "longbreak") return;   // auto-fix owns break placement
          if ((e.target as HTMLElement).closest("button")) return;
          const el = e.currentTarget as HTMLElement;
          try { el.setPointerCapture(e.pointerId); } catch (err) { return; }   // no capture → don't start a drag we can't end here
          e.preventDefault();
          const tlTop = tlRef.current ? tlRef.current.getBoundingClientRect().top : 0;
          const r = el.getBoundingClientRect();
          // The lead slot only opens when the EARLIEST block is grabbed, shifting the layout down
          // by its height. Fold that shift into the grab offset so the block STAYS in its slot on
          // the shifted board and moves only when the pointer moves. Other blocks: no shift at all.
          const bl = todayBlocks();
          const fb = bl.slice().sort((a: any, c: any) => a.start - c.start)[0];
          const lh = fb && fb.id === b.id && fb.start > tlLeadOf(bl) ? (fb.start - tlLeadOf(bl)) * PX_PER_MIN : 0;
          setTlDrag({ id: b.id, grab: e.clientY - r.top - lh, button: e.button, y: e.clientY - tlTop, tlTop, downY: e.clientY });
        }}
        onPointerMove={(e) => { if (!tlDrag || tlDrag.id !== b.id) return; const top = tlRef.current ? tlRef.current.getBoundingClientRect().top : null; const cy = e.clientY; setTlDrag((dd: any) => (dd && dd.id === b.id ? { ...dd, y: cy - (top != null ? top : dd.tlTop) } : dd)); }}
        onPointerUp={(e) => { if (tlDrag && tlDrag.id === b.id) { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {} onTlDrop(b, e.clientY); } }}
        onPointerCancel={(e) => { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {} setTlDrag(null); }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ position: "absolute", left: 108, right: 4, top: blkTop, height: h, boxSizing: "border-box", opacity: tlDrag && tlDrag.id !== b.id ? 0.5 : 1, background: isTask ? "#fdfbf5" : (b.kind === "break" ? BREAK_BG : b.kind === "longbreak" ? LBREAK_BG : b.kind === "meal" ? MEAL_BG : b.kind === "routine" ? ROUTINE_THEME[b.night ? "night" : "morning"][dayMode === "relax" ? "relax" : "work"] : "#fbf8f1"), border: `1px solid ${C.line}`, borderLeft: `4px solid ${isTask ? (POWER_COLOR[b.power] || POWER_COLOR.Y) : (b.kind === "routine" ? ROUTINE_THEME[b.night ? "night" : "morning"].bar : b.kind === "break" ? BREAK_STRIPE : b.kind === "longbreak" ? LBREAK_STRIPE : b.kind === "meal" ? MEAL_STRIPE : C.muted)}`, borderRadius: 6, padding: "2px 8px", cursor: (b.kind === "meeting" || b.kind === "break" || b.kind === "longbreak") ? "default" : (dragging ? "grabbing" : "grab"), display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: b.kind === "break" ? BREAK_TEXT : b.kind === "longbreak" ? LBREAK_TEXT : b.kind === "meal" ? MEAL_TEXT : C.ink, zIndex: dragging ? 20 : 1, boxShadow: dragging ? "0 4px 14px rgba(0,0,0,0.18)" : "none", touchAction: "none", userSelect: "none", overflow: "hidden" }}>
        {b.kind === "meeting" && <span style={{ color: C.muted, display: "inline-flex", flexShrink: 0 }}><LockIcon size={12} /></span>}
        {(b.kind === "break" || b.kind === "longbreak") && <img src={b.kind === "longbreak" ? breakLongIcon : breakShortIcon} alt="" draggable={false} style={{ width: 14, height: 14, flexShrink: 0 }} />}
        {b.kind === "meal" && <span style={{ color: MEAL_TEXT, display: "inline-flex", flexShrink: 0 }}><UtensilsIcon size={13} /></span>}
        {isTask && <span style={{ color: LOAD_COLOR[b.load] || LOAD_COLOR.B, fontFamily: "var(--fl-mono)", fontWeight: 700, fontSize: 12.5, flexShrink: 0 }} aria-label={LOAD_LABEL[b.load] || LOAD_LABEL.B}>{b.load || "B"}</span>}
        {isTask && b.category && settings.showAreaTimeline !== false && <span style={{ fontSize: 10, fontFamily: "var(--fl-mono)", color: personalBlk ? TAG_COFFEE.personal.text : TAG_COFFEE.project.text, background: personalBlk ? TAG_COFFEE.personal.bg : TAG_COFFEE.project.bg, border: `1px solid ${personalBlk ? TAG_COFFEE.personal.border : TAG_COFFEE.project.border}`, borderRadius: 999, height: 16, boxSizing: "border-box", display: "inline-flex", alignItems: "center", padding: "0 7px", whiteSpace: "nowrap", flexShrink: 0 }}>{b.category}</span>}
        {isTask && <button onClick={() => toggleLock(b.id)} className={b.locked ? "" : "fl-rowact fl-collapse"} aria-label={b.locked ? "commitment: fixed at this time, and auto-fix adds a long break after it and restarts the pomodoro count. Click to release." : "make this a commitment: fix it at this time, with a long break after it and a fresh pomodoro count"} style={{ ...ICON_BTN, color: b.locked ? (POWER_COLOR[b.power] || POWER_COLOR.Y) : C.muted }}><LockIcon size={12} open={!b.locked} /></button>}
        {isTask && b.placed && <button onClick={() => setTodayBlocks(todayBlocks().map((x: any) => { if (x.id !== b.id) return x; const nb: any = { ...x }; delete nb.placed; return nb; }))} aria-label="placed (by right-drag): auto-fix keeps it exactly here, position only, the break rhythm is unchanged. Click to release it back into the flow." style={{ ...ICON_BTN, color: POWER_COLOR[b.power] || POWER_COLOR.Y }}><PinIcon size={12} /></button>}
        <span aria-label={Array.isArray(b.steps) && b.steps.length ? b.steps.join(" · ") : undefined} style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isTask ? stripLeadingTag(b.name) : b.name}{Array.isArray(b.steps) && b.steps.length ? <span style={{ color: C.muted, fontSize: 11 }}> · {b.steps.join(" · ")}</span> : null}</span>
        {(isTask || b.kind === "routine") && <button onClick={() => openLog(b.name)} className="fl-rowact fl-collapse" aria-label="run a pomodoro" style={ICON_BTN}><PlayIcon size={12} /></button>}
        {isTask && !b.pageId && <button onClick={() => { setEditBlockId(b.id); setBlockDraft({ name: b.name, dur: b.dur, power: b.power || "Y", load: b.load || "B", category: b.category || "" }); }} className="fl-rowact fl-collapse" aria-label="edit name, power, load, tag and length" style={ICON_BTN}><PencilIcon size={13} /></button>}
        {(b.kind === "break" || b.kind === "longbreak") && <button onClick={() => { setEditBlockId(b.id); setBlockDraft({ name: b.name, dur: b.dur }); }} className="fl-rowact fl-collapse" aria-label="edit break length (auto-fix keeps it)" style={ICON_BTN}><PencilIcon size={13} /></button>}
        {b.kind === "meal" && <button onClick={() => { setEditBlockId(b.id); setBlockDraft({ name: b.name, dur: b.dur, start: fmtClock(b.start) }); }} className="fl-rowact fl-collapse" aria-label="edit this meal's time and length (today only; auto-fix keeps it)" style={ICON_BTN}><PencilIcon size={13} /></button>}
        {isTask
          ? <button onClick={() => duplicateBlock(b.id)} className="fl-rowact fl-collapse" aria-label="duplicate (add a pomodoro)" style={ICON_BTN}><CopyIcon size={13} /></button>
          : (b.kind === "routine" && !b.refIds) ? <button onClick={() => { setEditBlockId(b.id); setBlockDraft({ name: b.name, dur: b.dur }); }} className="fl-rowact fl-collapse" aria-label="edit" style={ICON_BTN}><PencilIcon size={13} /></button> : null}
        <button onClick={() => deleteBlock(b.id)} className="fl-rowact fl-rowdel fl-collapse" aria-label="delete" style={ICON_BTN}><TrashIcon size={13} /></button>
        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 10, color: C.muted, flexShrink: 0 }}>{b.dur}m</span>
      </div>
    );
  };
  const renderTimeline = () => {
    const blocks = todayBlocks();
    const { items, totalH } = tlLayout(blocks);
    const now = new Date();
    const nowClock = now.getHours() * 60 + now.getMinutes();
    // The plan can run past midnight and the clock can sit on either side of it. Independently of
    // dayStart/morningBegins, put "now" on whichever copy (today, or +1 day for a genuine
    // after-midnight tail) lands closer to the visible band — correct for any day-start setting.
    let nowY = -1, nowMin = nowClock;
    if (items.length) {
      const mid = (items[0].t0 + items[items.length - 1].t1) / 2;
      if (Math.abs(nowClock + 1440 - mid) < Math.abs(nowClock - mid)) nowMin = nowClock + 1440;
      if (nowMin <= items[0].t0) nowY = 0;
      else if (nowMin >= items[items.length - 1].t1) nowY = totalH;
      else for (const it of items) if (nowMin >= it.t0 && nowMin <= it.t1) { nowY = it.topY + (it.t1 > it.t0 ? (nowMin - it.t0) / (it.t1 - it.t0) * it.height : 0); break; }
    }
    return (
      <div style={{ marginTop: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "8px 12px", marginBottom: 10 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>Long break every</span>
            <div style={{ display: "inline-flex", alignItems: "center", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: 3, gap: 2, height: 30, boxSizing: "border-box" }}>
              {[3, 4, 5].map((n) => {
                const on = (longEvery >= 3 ? longEvery : 3) === n;
                return (
                  <button key={n} onClick={() => { setLongEveryState(n); api.patchSettings && api.patchSettings({ longBreakEvery: n }); }} aria-pressed={on} aria-label={`a long break every ${n} pomodoros`}
                    style={{ border: "none", boxShadow: "none", background: on ? ACCENT : "transparent", color: on ? "#fff" : C.muted, fontFamily: "var(--fl-mono)", fontSize: 12.5, fontWeight: on ? 600 : 400, width: 22, height: 22, minWidth: 22, padding: 0, lineHeight: 1, borderRadius: 999, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</button>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>pomodoros</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button onClick={autoBreaks} aria-label="auto-fix: pack the day in your order around commitments, pins and meals, glue your breaks, and add only the missing rests" style={{ ...btn(ACCENT), width: 30, height: 30, padding: 0, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><WandSparklesIcon size={14} /></button>
            {planUndo && <button onClick={() => { setTodayBlocks(planUndo); setPlanUndo(null); }} aria-label="undo the last auto-fix or drag" style={{ ...btn(C.worse, true), padding: "5px 10px", fontSize: 12 }}>undo</button>}
            {settings.addBlockEnabled === true && <button onClick={addBlock} aria-label="add a manual block: name, power colour, load letter, Area tag and length; lock it if it's a commitment" style={{ ...btn(ACCENT), width: 30, height: 30, padding: 0, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><ListPlusIcon size={14} /></button>}
          </div>
        </div>
        {blocks.length === 0 && <p style={{ color: C.muted, fontSize: 13, margin: "0 0 8px" }}>No blocks yet — sync some tasks and re-open the timeline, or add a block.</p>}
        <div ref={tlScrollRef} style={{ maxHeight: "62vh", overflowY: "auto", overflowX: "hidden" }}>
        <div ref={tlRef} onContextMenu={(e) => e.preventDefault()} style={{ position: "relative", height: totalH }}>
          <div style={{ position: "absolute", left: 100, top: 0, bottom: 0, width: 2, background: C.line }} />
          {(() => {
            // Wall-clock ruler in its own left column: every XX:00 / XX:30 from the timeline's start
            // to its end, mapped through the same non-linear layout as the blocks, so you can see
            // where real clock times land when arranging tasks. Labels skip when a compressed
            // stretch would overlap them, and keep clear of the red now-time.
            if (!items.length) return null;
            const ticks: any[] = [];
            let lastY = -20;
            const dragging = !!tlDrag;
            for (let m = Math.ceil(items[0].t0 / 30) * 30; m <= items[items.length - 1].t1; m += 30) {
              const y = minToY(items, m);
              if (y < 0) continue;
              // While dragging, every half-hour line extends across the board as an alignment guide.
              if (dragging) ticks.push(<div key={"rl" + m} style={{ position: "absolute", left: 100, right: 0, top: y, borderTop: `1px dashed ${C.muted}`, zIndex: 15, pointerEvents: "none" }} />);
              if (y - lastY < 14 || (nowY >= 0 && Math.abs(y - nowY) < 13)) continue;
              lastY = y;
              ticks.push(<span key={"rt" + m} style={{ position: "absolute", left: 0, top: y - 6, width: 36, textAlign: "right", fontSize: 10.5, color: dragging ? C.muted : C.faint, fontWeight: dragging ? 600 : 400, fontFamily: "var(--fl-mono)", pointerEvents: "none" }}>{fmtClock(m)}</span>);
            }
            return ticks;
          })()}
          {tlDrag && (() => {
            // Live drop-time label: the snapped start the block would get if released now.
            const gy = Math.max(0, tlDrag.y - tlDrag.grab);
            const gm = snapDrop(yToMin(items, gy));
            return <span style={{ position: "absolute", left: 42, top: gy - 7, width: 54, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: C.ink, background: C.paper, borderRadius: 4, zIndex: 30, pointerEvents: "none" }}>{fmtClock(gm)}</span>;
          })()}
          {items.map((it: any, i: number) => it.type !== "block" ? null : (
            <React.Fragment key={it.b.id}>
              <span style={{ position: "absolute", left: 46, top: it.topY + 3, width: 50, textAlign: "right", fontSize: 12, color: C.muted, fontFamily: "var(--fl-mono)" }}>{fmtClock(it.b.start)}</span>
              {renderBlock(it.b, it.topY, it.height)}
            </React.Fragment>
          ))}
          {nowY >= 0 && (
            <div ref={nowRef} style={{ position: "absolute", left: 0, right: 0, top: nowY, height: 0, zIndex: 6, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: 98, right: 0, top: 0, borderTop: `2px solid ${C.worse}` }} />
              <span style={{ position: "absolute", left: 0, top: -8, width: 36, textAlign: "right", fontSize: 12.5, color: C.worse, fontFamily: "var(--fl-mono)", fontWeight: 700 }}>{fmtClock(nowMin)}</span>
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
  const renderFullSection = (key: string, hideHeader?: boolean) => {
    const headColor = dayMode === "relax" ? MODE_COLORS.relax.solid : MODE_COLORS.work.solid;
    if (key === "morning") return renderRoutineBlock("morning", hideHeader);
    if (key === "night") return renderRoutineBlock("night", hideHeader);
    if (key === "work") return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {workTasks.length > 0 && <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 4px", display: hideHeader ? "none" : undefined }}><SectionIcon src={sketchImg} /> Project</h3>}
        {workTasks.map((t: any) => renderTaskRow(t))}
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 4px", display: hideHeader ? "none" : undefined }}><SectionIcon src={dogImg} /> Personal</h3>
        {personalTasks.map((t: any) => renderTaskRow(t))}
      </div>
    );
  };
  const renderTodaySections = () => {
    const defs = [
      { key: "morning", label: <><SectionIcon src={blindsImg} /> Morning</>, rank: 0, on: !settings.skipMorningRoutine },
      { key: "work", label: <><SectionIcon src={sketchImg} /> Project</>, rank: 1, on: true },
      { key: "personal", label: <><SectionIcon src={dogImg} /> Personal</>, rank: 1, on: personalTasks.length > 0 },
      { key: "night", label: <><SectionIcon src={tableLampImg} /> Night</>, rank: 2, on: !settings.skipNightRoutine },
    ].filter((s) => s.on);
    const future = defs.filter((s) => s.rank >= phaseRankNow);
    const past = defs.filter((s) => s.rank < phaseRankNow);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
        {future.map((s) => <div key={s.key} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>{renderFullSection(s.key)}</div>)}
        {past.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 }}>earlier today</div>
            {past.map((s) => (
              <div key={s.key}>
                <button onClick={() => setExpandedPast((e) => { const n = new Set(e); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })} style={{ margin: 0, fontFamily: "var(--fl-display)", fontSize: 13.5, fontWeight: 600, color: C.ink, background: "transparent", border: "none", boxShadow: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 0" }}>{expandedPast.has(s.key) ? "▾" : "▸"} {s.label}</button>
                {expandedPast.has(s.key) && <div style={{ marginTop: 4 }}>{renderFullSection(s.key, true)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const seg = (on: boolean): any => ({ padding: "6px 14px", borderRadius: 9, border: "none", background: on ? C.card : "transparent", color: on ? C.ink : C.muted, fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", textTransform: "capitalize", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.14)" : "none", fontFamily: "var(--fl-display)", whiteSpace: "nowrap" });
  // Horizontal sub-view toggle, same look as the Sky view's Pomodoros/Reflections control.
  const segH = (on: boolean): any => ({ padding: "4px 12px", borderRadius: 8, border: "none", background: on ? C.card : "transparent", color: on ? C.ink : C.muted, fontSize: 12.5, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "var(--fl-display)" });

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
            <span style={{ marginLeft: 4 }}><img src={crownImg} alt="King" draggable={false} style={{ width: 15, height: 15, verticalAlign: "-3px" }} /> = King {"·"} day starts at {fmtHM(settings.dayStart)}</span>
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

        {view === "sky" && <SkyView sessions={sessions} reflections={reflections} C={C} />}

        {view === "reflect" && <ReflectPanel feelings={reflectFeelings} C={C} onSave={onSaveReflection} />}

        {view === "today" && (
          <div>
            <div className="fl-plan-bar" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: 4 }}>
                {["work", "relax"].map((m) => {
                  const on = dayMode === m;
                  const col = m === "work" ? MODE_COLORS.work.solid : MODE_COLORS.relax.solid;
                  return (
                    <button key={m} onClick={() => { if (dayMode !== m) toggleDayMode(); }} aria-pressed={on} aria-label={`${m === "work" ? "Work" : "Relax"} mode`}
                      style={{ border: "none", boxShadow: "none", background: on ? col : "transparent", color: on ? "#fff" : C.muted, borderRadius: 999, padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", lineHeight: 1.2, display: "inline-flex", alignItems: "center", gap: 5 }}>{m === "work" ? <BriefcaseBusinessIcon size={13} /> : <LeafIcon size={13} />} {m === "work" ? "Work" : "Relax"}</button>
                  );
                })}
              </div>
              <button onClick={doSync} disabled={sync === "loading"} aria-label="sync from Notion and rebuild the timeline" style={{ ...btn(ACCENT, true), borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px" }}>
                <RefreshCwIcon size={14} spin={sync === "loading"} />
                {sync === "loading" ? "…" : <img src={NOTION_LOGO} alt="Notion" className="fl-sync-logo" style={{ width: 16, height: 16 }} />}
              </button>
              <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
                {timelineMode && (
                  <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
                    onMouseEnter={() => setIntroOpen(true)} onMouseLeave={() => setIntroOpen(false)}>
                    <span aria-label={introOpen ? undefined : "how the Timeline works"} style={{ display: "inline-flex", color: C.muted }}><InfoIcon size={16} /></span>
                    {introOpen && (
                      <div style={{ position: "absolute", right: 0, top: 22, width: 400, maxWidth: "84vw", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 16px", zIndex: 60, boxShadow: "0 6px 24px rgba(0,0,0,0.16)", fontSize: 12.5, fontWeight: 400, color: C.ink, lineHeight: 1.5, textAlign: "left" }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>How the Timeline works</div>
                        <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>Moving blocks</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>Left-drag a task: pure reordering — it glues to the end of the block above your drop, whatever it lands on moves to after it, and no break is ever created.</li>
                          <li>Right-drag: move a block plus everything after it; the grabbed task is pinned, and the gap opened in front becomes a break you own.</li>
                        </ul>
                        <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>Breaks are yours</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>Auto-fix never deletes or resizes them; each one glues to the task before it.</li>
                          <li>Longer than the short-break setting = a long break, and the pomodoro count restarts.</li>
                          <li>Two long breaks back to back merge into one.</li>
                        </ul>
                        <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>Auto-fix</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>Keeps your task order; compacts only genuinely empty gaps.</li>
                          <li>Adds missing short breaks, plus a long one every N pomodoros; never against a meal.</li>
                          <li>Deletes any long break sitting against lunch or dinner (the meal is the rest); later blocks move up.</li>
                          <li>Task blocks always stay 25 minutes; the current Focus length is only recorded on them.</li>
                          <li>After dinner: tasks stay in the evening, each with a break after it.</li>
                        </ul>
                        <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>Anchors and meals</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>Lock = commitment: fixed time, a long break after it, rhythm restarts.</li>
                          <li>Pin = placed: fixed position; a short break separates the task that packs in behind it.</li>
                          <li>Meals reset the rhythm; use their pencil to re-time today's lunch or dinner.</li>
                        </ul>
                        <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>Sync and the ruler</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>Sync deletes all breaks and rebuilds tasks fresh (unlocked, unpinned); your commitments and meals keep their time and length.</li>
                          <li>The left ruler shows real clock times; the red line is now.</li>
                        </ul>
                      </div>
                    )}
                  </span>
                )}
                {!timelineMode && (
                  <InfoHover C={C} label="how the Tasks view works" width={400}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>How the Tasks view works</div>
                      <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>What's here</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        <li>Today's tasks from Notion, plus any local tasks added with the Timeline's add-block button (those survive sync, so the plugin also works without Notion).</li>
                        <li>Grouped into Project and Personal by your Personal Areas and names settings, with the morning and night routines around them.</li>
                      </ul>
                      <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>Reading a row</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        <li>The coloured letter is cognitive load: A high, B medium, C low. The chip beside it is the Notion Area.</li>
                        <li>A crown marks the King task; bookmarked tasks sort first, then the King, then the rest (new tasks arrive ranked Must, then Aim, then Bonus).</li>
                        <li>The tomatoes count today's pomodoros on that task: bright are done, grey still planned.</li>
                      </ul>
                      <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>On hover</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        <li>Drag the dots to reorder; the person/briefcase moves a task between Personal and Work.</li>
                        <li>The bookmark pins a task to the top by name, so it survives the daily re-created Notion tasks.</li>
                        <li>The play button runs a pomodoro on that task.</li>
                      </ul>
                  </InfoHover>
                )}
                <div style={{ display: "inline-flex", gap: 2, background: C.line, borderRadius: 10, padding: 3, flexShrink: 0 }}>
                  <button onClick={() => setTimelineMode(false)} aria-pressed={!timelineMode} style={segH(!timelineMode)}>Tasks</button>
                  <button onClick={() => setTimelineMode(true)} aria-pressed={timelineMode} style={segH(timelineMode)}>Timeline</button>
                </div>
              </div>
            </div>
            <div style={{ margin: "0 0 12px" }}>
              <span style={{ color: C.ink, fontSize: 16, fontWeight: 700, display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                {tasks.length} tasks {"·"} {countToday} / {plannedPomos} {"\u{1F345}"}
                {timelineMode && planEndMin > 0 &&
                  <span style={{ fontWeight: 600 }}>{" · ends " + fmtClock(planEndMin)}{planOverflow > 0 && <span style={{ color: C.worse }}>{" (overflows by " + planOverflow + "m)"}</span>}</span>}
              </span>
            </div>
            {fallingEnjoyment && (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.worse}`, borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: C.ink, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 200 }}>Enjoyment is dipping over your last few pomodoros \u2014 consider an extra break.</span>
                <button onClick={() => { startBreak(); setView("break"); }} style={{ ...btn(ACCENT, true), padding: "3px 10px" }}>take a break</button>
              </div>
            )}
            {tasks.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>No tasks yet. Set your Notion token in settings, then press sync.</p>}
            {timelineMode ? <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>{renderTimeline()}</div> : renderTodaySections()}
          </div>
        )}

        {view === "status" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
              <InfoHover C={C} label="about this view" width={340}>
                {statusSub === "week" && (<>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Week</div>
                  <div>One week at a time: your pomodoros grouped by Area.</div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    <li><b>Charts</b>: one per Notion Area, with a row for each task worked on that week.</li>
                    <li><b>Marks</b>: {"○"} is expected, {"●"} is actual; green means better than expected, red worse.</li>
                    <li><b>Arrows</b>: step between weeks; the right arrow stops at the current week.</li>
                  </ul>
                </>)}
                {statusSub === "month" && (<>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Month</div>
                  <div>The month as a calendar: a square for every pomodoro.</div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    <li><b>Squares</b>: one per pomodoro, red on work days and green on relax days; the lightness is the time of day (light morning, medium afternoon, darkest evening).</li>
                    <li><b>Yellow squares</b>: overnight pomodoros, done between your day start and "morning begins"; they stack on the day they lead into.</li>
                    <li><b>Changing month</b>: use the arrows or scroll on the month name; TODAY jumps back to now and opens today's daily note.</li>
                    <li><b>Days</b>: darker brown date numbers already have a daily note; click any day to open its note. The outline follows the daily note you have open, or today.</li>
                  </ul>
                </>)}
                {statusSub === "totals" && (<>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Total</div>
                  <div>The long view: everything you have logged, all projects combined.</div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    <li><b>Pomodoro totals</b>: counts and hours for this week, this month and this year.</li>
                    <li><b>Six-month heatmap</b>: pomodoros per day over the last six months; darker means more.</li>
                    <li><b>Expected vs actual</b>: how often sessions turned out more enjoyable than you expected, with the biggest surprises (dreaded, then enjoyed).</li>
                    <li><b>Best time of day</b>: average enjoyment for morning, afternoon and evening.</li>
                    <li><b>All sessions</b>: the full editable log; edits and deletes only change the local log, not Notion.</li>
                  </ul>
                </>)}
              </InfoHover>
              <div style={{ display: "inline-flex", gap: 2, background: C.line, borderRadius: 10, padding: 3, flexShrink: 0 }}>
                {([["week", "Week"], ["month", "Month"], ["totals", "Total"]] as [string, string][]).map(([k, lab]) => (
                  <button key={k} onClick={() => setStatusSub(k)} style={segH(statusSub === k)}>{lab}</button>
                ))}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
        {statusSub === "week" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => setWeekOff((w) => w - 1)} style={btn(C.muted, true)}>{"\u2190"}</button>
              <span style={{ fontFamily: "var(--fl-mono)", fontSize: 13 }}>{fmtDate(weekStart)} {"\u2013"} {fmtDate(new Date(+weekEnd - DAY))}</span>
              <button onClick={() => setWeekOff((w) => Math.min(0, w + 1))} style={btn(C.muted, true)}>{"\u2192"}</button>
            </div>
            {weekAreas.length === 0 ? <p style={{ color: C.muted, textAlign: "center", padding: "40px 0" }}>{weekSessions.length ? "No pomodoros with an Area this week." : "No pomodoros this week."}</p> :
              weekAreas.map((a) => (<GroupChart key={a} group={a} sessions={weekSessions.filter((x) => x.category === a)} settings={settings} override={modeOverride} />))}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 11, color: C.muted }}>
              <span><span style={{ color: C.ink }}>{"\u25CB"}</span> expected</span>
              <span><span style={{ color: C.ink }}>{"\u25CF"}</span> actual</span>
              <span><span style={{ color: C.better }}>{"\u2014"}</span> better than expected</span>
              <span><span style={{ color: C.worse }}>{"\u2014"}</span> worse than expected</span>
            </div>
          </div>
        )}

        {statusSub === "month" && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingLeft: 4 }}>
              <span ref={monthLabelRef} aria-label="scroll to change the month" style={{ fontFamily: "var(--fl-display)", fontVariantNumeric: "tabular-nums", fontSize: 16, fontWeight: "var(--h3-weight, 600)" as any, color: C.ink, letterSpacing: "-0.01em", lineHeight: 1, cursor: "ns-resize", userSelect: "none" }}>
                <span style={{ display: "inline-block", minWidth: "2.3em" }}>{MON3[monthRef.getMonth()]}</span>
                <span style={{ color: ACCENT, marginLeft: "0.1em" }}>{monthRef.getFullYear()}</span>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => setMonthOff((m) => m - 1)} aria-label="previous month" style={{ background: "transparent", border: "none", boxShadow: "none", color: C.ink, cursor: "pointer", padding: 5, borderRadius: 7, display: "inline-flex", alignItems: "center" }}><ChevronLeftIcon size={20} /></button>
                <button onClick={() => { setMonthOff(0); api.openDailyNote && api.openDailyNote(+logicalDay(Date.now(), settings)); }} aria-label="jump to the current month and open today's daily note — 'today' follows your day-start setting, so after an evening rollover it is already tomorrow's date" style={{ background: "transparent", border: "none", boxShadow: "none", color: ACCENT, cursor: "pointer", padding: "5px 8px", borderRadius: 7, fontFamily: "var(--fl-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.02em" }}>TODAY</button>
                <button onClick={() => setMonthOff((m) => m + 1)} aria-label="next month" style={{ background: "transparent", border: "none", boxShadow: "none", color: C.ink, cursor: "pointer", padding: 5, borderRadius: 7, display: "inline-flex", alignItems: "center" }}><ChevronRightIcon size={20} /></button>
              </div>
            </div>
            <Heatmap sessions={sessions} monthRef={monthRef} settings={settings} activeTs={activeDaily} override={modeOverride} hasNote={(d: Date) => !!(api.hasDailyNote && api.hasDailyNote(+d))} onOpenDay={(date: Date) => api.openDailyNote && api.openDailyNote(+date)}
              onDayMenu={(date: Date, e: any) => {
                if (!api.openDayMenu) return;
                const key = String(date.getTime());
                const cur = (modeOverride[key] === "work" || modeOverride[key] === "relax") ? modeOverride[key] : (((settings.workDays || [])[(date.getDay() + 6) % 7] === false) ? "relax" : "work");
                const next = cur === "work" ? "relax" : "work";
                api.openDayMenu(+date, e.nativeEvent || e, { flipLabel: "Flip to " + next + " day", onFlip: () => { const obj = { ...modeOverride, [key]: next }; setModeOverride(obj); api.saveModeOverride && api.saveModeOverride(obj); } });
              }} />
          </div>
        )}

        {statusSub === "totals" && (
          <div>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 10px" }}>Pomodoro totals</h3>
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
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 12px" }}>Six-month heatmap</h3>
              <ContribHeatmap sessions={sessions} settings={settings} />
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginTop: 20 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 4px" }}>Expected vs actual</h3>
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
                            <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, whiteSpace: "nowrap" }}><span style={{ color: C.ink }}>{s.expected}</span><span style={{ color: C.muted }}>{" → "}</span><span style={{ color: C.ink }}>{s.actual}</span></span>
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
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 10px" }}>Best time of day</h3>
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
          </div>
        )}

        {view === "log" && <LogForm tasks={orderedTasks} preset={preset} onAdd={logPomodoro} settings={settings} secs={secs} running={running} resetTimer={resetTimer} pomoMin={pomoMin} changePomo={changePomo} stepPomo={stepPomo} chooseNext={chooseNext} setChooseNext={setChooseNext} nextTask={nextTask} setNextTask={setNextTask} onStart={onStart} onPickTask={(v: string) => { setPreset(v); api.timer && api.timer.setTask(v); }} onPause={onPause} pauseActive={pauseActive} paused={timer.paused} pauseTags={pauseTags} pauseTag={pauseTag} setPauseTag={setPauseTag} tagColor={tagColor} tagBorder={tagBorder} floatOn={floatOn} setFloatOn={setFloatOn} lenLocked={lenLocked} finished={finished} expected={timer.expected} onSetExpected={setExpectedRating} autoLogDefault={settings.autoLogOnRate !== false} onAutoLogChange={(v: boolean) => api.patchSettings && api.patchSettings({ autoLogOnRate: v })} />}

        {view === "break" && (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0 }}>Start a break</h3>
              <button onClick={() => startBreak(settings.breakMinutes)} style={{ ...btn(C.ink, true), borderRadius: 999, padding: "6px 16px" }}>short · {settings.breakMinutes}m</button>
              <button onClick={() => startBreak(settings.longBreakMinutes)} style={{ ...btn(C.ink, true), borderRadius: 999, padding: "6px 16px" }}>long · {settings.longBreakMinutes}m</button>
            </div>
            {brk.active && (
              <div style={{ background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--fl-mono)", fontSize: 30, color: brk.finished ? C.better : C.ink }}>{String(Math.floor(brk.secs / 60)).padStart(2, "0")}:{String(brk.secs % 60).padStart(2, "0")}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                    {!brk.finished && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 4 }}>
                        <button onClick={() => api.timer.stepBreak(-1)} style={{ width: 29, height: 29, padding: 0, borderRadius: 999, border: `1.5px solid ${C.ink}`, background: "transparent", color: C.ink, fontSize: 16, fontFamily: "var(--fl-display)", boxShadow: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><MinusIcon size={18} /></button>
                        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, color: C.muted, minWidth: 34, textAlign: "center" }}>{Math.round(brk.secs / 60)}m</span>
                        <button onClick={() => api.timer.stepBreak(1)} style={{ width: 29, height: 29, padding: 0, borderRadius: 999, border: `1.5px solid ${C.ink}`, background: "transparent", color: C.ink, fontSize: 16, fontFamily: "var(--fl-display)", boxShadow: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><PlusIcon size={18} /></button>
                      </span>
                    )}
                    {!brk.finished && <button onClick={() => api.timer.toggleBreakRun()} aria-label={brk.running ? "pause" : "start"} style={{ ...btn(C.ink), borderRadius: 999, height: 32, padding: "0 14px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{brk.running ? <PauseIcon size={16} /> : <PlayIcon size={16} />}</button>}
                    <button onClick={endBreak} aria-label={brk.finished ? "go back to my task" : "end break"} style={{ ...btn(C.muted, true), borderRadius: 999, height: 32, padding: "0 14px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{brk.finished ? <ArrowRightIcon size={16} /> : <CheckIcon size={16} />}</button>
                  </div>
                </div>
                <p style={{ color: C.muted, fontSize: 12, margin: "0 0 8px" }}>Pick up to 3 — tap an activity ({brk.picked.length}/3):</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {activities.length === 0 ? <span style={{ color: C.muted, fontSize: 13 }}>No activities yet — end the break to add some.</span> :
                    activities.map((a, i) => renderActRow(a, i))}
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                  <Scale label="how do you feel after this break?" value={brk.feeling} onChange={(v: number) => api.timer.setBreakFeeling(v)} seasons />
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
                <button onClick={addActivity} aria-label="add" style={{ ...ADD_BTN, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><ListPlusIcon size={16} /></button>
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 10px" }}>Break stats</h3>
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
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 10px" }}>Break insights</h3>
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
                          <Scale label="feeling" value={breakDraft.feeling} onChange={(v: number) => setBreakDraft({ ...breakDraft, feeling: v })} seasons />
                          <button onClick={() => setBreakDraft({ ...breakDraft, feeling: null })} style={{ ...btn(C.muted, true), padding: "2px 8px", fontSize: 11, marginBottom: 12 }}>clear</button>
                        </div>
                        <button onClick={saveEditBreak} aria-label="save" style={{ ...btn(C.ink), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SaveIcon size={15} /></button>
                        <button onClick={() => setEditBreakId(null)} aria-label="cancel" style={{ ...btn(C.muted, true), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><CircleXIcon size={15} /></button>
                      </div>
                    ) : (
                      <div key={b.id} className="fl-act-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 13, padding: "8px 12px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 }}>
                        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{fmtDate(b.start)} {fmtTime(b.start)}{"–"}{fmtTime(b.end)}</span>
                        <span style={{ flex: 1, minWidth: 120, overflowWrap: "anywhere" }}>{(b.activities && b.activities.length) ? b.activities.join(", ") : "—"}</span>
                        <span style={{ fontSize: 11, color: C.muted, fontFamily: "var(--fl-mono)", minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>{(b.areas && b.areas.length) ? b.areas.join(" · ") : ""}</span>
                        {b.feeling != null && (BREAK_SEASONS[b.feeling - 1]
                          ? <img src={BREAK_SEASONS[b.feeling - 1].img} alt={BREAK_SEASONS[b.feeling - 1].name} aria-label={BREAK_SEASONS[b.feeling - 1].name} draggable={false} style={{ width: 16, height: 16, flexShrink: 0 }} />
                          : <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: C.ink, whiteSpace: "nowrap" }}>{b.feeling}/5</span>)}
                        <button onClick={() => startEditBreak(b)} className="fl-rowact" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
                        <button onClick={() => deleteBreak(b.id)} className="fl-rowact fl-rowdel" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
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
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, margin: "0 0 10px" }}>
                <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0 }}>Pause tags</h3>
                <InfoHover C={C} label="about pause tags" width={330}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Pause tags</div>
                  <div>Reasons you can tag a pause with, grouped by whether the interruption was <b style={{ color: PAUSE_CAT.internal.border }}>internal</b> (your own impulse) or <b style={{ color: PAUSE_CAT.external.border }}>external</b> (from outside). Picked from the log view when you pause.</div>
                </InfoHover>
              </div>
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
                <button onClick={addPauseTag} aria-label="add" style={{ ...ADD_BTN, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><ListPlusIcon size={16} /></button>
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, margin: "0 0 10px" }}>
                <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0 }}>Pause stats</h3>
                <InfoHover C={C} label="about pause stats" width={330}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Pause stats</div>
                  <div>When and why you pause: totals for this week and month, your most common reasons, and the typical time of day across all history, split into <b style={{ color: PAUSE_CAT.internal.border }}>internal</b> and <b style={{ color: PAUSE_CAT.external.border }}>external</b>.</div>
                </InfoHover>
              </div>
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
                          {total > 0 && <div aria-label={`internal ${s.internal}/${total}`} style={{ width: `${(s.internal / total) * 100}%`, background: PAUSE_CAT.internal.border }} />}
                          {total > 0 && <div aria-label={`external ${s.external}/${total}`} style={{ width: `${(s.external / total) * 100}%`, background: PAUSE_CAT.external.border }} />}
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
                        <button onClick={saveEditPause} aria-label="save" style={{ ...btn(C.ink), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SaveIcon size={15} /></button>
                        <button onClick={() => setEditPauseId(null)} aria-label="cancel" style={{ ...btn(C.muted, true), padding: "5px 9px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><CircleXIcon size={15} /></button>
                      </div>
                    ) : (
                      <div key={p.id} className="fl-act-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 13, padding: "8px 12px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 }}>
                        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{fmtDate(p.ts)} {fmtTime(p.ts)}</span>
                        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, minWidth: 34 }}>{p.mins != null ? p.mins + "m" : "—"}</span>
                        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{p.tag}</span>
                        <button onClick={() => startEditPause(p)} className="fl-rowact" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
                        <button onClick={() => deletePause(p.id)} className="fl-rowact fl-rowdel" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
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
