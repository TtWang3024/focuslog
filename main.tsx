import { App, ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, normalizePath, requestUrl, setIcon } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import FocusLogApp from "./FocusLogApp";

export const VIEW_TYPE = "focuslog-view";
export const VIEW_TYPE_FLOAT = "focuslog-float";
const NOTION_VERSION = "2022-06-28";

// Best-effort access to Electron's remote module so we can pin a popout window
// on top of every other app. The module is deprecated and its availability
// varies by Obsidian/Electron version, so every path is guarded and the feature
// degrades gracefully (the window still opens, just not always-on-top).
function getElectronRemote(): any {
  const req = (mod: string) => {
    try {
      const r = (window as any).require;
      return r ? r(mod) : null;
    } catch {
      return null;
    }
  };
  const electron = req("electron");
  if (electron && electron.remote) return electron.remote;
  const remote = req("@electron/remote");
  if (remote) return remote;
  return null;
}

// Pause-category colours for the floating window's reason chips (internal=yellow, external=blue).
const FLOAT_CAT: any = {
  internal: { fill: "#FBEFC9", border: "#D9A521" },
  external: { fill: "#DCEAF6", border: "#3E78B2" },
};

export interface FocusLogSettings {
  notionToken: string;
  databaseId: string;
  doneStatus: string;
  categoryProperty: string;
  tagNamespace: string;
  showCategoryInView: boolean;
  writeCategoryTag: boolean;
  dailyGoal: number;
  dayStart: number;
  weekStartsSunday: boolean;
  morningEnd: number;
  afternoonEnd: number;
  beginColor: string;
  endColor: string;
  dailyNoteWrite: boolean;
  dailyNoteTrueDate: boolean;
  dailyHeading: string;
  dailyCreateHeading: boolean;
  dailyTemplate: string;
  createDailyIfMissing: boolean;
  dailyTitleFormat: string;
  dailyTemplatePath: string;
  dailyNoteFolder: string;
  counterEnabled: boolean;
  counterPrefix: string;
  breakEnabled: boolean;
  breakAutoStart: boolean;
  breakMinutes: number;
  autoLogOnRate: boolean;
  frozenTaskNames: string[];
  pomodoroMinutes: number;
  chooseNextTask: boolean;
  pauseTemplate: string;
  floatOnStart: boolean;
  floatAlwaysOnTop: boolean;
  floatBounds: { x: number; y: number; w: number; h: number } | null;
  floatBreakBounds: { x: number; y: number; w: number; h: number } | null;
}

const DEFAULT_SETTINGS: FocusLogSettings = {
  notionToken: "",
  databaseId: "24f3423255b680ce9dd5eb8eeece3ca0", // Pressure to Progress
  doneStatus: "",
  categoryProperty: "Area",
  tagNamespace: "Notion",
  showCategoryInView: true,
  writeCategoryTag: true,
  dailyGoal: 8,
  dayStart: 4,
  weekStartsSunday: false,
  morningEnd: 12,
  afternoonEnd: 18,
  beginColor: "#d98324",
  endColor: "#2f6f8f",
  dailyNoteWrite: true,
  dailyNoteTrueDate: true,
  dailyHeading: "\u{1F33B} Today",
  dailyCreateHeading: true,
  dailyTemplate:
    "- [ ] <mark class=\"hltr-yellow\">{date}</mark> {start} - {end} \u{1F345} {tag}\n    - {task}{hierarchy}\n    - {note}",
  createDailyIfMissing: true,
  dailyTitleFormat: "",
  dailyTemplatePath: "",
  dailyNoteFolder: "",
  counterEnabled: false,
  counterPrefix: "## \u{1F34E} Today_Pomodoro:: ",
  breakEnabled: false,
  breakAutoStart: true,
  breakMinutes: 5,
  autoLogOnRate: true,
  frozenTaskNames: [],
  pomodoroMinutes: 25,
  chooseNextTask: true,
  pauseTemplate: "- [ ] <mark class=\"hltr-pink\">{date}</mark> {pause-start} - {pause-end} ⏸️ {pause-tag}",
  floatOnStart: true,
  floatAlwaysOnTop: true,
  floatBounds: null,
  floatBreakBounds: null,
};

// Pause tags carry a category: "internal" (the impulse came from you) or
// "external" (something outside interrupted you).
const DEFAULT_PAUSE_TAGS = [
  { id: "p-bathroom", name: "bathroom", category: "internal" },
  { id: "p-water", name: "water / snack", category: "internal" },
  { id: "p-distracted", name: "got distracted", category: "internal" },
  { id: "p-tired", name: "tired", category: "internal" },
  { id: "p-phone", name: "phone", category: "external" },
  { id: "p-interrupted", name: "interrupted", category: "external" },
];
// Used to backfill a category onto tags saved before this field existed.
const PAUSE_TAG_DEFAULT_CAT: Record<string, string> = { phone: "external", interrupted: "external" };

const DEFAULT_ACTIVITIES = [
  { id: "a-stretch", name: "Stretch", area: "Body", count: 0, lastUsed: null },
  { id: "a-water", name: "Drink water", area: "Body", count: 0, lastUsed: null },
  { id: "a-eyes", name: "Rest eyes — look far", area: "Body", count: 0, lastUsed: null },
  { id: "a-breathe", name: "Deep breathing", area: "Mind", count: 0, lastUsed: null },
];

interface PluginData {
  settings: FocusLogSettings;
  sessions: any[];
  pending: any[];
  tasks: any[];
  activities: any[];
  pauseTags: any[];
  pauses: any[];
  breaks: any[];
}

// ---------- Notion property parsing ----------
function plainTitle(page: any): string {
  const t = page?.properties?.["Task"]?.title || [];
  return t.map((x: any) => x.plain_text).join("").trim();
}
function selectName(page: any, name: string): string | null {
  const prop = page?.properties?.[name];
  return prop?.select?.name || prop?.status?.name || null;
}
// Like selectName but also reads a multi_select (first value) — the category property may be either.
function categoryName(page: any, name: string): string | null {
  const prop = page?.properties?.[name];
  if (!prop) return null;
  return prop.select?.name || prop.status?.name || prop.multi_select?.[0]?.name || null;
}
function numberProp(page: any, name: string): number {
  const n = page?.properties?.[name]?.number;
  return typeof n === "number" ? n : 0;
}
// box = 4 pomodoros, tomato = 1, mountain = 1. An Est field may hold several options.
function optValue(name: string): number {
  if (!name) return 0;
  const boxes = (name.match(/\u{1F4E6}/gu) || []).length;
  const toms = (name.match(/\u{1F345}/gu) || []).length;
  const mts = (name.match(/\u{1F3D4}/gu) || []).length;
  return boxes * 4 + toms + mts;
}
function fieldValue(page: any, field: string): number {
  const ms = page?.properties?.[field]?.multi_select || [];
  return ms.reduce((a: number, o: any) => a + optValue(o.name), 0);
}
// Total estimate = sum of all three Est fields.
function estTotalOf(page: any): number {
  return fieldValue(page, "1 Est_T") + fieldValue(page, "2 Est_T") + fieldValue(page, "3 Est_T");
}
function mapLoad(name: string | null): string {
  if (!name) return "B";
  const c = name[0];
  return c === "A" || c === "B" || c === "C" ? c : "B";
}
// ExecutionPower select -> colour code. Default to Aim Today (yellow) when unset.
function mapPower(name: string | null): string {
  if (!name) return "Y";
  if (name.includes("Must")) return "P";
  if (name.includes("Bonus")) return "G";
  return "Y";
}
// Turn a category value into an Obsidian-tag-safe slug: drop emoji/punctuation, spaces -> "-".
// Keeps Unicode letters/digits (incl. CJK) plus underscore and hyphen.
function tagSlug(value: string): string {
  return (value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .replace(/^-+|-+$/g, "");
}
// Hours to shift a timestamp before taking its calendar date. A morning start (0–12)
// keeps late-night work on the previous day; an evening start (13–23) rolls the day over
// that night, so work after that hour counts toward the next date. Mirrors dayShift in the UI.
function dayShiftHours(dayStart: number): number {
  const h = dayStart || 0;
  return h <= 12 ? h : h - 24;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// Insert a block at the end of the section under a level-1 heading.
// If the heading is absent, optionally append it (with the block) at the end of the note.
function insertUnderHeading(data: string, heading: string, block: string, createIfMissing: boolean): string {
  const lines = data.split("\n");
  const headRe = new RegExp("^#\\s+" + escapeRe(heading) + "\\s*$");
  const hi = lines.findIndex((l) => headRe.test(l.trim()));
  const blockLines = block.split("\n");
  if (hi === -1) {
    if (!createIfMissing) return data;
    const sep = data.length === 0 || data.endsWith("\n") ? "" : "\n";
    return data + sep + "\n# " + heading + "\n" + blockLines.join("\n") + "\n";
  }
  let end = lines.length;
  for (let i = hi + 1; i < lines.length; i++) {
    if (/^#\s/.test(lines[i])) { end = i; break; } // next level-1 heading ends the section
  }
  let insertAt = end;
  while (insertAt > hi + 1 && lines[insertAt - 1].trim() === "") insertAt--;
  const out = [...lines.slice(0, insertAt), ...blockLines, ...lines.slice(insertAt)];
  return out.join("\n");
}

// Set the trailing number of the unique counter line (a line whose trimmed text starts with
// `prefix`) to `count`. If the prefix matches more than one line, leave the note unchanged so we
// never edit the wrong line. If it matches none, add the line near the top.
function updateCounterLine(data: string, prefix: string, count: number): { text: string; status: string } {
  const core = (prefix || "").trim();
  if (!core) return { text: data, status: "no-prefix" };
  const lines = data.split("\n");
  const idxs: number[] = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].trim().startsWith(core)) idxs.push(i);
  if (idxs.length > 1) return { text: data, status: "ambiguous" };
  if (idxs.length === 1) {
    const lead = (lines[idxs[0]].match(/^\s*/) || [""])[0];
    lines[idxs[0]] = lead + core + " " + count;
    return { text: lines.join("\n"), status: "updated" };
  }
  let at = 0;
  if (lines[0] === "---") { const e = lines.indexOf("---", 1); if (e !== -1) at = e + 1; }
  lines.splice(at, 0, core + " " + count);
  return { text: lines.join("\n"), status: "added" };
}

// The authoritative pomodoro timer. It lives on the plugin (not in any view) so
// it survives the panel closing and drives both the main panel and the floating
// window. Both are thin clients: they read getState() and call the control
// methods; a subscriber list re-renders them on every change.
interface TimerState {
  secs: number;
  total: number;
  running: boolean;
  paused: boolean;
  lengthMin: number;
  taskName: string;
  startedAt: number | null;
  pauseStart: number | null; // when the current pause began (null if not paused)
  pauseTag: string;          // the reason chosen for the current pause
  expected: number;          // the "before" enjoyment rating (1-5), carried so a quick-log has it
  // ----- break phase (shared with the panel + the floating window's closed loop) -----
  breakActive: boolean;      // a break is in progress (running, paused, or finished-awaiting-dismiss)
  breakRunning: boolean;     // the break countdown is ticking
  breakFinished: boolean;    // the break hit 0 (kept up so its activities/feeling can still be set)
  breakSecs: number;         // seconds left on the break
  breakTotal: number;        // full break length in seconds
  breakStart: number | null; // wall-clock moment the break began (for the breaks log)
  breakPicked: string[];     // activity ids chosen for this break (max 3)
  breakFeeling: number | null; // the "how do you feel now" rating (1-5)
}
class TimerEngine {
  private lengthMin: number;
  private total: number;          // full length of the current pomodoro, in seconds
  private endTs = 0;              // wall-clock target while running (ms epoch)
  private frozenSecs: number;     // remaining seconds while paused/idle
  private running = false;
  private paused = false;
  private taskName = "";
  private startedAt: number | null = null;
  private pauseStart: number | null = null; // pause-with-reason: when this pause began
  private pauseTag = "";                     // pause-with-reason: chosen reason
  private expected = 3;                      // "before" enjoyment rating; set from the panel, read at log time
  // ----- break phase: a second, wall-clock countdown owned by the same engine so the
  // panel and the floating window share one source of truth for the rest-and-resume loop.
  private breakActive = false;
  private breakRunning = false;
  private breakFinished = false;
  private breakTotal = 0;            // full break length in seconds
  private breakEndTs = 0;            // wall-clock target while the break runs (ms epoch)
  private breakFrozen = 0;           // remaining break seconds while paused
  private breakStart: number | null = null;
  private breakPicked: string[] = [];
  private breakFeeling: number | null = null;
  private iv: number | null = null;
  private fired: Record<number, boolean> = {};
  private subs = new Set<() => void>();

  constructor(private plugin: FocusLogPlugin, lengthMin: number) {
    this.lengthMin = Math.max(5, Math.min(30, Math.round(lengthMin) || 25));
    this.total = this.lengthMin * 60;
    this.frozenSecs = this.total;
  }

  // Remaining seconds derived from the wall clock — never a decremented counter,
  // so a throttled/late tick (or returning from another app) always shows the
  // correct time. ceil() keeps the displayed second from over-counting at start.
  private secsNow(): number {
    if (this.running) return Math.max(0, Math.ceil((this.endTs - Date.now()) / 1000));
    return Math.max(0, this.frozenSecs);
  }

  // Break seconds derived from the wall clock too, so a throttled/late tick stays correct.
  private breakSecsNow(): number {
    if (this.breakRunning) return Math.max(0, Math.ceil((this.breakEndTs - Date.now()) / 1000));
    return Math.max(0, this.breakFrozen);
  }

  getState(): TimerState {
    return {
      secs: this.secsNow(), total: this.total, running: this.running, paused: this.paused, lengthMin: this.lengthMin, taskName: this.taskName, startedAt: this.startedAt, pauseStart: this.pauseStart, pauseTag: this.pauseTag, expected: this.expected,
      breakActive: this.breakActive, breakRunning: this.breakRunning, breakFinished: this.breakFinished, breakSecs: this.breakSecsNow(), breakTotal: this.breakTotal, breakStart: this.breakStart, breakPicked: this.breakPicked.slice(), breakFeeling: this.breakFeeling,
    };
  }
  setPauseTag(tag: string) { this.pauseTag = tag || ""; this.emit(); }
  // The panel's "before" rating; kept on the engine so a quick-log from the float window
  // (which never shows a before-section) still records the expectation the user set.
  setExpected(n: number) { this.expected = Math.max(1, Math.min(5, Math.round(n) || 3)); }
  // Pre-select the task for the next pomodoro (e.g. chosen on the float celebration)
  // without starting the timer; both windows show it as the upcoming task.
  setTask(name: string) { this.taskName = (name || "").trim(); this.emit(); }
  // Write the pending pause (its event + daily-note block) if one is open, then clear
  // it. Called when resuming, and when logging a pomodoro mid-pause.
  commitPendingPause() {
    if (this.pauseStart != null) {
      this.plugin.writePauseEvent(this.startedAt, this.pauseStart, Date.now(), this.pauseTag);
    }
    this.pauseStart = null;
    this.pauseTag = "";
  }
  subscribe(fn: () => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }
  private emit() {
    this.subs.forEach((fn) => { try { fn(); } catch {} });
  }

  setLength(min: number) {
    if (this.running || this.paused) return; // length is locked while a pomodoro is active
    const m = Math.max(5, Math.min(30, Math.round(min) || 25));
    if (m === this.lengthMin) return;
    this.lengthMin = m;
    this.total = m * 60;
    this.frozenSecs = m * 60;
    this.fired = {};
    this.plugin.data.settings.pomodoroMinutes = m;
    this.plugin.persist();
    this.emit();
  }
  step(delta: number) { this.setLength(this.lengthMin + delta); }

  start(taskName?: string) {
    if (typeof taskName === "string" && taskName.trim()) this.taskName = taskName.trim();
    const fresh = !this.running && !this.paused; // brand-new pomodoro vs. a resume
    // Starting a fresh pomodoro out of an open break closes (and records) the break first.
    if (fresh && this.breakActive) this.endBreak();
    // Resuming from a pause → write that pause (event + note) and clear it.
    if (this.paused) this.commitPendingPause();
    let secs = this.secsNow();
    if (fresh) { this.startedAt = Date.now(); this.total = this.lengthMin * 60; this.fired = {}; secs = this.total; this.pauseStart = null; this.pauseTag = ""; }
    else if (secs <= 0) { secs = this.lengthMin * 60; this.fired = {}; }
    this.endTs = Date.now() + secs * 1000;
    this.running = true;
    this.paused = false;
    this.ensureTick();
    this.emit();
    if (fresh) this.plugin.onTimerStarted();
  }
  pause() {
    if (!this.running) return;
    this.frozenSecs = this.secsNow();
    this.running = false;
    this.paused = true;
    this.pauseStart = Date.now(); // open a pause; reason picker appears in both windows
    this.pauseTag = "";
    this.stopTick();
    this.emit();
  }
  resume() { this.start(); }
  reset() {
    // A tagged pause is written (event + daily-note block) just like on resume,
    // so tagging and then restarting doesn't lose the pause. An untagged pause
    // is still discarded silently. Must run before startedAt is cleared.
    this.commitPendingPause();
    this.running = false;
    this.paused = false;
    this.total = this.lengthMin * 60;
    this.frozenSecs = this.total;
    this.endTs = 0;
    this.startedAt = null;
    this.taskName = "";
    this.pauseStart = null;
    this.pauseTag = "";
    this.fired = {};
    this.stopTick();
    this.emit();
  }
  dispose() {
    // Force the clock down regardless of phase (stopTick keeps ticking while running).
    this.running = false;
    this.breakRunning = false;
    this.stopTick();
    this.subs.clear();
  }

  // ---------- break phase (the rest half of the closed loop) ----------
  // Begin (or restart) the rest timer using the configured break length. Honors the
  // break-auto-start setting; either way the break phase becomes active so the panel
  // and float can show its controls + activity picker.
  startBreak() {
    const mins = Math.max(1, Math.min(60, Math.round(this.plugin.data.settings.breakMinutes) || 5));
    this.breakTotal = mins * 60;
    this.breakFrozen = this.breakTotal;
    this.breakStart = Date.now();
    this.breakPicked = [];
    this.breakFeeling = null;
    this.breakFinished = false;
    this.breakActive = true;
    if (this.plugin.data.settings.breakAutoStart !== false) {
      this.breakRunning = true;
      this.breakEndTs = Date.now() + this.breakFrozen * 1000;
      this.ensureTick();
    } else {
      this.breakRunning = false;
    }
    this.emit();
  }
  toggleBreakRun() {
    if (!this.breakActive || this.breakFinished) return;
    if (this.breakRunning) { this.breakFrozen = this.breakSecsNow(); this.breakRunning = false; this.stopTick(); }
    else { this.breakEndTs = Date.now() + Math.max(1, this.breakFrozen) * 1000; this.breakRunning = true; this.ensureTick(); }
    this.emit();
  }
  stepBreak(deltaMin: number) {
    if (!this.breakActive) return;
    const next = Math.max(60, Math.min(30 * 60, this.breakSecsNow() + deltaMin * 60));
    this.breakFrozen = next;
    this.breakFinished = false;
    if (this.breakRunning) this.breakEndTs = Date.now() + next * 1000;
    this.emit();
  }
  toggleBreakPick(id: string) {
    if (this.breakPicked.includes(id)) this.breakPicked = this.breakPicked.filter((x) => x !== id);
    else if (this.breakPicked.length < 3) this.breakPicked = [...this.breakPicked, id];
    this.emit();
  }
  setBreakFeeling(n: number) { this.breakFeeling = Math.max(1, Math.min(5, Math.round(n) || 3)); this.emit(); }
  // Commit the break (activities + feeling → the breaks log via the plugin) and clear
  // the phase. Called when the user ends/skips the break, closing the loop back to setup.
  endBreak() {
    if (this.breakActive && this.breakStart) this.plugin.commitBreak(this.breakStart, Date.now(), this.breakPicked.slice(), this.breakFeeling);
    this.breakActive = false;
    this.breakRunning = false;
    this.breakFinished = false;
    this.breakStart = null;
    this.breakPicked = [];
    this.breakFeeling = null;
    this.breakFrozen = 0;
    this.breakEndTs = 0;
    this.stopTick();
    this.emit();
  }

  private ensureTick() {
    // Tell Electron not to throttle this window's timers while a pomodoro or break runs,
    // otherwise a backgrounded window's setInterval is clamped to ~1/minute and the
    // countdown jumps a minute at a time. Restored to normal when nothing is ticking.
    this.plugin.setBackgroundThrottle(false);
    if (this.iv != null) return;
    this.iv = window.setInterval(() => this.poll(), 500);
  }
  private stopTick() {
    // Keep the clock alive while either the pomodoro or a break still needs it.
    if (this.running || this.breakRunning) return;
    if (this.iv != null) { window.clearInterval(this.iv); this.iv = null; }
    this.plugin.setBackgroundThrottle(true);
  }
  // Recompute from the wall clock and fire the alerts / finish. Idempotent and
  // safe to call from several drivers: the engine's own interval (runs while the
  // main window is focused) and the floating window's interval (runs while that
  // always-on-top window is visible, even when the main window is hidden and its
  // timers are throttled). Milestones use "<=" threshold-crossing, so a tick that
  // jumps past a mark still fires it. The 15/5-min marks only apply if the
  // pomodoro is actually longer than that.
  poll() {
    let changed = false;
    if (this.running) {
      const s = this.secsNow();
      if (this.total > 900 && s <= 900 && !this.fired[900]) { this.fired[900] = true; this.plugin.timerNotify("15 minutes left. Still on this task?"); }
      if (this.total > 300 && s <= 300 && !this.fired[300]) { this.fired[300] = true; this.plugin.timerNotify("5 minutes left. Stay with it."); }
      if (s <= 0 && !this.fired[0]) {
        this.fired[0] = true;
        this.frozenSecs = 0;
        this.running = false;
        this.paused = false;
        this.stopTick();
        this.emit();
        this.plugin.timerDone();
        return;
      }
      changed = true;
    }
    if (this.breakRunning) {
      if (this.breakSecsNow() <= 0) {
        this.breakFrozen = 0;
        this.breakRunning = false;
        this.breakFinished = true;
        this.stopTick();
        this.emit();
        this.plugin.breakDone();
        return;
      }
      changed = true;
    }
    if (changed) this.emit();
  }
}

export default class FocusLogPlugin extends Plugin {
  data: PluginData;
  timer: TimerEngine;
  floatWin: any = null;
  private floatSubs = new Set<() => void>();
  private pauseSubs = new Set<() => void>();   // panel re-syncs its pauses list when these fire
  private sessionSubs = new Set<() => void>(); // panel re-reads its sessions when these fire (e.g. a float quick-log)
  private breakSubs = new Set<() => void>();   // panel re-reads activities + breaks when the engine commits a break
  private logViewSubs = new Set<() => void>(); // panel switches to the log tab when these fire
  private openingFloat = false; // true between asking for a float popout and the window-open handler claiming it
  private doneStatusCache: string | null = null;

  async onload() {
    const loaded = (await this.loadData()) || {};
    this.data = {
      settings: Object.assign({}, DEFAULT_SETTINGS, loaded.settings || {}),
      sessions: loaded.sessions || [],
      pending: loaded.pending || [],
      tasks: loaded.tasks || [],
      activities: loaded.activities || DEFAULT_ACTIVITIES.map((a) => ({ ...a })),
      pauseTags: (loaded.pauseTags || DEFAULT_PAUSE_TAGS.map((a) => ({ ...a }))).map((t: any) => ({ ...t, category: t.category || PAUSE_TAG_DEFAULT_CAT[t.name] || "internal" })),
      pauses: loaded.pauses || [],
      breaks: loaded.breaks || [],
    };

    this.timer = new TimerEngine(this, this.data.settings.pomodoroMinutes);
    // When the main window is revealed again, recompute at once so any alert or
    // finish that came due while it was hidden (and its timers throttled) fires.
    this.registerDomEvent(document, "visibilitychange", () => { if (!document.hidden) this.timer.poll(); });
    // Catch our float popout the instant its OS window is created, so we can size
    // and place it before its first visible frame (no large-window-then-jump).
    this.registerEvent(this.app.workspace.on("window-open", () => this.onFloatWindowOpen()));

    this.registerView(VIEW_TYPE, (leaf) => new FocusLogView(leaf, this));
    this.registerView(VIEW_TYPE_FLOAT, (leaf) => new FloatTimerView(leaf, this));
    this.addRibbonIcon("bird", "Open Focus Log", () => this.activateView());
    this.addRibbonIcon("timer", "Toggle floating timer", () => this.toggleFloating());
    this.addCommand({ id: "open-focus-log", name: "Open Focus Log", callback: () => this.activateView() });
    this.addCommand({ id: "toggle-floating-timer", name: "Toggle floating timer", callback: () => this.toggleFloating() });
    this.addSettingTab(new FocusLogSettingTab(this.app, this));
  }

  onunload() {
    this.timer?.dispose();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_FLOAT);
  }

  // Enable/disable Electron's background timer throttling on the MAIN window. We
  // turn it OFF while a pomodoro counts (so the interval keeps firing every second
  // even when Obsidian is behind another app) and back ON when it stops, to be
  // battery-friendly the rest of the time.
  setBackgroundThrottle(allowed: boolean) {
    try {
      const remote = getElectronRemote();
      const win = remote && remote.getCurrentWindow ? remote.getCurrentWindow() : null;
      if (win && win.webContents && win.webContents.setBackgroundThrottling) win.webContents.setBackgroundThrottling(allowed);
    } catch {}
  }

  // ---------- pause events (written from either window via the engine) ----------
  onPausesChange(fn: () => void): () => void { this.pauseSubs.add(fn); return () => this.pauseSubs.delete(fn); }
  private notifyPausesChange() { this.pauseSubs.forEach((fn) => { try { fn(); } catch {} }); }
  getPauses(): any[] { return this.data.pauses || []; }
  // Record a finished pause: a stored event + a daily-note block. An untagged pause
  // writes nothing. Called by the engine on resume / log, so it works even when the
  // main panel is closed (e.g. you paused from the floating window).
  writePauseEvent(pomodoroStart: number | null, pauseStart: number, pauseEnd: number, tag: string) {
    if (!tag) return;
    const ev = { id: "pa" + Date.now(), ts: pauseStart, end: pauseEnd, mins: Math.max(0, Math.round((pauseEnd - pauseStart) / 60000)), tag };
    this.data.pauses = [...(this.data.pauses || []), ev];
    this.persist();
    this.appendPauseToDailyNote({ pomodoroStart, pauseStart, pauseEnd, tag }).catch(() => {});
    this.notifyPausesChange();
  }

  // ---------- sessions changed outside the panel (a float quick-log) ----------
  onSessionsChange(fn: () => void): () => void { this.sessionSubs.add(fn); return () => this.sessionSubs.delete(fn); }
  private notifySessionsChange() { this.sessionSubs.forEach((fn) => { try { fn(); } catch {} }); }

  // ---------- breaks changed outside the panel (the engine committed one) ----------
  onBreaksChange(fn: () => void): () => void { this.breakSubs.add(fn); return () => this.breakSubs.delete(fn); }
  private notifyBreaksChange() { this.breakSubs.forEach((fn) => { try { fn(); } catch {} }); }
  // Fired by the engine when a break finishes its countdown on its own.
  breakDone() {
    this.timerNotify("Break over — ready for the next pomodoro?");
  }
  // Write a finished break to the log: bump the chosen activities' counts and record the
  // break (activities, areas, feeling). Called by the engine's endBreak so it works from
  // either window, even when the panel is closed. The panel re-reads via notifyBreaksChange.
  commitBreak(start: number, end: number, pickedIds: string[], feeling: number | null) {
    const acts = this.data.activities || [];
    if (pickedIds.length) {
      this.data.activities = acts.map((a: any) => pickedIds.includes(a.id) ? { ...a, count: (a.count || 0) + 1, lastUsed: end } : a);
    }
    if (start) {
      const picked = pickedIds.map((id) => (this.data.activities || []).find((a: any) => a.id === id)).filter(Boolean) as any[];
      const names = picked.map((a) => a.name);
      const areas = Array.from(new Set(picked.map((a) => a.area || "Other")));
      this.data.breaks = [...(this.data.breaks || []), { id: "br" + Date.now(), start, end, activities: names, areas, feeling: feeling ?? null }];
    }
    this.persist();
    this.notifyBreaksChange();
  }

  // Log the just-finished pomodoro straight from the floating window: build the session
  // from the engine's task + the matching task meta, record the rating, write Act and the
  // daily note (best-effort), then clear the timer. Optionally mark the task Done in
  // Notion and pre-select the next task. Mirrors the panel's logPomodoro so an open
  // panel stays in sync via notifySessionsChange().
  async quickLog(actual: number, markDone = false, nextTask = "") {
    const st = this.timer.getState();
    const taskName = (st.taskName || "").trim();
    if (!taskName) return;
    const meta: any = (this.data.tasks || []).find((t: any) => t.task === taskName) || {};
    const workedSecs = st.total - st.secs;
    const minutes = workedSecs > 0 ? Math.max(1, Math.round(workedSecs / 60)) : st.lengthMin;
    const s: any = {
      id: Date.now(), task: taskName, group: meta.group || taskName, hierarchy: meta.hierarchy || "",
      load: meta.load || null, category: meta.category || null, url: meta.url || null, pageId: meta.id || null,
      ts: new Date().toISOString(), expected: st.expected, actual: Math.max(1, Math.min(5, Math.round(actual) || 3)), note: "", minutes,
    };
    this.data.sessions = [...(this.data.sessions || []), s];
    await this.persist();
    this.timer.commitPendingPause();
    this.timer.reset();
    // The chosen next task rides on the engine: the float shows it as the upcoming task
    // and the panel picks it up as its preset.
    if (nextTask) this.timer.setTask(nextTask);
    // Closed loop: roll straight into the shared break phase (the float renders it next).
    if (this.data.settings.breakEnabled) this.timer.startBreak();
    this.notifySessionsChange();
    let msg = "Logged “" + taskName + "” — felt " + s.actual + "/5.";
    if (s.pageId) {
      try { await this.incrementAct(s.pageId); }
      catch (e) { this.data.pending = [...(this.data.pending || []), { sessionId: s.id, pageId: s.pageId, task: s.task }]; await this.persist(); msg += " Act write queued."; }
    }
    if (markDone && s.pageId) {
      try {
        const name = await this.setTaskDone(s.pageId);
        this.data.tasks = (this.data.tasks || []).filter((t: any) => t.id !== s.pageId);
        await this.persist();
        this.notifySessionsChange(); // tasks changed too; the panel re-reads both
        msg += " Status set to " + name + ".";
      } catch (e: any) { msg += " Mark-done failed: " + (e?.message || e); }
    }
    try { await this.appendToDailyNote({ ts: +new Date(s.ts), minutes: s.minutes, task: s.task, hierarchy: s.hierarchy || "", note: "", category: s.category || null }); } catch (e) {}
    new Notice(msg, 5000);
  }

  // ---------- bring the user into the log view (from the float celebration) ----------
  onRequestLogView(fn: () => void): () => void { this.logViewSubs.add(fn); return () => this.logViewSubs.delete(fn); }
  async focusAndLog() {
    try {
      const remote = getElectronRemote();
      const win = remote && remote.getCurrentWindow ? remote.getCurrentWindow() : null;
      if (win) { try { win.show(); } catch {} try { win.focus(); } catch {} }
      try { if (remote && remote.app && remote.app.focus) remote.app.focus({ steal: true }); } catch {}
    } catch {}
    await this.activateView();
    // Give a freshly-created panel a moment to subscribe before asking for the log tab.
    window.setTimeout(() => this.logViewSubs.forEach((fn) => { try { fn(); } catch {} }), 60);
  }

  // ---------- floating timer window ----------
  private floatView(): FloatTimerView | null {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT)[0];
    return leaf ? (leaf.view as FloatTimerView) : null;
  }

  // Lets the panel keep its "floating timer window" toggle in step with whether
  // the window is actually open (e.g. after it's closed with its own X button).
  onFloatChange(fn: () => void): () => void {
    this.floatSubs.add(fn);
    return () => this.floatSubs.delete(fn);
  }
  notifyFloatChange() {
    this.floatSubs.forEach((fn) => { try { fn(); } catch {} });
  }
  isFloatingOpen(): boolean {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT).some((l) => { const w = (l.view as any)?.containerEl?.win; return w && !w.closed; });
  }

  // Called by the engine whenever a pomodoro starts; pop the window into view.
  onTimerStarted() {
    if (this.data.settings.floatOnStart !== false) this.openFloating();
  }

  async openFloating() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT);
    // A previously-closed popout can leave a leaf behind whose window is already
    // gone. Reveal one only if its window is genuinely still open; otherwise drop
    // the stale leaves and create a fresh window.
    const live = leaves.find((l) => { const w = (l.view as any)?.containerEl?.win; return w && !w.closed; });
    if (live) {
      this.app.workspace.revealLeaf(live);
      this.pinFloatWindow(false);
      return;
    }
    leaves.forEach((l) => l.detach());
    const ws: any = this.app.workspace;
    // Mark the next popout as ours: onFloatWindowOpen() fires the instant the OS
    // window is created and hides → sizes → reveals it, so the first visible frame
    // is already small and in the corner (no large-window-in-the-middle flash).
    this.openingFloat = true;
    let leaf: WorkspaceLeaf;
    try {
      leaf = ws.openPopoutLeaf ? ws.openPopoutLeaf() : ws.getLeaf("window");
    } catch {
      leaf = ws.getLeaf("window");
    }
    await leaf.setViewState({ type: VIEW_TYPE_FLOAT, active: true });
    // Fallbacks: if window-open never fired, still size/pin; and never leave the
    // window stuck invisible from the opacity trick.
    window.setTimeout(() => {
      this.openingFloat = false;
      this.pinFloatWindow(true);
      try { if (this.floatWin && this.floatWin.setOpacity) this.floatWin.setOpacity(1); } catch {}
    }, 90);
  }

  // Fires from workspace "window-open". If this popout is the one we just asked for,
  // hide it immediately, size + place it, then reveal it a beat later — so it never
  // shows at the default large size first.
  private onFloatWindowOpen() {
    if (!this.openingFloat) return;
    this.openingFloat = false;
    try {
      const remote = getElectronRemote();
      if (!remote || !remote.BrowserWindow) return;
      const cur = remote.getCurrentWindow ? remote.getCurrentWindow() : null;
      const all = remote.BrowserWindow.getAllWindows ? remote.BrowserWindow.getAllWindows() : [];
      const win = all.filter((w: any) => !cur || w.id !== cur.id).pop();
      if (!win) return;
      try { win.setOpacity(0); } catch {}
      this.pinFloatWindow(true, win);
      window.setTimeout(() => { try { win.setOpacity(1); } catch {} }, 50);
    } catch {}
  }

  closeFloating() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT).forEach((l) => l.detach());
  }
  toggleFloating() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT);
    if (existing.length) existing.forEach((l) => l.detach());
    else this.openFloating();
  }

  // Size, place, and pin a float popout. `winOverride` may be passed (from the
  // window-open handler, which has the brand-new window); otherwise we take the
  // most-recently-opened popout. Sizing happens regardless of the always-on-top
  // setting; only the always-on-top call itself is gated.
  pinFloatWindow(initial: boolean, winOverride?: any) {
    try {
      const remote = getElectronRemote();
      if (!remote || !remote.BrowserWindow) {
        if (initial && this.data.settings.floatAlwaysOnTop !== false) new Notice("Focus Log: the timer opened, but couldn't be pinned on top (Electron API unavailable in this Obsidian).", 7000);
        return;
      }
      let win = winOverride;
      if (!win) {
        const cur = remote.getCurrentWindow ? remote.getCurrentWindow() : null;
        const all = remote.BrowserWindow.getAllWindows ? remote.BrowserWindow.getAllWindows() : [];
        win = all.filter((w: any) => !cur || w.id !== cur.id).pop();
      }
      if (!win) return;
      if (this.data.settings.floatAlwaysOnTop !== false) {
        win.setAlwaysOnTop(true, "floating");
        // skipTransformProcessType:true keeps macOS from changing Obsidian's process
        // type here — without it, "visible on all workspaces" makes Obsidian drop its
        // dock dot and lose focus (the menu bar jumps to another app) when the float opens.
        try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true }); } catch {}
      }
      try { if (win.webContents && win.webContents.setBackgroundThrottling) win.webContents.setBackgroundThrottling(false); } catch {}
      if (initial) {
        try {
          const b = this.data.settings.floatBounds;
          if (b && b.w && b.h) {
            // Restore the size + position from last time.
            win.setBounds({ x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.w), height: Math.round(b.h) });
          } else {
            const screen = remote.screen;
            const wa = screen && screen.getPrimaryDisplay ? screen.getPrimaryDisplay().workArea : null;
            win.setSize(300, 240, false); // first-time default: small, top-right (fits the setup picker)
            if (wa) win.setPosition(Math.round(wa.x + wa.width - 320), Math.round(wa.y + 40), false);
          }
        } catch {}
      }
      this.floatWin = win;
    } catch {}
  }

  // Remember the float window's geometry so next time it opens where you left it.
  saveFloatBounds(b: { x: number; y: number; width: number; height: number }) {
    this.data.settings.floatBounds = { x: b.x, y: b.y, w: b.width, h: b.height };
    this.persist();
  }
  // The break phase gets its own remembered geometry (larger, for the activity picker),
  // so the focus and break sizes don't overwrite each other.
  saveFloatBreakBounds(b: { x: number; y: number; width: number; height: number }) {
    this.data.settings.floatBreakBounds = { x: b.x, y: b.y, w: b.width, h: b.height };
    this.persist();
  }

  // ---------- timer alerts (work over other apps) ----------
  private osNotify(title: string, body: string) {
    try {
      const N: any = (window as any).Notification;
      if (!N) return;
      if (N.permission === "granted") { new N(title, { body, silent: false }); }
      else if (N.permission !== "denied") { N.requestPermission().then((p: string) => { if (p === "granted") new N(title, { body }); }); }
    } catch {}
  }
  timerNotify(msg: string) {
    new Notice(msg, 6000);
    this.osNotify("Focus Log", msg);
    this.floatView()?.flash(msg);
  }
  timerDone() {
    this.osNotify("Pomodoro complete \u{1F389}", "One block done — log how enjoyable it actually was.");
    // When the floating window is up, it owns the celebration (tap it to jump to the
    // log view) — no extra modal. Fall back to the modal only if there's no float.
    if (this.isFloatingOpen()) this.floatView()?.celebrate();
    else new CelebrateModal(this.app).open();
  }

  async persist() {
    await this.saveData(this.data);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) as WorkspaceLeaf;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  // ---------- Notion API ----------
  private async notionFetch(path: string, method = "GET", body?: any): Promise<any> {
    if (!this.data.settings.notionToken) throw new Error("No Notion token set in Focus Log settings.");
    const res = await requestUrl({
      url: "https://api.notion.com/v1" + path,
      method,
      headers: {
        Authorization: "Bearer " + this.data.settings.notionToken,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      throw: false,
    });
    if (res.status >= 300) throw new Error("Notion " + res.status + ": " + (res.text || "").slice(0, 200));
    return res.json;
  }

  private logicalTodayISO(): string {
    const d = new Date(Date.now() - dayShiftHours(this.data.settings.dayStart) * 3600000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // The daily-note date key a timestamp belongs to (the same grouping used to pick the note file),
  // and the number of logged sessions sharing that key — i.e. that note's pomodoro count.
  private noteDateKey(ts: number): string {
    const s = this.data.settings;
    const d = s.dailyNoteTrueDate ? new Date(ts) : new Date(ts - dayShiftHours(s.dayStart) * 3600000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  private countForNote(ts: number): number {
    const key = this.noteDateKey(ts);
    return (this.data.sessions || []).filter((x: any) => this.noteDateKey(+new Date(x.ts)) === key).length;
  }

  // Mirrors the "Today Tasks" view: Today / King / This week, plus Daily dated today.
  async queryToday(): Promise<any[]> {
    const today = this.logicalTodayISO();
    const filter = {
      or: [
        { property: "Status", select: { equals: "\u{1F33B} Today" } },
        { property: "Status", select: { equals: "1\uFE0F\u20E3 King" } },
        {
          and: [
            { property: "Status", select: { equals: "\u{1F331} Daily" } },
            { property: "Date", date: { equals: today } },
          ],
        },
      ],
    };
    const json = await this.notionFetch(`/databases/${this.data.settings.databaseId}/query`, "POST", {
      filter,
      page_size: 50,
    });
    const pages: any[] = json.results || [];
    const cache: Record<string, any> = {};
    const tasks: any[] = [];
    for (const p of pages) {
      const task = plainTitle(p);
      if (!task) continue;
      const h = await this.resolveHierarchy(p, cache);
      tasks.push({
        task,
        load: mapLoad(selectName(p, "CognitiveLoad")),
        power: mapPower(selectName(p, "ExecutionPower")),
        king: (selectName(p, "Status") || "").includes("King"),
        category: categoryName(p, this.data.settings.categoryProperty) || null,
        pomodoros: estTotalOf(p),
        act: numberProp(p, "Act"),
        url: p.url,
        id: p.id,
        parent: h.parent,
        ancestor: h.ancestor,
        group: h.ancestor || task,
      });
    }
    // Preserve the user's manual ranking across syncs: tasks whose id we have not seen
    // go to the top, ranked by urgency Must → Aim → Bonus as their default order;
    // already-ranked ids keep their saved position.
    const prevIndex: Record<string, number> = {};
    (this.data.tasks || []).forEach((t: any, i: number) => { if (t && t.id != null) prevIndex[t.id] = i; });
    const POWER_RANK: Record<string, number> = { P: 0, Y: 1, G: 2 };
    const fresh = tasks
      .filter((t) => prevIndex[t.id] === undefined)
      .sort((a, b) => (POWER_RANK[a.power] ?? 1) - (POWER_RANK[b.power] ?? 1));
    const known = tasks
      .filter((t) => prevIndex[t.id] !== undefined)
      .sort((a, b) => prevIndex[a.id] - prevIndex[b.id]);
    const ordered = [...fresh, ...known];
    this.data.tasks = ordered;
    await this.persist();
    return ordered;
  }

  // Walk Parent item up: immediate parent title and top-level ancestor title (else null).
  private async resolveHierarchy(page: any, cache: Record<string, any>): Promise<{ parent: string | null; ancestor: string | null }> {
    const rel0 = page?.properties?.["Parent item"]?.relation;
    if (!rel0 || !rel0.length) return { parent: null, ancestor: null };
    let cur = page;
    let top = plainTitle(page);
    let immediate: string | null = null;
    let guard = 0;
    while (guard < 6) {
      const rel = cur?.properties?.["Parent item"]?.relation;
      if (!rel || !rel.length) break;
      const pid = rel[0].id;
      let parent = cache[pid];
      if (!parent) {
        parent = await this.notionFetch(`/pages/${pid}`);
        cache[pid] = parent;
      }
      const pt = plainTitle(parent);
      if (guard === 0) immediate = pt || null;
      if (pt) top = pt;
      cur = parent;
      guard++;
    }
    return { parent: immediate, ancestor: top };
  }

  // Read current Act, then PATCH only that one property (+1).
  async incrementAct(pageId: string): Promise<number> {
    const page = await this.notionFetch(`/pages/${pageId}`);
    const next = numberProp(page, "Act") + 1;
    await this.notionFetch(`/pages/${pageId}`, "PATCH", { properties: { Act: { number: next } } });
    return next;
  }

  // Resolve the Status option that means "done": an explicit setting wins, otherwise
  // auto-detect from the database schema (first option whose name reads as done/complete).
  private async resolveDoneStatus(): Promise<string> {
    const override = (this.data.settings.doneStatus || "").trim();
    if (override) return override;
    if (this.doneStatusCache) return this.doneStatusCache;
    const db = await this.notionFetch(`/databases/${this.data.settings.databaseId}`);
    const status = db?.properties?.["Status"];
    const opts = status?.select?.options || status?.status?.options || [];
    const match = opts.find((o: any) => /done|complete|finish/i.test(o.name || ""));
    if (!match) throw new Error("No 'Done' status option found. Set the Done status value in Focus Log settings.");
    this.doneStatusCache = match.name;
    return match.name;
  }

  // Set a task page's Status select to the resolved done value.
  async setTaskDone(pageId: string): Promise<string> {
    const name = await this.resolveDoneStatus();
    await this.notionFetch(`/pages/${pageId}`, "PATCH", { properties: { Status: { select: { name } } } });
    return name;
  }

  // Build the initial content for a newly created daily note: a template (Focus Log's, else the
  // Daily Notes / Periodic Notes one) with the common {{title}}/{{date}}/{{time}} tokens filled,
  // or a bare heading if no template is set.
  private async buildDailyNoteContent(m: any, format: string, coreTemplate?: string): Promise<string> {
    const s = this.data.settings;
    const tplPath = (s.dailyTemplatePath || coreTemplate || "").trim();
    if (tplPath) {
      const norm = normalizePath(tplPath.endsWith(".md") ? tplPath : tplPath + ".md");
      const tf = this.app.vault.getAbstractFileByPath(norm) as TFile;
      if (tf) {
        const raw = await this.app.vault.read(tf);
        const moment = (window as any).moment;
        const title = m.format(format);
        return raw
          .replace(/\{\{\s*title\s*\}\}/gi, title)
          .replace(/\{\{\s*date\s*:\s*([^}]+)\}\}/gi, (_: any, f: string) => m.format(f.trim()))
          .replace(/\{\{\s*time\s*:\s*([^}]+)\}\}/gi, (_: any, f: string) => moment().format(f.trim()))
          .replace(/\{\{\s*date\s*\}\}/gi, m.format("YYYY-MM-DD"))
          .replace(/\{\{\s*time\s*\}\}/gi, moment().format("HH:mm"));
      }
    }
    return "# " + s.dailyHeading + "\n";
  }

  // Append a formatted block under the configured heading in the (logical) day's daily note.
  async appendToDailyNote(p: { ts: number; minutes: number; task: string; hierarchy: string; note: string; category?: string | null }) {
    const s = this.data.settings;
    if (!s.dailyNoteWrite) return;
    const moment = (window as any).moment;
    if (!moment) throw new Error("moment unavailable");
    // The note FILE follows the day-start rollover (an evening pomodoro can land in tomorrow's
    // note), unless "File under the true date" puts it in the real date's note instead. The {date}
    // TEXT is always the true calendar date of the pomodoro, regardless of which file it lands in.
    const trueDate = new Date(p.ts);
    const fileDate = s.dailyNoteTrueDate ? trueDate : new Date(p.ts - dayShiftHours(s.dayStart) * 3600000);
    const fileM = moment(new Date(fileDate.getFullYear(), fileDate.getMonth(), fileDate.getDate()));
    const dateM = moment(new Date(trueDate.getFullYear(), trueDate.getMonth(), trueDate.getDate()));

    const dn: any = (this.app as any).internalPlugins?.getPluginById?.("daily-notes");
    const opts = dn?.instance?.options || {};
    // Focus Log's own format/folder win; otherwise fall back to the Daily Notes / Periodic Notes setting.
    const format = (s.dailyTitleFormat || opts.format || "YYYY-MM-DD").trim();
    const folder = (s.dailyNoteFolder || opts.folder || "").trim();
    const path = normalizePath((folder ? folder + "/" : "") + fileM.format(format) + ".md");

    let file = this.app.vault.getAbstractFileByPath(path) as TFile;
    if (!file) {
      if (!s.createDailyIfMissing) {
        new Notice("Focus Log: today's daily note doesn't exist. Enable “Create new daily note if missing” in settings.");
        return;
      }
      if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder).catch(() => {});
      }
      file = await this.app.vault.create(path, await this.buildDailyNoteContent(fileM, format, opts.template));
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const startT = new Date(p.ts - (p.minutes || 25) * 60000);
    const endT = new Date(p.ts);
    const hier = p.hierarchy ? " (" + p.hierarchy + ")" : "";
    const slug = (s.writeCategoryTag !== false && p.category) ? tagSlug(p.category) : "";
    const ns = (s.tagNamespace || "").trim();
    const tag = slug ? "#" + (ns ? ns + "/" : "") + slug : "";
    const block = (s.dailyTemplate || "")
      .replace(/\{date\}/g, dateM.format("YYYY-MM-DD"))
      .replace(/\{start\}/g, pad(startT.getHours()) + ":" + pad(startT.getMinutes()))
      .replace(/\{end\}/g, pad(endT.getHours()) + ":" + pad(endT.getMinutes()))
      .replace(/\{task\}/g, p.task || "")
      .replace(/\{hierarchy\}/g, hier)
      .replace(/\{tag\}/g, tag)
      .replace(/\{note\}/g, p.note || "");

    const count = this.countForNote(p.ts);
    let counterStatus = "";
    await this.app.vault.process(file, (data: string) => {
      let out = insertUnderHeading(data, s.dailyHeading, block, s.dailyCreateHeading);
      if (s.counterEnabled && (s.counterPrefix || "").trim()) {
        const r = updateCounterLine(out, s.counterPrefix, count);
        out = r.text;
        counterStatus = r.status;
      }
      return out;
    });
    if (counterStatus === "ambiguous") new Notice("Focus Log: the counter prefix matches more than one line — counter not updated.");
  }

  // Append a pause entry under the daily heading, using the pause template and its placeholders.
  async appendPauseToDailyNote(p: { pomodoroStart: number | null; pauseStart: number; pauseEnd: number; tag: string }) {
    const s = this.data.settings;
    if (!s.dailyNoteWrite) return;
    const moment = (window as any).moment;
    if (!moment) throw new Error("moment unavailable");
    const fileDate = s.dailyNoteTrueDate ? new Date(p.pauseEnd) : new Date(p.pauseEnd - dayShiftHours(s.dayStart) * 3600000);
    const m = moment(new Date(fileDate.getFullYear(), fileDate.getMonth(), fileDate.getDate()));
    const dn: any = (this.app as any).internalPlugins?.getPluginById?.("daily-notes");
    const opts = dn?.instance?.options || {};
    const format = opts.format || "YYYY-MM-DD";
    const folder = (opts.folder || "").trim();
    const path = normalizePath((folder ? folder + "/" : "") + m.format(format) + ".md");
    let file = this.app.vault.getAbstractFileByPath(path) as TFile;
    if (!file) {
      if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder).catch(() => {});
      file = await this.app.vault.create(path, "# " + s.dailyHeading + "\n");
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    const hm = (ts: number) => { const d = new Date(ts); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
    const block = (s.pauseTemplate || "")
      .replace(/\{date\}/g, m.format("YYYY-MM-DD"))
      .replace(/\{pomodoro-start\}/g, hm(p.pomodoroStart || p.pauseStart))
      .replace(/\{pomodoro-resume\}/g, hm(p.pauseEnd))
      .replace(/\{pause-start\}/g, hm(p.pauseStart))
      .replace(/\{pause-end\}/g, hm(p.pauseEnd))
      .replace(/\{pause-tag\}/g, p.tag || "");
    await this.app.vault.process(file, (data: string) => insertUnderHeading(data, s.dailyHeading, block, s.dailyCreateHeading));
  }

  // ---------- bridge handed to the React app ----------
  makeApi() {
    const self = this;
    return {
      settings: self.data.settings,
      getSessions: () => self.data.sessions || [],
      getInitial: () => ({
        sessions: self.data.sessions || [],
        pending: self.data.pending || [],
        tasks: self.data.tasks || [],
        activities: self.data.activities || [],
        pauseTags: self.data.pauseTags || [],
        pauses: self.data.pauses || [],
        breaks: self.data.breaks || [],
      }),
      saveSessions: async (arr: any[]) => { self.data.sessions = arr; await self.persist(); },
      saveActivities: async (arr: any[]) => { self.data.activities = arr; await self.persist(); },
      savePauseTags: async (arr: any[]) => { self.data.pauseTags = arr; await self.persist(); },
      savePauses: async (arr: any[]) => { self.data.pauses = arr; await self.persist(); },
      saveBreaks: async (arr: any[]) => { self.data.breaks = arr; await self.persist(); },
      appendPause: (p: any) => self.appendPauseToDailyNote(p),
      savePending: async (arr: any[]) => { self.data.pending = arr; await self.persist(); },
      saveTasks: async (arr: any[]) => { self.data.tasks = arr; await self.persist(); },
      patchSettings: async (partial: Partial<FocusLogSettings>) => { self.data.settings = Object.assign({}, self.data.settings, partial); await self.persist(); },
      sync: () => self.queryToday(),
      writeAct: (pageId: string) => self.incrementAct(pageId),
      setDone: (pageId: string) => self.setTaskDone(pageId),
      appendDaily: (p: any) => self.appendToDailyNote(p),
      notify: (msg: string, duration?: number) => new Notice(msg, duration),
      celebrate: () => new CelebrateModal(self.app).open(),
      timer: {
        getState: () => self.timer.getState(),
        subscribe: (fn: () => void) => self.timer.subscribe(fn),
        start: (taskName?: string) => self.timer.start(taskName),
        pause: () => self.timer.pause(),
        resume: () => self.timer.resume(),
        reset: () => self.timer.reset(),
        setLength: (m: number) => self.timer.setLength(m),
        step: (d: number) => self.timer.step(d),
        setPauseTag: (tag: string) => self.timer.setPauseTag(tag),
        setExpected: (n: number) => self.timer.setExpected(n),
        setTask: (name: string) => self.timer.setTask(name),
        commitPendingPause: () => self.timer.commitPendingPause(),
        startBreak: () => self.timer.startBreak(),
        toggleBreakRun: () => self.timer.toggleBreakRun(),
        stepBreak: (d: number) => self.timer.stepBreak(d),
        toggleBreakPick: (id: string) => self.timer.toggleBreakPick(id),
        setBreakFeeling: (n: number) => self.timer.setBreakFeeling(n),
        endBreak: () => self.timer.endBreak(),
      },
      quickLog: (actual: number, markDone?: boolean, nextTask?: string) => self.quickLog(actual, markDone, nextTask),
      getPauses: () => self.getPauses(),
      onPausesChange: (fn: () => void) => self.onPausesChange(fn),
      onSessionsChange: (fn: () => void) => self.onSessionsChange(fn),
      onBreaksChange: (fn: () => void) => self.onBreaksChange(fn),
      onRequestLogView: (fn: () => void) => self.onRequestLogView(fn),
      openFloating: () => self.openFloating(),
      closeFloating: () => self.closeFloating(),
      toggleFloating: () => self.toggleFloating(),
      floatingOpen: () => self.isFloatingOpen(),
      onFloatChange: (fn: () => void) => self.onFloatChange(fn),
    };
  }
}

class CelebrateModal extends Modal {
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("focuslog-celebrate");
    contentEl.createEl("div", { text: "\u{1F389}", cls: "fl-popper" });
    contentEl.createEl("h2", { text: "Pomodoro complete" });
    contentEl.createEl("p", { text: "One block done. Log how enjoyable it actually was." });
    const confetti = contentEl.createDiv({ cls: "fl-confetti" });
    const colors = ["#d98324", "#2f6f8f", "#5b8c5a", "#b4533a", "#c9a227"];
    for (let i = 0; i < 28; i++) {
      const piece = confetti.createSpan({ cls: "fl-piece" });
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 0.4).toFixed(2) + "s";
    }
    const ok = contentEl.createEl("button", { text: "Nice", cls: "mod-cta" });
    ok.style.marginTop = "12px";
    ok.onclick = () => this.close();
  }
  onClose() {
    this.contentEl.empty();
  }
}

class FocusLogView extends ItemView {
  root: Root | null = null;
  plugin: FocusLogPlugin;
  constructor(leaf: WorkspaceLeaf, plugin: FocusLogPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Focus Log"; }
  getIcon() { return "bird"; }
  async onOpen() {
    this.root = createRoot(this.contentEl);
    this.root.render(React.createElement(FocusLogApp, { api: this.plugin.makeApi() }));
  }
  async onClose() {
    this.root?.unmount();
  }
}

// A compact, plain-DOM timer rendered into a popout window. It owns no timer
// state — it reads the plugin's TimerEngine and re-renders on every change, so
// it stays in lock-step with the main panel.
class FloatTimerView extends ItemView {
  plugin: FocusLogPlugin;
  private unsub: (() => void) | null = null;
  private els: any = {};
  private flashT = 0;
  private celebrateT = 0;
  private localTick = 0;
  private lastIcon = ""; // avoid re-rendering the play/pause svg every tick
  private pickerShown = false; // whether the pause reason picker is currently expanded
  private pkey = "";           // chips rebuild only when this (tag list / selection) changes
  private boundsKey = "";      // last seen window geometry (to detect user move/resize)
  private boundsDirty = false; // geometry changed; save once it settles
  private pauseBaseH = 0;      // window height before the pause picker grew it
  private celebrateBaseH = 0;  // window height before the celebration grew it
  private curPhase = "";       // "setup" | "focus" | "break" — which screen of the loop is showing
  private skey = "";           // setup task-picker rebuilds only when the task list / selection changes
  private bkey = "";           // break activity chips rebuild only when the list / picked set changes
  private fwin: any = null; // this popout's own window object (its timers aren't throttled while it's visible)
  constructor(leaf: WorkspaceLeaf, plugin: FocusLogPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_TYPE_FLOAT; }
  getDisplayText() { return "Focus timer"; }
  getIcon() { return "timer"; }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("focuslog-float");
    this.fwin = (root as any).win || window;
    // Tag this popout's window so the CSS can hide its tab bar + view header for a
    // clean, frameless timer — without touching the main window or other popouts.
    try { this.fwin.document.body.classList.add("focuslog-float-window"); } catch {}
    const wrap = root.createDiv({ cls: "flt-wrap" });
    // Setup (pre-pomodoro) task picker — shown only when idle, so you choose what's next
    // before the countdown begins.
    this.els.setupSel = wrap.createEl("select", { cls: "flt-setsel" }) as HTMLSelectElement;
    this.els.setupSel.onchange = () => this.plugin.timer.setTask((this.els.setupSel as HTMLSelectElement).value);
    this.els.task = wrap.createDiv({ cls: "flt-task" });
    this.els.time = wrap.createDiv({ cls: "flt-time" });
    // One row: − , a play/pause toggle (icon), + , and reset (rotate-ccw icon).
    const row = wrap.createDiv({ cls: "flt-row" });
    this.els.row = row;
    this.els.minus = row.createEl("button", { cls: "flt-btn flt-step", text: "−" });
    this.els.primary = row.createEl("button", { cls: "flt-btn flt-primary" });
    this.els.plus = row.createEl("button", { cls: "flt-btn flt-step", text: "+" });
    this.els.reset = row.createEl("button", { cls: "flt-btn flt-icon" });
    setIcon(this.els.reset, "rotate-ccw");
    this.els.reset.setAttribute("aria-label", "reset");
    // Setup before-rating — the "how enjoyable do I expect this to be" set before starting.
    this.els.setupRate = wrap.createDiv({ cls: "flt-setrate" });
    this.els.picker = wrap.createDiv({ cls: "flt-picker" });
    this.els.break = wrap.createDiv({ cls: "flt-break" }); // the rest phase of the loop
    this.els.flash = wrap.createDiv({ cls: "flt-flash" });
    this.els.celebrate = wrap.createDiv({ cls: "flt-celebrate" });

    this.els.minus.onclick = () => this.plugin.timer.step(-1);
    this.els.plus.onclick = () => this.plugin.timer.step(1);
    // Start gates on a chosen task when fresh (the closed loop wants a task picked first);
    // pause/resume behave as before once a pomodoro is active.
    this.els.primary.onclick = () => {
      const st = this.plugin.timer.getState();
      if (st.running) { this.plugin.timer.pause(); return; }
      // Fresh start wants a task chosen first — but only nag when there are tasks to pick.
      if (!st.paused && !(st.taskName || "").trim() && (this.plugin.data.tasks || []).length) { this.flash("Pick a task first."); return; }
      this.plugin.timer.start();
    };
    this.els.reset.onclick = () => this.plugin.timer.reset();

    this.unsub = this.plugin.timer.subscribe(() => this.render());
    this.render();

    // Drive the engine from THIS window's timeline. Because this popout stays
    // visible (always-on-top), its timers keep firing at full rate even when the
    // main Obsidian window is hidden and throttled — so the countdown never stalls.
    this.localTick = this.fwin.setInterval(() => { this.plugin.timer.poll(); this.render(); this.maybeSaveBounds(); }, 500);
    this.plugin.notifyFloatChange();
  }

  // The closed loop has three screens: setup (pick task + rate, idle), focus (the
  // countdown, running/paused/finished), and break (the rest timer + activities).
  private phaseOf(s: TimerState): string {
    if (s.breakActive) return "break";
    if (!s.running && !s.paused && s.startedAt == null) return "setup";
    return "focus";
  }

  render() {
    const s = this.plugin.timer.getState();
    const phase = this.phaseOf(s);
    if (phase !== this.curPhase) { this.onPhaseChange(this.curPhase, phase); this.curPhase = phase; }
    this.setPhaseVisibility(phase);

    if (phase === "break") {
      this.renderBreak(s);
    } else {
      // setup + focus share the countdown + the −/play/+ row.
      const mm = String(Math.floor(s.secs / 60)).padStart(2, "0");
      const ss = String(s.secs % 60).padStart(2, "0");
      this.els.time.setText(mm + ":" + ss);
      this.els.time.toggleClass("is-done", s.secs === 0);
      this.els.task.setText(s.taskName || "Focus");
      const wantIcon = s.running ? "pause" : "play";
      if (this.lastIcon !== wantIcon) { setIcon(this.els.primary, wantIcon); this.lastIcon = wantIcon; }
      this.els.primary.setAttribute("aria-label", s.running ? "pause" : (s.paused ? "resume" : "start"));
      this.els.primary.toggleClass("is-running", s.running);
      const locked = s.running || s.paused; // length is frozen while a pomodoro is active
      this.els.minus.disabled = locked || s.lengthMin <= 5;
      this.els.plus.disabled = locked || s.lengthMin >= 30;

      if (phase === "setup") this.refreshSetup(s);

      // Pause reason picker: grow the window and show the chips while paused.
      if (s.paused !== this.pickerShown) {
        this.pickerShown = s.paused;
        this.resizeForPause(s.paused);
        if (!s.paused && this.els.picker) { this.els.picker.empty(); this.pkey = ""; }
      }
      if (s.paused) {
        const pkey = "P:" + s.pauseTag + ":" + ((this.plugin.data.pauseTags || []).length);
        if (this.pkey !== pkey) { this.pkey = pkey; this.buildPicker(s.pauseTag); }
      }
    }

    // The celebration stays until tapped; clear it once a new pomodoro starts, a break
    // begins, or the timer resets.
    if ((s.running || s.breakActive || s.startedAt == null) && this.els.celebrate && this.els.celebrate.hasClass("show")) {
      this.els.celebrate.removeClass("show");
      this.els.celebrate.empty();
      this.resizeForCelebrate(false);
    }
  }

  // Show only the controls for the active screen.
  setPhaseVisibility(phase: string) {
    const setup = phase === "setup";
    const brk = phase === "break";
    this.els.setupSel.style.display = setup ? "" : "none";
    this.els.setupRate.style.display = setup ? "" : "none";
    this.els.task.style.display = (!setup && !brk) ? "" : "none";
    this.els.time.style.display = brk ? "none" : "";
    this.els.row.style.display = brk ? "none" : "";
    this.els.reset.style.display = setup ? "none" : "";
    this.els.break.style.display = brk ? "" : "none";
  }

  // Switch the window between the small focus size and the larger break size, and
  // (re)build the break DOM on entry.
  onPhaseChange(prev: string, next: string) {
    if (next === "break") { this.buildBreak(); this.applyBreakWindow(true); }
    else if (prev === "break") { this.applyBreakWindow(false); this.els.break.empty(); this.els.brkTime = null; }
  }

  // ---------- setup screen (pick task + rate before starting) ----------
  refreshSetup(s: TimerState) {
    const tasks = this.plugin.data.tasks || [];
    const skey = "S:" + tasks.map((t: any) => t.task).join("|") + "::" + (s.taskName || "");
    if (this.skey !== skey) {
      this.skey = skey;
      const sel = this.els.setupSel as HTMLSelectElement;
      sel.empty();
      sel.createEl("option", { text: tasks.length ? "— pick a task —" : "— no tasks (sync first) —", value: "" });
      tasks.forEach((t: any) => sel.createEl("option", { text: t.task, value: t.task }));
      sel.value = s.taskName || "";
    }
    if (!this.els.setupRate.childElementCount) this.buildSetupRate();
    (this.els.setupRateBtns || []).forEach((b: any, i: number) => b.toggleClass("is-on", i + 1 === s.expected));
  }
  buildSetupRate() {
    const el = this.els.setupRate;
    el.empty();
    el.createDiv({ cls: "flt-setlabel", text: "how enjoyable do you expect this to be?" });
    const r = el.createDiv({ cls: "flt-rate" });
    this.els.setupRateBtns = [1, 2, 3, 4, 5].map((n) => {
      const b = r.createEl("button", { cls: "flt-rbtn", text: String(n) });
      b.onclick = () => this.plugin.timer.setExpected(n);
      return b;
    });
  }

  // ---------- break screen (rest timer + activities + feeling) ----------
  buildBreak() {
    const el = this.els.break;
    el.empty();
    const head = el.createDiv({ cls: "flt-brk-head" });
    this.els.brkTime = head.createDiv({ cls: "flt-brktime" });
    const ctrls = head.createDiv({ cls: "flt-brk-ctrls" });
    this.els.brkMinus = ctrls.createEl("button", { cls: "flt-btn flt-step", text: "−" });
    this.els.brkToggle = ctrls.createEl("button", { cls: "flt-btn flt-brk-toggle" });
    this.els.brkPlus = ctrls.createEl("button", { cls: "flt-btn flt-step", text: "+" });
    this.els.brkEnd = ctrls.createEl("button", { cls: "flt-btn flt-brk-end" });
    this.els.brkMinus.onclick = () => this.plugin.timer.stepBreak(-1);
    this.els.brkPlus.onclick = () => this.plugin.timer.stepBreak(1);
    this.els.brkToggle.onclick = () => this.plugin.timer.toggleBreakRun();
    this.els.brkEnd.onclick = () => this.plugin.timer.endBreak(); // ends + loops back to setup
    this.els.brkLbl = el.createDiv({ cls: "flt-brk-lbl" });
    this.els.brkActs = el.createDiv({ cls: "flt-brk-acts" });
    const feel = el.createDiv({ cls: "flt-brk-feel" });
    feel.createDiv({ cls: "flt-setlabel", text: "how do you feel now? (1 worse … 5 a lot better)" });
    const fr = feel.createDiv({ cls: "flt-rate" });
    this.els.brkFeelBtns = [1, 2, 3, 4, 5].map((n) => {
      const b = fr.createEl("button", { cls: "flt-rbtn", text: String(n) });
      b.onclick = () => this.plugin.timer.setBreakFeeling(n);
      return b;
    });
    this.bkey = "";
  }
  renderBreak(s: TimerState) {
    if (!this.els.brkTime) this.buildBreak();
    const mm = String(Math.floor(s.breakSecs / 60)).padStart(2, "0");
    const ss = String(s.breakSecs % 60).padStart(2, "0");
    this.els.brkTime.setText(mm + ":" + ss);
    this.els.brkTime.toggleClass("is-done", s.breakFinished);
    this.els.brkToggle.setText(s.breakFinished ? "done" : (s.breakRunning ? "pause" : "start"));
    this.els.brkToggle.disabled = s.breakFinished;
    this.els.brkMinus.disabled = s.breakSecs <= 60;
    this.els.brkPlus.disabled = s.breakSecs >= 30 * 60;
    this.els.brkEnd.setText(s.breakFinished ? "next task →" : "end break");
    const acts = this.plugin.data.activities || [];
    const picked = s.breakPicked || [];
    const bkey = "B:" + acts.map((a: any) => a.id).join("|") + "::" + picked.join(",");
    if (this.bkey !== bkey) { this.bkey = bkey; this.buildBreakChips(acts, picked); }
    this.els.brkLbl.setText("pick up to 3 for this break (" + picked.length + "/3):");
    (this.els.brkFeelBtns || []).forEach((b: any, i: number) => b.toggleClass("is-on", i + 1 === s.breakFeeling));
  }
  buildBreakChips(acts: any[], picked: string[]) {
    const el = this.els.brkActs;
    el.empty();
    if (!acts.length) { el.createDiv({ cls: "flt-brk-empty", text: "No activities yet — add some in the panel's Break tab." }); return; }
    acts.forEach((a: any) => {
      const on = picked.includes(a.id);
      const chip = el.createEl("button", { cls: "flt-chip flt-brk-chip" + (on ? " is-on" : ""), text: (on ? "✓ " : "") + a.name });
      chip.onclick = () => this.plugin.timer.toggleBreakPick(a.id);
    });
  }

  // Save the focus geometry and grow to the remembered (or default 380×400) break size;
  // on the way out, restore the focus geometry. The break has its own remembered bounds.
  applyBreakWindow(toBreak: boolean) {
    try {
      const win = this.plugin.floatWin;
      if (!win || !win.getBounds || !win.setBounds) return;
      if (toBreak) {
        const b = win.getBounds();
        this.plugin.saveFloatBounds(b); // remember where the focus window was
        const bb = this.plugin.data.settings.floatBreakBounds;
        if (bb && bb.w && bb.h) win.setBounds({ x: Math.round(bb.x), y: Math.round(bb.y), width: Math.round(bb.w), height: Math.round(bb.h) });
        else win.setBounds({ x: b.x, y: b.y, width: 380, height: 400 });
      } else {
        const fb = this.plugin.data.settings.floatBounds;
        if (fb && fb.w && fb.h) win.setBounds({ x: Math.round(fb.x), y: Math.round(fb.y), width: Math.round(fb.w), height: Math.round(fb.h) });
      }
    } catch {}
  }

  // Grow the window downward to fit the pause picker, then restore the prior height —
  // relative to whatever size the window currently is, so a remembered/custom size is kept.
  resizeForPause(paused: boolean) {
    try {
      const win = this.plugin.floatWin;
      if (!win || !win.getSize) return;
      const [w, h] = win.getSize();
      if (paused) { this.pauseBaseH = h; win.setSize(w, h + 150, false); }
      else if (this.pauseBaseH) { win.setSize(w, this.pauseBaseH, false); this.pauseBaseH = 0; }
    } catch {}
  }

  // Persist the window geometry shortly after the user stops moving/resizing it.
  // Skipped while paused or celebrating (the picker/celebration has grown the
  // window — not the real size). The break phase remembers its own larger bounds.
  maybeSaveBounds() {
    try {
      const win = this.plugin.floatWin;
      if (!win || !win.getBounds) return;
      const st = this.plugin.timer.getState();
      if (st.paused) return;
      if (this.celebrateBaseH) return;
      const b = win.getBounds();
      const key = b.x + "," + b.y + "," + b.width + "," + b.height;
      if (key !== this.boundsKey) { this.boundsKey = key; this.boundsDirty = true; return; }
      if (this.boundsDirty) { this.boundsDirty = false; if (st.breakActive) this.plugin.saveFloatBreakBounds(b); else this.plugin.saveFloatBounds(b); }
    } catch {}
  }

  buildPicker(selected: string) {
    const el = this.els.picker;
    if (!el) return;
    el.empty();
    el.createDiv({ cls: "flt-picker-q", text: "Paused — why? Pick a reason." });
    const chips = el.createDiv({ cls: "flt-picker-chips" });
    const tags = this.plugin.data.pauseTags || [];
    if (!tags.length) { chips.createDiv({ cls: "flt-picker-empty", text: "No tags — add some in the Pause tab." }); return; }
    tags.forEach((t: any) => {
      const cat = t.category === "external" ? "external" : "internal";
      const on = selected === t.name;
      const chip = chips.createEl("button", { cls: "flt-chip" + (on ? " is-on" : ""), text: (on ? "✓ " : "") + t.name });
      chip.style.background = FLOAT_CAT[cat].fill;
      chip.style.borderColor = FLOAT_CAT[cat].border;
      chip.onclick = () => this.plugin.timer.setPauseTag(on ? "" : t.name);
    });
  }

  flash(msg: string) {
    if (!this.els.flash) return;
    const w = this.fwin || window;
    this.els.flash.setText(msg);
    this.els.flash.addClass("show");
    w.clearTimeout(this.flashT);
    this.flashT = w.setTimeout(() => this.els.flash && this.els.flash.removeClass("show"), 5000);
  }

  // Grow the window downward while the celebration (rating + done + next-task) is up,
  // restoring the prior height afterwards — same approach as resizeForPause.
  resizeForCelebrate(open: boolean) {
    try {
      const win = this.plugin.floatWin;
      if (!win || !win.getSize) return;
      const [w, h] = win.getSize();
      if (open && !this.celebrateBaseH) { this.celebrateBaseH = h; win.setSize(w, h + 120, false); }
      else if (!open && this.celebrateBaseH) { win.setSize(w, this.celebrateBaseH, false); this.celebrateBaseH = 0; }
    } catch {}
  }

  celebrate() {
    const el = this.els.celebrate;
    if (!el) return;
    el.empty();
    el.addClass("show");
    this.resizeForCelebrate(true);
    const dismiss = () => { el.removeClass("show"); el.empty(); el.onclick = null; this.resizeForCelebrate(false); };
    el.createDiv({ cls: "flt-pop", text: "\u{1F389}" });
    el.createDiv({ cls: "flt-clabel", text: "complete" });
    // Decisions first (Done? next task?), then the rating — tapping a number is the final
    // act: it logs straight from here with whatever was chosen above.
    let done = false;
    const opts = el.createDiv({ cls: "flt-copts" });
    const doneChip = opts.createEl("button", { cls: "flt-chip flt-done", text: "set task to Done" });
    doneChip.onclick = (ev: any) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      done = !done;
      doneChip.toggleClass("is-on", done);
      doneChip.setText((done ? "✓ " : "") + "set task to Done");
    };
    const sel = opts.createEl("select", { cls: "flt-next" }) as HTMLSelectElement;
    sel.createEl("option", { text: "— next task: decide later —", value: "" });
    (this.plugin.data.tasks || []).forEach((t: any) => { sel.createEl("option", { text: t.task, value: t.task }); });
    sel.onclick = (ev: any) => { if (ev && ev.stopPropagation) ev.stopPropagation(); };
    el.createDiv({ cls: "flt-cask", text: "how enjoyable was it?" });
    const rate = el.createDiv({ cls: "flt-rate" });
    [1, 2, 3, 4, 5].forEach((n) => {
      const b = rate.createEl("button", { cls: "flt-rbtn", text: String(n) });
      b.onclick = (ev: any) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        const nextTask = sel.value || "";
        dismiss();
        this.plugin.quickLog(n, done, nextTask);
        this.flash("Logged " + n + "/5 ✓");
      };
    });
    el.createDiv({ cls: "flt-chint", text: "tap a rating to log · tap background for the full form" });
    const colors = ["#d98324", "#2f6f8f", "#5b8c5a", "#b4533a", "#c9a227"];
    for (let i = 0; i < 24; i++) {
      const piece = el.createSpan({ cls: "fl-piece" });
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 0.4).toFixed(2) + "s";
    }
    // Tapping the background (not a control) brings Obsidian to the front and opens the log view.
    el.onclick = () => { dismiss(); this.plugin.focusAndLog(); };
  }

  async onClose() {
    // Guard every teardown step: when the popout is closing, its window may already
    // be gone, and a throw here could leave a phantom leaf that blocks reopening.
    try { this.unsub?.(); } catch {}
    this.unsub = null;
    // Capture the final geometry so it reopens here next time (to the right bucket).
    try {
      const win = this.plugin.floatWin;
      const st = this.plugin.timer.getState();
      if (win && win.getBounds && !st.paused && !this.celebrateBaseH) {
        if (st.breakActive) this.plugin.saveFloatBreakBounds(win.getBounds());
        else this.plugin.saveFloatBounds(win.getBounds());
      }
    } catch {}
    try {
      const w = this.fwin || window;
      w.clearInterval(this.localTick);
      w.clearTimeout(this.flashT);
      w.clearTimeout(this.celebrateT);
    } catch {}
    try { this.fwin && this.fwin.document.body.classList.remove("focuslog-float-window"); } catch {}
    this.fwin = null;
    // Let the panel toggle catch up once the leaf is fully gone.
    try { window.setTimeout(() => this.plugin.notifyFloatChange(), 0); } catch {}
  }
}

class FocusLogSettingTab extends PluginSettingTab {
  plugin: FocusLogPlugin;
  constructor(app: App, plugin: FocusLogPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h3", { text: "Focus Log — Notion connection" });

    new Setting(containerEl)
      .setName("Notion integration token")
      .setDesc("Create an internal integration at notion.so/my-integrations, share the Pressure to Progress database with it, then paste the secret here. Stored locally in your vault.")
      .addText((t) =>
        t.setPlaceholder("secret_...").setValue(this.plugin.data.settings.notionToken).onChange(async (v) => {
          this.plugin.data.settings.notionToken = v.trim();
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Database ID")
      .setDesc("The Pressure to Progress database ID (prefilled).")
      .addText((t) =>
        t.setValue(this.plugin.data.settings.databaseId).onChange(async (v) => {
          this.plugin.data.settings.databaseId = v.trim();
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Done status value")
      .setDesc("Optional. The exact Status option to set when you tick “mark done” while logging. Leave blank to auto-detect an option whose name contains “Done”.")
      .addText((t) =>
        t.setPlaceholder("auto-detect").setValue(this.plugin.data.settings.doneStatus).onChange(async (v) => {
          this.plugin.data.settings.doneStatus = v.trim();
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Category property")
      .setDesc("Name of the Notion select that holds each task's area (e.g. Area, with options like Me / En / Pro). Shown as a chip in the panel and written to the daily note as a tag. Leave blank to disable.")
      .addText((t) =>
        t.setPlaceholder("Area").setValue(this.plugin.data.settings.categoryProperty).onChange(async (v) => {
          this.plugin.data.settings.categoryProperty = v.trim();
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Show category in the today list")
      .setDesc("Show each task's Area as a chip in the panel's today view. Off hides the chip and keeps the full task title.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.showCategoryInView).onChange(async (v) => {
          this.plugin.data.settings.showCategoryInView = v;
          await this.plugin.persist();
        })
      );

    containerEl.createEl("h3", { text: "Day and time bands" });

    new Setting(containerEl)
      .setName("Day starts at (hour, 0–23)")
      .setDesc("The clock hour your logical day rolls over. A morning value like 4 keeps late-night work on the previous day (anything up to 03:59 counts as yesterday). An evening value like 22 starts a fresh day that night, so a pomodoro after 22:00 counts toward the next date.")
      .addText((t) =>
        t.setValue(String(this.plugin.data.settings.dayStart)).onChange(async (v) => {
          const n = Math.max(0, Math.min(23, parseInt(v, 10) || 0));
          this.plugin.data.settings.dayStart = n;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Morning ends at (hour)")
      .setDesc("Pomodoros logged before this hour are coloured as morning on the heatmap.")
      .addText((t) =>
        t.setValue(String(this.plugin.data.settings.morningEnd)).onChange(async (v) => {
          const n = Math.max(0, Math.min(24, parseInt(v, 10) || 0));
          this.plugin.data.settings.morningEnd = n;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Afternoon ends at (hour)")
      .setDesc("Anything after this hour is coloured as evening.")
      .addText((t) =>
        t.setValue(String(this.plugin.data.settings.afternoonEnd)).onChange(async (v) => {
          const n = Math.max(0, Math.min(24, parseInt(v, 10) || 0));
          this.plugin.data.settings.afternoonEnd = n;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Start the week on Sunday")
      .setDesc("Off (default): weeks run Monday–Sunday. On: weeks run Sunday–Saturday. Affects the week view range, the weekly grouping, and the weekday headers on both heatmaps.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.weekStartsSunday).onChange(async (v) => {
          this.plugin.data.settings.weekStartsSunday = v;
          await this.plugin.persist();
        })
      );

    containerEl.createEl("h3", { text: "Rating colours" });
    containerEl.createEl("p", {
      text: "These colours show on the weekly chart dots: expected before, actual after.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Expected (before)")
      .addColorPicker((c) =>
        c.setValue(this.plugin.data.settings.beginColor).onChange(async (v) => {
          this.plugin.data.settings.beginColor = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Actual (after)")
      .addColorPicker((c) =>
        c.setValue(this.plugin.data.settings.endColor).onChange(async (v) => {
          this.plugin.data.settings.endColor = v;
          await this.plugin.persist();
        })
      );

    containerEl.createEl("h3", { text: "Daily note" });

    new Setting(containerEl)
      .setName("Append to daily note when logging")
      .setDesc("On each logged pomodoro, write a block into the daily note.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.dailyNoteWrite).onChange(async (v) => {
          this.plugin.data.settings.dailyNoteWrite = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Create new daily note if missing")
      .setDesc("If that day's note doesn't exist when you log, create it from the template below. Off: the daily-note block is skipped when the note is missing.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.createDailyIfMissing).onChange(async (v) => {
          this.plugin.data.settings.createDailyIfMissing = v;
          await this.plugin.persist();
        })
      );

    const moment = (window as any).moment;
    const dnOpts: any = ((this.app as any).internalPlugins?.getPluginById?.("daily-notes"))?.instance?.options || {};
    const coreFmt = (dnOpts.format || "YYYY-MM-DD").trim();
    let fmtPreview: HTMLElement | null = null;
    const renderFmtPreview = (val: string) => {
      if (fmtPreview && moment) fmtPreview.setText(moment().format((val || coreFmt || "YYYY-MM-DD")));
    };
    const titleSetting = new Setting(containerEl)
      .setName("Title format")
      .addText((t) =>
        t.setPlaceholder("(from Daily Notes)").setValue(this.plugin.data.settings.dailyTitleFormat).onChange(async (v) => {
          this.plugin.data.settings.dailyTitleFormat = v.trim();
          renderFmtPreview(v.trim());
          await this.plugin.persist();
        })
      );
    titleSetting.descEl.empty();
    titleSetting.descEl.appendText("Filename date format. Blank = use your Daily Notes / Periodic Notes format. For more syntax, refer to ");
    const fmtLink = titleSetting.descEl.createEl("a", { text: "format reference" });
    fmtLink.setAttr("href", "https://momentjs.com/docs/#/displaying/format/");
    fmtLink.setAttr("target", "_blank");
    fmtLink.setAttr("rel", "noopener");
    titleSetting.descEl.createEl("br");
    titleSetting.descEl.appendText("Your current syntax looks like this: ");
    fmtPreview = titleSetting.descEl.createEl("b");
    fmtPreview.style.color = "var(--text-accent)";
    renderFmtPreview(this.plugin.data.settings.dailyTitleFormat);

    new Setting(containerEl)
      .setName("Template path")
      .setDesc("Note used as the template for new daily notes. Supports {{title}}, {{date}}, {{date:FORMAT}}, {{time}}, {{time:FORMAT}}. Blank = use your Daily Notes template. (Templater <% %> syntax is not run.)")
      .addText((t) =>
        t.setPlaceholder("0_BuJo/Z_templates/Template.md").setValue(this.plugin.data.settings.dailyTemplatePath).onChange(async (v) => {
          this.plugin.data.settings.dailyTemplatePath = v.trim();
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Note folder")
      .setDesc("Folder for new daily notes. Blank = use your Daily Notes folder.")
      .addText((t) =>
        t.setPlaceholder("(from Daily Notes)").setValue(this.plugin.data.settings.dailyNoteFolder).onChange(async (v) => {
          this.plugin.data.settings.dailyNoteFolder = v.trim();
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("File the block under the true date")
      .setDesc("Chooses which daily-note FILE the block goes into. On: the real date's note. Off: the day-start rollover note, so an evening pomodoro lands in tomorrow's note. The {date} text inside the block is always the true calendar date, either way.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.dailyNoteTrueDate).onChange(async (v) => {
          this.plugin.data.settings.dailyNoteTrueDate = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Section heading")
      .setDesc("First-level heading (#) to append under. The leading # is added automatically.")
      .addText((t) =>
        t.setValue(this.plugin.data.settings.dailyHeading).onChange(async (v) => {
          this.plugin.data.settings.dailyHeading = v.trim();
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Create the heading if missing")
      .setDesc("If the section is not found, add it (with the block) at the end of the note.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.dailyCreateHeading).onChange(async (v) => {
          this.plugin.data.settings.dailyCreateHeading = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Block template")
      .setDesc("Placeholders: {date} {start} {end} {task} {hierarchy} {tag} {note}. {hierarchy} expands to \" (ancestor \u00B7 parent)\" when present; {tag} is the category tag configured below.")
      .addTextArea((t) => {
        t.setValue(this.plugin.data.settings.dailyTemplate).onChange(async (v) => {
          this.plugin.data.settings.dailyTemplate = v;
          await this.plugin.persist();
        });
        t.inputEl.rows = 4;
        t.inputEl.style.width = "100%";
      });

    new Setting(containerEl)
      .setName("Write the category tag to the daily note")
      .setDesc("Expand the {tag} placeholder to a tag like #Notion/En when logging. Off leaves {tag} blank without editing your template.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.writeCategoryTag).onChange(async (v) => {
          this.plugin.data.settings.writeCategoryTag = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Tag namespace")
      .setDesc("Parent segment for the {tag}. With \u201CNotion\u201D, an Area of En writes \u201C#Notion/En\u201D. Leave blank for a flat tag like \u201C#En\u201D.")
      .addText((t) =>
        t.setPlaceholder("Notion").setValue(this.plugin.data.settings.tagNamespace).onChange(async (v) => {
          this.plugin.data.settings.tagNamespace = v.trim();
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Update a daily pomodoro counter")
      .setDesc("After each log, set the number on a counter line in the note to that day's pomodoro count, using the same day-start grouping as the note (so evening logs count toward tomorrow). The line must appear exactly once, or it is left untouched.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.counterEnabled).onChange(async (v) => {
          this.plugin.data.settings.counterEnabled = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Counter line prefix")
      .setDesc("The exact text before the number. The plugin finds the line that starts with this and rewrites the number after it. Example: \"## \uD83C\uDF4E Today_Pomodoro:: \".")
      .addText((t) => {
        t.setValue(this.plugin.data.settings.counterPrefix).onChange(async (v) => {
          this.plugin.data.settings.counterPrefix = v;
          await this.plugin.persist();
        });
        t.inputEl.style.width = "100%";
      });

    containerEl.createEl("h3", { text: "Break" });

    new Setting(containerEl)
      .setName("Take a break after logging")
      .setDesc("After logging a pomodoro, open the Break view instead of returning straight to the today list.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.breakEnabled).onChange(async (v) => {
          this.plugin.data.settings.breakEnabled = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Start the break automatically")
      .setDesc("On: the break timer starts on its own. Off: you start it manually in the Break view.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.breakAutoStart).onChange(async (v) => {
          this.plugin.data.settings.breakAutoStart = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Break length (minutes)")
      .setDesc("How long the break timer runs.")
      .addText((t) =>
        t.setValue(String(this.plugin.data.settings.breakMinutes)).onChange(async (v) => {
          this.plugin.data.settings.breakMinutes = Math.max(1, Math.min(60, parseInt(v, 10) || 5));
          await this.plugin.persist();
        })
      );

    containerEl.createEl("h3", { text: "Floating timer" });

    new Setting(containerEl)
      .setName("Open the floating window when a pomodoro starts")
      .setDesc("A small always-on-top window that shows the countdown over your other apps. You can also toggle it any time from the ribbon clock or the “Toggle floating timer” command. It stays in sync with the panel — start, pause, or reset from either.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.floatOnStart).onChange(async (v) => {
          this.plugin.data.settings.floatOnStart = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Keep it above other apps")
      .setDesc("Pin the floating window on top of every other window. If your Obsidian build doesn't allow this, the window still opens — it just won't stay in front.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.floatAlwaysOnTop).onChange(async (v) => {
          this.plugin.data.settings.floatAlwaysOnTop = v;
          await this.plugin.persist();
        })
      );

    containerEl.createEl("h3", { text: "Pause" });

    new Setting(containerEl)
      .setName("Pause block template")
      .setDesc("Written to the daily note when you tag a pause. Placeholders: {date} {pomodoro-start} {pause-start} {pause-end} {pomodoro-resume} {pause-tag}. ({pause-end} and {pomodoro-resume} are both the moment you resumed or reset.) Manage pause tags in the panel's Pause tab.")
      .addTextArea((t) => {
        t.setValue(this.plugin.data.settings.pauseTemplate).onChange(async (v) => {
          this.plugin.data.settings.pauseTemplate = v;
          await this.plugin.persist();
        });
        t.inputEl.rows = 3;
        t.inputEl.style.width = "100%";
      });

    containerEl.createEl("p", {
      text: "Reopen the Focus Log panel after changing settings here so the panel picks up the new values.",
      cls: "setting-item-description",
    });
  }
}
