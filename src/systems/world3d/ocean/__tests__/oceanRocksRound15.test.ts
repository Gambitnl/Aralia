/**
 * Rocks round 15 (the ocean gauntlet): the root is the breaking crest at the face (the rock's active
 * breaker in the one foam field), the drop population ends at the stable drop, the core grid of the
 * march (two levels), and the swash's air leaving the draining sheet.
 */
import { describe, expect, it } from 'vitest';
import {
  ROCK_CREST_TO_HEIGHT,
  ROCK_ROLLER_BUBBLE_RISE_MS,
  ROCK_ROLLER_PER_H,
  ROCK_SURF_BREAK_FULL,
  ROCK_SURF_BREAK_START,
  rockCrestSpeedMs,
  rockFaceBreakerCover,
  rockFaceBreakerShare,
  rockFaceRollerReachM,
  rockRollerAirStep,
} from '../oceanRocksMath';
import {
  SPLASH_AIR_RHO,
  SPLASH_BREAK_BAG_D,
  SPLASH_BREAK_RING_D,
  SPLASH_DROP,
  SPLASH_LIGAMENT,
  SPLASH_SHEET,
  SPLASH_STABLE_DROP_M,
  SPLASH_WATER_RHO,
  SPLASH_WATER_SIGMA,
  SPLASH_WE_CRIT,
  SplashPool,
  SplashVolume,
  splashCappedDropLaw,
  splashDragPerSpeed,
  splashGammaP,
  splashGammaVolumeBelow,
  splashTerminalSpeedMs,
} from '../oceanSplashMath';

describe('rocks round 15: the root is the breaking crest at the face', () => {
  it('breaks the standing crest by the reef law, only where the wave arrives', () => {
    const d = 2.5;
    // Under the start of the reef law nothing breaks; over its full value all of it, times the struck share.
    expect(rockFaceBreakerShare((ROCK_SURF_BREAK_START * d) / ROCK_CREST_TO_HEIGHT - 0.01, 1, d)).toBe(0);
    expect(rockFaceBreakerShare((ROCK_SURF_BREAK_FULL * d) / ROCK_CREST_TO_HEIGHT + 0.01, 1, d)).toBeCloseTo(1, 9);
    expect(rockFaceBreakerShare(2.19, 0.5, d)).toBeCloseTo(0.5, 9);
    expect(rockFaceBreakerShare(2.19, 0, d)).toBe(0);
    // The reflection raises the crest at the face: a face that stands the crest higher breaks more.
    const lo = rockFaceBreakerShare(0.8, 1, d);
    const hi = rockFaceBreakerShare(0.95, 1, d);
    expect(hi).toBeGreaterThan(lo);
  });
  it('lays the roller over its Svendsen length from the face, with a one-texel edge and nothing under the rock', () => {
    expect(rockFaceRollerReachM(1.36)).toBeCloseTo(ROCK_ROLLER_PER_H * ROCK_CREST_TO_HEIGHT * 1.36, 12);
    const reach = rockFaceRollerReachM(1.36);
    expect(rockFaceBreakerCover(0.8, reach, 0.5 * reach, 0.5)).toBeCloseTo(0.8, 9);
    expect(rockFaceBreakerCover(0.8, reach, reach, 0.5)).toBeCloseTo(0.4, 6);
    expect(rockFaceBreakerCover(0.8, reach, reach + 0.3, 0.5)).toBe(0);
    expect(rockFaceBreakerCover(0.8, reach, -0.6, 0.5)).toBe(0);
    expect(rockFaceBreakerCover(0, reach, 0.1, 0.5)).toBe(0);
  });
  it('runs the crest at the shallow-water speed of the reef and its crest', () => {
    expect(rockCrestSpeedMs(2.5, 1.36)).toBeCloseTo(Math.sqrt(9.81 * 3.86), 2);
    expect(rockCrestSpeedMs(2.5, -0.5)).toBeCloseTo(Math.sqrt(9.81 * 2.5), 2);
  });
});

describe('rocks round 15: the swash air leaves the draining sheet', () => {
  it('holds the air while the run-up climbs and loses it at the bubbles rise through the sheet', () => {
    expect(rockRollerAirStep(0.2, true, 0.5, 0.01)).toBe(1);
    const h = 0.1 * 0.5;
    const a = rockRollerAirStep(1, false, 0.5, 0.1);
    expect(a).toBeCloseTo(Math.exp((-0.1 * ROCK_ROLLER_BUBBLE_RISE_MS) / h), 12);
    // A thin sheet degasses faster than a thick one.
    expect(rockRollerAirStep(1, false, 0.05, 0.1)).toBeLessThan(rockRollerAirStep(1, false, 0.5, 0.1));
    // A second of drain leaves under 2% of the air of a 5 cm sheet.
    let x = 1;
    for (let k = 0; k < 100; k += 1) x = rockRollerAirStep(x, false, 0.5, 0.01);
    expect(x).toBeLessThan(0.15);
  });
});

describe('rocks round 15: the drop population ends at the stable drop', () => {
  it('solves the stable drop from the Weber law at the drop terminal speed (Newton drag, the pool law)', () => {
    const D = SPLASH_STABLE_DROP_M;
    expect(D).toBeGreaterThan(0.005);
    expect(D).toBeLessThan(0.006);
    const v = splashTerminalSpeedMs(D);
    // At the terminal speed the drag balances gravity (the pool's own drag law, Newton's regime).
    const kU = splashDragPerSpeed(D, v);
    expect(kU * v).toBeCloseTo(9.81, 1);
    // And there the Weber number is the critical one.
    expect((SPLASH_AIR_RHO * v * v * D) / SPLASH_WATER_SIGMA).toBeCloseTo(SPLASH_WE_CRIT, 6);
    // A capillary length check: D_s = 3 sqrt(Cd) l_c.
    const lc = Math.sqrt(SPLASH_WATER_SIGMA / (SPLASH_WATER_RHO * 9.81));
    expect(D / lc).toBeCloseTo(3 * Math.sqrt(0.44), 6);
  });
  it('agrees with the volume share of the gamma law', () => {
    for (const x of [0.5, 3, 7, 12, 30]) expect(splashGammaP(7, x)).toBeCloseTo(splashGammaVolumeBelow(x / 4 * 0.01, 0.01), 10);
  });
  it('breaks the water over the stable drop into the ring and bag fragments, the cross-section from the sum', () => {
    // A law far under the cap is unchanged.
    const small = splashCappedDropLaw(0.0003, SPLASH_STABLE_DROP_M);
    expect(small.overShare).toBe(0);
    expect(6 / small.areaV).toBeCloseTo(0.0003 * 1.5, 9);
    // A 2 cm law: every drop is under the cap after the break.
    const big = splashCappedDropLaw(0.02, SPLASH_STABLE_DROP_M);
    expect(big.overShare).toBeGreaterThan(0.99);
    expect(6 / big.areaV).toBeLessThan(SPLASH_STABLE_DROP_M);
    // Its area is at least that of the ring drops cascaded under the cap and no more than the bag's finest.
    expect(big.areaV).toBeGreaterThan(6 / SPLASH_STABLE_DROP_M);
    expect(big.areaV).toBeLessThan(6 / (SPLASH_BREAK_BAG_D * SPLASH_BREAK_RING_D * SPLASH_BREAK_RING_D * 0.02 * 0.5));
    // The parcel keeps its under-cap and ring drops, the bags' fines leave: the shares sum to the water, the
    // two parts' areas to the whole, and the kept drops are all under the cap.
    expect(big.keepShare + big.bagShare).toBeCloseTo(1, 9);
    expect(big.keepShare * big.keepAreaV + (big.bagShare * 6) / big.bagD32).toBeCloseTo(big.areaV, 6);
    expect(6 / big.keepAreaV).toBeLessThanOrEqual(SPLASH_STABLE_DROP_M);
    expect(big.bagD32).toBeLessThan(6 / big.keepAreaV);
  });
  it('tears no drop or strand parcel over the stable drop from a fast sheet', () => {
    const pool = new SplashPool(4096, 3);
    // Round 16: round 15's law is the free air's (THE PLUME'S AIR off; oceanRocksRound16.test.ts holds the coupled law).
    pool.lawsOn.airCoupling = false;
    pool.emit(SPLASH_SHEET, 0, 1, 0, 0, 6, 0, 0.3, 0, 1, 8, 2 / 0.05, 0.05);
    for (let k = 0; k < 30; k += 1) pool.step(1 / 60, { airX: 0, airZ: 0, seaHeight: () => -10 });
    let drops = 0; let strands = 0;
    for (let a = 0; a < pool.alive; a += 1) {
      const j = pool.aliveIndex[a];
      if (pool.kind[j] === SPLASH_DROP) { drops += 1; expect(6 / pool.areaV[j]).toBeLessThanOrEqual(SPLASH_STABLE_DROP_M * 1.0001); }
      if (pool.kind[j] === SPLASH_LIGAMENT) { strands += 1; expect(4 / pool.areaV[j]).toBeLessThanOrEqual(SPLASH_STABLE_DROP_M * 1.0001); }
    }
    expect(drops + strands).toBeGreaterThan(0);
    // With the law off the round-10 law tears drops over it at 6 m/s (the Weber limit 2 cm).
    const old = new SplashPool(4096, 3);
    old.lawsOn.stableDrop = false;
    old.emit(SPLASH_SHEET, 0, 1, 0, 0, 6, 0, 0.3, 0, 1, 8, 2 / 0.05, 0.05);
    for (let k = 0; k < 30; k += 1) old.step(1 / 60, { airX: 0, airZ: 0, seaHeight: () => -10 });
    let over = 0;
    for (let a = 0; a < old.alive; a += 1) { const j = old.aliveIndex[a]; if (old.kind[j] === SPLASH_DROP && 6 / old.areaV[j] > SPLASH_STABLE_DROP_M) over += 1; }
    expect(over).toBeGreaterThan(0);
  });
});

describe('rocks round 15: the core is dense (the two-level march)', () => {
  const make = (core: boolean) => {
    const v = new SplashVolume(core ? { nx: 40, ny: 40, nz: 40, cellM: 0.2, coreN: [40, 30, 40], coreCellM: 0.1 } : { nx: 40, ny: 40, nz: 40, cellM: 0.2 });
    if (core) v.setCore(-2, -0.5, -2);
    return v;
  };
  const pool = new SplashPool(256, 5);
  // A compact drop parcel at the root and a wide one high over it.
  const a = pool.emit(SPLASH_DROP, 0.05, 0.6, 0.05, 0, 0.5, 0, 0.002, 0, 1, 2, 6 / 0.001, 0.001);
  const b = pool.emit(SPLASH_DROP, 0.3, 6, 0.2, 0, 0.5, 0, 0.002, 0, 1, 2, 6 / 0.001, 0.001);
  pool.spanM[b] = 3;
  const cs = new Float32Array(pool.capacity);
  cs[a] = SplashVolume.crossSection(pool, a);
  cs[b] = SplashVolume.crossSection(pool, b);
  it('lays a compact parcel in the core box on the core grid, keeping its cross-section, and the rest on the light grid', () => {
    const v = make(true);
    v.build(pool, 0, cs);
    expect(v.coreParcels).toBe(1);
    expect(v.coarseParcels).toBe(1);
    let sq = 0;
    for (let c = 0; c < v.coreDraw.length; c += 1) sq += v.coreDraw[c] * 0.001;
    expect(sq).toBeCloseTo(cs[a], 4);
    // Round 16: the light cell is the grid's cell now, which follows the plume's spread (splashVolumeCellFor).
    let sc = 0;
    for (let c = 0; c < v.drawSigma.length; c += 1) sc += v.drawSigma[c] * (2 * v.cellM) ** 3;
    expect(sc).toBeCloseTo(cs[b], 4);
  });
  it('holds the compact parcel four times finer: its peak sigma is higher on the core grid', () => {
    const v1 = make(true); v1.build(pool, 0, cs);
    const v0 = make(false); v0.build(pool, 0, cs);
    let p1 = 0; for (let c = 0; c < v1.coreDraw.length; c += 1) p1 = Math.max(p1, v1.coreDraw[c]);
    let p0 = 0; for (let c = 0; c < v0.drawSigma.length; c += 1) p0 = Math.max(p0, v0.drawSigma[c]);
    expect(p1).toBeGreaterThan(4 * p0);
    // Packing writes the core and clears it on the next build.
    const out = new Uint8Array(v1.coreDraw.length);
    v1.packCore(out);
    expect(out.some((x) => x > 0)).toBe(true);
  });
  it('without a core spec the volume is the round-14 volume', () => {
    const v = make(false);
    v.build(pool, 0, cs);
    expect(v.coreDraw.length).toBe(0);
    expect(v.coreParcels).toBe(0);
  });
});
