# Tiered Autosave Living Tracker

Status: active
Last updated: 2026-06-12

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

## Active Work Queue

| ID | Status | Task | Owner | Evidence | Next Action | Next Check |
|---|---|---|---|---|---|---|
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
| T1 | active | Wire checkpoint tier runner and keep autosave docs aligned | future agent | 2026-06-12 | `NORTH_STAR.md`; `GAPS.md` GAP-002 through GAP-006; `src/services/saveLoadService.ts`; `src/components/SaveLoad/LoadGameModal.tsx` | Implement or explicitly defer checkpoint timer wiring, then update UI/test/docs follow-ups to match the chosen path. | Checkpoint tiers either write to slots through runtime proof or the project records a deliberate defer decision with updated gaps. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
