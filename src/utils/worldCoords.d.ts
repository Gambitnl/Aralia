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
/**
 * Meters per world-map grid cell, in the streamed-3D frame. Must match the chunk
 * geometry's mapping (WORLD3D_CONFIG.METERS_PER_CELL) or positions land at the
 * wrong scale — the old standalone 128 (one chunk, not one cell) spawned 3D entry
 * at 1/8 scale and pinned the atlas player marker to the map edge.
 */
export declare const METERS_PER_CELL: 1024;
export declare const WORLD_WIDTH_M: number;
export declare const WORLD_HEIGHT_M: number;
export declare const DEFAULT_SVG_WIDTH = 2000;
export declare const DEFAULT_SVG_HEIGHT = 1333;
/**
 * Convert world meters to SVG atlas coordinates.
 * @param wx - world X in meters
 * @param wz - world Z in meters (maps to Y in 2D atlas)
 * @param svgWidth - SVG viewport width in SVG units
 * @param svgHeight - SVG viewport height in SVG units
 * @returns SVG coordinates { x, y }
 */
export declare function worldToSvgCoords(wx: number, wz: number, svgWidth?: number, svgHeight?: number): {
    x: number;
    y: number;
};
/**
 * Convert SVG atlas coordinates to world meters.
 * @param svgX - SVG X coordinate
 * @param svgY - SVG Y coordinate
 * @param svgWidth - SVG viewport width in SVG units
 * @param svgHeight - SVG viewport height in SVG units
 * @returns World coordinates { x, z } in meters
 */
export declare function svgToWorldCoords(svgX: number, svgY: number, svgWidth?: number, svgHeight?: number): {
    x: number;
    z: number;
};
/**
 * Convert world meters to WorldData grid cell indices.
 * @param wx - world X in meters
 * @param wz - world Z in meters
 * @returns Grid cell { col, row }
 */
export declare function worldToGridCell(wx: number, wz: number): {
    col: number;
    row: number;
};
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
export declare function getTerrainHeight(wx: number, wz: number, worldData: WorldData): number;
/**
 * World-map grid dimensions in meters for a given col/row count.
 */
export declare function gridWorldDimensions(cols: number, rows: number): {
    widthM: number;
    heightM: number;
};
/**
 * Normalized 0–1 atlas coordinates for a world-meter position on the gameplay grid.
 */
export declare function worldMetersToGridNormalized(wx: number, wz: number, cols: number, rows: number): {
    normX: number;
    normY: number;
};
