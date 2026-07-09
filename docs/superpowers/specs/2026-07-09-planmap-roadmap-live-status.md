# Live plan-map status on the feature-tree roadmap

**Date:** 2026-07-09
**Status:** Design approved, spec under review
**Owner:** Remy (design), agent (build)

## Problem

Aralia has two planning viewers. The **plan-map** (`public/planmap/`, port 5183) is the
curated "what's next and in what order" view — about ten topics with dependency
arrows, and honest status kept truthful by `planmap-reconcile.mjs`. The
**feature-tree roadmap** (`devtools/roadmap/`, port 3010) is the big inventory
view — about 200 capability nodes. The roadmap's own status counters are
known-rotted, so its "At A Glance" card was relabeled "Inventory — presence, not
progress."

We want the roadmap to show the plan-map's honest status, and to do it **live** —
so that when work moves forward on the plan-map, the roadmap reflects it without a
regenerate step.

## Goal

For any roadmap node that corresponds to a plan-map topic, display the plan-map's
current status and readiness, read live from the plan-map's data file. Leave every
other roadmap node exactly as it is today.

## Principle: one truth plus projections

The plan-map's `public/planmap/topics.json` stays the **sole owner** of topic
status. The roadmap only **displays** that status. Data flows one direction only:
plan-map to roadmap. The roadmap never writes back into `topics.json`. This keeps
the rule that stopped the plan-map from rotting the way the feature-tree did —
status has exactly one editable home.

The forbidden coupling is the reverse direction (roadmap or the gap swamp feeding
the plan-map). This design does not do that and must never be extended to.

## Architecture: baked structure, live status

The design splits along how often a fact changes.

**Baked (structural, changes rarely) — written into `roadmap.json` at generate time:**

- Each curated roadmap node may carry an optional `planmapTopic: "<topic-id>"`
  tag. It names the plan-map topic whose status this node should mirror. A node
  with no tag behaves exactly as today.

**Live (status, moves with the work) — computed in the browser at load:**

- When the roadmap app loads, it fetches `topics.json` directly, builds an
  id-to-topic map, and computes a status overlay for each tagged node.
- A **Refresh** button in the roadmap toolbar re-fetches `topics.json` and
  recomputes the overlay in place, with no page reload.

No polling and no live socket. The roadmap reflects the plan-map every time it is
opened or refreshed, plus on demand via the button.

## Data flow

```
Agora board ──► planmap-reconcile ──► topics.json ──► roadmap browser overlay
 (work items)   (keeps status honest)  (the one truth)  (live projection)

roadmap generator ──► roadmap.json (node tree + planmapTopic tags — baked once)
```

The generator bakes the *mapping*. The browser reads the *status*. The two meet at
render time.

## Components

### 1. Shared readiness module (`public/planmap/ready-derive.mjs`)

The "is this topic actionable now" rule currently lives inside the plan-map viewer
(`public/planmap/index.html`, the `isActionable` function). It is not trivial: it
treats a `chosen` dependency as non-blocking, treats a dependency pointing at a
`done` or `superseded` topic as satisfied, and supports feature-targeted
dependencies (a dep may point at one feature of a topic rather than the whole
topic).

Extract that logic into a dual-use pure module, following the existing
`public/planmap/history-derive.mjs` pattern (loadable as an ES module in the
browser, importable by the roadmap app, and testable under vitest).

The module exposes at least:

- `isDead(topic)` — status is `done` or `superseded`.
- `isActionable(topic, byId, helpers)` — the READY predicate: the topic is alive
  and every hard dependency is satisfied. Matches the current `index.html`
  behavior exactly, including feature-targeted deps and the fall-back to
  whole-topic when a feature slug does not resolve.

The plan-map viewer is refactored to import this module instead of defining the
predicate inline, so "what counts as ready" has one home. The roadmap overlay
imports the same module.

### 2. Generator tag (`devtools/roadmap/scripts/roadmap-engine/generate.ts`)

Allow a curated node entry to declare `planmapTopic: "<topic-id>"`. The generator
copies the tag verbatim onto the emitted `roadmap.json` node. The generator does
**not** read `topics.json` and does **not** bake any status — status is a runtime
concern now. The tag is the only new baked field.

### 3. Runtime overlay (roadmap app)

Extend the roadmap bootstrap loader
(`devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.ts`)
to also fetch `topics.json` as a fourth parallel dataset, honoring the existing
`AbortSignal` used for React StrictMode cleanup.

Add a pure overlay function, tested in isolation:

```
applyPlanmapOverlay(nodes, topicsData) -> nodes
```

For each node with a `planmapTopic` that resolves to a topic, it sets:

- `planmapStatus` — the raw plan-map status string (`parked` | `specced` |
  `active` | `done` | `superseded`), kept verbatim so no fidelity is lost.
- `planmapReady` — `isActionable(topic, ...)` from the shared module.
- `planmapFocus` — the topic's `focus === true`.
- `status` — the node's base status, set by the mapping below so existing color
  logic keeps working.

A `planmapTopic` that does not resolve is left un-overlaid (the validator catches
this at author time; the runtime degrades quietly rather than crashing).

**Status mapping (plan-map to the roadmap's three-state base):**

| plan-map `status` | roadmap base `status` |
| --- | --- |
| `done` | `done` |
| `active` | `active` |
| `specced` | `planned` |
| `parked` | `planned` |
| `superseded` | `planned` |

The raw word is always preserved in `planmapStatus`, so the viewer can show the
richer label even where the base collapses to `planned`.

### 4. Viewer (`RoadmapVisualizer.tsx`)

- Where a node has `planmapStatus`, the status pill reads that word.
- Render a **▶ READY** badge when `planmapReady`, and a **★ FOCUS** badge when
  `planmapFocus`, reusing the plan-map's green (`#4ade80`) so the two tools read
  as one system.
- Add a **Refresh** button to the toolbar. It re-fetches `topics.json` and re-runs
  `applyPlanmapOverlay` on the current node set, updating the badges and pills
  without a reload.
- Nodes with no overlay are visually unchanged.

### 5. Validator

Extend the roadmap's generate-time validation:

- **Error:** a `planmapTopic` that names a topic id absent from `topics.json`
  (typo or rename guard).
- **Warning:** plan-map topics that no roadmap node claims — the reverse of the
  plan-map's existing DISCONNECTED list, so coverage gaps are visible.

## Fetch path

`topics.json` is served by the same Vite server the roadmap runs under (Vite root
is the repo, so `public/planmap/topics.json` is served at `planmap/topics.json`
under the app base). The loader resolves the fetch against the app's base path.
Confirm the resolved URL during implementation; treat any base-path mismatch as an
implementation detail to fix, not a design change.

## Edge cases

- **Many nodes to one topic.** Several roadmap nodes may tag the same
  `planmapTopic`; each does its own lookup. Allowed and expected.
- **One node to one topic.** A node carries a single `planmapTopic` string, not a
  list. A node mirrors at most one topic.
- **Superseded topic.** Overlay still applies; the base status collapses to
  `planned` while `planmapStatus` shows `superseded`. It is never READY (it is
  dead).
- **`topics.json` fails to load.** The overlay is skipped; nodes render with their
  baked inventory status. The roadmap never hard-fails because the plan-map file
  is missing.

## Testing

All new logic is pure and unit-tested:

- **Shared readiness module:** parity tests against the current `index.html`
  behavior — chosen dep non-blocking, hard dep at `done` satisfied, hard dep at
  `superseded` satisfied, hard dep still open not ready, feature-targeted dep
  satisfied when that feature is dead, unresolved feature slug falls back to whole
  topic, a dead topic is never actionable.
- **Overlay function:** status mapping for all five plan-map states, READY and
  FOCUS pass-through, unresolved `planmapTopic` left un-overlaid, many-to-one
  mapping.
- **Validator:** error on unknown topic id, warning list for unclaimed topics.

## Out of scope

- No writes back to `topics.json` from the roadmap. Ever.
- No auto-refresh polling or live socket (explicitly deferred; the Refresh button
  covers on-demand sync).
- No change to the plan-map's data model — `topics.json` gains no new fields.
- No merge of the two viewers and no injection of plan-map topics as new roadmap
  nodes; this design only overlays status onto nodes that already exist.
- No fix to the roadmap's non-overlaid inventory counters; that rot is a separate,
  already-recorded issue.

## Open questions

None outstanding — all design decisions are settled.
