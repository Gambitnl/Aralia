/** Manufactured controls isolate conservative ownership and swept contact.
 * Native rendered realism remains a separate acceptance check. */
import { describe, expect, it } from 'vitest';
import { RiverFlowSolver } from '../riverSolver';
import { RiverSpillTransfer } from '../riverSpillTransfer';
import { LiveRiver, LiveFlowMapper } from '../riverLive';
import { setRiverHeadwaters } from '../riverHeadwaters';
import { setRiverShape } from '../riverReach';

const grid = { x0: 0, z0: 0, dx: .5, nx: 30, nz: 3 };
function packet(speed = 2, lateral = .3) {
  const transfer = new RiverSpillTransfer(grid, [{ from: 34, to: 35, axis: 'x' }]);
  const bed = new Float64Array(90); bed[34] = 4;
  const h = new Float64Array(90); h[34] = .5;
  const u = new Float64Array(90); u[34] = speed;
  const v = new Float64Array(90); v[34] = lateral;
  // The outgoing control flux includes a separately known pressure term.
  const mass = .5 * speed, advective = mass * speed, pressure = .5 * 9.81 * .5 ** 2;
  const departed = transfer.launch(34, 35, 'x', mass, advective + pressure, mass * lateral, h, bed, u, v, 0, .1);
  return { transfer, departed, bed, h, u, v, pressure, volume: mass * .5 * .1 };
}
function solver(transfer?: RiverSpillTransfer, sleepingReceivers = false) {
  const bed = new Float64Array(90), h = new Float64Array(90), u = new Float64Array(90);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 30; i++) {
    const c = j * 30 + i; bed[c] = j === 1 ? (i < 5 ? 4 : 0) : 12;
    if (j === 1 && i < 5) { h[c] = .5; u[c] = 2; }
  }
  const ceiling = sleepingReceivers ? Float64Array.from(bed, (b, c) => c >= 30 && c < 35 ? 5 : -1) : undefined;
  const result = new RiverFlowSolver({ grid, bed, manning: new Float32Array(90), dischargeM3S: 0,
    inflow: [], inflowDir: [1, 0], inflowSpeedMS: 0, outflowEdge: 'east', maxDtS: .01 }, ceiling);
  result.setState(h, u); if (transfer) result.setSpillTransfer(transfer);
  return result;
}
describe('native spill conservative transport', () => {
  it('checks escaped airborne water without changing retained packet history',()=>{
    const f=packet(20,0);
    const before=f.transfer.saveState();
    expect(f.transfer.hasAirborneOutsideGrid()).toBe(false);
    expect(f.transfer.saveState()).toEqual(before);
    f.transfer.advance(1,()=>null,()=>{throw Error('No supported receiver');});
    const escaped=f.transfer.saveState();
    expect(f.transfer.hasAirborneOutsideGrid()).toBe(true);
    expect(f.transfer.saveState()).toEqual(escaped);
    expect(escaped.packets.some(p=>p.position[0]>=grid.nx*grid.dx)).toBe(true);
  });
  it('carries donor velocity and separates pressure from transported momentum', () => {
    const f = packet(); expect(f.departed).toBe(1);
    const p = f.transfer.snapshot().packets[0], r = f.transfer.receipt();
    expect(p.releaseVelocity).toEqual([2, 0, .3]);
    expect(p.volume).toBeCloseTo(f.volume, 14);
    expect(r.releasedMomentum).toEqual([f.volume * 2, 0, f.volume * .3]);
    expect(r.pressureBoundaryImpulse[0]).toBeCloseTo(-f.pressure * .5 * .1, 14);
    expect(r.pressureBoundaryImpulse[2]).toBeCloseTo(0, 14);
  });
  it('retains water in flight, then returns once at real gravity contact with momentum', () => {
    const f = packet(), returned: number[] = [], momenta: number[][] = [];
    const surface = () => ({ cell: 40, level: 0 });
    f.transfer.advance(.3, surface, (c, volume, v) => { returned.push(volume); momenta.push(v); });
    expect(returned).toHaveLength(0); expect(f.transfer.receipt().airborneVolume).toBeCloseTo(f.volume);
    f.transfer.advance(2, surface, (c, volume, v) => { returned.push(volume); momenta.push(v); });
    expect(returned).toEqual([f.volume]); expect(momenta).toEqual([[2, 0, .3]]);
    f.transfer.advance(3, surface, () => { throw Error('duplicate arrival'); });
    const r = f.transfer.receipt(); expect(r.volumeError).toBeCloseTo(0, 14);
    for (const e of r.momentumError) expect(e).toBeCloseTo(0, 10);
    expect(r.landingReaction[1]).toBeGreaterThan(0);
    const contactAge = Math.sqrt(2 * 4.25 / 9.81);
    expect(r.gravityImpulse[1]).toBeCloseTo(-f.volume * 9.81 * contactAge, 8);
  });
  it('drags a tall fall past break-up, and keeps the ledger closed with the air drag impulse (GG-572)', () => {
    // A slow 50 m fall of Steinsdalsfossen's sheet (0.08 m deep at 1 m/s): the
    // jet breaks up after about 3 m, then falls as a drop cloud.
    const fall = (airDrag: boolean) => {
      const transfer = new RiverSpillTransfer(grid, [{ from: 34, to: 35, axis: 'x' }], 9.81, { airDrag });
      const bed = new Float64Array(90); bed[34] = 4;
      const h = new Float64Array(90); h[34] = .08;
      const u = new Float64Array(90); u[34] = 1;
      const mass = .08 * 1;
      transfer.launch(34, 35, 'x', mass, mass + .5 * 9.81 * .08 ** 2, 0, h, bed, u, new Float64Array(90), 0, .1);
      const flying: number[] = [];
      let arrived = transfer.snapshot().arrived[0];
      for (let t = .5; t <= 6; t += .5) {
        transfer.advance(t, () => ({ cell: 40, level: -46 }), () => {});
        const s = transfer.snapshot();
        if (s.packets[0]) flying.push(s.packets[0].breakAge ?? -1);
        arrived ??= s.arrived[0];
      }
      return { r: transfer.receipt(), arrived, flying };
    };
    const free = fall(false), dragged = fall(true);
    const freeAge = Math.sqrt(2 * 50.04 / 9.81);
    expect(free.arrived.age).toBeCloseTo(freeAge, 6);
    expect(free.r.airDragImpulse).toEqual([0, 0, 0]);
    // Drag: a later landing, a slower impact, and a break-up age on the way down.
    expect(dragged.arrived.age).toBeGreaterThan(freeAge + .05);
    expect(-dragged.arrived.velocity[1]).toBeLessThan(-free.arrived.velocity[1] - 2);
    expect(dragged.arrived.velocity[0]).toBeLessThan(1);
    expect(dragged.flying.some(b => b > 0)).toBe(true);
    expect(dragged.r.airDragImpulse[1]).toBeGreaterThan(0);
    for (const r of [free.r, dragged.r]) {
      expect(r.volumeError).toBeCloseTo(0, 14);
      for (const e of r.momentumError) expect(e).toBeCloseTo(0, 10);
    }
  });
  it('preserves release history and obtains distinct local-current arcs after shutoff', () => {
    const slow = packet(.2), fast = packet(4);
    for (const f of [slow, fast]) f.transfer.advance(.55, () => ({ cell: 40, level: 0 }), () => { throw Error('early contact'); });
    const a = slow.transfer.snapshot().packets[0], b = fast.transfer.snapshot().packets[0];
    expect(b.position[0] - b.releasePosition[0]).toBeCloseTo(2);
    expect(a.position[0] - a.releasePosition[0]).toBeCloseTo(.1);
    expect(a.position[1]).toBeCloseTo(b.position[1]);
    expect(a.birth).toBe(.05); expect(a.age).toBe(.5);
    const before = fast.transfer.receipt().releasedVolume;
    fast.transfer.setFaces([]); // Shutoff affects future departures only.
    fast.transfer.advance(.7, () => ({ cell: 40, level: 0 }), () => {});
    expect(fast.transfer.receipt().releasedVolume).toBe(before);
    expect(fast.transfer.snapshot().packets[0].releaseVelocity).toEqual(b.releaseVelocity);
  });
  it.each([
    { from: 35, to: 34, axis: 'x' as const, ux: -2, uz: .3, sign: -1 },
    { from: 34, to: 64, axis: 'z' as const, ux: .3, uz: 2, sign: 1 },
  ])('keeps transported and reacted momentum separate for oriented face %j', f => {
    const t = new RiverSpillTransfer(grid, [f]), h = new Float64Array(90), bed = new Float64Array(90), u = new Float64Array(90), v = new Float64Array(90);
    h[f.from] = .5; bed[f.from] = 4; u[f.from] = f.ux; v[f.from] = f.uz;
    const cL = Math.min(f.from, f.to), cR = Math.max(f.from, f.to), q = f.sign;
    const pressure = .5 * 9.81 * .25;
    expect(t.launch(cL, cR, f.axis, q, 2 + pressure, q * .3, h, bed, u, v, 0, .1)).toBe(f.sign);
    expect(t.snapshot().packets[0].releaseVelocity).toEqual([f.ux, 0, f.uz]);
    const r = t.receipt(), normal = f.axis === 'x' ? 0 : 2;
    expect(r.pressureBoundaryImpulse[normal]).toBeCloseTo(-f.sign * pressure * .05, 12);
    t.advance(2, () => ({ cell: f.to, level: 0 }), () => {});
    for (const e of t.receipt().momentumError) expect(e).toBeCloseTo(0, 10);
  });
  it('sweeps into a raised terrain obstruction and latest edited water surface', () => {
    const f = packet(4); let landingCell = -1;
    f.transfer.advance(.9, (x) => ({ cell: x >= 3 ? 41 : 40, level: x >= 3 ? 4 : 0 }), c => { landingCell = c; });
    expect(landingCell).toBe(41); expect(f.transfer.receipt().airborneVolume).toBe(0);
    const edited = packet(); edited.transfer.advance(.15, () => ({ cell: 40, level: 0 }), () => {});
    edited.transfer.advance(.2, () => ({ cell: 42, level: 5 }), c => { landingCell = c; });
    expect(landingCell).toBe(42);
  });
  it('lands a parcel that hits the side of a higher step below it, not on top', () => {
    // From x 2.5 at 4.25 m, 4 m/s east; at x 3 a step stands at 10 m.
    const f = packet(4, 0); let landed = -1, level = NaN;
    f.transfer.advance(2, (x) => (x >= 3 ? { cell: 41, level: 10 } : { cell: 40, level: 0 }), (c) => { landed = c; });
    expect(landed).toBe(40);
    const a = f.transfer.snapshot().arrived[0]; level = a.position[1];
    expect(level).toBe(0);
    expect(a.position[0]).toBeLessThan(3);
    const r = f.transfer.receipt();
    expect(r.volumeError).toBeCloseTo(0, 14);
    for (const e of r.momentumError) expect(e).toBeCloseTo(0, 10);
  });
  it('keeps submerged, dry and backward faces in ordinary SWE', () => {
    for (const condition of ['submerged', 'dry', 'backward']) {
      const f = packet(), t = new RiverSpillTransfer(grid, [{ from: 34, to: 35, axis: 'x' }]);
      if (condition === 'submerged') f.h[35] = 5;
      if (condition === 'dry') f.h[34] = 0;
      if (condition === 'backward') f.u[34] = -2;
      expect(t.launch(34, 35, 'x', 1, 3, .3, f.h, f.bed, f.u, f.v, 0, .1)).toBe(0);
      expect(t.snapshot().packets).toHaveLength(0);
      expect(t.snapshot().exposedFaces).toEqual([]);
    }
    // A previously detached face becomes attached again when submerged,
    // while its already released water retains airborne ownership.
    const prior = packet(); expect(prior.transfer.snapshot().exposedFaces).toHaveLength(1);
    prior.transfer.beginStep(); prior.h[35] = 5;
    expect(prior.transfer.launch(34, 35, 'x', 1, 3, .3, prior.h, prior.bed, prior.u, prior.v, .1, .1)).toBe(0);
    expect(prior.transfer.snapshot().exposedFaces).toEqual([]);
    expect(prior.transfer.snapshot().packets).toHaveLength(1);
  });
  it('cuts every native outgoing diagonal face once without a remaining attached leak', () => {
    const g = { x0: 0, z0: 0, dx: .5, nx: 20, nz: 20 }, size = 400;
    const bed = new Float64Array(size), h = new Float64Array(size), u = new Float64Array(size), v = new Float64Array(size);
    const faces: Array<{ from: number; to: number; axis: 'x' | 'z' }> = [];
    for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) {
      const c = j * 20 + i, wall = i === 0 || j === 0 || i === 19 || j === 19;
      bed[c] = wall ? 12 : i + j < 12 ? 4 : 0;
      if (!wall && i + j < 12) { h[c] = .5; u[c] = 1.4; v[c] = 1.2; }
      if (!wall && i + j === 11) {
        faces.push({ from: c, to: c + 1, axis: 'x' }, { from: c, to: c + 20, axis: 'z' });
      }
    }
    const make = () => {
      const s = new RiverFlowSolver({ grid: g, bed, manning: new Float32Array(size), dischargeM3S: 0,
        inflow: [], inflowDir: [1, 0], inflowSpeedMS: 0, outflowEdge: 'east', maxDtS: .01 });
      s.setState(h, u, v); return s;
    };
    const transfer = new RiverSpillTransfer(g, faces), native = make(), coupled = make();
    coupled.setSpillTransfer(transfer); const initial = coupled.volume();
    expect(native.step()).toBe(coupled.step());
    const snapshot = transfer.snapshot();
    expect(snapshot.exposedFaces).toHaveLength(faces.length);
    expect(new Set(snapshot.packets.map(p => p.faceId)).size).toBe(faces.length);
    // No outgoing cut volume can remain in the terrain-following receiver.
    const leaked = coupled.h.reduce((sum, d, c) => sum + (bed[c] === 0 ? d : 0), 0);
    expect(leaked).toBeCloseTo(0, 12);
    expect(coupled.totalWetPlusAirVolume()).toBeCloseTo(initial, 11);
    const referenceP = native.wetMomentum(), gridP = coupled.wetMomentum(), r = transfer.receipt();
    for (let axis = 0; axis < 3; axis++) expect(gridP[axis] + r.airborneMomentum[axis] - referenceP[axis])
      .toBeCloseTo(r.pressureBoundaryImpulse[axis] + r.gravityImpulse[axis] + r.landingReaction[axis], 11);
    while (coupled.time < 1.5) {
      coupled.step(); expect(coupled.totalWetPlusAirVolume() + coupled.outVolume).toBeCloseTo(initial, 10);
      expect(coupled.health(100).ok).toBe(true);
    }
    expect(transfer.receipt().returnedVolume).toBeGreaterThan(0);
  });
  it('conserves actual wet plus airborne mass across native solver faces and landings', () => {
    const t = new RiverSpillTransfer(grid, [{ from: 34, to: 35, axis: 'x' }]), s = solver(t), initial = s.volume();
    let inFlight = false, landed = false;
    while (s.time < 2) {
      s.step(); inFlight ||= t.receipt().airborneVolume > 0; landed ||= t.receipt().returnedVolume > 0;
      expect(s.totalWetPlusAirVolume() + s.outVolume - s.inVolume).toBeCloseTo(initial, 10);
      expect(s.health(100).ok).toBe(true);
    }
    expect(inFlight).toBe(true); expect(landed).toBe(true);
  });
  it('independently accounts for native momentum removed at the intercepted face', () => {
    const t = new RiverSpillTransfer(grid, [{ from: 34, to: 35, axis: 'x' }]), native = solver(), coupled = solver(t);
    // Same initial state and native face solve; only receiver ownership differs.
    // Zero Manning eliminates an unrelated velocity-dependent bed force.
    expect(native.step()).toBe(coupled.step());
    const reference = native.wetMomentum(), wet = coupled.wetMomentum(), r = t.receipt();
    expect(r.airborneVolume).toBeGreaterThan(0);
    for (let axis = 0; axis < 3; axis++) {
      const actual = wet[axis] + r.airborneMomentum[axis] - reference[axis];
      const reacted = r.pressureBoundaryImpulse[axis] + r.gravityImpulse[axis] + r.landingReaction[axis];
      expect(actual).toBeCloseTo(reacted, 12);
    }
  });
  it('restores wet and airborne owners together without replaying departures', () => {
    const t = new RiverSpillTransfer(grid, [{ from: 34, to: 35, axis: 'x' }]), s = solver(t);
    for (let i = 0; i < 5; i++) s.step();
    const saved = s.saveState(), volume = s.totalWetPlusAirVolume(), packets = t.snapshot();
    for (let i = 0; i < 5; i++) s.step();
    s.restoreState(saved); expect(s.totalWetPlusAirVolume()).toBeCloseTo(volume, 12); expect(t.snapshot()).toEqual(packets);
    expect(s.time).toBe(saved.time);
    const oldIn = s.inVolume, oldOut = s.outVolume;
    for (let i = 0; i < 20; i++) s.step();
    expect(s.totalWetPlusAirVolume() + s.outVolume - oldOut - (s.inVolume - oldIn)).toBeCloseTo(volume, 10);
  });
  it('wakes the actual dormant receiving cell without cutting off arrived water', () => {
    const t = new RiverSpillTransfer(grid, [{ from: 34, to: 35, axis: 'x' }]), s = solver(t, true);
    const initial = s.volume(), active = s.activeCells;
    while (s.time < 1.5) s.step();
    expect(t.receipt().returnedVolume).toBeGreaterThan(0);
    expect(s.activeCells).toBeGreaterThan(active);
    expect(s.totalWetPlusAirVolume() + s.outVolume).toBeCloseTo(initial, 10);
  });
  it('preserves opt-out output bit for bit when no spill faces are enabled', () => {
    const a = solver(), b = solver(new RiverSpillTransfer(grid, []));
    for (let i = 0; i < 30; i++) { expect(a.step()).toBe(b.step()); }
    expect(a.h).toEqual(b.h); expect(a.hu).toEqual(b.hu); expect(a.hv).toEqual(b.hv);
  });
  it('finds current native plateau faces and serializes real owned flight', () => {
    try {
      const live = new LiveRiver(20260928, true, true); live.startCold();
      const initial = live.solver.totalWetPlusAirVolume(), before = live.solver.inVolume - live.solver.outVolume;
      live.advance(Infinity, 1.5);
      const frame = structuredClone(live.frame());
      expect(frame.spill!.receipt.releasedVolume).toBeGreaterThan(0);
      expect(frame.spill!.receipt.totalWetPlusAirVolume).toBeCloseTo(frame.volume, 10);
      expect(frame.spill!.receipt.volumeError).toBeCloseTo(0, 9);
      expect(frame.spill!.packets.length + frame.spill!.arrived.length).toBeGreaterThan(0);
      expect(frame.volume - (live.solver.inVolume - live.solver.outVolume - before)).toBeCloseTo(initial, 7);
      for (const p of frame.spill!.packets) {
        expect(p.birth).toBeLessThanOrEqual(frame.spill!.time);
        expect(p.position[1]).toBeLessThanOrEqual(p.releasePosition[1]);
        expect(p.releaseVelocity[0]).not.toBe(0);
      }
      // The second worker passes owned flight through unchanged, using a
      // small receiving fixture to isolate serialization from full-map cost.
      const small = solver(), n = grid.nx * grid.nz;
      const mapper = new LiveFlowMapper({ grid, ground: Float32Array.from(small.bed), bed: Float32Array.from(small.bed),
        manning: new Float32Array(n), boulders: [], W: new Float32Array(n), T: new Float32Array(n), L: new Float32Array(n) });
      const mapped = mapper.map({ ...frame, waterfallImpact: null, waterfallLanding: null,
        h: Float32Array.from(small.h), u: new Float32Array(n), v: new Float32Array(n), uRms: new Float32Array(n) });
      expect(mapped.spill).toEqual(frame.spill); expect(mapped.spill).not.toBe(frame.spill);
      // Recovery rolls back both owners and the same simulation epoch.
      live.checkHealth(); const savedVolume = live.solver.totalWetPlusAirVolume(), saved = live.frame().spill;
      const activeDonor = (frame.spill!.packets[0] ?? frame.spill!.arrived[0]).from;
      live.solver.h[activeDonor] = NaN; live.checkHealth();
      expect(live.solver.totalWetPlusAirVolume()).toBeCloseTo(savedVolume, 9);
      expect(live.frame().spill).toEqual(saved);
    } finally { setRiverHeadwaters(false); setRiverShape(null); }
  }, 60000);
});

// DETECTED LIPS (2026-10-21): no face list. The transfer tests each native
// face against the free flight of its donor water (RiverSpillTransfer.separates).
describe('detected lips from the bed and the water', () => {
  /** One row of 30 cells (row 1 of the 30 x 3 grid), donor at cell 34. */
  function line(beds: Record<number, number>, speed: number, depth = .2, wetBack = true) {
    const bed = new Float64Array(90), h = new Float64Array(90), u = new Float64Array(90), v = new Float64Array(90);
    for (const [c, b] of Object.entries(beds)) bed[Number(c)] = b;
    h[34] = depth; u[34] = speed; if (wetBack) { h[33] = depth; u[33] = speed; }
    const t = new RiverSpillTransfer(grid, [], 9.81, { detect: true });
    const mass = depth * speed;
    return { t, sign: t.launch(34, 35, 'x', mass, mass * speed, 0, h, bed, u, v, 0, .1), bed, h, u, v };
  }
  it('launches flat-crest water over a cliff with no vertical speed', () => {
    const f = line({ 33: 4, 34: 4 }, 1);
    expect(f.sign).toBe(1);
    expect(f.t.snapshot().packets[0].releaseVelocity).toEqual([1, 0, 0]);
    expect(f.t.snapshot().exposedFaces).toEqual([{ from: 34, to: 35, axis: 'x' }]);
  });
  it('keeps water on a straight steep slope, as on a spillway face', () => {
    // 0.8 m per m: drop 0.4 m per cell, but the jet would fall 0.707 m.
    expect(line({ 32: 4.8, 33: 4.4, 34: 4, 35: 3.6 }, 2).sign).toBe(0);
  });
  it('launches at a convex lip with the downward speed of the slope above it', () => {
    const f = line({ 33: 4.2, 34: 4, 35: 2 }, 2);
    expect(f.sign).toBe(1);
    const p = f.t.snapshot().packets[0];
    // The speed turns down the 0.4 slope and keeps its size of 2 m/s.
    const cosT = 1 / Math.sqrt(1 + .4 * .4);
    expect(p.releaseVelocity[0]).toBeCloseTo(2 * cosT, 12);
    expect(p.releaseVelocity[1]).toBeCloseTo(-2 * .4 * cosT, 12);
    expect(Math.hypot(...p.releaseVelocity)).toBeCloseTo(2, 12);
    // It lands at the analytic time and the ledger closes with vertical speed.
    let landed = 0;
    f.t.advance(3, () => ({ cell: 40, level: 0 }), (_c, volume) => { landed += volume; });
    const r = f.t.receipt(), w0 = p.releaseVelocity[1], y0 = 4.1, age = (w0 + Math.sqrt(w0 * w0 + 2 * 9.81 * y0)) / 9.81;
    expect(landed).toBeCloseTo(p.volume, 14);
    expect(r.volumeError).toBeCloseTo(0, 14);
    for (const e of r.momentumError) expect(e).toBeCloseTo(0, 10);
    expect(r.landingReaction[1]).toBeCloseTo(-p.volume * (w0 - 9.81 * age), 6);
  });
  it('never releases faster than the solver speed on a near-vertical face', () => {
    // Slope 8 behind the donor (the Seven Sisters face); an 8 m drop ahead.
    const f = line({ 33: 8, 34: 4, 35: -4 }, 40);
    expect(f.sign).toBe(1);
    const p = f.t.snapshot().packets[0];
    expect(Math.hypot(...p.releaseVelocity)).toBeCloseTo(40, 10);
    expect(p.releaseVelocity[1]).toBeLessThan(-39);
  });
  it('ignores the slope behind a dry donor neighbor', () => {
    const f = line({ 33: 4.2, 34: 4, 35: 2 }, 2, .2, false);
    expect(f.sign).toBe(1);
    expect(f.t.snapshot().packets[0].releaseVelocity[1]).toBe(0);
  });
  it('lets slow water step down a small ledge but fast water jump it', () => {
    expect(line({ 33: 4, 34: 4, 35: 3.7 }, .5).sign).toBe(0);
    expect(line({ 33: 4, 34: 4, 35: 3.7 }, 4).sign).toBe(1);
  });
  it('keeps a ledge lower than the flow depth in ordinary SWE', () => {
    expect(line({ 33: 4, 34: 4, 35: 3.85 }, 4, .2).sign).toBe(0);
  });
  it('merges the releases of one face inside the window and keeps the ledger exact', () => {
    const bed = new Float64Array(90), h = new Float64Array(90), u = new Float64Array(90), v = new Float64Array(90);
    bed[33] = 4; bed[34] = 4; h[33] = h[34] = .2; u[33] = u[34] = 1;
    const t = new RiverSpillTransfer(grid, [], 9.81, { detect: true }), ground = () => ({ cell: 40, level: 0 });
    const step = (time: number, speed: number) => {
      u[34] = speed; t.beginStep();
      expect(t.launch(34, 35, 'x', .2 * speed, .2 * speed * speed, 0, h, bed, u, v, time, .04)).toBe(1);
      t.advance(time + .04, ground, () => { throw Error('early contact'); });
    };
    step(0, 1); step(.04, 2);
    // Same face, 0.08 s of release: one parcel; volume and momentum add.
    const merged = t.snapshot().packets;
    expect(merged).toHaveLength(1);
    expect(merged[0].volume).toBeCloseTo((.2 + .4) * .5 * .04, 14);
    expect(merged[0].releaseVelocity[0]).toBeCloseTo((.004 * 1 + .008 * 2) / .012, 12);
    expect(merged[0].releaseDuration).toBeCloseTo(.08, 14);
    for (const e of t.receipt().momentumError) expect(e).toBeCloseTo(0, 12);
    // The next release would make the span 0.12 s: the face opens a new parcel.
    step(.08, 2);
    expect(t.snapshot().packets).toHaveLength(2);
    for (const e of t.receipt().momentumError) expect(e).toBeCloseTo(0, 12);
    t.advance(5, ground, () => {});
    const r = t.receipt();
    expect(r.airborneVolume).toBe(0); expect(r.volumeError).toBeCloseTo(0, 14);
    for (const e of r.momentumError) expect(e).toBeCloseTo(0, 10);
  });
  it('finds the cliff in the native solver with no face list and conserves mass', () => {
    const t = new RiverSpillTransfer(grid, [], 9.81, { detect: true }), s = solver(t), initial = s.volume();
    let launched = false, landed = false;
    while (s.time < 2) {
      s.step(); launched ||= t.receipt().releasedVolume > 0; landed ||= t.receipt().returnedVolume > 0;
      expect(s.totalWetPlusAirVolume() + s.outVolume - s.inVolume).toBeCloseTo(initial, 10);
      expect(s.health(100).ok).toBe(true);
    }
    expect(launched).toBe(true); expect(landed).toBe(true);
    for (const e of t.receipt().momentumError) expect(e).toBeCloseTo(0, 9);
  });
});
