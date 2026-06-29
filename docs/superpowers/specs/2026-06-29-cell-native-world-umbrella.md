# Cell-Native World — Umbrella Design (retire the 30×20 grid)

**Date:** 2026-06-29
**Status:** Approved (umbrella / decomposition)
**Topic:** Replace the legacy 30×20 world grid + compass movement with a Voronoi-cell-native
world: atlas travel between cells, movement on a per-cell **Locale** (synced 2D + 3D),
seamless edge-crossing. Each stage below gets its own spec → plan → implementation.

## Why

Investigation (2026-06-29) proved the start-selection spawn never lands the player in the
chosen town: **chosenBurgRenders = 0 / 219 ports across 2 seeds** (faithful `makeGroundWorld`
sweep; control passes). Root cause: spawn/3D-entry route the chosen Voronoi cell through a
coarse 30×20 grid (`spawnFromAtlasCell` → proportional projection → `legacyTileToAtlasCell`
nearest-land), which essentially never recovers the chosen cell. Towns exist per Voronoi
cell; the grid is a lossy intermediary that can't deliver the player to them.

Rather than patch the grid, retire it. Movement is rebuilt (not migrated) onto the zoomed-in
Locale; the world level becomes pure cell-to-cell travel.

## End-State Architecture

- **Presence model.** Canonical player position = `{ cellId, locale: { xFt, yFt } }` — a
  Voronoi cell + continuous Locale-local feet. Replaces `currentLocationId = "coord_X_Y"`
  AND `subMapCoordinates`. `playerWorldPos` / `playerGroundPos` (meters) back it.
- **World navigation = atlas travel.** The Voronoi atlas is the world map; inter-cell
  movement is the existing `atlasTravelGraph` fast-travel (routes + encounters). No compass,
  no grid stepping.
- **Locale = one state, two synced views.** Each cell's local artifact (region → local) is
  rendered as a 2D Locale map AND a 3D ground from the same movement state; moving in one
  updates the other (canonical-town principle extended to position).
- **Seamless edges.** Walking to a Locale boundary streams the adjacent cell's Locale
  (recursive submap engine, clipped to the parent cell). Long hops use atlas fast-travel.
- **Static `LOCATIONS`** (the 14 hand-authored places) become **cell-anchored Locale
  overrides** rather than grid coordinates.
- **Deleted:** the 30×20 grid, `mapData.tiles`, `coord_X_Y`, `subMapCoordinates`, compass
  movement.

## Cross-Cutting Constraints

- **Save migration.** Old saves carry `coord_X_Y` + `subMapCoordinates`; on load, translate
  `coord_X_Y → cellId` via `legacyTileToAtlasCell` (one-time, versioned in
  `saveLoadService` + a `worldDataMigration`-style backfill).
- **Always-playable invariant.** Every stage ships with the game working. The grid is
  demoted to derived bookkeeping before deletion (final stage).

## Decomposition & Build Order

Each is its own spec → plan → implementation cycle.

1. **Cell-addressed Locale entry** *(foundation)* — adopt the approved
   [2026-06-27 grid↔atlas bridge spec](2026-06-27-grid-atlas-bridge-unification-design.md)
   (`snapToLandCell`, `getWorldforgeLocalForCell`, `entry3DAnchorCell`, World3DWrapper
   branch, MapPane click cleanup) **plus** its missing piece: the **start-selection spawn**
   path must also set `entry3DAnchorCell` from the spawn's already-returned `atlasCellId`
   (currently dead cargo). Fixes the 0/219 bug. Grid still present for movement/2D.
2. **Position model** — introduce `{ cellId, localeCoords }` alongside legacy `coord_X_Y`
   (grid derived for compat) + save-migration scaffolding.
3. **Locale movement (2D + 3D synced)** — the new movement system; scrap compass/submap.
4. **Atlas fast-travel as the world loop** — wire existing atlas travel as THE inter-cell mover.
5. **Seamless edge-crossing** — stitch/stream adjacent Locales (hardest piece).
6. **Retire the grid** — delete `coord_X_Y` / `subMapCoordinates` / `mapData.tiles` /
   compass; migrate `LOCATIONS` to cell-anchored Locales; finalize save migration.

## Out of Scope

- The continent-scale legacy streamer.
- The 3D rendering technology itself.
- Grid-resolution tweaks (the cell anchor is resolution-independent by construction).
