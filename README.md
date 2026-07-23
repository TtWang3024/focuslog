# Focus Log

An Obsidian pomodoro companion that treats your day as something to *feel*, not just count. It can sync tasks from Notion (writing **Act +1** back to the exact page) or run fully standalone with local tasks.

## The fun parts

- **A sky of stars.** Every pomodoro you log lights a real star in a night sky with true constellations; your reflections light a second, silver sky. Drag to roam, scroll to zoom.
- **Feelings as weather.** Rate each session before and after with rain-to-sun weather icons, then watch the calibration stats: starting is usually less bad than feared, and the "biggest surprises" list proves it.
- **Breaks with seasons.** Rate how a break felt with four season trees, pick restoring activities, and learn which ones actually leave you restored.
- **A drag-first Timeline.** Left-drag reorders by seats: same-length tasks trade start times while everything else stays put, with a chocolate bar showing exactly where you'll land; right-drag pins a block in place and carves out a break you own; auto-fix packs the day around meals and commitments without touching your breaks.
- **Days with moods.** Work and relax days re-tint the morning and night routines (straw or blush dawns, sea-glass or misty-purple nights); Project and Personal tasks wear coffee-coloured tags.
- **A living calendar.** Month squares are coloured by day type and time of day (overnight work glows gold), date numbers show at a glance which days have a daily note, the outline follows the note you have open, and right-clicking a day reveals, deletes, or flips it between work and relax.
- **A floating timer.** A tiny always-on-top window with the same clock, pause reasons, and a star celebration when you finish.

Everything can be written into your daily notes: pomodoro blocks, pause reasons, and a per-day counter.

## Quick start

1. Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/focuslog/`, then enable **Focus Log**.
2. Optional: paste a Notion integration token in Settings → Focus Log and press sync; without it, add tasks with the Timeline's add-block button.

## Thanks

- **[Calendar](https://github.com/liamcain/obsidian-calendar-plugin)** by Liam Cain: the Month view's feel, opening a day's note from a calendar and the right-click day menu, follows its lead.
- **[Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes)** by Liam Cain: the format / folder / template model behind "create the daily note if missing".

## Icon credits

- [Window icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/window)
- [Study icons created by Mihimihi - Flaticon](https://www.flaticon.com/free-icons/study)
- [Table lamp icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/table-lamp)
- [Notebook icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/notebook)
- The Reflect view's icons (sun, moon, cactus, lily, and the body map) come from [Hold](https://github.com/TtWang3024/pause), the Chrome extension this view grew out of.

## Build

```
npm install
npm run build
```

`main.tsx` is the plugin entry (Notion client, settings, writers); `FocusLogApp.tsx` is the React panel.
