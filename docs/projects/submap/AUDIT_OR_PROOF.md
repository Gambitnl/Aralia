# Submap Audit and Proof

Status: active
Last updated: 2026-06-09

## 2026-06-09 Dependency Inventory Refresh

This pass was a source-backed documentation pass only. No runtime systems were
deleted, moved, or replaced.

The 2026-06-09 user clarification makes this an active pre-deprecation
extraction packet. This proof is the starting evidence for inventorying
dependents and extracting retained functions before any component deprecation.

| Surface checked | Evidence | Finding |
|---|---|---|
| Visibility routing | `src/components/CompassPane/index.tsx`, `src/components/layout/GameLayout.tsx`, `src/components/layout/GameModals.tsx`, `src/hooks/actions/handleSystemAndUi.ts`, `src/state/reducers/uiReducer.ts` | Submap visibility is tied to modal mutual exclusion and NPC-interaction reset. |
| Quick travel | `src/components/Submap/SubmapPane.tsx`, `src/hooks/actions/handleMovement.ts`, `src/types/actions.ts` | Quick travel depends on destination, ordered path, per-step durations, encounter chance, and step delay. |
| Inspect | `src/components/Submap/SubmapPane.tsx`, `src/hooks/actions/handleObservation.ts`, `src/types/actions.ts` | Inspect stores descriptions under the parent world tile and advances time by five minutes. |
| Map data compatibility | `src/hooks/useGameInitialization.ts`, `src/services/mapService.ts`, `src/services/saveLoadService.ts`, `src/state/migrations/worldDataMigration.ts`, `src/utils/mapDataToWorldData.ts` | Legacy tile-grid `MapData` remains part of setup, save/load, migration, and 3D world-data resolution. |

## Conclusion

The dependency contract is stronger, but the project is not ready for deletion.
Future agents may be assigned extraction-only passes that inventory dependents,
lift retained contracts, or write proof. They must not remove Submap components
until retained behavior has owners and replacement proof.
