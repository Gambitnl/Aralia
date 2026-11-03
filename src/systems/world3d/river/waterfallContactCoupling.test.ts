/** Small native pool fixtures prove one-time transfer, source-off draining,
 * and retention when the real receiving water is unavailable. */
import { describe, expect, it } from 'vitest';
import { RiverFlowSolver } from './riverSolver';
import { LiveRiver, type ContactPoolSnapshot } from './riverLive';

function fixture(wet = true) {
  const grid = { x0: -2, z0: -40, dx: 1, nx: 70, nz: 80 };
  const count = grid.nx * grid.nz;
  const solver = new RiverFlowSolver({ grid, bed: new Float64Array(count).fill(17),
    manning: new Float32Array(count), dischargeM3S: 99, inflow: [], inflowDir: [1, 0], inflowSpeedMS: 0, outflowEdge: 'east' });
  solver.setState(new Float64Array(count).fill(wet ? 1 : 0));
  // Exercise production coupling with a deliberately small course/pool. Reach
  // construction is irrelevant to ownership, so this avoids a 450k-cell test.
  const river = Object.create(LiveRiver.prototype) as LiveRiver;
  Object.assign(river, { headwaters: true, grid, solver, simTime: 0,
    shape: { widthScale: 1, depthScale: 1, dischargeM3S: 1.5 },
    course: { at: () => ({ x: 0, z: 0, tx: 1, tz: 0 }) },
    contactFlow: null, contactRequested: false, contactPending: [],
    contactAcceptedVolume: 0, contactAcceptedMomentum: [0, 0, 0], contactDissipatedEnergy: 0,
    acc: { sh: new Float64Array(count), shu: new Float64Array(count), shv: new Float64Array(count), su2: new Float64Array(count) },
    contactArrivalRate: 0, sourceAt: (time: number) => time < 1 ? 1.5 : 0,
    refreshSpillFaces: () => {}, sourceHistory: { record: () => {} } });
  river.setContactWaterfall(true);
  const advance = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      (river as unknown as { advanceContact(dt: number): void }).advanceContact(1 / 60);
      river.simTime += 1 / 60;
      solver.time = river.simTime;
    }
  };
  const receipt = () => (river as unknown as { contactSnapshot(): ContactPoolSnapshot }).contactSnapshot();
  return { river, solver, advance, receipt };
}

describe('worker-owned contact water enters the native pool', () => {
  // Four tests below run the contact flow with a native pool. They took 60 s
  // to 162 s locally and about 90 s each in CI run 41551325235 (2026-11-03),
  // with every check passing; the 60 s project default failed them on time only.
  it('replaces legacy inflow, admits each arrival once, and drains after source-off', () => {
    const f = fixture(), initial = f.solver.volume();
    expect(f.solver.discharge).toBe(0);
    f.advance(1);
    const emitted = f.receipt().receipt.emittedVolume;
    expect(emitted).toBeCloseTo(1.5, 8);
    expect(f.solver.inVolume).toBe(0);
    f.advance(1);
    const onLedge = f.receipt();
    expect(onLedge.receipt.filmVolume).toBeGreaterThan(0);
    expect(onLedge.receipt.totalOwnedVolume).toBeCloseTo(onLedge.receipt.airborneVolume + onLedge.receipt.filmVolume, 12);
    expect(f.solver.volume() - initial + onLedge.receipt.totalOwnedVolume + onLedge.pool.pendingVolume).toBeCloseTo(emitted, 8);
    f.advance(38);
    const r = f.receipt();
    expect(r.receipt.emittedVolume).toBeCloseTo(emitted, 8);
    expect(r.receipt.airborneVolume).toBeCloseTo(0, 8);
    expect(r.pool.pendingVolume).toBe(0);
    expect(r.pool.acceptedVolume).toBeCloseTo(emitted, 8);
    expect(f.solver.inVolume).toBeCloseTo(emitted, 8);
    expect(f.solver.volume() - initial).toBeCloseTo(emitted, 8);
    expect(r.pool.dissipatedEnergy).toBeGreaterThan(0);
    const accepted = f.solver.inVolume;
    f.advance(2);
    expect(f.solver.inVolume).toBe(accepted);
  }, 240000);

  it('retains arrivals until a real wet receiver exists', () => {
    const f = fixture(false);
    f.advance(40);
    let r = f.receipt();
    expect(r.pool.pendingVolume).toBeCloseTo(r.receipt.emittedVolume, 8);
    expect(f.solver.inVolume).toBe(0);
    f.solver.setState(new Float64Array(f.solver.h.length).fill(1));
    f.advance(1 / 60);
    r = f.receipt();
    expect(r.pool.pendingVolume).toBe(0);
    expect(f.solver.inVolume).toBeCloseTo(r.receipt.emittedVolume, 8);
  }, 240000);

  it('converts momentum to the solver convention and rejects out-of-grid deposits', () => {
    const f = fixture(false);
    expect(f.solver.depositWater(-1, 2, [4, -8, 6])).toBe(false);
    expect(f.solver.inVolume).toBe(0);
    expect(f.solver.depositWater(25, 2, [4, -8, 6])).toBe(true);
    expect(f.solver.inVolume).toBe(2);
    expect(f.solver.wetMomentum()).toEqual([4, 0, 6]);
    expect(f.solver.h[25]).toBe(2);
  });

  it('rolls native time, transport, pending arrivals and admission ledger back together', () => {
    const f = fixture();
    f.advance(5); f.river.checkHealth();
    const before = f.receipt(), native = f.solver.inVolume, time = f.river.simTime;
    f.advance(3); f.solver.h[0] = Number.NaN;
    f.river.checkHealth();
    expect(f.river.simTime).toBe(time);
    expect(f.solver.time).toBe(time);
    expect(f.solver.inVolume).toBe(native);
    expect(f.receipt().receipt.time).toBe(before.receipt.time);
    expect(f.receipt().pool.acceptedVolume).toBe(before.pool.acceptedVolume);
    expect(f.receipt().pool.pendingVolume).toBe(before.pool.pendingVolume);
    f.advance(35);
    expect(f.solver.inVolume).toBeCloseTo(f.receipt().receipt.emittedVolume, 8);
  }, 240000);

  it('keeps film ownership and rolls back a failed native pool while draining modes', () => {
    const f = fixture();
    f.advance(1); f.river.checkHealth();
    f.river.setContactWaterfall(false);
    f.advance(39); f.solver.h[0] = Number.NaN;
    (f.river as unknown as { finishContactDrain(): void }).finishContactDrain();
    // The old parcel-only test could finish here. Film retains a numerical
    // tail, so the mode transition preserves ownership until it is exactly dry.
    expect(f.receipt().receipt.totalOwnedVolume).toBeGreaterThan(0);
    f.river.checkHealth();
    expect(f.river.simTime).toBeCloseTo(1, 8);
    expect(f.receipt().receipt.airborneVolume).toBeGreaterThan(0);
    expect(f.solver.discharge).toBe(0);
    f.advance(39);
    (f.river as unknown as { finishContactDrain(): void }).finishContactDrain();
    expect(f.receipt().receipt.totalOwnedVolume).toBeGreaterThan(0);
    expect(f.receipt().pool.requested).toBe(false);
    expect(f.solver.discharge).toBe(0);
    expect(f.solver.inVolume).toBeCloseTo(1.5, 8);
  }, 240000);

  it('wakes an eligible sleeping native receiver and includes its speed in the next CFL step', () => {
    const grid = { x0: 0, z0: 0, dx: 1, nx: 5, nz: 5 };
    const solver = new RiverFlowSolver({ grid, bed: new Float64Array(25), manning: new Float32Array(25),
      dischargeM3S: 0, inflow: [], inflowDir: [1, 0], inflowSpeedMS: 0, outflowEdge: 'east' }, new Float64Array(25).fill(-1));
    solver.enableWetFrontExpansion(new Uint8Array(25).fill(1));
    expect(solver.depositWater(12, 1, [20, -10, 0])).toBe(true);
    expect(solver.breachCells()).toBe(0);
    const step = solver.step();
    expect(step).toBeLessThan(0.025);
    expect(solver.h[11] + solver.h[13]).toBeGreaterThan(0);
    expect(solver.inVolume).toBe(1);
  });

  it('retains a film-only numerical tail when returning to the original mode', () => {
    const f = fixture();
    f.river.setContactWaterfall(false);
    const owner = (f.river as unknown as { contactFlow: { snapshot(): ContactPoolSnapshot } }).contactFlow;
    const snapshot = owner.snapshot();
    // An exact contract fixture isolates a tail with no airborne parcels.
    // This must remain owned regardless of how small its visible thickness is.
    Object.defineProperty(owner, 'totalOwnedVolume', { get: () => 1e-12 });
    owner.snapshot = () => ({ ...snapshot, receipt: { ...snapshot.receipt,
      airborneVolume: 0, filmVolume: 1e-12, totalOwnedVolume: 1e-12 } });
    (f.river as unknown as { finishContactDrain(): void }).finishContactDrain();
    expect(f.receipt().receipt.totalOwnedVolume).toBe(1e-12);
    expect(f.receipt().pool.requested).toBe(false);
    expect(f.solver.discharge).toBe(0);
  });
});
