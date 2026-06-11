# Tiered Autosave Living Tracker

Status: active
Last updated: 2026-06-10

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Last Updated
2026-05-31

## Project Status
- **Mode:** active
- **Current Outcome Level:** partial
- **Primary risk:** checkpoint automation is not yet wired through app runtime.

## Completed Work
- `[done]` Added IndexedDB storage service with async payload operations.
- `[done]` Switched `saveLoadService` to IDB-first payload storage with localStorage fallback.
- `[done]` Added migration path from legacy localStorage save payload keys.
- `[done]` Added emergency save key path and recovery helper in `saveLoadService`.
- `[done]` Added checkpoint slot constants and metadata support (`isCheckpoint`, `slotId` prefixes).
- `[done]` **A1** (2026-06-10): Wired `initializeStorage()` into App.tsx startup effect. Also fixed `buildSlotIndex` ghost mitigation to trust the metadata index when IDB is active (post-migration payloads live in IDB, not localStorage). Wired `emergencySaveSync` into `beforeunload` handler in `useAutoSave.ts` (GAP-004).

## Active Work Queue

| ID | Status | Task | Owner | Evidence | Next Action | Next Check |
|---|---|---|---|---|---|---|
| A1 | done | Call `initializeStorage()` during app startup and remove startup race gaps between migration and UI rendering | Project owner | `src/App.tsx`, `src/services/saveLoadService.ts`, `src/hooks/useAutoSave.ts` | Wired into App.tsx useEffect; fixed ghost mitigation for IDB mode; wired emergencySaveSync into beforeunload | Verified via typecheck; runtime proof pending |
| A2 | active | Implement checkpoint copy runner for defined tiers | Project owner | `src/services/saveLoadService.ts` tier config; missing `useCheckpointSaves.ts` | Create and wire checkpoint timer hook from autosave snapshots | Confirm checkpoints appear as expected in slot list |
| A3 | active | Separate checkpoint presentation in `LoadGameModal` and guard deletion for non-manual slots | Project owner | `src/components/SaveLoad/LoadGameModal.tsx` | Add checkpoint section and disable delete action for checkpoint slots | Manual UI test for checkpoint list and action behavior |
| A4 | active | Update save/load docs to match IndexedDB behavior | Project owner | `src/services/saveLoad.README.md` | Replace localStorage-first text with current design | Add note on IDB fallback and emergency save |
| A5 | active | Extend persistence tests to cover IndexedDB paths and initializeStorage | Project owner | `src/services/__tests__/saveLoadService*.ts` | Add tests for migration + fallback + emergency recovery | CI test run for save/load suite |

## Discovery Notes
- Current docs in this folder were written before runtime details matured; they need regular refreshs when implementation changes.
- No external code edits are required by this doc update.

## Next Checks
- Re-scan this tracker whenever checkpoint hooks or storage init are added.
- Keep `status` rows as `done` only after evidence is verified in code and tests.

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | active | Normalize this tracker to the living-project workflow contract | future agent | 2026-06-10 | docs/projects/PROJECT_CARD_SCHEMA.md; docs/agent-workflows/living-project-task-protocol/templates/LIVING_TRACKER.md | Replace this seeded row with the current real project task during the next iteration | Project tracker has at least one current active/waiting/done row with evidence and next proof |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
