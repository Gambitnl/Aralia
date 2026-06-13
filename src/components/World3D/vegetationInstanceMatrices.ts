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

/** Geometry profile per vegetation kind: footprint, height, and the lift
 * that grounds a center-origin cone/sphere on the terrain. */
export type VegetationProfile = 'tree' | 'bush';

const PROFILE_SCALE = {
  tree: { width: 2, height: 6, yLift: 3 },
  bush: { width: 2.5, height: 1.8, yLift: 0.9 },
} as const;

const FALLBACK_COLOR = new THREE.Color('#2f5d2f');

/** Minimal surface needed by the matrix writer. */
export interface VegetationInstanceMatrixTarget {
  setMatrixAt(index: number, matrix: THREE.Matrix4): void;
  setColorAt?(index: number, color: THREE.Color): void;
  instanceMatrix: {
    needsUpdate: boolean;
  };
  instanceColor?: {
    needsUpdate: boolean;
  } | null;
  /** The mesh material — recompiled once when instance colors first appear
   * (three.js only injects USE_INSTANCING_COLOR if the attribute existed at
   * compile time; setColorAt after first render needs material.needsUpdate). */
  material?: { needsUpdate: boolean } | Array<{ needsUpdate: boolean }>;
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
  profile: VegetationProfile = 'tree',
): boolean {
  if (cacheRef.current === scatter.cacheKey) {
    return false;
  }

  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const { width: sw, height: sh, yLift } = PROFILE_SCALE[profile];
  const count = scatter.positions.length / 3;

  for (let i = 0; i < count; i++) {
    const s = scatter.scales[i];
    rotation.setFromAxisAngle(axis, scatter.rotations[i]);
    // yLift grounds the center-origin geometry: base sits ON the surface
    // sample instead of the cone straddling it half-buried.
    position.set(
      scatter.positions[i * 3],
      scatter.positions[i * 3 + 1] + s * yLift,
      scatter.positions[i * 3 + 2],
    );
    scale.set(s * sw, s * sh, s * sw);
    matrix.compose(position, rotation, scale);
    target.setMatrixAt(i, matrix);

    if (target.setColorAt) {
      if (scatter.colors) {
        // Palette floats are authored as sRGB values; setRGB defaults to the
        // LINEAR working space in three r152+, which washed every tree out
        // to pale mint (linear 0.3 displays like sRGB ~0.58).
        color.setRGB(
          scatter.colors[i * 3],
          scatter.colors[i * 3 + 1],
          scatter.colors[i * 3 + 2],
          THREE.SRGBColorSpace,
        );
      } else {
        color.copy(FALLBACK_COLOR);
      }
      target.setColorAt(i, color);
    }
  }

  target.instanceMatrix.needsUpdate = true;
  if (target.instanceColor) {
    target.instanceColor.needsUpdate = true;
    // Force a recompile so the shader picks up USE_INSTANCING_COLOR — the
    // attribute did not exist when the material first compiled.
    if (Array.isArray(target.material)) {
      for (const m of target.material) m.needsUpdate = true;
    } else if (target.material) {
      target.material.needsUpdate = true;
    }
  }
  cacheRef.current = scatter.cacheKey;
  return true;
}
