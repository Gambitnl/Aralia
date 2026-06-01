# NORTH STAR: Tiered Autosave Checkpoint System

## Purpose
Document the state, scope, and next actions for the autosave checkpoint work so future work can continue without re-locating implementation intent.

## Scope
- In scope: IndexedDB persistence, autosave slot migration, checkpoint tier model, save slot loading behavior, checkpoint-to-UI integration.
- Adjacent, explicitly deferred: save compression, cross-tab sync strategy, advanced export/import, long-term save migration version strategy.

## Objective
Keep multiple recovery points available for the player while removing localStorage quota risk.

## Current State (as of 2026-05-31)
- `src/services/indexedDBStorageService.ts` exists and is wired into `src/services/saveLoadService.ts`.
- `saveLoadService` now stores save payloads in IndexedDB when available, and falls back to localStorage when needed.
- Legacy localStorage saves can be migrated into IndexedDB, with an `MIGRATION_FLAG_KEY` guard.
- Emergency fallback save uses localStorage key `aralia_rpg_emergency_save` and is recovered into normal loading flow.
- Checkpoint slots are defined in `CHECKPOINT_TIERS`:
  - 1 minute
  - 5 minutes
  - 15 minutes
  - 30 minutes
  - 1 hour
- Auto-save still runs through `useAutoSave` (debounce + throttle, visibility hooks, beforeunload save attempt).
- `useCheckpointSaves` is not present in source, so checkpoint copy timers are not yet active in practice.
- `LoadGameModal` currently groups `isAutoSave` slots together and does not yet render a dedicated checkpoint section.
- `saveLoad.README.md` still describes localStorage-first behavior and is no longer current.

## Implementation Status Snapshot
- PASS: metadata fields, slot index cache, checkpoint slot tagging.
- PASS: migration from localStorage payload keys and emergency save recovery path are implemented in service layer.
- PASS: core save/load APIs support async storage through IndexedDB.
- BLOCKER: startup initialization and checkpoint runner are not fully connected to the app flow.

## File Map
- `src/services/indexedDBStorageService.ts` - raw IndexedDB wrapper (`putSave`, `getSave`, `deleteSave`, `getAllKeys`, `clearAllSaves`).
- `src/services/saveLoadService.ts` - canonical save/read/delete API, migration flags, metadata indexing.
- `src/hooks/useAutoSave.ts` - periodic gameplay autosave hook.
- `src/components/SaveLoad/LoadGameModal.tsx` - resume/load listing.
- `src/components/SaveLoad/SaveSlotSelector.tsx` - save slot manual selection.
- `src/components/layout/MainMenu.tsx` - save/load modal entry and slot refresh wiring.
- `src/hooks/useGameInitialization.ts` - load flow entrypoint into reducer.
- `src/services/__tests__/saveLoadService*.ts` - existing coverage still mostly localStorage-first assertions.
- `docs/projects/tiered-autosave/ARCHITECTURE_NOTES.md` and `DECISIONS.md`.

## Decisions To Preserve
- IndexedDB for payload storage is the storage direction; metadata can stay in localStorage for sync reads.
- Checkpoint model remains five checkpoints plus rapid autosave (6 total auto slots).
- Independent checkpoint timers are the intended behavior, not cascading promotion.

## Active Uncertainty
- Whether startup call order should force an explicit `initializeStorage()` before UI save checks.
- Whether checkpoint slots should be user-visible as their own protected section vs current auto save section.
- How to prevent checkpoint data loss across rapid tab close events without impacting normal autosave path.

## Resume Path
1. Read `TRACKER.md`.
2. Address the open gaps in `GAPS.md`.
3. Re-check implementation against `src/services/saveLoadService.ts`, then update docs in this folder only.
