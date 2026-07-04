# Plan-map date progression tracker — design

**Date:** 2026-07-04
**Status:** approved design, not yet built
**Component:** `public/planmap/` (the plan-map viewer) + `tools/agora/` (generator)

## Goal

Add a way to see the plan-map's history: what has actually moved, how long things
have been sitting, and how the whole map looked at past points in time. Three
views, all retrospective:

1. **Momentum** — what shipped, and when.
2. **Staleness** — how long each tile has sat in its current status.
3. **Time-travel replay** — redraw the map as it looked on any past day.

## Non-goals (the guardrail)

No forecasts. No ETAs. No target or deadline dates. No burndown projection. No
sub-day resolution. Every mark on this tracker is measured from a real commit
that already happened. This is what keeps the feature on the right side of the
no-estimates rule the plan-map was built to honor ("no dates, only order").

If a future request asks for "when will X be done," that is a separate, rejected
feature — not an extension of this one.

## Decisions (settled during design)

- **Retrospective only** — measures what happened, never predicts.
- **Data source: git history.** The repo auto-commits a daily snapshot at 2am, so
  `topics.json`'s commit log already holds a dated daily record of every status
  change. We reconstruct the timeline from it. Zero manual dating; it cannot rot.
- **Granularity: topics AND step tiles.** Git diffs capture per-feature status, so
  step-level progression is free.
- **Resolution: daily.** One point per calendar day (the snapshot cadence). Finer
  only on days with extra manual commits. A roadmap moves in days, so this fits.
- **Staleness = age in current status, for every live tile** (parked included — a
  long-parked tile glows too). `done`/`superseded` are excluded; they are already
  retired to the Shipped/Graveyard strips.
- **Staleness is a toggle overlay, off by default** — the map stays clean until you
  ask for the heatmap.
- **Replay is a draggable playhead plus a play button** that animates day-by-day.

## Architecture

Three parts: a generator (writes history), a render refactor (so the map can be
drawn from any snapshot), and the UI (timeline + heat toggle).

### Part 1 — the generator (`tools/agora/planmap-history.mjs`)

A Node script, sibling to the existing `validate-planmap.mjs` / `planmap-add.mjs`
tooling.

Behavior:
1. `git log --reverse --format=%H|%cI -- public/planmap/topics.json` → every commit
   that changed the file, oldest first, with its committer ISO date.
2. For each commit, `git show <hash>:public/planmap/topics.json`, parse it. If a
   historical snapshot fails to parse (a mid-edit commit), skip it and carry the
   last good state — defensive, never throws.
3. Collapse to daily grain: if a day has multiple commits, keep the **last** of
   that day (end-of-day state).
4. Write `public/planmap/history.json`:
   ```
   {
     "generatedAt": "<ISO now>",
     "days": [
       { "date": "YYYY-MM-DD", "commit": "<hash>", "topics": [ <full topic objects> ] },
       ...
     ]
   }
   ```
   Ordered oldest → newest. Full topic objects are stored (not just statuses) so
   replay can redraw the real map — deps, titles, campaigns and all — as it was.
   The file only carries days on which `topics.json` actually changed, so it grows
   with real activity, not the calendar.

Wiring: runnable on demand (`node tools/agora/planmap-history.mjs`) and added to
the 2am snapshot script (`aralia-daily-commit.ps1`, which lives outside the repo)
so the history refreshes automatically. The generator is the only thing that
touches git; the page never does — which is why it works on the lean static
`planmap` server.

**"Now" is the live file, not a commit.** The page fetches both `history.json`
(committed past days) and the live `topics.json`, and appends the live file as the
final point dated today. So today's uncommitted edits show up as "Now" without
needing a commit.

### Part 2 — render refactor (`public/planmap/index.html`)

Today the whole map is built once, inline, inside the `fetch('./topics.json')`
callback. Replay needs to redraw from an arbitrary snapshot, so the build logic is
extracted into a function — `renderMap(topicsArray)` — that takes any topics array
and produces the SVG. "Now" calls it with the live topics; scrubbing calls it with
a past day's topics. This is a structural refactor with **no behavior change** on
its own, and should land as its own slice so it is easy to verify in isolation.

Constraint: redrawing must **preserve the current zoom/pan** (the view window) and
any active filters, so scrubbing does not throw the reader back to a fitted view
every frame.

### Part 3 — the UI

**Timeline bar (momentum + replay).** A new fixed-height row docked below the map
canvas, above the Shipped/Graveyard strips. It holds:
- A horizontal date axis from the first history day to Now.
- **Momentum:** a small vertical bar per day, height ∝ how many tiles (topic or
  step) flipped to `done` that day. Hover a bar → the list of what shipped.
- **Playhead:** a draggable marker. Dragging it calls `renderMap` with that day's
  snapshot. A date readout shows the selected day; the far right is "Now" (live).
- **Play button:** advances the playhead day-by-day to Now, so you can watch the
  roadmap grow, then snaps back to live.

**Staleness heat toggle.** A toggle in the map controls (with the zoom/legend
chrome), off by default. When on, each live tile gets a semi-transparent tint by
age-in-current-status, bucketed for legibility (e.g. fresh → warm → hot), with a
matching legend. The tint sits behind the tile's border and text so both stay
readable — same "blending overlay" idea as the existing derived overlays. Toggling
it off restores the normal look. The heat reads the selected day's ages, so it
also works while scrubbed into the past.

## Derived data (computed in the page, never stored)

- **Momentum(day D):** diff day D's topics against day D-1 → count nodes whose
  status became `done` (including a node that first appears already `done`).
- **Staleness(node, day D):** walk back through the days to the most recent one
  where the node's status differed from its status on D → age = D − that date. If
  the node has held its status since the first history day, report `≥ N days` — an
  honest floor, because we cannot see before history starts.
- **Replay(day D):** `renderMap(day D's topics)`; nodes that did not exist yet are
  simply absent.

## Node identity across time

- Topics are keyed by `id` (stable).
- Step tiles are keyed by `topic-id + slug(title)`. Renaming a feature changes its
  slug, so it reads as the old one disappearing and a new one appearing. Acceptable
  and worth stating; renames are rare and the plan-map already warns on slug drift.

## Edge cases

- **Short history.** The plan-map began ~2026-07-02, so early on the timeline spans
  only a few days. That is fine; it lengthens over time.
- **Empty/missing `history.json`.** If the generator has never run, the page hides
  the timeline and heat toggle and behaves exactly as it does today (live map only).
  No error, no fallback fiction — the features simply aren't offered yet.
- **Layout shifts during replay.** Because past snapshots have different topics and
  deps, the computed layout differs day to day, so tiles move as you scrub. This is
  honest, not a bug; do not try to freeze positions.
- **Unparseable historical snapshot.** Skipped by the generator (carry last good).

## Verification

- **Generator:** assert `history.json` parses, days are unique and ordered, each day
  has a topics array; cross-check the day count against `git log`. Spot-check one
  known status change lands on the right date.
- **Page (DOM/eval, since preview screenshots are flaky on the lean server):**
  timeline renders; momentum bar counts match computed done-events; dragging the
  playhead to a past date changes the rendered node set; the heat toggle adds tints
  and removes them cleanly; zoom/pan survive a redraw.
- Visual eyeball through a full app server pointed at the plan-map URL when a
  picture is needed (the lean `planmap` server can't be screenshotted).

## Suggested build order (for the plan)

1. Generator + `history.json` + 2am wiring.
2. Extract `renderMap(topicsArray)` — no behavior change.
3. Timeline bar + momentum bars (static, at Now).
4. Playhead drag + play → replay via `renderMap`, preserving view.
5. Staleness heat overlay toggle.
