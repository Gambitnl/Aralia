# Submap Audit and Proof

Status: active
Last updated: 2026-06-10

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

## 2026-06-10 Extraction Slice (T3/T4/T5)

| Task | Evidence | Finding |
|---|---|---|
| T3 action contract extraction | `src/utils/spatial/submapActionContracts.ts`, `src/utils/spatial/__tests__/submapActionContracts.test.ts` | UI-independent helpers now build/normalize quick-travel and inspect payloads; 9 focused tests pass. SubmapPane not rewired yet (G7). |
| T4 dependent-system matrix | `docs/projects/submap/DEPENDENCY_CONTRACT.md` extraction matrix | 18 dependent surfaces classified with retain/extract/replace/retire and owner routing. |
| T5 generation modularization plan | `docs/projects/submap/GAPS.md` G4/G8 imported plan appendix | Source-backed plan names `generateLocalTerrainData` extraction path and defers painter splits until G3/G6/CMA-G16. |
| Inventory scan | `rg -n -e Submap -e submap -e QUICK_TRAVEL -e inspect_submap_tile src` (2026-06-10) | 90+ non-test source files reference Submap concepts; matrix covers primary integration edges. |

### Verification commands run

```
npx vitest run src/utils/spatial/__tests__/submapActionContracts.test.ts
# 9 passed (2026-06-10)
```

## Conclusion

The dependency contract and extraction matrix are stronger, but the project is not
ready for deletion. Future agents may continue extraction-only passes: wire
`submapActionContracts` into SubmapPane, extract the generation core, and prove
Minimap independence. They must not remove Submap components until retained
behavior has owners and replacement proof.
