/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 10:26:09
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file vegetationInstanceMatrices.ts
 * @description Matrix sync helper for instanced vegetation in World3D.
 *
 * Why this exists:
 * - W3D-G25 made vegetation scatter payloads stable, but the renderer can still receive a
 *   fresh wrapper object when chunks round-trip through a worker boundary.
 * - The helper keeps the expensive `setMatrixAt` loop behind a stable payload key, so
 *   unchanged scatter can skip a full matrix rewrite without changing the visible result.
 * - The tiny ref-like state object keeps the React component thin and makes the skip
 *   behavior easy to unit-test without mounting the full R3F scene.
 */
import * as THREE from 'three';
import type { VegetationScatter } from '@/systems/world3d/types';
/** Geometry profile per vegetation kind: footprint, height, and the lift
 * that grounds a center-origin cone/sphere on the terrain. */
export type VegetationProfile = 'tree' | 'bush';
/** Minimal surface needed by the matrix writer. */
export interface VegetationInstanceMatrixTarget {
    setMatrixAt(index: number, matrix: THREE.Matrix4): void;
    setColorAt?(index: number, color: THREE.Color): void;
    /** Refreshes the aggregate instance bounds used by Three.js frustum culling. */
    computeBoundingSphere?(): void;
    instanceMatrix: {
        needsUpdate: boolean;
    };
    instanceColor?: {
        needsUpdate: boolean;
    } | null;
    /** The mesh material — recompiled once when instance colors first appear
     * (three.js only injects USE_INSTANCING_COLOR if the attribute existed at
     * compile time; setColorAt after first render needs material.needsUpdate). */
    material?: {
        needsUpdate: boolean;
    } | Array<{
        needsUpdate: boolean;
    }>;
}
/** Mutable one-slot cache for the last scatter key written into a mesh. */
export interface VegetationScatterCacheRef {
    current: string | null;
}
/**
 * Writes vegetation transforms into an instanced mesh unless the stable scatter key
 * matches the last payload already applied to that mesh.
 */
export declare function syncVegetationInstanceMatrices(target: VegetationInstanceMatrixTarget, scatter: VegetationScatter, cacheRef: VegetationScatterCacheRef, profile?: VegetationProfile): boolean;
