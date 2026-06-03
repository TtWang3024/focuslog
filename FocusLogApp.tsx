import * as React from "react";
const { useState, useEffect, useRef, useCallback } = React;

// Focus Log UI. `api` bridge from the plugin:
//   settings, getInitial(), saveSessions, savePending, saveTasks, sync, writeAct, notify(msg,ms), celebrate()
// Scoring is enjoyment-based: expected enjoyment BEFORE, actual enjoyment AFTER.
// A higher actual is the good outcome (green); a lower actual is worse (red).

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
  paper: "#f5f1e8", card: "#fbf8f1", ink: "#2b2723", muted: "#8a8175",
  faint: "#cfc7b8", line: "#e4ddcf", better: "#5b8c5a", worse: "#b4533a", neutral: "#a59c8c",
};

const DAY = 86400000;
const startOfDay = (d: any) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
function weekStartOf(d: any, sundayStart?: boolean) { const x = startOfDay(d); const k = sundayStart ? x.getDay() : (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; }
// Hours to shift a timestamp before taking its calendar date. A morning start (0–12)
// pushes the boundary later into the morning, so late-night work stays on the previous
// day (subtract). An evening start (13–23) rolls the day over that night, so the late
// hours fall on the next date (add).
const dayShift = (s: any) => { const h = s.dayStart || 0; return h <= 12 ? h : h - 24; };
const logicalDay = (ts: any, s: any) => startOfDay(new Date(ts).getTime() - dayShift(s) * 3600000);
const logicalWeekStart = (ts: any, s: any) => weekStartOf(logicalDay(ts, s), s.weekStartsSunday);
function bandOf(ts: any, s: any) {
  const h = new Date(ts).getHours();
  const ds = s.dayStart || 0;
  if (ds <= 12 && h < ds) return 2; // pre-dawn tail of a morning-offset day reads as evening
  if (h < s.morningEnd) return 0;
  if (h < s.afternoonEnd) return 1;
  return 2;
}
function timeColor(ts: any, s: any) {
  const w = WEEKDAY[logicalDay(ts, s).getDay()];
  return `hsl(${w.h} ${w.s}% ${BAND_L[bandOf(ts, s)]}%)`;
}
const weekdayInk = (wd: number) => { const w = WEEKDAY[wd]; return `hsl(${w.h} ${Math.max(w.s, 4)}% 40%)`; };
const sameLogicalDay = (a: any, b: any, s: any) => logicalDay(a, s).getTime() === logicalDay(b, s).getTime();
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
const HEAT = ["#f3d9bf", "#eab784", "#df8a4e", "#c9603a", "#a23b22"];
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
  const heat = (n: number) => { if (!n) return "#e8e0cf"; const cap = Math.min(n, 8); return HEAT[Math.min(HEAT.length - 1, Math.floor(((cap - 1) / 8) * HEAT.length))]; };

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
      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 8, fontSize: 10, color: C.muted }}>
        less {["#e8e0cf", ...HEAT].map((c, i) => (<span key={i} style={{ width: CELL, height: CELL, borderRadius: 2, background: c, border: `1px solid ${C.line}`, boxSizing: "border-box" }} />))} more
      </div>
    </div>
  );
}

const PIE = ["#b4533a", "#cda32f", "#5b8c5a", "#4e7d9c", "#9a6f9c", "#c0772e", "#6f9461", "#847bb2"];
function polarPt(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function PieChart({ data }: any) {
  const total = data.reduce((a: number, d: any) => a + d.value, 0);
  if (!total) return <p style={{ color: C.muted, fontSize: 13 }}>No break activities logged yet.</p>;
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

function LogForm({ tasks, preset, onAdd, settings, secs, running, setRunning, resetTimer }: any) {
  const [task, setTask] = useState(preset || (tasks[0] && tasks[0].task) || "");
  const [exp, setExp] = useState(3);
  const [act, setAct] = useState(3);
  const [note, setNote] = useState("");
  const [markDone, setMarkDone] = useState(false);

  useEffect(() => setTask(preset || (tasks[0] && tasks[0].task) || ""), [preset, tasks]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const meta: any = tasks.find((t: any) => t.task === task) || {};
  const submit = () => {
    if (!task.trim()) return;
    onAdd({ id: Date.now(), task: task.trim(), group: meta.group || task.trim(), hierarchy: hierarchyText(meta), load: meta.load || null, category: meta.category || null, url: meta.url || null, pageId: meta.id || null, ts: new Date().toISOString(), expected: exp, actual: act, note: note.trim(), minutes: 25 }, markDone);
    setNote("");
    setMarkDone(false);
  };
  const inputStyle: any = { border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 14, width: "100%", borderRadius: 6, padding: "8px 12px", boxSizing: "border-box", lineHeight: 1.5 };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, maxWidth: 460, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.line}` }}>
        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 30, color: secs === 0 ? C.better : C.ink }}>{mm}:{ss}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setRunning((r: boolean) => !r)} style={btn(C.ink)}>{running ? "pause" : "start 25m"}</button>
          <button onClick={resetTimer} style={btn(C.muted, true)}>reset</button>
        </div>
      </div>
      <label style={{ color: C.muted, fontSize: 12 }}>task (Act +1 writes to this page)</label>
      <select value={task} onChange={(e) => setTask(e.target.value)} style={{ ...inputStyle, marginTop: 4, marginBottom: 12, padding: "10px 12px", lineHeight: 1.6, height: "auto", minHeight: 44 }}>
        {tasks.map((t: any) => (<option key={t.task} value={t.task}>{t.task}{t.king ? " \u{1F451}" : ""}</option>))}
      </select>
      <Scale label="before: how enjoyable do I expect this to be? (1 dull ... 5 great)" value={exp} onChange={setExp} color={settings.beginColor} />
      <Scale label="after: how enjoyable was it actually? (1 dull ... 5 great)" value={act} onChange={setAct} color={settings.endColor} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="quick note (optional)" style={{ ...inputStyle, marginBottom: 14, marginTop: 4 }} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13, color: C.ink, cursor: "pointer" }}>
        <input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.better, cursor: "pointer" }} />
        also set this task's status to Done in Notion
      </label>
      <button onClick={submit} style={{ ...btn(C.ink), width: "100%", padding: "10px" }}>log pomodoro + write Act</button>
    </div>
  );
}

function SessionRow({ s, settings, onEdit, onDelete }: any) {
  const d = new Date(s.ts);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: C.paper, border: `1px solid ${C.line}` }}>
      <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11, color: C.muted, minWidth: 96 }}>{fmtDate(d)} {fmtTime(d)}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.ink, overflowWrap: "anywhere" }}>{s.task}</div>
      <span style={{ fontFamily: "var(--fl-mono)", fontSize: 12, whiteSpace: "nowrap" }}>
        <span style={{ color: settings.beginColor }}>{s.expected}</span>
        <span style={{ color: C.muted }}> {"→"} </span>
        <span style={{ color: settings.endColor }}>{s.actual}</span>
      </span>
      <button onClick={() => onEdit(s)} style={btn(C.muted, true)}>edit</button>
      <button onClick={() => onDelete(s)} style={btn(C.worse, true)}>delete</button>
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
  const [preset, setPreset] = useState("");
  const [weekOff, setWeekOff] = useState(0);
  const [monthOff, setMonthOff] = useState(0);
  const [sync, setSync] = useState("idle");
  const [flash, setFlash] = useState("");
  const settings = api.settings;
  const [goal, setGoal] = useState<number>(Number(settings.dailyGoal) || 8);
  const [editingGoal, setEditingGoal] = useState(false);
  const saveGoal = (n: number) => { const g = Math.max(1, Math.min(99, Math.round(n) || 1)); setGoal(g); api.patchSettings && api.patchSettings({ dailyGoal: g }); setEditingGoal(false); };

  // Break activities + the post-log break timer.
  const [activities, setActivities] = useState<any[]>(init.activities || []);
  const saveActivities = (next: any[]) => { setActivities(next); api.saveActivities && api.saveActivities(next); };
  const [brk, setBrk] = useState<any>({ active: false, secs: 0, running: false, picked: [], finished: false });
  const brkTick = useRef<any>(null);
  const [newAct, setNewAct] = useState<any>({ name: "", area: "" });
  useEffect(() => {
    if (!brk.active || !brk.running) return;
    brkTick.current = setInterval(() => {
      setBrk((b: any) => {
        if (!b.active || !b.running) return b;
        const nx = b.secs > 0 ? b.secs - 1 : 0;
        if (nx === 0 && !b.finished) { api.notify("Break over — ready for the next pomodoro?", 6000); return { ...b, secs: 0, running: false, finished: true }; }
        return { ...b, secs: nx };
      });
    }, 1000);
    return () => clearInterval(brkTick.current);
  }, [brk.active, brk.running]);
  const startBreak = () => setBrk({ active: true, secs: (Number(settings.breakMinutes) || 5) * 60, running: settings.breakAutoStart !== false, picked: [], finished: false });
  const togglePick = (id: string) => setBrk((b: any) => {
    if (b.picked.includes(id)) return { ...b, picked: b.picked.filter((x: string) => x !== id) };
    if (b.picked.length >= 3) return b;
    return { ...b, picked: [...b.picked, id] };
  });
  const endBreak = () => {
    if (brk.picked.length) {
      const now = Date.now();
      saveActivities(activities.map((a) => brk.picked.includes(a.id) ? { ...a, count: (a.count || 0) + 1, lastUsed: now } : a));
    }
    setBrk({ active: false, secs: 0, running: false, picked: [], finished: false });
    setView("today");
  };
  const addActivity = () => {
    const name = (newAct.name || "").trim();
    if (!name) return;
    saveActivities([...activities, { id: "a" + Date.now(), name, area: (newAct.area || "").trim() || "Other", count: 0, lastUsed: null }]);
    setNewAct({ name: "", area: "" });
  };
  const removeActivity = (id: string) => saveActivities(activities.filter((a) => a.id !== id));

  // Timer state lives here so it survives tab switches (LogForm mounts/unmounts).
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const tick = useRef<any>(null);
  const fired = useRef<any>({});

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => {
      setSecs((x: number) => {
        const nx = x > 0 ? x - 1 : 0;
        if (nx === 900 && !fired.current[900]) { fired.current[900] = true; api.notify("15 minutes left. Still on this task?", 6000); }
        if (nx === 300 && !fired.current[300]) { fired.current[300] = true; api.notify("5 minutes left. Stay with it.", 6000); }
        if (nx === 0 && !fired.current[0]) { fired.current[0] = true; api.celebrate(); }
        return nx;
      });
    }, 1000);
    return () => clearInterval(tick.current);
  }, [running]);
  useEffect(() => { if (secs === 0) setRunning(false); }, [secs]);

  const resetTimer = () => { setRunning(false); setSecs(25 * 60); fired.current = {}; };

  // Session edit/delete state for Totals view.
  const [editingId, setEditingId] = useState<any>(null);
  const [editDraft, setEditDraft] = useState<any>(null);

  // Drag-to-reorder for the Today list. The order persists; on sync, queryToday keeps
  // already-ranked tasks in place and floats brand-new ones to the top.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const moveTask = (from: number | null, to: number) => {
    if (from == null || from === to) return;
    const a = [...tasks];
    const [m] = a.splice(from, 1);
    a.splice(to, 0, m);
    setTasks(a);
    api.saveTasks(a);
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
  const weekGroups = Array.from(new Set(weekSessions.map((s) => s.group || s.task)));

  const nowLD = logicalDay(Date.now(), settings);
  const wkStartNow = logicalWeekStart(Date.now(), settings);
  const countWeek = sessions.filter((s) => { const d = logicalDay(s.ts, settings); return d >= wkStartNow && d < new Date(wkStartNow.getTime() + 7 * DAY); }).length;
  const countMonth = sessions.filter((s) => { const d = logicalDay(s.ts, settings); return d.getMonth() === nowLD.getMonth() && d.getFullYear() === nowLD.getFullYear(); }).length;
  const countYear = sessions.filter((s) => logicalDay(s.ts, settings).getFullYear() === nowLD.getFullYear()).length;
  const countToday = sessions.filter((s) => sameLogicalDay(s.ts, Date.now(), settings)).length;
  const hrs = (c: number) => (Math.round((c * 25) / 6) / 10).toFixed(1);
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

  // Break activity stats: most-reached-for (top 3), least (bottom 2), and the Area distribution.
  const actByCount = [...activities].sort((a, b) => (b.count || 0) - (a.count || 0));
  const favs = actByCount.filter((a) => (a.count || 0) > 0).slice(0, 3);
  const disliked = actByCount.slice().reverse().slice(0, 2);
  const areaAgg: any = {};
  activities.forEach((a) => { if ((a.count || 0) > 0) areaAgg[a.area || "Other"] = (areaAgg[a.area || "Other"] || 0) + (a.count || 0); });
  const pieData = Object.keys(areaAgg).map((k, i) => ({ label: k, value: areaAgg[k], color: PIE[i % PIE.length] }));

  const openLog = (leafTask: string) => { setPreset(leafTask); setView("log"); };

  const tab = (t: string): any => ({ padding: "7px 16px", borderRadius: 999, border: `1.5px solid ${view === t ? C.ink : C.faint}`, background: view === t ? C.ink : "transparent", color: view === t ? "#fff" : C.muted, fontSize: 13, cursor: "pointer", textTransform: "capitalize" });

  return (
    <div style={{ background: C.paper, minHeight: "100%", color: C.ink, fontFamily: "var(--fl-display)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700&display=swap');
        :root{ --fl-display:'Baloo 2',Georgia,'Iowan Old Style',serif; --fl-mono:ui-monospace,'SF Mono',Menlo,monospace; }
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
            <span style={{ marginLeft: 4 }}>{"\u{1F451}"} = King {"·"} day starts at {settings.dayStart}:00</span>
          </div>
        </div>

        {flash && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16, color: C.ink, fontSize: 12.5 }}>
            {flash}
            {pending.length > 0 && <button onClick={retryPending} style={{ ...btn(C.worse, true), marginLeft: 10, padding: "3px 10px" }}>retry {pending.length}</button>}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {["today", "week", "month", "totals", "log", "break"].map((t) => (<button key={t} onClick={() => setView(t)} style={tab(t)}>{t}</button>))}
        </div>

        {view === "today" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: C.muted, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                {tasks.length} tasks {"\u00B7"} {countToday} /
                {editingGoal ? (
                  <input
                    type="number" min={1} max={99} autoFocus defaultValue={goal}
                    onBlur={(e) => saveGoal(Number(e.target.value))}
                    onKeyDown={(e) => { if (e.key === "Enter") saveGoal(Number((e.target as HTMLInputElement).value)); if (e.key === "Escape") setEditingGoal(false); }}
                    style={{ width: 40, fontSize: 12, padding: "1px 4px", border: `1px solid ${C.faint}`, borderRadius: 4, fontFamily: "var(--fl-mono)" }}
                  />
                ) : (
                  <button onClick={() => setEditingGoal(true)} title="click to set today's goal" style={{ border: "none", background: "transparent", color: C.ink, fontFamily: "var(--fl-mono)", fontSize: 12, cursor: "pointer", textDecoration: "underline dotted", padding: 0 }}>{goal}</button>
                )}
                {"\u{1F345}"} today
              </span>
              <button onClick={doSync} style={btn(C.ink, true)} disabled={sync === "loading"}>{sync === "loading" ? "syncing\u2026" : "sync from Notion"}</button>
            </div>
            {tasks.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>No tasks yet. Set your Notion token in settings, then press sync.</p>}
            {tasks.length > 1 && <p style={{ color: C.muted, fontSize: 11, margin: "0 0 8px" }}>Drag the grip to reorder. The order is kept for tomorrow; new tasks from Notion appear on top.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tasks.map((t, i) => {
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
                return (
                  <div
                    key={key}
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
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                      <TomatoPips vivid={done} grey={remaining} />
                      <span style={{ fontSize: 10.5, color: C.muted, fontFamily: "var(--fl-mono)" }}>{completed} done</span>
                    </div>
                    <button onClick={() => openLog(t.task)} style={btn(C.muted, true)}>log</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "week" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => setWeekOff((w) => w - 1)} style={btn(C.muted, true)}>{"\u2190"}</button>
              <span style={{ fontFamily: "var(--fl-mono)", fontSize: 13 }}>{fmtDate(weekStart)} {"\u2013"} {fmtDate(new Date(+weekEnd - DAY))}</span>
              <button onClick={() => setWeekOff((w) => Math.min(0, w + 1))} style={btn(C.muted, true)}>{"\u2192"}</button>
            </div>
            {weekGroups.length === 0 ? <p style={{ color: C.muted, textAlign: "center", padding: "40px 0" }}>No pomodoros this week.</p> :
              weekGroups.map((g) => (<GroupChart key={g} group={g} sessions={weekSessions.filter((x) => (x.group || x.task) === g)} settings={settings} />))}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 11, color: C.muted }}>
              <span><span style={{ color: settings.beginColor }}>{"\u25CF"}</span> expected</span>
              <span><span style={{ color: settings.endColor }}>{"\u25CF"}</span> actual</span>
              <span><span style={{ color: C.better }}>{"\u2014"}</span> better than expected</span>
              <span><span style={{ color: C.worse }}>{"\u2014"}</span> worse than expected</span>
            </div>
          </div>
        )}

        {view === "month" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => setMonthOff((m) => m - 1)} style={btn(C.muted, true)}>{"\u2190"}</button>
              <span style={{ fontFamily: "var(--fl-mono)", fontSize: 13 }}>{monthRef.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
              <button onClick={() => setMonthOff((m) => Math.min(0, m + 1))} style={btn(C.muted, true)}>{"\u2192"}</button>
            </div>
            <Heatmap sessions={sessions} monthRef={monthRef} settings={settings} />
          </div>
        )}

        {view === "totals" && (
          <div>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>All pomodoros, every project combined.</p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-around" }}>
                <Stat label="this week" value={countWeek} big />
                <Stat label="this month" value={countMonth} big />
                <Stat label="this year" value={countYear} big />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-around", borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 4 }}>
                <Stat label="hours, week" value={hrs(countWeek)} color={C.muted} />
                <Stat label="hours, month" value={hrs(countMonth)} color={C.muted} />
                <Stat label="hours, year" value={hrs(countYear)} color={C.muted} />
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginTop: 20 }}>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>Last 6 months — pomodoros per day.</p>
              <ContribHeatmap sessions={sessions} settings={settings} />
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginTop: 20 }}>
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
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>Best time of day (average enjoyment).</p>
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
                <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: 0 }}>All sessions</h3>
                <span style={{ color: C.muted, fontSize: 12, fontFamily: "var(--fl-mono)" }}>{sessions.length} logged</span>
              </div>
              {sessions.length === 0 ? (
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
              <p style={{ color: C.muted, fontSize: 11, marginTop: 10 }}>
                Edits and deletes only change the local log; they do not undo the Act write-back on Notion.
              </p>
            </div>
          </div>
        )}

        {view === "log" && <LogForm tasks={tasks} preset={preset} onAdd={logPomodoro} settings={settings} secs={secs} running={running} setRunning={setRunning} resetTimer={resetTimer} />}

        {view === "break" && (
          <div>
            {brk.active && (
              <div style={{ background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--fl-mono)", fontSize: 30, color: brk.finished ? C.better : C.ink }}>{String(Math.floor(brk.secs / 60)).padStart(2, "0")}:{String(brk.secs % 60).padStart(2, "0")}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {!brk.finished && <button onClick={() => setBrk((b: any) => ({ ...b, running: !b.running }))} style={btn(C.ink)}>{brk.running ? "pause" : "start"}</button>}
                    <button onClick={endBreak} style={btn(C.muted, true)}>{brk.finished ? "back to today" : "end break"}</button>
                  </div>
                </div>
                <p style={{ color: C.muted, fontSize: 12, margin: "0 0 8px" }}>Pick up to 3 things to do on this break ({brk.picked.length}/3):</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {activities.length === 0 ? <span style={{ color: C.muted, fontSize: 13 }}>No activities yet — add some below.</span> :
                    activities.map((a) => {
                      const on = brk.picked.includes(a.id);
                      return <button key={a.id} onClick={() => togglePick(a.id)} style={{ padding: "6px 12px", borderRadius: 999, border: `1.5px solid ${on ? C.ink : C.faint}`, background: on ? C.ink : "transparent", color: on ? "#fff" : C.ink, fontSize: 13, cursor: "pointer", fontFamily: "var(--fl-display)" }}>{a.name}</button>;
                    })}
                </div>
              </div>
            )}

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 10px" }}>Break activities</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {activities.length === 0 && <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>None yet. Add an activity and an area below.</p>}
                {activities.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 10px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 }}>
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{a.name}</span>
                    <span style={{ fontSize: 11, color: C.muted, fontFamily: "var(--fl-mono)" }}>#{a.area}</span>
                    <span style={{ fontSize: 11, color: C.muted, fontFamily: "var(--fl-mono)" }}>{a.count || 0}{"×"}</span>
                    <span style={{ fontSize: 11, color: C.muted, fontFamily: "var(--fl-mono)", minWidth: 48, textAlign: "right" }}>{a.lastUsed ? fmtDate(a.lastUsed) : "—"}</span>
                    <button onClick={() => removeActivity(a.id)} style={{ ...btn(C.worse, true), padding: "3px 9px" }}>{"✕"}</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input value={newAct.name} onChange={(e) => setNewAct({ ...newAct, name: e.target.value })} placeholder="activity name" style={{ flex: 2, minWidth: 140, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "7px 10px" }} />
                <input value={newAct.area} onChange={(e) => setNewAct({ ...newAct, area: e.target.value })} placeholder="area / tag" style={{ flex: 1, minWidth: 90, border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 13, borderRadius: 6, padding: "7px 10px" }} />
                <button onClick={addActivity} style={btn(C.ink)}>add</button>
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
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
          </div>
        )}
      </div>
    </div>
  );
}
