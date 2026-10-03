/**
 * @file oceanUnderwater.test.ts — the CPU arithmetic behind the underwater view.
 *
 * The GPU side (`oceanUnderwater.ts`) is proved by captures against the
 * reference frames. What is checked here is the math the shaders mirror:
 * Snell's window and the Fresnel from the water side, the refracted sun,
 * the absorption that eats red first, the closed-form path light against a
 * numerical integral, the fog curves, the phase functions, the daylight
 * that enters and the exposure, the shaft contrast and the lens tiles'
 * spread. Each number a comment in `oceanUnderwaterMath.ts` quotes has a
 * test that fails if it drifts.
 */
import { describe, expect, it } from 'vitest';
import {
  DIFFUSE_FRESNEL_INTO_WATER,
  STORM_OPTICS,
  UNDERWATER_ADAPTATION,
  UNDERWATER_E_REF,
  UNDERWATER_EXPOSURE_REF,
  UNDERWATER_LIGHT,
  UNDERWATER_OPTICS,
  UNDERWATER_SHAFTS,
  WATER_IOR,
  CLEAR_WATER_CHL,
  FAIR_OPTICS,
  oceanWaterOptics,
  acesFilmicSrgb8,
  beamAttenuation,
  beamTransmittance,
  combTransfer,
  diffuseAttenuation,
  downwelling,
  foldDeficitRms,
  fresnelAirToWater,
  fresnelWaterToAir,
  henyeyGreenstein,
  inWaterIrradiance,
  inscatterPath,
  inscatterSource,
  pathAttenuation,
  refractWaterToAir,
  refractedSunTravelDir,
  erfApprox,
  shaftEnvelope,
  shaftSheetLight,
  shaftSheetSegment,
  sheetMean,
  snellWindowHalfAngleRad,
  sunPhase,
  underwaterExposure,
  underwaterWhiteBalance,
  type Rgb,
} from '../oceanUnderwaterMath';
import { directionalSpectrum, buildCascadeSpectrum } from '../oceanSpectrum';
import { realizeCascade } from '../oceanFieldReference';
import { DEFAULT_CASCADES } from '../oceanConfig';

const DEG = Math.PI / 180;

describe("Snell's window", () => {
  it('is 48.6 degrees from the zenith at n = 1.333', () => {
    expect(snellWindowHalfAngleRad(WATER_IOR) / DEG).toBeCloseTo(48.6, 1);
  });

  it('reflects everything past the critical angle and almost nothing straight up', () => {
    const crit = snellWindowHalfAngleRad();
    // Straight up: ((n - 1) / (n + 1))^2.
    expect(fresnelWaterToAir(1)).toBeCloseTo(((WATER_IOR - 1) / (WATER_IOR + 1)) ** 2, 6);
    expect(fresnelWaterToAir(Math.cos(crit + 0.1 * DEG))).toBe(1);
    expect(fresnelWaterToAir(Math.cos(crit - 0.05 * DEG))).toBeGreaterThan(0.6);
    // Rises with the incidence angle all the way to the critical angle.
    let last = 0;
    for (let a = 0; a < crit / DEG; a += 0.5) {
      const r = fresnelWaterToAir(Math.cos(a * DEG));
      expect(r).toBeGreaterThanOrEqual(last - 1e-12);
      last = r;
    }
    // "falls from 0.6 to nothing over the last three degrees" (oceanUnderwater.ts)
    expect(1 - fresnelWaterToAir(Math.cos(crit - 3 * DEG))).toBeGreaterThan(0.6);
  });

  it('matches the air side at normal incidence and goes to 1 at grazing from the air', () => {
    expect(fresnelAirToWater(1)).toBeCloseTo(fresnelWaterToAir(1), 10);
    expect(fresnelAirToWater(0.001)).toBeGreaterThan(0.99);
  });

  it('bends the eye ray by Snell and loses it past the window', () => {
    const n: [number, number, number] = [0, 1, 0];
    const up = refractWaterToAir([0, 1, 0], n)!;
    expect(up[1]).toBeCloseTo(1, 12);
    const a = 30 * DEG;
    const t = refractWaterToAir([Math.sin(a), Math.cos(a), 0], n)!;
    expect(Math.hypot(t[0], t[2])).toBeCloseTo(WATER_IOR * Math.sin(a), 10);
    const crit = snellWindowHalfAngleRad();
    const edge = refractWaterToAir([Math.sin(crit - 0.2 * DEG), Math.cos(crit - 0.2 * DEG), 0], n)!;
    expect(edge[1]).toBeLessThan(0.15); // the rim of the window shows the horizon
    expect(refractWaterToAir([Math.sin(crit + 1 * DEG), Math.cos(crit + 1 * DEG), 0], n)).toBeNull();
  });

  it('puts the shipped sun 68 degrees up from under the water, its shafts 22 degrees off the vertical', () => {
    const sun: [number, number, number] = [-0.321, 0.866, -0.383];
    const t = refractedSunTravelDir(sun);
    expect(Math.hypot(t[0], t[1], t[2])).toBeCloseTo(1, 12);
    expect(Math.acos(-t[1]) / DEG).toBeCloseTo(Math.asin(0.5 / WATER_IOR) / DEG, 1);
    expect(Math.acos(-t[1]) / DEG).toBeCloseTo(22.0, 0);
    // It travels away from the sun's azimuth.
    expect(t[0] * sun[0] + t[2] * sun[2]).toBeLessThan(0);
  });
});

describe('the water eats red first', () => {
  it('passes less red than green than blue over any path', () => {
    for (const d of [1, 5, 20, 60]) {
      const t = beamTransmittance(d);
      expect(t[0]).toBeLessThan(t[1]);
      expect(t[1]).toBeLessThan(t[2]);
      const e = downwelling(d);
      expect(e[0]).toBeLessThan(e[1]);
      expect(e[1]).toBeLessThan(e[2]);
    }
  });

  it('keeps the shares of daylight at 10 m and the visibility its comments quote', () => {
    const e = downwelling(10);
    expect(e[0]).toBeCloseTo(0.05, 2);
    expect(e[1]).toBeCloseTo(0.58, 2);
    expect(e[2]).toBeCloseTo(0.80, 2);
    const c = beamAttenuation();
    expect(4 / c[1]).toBeGreaterThan(38);
    expect(4 / c[1]).toBeLessThan(44);
    const a = UNDERWATER_OPTICS.absorption;
    expect(Math.exp(-a[0] * 5)).toBeCloseTo(0.26, 2);
    expect(Math.exp(-a[2] * 5)).toBeCloseTo(0.91, 2);
    const k = pathAttenuation();
    expect(k[0]).toBeCloseTo(0.28, 2);
    expect(k[1]).toBeCloseTo(0.063, 3);
    expect(k[2]).toBeCloseTo(0.036, 3);
  });

  it("loses the water's own light slower than an object's contrast", () => {
    for (const o of [UNDERWATER_OPTICS, STORM_OPTICS]) {
      const c = beamAttenuation(o);
      const k = pathAttenuation(o);
      const kd = diffuseAttenuation(o);
      for (let i = 0; i < 3; i += 1) {
        expect(k[i]).toBeLessThan(c[i]);
        expect(kd[i]).toBeGreaterThan(0);
      }
    }
  });

  it('turns the storm water murkier, not darker in color', () => {
    const cFair = beamAttenuation(UNDERWATER_OPTICS);
    const cStorm = beamAttenuation(STORM_OPTICS);
    expect(cStorm[1]).toBeGreaterThan(cFair[1]);
    // The storm's green beam attenuation quoted in the comment.
    expect(cStorm[1]).toBeCloseTo(0.127, 3);
  });
});

describe('the phase functions', () => {
  const integrate = (p: (mu: number) => number) => {
    // 2 pi integral over mu of p(mu).
    let s = 0;
    const N = 200000;
    for (let i = 0; i < N; i += 1) {
      const mu = -1 + (2 * (i + 0.5)) / N;
      s += p(mu);
    }
    return (2 * Math.PI * 2 * s) / N;
  };

  it('each integrate to 1 over the sphere', () => {
    for (const g of [0, 0.35, 0.55, 0.96]) {
      expect(integrate((mu) => henyeyGreenstein(mu, g))).toBeCloseTo(1, 3);
    }
    expect(integrate((mu) => sunPhase(mu))).toBeCloseTo(1, 3);
  });

  it('give the sun lobes their quoted mean cosine and the diffuse field its down-to-side ratio', () => {
    const l = UNDERWATER_LIGHT;
    const meanCos = l.sunNarrowShare * l.gSunNarrow + (1 - l.sunNarrowShare) * l.gSunBroad;
    expect(meanCos).toBeCloseTo(0.8575, 4);
    expect(henyeyGreenstein(-1, l.gDiffuse) / henyeyGreenstein(0, l.gDiffuse)).toBeCloseTo(0.48, 2);
    // Two lobes against one of 0.88: side light at 90 degrees within 50%.
    const ratio = sunPhase(0) / henyeyGreenstein(0, 0.88);
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(1.5);
    // And half the halo at 10 degrees.
    expect(sunPhase(Math.cos(10 * DEG)) / henyeyGreenstein(Math.cos(10 * DEG), 0.88)).toBeLessThan(0.55);
  });
});

describe('the path light (the fog)', () => {
  const j0: Rgb = [1, 1, 1];

  it('equals a numerical integral of the scattered light along the line of sight', () => {
    const c = pathAttenuation();
    const k = diffuseAttenuation();
    for (const mu of [-0.8, -0.2, 0, 0.3, 0.9]) {
      for (const S of [3, 12, 40]) {
        const L = inscatterPath(j0, mu, S);
        for (let i = 0; i < 3; i += 1) {
          let acc = 0;
          const N = 20000;
          for (let n = 0; n < N; n += 1) {
            const s = ((n + 0.5) / N) * S;
            acc += Math.exp(k[i] * mu * s) * Math.exp(-c[i] * s) * (S / N);
          }
          // The floor on the red looking up changes it by under 1% at 20 m.
          expect(Math.abs(L[i] - acc) / acc).toBeLessThan(i === 0 && mu > 0.5 && S > 20 ? 0.03 : 0.01);
        }
      }
    }
  });

  it('saturates into the deep and refuses an endless line of sight upward', () => {
    const c = pathAttenuation();
    const k = diffuseAttenuation();
    const L = inscatterPath(j0, -0.5, Infinity);
    for (let i = 0; i < 3; i += 1) expect(L[i]).toBeCloseTo(1 / (c[i] + 0.5 * k[i]), 10);
    expect(() => inscatterPath(j0, 0.5, Infinity)).toThrow();
  });

  it('draws fog curves that close on one color from both sides', () => {
    // A dark and a bright surface seen through more and more water: one
    // brightens, the other dims, both toward the same path light.
    const limit = inscatterPath(j0, 0, 1e4);
    const k = pathAttenuation();
    let lastDark = -1;
    let lastBright = Infinity;
    for (let S = 0; S <= 200; S += 5) {
      const path = inscatterPath(j0, 0, S);
      const dark = path[2];
      const bright = 3 * limit[2] * Math.exp(-k[2] * S) + path[2];
      expect(dark).toBeGreaterThanOrEqual(lastDark);
      expect(bright).toBeLessThanOrEqual(lastBright + 1e-12);
      lastDark = dark;
      lastBright = bright;
    }
    expect(lastDark / limit[2]).toBeGreaterThan(0.99);
    expect(lastBright / limit[2]).toBeLessThan(1.01);
  });

  it('is brighter looking up than across, and darker looking down', () => {
    const sun = refractedSunTravelDir([-0.321, 0.866, -0.383]);
    const light = inWaterIrradiance(0.866, 0);
    const across = inscatterSource([0.8, 0, 0.6], sun, 4, light);
    const down = inscatterSource([0, -1, 0], sun, 4, light);
    const up = inscatterSource([0, 1, 0], sun, 4, light);
    expect(up[2]).toBeGreaterThan(across[2]);
    expect(down[2]).toBeLessThan(across[2]);
    // Darker with depth, and red first.
    const deep = inscatterSource([0.8, 0, 0.6], sun, 14, light);
    expect(deep[0] / across[0]).toBeLessThan(deep[2] / across[2]);
  });
});

describe('the daylight and the exposure', () => {
  it('has the hemispherical Fresnel it quotes', () => {
    // 2 * integral of R(theta) cos(theta) sin(theta) dtheta.
    let s = 0;
    const N = 20000;
    for (let i = 0; i < N; i += 1) {
      const th = ((i + 0.5) / N) * (Math.PI / 2);
      s += fresnelAirToWater(Math.cos(th)) * Math.cos(th) * Math.sin(th) * (Math.PI / 2 / N);
    }
    expect(2 * s).toBeCloseTo(DIFFUSE_FRESNEL_INTO_WATER, 2);
  });

  it('lets 1.4% of the fair daylight in under the deck, and gives the storm the exposure its comment states', () => {
    const fair = inWaterIrradiance(0.866, 0);
    const storm = inWaterIrradiance(0.866, 1);
    expect(storm.sun).toBe(0);
    expect(storm.total / fair.total).toBeCloseTo(0.014, 3);
    expect(UNDERWATER_E_REF).toBeCloseTo(fair.total, 10);
    expect(underwaterExposure(fair.total)).toBeCloseTo(UNDERWATER_EXPOSURE_REF, 10);
    // The storm's exposure is 0.8 of round 1's 1.124, as THE EXPOSURE says.
    expect(underwaterExposure(storm.total) / (0.8 * 1.124)).toBeCloseTo(1, 2);
    expect(UNDERWATER_ADAPTATION).toBeGreaterThan(0);
    expect(UNDERWATER_ADAPTATION).toBeLessThan(1);
  });
});

describe('the water by its chlorophyll', () => {
  it('rebuilds the clear table at 0.05 and grows murkier and greener with more', () => {
    const c05 = oceanWaterOptics(CLEAR_WATER_CHL);
    for (let i = 0; i < 3; i += 1) {
      expect(c05.absorption[i]).toBeCloseTo(UNDERWATER_OPTICS.absorption[i], 2);
      expect(c05.scattering[i]).toBeCloseTo(UNDERWATER_OPTICS.scattering[i], 2);
    }
    const fair = beamAttenuation(FAIR_OPTICS);
    // "the green beam attenuation is 0.149 /m (27 m visibility)"
    expect(fair[1]).toBeCloseTo(0.149, 3);
    expect(4 / fair[1]).toBeCloseTo(26.9, 0);
    // "the ripple seen through 6 m keeps 41% of its contrast, not 56%"
    expect(Math.exp(-fair[1] * 6)).toBeCloseTo(0.41, 2);
    expect(Math.exp(-beamAttenuation(UNDERWATER_OPTICS)[1] * 6)).toBeCloseTo(0.56, 2);
    // Greener: the blue attenuation catches up with the green.
    const blueOverGreen = (o: typeof UNDERWATER_OPTICS) => beamAttenuation(o)[2] / beamAttenuation(o)[1];
    expect(blueOverGreen(FAIR_OPTICS)).toBeGreaterThan(blueOverGreen(UNDERWATER_OPTICS));
    expect(() => oceanWaterOptics(0)).toThrow();
  });
});

describe('the water the view ships (round 5, SHIPPED_CHL = CLEAR_WATER_CHL)', () => {
  it('halves the scattering of the round-4 water and keeps more of the ceiling through 10 m', () => {
    const clear = oceanWaterOptics(CLEAR_WATER_CHL);
    // "at 0.05 b is half of what it is at 0.15"
    expect(clear.scattering[1] / FAIR_OPTICS.scattering[1]).toBeCloseTo(0.51, 1);
    // "the beam through 10 m of water keeps 38% of the ceiling's contrast, not 23%"
    expect(Math.exp(-beamAttenuation(clear)[1] * 10)).toBeCloseTo(0.38, 2);
    expect(Math.exp(-beamAttenuation(FAIR_OPTICS)[1] * 10)).toBeCloseTo(0.225, 2);
    // "0.097 /m, 41 m visibility"
    expect(beamAttenuation(clear)[1]).toBeCloseTo(0.097, 2);
    expect(4 / beamAttenuation(clear)[1]).toBeCloseTo(41, -1);
  });
});

describe('the light shafts', () => {
  it('are even at the surface, half formed by 0.3 m, formed within a meter, and fading slowly with depth', () => {
    expect(shaftEnvelope(0)).toBe(0);
    // Round 3: the ramp is 0.4 m (focusM), so the rays start close under the ceiling.
    expect(shaftEnvelope(0.3)).toBeGreaterThan(0.5);
    expect(shaftEnvelope(1.0)).toBeGreaterThan(0.9);
    expect(shaftEnvelope(2.5)).toBeGreaterThan(0.9);
    expect(shaftEnvelope(30)).toBeGreaterThan(0.55);
    expect(shaftEnvelope(30)).toBeLessThan(shaftEnvelope(6));
  });

  it('put the light in sheets and add none: mean 1 over a unit normal field', () => {
    const p = UNDERWATER_SHAFTS;
    for (const w of [p.sheetW, 0.3, 1.0]) {
      for (const env of [1, 0.4]) {
        let sum = 0;
        let norm = 0;
        for (let m = -9; m <= 9; m += 0.0005) {
          const g = Math.exp(-0.5 * m * m);
          sum += shaftSheetLight(m, w, env) * g;
          norm += g;
        }
        expect(sum / norm).toBeCloseTo(1, 4);
      }
    }
    // The closed form of the Gaussian's mean.
    let e = 0;
    let n = 0;
    for (let m = -9; m <= 9; m += 0.0005) {
      const g = Math.exp(-0.5 * m * m);
      e += Math.exp(-((m - 1.8) ** 2) / (2 * 0.12 * 0.12)) * g;
      n += g;
    }
    expect(sheetMean(0.12, 1.8)).toBeCloseTo(e / n, 6);
    expect(() => sheetMean(0, 1)).toThrow();
  });

  it('make a sheet many times the mean and the water between it a tenth', () => {
    const p = UNDERWATER_SHAFTS;
    const peak = shaftSheetLight(p.sheetM0, p.sheetW);
    // Round 3: at the level of 1.0 deviations a sheet's center is 12 times
    // the mean (37 at round 2's 1.8); "a sheet is 12 times the mean at its center".
    expect(peak).toBeGreaterThan(12);
    expect(peak).toBeLessThan(13);
    expect(shaftSheetLight(-3, p.sheetW)).toBeCloseTo(p.sheetBase, 3);
    // "16% of the field lies above a level one deviation up"
    const erfc = (x: number) => {
      // Abramowitz and Stegun 7.1.26.
      const t = 1 / (1 + 0.3275911 * x);
      return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
        * Math.exp(-x * x);
    };
    expect(0.5 * erfc(p.sheetM0 / Math.SQRT2)).toBeCloseTo(0.159, 3);
    // "one crossing in 6 m at 1.8, one in 2 m at 1.0": the crossing rate goes as e^(-m0^2 / 2).
    expect(Math.exp(-(1.8 * 1.8) / 2) / Math.exp(-(1.0 * 1.0) / 2)).toBeCloseTo(0.33, 2);
  });
});

describe('the sheets integrated across a step (round 3)', () => {
  /* erf to 1e-9 (Abramowitz and Stegun 7.1.26 is 1.5e-7; a series is exact enough here). */
  const erfRef = (x: number): number => {
    let sum = 0;
    let term = x;
    for (let n = 0; n < 60; n += 1) {
      sum += term / (2 * n + 1);
      term *= (-x * x) / (n + 1);
    }
    return Math.abs(x) < 4 ? (2 / Math.sqrt(Math.PI)) * sum : Math.sign(x);
  };
  it("erf is Winitzki's form within 1.25e-4 and odd", () => {
    for (let x = -3.5; x <= 3.5; x += 0.05) {
      // Winitzki's largest error is 1.2e-4 (measured 1.2014e-4 near x = 1).
      expect(Math.abs(erfApprox(x) - erfRef(x))).toBeLessThan(1.25e-4);
      expect(erfApprox(-x)).toBeCloseTo(-erfApprox(x), 12);
    }
  });
  it('reads a chord shorter than a twentieth of the width as the point sheet at its middle', () => {
    const p = UNDERWATER_SHAFTS;
    for (const m of [0, 1.2, p.sheetM0, 2.4]) {
      expect(shaftSheetSegment(m, m, p.sheetW)).toBeCloseTo(shaftSheetLight(m, p.sheetW), 12);
      expect(shaftSheetSegment(m - 0.002, m + 0.002, p.sheetW)).toBeCloseTo(shaftSheetLight(m, p.sheetW), 3);
    }
  });
  it('counts a sheet the chord crosses between two steps that both miss it', () => {
    const p = UNDERWATER_SHAFTS;
    const w = p.sheetW;
    // A step from half a deviation under the focus level to half over it.
    const a = p.sheetM0 - 0.5;
    const b = p.sheetM0 + 0.5;
    const point = 0.5 * (shaftSheetLight(a, w) + shaftSheetLight(b, w));
    // The exact mean over the chord, by a fine numerical integral.
    let fine = 0;
    const N = 20000;
    for (let i = 0; i < N; i += 1) fine += shaftSheetLight(a + ((i + 0.5) / N) * (b - a), w);
    fine /= N;
    const seg = shaftSheetSegment(a, b, w);
    expect(point).toBeLessThan(0.2);
    expect(fine).toBeGreaterThan(2);
    expect(Math.abs(seg - fine) / fine).toBeLessThan(0.002);
  });
  it('matches a fine march of the point sheet along a smooth pattern from steps that miss its sheets', () => {
    const p = UNDERWATER_SHAFTS;
    const w = p.sheetW;
    // A unit-variance pattern along the path: a sum of sines with fixed
    // phases, features about 1 m long, sampled at fine and at coarse steps.
    const m = (s: number): number => Math.SQRT2 * Math.sqrt(1 / 3) * (
      Math.sin(6.1 * s + 0.3) + Math.sin(4.3 * s + 2.1) + Math.sin(7.9 * s + 4.4)
    );
    const L = 40;
    let fine = 0;
    const NF = 80000;
    for (let i = 0; i < NF; i += 1) fine += shaftSheetLight(m(((i + 0.5) / NF) * L), w);
    fine /= NF;
    const coarseStep = 0.25; // a quarter of a feature: what the far march does
    let seg = 0;
    let point = 0;
    let n = 0;
    for (let s = coarseStep; s <= L; s += coarseStep) {
      seg += shaftSheetSegment(m(s - coarseStep), m(s), w);
      point += shaftSheetLight(m(s), w);
      n += 1;
    }
    seg /= n;
    point /= n;
    // The segment form reads the sheets the coarse steps miss: within 3% of
    // the fine march; the point read at the same steps is off by more.
    expect(Math.abs(seg - fine) / fine).toBeLessThan(0.03);
    expect(Math.abs(point - fine) / fine).toBeGreaterThan(Math.abs(seg - fine) / fine);
  });
});

describe('the lens tiles', () => {
  const ripple = DEFAULT_CASCADES[0];
  const psi = (kx: number, kz: number) => directionalSpectrum(kx, kz, ripple);

  it('has a comb transfer of 1 at k = 0 and the two-tap cosine', () => {
    const h = combTransfer([[2, 0.1]]);
    expect(h(0)).toBe(1);
    expect(h(7)).toBeCloseTo(Math.cos(0.35), 12);
    expect(() => combTransfer([[0, 0.1]])).toThrow();
  });

  it('spreads the fold deficit as the choppiness times the RMS slope, unfiltered', () => {
    const n = 64;
    const rms = foldDeficitRms(psi, ripple.patchM, n, ripple.choppiness);
    const dk = (2 * Math.PI) / ripple.patchM;
    let mss = 0;
    for (let z = 1; z < n; z += 1) {
      for (let x = 1; x < n; x += 1) {
        const kx = (x - n / 2) * dk;
        const kz = (z - n / 2) * dk;
        mss += (kx * kx + kz * kz) * psi(kx, kz) * dk * dk;
      }
    }
    expect(rms).toBeCloseTo(ripple.choppiness * Math.sqrt(mss), 10);
    // A filter only takes spread away.
    expect(foldDeficitRms(psi, ripple.patchM, n, ripple.choppiness, combTransfer([[4, 0.2]]))).toBeLessThan(rms);
  });

  it('matches the realized field the GPU tiles are built from', () => {
    const n = 128;
    const spec = buildCascadeSpectrum({ ...ripple }, n, 0x0cea9);
    const f = realizeCascade(spec, 42);
    // The linear deficit is minus the divergence of the displacement.
    let s2 = 0;
    for (let i = 0; i < n * n; i += 1) {
      const d = -(f.dxdx[i] + f.dzdz[i]);
      s2 += d * d;
    }
    const realized = Math.sqrt(s2 / (n * n));
    const analytic = foldDeficitRms(psi, ripple.patchM, n, ripple.choppiness);
    expect(Math.abs(realized - analytic) / analytic).toBeLessThan(0.08);
  });
});

describe('the calibration', () => {
  it('draws a bare line of sight 4 m down in the fair water where the comments say', () => {
    const sun = refractedSunTravelDir([-0.321, 0.866, -0.383]);
    const light = inWaterIrradiance(0.866, 0);
    const K = underwaterExposure(light.total);
    const drawn = (dir: [number, number, number]) => {
      const j = inscatterSource(dir, sun, 4, light, FAIR_OPTICS);
      return acesFilmicSrgb8(inscatterPath([j[0] * K, j[1] * K, j[2] * K], dir[1], Infinity, FAIR_OPTICS));
    };
    const square = drawn([0.77, 0, -0.64]);
    const toward = drawn([-0.64, 0, -0.77]);
    for (const [got, want] of [[square, [0, 52, 72]], [toward, [0, 67, 91]]] as const) {
      for (let i = 0; i < 3; i += 1) expect(Math.abs(got[i] - want[i])).toBeLessThanOrEqual(2);
    }
  });
});

describe('the white balance', () => {
  it('goes half-way to a grey card at the camera, and never touches the green', () => {
    const at0 = underwaterWhiteBalance(0);
    expect(at0[0]).toBeCloseTo(1, 12);
    expect(at0[2]).toBeCloseTo(1, 12);
    const at4 = underwaterWhiteBalance(4);
    expect(at4[1]).toBe(1);
    expect(at4[0]).toBeCloseTo(1.8, 1);
    expect(at4[2]).toBeCloseTo(0.94, 2);
    expect(underwaterWhiteBalance(14)[0]).toBeCloseTo(15.3, 0);
    // Deeper, more red is made back and more blue taken off.
    expect(underwaterWhiteBalance(14)[0]).toBeGreaterThan(at4[0]);
    expect(underwaterWhiteBalance(14)[2]).toBeLessThan(at4[2]);
  });
});

describe('the tone map twin', () => {
  it('keeps black black, a grey grey, and clips the sun', () => {
    expect(acesFilmicSrgb8([0, 0, 0])).toEqual([0, 0, 0]);
    const g = acesFilmicSrgb8([0.18, 0.18, 0.18]);
    expect(Math.abs(g[0] - g[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(g[1] - g[2])).toBeLessThanOrEqual(1);
    expect(acesFilmicSrgb8([30, 30, 30])).toEqual([255, 255, 255]);
  });
});
