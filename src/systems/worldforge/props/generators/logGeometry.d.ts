/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 14:21:30
 * Dependents: components/World3D/GroundProps.tsx, components/World3D/WebGPUProbeScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file logGeometry.ts — owned, seeded fallen-log geometry.
 *
 * Replaces the perfect cylinder in GroundProps (world-props slice 1): a
 * tapered trunk (root end fatter), a ragged BROKEN end (the ring vertices at
 * the thin end are jittered along the axis + radially so the break reads
 * splintered, not machine-cut), and a slight cross-section irregularity so the
 * silhouette isn't a perfect circle. Baked horizontal + ground-lifted so it
 * can be instanced directly (same convention as the old GroundProps log).
 *
 * Deterministic from the seed.
 */
import * as THREE from 'three';
export interface LogOptions {
    /** Trunk length in meters (default 4.2, matching the old prop). */
    length?: number;
    /** Radius at the root (thick) end (default 0.34). */
    rootRadius?: number;
}
export declare function createLogGeometry(seed: number, opts?: LogOptions): THREE.BufferGeometry;
