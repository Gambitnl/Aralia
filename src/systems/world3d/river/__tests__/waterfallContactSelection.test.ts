/** Direct contact selection must retain terrain order at ties and choose the
 * first physical crossing, even when a farther surface is listed earlier. */
import { describe, expect, it } from 'vitest';
import { WaterfallContactFlow, type ContactSurface } from '../waterfallContactFlow';
const dt = 1 / 120;
const off = { q: 0, width: 10, depth: .7, speed: 1.5 / 7, top: 78, pool: 18 };
function flat(id: string, y: number, x = -1): ContactSurface {
  return { id, normal: [0, 1, 0], vertices: [[x, y, -1], [x + 2, y, -1], [x + 2, y, 1], [x, y, 1]] };
}
function contact(faces: ContactSurface[]) {
  // The first (Film-owned) face lies outside this collision fixture. The owned
  // parcel below tests ordinary solid contact, not a synthetic source inflow.
  const flow = new WaterfallContactFlow({ startTime: 0, dt, surfaces: [flat('film-away', 75, 100), ...faces] });
  flow.advanceTo(dt, () => off);
  const state = flow.saveState();
  state.snapshot.parcels = [{ id: 0, birth: 0, position: [0, 70, 0], velocity: [0, -2000, 0], volume: .125, contactCount: 0, contactEnergy: 0 }];
  state.snapshot.receipt.emittedVolume = .125; state.nextId = 1;
  flow.restoreState(state); flow.advanceTo(2 * dt, () => off);
  expect(flow.failureReason).toBeNull();
  expect(flow.totalOwnedVolume).toBe(.125);
  const snap = flow.snapshot();
  expect(snap.receipt.landedVolume).toBe(0);
  expect(snap.parcels).toHaveLength(1);
  expect(snap.parcels[0].velocity[1]).toBe(0);
  return snap;
}
describe('earliest ordinary contact selection', () => {
  it.each([['a', 'b'], ['b', 'a']])('keeps first terrain face %s on an exact tie with %s', (first, second) => {
    const result = contact([flat(first, 64), flat(second, 64)]);
    expect(result.receipt.surfaceContactCounts).toEqual({ [first]: 1 });
    expect(result.parcels[0].position[1]).toBe(64 + 1e-8);
  });
  it('selects the nearer physical crossing when it occurs later in terrain order', () => {
    const result = contact([flat('far', 62), flat('near', 64)]);
    expect(result.receipt.surfaceContactCounts).toEqual({ near: 1 });
    expect(result.parcels[0].position[1]).toBe(64 + 1e-8);
  });
});
