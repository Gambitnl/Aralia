---
schema_version: 1
gap_schema: project_gap_registry
project: Travel System
slug: travel
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-15"
gap_count: 10
open_gap_count: 10
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/travel/NORTH_STAR.md
tracker: docs/projects/travel/TRACKER.md
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
# Travel Gap Registry

Status: active
Last updated: 2026-06-15

Use this file for durable unresolved findings that belong to Travel System and are too important to keep only in temporary notes.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Doc pass + code scan | Forced march exhaustion checks are not applied during movement flow. | `src/systems/travel/TravelCalculations.ts` and TODO in `src/hooks/actions/handleMovement.ts` | Party can remain in long travel loops without fatigue risk; gameplay behavior mismatches travel rules. | Wire `calculateForcedMarchStatus` into movement progression and apply exhaustion effects. | Add assertion in movement test that 9-hour travel triggers DC 11 outcome path. |
| G2 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Doc pass + code scan | Navigation drift logic (`checkNavigation`) is defined but not consumed by movement loop. | `src/systems/travel/TravelNavigation.ts`, `src/hooks/actions/handleMovement.ts` TODO marker | Get-lost and reroute behavior remains unused despite available logic. | Add navigation check call in movement or travel service and apply drift direction/time penalties. | Add deterministic drift regression with seeded random in a movement-level test. |
| G3 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Cross-file behavior scan | Quick travel and regular movement time cost models differ and are not reconciled. | `src/components/Submap/useQuickTravel.ts`, `src/hooks/actions/handleMovement.ts`, `src/services/travelService.ts` | Inconsistent travel duration, encounter checks, and seasonal multipliers depending on path entry point. | Choose one authoritative movement-time source and update both flows. | Add integration check for 10-step quick travel against same route service call. |
| G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Code review | Transport edge cases (wagon/cart pullers, load limits) are simplified with fallback defaults. | `src/systems/travel/TravelCalculations.ts`, `src/types/travel.ts` | Route realism and balance can drift when transport-based movement is added to narrative tasks. | Expand travel transport schema and validation before introducing new mechanics. | Add unit tests for vehicle with missing speed and heavy load routes. |
| G5 | not_started | adjacent_follow_up | Worker A | `src/components/Submap` | UI review | Quick travel cost currently ignores fatigue/consumption hooks despite TODO note. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts` | Later systems may not model cumulative cost of rapid movement. | Confirm scope; decide whether to add resource drain in this project or open dependency. | Add explicit decision note in TRACKER and tests when implemented. |
| G6 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Travel cell-native audit | Many small adjacent Voronoi cells collapse onto a single grid tile during target coordinates lookup. | `src/components/MapPane.tsx` (`gridTileFromWorld`) | Cell-accurate travel is impossible because coordinates are coerced to rectangular tiles. | Define Voronoi cell-based travel target lookup and route calculation. | Test that two distinct Voronoi cells on the same grid tile can be travelled to separately. |
| G7 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Travel cell-native audit | Map discovery status (`tile.discovered`) is tracked on rectangular grid tiles instead of Voronoi cells. | `src/components/MapPane.tsx` (`tiles` array discovery lookup) | Discovery resolution is coarse and does not match the actual rendered Voronoi boundaries. | Migrate discovery flags to a cell-native model (e.g. Set of cell IDs). | Test that traveling to a cell only discovers that specific Voronoi cell polygon. |
| G8 | not_started | support_needed_now | Worker A | `docs/projects/travel/TRACKER.md` | Code audit | Map seed generation (`deriveAzgaarSeed`) hashes coordinates of rectangular tiles. | `src/components/MapPane.tsx` (`deriveAzgaarSeed`) | Couples the iframe map loading and generation seed to the legacy grid structure. | Decouple seed generation from grid tiles; use direct seed mapping from `worldSeed`. | Test that seed derivation returns stable seed without traversing grid array. |
| G9 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Travel cell-native audit | Player marker (`AtlasPlayerMarker`) positioning is coupled to grid coordinates. | `src/components/MapPane.tsx` / `AtlasPlayerMarker` | Marker position snaps to grid tile centers instead of cell centroids. | Calculate player marker position based on current cell centroid coordinates (`cell.c`). | Test marker positions align correctly with actual cell centroids. |
| G10 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Code audit | Compass and travel reducers only accept and track `x, y` grid updates. | `src/state/reducers/worldReducer.ts` | State updates ignore cell-level precision for travel actions. | Add cell ID tracking to movement action payloads and state models. | Unit tests verifying dispatching cell-native travel updates cell ID state. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
