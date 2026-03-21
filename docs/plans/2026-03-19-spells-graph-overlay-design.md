# Spells Dynamic Graph Overlay — Design

**Date:** 2026-03-19
**Status:** Approved

> **IMPLEMENTED** — 2026-03-20. All items below were built as specified with one notable deviation: the `virtualNodes` derivation was originally a hardcoded 3-tier loop (depth 1→2→3→4→5). It was refactored to a **recursive `buildChildren(parentId, choices, depth)` inner function** inside a `useMemo`, guarded by `MAX_DEPTH = 14`, enabling unlimited axis drill-down. The `SpellBranchNavigator` was updated to accept `initialChoices?: AxisChoice[]` so the graph overlay can seed it when the user clicks "Open in Spell Branch →".

---

## Goal

Add a **Spells** primary feature node to the roadmap graph that expands into a live, axis-engine-powered navigation tree. The tree mirrors the VSM (Value Stream Map) drill-down of the SpellBranchNavigator but is rendered natively on the roadmap canvas as real graph nodes. The existing Spell Branch tab is kept as-is; the graph overlay is additive.

---

## User Flow

```
Spells (project node)
└── Class (axis node)          ← 11 axis nodes total
    └── Wizard [42] (value)   ← count = live spell count for this path
        ├── Level (remaining discriminating axis)
        │   └── 3rd [8]
        │       ├── School (remaining axis)
        │       │   └── ...
        │       └── Show Spells          ← available at every value node
        │           ├── Magic Missile    ← actual spell entry nodes
        │           └── ...
        └── Show Spells
            ├── Fireball
            └── ...
```

- Axis nodes expand to show value nodes derived live from the axis engine.
- After picking a value, remaining **discriminating** axes appear as children (same VSM logic as SpellBranchNavigator — axes with only one remaining value are hidden).
- **Show Spells** is available at every value node, regardless of depth.
- Show Spells expands to show **all** matching spell entries as leaf nodes.
- Multiple branches can be open simultaneously (e.g. Class→Wizard and School→Evocation are independent open paths).

---

## Architecture

### Spells Project Node (Data)

One new entry added to the roadmap registry data, surfaced via `/api/roadmap/data`:

```json
{
  "id": "pillar_spells",
  "label": "Spells",
  "type": "project",
  "status": "active",
  "initialX": 900,
  "initialY": 400,
  "spellTree": true
}
```

The `spellTree: true` flag is the signal the Visualizer uses to activate the overlay instead of the normal branch expansion.

### SpellGraphOverlay Component

**File:** `devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx`

Lives inside the existing canvas pan/zoom wrapper in `RoadmapVisualizer.tsx`, as a sibling of the existing node/edge layers. Shares the same CSS transform so its nodes are native to the graph.

**Props:**
- `spellsProjectNode: RenderNode` — position and dimensions of the Spells project node
- `spells: SpellCanonicalProfile[]` — the full 469-profile array (loaded once)
- `side: 1 | -1` — which side of the trunk the project node sits on
- `isDark: boolean`
- `selectedVirtualId: string | null`
- `onVirtualNodeSelect: (id: string, detail: VirtualNodeDetail) => void`

**State:**
- `expandedVirtualIds: Set<string>` — which virtual nodes are currently open

### Virtual Node ID Scheme

IDs encode the full selection path so no separate selection state is needed:

| Node type | ID format | Example |
|---|---|---|
| Axis (top level) | `$spell:axis:{axisId}` | `$spell:axis:class` |
| Value (after axis pick) | `$spell:v:{k=v pairs}:axis:{axisId}` (parent path + new axis) | `$spell:v:class=Wizard:axis:level` |
| Value leaf | `$spell:v:{k=v pairs}` | `$spell:v:class=Wizard` |
| Show Spells | `$spell:v:{k=v pairs}:show` | `$spell:v:class=Wizard:show` |
| Spell entry | `$spell:v:{k=v pairs}:entry:{spellId}` | `$spell:v:class=Wizard:entry:fireball` |

Path segments are **sorted** (`class=Wizard:level=3` ≡ `level=3:class=Wizard`) so the same filtered set is always reached regardless of pick order.

### Axis Engine Integration

`SpellGraphOverlay` calls `computeAxisEngineResult(spells, choicesFromPath)` to derive:
- `availableAxes` — the discriminating axes to show as children of a value node
- `filteredSpells` — the spell list for a Show Spells expansion or count badges
- `spellCount` — shown on value nodes as `[42]`

`choicesFromPath(virtualNodeId)` parses the `k=v` pairs out of the node ID to reconstruct the `AxisChoice[]` array.

### Layout

Uses the same constants as the existing branch layout (`BRANCH_WIDTH`, `BRANCH_COL_DISTANCE`, `BRANCH_ROW_GAP`, `BRANCH_BASE_DISTANCE`). Column offset is computed from depth in the virtual tree. Nodes are stacked vertically, centred on the Spells project node's Y midpoint. The overlay renders its own edges (Bezier curves, same style as branch edges).

### Info Panel Integration

`RoadmapVisualizer` is extended to accept a `virtualDetail` alongside the existing `DetailEntry`. When a virtual node is selected:

| Node type | Panel content |
|---|---|
| Axis | Axis label + total spell count reachable through this axis |
| Value | Value label + filtered spell count + active selection path |
| Show Spells | Filtered spell count + **"Open in Spell Branch →"** button |
| Spell entry | Spell name, level, school, components, casting time, concentration, ritual |

The "Open in Spell Branch →" button switches the roadmap to the Spell Branch tab with the current path pre-applied as `AxisChoice[]`.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx` | **New** — the overlay component |
| `devtools/roadmap/src/spell-branch/virtual-node-id.ts` | **New** — ID encode/decode helpers |
| `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx` | Mount overlay, wire virtual node selection into info panel |
| `.agent/roadmap/` (registry data) | Add `pillar_spells` project node |
| `devtools/roadmap/src/spell-branch/types.ts` | Add `VirtualNodeDetail` type |

---

## Out of Scope

- Persisting the open/expanded virtual node state across page reloads.
- Position overrides (drag-to-reposition) for virtual nodes.
- Health signals / test badges on virtual nodes.
