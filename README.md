# Focus Log — Obsidian plugin

Logs pomodoros against your Notion **⛅ Pressure to Progress** database. Each pomodoro carries two scores — expected enjoyment *before* and actual enjoyment *after* — so you can watch the gap (starting is usually less bad than feared). It writes **Act +1** back to the exact task page, collapses recurring work by top-level parent, and turns the data into weekly charts, totals, a contributions heatmap, and calibration insights.

On top of the core logger it adds a flexible timer with an optional **always-on-top floating window**, optional breaks with tracked activities, pauses logged with a reason, a daily-note writer, and a per-day pomodoro counter.

## What it borrows from existing plugins
- One-property write-back: logging a pomodoro sends `PATCH /v1/pages/{id}` with only the `Act` number, leaving everything else untouched.
- Server-side filtered reads: today's tasks come from `POST /v1/databases/{id}/query` with a filter that mirrors your "Today Tasks" view, so filtering happens in Notion before anything reaches Obsidian.

## Install (prebuilt)
1. In your vault, create the folder `<vault>/.obsidian/plugins/focuslog/`.
2. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
3. In Obsidian: Settings → Community plugins → turn off Restricted mode → enable **Focus Log**.

## Connect Notion
1. Create an internal integration at https://www.notion.so/my-integrations and copy its secret (`secret_...` or `ntn_...`).
2. Open the Pressure to Progress database in Notion → top-right menu → **Connections** → add your integration so it can read and update the database.
3. In Obsidian: Settings → Focus Log → paste the token. The database ID is prefilled.
4. Open the panel (timer ribbon icon or the "Open Focus Log" command) and press **sync from Notion**.

All configuration lives in **Settings → Focus Log**. Reopen the panel after editing settings so it picks up the new values.

## The panel
A tab bar across the top: **today · week · month · totals · log · break · pause**.

### today
Your synced tasks, newest ranking first. Each row shows a coloured square for **ExecutionPower** (🟥 Must / 🟨 Aim, the default / 🟩 Bonus), a coloured **CognitiveLoad** letter (A high / B medium / C low), the task name, a 👑 for King tasks, and the tomato pips done / remaining. **Drag the grip handle** to reorder; the order is saved and carried into the next day — after a sync, already-ranked tasks keep their place (even if you edited them in Notion) and brand-new tasks float to the top. The header shows `done / goal` where the **goal is click-to-edit** inline. A legend at the top explains the colours.

### log
Start a focus session here. The timer row is `[−] [start Nm] [+] [pause] [reset]`:
- **− / +** adjust the pomodoro length from **5 to 30 minutes** (hold to change quickly); each session records its actual length, and **start** reads *resume* while paused.
- **start** runs the countdown; **pause** asks for a reason (see *Pauses*); **reset** discards the in-progress pomodoro, so it never reaches the totals.
- **floating timer window** — a toggle under the timer pops out a small always-on-top timer (see *Floating timer window* below).

Pick the task (Act +1 writes to that page), rate expected and actual enjoyment, add an optional note, and press **log pomodoro + write Act**. Two toggles sit above the button: **set this task's status to Done in Notion**, and **pick the next task now** (default on) — choose what's next, and after your break the log view reopens already set to it.

### week / month / totals
- **week** — one chart per task group: expected → actual segments, a dashed expectation trend, and average stats. Navigate with ← →.
- **month** — a calendar heatmap; each pomodoro is a dot coloured by weekday × time band.
- **totals** — week/month/year counts and hours; a **6-month contributions heatmap** (weeks as columns, days shaded by count); a **rating summary** ("73% of your pomodoros turned out more enjoyable than you expected (avg gap +0.8)") with your **biggest surprises**; and **best time of day** (average enjoyment per band). Below that, **every session** with **edit** and **delete** (edit covers time, task name, and the two ratings; the note is preserved). Deleting only removes the local entry — the `Act +1` already written to Notion is not undone.

### break
Optional. Turn on **Settings → Break → "Take a break after logging"**, and logging opens this view with a countdown instead of returning to today; choose whether it auto-starts. The break length is adjustable from the popup. Pick **up to 3 activities** to do; on finish it records them and returns to today. Manage activities here (name + an **area** tag; add / **edit** / delete, and **drag to reorder**), and see your **favourites**, **least-chosen**, and a **pie chart of break activity by area**. An **All breaks** list logs each break's start–end time, its activities, and its areas, with edit and delete.

### pause
Manage **pause tags** (add / edit / delete, and **drag to reorder**) and see your pause stats: counts this week and this month, the top tag for each, a by-tag pie, and — per tag, across all history — the **typical time of day** (morning / afternoon / evening). An **All pauses** list logs each pause (time, duration, tag); edit reassigns the tag or fixes the time, and delete removes it.

## Floating timer window
A small **always-on-top** window that shows the countdown over your other apps — drag it to move, drag an edge to resize (the digits scale to fit). It mirrors the panel timer and shares **one clock**, so you can **start, pause, resume, or reset from either** and they stay in sync; the timer keeps running even if the panel is closed.

Turn it on with the **floating timer window** toggle in the *log* tab, the ribbon clock, or the **Toggle floating timer** command. While it's on it stays up across pause/resume and auto-opens when a pomodoro starts. The 15-/5-minute prompts and the finish fire as **system notifications** (so they reach you over any app), and the window itself celebrates when the timer hits zero.

The clock is **wall-clock based**, and while a pomodoro runs the window's background timer throttling is disabled, so the countdown stays smooth and accurate even when Obsidian is hidden behind another app. Settings → Focus Log → **Floating timer** has *Open the floating window when a pomodoro starts* and *Keep it above other apps* — staying on top uses an Electron API, and if your Obsidian build doesn't allow it the window still opens, it just won't pin.

## Pauses
When you click **pause**, the timer stops and a reason picker appears. Choose a tag; when you **resume** (or when you log), a block is written to the daily note from a configurable template. Placeholders: `{date} {pomodoro-start} {pause-start} {pause-end} {pomodoro-resume} {pause-tag}` — `{pause-start}–{pause-end}` is the pause interval, and `{pomodoro-start}` lets you also show the focus-before-pause. An untagged pause just resumes (nothing written); a reset discards it.

## The daily note
With **Append to daily note when logging** on, each logged pomodoro adds a block under your chosen heading. Template placeholders: `{date} {start} {end} {task} {hierarchy} {tag} {note}`.
- **File the block under the true date** chooses which note the block goes into: on → the real date's note; off → the day-start rollover note (an evening pomodoro lands in tomorrow's note). The `{date}` text inside the block is always the true calendar date.
- **Create new daily note if missing** — if that day's note doesn't exist when you log, create it from a template (Focus Log's *Template path*, else your Daily Notes / Periodic Notes template), filling `{{title}}`, `{{date}}`, `{{date:FORMAT}}`, and `{{time}}`. Set *Title format*, *Template path*, and *Note folder*; blank fields fall back to your Daily Notes config. (Templater `<% %>` syntax is not executed.)
- **Daily pomodoro counter** — point it at a unique counter line (e.g. `## 🍎 Today_Pomodoro:: 0`) and each log rewrites the number to that day's count (using the same day-start grouping). The line is left untouched if its prefix is not unique.

## Categories and Obsidian tags
Each task can carry a category (Me / En / Pro …) read from a Notion **select** (or multi-select) property — name it under *Category property* (default `Area`). It shows as a chip in the today list (a matching `[X]` title prefix is hidden to avoid duplication). With **Write the category tag to the daily note** on and `{tag}` in your template, each block gets a real Obsidian tag: with *Tag namespace* `Notion`, an Area of `En` writes `#Notion/En`, nesting under one parent in the tag pane. Leave the namespace blank for a flat `#En`, or the category property blank to switch it off.

## Day, week, and time settings
- **Day starts at (0–23)** — the hour your logical day rolls over. A morning value like 4 keeps late-night work on the previous day; an evening value like 22 starts a fresh day that night. Stats and the heatmaps all follow this.
- **Start the week on Sunday** — Monday by default; toggling shifts the week range, the weekly grouping, and the weekday headers.
- **Morning/afternoon ends at** — the time bands used for the month heatmap and the best-time-of-day stat.

## Caveats
- The Notion API has no atomic increment, so Act write-back reads the current value then writes value + 1. With a single user this is safe; avoid editing the same page in two places at the exact same moment.
- The "Today Tasks" filter is an approximation (Today / King / This week, plus Daily dated today). Adjust in `queryToday()` for an exact match.
- It uses Notion API version `2022-06-28`. If your workspace requires data-source IDs, update the version and endpoints in `main.tsx`.
- Desktop only (it makes network requests).

## Thanks
The **Create new daily note if missing** feature is modelled on **[Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes)** by Liam Cain — its clean *format / folder / template* model for periodic notes shaped how Focus Log finds and creates the daily note. Thank you for that work, which a good slice of the Obsidian daily-note workflow is built on.

## Build from source
```
npm install
npm run build   # outputs main.js
# npm run dev   # watch mode
```
Files: `main.tsx` (plugin entry, Notion client, settings tab, daily-note + pause writers) and `FocusLogApp.tsx` (the React UI). `esbuild.config.mjs` bundles them into `main.js`.
