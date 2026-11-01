/** Two equal free-falling water volumes must interact, rather than pass
 * through one another as independent ballistic packets. Measurements of
 * density and occupied space below are independent of the solver's ledger. */
import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { WaterfallCrestLiquid, type CrestParticle, type CrestSnapshot } from '../waterfallCrestLiquid';

// Diagnostic export is explicitly requested by the local gate runner. Normal
// regression runs leave no runtime files in a clone or CI checkout.
const output = process.env.ARALIA_LIQUID_BEHAVIOR_PROOF;
function report(name: string, data: unknown): void {
  if (output) { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/${name}.json`, JSON.stringify(data, null, 2)); }
}
function control(refined = false, particlesPerCellAxis = 2) {
  return new WaterfallCrestLiquid(refined
    ? { crest: 0, cellSize: .05, cells: [44, 36, 24], origin: [-.2, -2.2, -.6],
      lipX: 0, inletX: -.1, channelDepth: .7, channelWidth: 1, outletX: 1.9, outletY: -2,
      dt: .0025, transport: 'flux-cell', pressureSurface: 'volume-kernel', surfaceSupport: .1, particlesPerCellAxis: 1 }
    : { crest: 0, cellSize: .1, cells: [28, 36, 20], origin: [-.4, -3, -1],
      lipX: 0, inletX: -.2, channelDepth: .7, channelWidth: 1, outletX: 2.2, outletY: -2.8,
      dt: .0025, transport: 'flux-cell', pressureSurface: 'volume-kernel', surfaceSupport: .1, particlesPerCellAxis });
}
function measurements(snapshot: CrestSnapshot) {
  const particles = snapshot.particles, time = snapshot.receipt.time;
  const sources = ['left', 'right'].map(sourceId => {
    const ps = particles.filter(p => p.sourceId === sourceId), volume = ps.reduce((s, p) => s + p.volume, 0);
    const average = (values: (p: CrestParticle) => number) => ps.reduce((s, p) => s + p.volume * values(p), 0) / volume;
    return { sourceId, particles: ps.length, volume, centerX: average(p => p.position[0]), vx: average(p => p.velocity[0]),
      lateralSpeed: average(p => Math.hypot(p.velocity[1] + 9.81 * time, p.velocity[2])),
      bounds: [0, 1, 2].map(axis => [Math.min(...ps.map(p => p.position[axis] + (axis === 1 ? .5 * 9.81 * time ** 2 : 0))),
        Math.max(...ps.map(p => p.position[axis] + (axis === 1 ? .5 * 9.81 * time ** 2 : 0)))]),
      oldestBirth: Math.min(...ps.map(p => p.birth)), newestBirth: Math.max(...ps.map(p => p.birth)) };
  });
  // A fixed physical sphere measures local volume density directly from
  // material positions. It does not read pressure cells or deposited density.
  const radius = .1, sphereVolume = 4 * Math.PI * radius ** 3 / 3;
  const localDensities = particles.map(p => {
    let volume = 0;
    for (const q of particles) {
      const x = p.position[0] - q.position[0], y = p.position[1] - q.position[1], z = p.position[2] - q.position[2];
      if (x * x + y * y + z * z <= (radius + 1e-12) ** 2) volume += q.volume;
    }
    return volume / sphereVolume;
  });
  // Independent occupied voxels at two offsets disclose sampling sensitivity.
  const occupied = [0, .025].map(offset => {
    const cells = new Set(particles.map(p => p.position.map((v, axis) => Math.floor((v + offset + (axis === 1 ? .5 * 9.81 * time ** 2 : 0)) / .05 + 1e-9)).join(':')));
    return cells.size * .05 ** 3;
  });
  const signedMomentum = [0, 1, 2].map(axis => particles.reduce((s, p) => s + 1000 * p.volume * (p.velocity[axis] + (axis === 1 ? 9.81 * time : 0)), 0));
  return { time, sources, maxLocalDensity: Math.max(...localDensities), occupiedVolume: occupied,
    pressureMax: Math.max(...snapshot.pressure), pressureMin: Math.min(...snapshot.pressure),
    signedMomentum,
    // These isolated controls touch no source, solids, or exits. Pressure and
    // its numerical support extensions must not manufacture a net impulse.
    // Closing a ledger by counting that manufactured impulse is insufficient.
    isolatedExternalForceOnlyResidual: signedMomentum.map((p, axis) => p - snapshot.receipt.initialMomentum[axis]),
    // Neutral projection diagnostics: pressure can include real boundary
    // forces in other scenes. This gate independently proves there were no
    // such contacts before interpreting its net horizontal impulse as error.
    summedPressureAndExtensionImpulse: [0, 1, 2].map(axis => snapshot.receipt.pressureImpulse[axis]
      + snapshot.receipt.pressureExtensionImpulse[axis] + snapshot.receipt.solenoidalExtensionImpulse[axis]),
    projectionImpulseBreakdown: { pressure: snapshot.receipt.pressureImpulse,
      pressureExtension: snapshot.receipt.pressureExtensionImpulse, solenoidalExtension: snapshot.receipt.solenoidalExtensionImpulse,
      transfer: snapshot.receipt.transferMomentumError, bookkeepingClosure: snapshot.receipt.momentumBudgetError },
    residentVolume: particles.reduce((s, p) => s + p.volume, 0), receipt: snapshot.receipt };
}

describe('interacting liquid behavior in free fall', () => {
  it('redirects opposing water while retaining density and source histories', () => {
    const liquid = control();
    liquid.seedBox([.4, -1.2, -.2], [.8, -.8, .2], [1, 0, 0], 'left');
    liquid.seedBox([1, -1.2, -.2], [1.4, -.8, .2], [-1, 0, 0], 'right');
    const samples: ReturnType<typeof measurements>[] = [], initial = liquid.snapshot().particles;
    let failure: string | null = null;
    try {
      for (const time of [0, .075, .1, .2, .3]) { liquid.advanceTo(time); samples.push(measurements(liquid.snapshot())); }
    } catch (error) { failure = String(error); samples.push(measurements(liquid.snapshot())); }
    const ballistic = samples.map(s => ({ time: s.time,
      centerX: [.6 + s.time, 1.2 - s.time], vx: [1, -1],
      overlapDepth: Math.max(0, Math.min(.8 + s.time, 1.4 - s.time) - Math.max(.4 + s.time, 1 - s.time)),
      // Exact independent translation leaves each box's 0.064 m3 unchanged.
      individualVolume: .064, totalVolume: .128 }));
    report('opposing-freefall-control', { failure, samples, ballistic });
    console.log(JSON.stringify({ failure, samples: samples.map(({ receipt, ...s }) => s) }));
    expect(failure).toBeNull();
    const first = samples[0], late = samples.at(-1)!;
    expect(late.sources[0].vx).toBeLessThan(.5); expect(late.sources[1].vx).toBeGreaterThan(-.5);
    expect(late.sources.every(s => s.lateralSpeed > .15)).toBe(true);
    expect(late.maxLocalDensity).toBeLessThanOrEqual(first.maxLocalDensity * 1.15);
    expect(Math.min(...late.occupiedVolume)).toBeGreaterThanOrEqual(Math.min(...first.occupiedVolume) * .85);
    for (const s of samples) {
      expect(s.residentVolume).toBeCloseTo(.128, 10);
      for (const source of s.sources) { expect(source.volume).toBeCloseTo(.064, 10); expect(source.oldestBirth).toBe(0); expect(source.newestBirth).toBe(0); }
      expect(s.receipt.emittedVolume).toBe(0); expect(s.receipt.exits).toBe(0);
    }
    expect(late.signedMomentum[0]).toBeCloseTo(0, 3); expect(late.signedMomentum[2]).toBeCloseTo(0, 3);
    expect(initial).toHaveLength(1024);
  }, 60000);
  it('keeps separated co-translating liquid in uniform free fall before interaction', () => {
    const liquid = control(), samples: ReturnType<typeof measurements>[] = [];
    liquid.seedBox([.4, -1.2, -.2], [.8, -.8, .2], [1, 0, 0], 'left');
    liquid.seedBox([1, -1.2, -.2], [1.4, -.8, .2], [1, 0, 0], 'right');
    let failure: string | null = null;
    try { for (const time of [0, .075, .1, .2]) { liquid.advanceTo(time); samples.push(measurements(liquid.snapshot())); } }
    catch (error) { failure = String(error); samples.push(measurements(liquid.snapshot())); }
    report('co-translating-freefall-control', { failure, samples });
    console.log(JSON.stringify({ control: 'co-translating', failure, samples: samples.map(({ receipt, ...s }) => s) }));
    expect(failure).toBeNull();
    const late = samples.at(-1)!;
    for (const s of late.sources) { expect(s.vx).toBeCloseTo(1, 6); expect(s.lateralSpeed).toBeLessThan(1e-5); }
    expect(late.maxLocalDensity).toBeLessThanOrEqual(samples[0].maxLocalDensity * 1.15);
  }, 60000);
  it('retains the same density gate on a refined pressure grid at fixed physical support', () => {
    const liquid = control(true), samples: ReturnType<typeof measurements>[] = [];
    liquid.seedBox([.4, -1.2, -.2], [.8, -.8, .2], [1, 0, 0], 'left');
    liquid.seedBox([1, -1.2, -.2], [1.4, -.8, .2], [-1, 0, 0], 'right');
    let failure: string | null = null;
    try { for (const time of [0, .075, .1, .2]) { liquid.advanceTo(time); samples.push(measurements(liquid.snapshot())); } }
    catch (error) { failure = String(error); samples.push(measurements(liquid.snapshot())); }
    report('opposing-freefall-refined-control', { failure, samples });
    console.log(JSON.stringify({ control: 'refined-pressure-grid', failure, samples: samples.map(({ receipt, ...s }) => s) }));
    expect(failure).toBeNull();
    const first = samples[0], late = samples.at(-1)!;
    expect(late.maxLocalDensity).toBeLessThanOrEqual(first.maxLocalDensity * 1.15);
    expect(Math.min(...late.occupiedVolume)).toBeGreaterThanOrEqual(Math.min(...first.occupiedVolume) * .85);
    expect(late.sources[0].vx).toBeLessThan(.5); expect(late.sources[1].vx).toBeGreaterThan(-.5);
    expect(late.sources.every(s => s.lateralSpeed > .15)).toBe(true);
  }, 120000);
  it('retains the behavior gate under particle refinement at fixed grid and support', () => {
    const liquid = control(false, 3), samples: ReturnType<typeof measurements>[] = [];
    liquid.seedBox([.4, -1.2, -.2], [.8, -.8, .2], [1, 0, 0], 'left');
    liquid.seedBox([1, -1.2, -.2], [1.4, -.8, .2], [-1, 0, 0], 'right');
    let failure: string | null = null;
    try { for (const time of [0, .1, .2]) { liquid.advanceTo(time); samples.push(measurements(liquid.snapshot())); } }
    catch (error) { failure = String(error); samples.push(measurements(liquid.snapshot())); }
    report('opposing-freefall-particle-refined-control', { failure, samples });
    console.log(JSON.stringify({ control: 'PPC3-fixed-grid-support', failure, samples: samples.map(({ receipt, ...s }) => s) }));
    expect(failure).toBeNull();
    const first = samples[0], late = samples.at(-1)!;
    expect(late.maxLocalDensity).toBeLessThanOrEqual(first.maxLocalDensity * 1.15);
    expect(Math.min(...late.occupiedVolume)).toBeGreaterThanOrEqual(Math.min(...first.occupiedVolume) * .85);
    expect(late.sources[0].vx).toBeLessThan(.5); expect(late.sources[1].vx).toBeGreaterThan(-.5);
    expect(late.sources.every(s => s.lateralSpeed > .15)).toBe(true);
  }, 120000);
  it('does not manufacture isolated momentum through pressure support extension', () => {
    const liquid = control(true);
    liquid.seedBox([.4, -1.2, -.2], [.8, -.8, .2], [1, 0, 0], 'left');
    liquid.seedBox([1, -1.2, -.2], [1.4, -.8, .2], [-1, 0, 0], 'right');
    liquid.advanceTo(.1); const measured = measurements(liquid.snapshot());
    report('isolated-horizontal-momentum-control', measured);
    console.log(JSON.stringify({ control: 'independent-physical-momentum', ...measured }));
    expect(measured.receipt.emittedVolume).toBe(0); expect(measured.receipt.exits).toBe(0);
    expect(measured.receipt.gridBoundaryImpulse).toEqual([0, 0, 0]);
    expect(measured.receipt.collisionImpulse).toEqual([0, 0, 0]);
    // This checks material momentum directly, not the force bookkeeping book.
    // Gravity is removed independently; symmetry in X must not hide Y/Z forces.
    for (const [axis, residual] of measured.isolatedExternalForceOnlyResidual.entries()) expect.soft(residual, `isolated axis ${axis}`).toBeCloseTo(0, 6);
  }, 120000);
});
