/** Focused CPU proof for bounded copies; this does not capture a running river scene. */
import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { captureRiverBankTerrainSnapshot, type RiverBankTerrainCaptureInput, type RiverBankTerrainSnapshot } from '../riverBankTerrainSnapshot';

function geometry(indexed = false) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 1,
    10, 0, 10, 11, 0, 10, 10, 1, 11,
  ], 3));
  if (indexed) g.setIndex([2, 1, 0, 3, 4, 5]);
  return g;
}
function input(mesh: Mesh = new Mesh(geometry(), new MeshBasicMaterial())): RiverBankTerrainCaptureInput {
  return { sources: [{ name: 'ground', mesh }], patch: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 }, inputsComplete: true, consistencyToken: 'committed-frame-1' };
}
function snapshot(value: RiverBankTerrainCaptureInput): RiverBankTerrainSnapshot {
  const result = captureRiverBankTerrainSnapshot(value);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.snapshot;
}
describe('captureRiverBankTerrainSnapshot', () => {
  it('selects a whole connected rock from a merged draw without retaining a distant rock', () => {
    const first = new BoxGeometry(2, 2, 2).toNonIndexed();
    const second = new BoxGeometry(2, 2, 2).toNonIndexed();
    second.translate(10, 0, 0);
    const merged = new BufferGeometry();
    merged.setAttribute('position', new Float32BufferAttribute([
      ...first.getAttribute('position').array, ...second.getAttribute('position').array,
    ], 3));
    const value = input(new Mesh(merged, new MeshBasicMaterial()));
    value.patch = { minX: -1.1, maxX: -0.9, minZ: -0.1, maxZ: 0.1 };
    value.sources[0].retainIntersectingComponents = true;
    value.caps = { outputTriangles: 12 };
    const selected = snapshot(value);
    expect(selected.triangles).toHaveLength(12);
    expect(selected.counters.scannedTriangles).toBe(24);
    expect(selected.bounds?.max[0]).toBe(1);
    expect(selected.objects[0].faceSelection).toBe('connected-patch-components');
    value.sources[0].retainWholeObject = true;
    expect(captureRiverBankTerrainSnapshot(value)).toMatchObject({ ok: false, code: 'invalid' });
    value.sources[0].retainWholeObject = undefined;
    value.caps = { outputTriangles: 11 };
    expect(captureRiverBankTerrainSnapshot(value)).toMatchObject({ ok: false, code: 'cap' });
  });
  it('retains a whole intersecting box, including outside faces needed to close its solid', () => {
    const value = input(new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial()));
    value.patch = { minX: -1.1, maxX: -0.9, minZ: -0.1, maxZ: 0.1 };
    const patch = snapshot(value);
    value.sources[0].retainWholeObject = true;
    const full = snapshot(value);
    expect(patch.triangles.length).toBeLessThan(12);
    expect(full.triangles).toHaveLength(12);
    expect(full.objects[0].faceSelection).toBe('whole-intersecting-object');
    expect(patch.objects[0].faceSelection).toBeUndefined();
    // Weld by actual copied positions for this exact box. Each oriented edge
    // must have exactly one opposite partner; patch-selected faces fail this.
    const edgeBalance = (s: RiverBankTerrainSnapshot) => {
      const edges = new Map<string, number>();
      for (let i = 0; i < s.vertices.length; i += 9) {
        const p = [0, 3, 6].map(k => [...s.vertices.slice(i + k, i + k + 3)].join(','));
        for (let k = 0; k < 3; k++) {
          const a = p[k], b = p[(k + 1) % 3];
          const key = a < b ? a + '/' + b : b + '/' + a;
          edges.set(key, (edges.get(key) ?? 0) + (a < b ? 1 : -1));
        }
      }
      return [...edges.values()].every(n => n === 0);
    };
    expect(edgeBalance(full)).toBe(true);
    expect(edgeBalance(patch)).toBe(false);
    expect(full.identity).not.toBe(patch.identity);
    expect(snapshot({ ...value, sources: [{ ...value.sources[0], retainWholeObject: undefined }] }).vertices).toEqual(patch.vertices);
  });
  it('keeps whole-object selection per instance and still refuses partial output at its cap', () => {
    const mesh = new InstancedMesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial(), 2);
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(0, 2, 0));
    mesh.setMatrixAt(1, new Matrix4().makeTranslation(100, 0, 100));
    const value = input(mesh);
    value.sources[0].retainWholeObject = true;
    value.patch = { minX: -1.1, maxX: -0.9, minZ: -0.1, maxZ: 0.1 };
    const s = snapshot(value);
    expect(s.triangles).toHaveLength(12);
    expect(s.objects).toHaveLength(1);
    expect(s.objects[0].instanceIndex).toBe(0);
    expect(s.counters.rejectedBounds).toBe(1);
    value.caps = { outputTriangles: 11 };
    expect(captureRiverBankTerrainSnapshot(value)).toMatchObject({ ok: false, code: 'cap' });
    expect(captureRiverBankTerrainSnapshot(value)).not.toHaveProperty('snapshot');
  });
  it('preserves draw-range omissions instead of claiming whole-object mode repairs missing rock faces', () => {
    const value = input(new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial()));
    value.sources[0].retainWholeObject = true;
    value.sources[0].mesh.geometry.setDrawRange(0, 3);
    const s = snapshot(value);
    expect(s.triangles).toHaveLength(1);
    expect(s.objects[0].drawRange).toEqual({ start: 0, count: 3 });
    expect(s.limitations.join(' ')).toContain('cross-tile closure');
  });
  it('copies indexed world triangles with committed transforms, provenance and stable identity', () => {
    const mesh = new Mesh(geometry(true), new MeshBasicMaterial());
    mesh.matrixWorld.makeTranslation(36, 2, 22);
    const value = input(mesh);
    value.patch = { minX: 36, maxX: 38, minZ: 22, maxZ: 24 };
    const s = snapshot(value);
    expect([...s.vertices]).toEqual([36, 3, 23, 37, 2, 22, 36, 2, 22]);
    expect(s.triangles).toHaveLength(1);
    expect(s.objects[0]).toMatchObject({ geometryUuid: mesh.geometry.uuid, instanceIndex: null, drawRange: { start: 0, count: Infinity } });
    expect(s.identity).toBe(snapshot(value).identity);
    mesh.geometry.getAttribute('position').setX(0, 0.25);
    expect(snapshot(value).identity).not.toBe(s.identity);
  });
  it('honors draw ranges and actual material-array groups', () => {
    const g = geometry(true);
    g.addGroup(0, 3, 1); g.addGroup(3, 3, 0);
    const mesh = new Mesh(g, [new MeshBasicMaterial(), new MeshBasicMaterial()]);
    const value = input(mesh);
    value.patch = { minX: 0, maxX: 12, minZ: 0, maxZ: 12 };
    g.setDrawRange(3, 3);
    const s = snapshot(value);
    expect(s.triangles).toMatchObject([{ groupIndex: 1, materialIndex: 0, elementStart: 3 }]);
    expect([...s.vertices]).toEqual([10, 0, 10, 11, 0, 10, 10, 1, 11]);
    g.setDrawRange(0, 3);
    expect(snapshot(value).triangles[0].materialIndex).toBe(1);
  });
  it('captures instanced small stones and rejects outside instances before triangle work', () => {
    const mesh = new InstancedMesh(geometry(), new MeshBasicMaterial(), 2);
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(100, 0, 100));
    mesh.setMatrixAt(1, new Matrix4().makeTranslation(36, 0, 22));
    mesh.matrixWorld.makeTranslation(0, 2, 0);
    const value = input(mesh);
    value.sources[0].name = 'small stones';
    value.patch = { minX: 36, maxX: 38, minZ: 22, maxZ: 24 };
    const s = snapshot(value);
    expect(s.counters).toMatchObject({ instances: 2, rejectedBounds: 1, scannedTriangles: 2, outputTriangles: 1 });
    expect(s.objects[0].instanceIndex).toBe(1);
    expect([...s.vertices]).toEqual([36, 2, 22, 37, 2, 22, 36, 3, 23]);
    value.sources[0].instanceIndices = [1];
    expect(captureRiverBankTerrainSnapshot(value)).toMatchObject({ ok: false, code: 'incomplete' });
    value.sources[0].selectedInstancesCoverPatch = true;
    expect(snapshot(value).vertices).toEqual(s.vertices);
  });
  it('keeps source geometry and matrices unchanged and copies all returned data', () => {
    const value = input();
    const mesh = value.sources[0].mesh;
    const before = mesh.geometry.getAttribute('position').array.slice();
    const matrix = mesh.matrixWorld.elements.slice();
    const s = snapshot(value);
    expect(mesh.geometry.boundingBox).toBeNull();
    expect(mesh.geometry.getAttribute('position').array).toEqual(before);
    expect(mesh.matrixWorld.elements).toEqual(matrix);
    mesh.geometry.getAttribute('position').setY(0, 99);
    mesh.matrixWorld.elements[12] = 99;
    mesh.geometry.setDrawRange(3, 3);
    value.patch.minX = 99;
    expect(s.vertices[1]).toBe(0);
    expect(s.objects[0].worldMatrix[12]).toBe(0);
    expect(s.objects[0].drawRange.start).toBe(0);
    expect(s.patch.minX).toBe(0);
  });
  it('retains vertical and boundary-touching triangles without claiming a top envelope', () => {
    const value = input();
    value.sources[0].mesh.geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 3, 0, 0, 2, 1], 3));
    expect(snapshot(value).triangles).toHaveLength(1);
  });
  it('fails closed for incomplete input, unsupported deformation and nonfinite coordinates', () => {
    const value = input();
    value.inputsComplete = false;
    expect(captureRiverBankTerrainSnapshot(value)).toMatchObject({ ok: false, code: 'incomplete' });
    value.inputsComplete = true;
    const material = value.sources[0].mesh.material as MeshBasicMaterial;
    Object.defineProperty(material, 'positionNode', { value: {}, configurable: true });
    expect(captureRiverBankTerrainSnapshot(value)).toMatchObject({ ok: false, code: 'unsupported' });
    Object.defineProperty(material, 'positionNode', { value: null, configurable: true });
    value.sources[0].mesh.geometry.getAttribute('position').setX(4, NaN);
    expect(captureRiverBankTerrainSnapshot(value)).toMatchObject({ ok: false, code: 'nonfinite' });
  });
  it.each(['inputMeshes', 'instances', 'inputVertices', 'scannedTriangles', 'outputTriangles'] as const)('returns no partial data when %s exceeds its cap', (key) => {
    const value = input();
    value.patch = { minX: 0, maxX: 12, minZ: 0, maxZ: 12 };
    if (key === 'inputMeshes') value.sources = [...value.sources, { name: 'rock', mesh: new Mesh(geometry(), new MeshBasicMaterial()) }];
    if (key === 'instances') {
      const mesh = new InstancedMesh(geometry(), new MeshBasicMaterial(), 2);
      mesh.setMatrixAt(0, new Matrix4()); mesh.setMatrixAt(1, new Matrix4());
      value.sources = [{ name: 'stones', mesh }];
    }
    value.caps = { [key]: 1 };
    const result = captureRiverBankTerrainSnapshot(value);
    expect(result).toMatchObject({ ok: false, code: 'cap' });
    expect(result).not.toHaveProperty('snapshot');
  });
  it('rejects invalid indices, nonfinite matrices and morph inputs', () => {
    const value = input();
    const mesh = value.sources[0].mesh;
    mesh.geometry.setIndex([0, 1, 99]);
    expect(captureRiverBankTerrainSnapshot(value)).toMatchObject({ ok: false, code: 'invalid' });
    mesh.geometry.setIndex(null);
    mesh.matrixWorld.elements[12] = Infinity;
    expect(captureRiverBankTerrainSnapshot(value)).toMatchObject({ ok: false, code: 'nonfinite' });
    mesh.matrixWorld.identity();
    mesh.geometry.morphAttributes.position = [new Float32BufferAttribute([0, 0, 0], 3)];
    expect(captureRiverBankTerrainSnapshot(value)).toMatchObject({ ok: false, code: 'unsupported' });
  });
});
