---
schema_version: 1
gap_schema: project_gap_registry
project: Submap and Tile-Grid Retirement
slug: submap
status: "retired (legacy surface removed; successor work routed to Worldforge)"
status_note: "2026-07-11 source and live audit reconciled the deleted legacy stack with its Worldforge replacement."
registry_mode: canonical
last_updated: "2026-07-11"
gap_count: 12
open_gap_count: 0
resolved_gap_count: 5
routed_gap_count: 1
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: fresh
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/submap/NORTH_STAR.md
tracker: docs/projects/submap/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
# Submap and Tile-Grid Retirement Gap Registry

Status: retired; successor work is owned by Worldforge
Last updated: 2026-07-11

Use this file for durable unresolved findings that belong to Submap and legacy tile-grid retirement. The tile-grid world model and Submap system cannot be safely removed until all load-bearing grid dependencies are decoupled, action/generation contracts are extracted, and a retirement order is executed.

## Current State

The retirement order has now executed. The legacy `SubmapPane`, tile renderer,
Pixi painters, procedural hooks, inspect pipeline, toggle state, Compass entry,
and grid movement handler were deleted in the completed grid-retirement commits.
The reachable successor is Worldforge tiered navigation in `MapPane`: an atlas
cell drills into generated region/local views and can ascend back to the world.

Rows below remain as historical intent. `out_of_scope` means their cited legacy
implementation no longer exists; `resolved` means the requested retirement or
replacement condition landed; G12 is routed because the grid-coordinate part
landed but current 2D/3D identity defects belong to Worldforge WF-G13/WF-G14.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G2 | out_of_scope | medium | support_needed_now | Cursor / Composer | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` | contract extraction | Formalize and prove the quick-travel and inspect payload contract between Submap UI and action handler pipeline before component deprecation. | `src/utils/spatial/submapActionContracts.ts`, `src/utils/spatial/__tests__/submapActionContracts.test.ts`, `DEPENDENCY_CONTRACT.md` | Module and tests exist; SubmapPane still duplicates payload assembly inline. | Superseded: the legacy producer and contract module were deleted; successor local travel is Worldforge WF-G15. | Legacy contract is absent and no production route emits it. |  |
| G3 | resolved | medium | support_needed_now | Cursor / Composer | confirmed | project |  | none | none | fresh | `docs/projects/submap/TRACKER.md` | dependent-system inventory | All Submap dependents need retain/extract/replace/retire classification. | `DEPENDENCY_CONTRACT.md` matrix; 2026-07-11 source/history audit | The retirement commits removed every legacy runtime producer and current searches find no toggle/state route. | Preserve the retired history and route successor gaps to Worldforge. | Zero production `isSubmapVisible`, `TOGGLE_SUBMAP`, or `toggle_submap_visibility` hits. |  |
| G4 | out_of_scope | medium | support_needed_now | Cursor / Composer | confirmed | project |  | none | none | fresh | `docs/projects/submap/TRACKER.md` | generation modularization | Submap generation rules were mixed with React/UI projection and might have been reusable elsewhere. | Retired `GENERATION_MODULARIZATION.md`; deleted `useSubmapProceduralData.ts` | The cited generator was deleted rather than extracted; Worldforge owns the successor engine. | Do not recreate the retired generator; extend Worldforge SP1/SP2 contracts instead. | No cited legacy generator remains in production. |  |
| G7 | out_of_scope | low | adjacent_follow_up | future extraction agent | confirmed | project |  | none | none | fresh | `docs/projects/submap/TRACKER.md` T3 | SubmapPane wiring gap | The retired pane once duplicated quick-travel and inspect payload assembly. | Deleted `SubmapPane.tsx` and `submapActionContracts.ts` | Neither side of the old duplication exists. | Keep the historical row; do not reintroduce the retired contract. | Current source contains no legacy inspect/quick-travel producer. |  |
| G8 | out_of_scope | medium | support_needed_now | future extraction agent | confirmed | project |  | none | none | fresh | `docs/projects/submap/TRACKER.md` T5 | Generation core not extracted | The legacy hook once orchestrated CA/WFC/path/seeded-feature output. | Deleted `useSubmapProceduralData.ts`; Worldforge submap engine | The planned extraction target no longer exists and its successor is independently implemented. | Route new procedural needs to Worldforge SP1 rather than restoring the old hook. | Worldforge replacement tests and live drill proof remain the authority. |  |
| G5 | resolved | high | in_scope_now | June 2026 campaign (Azgaar-continuation proc-gen submap system) | confirmed | project |  | none | rendered proof complete | fresh | `docs/projects/submap/TRACKER.md` | replacement surface review | Replacement surface for local navigation was not named. | `src/components/MapPane.tsx`; Worldforge `SubmapSvgView`/`NeighbourhoodSvgView`; 2026-07-11 live audit | The named Worldforge successor now owns atlas-to-region/local drill and return. | Continue incomplete local movement under Worldforge WF-G15. | Live water guard, land detail, region descent, and Ascend-to-World return with zero console errors; replacement tests 21/21. |  |
| CMA-G16 | out_of_scope | low | adjacent_follow_up | submap owner | confirmed | code-modularization-audit | docs/projects/code-modularization-audit/GAPS.md | retired | none | fresh | `docs/projects/code-modularization-audit/GAPS.md` CMA-G16 | Code modularization audit routing | The deleted pane/painter/atlas cluster once needed a parity-safe split. | Retirement commits deleted all cited files. | Splitting deleted files is no longer meaningful. | Reconcile the source audit row if it still advertises this route. | Current source has no cited cluster. |  |
| G9 | resolved | medium | support_needed_now | submap owner | confirmed | project |  | none | none | fresh | `docs/projects/submap/TRACKER.md` | grid-decoupling | Decouple seed generation from the legacy rectangular grid world model. | `src/components/MapPane.tsx`; canonical `worldSeed` Worldforge bridge | `deriveAzgaarSeed` and the iframe/grid seed path are gone. | Preserve direct `worldSeed` ownership. | Canonical atlas render/reload proof uses one stable run seed. |  |
| G10 | resolved | high | support_needed_now | submap owner | confirmed | project |  | none | none | fresh | `docs/projects/submap/TRACKER.md` | grid-decoupling | Decouple world-map discovery from the rectangular grid. | Travel G7; `GameState.discoveryLog`; `MapPane` explored-cell projection | Exact Worldforge cell IDs now drive persistent, deduped exploration. | Preserve cell-native discovery; Submap local discovery is a successor concern. | Exact `[2497,2499,2498]` set survived full save/reload and later arrivals extended it once. |  |
| G11 | resolved | high | support_needed_now | submap owner | confirmed | project |  | none | none | fresh | `docs/projects/submap/TRACKER.md` | grid-decoupling | Unmount legacy Submap components and clean up modal routing. | Retirement commits; `src/components/layout/GameModals.tsx`; 2026-07-11 source scan | The pane and its route were deleted, so it cannot mount or consume runtime work. | Keep successor navigation in Worldforge only. | Zero legacy toggle/state hits; live game exposes no legacy Submap control. |  |
| G12 | routed | medium | routed | Worldforge | confirmed | project | WF-G13 / WF-G14 | routed | none | source_checked | `docs/projects/worldforge/GAPS.md` | grid-decoupling | Migrate Enter-3D grid resolution to Voronoi cells. | `MapPane`/`Entry3DAnchor`/worker source trace | The rectangular-grid dependency is gone, but deepest-leaf handoff and burg-cell identity contradictions remain under the successor owner. | Resolve Worldforge WF-G13 and WF-G14. | One selected leaf/cell remains the same identity through 2D, 3D, exit, and reload. |  |
| G13 | out_of_scope | medium | support_needed_now | submap owner | confirmed | `docs/BACKLOG.md` |  | retired | none | fresh | `src/components/Submap/SubmapRendererPixi.tsx` | backlog migration 2026-06-25 | Pixi initialization races could blank the legacy surface. | Retirement commit deleted `SubmapRendererPixi.tsx`. | A deleted renderer cannot race at runtime. | Do not restore it; test the Worldforge SVG successor instead. | Current replacement tests and live descent run without page errors. |  |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md`.
- Route generation-internal items to `docs/projects/submap-generation/GAPS.md`.

## Imported Generation Modularization Plan

The retired `GENERATION_MODULARIZATION.md` plan named the extraction order for G4/G8:

1. Lift pure generation from `useSubmapProceduralData` into `src/features/SubmapGeneration/generateLocalTerrainData.ts`.
2. Keep `useSubmapProceduralData` as a thin React wrapper during extraction.
3. Preserve path/network helpers in `src/utils/spatial/submapPathContinuity.ts`.
4. Keep `submapVisuals.ts` as a projection layer fed by extracted core data.
5. Defer painter and atlas splits until dependent inventory and CMA-G16 routing are settled.

Required proof remains: plains/cave/wetland fixture parity, unchanged `VisualLayerOutput`, Minimap seeded-feature/path overlay proof, and stable `getSubmapTileInfo` lookup behavior.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |
