---
schema_version: 1
gap_schema: project_gap_registry
project: Demo Area
slug: demo-area
status: "active (G1 decided 2026-06-10)"
status_note: ""
registry_mode: canonical
last_updated: "2026-06-10"
gap_count: 0
open_gap_count: 0
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/demo-area/NORTH_STAR.md
tracker: docs/projects/demo-area/TRACKER.md
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
project: Demo Area
slug: demo-area
last_updated: \"2026-06-10\"
gap_count: 0
open_gap_count: 0
north_star: docs/projects/demo-area/NORTH_STAR.md
tracker: docs/projects/demo-area/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
---
# Demo Area Gap Registry

Status: active (G1 decided 2026-06-10)
Last updated: 2026-06-10

Use this file for durable unresolved findings that belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it |
| `support_needed_now` | Not in slice but required for task progress |
| `adjacent_follow_up` | Related, useful, and outside current proof scope |
| `out_of_scope` | Explicitly not part of this project/task |
| `blocked_human_decision` | Owner/operator choice is required |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service |

## Update Rules

- Keep gaps tied to concrete evidence and a next proof/check.
- Move cross-project or external items to `docs/projects/GLOBAL_GAPS.md` only when they do not belong to Demo Area outcomes.
