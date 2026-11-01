/** CPU witnesses only: these tests never run the solver or render water. */
import { describe, expect, it } from 'vitest';
import { buildWaterSheetArrays } from '../riverWaterSheet';
import { inspectRiverQuad, type QuadSnapshotCertificate } from '../riverQuadInspection';
import { RiverReachView } from '@/components/World3D/water/riverReachScene';
import * as THREE from 'three/webgpu';
import type { RiverViewFlowSnapshot } from '@/components/World3D/water/riverReceivingRefiner';

const grid = { nx: 2, nz: 2, dx: 1, x0: 0, z0: 0 };
function fixture(surface: number[], ground: number[] = [0, 0, 0, 0]) {
  const S = Float32Array.from(surface);
  // The native sheet builder reads only these grid dimensions.
  const raw = buildWaterSheetArrays(grid, S);
  return { grid, surface: S, h: Float32Array.from([0.02, 0.02, 0.02, 0]), ground: Float32Array.from(ground), raw, installed: raw,
    certificate: null as QuadSnapshotCertificate | null };
}

describe('bounded native quad observation', () => {
  it('certifies only a completed application and invalidates certification when geometry changes', () => {
    const source = fixture([1, 1, 1, 1]);
    // Exercise the actual application/query methods with CPU-only dependencies.
    // Bypass the constructor because it creates a renderer, not part of this test.
    const view = Object.create(RiverReachView.prototype) as RiverReachView;
    const old = new THREE.BufferGeometry();
    const installed = new THREE.BufferGeometry();
    installed.setAttribute('position', new THREE.BufferAttribute(source.raw.pos, 3));
    installed.setIndex(new THREE.BufferAttribute(source.raw.index, 1));
    Object.assign(view, { data: { ...source }, waterfall: null, spillView: null,
      water: { geometry: old }, quadApplication: 0, quadInstalled: null,
      flowTex: Object.fromEntries(['flow0', 'flow1', 'flow2'].map(k => [k, { image: { data: null } }])),
      waterMat: { uniforms: { uPoolImpactEnergy: { value: new THREE.Vector4() }, uPoolRefractionEdge: { value: 0 } } },
      mirror: { setFlowHalf: () => {}, setPoolImpact: () => {} },
      receivingConfiguration: () => ({ maskVersion: 1, enabled: false, configId: 'test' }),
      prepareReceivingGeometry: (base: THREE.BufferGeometry) => { base.dispose(); return installed; } });
    // Only these snapshot fields are read on the no-waterfall/no-spill path.
    const snapshot = { ...source, sheet: source.raw, simTime: 7, qIn: 0,
      t0: new Float32Array(16), t0h: new Uint16Array(16), t1h: new Uint16Array(16), t2h: new Uint16Array(16) } as unknown as RiverViewFlowSnapshot;
    view.applyFlowSnapshot(snapshot);
    const applied = view.inspectQuad(1, 1);
    if (!applied.ok) throw new Error('Expected installed quad');
    expect(applied.installedSnapshot).toMatchObject({ simTime: 7, application: 1 });
    Object.assign(view, { waterfall: { setFlood: () => { throw new Error('application failed'); } } });
    expect(() => view.applyFlowSnapshot({ ...snapshot, simTime: 8 })).toThrow('application failed');
    const failed = view.inspectQuad(1, 1);
    if (!failed.ok) throw new Error('Expected prior quad');
    expect(failed.installedSnapshot?.simTime).toBe(7);
    Object.assign(view, { water: { geometry: installed.clone() } });
    const rebuilt = view.inspectQuad(1, 1);
    if (!rebuilt.ok) throw new Error('Expected rebuilt quad');
    expect(rebuilt.installedSnapshot).toBeNull(); expect(rebuilt.raw.available).toBe(false);
    installed.dispose();
  });
  it('retains a non-affine three-corner witness and its missing corner', () => {
    // Missing B changes the native water diagonal relative to the ordinary
    // terrain diagonal; preserve this exact established shallow witness.
    const source = fixture([0.02, NaN, 0.12, 0.02], [0, 0, 0.10, 0]);
    const result = inspectRiverQuad(source, 1, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cells.map(c => c.cellId)).toEqual([0, 1, 2, 3]);
    expect(result.cells[1]).toMatchObject({ surface: null, ground: 0, availability: { surface: false } });
    expect(result.raw.sourceVertexIds.map(id => [source.raw.pos[id * 3], source.raw.pos[id * 3 + 2]])).toEqual([[0.5, 0.5], [0.5, 1.5], [1.5, 1.5]]);
    expect(result.raw.triangleIndices).toHaveLength(3);
    expect(result.raw.vertices).toHaveLength(9);
    expect(result.bed).toBeNull(); expect(result.bedAvailable).toBe(false);
  });
  it.each([[1, 1, 1, 1], [1, 2, 2, 3]])('copies native all-wet flat/affine controls: %s', (...surface) => {
    const result = inspectRiverQuad(fixture(surface), 1, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.raw.triangleIndices).toHaveLength(6);
    expect(result.raw.vertices).toHaveLength(12);
    expect(result.cells.every(c => c.availability.surface)).toBe(true);
  });
  it.each([[NaN, 1], [Infinity, 1], [-1, 1], [2, 1], [0.25, 1], [1, 2]])('rejects invalid or outside quad coordinates %s,%s', (x, z) => {
    expect(inspectRiverQuad(fixture([1, 1, 1, 1]), x, z).ok).toBe(false);
  });
  it('returns copied arrays and certificates without altering native state', () => {
    const source = fixture([1, 1, 1, 1]);
    source.certificate = { simTime: 7, application: 1, kind: 'applyFlowSnapshot-returned-successfully' };
    const result = inspectRiverQuad(source, 1, 1);
    if (!result.ok) throw new Error('Expected quad');
    result.raw.vertices[0] = 99; result.installed.triangleIndices[0] = 99;
    result.cells[0].center[0] = 99; result.grid.dx = 99;
    if (result.installedSnapshot) result.installedSnapshot.simTime = 99;
    expect(source.raw.pos[0]).toBe(0.5); expect(source.raw.index[0]).not.toBe(99);
    expect(source.grid.dx).toBe(1); expect(source.certificate.simTime).toBe(7);
    expect(result.rendered.certified).toBe(false);
  });
  it('does not invent snapshot certification or unavailable raw geometry', () => {
    const source = fixture([1, 1, 1, 1]);
    const result = inspectRiverQuad({ ...source, raw: null }, 1, 1);
    if (!result.ok) throw new Error('Expected quad');
    expect(result.installedSnapshot).toBeNull(); expect(result.raw.available).toBe(false);
    expect(result.installed.available).toBe(true); expect(result.rendered.certified).toBe(false);
  });
  it('caps copied triangle output and states that its witness is truncated', () => {
    const source = fixture([1, 1, 1, 1]);
    source.raw.index = Uint32Array.from({ length: 600 }, (_, i) => source.raw.index[i % 6]);
    const result = inspectRiverQuad(source, 1, 1);
    if (!result.ok) throw new Error('Expected quad');
    expect(result.raw.triangleIndices).toHaveLength(128 * 3); expect(result.raw.truncated).toBe(true);
  });
});
