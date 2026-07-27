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
export declare function extractBiomeZones(biomeIds: string[], cols: number, rows: number): BiomeZone[];
