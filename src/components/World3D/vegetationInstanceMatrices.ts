// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:33:58
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

/** Minimal surface needed by the matrix writer. */
export interface VegetationInstanceMatrixTarget {
  setMatrixAt(index: number, matrix: THREE.Matrix4): void;
  instanceMatrix: {
    needsUpdate: boolean;
  };
}

/** Mutable one-slot cache for the last scatter key written into a mesh. */
export interface VegetationScatterCacheRef {
  current: string | null;
}

/**
 * Writes vegetation transforms into an instanced mesh unless the stable scatter key
 * matches the last payload already applied to that mesh.
 */
export function syncVegetationInstanceMatrices(
  target: VegetationInstanceMatrixTarget,
  scatter: VegetationScatter,
  cacheRef: VegetationScatterCacheRef,
): boolean {
  if (cacheRef.current === scatter.cacheKey) {
    return false;
  }

  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const count = scatter.positions.length / 3;

  for (let i = 0; i < count; i++) {
    const s = scatter.scales[i];
    rotation.setFromAxisAngle(axis, scatter.rotations[i]);
    position.set(scatter.positions[i * 3], scatter.positions[i * 3 + 1], scatter.positions[i * 3 + 2]);
    scale.set(s * 2, s * 5, s * 2);
    matrix.compose(position, rotation, scale);
    target.setMatrixAt(i, matrix);
  }

  target.instanceMatrix.needsUpdate = true;
  cacheRef.current = scatter.cacheKey;
  return true;
}
