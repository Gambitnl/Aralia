---
schema_version: 1
gap_schema: project_gap_registry
project: <Project Or Task>
slug: <project-slug>
status: active
status_note: ""
registry_mode: canonical
last_updated: <YYYY-MM-DD>
gap_count: <N>
open_gap_count: <N>
resolved_gap_count: <N>
routed_gap_count: <N>
imported_gap_count: <N>
decision_required_count: <N>
visual_proof_required_count: <N>
highest_severity: none
proof_freshness: not_recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/<project-slug>/NORTH_STAR.md
tracker: docs/projects/<project-slug>/TRACKER.md
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
# <Project Or Task> Gap Registry

Status: active
Last updated: <YYYY-MM-DD>

Use this file for durable unresolved findings that are too important or too
large to live only in the tracker and that genuinely belong to this project.
Put cross-project, orphaned, or out-of-current-scope gaps in the global gap
tracker instead. Use it for source-backed expansion opportunities too when
they belong to this project but should not widen the current slice yet.

## Gap Log

Canonical migration target:

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | medium | adjacent_follow_up | <owner> | <confirmed/provisional/imported/unknown> | <project/global/audit> | <global_gap_id or linked_gap_id> | <none/decision_required/review_required/decision_recorded> | <none/required/done> | <fresh/historical/stale/placeholder/not_recorded> | <tracker> | <task> | <gap> | <source> | <why> | <next> | <proof> | <notes> |

Minimum row contract before full migration:

| Gap ID | Status | Classification | Gap | Evidence/source | Next action |
|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | <gap> | <source> | <next> |

Use the canonical table when creating or fully migrating a project. Preserve
compact/reference tables until a migration pass can map each omitted concept
without losing intent.

## Schema Fit Notes

Use this section only when existing project gap content cannot be represented
cleanly by the schema yet.

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|

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
- Record real expansion opportunities as gaps or tracker follow-ups when they
  are source-backed and belong to this project.
- When a sweep finds no new gap, record the active edge-case/chaos probe
  vectors in the handoff or proof file instead of treating a passive read as
  proof. Useful vectors include invalid state, unusual action order, missing or
  stale data, disabled/loading/error states, and adjacent shared-state callers.
- Link back to a global gap ID when this project imports one.
- Link back to the source gap ID and source tracker when this project receives
  an inbound routed gap from another project.
- If the current project should not own a gap, add or update the global gap
  tracker instead of keeping the gap here. If routing directly to another
  owner project, add a minimal stub row to that owner's `GAPS.md` in the same
  pass.
- Do not mark a gap done unless completion evidence is linked or summarized.
- If a project uses a compact, routed, archived, or merged-reference gap table,
  preserve it until a migration pass can map the current rows into the
  canonical columns without discarding decision, routing, proof, or ownership
  context.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/agent-workflows/living-project-task-protocol/templates/GAPS.md","sha256WithoutMarker":"4ef34f24b3656c7fcd1cea04da27c6ec6205c3a589b26c31a5e85114aecf9cbc","markedAtUtc":"2026-06-25T22:57:26.961Z"} -->
