# MapPane Component (`src/components/MapPane.tsx`)

## Purpose

`MapPane.tsx` renders the game's world-map overlay. The player-facing square-grid
renderer has been deprecated: the default surface is now the embedded Azgaar
atlas, with a World Forge render-port option for native cartography work.

The component still receives `MapData` and emits `MapTile` payloads because
travel, discovery, save/load migration, submap anchoring, AI context, POI
visibility, and Enter-3D positioning still depend on that compatibility
contract.

## Props

* **`mapData: MapData`**
  * Core world-map state, including `gridSize`, legacy `tiles`, optional
    `worldData`, and optional `worldGeography`.
  * Required.

* **`onTileClick: (x: number, y: number, tile: MapTile) => void`**
  * Called when the atlas overlay resolves a click back to an Aralia travel cell.
  * Required until travel migrates away from legacy tile payloads.

* **`onEnter3DAtCell?: (x: number, y: number, tile: MapTile) => void`**
  * Called when Enter 3D mode resolves a discovered atlas cell to a world tile.

* **`onClose: () => void`**
  * Closes the map overlay.

## Current Behavior

1. **Atlas Surface**
   * Embeds the Azgaar atlas in read-only mode.
   * Adds an overlay that maps pointer clicks back to Aralia grid cells.
   * Shows Azgaar cell details in Travel mode.

2. **World Forge Surface**
   * Offers a native SVG render-port generated from the same world seed.
   * Does not restore the old square-grid renderer.

3. **Removed Grid Renderer**
   * `MapPane` no longer exposes the `Legacy Grid` button.
   * Azgaar iframe load failures now stay on the atlas surface and show an honest error instead of switching to the deprecated grid.
   * The old `src/components/MapTile.tsx` React renderer and its direct component test have been removed.

4. **Compatibility Bridge**
   * Discovery/current-player reads pass through the World geography adapter.
   * The atlas click bridge still returns legacy map cells so existing travel and 3D-entry behavior keeps working while downstream contracts migrate.

## Data Dependencies

* `MapData` and `MapTile` from `src/types/world`.
* `WorldGeographyAdapter` from `src/utils/world`.
* Azgaar embed files under `public/vendor/azgaar`.
* World Forge atlas generation and SVG view components.

## Migration Notes

Do not delete `MapData.tiles`, the `MapTile` data type, or the world-data
migration bridge as part of renderer cleanup. Those are still active gameplay
contracts. Remove them only after travel, save/load, submap, POI, AI context, and
3D entry have moved to `worldGeography` or `WorldData` directly.
