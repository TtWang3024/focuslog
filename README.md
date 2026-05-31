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

Day start, time bands, and rating colors are edited inside the panel's settings button. The rating colors only affect the chart dots; the heatmap colors are computed from weekday and time band and are independent.

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
Files: `src/main.tsx` (plugin, Notion client, settings, view) and `src/FocusLogApp.tsx` (the React UI).
