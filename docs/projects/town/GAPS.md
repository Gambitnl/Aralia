---
schema_version: 1
gap_schema: project_gap_registry
project: Town
slug: town
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-05"
gap_count: 4
open_gap_count: 4
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/town/NORTH_STAR.md
tracker: docs/projects/town/TRACKER.md
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
# Town Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that belong to this project.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | low | adjacent_follow_up | future owner | provisional | project |  | none | none | not_recorded | docs/projects/town/TRACKER.md | docs/projects/town/ | Clarify city-state model coupling (governing body, profile identity, cultural metadata) between Town runtime and town-description/world systems. | `src/utils/world/settlementGeneration.ts`, `src/types/world.ts`, `docs/projects/town-description-system` | Town needs a durable place to hold identity without duplicating or dropping world/state contract. | Add a definitive decision: store in town runtime state, derive from world at entry, or consume from a shared metadata artifact. | Decision note added to tracker and relation section in NORTH_STAR.md. |  |
| G2 | not_started | medium | in_scope_now | future owner | provisional | project |  | none | none | not_recorded | docs/projects/town/TRACKER.md | `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleMovement.ts`, `src/types/actions.ts`, `src/state/reducers/townReducer.ts` | The action contract has `ENTER_TOWN`, but the active overworld entry path uses `ENTER_VILLAGE` and direct phase switching in movement. | runtime paths in handleMovement and reducer/action contracts differ | Unclear canonical path increases risk of regression when expanding town transitions. | Decide one canonical entry path and align all callers. | Capture decision and proof from movement handler and reducer usage. |  |
| G3 | not_started | medium | in_scope_now | future owner | provisional | project |  | none | none | not_recorded | docs/projects/town/TRACKER.md | `src/App.tsx`, `src/components/Town/TownCanvas.tsx` | `determineSettlementInfo(...)` is computed but not consumed by active TownCanvas flow. | `src/App.tsx` (line around 966) | Settlement personality/city-state data is not currently used to adjust render rules. | Decide whether profile signal is intentionally deferred or should be threaded into TownCanvas now. | Add explicit integration point or mark deferred in docs. |  |
| G4 | not_started | low | adjacent_follow_up | future owner | provisional | project |  | none | none | not_recorded | docs/projects/town/TRACKER.md | `src/components/Town/TownCanvas.tsx`, `src/components/Town/VillageScene.tsx` | The project has two render surfaces; App currently routes through TownCanvas only. | runtime imports and tests for both components | Split ownership can cause drift and dead paths over time. | Decide whether VillageScene remains documented secondary surface or is decommissioned/activated. | Add explicit status decision and update tests/integration notes. |  |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The issue blocks or directly affects this project's current town runtime contract. |
| `support_needed_now` | Needed dependency or decision outside Town for this project to progress safely. |
| `adjacent_follow_up` | Related but not required to keep current project behavior stable. |
| `out_of_scope` | Explicitly owned by another project or system. |
| `blocked_human_decision` | Needs product/owner direction. |
| `blocked_external_state` | Depends on another team/process outside code scope. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
