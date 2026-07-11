---
schema_version: 1
gap_schema: project_gap_registry
project: SaveLoad
slug: saveload
status: active
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-07-11"
gap_count: 8
open_gap_count: 3
resolved_gap_count: 5
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
Last updated: 2026-07-11

Use this file for durable unresolved findings tied to SaveLoad behavior.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | medium | support_needed_now | Worker B | confirmed | project |  | none | none | current | `docs/projects/saveload/TRACKER.md` | whole-game systems audit W01 | Save storage initialization was reported as absent, but the startup call already exists. | `src/App.tsx` invokes `SaveLoadService.initializeStorage()` from its mount effect; source re-audited 2026-07-11. | Keeping stale bootstrap findings open obscures the real persistence risks. | Preserve the startup call and cover migration behavior through the service tests. | App bootstrap source trace plus migration-focused service tests. | Closed as documentation drift; no runtime change was needed. |
| G2 | resolved | low | adjacent_follow_up | Worker B | confirmed | project |  | none | none | current | `docs/projects/saveload/TRACKER.md` | whole-game systems audit W01 | Checkpoint tier constants were present but not fed by a scheduler. | `src/hooks/useAutoSave.ts` now schedules every `CHECKPOINT_TIERS` slot while eligible exploration is active; `src/hooks/__tests__/useAutoSave.test.tsx` proves firing, disabling, and cancellation. | Checkpoint history now has a runtime producer instead of being a data-only promise. | Retain owner coverage and review checkpoint presentation separately under Tiered Autosave GAP-003. | Focused autosave-hook tests and later rendered load-modal proof. | Resolved 2026-07-11 by the Tiered Autosave owner implementation. |
| G3 | not_started | low | adjacent_follow_up | Worker B | confirmed | project |  | none | none | not_recorded | `docs/projects/saveload/TRACKER.md` | docs pass | No direct file export/import backup flow in SaveLoad UI/service | `src/components/SaveLoad/*.tsx`, `src/services/saveLoadService.ts` | Impacts manual backup and disaster recovery workflows | Confirm required user-facing restore strategy | Add UX or explicitly mark as out of scope |  |
| G4 | active | high | in_scope_now | Worker B | confirmed | project |  | none | none | not_recorded | `docs/projects/saveload/TRACKER.md` | docs pass | Schema mismatch is hard-failed instead of migration/transform | `src/services/saveLoadService.ts` version check in `loadGame` | Risk of blocking older saves on format changes | Define migration policy before next schema increment | Update tests and policy docs before any version bump |  |
| G5 | resolved | medium | support_needed_now | Worker B | confirmed | project |  | none | none | not_recorded | `docs/projects/saveload/TRACKER.md` | docs pass | Versioned migration behavior not covered for all payload shapes in tests | `src/services/saveLoadService.test.ts` plus migration tests are partial; board-reconciled 2026: task "W4-P2: Add save/load migration test coverage for mixed payloads + slot anomalies (test-only)" — src/services/__tests__/saveLoadService.test.ts (+13 tests, test-only): 4 version/payload-shape cases (newer-version reject, unversioned legacy load, mixed wrapper-vs-state version, bare GameState no-wrapper); 3 migratePlayerCell cases (cell_<id> backfill, idempotent preserve, null when no worldSeed); 3 slot-metadata anomaly cases (malformed index, ghost drop, orphan merge); 3 migration-flow cases (migrate+flag stamp, flag skip, emergency recovery) via top-level vi.mock of indexedDBStorageService with in-memory store. Self-reviewed: env verified (jsdom, no fake-indexeddb, idbAvailable stays false for existing tests; migration describe placed LAST to avoid idbAvailable leak). No source touched. Did NOT run vitest/tsc per packet. | Regression risk if older states include missing fields | Expand tests for mixed payload shapes and slot metadata anomalies | Add test cases with missing legacy fields and malformed metadata |  |
| G6 | not_started | low | adjacent_follow_up | Codex | confirmed | code-modularization-audit | docs/projects/code-modularization-audit/GAPS.md | routed | none | not_recorded | `docs/projects/code-modularization-audit` CMA-G10 | Code modularization audit routing | Central state/save/load files are large split candidates, but save compatibility and migration behavior are the real risk. | `src/state/appState.ts`; `src/state/actionTypes.d.ts`; `src/state/reducers/characterReducer.ts`; `src/services/saveLoadService.ts` | Splitting these surfaces without migration/load proof can silently break older saves or reducer defaults. | Require migration/load regression boundaries before any state/save modularization. | `src/state/migrations/__tests__`, reducer tests, and save/load tests named in a split plan |  |
| G7 | resolved | medium | support_needed_now | Codex | confirmed | `docs/BACKLOG.md` |  | none | rendered proof required | not_recorded | `src/components/SaveSlotSelector.tsx` | backlog migration 2026-06-25 | Save-slot focus-trap and keyboard-navigation behavior needs automated accessibility coverage. | `docs/BACKLOG.md`; `src/components/SaveSlotSelector.tsx`; board-reconciled 2026: task "W2-P5: Automated a11y coverage for SaveSlotSelector (focus trap, keyboard nav) + minimal fix" — SaveSlotSelector.tsx (rootRef now useFocusTrap(true,onClose); removed unused useRef import), SaveSlotSelector.test.tsx NEW (8 tests: dialog render, focus-trap activation, Tab/Shift+Tab wrap, Escape close, Cancel close, selection-gated save, fresh-entry save); self-reviewed, mirrors ModalDialog/useFocusTrap canon + WindowFrame.test mock pattern; did NOT run vitest/tsc per packet | Save/load flows are high-risk for keyboard-only users and for accidental destructive selection. | Add focused accessibility tests for focus trap, keyboard navigation, and selection/close behavior. | Automated component tests plus, if UI changes, rendered keyboard proof for the save-slot flow. |  |
| G8 | resolved | low | support_needed_now | Codex | confirmed | game-systems-audit |  | none | none | current | Save storage observability | whole-game systems audit W01 | Loads recovered from localStorage were logged as IndexedDB whenever IndexedDB was merely available. | `src/services/saveLoadService.ts` now records the store that supplied the selected payload; focused tests assert both IDB-primary and local-fallback attribution. | Incorrect source logs misdirect corruption and migration diagnosis precisely when fallback recovery matters. | Keep actual payload source separate from general storage availability. | Save/load service suite passes 42/42 with explicit source assertions. | Discovered while proving Tiered Autosave GAP-005. |

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
