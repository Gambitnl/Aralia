/**
 * @file biomeZones.ts
 * Extracts one polygon per contiguous region of cells sharing a biomeId.
 *
 * Uses the generic marching-squares utility. For each unique biome present
 * in the input, builds a boolean field (1 where biomeId matches, 0 otherwise)
 * and runs polygon extraction. The 4-neighbor connectivity convention of the
 * underlying marching-squares utility applies — see marchingSquares.ts.
 */
import type { BiomeZone } from './types';
import { extractPolygons } from './marchingSquares';

export function extractBiomeZones(biomeIds: string[], cols: number, rows: number): BiomeZone[] {
  if (biomeIds.length === 0 || cols === 0 || rows === 0) return [];
  const unique = new Set(biomeIds);
  const out: BiomeZone[] = [];
  for (const biomeId of unique) {
    const field = (x: number, y: number) => (biomeIds[y * cols + x] === biomeId ? 1 : 0);
    const polys = extractPolygons(field, cols, rows, 0.5);
    for (const polygon of polys) {
      out.push({ biomeId, polygon });
    }
  }
  return out;
}
