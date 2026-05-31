import * as React from "react";
const { useState, useEffect, useRef, useCallback } = React;

// Focus Log UI. `api` bridge from the plugin:
//   settings, getInitial(), saveSessions, savePending, saveTasks, sync, writeAct, notify(msg,ms), celebrate()
// Scoring is enjoyment-based: expected enjoyment BEFORE, actual enjoyment AFTER.
// A higher actual is the good outcome (green); a lower actual is worse (red).

const LOAD_COLOR: any = { A: "#c0772e", B: "#4e7d9c", C: "#6f9461" };
const LOAD_LABEL: any = { A: "A high", B: "B medium", C: "C low" };

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
function mondayOf(d: any) { const x = startOfDay(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; }
const logicalDay = (ts: any, s: any) => startOfDay(new Date(ts).getTime() - (s.dayStart || 0) * 3600000);
const logicalWeekStart = (ts: any, s: any) => mondayOf(logicalDay(ts, s));
function bandOf(ts: any, s: any) {
  const h = new Date(ts).getHours();
  if (h < (s.dayStart || 0)) return 2;
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

function seedSessions() {
  const out: any[] = [];
  const ws = mondayOf(new Date());
  let id = 1;
  const push = (task: string, group: string, load: string, off: number, hour: number, exp: number, act: number, note: string) => {
    const t = new Date(ws); t.setDate(t.getDate() + off); t.setHours(hour, 0, 0, 0);
    out.push({ id: id++, task, group, load, pageId: null, url: null, ts: t.toISOString(), expected: exp, actual: act, note, minutes: 25 });
  };
  const P = "[Pro] mol-CSPy pipeline";
  push("[Pro] 1.1 review script", P, "B", 0, 10, 2, 4, "more fun than I thought");
  push("[Pro] 1.1 review script", P, "B", 1, 11, 3, 3, "");
  push("[Me] Pause Lab", "[Me] Pause Lab", "B", 1, 21, 2, 3, "");
  push("[Pro] 1.2 array job", P, "B", 2, 9, 3, 4, "");
  push("[G] stand up on Slack", "[G] stand up on Slack", "A", 2, 9, 4, 2, "draining today");
  push("[Pro] 1.3 ovito analysis", P, "B", 3, 20, 3, 4, "satisfying");
  push("[Pro] 1.1 review script", P, "B", 4, 11, 4, 4, "");
  return out;
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
  color: ghost ? color : "#fff", fontSize: 13, cursor: "pointer", fontFamily: "var(--fl-mono)",
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
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: any[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const headers = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

function LogForm({ tasks, preset, onAdd, settings, api }: any) {
  const [task, setTask] = useState(preset || (tasks[0] && tasks[0].task) || "");
  const [exp, setExp] = useState(3);
  const [act, setAct] = useState(3);
  const [note, setNote] = useState("");
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const tick = useRef<any>(null);
  const fired = useRef<any>({});

  useEffect(() => setTask(preset || (tasks[0] && tasks[0].task) || ""), [preset, tasks]);
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

  const reset = () => { setRunning(false); setSecs(25 * 60); fired.current = {}; };
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const meta: any = tasks.find((t: any) => t.task === task) || {};
  const submit = () => {
    if (!task.trim()) return;
    onAdd({ id: Date.now(), task: task.trim(), group: meta.group || task.trim(), load: meta.load || null, url: meta.url || null, pageId: meta.id || null, ts: new Date().toISOString(), expected: exp, actual: act, note: note.trim(), minutes: 25 });
    setNote("");
  };
  const inputStyle: any = { border: `1px solid ${C.faint}`, background: C.paper, color: C.ink, fontSize: 14, width: "100%", borderRadius: 6, padding: "8px 12px", boxSizing: "border-box", lineHeight: 1.5 };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, maxWidth: 460, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.line}` }}>
        <span style={{ fontFamily: "var(--fl-mono)", fontSize: 30, color: secs === 0 ? C.better : C.ink }}>{mm}:{ss}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setRunning((r) => !r)} style={btn(C.ink)}>{running ? "pause" : "start 25m"}</button>
          <button onClick={reset} style={btn(C.muted, true)}>reset</button>
        </div>
      </div>
      <label style={{ color: C.muted, fontSize: 12 }}>task (Act +1 writes to this page)</label>
      <select value={task} onChange={(e) => setTask(e.target.value)} style={{ ...inputStyle, marginTop: 4, marginBottom: 12, padding: "10px 12px", lineHeight: 1.6, height: "auto", minHeight: 44 }}>
        {tasks.map((t: any) => (<option key={t.task} value={t.task}>{t.task}</option>))}
      </select>
      <Scale label="before: how enjoyable do I expect this to be? (1 dull ... 5 great)" value={exp} onChange={setExp} color={settings.beginColor} />
      <Scale label="after: how enjoyable was it actually? (1 dull ... 5 great)" value={act} onChange={setAct} color={settings.endColor} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="quick note (optional)" style={{ ...inputStyle, marginBottom: 16, marginTop: 4 }} />
      <button onClick={submit} style={{ ...btn(C.ink), width: "100%", padding: "10px" }}>log pomodoro + write Act</button>
    </div>
  );
}

export default function FocusLogApp({ api }: any) {
  const init = api.getInitial();
  const [sessions, setSessions] = useState<any[]>(init.sessions);
  const [tasks, setTasks] = useState<any[]>(init.tasks);
  const [pending, setPending] = useState<any[]>(init.pending);
  const [settings, setSettings] = useState<any>(api.settings);
  const [doneSess, setDoneSess] = useState<any>({});
  const [view, setView] = useState("today");
  const [preset, setPreset] = useState("");
  const [weekOff, setWeekOff] = useState(0);
  const [monthOff, setMonthOff] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [sync, setSync] = useState("idle");
  const [flash, setFlash] = useState("");

  const persist = useCallback((next: any[]) => { setSessions(next); api.saveSessions(next); }, [api]);
  const savePending = useCallback((next: any[]) => { setPending(next); api.savePending(next); }, [api]);
  const saveSettings = (next: any) => { setSettings(next); api.saveSettings(next); };

  const doSync = async () => {
    setSync("loading");
    try { const fresh = await api.sync(); setTasks(fresh); setDoneSess({}); setSync("ok"); setFlash(fresh.length + " tasks loaded from Notion."); }
    catch (e: any) { setSync("error"); setFlash("Sync failed: " + (e?.message || e)); }
  };

  const logPomodoro = async (s: any) => {
    persist([...sessions, s]);
    const key = s.pageId || s.task;
    setDoneSess((m: any) => ({ ...m, [key]: (m[key] || 0) + 1 }));
    setView("today");
    if (!s.pageId) { setFlash("Logged. No Notion page linked, so Act was not written."); return; }
    setFlash("Logged. Writing Act +1 to Notion\u2026");
    try { const act = await api.writeAct(s.pageId); setFlash("Logged. Act" + (act != null ? " = " + act : " +1") + " written."); }
    catch (e: any) { savePending([...pending, { sessionId: s.id, pageId: s.pageId, task: s.task }]); setFlash("Logged locally. Notion write failed, queued."); }
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

  const openLog = (leafTask: string) => { setPreset(leafTask); setView("log"); };

  const tab = (t: string): any => ({ padding: "7px 16px", borderRadius: 999, border: `1.5px solid ${view === t ? C.ink : C.faint}`, background: view === t ? C.ink : "transparent", color: view === t ? "#fff" : C.muted, fontSize: 13, cursor: "pointer", textTransform: "capitalize" });
  const numInput: any = { width: 56, padding: "4px 6px", border: `1px solid ${C.faint}`, borderRadius: 6 };

  return (
    <div style={{ background: C.paper, minHeight: "100%", color: C.ink, fontFamily: "var(--fl-display)" }}>
      <style>{`:root{ --fl-display:Georgia,'Iowan Old Style',serif; --fl-mono:ui-monospace,'SF Mono',Menlo,monospace; }`}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 16px 60px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 }}>
          <h1 style={{ fontFamily: "var(--fl-display)", fontSize: 26, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>Focus Log</h1>
          <button onClick={() => setShowSettings((v) => !v)} style={btn(C.muted, true)}>settings</button>
        </div>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>Pomodoros against today's Notion tasks. Each log writes <span style={{ color: C.ink }}>Act +1</span>. The gap between <span style={{ color: settings.beginColor }}>expected</span> and <span style={{ color: settings.endColor }}>actual</span> enjoyment is the trend you watch. Day starts at {settings.dayStart}:00.</p>

        {flash && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16, color: C.ink, fontSize: 12.5 }}>
            {flash}
            {pending.length > 0 && <button onClick={retryPending} style={{ ...btn(C.worse, true), marginLeft: 10, padding: "3px 10px" }}>retry {pending.length}</button>}
          </div>
        )}

        {showSettings && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Day & time bands</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: C.muted }}>today begins at <input type="number" min={0} max={11} value={settings.dayStart} onChange={(e) => saveSettings({ ...settings, dayStart: Number(e.target.value) })} style={numInput} /></label>
              <label style={{ fontSize: 12, color: C.muted }}>morning ends at <input type="number" value={settings.morningEnd} onChange={(e) => saveSettings({ ...settings, morningEnd: Number(e.target.value) })} style={numInput} /></label>
              <label style={{ fontSize: 12, color: C.muted }}>afternoon ends at <input type="number" value={settings.afternoonEnd} onChange={(e) => saveSettings({ ...settings, afternoonEnd: Number(e.target.value) })} style={numInput} /></label>
            </div>
            <p style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Rating colors (chart dots only, not the heatmap)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>before / expected <input type="color" value={settings.beginColor} onChange={(e) => saveSettings({ ...settings, beginColor: e.target.value })} /></label>
              <label style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>after / actual <input type="color" value={settings.endColor} onChange={(e) => saveSettings({ ...settings, endColor: e.target.value })} /></label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => persist(seedSessions())} style={btn(C.muted, true)}>load sample</button>
              <button onClick={() => persist([])} style={btn(C.worse, true)}>clear log</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {["today", "week", "month", "totals", "log"].map((t) => (<button key={t} onClick={() => setView(t)} style={tab(t)}>{t}</button>))}
        </div>

        {view === "today" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: C.muted, fontSize: 12 }}>{tasks.length} tasks {"\u00B7"} {countToday} {"\u{1F345}"} today</span>
              <button onClick={doSync} style={btn(C.ink, true)} disabled={sync === "loading"}>{sync === "loading" ? "syncing\u2026" : "sync from Notion"}</button>
            </div>
            {tasks.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>No tasks yet. Set your Notion token in settings, then press sync.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tasks.map((t) => {
                const key = t.id || t.task;
                const done = doneSess[key] || 0;
                const est = t.pomodoros || 0;
                const completed = (t.act || 0) + done;
                const remaining = Math.max(0, est - completed);
                const hier = hierarchyText(t);
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 6, background: C.card, border: `1px solid ${C.line}` }}>
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: LOAD_COLOR[t.load] || C.neutral, flexShrink: 0 }} title={LOAD_LABEL[t.load]} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, lineHeight: 1.3, overflowWrap: "anywhere" }}>{t.task}</div>
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
        )}

        {view === "log" && <LogForm tasks={tasks} preset={preset} onAdd={logPomodoro} settings={settings} api={api} />}
      </div>
    </div>
  );
}
