/** Review a legacy meeting against the loaded world's real surfaces before
 * deciding how to repair it. Older entry code sampled one nearest terrain cell
 * and copied its height to the entire cast. A diagnosis never moves anybody:
 * valid saved footing stays valid, and proposed surfaces are not walking paths
 * or permission to move a person onto a bridge. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 28/10/2026, 22:39:44
 * Dependents: None (Orphan)
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { heightToMeters } from '@/systems/world3d/config';
import { groundSurfaceYM } from './terrain/groundSurfaceYM';
import { isGroundFootingSupported, type GroundWalkSurfaces } from './groundBuildingMotion';
import { groundWaterMovementAt, type GroundWaterProfile } from './groundWaterMovement';
import * as THREE from 'three';

export interface PlacementBodyProfile extends GroundWaterProfile {
  /** Standing model measurements, not the older fixed walking proxy. */
  halfWidthM: number;
  heightM: number;
}
export interface PlacementInspectionActor {
  id: string;
  position: { xM: number; yM: number; zM: number };
  body?: PlacementBodyProfile;
  /** Caller has checked the saved encounter/world/location provenance. */
  legacyEncounter?: boolean;
}
export interface PlacementSurfaceCandidate {
  kind: 'terrain' | 'deck';
  position: PlacementInspectionActor['position'];
  admissible: boolean;
  reasons: Array<'unknown-body' | 'unknown-surface' | 'steep-or-incomplete-support' | 'body-obstruction' | 'building-clearance-unverified' | 'water-blocked'>;
}
const MAX_GRADE = Math.tan(40 * Math.PI / 180);

/** Use the actual assembled figure, including its visible gear, for standing
 * clearance. The projected shadow and hidden materials are not anatomy. */
export function measurePlacementBody(group: THREE.Object3D): PlacementBodyProfile | undefined {
  group.updateWorldMatrix(true, true);
  const origin = group.getWorldPosition(new THREE.Vector3()), bounds = new THREE.Box3();
  group.traverseVisible(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.name === 'blobShadow') return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.some(material => material?.visible && material.opacity > 0)) return;
    bounds.union(new THREE.Box3().setFromObject(mesh));
  });
  if (bounds.isEmpty()) return undefined;
  const heightM = bounds.max.y - origin.y;
  const halfWidthM = Math.max(Math.abs(bounds.min.x - origin.x), Math.abs(bounds.max.x - origin.x), Math.abs(bounds.min.z - origin.z), Math.abs(bounds.max.z - origin.z));
  if (![heightM, halfWidthM].every(Number.isFinite) || heightM <= 0 || halfWidthM <= 0) return undefined;
  const mouth = group.getObjectByName('mouthLine');
  const mouthHeightM = mouth ? new THREE.Box3().setFromObject(mouth).min.y - origin.y : undefined;
  return { heightM, halfWidthM, ...(Number.isFinite(mouthHeightM) && mouthHeightM! > 0 ? { mouthHeightM } : {}) };
}

function nearestGridY(ground: GroundWorld, point: PlacementInspectionActor['position']): number | undefined {
  const col = Math.round(point.xM / GROUND_METERS_PER_CELL), row = Math.round(point.zM / GROUND_METERS_PER_CELL);
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 || col >= ground.cols || row >= ground.rows) return undefined;
  const value = ground.heights[row * ground.cols + col];
  return Number.isFinite(value) ? heightToMeters(value) : undefined;
}

/** Why a body cannot stand at one proposed point; an empty list admits it.
 * Shared by the legacy inspection and the GG-537 load step, so both judge
 * footprint, obstruction, building clearance and water by the same rules. */
export function standingSeatReasons(
  ground: GroundWorld, kind: PlacementSurfaceCandidate['kind'], point: PlacementInspectionActor['position'],
  body: PlacementBodyProfile | undefined, surfaces: GroundWalkSurfaces,
): PlacementSurfaceCandidate['reasons'] {
  const maxX = ground.extentMetersX ?? (ground.cols - 1) * GROUND_METERS_PER_CELL;
  const maxZ = ground.extentMetersZ ?? (ground.rows - 1) * GROUND_METERS_PER_CELL;
  const inside = (xM: number, zM: number) => xM >= 0 && zM >= 0 && xM <= maxX && zM <= maxZ;
  const reasons: PlacementSurfaceCandidate['reasons'] = [];
  if (!Number.isFinite(point.yM)) reasons.push('unknown-surface');
  const measured = body && [body.heightM, body.halfWidthM].every(Number.isFinite) && body.heightM > 0 && body.halfWidthM > 0;
  if (!measured) reasons.push('unknown-body');
  else if (Number.isFinite(point.yM)) {
    // Test a real standing footprint. A point on the lip of a steep bank
    // must not qualify merely because its center has a finite height.
    const offsets = [-1, 0, 1].flatMap(x => [-1, 0, 1].map(z => ({ x: x * body.halfWidthM, z: z * body.halfWidthM })))
      .filter(offset => offset.x || offset.z);
    const footprintSupported = offsets.every(offset => {
      const xM = point.xM + offset.x, zM = point.zM + offset.z;
      if (!inside(xM, zM)) return false;
      const heights = kind === 'terrain' ? [groundSurfaceYM(ground, xM, zM)] : surfaces.surfaceHeightsAt(xM, zM);
      return heights.some(yM => Number.isFinite(yM) && Math.abs(yM - point.yM) <= Math.hypot(offset.x, offset.z) * MAX_GRADE + 1e-7);
    });
    if (!footprintSupported) reasons.push('steep-or-incomplete-support');
    if (surfaces.intersectsBody(point, body.halfWidthM, body.heightM)) reasons.push('body-obstruction');
    // The old walking solver's 1.9 m building proxy cannot prove that a
    // taller measured body fits an interior. Keep that limitation visible.
    if (ground.buildings?.some(building => {
      const xs = building.cornersM.map(p => p.x), zs = building.cornersM.map(p => p.z);
      return xs.length && point.xM + body.halfWidthM >= Math.min(...xs) && point.xM - body.halfWidthM <= Math.max(...xs)
        && point.zM + body.halfWidthM >= Math.min(...zs) && point.zM - body.halfWidthM <= Math.max(...zs);
    })) reasons.push('building-clearance-unverified');
    if (groundWaterMovementAt(ground, point, body).mode === 'blocked') reasons.push('water-blocked');
  }
  return reasons;
}

/** This is source inspection only. The caller must separately establish any
 * compatibility decision; selecting a candidate here never changes game state. */
export function inspectLegacyScenePlacement(
  ground: GroundWorld,
  actors: readonly PlacementInspectionActor[],
  playerId: string,
  surfaces: GroundWalkSurfaces,
) {
  const player = actors.find(actor => actor.id === playerId);
  const playerNearestY = player ? nearestGridY(ground, player.position) : undefined;
  const legacyPlayerSignature = !!player && Number.isFinite(playerNearestY)
    && Object.is(playerNearestY, player.position.yM);
  const maxX = ground.extentMetersX ?? (ground.cols - 1) * GROUND_METERS_PER_CELL;
  const maxZ = ground.extentMetersZ ?? (ground.rows - 1) * GROUND_METERS_PER_CELL;
  const inside = (xM: number, zM: number) => xM >= 0 && zM >= 0 && xM <= maxX && zM <= maxZ;
  return {
    legacyPlayerSignature,
    actors: actors.map(actor => {
      const { position, body } = actor;
      const finite = [position.xM, position.yM, position.zM].every(Number.isFinite) && inside(position.xM, position.zM);
      const supported = finite && isGroundFootingSupported(ground, position, undefined, surfaces);
      const legacySharedHeight = legacyPlayerSignature && (actor.id === playerId || actor.legacyEncounter === true)
        && Object.is(position.yM, player!.position.yM);
      const candidates: PlacementSurfaceCandidate[] = [];
      // An ordinary supported save, a foreign encounter or an arbitrary floating
      // point is not evidence for the old shared-floor defect.
      if (finite && !supported && legacySharedHeight) {
        const terrainY = groundSurfaceYM(ground, position.xM, position.zM);
        const deckY = [...new Set(surfaces.surfaceHeightsAt(position.xM, position.zM).filter(Number.isFinite))];
        const proposed = [{ kind: 'terrain' as const, yM: terrainY }, ...deckY.map(yM => ({ kind: 'deck' as const, yM }))];
        for (const proposedSurface of proposed) {
          const point = { ...position, yM: proposedSurface.yM };
          const reasons = standingSeatReasons(ground, proposedSurface.kind, point, body, surfaces);
          candidates.push({kind: proposedSurface.kind, position: point, admissible: reasons.length === 0, reasons});
        }
      }
      return { id: actor.id, position: { ...position }, supported, nearestGridY: nearestGridY(ground, position), legacySharedHeight, candidates };
    }),
  };
}
