import { App, ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, normalizePath, requestUrl } from "obsidian";
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
  pomodoroMinutes: number;
  chooseNextTask: boolean;
  pauseTemplate: string;
  floatOnStart: boolean;
  floatAlwaysOnTop: boolean;
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
  pomodoroMinutes: 25,
  chooseNextTask: true,
  pauseTemplate: "- [ ] <mark class=\"hltr-pink\">{date}</mark> {pause-start} - {pause-end} ⏸️ {pause-tag}",
  floatOnStart: true,
  floatAlwaysOnTop: true,
};

const DEFAULT_PAUSE_TAGS = [
  { id: "p-bathroom", name: "bathroom" },
  { id: "p-water", name: "water / snack" },
  { id: "p-distracted", name: "got distracted" },
  { id: "p-phone", name: "phone" },
  { id: "p-tired", name: "tired" },
  { id: "p-interrupted", name: "interrupted" },
];

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

  getState(): TimerState {
    return { secs: this.secsNow(), total: this.total, running: this.running, paused: this.paused, lengthMin: this.lengthMin, taskName: this.taskName, startedAt: this.startedAt };
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
    let secs = this.secsNow();
    if (fresh) { this.startedAt = Date.now(); this.total = this.lengthMin * 60; this.fired = {}; secs = this.total; }
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
    this.stopTick();
    this.emit();
  }
  resume() { this.start(); }
  reset() {
    this.running = false;
    this.paused = false;
    this.total = this.lengthMin * 60;
    this.frozenSecs = this.total;
    this.endTs = 0;
    this.startedAt = null;
    this.taskName = "";
    this.fired = {};
    this.stopTick();
    this.emit();
  }
  dispose() {
    this.stopTick();
    this.subs.clear();
  }

  private ensureTick() {
    // Tell Electron not to throttle this window's timers while a pomodoro runs,
    // otherwise a backgrounded window's setInterval is clamped to ~1/minute and the
    // countdown jumps a minute at a time. Restored to normal when the timer stops.
    this.plugin.setBackgroundThrottle(false);
    if (this.iv != null) return;
    this.iv = window.setInterval(() => this.poll(), 500);
  }
  private stopTick() {
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
    if (!this.running) return;
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
    this.emit();
  }
}

export default class FocusLogPlugin extends Plugin {
  data: PluginData;
  timer: TimerEngine;
  floatWin: any = null;
  private floatSubs = new Set<() => void>();
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
      pauseTags: loaded.pauseTags || DEFAULT_PAUSE_TAGS.map((a) => ({ ...a })),
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
        try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
      }
      try { if (win.webContents && win.webContents.setBackgroundThrottling) win.webContents.setBackgroundThrottling(false); } catch {}
      if (initial) {
        try {
          const screen = remote.screen;
          const wa = screen && screen.getPrimaryDisplay ? screen.getPrimaryDisplay().workArea : null;
          // animate:false → instant, no Electron resize/move animation.
          win.setSize(320, 300, false);
          if (wa) win.setPosition(Math.round(wa.x + wa.width - 340), Math.round(wa.y + 40), false);
        } catch {}
      }
      this.floatWin = win;
    } catch {}
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
    new CelebrateModal(this.app).open();
    this.osNotify("Pomodoro complete \u{1F389}", "One block done — log how enjoyable it actually was.");
    this.floatView()?.celebrate();
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
    // go to the top (in Notion order); already-ranked ids keep their saved position.
    const prevIndex: Record<string, number> = {};
    (this.data.tasks || []).forEach((t: any, i: number) => { if (t && t.id != null) prevIndex[t.id] = i; });
    const fresh = tasks.filter((t) => prevIndex[t.id] === undefined);
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
      },
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
    const wrap = root.createDiv({ cls: "flt-wrap" });
    this.els.task = wrap.createDiv({ cls: "flt-task" });
    this.els.time = wrap.createDiv({ cls: "flt-time" });
    const row1 = wrap.createDiv({ cls: "flt-row" });
    this.els.minus = row1.createEl("button", { cls: "flt-btn flt-step", text: "−" });
    this.els.primary = row1.createEl("button", { cls: "flt-btn flt-primary" });
    this.els.plus = row1.createEl("button", { cls: "flt-btn flt-step", text: "+" });
    const row2 = wrap.createDiv({ cls: "flt-row" });
    this.els.pause = row2.createEl("button", { cls: "flt-btn", text: "pause" });
    this.els.reset = row2.createEl("button", { cls: "flt-btn", text: "reset" });
    this.els.flash = wrap.createDiv({ cls: "flt-flash" });
    this.els.celebrate = wrap.createDiv({ cls: "flt-celebrate" });

    this.els.minus.onclick = () => this.plugin.timer.step(-1);
    this.els.plus.onclick = () => this.plugin.timer.step(1);
    this.els.primary.onclick = () => this.plugin.timer.start();
    this.els.pause.onclick = () => this.plugin.timer.pause();
    this.els.reset.onclick = () => this.plugin.timer.reset();

    this.unsub = this.plugin.timer.subscribe(() => this.render());
    this.render();

    // Drive the engine from THIS window's timeline. Because this popout stays
    // visible (always-on-top), its timers keep firing at full rate even when the
    // main Obsidian window is hidden and throttled — so the countdown never stalls.
    this.localTick = this.fwin.setInterval(() => { this.plugin.timer.poll(); this.render(); }, 500);
    this.plugin.notifyFloatChange();
  }

  render() {
    const s = this.plugin.timer.getState();
    const mm = String(Math.floor(s.secs / 60)).padStart(2, "0");
    const ss = String(s.secs % 60).padStart(2, "0");
    this.els.time.setText(mm + ":" + ss);
    this.els.time.toggleClass("is-done", s.secs === 0);
    this.els.task.setText(s.taskName || "Focus");
    this.els.primary.setText((s.paused ? "resume" : "start") + " " + s.lengthMin + "m");
    this.els.primary.toggleClass("is-running", s.running);
    const locked = s.running || s.paused; // length is frozen while a pomodoro is active
    this.els.minus.disabled = locked || s.lengthMin <= 5;
    this.els.plus.disabled = locked || s.lengthMin >= 30;
    this.els.pause.disabled = !s.running;
  }

  flash(msg: string) {
    if (!this.els.flash) return;
    const w = this.fwin || window;
    this.els.flash.setText(msg);
    this.els.flash.addClass("show");
    w.clearTimeout(this.flashT);
    this.flashT = w.setTimeout(() => this.els.flash && this.els.flash.removeClass("show"), 5000);
  }

  celebrate() {
    const el = this.els.celebrate;
    if (!el) return;
    el.empty();
    el.addClass("show");
    el.createDiv({ cls: "flt-pop", text: "\u{1F389}" });
    el.createDiv({ cls: "flt-clabel", text: "complete" });
    const colors = ["#d98324", "#2f6f8f", "#5b8c5a", "#b4533a", "#c9a227"];
    for (let i = 0; i < 24; i++) {
      const piece = el.createSpan({ cls: "fl-piece" });
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 0.4).toFixed(2) + "s";
    }
    const w = this.fwin || window;
    w.clearTimeout(this.celebrateT);
    this.celebrateT = w.setTimeout(() => { if (this.els.celebrate) { this.els.celebrate.removeClass("show"); this.els.celebrate.empty(); } }, 4500);
  }

  async onClose() {
    // Guard every teardown step: when the popout is closing, its window may already
    // be gone, and a throw here could leave a phantom leaf that blocks reopening.
    try { this.unsub?.(); } catch {}
    this.unsub = null;
    try {
      const w = this.fwin || window;
      w.clearInterval(this.localTick);
      w.clearTimeout(this.flashT);
      w.clearTimeout(this.celebrateT);
    } catch {}
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
      .setDesc("Written to the daily note when you tag a pause. Placeholders: {date} {pomodoro-start} {pause-start} {pause-end} {pomodoro-resume} {pause-tag}. ({pause-end} and {pomodoro-resume} are both the moment you resumed.) Manage pause tags in the panel's Pause tab.")
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
