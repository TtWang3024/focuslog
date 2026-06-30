# Plan view redesign

Simplify viewing + editing of the Plan/Timeline view (currently the most complex view).
Most features already exist; this is mostly a calmer layout + a few interaction upgrades.

## Decisions (locked)

### Layout
- One header: Work/Relax toggle · Tasks/Timeline toggle · Sync from Notion.
- Header pomodoro counter is DERIVED from the timeline (count of task blocks; duplicates add up),
  not a manual goal: `5 tasks · 0 / 14 🍅 · ends 17:40` and, when the last block runs past the
  working window, append `(overflows by 25m)`. Fallback when the timeline is empty: sum of
  remaining task estimates.
- Timeline toolbar: long-break picker (3/4/5) · auto-fix · restart (quiet icon) · Commitment.
- Uniform block rows: left colour stripe by meaning (task = ExecutionPower priority: Must coral /
  Aim amber / Bonus green, with A/B/C load chip; routine = green; long break = blue; short break =
  thin labelled line). Lock icon = pinned task. Per-row actions hover-reveal (already exists).

### Interactions
- Drag model (replaces the global `anchorShift` setting, which is removed):
  - LEFT-drag a task → move only that task, then auto-fix breaks regenerates the rhythm, with UNDO.
  - RIGHT-drag a task → move it + everything after it (cascade), keep spacing, NO auto-fix.
  - Suppress the context menu over the timeline so the right button can drive a drag.
- Commitment (renamed from "unavailable") = a FIXED block (immovable; editable time/length);
  tasks reflow around it. Shows a lock icon.
- Duplicate stays (plan a task across several pomodoros; each duplicate counts toward the 🍅 total).
- Long-break picker: 3 / 4 / 5 (was 2/3/4).
- Restart = quiet icon with a one-tap confirm (rebuild the day from current tasks; destructive).
- Gap labels: thin break lines only; drop "free Xm".

### Scope: both views, one visual language (all shipped)
- Phase 1 ✓ Timeline: pointer-drag (left = move one + auto-fix + undo; right = cascade, no auto-fix),
  fixed Commitments (lock, flow around), 3/4/5 long-break picker, quiet restart with confirm,
  thin break lines only, derived 🍅 header. Reviewed; 5 drag-logic defects fixed.
- Phase 2 ✓ Task view: power-colour / green left stripes (was a floating swatch), load chip,
  tomato pips with the "N done" text removed (per-task Notion count, shown on hover). Reviewed.
- Phase 3 ✓ Header gates "· ends HH:MM (overflows)" to the Timeline view (Task view stays calm);
  removed the dead anchorShift toggle + dailyGoal setting (type, default, UI, and stale state).
