# Submap Dependency Contract

Status: active
Last updated: 2026-06-10

This note records the renderer-independent contract that the DOM/tile Submap
depends on before its components can be deprecated. It is intentionally narrow:
the goal is to extract quick-travel, inspection, tooltip, local-terrain,
material, and travel-timing behavior into reusable owners so a future
replacement map/navigation surface can work without reverse-engineering
gameplay rules from the current UI.

## Preserved Behavior

- The DOM/tile Submap remains present in the repo while extraction proceeds.
- It owns the local mode toggles for inspect, quick travel, glossary, and the
  3D preview handoff.
- It still computes tile visuals, hover state, path overlays, tooltip text, and
  the action payloads that drive travel and inspection.
- The phase-out path is inventory, extraction, proof, replacement-owner
  decision, and only then component deprecation. This note does not authorize
  deletion or renderer replacement.

## Renderer-Independent Inputs

- `currentWorldBiomeId`
- `parentWorldMapCoords`
- `worldSeed`
- `submapDimensions`
- `playerSubmapCoords`
- `currentLocation`
- `mapData`
- `gameTime`
- `playerCharacter`
- `inspectedTileDescriptions`
- `adjacentBiomeIds` when available for blend context

## Renderer-Independent Outputs

- `useSubmapProceduralData` produces `simpleHash`, `activeSeededFeatures`,
  `pathDetails`, `caGrid`, `wfcGrid`, and `biomeBlendContext`.
- `submapVisuals` produces `VisualLayerOutput` with the fields the tile surface
  and later renderers need to keep in sync:
  `style`, `content`, `animationClass`, `isResource`,
  `effectiveTerrainType`, `zIndex`, `activeSeededFeatureConfigForTile`, and
  `isSeedTile`.
- `useSubmapGrid` flattens the grid and attaches tooltip text.
- `useInspectableTiles` returns the adjacent-tile set when inspect mode is
  active.
- `useQuickTravelData` returns `path`, `orderedPath`, `time`, and `isBlocked`.
- `useTileHintGenerator` keeps inspected text ahead of fallback biome hints.

## Action Contract

### Quick Travel

- `SubmapPane` dispatches `QUICK_TRAVEL` with `destination`, `durationSeconds`,
  `orderedPath`, `stepDurationsSeconds`, `encounterChancePerStep`, and
  `stepDelayMs`.
- `durationSeconds` is derived from the pathfinder result in seconds before
  dispatch. The handler still advances time step-by-step.
- `orderedPath` is the preferred route source. The handler only falls back to
  the current position plus destination when the path array is missing.
- `stepDurationsSeconds` are derived from the pathfinding grid in seconds, not
  minutes.
- `encounterChancePerStep` and `stepDelayMs` are UI-supplied limits; the
  handler clamps them before use.
- Impassable destination tiles must be rejected before dispatch and again by
  the handler.

### Inspect

- `SubmapPane` dispatches `inspect_submap_tile` with
  `tileX`, `tileY`, `effectiveTerrainType`, `worldBiomeId`,
  `parentWorldMapCoords`, and `activeFeatureConfig`.
- `handleInspectSubmapTile` stores the returned description under the parent
  world tile key and advances time by 300 seconds.
- Only adjacent tiles are inspectable in the current UI, and that adjacency
  rule is renderer-independent.

## Source Dependency Inventory

This inventory captures the current dependency edges that extraction work must
preserve or explicitly retire. It is not a replacement plan and does not
authorize deleting the current DOM/tile surface.

| Dependency | Source evidence | Preserve before replacement |
|---|---|---|
| Submap modal visibility | `src/components/CompassPane/index.tsx`, `src/components/layout/GameLayout.tsx`, `src/components/layout/GameModals.tsx`, `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleSystemAndUi.ts`, `src/state/reducers/uiReducer.ts` | `toggle_submap_visibility` must continue to close conflicting map/3D/dev surfaces and reset NPC interaction context through `TOGGLE_SUBMAP_VISIBILITY`. |
| Action menu local context | `src/components/ActionPane/useActionGeneration.ts`, `src/components/ActionPane/index.tsx`, `src/systems/spells/ai/MaterialTagService.ts`, `src/utils/submapUtils.ts` | Preserve local terrain/material lookup behavior before changing action menu movement, gather, inspect, or spell-material options. |
| Quick-travel dispatch | `src/components/Submap/SubmapPane.tsx`, `src/types/actions.ts`, `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleMovement.ts` | Preserve `destination`, `durationSeconds`, `orderedPath`, `stepDurationsSeconds`, `encounterChancePerStep`, and `stepDelayMs` semantics, including handler clamping and ordered-path fallback. |
| Inspect dispatch and storage | `src/components/Submap/SubmapPane.tsx`, `src/types/actions.ts`, `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleObservation.ts` | Preserve `inspect_submap_tile` payload fields, parent-world-tile storage via `UPDATE_INSPECTED_TILE_DESCRIPTION`, and the five-minute time advance. |
| Minimap local preview | `src/components/Minimap.tsx`, `src/hooks/useSubmapProceduralData.ts`, `src/config/submapVisualsConfig.ts` | Decide whether Minimap keeps local generated features after the large Submap surface is retired. |
| Generation services | `src/hooks/useSubmapProceduralData.ts`, `src/components/Submap/submapVisuals.ts`, `src/services/cellularAutomataService.ts`, `src/services/wfcService.ts`, `src/services/DoodadGenerator.ts`, `src/services/TerrainGenerator.ts` | Extract CA, WFC, path, seeded-feature, scatter, and biome-blend rules that remain useful outside the Submap UI. |
| Town/village overlap | `src/services/villageGenerator.ts`, `src/components/Town`, `src/services/RealmSmithTownGenerator.ts`, `src/services/BuildingGenerator.ts` | Decide whether settlement-local layout replaces seeded village features, consumes them, or lives in a separate town owner. |
| Dungeon/puzzle hooks | `src/systems/puzzles/lockSystem.ts`, `src/systems/puzzles/puzzleSystem.ts`, `src/systems/puzzles/mechanism.ts` | Route dungeon tile interactions to the replacement local navigation surface, battle map, or a new dungeon interaction owner. |
| World `MapData` compatibility | `src/hooks/useGameInitialization.ts`, `src/services/mapService.ts`, `src/services/saveLoadService.ts`, `src/state/migrations/worldDataMigration.ts`, `src/utils/mapDataToWorldData.ts`, `src/App.tsx` | Keep legacy tile-grid data, `worldData` v2 backfill, save/load migration, and 3D world-data resolution available until a replacement contract is proven. |
| Combat map data adjacency | `src/types/combat.ts`, `src/hooks/useBattleMap.ts`, `src/hooks/combat/useGridMovement.ts`, `src/utils/spatial/pathfinding.ts`, `src/utils/spatial/lineOfSight.ts` | Do not collapse world `MapData` and `BattleMapData`; pathfinding, line-of-sight, terrain, and AI consumers still rely on battle-map tile maps. |
| Design/tooling references | `src/components/DesignPreview`, `src/components/BattleMap`, `src/components/Components_Ralph.md`, CSS z-index variables | Preserve useful examples and update stale references only after extraction choices are made. |

## Dependent-System Extraction Matrix

Classification key: **retain** = keep behavior as-is; **extract** = lift to reusable
owner; **replace** = needs replacement surface (blocked on G5); **retire** = safe to
drop only after proof.

| Dependent surface | Source evidence | Retained function | Class | Owner / project | Next proof |
|---|---|---|---|---|---|
| Submap modal shell | `SubmapPane.tsx`, `GameModals.tsx`, `GameLayout.tsx` | Local map UI, mode toggles, tile hit-testing | retain | `submap` until replacement named | Visual parity check after any extraction wiring |
| Compass launch | `CompassPane/index.tsx`, `toggle_submap_visibility` | Open/close local map from compass | extract | navigation entry contract | Toggle still closes conflicting modals |
| Action menu local context | `ActionPane/useActionGeneration.ts`, `submapUtils.ts`, `MaterialTagService.ts` | Terrain/material lookup for gather, inspect, spell targeting | extract | map-query contract | `getSubmapTileInfo` tests survive UI removal |
| Quick travel dispatch | `SubmapPane.tsx`, `submapActionContracts.ts`, `handleMovement.ts` | Path payload, step durations, encounter timing | extract | `src/utils/spatial/submapActionContracts.ts` | `submapActionContracts.test.ts` green; optional SubmapPane wiring |
| Inspect dispatch | `SubmapPane.tsx`, `submapActionContracts.ts`, `handleObservation.ts` | Adjacency rule, storage key, 300s time advance | extract | `src/utils/spatial/submapActionContracts.ts` | Contract tests + storage key proof |
| Movement handler | `handleMovement.ts`, `types/actions.ts` | `QUICK_TRAVEL` clamping, impassable checks, step loop | retain | action pipeline | Handler tests unchanged after UI wiring |
| Observation handler | `handleObservation.ts` | `inspect_submap_tile` prompt + `UPDATE_INSPECTED_TILE_DESCRIPTION` | retain | action pipeline | Inspect handler test or proof note |
| UI reducer / modal mutex | `uiReducer.ts`, `handleSystemAndUi.ts` | `isSubmapVisible` mutual exclusion | retain | layout state | Modal conflict matrix documented |
| Minimap preview | `Minimap.tsx`, `useSubmapProceduralData.ts` | Local terrain/feature preview independent of full Submap UI | extract | Minimap + `GAPS.md` G4/G8 imported plan appendix | Minimap renders from extracted generation core |
| Procedural generation | `useSubmapProceduralData.ts`, `submapPathContinuity.ts`, CA/WFC services | CA, WFC, paths, seeded features, biome blend | extract | `submap-generation` / `GAPS.md` G4/G8 imported plan appendix | Fixture parity for plains/cave/wetland |
| Visual projection | `submapVisuals.ts`, `submapVisualsConfig.ts` | `VisualLayerOutput` fields for tiles/tooltips | extract | map preview contract | Field list unchanged after core extraction |
| Painter path | `Submap/painters/*` | Alternate renderer draw contracts, texture cache | retain | `submap` (G6, CMA-G16) | Inventory before any painter split |
| Town/village overlap | `villageGenerator.ts`, `Town/*`, `RealmSmithTownGenerator.ts` | Settlement-local layout vs seeded village features | replace | human/product (G5) | Owner decision after inventory complete |
| Puzzle/dungeon hooks | `systems/puzzles/*` TODOs | Dungeon tile interactions | replace | dungeon/navigation owner | Route decision after G5 |
| Save/map compatibility | `mapService.ts`, `saveLoadService.ts`, `worldDataMigration.ts` | Legacy `MapData`, v2 backfill | retain | world data | Save/load regression proof |
| Combat map adjacency | `types/combat.ts`, `useBattleMap.ts`, spatial pathfinding | Separate `BattleMapData` tile maps | retain | combat map | Do not collapse with world `MapData` |
| Context/LLM prompts | `contextUtils.ts`, `ollamaTextService.ts`, `geminiService.ts` | Submap coords in action context strings | extract | context builder | Context strings still include terrain after UI change |
| Design/tooling refs | `DesignPreview/*`, `BattleMap/*`, CSS z-index | Examples and stale references | retire | post-extraction cleanup | Remove refs only after owner decisions |

## UI-Independent Action Contract Module

`src/utils/spatial/submapActionContracts.ts` now centralizes:

- inspect adjacency keys (`getInspectableTileKeys`)
- `QUICK_TRAVEL` payload assembly (`buildQuickTravelPayload`)
- inspect payload assembly (`buildInspectSubmapTilePayload`)
- inspect storage key format (`buildInspectTileStorageKey`)
- handler-side normalization (`normalizeQuickTravelHandlerInputs`)

Focused proof: `src/utils/spatial/__tests__/submapActionContracts.test.ts` (9 tests,
2026-06-10). SubmapPane still builds payloads inline; wiring callers through the
module is a follow-up (G7).

## Next Proof Path

Before component deprecation:

1. Wire `SubmapPane` through `submapActionContracts` without behavior drift (G7).
2. Extract `generateLocalTerrainData` per `GAPS.md` G4/G8 (retired generation-modularization plan imported there).
3. Compare Minimap preview output before/after generation-core extraction.

If a future renderer or navigation surface replaces the tile surface, it should
satisfy this contract before changing visuals or input routing.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/projects/submap/DEPENDENCY_CONTRACT.md","sha256WithoutMarker":"5f1fdb05e09350f2aee97a2b101fb7360f6a661c9507bbec24fe8e57d8ccb951","markedAtUtc":"2026-06-25T23:34:52.158Z"} -->
