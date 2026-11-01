/** Proves that receiving water controls one shared fall state across the
 * running solver and its serialized foam/drawing frames, without a full reach. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultRiverCourse, setRiverShape } from '../riverReach';
import { setRiverHeadwaters, WATERFALL } from '../riverHeadwaters';
import { coupleWaterfallImpact, flowMapCore, reachInflow, WATERFALL_IMPACT } from '../riverFlowField';
import { LiveFlowMapper, LiveRiver } from '../riverLive';
import { RiverFlowSolver } from '../riverSolver';
import { RiverFloodSurge } from '../riverFloodSurge';
import { RiverSourceHistory } from '../riverSourceHistory';

describe('actual waterfall receiving state', () => {
  beforeEach(() => { setRiverHeadwaters(true); setRiverShape({ widthScale: 1, depthScale: 1, dischargeM3S: 12 }); });
  afterEach(() => { setRiverHeadwaters(false); setRiverShape(null); });

  function fixture(poolLevel: number) {
    const course = defaultRiverCourse();
    const crest = course.at(WATERFALL.crestS);
    const grid = { x0: crest.x - 12, z0: crest.z - 12, dx: 0.5, nx: 72, nz: 48 };
    const n = grid.nx * grid.nz;
    const bed = new Float64Array(n).fill(4);
    const h = new Float64Array(n).fill(Math.max(0, poolLevel - 4));
    const s = new Float32Array(n).fill(-160);
    const lateral = new Float32Array(n);
    const inflow = reachInflow(grid, h, s, lateral, course, 12, bed);
    return { grid, course, bed, h, s, lateral, inflow, n };
  }

  it('moves injection with the measured pool and preserves discharge over source area', () => {
    const low = fixture(6); const high = fixture(20);
    expect(low.inflow.waterfallLanding!.poolLevel).toBeCloseTo(6);
    expect(high.inflow.waterfallLanding!.poolLevel).toBeCloseTo(20);
    expect(high.inflow.waterfallLanding!.forward).toBeLessThan(low.inflow.waterfallLanding!.forward);
    for (const f of [low, high]) {
      const landing = f.inflow.waterfallLanding!;
      expect(landing.speed * landing.width * landing.depth).toBeCloseTo(12);
      expect(f.inflow.inflow.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(1);
      for (const cell of f.inflow.inflow) {
        const x = f.grid.x0 + (cell.c % f.grid.nx + 0.5) * f.grid.dx;
        const z = f.grid.z0 + (Math.floor(cell.c / f.grid.nx) + 0.5) * f.grid.dx;
        expect(Math.abs((x - landing.x) * landing.tx + (z - landing.z) * landing.tz)).toBeLessThan(1.5);
      }
    }
  });

  it('accepts no discharge when the receiving surface submerges the launch', () => {
    const level = 80;
    const f = fixture(level);
    expect(f.inflow.inflow).toEqual([]);
    expect(f.inflow.waterfallLanding!.discharge).toBe(0);
    expect(f.inflow.speed).toBe(0);
    expect(f.inflow.waterfallLanding!.impactEnergy!.fallSpecificEnergy).toBe(0);
  });

  it('refreshes without edits and keeps injection, foam and serialized drawing state together', () => {
    const f = fixture(6);
    const solver = new RiverFlowSolver({ grid: f.grid, bed: f.bed, manning: new Float32Array(f.n).fill(0.045),
      dischargeM3S: 12, inflow: f.inflow.inflow, inflowDir: f.inflow.dir, inflowSpeedMS: f.inflow.speed, outflowEdge: 'east' });
    solver.setState(f.h, new Float64Array(f.n), new Float64Array(f.n));
    // The small real solver isolates the worker's normal advance/frame methods
    // from expensive terrain construction; no implementation method is mocked.
    const live = Object.assign(Object.create(LiveRiver.prototype), {
      // Prototype fixtures bypass field initializers; supply the same idle
      // source controller as a normal LiveRiver so its inlet refresh is real.
      floodSurge: new RiverFloodSurge(),
      sourceHistory: new RiverSourceHistory(), sourceFlightDelayS: 2,
      headwaters: true, solver, grid: f.grid, course: f.course, shape: { widthScale: 1, depthScale: 1, dischargeM3S: 12 },
      cellS: f.s, cellN: f.lateral, n: f.n, simTime: 0, simAtSnap: 0, outAtSnap: 0, accT: 0,
      acc: { sh: new Float64Array(f.n), shu: new Float64Array(f.n), shv: new Float64Array(f.n), su2: new Float64Array(f.n) },
      disp: { h: Float32Array.from(f.h), qu: new Float32Array(f.n), qv: new Float32Array(f.n), q2: new Float32Array(f.n) },
      restores: 0, lastHealth: { ok: true }, editLostM3: 0, editAddedM3: 0, topUpM3: 0,
    }) as LiveRiver;
    live.advance(Infinity, 0);
    const before = live.frame().waterfallLanding!;
    solver.h.fill(16);
    live.advance(Infinity, 0);
    const frame = live.frame();
    expect(frame.waterfallLanding!.poolLevel).toBeCloseTo(20);
    expect(frame.waterfallLanding!.forward).toBeLessThan(before.forward);
    expect(frame.waterfallImpact).toBe(frame.waterfallLanding);
    const mapper = new LiveFlowMapper({ grid: f.grid, ground: Float32Array.from(f.bed), bed: Float32Array.from(f.bed),
      manning: new Float32Array(f.n).fill(0.045), boulders: [], W: new Float32Array(f.n), T: new Float32Array(f.n), L: new Float32Array(f.n) });
    const snapshot = mapper.map(structuredClone(frame));
    expect(JSON.parse(JSON.stringify(snapshot.waterfallLanding))).toEqual(frame.waterfallLanding);
    const wetVolume = solver.volume();
    const outVolume = solver.outVolume;
    const wetStep = live.advance(Infinity, 0.05);
    expect(solver.volume() - wetVolume + solver.outVolume - outVolume).toBeCloseTo(12 * wetStep.simS, 8);
    solver.h.fill(0);
    solver.setState(new Float64Array(f.n), new Float64Array(f.n), new Float64Array(f.n));
    const volume = solver.volume(), outBefore = solver.outVolume;
    // This is receiving-pool dryness, not a blocked crest. The old wet-only
    // acceptance rule could never refill this pool with the existing fall.
    const dryStep = live.advance(Infinity, 0.05);
    expect(solver.discharge).toBe(12);
    expect(solver.volume() - volume + solver.outVolume - outBefore).toBeCloseTo(12 * dryStep.simS, 8);
    expect(solver.h.some(d => d > 0)).toBe(true);
    expect(live.frame().waterfallLanding!.discharge).toBe(12);

    // Closing the crest leaves the admitted flight tail arriving. Check mass
    // during that tail, then ensure the drawing worker loses impact forcing
    // when arrival stops, while retaining the last trajectory for airborne water.
    live.setSourcePaused(true);
    expect(live.flood.sourceM3S).toBe(0);
    expect(live.frame().waterfallLanding!.discharge).toBe(12);
    const tailVolume = solver.volume(), tailOut = solver.outVolume;
    const tailStep = live.advance(Infinity, 0.05);
    expect(solver.volume() - tailVolume + solver.outVolume - tailOut).toBeCloseTo(12 * tailStep.simS, 8);
    const tailLanding = { ...live.frame().waterfallLanding! };
    live.simTime += 2;
    live.advance(Infinity, 0);
    const stoppedFrame = live.frame();
    expect(stoppedFrame.qIn).toBe(0);
    expect(stoppedFrame.waterfallLanding).toEqual({ ...tailLanding, discharge: 0 });
    expect(stoppedFrame.waterfallImpact).toBe(stoppedFrame.waterfallLanding);
    expect(mapper.map(structuredClone(stoppedFrame)).waterfallLanding!.discharge).toBe(0);
    const stoppedVolume = solver.volume(), stoppedOut = solver.outVolume;
    live.advance(Infinity, 0.05);
    expect(solver.volume() - stoppedVolume + solver.outVolume - stoppedOut).toBeCloseTo(0, 8);
    expect(solver.volume()).toBeGreaterThan(0);

    // Reopening emits immediately but cannot refill the landing before flight.
    live.setSourcePaused(false);
    expect(live.flood.sourceM3S).toBe(12);
    expect(live.frame().waterfallLanding!.discharge).toBe(0);
    live.simTime += 2;
    live.advance(Infinity, 0);
    const resumedFrame = live.frame();
    expect(resumedFrame.qIn).toBe(12);
    expect(resumedFrame.waterfallLanding!.discharge).toBe(12);
    expect(mapper.map(structuredClone(resumedFrame)).waterfallLanding!.discharge).toBe(12);
    const resumedVolume = solver.volume(), resumedOut = solver.outVolume;
    const resumedStep = live.advance(Infinity, 0.05);
    expect(solver.volume() - resumedVolume + solver.outVolume - resumedOut).toBeCloseTo(12 * resumedStep.simS, 8);
    expect(live.topUpM3).toBe(0);
    expect(live.restores).toBe(0);
  });

  it('preserves the legacy west-edge inlet when headwaters is disabled', () => {
    const f = fixture(6);
    setRiverHeadwaters(false);
    const inlet = reachInflow(f.grid, f.h, new Float32Array(f.n), f.lateral, f.course, 12, f.bed);
    expect(inlet.waterfallLanding).toBeUndefined();
    expect(inlet.inflow.every((cell) => cell.c % f.grid.nx < 3)).toBe(true);
    expect(inlet.inflow.reduce((sum, cell) => sum + cell.share, 0)).toBeCloseTo(1);
  });

  function symmetricImpact(receivingDepth = 1, drop = 10, discharge = 2) {
    const grid = { x0: -5, z0: -5, dx: 1, nx: 10, nz: 10 };
    const cells = [44, 45, 54, 55].map(c => ({ c, share: 0.25 }));
    const depths = new Float64Array(100).fill(receivingDepth);
    const landing = { x: 0, z: 0, tx: 1, tz: 0, speed: 0.4, depth: 0.7,
      top: receivingDepth + drop, poolLevel: receivingDepth, discharge };
    return { grid, cells, depths, landing, ...coupleWaterfallImpact(grid, cells, depths, landing) };
  }

  it('centers radial impulse and bounds energy after the shared speed cap', () => {
    for (const drop of [10, 10000]) {
      const f = symmetricImpact(1, drop);
      const radial = f.inflow.map(p => ({ share: p.share,
        x: p.velocityMS![0] - f.landing.speed, z: p.velocityMS![1] }));
      expect(radial.reduce((sum, p) => sum + p.share * p.x, 0)).toBeCloseTo(0, 12);
      expect(radial.reduce((sum, p) => sum + p.share * p.z, 0)).toBeCloseTo(0, 12);
      const kinetic = radial.reduce((sum, p) => sum + 0.5 * p.share * (p.x * p.x + p.z * p.z), 0);
      expect(kinetic).toBeCloseTo(f.energy.radialSpecificEnergy, 12);
      expect(kinetic).toBeLessThanOrEqual(WATERFALL_IMPACT.radialEnergyShare * f.energy.fallSpecificEnergy);
      expect(Math.max(...radial.map(p => Math.hypot(p.x, p.z)))).toBeLessThanOrEqual(WATERFALL_IMPACT.maxRadialSpeedMS + 1e-12);
      expect(f.energy.radialSpecificEnergy + f.energy.dissipatedSpecificEnergy).toBeCloseTo(f.energy.fallSpecificEnergy, 12);
    }
    // Unequal eligible shares still have zero net added impulse; dry cells
    // retain their accepted shares rather than reallocating their water.
    const f = symmetricImpact(); f.depths[44] = 0;
    const cells = f.cells.map((p, i) => ({ ...p, share: [0.1, 0.2, 0.3, 0.4][i] }));
    const result = coupleWaterfallImpact(f.grid, cells, f.depths, f.landing);
    expect(result.inflow.map(p => p.share)).toEqual(cells.map(p => p.share));
    expect(result.inflow[0].velocityMS).toBeUndefined();
    expect(result.inflow.reduce((sum, p) => sum + p.share * ((p.velocityMS?.[0] ?? 0.4) - 0.4), 0)).toBeCloseTo(0, 12);
    expect(result.inflow.reduce((sum, p) => sum + p.share * (p.velocityMS?.[1] ?? 0), 0)).toBeCloseTo(0, 12);
  });

  it('responds to drop and receiving depth while preserving dry and zero-Q eligibility', () => {
    const low = symmetricImpact(1, 2), high = symmetricImpact(1, 10), deep = symmetricImpact(8, 10);
    expect(high.energy.radialSpecificEnergy).toBeGreaterThan(low.energy.radialSpecificEnergy);
    expect(deep.energy.radialSpecificEnergy).toBeLessThan(high.energy.radialSpecificEnergy);
    expect(deep.energy.receivingDepth).toBe(8);
    const dry = symmetricImpact(0), stopped = symmetricImpact(1, 10, 0);
    expect(dry.inflow).toEqual(dry.cells);
    expect(dry.energy.radialSpecificEnergy).toBe(0);
    expect(stopped.energy.fallSpecificEnergy).toBe(0);
    expect(stopped.energy.radialSpecificEnergy).toBe(0);
    expect(stopped.inflow).toEqual(stopped.cells);
    // Dry eligibility suppresses extra momentum, never already accepted mass.
    const solver = new RiverFlowSolver({ grid: dry.grid, bed: new Float64Array(100), manning: new Float32Array(100),
      dischargeM3S: dry.landing.discharge, inflow: dry.inflow, inflowDir: [1, 0], inflowSpeedMS: 0.4, outflowEdge: 'east' });
    const dt = solver.step();
    expect(solver.volume()).toBeCloseTo(dry.landing.discharge * dt, 12);
    expect(solver.h[44]).toBeGreaterThan(0);
  });

  it('drives actual outward pool momentum with unchanged mass and native carried foam', () => {
    const f = symmetricImpact();
    const bed = new Float64Array(100), manning = new Float32Array(100);
    const solver = new RiverFlowSolver({ grid: f.grid, bed, manning, dischargeM3S: 2,
      inflow: f.inflow, inflowDir: [1, 0], inflowSpeedMS: 0.4, outflowEdge: 'east' });
    solver.setState(f.depths, new Float64Array(100), new Float64Array(100));
    const before = solver.volume(), out = solver.outVolume, dt = solver.step();
    expect(solver.volume() - before + solver.outVolume - out).toBeCloseTo(2 * dt, 10);
    expect(solver.hv[44]).toBeLessThan(0);
    expect(solver.hv[54]).toBeGreaterThan(0);
    const u = Float32Array.from(solver.hu, (q, c) => q / solver.h[c]);
    const v = Float32Array.from(solver.hv, (q, c) => q / solver.h[c]);
    const base = { grid: f.grid, bed, h: Float32Array.from(solver.h), u, v, uRms: new Float32Array(100) };
    const foam = { kind: 'step' as const, dtS: 0.5, W: new Float32Array(100), T: new Float32Array(100), L: new Float32Array(100) };
    const impact = { ...f.landing, width: 2, impactEnergy: f.energy };
    const produced = flowMapCore({ ...base, waterfallImpact: impact }, Float32Array.from(bed), manning, [], foam);
    expect(produced.W[44]).toBeGreaterThan(0);
    // A carried packet leaves its source under the actual solver velocity.
    // Isolate transport after production stops; the existing W array persists.
    const transport = { ...foam, dtS: 1, W: new Float32Array(100), T: new Float32Array(100), L: new Float32Array(100) };
    transport.W[44] = 0.5;
    const moved = flowMapCore(base, Float32Array.from(bed), manning, [], transport);
    expect(moved.W[34] + moved.W[43]).toBeGreaterThan(0);
    expect(moved.W[44]).toBeLessThan(0.5);
    expect(moved.L.some(value => value > 0)).toBe(true);
  });
});
