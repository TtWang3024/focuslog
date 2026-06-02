import { App, ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, normalizePath, requestUrl } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import FocusLogApp from "./FocusLogApp";

export const VIEW_TYPE = "focuslog-view";
const NOTION_VERSION = "2022-06-28";

export interface FocusLogSettings {
  notionToken: string;
  databaseId: string;
  dayStart: number;
  morningEnd: number;
  afternoonEnd: number;
  beginColor: string;
  endColor: string;
  dailyNoteWrite: boolean;
  dailyHeading: string;
  dailyCreateHeading: boolean;
  dailyTemplate: string;
}

const DEFAULT_SETTINGS: FocusLogSettings = {
  notionToken: "",
  databaseId: "24f3423255b680ce9dd5eb8eeece3ca0", // Pressure to Progress
  dayStart: 4,
  morningEnd: 12,
  afternoonEnd: 18,
  beginColor: "#d98324",
  endColor: "#2f6f8f",
  dailyNoteWrite: true,
  dailyHeading: "\u{1F33B} Today",
  dailyCreateHeading: true,
  dailyTemplate:
    "- [ ] <mark class=\"hltr-yellow\">{date}</mark> {start} - {end} \u{1F345}\n    - {task}{hierarchy}\n    - {note}",
};

interface PluginData {
  settings: FocusLogSettings;
  sessions: any[];
  pending: any[];
  tasks: any[];
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

export default class FocusLogPlugin extends Plugin {
  data: PluginData;

  async onload() {
    const loaded = (await this.loadData()) || {};
    this.data = {
      settings: Object.assign({}, DEFAULT_SETTINGS, loaded.settings || {}),
      sessions: loaded.sessions || [],
      pending: loaded.pending || [],
      tasks: loaded.tasks || [],
    };

    this.registerView(VIEW_TYPE, (leaf) => new FocusLogView(leaf, this));
    this.addRibbonIcon("timer", "Open Focus Log", () => this.activateView());
    this.addCommand({ id: "open-focus-log", name: "Open Focus Log", callback: () => this.activateView() });
    this.addSettingTab(new FocusLogSettingTab(this.app, this));
  }

  onunload() {}

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
        pomodoros: estTotalOf(p),
        act: numberProp(p, "Act"),
        url: p.url,
        id: p.id,
        parent: h.parent,
        ancestor: h.ancestor,
        group: h.ancestor || task,
      });
    }
    this.data.tasks = tasks;
    await this.persist();
    return tasks;
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

  // Append a formatted block under the configured heading in the (logical) day's daily note.
  async appendToDailyNote(p: { ts: number; minutes: number; task: string; hierarchy: string; note: string }) {
    const s = this.data.settings;
    if (!s.dailyNoteWrite) return;
    const moment = (window as any).moment;
    if (!moment) throw new Error("moment unavailable");
    const ld = new Date(p.ts - dayShiftHours(s.dayStart) * 3600000); // logical day
    const m = moment(new Date(ld.getFullYear(), ld.getMonth(), ld.getDate()));

    const dn: any = (this.app as any).internalPlugins?.getPluginById?.("daily-notes");
    const opts = dn?.instance?.options || {};
    const format = opts.format || "YYYY-MM-DD";
    const folder = (opts.folder || "").trim();
    const path = normalizePath((folder ? folder + "/" : "") + m.format(format) + ".md");

    let file = this.app.vault.getAbstractFileByPath(path) as TFile;
    if (!file) {
      if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder).catch(() => {});
      }
      file = await this.app.vault.create(path, "# " + s.dailyHeading + "\n");
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const startT = new Date(p.ts - (p.minutes || 25) * 60000);
    const endT = new Date(p.ts);
    const hier = p.hierarchy ? " (" + p.hierarchy + ")" : "";
    const block = (s.dailyTemplate || "")
      .replace(/\{date\}/g, m.format("YYYY-MM-DD"))
      .replace(/\{start\}/g, pad(startT.getHours()) + ":" + pad(startT.getMinutes()))
      .replace(/\{end\}/g, pad(endT.getHours()) + ":" + pad(endT.getMinutes()))
      .replace(/\{task\}/g, p.task || "")
      .replace(/\{hierarchy\}/g, hier)
      .replace(/\{note\}/g, p.note || "");

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
      }),
      saveSessions: async (arr: any[]) => { self.data.sessions = arr; await self.persist(); },
      savePending: async (arr: any[]) => { self.data.pending = arr; await self.persist(); },
      saveTasks: async (arr: any[]) => { self.data.tasks = arr; await self.persist(); },
      sync: () => self.queryToday(),
      writeAct: (pageId: string) => self.incrementAct(pageId),
      appendDaily: (p: any) => self.appendToDailyNote(p),
      notify: (msg: string, duration?: number) => new Notice(msg, duration),
      celebrate: () => new CelebrateModal(self.app).open(),
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
  getIcon() { return "timer"; }
  async onOpen() {
    this.root = createRoot(this.contentEl);
    this.root.render(React.createElement(FocusLogApp, { api: this.plugin.makeApi() }));
  }
  async onClose() {
    this.root?.unmount();
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
      .setDesc("On each logged pomodoro, write a block into today's daily note.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.settings.dailyNoteWrite).onChange(async (v) => {
          this.plugin.data.settings.dailyNoteWrite = v;
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
      .setDesc("Placeholders: {date} {start} {end} {task} {hierarchy} {note}. {hierarchy} expands to \" (ancestor \u00B7 parent)\" when present.")
      .addTextArea((t) => {
        t.setValue(this.plugin.data.settings.dailyTemplate).onChange(async (v) => {
          this.plugin.data.settings.dailyTemplate = v;
          await this.plugin.persist();
        });
        t.inputEl.rows = 4;
        t.inputEl.style.width = "100%";
      });

    containerEl.createEl("p", {
      text: "Reopen the Focus Log panel after changing settings here so the panel picks up the new values.",
      cls: "setting-item-description",
    });
  }
}
