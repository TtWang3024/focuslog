// The "break's over" window. When a Focus Log break runs out and no pomodoro has started, a
// small window rises above every app (built like the eye-break card: a non-activating panel
// that never takes the keyboard, closed by its own button) and stays until you act or close it.
// Its face is the floating timer's start screen: pick the task, set the length, rate how
// enjoyable it will be, start. When the break's feeling was not logged, the four seasons wait
// there too. Snooze extends the break; Stop ends this round.
import { Platform } from "obsidian";
import { getElectronRemote } from "./electron";

export interface BreakPromptHost {
  enabled(): boolean;
  timer(): any;                                  // the pomodoro engine's getState()
  tasks(): any[];                                // today's tasks: { task, king }
  snoozeMins(): number;
  eyeBusy(): boolean;                            // an eye break is on screen: wait for it to end
  floatWindow(): any;
  art(): any;                                    // the start screen's images and icons
  setTask(name: string): void;
  setExpected(v: number): void;
  stepLength(delta: number): void;
  setFeeling(v: number): void;
  extendBreak(mins: number): void;
  stopRound(): void;
  start(): void;
}

// The window's size (px), taller when the season row is shown, and its gap from the corner.
const PROMPT_W = 320;
const PROMPT_H = 300;
const PROMPT_H_FEEL = 368;
const PROMPT_GAP = 20;

function promptWinId(w: any): number {
  try { return w && !(w.isDestroyed && w.isDestroyed()) ? w.id : -1; } catch { return -1; }
}

// The page inside the window: the float's start screen, restyled here because this window is
// not an Obsidian window and loads none of the plugin's CSS. Images and icons arrive once from
// the plugin (__promptInit); every 250 ms a model of what to show arrives (__promptSync), and
// the page answers with the control pressed since, as a small JSON string.
function promptPageHtml(): string {
  const css = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&display=swap');
html, body { margin: 0; height: 100%; overflow: hidden; background: #fdfbf6; }
* { box-sizing: border-box; }
body { font-family: 'Baloo 2', system-ui, -apple-system, 'Segoe UI', sans-serif; color: #2b2723; user-select: none; cursor: default; }
.wrap { position: relative; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; padding: 12px 16px; }
.x { position: absolute; top: 6px; right: 8px; border: none; background: transparent; color: #8a8175; font: inherit; font-size: 13px; padding: 2px 7px; border-radius: 6px; cursor: pointer; }
.x:hover { color: #2b2723; background: rgba(43, 39, 35, 0.07); }
.title { font-weight: 600; font-size: 18px; line-height: 1.1; color: #5b8c5a; }
.sel { position: relative; width: 100%; font-size: 12px; line-height: 1.35; border: 1px solid #cfc7b8; border-radius: 7px; background: #fffefc; color: #2b2723; padding: 6px 26px 6px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sel.empty { color: #8a8175; }
.sel::after { content: ""; position: absolute; right: 10px; top: 50%; width: 6px; height: 6px; border-right: 1.5px solid #8a8175; border-bottom: 1.5px solid #8a8175; transform: translateY(-70%) rotate(45deg); }
.menu { position: absolute; left: 16px; right: 16px; z-index: 5; max-height: 190px; overflow-y: auto; background: #fffefc; border: 1px solid #cfc7b8; border-radius: 7px; box-shadow: 0 8px 22px rgba(43, 39, 35, 0.16); padding: 3px; display: none; }
.menu.open { display: block; }
.item { font-size: 12px; line-height: 1.35; padding: 5px 8px; border-radius: 5px; cursor: pointer; overflow-wrap: anywhere; }
.item:hover { background: #f3eee3; }
.item.none { color: #8a8175; }
.item.on { background: #5b8c5a; color: #fff; }
.time { font-weight: 600; font-size: clamp(24px, 13vw, 46px); line-height: 1; font-variant-numeric: tabular-nums; }
.row { display: flex; gap: 6px; align-items: center; justify-content: center; }
.btn { font: inherit; font-size: 13px; border: 1.5px solid #2b2723; background: transparent; color: #2b2723; border-radius: 999px; padding: 4.5px 12px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background 0.12s ease, opacity 0.12s ease; }
.btn:hover { background: #f3eee3; }
.btn:disabled { opacity: 0.4; cursor: default; }
.btn svg { width: 18px; height: 18px; display: block; }
.btn.step { padding: 4px; line-height: 0; }
.btn.step svg { width: 12px; height: 12px; }
.btn.primary { background: #C57B5A; color: #fdfbf6; border-color: #C57B5A; padding: 5.5px 18px; }
.btn.primary:hover { background: #B56C4C; }
.btn.quiet { font-size: 12px; padding: 3px 11px; border-color: #cfc7b8; color: #8a8175; }
.btn.quiet:hover { color: #2b2723; }
.block { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 100%; }
.label { font-size: 11px; color: #8a8175; text-align: center; }
.rate { display: flex; gap: 6px; }
.rbtn { width: 40px; height: 40px; padding: 4px; border: 1.5px solid rgba(0, 0, 0, 0.14); border-radius: 9px; background: #fffefc; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.12s ease, transform 0.08s ease; }
.rbtn img { width: 28px; height: 28px; display: block; pointer-events: none; }
.rbtn:hover { border-color: #2b2723; transform: translateY(-1px); }
.rbtn.on { border-color: #2b2723; border-width: 2.5px; }
.label.warn { color: #b4533a; font-weight: 600; }
`;
  const js = `
(function () {
  var ready = false, pending = null, model = null, menuOpen = false, menuSig = "";
  function el(id) { return document.getElementById(id); }
  function act(a) { pending = a; }
  window.__promptInit = function (art) {
    try {
      art = art || {};
      el("minus").innerHTML = art.minus || "\\u2212";
      el("plus").innerHTML = art.plus || "+";
      el("start").innerHTML = art.play || "\\u25B6";
      var rates = el("rates"); rates.innerHTML = "";
      (art.weather || []).forEach(function (w) {
        var b = document.createElement("button");
        b.className = "rbtn"; b.style.background = w.bg; b.setAttribute("data-v", w.v); b.title = "rating " + w.v;
        var i = document.createElement("img"); i.src = w.img; i.alt = ""; b.appendChild(i);
        b.onclick = function () { act({ a: "rate", v: w.v }); };
        rates.appendChild(b);
      });
      var feels = el("feels"); feels.innerHTML = "";
      (art.seasons || []).forEach(function (s) {
        var b = document.createElement("button");
        b.className = "rbtn"; b.setAttribute("data-v", s.v); b.title = s.name;
        var i = document.createElement("img"); i.src = s.img; i.alt = s.name; b.appendChild(i);
        b.onclick = function () { act({ a: "feel", v: s.v }); };
        feels.appendChild(b);
      });
      ready = true;
    } catch (e) {}
    return true;
  };
  function noneText() { return model && model.tasks.length ? "Link a task (optional)" : "- no tasks (sync first) -"; }
  function paintMenu() {
    var menu = el("menu");
    menu.innerHTML = "";
    var first = document.createElement("div");
    first.className = "item none";
    first.textContent = noneText();
    first.onclick = function (e) { e.stopPropagation(); act({ a: "task", v: "" }); closeMenu(); };
    menu.appendChild(first);
    model.tasks.forEach(function (t) {
      var d = document.createElement("div");
      d.className = "item" + (t.name === model.task ? " on" : "");
      d.textContent = t.name + (t.king ? " \\uD83D\\uDC51" : "");
      d.onclick = function (e) { e.stopPropagation(); act({ a: "task", v: t.name }); closeMenu(); };
      menu.appendChild(d);
    });
  }
  function openMenu() {
    var sel = el("sel"), menu = el("menu");
    paintMenu();
    menu.style.top = (sel.offsetTop + sel.offsetHeight + 3) + "px";
    menu.classList.add("open");
    menuOpen = true;
    var on = menu.querySelector(".item.on");
    if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
  }
  function closeMenu() { el("menu").classList.remove("open"); menuOpen = false; }
  el("sel").onclick = function (e) { e.stopPropagation(); if (menuOpen) closeMenu(); else if (model) openMenu(); };
  document.addEventListener("click", function () { if (menuOpen) closeMenu(); });
  el("x").onclick = function () { act({ a: "close" }); };
  el("minus").onclick = function () { act({ a: "len", v: -1 }); };
  el("plus").onclick = function () { act({ a: "len", v: 1 }); };
  el("start").onclick = function () { act({ a: "start" }); };
  el("snooze").onclick = function () { act({ a: "snooze" }); };
  el("stop").onclick = function () { act({ a: "stop" }); };
  window.__promptSync = function (m) {
    if (!ready) return JSON.stringify({ a: "init" });
    model = m;
    var sel = el("sel"), label = m.task || noneText();
    if (sel.textContent !== label) sel.textContent = label;
    sel.classList.toggle("empty", !m.task);
    var sig = JSON.stringify([m.tasks, m.task]);
    if (menuOpen && sig !== menuSig) paintMenu();
    menuSig = sig;
    var mm = (m.mins < 10 ? "0" : "") + m.mins + ":00";
    if (el("time").textContent !== mm) el("time").textContent = mm;
    el("minus").disabled = m.mins <= 5;
    el("plus").disabled = m.mins >= 30;
    Array.prototype.forEach.call(el("rates").children, function (b) { b.classList.toggle("on", Number(b.getAttribute("data-v")) === m.expected); });
    el("feelBlock").style.display = m.showFeel ? "" : "none";
    Array.prototype.forEach.call(el("feels").children, function (b) { b.classList.toggle("on", Number(b.getAttribute("data-v")) === m.feeling); });
    var sz = "Snooze " + m.snooze + " min";
    if (el("snooze").textContent !== sz) el("snooze").textContent = sz;
    // A warning (Rate it first.) stands in for the rating question, right where it is answered.
    var rl = el("rateLabel"), q = m.flash || "how enjoyable do you expect this to be?";
    if (rl.textContent !== q) rl.textContent = q;
    rl.classList.toggle("warn", !!m.flash);
    var a = pending;
    pending = null;
    return a ? JSON.stringify(a) : null;
  };
})();
`;
  return '<!doctype html><html><head><meta charset="utf-8"><title>Break’s over</title><style>' + css + '</style></head><body>'
    + '<div class="wrap">'
    + '<button class="x" id="x" title="close; the break stays finished">✕</button>'
    + '<div class="title">Break’s over</div>'
    + '<div class="sel empty" id="sel"></div>'
    + '<div class="menu" id="menu"></div>'
    + '<div class="time" id="time"></div>'
    + '<div class="row"><button class="btn step" id="minus" title="shorter"></button><button class="btn primary" id="start" title="start the pomodoro"></button><button class="btn step" id="plus" title="longer"></button></div>'
    + '<div class="block"><div class="label" id="rateLabel">how enjoyable do you expect this to be?</div><div class="rate" id="rates"></div></div>'
    + '<div class="block" id="feelBlock" style="display:none"><div class="label">how do you feel after this break?</div><div class="rate" id="feels"></div></div>'
    + '<div class="row"><button class="btn quiet" id="snooze">Snooze</button><button class="btn quiet" id="stop">Stop this round</button></div>'
    + '</div><script>' + js + '</script></body></html>';
}

export class BreakPrompt {
  private host: BreakPromptHost;
  private win: any = null;
  private opening = false;
  private iv: number | null = null;
  private pushIv: number | null = null;
  private pushing = false;
  private pushAt = 0;
  private dismissed = false;       // closed by hand for the break that is sitting finished now
  private mainHadFocus = false;    // was Obsidian the active app when the window came up?
  private showFeel = false;        // the season row: shown when the break's feeling was not logged yet
  private flashMsg = "";
  private flashUntil = 0;

  constructor(host: BreakPromptHost) {
    this.host = host;
  }

  // The window while it is up, so the plugin never mistakes it for the floating timer.
  currentWindow(): any { return this.win; }

  start() {
    this.iv = window.setInterval(() => { try { this.poll(); } catch (e) { console.error("Focus Log: break prompt", e); } }, 1000);
  }
  dispose() {
    if (this.iv != null) { window.clearInterval(this.iv); this.iv = null; }
    this.close();
  }

  // Up while a break sits finished at 00:00 with no pomodoro running; gone the moment that
  // stops being true, wherever it was changed (the float, the panel, a command).
  poll() {
    const t = this.host.timer();
    const due = !!t && !!t.breakActive && !!t.breakFinished && !t.running && !t.paused;
    if (!due || !this.host.enabled()) {
      this.dismissed = false;
      if (this.win) this.close();
      return;
    }
    if (this.dismissed || this.win || Platform.isMobile) return;
    if (this.host.eyeBusy()) return;    // a short break's eye break lands at its end: let it finish first
    this.open();
  }

  private open() {
    const remote = getElectronRemote();
    if (!remote || !remote.BrowserWindow) return;
    try { this.mainHadFocus = document.hasFocus(); } catch { this.mainHadFocus = false; }
    // Catch up on the break's feeling only when it was not logged; decided once, so the row stays
    // put (and shows the pick) after a season is chosen here.
    const t0 = this.host.timer() || {};
    this.showFeel = !(Number(t0.breakFeeling) >= 1);
    this.flashUntil = 0;
    const opts: any = {
      show: false, frame: false, focusable: false, alwaysOnTop: true, skipTaskbar: true,
      movable: false, minimizable: false, maximizable: false, fullscreenable: false, resizable: false,
      hasShadow: true, title: "Break's over", width: PROMPT_W, height: this.showFeel ? PROMPT_H_FEEL : PROMPT_H, backgroundColor: "#fdfbf6",
      webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    };
    let win: any = null;
    try {
      // A macOS panel does not activate the app when clicked, so Obsidian stays where it is.
      if (Platform.isMacOS) { try { win = new remote.BrowserWindow(Object.assign({}, opts, { type: "panel" })); } catch (e) { win = null; } }
      if (!win) win = new remote.BrowserWindow(opts);
    } catch (e) { console.error("Focus Log: break prompt window", e); return; }
    this.win = win;
    this.opening = true;
    try { win.setAlwaysOnTop(true, "screen-saver"); } catch {}
    try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true }); } catch {}
    this.place(win);
    const reveal = () => {
      if (this.win !== win || !this.opening) return;
      this.opening = false;
      this.place(win);
      this.sendArt();
      this.push();
      try { if (win.showInactive) win.showInactive(); else win.show(); } catch {}
      try { win.moveTop(); } catch {}
    };
    try { win.webContents.once("did-finish-load", () => window.setTimeout(reveal, 0)); } catch {}
    try {
      win.on("closed", () => window.setTimeout(() => {
        if (this.win !== win) return;   // our own close
        this.win = null;
        this.opening = false;
        this.stopPush();
        this.dismissed = true;          // closed from outside: treat like the close button
      }, 0));
    } catch {}
    try { win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(promptPageHtml())); }
    catch (e) { this.close(); return; }
    window.setTimeout(reveal, 1500);   // a load event that never comes must not leave it hidden
    this.startPush();
  }

  // The bottom-right corner of the display under the cursor, where the eye-break card also sits
  // (the eye clock holds while a finished break waits, so the two do not meet there).
  private place(win: any) {
    try {
      const remote = getElectronRemote();
      const scr = remote && remote.screen;
      const d = scr ? scr.getDisplayNearestPoint(scr.getCursorScreenPoint()) : null;
      const wa = d ? (d.workArea || d.bounds) : null;
      if (!wa) return;
      try { win.setResizable(true); } catch {}
      const h = this.showFeel ? PROMPT_H_FEEL : PROMPT_H;
      win.setBounds({ x: Math.round(wa.x + wa.width - PROMPT_W - PROMPT_GAP), y: Math.round(wa.y + wa.height - h - PROMPT_GAP), width: PROMPT_W, height: h });
      try { win.setResizable(false); } catch {}
    } catch {}
  }

  private close() {
    this.opening = false;
    this.stopPush();
    const win = this.win;
    this.win = null;
    if (win) { try { if (promptWinId(win) >= 0) win.destroy(); } catch {} }
    if (win && !this.mainHadFocus) window.setTimeout(() => this.restoreFocus(), 80);
  }

  // As the eye break does: if Obsidian was in the background when the prompt came up and a
  // click left it active, step back out of the way (blur when the float is open, else hide).
  private restoreFocus() {
    try {
      if (!document.hasFocus()) return;
      const remote = getElectronRemote();
      if (!remote) return;
      const flt = this.host.floatWindow();
      if (flt && promptWinId(flt) >= 0) {
        const cur = remote.getCurrentWindow ? remote.getCurrentWindow() : null;
        try { if (cur) cur.blur(); } catch {}
      } else if (remote.app && remote.app.hide) remote.app.hide();
    } catch {}
  }

  private startPush() {
    if (this.pushIv != null) return;
    this.pushIv = window.setInterval(() => this.push(), 250);
  }
  private stopPush() {
    if (this.pushIv != null) { window.clearInterval(this.pushIv); this.pushIv = null; }
    this.pushing = false;
  }
  private push() {
    const win = this.win;
    if (!win || this.opening) return;
    if (this.pushing && Date.now() - this.pushAt < 2000) return;
    let p: any;
    try { p = win.webContents.executeJavaScript("window.__promptSync(" + JSON.stringify(this.model()) + ")", true); }
    catch (e) { return; }
    this.pushing = true;
    this.pushAt = Date.now();
    Promise.resolve(p).then(
      (a: any) => { this.pushing = false; if (a) window.setTimeout(() => this.act(String(a)), 0); },
      () => { this.pushing = false; },
    );
  }
  // The images and icons, sent once per window (the page asks again if it missed them).
  private sendArt() {
    const win = this.win;
    if (!win) return;
    let art: any = null;
    try { art = this.host.art(); } catch {}
    try { Promise.resolve(win.webContents.executeJavaScript("window.__promptInit(" + JSON.stringify(art || {}) + ")", true)).catch(() => {}); } catch {}
  }
  // What the page shows, read from the engine each time, so the float and the panel stay in step.
  private model(): any {
    const t = this.host.timer() || {};
    const tasks = (this.host.tasks() || []).map((x: any) => ({ name: String(x.task || ""), king: !!x.king })).filter((x: any) => x.name);
    const task = String(t.taskName || "").trim();
    if (task && !tasks.some((x: any) => x.name === task)) tasks.unshift({ name: task, king: false });
    return {
      tasks, task,
      mins: Number(t.lengthMin) || 25,
      expected: Number(t.expected) || 0,
      feeling: Number(t.breakFeeling) || 0,
      showFeel: this.showFeel,
      snooze: this.host.snoozeMins(),
      flash: Date.now() < this.flashUntil ? this.flashMsg : "",
    };
  }
  private act(raw: string) {
    let m: any = null;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || !m.a) return;
    if (m.a === "init") { this.sendArt(); return; }
    if (m.a === "close") { this.dismissed = true; this.close(); return; }
    // Choices made here go straight to the engine, exactly as on the float's start screen.
    if (m.a === "task") { this.host.setTask(String(m.v || "")); return; }
    if (m.a === "rate") { this.host.setExpected(Number(m.v) || 0); return; }
    if (m.a === "len") { this.host.stepLength(Number(m.v) || 0); return; }
    if (m.a === "feel") { this.host.setFeeling(Number(m.v) || 0); return; }
    if (m.a === "start") {
      // The float's rule: the task is optional, the expected rating is not.
      const t = this.host.timer() || {};
      if (!(Number(t.expected) >= 1)) { this.flashMsg = "Rate it first."; this.flashUntil = Date.now() + 2500; return; }
      this.close();
      this.host.start();
      return;
    }
    this.close();
    if (m.a === "snooze") this.host.extendBreak(this.host.snoozeMins());
    else if (m.a === "stop") this.host.stopRound();
  }
}
