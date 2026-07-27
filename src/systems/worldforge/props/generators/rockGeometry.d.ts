/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 14:20:35
 * Dependents: components/World3D/GroundProps.tsx, components/World3D/WebGPUProbeScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file rockGeometry.ts — owned, seeded procedural rock/boulder geometry.
 *
 * Replaces GroundProps' jittered-icosahedron blobs (world-props plan-map:
 * owned rock/prop generators, slice 1). No new dependencies: a three.js
 * IcosahedronGeometry displaced by our own seeded 3D value noise
 * (proceduralNoise.ts), plus 1–2 "scrape" planes that flatten random facets so
 * the rock reads angular instead of potato-round. Output is NON-indexed with
 * recomputed normals → true flat-shaded facets.
 *
 * Deterministic: same seed → byte-identical position/normal buffers
 * (unit-tested in __tests__/rockGeometry.test.ts).
 */
import * as THREE from 'three';
export interface RockOptions {
    /** Base radius in meters (default 0.5 — GroundProps scales per size class). */
    radius?: number;
    /** Icosphere subdivision (1–2; default 2). */
    detail?: number;
}
/**
 * Build one seeded rock. Pipeline:
 *  1. Icosahedron(radius, detail) — indexed, shared vertices, so noise
 *     displacement keeps the surface watertight.
 *  2. Displace each vertex radially by 2–3 octaves of seeded value noise
 *     (low-frequency lumps + mid-frequency crags), with a mild per-axis
 *     squash so no rock is a sphere.
 *  3. Scrape: 1–2 random planes; vertices beyond the plane get projected back
 *     onto it → flat facets (fresh-fracture look).
 *  4. toNonIndexed + computeVertexNormals → hard-edged flat facets.
 */
export declare function createRockGeometry(seed: number, opts?: RockOptions): THREE.BufferGeometry;
