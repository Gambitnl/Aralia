---
schema_version: 1
gap_schema: project_gap_registry
project: Conversation Panel
slug: conversation-panel
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-08"
gap_count: 1
open_gap_count: 1
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/conversation-panel/NORTH_STAR.md
tracker: docs/projects/conversation-panel/TRACKER.md
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
# Conversation Panel Gap Registry

Status: active  
Last updated: 2026-06-08

Use this file for durable unresolved findings that genuinely belong to this project.

Current backlog after this slice: CP-001/002/003 are resolved in this pass; CP-004 remains the live project-specific gap pending CMA policy alignment.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| CP-004 | active | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit/CMA-G12` | Code modularization audit routing | Companion banter and interactive conversation lanes can overlap without policy | `src/hooks/useCompanionBanter.ts`, `src/hooks/useConversation.ts`, `src/state/reducers/conversationReducer.ts`, `src/state/reducers/dialogueReducer.ts` | Conversation panel UX and turn semantics need clear exclusivity contract | require boundary note and sequencing policy in `CMA-G12` before any expansion | keep policy proof in cross-project handoff |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not in this task, but task progress needs it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- If a gap is out of project scope, move it to `docs/projects/GLOBAL_GAPS.md` with routing rationale.
- Do not mark any gap done without completion evidence.


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
