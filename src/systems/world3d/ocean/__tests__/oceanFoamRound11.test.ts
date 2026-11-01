/**
 * @file oceanFoamRound11.test.ts — foam round 11's two laws, checked on the
 * CPU twins the GPU step and read mirror (oceanFoamMath.ts):
 *
 * 1. A SOURCE LAYS AN ACTIVE BREAKER: the roller's crest speed on shallow
 *    water, its decay time from its own energy balance, the step law (no
 *    trail behind a breaking crest; a roller that has left the bar runs on
 *    at its crest's speed and dies by its own dissipation), the mix with the
 *    sea's own breakers by ownership, and the roller's foam floor.
 * 2. THE FOAM'S LIGHT UNDER A DECK: the dome's quadrature, an overcast dome
 *    (Moon and Spencer 1942) lighting a Lambertian foam brighter than its
 *    own horizon, and the read's factor at a flat facet and at a tilted one.
 */
import { describe, it, expect } from 'vitest';
import {
  FOAM_DT_S,
  FOAM_MAX,
  FOAM_ROLLER_BETA,
  FOAM_BREAKER_TAU_S,
  FOAM_DOME_RINGS,
  FOAM_DOME_AZ,
  foamRollerCrestSpeedMs,
  foamRollerCoverTauS,
  foamRollerDecayPerStep,
  foamSourceBreakerLaw,
  foamBreakerMix,
  foamRollerFoamFloor,
  foamDomeDir,
  foamDomeIrradianceCpu,
  foamDeckFoamGain,
  foamDeckFacetGain,
} from '../oceanFoamMath';

const G = 9.81;

describe('law 1: the roller on a bar', () => {
  it('runs at the bore speed sqrt(g (h + H)), not the deep peak speed', () => {
    // The river mouth's bar: h 0.61 m, Battjes and Janssen's broken height 0.50 m.
    expect(foamRollerCrestSpeedMs(0.61, 0.5)).toBeCloseTo(Math.sqrt(G * 1.11), 10);
    expect(foamRollerCrestSpeedMs(0.61, 0.5)).toBeCloseTo(3.30, 2);
    // The deep peak at the surf sea's Tz 5.45 s runs at g T / (2 pi) = 8.5 m/s.
    expect(foamRollerCrestSpeedMs(0.61, 0.5)).toBeLessThan(0.5 * (G * 5.45) / (2 * Math.PI));
  });

  it('decays with c / (beta g), from its own energy balance', () => {
    const c = foamRollerCrestSpeedMs(0.61, 0.5);
    const tau = foamRollerCoverTauS(c);
    expect(tau).toBeCloseTo(c / (FOAM_ROLLER_BETA * G), 12);
    expect(tau).toBeCloseTo(3.36, 2);
    expect(tau).toBeLessThan(FOAM_BREAKER_TAU_S);
    // dE_r/dt = -2 beta g E_r / c, integrated in small steps; the cover goes
    // as the roller's length, sqrt(A_r), and A_r as E_r at a fixed c.
    let e = 1;
    const h = 1e-4;
    for (let t = 0; t < 2; t += h) e -= h * (2 * FOAM_ROLLER_BETA * G * e) / c;
    expect(Math.sqrt(e)).toBeCloseTo(Math.exp(-2 / tau), 3);
    expect(foamRollerDecayPerStep(c)).toBeCloseTo(Math.exp(-FOAM_DT_S / tau), 14);
  });

  it('is the cover while its waves break: no trail behind the crest', () => {
    // A 1D replay of the GPU step at the fine level's 0.5 m texel: the drawn
    // crest runs at the deep 8.5 m/s, the source's B is read upstream at the
    // roller's 3.30 m/s, and the whole line is breaking.
    const texel = 0.5;
    const n = 400;
    const cDraw = 8.5;
    const cRoll = foamRollerCrestSpeedMs(0.61, 0.5);
    const dec = foamRollerDecayPerStep(cRoll);
    let b = new Float64Array(n);
    const coverAt = (x: number, t: number) => {
      const xc = 20 + cDraw * t;
      return x >= xc && x < xc + 1.42 ? 1 : 0;
    };
    let t = 0;
    for (let s = 0; s < 45; s += 1) {
      t += FOAM_DT_S;
      const nb = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const u = i - (cRoll * FOAM_DT_S) / texel;
        const i0 = Math.floor(u);
        const f = u - i0;
        const up = (i0 >= 0 && i0 + 1 < n) ? b[i0] * (1 - f) + b[i0 + 1] * f : 0;
        nb[i] = foamSourceBreakerLaw(up, coverAt((i + 0.5) * texel, t), 1, dec);
      }
      b = nb;
    }
    const xc = 20 + cDraw * t;
    for (let i = 0; i < n; i += 1) {
      const x = (i + 0.5) * texel;
      if (x < xc - texel) expect(b[i]).toBe(0);
    }
  });

  it('runs on at its crest speed once its waves stop breaking, and dies by its own time', () => {
    const texel = 0.5;
    const n = 600;
    const cRoll = 4;
    const dec = foamRollerDecayPerStep(cRoll);
    let b = new Float64Array(n);
    for (let i = 100; i < 103; i += 1) b[i] = 1;
    const steps = 60;
    for (let s = 0; s < steps; s += 1) {
      const nb = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const u = i - (cRoll * FOAM_DT_S) / texel;
        const i0 = Math.floor(u);
        const f = u - i0;
        const up = (i0 >= 0 && i0 + 1 < n) ? b[i0] * (1 - f) + b[i0 + 1] * f : 0;
        nb[i] = foamSourceBreakerLaw(up, 0, 0, dec);
      }
      b = nb;
    }
    let m = 0; let mx = 0; let sum = 0;
    for (let i = 0; i < n; i += 1) { m += b[i] * i; sum += b[i]; mx = Math.max(mx, b[i]); }
    const moved = (m / sum - 101) * texel;
    expect(moved).toBeCloseTo(cRoll * steps * FOAM_DT_S, 6);
    // Linear interpolation keeps the sum: the area decays by exactly the law.
    expect(sum / 3).toBeCloseTo(Math.exp(-(steps * FOAM_DT_S) / foamRollerCoverTauS(cRoll)), 10);
  });

  it('owns the step only where the source owns the breaking', () => {
    expect(foamBreakerMix(0.7, 0.2, 0)).toBe(0.7);
    expect(foamBreakerMix(0.7, 0.2, 1)).toBe(0.2);
    expect(foamBreakerMix(0.7, 0.2, 0.5)).toBeCloseTo(0.45, 12);
    expect(foamBreakerMix(0.7, 0.2, 2)).toBe(0.2);
  });

  it('is aerated water: F hides the water under it from birth, in the store unit', () => {
    expect(foamRollerFoamFloor(1, 1)).toBe(1);
    expect(foamRollerFoamFloor(0.4, 0.5)).toBeCloseTo(0.2, 12);
    expect(foamRollerFoamFloor(1, 0)).toBe(0);
    expect(foamRollerFoamFloor(1, 1)).toBeLessThan(FOAM_MAX);
  });
});

describe('law 2: the foam under a deck', () => {
  it('walks a deterministic cosine-spread set over the upper dome', () => {
    const n = FOAM_DOME_RINGS * FOAM_DOME_AZ;
    let sy = 0;
    for (let i = 0; i < n; i += 1) {
      const d = foamDomeDir(i);
      expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(1, 12);
      expect(d[1]).toBeGreaterThan(0);
      sy += d[1];
    }
    // The mean of cos(theta) under cos-weighted sampling is 2/3.
    expect(sy / n).toBeCloseTo(2 / 3, 2);
  });

  it('gives pi for a uniform sky of radiance 1', () => {
    expect(foamDomeIrradianceCpu(() => 1, [0, -1, 0])).toBeCloseTo(Math.PI, 12);
  });

  it('lights foam brighter than the horizon under an overcast dome (Moon and Spencer 1942)', () => {
    const lz = 1;
    const sky = (d: readonly [number, number, number]) => (lz * (1 + 2 * d[1])) / 3;
    const e = foamDomeIrradianceCpu(sky, [0, -1, 0]);
    // The 8-ring midpoint rule is within 0.3 % of the integral.
    expect(Math.abs(e / ((7 * Math.PI) / 9) - 1)).toBeLessThan(0.003);
    const albedo = 0.9;
    const foam = (albedo * e) / Math.PI;
    const horizon = lz / 3;
    expect(foam / horizon).toBeCloseTo(2.1, 1);
    expect(foam).toBeGreaterThan(horizon);
  });

  it('leaves the sun disc out of the dome: its light is the direct term', () => {
    const sun: [number, number, number] = [0, 1, 0];
    const disc = (d: readonly [number, number, number]) => (d[1] > 0.9999 ? 1e6 : 1);
    const e = foamDomeIrradianceCpu(disc, sun);
    expect(e).toBeLessThanOrEqual(Math.PI + 1e-9);
  });

  it('reproduces the drawn deck of the river mouth: 1.008 against the mean light 0.792', () => {
    // Measured on the GPU at the mouth (foam11/r6.log): the dome 1.275, the
    // sun on a flat surface 2.532 (clear E 0.6645 x the ratio 3.81), the sun's
    // unscattered share 0.458, the sun at 30 degrees.
    const k = foamDeckFoamGain(1.275, 2.532, 0.458, 0.5);
    expect(k).toBeCloseTo(1.008, 2);
    expect(k).toBeGreaterThan(0.792);
  });

  it('gives a flat facet the flat law, a facet facing the sun more, and the dome alone with no sun', () => {
    const mu0 = 0.5;
    const eSunH = 2.532;
    const flat = foamDeckFoamGain(1.275, eSunH, 0.458, mu0);
    expect(foamDeckFacetGain(1.275, eSunH / mu0, 0.458, 1, mu0)).toBeCloseTo(flat, 12);
    expect(foamDeckFacetGain(1.275, eSunH / mu0, 0.458, 0.9, 0.95)).toBeGreaterThan(flat);
    expect(foamDeckFacetGain(1.275, eSunH / mu0, 0, 1, mu0)).toBeCloseTo(1.275 / Math.PI / 0.7, 12);
  });
});
