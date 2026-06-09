# Submap Audit and Proof

Status: review-required
Last updated: 2026-06-09

## 2026-06-09 Dependency Inventory Refresh

This pass was a source-backed documentation pass only. No runtime systems were
deleted, moved, or replaced.

| Surface checked | Evidence | Finding |
|---|---|---|
| Visibility routing | `src/components/CompassPane/index.tsx`, `src/components/layout/GameLayout.tsx`, `src/components/layout/GameModals.tsx`, `src/hooks/actions/handleSystemAndUi.ts`, `src/state/reducers/uiReducer.ts` | Submap visibility is tied to modal mutual exclusion and NPC-interaction reset. |
| Quick travel | `src/components/Submap/SubmapPane.tsx`, `src/hooks/actions/handleMovement.ts`, `src/types/actions.ts` | Quick travel depends on destination, ordered path, per-step durations, encounter chance, and step delay. |
| Inspect | `src/components/Submap/SubmapPane.tsx`, `src/hooks/actions/handleObservation.ts`, `src/types/actions.ts` | Inspect stores descriptions under the parent world tile and advances time by five minutes. |
| Map data compatibility | `src/hooks/useGameInitialization.ts`, `src/services/mapService.ts`, `src/services/saveLoadService.ts`, `src/state/migrations/worldDataMigration.ts`, `src/utils/mapDataToWorldData.ts` | Legacy tile-grid `MapData` remains part of setup, save/load, migration, and 3D world-data resolution. |

## Conclusion

The dependency contract is stronger, but the project remains blocked on the
Submap renderer-authority decision. Future implementation agents should not be
assigned to this project until the Required Review Brief is answered.
