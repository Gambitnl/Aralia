/**
 * Tests a proposed prop pose against the terrain using its actual captured
 * triangle underside. The existing placement gate still owns nominal seating;
 * this additional check prevents a passing class box from hiding a floating or
 * buried rendered model. It reuses the town's authored contact tolerances.
 * Nothing here changes the scene, terrain, source receipt, body or save.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 01:29:04
 * Dependents: components/World3D/World3DWrapper.tsx, systems/worldforge/props/exteriorPropRevision.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import { propSourceId, type PropInstance } from '@/systems/worldforge/props/propSchema';
import type { SurfaceProbe } from '@/systems/worldforge/terrain/surfaceProbe';
import { FEET_PER_METER } from '@/systems/worldforge/terrain/surfaceProbe';
import { TOWN_THRESHOLDS } from '@/systems/worldforge/placement/thresholds';
import { FOOTPRINT_GRID } from '@/systems/worldforge/placement/placedObject';
import { renderedPropPose, type RenderedGroundPropShape } from './groundPropGeometry';

export interface RenderedPropSupport {
  passed: boolean;
  issues: string[];
  samples: number;
  contactRatio: number;
  penetrationFt: number;
  supportSlopeVarianceRad2: number;
}

/** Vertical intersection with a triangle; lowest hit is the real lower hull. */
function hullY(x: number, z: number, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number | undefined {
  const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
  if (Math.abs(denominator) < 1e-12) return undefined;
  const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / denominator;
  const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / denominator;
  const w = 1 - u - v;
  return u >= -1e-8 && v >= -1e-8 && w >= -1e-8 ? u * a.y + v * b.y + w * c.y : undefined;
}

export function verifyRenderedPropSupport(prop: PropInstance, shape: RenderedGroundPropShape,
  probe: SurfaceProbe): RenderedPropSupport {
  const refuse = (issue: string): RenderedPropSupport => ({ passed: false, issues: [issue], samples: 0,
    contactRatio: 0, penetrationFt: 0, supportSlopeVarianceRad2: 0 });
  const fit = prop.surface;
  if (shape.sourceId !== propSourceId(prop) || shape.defId !== prop.defId) return refuse('shape-source-mismatch');
  if (shape.variation.scale !== prop.variation.scale || shape.variation.variant !== prop.variation.variant)
    return refuse('shape-appearance-mismatch');
  if (!fit || ![fit.groundYM, fit.sinkM, fit.tiltRad, ...fit.tiltAxis, prop.xM, prop.zM, prop.rotationRad].every(Number.isFinite))
    return refuse('unseated-prop');
  if (!shape.triangles.length || shape.triangles.some(t => t.length !== 3 || t.some(p => p.length !== 3 || !p.every(Number.isFinite))))
    return refuse('invalid-prop-shape');
  const pose = renderedPropPose(prop, fit.groundYM - fit.sinkM);
  const triangles = shape.triangles.map(t => t.map(p => new THREE.Vector3(...p).applyMatrix4(pose)));
  const box = new THREE.Box3(); for (const triangle of triangles) for (const point of triangle) box.expandByPoint(point);
  if (box.isEmpty() || box.max.x - box.min.x < 1e-8 || box.max.z - box.min.z < 1e-8) return refuse('degenerate-prop-footprint');
  const gaps: number[] = [], slopes: number[] = [];
  for (let ix = 0; ix < FOOTPRINT_GRID; ix++) for (let iz = 0; iz < FOOTPRINT_GRID; iz++) {
    const x = box.min.x + (box.max.x - box.min.x) * ix / (FOOTPRINT_GRID - 1);
    const z = box.min.z + (box.max.z - box.min.z) * iz / (FOOTPRINT_GRID - 1);
    let lower = Infinity;
    for (const t of triangles) {
      const y = hullY(x, z, t[0], t[1], t[2]); if (y !== undefined) lower = Math.min(lower, y);
    }
    // Holes between legs/logs are empty air, not an invented flat-bottom box.
    if (!Number.isFinite(lower)) continue;
    const ground = probe.sampleAt(x * FEET_PER_METER, z * FEET_PER_METER);
    if (![ground.elevationFt, ground.slopeRad].every(Number.isFinite)) return refuse('unknown-ground');
    gaps.push(lower * FEET_PER_METER - ground.elevationFt); slopes.push(ground.slopeRad);
  }
  if (gaps.length < 3) return refuse('insufficient-hull-contact-samples');
  const t = TOWN_THRESHOLDS;
  const contactRatio = gaps.filter(gap => Math.abs(gap) <= t.contactToleranceFt).length / gaps.length;
  let penetrationFt = Math.max(0, ...gaps.map(gap => -gap));
  // A narrow buried tip can fall between the regular contact samples. Check
  // every actual vertex too; this strengthens penetration without widening
  // the existing tolerance or pretending an empty gap is a solid base.
  for (const triangle of triangles) for (const point of triangle) {
    const ground = probe.sampleAt(point.x * FEET_PER_METER, point.z * FEET_PER_METER);
    if (!Number.isFinite(ground.elevationFt)) return refuse('unknown-ground');
    penetrationFt = Math.max(penetrationFt, ground.elevationFt - point.y * FEET_PER_METER);
  }
  const mean = slopes.reduce((a, b) => a + b, 0) / slopes.length;
  const variance = slopes.reduce((sum, slope) => sum + (slope - mean) ** 2, 0) / slopes.length;
  const issues: string[] = [];
  if (contactRatio < t.minContactRatio) issues.push('rendered-floater');
  if (penetrationFt > t.maxPenetrationFt) issues.push('rendered-sunken');
  if (variance > t.maxSupportSlopeVarianceRad2) issues.push('rendered-unstable-support');
  return { passed: !issues.length, issues, samples: gaps.length, contactRatio, penetrationFt, supportSlopeVarianceRad2: variance };
}
