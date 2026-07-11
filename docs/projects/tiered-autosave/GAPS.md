---
schema_version: 1
gap_schema: project_gap_registry
project: Tiered Autosave
slug: tiered-autosave
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-07-11"
gap_count: 4
open_gap_count: 0
resolved_gap_count: 4
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
Last updated: 2026-07-11

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GAP-002 | resolved | medium | in_scope_now | Tiered Autosave | confirmed | project |  | none | none | current | Autosave/checkpoint runtime | whole-game systems audit W01 | No checkpoint timer runner was connected. | `src/hooks/useAutoSave.ts` now schedules each service-defined tier only during eligible exploration and prevents overlapping writes per tier; `src/hooks/__tests__/useAutoSave.test.tsx` covers the first threshold, disabled autosave, and leaving exploration. | IndexedDB checkpoint slots now receive runtime recovery snapshots instead of existing only as constants and UI expectations. | Keep the scheduler contract covered while resolving checkpoint visibility separately. | `npx vitest run src/hooks/__tests__/useAutoSave.test.tsx --maxWorkers=2` (3/3 passing, 2026-07-11). | The service infers checkpoint metadata from the reserved slot prefix, so the hook reuses the canonical save path. |
| GAP-003 | resolved | low | adjacent_follow_up | Tiered Autosave | confirmed | project |  | none | done | current | Save/load UI | whole-game systems audit W01 | Load modal mixed rapid autosaves and longer checkpoint history. | `src/components/SaveLoad/LoadGameModal.tsx` now presents Waystones, Echoes, and Chronicles separately; focused tests cover grouping/load/delete; a live one-minute checkpoint rendered in Waystones on 2026-07-11. | Players can now recognize the recovery horizon they are selecting instead of mistaking every automatic record for the latest autosave. | Preserve the three-section contract while completing IndexedDB path coverage under GAP-005. | 3/3 focused component tests plus live DOM, screenshot, and safe-delete confirmation proof. | The live pass generated a real checkpoint through the runtime scheduler rather than injecting display-only metadata. |
| GAP-005 | resolved | medium | adjacent_follow_up | Tiered Autosave | confirmed | project |  | none | none | current | Save/load tests | whole-game systems audit W01 | IndexedDB migration tests existed, but normal initialized save/load/delete, precedence, fallback, and corruption paths were not directly proved. | `src/services/__tests__/saveLoadService.test.ts` now covers IndexedDB-only payload writes with local preview metadata, IDB precedence over stale local data, valid local fallback when IDB is missing, corrupt IDB rejection, dual-store deletion, one-time migration, and emergency recovery. | The primary storage path and its recovery boundary now have executable evidence instead of inheriting confidence from localStorage-era tests. | Preserve the initialized-storage cases whenever storage routing or save metadata changes. | Full focused save/load service suite passes 42/42 on 2026-07-11. | Audit corrected the older broad wording: migration coverage was already present; five primary-path cases were the actual missing boundary. |
| GAP-006 | resolved | low | adjacent_follow_up | Tiered Autosave | confirmed | project |  | none | none | not_recorded | Save/load documentation | implementation scan | `saveLoad.README.md` is stale. | `src/services/saveLoad.README.md`; board-reconciled 2026: task "W2-P6: Rewrite saveLoad.README.md for IndexedDB-first reality (doc-only)" — src/services/saveLoad.README.md rewritten; verified every claim against saveLoadService.ts + indexedDBStorageService.ts. Covers IndexedDB-first storage layout, localStorage fallback, one-time migration (MIGRATION_FLAG_KEY), emergency save (EMERGENCY_SAVE_KEY) via emergencySaveSync/recover on init, notify callback -> NotificationSystem (no alert()), SaveLoadResult return shape, checksum+version integrity, cross-tab sync. Doc-only, no code touched. GOV.UK plain English, US spelling. Self-reviewed. | Future operators may rely on outdated localStorage-first behavior. | Rewrite docs for IndexedDB-first flow, migration, emergency save key, and notification path. | README reflects current storage flow and links to proof. |  |

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
