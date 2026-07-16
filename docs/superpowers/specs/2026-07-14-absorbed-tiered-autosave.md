# Absorbed: Tiered Autosave (docs/projects/tiered-autosave)

Absorbed into the planmap topic `tiered-autosave` by the 2026-07 absorption wave.
The folder's git history is the archive; this doc keeps the still-live operational context.
Runtime documentation lives in `src/services/saveLoad.README.md` (rewritten for the
IndexedDB-first reality; every claim verified against the services).

## What this project was

Tiered autosave checkpoints over IndexedDB persistence: multiple recovery points for the
player without localStorage quota risk.

## Current state (all project gaps resolved 2026-07-11, whole-game systems audit W01)

- `src/services/indexedDBStorageService.ts` wired into `src/services/saveLoadService.ts`;
  IndexedDB-first with localStorage fallback, one-time migration (`MIGRATION_FLAG_KEY`),
  emergency save key `aralia_rpg_emergency_save` recovered on init.
- Checkpoint tiers defined in `CHECKPOINT_TIERS` (1 / 5 / 15 / 30 minutes).
- GAP-002 resolved: `src/hooks/useAutoSave.ts` schedules each service-defined tier during
  eligible exploration, prevents overlapping writes per tier
  (`src/hooks/__tests__/useAutoSave.test.tsx`, 3/3).
- GAP-003 resolved: `src/components/SaveLoad/LoadGameModal.tsx` presents Waystones,
  Echoes, and Chronicles separately; live one-minute checkpoint rendered 2026-07-11.
- GAP-005 resolved: `src/services/__tests__/saveLoadService.test.ts` covers IDB-only
  writes, IDB precedence, local fallback, corrupt-IDB rejection, dual-store deletion,
  migration, emergency recovery (42/42).
- GAP-006 resolved: `src/services/saveLoad.README.md` rewritten (doc-only).

## Explicitly deferred (adjacent scope)

Save compression, cross-tab sync strategy, advanced export/import, long-term save
migration version strategy.
