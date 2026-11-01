/** Analytical crossings prove conservative sharing and all-or-nothing admission;
 * they do not establish a real contact trajectory or GPU integration. */
import { describe, expect, it } from 'vitest';
import { RiverFlowSolver } from '../riverSolver';
import { WATER_REACH_LAW } from '../waterfallMaterialReach';
import { buildMaterialReceiverStencil, MaterialReceiverAdapter, type ReceiverTriangle, type ReceiverShare, type ReceiverVertex } from '../waterfallMaterialReceiver';

const grid = { x0: 0, z0: 0, dx: 1, nx: 2, nz: 1 };
const triangle = (points: [number, number][], volume: number): ReceiverTriangle => {
  const vertex = ([x, z]: [number, number]): ReceiverVertex => ({ position: [x, 4, z], velocity: [x, -3, 2 * z] });
  return { sourceId: 'face:7:interval:2', volume, vertices: [vertex(points[0]), vertex(points[1]), vertex(points[2])] };
};
const rectangle = (x0: number, x1: number): ReceiverTriangle[] => [triangle([[x0, 0], [x1, 0], [x1, 1]], (x1 - x0) / 2), triangle([[x0, 0], [x1, 1], [x0, 1]], (x1 - x0) / 2)];
function solver(ceiling?: Float64Array) {
  return new RiverFlowSolver({ grid, bed: new Float64Array(2), manning: new Float32Array(2), dischargeM3S: 0,
    inflow: [], inflowDir: [1, 0], inflowSpeedMS: 0, outflowEdge: 'east' }, ceiling);
}
function sum(shares: ReceiverShare[]) {
  return { volume: shares.reduce((s, p) => s + p.volume, 0),
    momentum: [0, 1, 2].map(k => shares.reduce((s, p) => s + p.momentum[k], 0)),
    spatialMoment: [0, 1, 2].map(k => shares.reduce((s, p) => s + p.spatialMoment[k], 0)),
    energy: shares.reduce((s, p) => s + p.kineticEnergy, 0) };
}
describe('finite material receiver ownership', () => {
  it('clips a partial rectangle without moving outside water to hit cells', () => {
    const stencil = buildMaterialReceiverStencil(rectangle(-.5, 1.5), { grid, maxCells: 8, classifyCell: () => 'hit' });
    expect(sum(stencil.outside).volume).toBeCloseTo(.5, 12);
    expect(sum(stencil.hits.filter(h => h.c === 0)).volume).toBeCloseTo(1, 12);
    expect(sum(stencil.hits.filter(h => h.c === 1)).volume).toBeCloseTo(.5, 12);
    const total = sum([...stencil.hits, ...stencil.outside]);
    expect(total.volume).toBeCloseTo(2, 12);
    expect(total.momentum).toEqual(expect.arrayContaining([expect.closeTo(1, 12), expect.closeTo(-6, 12), expect.closeTo(2, 12)]));
    expect(total.spatialMoment[0]).toBeCloseTo(1, 12);
    expect(total.spatialMoment[1]).toBeCloseTo(8, 12);
    expect(total.spatialMoment[2]).toBeCloseTo(1, 12);
    expect(total.energy).toBeCloseTo(WATER_REACH_LAW.density * .5 * (7 / 6 + 18 + 8 / 3), 9);
    expect([...stencil.hits, ...stencil.outside].every(s => s.sourceId === 'face:7:interval:2')).toBe(true);
  });
  it('integrates a clipped triangle linear velocity analytically', () => {
    const stencil = buildMaterialReceiverStencil([triangle([[0, 0], [2, 0], [0, 1]], 1)], { grid, maxCells: 4, classifyCell: () => 'hit' });
    const right = sum(stencil.hits.filter(h => h.c === 1));
    expect(right.volume).toBeCloseTo(.25, 12);
    expect(right.momentum[0]).toBeCloseTo(1 / 3, 12);
    expect(right.spatialMoment[2]).toBeCloseTo(1 / 24, 12);
    expect(sum(stencil.hits).momentum[0]).toBeCloseTo(2 / 3, 12);
  });
  it('keeps rejected and bypass shares with their exact moments', () => {
    const a = buildMaterialReceiverStencil(rectangle(0, 2), { grid, maxCells: 8, classifyCell: c => c ? 'bypass' : 'ineligible' });
    expect(a.hits).toHaveLength(0);
    expect(sum(a.ineligible).volume).toBeCloseTo(1);
    expect(sum(a.bypass).momentum[0]).toBeCloseTo(1.5);
    expect(sum([...a.ineligible, ...a.bypass]).spatialMoment[0]).toBeCloseTo(2);
  });
  it('rejects an invalid later cell and overflowing resulting state without any write', () => {
    const s = solver();
    const hit = { c: 0, volume: 1, momentum: [1, -3, 2] as const };
    expect(s.depositWaterBatch([hit, { ...hit, c: 2 }])).toBe(false);
    expect(s.volume()).toBe(0); expect(s.inVolume).toBe(0);
    s.h[1] = Number.MAX_VALUE;
    expect(s.depositWaterBatch([hit, { ...hit, c: 1, volume: Number.MAX_VALUE }])).toBe(false);
    expect(s.h[0]).toBe(0); expect(s.inVolume).toBe(0);
  });
  it('combines repeated cells, acknowledges every hit once and rejects duplicates', () => {
    const s = solver(), adapter = new MaterialReceiverAdapter(s, 4);
    const stencil = adapter.prepare('cut:1', rectangle(0, 2), 8);
    // Returned previews cannot mutate the privately prepared transaction.
    stencil.hits[0].volume = 900;
    const receipt = adapter.commit('cut:1')!;
    expect(s.volume()).toBeCloseTo(2); expect(s.inVolume).toBeCloseTo(2);
    expect(s.wetMomentum()[0]).toBeCloseTo(2); expect(s.wetMomentum()[2]).toBeCloseTo(2);
    expect(receipt.verticalImpulse).toBeCloseTo(-6);
    expect(receipt.energyQualification).toBe('kinetic-mixing-and-surface-energy-unqualified');
    expect(() => adapter.commit('cut:1')).toThrow();
    expect(() => adapter.prepare('cut:1', rectangle(0, 2), 8)).toThrow();
    expect(s.volume()).toBeCloseTo(2);
  });
  it('retains ownership on rejected commit and capacity pressure; abort never deposits', () => {
    const s = solver(new Float64Array(2)), adapter = new MaterialReceiverAdapter(s, 1);
    expect(() => adapter.prepare('large', rectangle(0, 2), 1)).toThrow('capacity');
    expect(s.volume()).toBe(0);
    adapter.prepare('cut', rectangle(0, 2), 8, () => 'hit');
    expect(adapter.commit('cut')).toBeNull();
    expect(() => adapter.prepare('other', rectangle(0, 2), 8)).toThrow('capacity');
    expect(adapter.abort('cut')).toBe(true); expect(s.volume()).toBe(0);
    s.enableWetFrontExpansion(new Uint8Array([1, 1]));
    adapter.prepare('cut', rectangle(0, 2), 8);
    expect(adapter.commit('cut')).not.toBeNull(); expect(s.volume()).toBeCloseTo(2);
    expect(() => adapter.prepare('new', rectangle(0, 2), 8)).toThrow('capacity');
    expect(s.volume()).toBeCloseTo(2);
  });
  it('rejects nonhorizontal and degenerate supplied crossings', () => {
    const tilted = triangle([[0, 0], [1, 0], [0, 1]], 1);
    tilted.vertices[1].position = [1, 5, 0];
    expect(() => buildMaterialReceiverStencil([tilted], { grid, maxCells: 4, classifyCell: () => 'hit' })).toThrow('horizontal');
    expect(() => buildMaterialReceiverStencil([triangle([[0, 0], [1, 0], [2, 0]], 1)], { grid, maxCells: 4, classifyCell: () => 'hit' })).toThrow('Degenerate');
  });
});
