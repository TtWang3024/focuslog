import { App, ItemView, Menu, Modal, Notice, Platform, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, normalizePath, requestUrl, setIcon } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import FocusLogApp, { MACARON, MODE_COLORS, darken, fmtHM, parseHM, BREAK_SEASONS } from "./FocusLogApp";
import { newestStarName } from "./skymap";

// Solid glyphs for the float's controls (sized by the .flt-btn svg rule): minus/plus steppers,
// play/pause for the primary and break toggles, and a bold rotate-left for reset.
const FLT_MINUS = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512" fill="currentColor"><path d="M480,288H32c-17.673,0-32-14.327-32-32s14.327-32,32-32h448c17.673,0,32,14.327,32,32S497.673,288,480,288z"/></svg>`;
const FLT_PLUS = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512" fill="currentColor"><path d="M480,224H288V32c0-17.673-14.327-32-32-32s-32,14.327-32,32v192H32c-17.673,0-32,14.327-32,32s14.327,32,32,32h192v192c0,17.673,14.327,32,32,32s32-14.327,32-32V288h192c17.673,0,32-14.327,32-32S497.673,224,480,224z"/></svg>`;
const FLT_PLAY = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20.492,7.969,10.954.975A5,5,0,0,0,3,5.005V19a4.994,4.994,0,0,0,7.954,4.03l9.538-6.994a5,5,0,0,0,0-8.062Z"/></svg>`;
const FLT_PAUSE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6.5,0A3.5,3.5,0,0,0,3,3.5v17a3.5,3.5,0,0,0,7,0V3.5A3.5,3.5,0,0,0,6.5,0Z"/><path d="M17.5,0A3.5,3.5,0,0,0,14,3.5v17a3.5,3.5,0,0,0,7,0V3.5A3.5,3.5,0,0,0,17.5,0Z"/></svg>`;
const FLT_ROTATE_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M1.611,12c.759,0,1.375,.57,1.485,1.32,.641,4.339,4.389,7.68,8.903,7.68,5.476,0,9.827-4.917,8.867-10.569-.453-2.665-2.148-5.023-4.523-6.313-3.506-1.903-7.48-1.253-10.18,1.045l1.13,1.13c.63,.63,.184,1.707-.707,1.707H2c-.552,0-1-.448-1-1V2.414c0-.891,1.077-1.337,1.707-.707l1.332,1.332C7.6-.115,12.921-1.068,17.637,1.408c3.32,1.743,5.664,5.027,6.223,8.735,1.122,7.437-4.633,13.857-11.86,13.857-6.021,0-11.021-4.457-11.872-10.246-.135-.92,.553-1.754,1.483-1.754Z"/></svg>`;
// Background-noise picker glyphs: a struck speaker for muted, a waveform for the two
// noises (told apart by color, not shape: white, pink, brown). Sized by the .flt-noise svg rule.
const FLT_NOISE_MUTE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="m23.707,22.293c.391.391.391,1.023,0,1.414-.195.195-.451.293-.707.293s-.512-.098-.707-.293L.293,1.707C-.098,1.316-.098.684.293.293S1.316-.098,1.707.293l4.628,4.628C8.142,2.461,10.839.757,13.828.207c.288-.056.593.025.82.215.229.19.36.472.36.769v12.404l1.688,1.688c1.806-1.817,1.803-4.763-.01-6.576-.391-.391-.391-1.023,0-1.414.391-.391,1.023-.391,1.414,0,2.592,2.592,2.596,6.808.01,9.404l1.44,1.44c3.316-3.481,3.266-9.011-.152-12.43-.391-.391-.391-1.023,0-1.414s1.023-.391,1.414,0c4.198,4.198,4.249,10.997.152,15.258l2.742,2.742ZM.009,10v4c0,2.757,2.243,5,5,5h1.269c1.807,2.502,4.53,4.237,7.551,4.793.06.011.12.017.181.017.232,0,.459-.081.64-.231.229-.19.36-.472.36-.769v-3.579L1.881,6.103C.74,7.02.009,8.426.009,10Z"/></svg>`;
const FLT_NOISE_WAVE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="m18,17c-.553,0-1-.447-1-1v-8c0-.553.447-1,1-1s1,.447,1,1v8c0,.553-.447,1-1,1Zm-3,6V1c0-.553-.447-1-1-1s-1,.447-1,1v22c0,.553.447,1,1,1s1-.447,1-1Zm8-4V5c0-.553-.447-1-1-1s-1,.447-1,1v14c0,.553.447,1,1,1s1-.447,1-1Zm-12,0V5c0-.553-.447-1-1-1s-1,.447-1,1v14c0,.553.447,1,1,1s1-.447,1-1Zm-4-3v-8c0-.553-.447-1-1-1s-1,.447-1,1v8c0,.553.447,1,1,1s1-.447,1-1Zm-4-2v-4c0-.553-.447-1-1-1s-1,.447-1,1v4c0,.553.447,1,1,1s1-.447,1-1Z"/></svg>`;
import starImg from "./assets/star.png";
import rateRain from "./assets/rate-rain.png";
import rateClouds from "./assets/rate-clouds.png";
import ratePartly from "./assets/rate-partly-sunny.png";
import rateSun from "./assets/rate-sun.png";

export const VIEW_TYPE = "focuslog-view";
// Solid sea-wave glyph for the float's urge button (inline SVG; no icon font is bundled).
const SEA_WAVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="m6.5 9c-3.006 0-6.5 1.747-6.5 4 0 1.103.897 2 2 2 .415 0 .8-.127 1.12-.344.273.78 1.008 1.344 1.88 1.344.798 0 1.483-.473 1.804-1.15.782.779 1.196 1.829 1.196 3.15 0 2.198-1.794 3.987-4 3.987-.875 0-1.68-.276-2.392-.821-.438-.334-1.065-.254-1.402.187-.336.438-.252 1.066.186 1.401 1.054.806 2.301 1.233 3.606 1.233l11 .013c.334 0 .646-.167.832-.445.048-.071 1.168-1.784 1.168-4.555 0-5.607-4.612-10-10.5-10zm16.621 13.391-.136.78c-.083.479-.499.829-.985.829h-4.132c.451-.897 1.132-2.632 1.132-5 0-4.159-2.101-7.756-5.357-9.901-.564-1.793-1.752-2.992-3.182-3.71-.182.917-.991 1.611-1.961 1.611-1.009 0-1.837-.753-1.972-1.725-.367.439-.912.725-1.528.725-1.103 0-2-.897-2-2 .006-.459.178-.929.469-1.272.965-1.37 3.401-2.728 7.09-2.728 7.565 0 13.492 5.603 13.492 12.755.148 3.468-.4 6.603-.931 9.635z"/></svg>`;
export const VIEW_TYPE_FLOAT = "focuslog-float";
const NOTION_VERSION = "2022-06-28";
// The enjoyment scale is 1-4 weather buttons, shared verbatim with the React panel's
// Scale (FocusLogApp). Break feeling uses BREAK_SEASONS (four season trees), not this list.
const RATE_WEATHER = [
  { v: 1, img: rateRain, bg: "#BCBCBC" },
  { v: 2, img: rateClouds, bg: "#E3EBF1" },
  { v: 3, img: ratePartly, bg: "#C9EAFF" },
  { v: 4, img: rateSun, bg: "#89D2FF" },
];

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
  internal: { fill: "#FDE4C8", border: "#F07B16" },
  external: { fill: "#D6E8FD", border: "#2779E0" },
};
// First-time size (px) for each float phase; once you move/resize a phase, that phase
// remembers its own bounds (settings.floatPhaseBounds) and the default is ignored.
const FLOAT_PHASE_DEFAULTS: any = {
  setup: { w: 300, h: 240 },     // pick a task + before-rating
  focus: { w: 300, h: 170 },     // the pomodoro countdown
  pause: { w: 300, h: 320 },     // countdown + reason chips
  break: { w: 380, h: 400 },     // rest timer + activities + feeling
  celebrate: { w: 320, h: 440 }, // done + next-task + rating
};

export interface FocusLogSettings {
  notionToken: string;
  databaseId: string;
  doneStatus: string;
  categoryProperty: string;
  tagNamespace: string;
  showCategoryInView: boolean;
  writeCategoryTag: boolean;
  dayStart: number;
  weekStartsSunday: boolean;
  morningEnd: number;
  afternoonEnd: number;
  lunchEnabled: boolean;
  lunchStart: number;
  lunchMinutes: number;
  dinnerEnabled: boolean;
  dinnerStart: number;
  dinnerMinutes: number;
  nightRoutineGap: number;       // retired from the UI (was "starts N min after dinner"); still read once to seed nightRoutineStarts
  morningRoutinePomos: number;   // the routines' declared pomodoro cost (step lengths left the UI),
  nightRoutinePomos: number;     // one pair per day mode: work-day here, relax-day below
  relaxMorningRoutinePomos: number;
  relaxNightRoutinePomos: number;
  morningRoutineEnds: number;    // the Plan list's morning phase ends here, and counted pomodoro room begins
  nightRoutineStarts: number;    // the night phase begins here, and counted pomodoro room stops
  routineGroupMinutes: number;
  addBlockEnabled: boolean;
  showAreaTimeline: boolean;
  hideBonusByDefault: boolean;   // Bonus-If-Done rows start hidden in the Plan list
  heatThresholds: string;
  dailyNoteWrite: boolean;
  dailyNoteTrueDate: boolean;
  dailyHeading: string;
  calibrationHeading: string;
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
  floatPhaseBounds: { [phase: string]: { x: number; y: number; w: number; h: number } };
  personalTaskNames: string[];
  personalAreas: string[];
  skipMorningRoutine: boolean;
  skipNightRoutine: boolean;
  morningBegins: number;
  dayEnds: number;
  longBreakMinutes: number;
  urgeSurfMinutes: number;
  longBreakEvery: number;
  timeFmtV2: boolean;
  workDays: boolean[];
  noiseFocus: NoiseChoice;   // background noise while a pomodoro runs
  noiseBreak: NoiseChoice;   // and while a break runs - a muted break stays silent
  noiseVolume: number;       // loudness percent, 0-100
}

export type NoiseChoice = "off" | "white" | "pink" | "brown";

const DEFAULT_SETTINGS: FocusLogSettings = {
  notionToken: "",
  databaseId: "24f3423255b680ce9dd5eb8eeece3ca0", // Pressure to Progress
  doneStatus: "",
  categoryProperty: "Area",
  tagNamespace: "Notion",
  showCategoryInView: true,
  writeCategoryTag: true,
  dayStart: 240,
  weekStartsSunday: false,
  morningEnd: 720,
  afternoonEnd: 1080,
  lunchEnabled: false,
  lunchStart: 750,
  lunchMinutes: 45,
  dinnerEnabled: false,
  dinnerStart: 1110,
  dinnerMinutes: 45,
  nightRoutineGap: 60,
  morningRoutinePomos: 2,
  nightRoutinePomos: 2,
  relaxMorningRoutinePomos: 2,
  relaxNightRoutinePomos: 2,
  morningRoutineEnds: 540,
  nightRoutineStarts: 1215,
  routineGroupMinutes: 25,
  addBlockEnabled: false,
  showAreaTimeline: true,
  hideBonusByDefault: true,
  heatThresholds: "1,2,4,6,8,10",
  dailyNoteWrite: true,
  dailyNoteTrueDate: true,
  dailyHeading: "\u{1F33B} Today",
  calibrationHeading: "Calibration",
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
  floatOnStart: false,
  floatAlwaysOnTop: true,
  floatBounds: null,
  floatBreakBounds: null,
  floatPhaseBounds: {},
  personalTaskNames: [],
  personalAreas: [],
  skipMorningRoutine: false,
  skipNightRoutine: false,
  morningBegins: 480,
  dayEnds: 1380,
  longBreakMinutes: 20,
  urgeSurfMinutes: 5,
  longBreakEvery: 3,
  timeFmtV2: true,
  workDays: [true, true, true, true, true, true, true],
  noiseFocus: "off",
  noiseBreak: "off",
  noiseVolume: 40,
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
  { id: "a-eyes", name: "Rest eyes - look far", area: "Body", count: 0, lastUsed: null },
  { id: "a-breathe", name: "Deep breathing", area: "Mind", count: 0, lastUsed: null },
];

// Fixed personal routines (local, never synced from Notion). Editable in the today view.
const DEFAULT_MORNING = [
  { id: "m-water", name: "Drink water" },
  { id: "m-stretch", name: "Stretch" },
];
const DEFAULT_NIGHT = [
  { id: "n-tidy", name: "Tidy the desk" },
  { id: "n-review", name: "Review the day" },
];
// Relax-day routines (used on rest days, or when the today switch is set to Relax).
const DEFAULT_RELAX_MORNING = [
  { id: "rm-sleep", name: "Sleep in" },
  { id: "rm-coffee", name: "Slow coffee" },
];
const DEFAULT_RELAX_NIGHT = [
  { id: "rn-unwind", name: "Unwind - no screens" },
  { id: "rn-read", name: "Read for fun" },
];

// Default valence/arousal feeling vocabulary for the urge surf's Emotions tab (ported from Hold to Pause).
const DEFAULT_FEELINGS: any = {
  tl: ["vexation", "distress", "panic", "rage", "anger", "tension", "frustration", "worry"],
  tr: ["excitement", "joy", "delight", "amazement", "surprise"],
  bl: ["sadness", "fatigue", "exhaustion", "dejection", "disappointment", "loneliness"],
  br: ["ease & comfort", "contentment", "relaxation", "serenity", "reassurance", "tranquillity"],
};

interface PluginData {
  settings: FocusLogSettings;
  sessions: any[];
  pending: any[];
  tasks: any[];
  activities: any[];
  pauseTags: any[];
  pauses: any[];
  breaks: any[];
  reflections: any[];        // retired with the Reflect view; kept so persist() never drops old saves
  calibrations: any[];
  areaOptions: string[];
  quickParents: { id: string; name: string }[];
  feelings: any;
  morningRoutine: any[];
  nightRoutine: any[];
  relaxMorningRoutine: any[];
  relaxNightRoutine: any[];
  routineDone: { [dayKey: string]: string[] };
  modeOverride: { [dayKey: string]: string };
  plans: { [dayKey: string]: any[] };
  doneToday: any[];
  urgesSurfed: any[];
  timerRun: any;             // the live pomodoro mirrored to disk, so a quit loses nothing
  floatWasOpen: boolean;     // the float was up at quit, so the next launch reopens it properly
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
// Guess multi-select: base tomatoes/boxes, plus up to two "+ …" re-estimate rounds. Each round
// is capped at two — beyond that the task must be split. optValue turns emoji into pip counts.
function guessOf(page: any): { base: number; plus: number[] } {
  const ms = page?.properties?.["Guess"]?.multi_select || [];
  let base = 0; const plus: number[] = [];
  for (const o of ms) {
    const name = o.name || "";
    if (name.trim().startsWith("+")) plus.push(optValue(name)); else base += optValue(name);
  }
  return { base, plus: plus.slice(0, 2) };
}
// Notion Status select -> short code. Only exploring/executing surface in the task list.
function mapStatus(name: string | null): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("explor")) return "exploring";
  if (n.includes("execut")) return "executing";
  if (n.includes("split")) return "split";
  if (n.includes("solv")) return "solved";
  return null;
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
  const h = (dayStart || 0) / 60;
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
  adopted: boolean;          // this run was re-adopted from disk after an app quit
  finishedAt: number | null; // wall-clock ms when the pomodoro hit 00:00 (null unless finished)
  breakActive: boolean;      // a break is in progress (running, paused, or finished-awaiting-dismiss)
  breakRunning: boolean;     // the break countdown is ticking
  breakFinished: boolean;    // the break hit 0 (kept up so its activities/feeling can still be set)
  breakSecs: number;         // seconds left on the break
  breakTotal: number;        // full break length in seconds
  breakStart: number | null; // wall-clock moment the break began (for the breaks log)
  breakPicked: string[];     // activity ids chosen for this break (max 3)
  breakFeeling: number | null; // the "how do you feel after this break" season (1-4 = Spring..Winter)
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
  private expected = 0;                      // "before" enjoyment rating (0 = not yet rated); set from the panel, read at log time
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
  private adoptedRun = false;   // the current run came back from disk after an app quit

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

  private finishedAtMs(): number | null {
    return (this.startedAt != null && !this.running && !this.paused && this.frozenSecs === 0 && this.endTs > 0) ? this.endTs : null;
  }
  // What a quit must not lose: everything needed to rebuild this run from the wall clock.
  private runSnapshot(): any {
    if (this.startedAt == null && !this.running && !this.paused && !this.breakActive) return null;
    return { running: this.running, paused: this.paused, endTs: this.endTs, frozenSecs: this.frozenSecs,
      total: this.total, lengthMin: this.lengthMin, task: this.taskName, expected: this.expected,
      startedAt: this.startedAt, pauseStart: this.pauseStart, pauseTag: this.pauseTag,
      brk: this.breakActive ? { active: true, running: this.breakRunning, finished: this.breakFinished,
        endTs: this.breakEndTs, frozen: this.breakRunning ? this.breakSecsNow() : this.breakFrozen,
        total: this.breakTotal, start: this.breakStart, picked: this.breakPicked.slice(), feeling: this.breakFeeling } : null };
  }
  private pushSnap() { this.plugin.saveTimerRun(this.runSnapshot()); }
  // Re-adopt a run persisted before the last quit. The engine is wall-clock based, so the
  // remaining time falls straight out of endTs; a deadline that passed while Obsidian was
  // closed lands on the finished screen, to be rated late and logged at its real end time.
  adopt(run: any): "running" | "paused" | "finished" | "break-running" | "break-paused" | "break-finished" | null {
    if (!run) return null;
    let kind: "running" | "paused" | "finished" | null = null;
    if (run.startedAt != null) {
      this.lengthMin = Math.max(5, Math.min(30, Math.round(run.lengthMin) || this.lengthMin));
      this.total = run.total || this.lengthMin * 60;
      this.taskName = run.task || "";
      this.expected = run.expected || 0;
      this.startedAt = run.startedAt;
      this.pauseStart = run.pauseStart ?? null;
      this.pauseTag = run.pauseTag || "";
      this.adoptedRun = true;
      if (run.running && Date.now() < run.endTs) {
        this.endTs = run.endTs;
        this.running = true; this.paused = false;
        // milestones crossed before the quit must not re-fire as stale notices
        const s = this.secsNow();
        [900, 600, 300].forEach((m) => { if (s <= m) this.fired[m] = true; });
        this.ensureTick();
        kind = "running";
      } else if (run.paused && (run.frozenSecs || 0) > 0) {
        this.frozenSecs = run.frozenSecs;
        this.paused = true; this.running = false;
        kind = "paused";
      } else {
        // It ended while we were away, or was already sitting finished at quit: freeze at
        // 00:00 with the deadline kept, so the rate step logs the real end time.
        this.endTs = run.endTs || Date.now();
        this.frozenSecs = 0; this.running = false; this.paused = false;
        this.fired[0] = true;   // that finish already happened; no late celebration
        kind = "finished";
      }
    }
    let bk: "break-running" | "break-paused" | "break-finished" | null = null;
    const b = run.brk;
    if (b && b.active) {
      this.breakTotal = b.total || 0;
      this.breakStart = b.start || Date.now();
      this.breakPicked = Array.isArray(b.picked) ? b.picked.slice(0, 3) : [];
      this.breakFeeling = b.feeling ?? null;
      this.breakActive = true;
      this.adoptedRun = true;
      if (b.running && Date.now() < b.endTs) {
        this.breakEndTs = b.endTs; this.breakRunning = true; this.breakFinished = false;
        this.ensureTick();
        bk = "break-running";
      } else if (b.running || b.finished) {
        // it ran out while we were away, or was already on the finished face at quit
        this.breakEndTs = b.endTs || 0;
        this.breakFrozen = 0; this.breakRunning = false; this.breakFinished = true;
        bk = "break-finished";
      } else {
        this.breakFrozen = Math.max(0, b.frozen || 0); this.breakRunning = false; this.breakFinished = false;
        bk = "break-paused";
      }
    }
    if (kind || bk) this.emit();
    return kind || bk;
  }
  getState(): TimerState {
    return {
      secs: this.secsNow(), total: this.total, running: this.running, paused: this.paused, lengthMin: this.lengthMin, taskName: this.taskName, startedAt: this.startedAt, pauseStart: this.pauseStart, pauseTag: this.pauseTag, expected: this.expected,
      adopted: this.adoptedRun, finishedAt: this.finishedAtMs(),
      breakActive: this.breakActive, breakRunning: this.breakRunning, breakFinished: this.breakFinished, breakSecs: this.breakSecsNow(), breakTotal: this.breakTotal, breakStart: this.breakStart, breakPicked: this.breakPicked.slice(), breakFeeling: this.breakFeeling,
    };
  }
  setPauseTag(tag: string) { this.pauseTag = tag || ""; this.emit(); this.pushSnap(); }
  // The panel's "before" rating; kept on the engine so a quick-log from the float window
  // (which never shows a before-section) still records the expectation the user set.
  setExpected(n: number) { this.expected = (n >= 1 && n <= 4) ? Math.round(n) : 0; this.emit(); this.pushSnap(); }
  // Pre-select the task for the next pomodoro (e.g. chosen on the float celebration)
  // without starting the timer; both windows show it as the upcoming task.
  setTask(name: string) { this.taskName = (name || "").trim(); this.emit(); this.pushSnap(); }
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
    this.pushSnap();
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
    this.pushSnap();
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
    this.adoptedRun = false;
    this.pushSnap();   // startedAt is null now, so this clears the on-disk run
    this.taskName = "";
    this.expected = 0;
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
  startBreak(reqMins?: number) {
    const mins = Math.max(1, Math.min(120, Math.round(reqMins != null ? reqMins : (this.plugin.data.settings.breakMinutes || 5)) || 5));
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
    this.pushSnap();
  }
  toggleBreakRun() {
    if (!this.breakActive || this.breakFinished) return;
    if (this.breakRunning) { this.breakFrozen = this.breakSecsNow(); this.breakRunning = false; this.stopTick(); }
    else { this.breakEndTs = Date.now() + Math.max(1, this.breakFrozen) * 1000; this.breakRunning = true; this.ensureTick(); }
    this.emit();
    this.pushSnap();
  }
  stepBreak(deltaMin: number) {
    if (!this.breakActive) return;
    const next = Math.max(60, Math.min(30 * 60, this.breakSecsNow() + deltaMin * 60));
    this.breakFrozen = next;
    this.breakFinished = false;
    if (this.breakRunning) this.breakEndTs = Date.now() + next * 1000;
    this.emit();
    this.pushSnap();
  }
  toggleBreakPick(id: string) {
    if (this.breakPicked.includes(id)) this.breakPicked = this.breakPicked.filter((x) => x !== id);
    else if (this.breakPicked.length < 3) this.breakPicked = [...this.breakPicked, id];
    this.emit();
    this.pushSnap();
  }
  setBreakFeeling(n: number) { this.breakFeeling = Math.max(1, Math.min(4, Math.round(n) || 2)); this.emit(); this.pushSnap(); }   // 1-4 = the four seasons (Spring..Winter)
  // Commit the break (activities + feeling → the breaks log via the plugin) and clear
  // the phase. Called when the user ends/skips the break, closing the loop back to setup.
  endBreak() {
    // A break that already hit 00:00 ended AT its deadline, not when this button was finally
    // pressed — without the clamp, a finished break dismissed the next morning records hours.
    const endedAt = (this.breakFinished && this.breakEndTs > 0) ? Math.min(Date.now(), this.breakEndTs) : Date.now();
    if (this.breakActive && this.breakStart) this.plugin.commitBreak(this.breakStart, endedAt, this.breakPicked.slice(), this.breakFeeling);
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
    this.pushSnap();
  }

  // Emit only when the DISPLAYED second flips: polls can arrive at several Hz from two windows
  // whose intervals drift against the wall-clock second, and per-poll emits made the digits
  // advance in uneven bursts (a second lingering ~1.5s, then a quick catch-up).
  private lastPollSecs = -1;
  private lastPollBreak = -1;
  private ensureTick() {
    // Tell Electron not to throttle this window's timers while a pomodoro or break runs,
    // otherwise a backgrounded window's setInterval is clamped to ~1/minute and the
    // countdown jumps a minute at a time. Restored to normal when nothing is ticking.
    this.plugin.setBackgroundThrottle(false);
    if (this.iv != null) return;
    this.iv = window.setInterval(() => this.poll(), 200);
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
      if (this.total > 900 && s <= 900 && !this.fired[900]) { this.fired[900] = true; this.plugin.timerNotify("15 minutes left. Are you still on the task?"); }
      if (this.total > 600 && s <= 600 && !this.fired[600]) { this.fired[600] = true; this.plugin.timerNotify("10 minutes left. Are you still on the task?"); }
      if (this.total > 300 && s <= 300 && !this.fired[300]) { this.fired[300] = true; this.plugin.timerNotify("5 minutes left. Are you still on the task?"); }
      if (s <= 0 && !this.fired[0]) {
        this.fired[0] = true;
        this.frozenSecs = 0;
        this.running = false;
        this.paused = false;
        this.stopTick();
        this.emit();
        this.plugin.timerDone();
        this.pushSnap();   // the finished screen survives a quit before it is rated
        return;
      }
      if (s !== this.lastPollSecs) { this.lastPollSecs = s; changed = true; }
    }
    if (this.breakRunning) {
      if (this.breakSecsNow() <= 0) {
        this.breakFrozen = 0;
        this.breakRunning = false;
        this.breakFinished = true;
        this.pushSnap();
        this.stopTick();
        this.emit();
        this.plugin.breakDone();
        return;
      }
      const bs = this.breakSecsNow();
      if (bs !== this.lastPollBreak) { this.lastPollBreak = bs; changed = true; }
    }
    if (changed) this.emit();
  }
}

export default class FocusLogPlugin extends Plugin {
  data: PluginData;
  timer: TimerEngine;
  floatWin: any = null;
  private floatSubs = new Set<() => void>();
  // Background noise lives on the MAIN window (the float popout is rebuilt from scratch
  // every open, so audio owned there would die with it). Lazy: never allocated while muted.
  private noiseEl: HTMLAudioElement | null = null;
  private noiseTrack = "";
  private noiseSubs = new Set<() => void>();
  private pauseSubs = new Set<() => void>();   // panel re-syncs its pauses list when these fire
  private sessionSubs = new Set<() => void>(); // panel re-reads its sessions when these fire (e.g. a float quick-log)
  private breakSubs = new Set<() => void>();   // panel re-reads activities + breaks when the engine commits a break
  private logViewSubs = new Set<() => void>(); // panel switches to the log tab when these fire
  private skyViewSubs = new Set<() => void>(); // panel switches to the Sky tab when these fire (star notices)
  private activeDailySubs = new Set<(ts: number | null) => void>(); // Month calendar outline follows the focused daily note
  private activeDailyTs: number | null = null;
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
      reflections: loaded.reflections || [],
      calibrations: loaded.calibrations || [],
      areaOptions: loaded.areaOptions || [],
      quickParents: loaded.quickParents || [],
      doneToday: loaded.doneToday || [],
      urgesSurfed: loaded.urgesSurfed || [],
      timerRun: loaded.timerRun ?? null,
      floatWasOpen: !!loaded.floatWasOpen,
      feelings: loaded.feelings || JSON.parse(JSON.stringify(DEFAULT_FEELINGS)),
      morningRoutine: loaded.morningRoutine || DEFAULT_MORNING.map((a) => ({ ...a })),
      nightRoutine: loaded.nightRoutine || DEFAULT_NIGHT.map((a) => ({ ...a })),
      relaxMorningRoutine: loaded.relaxMorningRoutine || DEFAULT_RELAX_MORNING.map((a) => ({ ...a })),
      relaxNightRoutine: loaded.relaxNightRoutine || DEFAULT_RELAX_NIGHT.map((a) => ({ ...a })),
      routineDone: loaded.routineDone || {},
      modeOverride: loaded.modeOverride || {},
      plans: loaded.plans || {},
    };
    // One-time: refresh the mood vocabulary to the current word set (no feelings editor existed before).
    if (!(this.data.settings as any).feelingsV2) {
      (this.data.settings as any).feelingsV2 = true;
      this.data.feelings = JSON.parse(JSON.stringify(DEFAULT_FEELINGS));
    }
    // Seed the per-phase float bounds from the old single focus/break bounds (one-time).
    if (!this.data.settings.floatPhaseBounds || Object.keys(this.data.settings.floatPhaseBounds).length === 0) {
      const m: any = {};
      if (this.data.settings.floatBounds) m.focus = this.data.settings.floatBounds;
      if (this.data.settings.floatBreakBounds) m.break = this.data.settings.floatBreakBounds;
      this.data.settings.floatPhaseBounds = m;
    }
    // Migrate the day/time-band settings from whole hours to minutes-from-midnight (one
    // time). Old configs stored e.g. dayStart: 4; the code now expects 240. Persist the
    // flag right away so a reload before any later save can't double-convert.
    // The routine boundaries used to be derived (morning: Morning-begins + the routine's summed
    // minutes; night: dinner end + the old gap). Seed the new explicit settings from those same
    // formulas, so the Plan phases and the pomodoro counter keep today's behaviour until edited.
    if (loaded.settings && (loaded.settings as any).morningRoutineEnds == null) {
      const s = this.data.settings;
      const morningSum = (this.data.morningRoutine || []).reduce((a: number, it: any) => a + (it.dur || 25), 0);
      s.morningRoutineEnds = (s.morningBegins ?? 480) + (morningSum || 60);
      s.nightRoutineStarts = s.dinnerEnabled ? (s.dinnerStart ?? 1110) + (s.dinnerMinutes ?? 45) + (s.nightRoutineGap ?? 60) : 1215;
      await this.persist();
    }
    // The routines' pomodoro cost becomes a declared setting; seed it from what the old
    // duration-chunking displayed (a routine that read "1/5" seeds as 5).
    if (loaded.settings && (loaded.settings as any).morningRoutinePomos == null) {
      const s = this.data.settings;
      const cost = (list: any[]) => Math.max(1, Math.ceil(((list || []).reduce((a: number, it: any) => a + (it.dur || 15), 0) || 1) / (s.routineGroupMinutes || 25)));
      s.morningRoutinePomos = cost(this.data.morningRoutine);
      s.nightRoutinePomos = cost(this.data.nightRoutine);
      await this.persist();
    }
    if (loaded.settings && (loaded.settings as any).relaxMorningRoutinePomos == null) {
      const s = this.data.settings;
      const cost = (list: any[]) => Math.max(1, Math.ceil(((list || []).reduce((a: number, it: any) => a + (it.dur || 15), 0) || 1) / (s.routineGroupMinutes || 25)));
      s.relaxMorningRoutinePomos = cost(this.data.relaxMorningRoutine);
      s.relaxNightRoutinePomos = cost(this.data.relaxNightRoutine);
      await this.persist();
    }
    if (loaded.settings && !loaded.settings.timeFmtV2) {
      for (const k of ["dayStart", "morningBegins", "dayEnds", "morningEnd", "afternoonEnd"] as const) {
        const v = (this.data.settings as any)[k];
        if (typeof v === "number" && v <= 24) (this.data.settings as any)[k] = Math.round(v * 60);
      }
      this.data.settings.timeFmtV2 = true;
      await this.persist();
    } else {
      this.data.settings.timeFmtV2 = true;
    }

    this.timer = new TimerEngine(this, this.data.settings.pomodoroMinutes);
    // Background noise follows the engine: every transition re-derives what should sound.
    this.register(this.timer.subscribe(() => this.updateNoise()));
    // Pick back up whatever was running when Obsidian last quit: a still-live run resumes on
    // the wall clock; one whose time passed while away opens on the finished screen instead.
    {
      const kind = this.timer.adopt(this.data.timerRun);
      if (kind === "running") this.timerNotify("Picked your pomodoro back up - " + Math.max(1, Math.ceil(this.timer.getState().secs / 60)) + " min left.");
      else if (kind === "finished") this.timerNotify("A pomodoro finished while you were away. Rate it when you're ready - it still counts.");
      else if (kind === "break-running") this.timerNotify("Picked your break back up - " + Math.max(1, Math.ceil(this.timer.getState().breakSecs / 60)) + " min left.");
      else if (kind === "break-finished") this.timerNotify("Your break ended while you were away.");
    }
    this.updateNoise();   // covers a run adopted straight from disk
    // When the main window is revealed again, recompute at once so any alert or
    // finish that came due while it was hidden (and its timers throttled) fires.
    this.registerDomEvent(document, "visibilitychange", () => { if (!document.hidden) this.timer.poll(); });
    // Catch our float popout the instant its OS window is created, so we can size
    // and place it before its first visible frame (no large-window-then-jump).
    this.registerEvent(this.app.workspace.on("window-open", () => this.onFloatWindowOpen()));
    // The Month calendar's chocolate outline follows the daily note you focus (today when none is).
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateActiveDaily()));
    this.app.workspace.onLayoutReady(() => {
      this.updateActiveDaily();
      // A float popout restored from the last session's layout comes back as a plain centered
      // window — never through our hide → size → reveal path — and its leaf is exactly where
      // "open daily note on startup" likes to land. Close every remnant, then reopen the float
      // properly if it was up at quit.
      this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT).forEach((l) => l.detach());
      this.closeFloatRemnants();
      if (this.data.floatWasOpen) this.openFloating();
    });

    this.registerView(VIEW_TYPE, (leaf) => new FocusLogView(leaf, this));
    this.registerView(VIEW_TYPE_FLOAT, (leaf) => new FloatTimerView(leaf, this));
    this.addRibbonIcon("bird", "Open Focus Log", () => this.activateView());
    this.addRibbonIcon("timer", "Toggle floating timer", () => this.toggleFloating());
    this.addCommand({ id: "open-focus-log", name: "Open Focus Log", callback: () => this.activateView() });
    this.addCommand({ id: "toggle-floating-timer", name: "Toggle floating timer", callback: () => this.toggleFloating() });
    // Lets external automation open the view via the URL obsidian://focuslog
    this.registerObsidianProtocolHandler("focuslog", () => this.activateView());
    this.addSettingTab(new FocusLogSettingTab(this.app, this));
  }

  unloading = false;   // distinguishes app-quit/plugin-reload teardown from the user closing the float
  onunload() {
    this.unloading = true;
    try { if (this.noiseEl) { this.noiseEl.pause(); this.noiseEl.src = ""; } } catch {}
    this.noiseEl = null;
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
    this.timerNotify("Break over - ready for the next pomodoro?");
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
  async quickLog(actual: number, markDone = false, nextTask = "", opts?: { delayBreakMs?: number }) {
    const st = this.timer.getState();
    const taskName = (st.taskName || "").trim();
    if (!taskName) return;
    const meta: any = (this.data.tasks || []).find((t: any) => t.task === taskName) || {};
    const workedSecs = st.total - st.secs;
    const minutes = workedSecs > 0 ? Math.max(1, Math.round(workedSecs / 60)) : st.lengthMin;
    const s: any = {
      id: Date.now(), task: taskName, group: meta.group || taskName, hierarchy: meta.hierarchy || "",
      load: meta.load || null, category: meta.category || null, url: meta.url || null, pageId: meta.id || null,
      ts: new Date().toISOString(), expected: st.expected, actual: Math.max(1, Math.min(4, Math.round(actual) || 3)), note: "", minutes,
    };
    this.data.sessions = [...(this.data.sessions || []), s];
    await this.persist();
    this.timer.commitPendingPause();
    this.timer.reset();
    // The chosen next task rides on the engine: the float shows it as the upcoming task
    // and the panel picks it up as its preset.
    if (nextTask) this.timer.setTask(nextTask);
    // Closed loop: roll into the shared break phase (the float renders it next). A caller may
    // delay it briefly — the float does, so its star reveal plays before the break takes over.
    if (this.data.settings.breakEnabled) {
      const go = () => { try { this.timer.startBreak(); } catch {} };
      if (opts && opts.delayBreakMs) window.setTimeout(go, opts.delayBreakMs); else go();
    }
    this.notifySessionsChange();
    // The float's quick-log lights a star too: name it in a clickable notice. Notices are
    // hidden inside the float window, so this shows in the MAIN window; clicking it focuses
    // Obsidian and opens the panel's Sky tab (Pomodoros) on the new star.
    const starName = newestStarName((this.data.sessions || []).length);
    if (starName) {
      const n = new Notice("You lit up " + starName + " ✨  Click to see it in your Sky.", 9000);
      try { n.noticeEl.addEventListener("click", () => { try { this.focusAndSky(); } catch {} n.hide(); }); } catch {}
    }
    // Notices are hidden inside the float window, so flash the star there too (5s banner) —
    // unless the float is playing its own star reveal (delayBreakMs set), which already shows it.
    if (!(opts && opts.delayBreakMs)) try { this.floatView()?.flash(starName ? "Logged ✓  You lit up " + starName + " ✨" : "Logged ✓"); } catch {}
    let msg = "Logged “" + taskName + "” - felt " + s.actual + "/4.";
    if (s.pageId) {
      try { await this.incrementAct(s.pageId); }
      catch (e) { this.data.pending = [...(this.data.pending || []), { sessionId: s.id, pageId: s.pageId, task: s.task }]; await this.persist(); msg += " Spend write queued."; }
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
  onRequestSkyView(fn: () => void): () => void { this.skyViewSubs.add(fn); return () => this.skyViewSubs.delete(fn); }
  // Parse the active file as a daily note (same name format + folder the calendar opens) and tell
  // subscribers when it changes. null = the focused file is not a daily note.
  private updateActiveDaily() {
    let ts: number | null = null;
    try {
      const f: any = this.app.workspace.getActiveFile();
      const moment = (window as any).moment;
      if (f && moment) {
        const s = this.data.settings;
        const dn: any = (this.app as any).internalPlugins?.getPluginById?.("daily-notes");
        const opts = dn?.instance?.options || {};
        const format = (s.dailyTitleFormat || opts.format || "YYYY-MM-DD").trim();
        const folder = (s.dailyNoteFolder || opts.folder || "").trim();
        const okFolder = !folder || (f.parent && normalizePath(f.parent.path) === normalizePath(folder));
        if (okFolder) { const m = moment(f.basename, format, true); if (m.isValid()) ts = m.valueOf(); }
      }
    } catch (e) { ts = null; }
    if (ts !== this.activeDailyTs) { this.activeDailyTs = ts; this.activeDailySubs.forEach((fn) => { try { fn(ts); } catch {} }); }
  }
  getActiveDaily(): number | null { return this.activeDailyTs; }
  onActiveDaily(fn: (ts: number | null) => void): () => void { this.activeDailySubs.add(fn); return () => this.activeDailySubs.delete(fn); }
  // Focus the main window, open the panel, and switch it to the Sky tab (star-notice click).
  async focusAndSky() {
    try {
      const remote = getElectronRemote();
      const win = remote && remote.getCurrentWindow ? remote.getCurrentWindow() : null;
      if (win) { try { win.show(); } catch {} try { win.focus(); } catch {} }
      try { if (remote && remote.app && remote.app.focus) remote.app.focus({ steal: true }); } catch {}
    } catch {}
    await this.activateView();
    // Give a freshly-created panel a moment to subscribe before asking for the Sky tab.
    window.setTimeout(() => this.skyViewSubs.forEach((fn) => { try { fn(); } catch {} }), 60);
  }
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

  // Derives what should be sounding from engine state + settings and nudges the element
  // only on differences: the engine emits every second, so every write here is guarded.
  // Element pause keeps currentTime, which is exactly the pause-holds-resume-continues rule.
  updateNoise() {
    const st = this.data ? this.data.settings : null;
    const s = this.timer ? this.timer.getState() : null;
    const want: NoiseChoice = !s || !st ? "off" : s.breakRunning ? (st.noiseBreak || "off") : s.running ? (st.noiseFocus || "off") : "off";
    if (want === "off" || !st) { if (this.noiseEl && !this.noiseEl.paused) this.noiseEl.pause(); return; }
    if (!this.noiseEl) { this.noiseEl = new Audio(); this.noiseEl.loop = true; }
    const vol = Math.max(0, Math.min(1, (st.noiseVolume ?? 40) / 100));
    if (this.noiseEl.volume !== vol) this.noiseEl.volume = vol;
    if (this.noiseTrack !== want) {
      this.noiseEl.src = this.app.vault.adapter.getResourcePath(normalizePath((this.manifest.dir || "") + "/assets/" + want + "_noise.mp3"));
      this.noiseTrack = want;
    }
    if (this.noiseEl.paused) this.noiseEl.play().catch(() => {});
  }
  async setNoisePref(phase: "focus" | "break", v: NoiseChoice) {
    if (phase === "break") this.data.settings.noiseBreak = v; else this.data.settings.noiseFocus = v;
    await this.persist();
    this.updateNoise();
    this.notifyNoiseChange();
  }
  onNoiseChange(fn: () => void): () => void {
    this.noiseSubs.add(fn);
    return () => this.noiseSubs.delete(fn);
  }
  notifyNoiseChange() {
    this.noiseSubs.forEach((fn) => { try { fn(); } catch {} });
  }
  isFloatingOpen(): boolean {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT).some((l) => { const w = (l.view as any)?.containerEl?.win; return w && !w.closed; });
  }

  // Called by the engine whenever a pomodoro starts; pop the window into view.
  onTimerStarted() {
    if (this.data.settings.floatOnStart !== false) this.openFloating();
  }

  async openFloating() {
    if (Platform.isMobile) return;   // the floating timer is an Electron popout window — desktop only
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT);
    // A previously-closed popout can leave a leaf behind whose window is already
    // gone. Reveal one only if its window is genuinely still open; otherwise drop
    // the stale leaves and create a fresh window.
    const live = leaves.find((l) => { const w = (l.view as any)?.containerEl?.win; return w && !w.closed; });
    if (live) {
      this.app.workspace.revealLeaf(live);
      // true = also size and place: for a same-session reveal this re-applies the current
      // bounds (a no-op); for a leaf restored by Obsidian it is the missing sizing pass.
      this.pinFloatWindow(true);
      this.data.floatWasOpen = true; void this.persist();
      return;
    }
    leaves.forEach((l) => l.detach());
    const ws: any = this.app.workspace;
    // Mark the next popout as ours: onFloatWindowOpen() fires the instant the OS
    // window is created and hides → sizes → reveals it, so the first visible frame
    // is already small and in the corner (no large-window-in-the-middle flash).
    this.openingFloat = true;
    this.floatSizePhase = ""; // fresh window — force the phase sizing to apply on open
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
    this.data.floatWasOpen = true; void this.persist();
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

  // A restored float popout whose leaf was hijacked (e.g. by the startup daily note) is no
  // longer our view type, so it must be recognised by its window instead: a tiny popout the
  // exact size of a remembered float phase. Ordinary popouts are nowhere near these sizes.
  private closeFloatRemnants() {
    const sizes: any[] = Object.values(FLOAT_PHASE_DEFAULTS);
    const pb = this.data.settings.floatPhaseBounds || {};
    Object.keys(pb).forEach((k) => { if (pb[k]) sizes.push(pb[k]); });
    if (this.data.settings.floatBounds) sizes.push(this.data.settings.floatBounds);
    const doomed: any[] = [];
    this.app.workspace.iterateAllLeaves((l: any) => {
      try {
        const w = l.view?.containerEl?.win;
        if (!w || w === window || w.closed) return;
        if (l.getViewState && l.getViewState().type === VIEW_TYPE_FLOAT) return;   // handled by the detach above
        if (sizes.some((b: any) => Math.abs((b.w || 0) - w.outerWidth) <= 26 && Math.abs((b.h || 0) - w.outerHeight) <= 26)) doomed.push(l);
      } catch {}
    });
    doomed.forEach((l) => { try { l.detach(); } catch {} });
  }

  closeFloating() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT).forEach((l) => l.detach());
    this.data.floatWasOpen = false; void this.persist();
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
      this.floatWin = win;
      if (initial) this.syncFloatPhase(false); // size to the current phase (or its default)
    } catch {}
  }

  // ---------- per-phase float window geometry ----------
  // Each phase (setup / focus / pause / break / celebrate) remembers its own size and
  // position. This replaces the old patchwork (one focus size, one break size, plus
  // ad-hoc +Npx grows for pause/celebration) that fought each other when phases switched.
  floatSizePhase = "";
  getFloatPhaseBounds(phase: string): any { return (this.data.settings.floatPhaseBounds || {})[phase] || null; }
  saveFloatPhaseBounds(phase: string, b: { x: number; y: number; width: number; height: number }) {
    if (!phase) return;
    const m = Object.assign({}, this.data.settings.floatPhaseBounds || {});
    m[phase] = { x: b.x, y: b.y, w: b.width, h: b.height };
    this.data.settings.floatPhaseBounds = m;
    this.persist();
  }
  private floatPhaseFor(celebrating: boolean): string {
    if (celebrating) return "celebrate";
    const s = this.timer.getState();
    if (s.breakActive) return "break";
    // A pomodoro paused before a restart/reopen is rendered as setup until a live run is seen this
    // window-lifetime; size to setup then too, so the window doesn't grow to the pause geometry.
    const liveRun = this.floatView()?.hasSeenRun() ?? false;
    if (s.paused && (s.running || liveRun)) return "pause";
    if (!s.running && (s.startedAt == null || !liveRun)) return "setup";
    return "focus";
  }
  private applyFloatPhaseBounds(phase: string) {
    try {
      const win = this.floatWin;
      if (!win || !win.setBounds || !win.getBounds) return;
      const saved = this.getFloatPhaseBounds(phase);
      const d = FLOAT_PHASE_DEFAULTS[phase] || FLOAT_PHASE_DEFAULTS.focus;
      if (saved && saved.w && saved.h) {
        // Celebrate self-heal: an old sizing fight could save another phase's smaller geometry
        // into this slot; never apply a celebrate size below its content default.
        const w = phase === "celebrate" ? Math.max(saved.w, d.w) : saved.w;
        const h = phase === "celebrate" ? Math.max(saved.h, d.h) : saved.h;
        win.setBounds({ x: Math.round(saved.x), y: Math.round(saved.y), width: Math.round(w), height: Math.round(h) });
        return;
      }
      const cur = win.getBounds(); // first time in this phase: default size, keep current position
      win.setBounds({ x: cur.x, y: cur.y, width: d.w, height: d.h });
    } catch {}
  }
  // Switch the window to the active phase's geometry, saving where the previous phase was.
  syncFloatPhase(celebrating: boolean) {
    const want = this.floatPhaseFor(celebrating);
    if (want === this.floatSizePhase) return;
    const prev = this.floatSizePhase;
    this.floatSizePhase = want;
    try { const win = this.floatWin; if (prev && win && win.getBounds) this.saveFloatPhaseBounds(prev, win.getBounds()); } catch {}
    this.applyFloatPhaseBounds(want);
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
    this.osNotify("Pomodoro complete \u{1F389}", "One block done - log how enjoyable it actually was.");
    // When the floating window is up, it owns the celebration (tap it to jump to the
    // log view) — no extra modal. Fall back to the modal only if there's no float.
    if (this.isFloatingOpen()) this.floatView()?.celebrate();
    else new CelebrateModal(this.app).open();
  }

  // The engine mirrors its live run here on every state change; null clears it.
  saveTimerRun(snap: any) {
    this.data.timerRun = snap ?? null;
    void this.persist();
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
    // \uD83C\uDF31 Daily tasks recur and carry the status with no per-day Date, so match on status
    // alone (this mirrors the user's own "Today Tasks" Notion view). The earlier filter
    // also required Date == today, which hid every Daily task.
    const filter = {
      or: [
        { property: "Schedule", select: { equals: "\u{1F33B} Today" } },
        { property: "Schedule", select: { equals: "1\uFE0F\u20E3 King" } },
        { property: "Schedule", select: { equals: "\u{1F331} Daily" } },
      ],
    };
    // Page through every match — Notion returns at most 100 rows per request and sets
    // has_more / next_cursor when there are more. Without this loop, any task past the
    // first page was silently dropped.
    const pages: any[] = [];
    let cursor: string | undefined = undefined;
    do {
      const body: any = { filter, page_size: 100 };
      if (cursor) body.start_cursor = cursor;
      const json: any = await this.notionFetch(`/databases/${this.data.settings.databaseId}/query`, "POST", body);
      pages.push(...(json.results || []));
      cursor = json.has_more ? json.next_cursor : undefined;
    } while (cursor);
    // Refresh the Area choices for the add-block editor from the database schema, so the
    // dropdown always mirrors the Notion Area options.
    try {
      const db = await this.notionFetch(`/databases/${this.data.settings.databaseId}`);
      const prop = db?.properties?.[this.data.settings.categoryProperty || "Area"];
      const opts = (prop?.select?.options || prop?.multi_select?.options || []).map((o: any) => o.name).filter(Boolean);
      if (opts.length) { this.data.areaOptions = opts; await this.persist(); }
    } catch (e) {}
    // Refresh the quick-add parent choices: BIG TASKs are the pages whose Guess carries the
    // mountain marker (the user's own Today views hide them), and only while their Schedule is
    // 🌻 Today or 🎯 This week — Later / Done / Archived / Legacy big tasks stay out of the list.
    // Queried live each sync, so the list follows the database as it evolves.
    try {
      const bt: any[] = [];
      let bc: string | undefined = undefined;
      do {
        const body: any = { filter: { and: [
          { property: "Guess", multi_select: { contains: "\u{1F3D4}️" } },
          { or: [
            { property: "Schedule", select: { equals: "\u{1F33B} Today" } },
            { property: "Schedule", select: { equals: "\u{1F3AF} This week" } },
          ] },
        ] }, page_size: 100 };
        if (bc) body.start_cursor = bc;
        const j: any = await this.notionFetch(`/databases/${this.data.settings.databaseId}/query`, "POST", body);
        bt.push(...(j.results || []));
        bc = j.has_more ? j.next_cursor : undefined;
      } while (bc);
      this.data.quickParents = bt
        .map((p: any) => ({ id: p.id, name: plainTitle(p) }))
        .filter((x: any) => x.name);
      await this.persist();
    } catch (e) {}
    const cache: Record<string, any> = {};
    const tasks: any[] = [];
    for (const p of pages) {
      const task = plainTitle(p);
      if (!task) continue;
      const h = await this.resolveHierarchy(p, cache);
      const g = guessOf(p);
      tasks.push({
        task,
        status: mapStatus(selectName(p, "Status")),
        power: mapPower(selectName(p, "ExecutionPower")),
        king: (selectName(p, "Schedule") || "").includes("King"),
        // A Guess carrying the mountain marks a BIG TASK: the work happens in its
        // sub-tasks, so the list hides the parent by default (the eye reveals it).
        big: (p?.properties?.["Guess"]?.multi_select || []).some((o: any) => /\u{1F3D4}/u.test(o.name || "")),
        category: categoryName(p, this.data.settings.categoryProperty) || null,
        pomodoros: g.base + g.plus.reduce((a, b) => a + b, 0),
        guessBase: g.base,
        guessPlus: g.plus,
        act: numberProp(p, "Spend"),
        url: p.url,
        id: p.id,
        parent: h.parent,
        ancestor: h.ancestor,
        group: h.ancestor || task,
      });
    }
    // Preserve the user's manual ranking across syncs: already-ranked ids keep their saved
    // position, and tasks whose id we have not seen join at the END of the list (ranked
    // Must → Aim → Bonus among themselves), so a sync never reshuffles what you arranged.
    const prevIndex: Record<string, number> = {};
    (this.data.tasks || []).forEach((t: any, i: number) => { if (t && t.id != null) prevIndex[t.id] = i; });
    const POWER_RANK: Record<string, number> = { P: 0, Y: 1, G: 2 };
    const fresh = tasks
      .filter((t) => prevIndex[t.id] === undefined)
      .sort((a, b) => (POWER_RANK[a.power] ?? 1) - (POWER_RANK[b.power] ?? 1));
    const known = tasks
      .filter((t) => prevIndex[t.id] !== undefined)
      .sort((a, b) => prevIndex[a.id] - prevIndex[b.id]);
    // LOCAL tasks (created with the Timeline's add-block button) live alongside Notion tasks and
    // survive every sync, so the plugin also works without a Notion database at all.
    const locals = (this.data.tasks || []).filter((t: any) => t.local);
    const ordered = [...known, ...fresh, ...locals];
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

  // Read current Spend, then PATCH only that one property (+1).
  async incrementAct(pageId: string): Promise<number> {
    const page = await this.notionFetch(`/pages/${pageId}`);
    const next = numberProp(page, "Spend") + 1;
    await this.notionFetch(`/pages/${pageId}`, "PATCH", { properties: { Spend: { number: next } } });
    return next;
  }

  // Claimed work: add n pomodoros to Spend in one read + one PATCH.
  async incrementActBy(pageId: string, n: number): Promise<number> {
    const page = await this.notionFetch(`/pages/${pageId}`);
    const next = numberProp(page, "Spend") + Math.max(1, Math.round(n || 1));
    await this.notionFetch(`/pages/${pageId}`, "PATCH", { properties: { Spend: { number: next } } });
    return next;
  }

  // Quick-add from the panel. The public API cannot apply Notion page templates, so this
  // replicates the user's two templates exactly: no parent = "Common task" (Area Task, ⏳ icon);
  // a parentId = "This is sub tasks under BIG TASK" (Area Pro, 🐾 icon, Parent item relation).
  // Both get Schedule 🌻 Today, Status Exploring, ExecutionPower 🌤️ Aim Today, empty Guess —
  // the same values the real templates preset. One-way push: nothing is pulled back.
  async createTask(name: string, parentId?: string | null, guess?: number, status?: string): Promise<any> {
    const sub = !!parentId;
    const props: any = {
      Task: { title: [{ text: { content: name } }] },
      Schedule: { select: { name: "\u{1F33B} Today" } },
      Status: { select: { name: status === "Executing" ? "Executing" : "Exploring" } },
      ExecutionPower: { select: { name: "\u{1F324}️ Aim Today" } },
    };
    // Optional initial Guess, entered as a plain number: 1-3 become 🍅 strings, 4 becomes one 📦
    // (the same values optValue reads back), so the pip display round-trips exactly.
    const g = Math.max(0, Math.min(4, Math.round(guess || 0)));
    if (g) props.Guess = { multi_select: [{ name: g === 4 ? "\u{1F4E6}" : "\u{1F345}".repeat(g) }] };
    props[this.data.settings.categoryProperty || "Area"] = { select: { name: sub ? "Pro" : "Task" } };
    if (sub) props["Parent item"] = { relation: [{ id: parentId }] };
    const page = await this.notionFetch(`/pages`, "POST", {
      parent: { database_id: this.data.settings.databaseId },
      icon: { type: "emoji", emoji: sub ? "\u{1F43E}" : "⏳" },
      properties: props,
    });
    const parentName = sub ? (((this.data.quickParents || []).find((x: any) => x.id === parentId) || {}) as any).name || null : null;
    // Mirror queryToday's task shape and put the newcomer on top, so the panel updates
    // instantly without pulling from Notion (Sync stays manual; the timeline is not rebuilt).
    const t = {
      task: name, status: status === "Executing" ? "executing" : "exploring", power: "Y", king: false,
      category: sub ? "Pro" : "Task", pomodoros: g, guessBase: g, guessPlus: [],
      act: 0, url: page.url, id: page.id,
      parent: parentName, ancestor: parentName, group: parentName || name,
    };
    this.data.tasks = [t, ...(this.data.tasks || [])];
    await this.persist();
    return t;
  }

  // Resolve the Status option that means "done": an explicit setting wins, otherwise
  // auto-detect from the database schema (first option whose name reads as done/complete).
  private async resolveDoneStatus(): Promise<string> {
    const override = (this.data.settings.doneStatus || "").trim();
    if (override) return override;
    if (this.doneStatusCache) return this.doneStatusCache;
    const db = await this.notionFetch(`/databases/${this.data.settings.databaseId}`);
    const status = db?.properties?.["Schedule"];
    const opts = status?.select?.options || status?.status?.options || [];
    const match = opts.find((o: any) => /done|complete|finish/i.test(o.name || ""));
    if (!match) throw new Error("No 'Done' status option found. Set the Done status value in Focus Log settings.");
    this.doneStatusCache = match.name;
    return match.name;
  }

  // Set a task page's Schedule select to the resolved done value (Done moved to Schedule).
  // Also reads and returns the PREVIOUS Schedule, so the panel's "Done today" pile can put
  // the exact value back when the user un-finishes the task.
  async setTaskDone(pageId: string): Promise<{ name: string; prev: string | null }> {
    const name = await this.resolveDoneStatus();
    let prev: string | null = null;
    try { const page = await this.notionFetch(`/pages/${pageId}`); prev = selectName(page, "Schedule"); } catch (e) {}
    await this.notionFetch(`/pages/${pageId}`, "PATCH", { properties: { Schedule: { select: { name } } } });
    return { name, prev };
  }

  // Un-finish: put the task's Schedule back (its pre-done value, else 🌻 Today).
  async restoreTask(pageId: string, schedule?: string | null): Promise<void> {
    await this.notionFetch(`/pages/${pageId}`, "PATCH", { properties: { Schedule: { select: { name: schedule || "\u{1F33B} Today" } } } });
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
    if (counterStatus === "ambiguous") new Notice("Focus Log: the counter prefix matches more than one line - counter not updated.");
  }

  // The catch-up can rename a logged pomodoro after the fact; the daily note follows. The
  // old block is rebuilt exactly as appendToDailyNote wrote it and swapped for the new one.
  // If the note was edited by hand meanwhile the block won't match, nothing is touched, and
  // the caller is told so it can say the line was left alone.
  async renameInDailyNote(p: { ts: number; minutes: number; oldTask: string; newTask: string; hierarchy: string; note: string; category?: string | null }): Promise<boolean> {
    const s = this.data.settings;
    if (!s.dailyNoteWrite) return false;
    try {
      const moment = (window as any).moment;
      if (!moment) return false;
      const trueDate = new Date(p.ts);
      const fileDate = s.dailyNoteTrueDate ? trueDate : new Date(p.ts - dayShiftHours(s.dayStart) * 3600000);
      const fileM = moment(new Date(fileDate.getFullYear(), fileDate.getMonth(), fileDate.getDate()));
      const dn: any = (this.app as any).internalPlugins?.getPluginById?.("daily-notes");
      const opts = dn?.instance?.options || {};
      const format = (s.dailyTitleFormat || opts.format || "YYYY-MM-DD").trim();
      const folder = (s.dailyNoteFolder || opts.folder || "").trim();
      const path = normalizePath((folder ? folder + "/" : "") + fileM.format(format) + ".md");
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return false;
      const dateM = moment(new Date(trueDate.getFullYear(), trueDate.getMonth(), trueDate.getDate()));
      const pad = (n: number) => String(n).padStart(2, "0");
      const startT = new Date(p.ts - (p.minutes || 25) * 60000);
      const endT = new Date(p.ts);
      const hier = p.hierarchy ? " (" + p.hierarchy + ")" : "";
      const slug = (s.writeCategoryTag !== false && p.category) ? tagSlug(p.category) : "";
      const ns = (s.tagNamespace || "").trim();
      const tag = slug ? "#" + (ns ? ns + "/" : "") + slug : "";
      const mk = (task: string) => (s.dailyTemplate || "")
        .replace(/\{date\}/g, dateM.format("YYYY-MM-DD"))
        .replace(/\{start\}/g, pad(startT.getHours()) + ":" + pad(startT.getMinutes()))
        .replace(/\{end\}/g, pad(endT.getHours()) + ":" + pad(endT.getMinutes()))
        .replace(/\{task\}/g, task || "")
        .replace(/\{hierarchy\}/g, hier)
        .replace(/\{tag\}/g, tag)
        .replace(/\{note\}/g, p.note || "");
      const oldBlock = mk(p.oldTask);
      const newBlock = mk(p.newTask);
      let done = false;
      await this.app.vault.process(file, (data: string) => {
        if (data.includes(oldBlock)) { done = true; return data.replace(oldBlock, newBlock); }
        return data;
      });
      return done;
    } catch (e) { return false; }
  }

  // Open the daily note FILE for a calendar date (clicked in the Status month view). Resolves the
  // path with the same folder/format logic as appendToDailyNote, creates it if missing (only when
  // "Create new daily note if missing" is on), and opens it in the MAIN editor area rather than the
  // right-sidebar leaf the panel lives in (so the click never replaces the panel itself).
  // The daily note file for the calendar date of ts (same name format and folder that
  // openDailyNoteForDate uses), or null — drives the calendar's two-brown date numbers + day menu.
  dailyNoteFileFor(ts: number): TFile | null {
    try {
      const s = this.data.settings;
      const moment = (window as any).moment;
      if (!moment) return null;
      const d = new Date(ts);
      const m = moment(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      const dn: any = (this.app as any).internalPlugins?.getPluginById?.("daily-notes");
      const opts = dn?.instance?.options || {};
      const format = (s.dailyTitleFormat || opts.format || "YYYY-MM-DD").trim();
      const folder = (s.dailyNoteFolder || opts.folder || "").trim();
      const path = normalizePath((folder ? folder + "/" : "") + m.format(format) + ".md");
      const f = this.app.vault.getAbstractFileByPath(path);
      return f instanceof TFile ? f : null;
    } catch (e) { return null; }
  }
  dailyNoteExists(ts: number): boolean { return !!this.dailyNoteFileFor(ts); }
  // Right-click menu for a calendar day: file actions when its daily note exists, plus the
  // caller-supplied work/relax flip. Delete goes to the trash (recoverable), like the file menu.
  openDayMenu(ts: number, ev: MouseEvent, extra?: { flipLabel?: string; onFlip?: () => void }) {
    const menu = new Menu();
    const file = this.dailyNoteFileFor(ts);
    if (file) {
      menu.addItem((i: any) => i.setTitle("Reveal in Finder").setIcon("folder-open").onClick(() => {
        try { (this.app as any).showInFolder(file.path); } catch (e) { new Notice("Focus Log: cannot reveal in the system explorer."); }
      }));
      menu.addItem((i: any) => i.setTitle("Reveal in Obsidian files").setIcon("folder-tree").onClick(() => {
        try {
          const fe: any = (this.app as any).internalPlugins?.getEnabledPluginById?.("file-explorer");
          if (fe && fe.revealInFolder) fe.revealInFolder(file); else new Notice("Focus Log: the core Files plugin is not enabled.");
        } catch (e) {}
      }));
      menu.addSeparator();
      menu.addItem((i: any) => i.setTitle("Delete daily note").setIcon("trash").onClick(async () => {
        try {
          const fm: any = this.app.fileManager as any;
          if (fm.trashFile) await fm.trashFile(file); else await this.app.vault.trash(file, true);
          new Notice("Deleted " + file.basename + ".");
        } catch (e) { new Notice("Focus Log: could not delete the note."); }
      }));
      menu.addSeparator();
    }
    if (extra && extra.onFlip) menu.addItem((i: any) => i.setTitle(extra.flipLabel || "Flip work/relax").setIcon("repeat").onClick(() => extra.onFlip && extra.onFlip()));
    menu.showAtMouseEvent(ev);
  }

  async openDailyNoteForDate(ts: number) {
    const s = this.data.settings;
    const moment = (window as any).moment;
    if (!moment) { new Notice("Focus Log: moment unavailable, cannot open the daily note."); return; }
    const d = new Date(ts);
    const m = moment(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    const dn: any = (this.app as any).internalPlugins?.getPluginById?.("daily-notes");
    const opts = dn?.instance?.options || {};
    const format = (s.dailyTitleFormat || opts.format || "YYYY-MM-DD").trim();
    const folder = (s.dailyNoteFolder || opts.folder || "").trim();
    const path = normalizePath((folder ? folder + "/" : "") + m.format(format) + ".md");
    let file = this.app.vault.getAbstractFileByPath(path) as TFile;
    if (!file) {
      if (!s.createDailyIfMissing) {
        new Notice("Focus Log: no daily note for " + m.format(format) + ". Enable “Create new daily note if missing” to make one.");
        return;
      }
      if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder).catch(() => {});
      file = await this.app.vault.create(path, await this.buildDailyNoteContent(m, format, opts.template));
    }
    // Same pattern as the community Calendar plugin: getUnpinnedLeaf() always resolves to a usable
    // leaf in the MAIN area — the open note if there is one (jump), else the empty "New tab" leaf,
    // creating one when the window is empty — and never targets the sidebar tab group the click came
    // from (getLeaf("tab") did, which is why an empty window needed several clicks).
    const ws: any = this.app.workspace;
    const leaf = ws.getUnpinnedLeaf ? ws.getUnpinnedLeaf() : ws.getLeaf(false);
    await leaf.openFile(file, { active: true });
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

  // Add one "+ 🍅" re-estimate round to a task's Guess multi-select. The caller enforces the
  // two-round cap in the UI; this re-checks against Notion's current value to be safe.
  async addGuessRound(pageId: string, count = 1): Promise<number> {
    const page = await this.notionFetch(`/pages/${pageId}`);
    const ms = (page?.properties?.["Guess"]?.multi_select || []).map((o: any) => o.name);
    const rounds = ms.filter((n: string) => (n || "").trim().startsWith("+")).length;
    if (rounds >= 2) throw new Error("Two extra rounds already: split the task.");
    const optName = count >= 4 ? "+ \u{1F4E6}" : "+ " + "\u{1F345}".repeat(Math.max(1, Math.min(3, count)));
    const next = [...ms, optName];
    await this.notionFetch(`/pages/${pageId}`, "PATCH", { properties: { Guess: { multi_select: next.map((name: string) => ({ name })) } } });
    return rounds + 1;
  }

  // Write a calibration entry to the daily note under its own "Calibration" heading:
  // time, task, parents, guess vs spend, the reason chip and the optional note.
  async appendCalibrationToDailyNote(e: { ts: number; task: string; hierarchy?: string; guess: number; spend: number; direction: string; reason: string; note?: string }) {
    const s = this.data.settings;
    if (!s.dailyNoteWrite) return;
    const moment = (window as any).moment;
    if (!moment) throw new Error("moment unavailable");
    const fileDate = s.dailyNoteTrueDate ? new Date(e.ts) : new Date(e.ts - dayShiftHours(s.dayStart) * 3600000);
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
    const d = new Date(e.ts);
    const line = `- ${pad(d.getHours())}:${pad(d.getMinutes())} **${e.task}**${e.hierarchy ? " (" + e.hierarchy + ")" : ""} · guess ${e.guess} → spend ${e.spend} · ${e.reason}${e.note ? ": " + e.note : ""}`;
    await this.app.vault.process(file, (data: string) => insertUnderHeading(data, this.data.settings.calibrationHeading || "Calibration", line, true));
  }

  // ---------- restart → urge-surf countdown ----------
  // Owned by the core so BOTH surfaces mirror ONE state: the float shows the countdown on its
  // own face (where the eyes are), the panel shows its overlay, cancel anywhere cancels both.
  // Deadline-based (not tick-decrement) so the main window's background throttling can't
  // stretch the five seconds — the float's unthrottled 500ms poll drives expiry when hidden.
  surfCountdown: { deadline: number; task: string; lastLeft: number } | null = null;
  private rcTimer: number | null = null;
  surfCountCb: ((st: { left: number; task: string } | null) => void) | null = null;
  surfGoCb: ((task: string) => void) | null = null;
  beginSurfCountdown(task: string) {
    this.clearRc();
    this.surfCountdown = { deadline: Date.now() + 5000, task: task || "", lastLeft: 5 };
    this.emitRc();
    this.rcTimer = window.setInterval(() => this.pollSurfCountdown(), 250);
  }
  cancelSurfCountdown() { this.clearRc(); this.emitRc(); }
  private clearRc() {
    if (this.rcTimer != null) { window.clearInterval(this.rcTimer); this.rcTimer = null; }
    this.surfCountdown = null;
  }
  private emitRc() {
    const rc = this.surfCountdown;
    if (this.surfCountCb) try { this.surfCountCb(rc ? { left: rc.lastLeft, task: rc.task } : null); } catch (e) {}
  }
  pollSurfCountdown() {
    const rc = this.surfCountdown;
    if (!rc) return;
    const left = Math.ceil((rc.deadline - Date.now()) / 1000);
    if (left <= 0) {
      const task = rc.task;
      this.clearRc();
      this.emitRc();
      // Best-effort: bring the main window forward and reveal the panel, then hand the panel
      // the task so the surf opens over it. If the panel view is closed, nothing to reveal.
      try {
        window.focus();
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        if (leaves.length) this.app.workspace.revealLeaf(leaves[0]);
      } catch (e) {}
      if (this.surfGoCb) try { this.surfGoCb(task); } catch (e) {}
      return;
    }
    if (left !== rc.lastLeft) { rc.lastLeft = left; this.emitRc(); }
  }

  // ---------- urge surfing ----------
  // A 90-second wave, core-owned like the restart countdown: press the wave button when the
  // itch to switch hits; the pomodoro keeps running. Outlast the wave and a surfed urge is
  // recorded (humble count in Stats). Pausing or resetting mid-wave cancels it silently: the
  // pause + tag flow already records that story, and no judgment is attached either way.
  urgeWave: { deadline: number; task: string; lastLeft: number } | null = null;
  private uwTimer: number | null = null;
  urgeWaveCb: ((st: { left: number } | null) => void) | null = null;
  urgeSurfedCb: ((arr: any[]) => void) | null = null;
  beginUrgeWave() {
    if (this.urgeWave) { this.cancelUrgeWave(); return; }   // second press = changed my mind
    const st = this.timer.getState();
    if (!st.running) return;
    this.urgeWave = { deadline: Date.now() + 90000, task: st.taskName || "", lastLeft: 90 };
    this.emitUw();
    this.uwTimer = window.setInterval(() => this.pollUrgeWave(), 250);
  }
  cancelUrgeWave() { this.clearUw(); this.emitUw(); }
  private clearUw() {
    if (this.uwTimer != null) { window.clearInterval(this.uwTimer); this.uwTimer = null; }
    this.urgeWave = null;
  }
  private emitUw() {
    const w = this.urgeWave;
    if (this.urgeWaveCb) try { this.urgeWaveCb(w ? { left: w.lastLeft } : null); } catch (e) {}
  }
  pollUrgeWave() {
    const w = this.urgeWave;
    if (!w) return;
    const st = this.timer.getState();
    if (!st.running) { this.cancelUrgeWave(); return; }
    const left = Math.ceil((w.deadline - Date.now()) / 1000);
    if (left <= 0) {
      const task = w.task;
      this.clearUw();
      this.emitUw();
      this.data.urgesSurfed = [...(this.data.urgesSurfed || []), { ts: Date.now(), task }];
      this.persist();
      new Notice("\u{1F30A} Surfed. The wave passed; you're still here.", 4000);
      if (this.urgeSurfedCb) try { this.urgeSurfedCb(this.data.urgesSurfed); } catch (e) {}
      return;
    }
    if (left !== w.lastLeft) { w.lastLeft = left; this.emitUw(); }
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
        calibrations: self.data.calibrations || [],
        areaOptions: self.data.areaOptions || [],
        quickParents: self.data.quickParents || [],
        doneToday: self.data.doneToday || [],
        urgesSurfed: self.data.urgesSurfed || [],
        feelings: self.data.feelings || {},
        morningRoutine: self.data.morningRoutine || [],
        nightRoutine: self.data.nightRoutine || [],
        relaxMorningRoutine: self.data.relaxMorningRoutine || [],
        relaxNightRoutine: self.data.relaxNightRoutine || [],
        routineDone: self.data.routineDone || {},
        modeOverride: self.data.modeOverride || {},
        plans: self.data.plans || {},
      }),
      saveSessions: async (arr: any[]) => { self.data.sessions = arr; await self.persist(); },
      saveActivities: async (arr: any[]) => { self.data.activities = arr; await self.persist(); },
      savePauseTags: async (arr: any[]) => { self.data.pauseTags = arr; await self.persist(); },
      savePauses: async (arr: any[]) => { self.data.pauses = arr; await self.persist(); },
      saveBreaks: async (arr: any[]) => { self.data.breaks = arr; await self.persist(); },
      saveCalibrations: async (arr: any[]) => { self.data.calibrations = arr; await self.persist(); },
      addGuessRound: (pageId: string, count?: number) => self.addGuessRound(pageId, count),
      appendCalibration: (e: any) => self.appendCalibrationToDailyNote(e),
      saveFeelings: async (obj: any) => { self.data.feelings = obj; await self.persist(); },
      saveMorningRoutine: async (arr: any[]) => { self.data.morningRoutine = arr; await self.persist(); },
      saveNightRoutine: async (arr: any[]) => { self.data.nightRoutine = arr; await self.persist(); },
      saveRelaxMorningRoutine: async (arr: any[]) => { self.data.relaxMorningRoutine = arr; await self.persist(); },
      saveRelaxNightRoutine: async (arr: any[]) => { self.data.relaxNightRoutine = arr; await self.persist(); },
      saveRoutineDone: async (obj: any) => { self.data.routineDone = obj; await self.persist(); },
      saveModeOverride: async (obj: any) => { self.data.modeOverride = obj; await self.persist(); },
      savePlan: async (dayKey: string, blocks: any[]) => { self.data.plans = { ...(self.data.plans || {}), [dayKey]: blocks }; await self.persist(); },
      appendPause: (p: any) => self.appendPauseToDailyNote(p),
      savePending: async (arr: any[]) => { self.data.pending = arr; await self.persist(); },
      saveTasks: async (arr: any[]) => { self.data.tasks = arr; await self.persist(); },
      patchSettings: async (partial: Partial<FocusLogSettings>) => { self.data.settings = Object.assign({}, self.data.settings, partial); await self.persist(); },
      sync: () => self.queryToday(),
      createTask: (name: string, parentId?: string | null, guess?: number, status?: string) => self.createTask(name, parentId, guess, status),
      beginSurfCountdown: (task: string) => self.beginSurfCountdown(task),
      cancelSurfCountdown: () => self.cancelSurfCountdown(),
      onSurfCount: (cb: (st: { left: number; task: string } | null) => void) => { self.surfCountCb = cb; },
      onSurfGo: (cb: (task: string) => void) => { self.surfGoCb = cb; },
      beginUrgeWave: () => self.beginUrgeWave(),
      onUrgeWave: (cb: (st: { left: number } | null) => void) => { self.urgeWaveCb = cb; },
      onUrgeSurfed: (cb: (arr: any[]) => void) => { self.urgeSurfedCb = cb; },
      getQuickParents: () => self.data.quickParents || [],
      writeAct: (pageId: string) => self.incrementAct(pageId),
      writeActBy: (pageId: string, n: number) => self.incrementActBy(pageId, n),
      setDone: (pageId: string) => self.setTaskDone(pageId),
      restoreTask: (pageId: string, schedule?: string | null) => self.restoreTask(pageId, schedule),
      saveDoneToday: async (arr: any[]) => { self.data.doneToday = arr; await self.persist(); },
      saveUrges: async (arr: any[]) => { self.data.urgesSurfed = arr; await self.persist(); },
      appendDaily: (p: any) => self.appendToDailyNote(p),
      renameDaily: (p: any) => self.renameInDailyNote(p),
      openDailyNote: (ts: number) => self.openDailyNoteForDate(ts),
      hasDailyNote: (ts: number) => self.dailyNoteExists(ts),
      openDayMenu: (ts: number, ev: MouseEvent, extra?: any) => self.openDayMenu(ts, ev, extra),
      notify: (msg: string, duration?: number) => new Notice(msg, duration),
      // A notice you can left-click to run an action (e.g. jump to the Sky). Stays up ~9s.
      notifyClickable: (msg: string, onClick: () => void) => {
        const n = new Notice(msg, 9000);
        try {
          n.noticeEl.style.cursor = "default";   // plain-arrow preference; the notice text itself says it's clickable
          n.noticeEl.addEventListener("click", () => { try { onClick(); } catch (e) {} n.hide(); });
        } catch (e) {}
      },
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
        startBreak: (mins?: number) => self.timer.startBreak(mins),
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
      onRequestSkyView: (fn: () => void) => self.onRequestSkyView(fn),
      getActiveDaily: () => self.getActiveDaily(),
      onActiveDaily: (fn: (ts: number | null) => void) => self.onActiveDaily(fn),
      // The gear in the panel's corner: jump straight to this plugin's settings tab.
      openSettings: () => { try { const s = (self.app as any).setting; s.open(); s.openTabById("focuslog"); } catch (e) {} },
      openFloating: () => self.openFloating(),
      closeFloating: () => self.closeFloating(),
      toggleFloating: () => self.toggleFloating(),
      floatingOpen: () => self.isFloatingOpen(),
      onFloatChange: (fn: () => void) => self.onFloatChange(fn),
      getNoise: () => ({ focus: self.data.settings.noiseFocus || "off", break: self.data.settings.noiseBreak || "off", volume: self.data.settings.noiseVolume ?? 40 }),
      setNoise: (phase: "focus" | "break", v: NoiseChoice) => self.setNoisePref(phase, v),
      onNoiseChange: (fn: () => void) => self.onNoiseChange(fn),
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
  private tickWin: any = null;   // the window that owns localTick (interval ids are per-window, so clearing needs the right one)
  // Idempotent: applies the popout body tag (headers hidden + drag region) once the view
  // actually lives in a separate window; a no-op while it is still in the main document.
  private tagFloatWindow() {
    try {
      const doc = this.contentEl.ownerDocument;
      if (doc && doc !== document) {
        const w = doc.defaultView || this.fwin;
        const changed = w && w !== this.fwin;
        this.fwin = w || this.fwin;
        doc.body.classList.add("focuslog-float-window");
        // The 500ms tick must live in the popout (main-window timers throttle when it is
        // hidden). If it was created before the view was adopted into the popout, migrate
        // it — an interval left on the MAIN window would outlive the popout's close (ids
        // are per-window, so onClose's clear would miss it) and keep driving the window
        // geometry as a zombie, fighting the live float in a fast two-position battle.
        if (changed && this.localTick) {
          try { (this.tickWin || window).clearInterval(this.localTick); } catch {}
          this.tickWin = this.fwin;
          this.localTick = this.fwin.setInterval(() => { this.tagFloatWindow(); this.plugin.timer.poll(); this.render(); this.maybeSaveBounds(); }, 200);
        }
      }
    } catch {}
  }
  private lastIcon = ""; // avoid re-rendering the play/pause svg every tick
  private lastNoiseKey = ""; // avoid churning the noise picker's classes every tick
  private lastBrkIcon = ""; // break toggle (pause/play) icon, re-set only on change
  private lastEndIcon = ""; // break end (check/next) icon, re-set only on change
  private pickerShown = false; // whether the pause reason picker is currently expanded
  private pkey = "";           // chips rebuild only when this (tag list / selection) changes
  private boundsKey = "";      // last seen window geometry (to detect user move/resize)
  private boundsDirty = false; // geometry changed; save once it settles
  private celebrateShown = false; // celebration overlay up → the "celebrate" size phase
  private revealUntil = 0;   // star-reveal deadline (self-expiring, so a died timer can never wedge the overlay open)
  private curPhase = "";       // "setup" | "focus" | "break" — which screen of the loop is showing
  private skey = "";           // setup task-picker rebuilds only when the task list / selection changes
  private sawRun = false;       // seen a genuinely-live run in THIS window's lifetime (so a paused pomodoro left over from a restart/reopen isn't shown)
  private bkey = "";           // break activity chips rebuild only when the list / picked set changes
  private fwin: any = null; // this popout's own window object (its timers aren't throttled while it's visible)
  constructor(leaf: WorkspaceLeaf, plugin: FocusLogPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_TYPE_FLOAT; }
  getDisplayText() { return "Focus timer"; }
  getIcon() { return "timer"; }
  // Whether a genuinely-live run has been seen in this window's lifetime (used by the plugin's
  // phase sizing so a paused-from-before pomodoro is sized as setup, matching what we render).
  hasSeenRun() { return this.sawRun; }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("focuslog-float");
    this.fwin = (root as any).win || window;
    // Tag this popout's window so the CSS can hide its tab bar + view header AND enable
    // the drag region — the body class also carries -webkit-app-region: drag, so without
    // it the frameless window cannot be MOVED at all. The view can be adopted into the
    // popout document well after onOpen when the popout is created slowly (e.g. auto-
    // opened on timer start), so fixed-delay retries are not enough: the 500ms tick below
    // keeps re-checking until the tag lands. Never tags the main document.
    this.tagFloatWindow();
    setTimeout(() => this.tagFloatWindow(), 0);
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
    this.els.minus = row.createEl("button", { cls: "flt-btn flt-step" });
    this.els.minus.innerHTML = FLT_MINUS;
    this.els.primary = row.createEl("button", { cls: "flt-btn flt-primary" });
    this.els.plus = row.createEl("button", { cls: "flt-btn flt-step" });
    this.els.plus.innerHTML = FLT_PLUS;
    this.els.reset = row.createEl("button", { cls: "flt-btn flt-icon" });
    this.els.reset.innerHTML = FLT_ROTATE_LEFT;
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
      // Rhythm first, feeling always: the task link is optional (a free pomodoro starts
      // unnamed and can be named in the panel mid-run), but the expected rating is required
      // before EVERY fresh start.
      if (!st.paused && !(st.expected >= 1)) { this.flash("Rate it first."); return; }
      this.plugin.timer.start();
    };
    this.els.reset.onclick = () => {
      // Restarting a LIVE pomodoro opens the restart→surf countdown on this float's own
      // face (the surface being looked at); an idle reset stays a plain reset.
      const st = this.plugin.timer.getState();
      const live = st.running || st.paused;
      const tname = st.taskName || "";
      this.plugin.timer.reset();
      if (live) this.plugin.beginSurfCountdown(tname);
    };
    this.els.urge = row.createEl("button", { cls: "flt-btn flt-icon flt-urge" });
    this.els.urge.innerHTML = SEA_WAVE_SVG;
    this.els.urge.setAttribute("aria-label", "urge to switch? surf it: 90 quiet seconds, no questions; outlasting it is counted");
    this.els.urge.onclick = () => this.plugin.beginUrgeWave();
    // Background-noise picker, top right: rests as the active choice; hover opens all
    // three. It edits the choice for whatever phase the float is showing.
    this.els.noise = wrap.createDiv({ cls: "flt-noise" });
    const mkNoise = (cls: string, svg: string, val: NoiseChoice, label: string) => {
      const b = this.els.noise.createEl("button", { cls: "flt-noise-opt " + cls });
      b.innerHTML = svg;
      b.setAttribute("aria-label", label);
      b.onclick = () => { this.plugin.setNoisePref(this.plugin.timer.getState().breakActive ? "break" : "focus", val); };
      return b;
    };
    this.els.noiseMute = mkNoise("flt-noise-mute", FLT_NOISE_MUTE, "off", "background noise: muted");
    this.els.noiseWhite = mkNoise("flt-noise-white", FLT_NOISE_WAVE, "white", "background noise: white noise");
    this.els.noisePink = mkNoise("flt-noise-pink", FLT_NOISE_WAVE, "pink", "background noise: pink noise");
    this.els.noiseBrown = mkNoise("flt-noise-brown", FLT_NOISE_WAVE, "brown", "background noise: brown noise");
    // The countdown face: covers the whole float, making everything beneath unclickable.
    this.els.rcWrap = wrap.createDiv({ cls: "flt-rc" });
    this.els.rcWrap.createDiv({ cls: "flt-rc-title", text: "Off to the wave in" });
    this.els.rcNum = this.els.rcWrap.createDiv({ cls: "flt-rc-num" });
    this.els.rcCancel = this.els.rcWrap.createEl("button", { cls: "flt-btn flt-rc-cancel", text: "cancel, keep this task" });
    this.els.rcCancel.onclick = () => this.plugin.cancelSurfCountdown();

    this.unsub = this.plugin.timer.subscribe(() => this.render());
    this.render();

    // Drive the engine from THIS window's timeline. Because this popout stays
    // visible (always-on-top), its timers keep firing at full rate even when the
    // main Obsidian window is hidden and throttled — so the countdown never stalls.
    // tickWin remembers which window owns the interval (ids are per-window), so it can
    // always be cleared; tagFloatWindow migrates it into the popout once adopted.
    this.tickWin = this.fwin;
    this.localTick = this.fwin.setInterval(() => { this.tagFloatWindow(); this.plugin.timer.poll(); this.render(); this.maybeSaveBounds(); }, 200);
    this.plugin.notifyFloatChange();
  }

  // The closed loop has three screens: setup (pick task + rate, idle), focus (the
  // countdown, running/paused/finished), and break (the rest timer + activities).
  private phaseOf(s: TimerState): string {
    if (s.breakActive) return "break";
    if (!s.running && !s.paused && s.startedAt == null) return "setup";
    // A pomodoro left paused before a restart/reopen survives on the shared engine, but it must
    // not carry its task into a freshly opened float — until we've seen it run live this lifetime,
    // a paused (and not running) engine falls back to the setup picker showing "— pick a task —".
    if (!s.running && !this.sawRun && !s.adopted) return "setup";
    return "focus";
  }

  render() {
    // The restart→surf countdown owns the float while active: poll it (this float's own
    // unthrottled tick drives expiry when the main window sleeps), mirror it, skip the rest.
    this.plugin.pollSurfCountdown();
    this.plugin.pollUrgeWave();
    const rc = this.plugin.surfCountdown;
    if (this.els.rcWrap) {
      this.els.rcWrap.toggleClass("is-on", !!rc);
      if (rc && this.els.rcNum) this.els.rcNum.setText(String(Math.max(1, rc.lastLeft)));
    }
    if (rc) return;
    const s = this.plugin.timer.getState();
    if (s.running || s.adopted) this.sawRun = true; // live now, or adopted back from a quit
    if (this.els.noise) {
      // The picker mirrors the choice for the phase on screen (the break pref during a break).
      const cur = s.breakActive ? (this.plugin.data.settings.noiseBreak || "off") : (this.plugin.data.settings.noiseFocus || "off");
      const nkey = (s.breakActive ? "b" : "f") + ":" + cur;
      if (nkey !== this.lastNoiseKey) {
        this.lastNoiseKey = nkey;
        this.els.noiseMute.toggleClass("is-active", cur === "off");
        this.els.noiseWhite.toggleClass("is-active", cur === "white");
        this.els.noisePink.toggleClass("is-active", cur === "pink");
        this.els.noiseBrown.toggleClass("is-active", cur === "brown");
      }
    }
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
      const totalS = (s.lengthMin || 25) * 60;
      const alertRed = s.running && s.secs > 0 && (s.secs <= 60 || [900, 600, 300].some((mk: number) => totalS > mk && s.secs <= mk && s.secs >= mk - 2));
      this.els.time.toggleClass("is-alert", alertRed);
      this.els.task.setText(s.taskName || "Focus");
      const wantIcon = s.running ? "pause" : "play";
      if (this.lastIcon !== wantIcon) { this.els.primary.innerHTML = wantIcon === "pause" ? FLT_PAUSE : FLT_PLAY; this.lastIcon = wantIcon; }
      // A paused pomodoro left over from a restart/reopen is shown as setup (placeholder), so for
      // the focus-only controls below treat "paused" as false until it's the active focus screen.
      const pausedShown = s.paused && phase === "focus";
      this.els.primary.setAttribute("aria-label", s.running ? "pause" : (pausedShown ? "resume" : "start"));
      this.els.primary.toggleClass("is-running", s.running);
      const locked = s.running || pausedShown; // length is frozen while a pomodoro is active
      this.els.minus.disabled = locked || s.lengthMin <= 5;
      this.els.plus.disabled = locked || s.lengthMin >= 30;

      if (phase === "setup") this.refreshSetup(s);

      // Pause reason picker: show the chips while paused (the "pause" size phase grows the window).
      if (pausedShown !== this.pickerShown) {
        this.pickerShown = pausedShown;
        if (!pausedShown && this.els.picker) { this.els.picker.empty(); this.pkey = ""; }
      }
      if (pausedShown) {
        const pkey = "P:" + s.pauseTag + ":" + ((this.plugin.data.pauseTags || []).length);
        if (this.pkey !== pkey) { this.pkey = pkey; this.buildPicker(s.pauseTag); }
      }
    }

    // The celebration stays until tapped; clear it once a new pomodoro starts, a break
    // begins, or the timer resets.
    if (!(Date.now() < this.revealUntil) && (s.running || s.breakActive || s.startedAt == null) && this.els.celebrate && this.els.celebrate.hasClass("show")) {
      this.els.celebrate.removeClass("show");
      this.els.celebrate.empty();
      this.celebrateShown = false;
    }
    // Size the window to whichever phase is active (setup / focus / pause / break / celebrate).
    // ONLY the view that really lives in a popout may drive the sizing: a stale float leaf
    // left behind in the main window also ticks render(), and with its celebrateShown=false
    // it would fight the live popout's celebrate phase — alternating setBounds every tick,
    // which showed up as the celebration window "shaking" and clobbered its saved bounds.
    // Only the CURRENT float leaf, in a still-open popout, may drive the window geometry.
    // (A view whose popout has closed, or a leftover leaf, must never compete — that fight
    // showed up as the window rapidly flicking between two positions.)
    const liveLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT)[0];
    if (this.fwin !== window && !(this.fwin as any)?.closed && liveLeaf && liveLeaf.view === this) this.plugin.syncFloatPhase(this.celebrateShown);
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
    if (this.els.urge) {
      const w = this.plugin.urgeWave;
      const ts = this.plugin.timer.getState();
      this.els.urge.style.display = (!setup && !brk && ts.running) ? "" : "none";
      this.els.urge.toggleClass("is-on", !!w);
      if (w) this.els.urge.setText(String(Math.max(1, w.lastLeft)));
      else if (!this.els.urge.querySelector("svg")) this.els.urge.innerHTML = SEA_WAVE_SVG;
    }
    this.els.break.style.display = brk ? "" : "none";
  }

  // Switch the window between the small focus size and the larger break size, and
  // (re)build the break DOM on entry.
  onPhaseChange(prev: string, next: string) {
    if (next === "break") { this.buildBreak(); }
    else if (prev === "break") { this.els.break.empty(); this.els.brkTime = null; }
  }

  // ---------- setup screen (pick task + rate before starting) ----------
  refreshSetup(s: TimerState) {
    const tasks = this.plugin.data.tasks || [];
    // Preselect the engine's task when it is a CURRENT pick: either this window has seen a live
    // run, or the engine is idle (startedAt == null) — i.e. the task was just chosen in the panel
    // and no run is in flight, so it must mirror here. Only a leftover run from a restart/reopen
    // (startedAt set but never witnessed live) is dropped, so the selector shows "— pick a task —".
    const setupTask = (this.sawRun || s.startedAt == null) ? (s.taskName || "") : "";
    const skey = "S:" + tasks.map((t: any) => t.task + (t.king ? "K" : "")).join("|") + "::" + setupTask;
    if (this.skey !== skey) {
      this.skey = skey;
      const sel = this.els.setupSel as HTMLSelectElement;
      sel.empty();
      sel.createEl("option", { text: tasks.length ? "Link a task (optional)" : "- no tasks (sync first) -", value: "" });
      tasks.forEach((t: any) => sel.createEl("option", { text: t.task + (t.king ? " \u{1F451}" : ""), value: t.task }));
      sel.value = setupTask;
    }
    if (!this.els.setupRate.childElementCount) this.buildSetupRate();
    (this.els.setupRateBtns || []).forEach((b: any, i: number) => b.toggleClass("is-on", i + 1 === s.expected));
  }
  buildSetupRate() {
    const el = this.els.setupRate;
    el.empty();
    el.createDiv({ cls: "flt-setlabel", text: "how enjoyable do you expect this to be?" });
    const r = el.createDiv({ cls: "flt-rate" });
    this.els.setupRateBtns = RATE_WEATHER.map((w) => {
      const b = r.createEl("button", { cls: "flt-rbtn flt-rbtn-weather" });
      b.style.background = w.bg;
      b.createEl("img", { attr: { src: w.img, alt: "rating " + w.v, draggable: "false" } });
      b.onclick = () => this.plugin.timer.setExpected(w.v);
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
    this.els.brkMinus = ctrls.createEl("button", { cls: "flt-btn flt-step" });
    this.els.brkMinus.innerHTML = FLT_MINUS;
    this.els.brkToggle = ctrls.createEl("button", { cls: "flt-btn flt-brk-toggle flt-icon" });
    this.els.brkPlus = ctrls.createEl("button", { cls: "flt-btn flt-step" });
    this.els.brkPlus.innerHTML = FLT_PLUS;
    this.els.brkEnd = ctrls.createEl("button", { cls: "flt-btn flt-brk-end flt-icon" });
    this.lastBrkIcon = ""; this.lastEndIcon = "";
    this.els.brkMinus.onclick = () => this.plugin.timer.stepBreak(-1);
    this.els.brkPlus.onclick = () => this.plugin.timer.stepBreak(1);
    this.els.brkToggle.onclick = () => this.plugin.timer.toggleBreakRun();
    this.els.brkEnd.onclick = () => this.plugin.timer.endBreak(); // ends + loops back to setup
    this.els.brkLbl = el.createDiv({ cls: "flt-brk-lbl" });
    this.els.brkActs = el.createDiv({ cls: "flt-brk-acts" });
    const feel = el.createDiv({ cls: "flt-brk-feel" });
    feel.createDiv({ cls: "flt-setlabel", text: "how do you feel after this break?" });
    const fr = feel.createDiv({ cls: "flt-rate" });
    this.els.brkFeelBtns = BREAK_SEASONS.map((sn) => {
      const b = fr.createEl("button", { cls: "flt-rbtn flt-rbtn-weather" });
      b.setAttribute("aria-label", sn.name);
      b.createEl("img", { attr: { src: sn.img, alt: sn.name, draggable: "false" } });
      b.onclick = () => this.plugin.timer.setBreakFeeling(sn.v);
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
    this.els.brkToggle.disabled = s.breakFinished;
    const toggleIcon = s.breakRunning ? "pause" : "play";
    if (this.lastBrkIcon !== toggleIcon) { this.els.brkToggle.innerHTML = toggleIcon === "pause" ? FLT_PAUSE : FLT_PLAY; this.lastBrkIcon = toggleIcon; }
    this.els.brkToggle.setAttribute("aria-label", s.breakRunning ? "pause" : "start");
    this.els.brkMinus.disabled = s.breakSecs <= 60;
    this.els.brkPlus.disabled = s.breakSecs >= 30 * 60;
    const endIcon = s.breakFinished ? "arrow-right" : "check";
    if (this.lastEndIcon !== endIcon) { setIcon(this.els.brkEnd, endIcon); this.lastEndIcon = endIcon; }
    this.els.brkEnd.setAttribute("aria-label", s.breakFinished ? "next task" : "end break");
    const acts = this.plugin.data.activities || [];
    const picked = s.breakPicked || [];
    const bkey = "B:" + acts.map((a: any) => a.id).join("|") + "::" + picked.join(",");
    if (this.bkey !== bkey) { this.bkey = bkey; this.buildBreakChips(acts, picked); }
    this.els.brkLbl.setText("pick up to 3 for this break (" + picked.length + "/3):");
    (this.els.brkFeelBtns || []).forEach((b: any, i: number) => b.toggleClass("is-on", i + 1 === s.breakFeeling));
  }
  buildBreakChips(acts: any[], picked: string[]) {
    const el = this.els.brkActs;
    const keepScroll = el.scrollTop; // a pick rebuilds the list — don't jump back to the top
    el.empty();
    if (!acts.length) { el.createDiv({ cls: "flt-brk-empty", text: "No activities yet - add some in the panel's Break tab." }); return; }
    // Rows in the same format as the panel's Break-activities list: a coloured left
    // bar + #area pill + name, tappable to toggle (up to 3). Colours match the panel
    // (each area takes the next macaron colour, keyed by sorted name).
    const areaNames = Array.from(new Set(acts.map((a: any) => a.area || "Other"))).sort();
    const colorOf = (area: string) => MACARON[Math.max(0, areaNames.indexOf(area || "Other")) % MACARON.length];
    acts.forEach((a: any) => {
      const on = picked.includes(a.id);
      const col = colorOf(a.area || "Other");
      const row = el.createDiv({ cls: "flt-brk-row" + (on ? " is-on" : "") });
      row.style.borderLeftColor = col.border;
      if (on) row.style.background = col.fill;
      const pcol = row.createDiv({ cls: "flt-brk-pillcol" });
      const pill = pcol.createSpan({ cls: "flt-brk-pill", text: a.area || "Other" });
      pill.style.background = col.fill;
      pill.style.color = "#2b2723";
      pill.style.border = "1px solid " + col.border;   // thin border, like the Plan form's Area tags
      row.createDiv({ cls: "flt-brk-name", text: (on ? "✓ " : "") + a.name });
      row.onclick = () => this.plugin.timer.toggleBreakPick(a.id);
    });
    el.scrollTop = keepScroll;
  }


  // Persist the window geometry shortly after the user stops moving/resizing it.
  // Skipped while paused or celebrating (the picker/celebration has grown the
  // window — not the real size). The break phase remembers its own larger bounds.
  maybeSaveBounds() {
    try {
      if (this.fwin === window) return;   // a stale main-window leaf must never save float bounds
      if ((this.fwin as any)?.closed) return;   // nor a view whose popout has already closed
      const liveLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_FLOAT)[0];
      if (!liveLeaf || liveLeaf.view !== this) return;   // only the current float leaf saves
      const win = this.plugin.floatWin;
      if (!win || !win.getBounds) return;
      const b = win.getBounds();
      const key = b.x + "," + b.y + "," + b.width + "," + b.height;
      if (key !== this.boundsKey) { this.boundsKey = key; this.boundsDirty = true; return; }
      // Settled — remember this geometry for whichever phase is currently active.
      if (this.boundsDirty) { this.boundsDirty = false; this.plugin.saveFloatPhaseBounds(this.plugin.floatSizePhase, b); }
    } catch {}
  }

  buildPicker(selected: string) {
    const el = this.els.picker;
    if (!el) return;
    const keepScroll = el.scrollTop; // picking a tag rebuilds — preserve scroll position
    el.empty();
    el.createDiv({ cls: "flt-picker-q", text: "Paused - why? Pick a reason." });
    const chips = el.createDiv({ cls: "flt-picker-chips" });
    const tags = this.plugin.data.pauseTags || [];
    if (!tags.length) { chips.createDiv({ cls: "flt-picker-empty", text: "No tags - add some in the Pause tab." }); return; }
    tags.forEach((t: any) => {
      const cat = t.category === "external" ? "external" : "internal";
      const on = selected === t.name;
      const chip = chips.createEl("button", { cls: "flt-chip" + (on ? " is-on" : ""), text: (on ? "✓ " : "") + t.name });
      chip.style.background = FLOAT_CAT[cat].fill;
      chip.style.borderColor = FLOAT_CAT[cat].border;
      chip.onclick = () => this.plugin.timer.setPauseTag(on ? "" : t.name);
    });
    el.scrollTop = keepScroll;
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
    this.celebrateShown = true;
    this.plugin.syncFloatPhase(true); // grow to the celebrate size
    const dismiss = () => { el.removeClass("show"); el.empty(); el.onclick = null; this.celebrateShown = false; this.plugin.syncFloatPhase(false); };
    el.createDiv({ cls: "flt-pop", text: "\u{1F389}" });
    el.createDiv({ cls: "flt-clabel", text: "complete" });
    // Decisions first (Done? next task?), then the rating — tapping a number is the final
    // act: it logs straight from here with whatever was chosen above.
    let done = false;
    const opts = el.createDiv({ cls: "flt-copts" });
    const doneLabel = opts.createEl("label", { cls: "flt-donebox" });
    const doneBox = doneLabel.createEl("input"); // empty (unticked) by default
    doneBox.type = "checkbox";
    doneLabel.createSpan({ text: "\u{1F389} Set this task to Done" });
    doneLabel.onclick = (ev: any) => { if (ev && ev.stopPropagation) ev.stopPropagation(); };
    doneBox.onchange = () => { done = doneBox.checked; };
    const sel = opts.createEl("select", { cls: "flt-next" }) as HTMLSelectElement;
    sel.createEl("option", { text: "- next task: decide later -", value: "" });
    (this.plugin.data.tasks || []).forEach((t: any) => { sel.createEl("option", { text: t.task + (t.king ? " \u{1F451}" : ""), value: t.task }); });
    sel.onclick = (ev: any) => { if (ev && ev.stopPropagation) ev.stopPropagation(); };
    el.createDiv({ cls: "flt-cask", text: "how enjoyable was it?" });
    const rate = el.createDiv({ cls: "flt-rate" });
    RATE_WEATHER.forEach((w) => {
      const b = rate.createEl("button", { cls: "flt-rbtn flt-rbtn-weather" });
      b.style.background = w.bg;
      b.createEl("img", { attr: { src: w.img, alt: "rating " + w.v, draggable: "false" } });
      b.onclick = (ev: any) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        const nextTask = sel.value || "";
        // Star reveal, right here in the celebration: star icon + the star's name + a live
        // "closes in Ns" countdown (5 -> 1), then the overlay closes itself and the break takes
        // over. revealUntil keeps the overlay (and its geometry) up — the engine reset would
        // otherwise clear it at once, and the break jump would move the window mid-reveal.
        const starName = newestStarName((this.plugin.data.sessions || []).length + 1);
        this.revealUntil = Date.now() + 5200;
        el.empty();
        if (starName) {
          const line = el.createDiv({ cls: "flt-clabel flt-reveal" });
          line.createEl("img", { cls: "flt-reveal-star", attr: { src: starImg, alt: "", draggable: "false" } });
          line.createSpan({ text: "You lit up " + starName });
        } else {
          el.createDiv({ cls: "flt-clabel", text: "Logged ✓" });
        }
        const hint = el.createDiv({ cls: "flt-cask" });
        let left = 5;
        const paintHint = () => hint.setText((starName ? "find it in the Sky tab in Obsidian · " : "") + "closes in " + left + "s");
        paintHint();
        const w2 = this.fwin || window;
        const iv = w2.setInterval(() => { left = Math.max(1, left - 1); paintHint(); }, 1000);
        this.plugin.quickLog(w.v, done, nextTask, { delayBreakMs: 4800 });
        w2.setTimeout(() => { w2.clearInterval(iv); this.revealUntil = 0; dismiss(); }, 5000);
      };
    });
    el.createDiv({ cls: "flt-chint", text: "Tap a rating to log it" });
    // Explicit controls replace the old tap-anywhere-to-dismiss (which ate clicks meant for
    // moving the window): a quiet link to the full form, and a ✕ that just closes.
    const formBtn = el.createEl("button", { cls: "flt-open-form", text: "open the full form in Obsidian" });
    formBtn.onclick = (ev: any) => { if (ev && ev.stopPropagation) ev.stopPropagation(); dismiss(); this.plugin.focusAndLog(); };
    const closeBtn = el.createEl("button", { cls: "flt-cclose", text: "✕" });
    closeBtn.setAttribute("aria-label", "close the celebration without logging");
    closeBtn.onclick = (ev: any) => { if (ev && ev.stopPropagation) ev.stopPropagation(); dismiss(); };
    const colors = ["#d98324", "#2f6f8f", "#5b8c5a", "#b4533a", "#c9a227"];
    for (let i = 0; i < 24; i++) {
      const piece = el.createSpan({ cls: "fl-piece" });
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 0.4).toFixed(2) + "s";
    }
  }

  async onClose() {
    // Guard every teardown step: when the popout is closing, its window may already
    // be gone, and a throw here could leave a phantom leaf that blocks reopening.
    // The user closing the float means "don't bring it back at launch"; teardown from a
    // quit or plugin reload keeps the flag, so the float returns on its own.
    try { if (!this.plugin.unloading && this.plugin.data.floatWasOpen) { this.plugin.data.floatWasOpen = false; void this.plugin.persist(); } } catch {}
    try { this.unsub?.(); } catch {}
    this.unsub = null;
    // Capture the final geometry so it reopens here next time (to the active phase).
    try {
      const win = this.plugin.floatWin;
      if (win && win.getBounds) this.plugin.saveFloatPhaseBounds(this.plugin.floatSizePhase, win.getBounds());
    } catch {}
    try {
      // Clear the tick on the window that OWNS it (ids are per-window): a clear aimed at the
      // wrong window silently misses, leaving a zombie interval that keeps driving geometry.
      (this.tickWin || this.fwin || window).clearInterval(this.localTick);
      this.tickWin = null;
      const w = this.fwin || window;
      w.clearTimeout(this.flashT);
      w.clearTimeout(this.celebrateT);
    } catch {}
    this.revealUntil = 0;
    this.celebrateShown = false;
    try { this.fwin && this.fwin.document.body.classList.remove("focuslog-float-window"); } catch {}
    try { this.containerEl.ownerDocument.body.classList.remove("focuslog-float-window"); } catch {}
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
    containerEl.createEl("h3", { text: "Focus Log - Notion connection" });

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
      .setDesc("Optional. The exact Schedule option to set when you tick “mark done” while logging. Leave blank to auto-detect an option whose name contains “Done” (e.g. 🎉Done).")
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

    containerEl.createEl("h3", { text: "My day" });

    new Setting(containerEl)
      .setName("Day starts at (HH:MM)")
      .setDesc("The clock time your day rolls over - the end of one day and the start of the next, and the bottom of the Timeline. A morning value like 04:00 keeps late-night work on the previous day (anything up to 03:59 counts as yesterday). An evening value like 22:00 starts a fresh day that night, so a pomodoro after 22:00 counts toward the next date.")
      .addText((t) =>
        t.setPlaceholder("04:00").setValue(fmtHM(this.plugin.data.settings.dayStart)).onChange(async (v) => {
          const n = parseHM(v); if (n == null) return;
          this.plugin.data.settings.dayStart = n;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Morning begins at (HH:MM)")
      .setDesc("When your active day starts - the top of the Timeline. e.g. 08:00, or 08:15.")
      .addText((t) =>
        t.setPlaceholder("08:00").setValue(fmtHM(this.plugin.data.settings.morningBegins)).onChange(async (v) => {
          const n = parseHM(v); if (n == null) return;
          this.plugin.data.settings.morningBegins = n;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Morning routine ends at (HH:MM)")
      .setDesc("Until this time the Morning routine is the Plan list's current phase; after it, Morning drops into \u201Cearlier today\u201D. The day's pomodoro room is also counted from here.")
      .addText((t) =>
        t.setPlaceholder("09:00").setValue(fmtHM(this.plugin.data.settings.morningRoutineEnds)).onChange(async (v) => {
          const n = parseHM(v);
          if (n == null) return;
          this.plugin.data.settings.morningRoutineEnds = n;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Morning ends at (HH:MM)")
      .setDesc("Pomodoros logged before this time are coloured as morning on the heatmap.")
      .addText((t) =>
        t.setPlaceholder("12:00").setValue(fmtHM(this.plugin.data.settings.morningEnd)).onChange(async (v) => {
          const n = parseHM(v); if (n == null) return;
          this.plugin.data.settings.morningEnd = n;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Afternoon ends at (HH:MM)")
      .setDesc("Anything after this time is coloured as evening.")
      .addText((t) =>
        t.setPlaceholder("18:00").setValue(fmtHM(this.plugin.data.settings.afternoonEnd)).onChange(async (v) => {
          const n = parseHM(v); if (n == null) return;
          this.plugin.data.settings.afternoonEnd = n;
          await this.plugin.persist();
        })
      );

    const lunchSet = new Setting(containerEl)
      .setName("Lunch")
      .setDesc("Auto-place a lunch block on the Timeline. Tasks flow around it and it counts as a long rest, so no long break right after.");
    lunchSet.addToggle((t) => t.setValue(this.plugin.data.settings.lunchEnabled).onChange(async (v) => { this.plugin.data.settings.lunchEnabled = v; await this.plugin.persist(); }));
    lunchSet.addText((t) => { t.setPlaceholder("13:30").setValue(fmtHM(this.plugin.data.settings.lunchStart)).onChange(async (v) => { const n = parseHM(v); if (n == null) return; this.plugin.data.settings.lunchStart = n; await this.plugin.persist(); }); t.inputEl.style.width = "5.5em"; });
    lunchSet.controlEl.createEl("span", { text: "HH:MM", attr: { style: "font-size:11px;color:var(--text-muted);margin:0 12px 0 5px" } });
    lunchSet.addText((t) => { t.setPlaceholder("60").setValue(String(this.plugin.data.settings.lunchMinutes)).onChange(async (v) => { const n = parseInt(v, 10); if (!n || n < 5) return; this.plugin.data.settings.lunchMinutes = n; await this.plugin.persist(); }); t.inputEl.style.width = "4em"; });
    lunchSet.controlEl.createEl("span", { text: "min", attr: { style: "font-size:12px;color:var(--text-muted);margin-left:5px" } });

    const dinnerSet = new Setting(containerEl)
      .setName("Dinner")
      .setDesc("Auto-place a dinner block on the Timeline. Same rules as lunch.");
    dinnerSet.addToggle((t) => t.setValue(this.plugin.data.settings.dinnerEnabled).onChange(async (v) => { this.plugin.data.settings.dinnerEnabled = v; await this.plugin.persist(); }));
    dinnerSet.addText((t) => { t.setPlaceholder("17:30").setValue(fmtHM(this.plugin.data.settings.dinnerStart)).onChange(async (v) => { const n = parseHM(v); if (n == null) return; this.plugin.data.settings.dinnerStart = n; await this.plugin.persist(); }); t.inputEl.style.width = "5.5em"; });
    dinnerSet.controlEl.createEl("span", { text: "HH:MM", attr: { style: "font-size:11px;color:var(--text-muted);margin:0 12px 0 5px" } });
    dinnerSet.addText((t) => { t.setPlaceholder("60").setValue(String(this.plugin.data.settings.dinnerMinutes)).onChange(async (v) => { const n = parseInt(v, 10); if (!n || n < 5) return; this.plugin.data.settings.dinnerMinutes = n; await this.plugin.persist(); }); t.inputEl.style.width = "4em"; });

    new Setting(containerEl)
      .setName("Morning routine pomodoros (work day)")
      .setDesc("How many pomodoro sessions the morning routine splits into on work days.")
      .addText((t) => { t.setPlaceholder("2").setValue(String(this.plugin.data.settings.morningRoutinePomos ?? 2)).onChange(async (v) => { const n = parseInt(v, 10); if (!Number.isFinite(n) || n < 1 || n > 8) return; this.plugin.data.settings.morningRoutinePomos = n; await this.plugin.persist(); }); t.inputEl.style.width = "4em"; });

    new Setting(containerEl)
      .setName("Morning routine pomodoros (relax day)")
      .setDesc("How many pomodoro sessions the morning routine splits into on relax days.")
      .addText((t) => { t.setPlaceholder("2").setValue(String(this.plugin.data.settings.relaxMorningRoutinePomos ?? 2)).onChange(async (v) => { const n = parseInt(v, 10); if (!Number.isFinite(n) || n < 1 || n > 8) return; this.plugin.data.settings.relaxMorningRoutinePomos = n; await this.plugin.persist(); }); t.inputEl.style.width = "4em"; });

    new Setting(containerEl)
      .setName("Night routine pomodoros (work day)")
      .setDesc("How many pomodoro sessions the night routine splits into on work days.")
      .addText((t) => { t.setPlaceholder("2").setValue(String(this.plugin.data.settings.nightRoutinePomos ?? 2)).onChange(async (v) => { const n = parseInt(v, 10); if (!Number.isFinite(n) || n < 1 || n > 8) return; this.plugin.data.settings.nightRoutinePomos = n; await this.plugin.persist(); }); t.inputEl.style.width = "4em"; });

    new Setting(containerEl)
      .setName("Night routine pomodoros (relax day)")
      .setDesc("How many pomodoro sessions the night routine splits into on relax days.")
      .addText((t) => { t.setPlaceholder("2").setValue(String(this.plugin.data.settings.relaxNightRoutinePomos ?? 2)).onChange(async (v) => { const n = parseInt(v, 10); if (!Number.isFinite(n) || n < 1 || n > 8) return; this.plugin.data.settings.relaxNightRoutinePomos = n; await this.plugin.persist(); }); t.inputEl.style.width = "4em"; });

    new Setting(containerEl)
      .setName("Night routine starts at (HH:MM)")
      .setDesc("The evening wind-down begins here: Night becomes the Plan list's current phase, and the pomodoro counter stops counting room at this time.")
      .addText((t) =>
        t.setPlaceholder("20:15").setValue(fmtHM(this.plugin.data.settings.nightRoutineStarts)).onChange(async (v) => {
          const n = parseHM(v);
          if (n == null) return;
          this.plugin.data.settings.nightRoutineStarts = n;
          await this.plugin.persist();
        })
      );
    dinnerSet.controlEl.createEl("span", { text: "min", attr: { style: "font-size:12px;color:var(--text-muted);margin-left:5px" } });

    if (!this.plugin.data.settings.workDays) this.plugin.data.settings.workDays = [true, true, true, true, true, true, true];
    const schedSet = new Setting(containerEl)
      .setName("Work and relax days")
      .setDesc("Working days (orange) open the today view in Work mode; rest days (dark green) open in Relax mode with your relax routines. Tap a day to flip it - the switch in the today view overrides just one day.");
    const schedRow = schedSet.infoEl.createDiv();
    schedRow.style.display = "flex"; schedRow.style.gap = "6px"; schedRow.style.flexWrap = "wrap"; schedRow.style.marginTop = "10px";
    ["M", "T", "W", "T", "F", "S", "S"].forEach((lab, i) => {
      const b = schedRow.createEl("button", { text: lab });
      b.style.width = "36px"; b.style.height = "36px"; b.style.borderRadius = "9px"; b.style.border = "none"; b.style.color = "#fff"; b.style.fontWeight = "700"; b.style.fontSize = "14px"; b.style.cursor = "default"; b.style.padding = "0"; b.style.boxShadow = "none";
      const paint = () => { const rest = this.plugin.data.settings.workDays[i] === false; b.style.background = rest ? MODE_COLORS.relax.solid : MODE_COLORS.work.solid; b.setAttribute("aria-label", rest ? "rest day - tap to make it a working day" : "working day - tap to make it a rest day"); };
      paint();
      b.onclick = async () => { const arr = this.plugin.data.settings.workDays.slice(); arr[i] = arr[i] === false; this.plugin.data.settings.workDays = arr; await this.plugin.persist(); paint(); };
    });

    containerEl.createEl("h3", { text: "Focus and breaks" });

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

    new Setting(containerEl)
      .setName("Long break length (minutes)")
      .setDesc("The long break's length in minutes. Used in two places: the Break view's 'long' start button, and the Timeline's auto-fix when it inserts a long rest.")
      .addText((t) =>
        t.setValue(String(this.plugin.data.settings.longBreakMinutes)).onChange(async (v) => {
          const n = Math.max(5, Math.min(120, parseInt(v, 10) || 20));
          this.plugin.data.settings.longBreakMinutes = n;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Urge wave length (minutes)")
      .setDesc("How long the guided urge surf runs before the decide step; 5-10 is a good range. The floating window's quick wave stays 90 seconds.")
      .addText((t) =>
        t.setValue(String(this.plugin.data.settings.urgeSurfMinutes ?? 5)).onChange(async (v) => {
          const n = Math.max(2, Math.min(15, Math.round(Number(v)) || 5));
          this.plugin.data.settings.urgeSurfMinutes = n;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Background noise volume")
      .setDesc("How loud the white, pink or brown noise plays, as a percent. The noise itself is chosen next to the timer - one choice for focus, one for breaks.")
      .addText((t) =>
        t.setValue(String(this.plugin.data.settings.noiseVolume ?? 40)).onChange(async (v) => {
          const n = Math.max(0, Math.min(100, Math.round(Number(v)) || 0));
          this.plugin.data.settings.noiseVolume = n;
          await this.plugin.persist();
          this.plugin.updateNoise();
        })
      );

    containerEl.createEl("h3", { text: "Plan view" });

    new Setting(containerEl)
      .setName("Hide Bonus-If-Done tasks by default")
      .setDesc("Bonus tasks start hidden in the Plan list. The eye on a section header reveals hidden tasks, and each task's own eye can override either way.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.hideBonusByDefault !== false).onChange(async (v) => {
          this.plugin.data.settings.hideBonusByDefault = v;
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

    new Setting(containerEl)
      .setName("Personal areas")
      .setDesc("Comma-separated Areas that belong in the Personal group (e.g. Health, Home). Tasks in these Areas show under Personal instead of Project, including manual tasks added with the Timeline's add-block button, matched by their Area tag. Personal tasks wear the light oat-milk Area tag (Project tags are dark mocha).")
      .addText((t) =>
        t.setPlaceholder("Health, Home")
          .setValue((this.plugin.data.settings.personalAreas || []).join(", "))
          .onChange(async (v) => {
            this.plugin.data.settings.personalAreas = v.split(",").map((s) => s.trim()).filter(Boolean);
            await this.plugin.persist();
          })
      );

    new Setting(containerEl)
      .setName("Skip morning routine")
      .setDesc("Hide the morning routine block at the top of the today view.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.skipMorningRoutine).onChange(async (v) => {
          this.plugin.data.settings.skipMorningRoutine = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Skip night routine")
      .setDesc("Hide the night routine block at the bottom of the today view.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.skipNightRoutine).onChange(async (v) => {
          this.plugin.data.settings.skipNightRoutine = v;
          await this.plugin.persist();
        })
      );



    new Setting(containerEl)
      .setName("Show Area tags on the Timeline")
      .setDesc("Show each task's Notion Area tag on its timeline block - including manual blocks added with the add-block button. Default on.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.showAreaTimeline !== false).onChange(async (v) => {
          this.plugin.data.settings.showAreaTimeline = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Add block button")
      .setDesc("Show the 'add block' button on the Timeline toolbar. A manual block gets a name, an ExecutionPower colour, an Area-style tag, and its own length. Off by default.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.addBlockEnabled === true).onChange(async (v) => {
          this.plugin.data.settings.addBlockEnabled = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Long break every")
      .setDesc("How many pomodoros between long breaks when the Timeline's auto-fix packs your day. Meals and commitments count as rests and restart the count. Also adjustable from the Timeline toolbar.")
      .addDropdown((d) =>
        d.addOption("2", "2 pomodoros").addOption("3", "3 pomodoros").addOption("4", "4 pomodoros")
          .setValue(String(this.plugin.data.settings.longBreakEvery))
          .onChange(async (v) => {
            this.plugin.data.settings.longBreakEvery = parseInt(v, 10) || 3;
            await this.plugin.persist();
          })
      );

    containerEl.createEl("h3", { text: "Floating timer" });

    new Setting(containerEl)
      .setName("Open the floating window when a pomodoro starts")
      .setDesc("A small always-on-top window that shows the countdown over your other apps. You can also toggle it any time from the ribbon clock or the “Toggle floating timer” command. It stays in sync with the panel - start, pause, or reset from either.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.floatOnStart).onChange(async (v) => {
          this.plugin.data.settings.floatOnStart = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Keep it above other apps")
      .setDesc("Pin the floating window on top of every other window. If your Obsidian build doesn't allow this, the window still opens - it just won't stay in front.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.floatAlwaysOnTop).onChange(async (v) => {
          this.plugin.data.settings.floatAlwaysOnTop = v;
          await this.plugin.persist();
        })
      );

    containerEl.createEl("h3", { text: "Status calendar" });

    new Setting(containerEl)
      .setName("Start the week on Sunday")
      .setDesc("Off (default): weeks run Monday–Sunday. On: weeks run Sunday–Saturday. Affects the week view range, the weekly grouping, and the weekday headers on both heatmaps.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.weekStartsSunday).onChange(async (v) => {
          this.plugin.data.settings.weekStartsSunday = v;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Heatmap colour thresholds")
      .setDesc("Six-month heatmap. Give 3 to 6 ascending pomodoro counts (the minimum for each colour band; 0 stays blank). Fewer numbers means fewer bands, still spanning the lightest to the deepest colour. Default \"1,2,4,6,8,10\" colours days as 1 · 2-3 · 4-5 · 6-7 · 8-9 · 10+. Anything other than 3 to 6 rising numbers falls back to the default. The legend under the heatmap shows the resulting ranges.")
      .addText((t) =>
        t.setPlaceholder("1,2,4,6,8,10").setValue(this.plugin.data.settings.heatThresholds).onChange(async (v) => {
          this.plugin.data.settings.heatThresholds = v.trim();
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
      .setClass("fl-fullrow")
      .setName("Block template")
      .setDesc("Placeholders: {date} {start} {end} {task} {hierarchy} {tag} {note}. {hierarchy} expands to \" (ancestor \u00B7 parent)\" when present; {tag} is the category tag configured below.")
      .addTextArea((t) => {
        t.setValue(this.plugin.data.settings.dailyTemplate).onChange(async (v) => {
          this.plugin.data.settings.dailyTemplate = v;
          await this.plugin.persist();
        });
        t.inputEl.rows = 6;
        t.inputEl.style.width = "100%";
      });

    new Setting(containerEl)
      .setClass("fl-fullrow")
      .setName("Pause block template")
      .setDesc("Written to the daily note when you tag a pause. Placeholders: {date} {pomodoro-start} {pause-start} {pause-end} {pomodoro-resume} {pause-tag}. ({pause-end} and {pomodoro-resume} are both the moment you resumed or reset.) Manage pause tags in the panel's Pause tab.")
      .addTextArea((t) => {
        t.setValue(this.plugin.data.settings.pauseTemplate).onChange(async (v) => {
          this.plugin.data.settings.pauseTemplate = v;
          await this.plugin.persist();
        });
        t.inputEl.rows = 5;
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
      .setName("Calibration heading")
      .setDesc("First-level heading (#) the calibration lines append under; created at the end of the note when missing. The leading # is added automatically.")
      .addText((t) =>
        t.setValue(this.plugin.data.settings.calibrationHeading || "Calibration").onChange(async (v) => {
          this.plugin.data.settings.calibrationHeading = v.trim();
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
        t.inputEl.style.width = "22em";
      });

    containerEl.createEl("p", {
      text: "Reopen the Focus Log panel after changing settings here so the panel picks up the new values.",
      cls: "setting-item-description",
    });

  }
}
