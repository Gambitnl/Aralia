/**
 * Rocks round 14 (ocean gauntlet): the laws of the plume as one marched volume and of the matte stone.
 *  - ONE PLUME, ONE BUDGET: a parcel's water is either the sprites' or the march's (splashSpriteSplit),
 *    and the light grid takes all of it (SplashVolume.build with volumeCs).
 *  - A PARCEL IS LAID BY ITS OWN PROFILE: the lay keeps the cross-section and spreads by the region.
 *  - THE MIRROR SHARE IS THE SHARE OF THE GRAIN THE FILM DROWNS (rockFilmMirrorShare and its fit).
 * See the "## Rocks" Round 14 block of docs/architecture/domains/world3d-ocean.md.
 */
import { describe, expect, it } from 'vitest';
import {
  SPLASH_DROP,
  SPLASH_TRAIN_MAX,
  SplashPool,
  SplashVolume,
  splashClumpedCrossSection,
  splashSpriteSplit,
} from '../oceanSplashMath';
import {
  ROCK_GRAIN_RA_M,
  ROCK_GRAIN_RQ_M,
  rockDrainingFilmM,
  rockFilmLevel,
  rockFilmMirrorShare,
  rockFilmMirrorShareFit,
  rockNusseltFilmM,
  rockFilmLaminarShare,
  ROCK_WATER_NU_M2S,
  rockTopAt,
  rockTopRaster,
  rockTopRasterAt,
} from '../oceanRocksMath';

describe('rocks round 14: one plume, one budget', () => {
  it('gives a sheet and an unresolved population to the march, a resolved one to its trains', () => {
    // A sheet: all the march's, at its own cross-section.
    expect(splashSpriteSplit(false, 0, 0, 0.01, 0, 2)).toEqual({ trains: 0, trainShare: 0, volumeCsM2: 2 });
    // Trains under the pixel: the march's, at the clumped cross-section of K trains.
    const un = splashSpriteSplit(true, 0.4, 0.01, 0.02, 1e6, 3);
    expect(un.trains).toBe(0);
    expect(un.volumeCsM2).toBeCloseTo(splashClumpedCrossSection(3, (0.4 / 0.01) ** 2, 0.01), 12);
    expect(un.volumeCsM2).toBeLessThanOrEqual(3);
    // A population of more drops than its region holds trains: all the march's (A SPRITE IS ONE DROP).
    const pop = splashSpriteSplit(true, 0.05, 0.02, 0.01, 1e6, 1);
    expect(pop.trains).toBe(0);
    expect(pop.volumeCsM2).toBeCloseTo(splashClumpedCrossSection(1, 6.25, 0.02), 12);
    // Five drops flown apart in a region of 6.25 train widths: five one-drop sprites, nothing for the march.
    const few = splashSpriteSplit(true, 0.05, 0.02, 0.01, 5, 1);
    expect(few.trains).toBe(5);
    expect(few.trainShare).toBe(1);
    expect(few.volumeCsM2).toBe(0);
    // 100 drops flown apart in 400 train widths: maxK one-drop sprites at maxK / 100, the rest the march's (clumped).
    const K = 100;
    const many = splashSpriteSplit(true, 0.4, 0.02, 0.01, K, 1);
    expect(many.trains).toBe(SPLASH_TRAIN_MAX);
    expect(many.trainShare).toBeCloseTo(SPLASH_TRAIN_MAX / K, 12);
    expect(many.volumeCsM2).toBeCloseTo(splashClumpedCrossSection(1 - SPLASH_TRAIN_MAX / K, K - SPLASH_TRAIN_MAX, 0.02), 12);
    // Never more water than the parcel holds (the sprites' share plus the march's).
    for (const s of [un, pop, few, many]) expect(s.trainShare * 3 + s.volumeCsM2).toBeLessThanOrEqual(3 + 1e-9);
  });

  it('lays every parcel on the light grid with its cross-section kept, and the march takes only its share', () => {
    const pool = new SplashPool(64, 7);
    const vol = new SplashVolume({ nx: 40, ny: 40, nz: 40, cellM: 0.2 });
    // Two drop parcels in the air: one young (a small region), one spread over a meter.
    const a = pool.emit(SPLASH_DROP, 0, 3, 0, 0, 4, 0, 0.02, 0, 1, 2.0, 6 / 0.002, 0.002);
    const b = pool.emit(SPLASH_DROP, 1, 4, 0.5, 1, 2, 0, 0.02, 0, 1, 2.0, 6 / 0.002, 0.002);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
    pool.spanM[b] = 1.2;
    const csA = SplashVolume.crossSection(pool, a);
    const csB = SplashVolume.crossSection(pool, b);
    expect(csA).toBeGreaterThan(0);
    // Without a split the march draws none of the sprites' water (round 13).
    vol.build(pool, 0);
    expect(vol.drawSigma.reduce((s, v) => s + v, 0)).toBe(0);
    expect(vol.drawEmpty).toBe(true);
    const share = new Float32Array(pool.capacity);
    share[a] = csA; share[b] = 0.25 * csB;
    vol.build(pool, 0, share);
    vol.light(0.3, 0.5, 0.2);
    const volL = 0.4 ** 3;
    const sumLight = vol.lightSigma.reduce((s, v) => s + v, 0) * volL;
    const sumDraw = vol.drawSigma.reduce((s, v) => s + v, 0) * volL;
    expect(sumLight).toBeCloseTo(csA + csB, 4);
    expect(sumDraw).toBeCloseTo(csA + 0.25 * csB, 4);
    expect(vol.drawEmpty).toBe(false);
    // The spread parcel's light spans more than a cell either way (its region, not two points).
    const vol2 = new SplashVolume({ nx: 40, ny: 40, nz: 40, cellM: 0.2 });
    const only = new Float32Array(pool.capacity); only[b] = csB;
    pool.mass[a] = 0;
    vol2.build(pool, 0, only);
    const { lx, ly } = vol2;
    let m0 = 0; let m1 = 0; let m2 = 0;
    vol2.drawSigma.forEach((v, c) => { const x = (c % lx) * 0.4; m0 += v; m1 += v * x; m2 += v * x * x; });
    void ly;
    const sd = Math.sqrt(m2 / m0 - (m1 / m0) ** 2);
    const want = Math.sqrt(pool.spreadSigmaOf(b) ** 2 + 0.04);
    expect(sd).toBeGreaterThan(0.6 * want);
    expect(sd).toBeLessThan(1.3 * want);
  });
});

describe('rocks round 14: the low sun is cut by the rock and the crest', () => {
  it('takes the direct and the many-times-scattered sun from the cells under the shadow height of the occluders', () => {
    const pool = new SplashPool(16, 3);
    const i = pool.emit(SPLASH_DROP, 0, 2, 0, 0, 1, 0, 0.02, 0, 1, 0.5, 6 / 0.002, 0.002);
    pool.spanM[i] = 3;
    const open = new SplashVolume({ nx: 30, ny: 30, nz: 30, cellM: 0.2 });
    const cut = new SplashVolume({ nx: 30, ny: 30, nz: 30, cellM: 0.2 });
    open.build(pool, 0); cut.build(pool, 0);
    // The sun 6 degrees up toward +x; a wall 3 m high from x = 3 m on (2 m past the parcel's side).
    const e = (6 * Math.PI) / 180;
    const sun = [Math.cos(e), Math.sin(e), 0] as const;
    const wall = (x: number) => (x >= 3 ? 3 : -Infinity);
    open.light(sun[0], sun[1], sun[2]);
    cut.light(sun[0], sun[1], sun[2], (x) => wall(x), 4);
    const L = 0.4;
    let shaded = 0; let lit = 0;
    for (let z = 0; z < cut.lz; z += 1) for (let y = 0; y < cut.ly; y += 1) for (let x = 0; x < cut.lx; x += 1) {
      const c = (z * cut.ly + y) * cut.lx + x;
      const px = cut.ox + (x + 0.5) * L; const py = cut.oy + (y + 0.5) * L;
      if (px >= 3 - L) continue;
      // The shadow height: the wall's top less its run times tan e, the nearest wall cell first.
      let hs = -Infinity;
      for (let d = L; d <= 4 / Math.tan(e); d += L) if (px + d >= 3) hs = Math.max(hs, 3 - d * Math.tan(e));
      if (py < hs - L) { expect(cut.sun[c]).toBe(0); expect(cut.sunMs[c]).toBe(0); shaded += 1; }
      if (py > hs + L) { expect(cut.sun[c]).toBeCloseTo(open.sun[c], 9); lit += 1; }
      expect(cut.sky[c]).toBeCloseTo(open.sky[c], 9);
    }
    expect(shaded).toBeGreaterThan(0);
    expect(lit).toBeGreaterThan(0);
  });

  it('reads the top of a rock from its profile', () => {
    const tab = {
      centerX: 0, centerZ: 0, sectors: 4, azimuthRad: Float64Array.from([0, Math.PI / 2, Math.PI, 1.5 * Math.PI]),
      levelsM: Float64Array.from([0, 1, 2]), radiusM: Float64Array.from([3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1]),
    } as unknown as Parameters<typeof rockTopAt>[0];
    expect(rockTopAt(tab, 0.5, 0)).toBe(2);
    expect(rockTopAt(tab, 1.5, 0)).toBeCloseTo(1.5, 9);
    expect(rockTopAt(tab, 2.5, 0)).toBeCloseTo(0.5, 9);
    expect(rockTopAt(tab, 3.5, 0)).toBe(-Infinity);
    const r = rockTopRaster([tab], 0.2);
    expect(rockTopRasterAt(r, 1.5, 0.05)).toBeCloseTo(rockTopAt(tab, r.x0 + (Math.floor((1.5 - r.x0) / 0.2) + 0.5) * 0.2, r.z0 + (Math.floor((0.05 - r.z0) / 0.2) + 0.5) * 0.2), 6);
    expect(rockTopRasterAt(r, 10, 0)).toBe(-Infinity);
  });
});

describe('rocks round 14: the mirror share is the share of the grain the film drowns', () => {
  it('takes the Gaussian grain of Ra 2 mm, Rq = sqrt(pi / 2) Ra', () => {
    expect(ROCK_GRAIN_RA_M).toBe(0.002);
    expect(ROCK_GRAIN_RQ_M).toBeCloseTo(0.002 * Math.sqrt(Math.PI / 2), 12);
  });

  it('solves the film level from the water the grain holds', () => {
    // h / Rq = lambda Phi(lambda) + phi(lambda): at lambda 0 it is phi(0) = 0.39894.
    expect(rockFilmLevel(0.398942 * ROCK_GRAIN_RQ_M)).toBeCloseTo(0, 4);
    // Far over the grain the level is the film itself.
    expect(rockFilmLevel(10 * ROCK_GRAIN_RQ_M)).toBeCloseTo(10, 4);
    expect(rockFilmLevel(0)).toBe(-Infinity);
  });

  it('is a mirror over the drowned share, rising with the film, and the shader fit holds within 0.018', () => {
    expect(rockFilmMirrorShare(0)).toBe(0);
    expect(rockFilmMirrorShare(ROCK_GRAIN_RQ_M)).toBeCloseTo(0.816, 3);
    expect(rockFilmMirrorShare(0.1 * ROCK_GRAIN_RQ_M)).toBeCloseTo(0.183, 3);
    let prev = 0; let worst = 0;
    for (let e = -3; e <= 1.2; e += 0.02) {
      const h = ROCK_GRAIN_RQ_M * 10 ** e;
      const s = rockFilmMirrorShare(h);
      expect(s).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = s;
      worst = Math.max(worst, Math.abs(s - rockFilmMirrorShareFit(h)));
    }
    expect(worst).toBeLessThan(0.018);
    // The films of the face: a draining film after 10 s is a mirror over a tenth of the face (round 13: 0.27),
    // a strong cascade's Nusselt film over two thirds (round 13: 0.84).
    expect(rockFilmMirrorShare(rockDrainingFilmM(1, 1, 10))).toBeLessThan(0.12);
    expect(rockFilmMirrorShare(rockNusseltFilmM(0.01, 1))).toBeGreaterThan(0.6);
    expect(rockFilmMirrorShare(rockNusseltFilmM(0.01, 1))).toBeLessThan(0.7);
  });
});

describe('rocks round 14: a turbulent film is no mirror', () => {
  it('keeps the laminar share whole under q / nu 250 and none over 1000 (Fulford 1964)', () => {
    expect(rockFilmLaminarShare(0)).toBe(1);
    expect(rockFilmLaminarShare(250 * ROCK_WATER_NU_M2S)).toBeCloseTo(1, 12);
    expect(rockFilmLaminarShare(1000 * ROCK_WATER_NU_M2S)).toBeCloseTo(0, 12);
    expect(rockFilmLaminarShare(625 * ROCK_WATER_NU_M2S)).toBeCloseTo(0.5, 12);
    // The cascade at 0.01 m^2/s (q / nu 8,400) and a 5 cm swash under a 0.5 m bore are turbulent; a draining film of 0.35 mm is laminar.
    expect(rockFilmLaminarShare(0.01)).toBe(0);
    expect(rockFilmLaminarShare(0.05 * Math.sqrt(9.81 * 0.5))).toBe(0);
    const hD = rockDrainingFilmM(1, 1, 1);
    expect(rockFilmLaminarShare((9.81 * hD ** 3) / (3 * ROCK_WATER_NU_M2S))).toBe(1);
  });
});
