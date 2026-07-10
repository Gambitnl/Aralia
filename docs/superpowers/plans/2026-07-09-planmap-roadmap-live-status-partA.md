# Plan-map live status on the roadmap (Part A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the feature-tree roadmap display the plan-map's honest, reconciled status (plus READY/FOCUS badges) live in the browser, read from the plan-map's own `topics.json`, with an on-demand Refresh button.

**Architecture:** The plan-map's `public/planmap/topics.json` stays the sole owner of status; the roadmap only reads it and only displays it. The roadmap's node generator (which runs live, served at `/Aralia/api/roadmap/data` — there is no baked `roadmap.json`) stamps an optional `planmapTopic` tag onto curated nodes. At load, the roadmap app also fetches `topics.json`, and a pure overlay function computes each tagged node's status, READY, and FOCUS from it. The "what counts as READY" rule is extracted into one shared, dual-use module that both the plan-map viewer and the roadmap import.

**Tech Stack:** Vanilla ES module (`.mjs`) for the shared pure logic; TypeScript + React for the roadmap app; Vite dev server (`base: '/Aralia/'`); Vitest (`npm run test`, jsdom, globals).

## Global Constraints

- **One-directional only.** The roadmap never writes to `topics.json`. Data flows plan-map → roadmap, never back. (Spec: Principle.)
- **No new fields on the plan-map data model.** `topics.json` gains nothing. (Spec: Out of scope.)
- **Plan-map spelling/plain-language house style:** US English spelling everywhere; plain wording in any user-facing copy.
- **Vite base path is `/Aralia/`.** All app-origin fetches are absolute under it (e.g. `/Aralia/planmap/topics.json`, `/Aralia/api/roadmap/data`).
- **Test runner:** `npm run test` (Vitest). Single file: `npx vitest run <path>`. Config `vitest.config.ts` has no `include` restriction, so new `*.test.ts` / `*.test.mjs` next to code are auto-discovered; `environment: 'jsdom'` means `window` is defined during tests.
- **Node status vocabulary (roadmap):** `'planned' | 'active' | 'done'`. **Plan-map status vocabulary:** `'parked' | 'specced' | 'active' | 'done' | 'superseded'`.
- **Colors to mirror the plan-map:** READY green `#4ade80`, FOCUS amber `#fbbf24`.

---

## File Structure

**Created:**
- `public/planmap/ready-derive.mjs` — shared pure readiness logic (dual-use: vitest + browser `window.PlanmapReady` + roadmap import). One responsibility: "is a topic dead / actionable".
- `public/planmap/ready-derive.test.mjs` — tests for the shared module.
- `devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.ts` — pure overlay: given roadmap nodes + parsed topics.json, return nodes with `planmapStatus`/`planmapReady`/`planmapFocus`/base `status` set. Also the plan-map→roadmap status mapping and the node-tagging helper.
- `devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.test.ts` — tests for the overlay + mapping + tagging.
- `devtools/roadmap/scripts/roadmap-validate-planmap-links.ts` — CLI validator: error on unknown `planmapTopic`, warn on unclaimed plan-map topics.

**Modified:**
- `public/planmap/index.html` — import `ready-derive.mjs`; replace the inline `isDead`/`isActionable` with `window.PlanmapReady`; add `?topic=` deep-link focus (small, and it seeds Part B).
- `devtools/roadmap/scripts/roadmap-server-logic.ts:28-45` — add optional `planmapTopic`/`planmapStatus`/`planmapReady`/`planmapFocus` fields to `RoadmapNode`.
- `devtools/roadmap/scripts/roadmap-engine/generate.ts` — add `PLANMAP_TOPIC_BY_NODE_ID` map + `attachPlanmapTopic` helper; wrap the three `nodes.push({...})` sites.
- `devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.ts:69-97` — add a 4th, non-fatal `topics.json` fetch; return parsed topics.
- `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx` — apply overlay after load; render status pill + READY/FOCUS badges; add a Refresh button.
- `package.json` — add `roadmap:validate-planmap` script.

---

## Task 1: Shared readiness module

**Files:**
- Create: `public/planmap/ready-derive.mjs`
- Test: `public/planmap/ready-derive.test.mjs`

**Interfaces:**
- Produces:
  - `slug(s: string): string` — lowercases, `[^a-z0-9]+`→`-`, trims `-`, `slice(0,40)` (matches the plan-map's local slug).
  - `isDead(topic): boolean` — `status === 'done' || status === 'superseded'`.
  - `isActionable(topic, byId): boolean` — topic is alive and every hard dep is satisfied (chosen deps and unknown-id deps don't block; feature-targeted deps satisfied when that feature is dead, falling back to whole-topic when the feature slug doesn't resolve).
  - Also attaches `window.PlanmapReady = { slug, isDead, isActionable }` when `window` exists.
- `topic` shape used: `{ id, status, deps?: (string | { id, kind?, feature? })[], features?: { title, status }[] }`.

- [ ] **Step 1: Write the failing test**

Create `public/planmap/ready-derive.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { slug, isDead, isActionable } from './ready-derive.mjs';

// byId factory
const index = (topics) => Object.fromEntries(topics.map((t) => [t.id, t]));

describe('isDead', () => {
  it('is true for done and superseded, false otherwise', () => {
    expect(isDead({ status: 'done' })).toBe(true);
    expect(isDead({ status: 'superseded' })).toBe(true);
    expect(isDead({ status: 'active' })).toBe(false);
    expect(isDead({ status: 'parked' })).toBe(false);
  });
});

describe('isActionable', () => {
  it('a dead topic is never actionable', () => {
    const t = { id: 'a', status: 'done', deps: [] };
    expect(isActionable(t, index([t]))).toBe(false);
  });

  it('alive with no deps is actionable', () => {
    const t = { id: 'a', status: 'parked', deps: [] };
    expect(isActionable(t, index([t]))).toBe(true);
  });

  it('a hard dep pointing at a done topic is satisfied', () => {
    const dep = { id: 'dep', status: 'done' };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'hard' }] };
    expect(isActionable(t, index([t, dep]))).toBe(true);
  });

  it('a hard dep at superseded is satisfied', () => {
    const dep = { id: 'dep', status: 'superseded' };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'hard' }] };
    expect(isActionable(t, index([t, dep]))).toBe(true);
  });

  it('a hard dep still open blocks', () => {
    const dep = { id: 'dep', status: 'active' };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'hard' }] };
    expect(isActionable(t, index([t, dep]))).toBe(false);
  });

  it('a chosen dep never blocks even when open', () => {
    const dep = { id: 'dep', status: 'active' };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'chosen' }] };
    expect(isActionable(t, index([t, dep]))).toBe(true);
  });

  it('a string dep is treated as hard', () => {
    const dep = { id: 'dep', status: 'active' };
    const t = { id: 'a', status: 'parked', deps: ['dep'] };
    expect(isActionable(t, index([t, dep]))).toBe(false);
  });

  it('a feature-targeted hard dep is satisfied when that feature is dead', () => {
    const dep = { id: 'dep', status: 'active', features: [{ title: 'Ship It', status: 'done' }] };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'hard', feature: slug('Ship It') }] };
    expect(isActionable(t, index([t, dep]))).toBe(true);
  });

  it('unresolved feature slug falls back to whole-topic deadness', () => {
    const dep = { id: 'dep', status: 'active', features: [{ title: 'Ship It', status: 'done' }] };
    const t = { id: 'a', status: 'parked', deps: [{ id: 'dep', kind: 'hard', feature: 'no-such-feature' }] };
    // dep topic is alive → not satisfied
    expect(isActionable(t, index([t, dep]))).toBe(false);
  });

  it('a dep with an unknown id does not block', () => {
    const t = { id: 'a', status: 'parked', deps: [{ id: 'ghost', kind: 'hard' }] };
    expect(isActionable(t, index([t]))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run public/planmap/ready-derive.test.mjs`
Expected: FAIL — cannot resolve `./ready-derive.mjs` (module does not exist yet).

- [ ] **Step 3: Write the module**

Create `public/planmap/ready-derive.mjs`:

```js
// Pure readiness derivation for the plan-map. Dual-use: imported by vitest, loaded
// in the browser (attaches window.PlanmapReady), and imported by the roadmap tool.
// No DOM, no fetch — just data in, boolean out. One home for "what counts as READY".

export const slug = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40);

export const isDead = (t) => !!t && (t.status === 'done' || t.status === 'superseded');

const depList = (t) => (t.deps || []).map((d) => (typeof d === 'string' ? { id: d, kind: 'hard' } : d));

const featureOf = (byId, targetId, featureSlug) => {
  if (!featureSlug) return null;
  const t = byId[targetId];
  return (t && (t.features || []).find((f) => slug(f.title) === featureSlug)) || undefined;
};

const featureDead = (f) => !!f && (f.status === 'done' || f.status === 'superseded');

// A topic is actionable when it is alive and every HARD dep is satisfied.
// chosen-order deps and deps pointing at an unknown id never block.
export const isActionable = (t, byId) => !isDead(t) &&
  depList(t).every((d) => {
    if (d.kind === 'chosen' || !byId[d.id]) return true;
    if (d.feature) {
      const f = featureOf(byId, d.id, d.feature);
      if (f) return featureDead(f);
      // slug didn't resolve (data race / typo) — fall back to whole topic.
    }
    return isDead(byId[d.id]);
  });

if (typeof window !== 'undefined') {
  window.PlanmapReady = { slug, isDead, isActionable };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run public/planmap/ready-derive.test.mjs`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add public/planmap/ready-derive.mjs public/planmap/ready-derive.test.mjs
git commit -m "feat(planmap): extract shared readiness module (ready-derive.mjs)"
```

---

## Task 2: Plan-map viewer uses the shared module (+ `?topic=` focus)

**Files:**
- Modify: `public/planmap/index.html`

**Interfaces:**
- Consumes: `window.PlanmapReady.isDead`, `window.PlanmapReady.isActionable` from Task 1.

This viewer has no unit tests; it is a self-contained inline script. Verification is (a) the Task 1 module tests already prove the logic, and (b) a manual eyeball, required by the project's visual-inspection rule.

- [ ] **Step 1: Add the module script tag**

In `public/planmap/index.html`, find the existing module import (around line 369):

```html
<script type="module" src="./history-derive.mjs"></script>
```

Add a sibling line immediately after it:

```html
<script type="module" src="./ready-derive.mjs"></script>
```

- [ ] **Step 2: Replace the inline `isDead`**

Find (around line 661):

```js
  const isDead = t => t.status === 'done' || t.status === 'superseded';
```

Replace with:

```js
  const isDead = t => window.PlanmapReady.isDead(t);
```

- [ ] **Step 3: Replace the inline `isActionable`**

Find the block starting around line 766:

```js
  const isActionable = t => !isDead(t) &&
    depList(t).every(d => {
      if (d.kind === 'chosen' || !byId[d.id]) return true;
      if (d.feature) {
        const f = featureOf(d.id, d.feature);
        if (f) return featureDead(f);
        // slug didn't resolve (data race / typo) — fall back to whole topic.
      }
      return isDead(byId[d.id]);
    });
```

Replace the whole block with:

```js
  const isActionable = t => window.PlanmapReady.isActionable(t, byId);
```

Leave `depList`, `slug`, `featureOf`, `featureDead` in place — they are still used elsewhere in `buildAndShow` (e.g. dep rendering). Only the two readiness predicates move to the shared module.

- [ ] **Step 4: Add `?topic=` deep-link focus**

Find the first-render line (around line 1643):

```js
    buildAndShow(data.topics);   // live map, first render → fits
```

Immediately after it, add:

```js
    // Deep link: ?topic=<id> pins and opens that topic on load (seeds cross-tool nav).
    const focusTopic = new URLSearchParams(location.search).get('topic');
    if (focusTopic && byId[focusTopic]) pinNode(focusTopic);
```

Note: `byId` and `pinNode` are in scope at this point (both declared inside `buildAndShow`, but this line runs after the first `buildAndShow` call, which stashes them the same way `goToDay` is stashed via `window.__goToDay`). If `byId`/`pinNode` are NOT reachable here because they are inner to `buildAndShow`, stash them at the end of `buildAndShow` exactly like the existing `window.__goToDay = goToDay;` idiom (around line 1666): add `window.__pinNode = pinNode; window.__byId = byId;` inside `buildAndShow`, then use `window.__byId[focusTopic]` and `window.__pinNode(focusTopic)` here.

- [ ] **Step 5: Verify the module logic still passes**

Run: `npx vitest run public/planmap/ready-derive.test.mjs`
Expected: PASS (unchanged — this task did not touch the module).

- [ ] **Step 6: Eyeball the plan-map (required by the visual-inspection rule)**

Start the plan-map: `preview_start planmap` (port 5183), open `/Aralia/planmap/index.html`.
Confirm: the map renders, ▶ READY green outlines/badges and ★ FOCUS badges appear on the same tiles as before this change. Then open `/Aralia/planmap/index.html?topic=world-props` and confirm that topic is pinned/opened on load.

- [ ] **Step 7: Commit**

```bash
git add public/planmap/index.html
git commit -m "refactor(planmap): use shared ready-derive module; add ?topic= focus"
```

---

## Task 3: Roadmap node type + generator tag

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-server-logic.ts:28-45`
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`
- Test: `devtools/roadmap/scripts/roadmap-engine/planmap-tag.test.ts`

**Interfaces:**
- Produces:
  - `RoadmapNode` gains optional `planmapTopic?: string`, `planmapStatus?: string`, `planmapReady?: boolean`, `planmapFocus?: boolean`.
  - `PLANMAP_TOPIC_BY_NODE_ID: Record<string, string>` — maps a roadmap node id to a plan-map topic id.
  - `attachPlanmapTopic<T extends { id: string }>(node: T, map: Record<string, string>): T` — returns the node with `planmapTopic` set when `map[node.id]` exists, unchanged otherwise.

- [ ] **Step 1: Add the type fields**

In `devtools/roadmap/scripts/roadmap-server-logic.ts`, inside the `RoadmapNode` type (between `hasMedia?` on line 43 and the `[key: string]: unknown;` index signature on line 44), add:

```ts
  // Plan-map projection (set at generate/overlay time; see planmap-overlay.ts).
  planmapTopic?: string;   // baked by the generator from PLANMAP_TOPIC_BY_NODE_ID
  planmapStatus?: string;  // raw plan-map status word, set by the runtime overlay
  planmapReady?: boolean;  // computed by the runtime overlay
  planmapFocus?: boolean;  // computed by the runtime overlay
```

- [ ] **Step 2: Write the failing test for `attachPlanmapTopic`**

Create `devtools/roadmap/scripts/roadmap-engine/planmap-tag.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { attachPlanmapTopic, PLANMAP_TOPIC_BY_NODE_ID } from './generate';

describe('attachPlanmapTopic', () => {
  it('adds planmapTopic when the node id is in the map', () => {
    const map = { node_a: 'topic-x' };
    expect(attachPlanmapTopic({ id: 'node_a', label: 'A' }, map))
      .toEqual({ id: 'node_a', label: 'A', planmapTopic: 'topic-x' });
  });

  it('leaves the node unchanged when the id is not mapped', () => {
    const map = { node_a: 'topic-x' };
    const node = { id: 'node_b', label: 'B' };
    expect(attachPlanmapTopic(node, map)).toEqual(node);
  });

  it('exports a map object', () => {
    expect(typeof PLANMAP_TOPIC_BY_NODE_ID).toBe('object');
  });
});
```

- [ ] **Step 2b: Run it to verify it fails**

Run: `npx vitest run devtools/roadmap/scripts/roadmap-engine/planmap-tag.test.ts`
Expected: FAIL — `attachPlanmapTopic` / `PLANMAP_TOPIC_BY_NODE_ID` not exported.

- [ ] **Step 3: Add the map + helper to `generate.ts`**

In `devtools/roadmap/scripts/roadmap-engine/generate.ts`, near `CURATED_SUBFEATURES` (line 42), add:

```ts
// Plan-map projection: which roadmap node (by generated node id) mirrors which
// plan-map topic. Keyed by node id because the id is stable and unique; find a
// node's id from the live /Aralia/api/roadmap/data payload, or by the deterministic
// formula sub_<slug(pillarNodeId)>_<slug(stableLabel)>. Start empty; wire entries in
// as they are curated. The roadmap only READS the plan-map — never the reverse.
export const PLANMAP_TOPIC_BY_NODE_ID: Record<string, string> = {
  // 'sub_pillar_rendering_beautification_wave': 'world-props',
};

// Returns the node with planmapTopic set when its id is mapped; unchanged otherwise.
export const attachPlanmapTopic = <T extends { id: string }>(
  node: T,
  map: Record<string, string> = PLANMAP_TOPIC_BY_NODE_ID
): T => (map[node.id] ? { ...node, planmapTopic: map[node.id] } : node);
```

- [ ] **Step 4: Wrap the node push sites**

In the same file, wrap each of the three `nodes.push({...})` object literals with `attachPlanmapTopic(...)`.

Milestone node (line 2791) — change `nodes.push({` ... `});` to `nodes.push(attachPlanmapTopic({` ... `}));`. Concretely, line 2791 becomes:

```ts
        nodes.push(attachPlanmapTopic({
          id: subId,
          label: sub.name,
          type: 'milestone',
          category: NODE_CATEGORIES.feature,
          sourceKind: 'registry',
          feature: feature.feature,
          featureCategory: pillar.label,
          status: sub.state,
          initialX: x - 180 + (subIndex % 3) * 180,
          initialY: y + 170 + Math.floor(subIndex / 3) * 120,
          color: DOMAIN_COLORS.default,
          description: buildSubfeatureDescription(sub.name, canonicalDocs),
          sourceDocs,
          canonicalDocs,
          componentFiles,
          link: canonicalDocs[0]
        }));
```

Apply the identical `attachPlanmapTopic(...)` wrap to the project node push (line 2695) and the root node push (line 2645). Each is just `nodes.push(attachPlanmapTopic({ ... }));`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run devtools/roadmap/scripts/roadmap-engine/planmap-tag.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check the generator still builds**

Run: `npx tsc -p devtools/roadmap/tsconfig.json --noEmit` (if that tsconfig exists) or `npm run build` per repo convention. If neither is set up for this subtree, at minimum run the full test suite for this file's neighbors: `npx vitest run devtools/roadmap/scripts/roadmap-server-logic.test.ts`.
Expected: no type errors from the new fields or wraps.

- [ ] **Step 7: Commit**

```bash
git add devtools/roadmap/scripts/roadmap-server-logic.ts devtools/roadmap/scripts/roadmap-engine/generate.ts devtools/roadmap/scripts/roadmap-engine/planmap-tag.test.ts
git commit -m "feat(roadmap): add planmapTopic node tag + generator wiring"
```

---

## Task 4: Overlay + status mapping (pure)

**Files:**
- Create: `devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.ts`
- Test: `devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.test.ts`

**Interfaces:**
- Consumes: `isActionable`, `isDead` from `public/planmap/ready-derive.mjs` (Task 1); `RoadmapNode` from `../../../../../../../scripts/roadmap-server-logic` (verify the relative depth when creating the file; `roadmap-server-logic.ts` lives at `devtools/roadmap/scripts/`).
- Produces:
  - `mapPlanmapStatusToBase(status: string): 'planned' | 'active' | 'done'` — `done→done`, `active→active`, everything else (`specced`/`parked`/`superseded`)→`planned`.
  - `applyPlanmapOverlay(nodes: RoadmapNode[], topics: PlanmapTopic[] | null): RoadmapNode[]` — for each node with a `planmapTopic` that resolves, set `planmapStatus`, `planmapReady`, `planmapFocus`, and base `status`. Nodes without a tag, or whose tag does not resolve, are returned unchanged. `null` topics returns nodes unchanged.
  - `type PlanmapTopic = { id: string; status: string; focus?: boolean; deps?: unknown[]; features?: unknown[] }`.

- [ ] **Step 1: Write the failing test**

Create `devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyPlanmapOverlay, mapPlanmapStatusToBase } from './planmap-overlay';

const topics = [
  { id: 'done-topic', status: 'done', deps: [] },
  { id: 'active-topic', status: 'active', deps: [] },
  { id: 'ready-topic', status: 'parked', deps: [], focus: true },
  { id: 'blocked-topic', status: 'parked', deps: [{ id: 'active-topic', kind: 'hard' }] },
];

describe('mapPlanmapStatusToBase', () => {
  it('maps the five plan-map states to the three roadmap states', () => {
    expect(mapPlanmapStatusToBase('done')).toBe('done');
    expect(mapPlanmapStatusToBase('active')).toBe('active');
    expect(mapPlanmapStatusToBase('specced')).toBe('planned');
    expect(mapPlanmapStatusToBase('parked')).toBe('planned');
    expect(mapPlanmapStatusToBase('superseded')).toBe('planned');
  });
});

describe('applyPlanmapOverlay', () => {
  it('returns nodes unchanged when topics is null', () => {
    const nodes = [{ id: 'n1', label: 'N1', type: 'milestone', status: 'planned', planmapTopic: 'done-topic' }] as any;
    expect(applyPlanmapOverlay(nodes, null)).toEqual(nodes);
  });

  it('leaves an untagged node untouched', () => {
    const node = { id: 'n1', label: 'N1', type: 'milestone', status: 'active' } as any;
    const [out] = applyPlanmapOverlay([node], topics as any);
    expect(out).toEqual(node);
  });

  it('overlays raw status, base status, and focus for a done topic', () => {
    const node = { id: 'n1', label: 'N1', type: 'milestone', status: 'planned', planmapTopic: 'done-topic' } as any;
    const [out] = applyPlanmapOverlay([node], topics as any);
    expect(out.planmapStatus).toBe('done');
    expect(out.status).toBe('done');
    expect(out.planmapReady).toBe(false); // done is not "ready to start"
    expect(out.planmapFocus).toBe(false);
  });

  it('marks READY and FOCUS for an actionable focused topic', () => {
    const node = { id: 'n2', label: 'N2', type: 'milestone', status: 'planned', planmapTopic: 'ready-topic' } as any;
    const [out] = applyPlanmapOverlay([node], topics as any);
    expect(out.planmapStatus).toBe('parked');
    expect(out.status).toBe('planned');
    expect(out.planmapReady).toBe(true);
    expect(out.planmapFocus).toBe(true);
  });

  it('a blocked topic is not READY', () => {
    const node = { id: 'n3', label: 'N3', type: 'milestone', status: 'planned', planmapTopic: 'blocked-topic' } as any;
    const [out] = applyPlanmapOverlay([node], topics as any);
    expect(out.planmapReady).toBe(false);
  });

  it('leaves a node whose planmapTopic does not resolve unchanged', () => {
    const node = { id: 'n4', label: 'N4', type: 'milestone', status: 'active', planmapTopic: 'ghost-topic' } as any;
    const [out] = applyPlanmapOverlay([node], topics as any);
    expect(out).toEqual(node);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.ts`. First confirm the two relative import paths from this file:
- to `public/planmap/ready-derive.mjs`: seven levels up to repo root, then down — `../../../../../../../public/planmap/ready-derive.mjs`.
- to `roadmap-server-logic.ts` (at `devtools/roadmap/scripts/`): `../../../../scripts/roadmap-server-logic`.

```ts
import type { RoadmapNode } from '../../../../scripts/roadmap-server-logic';
// One home for the READY rule — shared with the plan-map viewer and vitest.
import { isActionable, isDead } from '../../../../../../../public/planmap/ready-derive.mjs';

export type PlanmapTopic = {
  id: string;
  status: string;
  focus?: boolean;
  deps?: unknown[];
  features?: unknown[];
};

// Plan-map has five states; the roadmap colors three. The raw word is preserved
// separately in planmapStatus so no fidelity is lost.
export const mapPlanmapStatusToBase = (status: string): 'planned' | 'active' | 'done' => {
  if (status === 'done') return 'done';
  if (status === 'active') return 'active';
  return 'planned'; // specced | parked | superseded
};

export const applyPlanmapOverlay = (
  nodes: RoadmapNode[],
  topics: PlanmapTopic[] | null
): RoadmapNode[] => {
  if (!topics) return nodes;
  const byId: Record<string, PlanmapTopic> = Object.fromEntries(topics.map((t) => [t.id, t]));
  return nodes.map((node) => {
    const topicId = node.planmapTopic;
    if (!topicId) return node;
    const topic = byId[topicId];
    if (!topic) return node; // unresolved tag — leave the node as-is
    return {
      ...node,
      planmapStatus: topic.status,
      planmapReady: !isDead(topic) && isActionable(topic, byId),
      planmapFocus: topic.focus === true,
      status: mapPlanmapStatusToBase(topic.status),
    };
  });
};
```

Note: `isActionable` already returns `false` for a dead topic, so `!isDead(topic) &&` is belt-and-suspenders and keeps the intent explicit.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.test.ts`
Expected: PASS. If the `.mjs` import fails to resolve under Vitest, correct the `../` depth (count from `modules/` to repo root) and re-run — do not change the module's logic.

- [ ] **Step 5: Commit**

```bash
git add devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.ts devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.test.ts
git commit -m "feat(roadmap): pure plan-map status overlay + status mapping"
```

---

## Task 5: Loader fetches topics.json; viewer applies overlay

**Files:**
- Modify: `devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.ts:69-97`
- Modify: `devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.test.ts`
- Modify: `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx` (the load `useEffect`, lines 785-803)

**Interfaces:**
- Consumes: `applyPlanmapOverlay` (Task 4).
- Produces: `RoadmapBootstrapResult` gains `planmapTopics: PlanmapTopic[] | null`.

- [ ] **Step 1: Extend the loader test**

In `devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.test.ts`, add a test that the loader fetches topics.json non-fatally and returns parsed topics. Follow the existing `vi.stubGlobal('fetch', ...)` style already in that file:

```ts
it('fetches topics.json and returns parsed planmapTopics', async () => {
  const topics = { topics: [{ id: 'a', status: 'done' }] };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/roadmap/data')) return { ok: true, json: async () => ({ version: '1', root: 'r', nodes: [], edges: [] }) } as any;
    if (url.includes('/planmap/topics.json')) return { ok: true, json: async () => topics } as any;
    return { ok: true, json: async () => ({}) } as any; // layout, labels
  }));
  const result = await loadRoadmapBootstrapData();
  expect(result.planmapTopics).toEqual(topics.topics);
});

it('tolerates a missing topics.json (returns null planmapTopics)', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/roadmap/data')) return { ok: true, json: async () => ({ version: '1', root: 'r', nodes: [], edges: [] }) } as any;
    if (url.includes('/planmap/topics.json')) throw new Error('network');
    return { ok: true, json: async () => ({}) } as any;
  }));
  const result = await loadRoadmapBootstrapData();
  expect(result.planmapTopics).toBeNull();
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.test.ts`
Expected: FAIL — `planmapTopics` is undefined.

- [ ] **Step 3: Add the fetch + return field**

In `roadmap-bootstrap-loader.ts`, add `PlanmapTopic` import and extend the result type (lines 55-59):

```ts
import type { PlanmapTopic } from './planmap-overlay';

export type RoadmapBootstrapResult = {
  data: RoadmapData;
  layout: LayoutPositions;
  labelOverrides: Record<string, string>;
  planmapTopics: PlanmapTopic[] | null;
};
```

Add a 4th fetch to the `Promise.all` (lines 72-76), non-fatal like layout/labels:

```ts
  const [dataRes, layoutRes, labelsRes, topicsRes] = await Promise.all([
    fetch('/Aralia/api/roadmap/data', fetchOpts),
    fetch('/Aralia/api/roadmap/layout', fetchOpts).catch(() => null),
    fetch('/Aralia/api/roadmap/labels', fetchOpts).catch(() => null),
    fetch('/Aralia/planmap/topics.json', fetchOpts).catch(() => null),
  ]);
```

Before the `return`, parse topics defensively:

```ts
  let planmapTopics: PlanmapTopic[] | null = null;
  if (topicsRes?.ok) {
    try {
      const parsed = await topicsRes.json();
      planmapTopics = Array.isArray(parsed?.topics) ? parsed.topics : null;
    } catch {
      planmapTopics = null;
    }
  }
```

Add `planmapTopics` to the returned object.

- [ ] **Step 4: Apply the overlay in the viewer**

In `RoadmapVisualizer.tsx`, import the overlay (near line 87 where the loader is imported):

```ts
import { applyPlanmapOverlay } from './modules/planmap-overlay';
```

In the load `useEffect` (lines 785-803), change the destructure + `setData`:

```ts
      const { data, layout, labelOverrides, planmapTopics } = await loadRoadmapBootstrapData(controller.signal);
      setData({ ...data, nodes: applyPlanmapOverlay(data.nodes, planmapTopics) });
```

- [ ] **Step 5: Run to verify tests pass**

Run: `npx vitest run devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.test.ts`
Expected: PASS (including the pre-existing "passes the AbortSignal to every fetch call" test, which asserts `signals.length >= 3` — a 4th fetch still satisfies it).

- [ ] **Step 6: Commit**

```bash
git add devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.ts devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.test.ts devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx
git commit -m "feat(roadmap): fetch topics.json and overlay plan-map status on load"
```

---

## Task 6: Render status pill + READY/FOCUS badges

**Files:**
- Modify: `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx` (branch card status row, lines 3384-3401; and the `graph.nodes` transform if it does not already carry `planmap*` fields).

This is a visual change with no unit test; verify by rendering (visual-inspection rule).

- [ ] **Step 1: Confirm the overlay fields reach the render**

Search `RoadmapVisualizer.tsx` for where `graph` / `graph.nodes` is derived from `data.nodes` (the render at line 3214 maps `graph.nodes`). Confirm each rendered node object carries `planmapStatus`/`planmapReady`/`planmapFocus`. If the transform copies fields explicitly (not a spread), add the four `planmap*` fields to it. If it spreads the source node, no change is needed.

- [ ] **Step 2: Render the plan-map status pill and badges**

In the branch card status row (around line 3386, next to the existing status pill), add — after the existing `<span ...>{node.status}</span>`:

```tsx
{node.planmapStatus && (
  <span className={`text-[10px] uppercase border rounded-full px-1.5 py-0.5 font-semibold ${statusChipClass(mapPlanmapBaseForChip(node.planmapStatus), isDark)}`}>
    {node.planmapStatus}
  </span>
)}
{node.planmapReady && (
  <span className="text-[10px] font-semibold" style={{ color: '#4ade80' }}>▶ READY</span>
)}
{node.planmapFocus && (
  <span className="text-[10px] font-semibold" style={{ color: '#fbbf24' }}>★ FOCUS</span>
)}
```

Add a tiny local helper near `statusChipClass` (line 189) so the pill can color the raw word using the existing chip classes:

```ts
const mapPlanmapBaseForChip = (raw: string): 'done' | 'active' | 'planned' =>
  raw === 'done' ? 'done' : raw === 'active' ? 'active' : 'planned';
```

(Reuse `mapPlanmapStatusToBase` from `planmap-overlay.ts` instead if you prefer a single mapping home — import it and call it here. Either is acceptable; do not define two diverging mappings.)

- [ ] **Step 3: Eyeball the roadmap**

Start the roadmap dev server (`dev:roadmap`, port 3010), open `/Aralia/devtools/roadmap/roadmap.html`. Temporarily add one real entry to `PLANMAP_TOPIC_BY_NODE_ID` (Task 3) pointing a known node id at a known topic (e.g. an `active` topic), reload, and confirm: the plan-map status pill shows the raw word, and READY/FOCUS badges appear for a ready/focused topic. Remove the temporary entry (or keep it if it is a genuinely correct mapping).

- [ ] **Step 4: Commit**

```bash
git add devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx
git commit -m "feat(roadmap): show plan-map status pill + READY/FOCUS badges"
```

---

## Task 7: Refresh button

**Files:**
- Modify: `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx` (drawer action row near line 1921; reuse the existing refresh pattern at lines 1640-1649).

- [ ] **Step 1: Add a refresh handler**

Near the existing data-refresh code (lines 1640-1649), add a handler that re-fetches both the roadmap data and topics.json and re-applies the overlay. Match the file's existing hook-import style — if hooks are named imports (`import { useCallback } from 'react'`), use `useCallback(...)`; if the file uses the `React.` namespace, use `React.useCallback(...)`:

```ts
const refreshPlanmapStatus = useCallback(async () => {
  const [dataRes, topicsRes] = await Promise.all([
    fetch('/Aralia/api/roadmap/data'),
    fetch('/Aralia/planmap/topics.json').catch(() => null),
  ]);
  const fresh = await dataRes.json();
  let topics = null;
  if (topicsRes && topicsRes.ok) {
    try { const p = await topicsRes.json(); topics = Array.isArray(p?.topics) ? p.topics : null; } catch { topics = null; }
  }
  setData({ ...fresh, nodes: applyPlanmapOverlay(fresh.nodes, topics) });
}, []);
```

- [ ] **Step 2: Add the button to the drawer action row**

In the drawer action row (near line 1921, alongside `Expand All` / `Collapse All`), add:

```tsx
<button type="button" onClick={() => void refreshPlanmapStatus()} className="/* match the sibling buttons' classes */">
  Refresh status
</button>
```

Copy the exact className from the neighboring `Expand All` button so it matches the toolbar styling.

- [ ] **Step 3: Eyeball**

Reload the roadmap. Change a topic's status in `public/planmap/topics.json` (e.g. flip one to `done`), click **Refresh status**, and confirm the matching node's pill updates without a full page reload.

- [ ] **Step 4: Commit**

```bash
git add devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx
git commit -m "feat(roadmap): add on-demand Refresh status button"
```

---

## Task 8: Validator

**Files:**
- Create: `devtools/roadmap/scripts/roadmap-validate-planmap-links.ts`
- Modify: `package.json` (add `roadmap:validate-planmap` script)
- Test: `devtools/roadmap/scripts/roadmap-validate-planmap-links.test.ts`

**Interfaces:**
- Produces: `checkPlanmapLinks(nodes: { id: string; planmapTopic?: string }[], topics: { id: string }[]): { errors: string[]; warnings: string[] }` — errors for each `planmapTopic` naming a topic id absent from `topics`; warnings for each topic id no node claims.

- [ ] **Step 1: Write the failing test**

Create `devtools/roadmap/scripts/roadmap-validate-planmap-links.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkPlanmapLinks } from './roadmap-validate-planmap-links';

describe('checkPlanmapLinks', () => {
  it('errors when a node points at an unknown topic', () => {
    const { errors } = checkPlanmapLinks([{ id: 'n1', planmapTopic: 'ghost' }], [{ id: 'real' }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('ghost');
  });

  it('warns about topics no node claims', () => {
    const { warnings } = checkPlanmapLinks([{ id: 'n1', planmapTopic: 'real' }], [{ id: 'real' }, { id: 'lonely' }]);
    expect(warnings.some((w) => w.includes('lonely'))).toBe(true);
    expect(warnings.some((w) => w.includes('real'))).toBe(false);
  });

  it('is clean when every tag resolves and every topic is claimed', () => {
    const { errors, warnings } = checkPlanmapLinks([{ id: 'n1', planmapTopic: 'real' }], [{ id: 'real' }]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run devtools/roadmap/scripts/roadmap-validate-planmap-links.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the validator**

Create `devtools/roadmap/scripts/roadmap-validate-planmap-links.ts`:

```ts
import fs from 'fs';
import path from 'path';
import { generateRoadmapData } from './roadmap-server-logic';

export const checkPlanmapLinks = (
  nodes: { id: string; planmapTopic?: string }[],
  topics: { id: string }[]
): { errors: string[]; warnings: string[] } => {
  const topicIds = new Set(topics.map((t) => t.id));
  const claimed = new Set<string>();
  const errors: string[] = [];
  for (const n of nodes) {
    if (!n.planmapTopic) continue;
    claimed.add(n.planmapTopic);
    if (!topicIds.has(n.planmapTopic)) {
      errors.push(`node "${n.id}" points at unknown plan-map topic "${n.planmapTopic}"`);
    }
  }
  const warnings = topics
    .filter((t) => !claimed.has(t.id))
    .map((t) => `plan-map topic "${t.id}" is not claimed by any roadmap node`);
  return { errors, warnings };
};

// CLI entry: only runs when invoked directly, not when imported by the test.
const isMain = process.argv[1] && process.argv[1].endsWith('roadmap-validate-planmap-links.ts');
if (isMain) {
  const topicsPath = path.resolve(process.cwd(), 'public/planmap/topics.json');
  const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8')).topics as { id: string }[];
  const data = generateRoadmapData();
  const { errors, warnings } = checkPlanmapLinks(data.nodes, topics);
  warnings.forEach((w) => console.warn('  ~ ' + w));
  errors.forEach((e) => console.error('  ✗ ' + e));
  console.log(`planmap-links: ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length) process.exit(1);
}
```

- [ ] **Step 4: Add the npm script**

In root `package.json`, in the `roadmap:*` group, add:

```json
    "roadmap:validate-planmap": "tsx devtools/roadmap/scripts/roadmap-validate-planmap-links.ts",
```

Use the same runner (`tsx` / `ts-node` / `vite-node`) the sibling `roadmap:*` scripts use — copy the exact invocation prefix from a neighboring script such as `roadmap:audit-all`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run devtools/roadmap/scripts/roadmap-validate-planmap-links.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the validator end-to-end**

Run: `npm run roadmap:validate-planmap`
Expected: prints a warning per unclaimed topic (many, since the map starts near-empty), 0 errors, exit 0. This is the coverage worklist for wiring `PLANMAP_TOPIC_BY_NODE_ID`.

- [ ] **Step 7: Commit**

```bash
git add devtools/roadmap/scripts/roadmap-validate-planmap-links.ts devtools/roadmap/scripts/roadmap-validate-planmap-links.test.ts package.json
git commit -m "feat(roadmap): validate planmapTopic links (unknown-topic error, unclaimed warning)"
```

---

## Final verification

- [ ] **Run the full affected test set**

Run:
```
npx vitest run public/planmap/ready-derive.test.mjs devtools/roadmap/src/components/debug/roadmap/modules/planmap-overlay.test.ts devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.test.ts devtools/roadmap/scripts/roadmap-engine/planmap-tag.test.ts devtools/roadmap/scripts/roadmap-validate-planmap-links.test.ts
```
Expected: all green.

- [ ] **End-to-end eyeball**

With `PLANMAP_TOPIC_BY_NODE_ID` holding at least one real mapping: open the roadmap, confirm the mapped node shows the plan-map's status word + READY/FOCUS badge; flip that topic's status in `topics.json`; click **Refresh status**; confirm the node updates. Open the plan-map and confirm it is unchanged in behavior (badges still correct) and that `?topic=<id>` focuses a topic.

## Notes for Part B (separate plan, after this ships)

Part B (jump / embed / peek between the two tools) builds directly on this plan's outputs: the `planmapTopic` mapping, the shared `ready-derive.mjs`, and the `?topic=` deep link already added in Task 2. It adds the reverse `?planmapTopic=` / `?peek=` URL modes, jump buttons, an iframe embed panel, a picture-in-picture peek card, and a `postMessage` focus channel (same-origin, full app dev server only). It will be written as its own plan once Part A is built, so its iframe/postMessage code is written against the real, shipped fields rather than speculatively.
