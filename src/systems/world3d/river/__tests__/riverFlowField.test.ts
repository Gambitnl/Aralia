import { describe, expect, it } from 'vitest';
import { buildFlowMap, flowMapCore, mainRiverSurfaceEnergy, RIVER_FOAM } from '../riverFlowField';
import type { RiverSteadyField } from '../riverSolver';
import { buildWaterSheetArrays } from '../riverWaterSheet';
import { LiveRiver, liveMapperPatchTransfer } from '../riverLive';
import { MAIN_CHANNEL_S, setRiverHeadwaters } from '../riverHeadwaters';

/**
 * A synthetic steady field: a straight channel along +x, 0.5 m cells, with
 * one fast shallow patch that breaks (Froude over 1.9) and slow deep water
 * everywhere else. It isolates the flow map from the solver.
 */
function field(opts: { patch: boolean; speed: number; depth: number }): RiverSteadyField {
  const nx = 120;
  const nz = 20;
  const dx = 0.5;
  const n = nx * nz;
  const h = new Float32Array(n);
  const u = new Float32Array(n);
  const v = new Float32Array(n);
  const bed = new Float32Array(n);
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const c = j * nx + i;
      const wall = j < 2 || j >= nz - 2;
      bed[c] = wall ? 3 : 0;
      if (wall) continue;
      h[c] = opts.depth;
      u[c] = opts.speed;
      if (opts.patch && i >= 20 && i < 24) {
        // 3 m/s over 0.2 m: F = 2.1, fully broken.
        h[c] = 0.2;
        u[c] = 3;
      }
    }
  }
  return {
    grid: { x0: 0, z0: 0, dx, nx, nz }, h, u, v, uRms: new Float32Array(n), bed,
    stats: { simSeconds: 0, steps: 0, qIn: 0, qOut: 0, dVdt: 0, volume: 0, maxSpeed: 0, activeCells: 0, breachCells: 0, wallMs: 0 },
  };
}

describe('riverFlowField: the flow map', () => {
  it('distinguishes a real deep level from an unavailable level at the old-100m sentinel',()=>{
    const wet=field({patch:false,speed:0,depth:.5});
    wet.bed.fill(-100.5);
    const map=buildFlowMap(wet),c=10*wet.grid.nx+50;
    expect(map.t0[c*4+3]).toBe(-100);
    expect(map.t1[c*4+3]).toBeGreaterThanOrEqual(0);
    const empty=field({patch:false,speed:0,depth:0});empty.bed.fill(-100.5);
    const dry=buildFlowMap(empty);
    expect(dry.t0[c*4+3]).toBe(-100);
    expect(dry.t1[c*4+3]).toBe(-1);
  });
  it.each([false, true])('keeps wet film triangles above their flat or sloping bed (sloping=%s)', (sloping) => {
    const f = field({ patch: false, speed: 0, depth: 0.0201 });
    const { nx, nz, dx } = f.grid;
    if (sloping) {
      // Use one affine bed plane so interpolation of terrain and water shares
      // the same triangles. Every corner must retain its actual water depth.
      for (let j = 2; j < nz - 2; j++) for (let i = 0; i < nx; i++) f.bed[j * nx + i] = 0.01 * i + 0.02 * j;
    }
    const cells = [10 * nx + 50, 10 * nx + 51, 11 * nx + 50, 11 * nx + 51];
    f.h[cells[0]] = 0.0199;
    const dryHollow = 10 * nx + 80;
    f.h[dryHollow] = 0;
    const before = { h: f.h.slice(), bed: f.bed.slice(), u: f.u.slice(), v: f.v.slice(), stats: { ...f.stats } };
    const map = buildFlowMap(f), sheet = buildWaterSheetArrays(f.grid, map.surface);
    const vertices = cells.map(c => {
      const x = f.grid.x0 + (c % nx + 0.5) * dx, z = f.grid.z0 + (Math.floor(c / nx) + 0.5) * dx;
      const vertex = Array.from({ length: sheet.pos.length / 3 }, (_, v) => v)
        .find(v => sheet.pos[v * 3] === x && sheet.pos[v * 3 + 2] === z);
      expect(vertex).toBeDefined();
      return vertex!;
    });
    const triangles: number[][] = [];
    for (let k = 0; k < sheet.index.length; k += 3) {
      const tri = Array.from(sheet.index.slice(k, k + 3));
      if (tri.every(v => vertices.includes(v))) triangles.push(tri);
    }
    const [a, b, c, d] = vertices;
    expect(triangles).toEqual([[a, c, b], [b, c, d]]);
    // A 19.9 mm wet corner beside 20.1 mm corners used to be tucked 3 cm
    // below terrain. Retaining its triangle alone did not prevent the cutout.
    cells.forEach((cell, corner) => {
      expect(map.surface[cell]).toBe(Math.fround(f.bed[cell] + f.h[cell]));
      expect(sheet.pos[vertices[corner] * 3 + 1] - f.bed[cell]).toBeCloseTo(f.h[cell], 6);
      expect(sheet.pos[vertices[corner] * 3 + 1]).toBeGreaterThan(f.bed[cell]);
    });
    // Changing the wet surface must preserve dry-bank hiding and reject a
    // dry hollow, without editing the hydraulic field or its accounting.
    const bank = nx + 50;
    expect(Number.isFinite(map.surface[bank])).toBe(true);
    expect(map.surface[bank]).toBeLessThanOrEqual(f.bed[bank] - 0.03);
    expect(Number.isNaN(map.surface[dryHollow])).toBe(true);
    expect({ h: f.h, bed: f.bed, u: f.u, v: f.v, stats: f.stats }).toEqual(before);
  });

  it('preserves actual Float32 wet membership at the 3 mm boundary', () => {
    const f = field({ patch: false, speed: 0, depth: 0.0201 });
    const below = 10 * f.grid.nx + 50, above = below + 1;
    // Decimal 0.003 rounds slightly above the strict wet threshold in
    // Float32. Its preceding representable value is the dry-side input.
    const encoded = new Float32Array([0.003]);
    const bits = new Uint32Array(encoded.buffer);
    const wetDepth = encoded[0];
    bits[0] -= 1;
    const dryDepth = encoded[0];
    expect(dryDepth).toBeLessThan(0.003);
    expect(wetDepth).toBeGreaterThan(0.003);
    f.h[below] = dryDepth; f.h[above] = wetDepth;
    const map = buildFlowMap(f);
    expect(Number.isNaN(map.surface[below])).toBe(true);
    expect(map.surface[above]).toBe(wetDepth);
    expect(map.t0[below * 4 + 2]).toBe(0);
    expect(map.t0[above * 4 + 2]).toBe(wetDepth);
  });

  it('uses accepted impact power and receiving depth for native aeration without a second footprint', () => {
    const grid = { x0: 0, z0: 0, dx: 1, nx: 12, nz: 12 }, n = 144, source = 78;
    const at = (depth: number, specificEnergy: number, discharge = 2) => {
      const h = new Float32Array(n).fill(depth), bed = new Float32Array(n);
      const impactEnergy = { receivingDepth: depth, fallSpecificEnergy: specificEnergy, radialSpecificEnergy: 0,
        dissipatedSpecificEnergy: specificEnergy, cells: [{ c: source, share: 1 }] };
      const foam = { kind: 'step' as const, dtS: 0.2, W: new Float32Array(n), T: new Float32Array(n), L: new Float32Array(n) };
      return flowMapCore({ grid, bed, h, u: new Float32Array(n), v: new Float32Array(n), uRms: new Float32Array(n),
        waterfallImpact: { x: 6.5, z: 6.5, width: 2, tx: 1, tz: 0, discharge, impactEnergy } }, bed, undefined, [], foam);
    };
    const shallow = at(1, 2), deep = at(4, 2), energetic = at(1, 8), higherFlow = at(1, 2, 4), stopped = at(1, 8, 0), dry = at(0, 8);
    expect(shallow.W[source]).toBeGreaterThan(deep.W[source]);
    expect(energetic.W[source]).toBeGreaterThan(shallow.W[source]);
    expect(higherFlow.W[source]).toBeGreaterThan(shallow.W[source]);
    expect(stopped.W.every(value => value === 0)).toBe(true);
    expect(dry.W.every(value => value === 0)).toBe(true);
    // At rest, new impact white water exists only on its actual mass cell;
    // downstream spread is the existing velocity transport's responsibility.
    expect(energetic.W.filter(value => value > 0).length).toBe(1);
    expect(energetic.T[source]).toBeGreaterThan(0);
  });

  it('keeps native maps identical while adding explicit headwater surface drivers', () => {
    const base = field({ patch: true, speed: 2, depth: 0.5 });
    const f = { ...base, grid: { ...base.grid, x0: 20, z0: 16 } };
    const legacy = buildFlowMap(f);
    // The distant accepted impact has no foam contribution in this box.
    // Its explicit frame input enables only the new main surface channels.
    const main = buildFlowMap({ ...f, waterfallImpact: { x: -150, z: 30, tx: 1, tz: 0, width: 10, discharge: 12 } });
    expect(main.t0).toEqual(legacy.t0);
    expect(main.t1).toEqual(legacy.t1);
    expect(main.surface).toEqual(legacy.surface);
    let energyCells = 0;
    for (let c = 0; c < f.h.length; c++) {
      expect(main.t2[c * 4]).toBe(legacy.t2[c * 4]);
      expect(main.t2[c * 4 + 1]).toBe(legacy.t2[c * 4 + 1]);
      expect(legacy.t2[c * 4 + 2]).toBe(0);
      expect(legacy.t2[c * 4 + 3]).toBe(0);
      if (main.t2[c * 4 + 3] > 0) energyCells++;
    }
    expect(energyCells).toBeGreaterThan(0);
  });

  it('keeps a uniform fast glide free of large forced waves despite friction', () => {
    const glide = { speed: 3, depth: 0.5, dissipation: 0.5, froude: 1.35,
      downSlope: 0.035, upSlope: 0, compression: 0, contact: 0, wake: 0, rockCover: 0, unsteadySpeed: 0 };
    const energy = mainRiverSurfaceEnergy(glide);
    expect(energy.forcing).toBe(0);
    expect(energy.breakingCover).toBe(0);
    expect(energy.microSlope).toBeGreaterThan(0);
    expect(energy.microSlope).toBeLessThanOrEqual(0.1);
    // A rising backwater surface without compression is not a breaking jump.
    expect(mainRiverSurfaceEnergy({ ...glide, upSlope: 0.2 }).forcing).toBe(0);
    expect(mainRiverSurfaceEnergy({ ...glide, upSlope: 0.2 }).breakingCover).toBe(0);
    expect(mainRiverSurfaceEnergy({ ...glide, downSlope: 0.3 }).forcing).toBe(1);
    expect(mainRiverSurfaceEnergy({ ...glide, upSlope: 0.2, compression: 1.3 }).forcing).toBe(1);
    expect(mainRiverSurfaceEnergy({ ...glide, contact: 0.9 }).forcing).toBe(0.9);
  });

  it('localizes main white water while retaining the original source and one native transport', () => {
    const base = field({ patch: false, speed: 3, depth: 0.2 });
    const f = { ...base, grid: { ...base.grid, x0: 20, z0: 16 }, waterfallImpact: { x: -150, z: 30, tx: 1, tz: 0, width: 10, discharge: 12 } };
    const legacy = buildFlowMap(f);
    const originalAddresses = new Float32Array(f.h.length);
    const mainAddresses = new Float32Array(f.h.length).fill(MAIN_CHANNEL_S + 45);
    const original = buildFlowMap({ ...f, cellS: originalAddresses });
    const main = buildFlowMap({ ...f, cellS: mainAddresses });
    const c = 10 * f.grid.nx + 50;
    // Uniform fast water has no local breaking feature. An original-owned
    // cell at the very same position still receives its legacy source.
    expect(legacy.t1[c * 4]).toBeGreaterThan(0.02);
    expect(main.t1[c * 4]).toBeLessThan(1e-5);
    expect(original.t1).toEqual(legacy.t1);
    expect(main.t0).toEqual(legacy.t0);
    expect(main.surface).toEqual(legacy.surface);
    for (let q = 0; q < f.h.length; q++) expect(main.t1[q * 4 + 3]).toBe(legacy.t1[q * 4 + 3]);
    // A real local drop generates a tongue, and the existing transport carries
    // it downstream before its native 1.3-second lifetime clears the bubbles.
    const patch = field({ patch: true, speed: 2, depth: 0.5 });
    const broken = buildFlowMap({ ...patch, grid: f.grid, waterfallImpact: f.waterfallImpact, cellS: mainAddresses });
    const at = (i: number) => broken.t1[(10 * f.grid.nx + i) * 4];
    expect(at(20)).toBeGreaterThan(0.04);
    expect(at(27)).toBeGreaterThan(0.001);
    expect(at(35)).toBeLessThan(at(27));
  });

  it('transfers mapper ownership copies without detaching the live solver addresses', () => {
    const live = new LiveRiver(20260928, true);
    try {
      const init = live.mapperInit();
      expect(init.cellS).toBeDefined();
      expect(init.cellS!.buffer).not.toBe(live.cellS.buffer);
      const originalLength = live.cellS.length, address = live.cellS[12345];
      const copy = structuredClone(init, { transfer: [init.cellS!.buffer] });
      expect(copy.cellS!.length).toBe(originalLength);
      expect(live.cellS.length).toBe(originalLength);
      expect(live.cellS[12345]).toBe(address);
      const patch = { box: null, ground: null, bed: null, manning: null, cellS: live.cellS.slice(0, 4), boulderMoves: new Float32Array(0) };
      const buffers = liveMapperPatchTransfer(patch);
      expect(buffers.filter(b => b === patch.cellS.buffer).length).toBe(1);
      structuredClone(patch, { transfer: buffers });
      expect(live.cellS.length).toBe(originalLength);
    } finally { setRiverHeadwaters(false); }
    // This constructs the actual 451,200-cell headwater solver; its startup
    // exceeds the small-unit-test budget under shared worker load.
  }, 30000);

  it('makes white water where the flow breaks and carries it downstream, fading over speed x life', () => {
    const f = field({ patch: true, speed: 2, depth: 0.5 });
    const map = buildFlowMap(f);
    const { nx } = f.grid;
    const j = 10;
    const at = (i: number): number => map.t1[(j * nx + i) * 4];
    const src = at(23);
    // The patch reaches its cover (the Froude term alone covers froudeCover).
    expect(src).toBeGreaterThan(0.6 * RIVER_FOAM.froudeCover);
    // Downstream it fades: 4 m further on at 2 m/s and a 2 s life is one
    // e-folding (upwind diffusion widens it, so the band is wide).
    const down = at(23 + 8);
    expect(down).toBeLessThan(src);
    expect(down / src).toBeGreaterThan(0.2);
    expect(down / src).toBeLessThan(0.6);
    // Upstream of the patch there is none.
    expect(at(10)).toBeLessThan(1e-3);
  });

  it('makes no white water in slow deep water', () => {
    const map = buildFlowMap(field({ patch: false, speed: 0.3, depth: 1.5 }));
    let max = 0;
    for (let c = 0; c < map.t1.length; c += 4) max = Math.max(max, map.t1[c]);
    expect(max).toBeLessThan(1e-6);
  });

  it('draws the surface at the water level, tucks it under the banks, and measures the distance to the water', () => {
    const f = field({ patch: false, speed: 0.5, depth: 0.8 });
    const map = buildFlowMap(f);
    const { nx } = f.grid;
    // In the water: the level.
    expect(map.surface[10 * nx + 50]).toBeCloseTo(0.8, 5);
    // One row into the bank (bed 3 m): the sheet runs on, under the bank.
    const under = map.surface[1 * nx + 50];
    expect(Number.isNaN(under)).toBe(false);
    expect(under).toBeLessThan(3);
    // Distance to the water: 0 in it, one cell (0.5 m) per ring outside.
    expect(map.t1[(10 * nx + 50) * 4 + 2]).toBe(0);
    expect(map.t1[(1 * nx + 50) * 4 + 2]).toBeCloseTo(0.5, 6);
  });

  it("puts white water at a rock's upstream face and carries it downstream as a tongue (rivers round 2)", () => {
    // 1.2 m/s over 0.4 m (F = 0.6, no Froude term; friction dissipation under
    // its threshold): the only source is the rock.
    const f = field({ patch: false, speed: 1.2, depth: 0.4 });
    const { nx } = f.grid;
    const ground = Float32Array.from(f.bed);
    for (const c of [9 * nx + 60, 9 * nx + 61, 10 * nx + 60, 10 * nx + 61, 11 * nx + 60, 11 * nx + 61]) {
      f.bed[c] = 1.5;
      f.h[c] = 0;
      f.u[c] = 0;
    }
    const map = buildFlowMap(f, ground);
    const W = (i: number, j: number): number => map.t1[(j * nx + i) * 4];
    // At the upstream face (one and two cells out): white.
    expect(Math.max(W(59, 10), W(58, 10))).toBeGreaterThan(0.3);
    // Beside the rock, downstream: the tongue carries on and fades.
    const tongue = Math.max(W(64, 12), W(64, 8));
    expect(tongue).toBeGreaterThan(0.02);
    // Far upstream, on the open channel: none.
    expect(W(30, 10)).toBeLessThan(0.005);
  });

  it('makes a turbulence field that paints no foam and stays low in slow deep water (rivers round 2)', () => {
    const slow = buildFlowMap(field({ patch: false, speed: 0.2, depth: 1.5 }));
    let maxT = 0;
    for (let c = 0; c < slow.t1.length; c += 4) maxT = Math.max(maxT, slow.t1[c + 3]);
    expect(maxT).toBeLessThan(0.05);
    // Fast shallow water: the surface is broken (turbulence), but only the
    // breaking patch makes white water.
    const fast = buildFlowMap(field({ patch: true, speed: 2, depth: 0.3 }));
    const nx = 120;
    expect(fast.t1[(10 * nx + 80) * 4 + 3]).toBeGreaterThan(0.3);
  });

  it('shapes the water around an emergent rock: a pillow upstream, a trough in the lee, a V-wake (rivers round 3)', () => {
    const f = field({ patch: false, speed: 1.5, depth: 0.5 });
    const { nx, dx } = f.grid;
    const ground = Float32Array.from(f.bed);
    // A 0.6 m rock standing 0.3 m out of the water at x = 30 m, z = 5 m.
    const rock = { x: 30, z: 5, y: 0.4, rx: 0.6, ry: 0.4, rz: 0.6 };
    for (let j = 0; j < f.grid.nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const x = (i + 0.5) * dx;
        const z = (j + 0.5) * dx;
        if ((x - rock.x) ** 2 + (z - rock.z) ** 2 < rock.rx ** 2) {
          const c = j * nx + i;
          f.bed[c] = 0.8;
          f.h[c] = 0;
          f.u[c] = 0;
        }
      }
    }
    const map = buildFlowMap(f, ground, undefined, [rock]);
    const at = (x: number, z: number, k: number): number => map.t2[(Math.floor(z / dx) * nx + Math.floor(x / dx)) * 4 + k];
    // Pillow: the water stands up in front of the rock (U^2/2g at 1.5 m/s is
    // 0.11 m; 90 % of it at the crest).
    expect(at(29.1, 5.2, 0)).toBeGreaterThan(0.03);
    // Trough in its lee.
    expect(at(31.3, 5.2, 0)).toBeLessThan(0);
    // The V's ridges leave the flanks downstream at about 34 degrees (a
    // subcritical flow's short-crested V): 2.5 m downstream they stand about
    // 2.2 m off the centerline, and the centerline itself carries none.
    let ridge = 0;
    for (let z = 1.5; z < 8.5; z += 0.5) if (Math.abs(z - 5) > 1.2) ridge = Math.max(ridge, at(32.5, z, 1));
    expect(ridge).toBeGreaterThan(0.2);
    expect(at(32.5, 5.1, 1)).toBeLessThan(0.05);
    // White water starts at the rock's face.
    expect(map.t1[(Math.floor(5.2 / dx) * nx + Math.floor(29.1 / dx)) * 4]).toBeGreaterThan(0.2);
  });

  it('runs the water on over a rock footprint at the level around it', () => {
    const f = field({ patch: false, speed: 0.5, depth: 0.8 });
    const { nx } = f.grid;
    // A rock: bed raised over the water at four cells.
    const ground = Float32Array.from(f.bed);
    for (const c of [10 * nx + 60, 10 * nx + 61, 11 * nx + 60, 11 * nx + 61]) {
      f.bed[c] = 1.5;
      f.h[c] = 0;
      f.u[c] = 0;
    }
    const map = buildFlowMap(f, ground);
    expect(map.surface[10 * nx + 60]).toBeCloseTo(0.8, 5);
  });
});
