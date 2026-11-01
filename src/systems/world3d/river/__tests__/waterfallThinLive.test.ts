import { describe, expect, it } from 'vitest';
import { WaterfallThinDynamics, type ThinSnapshot } from '../waterfallThinDynamics';

const inlet = { q: 1.5, width: 10, depth: .7, speed: 1.5 / 7, top: 76,
  verticalSpeed: -Math.sqrt(4 * 9.81), forward: .14, turbulence: 0 };
const create = () => new WaterfallThinDynamics({ crest: 76, pool: 19, across: 8,
  dt: .01, emissionStep: .04, mode: 'fixed-air', conservativeAdmission: true });
function horizontalMomentum(snapshot: ThinSnapshot) {
  const nodes = new Map(snapshot.vertices.map(v => [v.id, v]));
  return snapshot.patches.reduce((sum, face) => sum + face.volume * 1000 / 3 * face.vertices.reduce((s, id) => s + nodes.get(id)!.velocity[0], 0), 0);
}
describe('live detached material comparison', () => {
  it('carries the full pulse, moves existing vertices, then drains without recycled water', () => {
    const model = create(); model.recordSource(0, inlet); model.recordSource(4, { ...inlet, q: 0 });
    model.advanceTo(.4); const first = model.snapshot();
    const carried = first.vertices.find(v => first.patches.some(p => p.vertices.includes(v.id)))!;
    model.advanceTo(.8);
    expect(model.snapshot().vertices.find(v => v.id === carried.id)!.position[1]).toBeLessThan(carried.position[1]);
    model.advanceTo(4.1); expect(model.receipt().emittedVolume).toBeCloseTo(6, 10);
    expect(model.receipt().airborneVolume).toBeGreaterThan(0);
    model.advanceTo(10);
    expect(model.receipt().airborneVolume).toBe(0);
    expect(model.receipt().landedVolume).toBeCloseTo(6, 10);
    expect(model.receipt().budgetError).toBeCloseTo(0, 10);
    expect(model.receipt().failure).toBeNull();
    expect(model.snapshot().patches).toEqual([]);
  });
  it('does not create horizontal momentum when adding mass to a shared row', () => {
    const model = create(); model.recordSource(0, inlet); model.advanceTo(1);
    const receipt = model.receipt();
    expect(horizontalMomentum(model.snapshot())).toBeCloseTo(receipt.admissionMomentum[0], 8);
    expect(receipt.admissionMomentum[0]).toBeCloseTo(1000 * 1.5 * inlet.speed, 8);
    expect(receipt.admissionMixingLoss).toBeGreaterThanOrEqual(-1e-8);
  });
  it('does not connect material across a source-off interval', () => {
    const model = create(); model.recordSource(0, inlet); model.recordSource(.4, { ...inlet, q: 0 });
    model.recordSource(.8, inlet); model.advanceTo(.7);
    const ids = new Set(model.snapshot().patches.flatMap(p => p.vertices));
    model.advanceTo(1);
    for (const face of model.snapshot().patches) {
      const overlap = face.vertices.filter(id => ids.has(id)).length;
      expect(overlap === 0 || overlap === 3).toBe(true);
    }
  });
});
