# 3. Retire the MapData tile grid in favour of cell-native world reads

Date: 2026-09-09

## Status

Accepted, partially executed. One production blocker remains (legacy v1 save
backfill); it is named below and holds `MapData.tiles` alive as an optional,
deprecated field rather than a required one.

## Context

The world layer carried two overlapping models.

The legacy model is `MapData` in `src/types/world.ts`: a `gridSize` of rows and
columns plus `tiles: MapTile[][]`, a dense 30x20 rectangular array where each
`MapTile` holds `x`, `y`, `biomeId`, an optional `locationId`, `discovered` and
`isPlayerCurrent`.

The cell-native model is the Worldforge Voronoi atlas: `getBridgeAtlas(worldSeed)`
gives a cell graph, `state.playerCell` (`{ cellId, localeCoords }`) is the
canonical player position, `biomeIdForCell(seed, cellId)` gives terrain, and
`cell_<id>` location ids address places. Elevation and water come off the same
atlas pack arrays.

An earlier grid-retirement pass (2026-06-30) already removed `mapData` from
`GameState`, removed it from the save format, deleted the geography-snapshot
read adapter, and made `MapPane` render the atlas directly. What it did not
finish is the residue: `MapData.tiles` is still a required field on the type,
and `MapTile` is still the payload shape that the world map hands back to `App`
when the player clicks a cell. Those payloads were being *synthesised* from
cells (`synthCellTile`) with `x` and `y` hard-coded to `0` and the real cell id
thrown away, so the click contract lied about its own model: it looked like a
grid coordinate and carried no cell identity.

## Consumer inventory (2026-09-09)

Scope note. `BattleMapData.tiles` (`src/types/combat.ts`, a `Map<string,
BattleMapTile>` keyed `"x-y"`) is a **different model** - the tactical combat
board. Roughly 120 files under `src/components/BattleMap/**`,
`src/commands/effects/**` and `src/components/DesignPreview/steps/**` read
`mapData.tiles` in that sense. None of them are in scope here and none were
touched.

### A. Reads/writes of the world `MapData.tiles` field

| Consumer | Verdict |
|---|---|
| `src/state/migrations/worldDataMigration.ts` | **Cannot migrate.** Reads `mapData.tiles[y][x].biomeId` to rebuild `biomeIds` for a pre-v2 save. For a v1 save the grid is the *only* record of that world's biomes - there is no cell atlas to read instead, because the atlas is derived from `worldSeed` and a v1 save's grid may not match it. Now guards against an absent grid and falls back to the seed-derived atlas biome. |
| `src/services/__tests__/saveLoadService.test.ts` (x2) | Fixtures for the migration above. Kept deliberately - they are the regression cover for the one path that still needs the grid. |
| `src/state/migrations/__tests__/worldDataMigration.test.ts` | Same. Kept. |
| `src/commands/__tests__/SummoningCommand.test.ts` | Builds `tiles: Array.from(...)` only to satisfy the required field. Becomes unnecessary once the field is optional; harmless. |
| `src/components/__tests__/MapPane.test.tsx` | `createMapData()` was **dead** - `MapPane` has taken no `mapData` prop since the 2026-06-30 pass. **Migrated:** fixture and import removed. |

### B. Consumers of the `MapTile` element type (the click/observation DTO)

| Consumer | Verdict |
|---|---|
| `src/components/MapPane.tsx` - `synthCellTile` | **Migrated** to return `WorldCellView` carrying the real `cellId`. |
| `src/App.tsx` - `handleTileClick`, `handleEnter3DAtCell`, `getTileTooltipText` | **Migrated** to `WorldCellView`. |
| `src/components/layout/GameModals.tsx` - `onTileClick` / `onEnter3DAtCell` prop types | **Migrated.** |
| `src/hooks/actions/actionHandlerTypes.ts` - `GetTileTooltipTextFn` | **Migrated.** |
| `src/hooks/actions/handleObservation.ts` | **Migrated.** The `as MapTile` cast is gone; the payload now carries `gameState.playerCell.cellId` directly. |
| `src/components/layout/GameLayout.tsx` | Unused `MapData` import. **Migrated** (removed). |
| `src/components/Worldforge/SpawnPreview.tsx` | Unused `MapData` import. **Migrated** (removed). |

### C. Dead `MapData` imports (the type had already left these systems)

| Consumer | Verdict |
|---|---|
| `src/state/actionTypes.ts` | **Migrated** (removed). No action payload has carried the grid since it left `GameState`. |
| `src/types/state.ts` | **Migrated** (removed). `GameState` stopped holding `mapData` on 2026-06-30; only the import lingered. |
| `src/systems/worldforge/local/__tests__/startTowns.test.ts` | **Migrated** (removed). |
| `src/state/reducers/__tests__/worldReducer.test.ts` | **Migrated** (removed). |

Also corrected: the `MapPane.tsx` / `MapPane.d.ts` file header still claimed
that the pane receives a legacy `MapData` and reads it through the World
geography adapter. Both the prop and the adapter were already gone; the comment
now matches the code.

Thirteen of fourteen migratable consumers moved (93%). One
(`worldDataMigration`) is the documented blocker.

### D. Blocked by another agent's lock at the time of writing

None in this scope. The BattleMap files held by concurrent workers
(`BattleMap3DGpuScene.tsx`, `vfx/VFXSystem.tsx`, `terrain/TerrainMesh.tsx`,
`characters/characterActor/CharacterActor.tsx`, `camera/CameraController.tsx`)
all use `BattleMapData.tiles`, which is out of scope per the note above.

## Decision

1. Add `WorldCellView` to `src/types/world.ts` as the cell-native world-cell
   payload. It carries `cellId` as the identity and keeps `x`/`y` as
   display-only bookkeeping so that `coord_X_Y` labels on legacy saves still
   read correctly. It is structurally a superset of `MapTile`, so the migration
   is behaviour-preserving.
2. Migrate every click, entry and observation contract to `WorldCellView`.
3. Mark `MapTile` deprecated and make `MapData.tiles` **optional** and
   deprecated, rather than deleting it. Deleting it would break the one
   remaining honest consumer - the v1 save backfill.
4. Make `migrateMapDataToWorldDataV2` tolerate an absent grid.

## Consequences

The click contract now carries the canonical cell id instead of a fabricated
`(0, 0)`. Callers that previously had to recover the cell from `travelMeta` or
an `Entry3DAnchor` can read it off the payload.

`MapData` is now a save-migration-only type. Nothing in the running game
constructs or reads it.

`MapData.tiles` can be deleted outright once the project decides that pre-v2
saves are no longer loadable. That is a product decision, not a code one, so it
is not taken here.

`x` and `y` on `WorldCellView` remain because the tooltip formatter and the
`coord_X_Y` location-id shape still exist. They are the next thing to remove,
after the `coord_X_Y` -> `cell_<id>` cut finishes.
