# SaveLoad Gaps

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings tied to SaveLoad behavior.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | support_needed_now | Worker B | `docs/projects/saveload/TRACKER.md` | docs pass | Save storage initialization is not started automatically | `src/services/saveLoadService.ts` defines `initializeStorage()` but no caller in startup chain (`rg` scan) | Prevents IndexedDB migration and storage mode setup from running | Add controlled startup call path and verify in App bootstrap path | Verify save migration occurs when localStorage and IDB are both available |
| G2 | not_started | adjacent_follow_up | Worker B | `docs/projects/saveload/TRACKER.md` | docs pass | Checkpoint tier constants are present but not fed by a scheduler | `src/services/saveLoadService.ts` defines `CHECKPOINT_TIERS` and `CHECKPOINT_PREFIX`, no caller found | Avoids false assumptions about checkpoint autosaves | Decide keep/remove and align with checkpoint ownership | Document decision and implementation scope |
| G3 | not_started | adjacent_follow_up | Worker B | `docs/projects/saveload/TRACKER.md` | docs pass | No direct file export/import backup flow in SaveLoad UI/service | `src/components/SaveLoad/*.tsx`, `src/services/saveLoadService.ts` | Impacts manual backup and disaster recovery workflows | Confirm required user-facing restore strategy | Add UX or explicitly mark as out of scope |
| G4 | active | in_scope_now | Worker B | `docs/projects/saveload/TRACKER.md` | docs pass | Schema mismatch is hard-failed instead of migration/transform | `src/services/saveLoadService.ts` version check in `loadGame` | Risk of blocking older saves on format changes | Define migration policy before next schema increment | Update tests and policy docs before any version bump |
| G5 | not_started | support_needed_now | Worker B | `docs/projects/saveload/TRACKER.md` | docs pass | Versioned migration behavior not covered for all payload shapes in tests | `src/services/saveLoadService.test.ts` plus migration tests are partial | Regression risk if older states include missing fields | Expand tests for mixed payload shapes and slot metadata anomalies | Add test cases with missing legacy fields and malformed metadata |
| G6 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G10 | Code modularization audit routing | Central state/save/load files are large split candidates, but save compatibility and migration behavior are the real risk. | `src/state/appState.ts`; `src/state/actionTypes.d.ts`; `src/state/reducers/characterReducer.ts`; `src/services/saveLoadService.ts` | Splitting these surfaces without migration/load proof can silently break older saves or reducer defaults. | Require migration/load regression boundaries before any state/save modularization. | `src/state/migrations/__tests__`, reducer tests, and save/load tests named in a split plan |

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
