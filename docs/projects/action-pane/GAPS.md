---
schema_version: 1
gap_schema: project_gap_registry
project: Action Pane
slug: action-pane
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-07-11"
gap_count: 1
open_gap_count: 0
resolved_gap_count: 1
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/action-pane/NORTH_STAR.md
tracker: docs/projects/action-pane/TRACKER.md
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
# Action Pane Gap Registry

Status: active
Last updated: 2026-07-11

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | integration | Codex | Long Rest modal-to-action pipeline | Whole-game systems audit W02 command pass, 2026-07-11 | `LongRestModal` confirmation dispatched the `LONG_REST` reducer action directly from `GameModals`, bypassing `processAction` and `handleLongRest`; the visible eight-hour promise therefore skipped planar-rest rules, overnight world events, journal rollover, and `ADVANCE_TIME`. Racial rest choices also had no route through the full handler. | `src/components/layout/GameModals.tsx`; `src/hooks/actions/actionHandlers.ts`; `src/hooks/actions/handleResourceActions.ts`; focused tests; live modal confirmation. | Rest is a core recovery/time loop: restoring resources without advancing the world creates free recovery and breaks every system keyed to elapsed time. | Confirmation now emits the gameplay `LONG_REST` action through `onAction`; the handler carries modal choices alongside planar denials and owns all overnight effects plus the eight-hour advance. | 48/48 focused ActionPane/GameModals/resource-action tests green; live confirmation advanced 10:40 to 18:40, emitted settle/world/awake messages, closed once, and produced zero console errors. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not in the slice but the slice cannot progress without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, vendor, service, or environment state. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md` instead of keeping them here.
- Keep `classification` aligned with current slice need and avoid using adjacent items to hide implementation blockers.
- Do not mark entries resolved without a final proof file path, test result, or explicit design decision.
