/**
 * Joins rendered prop instances back to their canonical objects and measures
 * their actual geometry. A woodpile has six logs split across material batches;
 * a nearby prop must never be mistaken for one of those logs. These addresses
 * let clearance/collision work share the visible object's identity and bounds.
 *
 * Measurement is an explicit snapshot after layout, not per-frame work. It does
 * not change transforms, props, saves, ownership or movement admission. Missing
 * or inconsistent geometry is reported rather than replaced by a guessed size.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/11/2026, 03:10:38
 * Dependents: components/World3D/GroundProps.tsx, components/World3D/World3DWrapper.tsx, components/World3D/groundPropSupport.ts, systems/worldforge/props/exteriorPropRevision.ts, systems/worldforge/props/generators/propRenderRecipeV1.ts, systems/worldforge/props/generators/woodpileGeometry.ts, systems/worldforge/props/prospectivePropPlacement.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import { propSourceId, type PropInstance } from '@/systems/worldforge/props/propSchema';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';

export interface GroundPropInstanceSource {
  sourceId: string;
  defId: string;
  xM: number;
  zM: number;
  rotationRad: number;
  scale: number;
  variant: number;
  renderRecipe?: PropInstance['renderRecipe'];
  renderScale?: number;
}
const SOURCE_KEY = 'araliaGroundPropSources';

export function groundPropInstanceSource(prop: PropInstance): GroundPropInstanceSource {
  return { sourceId: propSourceId(prop), defId: prop.defId, xM: prop.xM, zM: prop.zM,
    rotationRad: prop.rotationRad, scale: prop.variation.scale, variant: prop.variation.variant,
    ...(prop.renderRecipe === undefined ? {} : {renderRecipe: prop.renderRecipe}),
    ...(prop.renderScale === undefined ? {} : {renderScale: prop.renderScale}) };
}

/** Called beside setMatrixAt, so metadata has exactly the same instance order. */
export function setGroundPropInstanceSources(mesh: THREE.InstancedMesh, sources: readonly GroundPropInstanceSource[]): void {
  mesh.userData[SOURCE_KEY] = sources.map(source => ({ ...source }));
}

export interface RenderedGroundPropBounds extends GroundPropInstanceSource {
  minXM: number; maxXM: number;
  minYM: number; maxYM: number;
  minZM: number; maxZM: number;
  radiusM: number;
  pieces: number;
  vertices: number;
}

export interface GroundPropGeometrySnapshot {
  bounds: RenderedGroundPropBounds[];
  issues: string[];
}

export type PropShapePoint = [number, number, number];
export interface RenderedGroundPropShape {
  sourceId: string;
  defId: string;
  variation: PropInstance['variation'];
  /** Geometry in prop-local metres; actual model/variation scale is retained. */
  triangles: Array<[PropShapePoint, PropShapePoint, PropShapePoint]>;
}

/** The same yaw/negative surface lean used by GroundProps. Scale is already
 * present in captured triangles, so it must never be applied a second time. */
export function renderedPropPose(prop: PropInstance, baseYM: number): THREE.Matrix4 {
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotationRad);
  const fit = prop.surface;
  if (fit?.tiltRad) {
    const axis = new THREE.Vector3(fit.tiltAxis[0], 0, fit.tiltAxis[1]);
    if (axis.lengthSq() > 0) rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(axis.normalize(), -fit.tiltRad));
  }
  return new THREE.Matrix4().compose(new THREE.Vector3(prop.xM, baseYM, prop.zM), rotation, new THREE.Vector3(1, 1, 1));
}

/** Captures only one actually mounted prop, without editing/cloning the scene.
 * The caller supplies its authoritative base height. The snapshot can then be
 * tested at another pose without moving a single live mesh or saved object. */
export function captureRenderedGroundPropShape(root: THREE.Object3D, origin: SceneOrigin,
  prop: PropInstance, baseYM: number): { shape?: RenderedGroundPropShape; issues: string[] } {
  if (!Number.isFinite(baseYM)) return { issues: ['unknown-prop-base'] };
  if (![prop.rotationRad, ...(prop.surface ? [prop.surface.tiltRad, ...prop.surface.tiltAxis] : [])].every(Number.isFinite))
    return { issues: ['invalid-prop-pose'] };
  const measured = measureRenderedGroundProps(root, origin, [prop]);
  if (measured.issues.length) return { issues: measured.issues };
  const sourceId = propSourceId(prop), inverse = renderedPropPose(prop, baseYM).invert();
  const triangles: RenderedGroundPropShape['triangles'] = [];
  const instance = new THREE.Matrix4(), transform = new THREE.Matrix4(), v = new THREE.Vector3();
  const rebase = new THREE.Matrix4().makeTranslation(origin.x, 0, origin.z);
  let invalid = false;
  root.traverseVisible(object => {
    const mesh = object as THREE.InstancedMesh;
    const sources = mesh.userData[SOURCE_KEY] as GroundPropInstanceSource[] | undefined;
    if (!mesh.isInstancedMesh || !sources) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.some(material => material.visible && material.opacity > 0 && material.colorWrite)) return;
    const positions = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex();
    if (!positions) { invalid = true; return; }
    const count = index?.count ?? positions.count;
    for (let i = 0; i < mesh.count; i++) {
      if (sources[i].sourceId !== sourceId) continue;
      if (count % 3 !== 0) { invalid = true; continue; }
      mesh.getMatrixAt(i, instance);
      transform.copy(inverse).multiply(rebase).multiply(mesh.matrixWorld).multiply(instance);
      for (let j = 0; j < count; j += 3) {
        const points = [j, j + 1, j + 2].map(k => {
          v.fromBufferAttribute(positions, index ? index.getX(k) : k).applyMatrix4(transform);
          return [v.x, v.y, v.z] as PropShapePoint;
        });
        triangles.push([points[0], points[1], points[2]]);
      }
    }
  });
  if (invalid || !triangles.length) return { issues: ['missing-prop-triangles'] };
  if (triangles.some(t => t.some(p => !p.every(Number.isFinite)))) return { issues: ['invalid-prop-triangles'] };
  return { shape: { sourceId, defId: prop.defId, variation: { ...prop.variation }, triangles }, issues: [] };
}

/**
 * Uses every transformed vertex of each represented instance, including yaw,
 * surface lean, nonuniform model scale and parent transforms. Optional focus
 * selects canonical prop origins BEFORE vertex work; all selected pieces still
 * contribute. The caller supplies the expected props so an invisible/missing
 * model cannot silently disappear from clearance qualification.
 */
export function measureRenderedGroundProps(
  root: THREE.Object3D,
  origin: SceneOrigin,
  expected: readonly PropInstance[],
  focus?: { xM: number; zM: number; radiusM: number },
): GroundPropGeometrySnapshot {
  const issues: string[] = [];
  if (![origin.x, origin.z].every(Number.isFinite)
    || (focus && (![focus.xM, focus.zM, focus.radiusM].every(Number.isFinite) || focus.radiusM < 0))) {
    return { bounds: [], issues: ['invalid-measurement-frame'] };
  }
  const selected = new Map<string, PropInstance>();
  for (const prop of expected) {
    if (focus && Math.hypot(prop.xM - focus.xM, prop.zM - focus.zM) > focus.radiusM) continue;
    const id = propSourceId(prop);
    if (selected.has(id)) issues.push(`duplicate-source:${id}`);
    selected.set(id, prop);
  }
  // Rounded legacy addresses can collide. Never merge two physical objects
  // into one apparently measured source or choose one by array order.
  if (issues.length) return { bounds: [], issues };
  const bounds = new Map<string, RenderedGroundPropBounds>();
  const invalid = new Set<string>();
  const instance = new THREE.Matrix4(), world = new THREE.Matrix4(), vertex = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverseVisible(object => {
    const mesh = object as THREE.InstancedMesh;
    if (!mesh.isInstancedMesh) return;
    const sources = mesh.userData[SOURCE_KEY] as GroundPropInstanceSource[] | undefined;
    if (!sources) return;
    if (sources.length !== mesh.count) { issues.push(`instance-count:${mesh.name}`); return; }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.some(material => material.visible && material.opacity > 0 && material.colorWrite)) return;
    const positions = mesh.geometry.getAttribute('position');
    for (let i = 0; i < mesh.count; i++) {
      const source = sources[i], prop = selected.get(source.sourceId);
      if (!prop) continue;
      if (source.defId !== prop.defId || source.xM !== prop.xM || source.zM !== prop.zM
        || source.rotationRad !== prop.rotationRad || source.scale !== prop.variation.scale || source.variant !== prop.variation.variant
        || source.renderRecipe !== prop.renderRecipe || source.renderScale !== prop.renderScale
        || !positions || !positions.count) {
        invalid.add(source.sourceId); issues.push(`source-geometry:${source.sourceId}`); continue;
      }
      mesh.getMatrixAt(i, instance); world.multiplyMatrices(mesh.matrixWorld, instance);
      if (!world.elements.every(Number.isFinite)) {
        invalid.add(source.sourceId); issues.push(`nonfinite-transform:${source.sourceId}`); continue;
      }
      let row = bounds.get(source.sourceId);
      if (!row) {
        row = { ...source, minXM: Infinity, maxXM: -Infinity, minYM: Infinity, maxYM: -Infinity,
          minZM: Infinity, maxZM: -Infinity, radiusM: 0, pieces: 0, vertices: 0 };
        bounds.set(source.sourceId, row);
      }
      row.pieces++;
      for (let j = 0; j < positions.count; j++) {
        vertex.fromBufferAttribute(positions, j).applyMatrix4(world);
        const x = vertex.x + origin.x, y = vertex.y, z = vertex.z + origin.z;
        if (![x, y, z].every(Number.isFinite)) {
          invalid.add(source.sourceId); issues.push(`nonfinite-vertex:${source.sourceId}`); break;
        }
        row.minXM = Math.min(row.minXM, x); row.maxXM = Math.max(row.maxXM, x);
        row.minYM = Math.min(row.minYM, y); row.maxYM = Math.max(row.maxYM, y);
        row.minZM = Math.min(row.minZM, z); row.maxZM = Math.max(row.maxZM, z);
        row.radiusM = Math.max(row.radiusM, Math.hypot(x - prop.xM, z - prop.zM));
        row.vertices++;
      }
    }
  });
  for (const id of selected.keys()) if (!bounds.has(id) || invalid.has(id)) issues.push(`unmeasured:${id}`);
  return { bounds: [...bounds.values()].filter(row => !invalid.has(row.sourceId)), issues: [...new Set(issues)] };
}
