import * as React from "react";
import { SkyView } from "./SkyView";
import { newestStarName } from "./skymap";
import { MoodGrid } from "./MoodGrid";
import { NOTION_LOGO } from "./notionLogo";
import { BodyMap } from "./BodyMap";
import { InfoHover, SUBBAR, subTab, SUBTAB_ROW, TomatoIcon, WaterIcon } from "./icons";
import breakShortIcon from "./assets/break-short.png";
import breakLongIcon from "./assets/break-long.png";
import roosterImg from "./assets/rooster.png";
import batImg from "./assets/bat.png";
import swanImg from "./assets/swan.png";
import doveImg from "./assets/dove.png";
import doveBadgeImg from "./assets/dove-badge.png";
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
const LOAD_LABEL: any = { A: "A - high load", B: "B - medium load", C: "C - low load" };
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
const agoText = (ts: number) => { const m = Math.round((Date.now() - ts) / 60000); return m < 60 ? m + " min ago" : Math.round(m / 6) / 10 + " h ago"; };
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
// Guess-aware pips: base tomatoes plain, the first "+" round on a yellow wash, the second on
// orange; undone pips are dim (the grey "finished early" ones stay clickable). Hovering a
// coloured pip shows the saved calibration reason; hovering a grey one invites the reflection.
function TomatoPips({ vivid, grey, base, plus, overInfo, underInfo, onGrey }: any) {
  const total = vivid + grey;
  if (!total) return <span style={{ fontSize: 11, color: C.muted }}>{"-"}</span>;
  const b = base != null && base > 0 ? base : total;
  const p1 = (plus && plus[0]) || 0;
  const p2 = (plus && plus[1]) || 0;
  const items: any[] = [];
  for (let i = 0; i < total; i++) {
    const doneOne = i < vivid;
    const round = i < b ? 0 : i < b + p1 ? 1 : i < b + p1 + p2 ? 2 : 0;
    const bg = round === 1 ? "#FBEFC9" : round === 2 ? "#F8D8B4" : "transparent";
    const label = round === 1 ? (overInfo && overInfo[0] ? "round 1: " + overInfo[0] : "extra round 1 (+\u{1F345})")
      : round === 2 ? (overInfo && overInfo[1] ? "round 2: " + overInfo[1] : "extra round 2 (+\u{1F345}): if it grows again, split the task")
      : (!doneOne && onGrey ? (underInfo ? "finished early: " + underInfo : "finished early? click to reflect on why it was lighter") : undefined);
    items.push(
      <span key={i} onClick={!doneOne ? onGrey : undefined} role={!doneOne && onGrey ? "button" : undefined} aria-label={label}
        style={{ fontSize: 13, opacity: doneOne ? 1 : round === 0 ? 0.28 : 0.5, background: bg, borderRadius: 4, padding: round === 0 ? 0 : "0 1px", cursor: !doneOne && onGrey ? "pointer" : "default" }}>{"\u{1F345}"}</span>
    );
  }
  return <span style={{ letterSpacing: 1, display: "inline-flex", gap: 1, alignItems: "center" }}>{items}</span>;
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
  // Newest first: column 0 is the current week and time runs backwards to the right, so the
  // days you care about are the ones you land on (and the ones a narrow panel keeps in view).
  for (let dow = 0; dow < 7; dow++) for (let w = 0; w < weeks; w++) {
    const day = new Date(+gridStart + ((weeks - 1 - w) * 7 + dow) * DAY);
    const inRange = day >= startMonth && day <= end;
    const k = ymd(day), n = counts[k] || 0;
    cells.push(<div key={dow + "-" + w} aria-label={inRange ? `${k}: ${n}${"\u{1F345}"}` : undefined} style={{ width: CELL, height: CELL, borderRadius: 2, boxSizing: "border-box", background: inRange ? heat(n) : "transparent", border: `1px solid ${inRange ? C.line : "transparent"}` }} />);
  }
  const monthLabels: any[] = [];
  let cur = new Date(startMonth);
  while (cur <= end) {
    const nxt = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const col = Math.round((+weekStartOf(cur, sun) - +gridStart) / (7 * DAY));
    // A month's block now runs right-to-left, so its label belongs at the block's LEFT edge:
    // the column holding its LAST day. (Not the next month's first column - that week can
    // still contain days of this month, which would push the label one column too far right.)
    const lastCol = Math.round((+weekStartOf(new Date(+nxt - DAY), sun) - +gridStart) / (7 * DAY));
    const left = Math.max(0, weeks - 1 - lastCol);
    if (col >= 0 && col < weeks) monthLabels.push(<span key={+cur} style={{ position: "absolute", left: left * (CELL + GAP), fontSize: 10, color: C.muted, fontFamily: "var(--fl-mono)" }}>{cur.toLocaleDateString(undefined, { month: "short" })}</span>);
    cur = nxt;
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
// The merged Calibrate view: five panels across the top, and two of them (Total, Log) open a
// second control down their left side. One table per level so the control and the switch that
// renders the panel can never drift apart.
const FOCUS_SUB: [string, string, any][] = [["log", "Pomo", TomatoIcon], ["break", "Break", MugIcon], ["pause", "Pause", PlayPauseIcon]];
const isFocusView = (v: string) => FOCUS_SUB.some(([k]) => k === v);
// The left rail, Slack-style: icon above a small label, one entry per view.
const NAV_TABS: [string, string, any][] = [["log", "Focus", CrosshairsIcon], ["calendar", "Calendar", CalendarTabIcon], ["calibrate", "Calibrate", TachometerIcon], ["today", "Plan", KiteIcon], ["sky", "Sky", ConstellationIcon]];
const CALIB_TABS: [string, string, any][] = [["today", "Today", RoseIcon], ["accuracy", "Pomo Accuracy", TemperatureIcon], ["total", "Sum", EggIcon]];
const HIST_TABS: [string, string][] = [["calib", "Calibration"], ["break", "Break"], ["pomo", "Pomo"], ["pause", "Pause"]];
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
  internal: { fill: "#FDE4C8", border: "#F07B16" },
  external: { fill: "#D6E8FD", border: "#2779E0" },
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
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M1.611,12c.759,0,1.375,.57,1.485,1.32,.641,4.339,4.389,7.68,8.903,7.68,5.476,0,9.827-4.917,8.867-10.569-.453-2.665-2.148-5.023-4.523-6.313-3.506-1.903-7.48-1.253-10.18,1.045l1.13,1.13c.63,.63,.184,1.707-.707,1.707H2c-.552,0-1-.448-1-1V2.414c0-.891,1.077-1.337,1.707-.707l1.332,1.332C7.6-.115,12.921-1.068,17.637,1.408c3.32,1.743,5.664,5.027,6.223,8.735,1.122,7.437-4.633,13.857-11.86,13.857-6.021,0-11.021-4.457-11.872-10.246-.135-.92,.553-1.754,1.483-1.754Z" />
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
function SunRoutineIcon({ size = 14 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>);
}
function MoonRoutineIcon({ size = 14 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" /></svg>);
}
function MinusIcon({ size = 16 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 512 512" fill="currentColor" stroke="none" style={{ display: "block" }}><path d="M480,288H32c-17.673,0-32-14.327-32-32s14.327-32,32-32h448c17.673,0,32,14.327,32,32S497.673,288,480,288z" /></svg>);
}
function PlusIcon({ size = 16 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 512 512" fill="currentColor" stroke="none" style={{ display: "block" }}><path d="M480,224H288V32c0-17.673-14.327-32-32-32s-32,14.327-32,32v192H32c-17.673,0-32,14.327-32,32s14.327,32,32,32h192v192c0,17.673,14.327,32,32,32s32-14.327,32-32V288h192c17.673,0,32-14.327,32-32S497.673,224,480,224z" /></svg>);
}
function ExploreIcon({ size = 13 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></svg>);
}
function HammerIcon({ size = 13 }: any) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9" /><path d="m18 15 4-4" /><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" /></svg>);
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
function VolumeSlashIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="m23.707,22.293c.391.391.391,1.023,0,1.414-.195.195-.451.293-.707.293s-.512-.098-.707-.293L.293,1.707C-.098,1.316-.098.684.293.293S1.316-.098,1.707.293l4.628,4.628C8.142,2.461,10.839.757,13.828.207c.288-.056.593.025.82.215.229.19.36.472.36.769v12.404l1.688,1.688c1.806-1.817,1.803-4.763-.01-6.576-.391-.391-.391-1.023,0-1.414.391-.391,1.023-.391,1.414,0,2.592,2.592,2.596,6.808.01,9.404l1.44,1.44c3.316-3.481,3.266-9.011-.152-12.43-.391-.391-.391-1.023,0-1.414s1.023-.391,1.414,0c4.198,4.198,4.249,10.997.152,15.258l2.742,2.742ZM.009,10v4c0,2.757,2.243,5,5,5h1.269c1.807,2.502,4.53,4.237,7.551,4.793.06.011.12.017.181.017.232,0,.459-.081.64-.231.229-.19.36-.472.36-.769v-3.579L1.881,6.103C.74,7.02.009,8.426.009,10Z" />
    </svg>
  );
}
// One waveform for every noise; the picker tells white, pink and brown apart by color alone.
function WaveformIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="m18,17c-.553,0-1-.447-1-1v-8c0-.553.447-1,1-1s1,.447,1,1v8c0,.553-.447,1-1,1Zm-3,6V1c0-.553-.447-1-1-1s-1,.447-1,1v22c0,.553.447,1,1,1s1-.447,1-1Zm8-4V5c0-.553-.447-1-1-1s-1,.447-1,1v14c0,.553.447,1,1,1s1-.447,1-1Zm-12,0V5c0-.553-.447-1-1-1s-1,.447-1,1v14c0,.553.447,1,1,1s1-.447,1-1Zm-4-3v-8c0-.553-.447-1-1-1s-1,.447-1,1v8c0,.553.447,1,1,1s1-.447,1-1Zm-4-2v-4c0-.553-.447-1-1-1s-1,.447-1,1v4c0,.553.447,1,1,1s1-.447,1-1Z" />
    </svg>
  );
}
// The background-noise picker: rests as just the active choice; hovering slides the other
// two open (the fl-noise rules in styles.css). Muted, white noise, pink noise.
function NoiseControl({ value, onPick }: any) {
  const opts: [string, any, string][] = [
    ["off", VolumeSlashIcon, "muted"],
    ["white", WaveformIcon, "white noise"],
    ["pink", WaveformIcon, "pink noise"],
    ["brown", WaveformIcon, "brown noise"],
  ];
  return (
    <span className="fl-noise" style={{ display: "inline-flex", alignItems: "center", marginBottom: 4 }}>
      {opts.map(([v, Icon, label]) => (
        <button key={v} onClick={() => onPick(v)} aria-label={"background noise: " + label} title={"background noise: " + label}
          className={"fl-noise-opt fl-noise-" + (v === "off" ? "mute" : v) + (value === v ? " is-active" : "")}>
          <Icon size={13} />
        </button>
      ))}
    </span>
  );
}
function PlayIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M20.492,7.969,10.954.975A5,5,0,0,0,3,5.005V19a4.994,4.994,0,0,0,7.954,4.03l9.538-6.994a5,5,0,0,0,0-8.062Z" />
    </svg>
  );
}
function PauseIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M6.5,0A3.5,3.5,0,0,0,3,3.5v17a3.5,3.5,0,0,0,7,0V3.5A3.5,3.5,0,0,0,6.5,0Z" />
      <path d="M17.5,0A3.5,3.5,0,0,0,14,3.5v17a3.5,3.5,0,0,0,7,0V3.5A3.5,3.5,0,0,0,17.5,0Z" />
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
function SproutIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="m23.987,2.323c.017-.649-.252-1.277-.737-1.722-.49-.448-1.147-.663-1.802-.586-5.656.654-8.256,4.435-9.448,7.57C10.808,4.45,8.208.669,2.552.015,1.902-.061,1.24.153.75.601.265,1.046-.004,1.674.013,2.323c.087,3.27,1.156,5.867,3.179,7.72,2.607,2.388,6.082,2.863,7.809,2.943v10.014c0,.552.447,1,1,1s1-.448,1-1v-10.014c1.727-.08,5.202-.555,7.809-2.943,2.022-1.853,3.092-4.45,3.179-7.72Z" />
    </svg>
  );
}
function SeaWaveIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="m6.5 9c-3.006 0-6.5 1.747-6.5 4 0 1.103.897 2 2 2 .415 0 .8-.127 1.12-.344.273.78 1.008 1.344 1.88 1.344.798 0 1.483-.473 1.804-1.15.782.779 1.196 1.829 1.196 3.15 0 2.198-1.794 3.987-4 3.987-.875 0-1.68-.276-2.392-.821-.438-.334-1.065-.254-1.402.187-.336.438-.252 1.066.186 1.401 1.054.806 2.301 1.233 3.606 1.233l11 .013c.334 0 .646-.167.832-.445.048-.071 1.168-1.784 1.168-4.555 0-5.607-4.612-10-10.5-10zm16.621 13.391-.136.78c-.083.479-.499.829-.985.829h-4.132c.451-.897 1.132-2.632 1.132-5 0-4.159-2.101-7.756-5.357-9.901-.564-1.793-1.752-2.992-3.182-3.71-.182.917-.991 1.611-1.961 1.611-1.009 0-1.837-.753-1.972-1.725-.367.439-.912.725-1.528.725-1.103 0-2-.897-2-2 .006-.459.178-.929.469-1.272.965-1.37 3.401-2.728 7.09-2.728 7.565 0 13.492 5.603 13.492 12.755.148 3.468-.4 6.603-.931 9.635z" />
    </svg>
  );
}
// The Focus sub-tabs' glyphs, in the same two weights as the surf tabs: the regular
// outline resting, the heavier cut when that panel is the open one.
function MugIcon({ size = 14, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d={on ? "M13.025,3V1a1,1,0,0,1,2,0V3A1,1,0,0,1,13.025,3Zm-3,1a1,1,0,0,0,1-1V1a1,1,0,0,0-2,0V3A1,1,0,0,0,10.025,4Zm-4,0a1,1,0,0,0,1-1V1a1,1,0,0,0-2,0V3A1,1,0,0,0,6.025,4ZM24,13.143A3.983,3.983,0,0,1,20,17H17.525a6.875,6.875,0,0,1-5.742,3H8.216a6.877,6.877,0,0,1-5.808-3.088C.992,14.653-2.453,6.371,3,6L17,6a3.1,3.1,0,0,1,2.882,4C22.353,10,24,11.205,24,13.143Zm-2,0c.088-.927-1.25-1.224-2.458-1.143a16.82,16.82,0,0,1-.954,3H20A1.984,1.984,0,0,0,22,13.143ZM19,22H1a1,1,0,0,0,0,2H19A1,1,0,0,0,19,22Z" : "M20,10h-.115A3.1,3.1,0,0,0,17,6L3,6c-5.451.372-2,8.651-.589,10.912A6.877,6.877,0,0,0,8.216,20h3.567a6.875,6.875,0,0,0,5.742-3H20C24.814,16.907,25.759,9.822,20,10Zm-8.217,8H8.216a4.881,4.881,0,0,1-4.131-2.179C3.541,15.3.494,8,3,8L17,8a.973.973,0,0,1,.729.325,1.028,1.028,0,0,1,.261.8C17.427,13.384,16.368,17.811,11.783,18ZM20,15H18.588a16.82,16.82,0,0,0,.954-3c1.209-.081,2.546.216,2.458,1.143A1.984,1.984,0,0,1,20,15ZM9.025,3V1a1,1,0,0,1,2,0V3A1,1,0,0,1,9.025,3Zm4,0V1a1,1,0,0,1,2,0V3A1,1,0,0,1,13.025,3Zm-8,0V1a1,1,0,0,1,2,0V3A1,1,0,0,1,5.025,3ZM20,23a1,1,0,0,1-1,1H1a1,1,0,0,1,0-2H19A1,1,0,0,1,20,23Z"} />
    </svg>
  );
}
function PlayPauseIcon({ size = 14, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d={on ? "M22,21c-.553,0-1-.448-1-1V4c0-.552,.447-1,1-1s1,.448,1,1V20c0,.552-.447,1-1,1Zm-4,0c-.553,0-1-.448-1-1V4c0-.552,.447-1,1-1s1,.448,1,1V20c0,.552-.447,1-1,1Zm-13.673-.271c-.509,0-1.023-.122-1.509-.367-1.139-.578-1.818-1.683-1.818-2.958V6.597c0-1.275,.679-2.381,1.817-2.958,1.119-.567,2.452-.457,3.46,.285l7.368,5.402c.86,.631,1.354,1.606,1.354,2.674s-.494,2.043-1.355,2.674l-7.368,5.403c-.588,.432-1.265,.651-1.949,.651Z" : "M22,21c-.553,0-1-.448-1-1V4c0-.552,.447-1,1-1s1,.448,1,1V20c0,.552-.447,1-1,1Zm-4,0c-.553,0-1-.448-1-1V4c0-.552,.447-1,1-1s1,.448,1,1V20c0,.552-.447,1-1,1Zm-13.673-.271c-.509,0-1.023-.122-1.509-.367-1.139-.578-1.818-1.683-1.818-2.958V6.597c0-1.275,.679-2.381,1.817-2.958,1.119-.567,2.452-.457,3.46,.285l7.368,5.402c.86,.631,1.354,1.606,1.354,2.674s-.494,2.043-1.355,2.674l-7.368,5.403c-.588,.432-1.265,.651-1.949,.651Zm-.003-15.455c-.205,0-.408,.05-.603,.149-.458,.232-.721,.66-.721,1.174v10.807c0,.514,.263,.941,.721,1.174,.459,.232,.959,.19,1.372-.112l7.369-5.404c.347-.254,.538-.631,.538-1.061s-.191-.807-.538-1.061L5.094,5.536c-.233-.172-.5-.262-.77-.262Z"} />
    </svg>
  );
}
// The surf's tab glyphs, each in two weights: the regular outline for a resting pill, the
// heavier cut for the open one, so the active tab reads as filled-in rather than recoloured.
function WalkingIcon({ size = 14, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      {on ? (<><circle cx="12.5" cy="2.5" r="2.5" /><path d="m20.447,12.402l-2.843-1.422c-.327-.163-.603-.413-.797-.723l-1.48-2.351c-.054-.078-1.321-1.907-3.327-1.907h-.879c-1.214,0-2.431.287-3.518.83l-2.096,1.049c-.77.384-1.338,1.082-1.559,1.914l-.783,2.951c-.142.534.177,1.082.71,1.223.534.139,1.082-.177,1.223-.71l.783-2.951c.073-.277.262-.51.519-.638l2.097-1.049c.197-.099.4-.185.607-.26l-1.026,4.385c-.301,1.286.291,2.64,1.439,3.292l3.977,2.258c.312.178.506.511.506.87v3.836c0,.552.447,1,1,1s1-.448,1-1v-3.836c0-1.077-.581-2.076-1.518-2.609l-1.95-1.108,1.538-5.784,1.044,1.659c.39.62.942,1.121,1.597,1.447l2.842,1.421c.144.072.296.105.446.105.367,0,.72-.202.896-.553.247-.494.047-1.095-.447-1.342Z" /><path d="m9.19,17.865c-.008-.005-.016-.01-.024-.014-.568-.34-1.304-.029-1.454.616l-.153.661-1.61,3.452c-.308.661.174,1.419.904,1.419.386,0,.738-.223.903-.573l1.654-3.514.228-.993c.095-.412-.086-.838-.449-1.055Z" /></>) : (<path d="m10,2.5c0-1.381,1.119-2.5,2.5-2.5s2.5,1.119,2.5,2.5-1.119,2.5-2.5,2.5-2.5-1.119-2.5-2.5Zm10.895,11.244c-.176.351-.528.553-.896.553-.15,0-.303-.034-.446-.105l-2.842-1.421c-.654-.327-1.207-.827-1.597-1.447l-.494-.784-1.408,5.296,1.27.721c.937.533,1.518,1.532,1.518,2.609v3.836c0,.552-.447,1-1,1s-1-.448-1-1v-3.836c0-.359-.194-.692-.506-.87l-3.977-2.258c-1.148-.652-1.74-2.006-1.439-3.292l1.026-4.385c-.207.076-.41.162-.607.26l-2.097,1.049c-.257.128-.446.36-.519.638l-.783,2.951c-.142.534-.689.85-1.223.71-.534-.142-.852-.689-.71-1.223l.783-2.951c.221-.832.789-1.53,1.559-1.914l2.096-1.049c1.087-.543,2.303-.83,3.518-.83h.879c2.006,0,3.273,1.829,3.327,1.907l1.48,2.351c.194.31.47.56.797.723l2.843,1.422c.494.247.694.848.447,1.342Zm-9.438,1.093l1.667-6.369c-.295-.238-.688-.467-1.124-.467h-.758l-1.217,5.2c-.1.428.097.879.48,1.097l.951.54Zm-2.266,3.029c-.008-.005-.016-.01-.024-.014-.568-.34-1.304-.029-1.454.616l-.153.661-1.61,3.452c-.308.661.174,1.419.904,1.419.386,0,.738-.223.903-.573l1.654-3.514.228-.993c.095-.412-.086-.838-.449-1.055Z" />)}
    </svg>
  );
}
function StomachIcon({ size = 14, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d={on ? "m15,3h-5c-1.398,0-2.701-.967-3.031-2.249-.138-.535-.687-.854-1.218-.72-.535.138-.857.684-.72,1.218.478,1.855,2.07,3.276,3.969,3.652v9.099c0,2.176-3.612,3.186-3.743,3.331-1.897.711-3.257,2.527-3.257,4.669v1c0,.553.447,1,1,1s1-.447,1-1v-1c0-1.305.842-2.406,2.008-2.818.167.104.342.21.504.312,2.012,1.275,3.911,2.479,8.487,2.505h.04c1.835,0,3.568-.72,4.886-2.029,1.338-1.331,2.075-3.096,2.075-4.97v-5c0-3.859-3.141-7-7-7Zm4.915,9.702c-.222.506-.811.733-1.319.511-.319-.142-.672-.213-1.05-.213-.596,0-.979.179-1.464.406-.566.265-1.271.594-2.311.594-.74,0-1.474-.161-2.181-.479-.504-.226-.729-.817-.503-1.321.227-.503.819-.729,1.321-.503.448.201.906.303,1.362.303.596,0,.979-.179,1.463-.405.566-.266,1.271-.595,2.312-.595.657,0,1.283.129,1.858.383.505.224.733.814.511,1.319Z" : "m15,3h-5c-1.398,0-2.701-.967-3.031-2.249-.138-.535-.687-.854-1.218-.72-.535.138-.857.684-.72,1.218.478,1.855,2.07,3.276,3.969,3.652v9.099c0,2.176-3.59,3.173-3.717,3.304-1.914.702-3.283,2.542-3.283,4.696v1c0,.553.447,1,1,1s1-.447,1-1v-1c0-1.304.836-2.415,2-2.828.174.108.344.216.511.322,2.012,1.275,3.911,2.479,8.487,2.505h.04c1.835,0,3.568-.72,4.886-2.029,1.338-1.331,2.075-3.096,2.075-4.97v-5c0-3.859-3.141-7-7-7Zm0,2c2.757,0,5,2.243,5,5v1.314c-.539-.181-1.205-.314-2-.314-1.185,0-1.971.301-2.664.566-.608.232-1.134.434-1.949.434-1.049,0-1.906-.335-2.387-.575v-6.425h4Zm3.515,13.552c-.939.934-2.173,1.447-3.477,1.447h-.027c-3.58-.021-5.167-.789-6.832-1.818,1.318-.731,2.821-2.035,2.821-4.181v-.41c.646.225,1.46.41,2.387.41,1.185,0,1.971-.301,2.664-.566.608-.232,1.134-.434,1.949-.434.986,0,1.65.291,2,.5v1.5c0,1.338-.527,2.599-1.485,3.552Z"} />
    </svg>
  );
}
// Capture-form buttons and the Project card's visibility toggle.
function DiskIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 512 512" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <circle cx="256" cy="298.667" r="42.667" />
      <path d="M480.768,87.936l-56.704-56.704c-5.674-5.585-11.957-10.515-18.731-14.699V64   c-0.071,58.881-47.786,106.596-106.667,106.667h-85.333C154.452,170.596,106.737,122.881,106.667,64V0   C47.786,0.071,0.071,47.786,0,106.667v298.667C0.071,464.215,47.786,511.93,106.667,512h298.667   C464.214,511.93,511.93,464.215,512,405.334V163.35C512.08,135.049,500.833,107.893,480.768,87.936z M256,384   c-47.128,0-85.333-38.205-85.333-85.333s38.205-85.333,85.333-85.333s85.333,38.205,85.333,85.333S303.128,384,256,384z" />
      <path d="M213.333,128h85.333c35.346,0,64-28.654,64-64V1.366c-4.638-0.756-9.32-1.212-14.016-1.365H149.333v64   C149.333,99.346,177.987,128,213.333,128z" />
    </svg>
  );
}
function BackArrowIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M10,22.03c-.77,0-1.51-.3-2.09-.88L1.18,14.82c-1.57-1.57-1.57-4.09-.02-5.64,0,0,.01-.01,.02-.02L7.93,2.81c.84-.85,2.09-1.1,3.22-.63s1.84,1.52,1.85,2.74v2.06h7.03c2.19,0,3.97,1.8,3.97,4.01v1.98c0,2.21-1.78,4.01-3.97,4.01h-7.03v2.06c0,1.23-.71,2.28-1.85,2.75-.38,.16-.77,.23-1.15,.23Z" />
    </svg>
  );
}
function PlusBoldIcon({ size = 11 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 512 512" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M480,224H288V32c0-17.673-14.327-32-32-32s-32,14.327-32,32v192H32c-17.673,0-32,14.327-32,32s14.327,32,32,32h192v192   c0,17.673,14.327,32,32,32s32-14.327,32-32V288h192c17.673,0,32-14.327,32-32S497.673,224,480,224z" />
    </svg>
  );
}
function EyeIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 509.348 509.348" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M488.935,188.541C437.397,109.024,349.407,60.662,254.652,59.773C159.898,60.662,71.908,109.024,20.37,188.541   c-27.16,39.859-27.16,92.279,0,132.139c51.509,79.566,139.504,127.978,234.283,128.896   c94.754-0.889,182.744-49.251,234.283-128.768C516.153,280.919,516.153,228.429,488.935,188.541z M436.199,284.541   c-39.348,62.411-107.769,100.488-181.547,101.035c-73.777-0.546-142.198-38.624-181.547-101.035   c-12.267-18.022-12.267-41.712,0-59.733c39.348-62.411,107.769-100.488,181.547-101.035   c73.777,0.546,142.198,38.624,181.547,101.035C448.466,242.829,448.466,266.519,436.199,284.541z" />
      <circle cx="254.652" cy="254.674" r="85.333" />
    </svg>
  );
}
function EyeCrossedIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 512.19 512.19" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M496.543,200.771c-19.259-31.537-43.552-59.707-71.915-83.392l59.733-59.733c8.185-8.475,7.95-21.98-0.525-30.165   c-8.267-7.985-21.374-7.985-29.641,0l-64.96,65.045c-40.269-23.918-86.306-36.385-133.141-36.053   c-132.075,0-207.339,90.411-240.448,144.299c-20.862,33.743-20.862,76.379,0,110.123c19.259,31.537,43.552,59.707,71.915,83.392   l-59.733,59.733c-8.475,8.185-8.71,21.691-0.525,30.165c8.185,8.475,21.691,8.71,30.165,0.525c0.178-0.172,0.353-0.347,0.525-0.525   l65.109-65.109c40.219,23.915,86.201,36.402,132.992,36.117c132.075,0,207.339-90.411,240.448-144.299   C517.405,277.151,517.405,234.515,496.543,200.771z M128.095,255.833c-0.121-70.575,56.992-127.885,127.567-128.006   c26.703-0.046,52.75,8.275,74.481,23.793l-30.976,30.976c-13.004-7.842-27.887-12.022-43.072-12.096   c-47.128,0-85.333,38.205-85.333,85.333c0.074,15.185,4.254,30.068,12.096,43.072l-30.976,30.976   C136.414,308.288,128.096,282.394,128.095,255.833z M256.095,383.833c-26.561-0.001-52.455-8.319-74.048-23.787l30.976-30.976   c13.004,7.842,27.887,12.022,43.072,12.096c47.128,0,85.333-38.205,85.333-85.333c-0.074-15.185-4.254-30.068-12.096-43.072   l30.976-30.976c41.013,57.434,27.702,137.242-29.732,178.255C308.845,375.558,282.798,383.879,256.095,383.833z" />
    </svg>
  );
}
// The Calibrate sub-tabs' glyphs, two weights each like every other tab family.
function RoseIcon({ size = 14, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d={on ? "M23.996,13.957l-.127,1.124c-.794,7.021-7.366,8.876-10.731,8.876h-2.28C7.494,23.957,.921,22.102,.127,15.081l-.127-1.124H1.025c6.004,0,8.8,4.077,9.973,6.672v-5.72c-2.832-.479-4.998-2.943-4.998-5.909,0-2.18-.468-4.099-.743-5.039,.228,.006,1.839,.134,3.864,.964,2.135,.875,4.678,4.002,5.19,8.103,.002,.013,.092,.596,.197,1.415-.473,.219-.982,.372-1.511,.463v5.723c1.172-2.596,3.969-6.672,9.973-6.672h1.025ZM9.879,3.075c.697,.286,1.417,.742,2.113,1.34,.687-.587,1.41-1.045,2.128-1.34,1.002-.41,1.814-.661,2.434-.818,.124-1.579,.446-2.257,.446-2.257,0,0-2.5,0-5,1.5C9.5,0,7,0,7,0c0,0,.322,.678,.446,2.257,.619,.157,1.427,.405,2.433,.817Zm3.509,2.784c1.419,1.747,2.559,4.127,2.904,6.892,.003,.019,.024,.155,.055,.372,1.021-1.076,1.653-2.526,1.653-4.124,0-2.234,.491-4.194,.763-5.107-.202,.028-1.859,.202-3.884,1.032-.493,.202-.998,.524-1.491,.934Z" : "M22.865,14c-5.167,0-8.171,2.472-9.865,4.792v-3.882c2.833-.478,5-2.942,5-5.91,0-3.067,.929-5.628,.938-5.654l.53-1.443-1.533,.099c-.083,.005-.565,.049-1.382,.256,.124-1.58,.446-2.258,.446-2.258,0,0-2.5,0-5,1.5C9.5,0,7,0,7,0c0,0,.322,.678,.446,2.258-.817-.207-1.299-.251-1.382-.256l-1.533-.098,.53,1.442c.01,.025,.938,2.586,.938,5.654,0,2.967,2.167,5.431,5,5.91v3.882c-1.694-2.32-4.699-4.792-9.865-4.792H.002l.141,1.124c.788,6.305,6.718,8.438,10.613,8.809l1.244,.067,1.244-.067c3.895-.371,9.825-2.503,10.613-8.809l.141-1.124h-1.133ZM2.362,16.056c5.092,.478,7.319,3.888,8.186,5.833-2.385-.307-6.962-1.465-8.186-5.833ZM14.879,4.925c.661-.271,1.229-.464,1.696-.601-.28,1.16-.575,2.823-.575,4.675,0,.469-.081,.919-.23,1.338-.544-1.746-1.396-3.269-2.385-4.485,.494-.41,1.001-.726,1.494-.928Zm-6.879,4.075c0-1.852-.295-3.516-.575-4.675,.467,.137,1.035,.33,1.696,.601,2.017,.827,4.398,3.665,5.084,7.41-.633,.42-1.391,.665-2.205,.665-2.206,0-4-1.794-4-4Zm5.452,12.889c.866-1.945,3.094-5.355,8.186-5.833-1.224,4.368-5.801,5.526-8.186,5.833Z"} />
    </svg>
  );
}
function TemperatureIcon({ size = 14, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d={on ? "M18,17a7.009,7.009,0,0,1-7,7c-6.077.117-9.335-7.638-5-11.889V5c.211-6.609,9.791-6.6,10,0v7.111A7.007,7.007,0,0,1,18,17Zm-4,0a3,3,0,0,0-2-2.828V5a1,1,0,0,0-2,0v9.172A3,3,0,1,0,14,17ZM24,3a3,3,0,0,0-6,0,3,3,0,0,0,6,0ZM22,3a1,1,0,1,1-1-1A1,1,0,0,1,22,3Z" : "M11,24c-6.078.117-9.334-7.638-5-11.889V5c.211-6.609,9.791-6.6,10,0v7.111C20.335,16.363,17.077,24.117,11,24ZM11,2A3,3,0,0,0,8,5v7.537a1,1,0,0,1-.332.744A5.018,5.018,0,0,0,11,22a5.018,5.018,0,0,0,3.332-8.719A1,1,0,0,1,14,12.537V5A3,3,0,0,0,11,2Zm0,18a3.007,3.007,0,0,1-1-5.829V5a1,1,0,0,1,2,0v9.171A3.007,3.007,0,0,1,11,20Zm0-4a1,1,0,0,0,0,2A1,1,0,0,0,11,16ZM21,6a3,3,0,0,1,0-6A3,3,0,0,1,21,6Zm0-4a1,1,0,0,0,0,2A1,1,0,0,0,21,2Z"} />
    </svg>
  );
}
function EggIcon({ size = 14, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d={on ? "M12,0C6.294,0,2,8.493,2,14a10,10,0,0,0,20,0C22,8.493,17.706,0,12,0Zm1,7a1,1,0,1,1,1,1A1,1,0,0,1,13,7Zm2.5,6A1.5,1.5,0,1,1,17,11.5,1.5,1.5,0,0,1,15.5,13Z" : "M12,24A10.011,10.011,0,0,1,2,14C2,8.493,6.294,0,12,0S22,8.493,22,14A10.011,10.011,0,0,1,12,24ZM12,2C7.739,2,4,9.479,4,14a8,8,0,0,0,16,0C20,9.479,16.261,2,12,2Zm2,9.5a1.5,1.5,0,0,0,3,0A1.5,1.5,0,0,0,14,11.5ZM13,7a1,1,0,0,0,2,0A1,1,0,0,0,13,7Z"} />
    </svg>
  );
}
// The left rail's five view glyphs, two weights each: regular resting, the heavier cut
// when that view is the open one (same convention as every other tab in the app).
function CrosshairsIcon({ size = 16, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      {on ? (<>
        <path d="M15,12c0,1.654-1.346,3-3,3s-3-1.346-3-3,1.346-3,3-3,3,1.346,3,3Zm9,0c0,.553-.448,1-1,1h-1.05c-.471,4.717-4.233,8.48-8.95,8.95v1.05c0,.553-.448,1-1,1s-1-.447-1-1v-1.05c-4.717-.471-8.48-4.233-8.95-8.95H1c-.552,0-1-.447-1-1s.448-1,1-1h1.05C2.52,6.283,6.283,2.52,11,2.05V1c0-.553,.448-1,1-1s1,.447,1,1v1.05c4.717,.471,8.48,4.233,8.95,8.95h1.05c.552,0,1,.447,1,1Zm-7,0c0-2.757-2.243-5-5-5s-5,2.243-5,5,2.243,5,5,5,5-2.243,5-5Z" />
      </>) : (<>
        <path d="M12,7c-2.757,0-5,2.243-5,5s2.243,5,5,5,5-2.243,5-5-2.243-5-5-5Zm0,8c-1.654,0-3-1.346-3-3s1.346-3,3-3,3,1.346,3,3-1.346,3-3,3Zm11-4h-1.05c-.471-4.717-4.233-8.48-8.95-8.95V1c0-.553-.448-1-1-1s-1,.447-1,1v1.05C6.283,2.52,2.52,6.283,2.05,11H1c-.552,0-1,.447-1,1s.448,1,1,1h1.05c.471,4.717,4.233,8.48,8.95,8.95v1.05c0,.553,.448,1,1,1s1-.447,1-1v-1.05c4.717-.471,8.48-4.233,8.95-8.95h1.05c.552,0,1-.447,1-1s-.448-1-1-1Zm-11,9c-4.411,0-8-3.589-8-8S7.589,4,12,4s8,3.589,8,8-3.589,8-8,8Z" />
      </>)}
    </svg>
  );
}
function CalendarTabIcon({ size = 16, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      {on ? (<>
        <path d="M0,19a5.006,5.006,0,0,0,5,5H19a5.006,5.006,0,0,0,5-5V10H0Zm17-4.5A1.5,1.5,0,1,1,15.5,16,1.5,1.5,0,0,1,17,14.5Zm-5,0A1.5,1.5,0,1,1,10.5,16,1.5,1.5,0,0,1,12,14.5Zm-5,0A1.5,1.5,0,1,1,5.5,16,1.5,1.5,0,0,1,7,14.5Z" />
        <path d="M19,2H18V1a1,1,0,0,0-2,0V2H8V1A1,1,0,0,0,6,1V2H5A5.006,5.006,0,0,0,0,7V8H24V7A5.006,5.006,0,0,0,19,2Z" />
      </>) : (<>
        <path d="M19,2H18V1a1,1,0,0,0-2,0V2H8V1A1,1,0,0,0,6,1V2H5A5.006,5.006,0,0,0,0,7V19a5.006,5.006,0,0,0,5,5H19a5.006,5.006,0,0,0,5-5V7A5.006,5.006,0,0,0,19,2ZM2,7A3,3,0,0,1,5,4H19a3,3,0,0,1,3,3V8H2ZM19,22H5a3,3,0,0,1-3-3V10H22v9A3,3,0,0,1,19,22Z" />
        <circle cx="12" cy="15" r="1.5" />
        <circle cx="7" cy="15" r="1.5" />
        <circle cx="17" cy="15" r="1.5" />
      </>)}
    </svg>
  );
}
function TachometerIcon({ size = 16, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      {on ? (<>
        <path d="M20,4.052A12,12,0,0,0,3.611,21.571,4.991,4.991,0,0,0,7.12,23h9.766a4.841,4.841,0,0,0,3.355-1.288A12.053,12.053,0,0,0,20,4.052ZM12,15a2,2,0,0,1-1-3.723V6a1,1,0,0,1,2,0v5.277A2,2,0,0,1,12,15Zm5.953,4.75a1,1,0,0,1-1.324-1.5A7,7,0,0,0,19,13h0a7,7,0,0,0-3.5-6.065,1,1,0,0,1,1-1.731A9.011,9.011,0,0,1,17.953,19.75ZM3,13a.28.28,0,0,1,.006-.028A9,9,0,0,1,7.5,5.2a1,1,0,0,1,1,1.731A7,7,0,0,0,5,13H5a7,7,0,0,0,2.371,5.25,1,1,0,0,1-1.324,1.5A9,9,0,0,1,3,13Z" />
      </>) : (<>
        <path d="M20,4.052A12,12,0,0,0,3.612,21.571,4.988,4.988,0,0,0,7.12,23h9.767a4.84,4.84,0,0,0,3.354-1.288A12.054,12.054,0,0,0,20,4.052ZM18.868,20.259A2.862,2.862,0,0,1,16.887,21H7.12a3.005,3.005,0,0,1-2.11-.858,10,10,0,1,1,13.858.117ZM8.82,6.683a1,1,0,0,1-.248,1.392,6.031,6.031,0,0,0-.766,9.21,1,1,0,1,1-1.4,1.43A8.042,8.042,0,0,1,7.427,6.435,1,1,0,0,1,8.82,6.683ZM20,13a7.932,7.932,0,0,1-2.408,5.715,1,1,0,0,1-1.4-1.43,6.031,6.031,0,0,0-.765-9.21,1,1,0,1,1,1.144-1.64A8.008,8.008,0,0,1,20,13Zm-6,0a2,2,0,1,1-3-1.732V6a1,1,0,0,1,2,0v5.268A2,2,0,0,1,14,13Z" />
      </>)}
    </svg>
  );
}
function KiteIcon({ size = 16, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d={on ? "M24,21.242V24H22V21.242a3.243,3.243,0,0,0-5.535-2.293l-3,3A6.955,6.955,0,0,1,8.517,24H3.123A3.121,3.121,0,0,1,.916,18.672L4.1,15.485,7.639,2.227A2.953,2.953,0,0,1,8,1.413L13.087,6.5,4.106,15.482,5.52,16.9,14.5,7.915,19.587,13a2.953,2.953,0,0,1-.814.36L5.52,16.9l-3.19,3.19A1.121,1.121,0,0,0,3.123,22H8.517a4.971,4.971,0,0,0,3.536-1.465l3-3A5.242,5.242,0,0,1,24,21.242ZM19.287.3A2.977,2.977,0,0,0,18,0H10.536a3,3,0,0,0-.962.16L14.5,5.087ZM20.84,11.426a3,3,0,0,0,.16-.962V3a2.963,2.963,0,0,0-.3-1.284L15.915,6.5Z" : "M18.76,16a5.207,5.207,0,0,0-3.707,1.535l-3,3A4.971,4.971,0,0,1,8.517,22H3.123a1.121,1.121,0,0,1-.793-1.914L5.52,16.9l13.253-3.535A3,3,0,0,0,21,10.464V3a3,3,0,0,0-3-3H10.536a3,3,0,0,0-2.9,2.227L4.1,15.485.916,18.672A3.121,3.121,0,0,0,3.123,24H8.517a6.955,6.955,0,0,0,4.95-2.051l3-3A3.243,3.243,0,0,1,22,21.242V24h2V21.242A5.249,5.249,0,0,0,18.76,16ZM19,3.416v6.17L15.915,6.5ZM14.5,5.087,11.414,2h6.174Zm3.566,6.394L8.342,14.074,14.5,7.915ZM9.519,2.933,13.087,6.5,6.925,12.663Z"} />
    </svg>
  );
}
function ConstellationIcon({ size = 16, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d={on ? "m20.75,17.5c-.641,0-1.238.186-1.742.508l-4.429-3.659c.268-.472.422-1.018.422-1.599,0-1.411-.904-2.615-2.164-3.063l.332-3.319c1.11-.328,1.975-1.234,2.244-2.368h2.175c.34,1.432,1.629,2.5,3.162,2.5,1.792,0,3.25-1.458,3.25-3.25s-1.458-3.25-3.25-3.25c-1.349,0-2.509.827-3,2h-2.5c-.491-1.173-1.651-2-3-2-1.792,0-3.25,1.458-3.25,3.25,0,1.411.904,2.615,2.164,3.063l-.332,3.319c-1.11.328-1.975,1.234-2.244,2.368h-2.245c-.423-1.304-1.649-2.25-3.092-2.25-1.792,0-3.25,1.458-3.25,3.25s1.458,3.25,3.25,3.25c1.443,0,2.67-.946,3.092-2.25h2.408c.491,1.173,1.651,2,3,2,.477,0,.93-.103,1.339-.289l4.643,3.835c-.149.372-.231.779-.231,1.204,0,1.792,1.458,3.25,3.25,3.25s3.25-1.458,3.25-3.25-1.458-3.25-3.25-3.25Zm-14.75,3c0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5.672-1.5,1.5-1.5,1.5.672,1.5,1.5Zm18-9c0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5.672-1.5,1.5-1.5,1.5.672,1.5,1.5Zm-11,11c0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5.672-1.5,1.5-1.5,1.5.672,1.5,1.5ZM0,1.5C0,.672.672,0,1.5,0s1.5.672,1.5,1.5-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5Zm4,4c0-.828.672-1.5,1.5-1.5s1.5.672,1.5,1.5-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5Z" : "m20.75,17.5c-.641,0-1.238.186-1.742.508l-4.429-3.659c.268-.472.422-1.018.422-1.599,0-1.411-.904-2.615-2.164-3.063l.332-3.319c1.11-.328,1.975-1.234,2.244-2.368h2.175c.34,1.432,1.629,2.5,3.162,2.5,1.792,0,3.25-1.458,3.25-3.25s-1.458-3.25-3.25-3.25c-1.349,0-2.509.827-3,2h-2.5c-.491-1.173-1.651-2-3-2-1.792,0-3.25,1.458-3.25,3.25,0,1.411.904,2.615,2.164,3.063l-.332,3.319c-1.11.328-1.975,1.234-2.244,2.368h-2.245c-.423-1.304-1.649-2.25-3.092-2.25-1.792,0-3.25,1.458-3.25,3.25s1.458,3.25,3.25,3.25c1.443,0,2.67-.946,3.092-2.25h2.408c.491,1.173,1.651,2,3,2,.477,0,.93-.103,1.339-.289l4.643,3.835c-.149.372-.231.779-.231,1.204,0,1.792,1.458,3.25,3.25,3.25s3.25-1.458,3.25-3.25-1.458-3.25-3.25-3.25Zm0-15.5c.689,0,1.25.561,1.25,1.25s-.561,1.25-1.25,1.25-1.25-.561-1.25-1.25.561-1.25,1.25-1.25Zm-8.5,0c.689,0,1.25.561,1.25,1.25s-.561,1.25-1.25,1.25-1.25-.561-1.25-1.25.561-1.25,1.25-1.25ZM3.25,14.25c-.689,0-1.25-.561-1.25-1.25s.561-1.25,1.25-1.25,1.25.561,1.25,1.25-.561,1.25-1.25,1.25Zm7.25-1.5c0-.689.561-1.25,1.25-1.25s1.25.561,1.25,1.25-.561,1.25-1.25,1.25-1.25-.561-1.25-1.25Zm10.25,9.25c-.689,0-1.25-.561-1.25-1.25s.561-1.25,1.25-1.25,1.25.561,1.25,1.25-.561,1.25-1.25,1.25Zm-14.75-1.5c0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5.672-1.5,1.5-1.5,1.5.672,1.5,1.5Zm18-9c0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5.672-1.5,1.5-1.5,1.5.672,1.5,1.5Zm-11,11c0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5.672-1.5,1.5-1.5,1.5.672,1.5,1.5ZM0,1.5C0,.672.672,0,1.5,0s1.5.672,1.5,1.5-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5Zm4,4c0-.828.672-1.5,1.5-1.5s1.5.672,1.5,1.5-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5Z"} />
    </svg>
  );
}
function TimePastIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M13.001,7.245c-.539-.121-1.074,.215-1.197,.753-.31,1.365-.411,2.751-.3,4.119,.017,.209,.099,.407,.235,.567,.667,.784,1.427,1.495,2.261,2.111,.179,.133,.387,.196,.594,.196,.307,0,.609-.141,.805-.405,.328-.444,.234-1.07-.209-1.398-.624-.461-1.199-.983-1.714-1.555-.055-1.061,.038-2.132,.279-3.191,.123-.539-.215-1.075-.753-1.197Z" />
      <path d="M22.122,6.806c-.637-1.882-2.151-3.383-4.05-4.015-3.472-1.155-6.995-1.154-10.468,0-1.898,.631-3.412,2.132-4.05,4.015-.231,.682-.417,1.37-.557,2.058-.033-.064-.067-.131-.102-.203-.246-.494-.845-.697-1.341-.45-.494,.246-.695,.846-.449,1.341,.595,1.196,.928,1.607,1.982,2.443,.18,.143,.4,.217,.622,.217,.147,0,.296-.033,.434-.099,1.221-.588,1.642-.916,2.503-1.948,.354-.424,.297-1.055-.127-1.408-.424-.354-1.054-.297-1.408,.127-.033,.04-.066,.078-.097,.115,.116-.518,.261-1.036,.435-1.551,.438-1.292,1.479-2.324,2.786-2.759,3.054-1.015,6.151-1.015,9.206,0,1.307,.435,2.349,1.466,2.786,2.759,1.023,3.021,1.023,6.084,0,9.105-.438,1.293-1.479,2.324-2.787,2.758-3.054,1.018-6.151,1.018-9.206,0-1.306-.434-2.348-1.465-2.786-2.759-.099-.291-.188-.581-.268-.872-.146-.533-.697-.847-1.229-.699-.533,.146-.846,.696-.7,1.229,.09,.328,.19,.657,.302,.984,.638,1.885,2.152,3.386,4.049,4.016,1.737,.577,3.485,.866,5.234,.866s3.498-.289,5.233-.866c1.899-.631,3.413-2.132,4.05-4.016,1.167-3.446,1.167-6.941,0-10.388Z" />
    </svg>
  );
}
function SettingsIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M12,8a4,4,0,1,0,4,4A4,4,0,0,0,12,8Zm0,6a2,2,0,1,1,2-2A2,2,0,0,1,12,14Z" />
      <path d="M21.294,13.9l-.444-.256a9.1,9.1,0,0,0,0-3.29l.444-.256a3,3,0,1,0-3-5.2l-.445.257A8.977,8.977,0,0,0,15,3.513V3A3,3,0,0,0,9,3v.513A8.977,8.977,0,0,0,6.152,5.159L5.705,4.9a3,3,0,0,0-3,5.2l.444.256a9.1,9.1,0,0,0,0,3.29l-.444.256a3,3,0,1,0,3,5.2l.445-.257A8.977,8.977,0,0,0,9,20.487V21a3,3,0,0,0,6,0v-.513a8.977,8.977,0,0,0,2.848-1.646l.447.258a3,3,0,0,0,3-5.2Zm-2.548-3.776a7.048,7.048,0,0,1,0,3.75,1,1,0,0,0,.464,1.133l1.084.626a1,1,0,0,1-1,1.733l-1.086-.628a1,1,0,0,0-1.215.165,6.984,6.984,0,0,1-3.243,1.875,1,1,0,0,0-.751.969V21a1,1,0,0,1-2,0V19.748a1,1,0,0,0-.751-.969A6.984,6.984,0,0,1,7.006,16.9a1,1,0,0,0-1.215-.165l-1.084.627a1,1,0,1,1-1-1.732l1.084-.626a1,1,0,0,0,.464-1.133,7.048,7.048,0,0,1,0-3.75A1,1,0,0,0,4.79,8.992L3.706,8.366a1,1,0,0,1,1-1.733l1.086.628A1,1,0,0,0,7.006,7.1a6.984,6.984,0,0,1,3.243-1.875A1,1,0,0,0,11,4.252V3a1,1,0,0,1,2,0V4.252a1,1,0,0,0,.751.969A6.984,6.984,0,0,1,16.994,7.1a1,1,0,0,0,1.215.165l1.084-.627a1,1,0,1,1,1,1.732l-1.084.626A1,1,0,0,0,18.746,10.125Z" />
    </svg>
  );
}
function CheckSolidIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 507.506 507.506" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M163.865,436.934c-14.406,0.006-28.222-5.72-38.4-15.915L9.369,304.966c-12.492-12.496-12.492-32.752,0-45.248l0,0c12.496-12.492,32.752-12.492,45.248,0l109.248,109.248L452.889,79.942c12.496-12.492,32.752-12.492,45.248,0l0,0c12.492,12.496,12.492,32.752,0,45.248L202.265,421.019C192.087,431.214,178.271,436.94,163.865,436.934z" />
    </svg>
  );
}
function StarIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M22.789,8.85c-.465-1.258-1.554-1.999-2.866-1.945-1.002,.032-2.005,.059-3.006,.079-.445,.038-.866-.284-1.004-.728-.297-.96-.595-1.919-.898-2.877-.408-1.301-1.591-2.142-3.013-2.142s-2.605,.841-3.013,2.141c-.304,.958-.602,1.917-.898,2.877-.138,.445-.54,.769-1.004,.729-1.002-.02-2.005-.046-2.996-.078-1.311-.052-2.414,.688-2.878,1.945-.507,1.372-.081,2.893,1.066,3.789,.812,.623,1.617,1.231,2.421,1.831,.382,.285,.529,.795,.367,1.27-.334,.979-.683,1.962-1.044,2.946-.492,1.301-.142,2.657,.892,3.453,1.09,.841,2.635,.828,3.847-.036l2.558-1.837c.414-.296,.95-.297,1.365,0l2.562,1.84c.613,.436,1.312,.655,1.994,.655,.664,0,1.312-.207,1.849-.621,1.033-.796,1.383-2.152,.895-3.445-.365-.992-.712-1.976-1.047-2.954-.163-.474-.015-.984,.366-1.269,.805-.601,1.611-1.209,2.429-1.837,1.14-.891,1.566-2.412,1.059-3.784Z" />
    </svg>
  );
}
function BoxIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 512.103 512.103" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M405.333,0.052H106.667C47.756,0.052,0,47.808,0,106.718l0,0c0,35.346,28.654,64,64,64h384c33.692,0.411,61.813-25.619,64-59.243C514.568,52.562,468.892,2.721,409.979,0.153C408.431,0.085,406.882,0.052,405.333,0.052z" />
      <path d="M469.333,213.385H42.667c-11.782,0-21.333,9.551-21.333,21.333v170.667C21.404,464.266,69.119,511.981,128,512.052h256c58.881-0.071,106.596-47.786,106.667-106.667V234.718C490.667,222.936,481.115,213.385,469.333,213.385z M320,320.052H192c-11.782,0-21.333-9.551-21.333-21.333s9.551-21.333,21.333-21.333h128c11.782,0,21.333,9.551,21.333,21.333S331.782,320.052,320,320.052z" />
    </svg>
  );
}
function ShuffleIcon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d="M15.803,7.572h4.141c-.399,.342-.926,.708-1.615,1.047-.495,.244-.699,.844-.455,1.339,.175,.354,.529,.559,.898,.558,.148,0,.299-.033,.441-.103,2.838-1.398,3.636-3.268,3.718-3.477,.092-.235,.091-.496,0-.73-.082-.208-.88-2.069-3.717-3.468-.496-.242-1.095-.041-1.339,.455-.245,.496-.041,1.095,.454,1.339,.685,.338,1.21,.701,1.608,1.04h-4.134c-2.02,0-4.568,.929-5.243,5.357-.014,.09-.062,.331-.062,.331-.646,2.925-1.657,5.632-4.665,5.632-2.072,0-3.06-1.007-3.092-1.04-.371-.41-1.004-.44-1.413-.07-.409,.371-.44,1.003-.069,1.413,.063,.069,1.572,1.697,4.574,1.697,5.029,0,6.143-5.046,6.618-7.202,0,0,.062-.314,.085-.46,.276-1.809,.88-3.658,3.267-3.658Z" />
      <path d="M1.323,8.203c.191,.178,.435,.266,.679,.266,.267,0,.532-.105,.73-.312,.041-.043,1.028-1.05,3.101-1.05,.87,0,1.596,.215,2.216,.657,.45,.32,1.075,.214,1.395-.235,.32-.45,.215-1.074-.234-1.395-.958-.681-2.094-1.027-3.376-1.027-3.002,0-4.511,1.628-4.574,1.697-.367,.405-.336,1.025,.064,1.398Z" />
      <path d="M19.214,13.587c-.496-.244-1.094-.041-1.34,.455-.244,.495-.04,1.095,.455,1.339,.689,.339,1.216,.706,1.615,1.047h-4.141c-.548,0-1.029-.099-1.432-.295-.496-.242-1.096-.034-1.337,.462-.241,.497-.035,1.095,.462,1.337,.677,.329,1.453,.496,2.307,.496h4.134c-.398,.34-.923,.703-1.608,1.04-.495,.244-.699,.844-.454,1.339,.174,.353,.528,.558,.897,.558,.148,0,.299-.033,.441-.103,2.837-1.399,3.635-3.26,3.717-3.468,.092-.234,.093-.495,0-.73-.082-.209-.88-2.079-3.718-3.477Z" />
    </svg>
  );
}
function BriefcaseBusinessIcon({ size = 16 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M12 12h.01" /><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M22 13a18.15 18.15 0 0 1-20 0" /><rect width="20" height="14" x="2" y="6" rx="2" />
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
function AngleIcon({ size = 14, down = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      {down
        ? <path d="M19.061,7.854a1.5,1.5,0,0,0-2.122,0l-4.586,4.585a.5.5,0,0,1-.707,0L7.061,7.854A1.5,1.5,0,0,0,4.939,9.975l4.586,4.586a3.5,3.5,0,0,0,4.95,0l4.586-4.586A1.5,1.5,0,0,0,19.061,7.854Z" />
        : <path d="M15.75,9.525,11.164,4.939A1.5,1.5,0,0,0,9.043,7.061l4.586,4.585a.5.5,0,0,1,0,.708L9.043,16.939a1.5,1.5,0,0,0,2.121,2.122l4.586-4.586A3.505,3.505,0,0,0,15.75,9.525Z" />}
    </svg>
  );
}
function Undo2Icon({ size = 14 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
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

function LogForm({ tasks, preset, onAdd, settings, secs, running, paused, resetTimer, onSurf, whisper, pomoMin, changePomo, stepPomo, chooseNext, setChooseNext, nextTask, setNextTask, onStart, onPickTask, onPause, pauseActive, pauseTags, pauseTag, setPauseTag, tagColor, tagBorder, floatOn, setFloatOn, lenLocked, finished, finishedTs, expected, onSetExpected, autoLogDefault, onAutoLogChange }: any) {
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
  // Tiny starter (behavioral activation): a 5-minute toe-dip that counts as a real beat if
  // you stop, and upgrades into the full pomodoro when flow catches. tinyPrev remembers the
  // real length to restore; tinyCarry folds the dipped minutes into the upgraded log.
  const [tinyCarry, setTinyCarry] = useState(0);
  const tinyPrev = useRef(0);
  const tinyRun = useRef(false);
  const meta: any = tasks.find((t: any) => t.task === task) || {};
  // Build and log the session with explicit ratings (so a tap-to-log doesn't race React state).
  const buildAndAdd = (actualVal: number, expectedVal: number) => {
    // Rhythm first: an unnamed run logs as plain "Focus", and ratings the user skipped are
    // neutralized (expected = actual) so free pomodoros never fake a feelings surprise.
    const name = task.trim() || "Focus";
    const expOut = expectedVal >= 1 ? expectedVal : (actualVal >= 1 ? actualVal : 0);
    const actOut = actualVal >= 1 ? actualVal : expOut;
    // Minutes actually worked, from the countdown's progress (pauses freeze it, so
    // elapsed = work time): stopping a 25-min pomodoro with 10:00 left logs 15 min.
    // An untouched timer (a manual log) still records the full length.
    const workedSecs = pomoMin * 60 - secs;
    const workedMin = (workedSecs > 0 ? Math.max(1, Math.round(workedSecs / 60)) : pomoMin) + tinyCarry;
    onAdd({ id: Date.now(), task: name, group: meta.group || name, hierarchy: hierarchyText(meta), load: meta.load || null, category: meta.category || null, url: meta.url || null, pageId: meta.id || null, ts: new Date(finished && finishedTs ? finishedTs : Date.now()).toISOString(), expected: expOut, actual: actOut, note: note.trim(), minutes: workedMin }, markDone);
    setNote("");
    setMarkDone(false);
    setAct(0);   // clear the rating so the next pomodoro's finish panel starts unhighlighted
    if (tinyCarry) setTinyCarry(0);
    if (tinyPrev.current > 0) { changePomo(tinyPrev.current); tinyPrev.current = 0; }
    tinyRun.current = false;
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
  // Rhythm first, feeling always: the expected rating is REQUIRED before every fresh start
  // (free or named), while the task link is optional; a task-less free pomodoro can be named
  // mid-run or at the end, or logged as plain "Focus". Logging itself is never hard-blocked.
  const canLog = true as boolean;
  const blockStart = !running && !paused && !pauseActive && !rated;
  const logBtn = <button onClick={submit} disabled={!canLog} aria-label={canLog ? undefined : "set an expected rating first"} style={{ ...btn(C.ink), width: "100%", padding: "10px", opacity: canLog ? 1 : 0.5, cursor: canLog ? "pointer" : "not-allowed" }}>log pomodoro + write Act</button>;
  // Only offered when the chosen task really maps to a Notion page: a free pomodoro (or a
  // local-only task) has nothing to set Done, so the line would be a dead checkbox.
  const markDoneLabel = !meta.id ? null : (
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
          <option value="">{"- next pomodoro: decide later -"}</option>
          {tasks.map((t: any) => (<option key={t.task} value={t.task}>{t.task}{t.king ? " \u{1F451}" : ""}</option>))}
        </select>
      )}
    </>
  );
  return (
    <>
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.line}` }}>
        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 30, color: secs === 0 ? C.better : ((running && secs > 0 && (secs <= 60 || [900, 600, 300].some((mk: number) => pomoMin * 60 > mk && secs <= mk && secs >= mk - 2))) ? C.worse : C.ink) }}>{mm}:{ss}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button disabled={lenLocked || pomoMin <= 5} onMouseDown={() => beginHold(-1)} onMouseUp={endHold} onMouseLeave={endHold} aria-label={lenLocked ? "length is locked while a pomodoro is running" : "shorter - hold to speed up (min 5)"} style={{ width: 19, height: 19, padding: 0, borderRadius: 999, border: `1.5px solid ${C.ink}`, background: "transparent", color: C.ink, boxShadow: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: (lenLocked || pomoMin <= 5) ? 0.4 : 1, cursor: lenLocked ? "not-allowed" : "pointer" }}><MinusIcon size={10} /></button>
          <button onClick={running ? onPause : () => onStart(task)} disabled={blockStart} aria-label={blockStart ? "rate the expected feeling first" : (running ? "pause" : ((paused || pauseActive) ? "resume" : "start"))} style={{ ...btn("#C57B5A"), borderRadius: 999, height: 32, padding: "0 21px", minWidth: 84, opacity: blockStart ? 0.5 : 1, cursor: blockStart ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{running ? <PauseIcon size={15} /> : <><PlayIcon size={14} /><span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12.5 }}>{pomoMin}m</span></>}</button>
          <button disabled={lenLocked || pomoMin >= 30} onMouseDown={() => beginHold(1)} onMouseUp={endHold} onMouseLeave={endHold} aria-label={lenLocked ? "length is locked while a pomodoro is running" : "longer - hold to speed up (max 30)"} style={{ width: 19, height: 19, padding: 0, borderRadius: 999, border: `1.5px solid ${C.ink}`, background: "transparent", color: C.ink, boxShadow: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: (lenLocked || pomoMin >= 30) ? 0.4 : 1, cursor: lenLocked ? "not-allowed" : "pointer" }}><PlusIcon size={10} /></button>
          {!running && !paused && !pauseActive && !finished && <button onClick={() => { tinyPrev.current = pomoMin; tinyRun.current = true; changePomo(5); onStart(task); }} aria-label="tiny start: five quiet minutes with no feeling rating needed; if flow catches you can extend to the full beat at the end" style={{ height: 24, padding: "0 8px", borderRadius: 999, border: "1.5px solid transparent", background: "#EAF3DE", color: C.muted, boxShadow: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11.5, fontFamily: "var(--fl-mono)", whiteSpace: "nowrap", gap: 3 }}><span style={{ color: C.better, display: "inline-flex" }}><SproutIcon size={13} /></span>5m</button>}
          <button onClick={onSurf} aria-label="an urge is here? open the surf: rate it, find it on the body, breathe, and decide after the wave" style={{ width: 24, height: 24, minWidth: 24, padding: 0, borderRadius: 999, border: "1.5px solid transparent", background: "#DCEAF6", color: "#3E78B2", boxShadow: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><SeaWaveIcon size={12} /></button>
          <button onClick={() => { resetTimer(); setTask(""); onPickTask && onPickTask(""); if (tinyPrev.current > 0) { changePomo(tinyPrev.current); tinyPrev.current = 0; } tinyRun.current = false; setTinyCarry(0); }} aria-label="reset" style={{ width: 24, height: 24, padding: 0, borderRadius: 999, border: `1.5px solid ${C.faint}`, background: "transparent", color: C.muted, boxShadow: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><RotateCcwIcon size={12} /></button>

        </div>
      </div>
      {finished && finishedTs != null && Date.now() - finishedTs > 120000 && (
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: C.muted }}>It finished while you were away ({agoText(finishedTs)}). Rate it when you're ready {"-"} it logs at its real end time.</p>
      )}
      {pauseActive && (
        <div style={{ marginBottom: 14, padding: 10, borderRadius: 8, background: C.paper, border: `1px solid ${C.faint}` }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: C.muted }}>Paused - why? Pick a tag; it's written to your note when you resume.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {pauseTags.length === 0 ? <span style={{ fontSize: 12, color: C.muted }}>No pause tags - add some in the Pause tab.</span> :
              pauseTags.map((pt: any) => {
                const on = pauseTag === pt.name;
                return <button key={pt.id} onClick={() => setPauseTag(on ? "" : pt.name)} style={{ padding: "5px 12px", borderRadius: 999, border: `${on ? 2 : 1.5}px solid ${catBorder(pt.category)}`, background: catColor(pt.category), color: C.ink, boxShadow: "none", fontWeight: on ? 700 : 500, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--fl-display)", whiteSpace: "normal", maxWidth: "100%", height: "auto", minHeight: 0, lineHeight: 1.35 }}>{on ? "✓ " : ""}{pt.name}</button>;
              })}
          </div>
        </div>
      )}

      {/* New order (feeling first, always): the required rating leads, the optional task
          link follows, and the floating-window toggle sits last. */}
      {!finished && <Scale label="Feeling" value={expected} onChange={setExpected} weather />}
      {!finished && whisper && <div style={{ fontSize: 11.5, color: C.muted, margin: "2px 0 10px" }}>{whisper}</div>}
      {/* The task picker stays visible in both phases - it's the page Act +1 writes to. */}
      <select value={task} onChange={(e) => { setTask(e.target.value); onPickTask && onPickTask(e.target.value); }} style={{ ...inputStyle, marginTop: 4, marginBottom: 12, padding: "10px 12px", lineHeight: 1.6, height: "auto", minHeight: 44 }}>
        <option value="">{tasks.length ? "Link a task (optional)" : "- no tasks (sync first) -"}</option>
        {task && !tasks.some((t: any) => t.task === task) && <option value={task}>{task}</option>}
        {tasks.map((t: any) => (<option key={t.task} value={t.task}>{t.task}{t.king ? " \u{1F451}" : ""}</option>))}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, fontSize: 12.5, color: C.muted, cursor: "pointer" }}>
        <input type="checkbox" checked={!!floatOn} onChange={(e) => setFloatOn(e.target.checked)} style={{ width: 15, height: 15, accentColor: C.ink, cursor: "pointer" }} />
        open floating window
      </label>

      {finished ? (
        /* ---------- AFTER the pomodoro: decide Done + next task first; the rating is the
             final tap - with auto-log on, it logs the moment you pick it. ---------- */
        <div style={{ marginTop: 4, padding: 14, borderRadius: 8, background: C.paper, border: `1px solid ${C.better}` }}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontFamily: "var(--fl-display)", color: C.ink }}>{"\u{1F389}"} Pomodoro done - how did it go?</p>
          {tinyRun.current && (() => { const more = Math.max(5, (tinyPrev.current || (settings.pomodoroMinutes || 25)) - pomoMin); return (
            <button onClick={() => { setTinyCarry(tinyCarry + pomoMin); tinyRun.current = false; changePomo(more); onStart(task); }} style={{ ...btn("#C57B5A"), width: "100%", padding: "9px", borderRadius: 999, marginBottom: 10, fontSize: 13 }}><span style={{ display: "inline-flex", marginRight: 6, verticalAlign: "middle" }}><SproutIcon size={14} /></span>{"flow caught: keep going " + more + "m (same beat, log at the end)"}</button>
          ); })()}
          {markDoneLabel}
          {chooseNextControls}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="quick note (optional)" style={{ ...inputStyle, marginBottom: 14, marginTop: 4 }} />
          <Scale label="after: how enjoyable was it actually?" value={act} onChange={rateActual} weather />
          <button onClick={submit} disabled={!act || !canLog}
            aria-label={!act ? "pick a rating first" : undefined}
            style={{ ...btn(C.ink), width: "100%", padding: "10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: (act && canLog) ? 1 : 0.5, cursor: (act && canLog) ? "pointer" : "not-allowed" }}>
            <img src={starImg} alt="" draggable={false} style={{ width: 16, height: 16 }} /> Light up a star in my Sky
          </button>
        </div>
      ) : (
        /* ---------- BEFORE the pomodoro: set the expectation, then start the timer ---------- */
        <div>
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
    </>
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
  // Quick-add: capture box state + the BIG TASK parent choices discovered at sync (Guess 🏔️).
  const [quickParents, setQuickParents] = useState<any[]>(init.quickParents || []);
  // "Done today" pile: finished tasks crystallize here (restorable) instead of vanishing.
  const [doneToday, setDoneToday] = useState<any[]>(init.doneToday || []);
  const [doneOpen, setDoneOpen] = useState(false);
  const [qaName, setQaName] = useState("");
  const [qaOpen, setQaOpen] = useState(false);            // the Project card's capture form, folded behind the (+)
  const [qaStatus, setQaStatus] = useState("Exploring");  // Exploring | Executing, chosen as bare icons
  const [qaParent, setQaParent] = useState("");
  const [qaGuess, setQaGuess] = useState("1");
  const [qaBusy, setQaBusy] = useState(false);
  // Back door: claim work done off the timer. Recorded with a mark, counted like the rest.
  const [claimOpen, setClaimOpen] = useState(false);
  const [clTask, setClTask] = useState("");
  const [clStart, setClStart] = useState("");
  const [clEnd, setClEnd] = useState("");
  const [clAnchor, setClAnchor] = useState<"start" | "end">("end");
  const [clBusy, setClBusy] = useState(false);
  const [clParent, setClParent] = useState("");
  const [clGuess, setClGuess] = useState("1");
  const [clCreating, setClCreating] = useState(false);
  const [clMealEdits, setClMealEdits] = useState<any>({});
  // A fresh claim opens as "one pomodoro ending now": end = now, start = 25 minutes ago.
  // Editing a field makes it the anchor the tomato chips complete FROM.
  useEffect(() => {
    if (!claimOpen) return;
    const d = new Date();
    const nt = d.getHours() * 60 + d.getMinutes();
    const clk = (m: number) => { const v = ((m % 1440) + 1440) % 1440; return String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0"); };
    setClEnd(clk(nt)); setClStart(clk(nt - 25)); setClAnchor("end"); setClMealEdits({});
  }, [claimOpen]);
  const [surfCount, setSurfCount] = useState<{ left: number; task: string } | null>(null);
  const [urges, setUrges] = useState<any[]>(init.urgesSurfed || []);
  // The guided urge surf (panel-only): one entry per wave, with the intensity curve, body
  // spots, mood words and the outcome. The float keeps its quick 90-second wave.
  const [surfOpen, setSurfOpen] = useState(false);
  const [surf, setSurf] = useState<any>(null);
  // Body / Emotions share one pane, so the note and the three decisions sit near the top
  // of the dialog instead of below two full-height sections.
  const [surfTab, setSurfTab] = useState<"wave" | "body" | "mood">("wave");
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => { if (!surfOpen) return; const iv = window.setInterval(() => setNowTick(Date.now()), 1000); return () => window.clearInterval(iv); }, [surfOpen]);
  const [pending, setPending] = useState<any[]>(init.pending);
  const [doneSess, setDoneSess] = useState<any>({});
  const [view, setView] = useState("log");
  // Status view bundles the old week/month/totals; its right-side vertical control picks the sub-view.
  const [calibSub, setCalibSub] = useState("today");
  const [skyMode, setSkyMode] = useState<"pomodoro" | "wave">("pomodoro");
  // The day-mode split button's dropdown: open on click, closed by picking, clicking
  // anywhere else, or Escape.
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  useEffect(() => {
    if (!modeMenuOpen) return;
    const onDown = (e: any) => { if (!(e.target instanceof Element && e.target.closest("[data-modemenu]"))) setModeMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModeMenuOpen(false); };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown, true); document.removeEventListener("keydown", onKey); };
  }, [modeMenuOpen]);
  const [historySub, setHistorySub] = useState("calib");
  // The daily note focused in the workspace (ms timestamp), null when none: drives the calendar outline.
  const [activeDaily, setActiveDaily] = useState<number | null>(api.getActiveDaily ? api.getActiveDaily() : null);
  useEffect(() => { if (!api.onActiveDaily) return; return api.onActiveDaily((ts: number | null) => setActiveDaily(ts)); }, []);
  const [preset, setPreset] = useState("");
  const [monthOff, setMonthOff] = useState(0);
  const [todayFlash, setTodayFlash] = useState(false);   // brief pill behind TODAY confirming the click
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
  }, [view]);
  const [sync, setSync] = useState("idle");
  const [pendingSyncRebuild, setPendingSyncRebuild] = useState(false); // sync also rebuilds the timeline (subsumes the old restart), deferred until the fresh tasks land in state
  const [flash, setFlash] = useState("");
  // The banner announces a sync (or pending Notion writes); it should inform, not linger.
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(""), 60000);
    return () => window.clearTimeout(t);
  }, [flash]);
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
  // Display order: pinned first (in the sequence they were locked), then King, then the
  // urgency tiers Must - Aim - Bonus. Drags rearrange freely INSIDE a tier (the arrival
  // index is still the tiebreak); the tiers themselves hold.
  const tierOf = (t: any) => (frozenNames.includes(t.task) ? 0 : t.king ? 1 : t.power === "P" ? 2 : t.power === "G" ? 4 : 3);
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
  // Per-task visibility, keyed by NAME so it survives Notion's daily re-created pages.
  // Bonus-If-Done rows start hidden (a setting can turn that off); each task's own eye
  // overrides in either direction.
  const [hiddenNames, setHiddenNames] = useState<string[]>(Array.isArray(settings.hiddenTaskNames) ? settings.hiddenTaskNames : []);
  const [shownNames, setShownNames] = useState<string[]>(Array.isArray(settings.shownTaskNames) ? settings.shownTaskNames : []);
  const [showHidden, setShowHidden] = useState(false);   // the header eye: reveal hidden rows, dimmed
  // Hidden: named by hand, a bonus task (unless the setting shows them), or a BIG TASK
  // (the Guess mountain) whose real work lives in its sub-tasks. The eye reveals any of them.
  const isTaskHidden = (t: any) => hiddenNames.includes(t.task) || ((!!t.big || (settings.hideBonusByDefault !== false && t.power === "G")) && !shownNames.includes(t.task));
  const toggleTaskHidden = (t: any) => {
    if (isTaskHidden(t)) {
      const h = hiddenNames.filter((n) => n !== t.task);
      setHiddenNames(h);
      let s = shownNames;
      if ((!!t.big || (settings.hideBonusByDefault !== false && t.power === "G")) && !s.includes(t.task)) { s = [...s, t.task]; setShownNames(s); }
      api.patchSettings && api.patchSettings({ hiddenTaskNames: h, shownTaskNames: s });
    } else {
      const h = [...hiddenNames, t.task];
      const s = shownNames.filter((n) => n !== t.task);
      setHiddenNames(h); setShownNames(s);
      api.patchSettings && api.patchSettings({ hiddenTaskNames: h, shownTaskNames: s });
    }
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
  // Pill interactions: a long-press or double-click "arms" a pill (edit + delete icons show);
  // the pending-click timer is what tells a plain tick apart from the first half of a double.
  const [armedRoutineId, setArmedRoutineId] = useState<string | null>(null);
  const [addingRoutine, setAddingRoutine] = useState<string | null>(null);   // which routine's add pill is an open input
  const routineHold = useRef<number | null>(null);
  const routineHoldFired = useRef(false);
  const routineClickPend = useRef<{ id: string; t: number } | null>(null);
  const editRoutineWhich = useRef("morning");
  // One outside-click brain for the pills, in capture phase so it runs before the click lands:
  // an armed pill disarms, an open editor SAVES (the back arrow inside it is the only way out
  // without saving), and an open add pill commits whatever was typed.
  useEffect(() => {
    if (!armedRoutineId && !editRoutineId && addingRoutine == null) return;
    const onDown = (e: any) => {
      const host = e.target instanceof Element ? e.target.closest("[data-rpill]") : null;
      const key = host ? host.getAttribute("data-rpill") : null;
      if (editRoutineId && key !== "edit:" + editRoutineId) saveEditRoutine(editRoutineWhich.current);
      if (armedRoutineId && key !== "armed:" + armedRoutineId) setArmedRoutineId(null);
      if (addingRoutine != null && key !== "add:" + addingRoutine) {
        const v = (addingRoutine === "morning" ? newMorning : newNight).trim();
        if (v) addRoutine(addingRoutine);
        setAddingRoutine(null);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [armedRoutineId, editRoutineId, addingRoutine, editRoutineName, editRoutineDur, newMorning, newNight]);
  // How many pomodoros still fit between now and the night routine, once meals, short breaks
  // and the long break every N are taken out of it. A ceiling, not a target: it answers "how
  // much room is left" without saying which task belongs in which slot. The window is the two
  // My-day settings: it opens when the morning routine ends and shuts when the night one starts.
  const pomosLeftToday = (() => {
    const dayStart = settings.dayStart ?? 240;
    const band = (m: number) => (m < dayStart ? m + 1440 : m);
    const pomo = Math.max(1, settings.pomodoroMinutes ?? 25);
    const shortB = Math.max(0, settings.breakMinutes ?? 5);
    const longB = Math.max(0, settings.longBreakMinutes ?? 20);
    const every = Math.max(1, settings.longBreakEvery ?? 3);
    const d = new Date();
    let t = Math.max(band(d.getHours() * 60 + d.getMinutes()), band(settings.morningRoutineEnds ?? 540));
    const end = band(settings.nightRoutineStarts ?? 1215);
    const meals: any[] = [];
    if (settings.lunchEnabled) { const s = band(settings.lunchStart ?? 750); meals.push({ s, e: s + (settings.lunchMinutes ?? 45) }); }
    if (settings.dinnerEnabled) { const s = band(settings.dinnerStart ?? 1110); meals.push({ s, e: s + (settings.dinnerMinutes ?? 45) }); }
    let n = 0, sinceLong = 0, guard = 0;
    while (guard++ < 400) {
      // A meal the pomodoro would run into pushes it past, and counts as a rest.
      let moved = false;
      for (const m of meals) if (t < m.e && t + pomo > m.s) { t = m.e; sinceLong = 0; moved = true; }
      if (moved) continue;
      if (t + pomo > end) break;
      n++; t += pomo; sinceLong++;
      if (t >= end) break;
      const isLong = sinceLong >= every;
      t += isLong ? longB : shortB;
      if (isLong) sinceLong = 0;
    }
    return n;
  })();
  // Timeline (daily plan): timelineMode swaps the today list for the time axis.
  const [timelineMode, setTimelineModeState] = useState(false);
  const [plans, setPlans] = useState<any>(init.plans || {});
  const [tlDrag, setTlDrag] = useState<{ id: string; grab: number; button: number; y: number; tlTop: number; downY?: number } | null>(null);
  // Timeline undo: a stack of up to three day-photos, pushed by setTodayBlocks itself, so EVERY
  // user edit (drags, auto-fix, add/delete/edit/duplicate, lock, pin release) is one undo step.
  // System writes (sync rebuild, routine mirroring, settings re-flow, the undo restore) pass
  // silent=true, so a step is always something the user did on the timeline.
  const [planUndo, setPlanUndo] = useState<any[][]>([]);
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
  const [foldedHistory, setFoldedHistory] = useState<Set<string>>(new Set());
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
        <button onClick={() => { setEditTagId(t.id); setEditTagName(t.name); setEditTagCat(cat); }} className="fl-rowact fl-collapse" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
        <button onClick={() => removePauseTag(t.id)} className="fl-rowact fl-rowdel fl-collapse" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
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
  if (timer.running || timer.adopted) sawRun.current = true;   // adopted-from-disk counts as seen live
  useEffect(() => { if (sawRun.current && (timer.running || timer.paused || (timer.adopted && timer.startedAt != null)) && timer.taskName) setPreset(timer.taskName); }, [timer.taskName, timer.running, timer.paused]);
  const pomoMin = timer.lengthMin;
  const lenLocked = timer.running || timer.paused; // freeze −/+ while a pomodoro is active
  // Pause-with-reason state is owned by the engine (shared with the floating window);
  // the engine writes the pause event + daily-note block itself on resume/log/reset.
  const pauseActive = timer.pauseStart != null;
  const pauseTag = timer.pauseTag || "";
  const setPauseTag = (t: string) => api.timer.setPauseTag(t);
  const [calibrations, setCalibrations] = useState<any[]>(init.calibrations || []);
  const [cuEdit, setCuEdit] = useState<{ id: any; v: string } | null>(null);   // the catch-up row being named
  const [calibDraft, setCalibDraft] = useState<any>(null);   // the "+ 🍅" / finished-early popup model
  const [areaOptions, setAreaOptions] = useState<string[]>(init.areaOptions || []);   // Notion Area options for the add-block dropdown
  const feelingWords = init.feelings && Object.keys(init.feelings).length ? init.feelings : {};

  const resetTimer = () => api.timer.reset();
  // Restarting a LIVE pomodoro is a fork in the day ("this isn't what I want to be doing").
  // The HARD 5-second countdown is owned by the plugin core, so the float mirrors it on its
  // own face and cancel on either surface cancels both. Expiry lands here via onSurfGo.
  // Only manual reset buttons take this path; logging and next-task handoffs reset silently.
  const restartTimer = () => {
    const live = running || timer.paused;
    const tname = timer.task || preset;
    resetTimer();
    if (live && api.beginSurfCountdown) api.beginSurfCountdown(tname || "");
  };
  useEffect(() => {
    if (api.onSurfCount) api.onSurfCount((st: any) => setSurfCount(st));
    if (api.onUrgeSurfed) api.onUrgeSurfed((arr: any[]) => setUrges([...(arr || [])]));
    // (see also the anchor-prompt interval below)
    // The core hands back the task that was interrupted, so the wave opens named even though
    // the timer has already been reset out from under it.
    if (api.onSurfGo) api.onSurfGo((task: string) => openSurf(task));
  }, []);
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
  // Background-noise choices live on the plugin core (the float edits them too); mirror
  // them here rather than reading api.settings, which patchSettings replaces.
  const [noise, setNoiseState] = useState<any>(() => (api.getNoise ? api.getNoise() : { focus: "off", break: "off", volume: 40 }));
  useEffect(() => {
    if (!api.onNoiseChange) return;
    return api.onNoiseChange(() => setNoiseState(api.getNoise ? { ...api.getNoise() } : { focus: "off", break: "off" }));
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
  const saveDone = (arr: any[]) => { setDoneToday(arr); api.saveDoneToday && api.saveDoneToday(arr); };

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
    try { const fresh = await api.sync(); setTasks(fresh); setDoneSess({}); setSync("ok"); setPendingSyncRebuild(true); if (api.getInitial) setAreaOptions(api.getInitial().areaOptions || []); if (api.getQuickParents) setQuickParents(api.getQuickParents()); const fids = new Set(fresh.map((t: any) => t.id)); setDoneToday((dp: any[]) => { const nd = dp.filter((e: any) => !fids.has(e.id)); if (nd.length !== dp.length && api.saveDoneToday) api.saveDoneToday(nd); return nd; }); setFlash(fresh.length + " tasks loaded from Notion; plan merged, your arrangement kept."); }
    catch (e: any) { setSync("error"); setFlash("Sync failed: " + (e?.message || e)); }
  };

  // ---------- Calibration (guess vs reality, blame-free) ----------
  // "Over": the task answered that it is bigger than it looked; adds a "+ 🍅" round to Notion's
  // Guess (max two, then split). "Under": finished early — a gift; nothing is written to Notion.
  const openOverCalib = (t: any) => {
    const rounds = (t.guessPlus || []).length;
    if (rounds >= 2) { api.notify && api.notify("Two extra rounds already: time to split this task.", 6000); return; }
    setCalibDraft({ mode: "over", pageId: t.id, task: t.task, hierarchy: hierarchyText(t), category: t.category || null, guess: t.pomodoros || 0, spend: t.act || 0, round: rounds + 1, count: 1, reason: "", note: "" });
  };
  const openUnderCalib = (t: any, spendOverride?: number) => {
    setCalibDraft({ mode: "under", pageId: t.id, task: t.task, hierarchy: hierarchyText(t), category: t.category || null, guess: t.pomodoros || 0, spend: spendOverride != null ? spendOverride : (t.act || 0), reason: "", note: "", spare: "" });
  };
  const saveCalibration = async () => {
    const d = calibDraft; if (!d || !d.reason) return;
    let round = d.round;
    if (d.mode === "over" && d.pageId && api.addGuessRound) {
      try { round = await api.addGuessRound(d.pageId, d.count || 1); }
      catch (e: any) { api.notify && api.notify("Could not add the + \u{1F345}: " + (e?.message || e), 6000); return; }
      const nt = tasks.map((t: any) => (t.id === d.pageId ? { ...t, guessPlus: [...(t.guessPlus || []), d.count || 1], pomodoros: (t.pomodoros || 0) + (d.count || 1) } : t));
      setTasks(nt); api.saveTasks && api.saveTasks(nt);
    }
    const entry = { id: Date.now(), ts: Date.now(), pageId: d.pageId || null, task: d.task, hierarchy: d.hierarchy || "", category: d.category || null, guess: d.guess, spend: d.spend, direction: d.mode, round: d.mode === "over" ? round : null, reason: d.reason, note: (d.note || "").trim(), spare: d.spare || null };
    const arr = [...calibrations, entry];
    setCalibrations(arr); api.saveCalibrations && api.saveCalibrations(arr);
    if (api.appendCalibration) { try { await api.appendCalibration(entry); } catch (e) {} }
    setCalibDraft(null);
    api.notify && api.notify(d.mode === "over" ? "+ \u{1F345} added and calibration saved." : "Calibration saved.", 4000);
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
    let newSpend: number | null = null;
    if (s.pageId) {
      try { const act = await api.writeAct(s.pageId); newSpend = act != null ? act : null; msg += " Spend" + (act != null ? " = " + act : " +1") + " written."; }
      catch (e: any) { savePending([...pending, { sessionId: s.id, pageId: s.pageId, task: s.task }]); msg += " Spend write queued."; }
    } else { msg += " No Notion page linked."; }
    if (markDone && s.pageId && api.setDone) {
      try {
        const meta = tasks.find((t) => t.id === s.pageId);
        const res: any = await api.setDone(s.pageId);
        const doneName = res && res.name ? res.name : res;
        const nt = tasks.filter((t) => t.id !== s.pageId);
        setTasks(nt); api.saveTasks(nt);
        msg += " Status set to " + doneName + ".";
        // Finishing CRYSTALLIZES instead of erasing: the task joins the local "Done today"
        // pile (restorable; sync reconciles it by id), its worked blocks stay struck-through
        // on the timeline, and only its unneeded FUTURE blocks are removed.
        if (meta) {
          const d0 = new Date();
          let nowTl0 = d0.getHours() * 60 + d0.getMinutes();
          const mid0 = (tlStart + tlEnd) / 2;
          if (Math.abs(nowTl0 + 1440 - mid0) < Math.abs(nowTl0 - mid0)) nowTl0 += 1440;
          const bl0 = todayBlocks();
          if (bl0.length) setTodayBlocks(bl0
            .filter((b: any) => !(b.kind === "task" && b.pageId === meta.id && !b.claimed && b.start >= nowTl0))
            .map((b: any) => (b.kind === "task" && b.pageId === meta.id ? { ...b, done: true, placed: true, created: b.created || Date.now() } : b)));
          const spendFinal = newSpend != null ? newSpend : (meta.act || 0) + 1;
          saveDone([...doneToday.filter((e: any) => e.id !== meta.id), { id: meta.id, task: meta.task, prevSchedule: res && res.prev ? res.prev : null, ts: Date.now(), spend: spendFinal, guess: meta.pomodoros || 0, meta: { ...meta, act: spendFinal } }]);
        }
        // Finished under the guess: offer the blame-free reflection (the spare tomato is a gift).
        const spendNow = newSpend != null ? newSpend : ((meta && meta.act) || 0) + 1;
        const target = (meta && meta.pomodoros) || 0;
        if (meta && target > 0 && spendNow < target) openUnderCalib(meta, spendNow);
        else if (meta && target > 0 && spendNow === target) {
          // Landed exactly on the guess: record it silently so the calibration score also
          // counts the quiet wins, not only the days the guess missed.
          const onEntry = { id: Date.now(), ts: Date.now(), pageId: meta.id || null, task: meta.task, hierarchy: hierarchyText(meta), category: meta.category || null, guess: target, spend: spendNow, direction: "on", round: null, reason: "on target", note: "", spare: null };
          const arr = [...calibrations, onEntry];
          setCalibrations(arr); api.saveCalibrations && api.saveCalibrations(arr);
        }
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
    const still: any[] = [], gone: any[] = [];
    for (const p of pending) {
      try { await api.writeAct(p.pageId); }
      catch (e: any) {
        // A dead target will never succeed (deleted or archived page, e.g. yesterday's
        // re-created daily task): drop it and say so, instead of a forever retry button.
        // The pomodoro itself is safe in the local log; only Notion's Spend misses one.
        const msg = String((e && e.message) || e || "");
        if (/Notion 404|object_not_found|Could not find|archived/i.test(msg)) gone.push(p); else still.push(p);
      }
    }
    savePending(still);
    const bits: string[] = [];
    if (gone.length) bits.push("Dropped " + gone.length + " write" + (gone.length > 1 ? "s" : "") + " to a deleted Notion page (" + gone.map((x: any) => x.task || "unknown task").join(", ") + "); the pomodoro stays in your local log.");
    if (still.length) bits.push(still.length + " still pending.");
    if (!bits.length) bits.push("All pending writes pushed.");
    setFlash(bits.join(" "));
  };

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
  // The evidence whisper (CBT restructuring with the user's own data): when the current
  // forecast is rainy (expected 1-2), quietly show how the last rainy forecasts actually
  // landed. No pep talk, no argument — just the history, at the moment of the prediction.
  const rainWhisper = (() => {
    const exp = timer.expected;
    if (!(exp >= 1 && exp <= 2)) return null;
    const past = sessions.filter((s: any) => s.expected >= 1 && s.expected <= 2 && s.actual >= 1).slice(-12);
    if (past.length < 3) return null;
    const sunnier = past.filter((s: any) => s.actual > s.expected).length;
    return "Your last " + past.length + " rainy forecasts: " + sunnier + " ended sunnier than expected.";
  })();
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
  // A logged pause stores only its tag NAME, so the category comes from the live tag list.
  const pauseCatOf = (name: any) => (pauseTags.find((t: any) => t.name === name) || {}).category;
  const tagColor = (n: any) => MACARON[tagIdx(n)].fill;
  const tagBorder = (n: any) => MACARON[tagIdx(n)].border;
  const openLog = (leafTask: string) => { setPreset(leafTask); setView("log"); };
  const openSurf = (taskName?: any) => { const seedTask = typeof taskName === "string" ? taskName : ""; setNowTick(Date.now()); setSurfTab("wave"); setSurf({ startTs: Date.now(), task: seedTask || timer.task || preset || "", curve: [], body: [], moods: [], note: "" }); setSurfOpen(true); };
  const finishSurf = (outcome: string) => {
    if (!surf) return;
    const entry = { id: surf.startTs, ts: surf.startTs, endTs: Date.now(), task: surf.task, curve: surf.curve, body: (surf.body || []).map((b: any) => ({ part: b.part, note: (b.note || "").trim() })), moods: surf.moods, note: (surf.note || "").trim(), outcome };
    const arr = [...urges, entry];
    setUrges(arr); api.saveUrges && api.saveUrges(arr);
    setSurfOpen(false); setSurf(null);
    if (outcome === "paused") { api.timer && api.timer.pause(); }
    if (outcome === "surfed") api.notify && api.notify("\u{1F30A} Surfed. It counts.");
    if (outcome === "acted") api.notify && api.notify("A deliberate yes after the wave is still a win.");
  };
  // Quick-add: one box that creates the Notion page (using the user's template presets), mirrors
  // it into the task list instantly, drops a placed 25-minute block at NOW on today's plan, and
  // arms the Focus form, so capturing a spontaneous task costs one Enter.
  const quickAdd = async () => {
    const name = qaName.trim();
    if (!name || qaBusy || !api.createTask) return;
    setQaBusy(true);
    try {
      const g = Math.max(0, Math.min(4, Math.round(Number(qaGuess) || 0)));
      const t = await api.createTask(name, qaParent || null, g, qaStatus);
      // The point of saving is to SEE it land: mirror instantly, fold the form, then run
      // the standard sync so the row arrives through the same door as every other task.
      setTasks((prev: any[]) => [t, ...prev]);
      setQaName("");
      setQaOpen(false);
      api.notify && api.notify('"' + t.task + '" is in Notion.');
      await doSync();
    } catch (e) {
      api.notify && api.notify("Could not create the task in Notion. Check the token and database in settings.");
    }
    setQaBusy(false);
  };
  // Tomato conversion for claims, counting the breaks a real run would have contained (the
  // user's formula): t(n) = n·pomodoro + (n-1)·short break + one long break. Pick the n whose
  // t(n) lies nearest the claimed minutes; ties go DOWN (when unsure, claim the smaller number).
  const tomatoesFor = (mins: number) => {
    const pomo = settings.pomodoroMinutes || 25;
    const sb = settings.breakMinutes || 5;
    const lb = settings.longBreakMinutes || 20;
    let best = 1, bestD = Infinity;
    for (let k = 1; k <= 40; k++) {
      const t = k * pomo + (k - 1) * sb + lb;
      const d0 = Math.abs(t - mins);
      if (d0 < bestD) { bestD = d0; best = k; }
      if (t > mins + pomo + lb) break;
    }
    return best;
  };
  // Shared by the popup and doClaim: both claim times parsed into timeline minutes (banded
  // around now, so 23:50 during the overnight stretch means yesterday evening), plus the one
  // error that blocks the claim button. Claims are finished work: the span must sit wholly
  // in the past, start before end, at most 8 hours.
  const claimParse = () => {
    const d = new Date();
    let nt = d.getHours() * 60 + d.getMinutes();
    const mid = (tlStart + tlEnd) / 2;
    if (Math.abs(nt + 1440 - mid) < Math.abs(nt - mid)) nt += 1440;
    const parse = (s0: string) => { const m = (s0 || "").match(/^(\d{1,2}):(\d{2})$/); if (!m) return null; let v = Number(m[1]) * 60 + Number(m[2]); if (Math.abs(v + 1440 - nt) < Math.abs(v - nt)) v += 1440; return v; };
    const st0 = parse(clStart), en0 = parse(clEnd);
    const span = st0 != null && en0 != null ? en0 - st0 : null;
    const err = st0 == null || en0 == null ? "both times are needed"
      : en0 > nt ? "that ends in the future - claims are for finished work"
      : (span as number) <= 0 ? "the start needs to come before the end"
      : (span as number) > 480 ? "that is over 8 hours - claim it in smaller chunks"
      : "";
    return { nt, st0, en0, span, err };
  };
  // Claim finished work (the back door): a recorder, not a simulator. Spend and stars use the
  // rounded pomodoro count (min 1); the Timeline block keeps the REAL span; the live break
  // counter is never touched; everything claimed wears a mark so future-you knows the instrument.
  const doClaim = async () => {
    const name = clTask.trim();
    if (!name || clBusy) return;
    setClBusy(true);
    const cp = claimParse();
    if (cp.err || cp.st0 == null || cp.en0 == null) return;   // the popup names the problem
    const meta = tasks.find((t: any) => t.task === name) || null;
    const now = Date.now();
    const bl = todayBlocks();
    // The claim owns the exact span you typed: end from the popup (now by default), start
    // before it. Nothing auto-slides any more; a collision is an error to adjust around.
    const nowTl = cp.nt;
    const endTl = cp.en0 as number;
    const startTl = cp.st0 as number;
    const mins = endTl - startTl;
    // The MORNING routine and commitments cannot be worked through: refuse, log NOTHING.
    // Meals are different: the claim SPLITS around them (the popup fields give actual times).
    // The NIGHT routine is different too: it simply hasn't happened yet, so it is put off,
    // slid later past the pinned claim by resolveOverlaps, instead of blocking the claim.
    // Earlier claims block too: with explicit times, an overlap is an error, not a slide.
    const clash = bl.find((x: any) => (x.claimed || (x.kind === "routine" && !x.night) || x.kind === "meeting" || (x.kind === "task" && x.locked)) && x.start < endTl && x.start + x.dur > startTl);
    if (clash) {
      api.notify && api.notify("Nothing logged: that span overlaps “" + (clash.name || clash.kind) + "”. Adjust the time, or claim the chunks around it separately.", 8000);
      setClBusy(false);
      return;
    }
    const parseTlClock = (s0: string, ref: number) => {
      const m2 = (s0 || "").match(/^(\d{1,2}):(\d{2})$/);
      if (!m2) return null;
      let v = Number(m2[1]) * 60 + Number(m2[2]);
      if (Math.abs(v + 1440 - ref) < Math.abs(v - ref)) v += 1440;
      return v;
    };
    const mealsCovered = bl
      .filter((x: any) => x.kind === "meal" && x.start < endTl && x.start + x.dur > startTl)
      .map((x: any) => {
        const ed = clMealEdits[x.id] || {};
        const as0 = parseTlClock(ed.start, x.start);
        return { ...x, aStart: as0 != null ? as0 : x.start, aLen: Math.max(5, Math.min(240, Math.round(Number(ed.len)) || x.dur)) };
      })
      .sort((a: any, b: any) => a.aStart - b.aStart);
    // Carve the worked segments around the ACTUAL meal times; slivers under 3 min are dropped.
    let segs: { s: number; e: number }[] = [{ s: startTl, e: endTl }];
    for (const m3 of mealsCovered) {
      const out0: { s: number; e: number }[] = [];
      for (const g of segs) {
        const a = Math.max(g.s, m3.aStart), b2 = Math.min(g.e, m3.aStart + m3.aLen);
        if (b2 <= a) { out0.push(g); continue; }
        if (a - g.s >= 3) out0.push({ s: g.s, e: a });
        if (g.e - b2 >= 3) out0.push({ s: b2, e: g.e });
      }
      segs = out0;
    }
    if (!segs.length) {
      api.notify && api.notify("Nothing logged: after the meal there is no worked time left in that span.", 8000);
      setClBusy(false);
      return;
    }
    const workedMins = segs.reduce((s2, g) => s2 + (g.e - g.s), 0);
    // A chip-exact span claims its tomato count outright: clicking two tomatoes MEANS two.
    // Hand-edited spans keep the break-aware rounding, and a span carved by meals always
    // re-derives from the minutes actually worked.
    const sb0 = settings.breakMinutes || 5;
    const chipN = [1, 2, 3, 4].find((k) => k * 25 + (k - 1) * sb0 === mins) || 0;
    const n = !mealsCovered.length && chipN ? chipN : tomatoesFor(workedMins);
    const realTs = (tl: number) => now - (nowTl - tl) * 60000;
    // ONE session and ONE star per claim, however long: the stats and the Sky count deep-work
    // sittings, while Notion's Spend still receives the full rounded tomato count (n) so the
    // calibration data stays in real tomatoes.
    const newSess: any[] = [{ id: now, ts: realTs(segs[segs.length - 1].e), minutes: workedMins, task: name, hierarchy: meta ? hierarchyText(meta) : "", note: "", category: (meta && meta.category) || null, pageId: (meta && meta.id) || null, claimed: true }];
    persist([...sessions, ...newSess]);
    // The pips read "done today" from doneSess, so a claim must feed it in TOMATOES,
    // exactly like n live pomodoros would have.
    const dsKey = (meta && meta.id) || name;
    setDoneSess((m: any) => ({ ...m, [dsKey]: (m[dsKey] || 0) + n }));
    let msg = "Claimed: " + n + " \u{1F345} on “" + name + "”" + (mealsCovered.length ? " around " + mealsCovered.map((x: any) => x.name).join(" and ") : "") + ". It counts.";
    let newSpend: number | null = null;
    if (meta && meta.id && api.writeActBy) {
      try { newSpend = await api.writeActBy(meta.id, n); msg += " Spend = " + newSpend + "."; }
      catch (e) { const q = [...pending]; for (let i = 0; i < n; i++) q.push({ sessionId: now, pageId: meta.id, task: name }); savePending(q); msg += " Spend write queued."; }
      const finalAct = newSpend != null ? newSpend : ((meta.act || 0) + n);
      setTasks((prev: any[]) => prev.map((t: any) => (t.id === meta.id ? { ...t, act: finalAct } : t)));
    }
    if (bl.length) {
      const mealIds = new Set(mealsCovered.map((x: any) => x.id));
      const withMeals = bl.map((x: any) => { if (!mealIds.has(x.id)) return x; const mc: any = mealsCovered.find((y: any) => y.id === x.id); return { ...x, start: mc.aStart, dur: mc.aLen }; });
      const claimBlocks = segs.map((g, i) => ({ id: "cl" + now + "_" + i, kind: "task", pageId: (meta && meta.id) || undefined, name, power: (meta && meta.power) || "Y", status: meta ? meta.status : undefined, category: (meta && meta.category) || undefined, start: g.s, dur: g.e - g.s, created: now, placed: true, claimed: true }));
      // Put off the night routine EXPLICITLY: a night block starting exactly at the claim's own
      // start ties with it in resolveOverlaps' start-order walk and would slip through untouched,
      // leaving an overlap. The whole hit night group slides as one unit to after the claim,
      // keeping its internal spacing; resolveOverlaps then settles everything else.
      const nightHit = withMeals.filter((x: any) => x.kind === "routine" && x.night && x.start < endTl && x.start + x.dur > startTl);
      let shifted = withMeals;
      if (nightHit.length) {
        const m0 = Math.min(...nightHit.map((x: any) => x.start));
        const delta = endTl - m0;
        shifted = withMeals.map((x: any) => (x.kind === "routine" && x.night && x.start >= m0 ? { ...x, start: x.start + delta } : x));
      }
      setTodayBlocks(resolveOverlaps([...shifted, ...claimBlocks]));
    }
    if (api.appendDaily) {
      try {
        for (const g of segs) await api.appendDaily({ ts: realTs(g.e), minutes: Math.round(g.e - g.s), task: name, hierarchy: meta ? hierarchyText(meta) : "", note: "#FocusLog/claimed", category: (meta && meta.category) || null });
        msg += " Added to daily note.";
      } catch (e: any) { msg += " Daily note skipped: " + (e?.message || e); }
    }
    const starName = newestStarName(sessions.length + newSess.length);
    if (starName && api.notifyClickable) api.notifyClickable("You lit up " + starName + " ✨ (claimed). Click to see your Sky.", () => setView("sky"));
    setFlash(msg);
    setClaimOpen(false);
    setClBusy(false);
    // pushed past the guess? the same gentle, fully skippable reflection as a live pomodoro
    if (meta) {
      const target = meta.pomodoros || 0;
      const spendNow = newSpend != null ? newSpend : (meta.act || 0) + n;
      // pass the FRESH spend: meta is the pre-claim object, and the popup records its act
      if (target > 0 && spendNow > target) openOverCalib({ ...meta, act: spendNow });
    }
  };

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
        {!narrowPanel && <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: C.muted, minWidth: 48, textAlign: "right" }}>{a.lastUsed ? fmtDate(a.lastUsed) : "-"}</span>}
        <button onClick={(e) => { e.stopPropagation(); startEditAct(a); }} className="fl-rowact fl-collapse" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
        <button onClick={(e) => { e.stopPropagation(); removeActivity(a.id); }} className="fl-rowact fl-rowdel fl-collapse" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
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
    // Latest saved calibration per "+" round (and the finished-early one) feed the pip tooltips.
    const overInfo = [1, 2].map((r) => { const e = [...calibrations].reverse().find((c: any) => c.pageId === t.id && c.direction === "over" && c.round === r); return e ? e.reason + (e.note ? ": " + e.note : "") : null; });
    const underCal = [...calibrations].reverse().find((c: any) => c.pageId === t.id && c.direction === "under");
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
          <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, lineHeight: 1.3, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 6, rowGap: 2 }}>{t.status === "exploring" ? <span style={{ color: MODE_COLORS.relax.solid, display: "inline-flex", flexShrink: 0 }} aria-label="Exploring"><ExploreIcon size={13} /></span> : t.status === "executing" ? <span style={{ color: MODE_COLORS.work.solid, display: "inline-flex", flexShrink: 0 }} aria-label="Executing"><HammerIcon size={13} /></span> : null}{cat &&<span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: personal ? TAG_COFFEE.personal.text : TAG_COFFEE.project.text, background: personal ? TAG_COFFEE.personal.bg : TAG_COFFEE.project.bg, border: `1px solid ${personal ? TAG_COFFEE.personal.border : TAG_COFFEE.project.border}`, borderRadius: 999, height: 16, boxSizing: "border-box", display: "inline-flex", alignItems: "center", padding: "0 7px", whiteSpace: "nowrap", flexShrink: 0 }}>{cat}</span>}<span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{titleText}</span>{t.king ? <img src={crownImg} alt="king" draggable={false} style={{ width: 13, height: 13, flexShrink: 0 }} /> : null}</div>
          {hier && <div style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hier}</div>}
        </div>
        <button onClick={() => togglePersonal(t.task)} className="fl-rowact fl-collapse" aria-label={personal ? "move to Project" : "move to Personal"} style={ICON_BTN}>{personal ? <BriefcaseIcon size={14} /> : <UserIcon size={14} />}</button>
        {t.id && <button onClick={() => openOverCalib(t)} className="fl-rowact fl-collapse" aria-label="the task grew: add a + tomato round (max two, then split)" style={{ ...ICON_BTN, fontSize: 12, whiteSpace: "nowrap" }}>{"+\u{1F345}"}</button>}
        <button onClick={() => toggleTaskHidden(t)} className="fl-rowact fl-collapse" aria-label={isTaskHidden(t) ? "show this task again" : "hide this task (the header eye can reveal it)"} style={ICON_BTN}>{isTaskHidden(t) ? <EyeIcon size={14} /> : <EyeCrossedIcon size={14} />}</button>
                <button onClick={() => openLog(t.task)} className="fl-rowact fl-collapse" aria-label="run a pomodoro" style={ICON_BTN}><PlayIcon size={14} /></button>
        <button
          onClick={() => toggleFreeze(t.task)}
          className={"fl-lock" + (isFrozen ? " is-locked" : "")}
          aria-label={isFrozen ? "unpin from the top" : "pin to the top (by name, so it survives daily re-created Notion tasks)"}
          style={{ background: "transparent", border: "none", boxShadow: "none", height: "auto", cursor: "pointer", padding: 2, color: isFrozen ? C.ink : C.muted, flexShrink: 0, display: "inline-flex" }}
        >
          <BookmarkIcon size={13} filled={isFrozen} />
        </button>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }} aria-label={`${completed} of ${est} done for this task`}>
          <TomatoPips vivid={done} grey={remaining} base={t.guessBase} plus={t.guessPlus} overInfo={overInfo} underInfo={underCal ? underCal.reason + (underCal.note ? ": " + underCal.note : "") : null} onGrey={t.id ? () => openUnderCalib(t) : undefined} />
        </div>
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
  const setDayModeTo = (next: "work" | "relax") => { if (next === dayMode) return; const obj = { ...modeOverride, [todayKey]: next }; setModeOverride(obj); api.saveModeOverride && api.saveModeOverride(obj); };
  const activeMorning = dayMode === "relax" ? relaxMorning : morningRoutine;
  const activeNight = dayMode === "relax" ? relaxNight : nightRoutine;
  const isRoutineDone = (id: string) => (routineDone[todayKey] || []).includes(id);
  const morningPromptDay = useRef("");
  const toggleRoutineDone = (id: string) => {
    const cur = routineDone[todayKey] || [];
    const turningOn = !cur.includes(id);
    const nextList = turningOn ? [...cur, id] : cur.filter((x: string) => x !== id);
    const next = { ...routineDone, [todayKey]: nextList };
    setRoutineDone(next);
    api.saveRoutineDone && api.saveRoutineDone(next);
    // Anchor prompt (after X, do Y): the moment the LAST morning step is ticked, offer the
    // day's first beat. Once per day, and only while the engine is fully idle.
    if (turningOn && morningPromptDay.current !== todayKey && activeMorning.length > 0 && activeMorning.some((x: any) => x.id === id) && activeMorning.every((x: any) => nextList.includes(x.id)) && !running && !timer.paused && !timer.breakActive && api.notifyClickable) {
      morningPromptDay.current = todayKey;
      api.notifyClickable("Morning routine done ✨ Feel, then start the first beat?", () => setView("log"));
    }
  };
  const routineSaver = (which: string) => (dayMode === "relax" ? (which === "morning" ? saveRelaxMorning : saveRelaxNight) : (which === "morning" ? saveMorning : saveNight));
  const routineList = (which: string) => (which === "morning" ? activeMorning : activeNight);
  // Keep the timeline's routine blocks in step with the Tasks-view lists the moment a step is
  // added, removed or reordered: regroup the new list and rebuild that routine's blocks in place.
  // The first group keeps its old start, the rest chain after; auto-fix re-flows the day around them.
  const refreshRoutineBlocks = (which: string, list: any[]) => {
    const tb = todayBlocks();
    const isMine = (b: any) => b.kind === "routine" && (which === "night" ? !!b.night : !b.night);
    const olds = tb.filter(isMine).sort((a: any, b: any) => a.start - b.start);
    if (!olds.length) return;   // that routine isn't on today's plan
    const groups = groupRoutine(list, settings.routineGroupMinutes || 25);
    let t = olds[0].start;
    const fresh: any[] = groups.map((g: any, gi: number) => {
      const start = Math.max(olds[gi] ? olds[gi].start : t, t);
      const blk: any = { id: "r" + Date.now() + "_" + gi, kind: "routine", name: routineGroupName(which, gi, groups.length), start, dur: g.dur, refIds: g.steps.map((x: any) => x.id), steps: g.steps.map((x: any) => x.name) };
      if (which === "night") blk.night = true;
      t = start + g.dur;
      return blk;
    });
    setTodayBlocks(autoBreaksOf([...tb.filter((b: any) => !isMine(b)), ...fresh]), true);
  };
  const addRoutine = (which: string) => {
    const name = (which === "morning" ? newMorning : newNight).trim();
    if (!name) return;
    const next = [...routineList(which), { id: "r" + Date.now(), name, pomo: routineGroupCount(which) - 1 }];
    routineSaver(which)(next);
    refreshRoutineBlocks(which, next);
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
    })), true);
    setEditRoutineId(null);
  };
  const removeRoutine = (which: string, id: string) => { const next = routineList(which).filter((x: any) => x.id !== id); routineSaver(which)(next); refreshRoutineBlocks(which, next); };
  const moveRoutine = (which: string, from: number, to: number, grp?: number) => {
    const list = routineList(which);
    const effOf: any = {};
    groupRoutineByPomo(list, which).forEach((g: any, gi: number) => g.steps.forEach((s: any) => { effOf[s.id] = gi; }));
    if (from === to && (grp == null || (list[from] && effOf[list[from].id] === grp))) return;
    // Materialize every stamp before the move, so a drag never re-seats unstamped neighbours.
    const a = list.map((x: any) => ({ ...x, pomo: effOf[x.id] }));
    const [m] = a.splice(from, 1);
    if (grp != null) m.pomo = grp;
    a.splice(to, 0, m);
    routineSaver(which)(a);
    refreshRoutineBlocks(which, a);
  };
  const renderRoutineBlock = (which: string, hideHeader?: boolean) => {
    const list = routineList(which);
    const relax = dayMode === "relax";
    const label = which === "morning" ? <><SectionIcon src={roosterImg} /> Morning</> : <><SectionIcon src={batImg} /> Night</>;
    const newVal = which === "morning" ? newMorning : newNight;
    const setNewVal = which === "morning" ? setNewMorning : setNewNight;
    const theme = ROUTINE_THEME[which];
    const tick = relax ? C.better : MODE_COLORS.work.solid;
    const addLabel = which === "morning" ? "add a morning step" : "add a night step";
    const clearHold = () => { if (routineHold.current) { window.clearTimeout(routineHold.current); routineHold.current = null; } };
    // The add pill lives at the tail of the LAST group (or stands alone when the list is
    // empty / the last group is folded). Click = an inline input; Enter chains more adds;
    // clicking anywhere else commits whatever is typed (the document listener).
    const addPill = addingRoutine === which ? (
      <span key="add" data-rpill={"add:" + which} style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 999, border: `1.5px dashed ${theme.bar}`, background: C.paper }}>
        <input autoFocus value={newVal} onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addRoutine(which); if (e.key === "Escape") { setNewVal(""); setAddingRoutine(null); } }}
          placeholder={addLabel} aria-label={addLabel}
          style={{ width: 150, border: "none", boxShadow: "none", outline: "none", background: "transparent", color: C.ink, fontSize: 12.5, fontFamily: "var(--fl-display)", padding: 0 }} />
      </span>
    ) : (
      <button key="add" onClick={() => setAddingRoutine(which)} aria-label={addLabel}
        onDragOver={(e) => { e.preventDefault(); if (!routineOver || routineOver.w !== which || routineOver.i !== list.length) setRoutineOver({ w: which, i: list.length }); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (routineDrag && routineDrag.w === which) moveRoutine(which, routineDrag.i, list.length, routineGroupCount(which) - 1); setRoutineDrag(null); setRoutineOver(null); }}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", height: "auto", borderRadius: 999, border: `1.5px dashed ${C.faint}`, background: "transparent", color: C.muted, boxShadow: "none", fontSize: 12.5, fontFamily: "var(--fl-display)", cursor: "pointer" }}>+ {addLabel}</button>
    );
    const renderPill = (it: any, i: number, gi: number) => {
      const done = isRoutineDone(it.id);
      const dragging = !!routineDrag && routineDrag.w === which && routineDrag.i === i;
      const over = !!routineOver && routineOver.w === which && routineOver.i === i && !!routineDrag && !dragging;
      if (editRoutineId === it.id) {
        // Editing in place: the back arrow leaves without saving; Enter, or a click anywhere
        // outside the pill, keeps the change (the document listener does that part).
        return (
          <span key={it.id} data-rpill={"edit:" + it.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px 4px 12px", borderRadius: 999, border: `1.5px solid ${C.ink}`, background: C.card }}>
            <input autoFocus value={editRoutineName} onChange={(e) => setEditRoutineName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEditRoutine(which); if (e.key === "Escape") setEditRoutineId(null); }}
              aria-label="rename this step (Enter or a click elsewhere saves; the arrow goes back without saving)"
              style={{ width: Math.max(70, Math.min(220, editRoutineName.length * 7 + 24)), border: "none", boxShadow: "none", outline: "none", background: "transparent", color: C.ink, fontSize: 12.5, fontFamily: "var(--fl-display)", padding: 0 }} />
            <button onClick={() => setEditRoutineId(null)} aria-label="go back without saving" style={{ ...ICON_BTN, padding: 0 }}><Undo2Icon size={13} /></button>
          </span>
        );
      }
      const armed = armedRoutineId === it.id;
      return (
        <span key={it.id} data-rpill={"armed:" + it.id} draggable={!armed}
          onDragStart={(e) => { clearHold(); setRoutineDrag({ w: which, i }); e.dataTransfer.effectAllowed = "move"; }}
          onDragEnd={() => { setRoutineDrag(null); setRoutineOver(null); }}
          onDragOver={(e) => { e.preventDefault(); if (!routineOver || routineOver.w !== which || routineOver.i !== i) setRoutineOver({ w: which, i }); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (routineDrag && routineDrag.w === which) moveRoutine(which, routineDrag.i, i, gi); setRoutineDrag(null); setRoutineOver(null); }}
          onPointerDown={() => { routineHoldFired.current = false; clearHold(); routineHold.current = window.setTimeout(() => { routineHold.current = null; routineHoldFired.current = true; setArmedRoutineId(it.id); }, 500); }}
          onPointerUp={clearHold} onPointerLeave={clearHold} onPointerCancel={clearHold}
          onClick={() => {
            if (routineHoldFired.current) { routineHoldFired.current = false; return; }   // the click that ends a long-press
            if (armed) return;                                                            // the icons own an armed pill's clicks
            const pend = routineClickPend.current;
            if (pend && pend.id === it.id) { window.clearTimeout(pend.t); routineClickPend.current = null; setArmedRoutineId(it.id); return; }   // double click
            if (pend) { window.clearTimeout(pend.t); routineClickPend.current = null; toggleRoutineDone(pend.id); }   // a stray pending tick on another pill
            routineClickPend.current = { id: it.id, t: window.setTimeout(() => { routineClickPend.current = null; toggleRoutineDone(it.id); }, 260) };
          }}
          role="button" aria-label={it.name + (done ? " - done." : ".") + " Click to tick it off; hold or double-click for edit and delete; drag to rearrange"}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontFamily: "var(--fl-display)", background: armed ? C.card : theme[relax ? "relax" : "work"], border: `1.5px solid ${armed ? C.ink : theme.bar}`, color: done ? C.muted : C.ink, opacity: dragging ? 0.4 : 1, boxShadow: over ? `-3px 0 0 0 ${C.ink}` : "none", cursor: "pointer", userSelect: "none", maxWidth: "100%" }}>
          {done && <span style={{ color: tick, display: "inline-flex", flexShrink: 0 }}><CheckIcon size={11} /></span>}
          <span style={{ textDecoration: done ? "line-through" : "none", overflowWrap: "anywhere", minWidth: 0 }}>{it.name}</span>
          {armed && <>
            <button onClick={(e) => { e.stopPropagation(); setEditRoutineId(it.id); setEditRoutineName(it.name); setEditRoutineDur(it.dur || ROUTINE_MIN); editRoutineWhich.current = which; setArmedRoutineId(null); }} aria-label="edit" style={{ ...ICON_BTN, padding: 0 }}><PencilIcon size={13} /></button>
            <button onClick={(e) => { e.stopPropagation(); setArmedRoutineId(null); removeRoutine(which, it.id); }} aria-label="delete" style={{ ...ICON_BTN, padding: 0, color: "#C06A57" }}><TrashIcon size={13} /></button>
          </>}
        </span>
      );
    };
    return (
      <div>
        {!hideHeader && <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 10px" }}>{label}</h3>}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(() => {
          // Declared sessions: exactly N groups (the My day pomodoro settings), steps seated
          // by their `pomo` stamp. Every session's row is a drop target, so a pill can move
          // between sessions freely; an empty session shows a dashed slot during a drag.
          const groups = groupRoutineByPomo(list, which);
          if (!list.length) return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{addPill}</div>;
          const idxOf: any = {}; list.forEach((x: any, i: number) => { idxOf[x.id] = i; });
          const effOf: any = {}; groups.forEach((g: any, gi: number) => g.steps.forEach((s: any) => { effOf[s.id] = gi; }));
          // Appending to a session inserts after the last step of any session up to it.
          const endIdx = (gi: number) => { let at = 0; list.forEach((x: any, i: number) => { if (effOf[x.id] <= gi) at = i + 1; }); return at; };
          return groups.map((g: any, gi: number) => {
            const gname = routineGroupName(which, gi, groups.length);
            const gDone = g.steps.length > 0 && g.steps.every((it: any) => isRoutineDone(it.id));
            const last = gi === groups.length - 1;
            const dropHint = !g.steps.length && !last && !!routineDrag && routineDrag.w === which;
            // Pills carry their own done state, so a finished group just strikes its name.
            return (
              <React.Fragment key={"g" + gi}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: gi ? 8 : 0, padding: "0 2px" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, fontFamily: "var(--fl-display)", textDecoration: gDone ? "line-through" : "none" }}>{gname}</span>
                  {gDone
                    ? <span aria-label={`"${gname}" is finished`} style={{ width: 20, height: 20, minWidth: 20, borderRadius: 999, background: "rgb(144, 213, 144)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CheckSolidIcon size={10} /></span>
                    : <button onClick={() => openLog(gname)} aria-label={`run "${gname}" as one pomodoro`} style={{ width: 20, height: 20, minWidth: 20, padding: 0, borderRadius: 999, border: "none", boxShadow: "none", background: relax ? MODE_COLORS.relax.solid : MODE_COLORS.work.solid, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><PlayIcon size={10} /></button>}
                </div>
                <div onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (routineDrag && routineDrag.w === which) moveRoutine(which, routineDrag.i, endIdx(gi), gi); setRoutineDrag(null); setRoutineOver(null); }}
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "2px 0 0 14px", minHeight: g.steps.length || last ? undefined : 24, border: dropHint ? `1.5px dashed ${C.faint}` : "none", borderRadius: 999, marginLeft: dropHint ? 14 : 0, paddingLeft: dropHint ? 0 : 14 }}>
                  {g.steps.map((it: any) => renderPill(it, idxOf[it.id], gi))}
                  {last && addPill}
                </div>
              </React.Fragment>
            );
          });
          })()}
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
      const h = b.kind === "break" ? SHORT_BREAK_H : b.kind === "longbreak" ? LONG_BREAK_H : (b.kind === "meal" || b.claimed || (b.kind === "task" && !b.pageId)) ? Math.max(MIN_BLOCK_H, 25 * PX_PER_MIN) : Math.max(MIN_BLOCK_H, b.dur * PX_PER_MIN);
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
  // Every plan mutation flows through here. Unless silent, the PREVIOUS list is pushed as an
  // undo step first (max three), so undo means "revert my last action, whatever it was".
  const setTodayBlocks = (blocks: any[], silent?: boolean) => {
    if (!silent) { const prev = todayBlocks(); setPlanUndo((u) => [...u, prev].slice(-3)); }
    setPlans((p: any) => ({ ...p, [todayKey]: blocks }));
    api.savePlan && api.savePlan(todayKey, blocks);
  };
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
  // Pack consecutive routine steps into pomodoro-sized groups by their hidden durations. The
  // Timeline still uses this, and it seats steps that predate the `pomo` stamps; the Plan
  // list's visible sessions come from groupRoutineByPomo below.
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
  // The sessions are declared now, not measured: each routine splits into exactly N groups
  // (the My day "routine pomodoros" settings) and every step carries a `pomo` stamp naming
  // its session. Unstamped steps (from the duration-chunking era) land where the old packing
  // would have put them, clamped into the last session.
  const routineGroupCount = (which: string) => {
    const n = dayMode === "relax"
      ? (which === "morning" ? settings.relaxMorningRoutinePomos : settings.relaxNightRoutinePomos)
      : (which === "morning" ? settings.morningRoutinePomos : settings.nightRoutinePomos);
    return Math.max(1, Math.min(12, Math.round(n || 1)));
  };
  const groupRoutineByPomo = (list: any[], which: string) => {
    const n = routineGroupCount(which);
    const legacyIdx: any = {};
    groupRoutine(list, settings.routineGroupMinutes || 25).forEach((g: any, gi: number) => g.steps.forEach((s: any) => { legacyIdx[s.id] = gi; }));
    const groups = Array.from({ length: n }, () => ({ steps: [] as any[], dur: 0 }));
    (list || []).forEach((it: any) => {
      const gi = Math.max(0, Math.min(n - 1, it.pomo ?? legacyIdx[it.id] ?? 0));
      groups[gi].steps.push(it); groups[gi].dur += it.dur || ROUTINE_MIN;
    });
    return groups;
  };
  // Smart rule: a plan never ends on a break — drop any break/long-break left at the tail.
  const mkBreak = (start: number, k: string) => ({ id: (k === "longbreak" ? "lb" : "sb") + Date.now() + "_" + Math.round(start), kind: k, name: k === "longbreak" ? "Long break" : "Break", start, dur: k === "longbreak" ? (settings.longBreakMinutes || 20) : (settings.breakMinutes || 5) });
  const buildInitialPlan = () => {
    const pomo = settings.pomodoroMinutes || 25;
    // A sync rebuild carries over only the day's SURVIVORS: meals keep their (possibly edited)
    // time and length, and manual commitment blocks (locked, not from Notion) stay fixed with
    // their lengths. Everything else is rebuilt fresh: Notion task blocks arrive unlocked and
    // unpinned (Notion re-creates them), routine groups regroup, and ALL breaks are deleted —
    // none are auto-inserted either (insertBreaks: false); press auto-fix to add the rhythm.
    // Manual commitments only survive syncs on the calendar day they were created: yesterday
    // evening's add-blocks vanish when the new morning's sync runs (blocks without a stamp are
    // treated as stale and dropped too).
    const sameDayCreated = (b: any) => !!b.created && new Date(b.created).toDateString() === new Date().toDateString();
    const survivors = todayBlocks()
      .filter((b: any) => b.kind === "meal" || ((b.claimed || b.done) && sameDayCreated(b)) || (b.kind === "task" && b.locked && !b.pageId && sameDayCreated(b)))
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
      blocks.push({ id: "b" + Date.now() + "_" + (seq++), kind: "task", name: task.task, start: t, dur: 25, pomoLen: pomo, pageId: task.id || null, category: task.category || null, status: task.status || null, power: task.power || null });
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
  // Sync MERGES into the day instead of rebuilding it: arranged blocks keep their exact
  // positions; only FUTURE blocks of tasks that left today's list are removed; newcomers are
  // appended after the later of now and the last block, in task-list order (auto-fix stays
  // the explicit re-packer). The full build still runs when today has no plan yet.
  useEffect(() => {
    if (!pendingSyncRebuild) return;
    const bl = todayBlocks();
    if (!bl.length) { setTodayBlocks(buildInitialPlan(), true); setPendingSyncRebuild(false); return; }
    const d = new Date();
    let nowTl = d.getHours() * 60 + d.getMinutes();
    const mid = (tlStart + tlEnd) / 2;
    if (Math.abs(nowTl + 1440 - mid) < Math.abs(nowTl - mid)) nowTl += 1440;
    const ids = new Set(tasks.map((t: any) => t.id).filter(Boolean));
    const kept = bl.filter((b: any) => !(b.kind === "task" && b.pageId && !b.claimed && !b.done && !ids.has(b.pageId) && b.start >= nowTl));
    const having = new Set(kept.filter((b: any) => b.kind === "task" && b.pageId).map((b: any) => b.pageId));
    let tail = snap5(Math.max(nowTl, ...kept.map((b: any) => b.start + b.dur)));
    const added: any[] = [];
    for (const t of tasks) {
      if (!t.id || t.local || having.has(t.id)) continue;
      const nblocks = Math.max(1, t.pomodoros || 1);
      for (let i = 0; i < nblocks; i++) {
        added.push({ id: "sy" + Date.now() + "_" + String(t.id).slice(-4) + i, kind: "task", pageId: t.id, name: t.task, power: t.power || "Y", status: t.status, category: t.category, start: tail, dur: 25, created: Date.now() });
        tail += 25 + (settings.breakMinutes || 5);
      }
    }
    setTodayBlocks(resolveOverlaps([...kept, ...added]), true);
    setPendingSyncRebuild(false);
  }, [tasks, pendingSyncRebuild]);
  // Anchor prompt #2: shortly after lunch ends (per today's plan), offer the afternoon's
  // first beat. Once per day, and only while the engine is fully idle.
  const lunchPromptDay = useRef("");
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (lunchPromptDay.current === todayKey) return;
      if (running || timer.paused || timer.breakActive) return;
      const lunch = todayBlocks().find((b: any) => b.kind === "meal" && b.meal === "lunch");
      if (!lunch) return;
      const d = new Date();
      let m = d.getHours() * 60 + d.getMinutes();
      const mid = (tlStart + tlEnd) / 2;
      if (Math.abs(m + 1440 - mid) < Math.abs(m - mid)) m += 1440;
      const end = lunch.start + lunch.dur;
      if (m >= end && m < end + 10) {
        lunchPromptDay.current = todayKey;
        api.notifyClickable && api.notifyClickable("Lunch is over. Start the afternoon's first beat?", () => setView("log"));
      }
    }, 60000);
    return () => window.clearInterval(iv);
  }, [running, timer.paused, timer.breakActive, todayKey, plans]);
  const setTimelineMode = (on: boolean) => {
    const hasInput = [...workTasks, ...personalTasks].length || (!settings.skipMorningRoutine && (activeMorning || []).length) || (!settings.skipNightRoutine && (activeNight || []).length);
    if (on && !plans[todayKey] && hasInput) setTodayBlocks(buildInitialPlan(), true);
    else if (on && plans[todayKey]) {
      // A lunch/dinner toggle in settings only takes effect through autoBreaksOf; if the plan's
      // meals no longer match the settings, re-flow once on open so the change applies.
      const cur = plans[todayKey];
      const hasLunch = cur.some((b: any) => b.meal === "lunch"), hasDinner = cur.some((b: any) => b.meal === "dinner");
      if (!!settings.lunchEnabled !== hasLunch || !!settings.dinnerEnabled !== hasDinner) setTodayBlocks(autoBreaksOf(cur), true);
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
    setTodayBlocks([...todayBlocks(), { id, kind: "task", name: "New task", start: clampStart(snap5(last + (settings.breakMinutes || 5)), pomo), dur: pomo, power: "Y", load: "B", created: Date.now() }]);
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
    // Claimed blocks are HISTORY with real spans: the wand must never re-size them to 25.
    const sized = prev.map((b: any) => (b.kind === "task" && b.pageId && !b.claimed ? { ...b, dur: 25, pomoLen: pomo } : b));
    setTodayBlocks(autoBreaksOf(sized));
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
  // Left-drag landing rule, shared by the live insertion bar and the drop itself: place the
  // grabbed block at newStart, then GLUE it back to the end of the previous block (hopping any
  // anchor it may not overlap), so pure reordering never leaves a blank in front of the block.
  const tlAnchorish = (x: any) => x.kind === "meal" || x.kind === "meeting" || (x.kind === "task" && (x.locked || x.placed));
  const lgGlue = (blocks: any[], cur: any, newStart: number) => {
    const movedArr = blocks.map((x: any) => (x.id === cur.id ? { ...x, start: newStart } : x));
    const D: any = movedArr.find((x: any) => x.id === cur.id);
    const anchors = movedArr.filter(tlAnchorish);
    const prevEnd = movedArr.reduce((m: number, x: any) => (x.id !== cur.id && x.start + x.dur <= D.start ? Math.max(m, x.start + x.dur) : m), -1);
    if (prevEnd >= 0 && D.start > prevEnd) {
      let s = prevEnd, guard = 0;
      while (guard++ < 30) { const hit = anchors.find((f: any) => s < f.start + f.dur && s + D.dur > f.start); if (!hit) break; s = hit.start + hit.dur; }
      if (s < D.start) D.start = s;
    }
    return { movedArr, D, anchors };
  };
  // The SEAT model for left-dragging a FREE task (unlocked, unpinned): free tasks of the same
  // length are interchangeable seats. lgLanding picks one of three outcomes:
  //   rotate: the drop crossed another seat-task's midpoint. Tasks permute among their existing
  //           start times; breaks, meals, routines, pinned and odd-length blocks are furniture
  //           and never move, so the day keeps the exact same set of times.
  //   nudge:  no order change. Only the grabbed block's start moves, clamped into the free
  //           pocket between solid neighbours around the drop point.
  //   none:   the pocket is too small to hold the block, so the drop is a no-op.
  const seatPeers = (blocks: any[], cur: any) =>
    blocks.filter((x: any) => x.kind === "task" && !x.locked && !x.placed && x.dur === cur.dur)
      .sort((a: any, b: any) => a.start - b.start);
  // A "pocket" is the free span (breaks only) between the solid blocks around time t. When t is
  // inside a solid it snaps to the nearer edge, so a drop on a block's lower half means the
  // pocket after it. loSolid/hiSolid say whether an edge is a real block (pad it with a break)
  // or the open morning / open tail (leave it blank: the day just starts or ends there).
  const pocketOf = (blocks: any[], cur: any, t0: number) => {
    const solids = blocks.filter((x: any) => x.id !== cur.id && x.kind !== "break" && x.kind !== "longbreak");
    let t = t0;
    const inS = solids.find((s: any) => t > s.start && t < s.start + s.dur);
    if (inS) t = t < inS.start + inS.dur / 2 ? inS.start : inS.start + inS.dur;
    const dayLo = Math.min(tlStart, tlLeadOf(blocks));
    const loB = solids.reduce((m: number, s: any) => (s.start + s.dur <= t ? Math.max(m, s.start + s.dur) : m), -Infinity);
    const hiB = solids.reduce((m: number, s: any) => (s.start >= t ? Math.min(m, s.start) : m), Infinity);
    return { lo: Math.max(dayLo, loB), hi: Math.min(tlEnd, hiB), loSolid: loB > -Infinity, hiSolid: hiB < Infinity, t };
  };
  const lgLanding = (blocks: any[], cur: any, rawT: number): any => {
    const peers = seatPeers(blocks, cur);
    const others = peers.filter((x: any) => x.id !== cur.id);
    const oldIdx = others.filter((x: any) => x.start < cur.start).length;
    const newIdx = others.filter((x: any) => x.start + x.dur / 2 <= rawT).length;
    if (newIdx !== oldIdx) {
      const seats = peers.map((x: any) => x.start);
      const order = others.slice(); order.splice(newIdx, 0, cur);
      return { mode: "rotate", start: seats[newIdx], order, seats };
    }
    const pk = pocketOf(blocks, cur, rawT);
    if (pk.hi - pk.lo < cur.dur) return { mode: "none", start: cur.start };
    return { mode: "nudge", start: Math.max(pk.lo, Math.min(pk.hi - cur.dur, pk.t)), pk };
  };
  const onTlDrop = (b: any, clientY: number) => {
    const d = tlDrag;
    const blocks = todayBlocks();
    const cur = blocks.find((x: any) => x.id === b.id);
    if (!d || !cur) { setTlDrag(null); return; }
    // A press-and-release without real vertical movement is a CLICK, not a drag: change nothing.
    if (d.downY != null && Math.abs(clientY - d.downY) < 4) { setTlDrag(null); return; }
    const tlTop = tlRef.current ? tlRef.current.getBoundingClientRect().top : d.tlTop;
    const target = snapDrop(yToMin(tlLayout(blocks).items, clientY - tlTop - d.grab));
    if (d.button === 2) {
      const newStart = avoidMeals(clampStart(target, cur.dur), cur.dur, blocks, cur.id);
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
      const movedMap = blocks.map((x: any) => {
        if (!ids.has(x.id)) return x;
        const nb: any = { ...x, start: x.start + delta };
        if (x.id === cur.id && x.kind === "task" && !x.locked) nb.placed = true;
        return nb;
      });
      let pre = movedMap;
      const curMoved = movedMap.find((x: any) => x.id === cur.id);
      if (delta < 0 && curMoved) {
        // Dragging UP eats the stationary break(s) directly in front: they shrink by the
        // distance moved (re-classified short/long by the new length) and disappear when
        // fully consumed. Auto-fix can regrow any missing rests later.
        const sb0 = settings.breakMinutes || 5;
        pre = movedMap
          .map((x: any) => {
            if (ids.has(x.id) || (x.kind !== "break" && x.kind !== "longbreak")) return x;
            if (x.start >= curMoved.start && x.start + x.dur <= cur.start) return null;
            if (x.start < curMoved.start && x.start + x.dur > curMoved.start) {
              const nd = curMoved.start - x.start;
              if (nd < 1) return null;
              return { ...x, dur: nd, kind: nd > sb0 ? "longbreak" : "break", name: (x.name === "Break" || x.name === "Long break") ? (nd > sb0 ? "Long break" : "Break") : x.name };
            }
            return x;
          })
          .filter(Boolean);
      }
      const shifted = resolveOverlaps(pre);
      // The gap the drag opened IN FRONT of the grabbed task hardens into a persistent break the
      // user owns: auto-fix keeps its length; longer than the short-break setting reads as long.
      const outBlocks = shifted.slice();
      const curNew = shifted.find((x: any) => x.id === cur.id);
      if (curNew) {
        // The void the drag opened runs from the end of the last block still in front of the OLD
        // position up to the new start. Crossing an anchor (lunch, dinner, a commitment) splits
        // it, and EVERY free segment hardens into a persistent break, not just the last one
        // (which used to leave the emptied stretch before the meal blank). A segment that begins
        // exactly at an existing break's end JOINS that break instead of stacking a second one.
        const shortB = settings.breakMinutes || 5;
        const others = shifted.filter((x: any) => x.id !== cur.id);
        const lowBound = Math.min(cur.start, curNew.start);
        let pt = others.reduce((m: number, x: any) => (x.start + x.dur <= lowBound ? Math.max(m, x.start + x.dur) : m), -1);
        if (pt < 0) pt = lowBound;
        const mk = (s: number, e: number) => {
          const g = e - s;
          if (g <= 0) return;
          const prevBr = outBlocks.find((x: any) => (x.kind === "break" || x.kind === "longbreak") && Math.abs(x.start + x.dur - s) < 0.5);
          if (prevBr) {
            // The joined length decides the kind: a short break flips to a long one (icon,
            // height and default name included) once it grows past the short-break setting.
            const total = e - prevBr.start;
            const long = total > shortB;
            outBlocks[outBlocks.indexOf(prevBr)] = { ...prevBr, dur: total, kind: long ? "longbreak" : "break", name: (prevBr.name === "Break" || prevBr.name === "Long break") ? (long ? "Long break" : "Break") : prevBr.name };
            return;
          }
          outBlocks.push({ id: "gb" + Date.now() + "_" + Math.round(s), kind: g > shortB ? "longbreak" : "break", name: g > shortB ? "Long break" : "Break", start: s, dur: g });
        };
        const between = others.filter((x: any) => x.start + x.dur > pt && x.start < curNew.start).sort((a: any, b: any) => a.start - b.start);
        for (const x of between) { mk(pt, Math.min(x.start, curNew.start)); pt = Math.max(pt, x.start + x.dur); if (pt >= curNew.start) break; }
        if (pt < curNew.start) mk(pt, curNew.start);
      }
      setTodayBlocks(outBlocks);    } else if (cur.kind === "task" && !cur.locked && !cur.placed) {
      // Left-drag on a free task: the SEAT model (see lgLanding). A reorder permutes tasks among
      // their existing start times and moves nothing else; a nudge moves only this block inside
      // its pocket and rebuilds the break padding there; a no-fit drop changes nothing.
      const land: any = lgLanding(blocks, cur, target);
      if (land.mode === "rotate") {
        const seatAt = new Map(land.order.map((x: any, i: number) => [x.id, land.seats[i]]));
        setTodayBlocks(blocks.map((x: any) => (seatAt.has(x.id) ? { ...x, start: seatAt.get(x.id) } : x)));      } else if (land.mode === "nudge" && land.start !== cur.start) {
        const shortB = settings.breakMinutes || 5;
        const npk = land.pk, opk = pocketOf(blocks, cur, cur.start);
        const pks = npk.lo === opk.lo ? [npk] : [npk, opk];
        const isBrk = (x: any) => x.kind === "break" || x.kind === "longbreak";
        const inPk = (x: any, pk: any) => x.start >= pk.lo - 0.5 && x.start + x.dur <= pk.hi + 0.5;
        const out = blocks
          .map((x: any) => (x.id === cur.id ? { ...x, start: land.start } : x))
          .filter((x: any) => !(isBrk(x) && pks.some((pk: any) => inPk(x, pk))));
        const mk = (s: number, e: number) => { const g = e - s; if (g > 0.5) out.push({ id: "gb" + Date.now() + "_" + Math.round(s), kind: g > shortB ? "longbreak" : "break", name: g > shortB ? "Long break" : "Break", start: s, dur: g }); };
        pks.forEach((pk: any) => {
          const inside = land.start >= pk.lo - 0.5 && land.start + cur.dur <= pk.hi + 0.5;
          if (inside) { if (pk.loSolid) mk(pk.lo, land.start); if (pk.hiSolid) mk(land.start + cur.dur, pk.hi); }
          else if (pk.loSolid && pk.hiSolid) mk(pk.lo, pk.hi);   // the emptied pocket reads as one break you own
        });
        setTodayBlocks(out);      }
    } else {
      // Left-drag on a meal, routine or pinned block keeps the old GLUE: connect to the end of
      // the previous block (hopping anchors), then chain-push whatever it lands on, gaplessly.
      const newStart = avoidMeals(clampStart(target, cur.dur), cur.dur, blocks, cur.id);
      const { movedArr, D, anchors } = lgGlue(blocks, cur, newStart);
      const moved = movedArr.sort((a: any, c: any) => a.start - c.start);
      let cursor = D.start + D.dur;
      const resolved = moved.map((x: any) => {
        if (x.id === cur.id || tlAnchorish(x)) return x;
        if (x.start + x.dur <= D.start) return x;   // entirely before the drop: untouched
        if (x.start >= cursor) return x;            // clear of the drop and its chain: untouched
        let s = cursor, guard = 0;
        while (guard++ < 30) { const hit = anchors.find((f: any) => s < f.start + f.dur && s + x.dur > f.start); if (!hit) break; s = hit.start + hit.dur; }
        cursor = s + x.dur;
        return { ...x, start: s };
      });
      setTodayBlocks(resolved);    }
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
            <select value={blockDraft.category ?? ""} onChange={(e) => setBlockDraft({ ...blockDraft, category: e.target.value })} aria-label="Area tag, mirroring your Notion Area options" style={{ width: 96, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 12, borderRadius: 5, padding: "3px 4px", fontFamily: "var(--fl-display)", flexShrink: 0 }}>
              <option value="">no area</option>
              {Array.from(new Set([...(areaOptions || []), ...tasks.map((t: any) => t.category).filter(Boolean), ...((blockDraft.category ?? "") ? [blockDraft.category] : [])])).map((a: any) => (<option key={a} value={a}>{a}</option>))}
            </select>
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
        style={{ position: "absolute", left: 108, right: 4, top: blkTop, height: h, boxSizing: "border-box", opacity: tlDrag && tlDrag.id !== b.id ? 0.5 : 1, background: isTask ? "#fdfbf5" : (b.kind === "break" ? BREAK_BG : b.kind === "longbreak" ? LBREAK_BG : b.kind === "meal" ? MEAL_BG : b.kind === "routine" ? ROUTINE_THEME[b.night ? "night" : "morning"][dayMode === "relax" ? "relax" : "work"] : "#fbf8f1"), border: `1px solid ${C.line}`, borderLeft: `4px ${b.claimed ? "dashed" : "solid"} ${isTask ? (POWER_COLOR[b.power] || POWER_COLOR.Y) : (b.kind === "routine" ? ROUTINE_THEME[b.night ? "night" : "morning"].bar : b.kind === "break" ? BREAK_STRIPE : b.kind === "longbreak" ? LBREAK_STRIPE : b.kind === "meal" ? MEAL_STRIPE : C.muted)}`, borderRadius: 6, padding: "2px 8px", cursor: (b.kind === "meeting" || b.kind === "break" || b.kind === "longbreak") ? "default" : (dragging ? "grabbing" : "grab"), display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: b.kind === "break" ? BREAK_TEXT : b.kind === "longbreak" ? LBREAK_TEXT : b.kind === "meal" ? MEAL_TEXT : C.ink, zIndex: dragging ? 20 : 1, boxShadow: dragging ? "0 4px 14px rgba(0,0,0,0.18)" : "none", touchAction: "none", userSelect: "none", overflow: "hidden" }}>
        {b.claimed && <span aria-label="claimed: logged after the fact, off the timer" style={{ fontSize: 10, flexShrink: 0, lineHeight: 1 }}>{"✋"}</span>}
        {b.kind === "meeting" && <span style={{ color: C.muted, display: "inline-flex", flexShrink: 0 }}><LockIcon size={12} /></span>}
        {(b.kind === "break" || b.kind === "longbreak") && <img src={b.kind === "longbreak" ? breakLongIcon : breakShortIcon} alt="" draggable={false} style={{ width: 14, height: 14, flexShrink: 0 }} />}
        {b.kind === "meal" && <span style={{ color: MEAL_TEXT, display: "inline-flex", flexShrink: 0 }}><UtensilsIcon size={13} /></span>}
        {b.kind === "routine" && <span style={{ color: ROUTINE_THEME[b.night ? "night" : "morning"].bar, display: "inline-flex", flexShrink: 0 }} aria-label={b.night ? "night routine" : "morning routine"}>{b.night ? <MoonRoutineIcon size={13} /> : <SunRoutineIcon size={13} />}</span>}
        {isTask && (b.status === "exploring" || b.status === "executing") && <span style={{ color: b.status === "exploring" ? MODE_COLORS.relax.solid : MODE_COLORS.work.solid, display: "inline-flex", flexShrink: 0 }} aria-label={b.status === "exploring" ? "Status: Exploring - still finding the shape" : "Status: Executing - the path is known"}>{b.status === "exploring" ? <ExploreIcon size={12} /> : <HammerIcon size={12} />}</span>}
        {isTask && b.category && settings.showAreaTimeline !== false && <span style={{ fontSize: 10, fontFamily: "var(--fl-mono)", color: personalBlk ? TAG_COFFEE.personal.text : TAG_COFFEE.project.text, background: personalBlk ? TAG_COFFEE.personal.bg : TAG_COFFEE.project.bg, border: `1px solid ${personalBlk ? TAG_COFFEE.personal.border : TAG_COFFEE.project.border}`, borderRadius: 999, height: 16, boxSizing: "border-box", display: "inline-flex", alignItems: "center", padding: "0 7px", whiteSpace: "nowrap", flexShrink: 0 }}>{b.category}</span>}
        {isTask && <button onClick={() => toggleLock(b.id)} className={b.locked ? "" : "fl-rowact fl-collapse"} aria-label={b.locked ? "commitment: fixed at this time, and auto-fix adds a long break after it and restarts the pomodoro count. Click to release." : "make this a commitment: fix it at this time, with a long break after it and a fresh pomodoro count"} style={{ ...ICON_BTN, color: b.locked ? (POWER_COLOR[b.power] || POWER_COLOR.Y) : C.muted }}><LockIcon size={12} open={!b.locked} /></button>}
        {isTask && b.placed && <button onClick={() => setTodayBlocks(todayBlocks().map((x: any) => { if (x.id !== b.id) return x; const nb: any = { ...x }; delete nb.placed; return nb; }))} aria-label="placed (by right-drag): auto-fix keeps it exactly here, position only, the break rhythm is unchanged. Click to release it back into the flow." style={{ ...ICON_BTN, color: POWER_COLOR[b.power] || POWER_COLOR.Y }}><PinIcon size={12} /></button>}
        <span aria-label={Array.isArray(b.steps) && b.steps.length ? b.steps.join(" · ") : undefined} style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: (b.done || (b.kind === "routine" && Array.isArray(b.refIds) && b.refIds.length > 0 && b.refIds.every((id: string) => isRoutineDone(id)))) ? "line-through" : "none" }}>{isTask ? stripLeadingTag(b.name) : b.name}{Array.isArray(b.steps) && b.steps.length ? <span style={{ color: C.muted, fontSize: 11 }}> · {b.steps.join(" · ")}</span> : null}</span>
        {isTask && b.pageId && <button onClick={() => { const t = tasks.find((x: any) => x.id === b.pageId); if (t) openOverCalib(t); }} className="fl-rowact fl-collapse" aria-label="the task grew: add a + tomato round (max two, then split)" style={{ ...ICON_BTN, fontSize: 11, whiteSpace: "nowrap" }}>{"+\u{1F345}"}</button>}
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

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button onClick={autoBreaks} aria-label="auto-fix: pack the day in your order around commitments, pins and meals, glue your breaks, and add only the missing rests" style={{ ...btn(ACCENT), width: 30, height: 30, padding: 0, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><WandSparklesIcon size={14} /></button>
            <button onClick={() => { if (!planUndo.length) return; const snap = planUndo[planUndo.length - 1]; const rest = planUndo.slice(0, -1); setTodayBlocks(snap, true); setPlanUndo(rest); }} disabled={planUndo.length === 0}
              aria-label={planUndo.length ? `undo your last plan edit (${planUndo.length} step${planUndo.length > 1 ? "s" : ""} stored)` : "nothing to undo yet: every plan edit stores a step, up to three"}
              style={{ ...btn(ACCENT, true), width: 30, height: 30, padding: 0, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: planUndo.length ? 1 : 0.35, cursor: planUndo.length ? "pointer" : "default" }}><Undo2Icon size={14} /></button>
            {settings.addBlockEnabled === true && <button onClick={addBlock} aria-label="add a manual block: name, power colour, load letter, Area tag and length; lock it if it's a commitment" style={{ ...btn(ACCENT), width: 30, height: 30, padding: 0, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><ListPlusIcon size={14} /></button>}
          </div>
        </div>
        {blocks.length === 0 && <p style={{ color: C.muted, fontSize: 13, margin: "0 0 8px" }}>No blocks yet - sync some tasks and re-open the timeline, or add a block.</p>}
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
          {tlDrag && tlDrag.button !== 2 && (() => {
            // Landing bar (left-drag only): marks the exact start the block will get on release.
            // For a free task that is its SEAT, i.e. the top edge of the task whose place it
            // takes in the rotation, or its nudged time inside the free pocket; for meals,
            // routines and pinned blocks it is the old glue boundary.
            const cur = blocks.find((x: any) => x.id === tlDrag.id);
            if (!cur || !items.length) return null;
            const gy = Math.max(0, tlDrag.y - tlDrag.grab);
            const rawT = snapDrop(yToMin(items, gy));
            const landing = (cur.kind === "task" && !cur.locked && !cur.placed)
              ? lgLanding(blocks, cur, rawT).start
              : lgGlue(blocks, cur, avoidMeals(clampStart(rawT, cur.dur), cur.dur, blocks, cur.id)).D.start;
            let by = minToY(items, landing);
            if (by < 0) by = landing <= items[0].t0 ? items[0].topY : items[items.length - 1].topY + items[items.length - 1].height;
            return <div style={{ position: "absolute", left: 100, right: 0, top: by - 1.5, height: 3, background: ACCENT, borderRadius: 999, zIndex: 25, pointerEvents: "none" }} />;
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
  // night routine) sits on top; finished phases collapse into "earlier today". The two
  // boundaries are the explicit My-day settings, the same pair the pomodoro counter uses.
  const phaseRankNow = (() => {
    const d = new Date();
    const nowM = d.getHours() * 60 + d.getMinutes();
    return nowM < (settings.morningRoutineEnds ?? 540) ? 0 : nowM < (settings.nightRoutineStarts ?? 1215) ? 1 : 2;
  })();
  const renderFullSection = (key: string, hideHeader?: boolean) => {
    const headColor = dayMode === "relax" ? MODE_COLORS.relax.solid : MODE_COLORS.work.solid;
    if (key === "morning") return renderRoutineBlock("morning", hideHeader);
    if (key === "night") return renderRoutineBlock("night", hideHeader);
    if (key === "work") return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: hideHeader ? "none" : "flex", alignItems: "center", gap: 8, margin: "0 0 4px" }}>
          <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0, flex: 1, minWidth: 0 }}><SectionIcon src={doveImg} /> Project</h3>
          {/* what you hid stays out of sight (and out of guilt) until asked for; counts
              elsewhere still include it */}
          {workTasks.some((t: any) => isTaskHidden(t)) && (
            <button onClick={() => setShowHidden((v) => !v)} aria-label={showHidden ? "tuck the hidden tasks away again" : "reveal the hidden tasks, dimmed"}
              style={{ ...ICON_BTN, display: "inline-flex", alignItems: "center", gap: 4, color: C.muted }}>
              {showHidden ? <EyeIcon size={15} /> : <EyeCrossedIcon size={15} />}
              {!showHidden && <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)" }}>{workTasks.filter((t: any) => isTaskHidden(t)).length}</span>}
            </button>
          )}
          {!!api.createTask && !!settings.notionToken && (
            <button onClick={() => setQaOpen((v) => !v)} aria-label={qaOpen ? "fold the capture form" : "add a task: opens the capture form"} aria-expanded={qaOpen}
              style={{ ...btn(ACCENT), width: 20, height: 20, minWidth: 20, padding: 0, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><PlusBoldIcon size={9} /></button>
          )}
        </div>
        {qaOpen && !!api.createTask && !!settings.notionToken && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", padding: "8px 10px", borderRadius: 8, background: "#fdfbf5", border: `1px solid ${C.line}` }}>
            <input value={qaName} autoFocus onChange={(e) => setQaName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); if (e.key === "Escape") setQaOpen(false); }}
              placeholder="capture a task: Enter = into Notion"
              style={{ flex: 1, minWidth: 140, border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontSize: 12.5, borderRadius: 999, padding: "6px 12px", fontFamily: "var(--fl-display)", height: 32, boxSizing: "border-box" }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, border: `1px solid ${C.line}`, background: C.paper, borderRadius: 999, padding: "0 6px 0 9px", height: 32, boxSizing: "border-box", flexShrink: 0 }}>
              <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>{"\u{1F345}"}</span>
              <input type="number" min={1} max={4} value={qaGuess} onChange={(e) => setQaGuess(e.target.value)}
                aria-label="initial Guess in pomodoros: 1 to 3 write tomatoes, 4 writes one box; empty = no guess"
                style={{ width: 28, border: "none", boxShadow: "none", background: "transparent", color: C.ink, fontSize: 12, textAlign: "center", fontFamily: "var(--fl-mono)", padding: 0 }} />
            </span>
            {/* the status choice, spoken in icons only: green search = Exploring, orange hammer = Executing */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, border: `1px solid ${C.line}`, background: C.paper, borderRadius: 999, padding: 3, height: 32, boxSizing: "border-box", flexShrink: 0 }}>
              <button onClick={() => setQaStatus("Exploring")} aria-label="status: Exploring - still finding the shape" aria-pressed={qaStatus === "Exploring"}
                style={{ width: 26, height: 24, padding: 0, border: "none", boxShadow: "none", borderRadius: 999, background: qaStatus === "Exploring" ? MODE_COLORS.relax.fill : "transparent", color: qaStatus === "Exploring" ? MODE_COLORS.relax.solid : C.faint, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ExploreIcon size={13} /></button>
              <button onClick={() => setQaStatus("Executing")} aria-label="status: Executing - the path is known" aria-pressed={qaStatus === "Executing"}
                style={{ width: 26, height: 24, padding: 0, border: "none", boxShadow: "none", borderRadius: 999, background: qaStatus === "Executing" ? MODE_COLORS.work.fill : "transparent", color: qaStatus === "Executing" ? MODE_COLORS.work.solid : C.faint, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><HammerIcon size={13} /></button>
            </span>
            <select value={qaParent} onChange={(e) => setQaParent(e.target.value)} aria-label="where it goes in Notion: a common task, or a sub-task under a BIG TASK"
              style={{ maxWidth: 150, border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontSize: 12, borderRadius: 999, padding: "5px 8px", fontFamily: "var(--fl-display)", height: 32, boxSizing: "border-box", flexShrink: 0 }}>
              <option value="">{"\u23F3 Common task"}</option>
              {quickParents.map((p: any) => (<option key={p.id} value={p.id}>{"\u{1F43E} " + p.name}</option>))}
            </select>
            <button onClick={() => setQaOpen(false)} aria-label="go back without saving (what you typed is kept for next time)"
              style={{ width: 30, height: 30, minWidth: 30, padding: 0, borderRadius: 999, border: "none", boxShadow: "none", background: "rgb(238, 201, 201)", color: C.worse, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><BackArrowIcon size={14} /></button>
            <button onClick={quickAdd} disabled={qaBusy || !qaName.trim()} aria-label="save: create it in Notion, then sync so it appears below"
              style={{ width: 30, height: 30, minWidth: 30, padding: 0, borderRadius: 999, border: "none", boxShadow: "none", background: "#DCEAF6", color: "#1d4f80", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: qaBusy || !qaName.trim() ? 0.5 : 1 }}><DiskIcon size={14} /></button>
          </div>
        )}
        {workTasks.length > 0 && (
          <div style={{ color: C.muted, fontSize: 12.5, margin: "0 0 6px 2px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px" }}>
          <span>Square = ExecutionPower:</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: POWER_COLOR.P }} />Must Today</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: POWER_COLOR.Y }} />Aim Today (default)</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: POWER_COLOR.G }} />Bonus If Done</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px" }}>
          <span>Icon = Status:</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ color: MODE_COLORS.relax.solid, display: "inline-flex" }}><ExploreIcon size={12} /></span> Exploring</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ color: MODE_COLORS.work.solid, display: "inline-flex" }}><HammerIcon size={12} /></span> Executing</span>
          <span style={{ marginLeft: 4 }}><img src={crownImg} alt="King" draggable={false} style={{ width: 15, height: 15, verticalAlign: "-3px" }} /> = King {"·"} day starts at {fmtHM(settings.dayStart)}</span>
          </div>
          </div>
        )}
        {workTasks.filter((t: any) => showHidden || !isTaskHidden(t)).map((t: any) => (
          isTaskHidden(t) ? <div key={"hid" + (t.id || t.task)} style={{ opacity: 0.55 }}>{renderTaskRow(t)}</div> : renderTaskRow(t)
        ))}
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: hideHeader ? "none" : "flex", alignItems: "center", gap: 8, margin: "0 0 4px" }}>
          <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0, flex: 1, minWidth: 0 }}><SectionIcon src={swanImg} /> Personal</h3>
          {personalTasks.some((t: any) => isTaskHidden(t)) && (
            <button onClick={() => setShowHidden((v) => !v)} aria-label={showHidden ? "tuck the hidden tasks away again" : "reveal the hidden tasks, dimmed"}
              style={{ ...ICON_BTN, display: "inline-flex", alignItems: "center", gap: 4, color: C.muted }}>
              {showHidden ? <EyeIcon size={15} /> : <EyeCrossedIcon size={15} />}
              {!showHidden && <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)" }}>{personalTasks.filter((t: any) => isTaskHidden(t)).length}</span>}
            </button>
          )}
        </div>
        {personalTasks.filter((t: any) => showHidden || !isTaskHidden(t)).map((t: any) => (
          isTaskHidden(t) ? <div key={"hid" + (t.id || t.task)} style={{ opacity: 0.55 }}>{renderTaskRow(t)}</div> : renderTaskRow(t)
        ))}
      </div>
    );
  };
  // Un-finish from the "Done today" pile: the task's previous Schedule goes back to Notion,
  // it returns to the END of the active list with its spend intact, and its struck timeline
  // blocks un-strike (the worked history itself stays). Sync reconciles the pile by id, so a
  // restored task can never appear twice.
  const restoreDone = async (e: any) => {
    try { if (api.restoreTask) await api.restoreTask(e.id, e.prevSchedule); }
    catch (err: any) { api.notify && api.notify("Could not restore in Notion: " + (err?.message || err)); return; }
    const back = e.meta ? { ...e.meta, act: e.spend != null ? e.spend : e.meta.act } : { task: e.task, id: e.id, pomodoros: e.guess || 0, guessBase: e.guess || 0, guessPlus: [], act: e.spend || 0, king: false, power: "Y", status: null, category: null, parent: null, ancestor: null, group: e.task };
    const nt = [...tasks.filter((t: any) => t.id !== e.id), back];
    setTasks(nt); api.saveTasks && api.saveTasks(nt);
    saveDone(doneToday.filter((x: any) => x.id !== e.id));
    const bl = todayBlocks();
    if (bl.some((b: any) => b.done && b.pageId === e.id)) setTodayBlocks(bl.map((b: any) => { if (!(b.done && b.pageId === e.id)) return b; const nb: any = { ...b }; delete nb.done; return nb; }));
    api.notify && api.notify("\u201C" + e.task + "\u201D is back in play.");
  };
  const renderTodaySections = () => {
    const defs = [
      { key: "morning", label: <><SectionIcon src={roosterImg} /> Morning</>, rank: 0, on: !settings.skipMorningRoutine },
      { key: "work", label: <><SectionIcon src={doveImg} /> Project</>, rank: 1, on: true },
      { key: "personal", label: <><SectionIcon src={swanImg} /> Personal</>, rank: 1, on: personalTasks.length > 0 },
      { key: "night", label: <><SectionIcon src={batImg} /> Night</>, rank: 2, on: !settings.skipNightRoutine },
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
                <button onClick={() => setExpandedPast((e) => { const n = new Set(e); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })} style={{ margin: 0, fontFamily: "var(--fl-display)", fontSize: 13.5, fontWeight: 600, color: C.ink, background: "transparent", border: "none", boxShadow: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 0" }}><AngleIcon size={14} down={expandedPast.has(s.key)} /> {s.label}</button>
                {expandedPast.has(s.key) && <div style={{ marginTop: 4 }}>{renderFullSection(s.key, true)}</div>}
              </div>
            ))}
          </div>
        )}
        {(() => {
          const pile = doneToday.filter((e: any) => sameLogicalDay(e.ts, Date.now(), settings));
          if (!pile.length) return null;
          return (
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
              <button onClick={() => setDoneOpen(!doneOpen)} style={{ margin: 0, fontFamily: "var(--fl-display)", fontSize: 13.5, fontWeight: 600, color: C.ink, background: "transparent", border: "none", boxShadow: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, padding: 0 }}>{doneOpen ? "\u25BE" : "\u25B8"} Done today ({pile.length})</button>
              {doneOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {pile.map((e: any) => (
                    <div key={e.id} className="fl-act-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 11px", borderRadius: 6, background: "#fdfbf5", border: `1px solid ${C.line}` }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.muted, textDecoration: "line-through", overflowWrap: "anywhere" }}>{stripLeadingTag(e.task)}</span>
                      <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11, color: C.muted, flexShrink: 0 }}>{(e.guess ? "guess " + e.guess + " \u00B7 " : "") + "spend " + (e.spend || 0)}</span>
                      <button onClick={() => restoreDone(e)} className="fl-rowact fl-collapse" aria-label="not finished after all: put its previous Schedule back in Notion and return it to the list" style={ICON_BTN}><RotateCcwIcon size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // Horizontal sub-view toggle, same look as the Sky view's Pomodoros/Waves control.

  // Every view's second-level bar, rendered in the PINNED zone above the divider line so
  // only the body below it scrolls (the Slack pattern). Each bar is the same JSX it always
  // was; it just lives up here now.
  // The pinned title names the place you are in, the way Slack's pane header does.
  const viewTitle = isFocusView(view) ? "Focus" : view === "calendar" ? "Calendar" : view === "calibrate" ? "Calibrate" : view === "today" ? "Plan" : view === "sky" ? "Sky" : view === "history" ? "History" : "Focus Log";
  const pinnedBar = () => {
    // One sync button, shared by the Plan and Focus bars: the Notion badge resting as a
    // 24px square, the refresh sliding in on hover or while a sync runs.
    const syncBtn = (
      <button onClick={doSync} disabled={sync === "loading"} className="fl-sync-btn" aria-label="sync from Notion: pull today's tasks and merge the plan" title="sync from Notion"
        style={{ display: "inline-flex", alignItems: "center", height: 24, boxSizing: "border-box", padding: "0 4px", borderRadius: 9, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, boxShadow: "none", cursor: "pointer", marginBottom: 4, opacity: sync === "loading" ? 0.7 : 1 }}>
        <span className={"fl-sync-refresh" + (sync === "loading" ? " is-on" : "")} style={{ display: "inline-flex", alignItems: "center" }}>
          <RefreshCwIcon size={14} spin={sync === "loading"} />
        </span>
        <img src={NOTION_LOGO} alt="" draggable={false} style={{ width: 16, height: 16 }} />
      </button>
    );
    if (isFocusView(view)) return (
      <div style={{ ...SUBBAR, marginBottom: 0, alignItems: "flex-end" }}>
        <div style={SUBTAB_ROW}>
          {FOCUS_SUB.map(([k, lab, Icon]) => (<button key={k} onClick={() => setView(k)} style={subTab(view === k)}><Icon size={13} on={view === k} />{lab}</button>))}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <NoiseControl value={view === "break" ? noise.break : noise.focus} onPick={(v: string) => api.setNoise && api.setNoise(view === "break" ? "break" : "focus", v)} />
        {syncBtn}
        <InfoHover C={C} label="about this view" width={360}>
          {view === "log" && (<>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Pomo</div>
            <div>Always set your expected feeling first; the task link is optional. The one exception is the {"\u{1F331}"} 5-minute tiny start, which may begin unrated, because starting is its whole point. A free pomodoro keeps the rhythm, can be named mid-run or at the end, and logs as plain "Focus" if it stays unnamed.</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              <li><b>Task</b>: today's tasks from the Plan; each pomodoro adds +1 to that task's Spend in Notion.</li>
              <li><b>Feeling</b>: the four weathers, rain to full sun; your before and after ratings are both saved.</li>
              <li><b>Timer</b>: the round buttons set 5 to 30 minutes (hold to speed up); the length locks while a pomodoro runs; the circle arrow resets the timer and task.</li>
              <li><b>Pause</b>: pausing asks for a reason, orange for internal, blue for external; it is recorded under Pause.</li>
              <li><b>{"\u{1F30A}"} Surf an urge</b>: mid-run, tap the wave: rate it, breathe, find it on the rabbit, name the feeling. Decide after the wave. The floating window keeps a quick 90-second version.</li>
            </ul>
          </>)}
          {view === "break" && (<>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Break</div>
            <div>Rest you choose, and the menu you choose it from. Rate a break with the four season trees and the numbers gather under Calibrate.</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              <li><b>Start a break</b>: short or long, using the lengths from settings; the floating window mirrors it.</li>
              <li><b>Break activities</b>: the things you actually do to recover. Tick them during a break and their restoring power shows up over time.</li>
            </ul>
          </>)}
          {view === "pause" && (<>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Pause</div>
            <div>Rest that interrupts you. Pausing a pomodoro asks for a reason, and these are the reasons on offer.</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              <li><b style={{ color: PAUSE_CAT.internal.border }}>internal</b>: the impulse came from you {"-"} tired, distracted, hungry.</li>
              <li><b style={{ color: PAUSE_CAT.external.border }}>external</b>: something outside interrupted you {"-"} a person, a call, a delivery.</li>
              <li>Drag to reorder; the order here is the order the pause picker offers them in.</li>
            </ul>
          </>)}
        </InfoHover>
        </div>
      </div>
    );
    if (view === "calendar") return (
      <div style={{ ...SUBBAR, marginBottom: 0, alignItems: "flex-end" }}>
        {/* the day's character and the week's count hold the left lane, like Plan's facts */}
        <span style={{ paddingBottom: 6, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13.5, fontWeight: 700, fontFamily: "var(--fl-display)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: dayMode === "relax" ? MODE_COLORS.relax.solid : MODE_COLORS.work.solid }}>
            {dayMode === "relax" ? <LeafIcon size={14} /> : <BriefcaseBusinessIcon size={14} />} {dayMode === "relax" ? "Relax day" : "Work day"}
          </span>
          <span style={{ color: C.muted, fontWeight: 600, fontSize: 13 }}>{"·"} {countWeek} {"\u{1F345}"} this week</span>
        </span>
        <div style={{ display: "inline-flex", alignItems: "center", height: 28 }}>
        <InfoHover C={C} label="about this view" width={360}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Calendar</div>
          <div>The month as a calendar: a square for every pomodoro.</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li><b>Squares</b>: one per pomodoro, red on work days and green on relax days; the lightness is the time of day.</li>
            <li><b>Yellow squares</b>: overnight pomodoros, done between your day start and "morning begins".</li>
            <li><b>Changing month</b>: use the arrows or scroll on the month name; TODAY jumps back to now and opens today's daily note.</li>
            <li><b>Days</b>: darker date numbers already have a daily note; click any day to open its note.</li>
          </ul>
        </InfoHover>
        </div>
      </div>
    );
    if (view === "calibrate") return (
      <div style={{ ...SUBBAR, marginBottom: 0, alignItems: "flex-end" }}>
        <div style={SUBTAB_ROW}>
          {CALIB_TABS.map(([k, lab, Icon]) => (<button key={k} onClick={() => setCalibSub(k)} style={subTab(calibSub === k)}><Icon size={13} on={calibSub === k} />{lab}</button>))}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", height: 28 }}>
        <InfoHover C={C} label="about this view" width={360}>
          {calibSub === "today" && (<>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Today</div>
            <div>Every pomodoro of the day, grouped morning / afternoon / evening, oldest first - a quick catch-up for the ones that ran unnamed.</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              <li><b>name this pomodoro{"\u2026"}</b>: an unnamed run; click, pick a task or type one, and Enter or a click away saves. Named ones can be renamed the same way {"-"} click the name. Open until tomorrow morning.</li>
              <li>A rename also rewrites that pomodoro's line in the daily note, as long as the line still matches what was written.</li>
              <li><b style={{ color: "#D9A521" }}>{"\u2B50"} star</b>: an overnight head start, done after the day began but before morning - it counts toward the day it leads into, like the Calendar's yellow squares.</li>
              <li>Naming only changes the local log; nothing is written back to Notion.</li>
            </ul>
          </>)}
          {calibSub === "accuracy" && (<>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Pomo Accuracy</div>
            <div>Two kinds of guess, side by side: how long a task would take, and how it would feel.</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              <li><b>How your guesses land</b>: the share of calibrated tasks that finished within one {"\u{1F345}"}, the average miss, and why tasks grew or shrank.</li>
              <li><b>Expected vs actual</b>: how often sessions turned out more enjoyable than you expected, with the biggest surprises.</li>
            </ul>
          </>)}
          {calibSub === "total" && (<>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Sum</div>
            <div>The long view, four cards in one scroll: pomodoro totals with the six-month heatmap, your best time of day, how you rest, and when and why you stop.</div>
          </>)}
        </InfoHover>
        </div>
      </div>
    );
    if (view === "history") return (
      <div style={{ ...SUBBAR, marginBottom: 0, alignItems: "flex-end" }}>
        <div style={SUBTAB_ROW}>
          {HIST_TABS.map(([k, lab]) => (<button key={k} onClick={() => setHistorySub(k)} style={subTab(historySub === k)}>{lab}</button>))}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", height: 28 }}>
        <InfoHover C={C} label="about this view" width={360}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>History</div>
          <div>The full record, one list per kind: calibrations, breaks, pomodoros, pauses. Edits and deletes only change the local log; they never undo what was written to Notion.</div>
        </InfoHover>
        </div>
      </div>
    );
    if (view === "today") return (
      <div className="fl-plan-bar" style={{ ...SUBBAR, marginBottom: 0, alignItems: "flex-end" }}>
        {/* the day's facts hold the bar's left lane, where other views put their tabs */}
        <span style={{ paddingBottom: 6, minWidth: 0 }}>
          <span style={{ color: C.ink, fontSize: 13.5, fontWeight: 700, display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {tasks.length} tasks {"·"} {countToday} / {plannedPomos} {"\u{1F345}"}
            {isOvernight(Date.now(), settings)
              ? <span style={{ fontWeight: 600, fontSize: 13, color: C.muted }} title="between your day start and morning-begins, pomodoros stack on the day they lead into - the same stretch the Calendar paints yellow">{"·"} a head start: anything now counts toward tomorrow</span>
              : <span style={{ fontWeight: 600, fontSize: 13, color: C.muted }} title="how many more pomodoros fit between now and the night routine, once meals and breaks are taken out">{"·"} room for {pomosLeftToday} more today</span>}
            {false && planEndMin > 0 &&
              <span style={{ fontWeight: 600 }}>{" · ends " + fmtClock(planEndMin)}{planOverflow > 0 && <span style={{ color: C.worse }}>{" (overflows by " + planOverflow + "m)"}</span>}</span>}
          </span>
        </span>
        {/* sync, then the day-mode pill, then the info button last - so info lands
            on the same spot here as on every other view */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Today's mode, the Slack split button in miniature: just the icon and a
              chevron, a rounded rectangle tinted by the day; the menu carries the words. */}
          <span data-modemenu style={{ position: "relative", display: "inline-flex", marginBottom: 4 }}>
            <button onClick={() => setModeMenuOpen((o) => !o)} aria-expanded={modeMenuOpen}
              aria-label={(dayMode === "relax" ? "today is a relax day" : "today is a work day") + " - open the menu to change it"}
              style={{ display: "inline-flex", alignItems: "stretch", height: 24, boxSizing: "border-box", padding: 0, overflow: "hidden", borderRadius: 9, border: `1px solid ${dayMode === "relax" ? MODE_COLORS.relax.border : MODE_COLORS.work.border}`, boxShadow: "none", cursor: "pointer", background: dayMode === "relax" ? MODE_COLORS.relax.fill : MODE_COLORS.work.fill, color: dayMode === "relax" ? MODE_COLORS.relax.solid : MODE_COLORS.work.solid }}>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "0 7px" }}>
                {dayMode === "relax" ? <LeafIcon size={15} /> : <BriefcaseBusinessIcon size={15} />}
              </span>
              <span className="fl-mode-caret" style={{ display: "inline-flex", alignItems: "center", padding: "0 5px", borderLeft: `1px solid ${dayMode === "relax" ? MODE_COLORS.relax.border : MODE_COLORS.work.border}` }}><AngleIcon size={13} down /></span>
            </button>
            {modeMenuOpen && (
              <div role="menu" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 6px 22px rgba(0,0,0,0.16)", padding: 6, minWidth: 126, display: "flex", flexDirection: "column", gap: 2 }}>
                {(["work", "relax"] as const).map((m) => (
                  <button key={m} role="menuitem" onClick={() => { setDayModeTo(m); setModeMenuOpen(false); }}
                    style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 8px", border: "none", boxShadow: "none", background: dayMode === m ? MODE_COLORS[m].fill : "transparent", borderRadius: 7, color: MODE_COLORS[m].solid, fontWeight: dayMode === m ? 700 : 500, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--fl-display)" }}>
                    {m === "work" ? <BriefcaseBusinessIcon size={13} /> : <LeafIcon size={13} />} {m === "work" ? "Work day" : "Relax day"}
                  </button>
                ))}
              </div>
            )}
          </span>
          {/* sync wears the Notion badge; the refresh slides in on hover (or while running) */}
          {syncBtn}
          {false && (
          <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
          onMouseEnter={() => setIntroOpen(true)} onMouseLeave={() => setIntroOpen(false)}>
          <span aria-label={introOpen ? undefined : "how the Timeline works"} style={{ display: "inline-flex", color: C.muted }}><InfoIcon size={16} /></span>
          {introOpen && (
          <div style={{ position: "absolute", right: 0, top: 22, width: 400, maxWidth: "84vw", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 16px", zIndex: 60, boxShadow: "0 6px 24px rgba(0,0,0,0.16)", fontSize: 12.5, fontWeight: 400, color: C.ink, lineHeight: 1.5, textAlign: "left" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>How the Timeline works</div>
          <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>Moving blocks</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Left-drag a task: reordering by seats. Tasks of the same length trade start times (the chocolate bar shows the seat you'll take), and nothing else in the day moves: breaks, meals, routines and pinned blocks stay put. A drag that crosses no task just nudges that one block inside its free pocket, and the break padding around it stretches or shrinks to fit.</li>
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
          {(
          <InfoHover C={C} label="about this view" width={400}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>How the Tasks view works</div>
          <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>What's here</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Today's tasks from Notion, plus any local tasks added with the Timeline's add-block button (those survive sync, so the plugin also works without Notion).</li>
          <li>The (+) on the Project card opens the capture form: name, {"\u{1F345}"} guess, a status choice (search = Exploring, hammer = Executing), and where it goes in Notion. Enter or the disk saves, then a sync brings the task into the list; the back arrow folds the form without saving.</li>
          <li>Grouped into Project and Personal by your Personal Areas and names settings, with the morning and night routines around them.</li>
          </ul>
          <div style={{ fontWeight: 600, margin: "8px 0 2px" }}>Reading a row</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>The little icon is the Notion Status: a green search while Exploring, an orange hammer while Executing. The chip beside it is the Notion Area.</li>
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
        </div>
      </div>
    );
    if (view === "sky") return (
      <div style={{ ...SUBBAR, marginBottom: 0, alignItems: "flex-end" }}>
        <div style={SUBTAB_ROW}>
          <button type="button" style={subTab(skyMode === "pomodoro")} onClick={() => setSkyMode("pomodoro")}><TomatoIcon size={13} on={skyMode === "pomodoro"} />Pomo</button>
          <button type="button" style={subTab(skyMode === "wave")} onClick={() => setSkyMode("wave")}><WaterIcon size={13} on={skyMode === "wave"} />Waves</button>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", height: 28 }}>
        <InfoHover C={C} label="about your Sky" width={330}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Your Sky</div>
          <div><b>Pomo</b> lights an amber star for every pomodoro you log; <b>Waves</b> is a second, silver sky with one star per urge you surf - however the wave ended, noticing it is the whole achievement. Recent stars shine brighter. Work you claim after the fact lights a quieter copper star: same sky, different instrument.</div>
          <div style={{ marginTop: 6 }}>Drag to roam and scroll to zoom. Hover a star for its story, or near a constellation for its name.</div>
        </InfoHover>
        </div>
      </div>
    );
    return null;
  };

  return (
    <div ref={rootRef} style={{ background: C.paper, height: "100%", overflow: "hidden", color: C.ink, fontFamily: "var(--fl-display)", fontVariantNumeric: "tabular-nums" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700&display=swap');
        :root{ --fl-display:'Baloo 2',Georgia,'Iowan Old Style',serif; --fl-mono:'Baloo 2',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; }
      `}</style>
      <div style={{ display: "flex", alignItems: "stretch", height: "100%" }}>
        {/* Slack-style rail: a light-brown column the full height of the page, with the
            buttons sticky inside it. Focus stays lit for any of its three faces; clicking
            it returns to the pomodoro. The active icon sits on a white cubic button, the
            same active-on-track language as the app's other controls. */}
        <div style={{ flex: "0 0 58px", background: "#EFE5D3", boxSizing: "border-box", overflowY: "auto" }}>
          {/* The dove badge, Slack's workspace-logo spot: bigger than the view squares, on a
              very light pink card. Decorative for now - it becomes the coffee button later. */}
          <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 0" }}>
            <span title="a future coffee corner" style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, boxSizing: "border-box", borderRadius: 12, background: C.card, boxShadow: "0 1px 4px rgba(43,39,35,0.14)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <img src={doveBadgeImg} alt="" draggable={false} style={{ width: 28, height: 28, objectFit: "contain" }} />
            </span>
          </div>
          <nav aria-label="views" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, padding: "44px 2px 16px" }}>
            {NAV_TABS.map(([t, lab, Icon]) => {
              const on = t === "log" ? isFocusView(view) : view === t;
              return (
                <button key={t} onClick={() => setView(t)} aria-label={lab}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 54, padding: 0, border: "none", background: "transparent", boxShadow: "none", cursor: "pointer", color: on ? C.ink : C.muted, fontFamily: "var(--fl-display)" }}>
                  <span style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, boxSizing: "border-box", flexShrink: 0, borderRadius: 9, background: on ? C.card : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s ease" }}><Icon size={18} on={on} /></span>
                  <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, lineHeight: 1 }}>{lab}</span>
                </button>
              );
            })}
          </nav>
        </div>
        {/* The content column: the title and each view's sub-bar stay pinned above a thin
            full-width line (the Slack pattern), and only the body below the line scrolls. */}
        <div style={{ flex: "1 1 auto", minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 8px 0 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "0 0 6px" }}>
          <h1 style={{ fontFamily: "var(--fl-display)", fontSize: 26, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>{viewTitle}</h1>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setView("history")} aria-label="history: every calibration, break, pomodoro and pause ever logged" style={{ ...ICON_BTN, padding: 2, color: view === "history" ? C.ink : C.muted, borderBottom: `2px solid ${view === "history" ? "#C57B5A" : "transparent"}`, borderRadius: 0 }}><TimePastIcon size={16} /></button>
            <button onClick={() => api.openSettings && api.openSettings()} aria-label="open the Focus Log settings" style={{ ...ICON_BTN, padding: 2 }}><SettingsIcon size={16} /></button>
          </div>
        </div>
              {pinnedBar()}
            </div>
          </div>
          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", scrollbarGutter: "stable" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "14px 8px 60px 16px" }}>
        {view === "today" && flash && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16, color: C.ink, fontSize: 12.5 }}>
            {flash}
            {pending.length > 0 && <button onClick={retryPending} style={{ ...btn(C.worse, true), marginLeft: 10, padding: "3px 10px" }}>retry {pending.length}</button>}
          </div>
        )}

        {calibDraft && (() => {
          const d = calibDraft;
          const over = d.mode === "over";
          const REASONS = over
            ? ["hidden scope", "interrupted", "low energy", "perfectionism", "learning curve", "waiting on someone"]
            : ["overestimated it", "knew more than I thought", "smaller scope", "good flow", "cut scope on purpose"];
          const chipStyle = (on: boolean): any => ({ padding: "3px 11px", borderRadius: 999, border: on ? `1px solid ${over ? "#D9A521" : "#3E78B2"}` : `1px solid ${over ? "#D9A521" : "#3E78B2"}`, background: on ? (over ? "#D9A521" : "#3E78B2") : (over ? "#FBEFC9" : "#DCEAF6"), color: on ? "#fdfbf6" : "#2b2723", fontSize: 12, cursor: "pointer", boxShadow: "none", fontFamily: "var(--fl-display)" });
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(43,39,35,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setCalibDraft(null)}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.line}`, padding: 16, width: "min(440px, 92vw)", boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, overflowWrap: "anywhere" }}>{over ? "The task grew: " : "Finished early: "}{stripLeadingTag(d.task)}</div>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: "var(--fl-mono)", margin: "4px 0 10px" }}>
                  {"guess " + d.guess + " · spend " + d.spend + (over ? " · adding round " + d.round + " of 2" : " · " + Math.max(1, d.guess - d.spend) + " \u{1F345} back")}
                </div>
                {over && d.round === 2 && <div style={{ fontSize: 11.5, color: "#c96f22", margin: "0 0 8px" }}>Second extra round: if it still doesn't fit, consider splitting the task.</div>}
                {over && <>
                  <div style={{ fontSize: 12, color: C.muted, margin: "0 0 6px" }}>how much bigger?</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} onClick={() => setCalibDraft({ ...d, count: n })} aria-label={n === 4 ? "add one box (4 pomodoros)" : "add " + n + " pomodoro" + (n > 1 ? "s" : "")}
                        style={{ padding: "3px 11px", borderRadius: 999, border: `1px solid ${(d.count || 1) === n ? "#c96f22" : C.faint}`, background: (d.count || 1) === n ? "#F8D8B4" : "#fffefc", color: "#2b2723", fontSize: 12, cursor: "pointer", boxShadow: "none", fontFamily: "var(--fl-display)" }}>
                        {n === 4 ? "\u{1F4E6}" : "\u{1F345}".repeat(n)}
                      </button>
                    ))}
                  </div>
                </>}
                <div style={{ fontSize: 12, color: C.muted, margin: "0 0 6px" }}>{over ? "what showed up?" : "what made it lighter?"}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {REASONS.map((r) => (<button key={r} onClick={() => setCalibDraft({ ...d, reason: r })} style={chipStyle(d.reason === r)}>{r}</button>))}
                </div>
                {!over && <>
                  <div style={{ fontSize: 12, color: C.muted, margin: "0 0 6px" }}>the spare tomato goes to…</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {["a bonus task", "a longer break", "bank it"].map((r) => (<button key={r} onClick={() => setCalibDraft({ ...d, spare: r })} style={{ padding: "3px 11px", borderRadius: 999, border: `1px solid ${MODE_COLORS.relax.border}`, background: d.spare === r ? MODE_COLORS.relax.solid : MODE_COLORS.relax.fill, color: d.spare === r ? "#fdfbf6" : "#2b2723", fontSize: 12, cursor: "pointer", boxShadow: "none", fontFamily: "var(--fl-display)" }}>{r}</button>))}
                  </div>
                </>}
                <input value={d.note || ""} onChange={(e) => setCalibDraft({ ...d, note: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && d.reason) saveCalibration(); if (e.key === "Escape") setCalibDraft(null); }} placeholder="optional: one line about it (doubles as the lesson)" style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontSize: 12.5, borderRadius: 8, padding: "6px 10px", marginBottom: 12, fontFamily: "var(--fl-display)" }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setCalibDraft(null)} style={{ ...btn(C.muted, true), borderRadius: 999, padding: "5px 14px", fontSize: 12.5 }}>cancel</button>
                  <button onClick={saveCalibration} disabled={!d.reason} style={{ ...btn(C.ink), borderRadius: 999, padding: "5px 16px", fontSize: 12.5, opacity: d.reason ? 1 : 0.5, cursor: d.reason ? "pointer" : "default" }}>{over ? "add + " + ((d.count || 1) === 4 ? "\u{1F4E6}" : "\u{1F345}".repeat(d.count || 1)) : "save"}</button>
                </div>
              </div>
            </div>
          );
        })()}

        {view === "sky" && <SkyView sessions={sessions} urges={urges} C={C} mode={skyMode} />}

        {view === "calendar" && (<>
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingLeft: 4 }}>
                  <span ref={monthLabelRef} aria-label="scroll to change the month" style={{ fontFamily: "var(--fl-display)", fontVariantNumeric: "tabular-nums", fontSize: 16, fontWeight: "var(--h3-weight, 600)" as any, color: C.ink, letterSpacing: "-0.01em", lineHeight: 1, cursor: "ns-resize", userSelect: "none" }}>
                    <span style={{ display: "inline-block", minWidth: "2.3em" }}>{MON3[monthRef.getMonth()]}</span>
                    <span style={{ color: ACCENT, marginLeft: "0.1em" }}>{monthRef.getFullYear()}</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button onClick={() => setMonthOff((m) => m - 1)} aria-label="previous month" style={{ background: "transparent", border: "none", boxShadow: "none", color: C.ink, cursor: "pointer", padding: 5, borderRadius: 7, display: "inline-flex", alignItems: "center" }}><ChevronLeftIcon size={20} /></button>
                    <button onClick={() => { setMonthOff(0); setTodayFlash(true); window.setTimeout(() => setTodayFlash(false), 450); api.openDailyNote && api.openDailyNote(+logicalDay(Date.now(), settings)); }} aria-label="jump to the current month and open today's daily note - 'today' follows your day-start setting, so after an evening rollover it is already tomorrow's date" style={{ background: todayFlash ? "#E4D3B8" : "transparent", transition: "background 0.35s ease", border: "none", boxShadow: "none", color: ACCENT, cursor: "pointer", padding: "5px 8px", borderRadius: 7, fontFamily: "var(--fl-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.02em" }}>TODAY</button>
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
        </>)}


        {view === "calibrate" && (() => {
          // Calibration surfaces tasks whose reality diverged from the guess: extra "+" rounds,
          // an early finish (Spend below the base guess), or a final Split/Solved status. The
          // reflection column fills in later, when adding a "+ tomato" in the plugin prompts for it.
          // Patterns: one final entry per task (the latest), hits = within one tomato of the guess.
          const perTask: any = {};
          calibrations.forEach((e: any) => { perTask[e.pageId || e.task] = e; });
          const finals: any[] = Object.values(perTask);
          const hits = finals.filter((e: any) => Math.abs((e.spend || 0) - (e.guess || 0)) <= 1).length;
          const pct = finals.length ? Math.round((hits / finals.length) * 100) : null;
          const recent5 = finals.slice(-5);
          const improving = finals.length >= 8 && recent5.filter((e: any) => Math.abs((e.spend || 0) - (e.guess || 0)) <= 1).length / recent5.length > hits / finals.length;
          const countReasons = (dir: string) => { const c: any = {}; calibrations.filter((e: any) => e.direction === dir).forEach((e: any) => { c[e.reason] = (c[e.reason] || 0) + 1; }); return Object.entries(c).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).slice(0, 3); };
          const grew = countReasons("over");
          const shrank = countReasons("under");
          const areaAgg: any = {};
          finals.forEach((e: any) => { if (e.category && e.guess > 0) (areaAgg[e.category] = areaAgg[e.category] || []).push((e.spend || 0) / e.guess); });
          const multipliers = Object.entries(areaAgg).map(([a, xs]: any) => [a, xs.reduce((s: number, x: number) => s + x, 0) / xs.length] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 4);
          const avgMiss = finals.length ? finals.reduce((s: number, e: any) => s + Math.abs((e.spend || 0) - (e.guess || 0)), 0) / finals.length : null;
          const statCard = (title: string, body: any) => (
            <div style={{ background: "#fffefc", border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 14px", minWidth: 170, flex: 1 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: C.ink }}>{body}</div>
            </div>
          );
          // ---- the eleven panels, lifted verbatim from the old Calibrate / Stats / Break / Pause
          // views. They stay closures so every derivation above and in the component body is
          // still in scope: nothing about the numbers changed, only where they are shown.
          const secGuessLand = () => (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
                <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 10px" }}>How your guesses land</h3>
                {pct == null ? (
                  <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No calibrations yet. Add a {"+\u{1F345}"} when a task grows, or click a grey tomato when one finishes early, and your calibration score builds from there.</p>
                ) : (
                  <div style={{ fontSize: 15, color: C.ink, marginBottom: (grew.length || shrank.length || multipliers.length) ? 12 : 0 }}>
                    <span style={{ color: MODE_COLORS.relax.solid, fontSize: 22, fontWeight: 700 }}>{pct}%</span>
                    {" of your calibrated tasks landed within one "}{"\u{1F345}"}
                    {improving && <span style={{ color: C.muted }}> (and improving)</span>}
                    <span style={{ color: C.muted, fontSize: 12 }}>{" · " + finals.length + " task" + (finals.length === 1 ? "" : "s")}{avgMiss != null ? " · avg miss " + avgMiss.toFixed(1) + " \u{1F345}" : ""}</span>
                  </div>
                )}
                {(grew.length > 0 || shrank.length > 0 || multipliers.length > 0) && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {grew.length > 0 && statCard("when tasks grew", grew.map(([r, n]: any) => r + " ×" + n).join(" · "))}
                    {shrank.length > 0 && statCard("when tasks shrank", shrank.map(([r, n]: any) => r + " ×" + n).join(" · "))}
                    {multipliers.length > 0 && statCard("area multipliers", multipliers.map(([a, v]) => a + " ×" + v.toFixed(1)).join(" · "))}
                  </div>
                )}
              </div>
          );
          const secPomodoroStats = () => (<div>
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0 }}>Pomodoro totals</h3>
                  <InfoHover C={C} label="about pomodoro totals" width={330}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Pomodoro totals</div>
                    <div>Counts and hours for this calendar week, month and year.</div>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      <li><b>Heatmap</b>: one square per day over six months, the newest week at the left; darker means more (the steps come from the heat-thresholds setting).</li>
                      <li>Yellow-stacked overnight pomodoros count toward the day they lead into, same as everywhere else.</li>
                    </ul>
                  </InfoHover>
                </div>
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
                {/* the density strip lives under the same title: one card = the long count of doing */}
                <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, margin: "14px 0 8px" }}>Six-month heatmap</p>
                <ContribHeatmap sessions={sessions} settings={settings} />
              </div>
          </div>);
          const secExpectedVsActual = () => (
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
                        <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Biggest surprises - dreaded, then enjoyed</p>
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
          );
          const secBreakStats = () => (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0 }}>Break stats</h3>
                  <InfoHover C={C} label="about break stats" width={330}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Break stats</div>
                    <div>How you actually rest.</div>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      <li><b>Favourites</b>: the activities you tick most, with their counts.</li>
                      <li><b>This week / month</b>: breaks logged in each window.</li>
                      <li><b>Pie</b>: your break time split by the activities' Areas.</li>
                    </ul>
                  </InfoHover>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Favourites</p>
                    {favs.length === 0 ? <span style={{ color: C.muted, fontSize: 13 }}>{"-"}</span> : favs.map((a) => (
                      <div key={a.id} style={{ fontSize: 13 }}>{a.name} <span style={{ color: C.muted, fontFamily: "var(--fl-mono)", fontSize: 11 }}>{a.count}{"×"}</span></div>
                    ))}
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Least chosen</p>
                    {disliked.length === 0 ? <span style={{ color: C.muted, fontSize: 13 }}>{"-"}</span> : disliked.map((a) => (
                      <div key={a.id} style={{ fontSize: 13, color: C.muted }}>{a.name} <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11 }}>{a.count || 0}{"×"}</span></div>
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>By area</p>
                <PieChart data={pieData} />
              </div>
          );
          const secPauseStats = () => (
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
                    <div style={{ fontSize: 14, color: C.ink }}>{topPauseWeek ? `${topPauseWeek.tag} (${topPauseWeek.n})` : "-"}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>top this month</div>
                    <div style={{ fontSize: 14, color: C.ink }}>{topPauseMonth ? `${topPauseMonth.tag} (${topPauseMonth.n})` : "-"}</div>
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
          );
          const secBestTime = () => (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0 }}>Best time of day</h3>
                  <InfoHover C={C} label="about best time of day" width={330}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Best time of day</div>
                    <div>The average after-rating (1{"\u2013"}5) of your pomodoros in each band; the green bar is your best.</div>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      <li>Bands follow the My-day settings: morning until \u201CMorning ends\u201D, afternoon until \u201CAfternoon ends\u201D, evening after.</li>
                      <li>The {"\u{1F345}"} count beside each bar is the sample size {"-"} small samples wobble.</li>
                    </ul>
                  </InfoHover>
                </div>
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
                            <span style={{ width: 64, textAlign: "right", fontFamily: "var(--fl-mono)", fontSize: 12, color: C.muted }}>{b.avg != null ? (b.avg as number).toFixed(1) : "-"} · {b.count}{"\u{1F345}"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
          );
          const secCatchUp = () => {
            // The catch-up day runs morning to morning: during the overnight stretch the day
            // you just finished stays on screen, so it can still be tidied before bed. A
            // pomodoro done NOW in that stretch belongs to tomorrow (same rule as the yellow
            // calendar squares) and will appear starred in tomorrow's Morning group.
            const dayKey = +logicalDay(Date.now(), settings) - (isOvernight(Date.now(), settings) ? DAY : 0);
            const daySess = sessions
              .filter((s: any) => +logicalDay(s.ts, settings) === dayKey)
              .sort((a: any, b: any) => (+new Date(a.ts)) - (+new Date(b.ts)));
            const unnamed = (s: any) => !s.task || s.task === "Focus";
            const groupsCu: any[][] = [[], [], []];
            daySess.forEach((s: any) => { groupsCu[isOvernight(s.ts, settings) ? 0 : bandOf(s.ts, settings)].push(s); });
            const missing = daySess.filter(unnamed).length;
            const saveName = (id: any) => {
              const cur = sessions.find((x: any) => x.id === id);
              const v = (cuEdit && cuEdit.id === id ? cuEdit.v : "").trim();
              setCuEdit(null);
              if (!cur || !v || v === (cur.task || "")) return;
              const next = sessions.map((s: any) => (s.id === id ? { ...s, task: v } : s));
              setSessions(next); api.saveSessions && api.saveSessions(next);
              // the daily note follows: the old block is swapped for the new one when it still
              // matches what the logger wrote (a hand-edited line is left alone).
              if (api.renameDaily) api.renameDaily({ ts: +new Date(cur.ts), minutes: cur.minutes || 25, oldTask: cur.task || "", newTask: v, hierarchy: cur.hierarchy || "", note: cur.note || "", category: cur.category || null })
                .then((ok: boolean) => { api.notify && api.notify(ok ? "Renamed - daily note updated." : "Renamed. The daily-note line looked different, so it was left as is."); })
                .catch(() => {});
            };
            return (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0 }}>Today's pomodoros</h3>
                  <span style={{ color: C.muted, fontSize: 12, fontFamily: "var(--fl-mono)" }}>{daySess.length} {"\u{1F345}"}{missing > 0 ? " · " + missing + " unnamed" : ""}</span>
                </div>
                <p style={{ color: C.muted, fontSize: 12.5, margin: "0 0 12px" }}>A quiet ledger, open until tomorrow morning: name the unnamed whenever it suits you. It still counts.</p>
                {daySess.length === 0 ? (
                  <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No pomodoros on this day yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {groupsCu.map((list, gi) => list.length > 0 && (
                      <div key={gi}>
                        <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 5px" }}>{BAND_NAME[gi]}</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {list.map((s: any) => (
                            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 11px", borderRadius: 8, background: "#fdfbf5", border: `1px solid ${C.line}`, fontSize: 13, color: C.ink }}>
                              {isOvernight(s.ts, settings) && <span title="an overnight head start - done after the day started, before morning began" style={{ color: OVERNIGHT_COLOR, display: "inline-flex", flexShrink: 0 }}><StarIcon size={13} /></span>}
                              {cuEdit && cuEdit.id === s.id ? null : !unnamed(s) ? (
                                <span role="button" title="click to rename; the daily note follows" onClick={() => setCuEdit({ id: s.id, v: "" })} style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", cursor: "pointer" }}>{stripLeadingTag(s.task)}</span>
                              ) : null}
                              {cuEdit && cuEdit.id === s.id ? (
                                <input autoFocus list="fl-catchup-tasks" value={cuEdit.v} onChange={(e) => setCuEdit({ id: s.id, v: e.target.value })}
                                  onKeyDown={(e) => { if (e.key === "Enter") saveName(s.id); if (e.key === "Escape") setCuEdit(null); }}
                                  onBlur={() => saveName(s.id)} placeholder={unnamed(s) ? "what was this one for?" : stripLeadingTag(s.task)}
                                  style={{ flex: 1, minWidth: 120, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 12.5, borderRadius: 6, padding: "4px 8px", fontFamily: "var(--fl-display)" }} />
                              ) : unnamed(s) ? (
                                <button onClick={() => setCuEdit({ id: s.id, v: "" })} style={{ flex: 1, textAlign: "left", border: `1.5px dashed ${C.faint}`, background: "transparent", color: C.muted, boxShadow: "none", borderRadius: 999, padding: "3px 11px", fontSize: 12.5, fontFamily: "var(--fl-display)", cursor: "pointer" }}>name this pomodoro…</button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <datalist id="fl-catchup-tasks">{orderedTasks.map((t: any) => (<option key={t.id || t.task} value={t.task} />))}</datalist>
                  </div>
                )}
              </div>
            );
          };
          return (
            <div>
              {calibSub === "today" && secCatchUp()}
              {calibSub === "accuracy" && (<>{secGuessLand()}<div style={{ marginTop: 14 }}>{secExpectedVsActual()}</div></>)}
              {calibSub === "total" && (
                <div>
                  {secPomodoroStats()}
                  <div style={{ marginTop: 20 }}>{secBestTime()}</div>
                  <div style={{ marginTop: 20 }}>{secBreakStats()}</div>
                  <div style={{ marginTop: 20 }}>{secPauseStats()}</div>
                </div>
              )}
            </div>
          );
        })()}


        {/* The full record lives behind the corner history icon: one list per kind, two
            levels of title only. Edits and deletes only change the local log. */}
        {view === "history" && (() => {
          const secCalibHistory = () => (calibrations.length === 0
            ? <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No calibrations yet. Add a {"+\u{1F345}"} when a task grows, or click a grey tomato when one finishes early.</p></div>
            : (
                <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: foldedHistory.has("calibrations") ? 0 : 10 }}>
                    <h3 onClick={() => toggleFold("calibrations")} style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><AngleIcon size={15} down={!foldedHistory.has("calibrations")} /> All calibrations</h3>
                    <span style={{ color: C.muted, fontSize: 12, fontFamily: "var(--fl-mono)" }}>{calibrations.length} logged</span>
                  </div>
                  {foldedHistory.has("calibrations") ? null : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {calibrations.slice().reverse().map((e: any) => (
                      <div key={e.id} className="fl-act-row" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "7px 11px", borderRadius: 8, background: "#fdfbf5", border: `1px solid ${C.line}`, fontSize: 12.5, color: C.ink }}>
                        <span style={{ flex: 1, minWidth: 140, fontWeight: 600, overflowWrap: "anywhere" }}>{stripLeadingTag(e.task)}</span>
                        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, color: C.muted, flexShrink: 0 }}>guess {e.guess} {"→"} spend {e.spend}</span>
                        <span style={{ background: e.direction === "over" ? "#FBEFC9" : "#DCEAF6", border: `1px solid ${e.direction === "over" ? "#D9A521" : "#3E78B2"}`, color: "#2b2723", borderRadius: 999, padding: "1px 9px", fontSize: 11, flexShrink: 0 }}>{e.reason}</span>
                        <button onClick={() => { const arr = calibrations.filter((x: any) => x.id !== e.id); setCalibrations(arr); api.saveCalibrations && api.saveCalibrations(arr); }} className="fl-rowact fl-rowdel fl-collapse" aria-label="delete this calibration entry (the Notion Guess rounds and the daily-note line are not touched)" style={ICON_BTN}><TrashIcon size={13} /></button>
                        {e.note && <span style={{ color: C.muted, fontSize: 11, flexBasis: "100%" }}>{e.note}</span>}
                      </div>
                    ))}
                  </div>}
                </div>
          ));
          const secAllSessions = () => (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                  <h3 onClick={() => toggleFold("sessions")} style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><AngleIcon size={15} down={!foldedHistory.has("sessions")} /> All sessions</h3>
                  <span style={{ color: C.muted, fontSize: 12, fontFamily: "var(--fl-mono)" }}>{sessions.length} logged{(() => { const n = urges.filter((u: any) => !u.outcome || u.outcome === "surfed").length; return n ? " · \u{1F30A} " + n + " surfed" : ""; })()}</span>
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
          );
          const secAllBreaks = () => (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                  <h3 onClick={() => toggleFold("breaks")} style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><AngleIcon size={15} down={!foldedHistory.has("breaks")} /> All breaks</h3>
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
                          <span style={{ flex: 1, minWidth: 120, overflowWrap: "anywhere" }}>{(b.activities && b.activities.length) ? b.activities.join(", ") : "-"}</span>
                          <span style={{ fontSize: 11, color: C.muted, fontFamily: "var(--fl-mono)", minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>{(b.areas && b.areas.length) ? b.areas.join(" · ") : ""}</span>
                          {b.feeling != null && (BREAK_SEASONS[b.feeling - 1]
                            ? <img src={BREAK_SEASONS[b.feeling - 1].img} alt={BREAK_SEASONS[b.feeling - 1].name} aria-label={BREAK_SEASONS[b.feeling - 1].name} draggable={false} style={{ width: 16, height: 16, flexShrink: 0 }} />
                            : <span style={{ fontSize: 11, fontFamily: "var(--fl-mono)", color: C.ink, whiteSpace: "nowrap" }}>{b.feeling}/5</span>)}
                          <button onClick={() => startEditBreak(b)} className="fl-rowact fl-collapse" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
                          <button onClick={() => deleteBreak(b.id)} className="fl-rowact fl-rowdel fl-collapse" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
          );
          const secAllPauses = () => (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                  <h3 onClick={() => toggleFold("pauses")} style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><AngleIcon size={15} down={!foldedHistory.has("pauses")} /> All pauses</h3>
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
                          <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, minWidth: 34 }}>{p.mins != null ? p.mins + "m" : "-"}</span>
                          {/* the reason wears its category: yellow came from you, blue came at you.
                              A tag deleted since the pause was logged falls back to internal, as the stats do. */}
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "inline-block", padding: "1px 10px", borderRadius: 999, background: catColor(pauseCatOf(p.tag)), border: `1px solid ${catBorder(pauseCatOf(p.tag))}`, color: C.ink, fontSize: 12, maxWidth: "100%", overflowWrap: "anywhere", lineHeight: 1.45 }}>{p.tag}</span>
                          </span>
                          <button onClick={() => startEditPause(p)} className="fl-rowact fl-collapse" aria-label="edit" style={ICON_BTN}><PencilIcon size={14} /></button>
                          <button onClick={() => deletePause(p.id)} className="fl-rowact fl-rowdel fl-collapse" aria-label="delete" style={ICON_BTN}><TrashIcon size={14} /></button>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
          );
          return (
            <div>
              {historySub === "calib" && secCalibHistory()}
              {historySub === "break" && secAllBreaks()}
              {historySub === "pomo" && secAllSessions()}
              {historySub === "pause" && secAllPauses()}
            </div>
          );
        })()}

        {view === "today" && (
          <div>
            {fallingEnjoyment && (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.worse}`, borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: C.ink, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 200 }}>Enjoyment is dipping over your last few pomodoros, consider an extra break.</span>
                <button onClick={() => { startBreak(); setView("break"); }} style={{ ...btn(ACCENT, true), padding: "3px 10px" }}>take a break</button>
              </div>
            )}
            {tasks.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>No tasks yet. Set your Notion token in settings, then press sync.</p>}
            {renderTodaySections()}
          </div>
        )}


        {surfCount && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(43,39,35,0.35)", zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => (api.cancelSurfCountdown ? api.cancelSurfCountdown() : setSurfCount(null))}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "min(340px, 92vw)", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
              <div style={{ fontFamily: "var(--fl-display)", fontSize: 15, fontWeight: 700, color: C.ink }}>Off to the wave in</div>
              <div style={{ fontFamily: "var(--fl-mono)", fontSize: 44, fontWeight: 700, color: ACCENT, lineHeight: 1.2, margin: "6px 0 2px", fontVariantNumeric: "tabular-nums" }}>{surfCount.left}</div>
              <button onClick={() => (api.cancelSurfCountdown ? api.cancelSurfCountdown() : setSurfCount(null))} style={{ ...btn(C.muted, true), padding: "6px 16px", fontSize: 12.5, borderRadius: 999, marginTop: 10, maxWidth: "100%", overflowWrap: "anywhere" }}>{surfCount.task ? "cancel, continue on “" + stripLeadingTag(surfCount.task) + "”" : "cancel"}</button>
            </div>
          </div>
        )}
        {surfOpen && surf && (() => {
          const surfMins = Math.max(2, Math.min(15, settings.urgeSurfMinutes || 5));
          const deadline = surf.startTs + surfMins * 60000;
          const rem = Math.max(0, deadline - nowTick);
          const over = rem <= 0;
          const lastRate = surf.curve.length ? surf.curve[surf.curve.length - 1] : null;
          const nudge = !over && (!lastRate || nowTick - lastRate.t > 90000);
          const remTxt = String(Math.floor(rem / 60000)) + ":" + String(Math.floor((rem % 60000) / 1000)).padStart(2, "0");
          // The rating buttons ARE the chart's y-axis. A six-item column laid out with
          // space-between over H puts each button's centre exactly on yOf(v) - but only while
          // the vertical padding stays half a button tall, so keep PTT/PBT tied to RBTN.
          const RATES = [10, 8, 6, 4, 2, 0], RBTN = 24;
          const W = 490, H = 200, PLT = 6, PRT = 8, PTT = RBTN / 2, PBT = RBTN / 2;
          const span = Math.max(surfMins * 60000, nowTick - surf.startTs);
          const xOf = (t: number) => PLT + ((t - surf.startTs) / span) * (W - PLT - PRT);
          const yOf = (v: number) => PTT + (1 - v / 10) * (H - PTT - PBT);
          const pts = surf.curve.map((c: any) => ({ x: xOf(c.t), y: yOf(c.v) }));
          let path = "";
          if (pts.length === 1) path = "M " + pts[0].x + " " + pts[0].y + " L " + (pts[0].x + 0.01) + " " + pts[0].y;
          else if (pts.length > 1) {
            path = "M " + pts[0].x + " " + pts[0].y;
            for (let i = 0; i < pts.length - 1; i++) {
              const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
              path += " C " + (p1.x + (p2.x - p0.x) / 6) + " " + (p1.y + (p2.y - p0.y) / 6) + ", " + (p2.x - (p3.x - p1.x) / 6) + " " + (p2.y - (p3.y - p1.y) / 6) + ", " + p2.x + " " + p2.y;
            }
          }
          const area = pts.length > 1 ? path + " L " + pts[pts.length - 1].x + " " + yOf(0) + " L " + pts[0].x + " " + yOf(0) + " Z" : "";
          const cur = lastRate ? lastRate.v : null;
          const setS = (patch: any) => setSurf((s0: any) => ({ ...s0, ...patch }));
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(43,39,35,0.35)", zIndex: 92, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => { setSurfOpen(false); setSurf(null); }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 94vw)", maxHeight: "88vh", overflowY: "auto", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontFamily: "var(--fl-display)", fontSize: 15.5, fontWeight: 700, color: C.ink, flex: 1, display: "flex", alignItems: "center", gap: 7 }}><span style={{ color: "#3E78B2", display: "inline-flex" }}><SeaWaveIcon size={16} /></span>An urge is here</div>
                  <span style={{ fontFamily: "var(--fl-mono)", fontSize: 13, color: over ? "#3E78B2" : C.muted, fontVariantNumeric: "tabular-nums" }}>{over ? "the wave has had its time" : remTxt}</span>
                </div>
                <div className="fl-surf-tabs" role="tablist" aria-label="the wave, the body, the feeling around it" style={{ display: "inline-flex", gap: 3, padding: 3, borderRadius: 999, border: `1px solid ${C.line}`, background: C.paper, margin: "10px 0 0" }}>
                  {[{ k: "wave", label: "Wave", n: surf.curve.length, Icon: WaterIcon }, { k: "body", label: "Body", n: (surf.body || []).length, Icon: WalkingIcon }, { k: "mood", label: "Emotions", n: (surf.moods || []).length, Icon: StomachIcon }].map((t) => {
                    const on = surfTab === t.k;
                    // The 90-second nudge follows the Wave pill while another tab is open.
                    const call = t.k === "wave" && nudge && !on;
                    return (
                      <button key={t.k} role="tab" aria-selected={on} onClick={() => setSurfTab(t.k as any)}
                        style={{ padding: "4px 13px", borderRadius: 999, border: "none", background: on ? "#DCEAF6" : "transparent", color: on ? "#1d4f80" : C.muted, boxShadow: call ? "0 0 0 2px #DCEAF6" : "none", transition: "box-shadow 0.4s", fontSize: 12.5, fontWeight: on ? 600 : 400, fontFamily: "var(--fl-display)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <t.Icon size={13} on={on} />{t.label}
                        {/* a quiet dot, so picks on the hidden sides are still visible */}
                        {t.n > 0 && <span aria-label={t.n + " chosen"} style={{ width: 5, height: 5, borderRadius: 999, background: "#3E78B2", display: "inline-block" }} />}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12.5, color: (surfTab === "wave" && nudge) ? "#3E78B2" : C.muted, margin: "7px 0 8px", transition: "color 0.4s" }}>{surfTab === "wave" ? "How strong is it now?" : surfTab === "body" ? "Where do I feel this in my body?" : "What emotions am I experiencing?"}</div>
                {/* One slot, one height: the three decisions below never move when tabs change. */}
                <div className="fl-surf-pane" style={{ minHeight: 320 }}>
                  {surfTab === "wave" && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 12px" }}>
                        <div className="fl-breath" aria-hidden="true" />
                        <div style={{ fontSize: 12.5, color: C.muted }}>Each breath helps you stay balanced on the wave.</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: H, flexShrink: 0 }}>
                          {RATES.map((v) => (
                            <button key={v} onClick={() => setS({ curve: [...surf.curve, { t: Date.now(), v }] })} aria-label={"rate the urge " + v + " of 10"}
                              style={{ width: RBTN, height: RBTN, minWidth: RBTN, padding: 0, borderRadius: 999, border: `1.5px solid ${cur === v ? "#3E78B2" : C.faint}`, background: cur === v ? "#DCEAF6" : "transparent", color: cur === v ? "#3E78B2" : C.muted, boxShadow: "none", fontSize: 11.5, fontFamily: "var(--fl-mono)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{v}</button>
                          ))}
                        </div>
                        {/* preserveAspectRatio=none keeps the 200px height (and so the axis
                            alignment) when the dialog narrows; strokes opt out of the stretch. */}
                        <svg viewBox={"0 0 " + W + " " + H} preserveAspectRatio="none" style={{ flex: "1 1 auto", minWidth: 0, height: H, display: "block" }} aria-label="the wave: your ratings over time">
                          {RATES.map((g) => (<line key={g} x1={PLT} x2={W - PRT} y1={yOf(g)} y2={yOf(g)} stroke={g === 0 ? C.faint : C.line} strokeWidth={1} vectorEffect="non-scaling-stroke" />))}
                          {area && <path d={area} fill="#DCEAF6" opacity={0.55} stroke="none" />}
                          {path && <path d={path} fill="none" stroke="#3E78B2" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
                          {pts.map((pt: any, i: number) => (<circle key={i} cx={pt.x} cy={pt.y} r={2.6} fill="#3E78B2" />))}
                          <line x1={xOf(nowTick)} x2={xOf(nowTick)} y1={PTT} y2={H - PBT} stroke={C.faint} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                      <input value={surf.note} onChange={(e) => setS({ note: e.target.value })} placeholder="This is an urge, not a command. I decide after the wave has passed"
                        style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontSize: 12.5, borderRadius: 8, padding: "7px 10px", fontFamily: "var(--fl-display)", marginTop: 12 }} />
                    </>
                  )}
                  {surfTab === "body" && <BodyMap value={surf.body} onChange={(b: any) => setS({ body: b })} C={C} />}
                  {surfTab === "mood" && <MoodGrid feelings={feelingWords} C={C} value={surf.moods} onChange={(m: any) => setS({ moods: m })} />}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => finishSurf("paused")} aria-label="park this thought: pause the pomodoro and tag why" style={{ ...btn(C.muted, true), padding: "6px 12px", fontSize: 12.5, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6 }}><BoxIcon size={13} />Park this thought</button>
                  <button onClick={() => finishSurf("acted")} aria-label="switch intentionally: a deliberate yes, decided after the wave" style={{ ...btn(C.muted, true), padding: "6px 12px", fontSize: 12.5, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6 }}><ShuffleIcon size={13} />Switch intentionally</button>
                  <button onClick={() => finishSurf("surfed")} aria-label="return to my task: the urge was outlasted, and it counts" style={{ ...btn("#3E78B2"), padding: "6px 14px", fontSize: 12.5, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6 }}><SeaWaveIcon size={13} />Return to my task</button>
                </div>
              </div>
            </div>
          );
        })()}
        {claimOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(43,39,35,0.35)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setClaimOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 92vw)", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
              <div style={{ fontWeight: 700, fontSize: 15.5, color: C.ink, marginBottom: 2, fontFamily: "var(--fl-display)" }}>Claim finished work</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>Work done off the timer still counts. Rough is fine; when unsure, claim the smaller number.</div>
              <input list="fl-claim-tasks" value={clTask} onChange={(e) => setClTask(e.target.value)} placeholder="link a task, or type a name"
                style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontSize: 12.5, borderRadius: 8, padding: "7px 10px", fontFamily: "var(--fl-display)", marginBottom: 10 }} />
              <datalist id="fl-claim-tasks">{tasks.map((t: any) => (<option key={t.id || t.task} value={t.task} />))}</datalist>
              {clTask.trim() !== "" && !tasks.some((t: any) => t.task === clTask.trim()) && !!api.createTask && !!settings.notionToken && (
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>not in your list yet:</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 2, border: `1px solid ${C.line}`, background: C.paper, borderRadius: 999, padding: "0 6px 0 9px", height: 28, boxSizing: "border-box", flexShrink: 0 }}>
                    <span aria-hidden="true" style={{ fontSize: 11, lineHeight: 1 }}>{"\u{1F345}"}</span>
                    <input type="number" min={1} max={4} value={clGuess} onChange={(e) => setClGuess(e.target.value)} aria-label="initial Guess in pomodoros" style={{ width: 26, border: "none", boxShadow: "none", background: "transparent", color: C.ink, fontSize: 12, textAlign: "center", fontFamily: "var(--fl-mono)", padding: 0 }} />
                  </span>
                  <select value={clParent} onChange={(e) => setClParent(e.target.value)} aria-label="where it goes in Notion: a common task, or a sub-task under a BIG TASK" style={{ maxWidth: 150, border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontSize: 12, borderRadius: 999, padding: "5px 8px", fontFamily: "var(--fl-display)", flexShrink: 0 }}>
                    <option value="">{"⏳ Common task"}</option>
                    {quickParents.map((p: any) => (<option key={p.id} value={p.id}>{"\u{1F43E} " + p.name}</option>))}
                  </select>
                  <button onClick={async () => { if (clCreating) return; setClCreating(true); try { const g = Math.max(0, Math.min(4, Math.round(Number(clGuess) || 0))); const t = await api.createTask(clTask.trim(), clParent || null, g); setTasks((prev: any[]) => [t, ...prev]); api.notify && api.notify('"' + t.task + '" is in Notion.'); } catch (e) { api.notify && api.notify("Could not create the task in Notion."); } setClCreating(false); }} disabled={clCreating}
                    style={{ ...btn(ACCENT, true), padding: "4px 10px", fontSize: 12, borderRadius: 999, opacity: clCreating ? 0.6 : 1 }}>add to Notion</button>
                </div>
              )}
              {(() => {
                const cp = claimParse();
                const sb1 = settings.breakMinutes || 5;
                // The claim's pomodoro is always the classic 25 minutes, whatever the live
                // timer is set to; n pomodoros span n*25 plus the short breaks between them.
                const chips = [1, 2, 3, 4].map((k) => ({ k, mins: k * 25 + (k - 1) * sb1, label: k === 4 ? "\u{1F4E6}" : "\u{1F345}".repeat(k) }));
                const clk = (m: number) => { const v = ((m % 1440) + 1440) % 1440; return String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0"); };
                const pick = (c: any) => {
                  if (clAnchor === "start" && cp.st0 != null) setClEnd(clk(cp.st0 + c.mins));
                  else if (cp.en0 != null) setClStart(clk(cp.en0 - c.mins));
                };
                return (<>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {chips.map((c) => {
                      const on = cp.span === c.mins;
                      return <button key={c.k} onClick={() => pick(c)} aria-pressed={on}
                        title={c.k === 1 ? "one pomodoro - 25m" : c.k === 4 ? "a box: four pomodoros and their short breaks - " + c.mins + "m" : c.k + " pomodoros and " + (c.k - 1) + " short break" + (c.k > 2 ? "s" : "") + " - " + c.mins + "m"}
                        aria-label={"claim " + (c.k === 4 ? "a box, four pomodoros" : c.k + " pomodoro" + (c.k > 1 ? "s" : "")) + ", " + c.mins + " minutes"}
                        style={{ ...btn(on ? ACCENT : C.muted, !on), padding: "4px 10px", fontSize: 12.5, borderRadius: 999 }}>{c.label}</button>;
                    })}
                    <span style={{ fontSize: 11.5, color: C.muted }}>{clAnchor === "start" ? "a tomato sets the end, forward from your start" : "a tomato sets the start, back from the end"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>from</span>
                    <input type="time" value={clStart} onChange={(e) => { setClStart(e.target.value); setClAnchor("start"); }} aria-label="when you started"
                      style={{ border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontSize: 12, borderRadius: 8, padding: "3px 6px", fontFamily: "var(--fl-mono)" }} />
                    <span style={{ fontSize: 12, color: C.muted }}>to</span>
                    <input type="time" value={clEnd} onChange={(e) => { setClEnd(e.target.value); setClAnchor("end"); }} aria-label="when you finished - now, if it just ended"
                      style={{ border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontSize: 12, borderRadius: 8, padding: "3px 6px", fontFamily: "var(--fl-mono)" }} />
                    {cp.err && <span role="alert" style={{ fontSize: 11.5, color: C.worse }}>{cp.err}</span>}
                  </div>
                </>);
              })()}
              {(() => {
                // Meals inside the claimed span: confirm when they ACTUALLY happened. The claim
                // splits around them, and the meal block moves to the time typed here.
                const bl0 = todayBlocks();
                if (!bl0.length) return null;
                const cp = claimParse();
                if (cp.err || cp.st0 == null || cp.en0 == null) return null;
                const sA = cp.st0 as number, sB = cp.en0 as number;
                const covered = bl0.filter((x: any) => x.kind === "meal" && x.start < sB && x.start + x.dur > sA);
                if (!covered.length) return null;
                return (
                  <div style={{ border: `1px solid ${C.line}`, background: C.paper, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>That span crosses a meal. When did it actually happen? The claim splits around it, and only the worked minutes count.</div>
                    {covered.map((m4: any) => (
                      <div key={m4.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        <span style={{ fontSize: 12.5, color: C.ink, minWidth: 60 }}>{m4.name}</span>
                        <input type="time" value={(clMealEdits[m4.id] && clMealEdits[m4.id].start) ?? fmtClock(m4.start % 1440)} onChange={(e) => setClMealEdits((p: any) => ({ ...p, [m4.id]: { ...(p[m4.id] || {}), start: e.target.value } }))} aria-label={m4.name + " actual start time"}
                          style={{ border: `1px solid ${C.line}`, background: C.card, color: C.ink, fontSize: 12, borderRadius: 8, padding: "3px 6px", fontFamily: "var(--fl-mono)" }} />
                        <input type="number" min={5} max={240} value={(clMealEdits[m4.id] && clMealEdits[m4.id].len) ?? m4.dur} onChange={(e) => setClMealEdits((p: any) => ({ ...p, [m4.id]: { ...(p[m4.id] || {}), len: e.target.value } }))} aria-label={m4.name + " actual length in minutes"}
                          style={{ width: 52, border: `1px solid ${C.line}`, background: C.card, color: C.ink, fontSize: 12, borderRadius: 8, padding: "3px 6px", textAlign: "center", fontFamily: "var(--fl-mono)" }} />
                        <span style={{ fontSize: 11.5, color: C.muted }}>min</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => setClaimOpen(false)} style={{ ...btn(C.muted, true), padding: "5px 12px", fontSize: 12.5 }}>cancel</button>
                <button onClick={doClaim} disabled={clBusy || !clTask.trim() || !!claimParse().err} style={{ ...btn(ACCENT), padding: "5px 14px", fontSize: 12.5, opacity: clBusy || !clTask.trim() || !!claimParse().err ? 0.6 : 1 }}>claim it</button>
              </div>
            </div>
          </div>
        )}
        {view === "log" && <LogForm tasks={orderedTasks} preset={preset} onAdd={logPomodoro} settings={settings} secs={secs} running={running} resetTimer={restartTimer} onSurf={openSurf} pomoMin={pomoMin} changePomo={changePomo} stepPomo={stepPomo} chooseNext={chooseNext} setChooseNext={setChooseNext} nextTask={nextTask} setNextTask={setNextTask} onStart={onStart} onPickTask={(v: string) => { setPreset(v); api.timer && api.timer.setTask(v); }} onPause={onPause} pauseActive={pauseActive} paused={timer.paused} pauseTags={pauseTags} pauseTag={pauseTag} setPauseTag={setPauseTag} tagColor={tagColor} tagBorder={tagBorder} floatOn={floatOn} setFloatOn={setFloatOn} lenLocked={lenLocked} finished={finished} finishedTs={timer.finishedAt} expected={timer.expected} onSetExpected={setExpectedRating} whisper={rainWhisper} autoLogDefault={settings.autoLogOnRate !== false} onAutoLogChange={(v: boolean) => api.patchSettings && api.patchSettings({ autoLogOnRate: v })} />}
        {view === "log" && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 16px", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ minWidth: 200, flex: 1 }}>
              <div style={{ fontFamily: "var(--fl-display)", fontSize: 15, fontWeight: 700, color: C.ink }}>It still counts</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Focus that happened off the timer still moved your goal. Claim it and let it count.</div>
            </div>
            <button onClick={() => { setClaimOpen(true); setClTask(preset || ""); }} aria-label="log work you already did off the timer: Spend, timeline, star and daily note, all marked as claimed" style={{ ...btn(C.muted, true), padding: "5px 14px", fontSize: 12.5, borderRadius: 999, flexShrink: 0 }}>{"✋ claim finished work"}</button>
          </div>
        )}

        {view === "break" && (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0 }}>Start a break</h3>
              <button onClick={() => startBreak(settings.breakMinutes)} style={{ ...btn(C.ink, true), borderRadius: 999, padding: "6px 16px" }}>short · {settings.breakMinutes}m</button>
              <button onClick={() => startBreak(settings.longBreakMinutes)} style={{ ...btn(C.ink, true), borderRadius: 999, padding: "6px 16px" }}>long · {settings.longBreakMinutes}m</button>
            </div>
            {/* Moved off the old Timeline toolbar: it sets the rhythm of the day's rests,
                so it belongs with the breaks rather than with a schedule. */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>Long break every</span>
              <div style={{ display: "inline-flex", alignItems: "center", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: 3, gap: 2, height: 32, boxSizing: "border-box" }}>
                {[3, 4, 5].map((n) => {
                  const on = (longEvery >= 3 ? longEvery : 3) === n;
                  return (
                    <button key={n} onClick={() => { setLongEveryState(n); api.patchSettings && api.patchSettings({ longBreakEvery: n }); }} aria-pressed={on} aria-label={`a long break every ${n} pomodoros`}
                      style={{ border: "none", boxShadow: "none", background: on ? ACCENT : "transparent", color: on ? "#fff" : C.muted, fontFamily: "var(--fl-mono)", fontSize: 12, fontWeight: on ? 700 : 500, borderRadius: 999, padding: "0 11px", height: 24, cursor: "pointer" }}>{n}</button>
                  );
                })}
              </div>
              <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>pomodoros</span>
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
                <p style={{ color: C.muted, fontSize: 12, margin: "0 0 8px" }}>Pick up to 3 - tap an activity ({brk.picked.length}/3):</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {activities.length === 0 ? <span style={{ color: C.muted, fontSize: 13 }}>No activities yet - end the break to add some.</span> :
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


          </div>
        )}
      </div>
          </div>
        </div>
      </div>
    </div>
  );
}
