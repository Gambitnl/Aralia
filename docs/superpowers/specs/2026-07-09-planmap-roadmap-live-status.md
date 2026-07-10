# Live plan-map status on the feature-tree roadmap, plus cross-tool navigation

**Date:** 2026-07-09
**Status:** Design approved, spec under review
**Owner:** Remy (design), agent (build)

This spec has two parts that share one mapping:

- **Part A — Live status.** The roadmap shows the plan-map's honest status, read
  live in the browser.
- **Part B — Cross-tool navigation.** The two tools become reachable from each
  other: jump between them, embed one inside the other, and peek at one from the
  other.

Part A is the foundation (it establishes the node-to-topic mapping). Part B builds
on that mapping and can be built after A.

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

## Part A components (live status)

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

## Part A testing

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

## Part B — cross-tool navigation

Make the two viewers reachable from each other: jump, embed, and peek. All three
compose from one primitive — deep-linkable, focusable viewers — so we build the
primitive once and get three behaviors.

### The knowledge stays one-directional

Only the roadmap knows the node-to-topic mapping (it already holds the
`planmapTopic` tags and the resolver from Part A). The plan-map never reads
`roadmap.json`. The plan-map only ever emits or receives a **topic id**; the
roadmap resolves that id to node(s). This keeps the plan-map ignorant of roadmap
internals, exactly as it is today, and keeps the mapping in one home.

### The primitive: URL modes

**Plan-map viewer (`public/planmap/index.html`) gains:**

- `?topic=<id>` — focus and pin that topic, reusing the existing pin and highlight
  behavior.
- `?peek=<id>` — a compact, chrome-less render of that topic's immediate
  neighborhood, sized to sit inside a small card.

**Roadmap app gains:**

- `?planmapTopic=<id>` — resolve to the matching node(s) via the Part A map, then
  pan to and highlight them. If no node claims the id, show a gentle "no roadmap
  node maps to this topic yet" state rather than an error.
- `?peek=<id>` — a compact, chrome-less render of the neighborhood of the node(s)
  that claim that topic id.

### 6. Jump between them

- A roadmap node with a `planmapTopic` shows an **Open in plan-map** action that
  navigates to `planmap/index.html?topic=<id>`.
- A plan-map topic shows an **Open in roadmap** action that navigates to
  `roadmap.html?planmapTopic=<id>`. The plan-map always offers the action and lets
  the roadmap handle the miss, so the plan-map never needs to read `roadmap.json`
  to know coverage.

Jump is plain navigation and works across the two dedicated ports.

### 7. Embed the other in a panel

- Each tool gains a toggle that opens a side panel (or modal) which iframes the
  other tool at the current focus URL — the roadmap embeds
  `planmap/index.html?topic=<current node's topic>`, the plan-map embeds
  `roadmap.html?planmapTopic=<current topic>`.
- **Live selection sync:** the parent posts a small `postMessage`
  (`{ type: 'focus', topicId }`) to the iframe when the selection changes; the
  embedded viewer focuses that item. The iframe may post back on its own selection
  so the parent can follow.

### 8. Picture-in-picture peek

- Selecting (or hovering, debounced) an item that has a counterpart shows a small
  corner card that iframes the other tool in `?peek=` mode for the matching item.
- Only items with a counterpart show a peek; items with no mapping show nothing
  extra.

### Same-origin constraint (embed and peek)

Jump links work across ports. Embed and peek need **same-origin** for the
`postMessage` sync, and the lean plan-map server (port 5183) cannot serve the
React roadmap. So embed and peek assume the full app dev server, which serves both
`planmap/` and `roadmap.html` from the repo root. Document this in each tool's
embed toggle (for example, disable the toggle with a tooltip when the tool detects
it is running under the lean static server).

### Part B testing

- **URL param parsing** for every new mode, in both viewers (pure).
- **Reverse resolution** `topicId -> nodeIds` on the roadmap side (pure), including
  the no-match case.
- **Peek neighborhood selection** — the pure function that picks which
  nodes/topics belong in a compact neighborhood.
- **postMessage handlers** are kept thin; the focus logic they call is the same
  pure code tested above.

## Out of scope

- No writes back to `topics.json` from the roadmap. Ever.
- No auto-refresh polling or live socket (explicitly deferred; the Refresh button
  covers on-demand sync).
- No change to the plan-map's data model — `topics.json` gains no new fields.
- No merge of the two viewers and no injection of plan-map topics as new roadmap
  nodes; Part A only overlays status onto nodes that already exist.
- **No blended-graph overlay.** Superimposing the plan-map's dependency arrows onto
  the roadmap's containment tree (or vice versa) is explicitly excluded — the two
  use deliberately different layouts, and merging them risks the drowned-tree
  problem. Cross-navigation (Part B) links and embeds the two; it never fuses their
  graphs into one picture.
- No fix to the roadmap's non-overlaid inventory counters; that rot is a separate,
  already-recorded issue.

## Open questions

None outstanding — all design decisions are settled.
