// Eye breaks: a BreakTimer-style rest reminder that lives alongside the pomodoro loop.
//
// Every N minutes a window asks you to look away from the screen for a few seconds, then
// gets out of the way again. It runs from the moment the plugin loads for as long as
// Obsidian is open, and it never touches the pomodoro engine: the two countdowns are
// independent, so a rest for your eyes never moves a task, a pomodoro, or a Focus Log
// break. The one courtesy runs the other way: while a Focus Log break is running you are
// already resting, so the eye countdown simply restarts from the end of that break.
//
// The window is one popout that changes shape, exactly like BreakTimer's: a small card in
// the bottom-right corner of the display you are working on counts down the last seconds
// before the break (Start now / Snooze / Skip), then grows into the full-screen break
// (or stays a card, by setting), and disappears when the break ends. It floats above every
// app and never takes the keyboard, so the app you were typing in is still focused when
// the window goes. Obsidian's own notices are invisible behind other apps, so they only
// serve as the fallback where no popout can be made (mobile, or no Electron API).
//
// Mirrors the settings BreakTimer offers (frequency, length, heads-up before the break,
// snooze length and limit, skip, end early, idle reset, sounds, title/message, colours,
// window opacity, a status-bar clock), minus working hours: the reminder is always alive.
import { ItemView, Menu, Notice, Platform, Setting, WorkspaceLeaf } from "obsidian";
import { getElectronRemote } from "./electron";

export const VIEW_TYPE_EYE = "focuslog-eyebreak";

export type EyeBreakMode = "popup" | "card";
export type EyeBreakSound = "none" | "chime" | "blip";
export type EyeBreakStatus = "off" | "next" | "since";
export type EyeLayout = "card" | "full";

export interface EyeBreakSettings {
  eyeBreakEnabled: boolean;
  eyeBreakEveryMins: number;       // minutes between breaks
  eyeBreakSecs: number;            // how long a break lasts, in seconds
  eyeBreakWarnSecs: number;        // the corner card counts down this many seconds before; 0 starts the break at once
  eyeBreakAllowSnooze: boolean;
  eyeBreakSnoozeMins: number;
  eyeBreakSnoozeLimit: number;     // snoozes allowed per break; 0 = unlimited
  eyeBreakAllowSkip: boolean;
  eyeBreakAllowEndEarly: boolean;
  eyeBreakEndEarlyAfter: number;   // the end-early button appears after this many seconds of the break
  eyeBreakMode: EyeBreakMode;      // the break fills the screen, or stays a corner card
  eyeBreakHoldDuringBreak: boolean; // a running Focus Log break restarts the eye countdown
  eyeBreakIdleMins: number;        // restart the countdown after this long away from the keyboard; 0 = off
  eyeBreakIdleNotice: boolean;     // say so when the countdown was reset by idleness
  eyeBreakSound: EyeBreakSound;
  eyeBreakVolume: number;          // 0-100
  eyeBreakTitle: string;
  eyeBreakMessage: string;
  eyeBreakBg: string;              // break screen background colour
  eyeBreakFg: string;              // break screen text colour
  eyeBreakOpacity: number;         // break window opacity, 20-100
  eyeBreakStatusBar: EyeBreakStatus;
}

export const DEFAULT_EYE_SETTINGS: EyeBreakSettings = {
  eyeBreakEnabled: true,
  eyeBreakEveryMins: 20,           // the 20-20-20 rule: every 20 minutes, look 20 feet away, for 20 seconds
  eyeBreakSecs: 20,
  eyeBreakWarnSecs: 10,
  eyeBreakAllowSnooze: true,
  eyeBreakSnoozeMins: 5,
  eyeBreakSnoozeLimit: 0,
  eyeBreakAllowSkip: true,
  eyeBreakAllowEndEarly: true,
  eyeBreakEndEarlyAfter: 5,
  eyeBreakMode: "popup",
  eyeBreakHoldDuringBreak: true,
  eyeBreakIdleMins: 5,
  eyeBreakIdleNotice: false,
  eyeBreakSound: "chime",
  eyeBreakVolume: 50,
  eyeBreakTitle: "Rest your eyes",
  eyeBreakMessage: "Look at something far away and let your eyes relax.",
  eyeBreakBg: "#1f3a34",
  eyeBreakFg: "#f3efe6",
  eyeBreakOpacity: 100,
  eyeBreakStatusBar: "next",
};

// What a quit must not lose: the countdown continues on the wall clock after a restart.
export interface EyeBreakState {
  nextAt: number | null;     // ms epoch when the next break is due
  cycleStart: number | null; // when the current countdown began (so a changed interval re-derives nextAt)
  snoozed: number;           // snoozes used against the break that is due next
  lastEnd: number | null;    // when the last break ended
  paused: boolean;           // paused from the status bar / command, until resumed
}

// The engine needs a little of the plugin: its app, its settings, a way to persist, the
// pomodoro engine's break flag, the float's window (never to be mistaken for ours), and
// the background-throttle switch. Typed as an interface so this file stays decoupled.
export interface EyeBreakHost {
  app: any;
  settings(): EyeBreakSettings;
  state(): EyeBreakState;
  persist(): Promise<void>;
  focusLogBreakRunning(): boolean;
  floatWindow(): any;
  setBackgroundThrottle(allowed: boolean): void;
}

type Phase = "idle" | "warn" | "break";

// The corner card's size (px) and its distance from the work area's bottom-right corner.
const CARD_W = 380;
const CARD_H = 190;
const CARD_GAP = 20;

function clampInt(v: any, lo: number, hi: number, dflt: number): number {
  const n = Math.round(Number(v));
  if (!isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

function mmss(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
}

// A BrowserWindow's id, or -1 once Electron has destroyed it (reading it would throw).
function winId(w: any): number {
  try { return w && !(w.isDestroyed && w.isDestroyed()) ? w.id : -1; } catch { return -1; }
}

export class EyeBreakEngine {
  phase: Phase = "idle";
  layout: EyeLayout = "card";    // the popout's current shape: the corner card, or the whole display
  breakStartAt = 0;
  breakEndAt = 0;
  breakSecsTotal = 0;
  eyeWin: any = null;            // the popout's BrowserWindow while it is up
  private iv: number | null = null;
  private warnNotice: Notice | null = null;     // fallback heads-up (no popout possible)
  private warnNum: HTMLElement | null = null;
  private breakNotice: Notice | null = null;    // fallback card-mode break (no popout possible)
  private overlay: HTMLElement | null = null;   // fallback full-screen break: an overlay inside the main window
  private overlayUnsub: (() => void) | null = null;
  private opening = false;       // true between asking for a popout and window-open claiming it
  private idleWas = false;
  private lastShownSec = -1;
  private lastPersist = 0;
  private audio: AudioContext | null = null;
  private subs = new Set<() => void>();

  constructor(private host: EyeBreakHost) {}

  // ---------- lifecycle ----------
  start() {
    const st = this.host.state();
    const s = this.host.settings();
    const now = Date.now();
    // A countdown that is still in the future resumes as it was; one that lapsed while
    // Obsidian was closed starts a fresh cycle, so a launch never opens straight into a break.
    if (!st.nextAt || st.nextAt <= now + 1000 || !st.cycleStart) this.schedule(false);
    else if (st.cycleStart + s.eyeBreakEveryMins * 60000 < now) this.schedule(false);
    this.iv = window.setInterval(() => this.poll(), 1000);
  }
  dispose() {
    if (this.iv != null) { window.clearInterval(this.iv); this.iv = null; }
    this.phase = "idle";   // so the view's close handler sees a deliberate teardown, not a hand-close
    this.closeAll();
    try { this.audio?.close(); } catch {}
    this.audio = null;
  }

  subscribe(fn: () => void): () => void { this.subs.add(fn); return () => this.subs.delete(fn); }
  private emit() { this.subs.forEach((fn) => { try { fn(); } catch {} }); }

  // ---------- derived state ----------
  get settings(): EyeBreakSettings { return this.host.settings(); }
  get state(): EyeBreakState { return this.host.state(); }
  isActive(): boolean { return !!this.settings.eyeBreakEnabled && !this.state.paused; }
  secsToNext(): number {
    const n = this.state.nextAt;
    return n ? Math.max(0, Math.ceil((n - Date.now()) / 1000)) : 0;
  }
  secsSinceLast(): number {
    const l = this.state.lastEnd;
    return l ? Math.max(0, Math.floor((Date.now() - l) / 1000)) : 0;
  }
  breakSecsLeft(): number {
    if (this.phase !== "break") return 0;
    return Math.max(0, Math.ceil((this.breakEndAt - Date.now()) / 1000));
  }
  breakSecsGone(): number {
    if (this.phase !== "break") return 0;
    return Math.max(0, Math.floor((Date.now() - this.breakStartAt) / 1000));
  }
  canEndEarly(): boolean {
    const s = this.settings;
    return s.eyeBreakAllowEndEarly && this.breakSecsGone() >= Math.max(0, s.eyeBreakEndEarlyAfter || 0);
  }
  snoozesLeft(): number {
    const lim = this.settings.eyeBreakSnoozeLimit || 0;
    return lim > 0 ? Math.max(0, lim - (this.state.snoozed || 0)) : Infinity;
  }

  // ---------- scheduling ----------
  // Arm the next break a full interval from now. `keepSnoozes` is only true for the
  // re-derivation after a settings change, which must not forgive used snoozes.
  schedule(keepSnoozes: boolean) {
    const st = this.state;
    const now = Date.now();
    st.cycleStart = now;
    st.nextAt = now + Math.max(1, this.settings.eyeBreakEveryMins) * 60000;
    if (!keepSnoozes) st.snoozed = 0;
    this.phase = "idle";
    this.closeAll();
    this.host.setBackgroundThrottle(true);
    this.persistNow();
    this.emit();
  }
  // The interval setting changed: the running countdown keeps its start and takes the new length.
  applySettings() {
    const s = this.settings;
    const st = this.state;
    if (!s.eyeBreakEnabled) { this.cancelAll(); return; }
    if (this.phase === "break") return;
    const now = Date.now();
    const from = st.cycleStart || now;
    st.cycleStart = from;
    st.nextAt = Math.max(now + 3000, from + Math.max(1, s.eyeBreakEveryMins) * 60000);
    if (this.phase === "warn") this.leaveWarn();
    this.persistNow();
    this.emit();
  }
  private cancelAll() {
    this.phase = "idle";
    this.closeAll();
    this.host.setBackgroundThrottle(true);
    this.emit();
  }
  setPaused(paused: boolean) {
    const st = this.state;
    st.paused = paused;
    if (paused) this.cancelAll();
    else this.schedule(false);
    this.persistNow();
    this.emit();
  }
  togglePaused() { this.setPaused(!this.state.paused); }

  snooze(): boolean {
    const s = this.settings;
    if (!s.eyeBreakAllowSnooze) return false;
    if (this.snoozesLeft() <= 0) { new Notice("Focus Log: no snoozes left for this eye break.", 4000); return false; }
    const st = this.state;
    st.snoozed = (st.snoozed || 0) + 1;
    const now = Date.now();
    st.cycleStart = now;
    st.nextAt = now + Math.max(1, s.eyeBreakSnoozeMins) * 60000;
    this.phase = "idle";
    this.closeAll();
    this.host.setBackgroundThrottle(true);
    this.persistNow();
    this.emit();
    return true;
  }
  skip() {
    this.schedule(false);
  }
  // From the card, the status bar or a command: begin the break right away.
  startNow() {
    if (this.phase === "break") return;
    this.startBreak();
  }
  endEarly() {
    if (this.phase !== "break" || !this.canEndEarly()) return;
    this.finishBreak(true);
  }
  // The popout was closed by hand (its OS close button) while it was showing something.
  windowClosedByHand() {
    if (this.phase === "warn") this.skip();
    else if (this.phase === "break") this.finishBreak(true);
  }

  // ---------- the clock ----------
  poll() {
    const s = this.settings;
    const st = this.state;
    if (!s.eyeBreakEnabled || st.paused) { if (this.phase !== "idle") this.cancelAll(); return; }
    const now = Date.now();
    if (this.phase === "break") {
      if (now >= this.breakEndAt) { this.finishBreak(false); return; }
      this.renderTick();
      return;
    }
    if (!st.nextAt) { this.schedule(false); return; }
    // Already resting inside a Focus Log break: the eye countdown restarts from its end.
    if (s.eyeBreakHoldDuringBreak && this.host.focusLogBreakRunning()) {
      if (this.phase === "warn") this.leaveWarn();
      st.cycleStart = now;
      st.nextAt = now + Math.max(1, s.eyeBreakEveryMins) * 60000;
      this.persistThrottled();
      this.emit();
      return;
    }
    // Away from the keyboard: hold the countdown, and start a fresh cycle on return.
    if (s.eyeBreakIdleMins > 0) {
      const idle = this.idleSecs();
      if (idle >= s.eyeBreakIdleMins * 60) {
        this.idleWas = true;
        if (this.phase === "warn") this.leaveWarn();
        if (st.nextAt - now < 5000) { st.nextAt = now + 5000; this.persistThrottled(); }
        this.emit();
        return;
      }
      if (this.idleWas) {
        this.idleWas = false;
        this.schedule(false);
        if (s.eyeBreakIdleNotice) new Notice("Focus Log: welcome back - the eye-break countdown starts over.", 4000);
        return;
      }
    }
    if (now >= st.nextAt) { this.startBreak(); return; }
    if (this.phase === "idle" && s.eyeBreakWarnSecs > 0 && now >= st.nextAt - s.eyeBreakWarnSecs * 1000) this.enterWarn();
    if (this.phase === "warn" && this.warnNum) this.warnNum.setText(String(this.secsToNext()));
    this.emit();
  }

  private idleSecs(): number {
    try {
      const remote = getElectronRemote();
      const pm = remote && remote.powerMonitor;
      if (pm && typeof pm.getSystemIdleTime === "function") return pm.getSystemIdleTime();
    } catch {}
    return 0;
  }

  private persistNow() { this.lastPersist = Date.now(); void this.host.persist(); }
  private persistThrottled() { if (Date.now() - this.lastPersist > 15000) this.persistNow(); }

  // ---------- the heads-up ----------
  // The corner card appears above every app; where no popout can be made, an Obsidian
  // notice with the same three buttons stands in.
  private enterWarn() {
    this.phase = "warn";
    this.layout = "card";
    this.host.setBackgroundThrottle(false);   // the break must land on time even with Obsidian behind another app
    if (this.canPopout()) this.openWindow();
    else this.showWarnNotice();
    this.emit();
  }
  private leaveWarn() {
    this.phase = "idle";
    this.closeAll();
    this.host.setBackgroundThrottle(true);
  }

  // ---------- the break ----------
  private startBreak() {
    const s = this.settings;
    const now = Date.now();
    this.hideWarnNotice();
    this.phase = "break";
    this.breakStartAt = now;
    this.breakSecsTotal = Math.max(3, s.eyeBreakSecs);
    this.breakEndAt = now + this.breakSecsTotal * 1000;
    this.lastShownSec = -1;
    this.layout = s.eyeBreakMode === "card" ? "card" : "full";
    this.host.setBackgroundThrottle(false);
    this.playSound("start");
    if (this.eyeWin) this.applyLayout(this.eyeWin);   // the card grows into the break (or stays a card)
    else if (this.opening) { /* the popout is still being created; window-open applies the layout */ }
    else if (this.canPopout()) this.openWindow();
    else if (this.layout === "full") this.showOverlay();
    else this.showBreakNotice();
    this.emit();
  }
  private finishBreak(early: boolean) {
    this.state.lastEnd = Date.now();
    if (!early) this.playSound("end");
    this.schedule(false);   // closes the window, re-arms, hands the clock back
  }
  private renderTick() {
    const left = this.breakSecsLeft();
    if (left === this.lastShownSec) return;
    this.lastShownSec = left;
    if (this.breakNotice) { try { this.breakNotice.setMessage(this.settings.eyeBreakTitle + " - " + mmss(left) + " left. " + this.settings.eyeBreakMessage); } catch {} }
    this.emit();
  }

  // Everything that could be showing: the popout, the overlay, both fallback notices.
  private closeAll() {
    this.hideWarnNotice();
    this.hideBreakNotice();
    this.hideOverlay();
    this.closeWindow();
  }

  // ---------- the popout window ----------
  private canPopout(): boolean { return !Platform.isMobile && !!getElectronRemote(); }
  private openWindow() {
    const ws: any = this.host.app.workspace;
    try { ws.getLeavesOfType(VIEW_TYPE_EYE).forEach((l: any) => l.detach()); } catch {}
    this.opening = true;
    let leaf: WorkspaceLeaf;
    try {
      leaf = ws.openPopoutLeaf ? ws.openPopoutLeaf() : ws.getLeaf("window");
    } catch {
      this.opening = false;
      this.fallback();
      return;
    }
    try { leaf.setViewState({ type: VIEW_TYPE_EYE, active: true }).catch(() => {}); } catch {}
    // If window-open never claims the popout, still place whatever opened; and never leave
    // a window invisible from the opacity trick.
    window.setTimeout(() => {
      if (this.opening) { this.opening = false; this.placeWindow(this.newestWindow()); }
      try { if (this.eyeWin && this.eyeWin.setOpacity) this.eyeWin.setOpacity(this.opacity()); } catch {}
    }, 150);
  }
  private fallback() {
    if (this.phase === "warn") this.showWarnNotice();
    else if (this.phase === "break" && this.layout === "full") this.showOverlay();
    else if (this.phase === "break") this.showBreakNotice();
  }
  // Fired from the workspace "window-open" event; true when the new window was ours.
  onWindowOpen(): boolean {
    if (!this.opening) return false;
    this.opening = false;
    this.placeWindow(this.newestWindow());
    return true;
  }
  private newestWindow(): any {
    try {
      const remote = getElectronRemote();
      if (!remote || !remote.BrowserWindow) return null;
      const cur = remote.getCurrentWindow ? winId(remote.getCurrentWindow()) : -1;
      const flt = winId(this.host.floatWindow());
      const all = remote.BrowserWindow.getAllWindows ? remote.BrowserWindow.getAllWindows() : [];
      return all.filter((w: any) => { const id = winId(w); return id >= 0 && id !== cur && id !== flt; }).pop() || null;
    } catch { return null; }
  }
  private display(): any {
    try {
      const remote = getElectronRemote();
      const scr = remote && remote.screen;
      return scr ? scr.getDisplayNearestPoint(scr.getCursorScreenPoint()) : null;
    } catch { return null; }
  }
  private opacity(): number { return Math.max(0.2, Math.min(1, (this.settings.eyeBreakOpacity ?? 100) / 100)); }
  // First placement of a fresh popout: hidden, pinned, shaped, then revealed — so its
  // first visible frame is already the card in the corner (or the whole display).
  private placeWindow(win: any) {
    if (!win) { this.fallback(); return; }
    this.eyeWin = win;
    try { win.setOpacity(0); } catch {}
    this.pinWindow(win);
    this.applyLayout(win);
    window.setTimeout(() => {
      try { win.setOpacity(this.opacity()); } catch {}
      try { if (win.showInactive) win.showInactive(); else win.show(); } catch {}
    }, 60);
  }
  private pinWindow(win: any) {
    try { win.setAlwaysOnTop(true, "screen-saver"); } catch {}
    // skipTransformProcessType keeps macOS from bouncing Obsidian's dock presence here.
    try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true }); } catch {}
    // Never take the keyboard: the app you were typing in stays focused for the whole
    // break, and is exactly where you land when the window goes.
    try { win.setFocusable(false); } catch {}
    try { win.setSkipTaskbar(true); } catch {}
    try { win.setMinimizable(false); } catch {}
    try { if (win.webContents && win.webContents.setBackgroundThrottling) win.webContents.setBackgroundThrottling(false); } catch {}
  }
  // Shape the window to the current layout: the corner card of the display under the
  // cursor, or that whole display. Called again on the same window when the card grows.
  private applyLayout(win: any) {
    const d = this.display();
    if (this.layout === "full") {
      try { if (d && d.bounds) win.setBounds(d.bounds); } catch {}
      try {
        // macOS "simple" full screen fills the display in place; native full screen would
        // animate into its own Space. Other platforms take the plain full-screen flag.
        if (Platform.isMacOS && win.setSimpleFullScreen) win.setSimpleFullScreen(true);
        else win.setFullScreen(true);
      } catch {}
      return;
    }
    this.unFullScreen(win);
    const wa = d ? (d.workArea || d.bounds) : null;
    if (wa) {
      try {
        win.setBounds({
          x: Math.round(wa.x + wa.width - CARD_W - CARD_GAP),
          y: Math.round(wa.y + wa.height - CARD_H - CARD_GAP),
          width: CARD_W,
          height: CARD_H,
        });
      } catch {}
    } else {
      try { const cur = win.getBounds(); win.setBounds({ x: cur.x, y: cur.y, width: CARD_W, height: CARD_H }); } catch {}
    }
  }
  private unFullScreen(win: any) {
    try {
      if (Platform.isMacOS && win.setSimpleFullScreen) { if (!win.isSimpleFullScreen || win.isSimpleFullScreen()) win.setSimpleFullScreen(false); }
      else if (win.isFullScreen && win.isFullScreen()) win.setFullScreen(false);
    } catch {}
  }
  private closeWindow() {
    this.opening = false;
    const win = this.eyeWin;
    this.eyeWin = null;
    if (win) this.unFullScreen(win);
    try { this.host.app.workspace.getLeavesOfType(VIEW_TYPE_EYE).forEach((l: any) => l.detach()); } catch {}
  }

  // ---------- fallbacks: Obsidian notices and an in-window overlay ----------
  private showWarnNotice() {
    this.hideWarnNotice();
    const s = this.settings;
    const frag = document.createDocumentFragment();
    const wrap = frag.createDiv({ cls: "fl-eye-warn" });
    const line = wrap.createDiv({ cls: "fl-eye-warn-line" });
    line.createSpan({ text: "Eye break in " });
    this.warnNum = line.createSpan({ cls: "fl-eye-warn-num", text: String(this.secsToNext()) });
    line.createSpan({ text: " s" });
    const btns = wrap.createDiv({ cls: "fl-eye-warn-btns" });
    const mk = (label: string, fn: () => void) => {
      const b = btns.createEl("button", { text: label, cls: "fl-eye-warn-btn" });
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    };
    mk("Start now", () => this.startNow());
    if (s.eyeBreakAllowSnooze) mk("Snooze " + s.eyeBreakSnoozeMins + " min", () => this.snooze());
    if (s.eyeBreakAllowSkip) mk("Skip", () => this.skip());
    this.warnNotice = new Notice(frag, 0);
  }
  private hideWarnNotice() {
    if (this.warnNotice) { try { this.warnNotice.hide(); } catch {} }
    this.warnNotice = null;
    this.warnNum = null;
  }
  private showBreakNotice() {
    this.hideBreakNotice();
    const s = this.settings;
    this.breakNotice = new Notice(s.eyeBreakTitle + " - " + mmss(this.breakSecsLeft()) + " left. " + s.eyeBreakMessage, 0);
  }
  private hideBreakNotice() {
    if (this.breakNotice) { try { this.breakNotice.hide(); } catch {} }
    this.breakNotice = null;
  }
  private showOverlay() {
    this.hideOverlay();
    const el = document.body.createDiv({ cls: "fl-eye-overlay" });
    this.overlay = el;
    const screen = renderEyeScreen(el, this);
    this.overlayUnsub = this.subscribe(() => screen.update());
  }
  private hideOverlay() {
    const el = this.overlay;
    this.overlay = null;
    try { this.overlayUnsub?.(); } catch {}
    this.overlayUnsub = null;
    if (el) { try { el.remove(); } catch {} }
  }

  // ---------- sounds (synthesised, so no asset ships) ----------
  private playSound(which: "start" | "end") {
    const s = this.settings;
    if (!s.eyeBreakSound || s.eyeBreakSound === "none") return;
    const vol = Math.max(0, Math.min(1, (s.eyeBreakVolume ?? 50) / 100));
    if (vol <= 0) return;
    try {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!this.audio) this.audio = new AC();
      const ctx = this.audio!;
      if (ctx.state === "suspended") { try { ctx.resume(); } catch {} }
      const t0 = ctx.currentTime + 0.02;
      const tone = (freq: number, at: number, dur: number, gain: number, type: OscillatorType) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, at);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(gain * vol, at + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(at);
        o.stop(at + dur + 0.05);
      };
      if (s.eyeBreakSound === "blip") {
        tone(which === "start" ? 880 : 660, t0, 0.12, 0.25, "square");
        return;
      }
      // A soft two-note chime: rising to open the break, falling to close it.
      const a = which === "start" ? 523.25 : 659.25;   // C5 or E5
      const b = which === "start" ? 783.99 : 523.25;   // G5 or C5
      tone(a, t0, 1.1, 0.35, "sine");
      tone(a * 2, t0, 0.5, 0.06, "sine");
      tone(b, t0 + 0.28, 1.4, 0.35, "sine");
      tone(b * 2, t0 + 0.28, 0.6, 0.06, "sine");
    } catch {}
  }

  // ---------- the status bar clock ----------
  statusText(): string {
    const s = this.settings;
    if (!s.eyeBreakEnabled) return "";
    if (this.state.paused) return "\u{1F441} paused";
    if (this.phase === "break") return "\u{1F441} " + mmss(this.breakSecsLeft());
    if (s.eyeBreakStatusBar === "since") return "\u{1F441} +" + mmss(this.secsSinceLast());
    return "\u{1F441} " + mmss(this.secsToNext());
  }
  statusMenu(evt: MouseEvent) {
    const s = this.settings;
    const menu = new Menu();
    if (this.phase === "break") {
      if (this.canEndEarly()) menu.addItem((i) => i.setTitle("End the eye break early").setIcon("check").onClick(() => this.endEarly()));
    } else {
      menu.addItem((i) => i.setTitle("Take an eye break now").setIcon("eye").onClick(() => this.startNow()));
      if (s.eyeBreakAllowSnooze) menu.addItem((i) => i.setTitle("Snooze the next one " + s.eyeBreakSnoozeMins + " min").setIcon("alarm-clock").onClick(() => this.snooze()));
      if (s.eyeBreakAllowSkip) menu.addItem((i) => i.setTitle("Skip the next one").setIcon("skip-forward").onClick(() => this.skip()));
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(this.state.paused ? "Resume eye breaks" : "Pause eye breaks").setIcon(this.state.paused ? "play" : "pause").onClick(() => this.togglePaused()));
    menu.showAtMouseEvent(evt);
  }
}

// ---------- the screen (shared by the popout view and the overlay) ----------
// Three faces, by engine phase and layout: the heads-up card (countdown to the break with
// Start now / Snooze / Skip), the break as a card (countdown bar + End early), and the
// break as a full screen (title, message, countdown ring + End early). During a break the
// single button is End early: a break already under way is never skipped or snoozed.
export function renderEyeScreen(root: HTMLElement, eng: EyeBreakEngine): { update: () => void } {
  const s = eng.settings;
  const card = eng.layout === "card";
  const warn = eng.phase === "warn";
  root.empty();
  // Add to the root's classes rather than replace them: the overlay fallback keeps its own.
  root.removeClass("is-card", "is-full", "is-warn", "is-break");
  root.addClass("fl-eye", card ? "is-card" : "is-full", warn ? "is-warn" : "is-break");
  root.style.setProperty("--fl-eye-bg", s.eyeBreakBg || DEFAULT_EYE_SETTINGS.eyeBreakBg);
  root.style.setProperty("--fl-eye-fg", s.eyeBreakFg || DEFAULT_EYE_SETTINGS.eyeBreakFg);
  const box = root.createDiv({ cls: "fl-eye-box" });
  const mkBtn = (parent: HTMLElement, label: string, cls: string, fn: () => void) => {
    const b = parent.createEl("button", { text: label, cls: "fl-eye-btn " + cls });
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    return b;
  };
  const title = s.eyeBreakTitle || DEFAULT_EYE_SETTINGS.eyeBreakTitle;

  if (warn) {
    const line = box.createDiv({ cls: "fl-eye-ctitle" });
    line.createSpan({ text: "Eye break in " });
    const num = line.createSpan({ cls: "fl-eye-cnum", text: String(eng.secsToNext()) });
    line.createSpan({ text: " s" });
    box.createDiv({ cls: "fl-eye-cmsg", text: "Look away from the screen for " + s.eyeBreakSecs + " seconds." });
    const bar = box.createDiv({ cls: "fl-eye-bar" });
    const fill = bar.createDiv({ cls: "fl-eye-bar-fill" });
    const btns = box.createDiv({ cls: "fl-eye-btns" });
    mkBtn(btns, "Start now", "fl-eye-now", () => eng.startNow());
    const snoozeBtn = s.eyeBreakAllowSnooze ? mkBtn(btns, "Snooze " + s.eyeBreakSnoozeMins + " min", "fl-eye-snooze", () => eng.snooze()) : null;
    if (s.eyeBreakAllowSkip) mkBtn(btns, "Skip", "fl-eye-skip", () => eng.skip());
    const total = Math.max(1, s.eyeBreakWarnSecs);
    const update = () => {
      const left = eng.secsToNext();
      num.setText(String(left));
      fill.style.width = Math.max(0, Math.min(100, (left / total) * 100)).toFixed(1) + "%";
      if (snoozeBtn) snoozeBtn.toggleClass("is-off", eng.snoozesLeft() <= 0);
    };
    update();
    return { update };
  }

  // The break itself, as a card or the whole screen.
  let num: HTMLElement;
  let arc: SVGCircleElement | null = null;
  let fill: HTMLElement | null = null;
  const C = 2 * Math.PI * 54;
  if (card) {
    const line = box.createDiv({ cls: "fl-eye-ctitle" });
    line.createSpan({ text: title + " " });
    num = line.createSpan({ cls: "fl-eye-cnum", text: String(eng.breakSecsLeft()) });
    line.createSpan({ text: " s" });
    if (s.eyeBreakMessage) box.createDiv({ cls: "fl-eye-cmsg", text: s.eyeBreakMessage });
    const bar = box.createDiv({ cls: "fl-eye-bar" });
    fill = bar.createDiv({ cls: "fl-eye-bar-fill" });
  } else {
    box.createDiv({ cls: "fl-eye-title", text: title });
    if (s.eyeBreakMessage) box.createDiv({ cls: "fl-eye-msg", text: s.eyeBreakMessage });
    const ring = box.createDiv({ cls: "fl-eye-ring" });
    ring.innerHTML = `<svg viewBox="0 0 120 120" width="160" height="160" aria-hidden="true">
      <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-width="6"/>
      <circle class="fl-eye-arc" cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"
        stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="0" transform="rotate(-90 60 60)"/>
    </svg>`;
    arc = ring.querySelector(".fl-eye-arc") as SVGCircleElement | null;
    num = ring.createDiv({ cls: "fl-eye-num", text: String(eng.breakSecsLeft()) });
  }
  const btns = box.createDiv({ cls: "fl-eye-btns" });
  const endBtn = s.eyeBreakAllowEndEarly ? mkBtn(btns, "End break early", "fl-eye-end", () => eng.endEarly()) : null;
  const foot = card ? null : box.createDiv({ cls: "fl-eye-foot" });
  const update = () => {
    const left = eng.breakSecsLeft();
    num.setText(String(left));
    const frac = eng.breakSecsTotal > 0 ? Math.max(0, Math.min(1, left / eng.breakSecsTotal)) : 0;
    if (arc) arc.setAttribute("stroke-dashoffset", (C * (1 - frac)).toFixed(2));
    if (fill) fill.style.width = (frac * 100).toFixed(1) + "%";
    if (endBtn) {
      const wait = Math.max(0, (s.eyeBreakEndEarlyAfter || 0) - eng.breakSecsGone());
      const ok = eng.canEndEarly();
      endBtn.toggleClass("is-waiting", !ok);
      endBtn.setText(ok ? "End break early" : "End break early (" + wait + " s)");
    }
    if (foot) foot.setText("Next eye break in " + s.eyeBreakEveryMins + " min");
  };
  update();
  return { update };
}

// The popout view: a plain-DOM screen that reads the engine, redraws when the phase or
// layout changes, and refreshes on its own window's clock (the popout's timers are not
// throttled while it is visible, unlike the main window's when Obsidian is behind an app).
export class EyeBreakView extends ItemView {
  private eng: EyeBreakEngine;
  private fwin: any = null;
  private tick = 0;
  private tickWin: any = null;   // the window that owns `tick` (interval ids are per-window)
  private unsub: (() => void) | null = null;
  private rootEl: HTMLElement | null = null;
  private screen: { update: () => void } | null = null;
  private key = "";
  constructor(leaf: WorkspaceLeaf, eng: EyeBreakEngine) {
    super(leaf);
    this.eng = eng;
  }
  getViewType() { return VIEW_TYPE_EYE; }
  getDisplayText() { return "Eye break"; }
  getIcon() { return "eye"; }
  // Idempotent: tags the popout body (headers hidden) once the view lives in its own
  // window, and moves the refresh tick onto that window's clock.
  private tagWindow() {
    try {
      const doc = this.contentEl.ownerDocument;
      if (doc && doc !== document) {
        doc.body.classList.add("focuslog-eye-window");
        const w = doc.defaultView;
        if (w && w !== this.fwin) {
          try { (this.tickWin || window).clearInterval(this.tick); } catch {}
          this.fwin = w;
          this.tickWin = w;
          this.tick = w.setInterval(() => { this.eng.poll(); this.paint(); }, 250);
        }
      }
    } catch {}
  }
  private paint() {
    if (!this.rootEl || this.eng.phase === "idle") return;   // idle: the window is on its way out
    const k = this.eng.phase + "|" + this.eng.layout;
    if (k !== this.key) { this.key = k; this.screen = renderEyeScreen(this.rootEl, this.eng); }
    else this.screen?.update();
  }
  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("focuslog-eye");
    this.fwin = null;
    this.key = "";
    this.rootEl = root.createDiv();
    this.paint();
    this.unsub = this.eng.subscribe(() => this.paint());
    this.tagWindow();
    if (!this.fwin) { this.tickWin = window; this.tick = window.setInterval(() => { this.tagWindow(); this.paint(); }, 250); }
  }
  async onClose() {
    try { this.unsub?.(); } catch {}
    this.unsub = null;
    try { (this.tickWin || window).clearInterval(this.tick); } catch {}
    try { window.clearInterval(this.tick); } catch {}
    try { this.fwin && this.fwin.document.body.classList.remove("focuslog-eye-window"); } catch {}
    try { this.contentEl.ownerDocument.body.classList.remove("focuslog-eye-window"); } catch {}
    this.fwin = null;
    this.tickWin = null;
    this.rootEl = null;
    this.screen = null;
    // The engine's own closes move the phase to idle before this runs; a phase still live
    // here means the window was closed by hand, which the engine treats as skip / end early.
    try { window.setTimeout(() => this.eng.windowClosedByHand(), 0); } catch {}
  }
}

// ---------- settings section ----------
export function buildEyeBreakSettings(containerEl: HTMLElement, s: EyeBreakSettings, save: () => Promise<void>, eng: EyeBreakEngine) {
  containerEl.createEl("h3", { text: "Eye breaks" });
  containerEl.createEl("p", {
    text: "A rest reminder in the spirit of BreakTimer: every so often a window asks you to look away for a few seconds, then disappears. A small card in the corner of your screen counts down first, above every app, without taking the keyboard from whatever you are typing in. It runs whenever Obsidian is open and is independent of the pomodoro: it never pauses a task, a pomodoro or a Focus Log break.",
    cls: "setting-item-description",
  });

  const num = (t: any, width: string) => { t.inputEl.type = "number"; t.inputEl.style.width = width; };
  const after = async () => { await save(); eng.applySettings(); };

  new Setting(containerEl)
    .setName("Eye breaks")
    .setDesc("Turn the reminder on or off. The status-bar eye and the “Eye break” commands also let you pause it for a while.")
    .addToggle((t) => t.setValue(s.eyeBreakEnabled).onChange(async (v) => { s.eyeBreakEnabled = v; await save(); if (v) eng.schedule(false); else eng.applySettings(); }));

  const every = new Setting(containerEl)
    .setName("Every N minutes, rest for N seconds")
    .setDesc("The 20-20-20 default: every 20 minutes, look at something 20 feet (6 m) away for 20 seconds.");
  every.addText((t) => { num(t, "5em"); t.setValue(String(s.eyeBreakEveryMins)).onChange(async (v) => { const n = clampInt(v, 1, 600, 20); s.eyeBreakEveryMins = n; await after(); }); });
  every.controlEl.createEl("span", { text: "min", attr: { style: "font-size:12px;color:var(--text-muted);margin:0 12px 0 5px" } });
  every.addText((t) => { num(t, "5em"); t.setValue(String(s.eyeBreakSecs)).onChange(async (v) => { const n = clampInt(v, 3, 3600, 20); s.eyeBreakSecs = n; await save(); }); });
  every.controlEl.createEl("span", { text: "s", attr: { style: "font-size:12px;color:var(--text-muted);margin-left:5px" } });

  new Setting(containerEl)
    .setName("How the break appears")
    .setDesc("Full screen covers the display you are working on; the small window stays in its bottom-right corner. Both float above every app. Where no such window can be made (mobile), a screen inside Obsidian or a notice stands in.")
    .addDropdown((d) => d.addOption("popup", "Full-screen window").addOption("card", "Small corner window").setValue(s.eyeBreakMode === "card" ? "card" : "popup").onChange(async (v) => { s.eyeBreakMode = v === "card" ? "card" : "popup"; await save(); }));

  new Setting(containerEl)
    .setName("Heads-up before the break")
    .setDesc("The corner card counts down this many seconds before the break, with Start now / Snooze / Skip. 0 starts the break with no warning (and no chance to snooze or skip it).")
    .addText((t) => { num(t, "5em"); t.setValue(String(s.eyeBreakWarnSecs)).onChange(async (v) => { s.eyeBreakWarnSecs = clampInt(v, 0, 300, 10); await save(); }); });

  const snooze = new Setting(containerEl)
    .setName("Snooze")
    .setDesc("Let the heads-up push a break back by this many minutes. The limit caps how many times one break can be snoozed; 0 means no limit.");
  snooze.addToggle((t) => t.setValue(s.eyeBreakAllowSnooze).onChange(async (v) => { s.eyeBreakAllowSnooze = v; await save(); }));
  snooze.addText((t) => { num(t, "5em"); t.setValue(String(s.eyeBreakSnoozeMins)).onChange(async (v) => { s.eyeBreakSnoozeMins = clampInt(v, 1, 240, 5); await save(); }); });
  snooze.controlEl.createEl("span", { text: "min", attr: { style: "font-size:12px;color:var(--text-muted);margin:0 12px 0 5px" } });
  snooze.addText((t) => { num(t, "4em"); t.setValue(String(s.eyeBreakSnoozeLimit)).onChange(async (v) => { s.eyeBreakSnoozeLimit = clampInt(v, 0, 99, 0); await save(); }); });
  snooze.controlEl.createEl("span", { text: "limit", attr: { style: "font-size:12px;color:var(--text-muted);margin-left:5px" } });

  new Setting(containerEl)
    .setName("Skip")
    .setDesc("Show a “Skip” button on the heads-up. A break already under way cannot be skipped, only ended early.")
    .addToggle((t) => t.setValue(s.eyeBreakAllowSkip).onChange(async (v) => { s.eyeBreakAllowSkip = v; await save(); }));

  const early = new Setting(containerEl)
    .setName("End early")
    .setDesc("The break screen's only button. It becomes active once the break has run for this many seconds (0 = right away).");
  early.addToggle((t) => t.setValue(s.eyeBreakAllowEndEarly).onChange(async (v) => { s.eyeBreakAllowEndEarly = v; await save(); }));
  early.addText((t) => { num(t, "5em"); t.setValue(String(s.eyeBreakEndEarlyAfter)).onChange(async (v) => { s.eyeBreakEndEarlyAfter = clampInt(v, 0, 3600, 5); await save(); }); });
  early.controlEl.createEl("span", { text: "s", attr: { style: "font-size:12px;color:var(--text-muted);margin-left:5px" } });

  new Setting(containerEl)
    .setName("Restart the countdown during a Focus Log break")
    .setDesc("While a pomodoro break is running you are already resting, so the eye countdown starts over from the end of that break. The pomodoro side is never touched either way.")
    .addToggle((t) => t.setValue(s.eyeBreakHoldDuringBreak).onChange(async (v) => { s.eyeBreakHoldDuringBreak = v; await save(); }));

  const idle = new Setting(containerEl)
    .setName("Restart the countdown after being away")
    .setDesc("If the computer sees no input for this many minutes, the countdown starts over when you return (0 = off). Needs Obsidian's Electron idle API; ignored where it is missing.");
  idle.addText((t) => { num(t, "5em"); t.setValue(String(s.eyeBreakIdleMins)).onChange(async (v) => { s.eyeBreakIdleMins = clampInt(v, 0, 240, 5); await save(); }); });
  idle.controlEl.createEl("span", { text: "min", attr: { style: "font-size:12px;color:var(--text-muted);margin:0 12px 0 5px" } });
  idle.addToggle((t) => { t.setTooltip("Show a notice when the countdown was reset"); t.setValue(s.eyeBreakIdleNotice).onChange(async (v) => { s.eyeBreakIdleNotice = v; await save(); }); });

  const snd = new Setting(containerEl)
    .setName("Sound")
    .setDesc("A short tone when a break starts and when it ends, with its loudness.");
  snd.addDropdown((d) => d.addOption("none", "Silent").addOption("chime", "Chime").addOption("blip", "Blip").setValue(s.eyeBreakSound).onChange(async (v) => { s.eyeBreakSound = (v as EyeBreakSound) || "none"; await save(); }));
  snd.addSlider((sl) => sl.setLimits(0, 100, 5).setValue(s.eyeBreakVolume).setDynamicTooltip().onChange(async (v) => { s.eyeBreakVolume = v; await save(); }));

  new Setting(containerEl)
    .setName("Title")
    .setDesc("The heading on the break screen.")
    .addText((t) => { t.setValue(s.eyeBreakTitle).onChange(async (v) => { s.eyeBreakTitle = v; await save(); }); t.inputEl.style.width = "22em"; });

  new Setting(containerEl)
    .setName("Message")
    .setDesc("The line under the title. Leave blank for none.")
    .addText((t) => { t.setValue(s.eyeBreakMessage).onChange(async (v) => { s.eyeBreakMessage = v; await save(); }); t.inputEl.style.width = "22em"; });

  const colors = new Setting(containerEl)
    .setName("Colours")
    .setDesc("Background and text of the break screen and the corner card.");
  colors.addColorPicker((c) => c.setValue(s.eyeBreakBg).onChange(async (v) => { s.eyeBreakBg = v; await save(); }));
  colors.controlEl.createEl("span", { text: "background", attr: { style: "font-size:12px;color:var(--text-muted);margin:0 12px 0 5px" } });
  colors.addColorPicker((c) => c.setValue(s.eyeBreakFg).onChange(async (v) => { s.eyeBreakFg = v; await save(); }));
  colors.controlEl.createEl("span", { text: "text", attr: { style: "font-size:12px;color:var(--text-muted);margin-left:5px" } });

  new Setting(containerEl)
    .setName("Window opacity")
    .setDesc("How solid the break window is. Below 100 the screen behind shows through.")
    .addSlider((sl) => sl.setLimits(20, 100, 5).setValue(s.eyeBreakOpacity).setDynamicTooltip().onChange(async (v) => { s.eyeBreakOpacity = v; await save(); }));

  new Setting(containerEl)
    .setName("Status bar")
    .setDesc("Show an eye in the status bar with the time to the next break, or the time since the last one. Click it for now / snooze / skip / pause.")
    .addDropdown((d) => d.addOption("next", "Time to next break").addOption("since", "Time since last break").addOption("off", "Hidden").setValue(s.eyeBreakStatusBar).onChange(async (v) => { s.eyeBreakStatusBar = (v as EyeBreakStatus) || "next"; await save(); eng.applySettings(); }));

  new Setting(containerEl)
    .setName("Try it")
    .setDesc("Start an eye break right now with the settings above, skipping the heads-up.")
    .addButton((b) => b.setButtonText("Take a break now").onClick(() => eng.startNow()));
}
