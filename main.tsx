import { App, ItemView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, requestUrl } from "obsidian";
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
}

const DEFAULT_SETTINGS: FocusLogSettings = {
  notionToken: "",
  databaseId: "24f3423255b680ce9dd5eb8eeece3ca0", // Pressure to Progress
  dayStart: 4,
  morningEnd: 12,
  afternoonEnd: 18,
  beginColor: "#d98324",
  endColor: "#2f6f8f",
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
  return page?.properties?.[name]?.select?.name || null;
}
function numberProp(page: any, name: string): number {
  const n = page?.properties?.[name]?.number;
  return typeof n === "number" ? n : 0;
}
function tomatoValue(optName: string): number {
  if (!optName) return 0;
  if (optName.includes("\u{1F4E6}\u{1F4E6}")) return 6; // box box
  if (optName.includes("\u{1F4E6}")) return 4; // box
  if (optName.includes("\u{1F3D4}")) return 1; // mountain (unknown size)
  const m = optName.match(/\u{1F345}/gu); // tomatoes
  return m ? m.length : 0;
}
function parsePomodoros(page: any): number {
  for (const field of ["3 Est_T", "2 Est_T", "1 Est_T"]) {
    const ms = page?.properties?.[field]?.multi_select || [];
    if (ms.length) {
      const best = Math.max(...ms.map((o: any) => tomatoValue(o.name)));
      return best > 0 ? best : 1;
    }
  }
  return 1;
}
function mapLoad(name: string | null): string {
  if (!name) return "B";
  const c = name[0];
  return c === "A" || c === "B" || c === "C" ? c : "B";
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
    const d = new Date(Date.now() - (this.data.settings.dayStart || 0) * 3600000);
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
        { property: "Status", select: { equals: "\u{1F3AF} This week" } },
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
      tasks.push({
        task,
        load: mapLoad(selectName(p, "CognitiveLoad")),
        pomodoros: parsePomodoros(p),
        act: numberProp(p, "Act"),
        url: p.url,
        id: p.id,
        group: await this.resolveTopGroup(p, cache),
      });
    }
    this.data.tasks = tasks;
    await this.persist();
    return tasks;
  }

  // Walk Parent item up to the top-level ancestor; group = that title (else own title).
  private async resolveTopGroup(page: any, cache: Record<string, any>): Promise<string> {
    let cur = page;
    let top = plainTitle(cur);
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
      if (pt) top = pt;
      cur = parent;
      guard++;
    }
    return top;
  }

  // Read current Act, then PATCH only that one property (+1).
  async incrementAct(pageId: string): Promise<number> {
    const page = await this.notionFetch(`/pages/${pageId}`);
    const next = numberProp(page, "Act") + 1;
    await this.notionFetch(`/pages/${pageId}`, "PATCH", { properties: { Act: { number: next } } });
    return next;
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
      saveSettings: async (s: FocusLogSettings) => { self.data.settings = Object.assign({}, self.data.settings, s); await self.persist(); },
      sync: () => self.queryToday(),
      writeAct: (pageId: string) => self.incrementAct(pageId),
      notify: (msg: string) => new Notice(msg),
    };
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

    containerEl.createEl("p", {
      text: "Day start, time bands, and rating colors are edited inside the Focus Log panel. Reopen the panel after changing the token.",
      cls: "setting-item-description",
    });
  }
}
