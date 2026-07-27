/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 14:21:02
 * Dependents: components/World3D/GroundProps.tsx, components/World3D/WebGPUProbeScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file bushGeometry.ts — owned, seeded bush/shrub geometry.
 *
 * Replaces the single icosphere blob in GroundProps (world-props slice 1):
 * 2–3 overlapping low-detail icospheres, each displaced by seeded value noise
 * so the canopy reads as a lumpy foliage clump rather than a geometric ball.
 * Lobes are offset around the base and squashed vertically. Non-indexed +
 * recomputed normals for the flat-shaded look of the streamed world.
 *
 * Deterministic from the seed.
 */
import * as THREE from 'three';
export interface BushOptions {
    /** Overall canopy radius in meters (default 0.55, matching the old prop). */
    radius?: number;
}
export declare function createBushGeometry(seed: number, opts?: BushOptions): THREE.BufferGeometry;
