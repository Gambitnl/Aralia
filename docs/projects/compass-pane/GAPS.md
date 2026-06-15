---
schema_version: 1
gap_schema: project_gap_registry
project: Compass Pane
slug: compass-pane
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-08"
gap_count: 3
open_gap_count: 1
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: mixed
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
Last updated: 2026-06-08

Use this file for durable unresolved findings that belong to Compass Pane.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `docs/projects/compass-pane/TRACKER.md` | Registry-to-implementation mapping | Define navigation affordances for map/submap/3D toggles in each context | `docs/projects/PROJECT_TRACKER.md`; `src/components/CompassPane/index.tsx`; `src/components/CompassPane/README.md` | Current behavior is implemented but intent is only partially documented in code/docs and differs between main layout and submap context | Define accepted rules for each UI state and lock them to tests | Acceptance criteria written and traceable to action/state checks |
| G3 | support_needed_now | support_needed_now | Worker B | `src/hooks/actions/handleMovement.ts` and action router | State-handler scan | Confirm UI pre-check semantics match handler movement semantics on boundaries and map transitions | `src/components/CompassPane/index.tsx`; `src/hooks/actions/handleMovement.ts` | UI currently blocks some cases before handler runs, so edge behavior can be under-tested at handler level | Capture an explicit rule table for edge and impassable transitions | Add regression tests or acceptance comments in `NORTH_STAR.md` and `TRACKER.md` |
| G4 | support_needed_now | support_needed_now | Worker B | Docs scan | Documentation continuity | `src/components/CompassPane/README.md` still describes the component as `CompassPane.tsx`, carries older prop/type wording, and omits the pass-time modal, submap context, and reducer toggle coupling details | `src/components/CompassPane/README.md`; `docs/projects/compass-pane/NORTH_STAR.md` | Mismatched docs can send future work down the wrong path and weaken cold-start accuracy | Sync the component README or keep the North Star note explicit that the README is historical only | README diff against source behavior for one pass |

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
