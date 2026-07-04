# Plan-map date progression tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three retrospective history views to the plan-map — momentum (what shipped when), staleness (how long a tile has sat in its status), and time-travel replay (redraw the map as of any past day) — driven entirely by git history.

**Architecture:** A Node generator diffs `topics.json` across its daily-snapshot commits and writes `public/planmap/history.json`. A pure ESM module derives momentum and staleness from that history and is unit-tested with vitest and reused in the browser. The plan-map page (`public/planmap/index.html`) is refactored so its map build is a function of a topics array, then gains a bottom timeline (momentum bars + draggable playhead + play), and a staleness heat overlay toggle.

**Tech Stack:** Node ESM (generator), vanilla JS + inline SVG (the viewer), vitest (tests for the pure logic). No new dependencies.

## Global Constraints

- **No forecasts, ever.** Every value is measured from a real commit. No ETAs, target dates, or projections. (Spec non-goal.)
- **Do NOT commit.** This repo auto-commits a daily snapshot at 2am; leave all work in the working tree. Replace the usual "commit" step with a verification checkpoint. (User standing rule.)
- **Work only on `master`.** No branches, no worktrees. (User standing rule.)
- **Daily resolution, topics + step tiles.** One timeline point per calendar day; track both topic and feature (step) status.
- **Staleness covers every live tile** (parked included); `done`/`superseded` are excluded. Heat overlay is **off by default**.
- **Slug function must stay identical** across the page, the derive module, and `tools/agora/validate-planmap.mjs`:
  `s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)`
- **Preview verification:** the lean `planmap` server (port 5183) cannot be screenshotted; verify the page via `preview_eval` DOM assertions. For a visual eyeball, use a full app server pointed at `/Aralia/planmap/index.html`.

---

## File Structure

- Create `tools/agora/planmap-history.mjs` — generator: reads git, writes `history.json`. Exports pure helpers.
- Create `tools/agora/planmap-history.test.mjs` — vitest tests for the generator's pure helpers.
- Create `public/planmap/history-derive.mjs` — pure derive functions (`flatNodes`, `diffDone`, `momentumByDay`, `stalenessDays`, `slug`); dual-use (vitest import + browser `window.PlanmapHistory`).
- Create `public/planmap/history-derive.test.mjs` — vitest tests for the derive functions.
- Create `public/planmap/history.json` — generated artifact (produced by running the generator; not hand-written).
- Modify `public/planmap/index.html` — extract `buildAndShow(topics)`; add timeline bar + momentum; playhead replay + play; staleness heat toggle; load the derive module.
- Document (outside repo): add `node tools/agora/planmap-history.mjs` to `C:\Users\Gambit\.claude\scripts\aralia-daily-commit.ps1` so history regenerates at 2am.

---

## Task 1: History generator (git → history.json)

**Files:**
- Create: `tools/agora/planmap-history.mjs`
- Test: `tools/agora/planmap-history.test.mjs`

**Interfaces:**
- Produces:
  - `parseSnapshot(text: string) => object[] | null` — parsed `topics` array, or `null` if the text isn't valid `topics.json`.
  - `collapseDaily(commits: {hash,dateISO,topics}[]) => {date,commit,topics}[]` — one entry per calendar day (last commit of the day), sorted ascending by date.
  - `buildHistory(commits) => { generatedAt: string, days: {date,commit,topics}[] }`.

- [ ] **Step 1: Write the failing tests**

Create `tools/agora/planmap-history.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { parseSnapshot, collapseDaily, buildHistory } from './planmap-history.mjs';

describe('parseSnapshot', () => {
  it('returns the topics array for valid json', () => {
    expect(parseSnapshot('{"topics":[{"id":"a"}]}')).toEqual([{ id: 'a' }]);
  });
  it('returns null for garbage or missing topics', () => {
    expect(parseSnapshot('not json')).toBeNull();
    expect(parseSnapshot('{"nope":1}')).toBeNull();
  });
});

describe('collapseDaily', () => {
  it('keeps the LAST commit of each calendar day, sorted ascending', () => {
    const commits = [
      { hash: 'c1', dateISO: '2026-07-01T09:00:00Z', topics: [{ id: 'x', status: 'parked' }] },
      { hash: 'c2', dateISO: '2026-07-01T22:00:00Z', topics: [{ id: 'x', status: 'specced' }] },
      { hash: 'c3', dateISO: '2026-07-02T02:00:00Z', topics: [{ id: 'x', status: 'active' }] },
    ];
    const days = collapseDaily(commits);
    expect(days.map(d => d.date)).toEqual(['2026-07-01', '2026-07-02']);
    expect(days[0].commit).toBe('c2');
    expect(days[0].topics[0].status).toBe('specced');
  });
  it('skips commits whose snapshot failed to parse (null topics)', () => {
    const days = collapseDaily([{ hash: 'c1', dateISO: '2026-07-01T09:00:00Z', topics: null }]);
    expect(days).toEqual([]);
  });
});

describe('buildHistory', () => {
  it('wraps days with a generatedAt stamp', () => {
    const h = buildHistory([{ hash: 'c1', dateISO: '2026-07-01T09:00:00Z', topics: [{ id: 'x' }] }]);
    expect(h.days).toHaveLength(1);
    expect(typeof h.generatedAt).toBe('string');
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run tools/agora/planmap-history.test.mjs`
Expected: FAIL — cannot resolve `./planmap-history.mjs` / exports undefined.

- [ ] **Step 3: Write the generator**

Create `tools/agora/planmap-history.mjs`:

```js
// Plan-map history generator. Reconstructs a dated, per-day timeline of
// topics.json from git (the repo auto-commits a daily snapshot), so the
// plan-map's date-progression tracker needs zero manual dating. Writes
// public/planmap/history.json. Run: node tools/agora/planmap-history.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = 'public/planmap/topics.json';
const OUT = 'public/planmap/history.json';

export function parseSnapshot(text) {
  try {
    const j = JSON.parse(text);
    return Array.isArray(j.topics) ? j.topics : null;
  } catch {
    return null;
  }
}

export function collapseDaily(commits) {
  // Map keeps insertion order; a later same-day commit overwrites the value
  // but keeps the day's original slot. commits arrive oldest -> newest.
  const byDay = new Map();
  for (const c of commits) {
    if (!c.topics) continue; // skip unparseable historical snapshots
    const date = c.dateISO.slice(0, 10);
    byDay.set(date, { date, commit: c.hash, topics: c.topics });
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildHistory(commits) {
  return { generatedAt: new Date().toISOString(), days: collapseDaily(commits) };
}

function gitCommits(file) {
  const log = execFileSync('git', ['log', '--reverse', '--format=%H|%cI', '--', file], { encoding: 'utf8' }).trim();
  if (!log) return [];
  return log.split('\n').map(line => {
    const [hash, dateISO] = line.split('|');
    let topics = null;
    try {
      topics = parseSnapshot(execFileSync('git', ['show', `${hash}:${file}`], { encoding: 'utf8' }));
    } catch { /* commit predates the file or blob missing — leave null */ }
    return { hash, dateISO, topics };
  });
}

function main() {
  const history = buildHistory(gitCommits(FILE));
  writeFileSync(OUT, JSON.stringify(history, null, 2) + '\n');
  console.log(`plan-map history: ${history.days.length} day(s) written to ${OUT}`);
}

// Run main only when invoked directly, not when imported by the test.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run tools/agora/planmap-history.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Generate the real artifact and sanity-check it**

Run: `node tools/agora/planmap-history.mjs`
Expected stdout: `plan-map history: N day(s) written to public/planmap/history.json` (N ≥ 1).
Then: `node -e "const h=require('./public/planmap/history.json'); console.log(h.days.length, h.days.at(-1).date, Array.isArray(h.days.at(-1).topics))"`
Expected: a day count, a recent date string, and `true`.

- [ ] **Step 6: Checkpoint (no commit)**

Leave `planmap-history.mjs`, its test, and `history.json` in the working tree. Do not commit.

---

## Task 2: Derive functions (momentum + staleness)

**Files:**
- Create: `public/planmap/history-derive.mjs`
- Test: `public/planmap/history-derive.test.mjs`

**Interfaces:**
- Consumes: the `{date, topics}[]` shape from `history.json` (`days`), plus a live "today" point appended by the caller.
- Produces:
  - `slug(title) => string`
  - `flatNodes(topics) => {key,kind,topicId,title,status}[]` — topics + features as one comparable list; `key` = topic `id` or `` `${id}::${slug(title)}` ``.
  - `diffDone(prevTopics, nextTopics) => node[]` — nodes that became `done` (incl. first-seen-as-done).
  - `momentumByDay(timeline) => {date,count,shipped}[]` — `timeline` is `[{date,topics}]` ascending (live appended by caller).
  - `stalenessDays(timeline, today) => Map<key,{days:number,floored:boolean}>` — for each live node in the last point, days held in current status; `floored` when unchanged across all visible history.

- [ ] **Step 1: Write the failing tests**

Create `public/planmap/history-derive.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { flatNodes, diffDone, momentumByDay, stalenessDays } from './history-derive.mjs';

const T = (id, status, features = []) => ({ id, title: id, status, features });
const F = (title, status) => ({ title, status });

describe('flatNodes', () => {
  it('flattens topics and their features with stable keys', () => {
    const nodes = flatNodes([T('a', 'active', [F('Do X', 'done')])]);
    expect(nodes.map(n => n.key)).toEqual(['a', 'a::do-x']);
  });
});

describe('diffDone', () => {
  it('reports nodes that newly became done', () => {
    const prev = [T('a', 'active', [F('Do X', 'active')])];
    const next = [T('a', 'active', [F('Do X', 'done')])];
    expect(diffDone(prev, next).map(n => n.key)).toEqual(['a::do-x']);
  });
  it('counts a node that first appears already done', () => {
    expect(diffDone([], [T('a', 'done')]).map(n => n.key)).toEqual(['a']);
  });
  it('does not re-report something already done', () => {
    expect(diffDone([T('a', 'done')], [T('a', 'done')])).toEqual([]);
  });
});

describe('momentumByDay', () => {
  it('counts done-transitions per day', () => {
    const timeline = [
      { date: '2026-07-01', topics: [T('a', 'active')] },
      { date: '2026-07-02', topics: [T('a', 'done')] },
      { date: '2026-07-03', topics: [T('a', 'done'), T('b', 'done')] },
    ];
    expect(momentumByDay(timeline).map(d => d.count)).toEqual([0, 1, 1]);
  });
});

describe('stalenessDays', () => {
  it('dates age from the day the status last changed', () => {
    const timeline = [
      { date: '2026-07-01', topics: [T('a', 'parked')] },
      { date: '2026-07-03', topics: [T('a', 'specced')] },
    ];
    const m = stalenessDays(timeline, '2026-07-05');
    expect(m.get('a')).toEqual({ days: 2, floored: false });
  });
  it('floors age when the status never changed in visible history', () => {
    const timeline = [
      { date: '2026-07-01', topics: [T('a', 'parked')] },
      { date: '2026-07-03', topics: [T('a', 'parked')] },
    ];
    const m = stalenessDays(timeline, '2026-07-05');
    expect(m.get('a')).toEqual({ days: 4, floored: true });
  });
  it('excludes done and superseded nodes', () => {
    const timeline = [{ date: '2026-07-01', topics: [T('a', 'done'), T('b', 'superseded')] }];
    expect(stalenessDays(timeline, '2026-07-02').size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run public/planmap/history-derive.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the derive module**

Create `public/planmap/history-derive.mjs`:

```js
// Pure history-derivation for the plan-map date tracker. Dual-use: imported by
// vitest AND loaded in the browser (attaches window.PlanmapHistory). No DOM, no
// git — just data in, data out.
export const slug = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export function flatNodes(topics) {
  const out = [];
  for (const t of topics || []) {
    out.push({ key: t.id, kind: 'topic', topicId: t.id, title: t.title, status: t.status });
    for (const f of t.features || [])
      out.push({ key: `${t.id}::${slug(f.title)}`, kind: 'feature', topicId: t.id, title: f.title, status: f.status });
  }
  return out;
}

export function diffDone(prevTopics, nextTopics) {
  const prev = new Map(flatNodes(prevTopics).map(n => [n.key, n.status]));
  return flatNodes(nextTopics).filter(n => n.status === 'done' && prev.get(n.key) !== 'done');
}

export function momentumByDay(timeline) {
  const out = [];
  for (let i = 0; i < timeline.length; i++) {
    const prev = i === 0 ? [] : timeline[i - 1].topics;
    const shipped = diffDone(prev, timeline[i].topics);
    out.push({ date: timeline[i].date, count: shipped.length, shipped });
  }
  return out;
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function stalenessDays(timeline, today) {
  const last = timeline[timeline.length - 1];
  const res = new Map();
  for (const n of flatNodes(last.topics)) {
    if (n.status === 'done' || n.status === 'superseded') continue;
    let sinceDate = timeline[0].date, floored = true;
    for (let i = timeline.length - 2; i >= 0; i--) {
      const was = new Map(flatNodes(timeline[i].topics).map(x => [x.key, x.status])).get(n.key);
      if (was !== n.status) { sinceDate = timeline[i + 1].date; floored = false; break; }
    }
    res.set(n.key, { days: Math.max(0, daysBetween(sinceDate, today)), floored });
  }
  return res;
}

if (typeof window !== 'undefined') {
  window.PlanmapHistory = { slug, flatNodes, diffDone, momentumByDay, stalenessDays };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run public/planmap/history-derive.test.mjs`
Expected: PASS (8 tests).

- [ ] **Step 5: Checkpoint (no commit)**

Leave both files in the tree.

---

## Task 3: Refactor the map build into `buildAndShow(topics)` (no behavior change)

**Files:**
- Modify: `public/planmap/index.html`

**Interfaces:**
- Produces (module-level in the page):
  - `buildAndShow(topics, opts?: { preserveView?: boolean }) => void` — rebuilds the SVG from any topics array, sets `#canvas` innerHTML, and re-wires hover/pin/filter. First call fits; `preserveView:true` keeps the current zoom/pan.
  - Persistent module-level `view` object and the zoom/pan/fit handlers, defined once and reused across rebuilds.

**Why:** Replay (Task 5) and the heat toggle (Task 6) redraw the map from different topics arrays without resetting the reader's zoom/pan.

- [ ] **Step 1: Wrap the existing build in a function**

In the `fetch('./topics.json').then(data => { ... })` callback in `index.html`:
1. Keep the top matter that is data-independent-of-snapshot as-is: `docHref`, `APP_BASE`, header-link wiring.
2. Move everything from the depth/layout computation through the SVG string build, the `#canvas` innerHTML assignment, and the node/edge/hover/pin/filter wiring into a single function `function buildAndShow(topics, opts = {})`. It must take `topics` as its parameter (not close over `data.topics`).
3. Recompute `byId` inside `buildAndShow` from the passed `topics` (`const byId = Object.fromEntries(topics.map(t => [t.id, t]))`).

- [ ] **Step 2: Lift zoom/pan state out of the per-build scope**

Move the `const view = { x:0, y:0, w:W, h:H }` declaration and the `applyView` / `fit` / `zoomBy` / pan handlers so they persist across rebuilds:
- Declare `let view = null;` at module scope (above `buildAndShow`).
- At the END of `buildAndShow`, after `#canvas` is populated and `svgEl` re-queried:
  ```js
  if (!view || !opts.preserveView) { fit(); }   // first render, or an explicit reset
  else { applyView(); }                          // keep the reader's current window
  ```
- `fit()` initializes `view` from the new `W`/`H`; `applyView()` re-applies the existing `view` to the new `svgEl`.
- Re-bind wheel/drag/zoom-button listeners to the freshly-created `svgEl` on every build (they were previously bound once). Keep the `resize` listener bound once at module scope.

- [ ] **Step 3: Call it once for the live map**

Replace the old inline execution with a single initial call:
```js
buildAndShow(data.topics);   // live map, first render → fits
```

- [ ] **Step 4: Verify no behavior change (DOM eval)**

Restart/point a server at the plan-map, then:
```
preview_eval: JSON.stringify({
  parents: document.querySelectorAll('.node:not(.stepnode)').length,
  steps: document.querySelectorAll('.stepnode').length,
  stepEdges: document.querySelectorAll('.stepedge').length,
  edges: document.querySelectorAll('.edgeg').length,
  validation: document.getElementById('validation').classList.contains('show')
})
```
Expected: same counts as before the refactor (19 parents / 21 steps / 21 stepEdges / 11 edges at time of writing) and `validation:false`. Hover, click-to-pin, filter chips, zoom, and pan all still work (spot-check by eval-ing a `.pinned` after a synthetic click, and confirming `view` is unchanged after a second `buildAndShow(data.topics,{preserveView:true})`).

- [ ] **Step 5: Checkpoint (no commit)**

---

## Task 4: Timeline bar + momentum (static, at Now)

**Files:**
- Modify: `public/planmap/index.html`

**Interfaces:**
- Consumes: `history.json` (fetched), live `data.topics`, `window.PlanmapHistory.momentumByDay`.
- Produces (module-level): `timeline` = `[...history.days, { date: <todayISO>, topics: data.topics }]`; `momentum` = `momentumByDay(timeline)`; a `#timeline` DOM element rendered by `buildTimeline()`.

- [ ] **Step 1: Load the derive module**

In `index.html` `<head>` (or before the main inline script), add:
```html
<script type="module" src="./history-derive.mjs"></script>
```
It attaches `window.PlanmapHistory`. The main script's `fetch(...).then` is async, so the module is loaded by the time it runs; guard with `const H = window.PlanmapHistory;` and if absent, skip building the timeline (feature simply absent — no error).

- [ ] **Step 2: Add the timeline container**

After `<div id="canvas"></div>` and before the Shipped/Graveyard strips are inserted, add:
```html
<div id="timeline" aria-label="History timeline"></div>
```
CSS (in the `<style>` block):
```css
#timeline { padding: 6px 22px 10px; border-top: 1px solid #1e293b; min-height: 54px; }
#timeline svg { width: 100%; height: 54px; display: block; }
#timeline .tl-bar { fill: #4ade80; }
#timeline .tl-axis { stroke: #334155; stroke-width: 1; }
#timeline .tl-tick { font-size: 10px; fill: #64748b; }
#timeline .tl-play { fill: #1e293b; stroke: #334155; cursor: pointer; }
#timeline .tl-playhead { stroke: #fbbf24; stroke-width: 2; }
#timeline .tl-knob { fill: #fbbf24; cursor: ew-resize; }
#timeline .tl-readout { font-size: 11px; fill: #94a3b8; }
```

- [ ] **Step 3: Fetch history and build the timeline**

Inside the `.then(data => …)`, after `buildAndShow(data.topics)`:
```js
const todayISO = new Date().toISOString().slice(0, 10);
fetch('./history.json').then(r => r.ok ? r.json() : null).then(hist => {
  if (!hist || !H) return;                       // no history yet → no timeline (feature absent)
  const timeline = [...hist.days, { date: todayISO, topics: data.topics }];
  const momentum = H.momentumByDay(timeline);
  buildTimeline(timeline, momentum, timeline.length - 1); // playhead at Now
}).catch(() => {});
```

- [ ] **Step 4: Implement `buildTimeline(timeline, momentum, activeIndex)`**

Renders an SVG into `#timeline`: a horizontal axis; one `.tl-bar` per day whose `count > 0` (bar height ∝ `count`, min 3px, positioned at that day's x); date ticks at the first, last, and a few interior days; a `<title>` per bar listing `shipped` titles; a play button rect at the left; a `.tl-playhead` vertical line + `.tl-knob` circle at `activeIndex`'s x; and a `.tl-readout` text showing the active day's date (or "Now" for the last index). Map day index → x with `x(i) = PADX + i*(W-2*PADX)/(timeline.length-1)`. For Task 4 the playhead is static at Now and the play button is inert (wired in Task 5).

- [ ] **Step 5: Verify (DOM eval)**

```
preview_eval: (() => {
  const bars = [...document.querySelectorAll('#timeline .tl-bar')];
  const H = window.PlanmapHistory;
  return JSON.stringify({
    timelinePresent: !!document.querySelector('#timeline svg'),
    barCount: bars.length,
    readout: document.querySelector('#timeline .tl-readout')?.textContent
  });
})()
```
Expected: `timelinePresent:true`; `barCount` equals the number of days with a done-transition (cross-check against `momentumByDay` in the console); readout shows "Now". Hovering a bar shows a `<title>` naming what shipped.

- [ ] **Step 6: Checkpoint (no commit)**

---

## Task 5: Playhead drag + play (time-travel replay)

**Files:**
- Modify: `public/planmap/index.html`

**Interfaces:**
- Consumes: `timeline`, `buildTimeline`, `buildAndShow` (Task 3).
- Produces (module-level): `let dayIndex = timeline.length - 1;` and `goToDay(i)` — clamps `i`, re-renders the map from that day's topics (live topics when `i` is the last index), preserves view, and redraws the timeline with the playhead at `i`.

- [ ] **Step 1: Implement `goToDay(i)`**

```js
function goToDay(i) {
  dayIndex = Math.max(0, Math.min(timeline.length - 1, i));
  const topics = timeline[dayIndex].topics;       // live topics for the last point
  buildAndShow(topics, { preserveView: true });   // keep zoom/pan
  buildTimeline(timeline, momentum, dayIndex);
}
```
Keep `timeline`/`momentum` at module scope (assigned when history loads) so `goToDay` can reach them.

- [ ] **Step 2: Make the knob draggable**

On the `.tl-knob` (and the timeline SVG background), add pointer handlers: on drag, convert clientX → nearest day index via the inverse of `x(i)`, and call `goToDay(nearest)`. Snap to integer day indices. Use `pointerdown`/`pointermove`/`pointerup` with pointer capture.

- [ ] **Step 3: Wire the play button**

On `.tl-play` click: if already at the last index, start from 0. Then `setInterval(() => { goToDay(dayIndex + 1); if (dayIndex >= timeline.length - 1) stop(); }, 700)`. Clicking again while playing stops it. On finish it rests at Now (live). Guard against overlapping intervals.

- [ ] **Step 4: Verify (DOM eval)**

```
preview_eval: (() => {
  // Jump to the first history day and confirm the rendered map matches that snapshot.
  window.__goToDay ? window.__goToDay(0) : null;   // expose goToDay as window.__goToDay for testing
  const firstDayTopics = window.__timeline?.[0]?.topics || [];
  return JSON.stringify({
    renderedParents: document.querySelectorAll('.node:not(.stepnode)').length,
    expectedTopics: firstDayTopics.length,
    playhead: !!document.querySelector('#timeline .tl-knob')
  });
})()
```
Expected: after `goToDay(0)`, `renderedParents` equals the count of non-dead topics in the first day's snapshot; going back to the last index restores the live counts; zoom/pan is unchanged across the jump (check `view` before/after). (Expose `window.__goToDay` and `window.__timeline` during development for this assertion.)

- [ ] **Step 5: Checkpoint (no commit)**

---

## Task 6: Staleness heat overlay toggle

**Files:**
- Modify: `public/planmap/index.html`

**Interfaces:**
- Consumes: `timeline`, `dayIndex`, `window.PlanmapHistory.stalenessDays`, `buildAndShow`.
- Produces (module-level): `let heatOn = false;` and a heat toggle control; `buildAndShow` draws per-node heat tints when `heatOn`.

- [ ] **Step 1: Add the toggle control**

In `#maptools` (next to the zoom buttons), add:
```html
<button id="heat-toggle" aria-pressed="false">Age heat</button>
```
CSS: reuse the `#maptools button` style; when `aria-pressed="true"`, give it an active tint (`background:#334155`). Click handler:
```js
document.getElementById('heat-toggle').addEventListener('click', e => {
  heatOn = !heatOn;
  e.currentTarget.setAttribute('aria-pressed', String(heatOn));
  buildAndShow(timeline[dayIndex].topics, { preserveView: true });
});
```

- [ ] **Step 2: Compute staleness inside `buildAndShow`**

At the top of `buildAndShow`, when `heatOn` and `timeline` exists:
```js
const heat = heatOn && window.PlanmapHistory
  ? window.PlanmapHistory.stalenessDays(timeline.slice(0, dayIndex + 1), timeline[dayIndex].date)
  : null;
const HEAT = d => d <= 2 ? '#22d3ee' : d <= 7 ? '#fbbf24' : d <= 21 ? '#fb923c' : '#f87171';
```
(`HEAT` maps age-in-days to a cool→hot color; buckets: ≤2 fresh cyan, ≤7 amber, ≤21 orange, >21 hot red.)

- [ ] **Step 3: Draw the tint per node**

When emitting each parent tile and each step tile, if `heat` has an entry for that node's key (`t.id` for topics, `` `${t.id}::${slug(f.title)}` `` for steps), push a semi-transparent overlay rect over the tile's rect BEFORE its border/text so text stays readable:
```js
const hk = heat && heat.get(nodeKey);
if (hk) S.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${HEAT(hk.days)}" fill-opacity="0.28" pointer-events="none"/>`);
```
Add a small legend row into `#timeline` or the legend area when `heatOn` (fresh → hot swatches with the day-bucket labels).

- [ ] **Step 4: Verify (DOM eval)**

```
preview_eval: (() => {
  document.getElementById('heat-toggle').click();
  const tints = document.querySelectorAll('.node rect[fill-opacity="0.28"]').length;
  document.getElementById('heat-toggle').click();
  const after = document.querySelectorAll('.node rect[fill-opacity="0.28"]').length;
  return JSON.stringify({ tintsWhenOn: tints, tintsWhenOff: after });
})()
```
Expected: `tintsWhenOn` > 0 (one per live tile), `tintsWhenOff` === 0. Colors match the bucket of each node's age (spot-check a known-stale node reads hot).

- [ ] **Step 5: Regenerate history and final full-map eval**

Run `node tools/agora/planmap-history.mjs` once more, reload, and confirm: timeline present, momentum bars correct, scrubbing works, heat toggles cleanly, and normal map interactions (hover per-type colors, pin, filter, zoom, pan) are unaffected.

- [ ] **Step 6: Checkpoint (no commit)** — leave everything in the tree.

---

## Post-plan wiring (one-time, documented)

- Add `node tools/agora/planmap-history.mjs` to the 2am snapshot script `C:\Users\Gambit\.claude\scripts\aralia-daily-commit.ps1` (runs before the commit so the fresh `history.json` is included). This file is outside the repo — note it in the session summary rather than editing it as a plan task unless the user asks.

## Self-review notes

- **Spec coverage:** momentum → Task 4; staleness heat → Task 6; time-travel replay → Tasks 3+5; git-derived history → Task 1; topic+step granularity → `flatNodes` (Task 2); daily grain → `collapseDaily` (Task 1); no-forecast guardrail → Global Constraints; empty-history graceful absence → Task 4 Step 3; layout-shift-is-honest → inherent to `buildAndShow(snapshot)`; view preservation → Task 3.
- **Type consistency:** `buildAndShow`, `timeline`, `momentum`, `dayIndex`, `goToDay`, `heatOn`, `HEAT`, node `key` scheme, and `window.PlanmapHistory` names are used identically across tasks.
