/**
 * Copies the ground and rock triangles already committed to a river scene.
 * A future fixed-bank experiment can give the solver and renderer this same copy.
 * This helper never updates the scene: the caller must supply a complete source
 * list and stable, current world/instance matrices from one committed render state.
 * Keeping vertical and boundary faces does not prove the terrain has one height.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/10/2026, 12:06:50
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync --only [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Box3, Material, Matrix4, Mesh, InstancedMesh, Vector3 } from 'three';

export interface RiverBankPatch { minX: number; maxX: number; minZ: number; maxZ: number }
export interface RiverBankTerrainCaps {
  inputMeshes: number; instances: number; inputVertices: number;
  scannedTriangles: number; outputTriangles: number;
}
export interface RiverBankTerrainSource {
  name: string;
  mesh: Mesh | InstancedMesh;
  /** A subset requires the caller's explicit assertion that omitted instances miss the patch. */
  instanceIndices?: readonly number[];
  selectedInstancesCoverPatch?: true;
  /** Keep all drawn faces of each overlapping mesh/instance for closure checks.
   * A tiled mesh can still be only part of a rock; this is not a solid certificate. */
  retainWholeObject?: true;
  /** Retain only exact-position-connected drawn pieces touching the patch.
   * This avoids copying unrelated rocks merged into the same draw tile. */
  retainIntersectingComponents?: true;
}
export interface RiverBankTerrainCaptureInput {
  sources: readonly RiverBankTerrainSource[];
  patch: RiverBankPatch;
  consistencyToken: string;
  /** This is a caller assertion, not evidence that this helper found every scene solid. */
  inputsComplete: boolean;
  caps?: Partial<RiverBankTerrainCaps>;
}
export interface RiverBankTerrainCounters {
  inputMeshes: number; instances: number; inputVertices: number;
  rejectedBounds: number; scannedTriangles: number; outputTriangles: number;
}
export interface RiverBankTerrainObject {
  sourceName: string; meshUuid: string; geometryUuid: string;
  positionVersion: number; indexVersion: number | null;
  instanceMatrixVersion: number | null; instanceIndex: number | null;
  worldMatrix: readonly number[]; instanceMatrix: readonly number[] | null;
  /** Present only for the optional full drawn-object copy; closure is unproved. */
  faceSelection?: 'whole-intersecting-object' | 'connected-patch-components';
  drawRange: { start: number; count: number };
  groups: readonly { start: number; count: number; materialIndex: number }[];
}
export interface RiverBankTerrainTriangle {
  objectIndex: number; elementStart: number; groupIndex: number | null;
  materialIndex: number; materialUuid: string; materialSide: number;
}
export interface RiverBankTerrainSnapshot {
  /** Nine copied world coordinates per triangle. Triangles crossing the patch are not clipped. */
  vertices: Float64Array;
  triangles: readonly RiverBankTerrainTriangle[];
  objects: readonly RiverBankTerrainObject[];
  identity: string;
  consistencyToken: string;
  patch: RiverBankPatch;
  bounds: { min: readonly number[]; max: readonly number[] } | null;
  counters: RiverBankTerrainCounters;
  limitations: readonly string[];
}
export type RiverBankTerrainCaptureResult =
  | { ok: true; snapshot: RiverBankTerrainSnapshot }
  | { ok: false; code: 'incomplete' | 'invalid' | 'nonfinite' | 'unsupported' | 'cap'; message: string; counters: RiverBankTerrainCounters };

const DEFAULT_CAPS: RiverBankTerrainCaps = {
  inputMeshes: 256, instances: 8192, inputVertices: 1000000,
  scannedTriangles: 1000000, outputTriangles: 100000,
};
const LIMITATIONS = [
  'Source completeness and committed matrix consistency are caller assertions.',
  'Only static CPU triangle positions are supported; shader displacement, skinning and morphs are rejected.',
  'Patch overlap is conservative in x/z; retained faces include vertical faces and overhangs.',
  'No single-valued top envelope, terrain coverage or solver/render integration is proved.',
  'Camera culling and material shading do not alter this solid geometry snapshot.',
  'Whole-object selection retains drawn faces, not hidden or omitted draw ranges; tiled objects still require cross-tile closure checks.',
] as const;

// A content identity catches accidental mixing of copies. It is a deterministic
// non-cryptographic checksum, not proof of scene ownership or source completeness.
function contentIdentity(metadata: string, vertices: Float64Array): string {
  let hash = 2166136261;
  const mix = (byte: number) => { hash = Math.imul(hash ^ byte, 16777619) >>> 0; };
  for (let i = 0; i < metadata.length; i++) {
    mix(metadata.charCodeAt(i) & 255); mix(metadata.charCodeAt(i) >>> 8);
  }
  const scratch = new DataView(new ArrayBuffer(8));
  for (const value of vertices) {
    scratch.setFloat64(0, value, true);
    for (let i = 0; i < 8; i++) mix(scratch.getUint8(i));
  }
  return `bank-terrain-v1-${hash.toString(16).padStart(8, '0')}`;
}

/** Returns no partial snapshot when any source or work limit is unsafe. */
export function captureRiverBankTerrainSnapshot(input: RiverBankTerrainCaptureInput): RiverBankTerrainCaptureResult {
  const counters: RiverBankTerrainCounters = {
    inputMeshes: 0, instances: 0, inputVertices: 0, rejectedBounds: 0,
    scannedTriangles: 0, outputTriangles: 0,
  };
  const fail = (code: 'incomplete' | 'invalid' | 'nonfinite' | 'unsupported' | 'cap', message: string): RiverBankTerrainCaptureResult =>
    ({ ok: false, code, message, counters: { ...counters } });
  const caps = { ...DEFAULT_CAPS, ...input.caps };
  const p = input.patch;
  if (!input.inputsComplete || !input.sources.length || !input.consistencyToken.trim()) return fail('incomplete', 'A complete named source list and consistency token are required.');
  if (!Object.values(p).every(Number.isFinite)) return fail('nonfinite', 'Patch bounds must be finite.');
  if (!(p.minX < p.maxX && p.minZ < p.maxZ) || !Object.entries(caps).every(([key, v]) => Number.isSafeInteger(v) && v > 0 && v <= DEFAULT_CAPS[key as keyof RiverBankTerrainCaps])) return fail('invalid', 'Patch extent and positive caps no larger than the fixed ceilings are required.');
  if (input.sources.length > caps.inputMeshes) return fail('cap', 'Input mesh cap exceeded.');
  const objects: RiverBankTerrainObject[] = [];
  const triangles: RiverBankTerrainTriangle[] = [];
  const coords: number[] = [];
  const outputBounds = new Box3();
  const names = new Set<string>();
  const overlaps = (box: Box3) => box.max.x >= p.minX && box.min.x <= p.maxX && box.max.z >= p.minZ && box.min.z <= p.maxZ;
  for (const source of input.sources) {
    counters.inputMeshes++;
    const mesh = source.mesh;
    if (!source.name.trim() || names.has(source.name) || !mesh?.isMesh) return fail('invalid', 'Sources need unique names and triangle meshes.');
    names.add(source.name);
    if (source.retainWholeObject && source.retainIntersectingComponents) return fail('invalid', 'Choose one complete-face selection mode.');
    for (let ancestor = mesh as Mesh | null; ancestor; ancestor = ancestor.parent as Mesh | null) {
      if (!ancestor.visible) return fail('incomplete', `${source.name} is hidden in the committed scene.`);
    }
    const geometry = mesh.geometry;
    if (!geometry?.isBufferGeometry) return fail('unsupported', 'Only BufferGeometry is supported.');
    if ('isInstancedBufferGeometry' in geometry && !(mesh as InstancedMesh).isInstancedMesh) return fail('unsupported', 'Custom geometry instancing without InstancedMesh matrices is unsupported.');
    if ('isSkinnedMesh' in mesh || Object.values(geometry.morphAttributes).some(attrs => attrs?.length) || mesh.morphTargetInfluences?.length) return fail('unsupported', 'Skinned or morphed terrain cannot be copied as static positions.');
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.length > caps.inputMeshes) return fail('cap', 'Material input cap exceeded.');
    for (const material of materials) {
      const nodes = material as Material & { positionNode?: unknown; vertexNode?: unknown; geometryNode?: unknown; displacementMap?: unknown; isShaderMaterial?: boolean; wireframe?: boolean };
      if (nodes.positionNode || nodes.vertexNode || nodes.geometryNode || nodes.displacementMap || nodes.isShaderMaterial || nodes.wireframe || material.onBeforeCompile !== Material.prototype.onBeforeCompile || material.clippingPlanes?.length || material.transparent || material.alphaTest > 0) return fail('unsupported', `${source.name} uses unsupported position or solid-coverage material behavior.`);
    }
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    if (index && (typeof index.getX !== 'function' || index.itemSize !== 1 || index.normalized || !Number.isSafeInteger(index.count))) return fail('unsupported', 'Only complete CPU triangle indices are supported.');
    if (!position || typeof position.getX !== 'function' || position.itemSize !== 3 || position.normalized || position.count < 3 || !Number.isSafeInteger(position.count)) return fail('unsupported', 'A complete unnormalized three-component CPU position attribute is required.');
    if (counters.inputVertices + position.count > caps.inputVertices) return fail('cap', 'Input vertex broadphase cap exceeded.');
    const localBounds = new Box3();
    const vertex = new Vector3();
    // Compute our own bounds without populating or trusting the source boundingBox.
    // This bounded scan detects bad coordinates before an outside-patch rejection.
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      if (![vertex.x, vertex.y, vertex.z].every(Number.isFinite)) return fail('nonfinite', 'Source vertex is nonfinite.');
      localBounds.expandByPoint(vertex);
    }
    counters.inputVertices += position.count;
    const total = index?.count ?? position.count;
    const draw = geometry.drawRange;
    const validRange = (start: number, count: number) => Number.isSafeInteger(start) && start >= 0 && (count === Infinity || Number.isSafeInteger(count) && count >= 0);
    if (!validRange(draw.start, draw.count)) return fail('invalid', 'Invalid draw range.');
    if (geometry.groups.length > caps.scannedTriangles) return fail('cap', 'Group cap exceeded.');
    const groups = geometry.groups.map(g => ({ start: g.start, count: g.count, materialIndex: g.materialIndex ?? 0 }));
    if (groups.some(g => !validRange(g.start, g.count) || !Number.isSafeInteger(g.materialIndex) || g.materialIndex < 0)) return fail('invalid', 'Invalid material group.');
    if (Array.isArray(mesh.material) && !groups.length) return fail('incomplete', 'A material-array mesh without groups has no solid draw calls.');
    if (Array.isArray(mesh.material) && groups.some(g => !materials[g.materialIndex])) return fail('incomplete', 'Material group refers to a missing material.');
    const instanced = (mesh as InstancedMesh).isInstancedMesh === true;
    const im = mesh as InstancedMesh;
    if (instanced && (!Number.isSafeInteger(im.count) || im.count < 0 || im.count > im.instanceMatrix.count)) return fail('invalid', 'Invalid active instance count.');
    if (!instanced && source.instanceIndices) return fail('invalid', 'Instance selection requires an InstancedMesh.');
    if (source.instanceIndices && !source.selectedInstancesCoverPatch) return fail('incomplete', 'Selected instances require explicit complete patch coverage assertion.');
    const instanceCount = instanced ? source.instanceIndices?.length ?? im.count : 1;
    if (counters.instances + instanceCount > caps.instances) return fail('cap', 'Instance cap exceeded.');
    const selected = new Set<number>();
    for (let selection = 0; selection < instanceCount; selection++) {
      counters.instances++;
      const instanceIndex = instanced ? source.instanceIndices?.[selection] ?? selection : null;
      if (instanceIndex !== null && (!Number.isSafeInteger(instanceIndex) || instanceIndex < 0 || instanceIndex >= im.count || selected.has(instanceIndex))) return fail('invalid', 'Invalid or duplicate selected instance.');
      if (instanceIndex !== null) selected.add(instanceIndex);
      const instanceMatrix = instanceIndex === null ? null : new Matrix4();
      if (instanceMatrix && instanceIndex !== null) im.getMatrixAt(instanceIndex, instanceMatrix);
      const world = mesh.matrixWorld.clone();
      if (instanceMatrix) world.multiply(instanceMatrix);
      if (!world.elements.every(Number.isFinite)) return fail('nonfinite', 'Committed source transform is nonfinite.');
      if (world.elements[3] !== 0 || world.elements[7] !== 0 || world.elements[11] !== 0 || world.elements[15] !== 1) return fail('unsupported', 'Only affine committed transforms are supported.');
      const box = localBounds.clone().applyMatrix4(world);
      if (![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) return fail('nonfinite', 'World bounds are nonfinite.');
      if (!overlaps(box)) { counters.rejectedBounds++; continue; }
      const objectIndex = objects.length;
      objects.push({ sourceName: source.name, meshUuid: mesh.uuid, geometryUuid: geometry.uuid,
        positionVersion: 'version' in position ? position.version : position.data.version,
        indexVersion: index?.version ?? null, instanceMatrixVersion: instanced ? im.instanceMatrix.version : null,
        instanceIndex, worldMatrix: mesh.matrixWorld.elements.slice(), instanceMatrix: instanceMatrix?.elements.slice() ?? null,
        ...(source.retainWholeObject ? { faceSelection: 'whole-intersecting-object' as const }
          : source.retainIntersectingComponents ? { faceSelection: 'connected-patch-components' as const } : {}),
        drawRange: { ...draw }, groups });
      const pending: { face: Vector3[]; triangle: RiverBankTerrainTriangle; touches: boolean }[] = [];
      // Three uses groups only for a material array. Preserve each actual draw call,
      // including overlapping groups, instead of inventing a single merged range.
      const calls = Array.isArray(mesh.material) ? groups.map((g, groupIndex) => ({ ...g, groupIndex })) : [{ start: 0, count: total, materialIndex: 0, groupIndex: null }];
      for (const call of calls) {
        const material = materials[call.materialIndex];
        if (!material) return fail('incomplete', 'Material group refers to a missing material.');
        if (!material.visible) return fail('incomplete', 'A solid source material is hidden.');
        const start = Math.max(draw.start, call.start);
        const end = Math.min(total, draw.start + draw.count, call.start + call.count);
        for (let element = start; element + 2 < end; element += 3) {
          if (++counters.scannedTriangles > caps.scannedTriangles) return fail('cap', 'Scanned triangle cap exceeded.');
          const face: Vector3[] = [];
          const faceBounds = new Box3();
          for (let corner = 0; corner < 3; corner++) {
            const vertexIndex = index ? index.getX(element + corner) : element + corner;
            if (!Number.isSafeInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= position.count) return fail('invalid', 'Drawn triangle index is outside its position attribute.');
            const point = new Vector3().fromBufferAttribute(position, vertexIndex).applyMatrix4(world);
            if (!point.toArray().every(Number.isFinite)) return fail('nonfinite', 'World triangle is nonfinite.');
            face.push(point); faceBounds.expandByPoint(point);
          }
          // Whole-object inspection keeps the back and underside too. Ordinary
          // ground/patch capture retains its original face-overlap behavior.
          if (source.retainIntersectingComponents) {
            pending.push({ face, touches: overlaps(faceBounds), triangle: { objectIndex, elementStart: element,
              groupIndex: call.groupIndex, materialIndex: call.materialIndex, materialUuid: material.uuid, materialSide: material.side } });
            continue;
          }
          if (!source.retainWholeObject && !overlaps(faceBounds)) continue;
          if (++counters.outputTriangles > caps.outputTriangles) return fail('cap', 'Output triangle cap exceeded.');
          for (const point of face) { coords.push(point.x, point.y, point.z); outputBounds.expandByPoint(point); }
          triangles.push({ objectIndex, elementStart: element, groupIndex: call.groupIndex,
            materialIndex: call.materialIndex, materialUuid: material.uuid, materialSide: material.side });
        }
      }
      if (source.retainIntersectingComponents) {
        // Exact copied positions join seams without welding nearby but separate
        // rocks. This is component selection, not a manifold/solid certificate.
        // All work remains under the existing scanned/output triangle ceilings.
        const parent = pending.map((_, i) => i);
        const find = (index: number): number => {
          let root = index;
          while (parent[root] !== root) root = parent[root];
          while (parent[index] !== index) { const next = parent[index]; parent[index] = root; index = next; }
          return root;
        };
        const seen = new Map<string, number>();
        for (let i = 0; i < pending.length; i++) for (const point of pending[i].face) {
          const key = `${point.x},${point.y},${point.z}`;
          const other = seen.get(key);
          if (other !== undefined) parent[find(i)] = find(other);
          else seen.set(key, i);
        }
        const retained = new Set(pending.flatMap((face, i) => face.touches ? [find(i)] : []));
        for (let i = 0; i < pending.length; i++) {
          if (!retained.has(find(i))) continue;
          if (++counters.outputTriangles > caps.outputTriangles) return fail('cap', 'Output triangle cap exceeded.');
          for (const point of pending[i].face) { coords.push(point.x, point.y, point.z); outputBounds.expandByPoint(point); }
          triangles.push(pending[i].triangle);
        }
      }
    }
  }
  const vertices = new Float64Array(coords);
  const metadata = JSON.stringify({ patch: p, consistencyToken: input.consistencyToken, objects, triangles });
  return { ok: true, snapshot: { vertices, triangles, objects, identity: contentIdentity(metadata, vertices),
    consistencyToken: input.consistencyToken, patch: { ...p },
    bounds: outputBounds.isEmpty() ? null : { min: outputBounds.min.toArray(), max: outputBounds.max.toArray() },
    counters: { ...counters }, limitations: [...LIMITATIONS] } };
}
