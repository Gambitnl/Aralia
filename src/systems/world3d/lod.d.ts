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
export declare const LOD_RINGS: {
    readonly full: 1;
    readonly mid: 3;
    readonly low: 6;
};
/**
 * Classifies a Chebyshev chunk distance value into a corresponding LodTier label.
 */
export declare function selectLodTier(chunkDistance: number): LodTier;
/** True when tier `a` carries strictly more mesh detail than tier `b`. */
export declare function isFinerLod(a: LodTier, b: LodTier): boolean;
