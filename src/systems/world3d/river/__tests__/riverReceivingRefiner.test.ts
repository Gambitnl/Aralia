import { describe, expect, it } from 'vitest';
import type { RiverReachData } from '../riverWorker';
import { toHalfArray } from '../riverWaterSheet';
import { RiverSurfaceMirror } from '@/components/World3D/water/riverSurfaceMirror';
import { riverStandingGeometryFrom } from '@/components/World3D/water/riverWaterMaterial';
import { RiverReceivingRefiner, preparedReceivingGeometry, receivingSheetMatches, receivingSheetTransfer } from '@/components/World3D/water/riverReceivingRefiner';

function fixture() {
  const grid = { nx: 4, nz: 4, dx: 1, x0: 0, z0: 0 };
  const t0 = new Float32Array(64), t1 = new Float32Array(64), t2 = new Float32Array(64);
  for (let k = 0; k < 16; k++) { t0[k * 4] = 2.6; t0[k * 4 + 2] = 0.15; t2[k * 4 + 2] = 1; }
  const surface = new Float32Array(16).fill(0.1);
  const mask = new Uint8Array(64); for (let k = 0; k < 16; k++) mask[k * 4] = mask[k * 4 + 3] = 255;
  const sheet = { pos: new Float32Array([1,0.1,1, 2,0.1,1, 1,0.1,2, 2,0.1,2]),
    nor: new Float32Array([0,1,0, 0,1,0, 0,1,0, 0,1,0]), index: new Uint32Array([0,2,1, 1,2,3]) };
  const snapshot = { t0h: toHalfArray(t0), t1h: toHalfArray(t1), t2h: toHalfArray(t2), surface, sheet };
  return { grid, mask, snapshot, data: { grid, t0, t1, t2, surface } as RiverReachData };
}

describe('native receiving refinement worker payload', () => {
  it('preserves the existing view path exactly, including shared-edge topology and owned faces', () => {
    const f = fixture();
    const mirror = new RiverSurfaceMirror(f.data); mirror.setMainRapidsMorphology(f.mask, true);
    mirror.setFlowHalf(f.snapshot.t0h, f.snapshot.t1h, f.snapshot.t2h, f.snapshot.surface);
    const baseline = riverStandingGeometryFrom(f.snapshot.sheet,
      (x,z) => mirror.mainRapidsShare(x,z), (x,z) => mirror.broadStandingHeightAt(x,z),
      (x,z) => mirror.broadStandingHeightAt(x,z,true), mirror.mainRapidsBounds);
    const prepared = new RiverReceivingRefiner(f.grid, f.mask, 3, 'viewA').refine(f.snapshot);
    expect(prepared.standingStats.addedTriangles).toBeGreaterThan(0);
    expect(prepared.sheet.pos).toEqual(baseline.getAttribute('position').array);
    expect(prepared.sheet.nor).toEqual(baseline.getAttribute('normal').array);
    expect(prepared.sheet.index).toEqual(baseline.getIndex()!.array);
    expect(prepared.mainStandingTriangles).toEqual(baseline.userData.mainStandingTriangles);
    const result = preparedReceivingGeometry(prepared);
    expect(result.boundingBox).toEqual(baseline.boundingBox); expect(result.boundingSphere).toEqual(baseline.boundingSphere);
    expect(result.userData.mainStandingTriangles).toBe(prepared.mainStandingTriangles);
    result.dispose(); baseline.dispose();
  });

  it('owns its mask and rejects stale or disabled optical configurations', () => {
    const f = fixture(); const refiner = new RiverReceivingRefiner(f.grid, f.mask, 7, 'viewA'); f.mask.fill(0);
    const prepared = refiner.refine(f.snapshot); expect(prepared.mainStandingTriangles.length).toBeGreaterThan(0);
    expect(receivingSheetMatches(prepared,7,true,'viewA')).toBe(true);
    expect(receivingSheetMatches(prepared,8,true,'viewA')).toBe(false);
    expect(receivingSheetMatches(prepared,7,false,'viewA')).toBe(false);
    expect(receivingSheetMatches(undefined,7,true,'viewA')).toBe(false);
    expect(() => new RiverReceivingRefiner(f.grid,new Uint8Array(4),1,'viewA')).toThrow('mask/version');
  });

  it('transfers refinement output without detaching the mapper field or original sheet', () => {
    const f = fixture(); const prepared = new RiverReceivingRefiner(f.grid,f.mask,1,'viewA').refine(f.snapshot);
    const transfers = receivingSheetTransfer(prepared); expect(new Set(transfers).size).toBe(4);
    const sent = structuredClone(prepared,{transfer:transfers});
    expect(prepared.sheet.pos.byteLength).toBe(0); expect(sent.sheet.pos.length).toBeGreaterThan(12);
    expect(f.snapshot.sheet.pos.byteLength).toBe(48); expect(f.snapshot.t0h.byteLength).toBe(128);
    expect(f.snapshot.surface.byteLength).toBe(64);
  });
});

describe('receiving configuration identity', () => {
  it('rejects replacement-view and disable/re-enable work even at the same mask version', () => {
    const f = fixture();
    const old = new RiverReceivingRefiner(f.grid, f.mask, 1, 'viewA-on').refine(f.snapshot);
    expect(receivingSheetMatches(old, 1, true, 'viewA-on')).toBe(true);
    expect(receivingSheetMatches(old, 1, true, 'viewB-on')).toBe(false);
    expect(receivingSheetMatches(old, 1, false, 'viewA-off')).toBe(false);
    expect(receivingSheetMatches(old, 1, true, 'viewA-reenabled')).toBe(false);
    const replacement = new RiverReceivingRefiner(f.grid, new Uint8Array(64), 1, 'viewB-on').refine(f.snapshot);
    expect(replacement.mainStandingTriangles).toHaveLength(0);
    expect(receivingSheetMatches(replacement, 1, true, 'viewB-on')).toBe(true);
  });
});
