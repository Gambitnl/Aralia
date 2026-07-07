
/**
 * @file src/config/mapConfig.ts
 * Centralizes configuration variables related to game maps and grids.
 */

// General Map Configuration
// Grid retirement (Cell-Native World): the legacy 30x20 world grid is gone —
// MAP_GRID_SIZE and SUBMAP_DIMENSIONS have both been removed. The world is
// Voronoi-cell-native; local terrain/materials come from the cell-native local
// layer (generateLocal / getWorldforgeLocalForCell). BATTLE_MAP_DIMENSIONS (the
// tactical combat map) is unrelated to the retired world grid and remains.
// 2026-07-01 (Remy): combat area quadrupled (40×30 → 80×60). The 2D map pans
// and zooms to fit; the 3D map renders a non-playable fringe beyond this rect
// so the battlefield no longer ends at a visible boundary.
// 2026-07-06 (Remy): "way more tiles" — 80×60 → 120×90 (2.25×, ~10.8k tiles).
// The 2D grid renders one DOM node per tile, so growth beyond this needs
// viewport culling first.
export const BATTLE_MAP_DIMENSIONS = { width: 120, height: 90 };
export const TILE_SIZE_PX = 32;

// Compass Direction Vectors
export interface DirectionVector {
  dx: number;
  dy: number;
  opposite: string; // Opposite direction key
}
export const DIRECTION_VECTORS: Record<string, DirectionVector> = {
  North:     { dx: 0,  dy: -1, opposite: 'South' },
  NorthEast: { dx: 1,  dy: -1, opposite: 'SouthWest' },
  East:      { dx: 1,  dy: 0,  opposite: 'West' },
  SouthEast: { dx: 1,  dy: 1,  opposite: 'NorthWest' },
  South:     { dx: 0,  dy: 1,  opposite: 'North' },
  SouthWest: { dx: -1, dy: 1,  opposite: 'NorthEast' },
  West:      { dx: -1, dy: 0,  opposite: 'East' },
  NorthWest: { dx: -1, dy: -1, opposite: 'SouthEast' },
};
