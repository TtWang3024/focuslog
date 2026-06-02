# Focus Log — Obsidian plugin

Logs pomodoros against your Notion **⛅ Pressure to Progress** database. Each pomodoro carries two scores, expected resistance before and actual difficulty after, so you can watch the gap (starting is usually less bad than feared). It writes **Act +1** back to the exact task page, collapses recurring work by top-level parent, and shows weekly charts, weekly/monthly/yearly totals, and a weekday-and-time heatmap.

## What it borrows from existing plugins
- One-property write-back, like *obsidian-notion-sync*: logging a pomodoro sends `PATCH /v1/pages/{id}` with only the `Act` number, leaving everything else untouched.
- Server-side filtered reads, like *obsidianotion*: today's tasks come from `POST /v1/databases/{id}/query` with a filter that mirrors your "Today Tasks" view, so filtering happens in Notion before anything reaches Obsidian.

## Install (prebuilt)
1. In your vault, create the folder `<vault>/.obsidian/plugins/focuslog/`.
2. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
3. In Obsidian: Settings → Community plugins → turn off Restricted mode → enable **Focus Log**.

## Connect Notion
1. Create an internal integration at https://www.notion.so/my-integrations and copy its secret (`secret_...` or `ntn_...`).
2. Open the Pressure to Progress database in Notion → top-right menu → **Connections** → add your integration so it can read and update the database.
3. In Obsidian: Settings → Focus Log → paste the token. The database ID is prefilled.
4. Open the panel (timer ribbon icon or the "Open Focus Log" command) and press **sync from Notion**.

All configuration — Notion connection, day start, time bands, rating colours, daily-note template — lives in **Settings → Focus Log**. Reopen the panel after editing settings so it picks up the new values. The rating colours only affect the chart dots; the heatmap colours come from weekday and time band and are independent.

## Editing logs
The timer in the **log** tab keeps running when you switch tabs, so checking the weekly chart mid-pomodoro does not reset it. In the **totals** tab, every logged session has **edit** and **delete** buttons. Editing lets you change the time, task name, and the two ratings; the original quick note is preserved. Deleting only removes the local entry — the `Act +1` already written to Notion is not undone.

## Ordering and finishing tasks
Drag the grip handle on the left of any task in the **today** list to reorder it. The order is saved and carried into the next day: after a sync, tasks you have already ranked keep their position (even if you edited them in Notion), while brand-new tasks appear on top. The **log** form has an optional "set this task's status to Done" checkbox; ticking it sets the page's Status to your Done value when you log. The Done value is auto-detected from the database (the first Status option whose name contains "Done"), or set it explicitly in settings.

## Categories and Obsidian tags
Each task can carry a category (Me / En / Pro / G …) read from a Notion **select** property — name it in settings under *Category property* (default `Area`). The category shows as a chip in the today list, and when a matching `[X]` prefix is present in the title it is hidden to avoid duplication. Put the `{tag}` placeholder in your daily-note template and each logged block gets a real Obsidian tag built from the category: with *Tag namespace* `Notion`, an Area of `En` writes `#Notion/En`, so all of them nest under one parent in the tag pane. Leave the namespace blank for a flat `#En`, or the category property blank to switch the feature off.

## Caveats
- The Notion API has no atomic increment, so Act write-back reads the current value then writes value + 1. With a single user this is safe; avoid editing the same page in two places at the exact same moment.
- The "Today Tasks" filter here is an approximation (Today / King / This week, plus Daily dated today). It does not yet exclude the `🏔️` estimate. Adjust in `queryToday()` if you want an exact match.
- It uses Notion API version `2022-06-28`. If your workspace requires data-source IDs, update the version and endpoints in `src/main.tsx`.
- Desktop only (it makes network requests). Tested by compiling, not inside a live vault, so treat 0.1.0 as a first cut.

## Build from source
```
npm install
npm run build   # outputs main.js
# npm run dev   # watch mode
```
Files: `main.tsx` (plugin entry, Notion client, settings tab, view registration) and `FocusLogApp.tsx` (the React UI). `esbuild.config.mjs` bundles them into `main.js`.
