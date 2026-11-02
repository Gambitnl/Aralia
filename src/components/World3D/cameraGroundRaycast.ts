/** Keep the walking camera in front of the real ground without scanning an
 * entire town for every view check. playerCameraVisibility calls this helper
 * for mounted terrain, roads, buildings and decks. Only triangle candidate
 * selection is cached. Rendered vertices and player feet never move. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 21:49:36
 * Dependents: components/World3D/playerCameraVisibility.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';

// Dense road/terrain faces need smaller bins than the town's sparse posts.
// A six-meter arm should not test every face across an eight-meter square.
const CELL_M = 2;
type GroundIndex = {
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  positionVersion: number;
  index: THREE.BufferAttribute | null;
  indexVersion: number;
  cells: Map<string, number[]>;
  wide: number[];
  triangleBounds: Float64Array;
};
const indices = new WeakMap<THREE.BufferGeometry, GroundIndex>();
const version = (attribute: GroundIndex['position']) => 'version' in attribute ? attribute.version : attribute.data.version;

/** Index the actual rendered triangles once, without changing their arrays.
 * A town road mesh can contain hundreds of thousands of faces. The walking
 * camera needs only the few cells crossed by its short arm, not a full scan
 * for each body sample on every frame. Large faces stay in a fallback list. */
function groundIndex(geometry: THREE.BufferGeometry): GroundIndex {
  const position = geometry.getAttribute('position'), index = geometry.getIndex();
  const previous = indices.get(geometry);
  if (previous?.position === position && previous.positionVersion === version(position)
    && previous.index === index && previous.indexVersion === (index?.version ?? 0)) return previous;
  const cells = new Map<string, number[]>(), wide: number[] = [];
  const count = index?.count ?? position.count;
  const triangleBounds = new Float64Array(Math.floor(count / 3) * 6);
  for (let offset = 0; offset + 2 < count; offset += 3) {
    const a = index ? index.getX(offset) : offset;
    const b = index ? index.getX(offset + 1) : offset + 1;
    const c = index ? index.getX(offset + 2) : offset + 2;
    const minX = Math.floor(Math.min(position.getX(a), position.getX(b), position.getX(c)) / CELL_M);
    const maxX = Math.floor(Math.max(position.getX(a), position.getX(b), position.getX(c)) / CELL_M);
    const minZ = Math.floor(Math.min(position.getZ(a), position.getZ(b), position.getZ(c)) / CELL_M);
    const maxZ = Math.floor(Math.max(position.getZ(a), position.getZ(b), position.getZ(c)) / CELL_M);
    triangleBounds.set([
      Math.min(position.getX(a), position.getX(b), position.getX(c)), Math.min(position.getY(a), position.getY(b), position.getY(c)), Math.min(position.getZ(a), position.getZ(b), position.getZ(c)),
      Math.max(position.getX(a), position.getX(b), position.getX(c)), Math.max(position.getY(a), position.getY(b), position.getY(c)), Math.max(position.getZ(a), position.getZ(b), position.getZ(c)),
    ], offset * 2);
    if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) continue;
    if ((maxX - minX + 1) * (maxZ - minZ + 1) > 4096) { wide.push(offset); continue; }
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const key = `${x},${z}`, bucket = cells.get(key);
      if (bucket) bucket.push(offset); else cells.set(key, [offset]);
    }
  }
  const result = {position, positionVersion: version(position), index, indexVersion: index?.version ?? 0, cells, wide, triangleBounds};
  indices.set(geometry, result); return result;
}

/** Exact Three ray/triangle and material-side semantics after a local broad
 * phase. This is visibility only: it supplies no footing or movement result.
 * Transforms, draw ranges, material groups and current visibility stay live. */
export function nearestGroundCameraHit(root: THREE.Object3D, raycaster: THREE.Raycaster): number | null {
  let nearest: number | null = null;
  const inverse = new THREE.Matrix4(), ray = new THREE.Ray();
  const start = new THREE.Vector3(), end = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
  const triangleBox = new THREE.Box3();
  root.traverseVisible(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.layers.test(raycaster.layers)) return;
    const geometry = mesh.geometry, position = geometry.getAttribute('position');
    if (!position) return;
    // Ordinary static structural meshes share this exact index. Preserve the
    // native path for animated meshes, custom decorative raycasts (including
    // lamps that intentionally yield), or unusual ranges rather than indexing
    // a shape that differs from what its owner actually permits the ray to hit.
    if (mesh instanceof THREE.SkinnedMesh || mesh instanceof THREE.InstancedMesh
      || mesh.raycast !== THREE.Mesh.prototype.raycast
      || geometry.morphAttributes.position?.length || geometry.drawRange.start % 3
      || (Array.isArray(mesh.material) && geometry.groups.some(group => group.start % 3))
      || !Number.isFinite(raycaster.far)) {
      for (const entry of raycaster.intersectObject(mesh, false)) {
        const material = Array.isArray(mesh.material) ? mesh.material[entry.face?.materialIndex ?? 0] : mesh.material;
        if (opaque(material) && (nearest === null || entry.distance < nearest)) nearest = entry.distance;
      }
      return;
    }
    inverse.copy(mesh.matrixWorld).invert(); ray.copy(raycaster.ray).applyMatrix4(inverse);
    start.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, raycaster.near).applyMatrix4(inverse);
    end.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, raycaster.far).applyMatrix4(inverse);
    const indexed = groundIndex(geometry), candidates = new Set(indexed.wide);
    let x = Math.floor(start.x / CELL_M), z = Math.floor(start.z / CELL_M);
    const endX = Math.floor(end.x / CELL_M), endZ = Math.floor(end.z / CELL_M);
    const dx = end.x - start.x, dz = end.z - start.z, stepX = Math.sign(dx), stepZ = Math.sign(dz);
    let nextX = dx ? ((x + (stepX > 0 ? 1 : 0)) * CELL_M - start.x) / dx : Infinity;
    let nextZ = dz ? ((z + (stepZ > 0 ? 1 : 0)) * CELL_M - start.z) / dz : Infinity;
    const deltaX = dx ? CELL_M / Math.abs(dx) : Infinity, deltaZ = dz ? CELL_M / Math.abs(dz) : Infinity;
    // Traverse crossed cells rather than the whole diagonal bounding rectangle.
    // Every face occupies all cells touched by its bounds, including boundaries.
    for (let remaining = Math.abs(endX - x) + Math.abs(endZ - z) + 1; remaining > 0; remaining--) {
      for (const offset of indexed.cells.get(`${x},${z}`) ?? []) candidates.add(offset);
      if (x === endX && z === endZ) break;
      if (nextX < nextZ) { x += stepX; nextX += deltaX; }
      else if (nextZ < nextX) { z += stepZ; nextZ += deltaZ; }
      else { x += stepX; z += stepZ; nextX += deltaX; nextZ += deltaZ; }
    }
    const count = indexed.index?.count ?? position.count;
    const drawEnd = Math.min(count, geometry.drawRange.start + geometry.drawRange.count);
    const vertex = (i: number) => indexed.index ? indexed.index.getX(i) : i;
    const sourceMaterials = mesh.material;
    const singleMaterials = Array.isArray(sourceMaterials) ? null : [sourceMaterials];
    for (const offset of candidates) {
      if (offset < geometry.drawRange.start || offset >= drawEnd) continue;
      // Most faces in a crossed ground cell sit below this camera ray. Their
      // exact bounds reject them before vertex reads and triangle intersection.
      triangleBox.min.fromArray(indexed.triangleBounds, offset * 2);
      triangleBox.max.fromArray(indexed.triangleBounds, offset * 2 + 3);
      if (!ray.intersectsBox(triangleBox)) continue;
      const materials = Array.isArray(sourceMaterials)
        ? geometry.groups.filter(group => offset >= group.start && offset < group.start + group.count)
          .map(group => sourceMaterials[group.materialIndex ?? 0])
        : singleMaterials!;
      a.fromBufferAttribute(position, vertex(offset)); b.fromBufferAttribute(position, vertex(offset + 1)); c.fromBufferAttribute(position, vertex(offset + 2));
      for (const material of materials) {
        if (!opaque(material)) continue;
        const point = material.side === THREE.BackSide ? ray.intersectTriangle(c, b, a, true, hit)
          : ray.intersectTriangle(a, b, c, material.side === THREE.FrontSide, hit);
        if (!point) continue;
        hit.applyMatrix4(mesh.matrixWorld);
        const distance = hit.distanceTo(raycaster.ray.origin);
        if (distance >= raycaster.near && distance <= raycaster.far && (nearest === null || distance < nearest)) nearest = distance;
      }
    }
  });
  return nearest;
}

function opaque(material: THREE.Material | undefined): material is THREE.Material {
  return !!material?.visible && material.opacity > 0 && !(material.transparent && material.opacity < .95);
}
