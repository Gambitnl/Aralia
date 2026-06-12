/**
 * @file src/utils/worldCoords.ts
 * Bidirectional coordinate transforms between world meters, SVG atlas units,
 * and WorldData grid cells. Shared between world-3d-ui and map components.
 *
 * All world-meter values here live in the streamed-3D coordinate frame defined by
 * WORLD3D_CONFIG (METERS_PER_CELL per grid cell, heightToMeters for elevation), so
 * positions produced/consumed here line up with the rendered terrain.
 *
 * World dimensions: 60 cols × 40 rows × 1024m/cell = 61440m × 40960m
 * Atlas SVG dimensions: configurable, default ~2000×1333 SVG units
 *
 * Coordinate conventions:
 * - World meters: (x, z) where x is east-west, z is north-south
 * - SVG units: (x, y) where x is left-right, y is top-bottom
 * - WorldData grid: (col, row) indexed as row * cols + col in flat arrays
 */

import type { WorldData } from '../services/worldSim/types';
import { WORLD3D_CONFIG, heightToMeters } from '../systems/world3d/config';

// World grid constants (from mapConfig)
const WORLD_COLS = 60;
const WORLD_ROWS = 40;
/**
 * Meters per world-map grid cell, in the streamed-3D frame. Must match the chunk
 * geometry's mapping (WORLD3D_CONFIG.METERS_PER_CELL) or positions land at the
 * wrong scale — the old standalone 128 (one chunk, not one cell) spawned 3D entry
 * at 1/8 scale and pinned the atlas player marker to the map edge.
 */
export const METERS_PER_CELL = WORLD3D_CONFIG.METERS_PER_CELL;

// Derived world dimensions in meters
export const WORLD_WIDTH_M = WORLD_COLS * METERS_PER_CELL;   // 61440m
export const WORLD_HEIGHT_M = WORLD_ROWS * METERS_PER_CELL;  // 40960m

// Default SVG viewport dimensions (overridden by MapPane props)
export const DEFAULT_SVG_WIDTH = 2000;
export const DEFAULT_SVG_HEIGHT = 1333;

/**
 * Convert world meters to SVG atlas coordinates.
 * @param wx - world X in meters
 * @param wz - world Z in meters (maps to Y in 2D atlas)
 * @param svgWidth - SVG viewport width in SVG units
 * @param svgHeight - SVG viewport height in SVG units
 * @returns SVG coordinates { x, y }
 */
export function worldToSvgCoords(
  wx: number,
  wz: number,
  svgWidth: number = DEFAULT_SVG_WIDTH,
  svgHeight: number = DEFAULT_SVG_HEIGHT,
): { x: number; y: number } {
  const x = (wx / WORLD_WIDTH_M) * svgWidth;
  const y = (wz / WORLD_HEIGHT_M) * svgHeight;
  return { x, y };
}

/**
 * Convert SVG atlas coordinates to world meters.
 * @param svgX - SVG X coordinate
 * @param svgY - SVG Y coordinate
 * @param svgWidth - SVG viewport width in SVG units
 * @param svgHeight - SVG viewport height in SVG units
 * @returns World coordinates { x, z } in meters
 */
export function svgToWorldCoords(
  svgX: number,
  svgY: number,
  svgWidth: number = DEFAULT_SVG_WIDTH,
  svgHeight: number = DEFAULT_SVG_HEIGHT,
): { x: number; z: number } {
  const x = (svgX / svgWidth) * WORLD_WIDTH_M;
  const z = (svgY / svgHeight) * WORLD_HEIGHT_M;
  return { x, z };
}

/**
 * Convert world meters to WorldData grid cell indices.
 * @param wx - world X in meters
 * @param wz - world Z in meters
 * @returns Grid cell { col, row }
 */
export function worldToGridCell(
  wx: number,
  wz: number,
): { col: number; row: number } {
  const col = Math.floor(wx / METERS_PER_CELL);
  const row = Math.floor(wz / METERS_PER_CELL);
  return {
    col: Math.max(0, Math.min(WORLD_COLS - 1, col)),
    row: Math.max(0, Math.min(WORLD_ROWS - 1, row)),
  };
}

/**
 * Get terrain height at a world position using bilinear interpolation
 * from the WorldData heights array.
 *
 * The heights array is a flat grid of WorldData heights (0..100 range),
 * indexed as `heights[row * cols + col]`. The interpolated height is mapped
 * to meters via `heightToMeters` — the same single source of truth the chunk
 * geometry uses — so the returned Y sits on the rendered terrain surface.
 *
 * @param wx - world X in meters
 * @param wz - world Z in meters
 * @param worldData - the WorldData object containing heights
 * @returns Terrain height (Y) in meters, with vertical exaggeration applied
 */
export function getTerrainHeight(
  wx: number,
  wz: number,
  worldData: WorldData,
): number {
  const { cols, rows } = worldData.gridSize;
  const heights = worldData.heights;

  // Convert world meters to fractional grid coordinates
  const fracCol = wx / METERS_PER_CELL;
  const fracRow = wz / METERS_PER_CELL;

  // Clamp to grid bounds
  const c0 = Math.max(0, Math.min(cols - 2, Math.floor(fracCol)));
  const r0 = Math.max(0, Math.min(rows - 2, Math.floor(fracRow)));
  const c1 = Math.min(cols - 1, c0 + 1);
  const r1 = Math.min(rows - 1, r0 + 1);

  // Interpolation weights (fractional part)
  const u = fracCol - c0;
  const v = fracRow - r0;

  // Sample four corners from the flat heights array
  const h00 = heights[r0 * cols + c0] ?? 0;
  const h10 = heights[r0 * cols + c1] ?? 0;
  const h01 = heights[r1 * cols + c0] ?? 0;
  const h11 = heights[r1 * cols + c1] ?? 0;

  // Bilinear interpolation
  const hTop = h00 * (1 - u) + h10 * u;
  const hBottom = h01 * (1 - u) + h11 * u;
  const h = hTop * (1 - v) + hBottom * v;

  // Map WorldData height (0..100) to exaggerated world meters — same mapping
  // as the rendered terrain heightfield.
  return heightToMeters(h);
}

/**
 * World-map grid dimensions in meters for a given col/row count.
 */
export function gridWorldDimensions(cols: number, rows: number): { widthM: number; heightM: number } {
  return { widthM: cols * METERS_PER_CELL, heightM: rows * METERS_PER_CELL };
}

/**
 * Center of a map grid cell in world meters (x east, z north).
 */
export function gridCellCenterToWorldMeters(
  cellX: number,
  cellY: number,
  cols: number,
  rows: number,
): { x: number; z: number } {
  const { widthM, heightM } = gridWorldDimensions(cols, rows);
  return {
    x: ((cellX + 0.5) / cols) * widthM,
    z: ((cellY + 0.5) / rows) * heightM,
  };
}

/**
 * Normalized 0–1 atlas coordinates for a world-meter position on the gameplay grid.
 */
export function worldMetersToGridNormalized(
  wx: number,
  wz: number,
  cols: number,
  rows: number,
): { normX: number; normY: number } {
  const { widthM, heightM } = gridWorldDimensions(cols, rows);
  return {
    normX: Math.max(0, Math.min(1, wx / widthM)),
    normY: Math.max(0, Math.min(1, wz / heightM)),
  };
}
