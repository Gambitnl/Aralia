/** The expanded river must be one connected body, with two draining branches. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { courseKeyAt, defaultRiverCourse, designLevelAt, setRiverShape, type RiverReach } from '../riverReach';
import { MAIN_CHANNEL_S, mainRapidsAt, setRiverHeadwaters, waterfallHydraulics, waterfallFlight, waterfallLanding, WATERFALL, POOL_SPILL } from '../riverHeadwaters';
import { buildFlowMap, reachInflow, setupReachSolver } from '../riverFlowField';
import { LiveFlowMapper, LiveRiver } from '../riverLive';
import { RiverFlowSolver } from '../riverSolver';

describe('waterfall, pool and branching rapids', () => {
  let reach: RiverReach;
  let live: LiveRiver;
  let state: ReturnType<typeof setupReachSolver>;
  beforeAll(() => {
    setRiverHeadwaters(true);
    setRiverShape(null);
    live = new LiveRiver(20260928, true);
    reach = live.reach;
    state = setupReachSolver(reach);
  }, 60000);
  afterAll(() => { setRiverHeadwaters(false); setRiverShape(null); });

  it('has a waterfall above a broad, deep pool and a descending outlet', () => {
    expect(designLevelAt(-175) - designLevelAt(-171)).toBeCloseTo(WATERFALL.heightM);
    expect(courseKeyAt(-140).halfW).toBeGreaterThan(17);
    expect(designLevelAt(-140) - courseKeyAt(-140).thalweg).toBeGreaterThan(3);
    expect(designLevelAt(-100)).toBeGreaterThan(designLevelAt(-60));
    expect(designLevelAt(-60)).toBeGreaterThan(designLevelAt(0));
  });
  it('holds a raised basin, spills sharply, and slopes into the exact original join', () => {
    expect(designLevelAt(-140)).toBe(WATERFALL.poolLevel);
    expect(courseKeyAt(-140).thalweg).toBe(POOL_SPILL.poolBed);
    expect(courseKeyAt(-140).bankTop).toBe(POOL_SPILL.bankTop);
    expect(courseKeyAt(POOL_SPILL.crestS).thalweg).toBe(POOL_SPILL.crestBed);
    expect(courseKeyAt(POOL_SPILL.toeS).thalweg).toBe(POOL_SPILL.toeBed);
    // The lip holds the deep pool, then every downstream key descends.
    // There is one inlet, so this spill must drain existing pool water.
    let previousBed = Infinity, previousLevel = Infinity;
    for (let s = POOL_SPILL.crestS; s <= -60; s += 0.25) {
      const key = courseKeyAt(s);
      expect(key.thalweg).toBeLessThanOrEqual(previousBed + 1e-9);
      expect(designLevelAt(s)).toBeLessThanOrEqual(previousLevel + 1e-9);
      expect(designLevelAt(s)).toBeGreaterThan(key.thalweg);
      previousBed = key.thalweg; previousLevel = designLevelAt(s);
    }
    expect(courseKeyAt(-60)).toMatchObject({ thalweg: 6.1, bankTop: 7.1 });
    expect(designLevelAt(-60)).toBeCloseTo(6.65);
    // Shared bank blending continues through both plateau and runoff.
    for (const s of [-140, -122, -115, -110, -103, -90, -70]) {
      const p = reach.course.at(s), half = courseKeyAt(s).halfW;
      for (const side of [-1, 1]) {
        let previous: number | null = null;
        for (let n = half - 3; n <= half + 6; n += 0.25) {
          const h = reach.terrainHeight(p.x + p.tz * n * side, p.z - p.tx * n * side);
          if (previous !== null) expect(Math.abs(h - previous)).toBeLessThan(1.2);
          previous = h;
        }
      }
    }
  });
  it('keeps the full selected source opening below the approach surface', () => {
    const top = waterfallHydraulics({ widthScale: 1, depthScale: 1, dischargeM3S: 1.5 }).top;
    let cells = 0;
    for (let c = 0; c < reach.ground.length; c += 1) {
      if (reach.cellS[c] > -200 && reach.cellS[c] < -175 && Math.abs(reach.cellN[c]) < 5) {
        expect(reach.ground[c]).toBeLessThan(top - 0.5); cells += 1;
      }
    }
    expect(cells).toBeGreaterThan(500);
  });

  it('embeds both source banks in continuous upland rather than a suspended trough', () => {
    const p = reach.course.at(-190);
    for (const side of [-1, 1]) {
      let previous: number | null = null;
      for (let n = 4; n <= 40; n += 0.5) {
        const x = p.x + p.tz * n * side; const z = p.z - p.tx * n * side;
        const i = Math.floor((x - reach.grid.x0) / reach.grid.dx);
        const j = Math.floor((z - reach.grid.z0) / reach.grid.dx);
        // The far upstream shoulder crosses the solver grid's west edge.
        // Sample its terrain function there instead of wrapping a negative
        // column index into an unrelated east-edge cell in the previous row.
        const ground = i >= 0 && i < reach.grid.nx && j >= 0 && j < reach.grid.nz
          ? reach.ground[j * reach.grid.nx + i] : reach.terrainHeight(x, z);
        expect(ground).toBeGreaterThan(77);
        if (previous !== null) expect(Math.abs(ground - previous)).toBeLessThan(1.1);
        previous = ground;
      }
    }
  });

  it('keeps the plunge-pool bank continuous where the source plateau meets its wandering edge', () => {
    // These adjacent cells previously alternated between the receiving bank
    // and an interpolated upland spike in the rendered pool.
    const heights = [[-156.25, -14.25], [-156.25, -13.75], [-156.75, -13.75]]
      .map(([x, z]) => reach.terrainHeight(x, z));
    expect(Math.max(...heights)).toBeLessThan(POOL_SPILL.bankTop + 2);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1.5);
    for (const s of [-164, -160, -156]) for (const side of [-1, 1]) {
      const p = reach.course.at(s); const half = courseKeyAt(s).halfW;
      let previous: number | null = null;
      for (let n = half - 4; n <= half + 5; n += 0.25) {
        const h = reach.terrainHeight(p.x + p.tz * n * side, p.z - p.tx * n * side);
        // A profile can cross the actual high cliff shoulder.
        // Check continuity only along the receiving bank below that cliff.
        if (previous !== null && h < 60 && previous < 60) expect(Math.abs(h - previous)).toBeLessThan(1);
        previous = h;
      }
    }
  });
  it('throws fast water farther, with gravity independent of discharge', () => {
    const low = waterfallHydraulics({ widthScale: 1, depthScale: 1, dischargeM3S: 0.5 });
    const high = waterfallHydraulics({ widthScale: 1, depthScale: 1, dischargeM3S: 12 });
    expect(high.speed / low.speed).toBeCloseTo(24);
    const slow = waterfallFlight(2, low.speed); const fast = waterfallFlight(2, high.speed);
    expect(fast.forward / slow.forward).toBeCloseTo(24); expect(fast.drop).toBe(slow.drop);
    expect(waterfallHydraulics({ widthScale: 2, depthScale: 1, dischargeM3S: 12 }).speed).toBeCloseTo(high.speed / 2);
  });

  it('feeds the pool once at the landing patch and leaves the cliff out of the shallow solver', () => {
    const inlet = reachInflow(reach.grid, state.h0, reach.cellS, reach.cellN, reach.course, reach.dischargeM3S);
    expect(inlet.inflow.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(1);
    expect(inlet.inflow.every((p) => reach.cellS[p.c] > -171)).toBe(true);
    expect(Array.from(state.h0).every((depth, c) => reach.cellS[c] >= -171 || depth === 0)).toBe(true);
  });

  it.each([0.5, 1.5, 12])('aligns the actual world landing and receiving momentum at Q=%s', (q) => {
    const shape = { widthScale: 1, depthScale: 1, dischargeM3S: q };
    setRiverShape(shape);
    const crest = reach.course.at(WATERFALL.crestS);
    const h = waterfallHydraulics(shape, designLevelAt(-160));
    expect(h.speed * h.width * h.depth).toBeCloseTo(q);
    const impact = waterfallLanding(crest, h);
    const inlet = reachInflow(reach.grid, state.h0, reach.cellS, reach.cellN, reach.course, q);
    expect(inlet.speed).toBe(h.speed);
    expect(inlet.dir).toEqual([crest.tx, crest.tz]);
    for (const cell of inlet.inflow) {
      const x = reach.grid.x0 + (cell.c % reach.grid.nx + 0.5) * reach.grid.dx;
      const z = reach.grid.z0 + (Math.floor(cell.c / reach.grid.nx) + 0.5) * reach.grid.dx;
      expect(Math.abs((x - impact.x) * crest.tx + (z - impact.z) * crest.tz)).toBeLessThan(1.5);
      expect(Math.abs((x - impact.x) * crest.tz - (z - impact.z) * crest.tx)).toBeLessThan(h.width * 0.5);
    }
    setRiverShape(null);
  });

  it('locates impact foam at the shared landing and increases it with discharge', () => {
    const crest = defaultRiverCourse().at(WATERFALL.crestS);
    const compare = (Q: number): number => {
      setRiverShape({ widthScale: 1, depthScale: 1, dischargeM3S: Q });
      const impact = waterfallLanding(crest, waterfallHydraulics({ widthScale: 1, depthScale: 1, dischargeM3S: Q }));
      const grid = { x0: impact.x - 10, z0: impact.z - 10, dx: 0.5, nx: 40, nz: 40 };
      const count = grid.nx * grid.nz;
      const zeros = new Float32Array(count);
      const map = buildFlowMap({ grid, h: new Float32Array(count).fill(1), u: zeros, v: zeros, uRms: zeros, bed: new Float32Array(count).fill(7), waterfallImpact: { ...impact, tx: crest.tx, tz: crest.tz, width: 10, discharge: Q } });
      const center = 20 * grid.nx + 20; const corner = 0;
      expect(map.t1[center * 4]).toBeGreaterThan(map.t1[corner * 4] + 0.02);
      expect(map.t1[center * 4 + 3]).toBeGreaterThan(0.1);
      return map.t1[center * 4];
    };
    expect(compare(12)).toBeGreaterThan(compare(0.5) * 2);
    setRiverShape(null);
  });

  it('carries landing energy across the worker frame with no ambient headwater state', () => {
    live.startCold();
    const original = live.frame();
    const frame = structuredClone(original);
    expect(frame.waterfallImpact!.impactEnergy).toEqual(original.waterfallImpact!.impactEnergy);
    expect(frame.waterfallImpact!.impactEnergy).not.toBe(original.waterfallImpact!.impactEnergy);
    expect(frame.waterfallImpact?.discharge).toBe(1.5);
    const impact = frame.waterfallImpact!;
    const grid = { x0: impact.x - 10, z0: impact.z - 10, dx: 0.5, nx: 40, nz: 40 };
    const count = grid.nx * grid.nz;
    // The small fixture changes grids. Linear source-cell indices belong to
    // the full worker grid, so project the SAME serialized physical stencil
    // into this local grid rather than silently dropping all impact energy.
    const energy = impact.impactEnergy!;
    energy.cells = energy.cells.map(p => {
      const x = live.grid.x0 + (p.c % live.grid.nx + 0.5) * live.grid.dx;
      const z = live.grid.z0 + (Math.floor(p.c / live.grid.nx) + 0.5) * live.grid.dx;
      const i = Math.floor((x - grid.x0) / grid.dx), j = Math.floor((z - grid.z0) / grid.dx);
      expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(grid.nx);
      expect(j).toBeGreaterThanOrEqual(0); expect(j).toBeLessThan(grid.nz);
      return { c: j * grid.nx + i, share: p.share };
    });
    expect(energy.cells.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(1);
    frame.h = new Float32Array(count).fill(1);
    frame.u = new Float32Array(count); frame.v = new Float32Array(count); frame.uRms = new Float32Array(count);
    frame.dtS = 4;
    const init = () => ({ grid, ground: new Float32Array(count).fill(7), bed: new Float32Array(count).fill(7), manning: new Float32Array(count).fill(0.04), boulders: [], W: new Float32Array(count), T: new Float32Array(count), L: new Float32Array(count) });
    setRiverHeadwaters(false); setRiverShape(null);
    try {
      const supplied = new LiveFlowMapper(structuredClone(init())).map(frame);
      const blocked = new LiveFlowMapper(structuredClone(init())).map({ ...frame, qIn: 0, waterfallImpact: { ...impact, discharge: 0 } });
      expect(supplied.waterfallLanding!.impactEnergy).toEqual(energy);
      const center = (20 * grid.nx + 20) * 4;
      expect(supplied.t1h[center]).toBeGreaterThan(blocked.t1h[center]);
      expect(supplied.t1h[center + 3]).toBeGreaterThan(blocked.t1h[center + 3]);
    } finally { setRiverHeadwaters(true); }
  });

  it('accepts the original mass into a dry receiving pool so it can refill', () => {
    // Receiving dryness previously paused the only source that could refill
    // the pool. A finite receiving bed below the launch accepts the same Q;
    // extra radial impact momentum stays off until the cells are wet.
    const crest = reach.course.at(WATERFALL.crestS);
    const grid = { x0: crest.x - 12, z0: crest.z - 12, dx: 0.5, nx: 72, nz: 48 };
    const count = grid.nx * grid.nz, dry = new Float64Array(count), bed = new Float64Array(count).fill(4);
    const inlet = reachInflow(grid, dry, new Float32Array(count).fill(-160), new Float32Array(count), reach.course, 1.5, bed);
    expect(inlet.waterfallLanding!.discharge).toBe(1.5);
    expect(inlet.inflow.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(1);
    expect(inlet.inflow.every(p => p.velocityMS === undefined)).toBe(true);
    const solver = new RiverFlowSolver({ grid, bed, manning: new Float32Array(count),
      dischargeM3S: 1.5, inflow: inlet.inflow, inflowDir: inlet.dir, inflowSpeedMS: inlet.speed, outflowEdge: 'east' });
    const dt = solver.step();
    expect(solver.volume() + solver.outVolume).toBeCloseTo(1.5 * dt, 10);
    expect(inlet.inflow.some(p => solver.h[p.c] > 0)).toBe(true);
  });
  it('pauses a blocked landing and resumes the selected source after repair', () => {
    // Disposable raised-bed fixture isolates the dry receiving patch without
    // changing any saved terrain or asking the renderer to fake a wet inlet.
    live.startCold();
    const bed = live.solver.bed.slice();
    const water = live.solver.saveState();
    live.solver.bed.fill(100);
    live.applyEdit({ shape: { widthScale: 1, depthScale: 1, dischargeM3S: 2 }, course: null });
    expect(live.inflowDry).toBe(true); expect(live.solver.discharge).toBe(0);
    // Restore the entire disposable fixture: the edit preserves free-surface
    // height, so restoring only the bed leaves the artificial raised water.
    live.solver.bed.set(bed);
    live.applyEdit({ shape: { widthScale: 1, depthScale: 1, dischargeM3S: 1.5 }, course: null });
    // A repaired, lowered receiving bed now accepts the original falling mass
    // even while dry. Refill is supplied by that source, not fabricated water.
    expect(live.inflowDry).toBe(false); expect(live.solver.discharge).toBe(1.5);
    const volume = live.solver.volume(), out = live.solver.outVolume;
    const dt = live.solver.step();
    expect(live.solver.volume() - volume + live.solver.outVolume - out).toBeCloseTo(1.5 * dt, 8);
    live.solver.restoreState(water);
    live.advance(0, 0);
    expect(live.inflowDry).toBe(false); expect(live.solver.discharge).toBe(1.5);
  });

  it('progressively separates the main rapids from the preserved offshoot', () => {
    const course = defaultRiverCourse();
    const gaps = [20, 100, 250].map((u) => {
      const p = mainRapidsAt(MAIN_CHANNEL_S + u);
      return course.project(p.x, p.z).d;
    });
    expect(gaps[1]).toBeGreaterThan(gaps[0] + 15);
    expect(gaps[2]).toBeGreaterThan(gaps[1] + 30);
    expect(courseKeyAt(205).thalweg).toBe(-1.4);
    expect(designLevelAt(205)).toBeCloseTo(1.2);
  });

  it('connects the waterfall inlet to both east-edge outlets through wet cells', () => {
    const { nx, nz } = reach.grid;
    const seen = new Uint8Array(nx * nz);
    const queue = new Int32Array(nx * nz);
    let end = 0;
    const inflow = reachInflow(reach.grid, state.h0, reach.cellS, reach.cellN, reach.course, reach.dischargeM3S);
    for (const p of inflow.inflow) { if (!seen[p.c]) { seen[p.c] = 1; queue[end++] = p.c; } }
    for (let at = 0; at < end; at += 1) {
      const c = queue[at]; const i = c % nx; const j = Math.floor(c / nx);
      for (const next of [i > 0 ? c - 1 : -1, i < nx - 1 ? c + 1 : -1, j > 0 ? c - nx : -1, j < nz - 1 ? c + nx : -1]) {
        if (next < 0 || seen[next] || state.h0[next] <= 0.005) continue;
        seen[next] = 1; queue[end++] = next;
      }
    }
    let main = 0; let offshoot = 0;
    for (let j = 0; j < nz; j += 1) {
      const c = j * nx + nx - 1;
      if (!seen[c]) continue;
      if (reach.cellS[c] >= MAIN_CHANNEL_S) main += 1;
      else offshoot += 1;
    }
    expect(main).toBeGreaterThan(0);
    expect(offshoot).toBeGreaterThan(0);
  });

  it('starts flow into both branches without nonfinite water or momentum', () => {
    state.solver.setState(state.h0, state.u0, state.v0);
    for (let i = 0; i < 30; i += 1) state.solver.step();
    let mainFlow = 0; let offshootFlow = 0;
    let valid = true;
    for (let c = 0; c < state.h0.length; c += 1) {
      valid &&= Number.isFinite(state.solver.h[c]) && state.solver.h[c] >= 0
        && Number.isFinite(state.solver.hu[c]) && Number.isFinite(state.solver.hv[c]);
      if (state.solver.hu[c] <= 0 || state.solver.h[c] < 0.01) continue;
      if (reach.cellS[c] >= MAIN_CHANNEL_S) mainFlow += 1;
      else if (reach.cellS[c] > 0) offshootFlow += 1;
    }
    expect(valid).toBe(true);
    expect(mainFlow).toBeGreaterThan(100);
    expect(offshootFlow).toBeGreaterThan(100);
  }, 60000);

  it('keeps the main channel and its rocks in place when the offshoot width changes', () => {
    live.startCold();
    const p = mainRapidsAt(MAIN_CHANNEL_S + 265);
    const c = Math.floor((p.z - live.grid.z0) / live.grid.dx) * live.grid.nx
      + Math.floor((p.x - live.grid.x0) / live.grid.dx);
    const depth = live.solver.h[c];
    const rocks = live.boulders.filter((b) => (b.s ?? 0) >= MAIN_CHANNEL_S).map((b) => [b.x, b.z]);
    live.applyEdit({ shape: { widthScale: 1.1, depthScale: 1, dischargeM3S: 1.5 }, course: null });
    expect(live.solver.h[c]).toBe(depth);
    expect(live.boulders.filter((b) => (b.s ?? 0) >= MAIN_CHANNEL_S).map((b) => [b.x, b.z])).toEqual(rocks);
    live.applyEdit({ shape: { widthScale: 1, depthScale: 1, dischargeM3S: 1.5 }, course: null });
    expect(live.ground[c]).toBe(reach.ground[c]);
  }, 60000);

  it.each([
    { widthScale: 1, depthScale: 1, dischargeM3S: 12 },
    { widthScale: 0.6, depthScale: 2, dischargeM3S: 0.5 },
  ])('keeps the requested high and low flows healthy after initialization: %j', (shape) => {
    live.applyEdit({ shape, course: null }); live.startCold();
    let seconds = 0;
    while (seconds < 20) seconds += live.solver.step();
    expect(live.solver.health(25)).toMatchObject({ ok: true, badCells: 0 });
    expect(live.inflowDry).toBe(false);
    expect(live.solver.discharge).toBe(shape.dischargeM3S);
    expect(Array.from(live.solver.h).every((depth, c) => reach.cellS[c] >= -175 || depth === 0)).toBe(true);
  }, 60000);
});
