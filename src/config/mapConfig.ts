
/**
 * @file src/config/mapConfig.ts
 * Centralizes configuration variables related to game maps and grids.
 */

// General Map Configuration
export const MAP_GRID_SIZE = { rows: 20, cols: 30 };
export const SUBMAP_DIMENSIONS = { rows: 20, cols: 30 };
export const BATTLE_MAP_DIMENSIONS = { width: 30, height: 20 };
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
