---
schema_version: 1
project: Submap and Tile-Grid Retirement
slug: submap
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-15
iteration: 6
confidence: high
evidence: "docs/projects/submap/DEPENDENCY_CONTRACT.md; src/components/MapPane.tsx; src/components/Submap/SubmapPane.tsx"
gap_signal: "11 open gaps; decoupling tile-grid world model, submap extraction, and cell-native travel seams."
protocol: living project doc set
next_step: "Inventory every load-bearing consumer of MapData.tiles + the Submap panes and record a retirement order."
agent_comments: "Upgraded on 2026-06-15 to encompass the retirement of the legacy rectangular tile-grid world model and Submap system."
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
  - DEPENDENCY_CONTRACT.md
required_verification:
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-15
workflow_gaps_reviewed: 2026-06-15
compaction_status: not_needed
lifecycle_status: pre-deprecation-extraction
deprecation_confidence: strong
deprecation_reason: superseded_by_azgaar_cartography_and_worldforge
canonical_owner: docs/projects/submap
human_decision_required: "no"
---
# Submap and Tile-Grid Retirement North Star

Status: active
Last updated: 2026-06-15

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Submap and Tile-Grid Retirement |
| Slug | submap |
| Category | Feature/UI Projects |
| Main category | Interface & Experience |
| Subcategory | Player UI Surfaces |
| Status | active |
| Last updated | 2026-06-15 |
| Confidence | high |
| Evidence | docs/projects/submap/DEPENDENCY_CONTRACT.md; src/components/MapPane.tsx; src/components/Submap/SubmapPane.tsx |
| Gap signal | 11 open gaps; decoupling tile-grid world model, submap extraction, and cell-native travel seams. |
| Protocol | living project doc set |
| Next step | Inventory every load-bearing consumer of MapData.tiles + the Submap panes and record a retirement order. |
| Required verification | docs_consistency |
| Completed verification | docs_consistency |
| Last proof | 2026-06-15 Project surface upgrade and decisions log refresh |
| Workflow gaps reviewed | 2026-06-15 |
| Agent comments | Upgraded on 2026-06-15 to encompass the retirement of the legacy rectangular tile-grid world model and Submap system. |
| Required docs | NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md, DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md |
| Optional docs | tasks/, architecture notes, migration notes, DEPENDENCY_CONTRACT.md |
| Compaction status | not_needed |
| Lifecycle status | pre-deprecation-extraction |
| Deprecation confidence | strong |
| Deprecation reason | superseded_by_azgaar_cartography_and_worldforge |
| Canonical owner | docs/projects/submap |
| Human decision required | no |

## Why This Project Exists

The Submap and Tile-Grid Retirement project manages the phase-out of Aralia's legacy 20x30 rectangular tile-grid world model (`MapData` tiles) and the Submap panes. It establishes the native Azgaar map (`MapPane`) as the canonical 2D world navigation surface. This project is a pre-deprecation extraction and retirement effort: the goal is to decouple dependent systems from the grid, extract necessary action/generation contracts, and unmount legacy views safely.

## Intended Outcome

A complete retirement of the old rectangular grid data and rendering models (including `gridSize`, tile discovery flags, `deriveAzgaarSeed`, and the Submap components) in favor of the Voronoi cell-based Azgaar map.
Per project safety guidelines (D21), legacy UI surfaces will be kept in-tree but unmounted (not hard-deleted) to preserve optionality and ease rollback/reference if needed.

## Current State

- The old square-grid hover readout and the amber "yellow square" target overlay in `MapPane.tsx` have been deprecated and removed.
- `MapPane.tsx` now highlights the hovered Voronoi cell and uses the `describeCell` bridge to output actual Azgaar cell data (biome, culture, state, religion, burgs).
- Still grid-coupled: `MapData.tiles` array, `gridSize` fields, tile discovery flags, `deriveAzgaarSeed` (hashes the tile grid), the Submap panes (`src/components/Submap/SubmapPane.tsx`), and the Enter-3D click handler which resolves to a grid cell coordinate.

### Live File Map

- `src/components/MapPane.tsx` - the canonical 2D map navigation surface.
- `src/components/Submap/SubmapPane.tsx` - legacy Submap container (retirement target).
- `src/components/Submap/SubmapTile.tsx` - legacy Submap tiles (retirement target).
- `src/utils/spatial/submapActionContracts.ts` - UI-independent action helpers with tests.
- `docs/projects/submap/DEPENDENCY_CONTRACT.md` - Submap and grid dependent matrix.
- `docs/projects/submap/DECISIONS.md` - decisions log (D-007 choice, D-008 Worldforge/travel seams).

### Scope Boundaries & Seams

- **Worldforge Placement**: Worldforge is the procedural world generator behind the scenes that generates deterministic L0-L4 datasets (atlas, region, local, ground, interior) from hierarchical seed paths. The player-facing 2D map (`MapPane`) is the visualization/navigation interface that displays the L0-L2 cartographic layers of these generated datasets.
- **Cell-Native Travel**: decouples travel movement, pathfinding, and discovery from the rectangular coordinate grid. This is owned by the adjacent `cell-native travel` project. Our project handles retiring the grid and Submap components; we seam with `cell-native travel` via cross-links and global gap `GG-28` to prevent duplicate efforts.

## Active Task

| Field | Value |
|---|---|
| Task | Inventory every load-bearing consumer of `MapData.tiles` + the Submap panes and record a retirement order. |
| Acceptance criteria | The dependent matrix is complete with all grid/submap consumers, their exact file paths, and a planned retirement order. No code is deleted. |
| Allowed boundaries | `docs/projects/submap/` and code searches across `src/`. |
| Owner | next iteration agent |
| Next action | Scan `src/` for all usages of `tiles` or `gridSize` on world-state variables and list them in the dependency inventory. |

## Known Gaps And Follow-Ups

Refer to [GAPS.md](file:///F:/Repos/Aralia/docs/projects/submap/GAPS.md) for full details. Notable retirement gaps:
- decouple `deriveAzgaarSeed` from the tile grid
- migrate `Enter-3D` grid coordinate cell resolution to Voronoi cells
- unmount Submap panes
- decouple discovery model from the rectangular grid
- seam with the adjacent "cell-native travel" project (GG-28)

## Resume Path For A Cold Agent

1. Read this file and [DECISIONS.md](file:///F:/Repos/Aralia/docs/projects/submap/DECISIONS.md).
2. Read [TRACKER.md](file:///F:/Repos/Aralia/docs/projects/submap/TRACKER.md) and [GAPS.md](file:///F:/Repos/Aralia/docs/projects/submap/GAPS.md).
3. Execute the first bounded slice: scan `src/` and build a complete inventory of `MapData.tiles` consumers, categorizing them and defining the exact retirement order.
