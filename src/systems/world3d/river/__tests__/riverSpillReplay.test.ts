/** GG-429: the resident GPU path replays device spill launches through
 * RiverSpillTransfer.release, step by step. Solver A runs the CPU path; solver
 * B receives the same interval from a fake device (A's water and launches in
 * the device record format). With no landing inside the interval, B's
 * parcels and receipts equal A's to Float32 precision (the device format). */
import { describe, expect, it } from 'vitest';
import { RiverFlowSolver } from '../riverSolver';
import { RiverSpillTransfer } from '../riverSpillTransfer';
import type { RiverGpuResidentInput, RiverGpuResidentOutput } from '../riverGpuResident';

const nx = 40, nz = 10, dx = 0.5, n = nx * nz;
const grid = { nx, nz, dx, x0: 0, z0: 0 };

/** A plateau, then a 30 m cliff: parcels fly about 2.5 s, longer than the interval. */
function cliff(): RiverFlowSolver {
  const bed = new Float64Array(n);
  for (let c = 0; c < n; c++) bed[c] = c % nx < 20 ? 30 - (c % nx) * 0.02 : 0;
  const inflow = [3, 4, 5, 6].map(j => ({ c: j * nx + 1, share: 0.25 }));
  const solver = new RiverFlowSolver({ grid, bed, manning: new Float32Array(n).fill(0.03), dischargeM3S: 0.4, inflow,
    inflowDir: [1, 0], inflowSpeedMS: 1, outflowEdge: 'east', maxDtS: 0.05 });
  const h = new Float64Array(n), u = new Float64Array(n), v = new Float64Array(n);
  for (let j = 2; j < 8; j++) for (let i = 0; i < 20; i++) { h[j * nx + i] = 0.2; u[j * nx + i] = 1.2; }
  solver.setState(h, u, v);
  solver.setSpillTransfer(new RiverSpillTransfer(grid, [], 9.81, { detect: true }));
  return solver;
}

describe('resident spill replay', () => {
  it('releases device launches step by step like the CPU path', async () => {
    const a = cliff(), b = cliff();
    const spillA = (a as unknown as { spillTransfer: RiverSpillTransfer }).spillTransfer;
    const before = { h: a.h.slice(), hu: a.hu.slice(), hv: a.hv.slice() };
    // Record A's launches in the device format while A steps on the CPU.
    const launches: number[] = [], dts: number[] = [];
    let step = 0;
    const launch = spillA.launch.bind(spillA);
    spillA.launch = (cL, cR, axis, m, nf, tf, h, bed, u, v, time, dt) => {
      const sign = launch(cL, cR, axis, m, nf, tf, h, bed, u, v, time, dt);
      if (sign) {
        const from = sign > 0 ? cL : cR, to = sign > 0 ? cR : cL;
        const slope = (spillA as unknown as { separates: (...x: unknown[]) => number }).separates(from, to, axis, h, bed, u, v);
        launches.push(cR, (axis === 'z' ? 1 : 0) | (sign < 0 ? 2 : 0), step, 0, m, nf, tf, h[from], u[from], v[from], slope, 0);
      }
      return sign;
    };
    for (; step < 4; step++) dts.push(a.step());
    expect(launches.length / 12).toBeGreaterThan(0);
    expect(spillA.receipt().returnedVolume).toBe(0);
    // The fake device returns A's end water, A's step clock and A's launches.
    const execute = async (input: RiverGpuResidentInput): Promise<RiverGpuResidentOutput> => {
      expect(input.spill).toEqual({ gravity: 9.81 });
      const changed: number[] = [];
      for (let c = 0; c < n; c++) if (a.h[c] !== before.h[c] || a.hu[c] !== before.hu[c] || a.hv[c] !== before.hv[c]) changed.push(c);
      const records = new Uint32Array(changed.length * 8), rv = new Float32Array(records.buffer);
      changed.forEach((c, k) => { records[k * 8] = c << 4 | 1; rv.set([a.h[c], a.hu[c], a.hv[c], 0, 0, 0, 0], k * 8 + 1); });
      const journal = new Float32Array(dts.length * 8);
      let t = 0; dts.forEach((dt, k) => { t += dt; journal.set([dt, 1, 0, n, t, 0, 0, 1], k * 8); });
      const words = new Uint32Array(launches.length), fv = new Float32Array(words.buffer);
      launches.forEach((x, k) => { if (k % 12 < 4) words[k] = x; else fv[k] = x; });
      return { records, launches: words, journal, steps: dts.length, duration: journal[(dts.length - 1) * 8 + 4], inVolume: 0, outVolume: 0,
        lastMaxSpeed: 2, awakeCells: n, uploadBytes: 0, elapsedMs: 0 };
    };
    await b.intervalOnGpu(execute, 0.2);
    const sa = spillA.saveState(), sb = (b as unknown as { spillTransfer: RiverSpillTransfer }).spillTransfer.saveState();
    expect(sb.packets.map(p => [p.id, p.faceId])).toEqual(sa.packets.map(p => [p.id, p.faceId]));
    expect(sb.exposedFaces).toEqual(sa.exposedFaces);
    sa.packets.forEach((p, k) => {
      const q = sb.packets[k];
      expect(q.volume).toBeCloseTo(p.volume, 7);
      expect(q.birth).toBeCloseTo(p.birth, 6);
      for (let i = 0; i < 3; i++) {
        expect(q.releaseVelocity[i]).toBeCloseTo(p.releaseVelocity[i], 5);
        expect(q.position[i]).toBeCloseTo(p.position[i], 4);
      }
    });
    expect(sb.receipt.releasedVolume).toBeCloseTo(sa.receipt.releasedVolume, 7);
    for (let i = 0; i < 3; i++) {
      expect(sb.receipt.releasedMomentum[i]).toBeCloseTo(sa.receipt.releasedMomentum[i], 6);
      expect(sb.receipt.pressureBoundaryImpulse[i]).toBeCloseTo(sa.receipt.pressureBoundaryImpulse[i], 5);
    }
    expect(Math.abs(sb.receipt.volumeError)).toBeLessThan(1e-12);
  });
});
