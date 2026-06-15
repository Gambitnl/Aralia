---
schema_version: 1
gap_schema: project_gap_registry
project: Tiered Autosave
slug: tiered-autosave
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-12"
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
north_star: docs/projects/tiered-autosave/NORTH_STAR.md
tracker: docs/projects/tiered-autosave/TRACKER.md
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
# Tiered Autosave Gap Registry

Status: active
Last updated: 2026-06-12

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GAP-002 | active | medium | in_scope_now | Tiered Autosave | confirmed | project |  | none | none | not_recorded | Autosave/checkpoint runtime | implementation scan | No checkpoint timer runner is connected. | `src/services/saveLoadService.ts` defines `CHECKPOINT_TIERS`; no `useCheckpointSaves` or equivalent is imported/used. | IndexedDB save payloads can exist, but checkpoint copy intervals are not created in runtime. | Add and wire checkpoint timer hook into gameplay autosave flow. | Verify each tier writes to its slot after interval threshold. |  |
| GAP-003 | open | low | adjacent_follow_up | Tiered Autosave | confirmed | project |  | none | required | not_recorded | Save/load UI | implementation scan | Load modal still mixes autosave and checkpoint visibility. | `src/components/SaveLoad/LoadGameModal.tsx` | Users can confuse rapid autosave and checkpoint history. | Add explicit checkpoint section and labels if checkpoint automation is enabled. | Manual UI check for section names and delete affordances. |  |
| GAP-005 | open | medium | adjacent_follow_up | Tiered Autosave | confirmed | project |  | none | none | not_recorded | Save/load tests | implementation scan | Legacy save tests are still localStorage-first. | `src/services/__tests__/saveLoadService*.ts` | Primary storage path changed, so IDB and migration regressions are under-covered. | Add dedicated IndexedDB path tests and fallback assertions. | Focused save/load service test run. |  |
| GAP-006 | open | low | adjacent_follow_up | Tiered Autosave | confirmed | project |  | none | none | not_recorded | Save/load documentation | implementation scan | `saveLoad.README.md` is stale. | `src/services/saveLoad.README.md` | Future operators may rely on outdated localStorage-first behavior. | Rewrite docs for IndexedDB-first flow, migration, emergency save key, and notification path. | README reflects current storage flow and links to proof. |  |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |
| `schema_normalization` | The row needs schema cleanup or canonicalization. |
| `integration` | The row concerns runtime wiring or consuming a shared contract. |
| `test_coverage` | The row concerns tests or regression coverage. |
| `documentation` | The row concerns docs or operational guidance. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
