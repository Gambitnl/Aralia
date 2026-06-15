---
schema_version: 1
gap_schema: project_gap_registry
project: SaveLoad
slug: saveload
status: active
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-05"
gap_count: 6
open_gap_count: 6
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/saveload/NORTH_STAR.md
tracker: docs/projects/saveload/TRACKER.md
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
# SaveLoad Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings tied to SaveLoad behavior.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | medium | support_needed_now | Worker B | confirmed | project |  | none | none | not_recorded | `docs/projects/saveload/TRACKER.md` | docs pass | Save storage initialization is not started automatically | `src/services/saveLoadService.ts` defines `initializeStorage()` but no caller in startup chain (`rg` scan) | Prevents IndexedDB migration and storage mode setup from running | Add controlled startup call path and verify in App bootstrap path | Verify save migration occurs when localStorage and IDB are both available |  |
| G2 | not_started | low | adjacent_follow_up | Worker B | confirmed | project |  | none | none | not_recorded | `docs/projects/saveload/TRACKER.md` | docs pass | Checkpoint tier constants are present but not fed by a scheduler | `src/services/saveLoadService.ts` defines `CHECKPOINT_TIERS` and `CHECKPOINT_PREFIX`, no caller found | Avoids false assumptions about checkpoint autosaves | Decide keep/remove and align with checkpoint ownership | Document decision and implementation scope |  |
| G3 | not_started | low | adjacent_follow_up | Worker B | confirmed | project |  | none | none | not_recorded | `docs/projects/saveload/TRACKER.md` | docs pass | No direct file export/import backup flow in SaveLoad UI/service | `src/components/SaveLoad/*.tsx`, `src/services/saveLoadService.ts` | Impacts manual backup and disaster recovery workflows | Confirm required user-facing restore strategy | Add UX or explicitly mark as out of scope |  |
| G4 | active | high | in_scope_now | Worker B | confirmed | project |  | none | none | not_recorded | `docs/projects/saveload/TRACKER.md` | docs pass | Schema mismatch is hard-failed instead of migration/transform | `src/services/saveLoadService.ts` version check in `loadGame` | Risk of blocking older saves on format changes | Define migration policy before next schema increment | Update tests and policy docs before any version bump |  |
| G5 | not_started | medium | support_needed_now | Worker B | confirmed | project |  | none | none | not_recorded | `docs/projects/saveload/TRACKER.md` | docs pass | Versioned migration behavior not covered for all payload shapes in tests | `src/services/saveLoadService.test.ts` plus migration tests are partial | Regression risk if older states include missing fields | Expand tests for mixed payload shapes and slot metadata anomalies | Add test cases with missing legacy fields and malformed metadata |  |
| G6 | not_started | low | adjacent_follow_up | Codex | confirmed | code-modularization-audit | docs/projects/code-modularization-audit/GAPS.md | routed | none | not_recorded | `docs/projects/code-modularization-audit` CMA-G10 | Code modularization audit routing | Central state/save/load files are large split candidates, but save compatibility and migration behavior are the real risk. | `src/state/appState.ts`; `src/state/actionTypes.d.ts`; `src/state/reducers/characterReducer.ts`; `src/services/saveLoadService.ts` | Splitting these surfaces without migration/load proof can silently break older saves or reducer defaults. | Require migration/load regression boundaries before any state/save modularization. | `src/state/migrations/__tests__`, reducer tests, and save/load tests named in a split plan |  |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `routed_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Needed for this project slice to remain correct |
| `support_needed_now` | Required so the slice can proceed safely |
| `adjacent_follow_up` | Related but not required to finish this slice |
| `out_of_scope` | Not owned by this project slice |
| `blocked_human_decision` | Blocked by product or owner choices |
| `blocked_external_state` | Blocked by external environment/state |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Route out-of-scope gaps to `docs/projects/GLOBAL_GAPS.md` only when ownership is not SaveLoad.
- Mark `active` only when verification is blocked and needs action.
