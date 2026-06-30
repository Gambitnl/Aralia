# Grid↔Atlas Bridge Unification — Design

**Date:** 2026-06-27
**Status:** Approved — IMPLEMENTED 2026-06-29 (with one deviation, see below)

> **Implementation note (2026-06-29):** Built as Stage 1 of the cell-native world
> program ([umbrella](2026-06-29-cell-native-world-umbrella.md)). Shipped:
> `snapToLandCell` + `entry3DAnchorForCell` (gridAtlasBridge), `getWorldforgeLocalForCell`
> + region `windowCenterPx` (the burg-position centering — a spec gap TDD found:
> cells are far larger than the Locale window so cell-id alone can't frame a town),
> the `entry3DAnchor` GameState field threaded atomically through `START_GAME_SUCCESS`,
> and both entry paths (start-selection spawn + MapPane click, snap hack removed).
> Start-selection spawn fix verified LIVE (player spawns in the chosen town).
> **DEVIATION:** §2's "reimplement `legacyTileToAtlasCell` as `legacyGridToAtlasCell`
> + `snapToLandCell`" was tried and REVERTED — it shifts `getTownTilesForGrid`
> (FMG 960×540 projection vs graphWidth; nearest-all+snap vs nearest-land),
> breaking the town-tile mapping + pipeline round-trip. The two halves still use
> separate land logic for water tiles (a benign edge case); revisit only with a
> verified new town-tile golden.
**Topic:** Close the world→atlas coordinate bridge so "click a cell, enter that cell" holds exactly in 3D.

## Problem

The Worldforge 2D atlas is the source of truth for the 3D world: clicking an atlas cell
"Enter 3D" deterministically re-generates a walking-scale slice anchored at that cell.
Today that anchor is **lost twice** between the click and the generator:

1. `MapPane.handleWorldforgePick` floors the clicked cell's Voronoi site to a coarse grid
   tile (proportional projection), discarding which of several cells share that tile.
2. `World3DWrapper` reconstructs a tile from `playerWorldPos`, then the generator
   (`getWorldforgeLocalForLocation` → `legacyTileToAtlasCell`) re-derives a cell by
   **nearest-land** — which need not be the clicked cell.

Consequences:

- Clicking a **non-burg coastal/edge land cell** can anchor the 3D slice on a *neighbour*.
- The player **marker** uses `legacyGridToAtlasCell` (nearest of *all* cells) while the 3D
  generator uses `legacyTileToAtlasCell` (nearest *land* cell) — the two halves of the
  "bridge" can name different cells for the same tile.
- Burgs are special-cased with a `getTownTilesForGrid` **snap hack** to paper over (1) —
  a fourth mapping bolted on only because landing next to a town is visibly wrong.
- The forward `floor(p/graphWidth*cols)` projection is **duplicated inline 3×** in MapPane
  instead of calling the shared module's `atlasCellToLegacyGrid`.

The SP4-pin / player-marker side IS already closed and site-accurate (via
`gridCellToAtlasSite` in `gridAtlasBridge.ts`). Only the world→3D **click path** is open.

## Goal

Make the **atlas cell id the anchor authority** for 3D entry. The grid tile becomes a
*derived* value used only for legacy bookkeeping. Every cell↔tile conversion routes
through one module (`gridAtlasBridge.ts`) with one land rule. The exact clicked cell
travels intact to the generator.

Chosen approach: **plumb the cellId through (full fix)** — not mere consolidation.
Consolidation alone cannot recover which Voronoi cell was clicked when several share a
coarse grid tile; only carrying the cell id explicitly closes the round-trip.

## Components & Changes

### 1. `src/systems/worldforge/local/gridAtlasBridge.ts` — single source of truth
- **Add** `snapToLandCell(atlas, cellId): number` — the one place the `h >= 20` land rule lives.
- **Keep** `legacyGridToAtlasCell` (nearest of all cells) for the marker / party-location
  reverse path.
- **Keep** `atlasCellToLegacyGrid` for the forward (cell → tile) path.

### 2. `src/systems/worldforge/bridge/legacySubmapBridge.ts` — cell-first entrypoint
- **Extract** `getWorldforgeLocalForCell(worldSeed, anchorCellId): BridgeLocalResult` from
  `getWorldforgeLocalForLocation` (which already computes `anchorCellId` first, then keys
  everything downstream on it — a clean split).
- `getWorldforgeLocalForLocation` becomes a thin wrapper: tile →
  `legacyGridToAtlasCell` + `snapToLandCell` → `getWorldforgeLocalForCell`.
- **Reimplement** the local `legacyTileToAtlasCell` as `legacyGridToAtlasCell` +
  `snapToLandCell` so the marker and 3D halves stop disagreeing. (Keep the exported name
  for callers; it now delegates to the shared module.)

### 3. Transport: one new GameState field `entry3DAnchorCell: number | null`
- Carries the exact clicked/drilled cell from the click handler to `World3DWrapper`.
- Cleared on 3D exit.
- Project rule: update **both** `src/utils/core/factories.ts` and
  `src/state/initialState.ts` when adding the field; add the reducer action to set/clear it.
- A new field is unavoidable: cell → tile → cell cannot recover the clicked Voronoi cell
  when several share one coarse grid tile.

### 4. `src/components/MapPane.tsx` — stop quantizing the cell away
- `handleWorldforgePick` (enter3d): drop the inline proportional projection **and** the
  burg-snap hack. Land-snap the clicked `info.i` once at click time and pass it as the
  anchor. Derive the bookkeeping tile from `atlasCellToLegacyGrid`.
- `handleEnter3DHere` (drill leaf): pass `focusCellId` directly (already a real cell).
- Replace the 3 inline `floor(p/graphWidth*cols)` copies (≈ lines 506, 543, 599) with the
  shared helpers.

### 5. `src/App.tsx` + `src/components/World3D/World3DWrapper.tsx`
- `handleEnter3DAtCell` also dispatches the anchor cell into `entry3DAnchorCell`
  (alongside the existing `SET_PLAYER_WORLD_POS`).
- `World3DWrapper` entry resolution: **if `entry3DAnchorCell` is set →
  `getWorldforgeLocalForCell` (exact)**. Else fall back to the existing tile path
  (`getWorldforgeLocalForLocation`) for party-location / `WF_TILE` / `WF_TOWN` entries.
- The burg-spawn logic (World3DWrapper ≈ line 351) already lands the player on
  `ground.towns[0]`, so removing the tile-level burg-snap is safe.

## Data Flow (after)

```
click cell C ─(land-snap once)→ anchor cell A
   ├─ entry3DAnchorCell = A ──→ World3DWrapper ──→ getWorldforgeLocalForCell(A)   [EXACT]
   └─ tile = atlasCellToLegacyGrid(A) ──→ playerWorldPos + currentLocation        [bookkeeping]

party-location entry (no click) ─→ tile ─→ legacyGridToAtlasCell + snapToLandCell ─→ same generator
```

## Testing

- **Round-trip:** for a sample of land cells, `A → tile` (bookkeeping) is stable, and entry
  via `entry3DAnchorCell` anchors on exactly `A` — no neighbour drift.
- **Reverse-mapping agreement:** assert `legacyTileToAtlasCell(tile) ==
  legacyGridToAtlasCell(tile) + snapToLandCell` for sampled tiles (the two halves agree).
- **Burg regression:** burg cells still spawn the player on the town with the snap hack removed.
- **Marker/pins unchanged:** still resolve via `gridCellToAtlasSite`.

## Out of Scope (YAGNI)

- The continent-scale legacy streamer.
- The marker's visual path.
- Grid resolution changes (the cell anchor is grid-resolution-independent by construction).
