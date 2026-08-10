/**
 * The join between the two water models, proved as arithmetic.
 *
 * The campaign's rule, learned four separate times on this ADR: mass that
 * moves between two systems is lost at the seam unless a test watches the
 * total. So the first test here is conservation, and the behavior tests come
 * after it — the same order `shallowWater.test.ts` was written in.
 *
 * Nothing in this file needs a GPU or a scene, which is the point of the
 * plain-TypeScript twin: `mpmDomain.ts` and `waterHandoff.ts` import nothing.
 */
import { describe, expect, it } from 'vitest';
import { ShallowWaterField, DRY_DEPTH_M } from '../shallowWater';
import {
  creditSheet,
  debitSheet,
  handoffResidualM3,
  newHandoffLedger,
  particleVolumeM3,
  particlesToSheet,
  sheetToParticles,
  type SheetTarget,
} from '../waterHandoff';
import {
  MPM_REST_DENSITY,
  createDomain,
  drainAll,
  drainSettled,
  spawnBall,
  stepDomain,
} from '../mpmDomain';

/** A bare sheet, so a contract test needs no solver. */
function sheet(n: number, cellM: number, depthM = 0): SheetTarget {
  const depth = new Float32Array(n * n);
  depth.fill(depthM);
  return { n, cellM, depth };
}

function totalM3(s: SheetTarget): number {
  let v = 0;
  for (let i = 0; i < s.depth.length; i++) v += s.depth[i];
  return v * s.cellM * s.cellM;
}

/** Deterministic RNG, so a splash test means the same thing twice. */
function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('particleVolumeM3', () => {
  it('divides a cell between the particles that fill it at rest', () => {
    // Rest density is particles PER CELL, so four particles fill one cell.
    expect(particleVolumeM3(1, 4)).toBeCloseTo(0.25, 12);
    expect(particleVolumeM3(0.5, 4)).toBeCloseTo(0.125 / 4, 12);
  });

  it('four particles at rest density hold exactly one cell of water', () => {
    const q = particleVolumeM3(0.4, MPM_REST_DENSITY);
    expect(q * MPM_REST_DENSITY).toBeCloseTo(0.4 ** 3, 12);
  });
});

describe('sheetToParticles', () => {
  const region = { x0: 1, z0: 1, x1: 2, z1: 2 };

  it('takes only whole quanta and leaves the remainder in the sheet', () => {
    const s = sheet(8, 1, 1); // 4 cells in region, 1 m each = 4 m³ available
    const q = 1.5;
    const before = totalM3(s);
    const d = sheetToParticles(s, region, 4, q, 0);
    // 4 m³ requested buys 2 quanta of 1.5; the odd 1 m³ must stay put.
    expect(d.particles).toBe(2);
    expect(d.takenM3).toBeCloseTo(3, 10);
    expect(d.remainderM3).toBeCloseTo(1, 10);
    expect(before - totalM3(s)).toBeCloseTo(3, 10);
  });

  it('takes nothing at all when the request cannot fill one quantum', () => {
    const s = sheet(8, 1, 0.1);
    const before = totalM3(s);
    const d = sheetToParticles(s, region, 0.3, 1, 0);
    expect(d.particles).toBe(0);
    expect(d.takenM3).toBe(0);
    expect(totalM3(s)).toBeCloseTo(before, 12);
  });

  it('never draws a cell below the depth it is told to keep', () => {
    const s = sheet(8, 1, 0.5);
    const keep = 0.2;
    // Ask for far more than is available above the floor.
    sheetToParticles(s, region, 1000, 1e-4, keep);
    for (let z = 1; z <= 2; z++) {
      for (let x = 1; x <= 2; x++) {
        expect(s.depth[z * 8 + x]).toBeGreaterThanOrEqual(keep - 1e-6);
      }
    }
  });

  it('draws in proportion to available depth, so the pour keeps its shape', () => {
    const s = sheet(8, 1, 0);
    s.depth[1 * 8 + 1] = 3;
    s.depth[1 * 8 + 2] = 1;
    sheetToParticles(s, region, 2, 0.5, 0);
    // 2 m³ off 4 m³ available: each cell loses half of what it had.
    expect(s.depth[1 * 8 + 1]).toBeCloseTo(1.5, 10);
    expect(s.depth[1 * 8 + 2]).toBeCloseTo(0.5, 10);
  });

  it('clamps a region that hangs off the grid instead of reading past it', () => {
    const s = sheet(4, 1, 1);
    const d = sheetToParticles(s, { x0: -5, z0: -5, x1: 99, z1: 99 }, 4, 1, 0);
    expect(d.takenM3).toBeCloseTo(4, 10);
    expect(totalM3(s)).toBeCloseTo(12, 10);
  });

  it('refuses a dry region rather than inventing water', () => {
    const s = sheet(8, 1, 0);
    const d = sheetToParticles(s, region, 5, 0.1, 0);
    expect(d).toEqual({ takenM3: 0, particles: 0, remainderM3: 0 });
  });
});

describe('particlesToSheet', () => {
  it('credits depth at the column it is given', () => {
    const s = sheet(8, 2); // 4 m² cells
    const idx = Int32Array.from([3 * 8 + 4]);
    const vol = Float32Array.from([8]);
    const c = particlesToSheet(s, idx, vol, 1);
    expect(c.creditedM3).toBeCloseTo(8, 10);
    expect(s.depth[3 * 8 + 4]).toBeCloseTo(2, 10);
  });

  it('records volume aimed off the grid rather than dropping it', () => {
    const s = sheet(4, 1);
    const idx = Int32Array.from([-1, 16, 5]);
    const vol = Float32Array.from([1, 2, 3]);
    const c = particlesToSheet(s, idx, vol, 3);
    expect(c.strandedM3).toBeCloseTo(3, 10);
    expect(c.creditedM3).toBeCloseTo(3, 10);
    expect(c.creditedM3 + c.strandedM3).toBeCloseTo(6, 10);
  });

  it('reads only the first `count` entries of the buffers', () => {
    const s = sheet(4, 1);
    const idx = Int32Array.from([5, 6, 7]);
    const vol = Float32Array.from([1, 1, 1]);
    const c = particlesToSheet(s, idx, vol, 2);
    expect(c.creditedM3).toBeCloseTo(2, 10);
    expect(s.depth[7]).toBe(0);
  });
});

describe('the handoff ledger', () => {
  it('closes to zero across a debit and a credit', () => {
    const s = sheet(8, 1, 1);
    const led = newHandoffLedger();
    const q = 0.25;
    const d = debitSheet(s, led, { x0: 2, z0: 2, x1: 3, z1: 3 }, 2, q, 0);
    expect(led.inFlightM3).toBeCloseTo(d.takenM3, 10);
    expect(handoffResidualM3(led)).toBeCloseTo(0, 12);

    const idx = new Int32Array(d.particles);
    const vol = new Float32Array(d.particles);
    idx.fill(5 * 8 + 5);
    vol.fill(q);
    creditSheet(s, led, idx, vol, d.particles);
    expect(led.inFlightM3).toBeCloseTo(0, 10);
    expect(handoffResidualM3(led)).toBeCloseTo(0, 12);
  });

  it('keeps the sheet total whole when nothing is in flight', () => {
    const s = sheet(8, 1, 1);
    const before = totalM3(s);
    const led = newHandoffLedger();
    const q = 0.25;
    const d = debitSheet(s, led, { x0: 2, z0: 2, x1: 3, z1: 3 }, 3, q, 0);
    expect(totalM3(s) + led.inFlightM3).toBeCloseTo(before, 8);
    const idx = new Int32Array(d.particles).fill(1);
    const vol = new Float32Array(d.particles).fill(q);
    creditSheet(s, led, idx, vol, d.particles);
    expect(totalM3(s)).toBeCloseTo(before, 8);
  });

  it('counts stranded volume as having left the domain, not as in flight', () => {
    const s = sheet(4, 1, 1);
    const led = newHandoffLedger();
    const d = debitSheet(s, led, { x0: 0, z0: 0, x1: 3, z1: 3 }, 4, 1, 0);
    expect(d.particles).toBe(4);
    const idx = Int32Array.from([-1, -1, 0, 1]);
    const vol = Float32Array.from([1, 1, 1, 1]);
    creditSheet(s, led, idx, vol, 4);
    expect(led.strandedM3).toBeCloseTo(2, 10);
    expect(led.inFlightM3).toBeCloseTo(0, 10);
    expect(handoffResidualM3(led)).toBeCloseTo(0, 12);
  });
});

describe('a full pour, splash and settle cycle', () => {
  /**
   * The whole slice in one test.
   *
   * A sheet with a cliff across it, a spring on the high side, and a particle
   * domain armed at the foot. Every frame: pour, solve, debit the lip into
   * particles, step the particles, credit the settled ones back. The identity
   *
   *     sheet + in flight + soaked + ran off = poured
   *
   * is asserted on EVERY frame, not just at the end — a leak that cancels out
   * over a run is still a leak, and only a per-frame check catches the frame
   * it happened on.
   */
  it('conserves mass exactly, every frame, across both crossings', () => {
    const n = 32;
    const cellM = 1;
    const area = cellM * cellM;
    const field = new ShallowWaterField(n, cellM);
    /* A CHANNEL that ends in a cliff, not a bare step.
     *
     * The first cut of this test used an open plateau, and the pour spread
     * into a 1.4 mm film that reached the lip below the sheet's own dry
     * threshold — so nothing was ever available to cross, and the identity
     * check passed on an empty crossing. That is exactly what the two
     * `sawParticles` / `sawSettled` guards at the end exist to catch, and they
     * caught it. Side walls confine the flow so the lip carries real depth. */
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const wall = x < 12 || x > 18;
        field.bed[z * n + x] = z < n / 2 ? (wall ? 24 : 10) : 0;
      }
    }

    const dxM = 0.5;
    const domainN = 24;
    const footZ = n / 2;
    const originM: [number, number, number] = [10, -1, footZ * cellM];
    const domain = createDomain({
      n: domainN,
      dxM,
      originM,
      capacity: 3000,
      // The foot is flat ground at y = 0.
      floorYAt: () => 0,
    });
    const quantumM3 = particleVolumeM3(dxM, MPM_REST_DENSITY);
    const led = newHandoffLedger();
    const rand = rng(1234);

    let pouredM3 = 0;
    let soakedM3 = 0;
    const outXZ = new Float32Array(4000);
    const idx = new Int32Array(2000);
    const vol = new Float32Array(2000);

    const lip = { x0: 12, z0: (n / 2 - 1) | 0, x1: 18, z1: (n / 2 - 1) | 0 };

    let sawParticles = 0;
    let sawSettled = 0;

    for (let frame = 0; frame < 240; frame++) {
      // --- pour, on the high side only for the first half of the run
      if (frame < 120) {
        for (let z = 2; z < 5; z++) {
          for (let x = 14; x < 17; x++) {
            field.add(x, z, 0.15);
            pouredM3 += 0.15 * area;
          }
        }
      }

      // --- the sheet solves
      const step = field.maxStableStep();
      for (let s = 0; s < 4; s++) field.step(step);

      // --- soak, booked
      for (let i = 0; i < field.depth.length; i++) {
        if (field.depth[i] <= 0) continue;
        const taken = Math.min(field.depth[i], 1e-4);
        field.depth[i] -= taken;
        soakedM3 += taken * area;
      }

      // --- CROSSING ONE: the lip feeds the domain
      const d = debitSheet(field, led, lip, quantumM3 * 40, quantumM3, DRY_DEPTH_M);
      if (d.particles > 0) {
        const put = spawnBall(
          domain,
          d.particles,
          [domainN / 2, domainN - 4, domainN / 2],
          2.5,
          [0, -0.4, 0],
          rand,
        );
        /* A budget that cannot take every particle it was paid for must hand
         * the difference straight back, in the same frame. Anything else is a
         * silent loss with a plausible excuse. */
        if (put < d.particles) {
          const back = d.particles - put;
          const bi = new Int32Array(back).fill(lip.z0 * n + lip.x0);
          const bv = new Float32Array(back).fill(quantumM3);
          creditSheet(field, led, bi, bv, back);
        }
        sawParticles += put;
      }

      // --- the domain runs
      stepDomain(domain);
      stepDomain(domain);

      // --- CROSSING TWO: settled particles rejoin the sheet
      const settled = drainSettled(domain, outXZ);
      if (settled > 0) {
        for (let k = 0; k < settled; k++) {
          const cx = Math.floor(outXZ[k * 2] / cellM);
          const cz = Math.floor(outXZ[k * 2 + 1] / cellM);
          idx[k] = cx < 0 || cz < 0 || cx >= n || cz >= n ? -1 : cz * n + cx;
          vol[k] = quantumM3;
        }
        const c = creditSheet(field, led, idx, vol, settled);
        field.boundaryLedgerM3 += c.strandedM3;
        sawSettled += settled;
      }

      /* --- THE IDENTITY, every frame.
       *
       * The tolerance is HALF A QUANTUM, and that choice is the test.
       *
       * The sheet stores depth as Float32, so summing 1,024 cells over 240
       * frames drifts by around 5e-7 m³ — that is the storage, and no
       * arithmetic in this file can remove it. A real leak at this seam is
       * never that small: the smallest unit that can cross is one particle,
       * and losing even one is 0.031 m³ here. Half a quantum sits four orders
       * of magnitude above the float noise and below the cheapest possible
       * fault, so this assertion cannot pass a dropped particle and cannot
       * fail on rounding. */
      const total =
        field.volume() + led.inFlightM3 + soakedM3 + field.boundaryLedgerM3;
      expect(Math.abs(total - pouredM3)).toBeLessThan(quantumM3 * 0.5);
      // The crossing's OWN books are pure float64 and must be exact.
      expect(handoffResidualM3(led)).toBeCloseTo(0, 9);
      expect(led.inFlightM3).toBeCloseTo(domain.live * quantumM3, 9);
    }

    // The test is worthless if the crossing never happened.
    expect(sawParticles).toBeGreaterThan(200);
    expect(sawSettled).toBeGreaterThan(100);

    // --- disarm: every remaining particle goes home, and the books close.
    let guard = 0;
    while (domain.live > 0 && guard++ < 50) {
      const rest = drainAll(domain, outXZ);
      for (let k = 0; k < rest; k++) {
        const cx = Math.floor(outXZ[k * 2] / cellM);
        const cz = Math.floor(outXZ[k * 2 + 1] / cellM);
        idx[k] = cx < 0 || cz < 0 || cx >= n || cz >= n ? -1 : cz * n + cx;
        vol[k] = quantumM3;
      }
      const c = creditSheet(field, led, idx, vol, rest);
      field.boundaryLedgerM3 += c.strandedM3;
    }
    expect(domain.live).toBe(0);
    expect(led.inFlightM3).toBeCloseTo(0, 9);
    const finalTotal = field.volume() + soakedM3 + field.boundaryLedgerM3;
    expect(Math.abs(finalTotal - pouredM3)).toBeLessThan(quantumM3 * 0.5);
  });

  it('hands back exactly what it was given when the domain never runs', () => {
    // The degenerate crossing: debit, disarm immediately. A budget that leaks
    // here leaks everywhere, and it is the cheapest place to see it.
    const field = new ShallowWaterField(16, 1);
    for (let i = 0; i < field.depth.length; i++) field.depth[i] = 0.5;
    const before = field.volume();
    const led = newHandoffLedger();
    const dxM = 0.25;
    const q = particleVolumeM3(dxM, MPM_REST_DENSITY);
    const domain = createDomain({
      n: 16,
      dxM,
      originM: [0, 0, 0],
      capacity: 500,
      floorYAt: () => 0,
    });
    const d = debitSheet(field, led, { x0: 4, z0: 4, x1: 6, z1: 6 }, 1, q, 0);
    expect(d.particles).toBeGreaterThan(0);
    spawnBall(domain, d.particles, [8, 8, 8], 2, [0, 0, 0], rng(7));

    const outXZ = new Float32Array(d.particles * 2);
    const got = drainAll(domain, outXZ);
    expect(got).toBe(d.particles);
    const idx = new Int32Array(got).fill(5 * 16 + 5);
    const vol = new Float32Array(got).fill(q);
    creditSheet(field, led, idx, vol, got);
    expect(field.volume()).toBeCloseTo(before, 8);
    expect(led.inFlightM3).toBeCloseTo(0, 10);
  });
});
