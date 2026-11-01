/**
 * Rocks round 16 (the ocean gauntlet): THE PLUME'S AIR (two-way coupling: the water drags its own air, so
 * the break-up takes the slip and the stable drop lifts where the water outweighs its air), and THE BOX
 * (GG-411: the lay is normalized over its whole window, the grid's cell follows the plume's spread, the
 * outermost cells are packed as 0).
 */
import { describe, expect, it } from 'vitest';
import {
  SPLASH_AIR_CELL_M,
  SPLASH_AIR_RHO,
  SPLASH_DROP,
  SPLASH_LIGAMENT,
  SPLASH_SHEET,
  SPLASH_STABLE_DROP_M,
  SPLASH_WATER_SIGMA,
  SPLASH_WE_CRIT,
  SplashPool,
  SplashVolume,
  splashCoupledShare,
  splashCoupledStableDrop,
  splashTerminalSpeedMs,
  splashVolumeCellFor,
} from '../oceanSplashMath';

const still = { airX: 0, airZ: 0, seaHeight: () => -100 };

describe("rocks round 16: the plume's air (two-way coupling)", () => {
  it('gives the air no share with no water, and phi / (1 + phi) once coupled (Marble 1970)', () => {
    expect(splashCoupledShare(0, 10, 1)).toBe(0);
    expect(splashCoupledShare(9, 0, 1)).toBe(0);
    expect(splashCoupledShare(9, 100, 1)).toBeCloseTo(0.9, 9);
    // The slip decays at (1 + phi) k: after one such time the air has 1 - 1/e of its final share.
    const phi = 4; const k = 0.5; const t = 1 / ((1 + phi) * k);
    expect(splashCoupledShare(phi, t, k)).toBeCloseTo((phi / (1 + phi)) * (1 - Math.exp(-1)), 9);
  });
  it('lifts the stable drop as D_s / sqrt(1 - kappa): the Weber number at the coupled terminal slip is We_c there', () => {
    expect(splashCoupledStableDrop(0)).toBeCloseTo(SPLASH_STABLE_DROP_M, 12);
    expect(splashCoupledStableDrop(0.75)).toBeCloseTo(2 * SPLASH_STABLE_DROP_M, 12);
    for (const kap of [0, 0.3, 0.75, 0.95]) {
      const D = splashCoupledStableDrop(kap);
      const w = splashTerminalSpeedMs(D) * Math.sqrt(1 - kap);
      expect((SPLASH_AIR_RHO * w * w * D) / SPLASH_WATER_SIGMA).toBeCloseTo(SPLASH_WE_CRIT, 6);
    }
    expect(Number.isFinite(splashCoupledStableDrop(1))).toBe(true);
  });
  const fly = (kg: number, coupled: boolean, steps = 30) => {
    const pool = new SplashPool(8192, 3);
    pool.lawsOn.airCoupling = coupled;
    pool.emit(SPLASH_SHEET, 0, 1, 0, 0, 6, 0, 0.3, 0, 1, kg, 2 / 0.05, 0.05);
    for (let k = 0; k < steps; k += 1) pool.step(1 / 60, still);
    return pool;
  };
  it('holds the strands of a dense sheet over the free stable drop (its air moves with it); a light one tears them at D_s', () => {
    const dense = fly(400, true);
    let thick = 0; let strands = 0; let kap = 0;
    for (let a = 0; a < dense.alive; a += 1) {
      const j = dense.aliveIndex[a];
      if (dense.kind[j] === SPLASH_LIGAMENT) { strands += 1; if (4 / dense.areaV[j] > SPLASH_STABLE_DROP_M * 1.01) thick += 1; }
      if (dense.kind[j] === SPLASH_SHEET) kap = Math.max(kap, dense.airK[j]);
    }
    expect(strands).toBeGreaterThan(0);
    expect(kap).toBeGreaterThan(0.5);
    expect(thick).toBeGreaterThan(0);
    // The same sheet with the coupling off: round 15's law, every strand at most D_s.
    const free = fly(400, false);
    for (let a = 0; a < free.alive; a += 1) {
      const j = free.aliveIndex[a];
      if (free.kind[j] === SPLASH_LIGAMENT) expect(4 / free.areaV[j]).toBeLessThanOrEqual(SPLASH_STABLE_DROP_M * 1.0001);
      if (free.kind[j] === SPLASH_DROP) expect(6 / free.areaV[j]).toBeLessThanOrEqual(SPLASH_STABLE_DROP_M * 1.0001);
    }
  });
  it('drags a dense cloud less than a lone parcel of the same drops (the entrained air carries the drag)', () => {
    const speed = (kg: number) => {
      const pool = new SplashPool(64, 1);
      pool.lawsOn.breakup = false;
      const i = pool.emit(SPLASH_DROP, 0, 1, 0, 8, 0, 0, 0.01, 0, 1, kg, 6 / 0.02, 0.02);
      for (let k = 0; k < 60; k += 1) pool.step(1 / 60, still);
      return { vx: pool.vel[i * 3], kap: pool.airK[i] };
    };
    const lone = speed(0.01);
    const dense = speed(50);
    expect(lone.kap).toBeLessThan(0.01);
    expect(dense.kap).toBeGreaterThan(0.1);
    expect(dense.vx).toBeGreaterThan(lone.vx);
  });
  it('reads the loading per cell of SPLASH_AIR_CELL_M: phi is the water over the air of its cell', () => {
    const pool = new SplashPool(64, 1);
    const kg = 6.144; // 10 times the air of one 0.8 m cell (0.512 m^3 at 1.2 kg/m^3)
    // At a cell's center the trilinear read is that cell alone.
    const c = (Math.floor(0.3 / SPLASH_AIR_CELL_M) + 0.5) * SPLASH_AIR_CELL_M;
    const i = pool.emit(SPLASH_DROP, c, c, c, 0, 0, 0, 0.01, 0, 1, kg, 6 / 0.02, 0.02);
    pool.step(1 / 60, still);
    expect(pool.airPhi[i]).toBeCloseTo(kg / (SPLASH_AIR_RHO * SPLASH_AIR_CELL_M ** 3), 4);
  });
});

describe('rocks round 16: the box follows the plume (GG-411)', () => {
  it('grows the cell at once to hold the plume, and shrinks it only with a margin', () => {
    expect(splashVolumeCellFor(0.2, 0.1, 0.2)).toBeCloseTo(0.2, 12);
    const up = splashVolumeCellFor(0.2, 0.21, 0.2);
    expect(up).toBeCloseTo(0.2 * 2 ** 0.25, 12);
    expect(up).toBeGreaterThanOrEqual(0.21);
    // Back under the base cell, but by less than the margin: the cell stays.
    expect(splashVolumeCellFor(0.2, 0.19, up)).toBeCloseTo(up, 12);
    expect(splashVolumeCellFor(0.2, 0.16, up)).toBeCloseTo(0.2, 12);
  });
  const pool = new SplashPool(256, 5);
  const a = pool.emit(SPLASH_DROP, 0, 1, 0, 0, 0.5, 0, 0.002, 0, 1, 2, 6 / 0.001, 0.001);
  pool.spanM[a] = 2;
  const b = pool.emit(SPLASH_DROP, 9, 1, 0, 0, 0.5, 0, 0.002, 0, 1, 2, 6 / 0.001, 0.001);
  pool.spanM[b] = 2;
  const cs = new Float32Array(pool.capacity);
  cs[a] = SplashVolume.crossSection(pool, a);
  cs[b] = SplashVolume.crossSection(pool, b);
  it('holds every parcel of a plume wider than the grid at its base cell: coverage 1, the cross-section kept', () => {
    const v = new SplashVolume({ nx: 40, ny: 40, nz: 40, cellM: 0.2 });
    v.build(pool, 0, cs);
    expect(v.cellM).toBeGreaterThan(0.2);
    expect(v.layCoverage).toBeCloseTo(1, 6);
    let sc = 0;
    const vol = (2 * v.cellM) ** 3;
    for (let c = 0; c < v.drawSigma.length; c += 1) sc += v.drawSigma[c] * vol;
    expect(sc).toBeCloseTo(cs[a] + cs[b], 3);
  });
  it('packs the outermost cells as 0, and piles nothing at a wall when the grid cannot hold a parcel', () => {
    const v = new SplashVolume({ nx: 40, ny: 40, nz: 40, cellM: 0.2 });
    v.build(pool, 0, cs);
    const out = new Uint8Array(v.lx * v.ly * v.lz);
    v.packDraw(out);
    for (let y = 0; y < v.ly; y += 1) for (let z = 0; z < v.lz; z += 1) {
      expect(out[(z * v.ly + y) * v.lx]).toBe(0);
      expect(out[(z * v.ly + y) * v.lx + v.lx - 1]).toBe(0);
    }
    expect(out.some((q) => q > 0)).toBe(true);
  });
});
