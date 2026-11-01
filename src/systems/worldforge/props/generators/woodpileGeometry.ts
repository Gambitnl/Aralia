/** Shared, versioned woodpile art recipe. Rendering and saved repair validation
 * use these same six logs; a receipt cannot substitute a smaller fake model to
 * pass clearance. Keep v1 available when a future art recipe is introduced. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 01:29:04
 * Dependents: components/World3D/GroundProps.tsx, components/World3D/groundBuildingMotion.ts, systems/worldforge/props/exteriorPropRevision.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import { propSourceId, type PropInstance } from '../propSchema';
import type { RenderedGroundPropShape, PropShapePoint } from '@/components/World3D/groundPropGeometry';

export const WOODPILE_LOG_POSITIONS_V1 = [
  [-.3, .15], [0, .15], [.3, .15], [-.15, .42], [.15, .42], [0, .68],
] as const;
export function createWoodpileLogGeometryV1(): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(.14, .14, 1.4, 7);
}

/** Walking envelopes come from the same seven-sided log vertices as rendering,
 * not the catalog's nominal Medium box. Empty space above/between tiers stays
 * empty. The movement owner adds its existing body clearance when sweeping. */
export function woodpileBoxesV1(prop: PropInstance) {
  const geometry = createWoodpileLogGeometryV1(); geometry.rotateX(Math.PI / 2); geometry.computeBoundingBox();
  const box = geometry.boundingBox!, scale = prop.variation.scale;
  const boxes = WOODPILE_LOG_POSITIONS_V1.map(([x, y]) => ({
    x: (x + (box.min.x + box.max.x) / 2) * scale, z: (box.min.z + box.max.z) / 2 * scale,
    hx: (box.max.x - box.min.x) / 2 * scale, hz: (box.max.z - box.min.z) / 2 * scale,
    bottom: (y + box.min.y) * scale, top: (y + box.max.y) * scale,
  }));
  geometry.dispose(); return boxes;
}

/** Actual scaled geometry, in prop-local axes; world yaw/lean remain pose. */
export function woodpileShapeV1(prop: PropInstance): RenderedGroundPropShape {
  if (prop.defId !== 'woodpile') throw new Error('Unsupported woodpile recipe source');
  const geometry = createWoodpileLogGeometryV1(), positions = geometry.getAttribute('position'), index = geometry.getIndex()!;
  const triangles: RenderedGroundPropShape['triangles'] = [], v = new THREE.Vector3();
  for (const [x, y] of WOODPILE_LOG_POSITIONS_V1) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x * prop.variation.scale, y * prop.variation.scale, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3().setScalar(prop.variation.scale));
    for (let j = 0; j < index.count; j += 3) {
      const points = [j, j + 1, j + 2].map(k => {
        v.fromBufferAttribute(positions, index.getX(k)).applyMatrix4(matrix);
        return [v.x, v.y, v.z] as PropShapePoint;
      });
      triangles.push([points[0], points[1], points[2]]);
    }
  }
  geometry.dispose();
  return { sourceId: propSourceId(prop), defId: prop.defId, variation: { ...prop.variation }, triangles };
}

/** Instanced matrices use float32. Compare the full triangle multiset within
 * 0.1 mm, independent of material batching/winding, rather than trusting a
 * supplied radius or a receipt that merely rehashed altered geometry. */
export function capturedWoodpileMatchesV1(prop: PropInstance, captured: RenderedGroundPropShape): boolean {
  const expected = woodpileShapeV1(prop);
  if (captured.sourceId !== expected.sourceId || captured.defId !== expected.defId
    || JSON.stringify(captured.variation) !== JSON.stringify(expected.variation)
    || captured.triangles.length !== expected.triangles.length) return false;
  const remaining = [...captured.triangles];
  for (const triangle of expected.triangles) {
    const i = remaining.findIndex(other => triangle.every(point => other.some(p =>
      p.length === 3 && Math.hypot(p[0] - point[0], p[1] - point[1], p[2] - point[2]) <= 1e-4)));
    if (i < 0) return false;
    remaining.splice(i, 1);
  }
  return true;
}
