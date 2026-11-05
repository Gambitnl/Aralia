/** Keep the walking camera in front of the real ground without scanning an
 * entire town for every view check. playerCameraVisibility calls this helper
 * for mounted terrain, roads, buildings and decks. Only triangle candidate
 * selection is cached. Rendered vertices and player feet never move. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/11/2026, 05:10:51
 * Dependents: components/World3D/playerCameraVisibility.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import {TABLE_LAMP_NO_HIT_RAYCAST} from './tableLamp';

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
  geometryBounds: THREE.Box3 | null;
  empty: boolean;
};
const indices = new WeakMap<THREE.BufferGeometry, GroundIndex>();
const version = (attribute: GroundIndex['position']) => 'version' in attribute ? attribute.version : attribute.data.version;

type InstanceIndex = {
  matrix: THREE.InstancedBufferAttribute; matrixVersion: number; count: number;
  geometry: THREE.BufferGeometry; position: GroundIndex['position']; positionVersion: number;
  cells: Map<string, number[]>; wide: number[]; boxes: THREE.Box3[];
};
const instanceIndices = new WeakMap<THREE.InstancedMesh, InstanceIndex>();

/** Street props share a handful of meshes across the whole town. Index their
 * actual instance bounds once, then check only instances crossed by this short
 * camera arm. The exact source triangles still decide visibility; these boxes
 * never become collision shapes or replace a prop's identity or transform. */
function instanceIndex(mesh: THREE.InstancedMesh): InstanceIndex {
  const position = mesh.geometry.getAttribute('position'), previous = instanceIndices.get(mesh);
  if (previous?.matrix === mesh.instanceMatrix && previous.matrixVersion === mesh.instanceMatrix.version
    && previous.count === mesh.count && previous.geometry === mesh.geometry
    && previous.position === position && previous.positionVersion === version(position)) return previous;
  const shape = new THREE.Box3(), vertex = new THREE.Vector3(), matrix = new THREE.Matrix4();
  for (let i = 0; i < position.count; i++) shape.expandByPoint(vertex.fromBufferAttribute(position, i));
  const cells = new Map<string, number[]>(), wide: number[] = [], boxes: THREE.Box3[] = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    const box = shape.clone().applyMatrix4(matrix); boxes.push(box);
    const minX = Math.floor(box.min.x / CELL_M), maxX = Math.floor(box.max.x / CELL_M);
    const minZ = Math.floor(box.min.z / CELL_M), maxZ = Math.floor(box.max.z / CELL_M);
    if (!Number.isFinite(minX + maxX + minZ + maxZ) || (maxX - minX + 1) * (maxZ - minZ + 1) > 256) {
      wide.push(i); continue;
    }
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const key = `${x},${z}`, list = cells.get(key);
      if (list) list.push(i); else cells.set(key, [i]);
    }
  }
  const result = {matrix: mesh.instanceMatrix, matrixVersion: mesh.instanceMatrix.version, count: mesh.count,
    geometry: mesh.geometry, position, positionVersion: version(position), cells, wide, boxes};
  instanceIndices.set(mesh, result); return result;
}

function nearbyInstances(mesh: THREE.InstancedMesh, raycaster: THREE.Raycaster): number[] {
  const indexed = instanceIndex(mesh), inverse = mesh.matrixWorld.clone().invert();
  const ray = raycaster.ray.clone().applyMatrix4(inverse);
  const start = raycaster.ray.at(raycaster.near, new THREE.Vector3()).applyMatrix4(inverse);
  const end = raycaster.ray.at(raycaster.far, new THREE.Vector3()).applyMatrix4(inverse);
  const candidates = new Set(indexed.wide);
  let x = Math.floor(start.x / CELL_M), z = Math.floor(start.z / CELL_M);
  const endX = Math.floor(end.x / CELL_M), endZ = Math.floor(end.z / CELL_M);
  const dx = end.x - start.x, dz = end.z - start.z, stepX = Math.sign(dx), stepZ = Math.sign(dz);
  let nextX = dx ? ((x + (stepX > 0 ? 1 : 0)) * CELL_M - start.x) / dx : Infinity;
  let nextZ = dz ? ((z + (stepZ > 0 ? 1 : 0)) * CELL_M - start.z) / dz : Infinity;
  const deltaX = dx ? CELL_M / Math.abs(dx) : Infinity, deltaZ = dz ? CELL_M / Math.abs(dz) : Infinity;
  for (let remaining = Math.abs(endX - x) + Math.abs(endZ - z) + 1; remaining > 0; remaining--) {
    for (const i of indexed.cells.get(`${x},${z}`) ?? []) candidates.add(i);
    if (x === endX && z === endZ) break;
    if (nextX < nextZ) { x += stepX; nextX += deltaX; }
    else if (nextZ < nextX) { z += stepZ; nextZ += deltaZ; }
    else { x += stepX; z += stepZ; nextX += deltaX; nextZ += deltaZ; }
  }
  return [...candidates].filter(i => ray.intersectsBox(indexed.boxes[i]));
}

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
  const geometryBounds = new THREE.Box3().makeEmpty();
  let boundsProven = true, triangleCount = 0;
  for (let offset = 0; offset + 2 < count; offset += 3) {
    const a = index ? index.getX(offset) : offset;
    const b = index ? index.getX(offset + 1) : offset + 1;
    const c = index ? index.getX(offset + 2) : offset + 2;
    const ax = position.getX(a), ay = position.getY(a), az = position.getZ(a);
    const bx = position.getX(b), by = position.getY(b), bz = position.getZ(b);
    const cx = position.getX(c), cy = position.getY(c), cz = position.getZ(c);
    triangleCount++;
    const triangleMinX = Math.min(ax, bx, cx), triangleMaxX = Math.max(ax, bx, cx);
    const triangleMinY = Math.min(ay, by, cy), triangleMaxY = Math.max(ay, by, cy);
    const triangleMinZ = Math.min(az, bz, cz), triangleMaxZ = Math.max(az, bz, cz);
    if (Number.isFinite(ax) && Number.isFinite(ay) && Number.isFinite(az)
      && Number.isFinite(bx) && Number.isFinite(by) && Number.isFinite(bz)
      && Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(cz)) {
      geometryBounds.min.set(Math.min(geometryBounds.min.x, triangleMinX), Math.min(geometryBounds.min.y, triangleMinY), Math.min(geometryBounds.min.z, triangleMinZ));
      geometryBounds.max.set(Math.max(geometryBounds.max.x, triangleMaxX), Math.max(geometryBounds.max.y, triangleMaxY), Math.max(geometryBounds.max.z, triangleMaxZ));
    } else {
      // An incomplete or non-finite source triangle cannot prove a safe reject.
      boundsProven = false;
    }
    const minX = Math.floor(triangleMinX / CELL_M), maxX = Math.floor(triangleMaxX / CELL_M);
    const minZ = Math.floor(triangleMinZ / CELL_M), maxZ = Math.floor(triangleMaxZ / CELL_M);
    triangleBounds.set([
      triangleMinX, triangleMinY, triangleMinZ, triangleMaxX, triangleMaxY, triangleMaxZ,
    ], offset * 2);
    if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) continue;
    if ((maxX - minX + 1) * (maxZ - minZ + 1) > 4096) { wide.push(offset); continue; }
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const key = `${x},${z}`, bucket = cells.get(key);
      if (bucket) bucket.push(offset); else cells.set(key, [offset]);
    }
  }
  const result = {position, positionVersion: version(position), index, indexVersion: index?.version ?? 0,
    cells, wide, triangleBounds, geometryBounds: boundsProven ? geometryBounds : null, empty: triangleCount === 0};
  indices.set(geometry, result); return result;
}

/** Exact Three ray/triangle and material-side semantics after a local broad
 * phase. This is visibility only: it supplies no footing or movement result.
 * Transforms, draw ranges, material groups and current visibility stay live. */
export type GroundCameraRayRoot = {
  root: THREE.Object3D;
  applies: readonly boolean[];
  /** The caller already found a meaningful custom raycast during its live scene walk. */
  batchSafe?: boolean;
};

/** Keep single-ray callers on the same exact path while letting one sightline
 * reuse its visible scene walk for every drawn-body sample. */
export function nearestGroundCameraHit(root: THREE.Object3D, raycaster: THREE.Raycaster): number | null {
  return nearestGroundCameraHitLegacy(root, raycaster);
}

/** Find the nearest rendered obstruction for each ray while visiting each root
 * once. The supplied fallback preserves the old ray-by-ray order when a custom
 * raycast can change the scene as it runs. */
export function nearestGroundCameraHits(roots: readonly GroundCameraRayRoot[], raycasters: readonly THREE.Raycaster[],
  fallback?: () => Array<number | null>): Array<number | null> {
  // A single ray already has no duplicate scene walk to remove. Keeping it on
  // the original ordered path also preserves custom side effects without a probe.
  if (raycasters.length < 2) return raycasters.map(raycaster => {
    let nearest: number | null = null;
    roots.forEach(({root, applies}) => {
      if (!applies[0]) return;
      const hit = nearestGroundCameraHitLegacy(root, raycaster);
      if (hit !== null && (nearest === null || hit < nearest)) nearest = hit;
    });
    return nearest;
  });
  const orderedFallback = () => {
    if (fallback) return fallback();
    return raycasters.map((raycaster, rayIndex) => {
      let nearest: number | null = null;
      roots.forEach(({root, applies}) => {
        if (!applies[rayIndex]) return;
        const hit = nearestGroundCameraHitLegacy(root, raycaster);
        if (hit !== null && (nearest === null || hit < nearest)) nearest = hit;
      });
      return nearest;
    });
  };
  // The caller's existing scene walk can identify custom callbacks before the
  // query, avoiding a probe traversal that would then be repeated in fallback.
  if (roots.some(({batchSafe}) => batchSafe === false)) return orderedFallback();
  const visibleMeshes = roots.map(({root, applies}) => {
    const meshes: THREE.Mesh[] = [];
    if (applies.some(Boolean)) root.traverseVisible(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) meshes.push(mesh);
    });
    return meshes;
  });
  // A custom raycast may open a door, move another root, or otherwise change
  // what a later ray sees. Re-run the caller's original ordered query in that
  // case so batching never freezes those meaningful side effects.
  if (visibleMeshes.some(meshes => meshes.some(mesh => mesh.raycast !== THREE.Mesh.prototype.raycast
    && mesh.raycast !== TABLE_LAMP_NO_HIT_RAYCAST
    && !(mesh instanceof THREE.InstancedMesh && mesh.raycast === THREE.InstancedMesh.prototype.raycast)))) {
    return orderedFallback();
  }

  const results = raycasters.map((): number | null => null);
  roots.forEach(({applies}, rootIndex) => {
    const meshes = visibleMeshes[rootIndex];
    raycasters.forEach((raycaster, rayIndex) => {
      if (!applies[rayIndex]) return;
      const hit = nearestGroundCameraHitMeshes(meshes, raycaster);
      if (hit !== null && (results[rayIndex] === null || hit < results[rayIndex]!)) results[rayIndex] = hit;
    });
  });
  return results;
}

function nearestGroundCameraHitLegacy(root: THREE.Object3D, raycaster: THREE.Raycaster): number | null {
  return nearestGroundCameraHitMeshes([], raycaster, root);
}

function nearestGroundCameraHitMeshes(meshes: readonly THREE.Mesh[], raycaster: THREE.Raycaster,
  liveRoot?: THREE.Object3D): number | null {
  let nearest: number | null = null;
  const inverse = new THREE.Matrix4(), ray = new THREE.Ray();
  const start = new THREE.Vector3(), end = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
  const triangleBox = new THREE.Box3();
  const visit = (mesh: THREE.Mesh) => {
    if (!mesh.layers.test(raycaster.layers)) return;
    const geometry = mesh.geometry, position = geometry.getAttribute('position');
    if (!position) return;
    if (mesh instanceof THREE.InstancedMesh && mesh.raycast === THREE.InstancedMesh.prototype.raycast
      && !mesh.morphTexture && !geometry.morphAttributes.position?.length && Number.isFinite(raycaster.far)) {
      const candidates = nearbyInstances(mesh, raycaster);
      if (!candidates.length) return;
      // A private query object uses the same triangles/materials at each exact
      // instance matrix. It is never mounted and never changes a live mesh.
      const probe = new THREE.Mesh(geometry, mesh.material), matrix = new THREE.Matrix4();
      probe.layers.mask = mesh.layers.mask;
      for (const i of candidates) {
        mesh.getMatrixAt(i, matrix); probe.matrixWorld.multiplyMatrices(mesh.matrixWorld, matrix);
        const hit = nearestGroundCameraHit(probe, raycaster);
        if (hit !== null && (nearest === null || hit < nearest)) nearest = hit;
      }
      return;
    }
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
    const indexed = groundIndex(geometry);
    // Every indexed triangle must fit this source-derived box before it can
    // reject a ray. Empty triangle lists are a proven miss; malformed source
    // data disables the shortcut and keeps the established exact path.
    if (indexed.empty || (indexed.geometryBounds && !ray.intersectsBox(indexed.geometryBounds))) return;
    const candidates = new Set(indexed.wide);
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
  };
  if (liveRoot) {
    // Preserve Three's ordered visibility walk for custom raycasts: each mesh
    // is queried before traversal advances to its next sibling.
    liveRoot.traverseVisible(object => { const mesh = object as THREE.Mesh; if (mesh.isMesh) visit(mesh); });
  } else {
    for (const mesh of meshes) visit(mesh);
  }
  return nearest;
}

function opaque(material: THREE.Material | undefined): material is THREE.Material {
  return !!material?.visible && material.opacity > 0 && !(material.transparent && material.opacity < .95);
}
