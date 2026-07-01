# Grid Retirement — Consolidated Decoupling Plan (Stage 5 + Stage 6)

**Date:** 2026-06-30
**Status:** Active — driving the [Cell-Native World umbrella](../specs/2026-06-29-cell-native-world-umbrella.md) to completion
**Goal:** Safely deprecate and fully uncouple the legacy 30×20 world grid from Aralia,
replacing it with cell-native systems on the Worldforge atlas.

## Where we are

Stages 1–4 of the umbrella are implemented and green (cell-addressed entry, the
`playerCell {cellId, localeCoords}` position model, Locale 2D/3D synced movement, and
atlas fast-travel arrival). Stage 5 (seamless edge-crossing) is undesigned; Stage 6
(delete the grid) is the goal's end-state. Baseline verified green 2026-06-30:
`state/__tests__` + `MapPane.test.tsx` = 72/72.

## What still couples to the grid (audit synthesis, 2026-06-30)

Three read-only audits mapped ~67 coupling sites. The grid plays **six roles**, each with
a cell-native replacement:

| # | Grid role | Where it couples (key sites) | Cell-native replacement | Needs Stage 5? |
|---|---|---|---|---|
| R1 | **Biome at the player** | `worldReducer.resolveBiomeId` parses `coord_X_Y`→`mapData.tiles[y][x].biomeId` | `playerCell.cellId` → `atlas.pack.cells.biome[cellId]` | no |
| R2 | **Town/burg at the player** | `chronicleForLocation.burgIdForLocation` → `getTownTilesForGrid` + coord match; `useTownSimRegistration` | `atlas.pack.cells.burg[cellId]` (FMG-native) | no |
| R3 | **NPC presence** | `determineActiveDynamicNpcsForLocation(coord_X_Y)` at every move/entry | cell-anchored `LOCATIONS` overrides keyed on `cellId` | no |
| R4 | **Locale-local position** | `subMapCoordinates` (BA-3/BA-5 dual producer) | `playerCell.localeCoords` (feet, from `playerGroundPos`) | done (Stage 3) |
| R5 | **Overland movement** | compass `handleMovement` + grid stepping + `CompassPane` + `DIRECTION_VECTORS` | atlas fast-travel (Stage 4 ✅) for hops + **seamless edges (Stage 5)** for walking | **yes** |
| R6 | **World data + save** | `generateMap` (×9 callers), `mapData.tiles`, `gridSize`, save serialize, `worldDataMigration` | atlas-derived geography; save stores only `playerCell` (+ one-way migration) | partial |

**Bridge functions** split into KEEP (cell-native: `snapToLandCell`, `entry3DAnchorForCell`,
`getWorldforgeLocalForCell`, `getBridgeAtlas`, `getBurgNamer`, `spreadColocatedPoints`) and
RETIRE-with-grid (`legacyGridToAtlasCell`, `atlasCellToLegacyGrid`, `gridCellToAtlasSite`,
`gridCellToGraphPoint`, `legacyTileToAtlasCell`, and the grid-keyed `getTownTilesForGrid`,
which needs a cell-keyed successor `listBurgCells`).

`// GRID-RETIRE:` band-aids in code: BA-2 (`appState` MOVE_PLAYER arrival), BA-3 (×4: the feet
mirror in `worldReducer`, `localePosition`, `LocaleMovePane`, `World3DWrapper`), BA-5
(`appState` dual `localeCoords` producer).

## The key lever (safety)

**R1–R3 (the position *readers*) can be migrated to `playerCell.cellId` NOW, additively,
independently of Stage 5.** `playerCell.cellId` is already the source of truth and is
populated at spawn, on Stage-4 arrival, and on every ground move. Flipping each reader from
the lossy `coord_X_Y` to the canonical cell **demotes the grid to derived bookkeeping** — the
umbrella's explicit prerequisite for deletion — without touching movement. This shrinks the
risky Stage-6 deletion to "remove bookkeeping nothing reads anymore."

## Build order (safe, additive, always-playable)

### Phase A — Demote the grid to bookkeeping (reader migration; independent of Stage 5)
Each slice is its own TDD cycle with a **golden-before-flip** check (the Stage-1 lesson: prove
the cell-native reader returns the same answer as the grid reader for the spawn cell before
flipping). Additive: the cell path is preferred when `playerCell` is present; the legacy coord
path stays as the fallback for the two-producer window and is tagged `// GRID-RETIRE:`.

- **A1 — Town/burg reader (R2).** New pure `burgIdForCell(worldSeed, cellId)` =
  `getBridgeAtlas(worldSeed).pack.cells.burg[cellId] || undefined`. `burgIdForLocation` prefers
  it when a `cellId` is supplied; callers (`useTownSimRegistration`, `resolveTownForLocation`)
  pass `playerCell.cellId`. Golden: for the spawn cell, `burgIdForCell` === the grid-path burg.
  *(First slice — cleanest, FMG stores burg-per-cell natively.)*
- **A2 — Biome reader (R1).** `resolveBiomeId` prefers `atlas.pack.cells.biome[playerCell.cellId]`
  (mapped to legacy id via `wfBiomeIndexToLegacyId`) over the `coord_X_Y` tile biome. Golden vs.
  the unified grid tile biome across sampled seeds before flip.
- **A3 — NPC presence (R3).** Anchor the 14 static `LOCATIONS` to cell ids; resolve active NPCs
  by `playerCell.cellId` (static-location override) instead of `coord_X_Y`. Keep coord path for
  unanchored wilderness until Stage 6.
- **A-exit:** `coord_X_Y` is written but read by nothing except save/migration → grid is pure
  bookkeeping. Re-verify the full golden suite green.

### Phase B — Stage 5: seamless edge-crossing (replaces compass overland movement, R5)
Own design doc first (`2026-06-30-stage5-...-design.md`). Walking to a Locale boundary streams
the adjacent cell's Locale and **re-anchors `playerCell.cellId`** mid-ground-session (reusing
Stage 4's "cell change ⇒ reset/translate Locale feet, re-anchor entry" invariant), via a NEW
reducer signal (NOT `TravelMeta`, per the Stage-4 doc's Stage-5 notes). Atlas fast-travel
remains the long-hop mover. Compass stays until Stage 6 (additive).

> **UNIFY with the open-region wilderness design**
> ([`2026-06-29-open-region-wilderness-design.md`](../specs/2026-06-29-open-region-wilderness-design.md),
> grilled 2026-06-29, transcribed to a spec file 2026-06-30). That resolved design IS Stage 5's
> rendering/world half: open streaming ground
> (not the bounded 3,000-ft locale), **height + scenery as PURE FUNCTIONS of world position** so
> cross-cell seams match by construction (zero stitching) — the deterministic base + saved
> `state.worldforgeDeltas` already exist (`groundChunkLoader.ts makeGroundWorld`,
> `getWorldforgeLocalForCell`). Stage 5 = that streaming ground (rendering) + the cell-native
> `playerCell.cellId` re-anchor on cross (state). Build order: **seam-first thin vertical slice** —
> walk across one working cell seam on bare ground and EYEBALL it (the one genuinely-risky claim
> is continuous height ACROSS FMG cell boundaries); then layer scenery → vistas → water (sea =
> the maritime/ship layer). Streaming unit = the locale tile; prefetch the neighbour near an edge.

### Phase C — Stage 6: delete the grid
With readers on the cell (Phase A) and overland movement cell-native (Phase B), delete:
`coord_X_Y` / `subMapCoordinates` / `mapData.tiles` / `generateMap` grid path / compass /
`CompassPane` / the RETIRE-with-grid bridge fns. The deletion **forces every `GRID-RETIRE`
band-aid to fail compile/test** until removed (the umbrella's forcing function). Finalize:
save stores only `playerCell`; `playerCellMigration` becomes the one-way legacy-save backfill;
`getTownTilesForGrid` → `listBurgCells`. Stage 6 is done when the `GRID-RETIRE` search is empty.

## Stage 6 — exact ordered deletion sequence (the coordinated operation)

Grep-confirmed (2026-06-30): no grid structure is isolated-deletable — the bridge fns, `coord_X_Y`,
`subMapCoordinates`, and `mapData.tiles` are all held alive by the BA-2 old-save FALLBACK paths and by
spawn/biome-unify/save-migration. So Stage 6 is ONE coordinated cut. Execute in this order; the game stays
playable after each numbered step (run the verify suite between steps). **Movement decision is the gate:
either S5.4 streaming ships first (preserves overland walking) OR commit to fast-travel-only overland.**

1. **Movement writer.** Remove compass overland stepping: `CompassPane`, `handleMovement` grid path
   (`DIRECTION_VECTORS`, `newSubMapCoordinates` math), and the App compass handlers. Overland = atlas
   travel (Stage 4) [+ seamless walk if S5.4 shipped]. The map/atlas already renders without the grid.
2. **Drop the BA-2 fallbacks.** Delete the `coord_X_Y` legacy branches now that no reader needs them:
   `resolveBiomeId` coord branch, `burgIdForLocation`/`chronicleForLocation` coord branch + `gridSize` args,
   `worldReducer` LOD coord branch, `useOpeningSituation` `mapData.tiles` scan, NPC presence coord usage.
   `parseCoordinateLocationId`/`locationIdToTile` become dead → delete.
3. **State fields.** Remove `currentLocationId` (coord form), `subMapCoordinates` from `GameState` +
   `initialState` + both factories; `playerCell` is the sole position. Collapse BA-3/BA-5 (the integer
   `localeCoords` producer in `appState.derivePlayerCell`) → feet-only.
4. **Spawn + biome-unify.** Rewrite `resolveSpawn`/`applyWfSpawnToMap` + `unifyMapBiomes` to be cell-native
   (spawn returns a cell, no grid projection); retire `legacyGridToAtlasCell`/`atlasCellToLegacyGrid`/
   `gridCellToAtlasSite`/`legacyTileToAtlasCell` once their last callers (MapPane pins, spawn, unify) move
   to `playerCell`/`snapToLandCell`/`worldPosToCell`. `getTownTilesForGrid` → cell-keyed `listBurgCells`.
5. **Data structure.** Delete `mapData.tiles`, `gridSize`, `MAP_GRID_SIZE`, the 9 `generateMap` callers +
   `mapService`/`azgaarDerivedMapService` tile builders. Fog/discovery move to cell ids
   (`discoveredHiddenSites` already cell/site-based). MapPane already renders the atlas, not tiles.
6. **Save migration (breaking).** Bump save version; on load, translate any legacy `coord_X_Y`+
   `subMapCoordinates`+`mapData` save to `playerCell` ONE-WAY (`playerCellMigration` becomes the legacy
   importer), then stop serializing grid fields. `worldDataMigration` tile path retires.
7. **Sweep.** `// GRID-RETIRE:` search returns EMPTY; ledger empty; `tsc -b` + full suite green. Done.

## Standing constraints (every slice)
Design/plan-first; TDD (failing test first); ADDITIVE & always-playable until Phase C; do NOT
change `legacyTileToAtlasCell` / `getTownTilesForGrid` / `atlasCellToLegacyGrid` *behavior*
before Phase C; never rely on a cell→tile→cell round-trip being lossless (carry the cell);
no fallback layers (a genuinely-unknown value is `null`, honest); new GameState fields update
both factories + `initialState`; any interim compromise adds a Band-Aid Ledger row + a
`// GRID-RETIRE:` tag. Verify: `npx tsc -b` and
`npx vitest run --no-file-parallelism src/systems/worldforge/ src/state/__tests__/ src/components/__tests__/MapPane.test.tsx`.
Ignore only pre-existing failures (the umbrella lists them; plus the `clever-snyder` worktree).

## First action
Phase A1 (town/burg reader), TDD: failing golden test → `burgIdForCell` → flip `burgIdForLocation`
to prefer the cell → callers pass `playerCell.cellId`.
