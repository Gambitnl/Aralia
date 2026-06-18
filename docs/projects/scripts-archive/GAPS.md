---
schema_version: 1
gap_schema: project_gap_registry
project: "Scripts: Archive"
slug: scripts-archive
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-17"
gap_count: 2
open_gap_count: 1
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 1
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/scripts-archive/NORTH_STAR.md
tracker: docs/projects/scripts-archive/TRACKER.md
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
# Scripts: Archive Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Gap Log

| Gap ID | Gap | Classification | Owner | Evidence | Next action | Next proof | Status |
|---|---|---|---|---|---|---|---|
| SARCH-001 | Retired archive scripts are not represented in active tooling registry metadata, so later reuse intent may still be unclear. | blocked_human_decision | Human/operator | Required Review Brief added to `NORTH_STAR.md` on 2026-06-17; tombstone policy decision now surfaced for human review | Human operator chooses Option A (tombstone entry), B (explicit omission policy), or C (defer) per Required Review Brief | Decision recorded in `DECISIONS.md`; tombstone entry or policy note committed | review-required |
| SARCH-002 | Temporary auth/session inputs for one-time retrieval runs still need a direct project-level cleanup check, even though the temp auth file was absent on the latest pass. | support_needed_now | Qoder CLI | `Test-Path .agent/roadmap-local/spell-validation/dndbeyond-auth.json` returned `False` on 2026-06-17 | Keep the manual cleanup check in the tracker and note any reappearance of the auth artifact immediately. | Re-run the same `Test-Path` check during the next archive pass. | open |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact archive policy table | Minimal row shape is tied to cleanup policy checks, not full canonical ownership metadata | Lossless expansion would add invented owner/source/link fields the source table does not provide | Keep compact archive tables allowed for tombstone/cleanup registries |

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
