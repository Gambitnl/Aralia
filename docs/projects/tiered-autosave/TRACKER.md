# TRACKER: Tiered Autosave Checkpoint System

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

## Active Work Queue

| ID | Status | Task | Owner | Evidence | Next Action | Next Check |
|---|---|---|---|---|---|---|
| A1 | active | Call `initializeStorage()` during app startup and remove startup race gaps between migration and UI rendering | Project owner | `src/services/saveLoadService.ts`, `src/App.tsx`, `src/components/layout/MainMenu.tsx` | Add one initialization effect in root boot path before save checks and modals | Verify legacy localStorage payloads migrate correctly |
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
