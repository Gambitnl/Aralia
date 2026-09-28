import { describe, expect, it } from 'vitest';
import { RiverFlowSolver, type InflowCell, type RiverSolverGrid } from '../riverSolver';

/** A straight channel along +x: `wide` cells of floor between two high walls, sloping down. */
function channel(nx: number, wide: number, dx: number, slope: number, n = 0.03) {
  const nz = wide + 2;
  const grid: RiverSolverGrid = { x0: 0, z0: 0, dx, nx, nz };
  const bed = new Float64Array(nx * nz);
  const manning = new Float32Array(nx * nz).fill(n);
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const wall = j === 0 || j === nz - 1;
      bed[j * nx + i] = (nx - i) * dx * slope + (wall ? 5 : 0);
    }
  }
  return { grid, bed, manning };
}

describe('riverSolver: shallow water with momentum', () => {
  it('keeps still water still over an uneven bed (well-balanced)', () => {
    const nx = 40;
    const nz = 30;
    const dx = 0.5;
    const bed = new Float64Array(nx * nz);
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        // A bowl with bumps; its rim stands over the water everywhere.
        const x = (i - nx / 2) * dx;
        const z = (j - nz / 2) * dx;
        bed[j * nx + i] = 0.02 * (x * x + z * z) + 0.3 * Math.sin(x * 1.3) * Math.cos(z * 0.9);
      }
    }
    const solver = new RiverFlowSolver({
      grid: { x0: 0, z0: 0, dx, nx, nz }, bed, manning: new Float32Array(nx * nz).fill(0.03),
      dischargeM3S: 0, inflow: [], inflowDir: [1, 0], inflowSpeedMS: 0, outflowEdge: 'east',
    });
    const level = 1.2;
    const h0 = Float64Array.from(bed, (b) => Math.max(0, level - b));
    solver.setState(h0);
    const v0 = solver.volume();
    for (let k = 0; k < 300; k += 1) solver.step();
    let maxQ = 0;
    for (let c = 0; c < nx * nz; c += 1) maxQ = Math.max(maxQ, Math.abs(solver.hu[c]), Math.abs(solver.hv[c]));
    expect(maxQ).toBeLessThan(1e-9);
    expect(Math.abs(solver.volume() - v0)).toBeLessThan(1e-9);
  });

  it('conserves mass: the water on the grid is the water that came in, in a closed box', () => {
    const { grid, bed, manning } = channel(60, 6, 0.5, 0.0);
    const inflow: InflowCell[] = [];
    for (let j = 1; j <= 6; j += 1) inflow.push({ c: j * grid.nx + 1, share: 1 / 6 });
    // The east end is a wall too: raise it.
    for (let j = 0; j < grid.nz; j += 1) bed[j * grid.nx + grid.nx - 1] = 5;
    const solver = new RiverFlowSolver({
      grid, bed, manning, dischargeM3S: 0.5, inflow, inflowDir: [1, 0], inflowSpeedMS: 0.3, outflowEdge: 'east',
    });
    for (let k = 0; k < 800; k += 1) solver.step();
    expect(solver.outVolume).toBe(0);
    expect(Math.abs(solver.volume() - solver.inVolume) / solver.inVolume).toBeLessThan(1e-9);
  });

  it('runs a straight sloped channel at Manning normal depth, with the discharge through it', () => {
    // 1 % slope, n = 0.03, 5 m wide, 2 m^3/s: q = 0.4 m^2/s and the wide-channel
    // normal depth is (q n / sqrt(S))^(3/5) = 0.28 m (the solver's friction reads
    // the depth, as a wide channel's hydraulic radius is).
    const { grid, bed, manning } = channel(240, 10, 0.5, 0.01);
    const inflow: InflowCell[] = [];
    for (let j = 1; j <= 10; j += 1) inflow.push({ c: j * grid.nx + 1, share: 1 / 10 });
    const solver = new RiverFlowSolver({
      grid, bed, manning, dischargeM3S: 2, inflow, inflowDir: [1, 0], inflowSpeedMS: 1.2, outflowEdge: 'east',
    });
    const h0 = new Float64Array(grid.nx * grid.nz);
    const u0 = new Float64Array(grid.nx * grid.nz);
    for (let j = 1; j <= 10; j += 1) for (let i = 0; i < grid.nx; i += 1) { h0[j * grid.nx + i] = 0.28; u0[j * grid.nx + i] = 1.4; }
    solver.setState(h0, u0);
    const f = solver.runSteady(90, 20);
    const expected = Math.pow((0.4 * 0.03) / Math.sqrt(0.01), 3 / 5);
    const mid = Math.floor(grid.nx / 2);
    let hs = 0;
    for (let j = 1; j <= 10; j += 1) hs += f.h[j * grid.nx + mid];
    const h = hs / 10;
    expect(Math.abs(h - expected) / expected).toBeLessThan(0.05);
    expect(Math.abs(f.stats.qOut - 2) / 2).toBeLessThan(0.02);
    // The speed follows from continuity: q / h.
    expect(Math.abs(f.u[5 * grid.nx + mid] - 0.4 / h) / (0.4 / h)).toBeLessThan(0.05);
  });

  it('is deterministic: two runs from the same start end on the same field', () => {
    const run = (): Float32Array => {
      const { grid, bed, manning } = channel(80, 6, 0.5, 0.02);
      const inflow: InflowCell[] = [];
      for (let j = 1; j <= 6; j += 1) inflow.push({ c: j * grid.nx + 1, share: 1 / 6 });
      const s = new RiverFlowSolver({ grid, bed, manning, dischargeM3S: 1, inflow, inflowDir: [1, 0], inflowSpeedMS: 1, outflowEdge: 'east' });
      return s.runSteady(10, 3).u;
    };
    const a = run();
    const b = run();
    expect(a.length).toBe(b.length);
    for (let c = 0; c < a.length; c += 1) expect(a[c]).toBe(b[c]);
  });
});
