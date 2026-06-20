---
schema_version: 1
gap_schema: project_gap_registry
project: Compass Pane
slug: compass-pane
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-20"
gap_count: 5
open_gap_count: 1
resolved_gap_count: 4
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: fresh
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/compass-pane/NORTH_STAR.md
tracker: docs/projects/compass-pane/TRACKER.md
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
# Compass Pane Gap Registry

Status: active
Last updated: 2026-06-20

Use this file for durable unresolved findings that belong to Compass Pane.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | adjacent_follow_up | Worker B | `docs/projects/compass-pane/TRACKER.md` | Registry-to-implementation mapping | Define navigation affordances for map/submap/3D toggles in each context | `docs/projects/PROJECT_TRACKER.md`; `src/components/CompassPane/index.tsx`; `src/components/CompassPane/README.md` | Current behavior is implemented but intent is only partially documented in code/docs and differs between main layout and submap context | Define accepted rules for each UI state and lock them to tests | Acceptance criteria written and traceable to action/state checks |
| G3 | resolved | support_needed_now | Kilo / kilo/kilo-auto/free | `src/hooks/actions/handleMovement.ts` and action router | State-handler scan | Confirm UI pre-check semantics match handler movement semantics on boundaries and map transitions | `src/components/CompassPane/index.tsx`; `src/hooks/actions/handleMovement.ts`; `src/components/CompassPane/__tests__/CompassPane.test.tsx` | UI pre-checks now mirror handler-owned source fields for world-boundary checks and have regression coverage for edge and impassable world transitions; submap terrain remains handler-owned | Rule table and regression tests document that CompassPane pre-checks global disabled state, world bounds, and world biome passability, while in-bounds submap moves and submap impassable terrain remain handler responsibility | Scoped CompassPane tests cover currentLocation-based boundary checks and impassable adjacent world tiles |
| G4 | resolved | support_needed_now | Qoder CLI | Docs scan | Documentation continuity | `src/components/CompassPane/README.md` still describes the component as `CompassPane.tsx`, carries older prop/type wording, and omits the pass-time modal, submap context, and reducer toggle coupling details | `src/components/CompassPane/README.md`; `src/components/CompassPane/index.tsx`; `docs/projects/compass-pane/NORTH_STAR.md` | Mismatched docs can send future work down the wrong path and weaken cold-start accuracy | README verified synced to current source: correct file name (`index.tsx`), all 9 props match `CompassPaneProps` interface, pass-time modal documented, submap context covered, toggle visibility rules recorded, imports match dependencies | README diff against source confirms no remaining mismatches |
| G5 | open | test_coverage | Qoder CLI | `src/components/CompassPane/__tests__/CompassPane.test.tsx` | Documentation continuity pass | No test coverage for `isSubmapContext` toggle visibility: tests do not verify that submap and 3D toggles are hidden when `isSubmapContext={true}` | `src/components/CompassPane/index.tsx` lines 179-206; `src/components/CompassPane/__tests__/CompassPane.test.tsx` | Toggle visibility rules are documented in NORTH_STAR.md and implemented in source but lack regression tests; a future refactor could silently break submap-context hiding | Add a scoped test that renders CompassPane with `isSubmapContext={true}` and asserts submap/3D toggle buttons are absent while world-map toggle remains | `npm exec vitest run src/components/CompassPane/__tests__/CompassPane.test.tsx` passes with the new test |
| G6 | resolved | adjacent_follow_up | Qoder CLI | `src/components/CompassPane/index.tsx` | Documentation continuity pass | Source file JSDoc header (`@file CompassPane.tsx`) is stale: does not mention `PassTimeModal`, `isSubmapContext` prop, or pass-time modal integration | `src/components/CompassPane/index.tsx` lines 2-9 | Stale header misleads cold-start agents and developers about current component surface | JSDoc updated to `@file index.tsx` with PassTimeModal integration and `isSubmapContext` prop documented | JSDoc header matches current exports and prop surface |

## G3 Resolution

Date: 2026-06-18

G3 is resolved as a documentation-and-proof slice. The durable rule is that CompassPane pre-checks only the cases it can verify from its props: global disabled state, current location/world boundary, and adjacent world biome passability. In-bounds submap moves are enabled in the UI so `handleMovement` can own submap terrain validation and messaging.

Proof added in `src/components/CompassPane/__tests__/CompassPane.test.tsx` for current-location boundary pre-checks and impassable adjacent world tiles.

## G4 Resolution

Date: 2026-06-20

G4 is resolved by verifying the README against current source. The README (`src/components/CompassPane/README.md`) was already synced to the current `index.tsx` by a prior pass: file name, all 9 props in `CompassPaneProps`, pass-time modal integration, `isSubmapContext` context-aware toggle rules, and import dependencies all match. The gap record was stale and has been updated to reflect the actual README state.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | Not in this slice but required for task progress. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route cross-project or orphaned gaps to `docs/projects/GLOBAL_GAPS.md` when they do not belong here.


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
