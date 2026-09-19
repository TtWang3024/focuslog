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
  eyeBreakKeepAwake: boolean;      // hold a power-save blocker, so a minimized Obsidian cannot nap the clock
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
  eyeBreakKeepAwake: true,
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
  log?: string[];                  // the last 60 engine events, for reading back what a freeze did
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

// The page inside the eye-break window: the card and the break screen as plain HTML, styled
// like styles.css's .fl-eye rules (the window is not an Obsidian window, so it gets none of
// the plugin's CSS), with a small script that repaints from the models the engine pushes
// and hands back the button pressed in between.
function eyePageHtml(s: EyeBreakSettings): string {
  const bg = s.eyeBreakBg || DEFAULT_EYE_SETTINGS.eyeBreakBg;
  const fg = s.eyeBreakFg || DEFAULT_EYE_SETTINGS.eyeBreakFg;
  const css = `
html, body { margin: 0; height: 100%; overflow: hidden; background: ${bg}; }
* { box-sizing: border-box; }
.fl-eye { height: 100%; width: 100%; display: flex; align-items: center; justify-content: center;
  background: var(--fl-eye-bg, ${bg}); color: var(--fl-eye-fg, ${fg}); user-select: none; cursor: default;
  font-family: 'Baloo 2', system-ui, -apple-system, 'Segoe UI', sans-serif; }
.fl-eye-box { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 24px; text-align: center; max-width: 640px; }
.fl-eye-title { font-weight: 700; font-size: clamp(28px, 4.5vw, 48px); line-height: 1.1; }
.fl-eye-msg { font-size: clamp(15px, 1.6vw, 20px); opacity: 0.85; max-width: 36em; }
.fl-eye-ring { position: relative; width: 160px; height: 160px; margin: 8px 0; }
.fl-eye-ring svg { position: absolute; inset: 0; }
#arc { transition: stroke-dashoffset 0.9s linear; }
.fl-eye-num { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 54px; font-variant-numeric: tabular-nums; }
.fl-eye-btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.fl-eye-btn { font: inherit; font-size: 14px; border: 1.5px solid currentColor; background: transparent; color: inherit;
  border-radius: 999px; padding: 6px 16px; box-shadow: none; cursor: pointer; transition: background 0.12s ease, opacity 0.12s ease; }
.fl-eye-btn:hover { background: rgba(127, 127, 127, 0.22); }
.fl-eye-btn.is-off { opacity: 0.4; cursor: default; pointer-events: none; }
.fl-eye-foot { font-size: 12px; opacity: 0.6; }
.fl-eye.is-card { align-items: stretch; justify-content: center; }
.fl-eye.is-card .fl-eye-box { align-items: flex-start; text-align: left; gap: 8px; padding: 26px 18px 14px; max-width: none; }
.fl-eye-ctitle { font-weight: 700; font-size: 19px; line-height: 1.15; }
.fl-eye-cnum { font-variant-numeric: tabular-nums; }
.fl-eye-cmsg { font-size: 13px; opacity: 0.85; line-height: 1.3; }
.fl-eye-bar { width: 100%; height: 4px; border-radius: 999px; background: rgba(127, 127, 127, 0.28); position: relative; overflow: hidden; }
.fl-eye-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; background: currentColor; border-radius: 999px; transition: width 0.9s linear; }
.fl-eye.is-card .fl-eye-btns { gap: 6px; margin-top: 2px; }
.fl-eye.is-card .fl-eye-btn { font-size: 12.5px; padding: 4px 12px; }
`;
  const js = `
(function () {
  var pending = null, shape = "";
  var C = 2 * Math.PI * 54;
  function el(id) { return document.getElementById(id); }
  function build(m) {
    var root = el("root");
    root.className = "fl-eye " + (m.card ? "is-card" : "is-full") + (m.warn ? " is-warn" : " is-break");
    var h = '<div class="fl-eye-box">';
    if (m.card) {
      h += '<div class="fl-eye-ctitle"><span id="title"></span><span class="fl-eye-cnum" id="num"></span><span id="unit"></span></div>';
      h += '<div class="fl-eye-cmsg" id="msg"></div>';
      h += '<div class="fl-eye-bar"><div class="fl-eye-bar-fill" id="fill"></div></div>';
    } else {
      h += '<div class="fl-eye-title" id="title"></div><div class="fl-eye-msg" id="msg"></div>';
      h += '<div class="fl-eye-ring"><svg viewBox="0 0 120 120" width="160" height="160" aria-hidden="true">'
        + '<circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-width="6"/>'
        + '<circle id="arc" cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="0" transform="rotate(-90 60 60)"/>'
        + '</svg><div class="fl-eye-num" id="num"></div></div>';
    }
    h += '<div class="fl-eye-btns" id="btns"></div>';
    if (!m.card) h += '<div class="fl-eye-foot" id="foot"></div>';
    root.innerHTML = h + '</div>';
  }
  window.__eyeSync = function (m) {
    var k = (m.card ? "c" : "f") + (m.warn ? "w" : "b");
    if (k !== shape) { shape = k; build(m); }
    var rs = document.documentElement.style;
    rs.setProperty("--fl-eye-bg", m.bg);
    rs.setProperty("--fl-eye-fg", m.fg);
    el("title").textContent = m.title;
    el("num").textContent = String(m.num);
    var u = el("unit"); if (u) u.textContent = m.unit;
    var msg = el("msg"); msg.textContent = m.msg; msg.style.display = m.msg ? "" : "none";
    var fill = el("fill"); if (fill) fill.style.width = (m.frac * 100).toFixed(1) + "%";
    var arc = el("arc"); if (arc) arc.setAttribute("stroke-dashoffset", (C * (1 - m.frac)).toFixed(2));
    var foot = el("foot"); if (foot) foot.textContent = m.foot;
    var box = el("btns"), sig = JSON.stringify(m.btns);
    if (box.getAttribute("data-sig") !== sig) {
      box.setAttribute("data-sig", sig);
      box.innerHTML = "";
      m.btns.forEach(function (b) {
        var bt = document.createElement("button");
        bt.className = "fl-eye-btn" + (b.off ? " is-off" : "");
        bt.textContent = b.label;
        bt.onclick = function (e) { e.preventDefault(); pending = b.id; };
        box.appendChild(bt);
      });
    }
    var a = pending;
    pending = null;
    return a;
  };
})();
`;
  return '<!doctype html><html><head><meta charset="utf-8"><title>Eye break</title><style>' + css + '</style></head>'
    + '<body><div id="root" class="fl-eye"></div><script>' + js + '</script></body></html>';
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
  private pushIv: number | null = null;   // the 250 ms model push into our window
  private pushing = false;       // a push is in flight (its promise not yet back)
  private psbId: number | null = null;    // the power-save blocker while eye breaks are active
  private pushAt = 0;            // when the in-flight push started (a watchdog resets a push that never answers)
  private lastTick = 0;          // the previous poll's clock, to notice a sleep or a stalled app
  private mainHadFocus = false;  // was Obsidian the active app when our window came up? (else it must not be when it goes)
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
    this.iv = window.setInterval(() => { try { this.poll(); } catch (e) { this.log("poll error: " + e); } }, 1000);
    this.syncClock();
  }
  dispose() {
    if (this.iv != null) { window.clearInterval(this.iv); this.iv = null; }
    this.phase = "idle";   // so the view's close handler sees a deliberate teardown, not a hand-close
    this.closeAll();
    this.keepAwake(false);
    this.host.setBackgroundThrottle(true);
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
    this.syncClock();
    this.persistNow();
    this.emit();
  }
  // The interval setting changed: the running countdown keeps its start and takes the new length.
  applySettings() {
    const s = this.settings;
    const st = this.state;
    this.syncClock();
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
    this.syncClock();
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
    this.syncClock();
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
    // The Mac slept, or the app was stalled: the clock jumped. Start a fresh cycle rather than
    // opening a break the instant the lid lifts (BreakTimer detects sleep the same way).
    const gap = this.lastTick ? now - this.lastTick : 0;
    this.lastTick = now;
    if (gap > Math.max(120000, this.breakSecsTotal * 1000)) {
      this.log("clock: gap of " + Math.round(gap / 1000) + " s, fresh cycle");
      this.schedule(false);
      return;
    }
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

  // Seconds without keyboard or mouse input, system-wide. A locked screen counts as away
  // outright, whatever the idle setting: nobody is looking at it.
  private idleSecs(): number {
    try {
      const remote = getElectronRemote();
      const pm = remote && remote.powerMonitor;
      if (pm && typeof pm.getSystemIdleState === "function" && pm.getSystemIdleState(60) === "locked") return 24 * 3600;
      if (pm && typeof pm.getSystemIdleTime === "function") return pm.getSystemIdleTime();
    } catch {}
    return 0;
  }

  private persistNow() { this.lastPersist = Date.now(); void this.host.persist(); }
  // Breadcrumbs for the odd freeze: kept in the persisted state (last 60 lines) and echoed to
  // the console, so what happened can be read back even when the window could not be.
  private log(msg: string) {
    try {
      const st = this.state;
      const line = new Date().toTimeString().slice(0, 8) + " " + msg;
      st.log = [...(st.log || []).slice(-59), line];
      console.debug("[focuslog eye] " + msg);
    } catch {}
  }
  private persistThrottled() { if (Date.now() - this.lastPersist > 15000) this.persistNow(); }

  // The countdown lives on a timer inside Obsidian's main window. Left throttled, that timer
  // runs about once a minute once the window has been hidden or minimized for a while (and
  // macOS App Nap can stall it further), so the poll that would wake the clock never comes
  // in time. While eye breaks are active the window therefore stays unthrottled throughout,
  // and, if allowed, a power-save blocker keeps the app itself from napping.
  private syncClock() {
    const on = this.isActive();
    this.host.setBackgroundThrottle(!on);
    this.keepAwake(on && !!this.settings.eyeBreakKeepAwake);
  }
  private keepAwake(on: boolean) {
    try {
      const remote = getElectronRemote();
      const psb = remote && remote.powerSaveBlocker;
      if (!psb) return;
      if (on && this.psbId == null) this.psbId = psb.start("prevent-app-suspension");
      else if (!on && this.psbId != null) { psb.stop(this.psbId); this.psbId = null; }
    } catch {}
  }

  // ---------- the heads-up ----------
  // The corner card appears above every app; where no popout can be made, an Obsidian
  // notice with the same three buttons stands in.
  private enterWarn() {
    this.log("warn: heads-up " + (this.canPopout() ? "card" : "notice"));
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
    this.syncClock();
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
    this.log("break: start, layout " + this.layout + (this.eyeWin ? ", window up" : this.opening ? ", window opening" : ", no window"));
    this.host.setBackgroundThrottle(false);
    this.playSound("start");
    if (this.eyeWin) { this.applyLayout(this.eyeWin); this.push(); }   // the card grows into the break (or stays a card) and repaints at once
    else if (this.opening) { /* the popout is still being created; window-open applies the layout */ }
    else if (this.canPopout()) this.openWindow();
    else if (this.layout === "full") this.showOverlay();
    else this.showBreakNotice();
    this.emit();
  }
  private finishBreak(early: boolean) {
    this.log("break: finish" + (early ? " (early)" : ""));
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
  // The card and the break screen live in a BrowserWindow of our own, not in an Obsidian
  // popout: Obsidian shows a popout focused, which on macOS activates the whole app and
  // drags every Obsidian window in front of what you were doing. Ours is created hidden and
  // non-focusable and only ever shown inactive, so the app you are typing in stays put.
  // It is also never put into a full-screen mode: pinned at screen-saver level, plain bounds
  // over the display already cover the menu bar and the dock, and Electron's simple full
  // screen left a non-focusable window painting blank.
  private canPopout(): boolean { return !Platform.isMobile && !!getElectronRemote(); }
  private openWindow() {
    const remote = getElectronRemote();
    if (!remote || !remote.BrowserWindow) { this.fallback(); return; }
    this.closeWindow();
    const s = this.settings;
    let win: any;
    // Remember whether Obsidian was the active app: a click in our window can activate it
    // (BreakTimer meets the same and hides itself afterwards), and it must end up as it was.
    try { this.mainHadFocus = document.hasFocus(); } catch { this.mainHadFocus = false; }
    const opts: any = {
      show: false,
      frame: false,
      focusable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      hasShadow: true,
      title: "Eye break",
      width: CARD_W,
      height: CARD_H,
      backgroundColor: s.eyeBreakBg || DEFAULT_EYE_SETTINGS.eyeBreakBg,
      webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    };
    try {
      // On macOS an NSPanel is the non-activating kind of window: clicking its buttons does
      // not make Obsidian the active app, so nothing of Obsidian is dragged forward.
      if (Platform.isMacOS) { try { win = new remote.BrowserWindow({ ...opts, type: "panel" }); } catch (e) { this.log("window: panel refused (" + e + "), plain window"); win = null; } }
      if (!win) win = new remote.BrowserWindow(opts);
    } catch (e) { this.log("window: create failed: " + e); this.fallback(); return; }
    this.log("window: created");
    this.eyeWin = win;
    this.opening = true;
    this.pinWindow(win);
    this.applyLayout(win);
    try { win.setOpacity(this.opacity()); } catch {}
    // Reveal once the page is in: shaped for the phase we are in by then (the warn card may
    // have become the break while it loaded), painted, and shown WITHOUT taking focus.
    const reveal = (why: string) => {
      if (this.eyeWin !== win || !this.opening) return;
      this.opening = false;
      this.log("window: reveal (" + why + "), layout " + this.layout);
      this.applyLayout(win);
      this.push();
      try { if (win.showInactive) win.showInactive(); else win.show(); } catch {}
      try { win.moveTop(); } catch {}
    };
    try { win.webContents.once("did-finish-load", () => window.setTimeout(() => reveal("loaded"), 0)); } catch {}
    try {
      win.on("closed", () => window.setTimeout(() => {
        if (this.eyeWin !== win) return;   // our own close: nothing to do
        this.log("window: closed by hand");
        this.eyeWin = null;
        this.opening = false;
        this.stopPush();
        this.windowClosedByHand();
      }, 0));
    } catch {}
    try { win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(eyePageHtml(s))); }
    catch { this.closeWindow(); this.fallback(); return; }
    window.setTimeout(() => reveal("timeout"), 1500);   // a load event that never comes must not leave an empty screen
    this.startPush();
  }
  private fallback() {
    this.log("fallback: no window, phase " + this.phase);
    if (this.phase === "warn") this.showWarnNotice();
    else if (this.phase === "break" && this.layout === "full") this.showOverlay();
    else if (this.phase === "break") this.showBreakNotice();
  }
  // Kept for the plugin's "window-open" hook: the eye break no longer opens Obsidian
  // popouts, so a new Obsidian window is never ours.
  onWindowOpen(): boolean { return false; }
  private display(): any {
    try {
      const remote = getElectronRemote();
      const scr = remote && remote.screen;
      return scr ? scr.getDisplayNearestPoint(scr.getCursorScreenPoint()) : null;
    } catch { return null; }
  }
  private opacity(): number { return Math.max(0.2, Math.min(1, (this.settings.eyeBreakOpacity ?? 100) / 100)); }
  private pinWindow(win: any) {
    try { win.setAlwaysOnTop(true, "screen-saver"); } catch {}
    // skipTransformProcessType keeps macOS from bouncing Obsidian's dock presence here.
    try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true }); } catch {}
    try { win.setSkipTaskbar(true); } catch {}
    try { if (win.webContents && win.webContents.setBackgroundThrottling) win.webContents.setBackgroundThrottling(false); } catch {}
  }
  // Shape the window to the current layout: the corner card of the display under the
  // cursor, or that whole display. Called again on the same window when the card grows.
  private applyLayout(win: any) {
    const d = this.display();
    const full = this.layout === "full";
    const area = d ? (full ? d.bounds : (d.workArea || d.bounds)) : null;
    let b: any = null;
    if (area) {
      b = full
        ? { x: area.x, y: area.y, width: area.width - 1, height: area.height - 1 }
        : { x: Math.round(area.x + area.width - CARD_W - CARD_GAP), y: Math.round(area.y + area.height - CARD_H - CARD_GAP), width: CARD_W, height: CARD_H };
    } else if (!full) {
      try { const cur = win.getBounds(); b = { x: cur.x, y: cur.y, width: CARD_W, height: CARD_H }; } catch {}
    }
    if (!b) return;
    // The user can never resize the window, but it must still take programmatic bounds;
    // toggling around the call keeps macOS from ignoring the size change.
    try { win.setResizable(true); } catch {}
    try { win.setBounds(b); } catch {}
    try { win.setResizable(false); } catch {}
  }
  private closeWindow() {
    this.opening = false;
    this.stopPush();
    const win = this.eyeWin;
    this.eyeWin = null;
    if (win) { this.log("window: destroy"); try { if (winId(win) >= 0) win.destroy(); } catch (e) { this.log("window: destroy failed: " + e); } }
    if (win && !this.mainHadFocus) window.setTimeout(() => this.restoreFocus(), 80);
    // Leaves from the old popout design, restored from a saved layout, go too.
    try { this.host.app.workspace.getLeavesOfType(VIEW_TYPE_EYE).forEach((l: any) => l.detach()); } catch {}
  }

  // Obsidian was in the background when the window came up; if the window's going (or a click
  // in it) left Obsidian active, step back out of the way: hide the app, which on macOS hands
  // focus to the previous app (BreakTimer's own trick). With the floating timer open, hiding
  // would take it along, so the main window only drops behind instead.
  private restoreFocus() {
    try {
      if (!document.hasFocus()) return;
      const remote = getElectronRemote();
      if (!remote) return;
      const flt = this.host.floatWindow();
      if (flt && winId(flt) >= 0) {
        const cur = remote.getCurrentWindow ? remote.getCurrentWindow() : null;
        this.log("focus: obsidian came forward, sending the main window back (float open)");
        try { cur && cur.blur(); } catch {}
      } else if (remote.app && remote.app.hide) {
        this.log("focus: obsidian came forward, hiding it again");
        remote.app.hide();
      }
    } catch (e) { this.log("focus: restore failed: " + e); }
  }

  // ---------- painting the window ----------
  // The window runs a small page of its own (eyePageHtml). Every 250 ms the engine pushes it
  // a model of what to show, and the page answers with the button pressed since the last push.
  private startPush() {
    if (this.pushIv != null) return;
    this.pushIv = window.setInterval(() => this.push(), 250);
  }
  private stopPush() {
    if (this.pushIv != null) { window.clearInterval(this.pushIv); this.pushIv = null; }
    this.pushing = false;
  }
  private push() {
    const win = this.eyeWin;
    if (!win || this.opening || this.phase === "idle") return;
    if (this.pushing) {
      if (Date.now() - this.pushAt < 2000) return;
      this.log("push: no answer in 2 s, resetting");   // a push whose promise never settles must not stall the page forever
      this.pushing = false;
    }
    let p: any;
    try { p = win.webContents.executeJavaScript("window.__eyeSync(" + JSON.stringify(this.model()) + ")", true); }
    catch (e) { this.log("push: call failed: " + e); return; }
    this.pushing = true;
    this.pushAt = Date.now();
    Promise.resolve(p).then(
      (act: any) => { this.pushing = false; if (act) window.setTimeout(() => this.act(String(act)), 0); },
      (e: any) => { this.pushing = false; this.log("push: rejected: " + e); },
    );
  }
  private act(a: string) {
    this.log("act: " + a + " (phase " + this.phase + ")");
    if (a === "now") this.startNow();
    else if (a === "snooze") this.snooze();
    else if (a === "skip") this.skip();
    else if (a === "end") this.endEarly();
  }
  // What the page shows: the same words and controls as renderEyeScreen, as plain data.
  private model(): any {
    const s = this.settings;
    const bg = s.eyeBreakBg || DEFAULT_EYE_SETTINGS.eyeBreakBg;
    const fg = s.eyeBreakFg || DEFAULT_EYE_SETTINGS.eyeBreakFg;
    if (this.phase === "warn") {
      const left = this.secsToNext();
      const total = Math.max(1, s.eyeBreakWarnSecs);
      const btns: any[] = [{ id: "now", label: "Start now" }];
      if (s.eyeBreakAllowSnooze) btns.push({ id: "snooze", label: "Snooze " + s.eyeBreakSnoozeMins + " min", off: this.snoozesLeft() <= 0 });
      if (s.eyeBreakAllowSkip) btns.push({ id: "skip", label: "Skip" });
      return { warn: true, card: true, bg, fg, title: "Eye break in ", num: left, unit: " s", msg: "Look away from the screen for " + s.eyeBreakSecs + " seconds.", frac: Math.max(0, Math.min(1, left / total)), btns, foot: "" };
    }
    const card = this.layout === "card";
    const title = s.eyeBreakTitle || DEFAULT_EYE_SETTINGS.eyeBreakTitle;
    const left = this.breakSecsLeft();
    const frac = this.breakSecsTotal > 0 ? Math.max(0, Math.min(1, left / this.breakSecsTotal)) : 0;
    const btns: any[] = [];
    if (s.eyeBreakAllowEndEarly) {
      const ok = this.canEndEarly();
      const wait = Math.max(0, (s.eyeBreakEndEarlyAfter || 0) - this.breakSecsGone());
      btns.push({ id: "end", label: ok ? "End break early" : "End break early (" + wait + " s)", off: !ok });
    }
    return { warn: false, card, bg, fg, title: card ? title + " " : title, num: left, unit: card ? " s" : "", msg: s.eyeBreakMessage || "", frac, btns, foot: card ? "" : "Next eye break in " + s.eyeBreakEveryMins + " min" };
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
    .setDesc("If the computer sees no keyboard or mouse input for this many minutes, the countdown holds and starts over when you return (0 = off). Watching a video counts as no input, so set this to 0 if breaks should still come during films. A locked screen and a sleeping Mac always count as away.");
  idle.addText((t) => { num(t, "5em"); t.setValue(String(s.eyeBreakIdleMins)).onChange(async (v) => { s.eyeBreakIdleMins = clampInt(v, 0, 240, 5); await save(); }); });
  idle.controlEl.createEl("span", { text: "min", attr: { style: "font-size:12px;color:var(--text-muted);margin:0 12px 0 5px" } });
  idle.addToggle((t) => { t.setTooltip("Show a notice when the countdown was reset"); t.setValue(s.eyeBreakIdleNotice).onChange(async (v) => { s.eyeBreakIdleNotice = v; await save(); }); });

  new Setting(containerEl)
    .setName("Keep Obsidian awake for eye breaks")
    .setDesc("Stops macOS from napping a minimized or hidden Obsidian, so breaks land on time while you work in other apps. While it is on, the Mac will not go to sleep by itself as long as Obsidian is open (the display still can).")
    .addToggle((t) => t.setValue(s.eyeBreakKeepAwake).onChange(async (v) => { s.eyeBreakKeepAwake = v; await save(); eng.applySettings(); }));

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
