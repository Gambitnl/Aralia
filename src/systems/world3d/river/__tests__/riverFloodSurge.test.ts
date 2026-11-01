/** Pulse timing, conservative transport and overbank activation; no rendered flood claim. */
import { afterEach, describe, expect, it } from 'vitest';
import { RiverFloodSurge, riverFloodSourceAt } from '../riverFloodSurge';
import { RiverFlowSolver } from '../riverSolver';
import { LiveRiver } from '../riverLive';
import { setRiverHeadwaters } from '../riverHeadwaters';
import { setRiverShape } from '../riverReach';
afterEach(() => { setRiverHeadwaters(false); setRiverShape(null); });

describe('temporary source flood', () => {
  it('uses simulation-time rise/hold/recession and preserves airborne volume on cancel', () => {
    const pulse = new RiverFloodSurge();
    expect(pulse.start(10, 12, 4, { peakM3S: 60, durationS: 90 })).toBe(true);
    expect(pulse.status(10, 12)).toMatchObject({ phase: 'rising', sourceM3S: 12, landingM3S: 12 });
    expect(pulse.status(28, 12)).toMatchObject({ phase: 'holding', sourceM3S: 60 });
    expect(pulse.landingAt(14, 12)).toBe(12);
    const emitted = pulse.emittedVolume(30), landingBefore = pulse.landingAt(30, 12);
    pulse.cancel(30);
    expect(pulse.emittedVolume(30)).toBe(emitted);
    expect(pulse.landingAt(30, 12)).toBe(landingBefore);
    expect(pulse.status(49, 12).phase).toBe('draining');
    expect(pulse.status(53, 12).phase).toBe('idle');
    expect(pulse.status(53, 12).sourceM3S).toBe(12);
    expect(pulse.status(53, 12).extraLandedM3).toBeCloseTo(pulse.status(53, 12).extraEmittedM3, 12);
    const descriptor = pulse.status(30, 12).pulse!;
    for (let t = 5; t < 60; t += .25) expect(riverFloodSourceAt(descriptor, t)).toBeCloseTo(12 + pulse.extraAt(t), 12);
    expect(pulse.status(30, 24).pulse).toEqual(descriptor);
    expect(riverFloodSourceAt(pulse.status(30, 24).pulse!, 28)).toBe(60);
  });

  it('integrates one pulse and bounds invalid requests without accumulating concurrent pulses', () => {
    const pulse = new RiverFloodSurge();
    pulse.start(0, 12, 4, { peakM3S: 60, durationS: 90 });
    expect(pulse.emittedVolume(100)).toBeCloseTo(48 * 90 * .7, 12);
    expect(pulse.start(10, 12, 4)).toBe(false);
    expect(pulse.start(100, 12, 4, { peakM3S: Infinity, durationS: NaN })).toBe(true);
    expect(pulse.status(100, 12).peakM3S).toBe(60);
    expect(pulse.status(100, 12).remainingS).toBe(94);
  });

  it('keeps a late cancellation continuous and its integral consistent with emitted flow', () => {
    const pulse = new RiverFloodSurge(); pulse.start(0, 12, 4, { peakM3S: 60, durationS: 90 });
    const before = pulse.extraAt(89); pulse.cancel(89);
    expect(pulse.extraAt(89)).toBe(before);
    for (const t of [89.1, 89.5, 89.9]) {
      const epsilon = .00001;
      const derivative = (pulse.emittedVolume(t + epsilon) - pulse.emittedVolume(t - epsilon)) / (2 * epsilon);
      expect(derivative).toBeCloseTo(pulse.extraAt(t), 6);
    }
    expect(pulse.extraAt(90 - .00001)).toBeLessThan(.0000001);
    expect(pulse.extraAt(90)).toBe(0);
    expect(pulse.emittedVolume(107)).toBe(pulse.emittedVolume(90));
    expect(pulse.status(94, 12).extraLandedM3).toBe(pulse.emittedVolume(90));
  });

  it('changes only the source, then transports a conserved pulse into overbank cells', () => {
    const nx = 48, nz = 9, dx = .5, count = nx * nz;
    const bed = new Float64Array(count), ceiling = new Float64Array(count).fill(.2), h = new Float64Array(count);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      bed[j * nx + i] = Math.abs(j - 4) <= 1 ? 0 : .25;
      h[j * nx + i] = Math.abs(j - 4) <= 1 ? .1 : 0;
    }
    const solver = new RiverFlowSolver({ grid: { x0: 0, z0: 0, nx, nz, dx }, bed,
      manning: new Float32Array(count).fill(.035), dischargeM3S: .2, inflow: [{ c: 4 * nx + 2, share: 1 }],
      inflowDir: [1, 0], inflowSpeedMS: 1, outflowEdge: 'east' }, ceiling);
    solver.setState(h, new Float64Array(count), new Float64Array(count)); solver.refreshWaveSpeed();
    const before = solver.saveState(), volume = solver.volume();
    solver.enableWetFrontExpansion(new Uint8Array(count).fill(1));
    expect(solver.saveState()).toEqual(before);
    const pulse = new RiverFloodSurge(); pulse.start(0, .2, 2, { peakM3S: 3, durationS: 10 });
    const far = 4 * nx + 36;
    solver.setInflow(pulse.landingAt(0, .2), [{ c: 4 * nx + 2, share: 1 }], [1, 0], 1);
    solver.step();
    expect(solver.h[far]).toBe(.1); expect(solver.hu[far]).toBe(0);
    let landedExtra = 0;
    while (solver.time < 16) {
      const q = pulse.landingAt(solver.time, .2);
      solver.setInflow(q, [{ c: 4 * nx + 2, share: 1 }], [1, 0], 1);
      landedExtra += Math.max(0, q - .2) * solver.step();
    }
    expect(landedExtra).toBeGreaterThan(18);
    expect(solver.h[far]).toBeGreaterThan(.1); expect(solver.hu[far]).toBeGreaterThan(0);
    const overbank = Array.from(solver.h).filter((d, c) => bed[c] === .25 && d > .01);
    expect(overbank.length).toBeGreaterThan(10);
    expect(solver.volume() - volume).toBeCloseTo(solver.inVolume - solver.outVolume, 8);
    const beforePatch = solver.volume();
    solver.updateBed(0, 0, nx - 1, nz - 1, bed, new Float32Array(count).fill(.035), ceiling);
    expect(solver.volume()).toBeCloseTo(beforePatch, 10);
    expect(solver.health(25).ok).toBe(true);
    // The pulse has finished; arrived overbank water remains and drains naturally.
    expect(pulse.status(solver.time, .2).phase).toBe('idle');
    expect(overbank.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    const activeWhileWet = solver.activeCells;
    solver.setInflow(0, [], [1, 0], 0);
    solver.setState(new Float64Array(count), new Float64Array(count), new Float64Array(count));
    solver.step();
    expect(solver.activeCells).toBeLessThan(activeWhileWet);
    expect(solver.volume()).toBe(0);
  });

  it('includes freshly injected depth in the next CFL bound at a narrow strong source', () => {
    const nx = 15, nz = 15, count = nx * nz, c = 7 * nx + 7;
    const solver = new RiverFlowSolver({ grid: { x0: 0, z0: 0, nx, nz, dx: .5 },
      bed: new Float64Array(count), manning: new Float32Array(count), dischargeM3S: 120,
      inflow: [{ c, share: 1 }], inflowDir: [1, 0], inflowSpeedMS: 1, outflowEdge: 'east' });
    solver.enableWetFrontExpansion(new Uint8Array(count).fill(1));
    solver.setState(new Float64Array(count), new Float64Array(count), new Float64Array(count));
    solver.setInflow(120, [{ c, share: 1 }], [1, 0], 1);
    const first = solver.step();
    const wave = Math.hypot(solver.hu[c], solver.hv[c]) / solver.h[c] + Math.sqrt(9.81 * solver.h[c]);
    const second = solver.step();
    expect(second).toBeLessThan(first);
    expect(second).toBeLessThanOrEqual(.45 * .5 / wave);
    for (let n = 0; n < 30; n++) solver.step();
    expect(solver.volume()).toBeCloseTo(solver.inVolume - solver.outVolume, 8);
    expect(solver.health(25).ok).toBe(true);
  });

  it('sleeps the original dry region and wakes it conservatively as water approaches', () => {
    const nx = 36, nz = 11, count = nx * nz, inlet = 5 * nx + 2;
    const bed = new Float64Array(count), ceiling = new Float64Array(count).fill(1);
    for (let j = 0; j < nz; j++) bed[j * nx + nx - 1] = 5;
    const make = () => new RiverFlowSolver({ grid: { x0: 0, z0: 0, nx, nz, dx: .5 },
      bed, manning: new Float32Array(count).fill(.03), dischargeM3S: .2,
      inflow: [{ c: inlet, share: 1 }], inflowDir: [1, 0], inflowSpeedMS: .5, outflowEdge: 'east' }, ceiling);
    const adaptive = make(), dense = make();
    adaptive.enableWetFrontExpansion(new Uint8Array(count).fill(1));
    const originallyActive = adaptive.activeCells;
    expect(adaptive.step()).toBe(dense.step());
    expect(adaptive.activeCells).toBeLessThan(originallyActive / 4);
    const remote = 5 * nx + 12;
    expect(adaptive.h[remote]).toBe(0);
    for (let n = 0; n < 300; n++) expect(adaptive.step()).toBeCloseTo(dense.step(), 12);
    expect(adaptive.h[remote]).toBeGreaterThan(.0001);
    for (let c = 0; c < count; c++) {
      expect(adaptive.h[c]).toBeCloseTo(dense.h[c], 12);
      expect(adaptive.hu[c]).toBeCloseTo(dense.hu[c], 12);
      expect(adaptive.hv[c]).toBeCloseTo(dense.hv[c], 12);
    }
    expect(adaptive.volume()).toBeCloseTo(adaptive.inVolume - adaptive.outVolume, 10);

    const saved = adaptive.saveState(), volume = adaptive.volume();
    adaptive.setInflow(0, [], [1, 0], 0);
    adaptive.setState(new Float64Array(count)); adaptive.step();
    expect(adaptive.activeCells).toBe(0);
    adaptive.restoreState(saved);
    expect(adaptive.volume()).toBeCloseTo(volume, 12);
    expect(adaptive.h).toEqual(saved.h);
    adaptive.setState(saved.h);
    expect(adaptive.volume()).toBeCloseTo(volume, 12);
    adaptive.updateBed(0, 0, nx - 1, nz - 1, bed, new Float32Array(count).fill(.03), ceiling);
    expect(adaptive.volume()).toBeCloseTo(volume, 12);
    adaptive.step();
    expect(adaptive.volume()).toBeCloseTo(volume, 10);
  });

  it('starts and cancels the actual headwater source without rebuilding or mutating the field', () => {
    const live = new LiveRiver(20260928, true);
    const before = live.solver.saveState(), bed = live.solver.bed.slice(), base = live.solver.discharge;
    expect(live.startFlood({ peakM3S: 60, durationS: 90 })).toBe(true);
    expect(live.solver.saveState()).toEqual(before); expect(live.solver.bed).toEqual(bed);
    expect(live.topUpM3).toBe(0); expect(live.restores).toBe(0);
    expect(live.flood.flightDelayS).toBeGreaterThan(3);
    expect(live.solver.discharge).toBe(base);
    expect(live.frame().flood).toEqual(live.flood);
    // Telemetry must describe accepted flow even when a receiver rejects its scheduled arrival.
    live.solver.setInflow(0, [], [0, 0], 0);
    expect(live.flood.landingM3S).toBe(0);
    live.cancelFlood();
    expect(live.solver.saveState()).toEqual(before); expect(live.solver.bed).toEqual(bed);
    expect(live.restores).toBe(0);
  }, 60000);
});
