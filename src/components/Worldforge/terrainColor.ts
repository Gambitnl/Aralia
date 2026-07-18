/**
 * This file calculates the terrain colors for cells on the overworld map.
 *
 * It takes the biome, elevation, and mountain slopes of the map and determines
 * the color (like green forests, yellow deserts, or grey peaks) for each land region.
 * By merging cells into groups with similar elevations and slopes, it creates a clean,
 * painted look for the map while keeping rendering fast.
 *
 * Called by: atlasSvg.ts (buildAtlasSvgModel)
 * Depends on: FmgAtlasResult types
 */

// ============================================================================
// Imports & Types
// ============================================================================

import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';

// ============================================================================
// Color Parsing Helpers
// ============================================================================
// These utilities convert hex color codes into rgb values for blending math.

/**
 * Parses a standard hexadecimal color code (e.g. "#2ca25f") into its red, green,
 * and blue integer values (0-255). Supports both 3-character and 6-character hex formats.
 */
export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  // Remove the leading hash if present.
  const cleanHex = hex.replace('#', '');

  // If short hex form like #abc, double each character.
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  }

  // Shift bits to extract red, green, and blue components.
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// ============================================================================
// Slope & Elevation Bucketing
// ============================================================================
// This section calculates the slope and elevation values for each land cell
// and groups them into discrete buckets to simplify the map rendering.

/**
 * Computes the North-West slope shading value for a cell.
 * Positive slope represents slopes facing North-West (which receive shadow),
 * and negative slope represents slopes facing South-East (which receive light).
 */
export function getCellSlope(atlas: FmgAtlasResult, i: number): number {
  const pack = atlas.pack;
  const cells = pack.cells;
  const h = cells.h[i];
  const neighbors = cells.c?.[i];
  const p_i = cells.p?.[i];
  if (!neighbors || !p_i) return 0;

  let dx = 0;
  let dy = 0;
  let count = 0;

  // Accumulate slope gradients from each adjacent cell.
  for (const j of neighbors) {
    const h_j = cells.h[j];
    const p_j = cells.p[j];
    if (p_j) {
      const dist = Math.hypot(p_j[0] - p_i[0], p_j[1] - p_i[1]) || 1;
      dx += ((h_j - h) * (p_j[0] - p_i[0])) / (dist * dist);
      dy += ((h_j - h) * (p_j[1] - p_i[1])) / (dist * dist);
      count++;
    }
  }

  const gx = count > 0 ? dx / count : 0;
  const gy = count > 0 ? dy / count : 0;

  // Return the North-West aligned dot product.
  return gx * -0.707 + gy * -0.707;
}

/**
 * Maps a calculated slope value into one of three buckets:
 * 0 = Lit (slope < -0.015)
 * 1 = Neutral (-0.015 <= slope <= 0.015)
 * 2 = Shaded (slope > 0.015)
 */
export function getCellSlopeBucket(slope: number): number {
  if (slope < -0.015) return 0;
  if (slope > 0.015) return 2;
  return 1;
}

/**
 * Maps a cell height value into one of four elevation buckets:
 * 0 = Lowland (height < 40)
 * 1 = Highland Tier 1 (40 <= height < 60)
 * 2 = Highland Tier 2 (60 <= height < 80)
 * 3 = Peak (height >= 80)
 */
export function getCellElevationBucket(h: number): number {
  if (h < 40) return 0;
  if (h < 60) return 1;
  if (h < 80) return 2;
  return 3;
}

// ============================================================================
// Terrain Keys & Colors
// ============================================================================
// Combines the biome, elevation, and slope buckets into a merged region key,
// and resolves that key into a final blended color.

/**
 * Constructs a unique terrain key for a cell to merge it with other similar cells.
 * Returns null if the cell is water (height < 20).
 */
export function getTerrainKey(atlas: FmgAtlasResult, i: number): string | null {
  const cells = atlas.pack.cells;
  const h = cells.h[i];
  if (h < 20) return null; // Water cell

  const biomeIdx = cells.biome?.[i] ?? 0;
  const elevBucket = getCellElevationBucket(h);
  const slope = getCellSlope(atlas, i);
  const slopeBucket = getCellSlopeBucket(slope);

  return `${biomeIdx}_${elevBucket}_${slopeBucket}`;
}

/**
 * Translates a terrain key (e.g. "3_1_2") back into a final blended RGB color.
 */
export function getTerrainColor(atlas: FmgAtlasResult, key: string): string {
  const [biomeStr, elevStr, slopeStr] = key.split('_');
  const biomeIdx = parseInt(biomeStr, 10);
  const elevBucket = parseInt(elevStr, 10);
  const slopeBucket = parseInt(slopeStr, 10);

  const biomeColors = atlas.biomesData.color;
  const biomeHex = biomeColors[biomeIdx] ?? '#888888';
  const { r, g, b } = parseHexColor(biomeHex);

  // Use midpoint/representative values for the bucket.
  const hRep = 30 + elevBucket * 20;
  const shadeRep = slopeBucket === 0 ? -0.035 : slopeBucket === 2 ? 0.035 : 0;

  let rFinal = r;
  let gFinal = g;
  let bFinal = b;

  // Apply elevation grey-lift (highlands lift toward rock-grey #ecebe8).
  const elev = Math.max(0, (hRep - 40) / 60);
  if (elev > 0) {
    const tLift = elev * elev * 0.85;
    rFinal = rFinal + (236 - rFinal) * tLift;
    gFinal = gFinal + (235 - gFinal) * tLift;
    bFinal = bFinal + (232 - bFinal) * tLift;
  }

  // Apply slope shadow/light adjustment.
  const adjust = Math.max(0.75, Math.min(1.25, 1 - shadeRep * 6.0));

  // Bright biome colors can cross 255 after the lit-slope multiplier. Clamp
  // every channel so the browser receives a valid, deterministic RGB color.
  const clampChannel = (channel: number): number => (
    Math.max(0, Math.min(255, Math.round(channel)))
  );

  return `rgb(${clampChannel(rFinal * adjust)},${clampChannel(gFinal * adjust)},${clampChannel(bFinal * adjust)})`;
}
