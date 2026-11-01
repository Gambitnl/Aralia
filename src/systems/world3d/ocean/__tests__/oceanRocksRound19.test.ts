/**
 * Rocks round 19 (the ocean gauntlet): THE JET'S SPEED CARRIES THE CREST'S AIR (the aerated crest's stagnation
 * pressure derates the flip-through jet by sqrt(1 - C)), THE CURTAIN'S RIM (a strip of the curtain sheds only at its
 * free edges: its ends and, on the burst's first parcel, its leading rim), THE WASH-OVER DRAWS AS THE FILM (no top
 * bodies, no fall sprites), and THE PLUME SEES THE DOME (the light grid's six-direction visibility, the dome's
 * delta-Eddington source). Each law has its own test; the frames are the lead's.
 */
import { describe, expect, it } from 'vitest';
import {
  ROCK_ROLLER_AREA_PER_L2,
  ROCK_ROLLER_VOID,
  ROCK_SECTORS,
  RockSurf,
  rockAeratedJetSpeed,
  rockBodyKindsOn,
  rockCollarRollerReachM,
  rockCrestAirShare,
  rockRollerLengthM,
  rockRollerThicknessM,
} from '../oceanRocksMath';
import {
  SPLASH_DELTA_F,
  SPLASH_DELTA_G,
  SPLASH_DOME_N,
  SPLASH_G,
  SPLASH_SHEET,
  SPLASH_WATER_RHO,
  SplashPool,
  splashCapillarySpeed,
  splashDomeDirections,
  splashDomeSource,
  splashDomeVisibility,
} from '../oceanSplashMath';

describe('round 19: the jet speed carries the crest air (GG-419)', () => {
  it('the crest air share is the roller void over the struck breaking share, clamped', () => {
    expect(rockCrestAirShare(0)).toBe(0);
    expect(rockCrestAirShare(1)).toBeCloseTo(ROCK_ROLLER_VOID, 12);
    expect(rockCrestAirShare(0.5)).toBeCloseTo(0.5 * ROCK_ROLLER_VOID, 12);
    expect(rockCrestAirShare(3)).toBeCloseTo(ROCK_ROLLER_VOID, 12);
    expect(rockCrestAirShare(-1)).toBe(0);
  });
  it('a clear crest keeps the round-6 speed; an aerated one leaves at sqrt(1 - C) of the water speed over the meeting point', () => {
    expect(rockAeratedJetSpeed(2, 8, 0)).toBeCloseTo(10, 12);
    expect(rockAeratedJetSpeed(2, 8, 0.5)).toBeCloseTo(2 + Math.sqrt(0.5) * 8, 12);
    // The meeting point's own climb is kinematic: the derate never takes it.
    expect(rockAeratedJetSpeed(2, 8, 0.9)).toBeGreaterThan(2);
    // Monotone in the air share; the share is bounded under 1 (a crest of pure air carries no water).
    const v = [0, 0.2, 0.5, 0.8, 0.95].map((c) => rockAeratedJetSpeed(1, 10, c));
    for (let k = 1; k < v.length; k += 1) expect(v[k]).toBeLessThan(v[k - 1]);
    expect(Number.isFinite(rockAeratedJetSpeed(1, 10, 1))).toBe(true);
  });
  it('at the roller void of 0.5 the ballistic rise falls by half (v^2 / 2g at sqrt(0.5) v)', () => {
    const v0 = rockAeratedJetSpeed(0, 10, 0);
    const v1 = rockAeratedJetSpeed(0, 10, rockCrestAirShare(1));
    expect((v1 * v1) / (v0 * v0)).toBeCloseTo(1 - ROCK_ROLLER_VOID, 12);
  });
});

describe('round 19: the curtain rim (Taylor-Culick at the free edges only)', () => {
  /** A jet sheet parcel of mass m, thickness h, as a strip of the curtain W wide. */
  const strip = (pool: SplashPool, m: number, h: number, W: number, lead: boolean): number => {
    const i = pool.emit(SPLASH_SHEET, 3, 1, 0, 0, 6, 0, 0.5, 0, 1, m, 2 / h, h);
    pool.markSheet(i, 0, 0, 0, W, lead);
    pool.spreadMs[i] = splashCapillarySpeed(h);
    return i;
  };
  it('a strip with no leading rim sheds at 2 v / W (its two ends); a wider strip sheds less', () => {
    const pool = new SplashPool(64, 5);
    const h = 0.05;
    const v = splashCapillarySpeed(h);
    const a = strip(pool, 40, h, 2, false);
    const b = strip(pool, 40, h, 4, false);
    expect(pool.curtainRimRate(a)).toBeCloseTo((2 * v) / 2, 6);
    expect(pool.curtainRimRate(b)).toBeCloseTo((2 * v) / 4, 6);
    expect(pool.curtainRimRate(b)).toBeLessThan(pool.curtainRimRate(a));
  });
  it('the burst first parcel also sheds its leading rim, W long: v (2 / W + 1 / L), L = m / (rho h W)', () => {
    const pool = new SplashPool(64, 5);
    const h = 0.05; const W = 3; const m = 60;
    const v = splashCapillarySpeed(h);
    const L = m / (SPLASH_WATER_RHO * h * W);
    const i = strip(pool, m, h, W, true);
    expect(pool.curtainRimRate(i)).toBeCloseTo(v * (2 / W + 1 / L), 6);
    expect(pool.curtainRimRate(i)).toBeGreaterThan(pool.curtainRimRate(strip(pool, m, h, W, false)));
  });
  it('the rate is in 1/s and small against the round-6 law of a lone strip one Rayleigh-Plateau wavelength wide', () => {
    const pool = new SplashPool(64, 5);
    const h = 0.05;
    const v = splashCapillarySpeed(h);
    const i = strip(pool, 40, h, 3, false);
    // Round 6: 2 v / lambda with lambda = 4.51 h: for a 5 cm sheet that is 2 v / 0.2255 against 2 v / 3 here.
    const old = (2 * v) / (4.51 * h);
    expect(pool.curtainRimRate(i)).toBeLessThan(old / 10);
  });
  it('a parcel with no strip (the churn lumps, a crown) has no curtain rim: 0', () => {
    const pool = new SplashPool(64, 5);
    const i = pool.emit(SPLASH_SHEET, 3, 1, 0, 0, 6, 0, 0.5, 0, 1, 40, 2 / 0.05, 0.05);
    pool.markSheet(i, 0, 0, 0, 0, false);
    pool.spreadMs[i] = splashCapillarySpeed(0.05);
    expect(pool.curtainRimRate(i)).toBe(0);
  });
});

describe('round 19: the wash-over draws as the film', () => {
  it('the top bodies are off (the sheet over the top is the stone film, not a march volume)', () => {
    expect(rockBodyKindsOn.top).toBe(false);
    expect(rockBodyKindsOn.collar).toBe(true);
    expect(rockBodyKindsOn.drain).toBe(true);
  });
});

describe('round 19: the collar roller floors the foam', () => {
  it('the collar roller reaches its own length: the thickness over Duncan area, the roller length of its bore', () => {
    expect(rockCollarRollerReachM(0)).toBe(0);
    expect(rockCollarRollerReachM(0.11)).toBeCloseTo(1, 9);
    for (const h of [0.3, 0.6, 1.0]) expect(rockCollarRollerReachM(rockRollerThicknessM(h))).toBeCloseTo(rockRollerLengthM(h), 9);
    expect(rockCollarRollerReachM(0.1)).toBeCloseTo(0.1 / ROCK_ROLLER_AREA_PER_L2, 12);
  });
  it('the breaker history carries the collar as its own pair of blocks after the face pair', () => {
    expect(RockSurf.BREAK_STRIDE).toBe(2 + 4 * ROCK_SECTORS);
  });
});

describe('round 19: the plume sees the dome', () => {
  it('the dome visibility is the six-direction mean of exp(-tau): 1 in the open, the mean of the six in the plume', () => {
    expect(splashDomeVisibility(0, 0, 0, 0, 0, 0)).toBe(1);
    const v = splashDomeVisibility(1, 2, 0.5, 0.5, 3, 0);
    const e = (Math.exp(-1) + Math.exp(-2) + 2 * Math.exp(-0.5) + Math.exp(-3) + 1) / 6;
    expect(v).toBeCloseTo(e, 12);
    // Under all a plume's water (the zenith column opaque) the base still sees the open sides.
    expect(splashDomeVisibility(10, 10, 0, 0, 0, 0)).toBeCloseTo(4 / 6, 3);
  });
  it('the delta-Eddington split: f = g^2, the lobe g / (1 + g)', () => {
    expect(SPLASH_DELTA_F).toBeCloseTo(SPLASH_G * SPLASH_G, 12);
    expect(SPLASH_DELTA_G).toBeCloseTo(SPLASH_G / (1 + SPLASH_G), 12);
    expect(SPLASH_DELTA_G).toBeLessThan(0.5);
  });
  it('the dome directions are unit vectors of equal solid angle over the horizon', () => {
    const d = splashDomeDirections();
    expect(d.length).toBe(SPLASH_DOME_N);
    let sy = 0;
    for (const [x, y, z] of d) {
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9);
      expect(y).toBeGreaterThan(0);
      sy += y;
    }
    // cos(theta) evenly spaced on (0, 1): its mean is 1/2.
    expect(sy / d.length).toBeCloseTo(0.5, 9);
  });
  it('the dome source is linear in the sky, dark under a dark sky and sea, and brighter looking up than down', () => {
    const one = () => 1;
    expect(splashDomeSource([0, 1, 0], () => 0, 0)).toBe(0);
    const up1 = splashDomeSource([0, 1, 0], one, 0);
    const up2 = splashDomeSource([0, 1, 0], () => 2, 0);
    expect(up2).toBeCloseTo(2 * up1, 9);
    const down = splashDomeSource([0, -1, 0], one, 0);
    expect(up1).toBeGreaterThan(down);
    expect(up1).toBeGreaterThan(0);
    // A ray toward the horizon sees the sky's forward delta share (f L) plus the lobe: over f alone.
    const side = splashDomeSource([1, 0, 0], one, 0);
    expect(side).toBeGreaterThan(SPLASH_DELTA_F * 0.99);
  });
  it('an isotropic sky with its own mirror under the horizon sums the phase to about 1 (the normalization)', () => {
    // The sea at F = 1 would mirror the whole sky; here the Fresnel is the law's, so the sphere sum is under 1
    // looking down and the test bounds it: the lobe's sum over the sphere at 32 samples is within 15% of 1.
    const n = 256;
    const dirs = splashDomeDirections(n);
    let s = 0;
    const gP = SPLASH_DELTA_G;
    const hg = (c: number) => (1 - gP * gP) / (4 * Math.PI * Math.max(1 + gP * gP - 2 * gP * c, 1e-6) ** 1.5);
    for (const w of dirs) { s += hg(w[1]); s += hg(-w[1]); }
    s *= (2 * Math.PI) / n;
    expect(Math.abs(s - 1)).toBeLessThan(0.15);
  });
});
