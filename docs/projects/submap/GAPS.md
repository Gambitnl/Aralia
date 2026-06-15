---
schema_version: 1
gap_schema: project_gap_registry
project: Submap and Tile-Grid Retirement
slug: submap
status: active
status_note: upgraded to encompass legacy tile-grid retirement
registry_mode: canonical
last_updated: "2026-06-15"
gap_count: 11
open_gap_count: 11
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: recorded
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

Status: active
Last updated: 2026-06-15

Use this file for durable unresolved findings that belong to Submap and legacy tile-grid retirement. The tile-grid world model and Submap system cannot be safely removed until all load-bearing grid dependencies are decoupled, action/generation contracts are extracted, and a retirement order is executed.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G2 | active | medium | support_needed_now | Cursor / Composer | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` | contract extraction | Formalize and prove the quick-travel and inspect payload contract between Submap UI and action handler pipeline before component deprecation. | `src/utils/spatial/submapActionContracts.ts`, `src/utils/spatial/__tests__/submapActionContracts.test.ts`, `DEPENDENCY_CONTRACT.md` | Module and tests exist; SubmapPane still duplicates payload assembly inline. | Wire SubmapPane through shared helpers (G7). | Contract tests green after SubmapPane wiring; handler behavior unchanged. |  |
| G3 | active | medium | support_needed_now | Cursor / Composer | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` | dependent-system inventory | All Submap dependents need retain/extract/replace/retire classification. | `DEPENDENCY_CONTRACT.md` matrix (18 rows), `rg` scan 2026-06-10 | Primary surfaces classified; secondary callers may still appear in future scans. | Spot-check matrix against new `rg` hits each extraction pass. | Matrix row count and owner routing stay current. |  |
| G4 | active | medium | support_needed_now | Cursor / Composer | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` | generation modularization | Submap generation rules are mixed with React/UI projection and may be reusable elsewhere. | `GENERATION_MODULARIZATION.md`, `useSubmapProceduralData.ts` | Plan names extraction path; core module not yet created. | Extract `generateLocalTerrainData` (G8). | Fixture parity for plains/cave/wetland. |  |
| G7 | active | low | adjacent_follow_up | future extraction agent | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` T3 | SubmapPane wiring gap | `submapActionContracts.ts` exists but `SubmapPane.tsx` still builds `QUICK_TRAVEL` and `inspect_submap_tile` payloads inline. | `SubmapPane.tsx` lines 324-363 vs `submapActionContracts.ts` | Duplicate payload rules can drift from the shared contract module during future edits. | Refactor SubmapPane dispatch paths to call `buildQuickTravelPayload` and `buildInspectSubmapTilePayload`. | SubmapPane tests and contract tests both pass; no payload field changes. |  |
| G8 | active | medium | support_needed_now | future extraction agent | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` T5 | Generation core not extracted | `useSubmapProceduralData` remains the only orchestration entry for CA/WFC/path/seeded-feature output. | `GENERATION_MODULARIZATION.md`, `useSubmapProceduralData.ts`, `Minimap.tsx` | Minimap and Submap both depend on the React hook; generation cannot be reused without UI coupling. | Create `generateLocalTerrainData` and keep the hook as a thin wrapper. | Fixture parity test for three biome families. |  |
| G5 | active | high | in_scope_now | June 2026 campaign (Azgaar-continuation proc-gen submap system) | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` | replacement surface review | Replacement surface for local navigation is not named. Decided 2026-06-10 (Remy): the new Azgaar-continuation proc-gen submap system from the June 2026 campaign is the named replacement; see the campaign context section in `docs/projects/DECISION_BLITZ_2026-06-10.md` (D3). | `src/components/Submap/SubmapPane.tsx`; `src/components/Minimap.tsx`; `src/components/Town`; `src/systems/travel`; `docs/projects/DECISION_BLITZ_2026-06-10.md` | Extraction can proceed, but final component deprecation needs a target architecture. The extraction contracts (G7/G8, `submapActionContracts`, DEPENDENCY_CONTRACT.md) are the inventory the new system must honor. | Implementation lane open: build the replacement against the inventoried contracts; component deprecation only after the replacement proves contract coverage. | Replacement implementation demonstrates carried-forward behaviors against DEPENDENCY_CONTRACT.md before any Submap component removal. |  |
| CMA-G16 | not_started | low | adjacent_follow_up | submap owner | confirmed | code-modularization-audit | docs/projects/code-modularization-audit/GAPS.md | routed | none | not_recorded | `docs/projects/code-modularization-audit/GAPS.md` CMA-G16 | Code modularization audit routing | `SubmapPane.tsx` (~679 lines), `SubmapFeaturePainter.ts` (~667 lines), and `TextureAtlasManager.ts` (~586 lines) form a cluster with legacy/orphan headers and painter helpers; a split needs painter parity and atlas contract preservation. | `src/components/Submap/SubmapPane.tsx`; `src/components/Submap/painters/SubmapFeaturePainter.ts`; `src/components/Submap/painters/TextureAtlasManager.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G16 | Splitting painter helpers or the atlas manager before G3 (dependent-system inventory) is complete risks orphaning retained contracts when the Submap surface is deprecated. | Accept or defer the inbound CMA-G16 route; if accepting, ensure G3 is complete first and create a narrow split plan with painter-parity proof. | Owner gap row exists and CMA-G16 status is updated to reflect acceptance or deferral. |  |
| G9 | active | medium | support_needed_now | submap owner | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` | grid-decoupling | Decouple `deriveAzgaarSeed` from the legacy rectangular grid world model. | `deriveAzgaarSeed` in `src/components/MapPane.tsx` | Currently, the seed generation parses the rectangular tile grid array, which blocks removing `mapData.tiles`. | Refactor `deriveAzgaarSeed` to hash stable configuration or seed data directly instead of the tiles array. | The generated seed remains identical or stable without reading `mapData.tiles`. |  |
| G10 | active | high | support_needed_now | submap owner | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` | grid-decoupling | Decouple world map discovery flags and exploration model from the rectangular grid. | `gameState.mapData.tiles` discovery flags in `src/hooks/actions/handleMovement.ts` | Map tiles carry discovery flags that are mutated during movement, coupling discovery to the old grid. | Re-route discovery tracking to store discovered cell IDs/coordinates in a dedicated set/array in the state. | Exploration state functions correctly and updates cell discovery without reading/writing the `tiles` grid. |  |
| G11 | active | high | support_needed_now | submap owner | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` | grid-decoupling | Unmount legacy Submap components and clean up the modal routing. | `src/components/Submap/SubmapPane.tsx`, `src/components/layout/GameModals.tsx` | Leaving legacy Submap components mounted/active wastes performance and introduces UI bugs once Azgaar map takes over. | Safely unmount Submap panes and clean up layouts per D21 (keep in-tree but unmounted). | Submap components are completely unmounted and the modal cannot be opened, while the main app remains fully functional. |  |
| G12 | active | medium | support_needed_now | submap owner | confirmed | project |  | none | none | not_recorded | `docs/projects/submap/TRACKER.md` | grid-decoupling | Migrate Enter-3D grid coordinate cell resolution to Voronoi cells. | `onEnter3DAtCell` and grid-coordinate routing in `src/components/MapPane.tsx` | Clicks to enter 3D mode resolve grid indices (`x`, `y`), which couples the 3D entry transition to the old grid coordinate model. | Update the 3D entry trigger to pass the Voronoi cell ID or the precise cell coordinates directly to the 3D scene loader. | Entering 3D mode loads the correct ground chunk based on Voronoi cell data instead of grid cell coordinates. |  |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md`.
- Route generation-internal items to `docs/projects/submap-generation/GAPS.md`.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |
