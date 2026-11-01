/** Continuous timber geometry shared by building previews and the live world.
 * Collision retains the containing box's conservative bounds; rendering uses
 * this direction so a sloped handrail never becomes a tall rectangular panel. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 05:58:04
 * Dependents: components/World3D/WebGPUProbeScene.tsx, components/World3D/World3DScene.tsx, devtools/buildingIdentityLab/PreviewBuilding3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import type { BeamProfile } from './buildingModels';

export function beamRotation(beam: BeamProfile, zDirection = 1): THREE.Quaternion {
  const direction = new THREE.Vector3(beam.dx, beam.dy, beam.dz * zDirection);
  if (![...direction.toArray(), beam.thickness].every(Number.isFinite) || direction.lengthSq() <= 0 || beam.thickness <= 0) {
    throw new Error('Beam must have a finite direction, positive length and thickness');
  }
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

export function buildBeamGeometry(beam: BeamProfile, zDirection = 1): THREE.BoxGeometry {
  const rotation = beamRotation(beam, zDirection);
  const geometry = new THREE.BoxGeometry(beam.thickness, Math.hypot(beam.dx, beam.dy, beam.dz), beam.thickness);
  geometry.applyQuaternion(rotation);
  return geometry;
}
