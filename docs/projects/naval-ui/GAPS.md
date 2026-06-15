---
schema_version: 1
gap_schema: project_gap_registry
project: Naval UI
slug: naval-ui
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-15"
gap_count: 5
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/naval-ui/NORTH_STAR.md
tracker: docs/projects/naval-ui/TRACKER.md
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
# Naval UI Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that belong to Naval UI.

## Gap Log

| Gap ID | Status | Classification | Source | Evidence | Why it matters | Next action |
|---|---|---|---|---|---|---|
| NU-1 | active | in_scope_now | Action surface mismatch | `src/state/actionTypes.ts`, `src/state/reducers/navalReducer.ts` | `NAVAL_REPAIR_SHIP` exists as a declared action but has no reducer behavior | Implement reducer branch or remove action contract before extending dashboard controls |
| NU-2 | active | in_scope_now | Voyage start route missing | `src/hooks/actions/handleMovement.ts`, `src/state/reducers/navalReducer.ts` | Water is blocked as impassable in movement/quick-travel logic and no voyage launch path exists | Add transport-to-voyage flow and proof action dispatch |
| NU-3 | active | in_scope_now | Combat/status dead-end | `src/data/naval/voyageEvents/index.ts`, `src/systems/naval/VoyageManager.ts`, `docs/projects/naval` | Voyage logs support `Combat` status but no naval dashboard flow consumes or exposes it | Define event-to-combat/handoff strategy and UI state reflection |
| NU-4 | active | in_scope_now | Duplicate input source | `src/data/naval/voyageEvents.ts`, `src/data/naval/voyageEvents/index.ts` | Two event catalogs exist with overlapping names/behavior | Choose one canonical source before adding new UI status/encounter wiring |
| NU-5 | active | support_needed_now | UI action gap | `src/components/Naval/ShipPane.tsx` | Dashboard is inspection-only (Overview/Crew/Cargo) and cannot trigger recruit/repair/voyage actions | Either add controls or confirm read-only contract explicitly |

## Uncertainties

- The intended behavior for `currentVoyage` status in UI remains undefined at the Naval UI layer.
- No dedicated voyage progress or status panel exists in Naval UI beyond ship-centric views.
- Clarify whether voyage and combat handoff should be represented in a new modal family instead of `ShipPane`.
- Iteration 2 (2026-06-15) docs-only verification pass confirmed all 5 gaps remain accurate against current source; no new project-specific blockers discovered.

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
