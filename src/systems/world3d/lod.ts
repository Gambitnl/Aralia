/**
 * @file lod.ts
 * @description Pure LOD-tier selection by Chebyshev chunk distance from the camera chunk.
 *
 * Why this is built this way:
 * - Distance-based rings are the standard approach for massive procedural landscapes.
 * - This provides early determination of details. Full-detail meshes are restricted to immediate
 *   neighbors, coarser geometries are served at medium distance, and highly simplified silhouettes
 *   or culling rules are applied at far ranges.
 * - Keeping this logic pure enables easy performance modeling and simulation without Three.js objects.
 */

import type { LodTier } from './types';

/** Inclusive max chunk distance for each tier. */
export const LOD_RINGS = {
  full: 1,
  mid: 3,
  low: 6,
} as const;

/**
 * Classifies a Chebyshev chunk distance value into a corresponding LodTier label.
 */
export function selectLodTier(chunkDistance: number): LodTier {
  if (chunkDistance <= LOD_RINGS.full) return 'full';
  if (chunkDistance <= LOD_RINGS.mid) return 'mid';
  if (chunkDistance <= LOD_RINGS.low) return 'low';
  return 'culled';
}

/** Detail order for tier comparisons (finer = more detail). */
const LOD_RANK: Record<LodTier, number> = { culled: 0, low: 1, mid: 2, full: 3 };

/** True when tier `a` carries strictly more mesh detail than tier `b`. */
export function isFinerLod(a: LodTier, b: LodTier): boolean {
  return LOD_RANK[a] > LOD_RANK[b];
}
