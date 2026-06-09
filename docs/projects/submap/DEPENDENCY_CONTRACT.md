# Submap Dependency Contract

Status: active
Last updated: 2026-06-09

This note records the renderer-independent contract that the current DOM/tile
Submap already depends on. It is intentionally narrow: the goal is to preserve
quick-travel, inspection, tooltip, and travel-timing behavior so a future
renderer can be built later without reverse-engineering gameplay rules from the
current UI.

## Preserved Behavior

- The DOM/tile Submap remains the live interactive surface.
- It owns the local mode toggles for inspect, quick travel, glossary, and the
  3D preview handoff.
- It still computes tile visuals, hover state, path overlays, tooltip text, and
  the action payloads that drive travel and inspection.
- The phase-out path is contract extraction first, replacement later. This note
  does not authorize renderer replacement.

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

This inventory captures the current dependency edges that replacement work must
preserve. It is not a replacement plan and does not authorize deleting the
current DOM/tile surface.

| Dependency | Source evidence | Preserve before replacement |
|---|---|---|
| Submap modal visibility | `src/components/CompassPane/index.tsx`, `src/components/layout/GameLayout.tsx`, `src/components/layout/GameModals.tsx`, `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleSystemAndUi.ts`, `src/state/reducers/uiReducer.ts` | `toggle_submap_visibility` must continue to close conflicting map/3D/dev surfaces and reset NPC interaction context through `TOGGLE_SUBMAP_VISIBILITY`. |
| Quick-travel dispatch | `src/components/Submap/SubmapPane.tsx`, `src/types/actions.ts`, `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleMovement.ts` | Preserve `destination`, `durationSeconds`, `orderedPath`, `stepDurationsSeconds`, `encounterChancePerStep`, and `stepDelayMs` semantics, including handler clamping and ordered-path fallback. |
| Inspect dispatch and storage | `src/components/Submap/SubmapPane.tsx`, `src/types/actions.ts`, `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleObservation.ts` | Preserve `inspect_submap_tile` payload fields, parent-world-tile storage via `UPDATE_INSPECTED_TILE_DESCRIPTION`, and the five-minute time advance. |
| World `MapData` compatibility | `src/hooks/useGameInitialization.ts`, `src/services/mapService.ts`, `src/services/saveLoadService.ts`, `src/state/migrations/worldDataMigration.ts`, `src/utils/mapDataToWorldData.ts`, `src/App.tsx` | Keep legacy tile-grid data, `worldData` v2 backfill, save/load migration, and 3D world-data resolution available until a replacement contract is proven. |
| Combat map data adjacency | `src/types/combat.ts`, `src/hooks/useBattleMap.ts`, `src/hooks/combat/useGridMovement.ts`, `src/utils/spatial/pathfinding.ts`, `src/utils/spatial/lineOfSight.ts` | Do not collapse world `MapData` and `BattleMapData`; pathfinding, line-of-sight, terrain, and AI consumers still rely on battle-map tile maps. |

## Next Proof Path

After the renderer-authority decision, the next safe proof should compare one
real `QUICK_TRAVEL` payload from `SubmapPane` against `handleQuickTravel`
assumptions and one real `inspect_submap_tile` payload against
`handleInspectSubmapTile` storage and time behavior.

If a future renderer replaces the tile surface, it should satisfy this contract
before changing visuals or input routing.
