import { describe, expect, it } from 'vitest';
import { buildFlowMap, RIVER_FOAM } from '../riverFlowField';
import type { RiverSteadyField } from '../riverSolver';

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
