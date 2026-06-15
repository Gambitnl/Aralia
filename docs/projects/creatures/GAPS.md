---
schema_version: 1
gap_schema: project_gap_registry
project: Creatures System
slug: creatures
status: "active (G4 decision recorded 2026-06-10; docs-only closure)"
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
north_star: docs/projects/creatures/NORTH_STAR.md
tracker: docs/projects/creatures/TRACKER.md
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
# Creatures System Gap Registry

Status: active (G4 decision recorded 2026-06-10; docs-only closure)
Last updated: 2026-06-10

Reviewed during the 2026-06-09 review-gate pass. G2/CT-3 is resolved; CT-2 taxonomy integration is complete; G4 is now review-required; G5 corpus ownership proof is documented.
Update (2026-06-10): G4 decided â€” keep binary include/exclude targeting, defer hybrid semantics (DECISION_BLITZ D11); G4 is closed as a deliberate defer with docs-only closure.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Classification Reference

- `in_scope_now` - required for the current task slice.
- `support_needed_now` - not in current slice but must be completed before the slice can progress safely.
- `adjacent_follow_up` - useful future work that should be preserved but not promoted into this slice.
- `out_of_scope` - explicitly rejected for this project/task.
- `blocked_human_decision` - needs explicit owner decision.
- `blocked_external_state` - external dependency/coordination needed.

## Import / Routing Rule

- If a future task identifies cross-project ownership, move it to `docs/projects/GLOBAL_GAPS.md` with routing rationale.
- Gaps already in this registry stay here until ownership is intentionally reassigned.

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
