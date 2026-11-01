/**
 * Rocks round 13 (ocean gauntlet): the laws of the plume's draw.
 *  - A COLUMN'S EDGE IS THE GAUSSIAN'S: the quad's reach (splashGaussReach).
 *  - CLUMPED TRAINS SHADE AS THEIR COVER (splashEin, splashClumpedCrossSection).
 *  - THE TRAINS THE CAMERA RESOLVES, AND THE REST AS THEIR VEIL (splashTrainPlan).
 * See the "## Rocks" Round 13 block of docs/architecture/domains/world3d-ocean.md.
 */
import { describe, expect, it } from 'vitest';
import {
  SPLASH_TAU_EPS,
  SPLASH_TRAIN_MAX,
  splashClumpedCrossSection,
  splashEin,
  splashGaussReach,
  splashTrainPlan,
} from '../oceanSplashMath';
import {
  ROCK_ROLLER_PER_H,
  rockDrainRivuletShare,
  rockFilmMinThicknessM,
  rockFingerWavelengthM,
  rockRollerLengthM,
  ROCK_COLLAR_REACH_M,
  rockBackwashSpeed,
  rockFlowAt,
} from '../oceanRocksMath';

/** The opacity of a Gaussian column of peak tau0 at d half widths (the quad's half width is 3 sigma). */
const opacityAt = (tau0: number, d: number) => 1 - Math.exp(-tau0 * Math.exp(-4.5 * d * d));

describe('rocks round 13: a column of drops has no rim of its own', () => {
  it('reaches its quad to where the column falls to the draw\'s least opacity', () => {
    for (const tau0 of [0.5, 2, 10, 100, 1000]) {
      const d = splashGaussReach(tau0);
      expect(d).toBeGreaterThanOrEqual(1);
      if (tau0 * Math.exp(-4.5) > SPLASH_TAU_EPS) {
        // Past 3 sigma the column is still drawn: at the reach it is the least opacity, 0.002.
        expect(opacityAt(tau0, d)).toBeCloseTo(0.002, 6);
      } else {
        expect(d).toBe(1);
      }
    }
    // Round 12's cut at d = 1 left a train of tau0 = 100 at 67% opacity on its quad's edge.
    expect(opacityAt(100, 1)).toBeGreaterThan(0.6);
    expect(opacityAt(100, splashGaussReach(100))).toBeLessThan(0.0021);
    // Thin columns keep the old quad.
    expect(splashGaussReach(0.1)).toBe(1);
    expect(splashGaussReach(0)).toBe(1);
  });
});

describe('rocks round 13: clumped trains shade as their cover', () => {
  it('computes Ein, the entire exponential integral, on both sides of the series switch', () => {
    // Ein(z) = gamma + ln z + E1(z); E1(1) = 0.219383934, E1(10) = 4.156968929e-6 (Abramowitz and Stegun table 5.1).
    expect(splashEin(1)).toBeCloseTo(0.5772156649 + 0 + 0.219383934, 8);
    expect(splashEin(10)).toBeCloseTo(0.5772156649 + Math.log(10) + 4.156968929e-6, 6);
    // Continuous across z = 8 (series below, asymptotic above).
    expect(Math.abs(splashEin(8 + 1e-9) - splashEin(8 - 1e-9))).toBeLessThan(1e-6);
    // Ein(z) = z - z^2 / 4 + z^3 / 18 - ... for small z.
    expect(splashEin(1e-3)).toBeCloseTo(1e-3 - 1e-6 / 4 + 1e-9 / 18, 13);
    expect(splashEin(0)).toBe(0);
  });

  it('keeps the cross-section of thin trains and caps dense ones at the area they cover', () => {
    const sigma = 0.02;
    const a = 2 * Math.PI * sigma * sigma;
    // Thin trains: each tau0 = 0.01, so the clumped cloud shades as the uniform one.
    const csThin = 0.01 * a * 20;
    expect(splashClumpedCrossSection(csThin, 20, sigma) / csThin).toBeGreaterThan(0.99);
    // Dense trains: tau0 = 1000; they shade as K a Ein(tau0), far under their cross-section.
    const csDense = 1000 * a * 20;
    const eff = splashClumpedCrossSection(csDense, 20, sigma);
    expect(eff).toBeCloseTo(20 * a * splashEin(1000), 9);
    expect(eff / csDense).toBeLessThan(0.01);
    // More trains of the same water spread it thinner: more effective cover, never past cs.
    expect(splashClumpedCrossSection(csDense, 200, sigma)).toBeGreaterThan(eff);
    expect(splashClumpedCrossSection(csDense, 1e7, sigma)).toBeLessThanOrEqual(csDense);
  });

  it('matches the mean transmittance of random trains (a Monte Carlo check of the law)', () => {
    // K trains at uniform random places over a square region of side L (wrapped), each a Gaussian
    // column of sigma and peak tau0; the mean of exp(-tau) over the region against exp(-cs_eff / L^2).
    const L = 1; const K = 60; const sigma = 0.03; const tau0 = 4;
    let seed = 12345;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const cx: number[] = []; const cz: number[] = [];
    for (let k = 0; k < K; k += 1) { cx.push(rnd() * L); cz.push(rnd() * L); }
    let sumT = 0; const n = 200;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const x = (i + 0.5) / n; const z = (j + 0.5) / n;
        let tau = 0;
        for (let k = 0; k < K; k += 1) {
          let dx = Math.abs(x - cx[k]); let dz = Math.abs(z - cz[k]);
          dx = Math.min(dx, L - dx); dz = Math.min(dz, L - dz);
          tau += tau0 * Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
        }
        sumT += Math.exp(-tau);
      }
    }
    const meanT = sumT / (n * n);
    const cs = tau0 * 2 * Math.PI * sigma * sigma * K;
    const law = Math.exp(-splashClumpedCrossSection(cs, K, sigma) / (L * L));
    const uniform = Math.exp(-cs / (L * L));
    // The law is near the measured mean; the uniform cloud of the same water is much darker.
    expect(Math.abs(law - meanT)).toBeLessThan(0.03);
    expect(meanT - uniform).toBeGreaterThan(0.1);
  });
});

describe('rocks round 13: the trains the camera resolves, and the rest as their veil', () => {
  it('draws a region of one train, or of trains under the pixel, as one sprite', () => {
    // A region of one train: one sprite, all its water, no veil.
    expect(splashTrainPlan(0.001, 0.001, 0.0001, 1e6, 1)).toEqual({ trains: 1, trainShare: 1, veilCsM2: 0 });
    // A region under the pixel holding 16 unresolved trains: one sprite at their clumped cross-section.
    expect(splashTrainPlan(0.004, 0.001, 0.005, 1e6, 1)).toEqual({ trains: 0, trainShare: 0, veilCsM2: splashClumpedCrossSection(1, 16, 0.001) });
    // A mist or a sheet (no train sigma): one sprite.
    expect(splashTrainPlan(0.5, 0, 0.001, 1e6, 1)).toEqual({ trains: 1, trainShare: 1, veilCsM2: 0 });
  });

  it('writes a parcel of trains under the pixel as one sprite: its region at the clumped cross-section (ruling 3)', () => {
    // sigma_t 1 mm under the pixel's 3 mm: no train is drawn; the region's one column holds the trains' cover.
    const p = splashTrainPlan(0.03, 0.001, 0.003, 1e6, 1);
    expect(p.trains).toBe(0);
    expect(p.veilCsM2).toBeCloseTo(splashClumpedCrossSection(1, 900, 0.001), 12);
    // The same parcel seen closer (the pixel 0.5 mm) is drawn as its trains.
    expect(splashTrainPlan(0.03, 0.001, 0.0005, 1e6, 1).trains).toBe(SPLASH_TRAIN_MAX);
  });

  it('keeps round 12 under the cap: the trains carry all the water', () => {
    const p = splashTrainPlan(0.1, 0.05, 0.001, 1e6, 2);
    expect(p.trains).toBeCloseTo(4, 9);
    expect(p.trainShare).toBe(1);
    expect(p.veilCsM2).toBe(0);
    // A parcel of few drops is that many trains (round 12).
    expect(splashTrainPlan(1, 0.01, 0.001, 3, 2).trains).toBe(3);
  });

  it('past the cap, draws the cap\'s trains at their true share and the rest as the clumped veil', () => {
    const sR = 0.3; const sT = 0.01; const cs = 0.5;
    const p = splashTrainPlan(sR, sT, 0.001, 1e6, cs);
    const k = (sR / sT) ** 2;
    expect(p.trains).toBe(SPLASH_TRAIN_MAX);
    expect(p.trainShare).toBeCloseTo(SPLASH_TRAIN_MAX / k, 12);
    expect(p.veilCsM2).toBeCloseTo(splashClumpedCrossSection(cs * (1 - SPLASH_TRAIN_MAX / k), k - SPLASH_TRAIN_MAX, sT), 12);
    // Each drawn train is as dense as a real one (cs / K), not cs / maxK (round 12's discs).
    expect((cs * p.trainShare) / p.trains).toBeCloseTo(cs / k, 12);
    // No step at the cap: just past it, the veil holds almost nothing.
    const sAt = sT * Math.sqrt(SPLASH_TRAIN_MAX * 1.0001);
    const q = splashTrainPlan(sAt, sT, 0.001, 1e6, cs);
    expect(q.veilCsM2 / cs).toBeLessThan(1e-3);
    expect(q.trainShare).toBeGreaterThan(0.999);
  });
});

describe('rocks round 13: the water on the stone', () => {
  it('breaks a thin draining film into rivulets that carry its flux at the least thickness', () => {
    const d = rockFilmMinThicknessM(1);
    // A whole film covers the face; a film half delta_min thick runs as rivulets over an eighth of it.
    expect(rockDrainRivuletShare(2 * d, 1)).toBe(1);
    expect(rockDrainRivuletShare(d, 1)).toBeCloseTo(1, 12);
    expect(rockDrainRivuletShare(0.5 * d, 1)).toBeCloseTo(0.125, 12);
    expect(rockDrainRivuletShare(0, 1)).toBe(0);
    // A gentler face holds a thicker least film, so the same film breaks sooner there.
    expect(rockDrainRivuletShare(0.5 * d, 0.3)).toBeLessThan(0.125);
  });

  it('fingers a draining front at 14 capillary-ridge lengths (Troian et al. 1989)', () => {
    // A 1 cm sheet on a vertical face: 14 (h l_c^2)^(1/3), l_c = 2.7 mm: about 6 cm.
    const lam = rockFingerWavelengthM(0.01, 1);
    expect(lam).toBeGreaterThan(0.05);
    expect(lam).toBeLessThan(0.07);
    // It goes as h^(1/3) and as sin(a)^(-1/3).
    expect(rockFingerWavelengthM(0.08, 1) / lam).toBeCloseTo(2, 9);
    expect(rockFingerWavelengthM(0.01, 0.125) / lam).toBeCloseTo(2, 9);
  });

  it('whitens the swash only in its roller, about 0.9 of the bore height behind its front (Svendsen 1984)', () => {
    expect(rockRollerLengthM(0.5)).toBeCloseTo(0.5 * ROCK_ROLLER_PER_H, 12);
    expect(rockRollerLengthM(-1)).toBe(0);
  });
});

describe('rocks round 13: the water round the rock moves the foam', () => {
  it('perturbs the surge as the potential flow round a circle, and is still inside the rock', () => {
    const out = new Float64Array(2);
    const ub = new Float64Array(16);
    const a = 2;
    // Inside: still.
    expect(Array.from(rockFlowAt(0, 0, a, 1, 0, ub, 0, 0.5, 0.5, out))).toEqual([0, 0]);
    // On the flank (90 degrees off the surge) the full flow is 2 U: the perturbation is +U along it.
    rockFlowAt(0, 0, a, 1, 0, ub, 0, 0, a + 1e-9, out);
    expect(out[0]).toBeCloseTo(1, 6);
    expect(out[1]).toBeCloseTo(0, 6);
    // At the struck point the water stands: the perturbation is -U.
    rockFlowAt(0, 0, a, 1, 0, ub, 0, -a - 1e-9, 0, out);
    expect(out[0]).toBeCloseTo(-1, 6);
    // It falls as (a / r)^2: at 4 a, a sixteenth.
    rockFlowAt(0, 0, a, 1, 0, ub, 0, 0, 4 * a, out);
    expect(out[0]).toBeCloseTo(1 / 16, 6);
    // The same flow turned with the surge (U along z).
    rockFlowAt(0, 0, a, 0, 1, ub, 0, a + 1e-9, 0, out);
    expect(out[1]).toBeCloseTo(1, 6);
    expect(out[0]).toBeCloseTo(0, 6);
  });

  it('adds the backwash as a radial wall jet, a / r, mixed out over the collar reach', () => {
    const out = new Float64Array(2);
    const ub = new Float64Array(16).fill(0);
    ub[4] = 3; // the face at 90 degrees (sector 4 of 16, azimuth 0 at sector 0)
    rockFlowAt(0, 0, 1, 0, 0, ub, 0, 0, 1 + 1e-9, out);
    expect(out[1]).toBeCloseTo(3, 6);
    expect(out[0]).toBeCloseTo(0, 6);
    rockFlowAt(0, 0, 1, 0, 0, ub, 0, 0, 2, out);
    expect(out[1]).toBeCloseTo(1.5 * Math.exp(-1 / ROCK_COLLAR_REACH_M), 9);
    // A face with no water over the sea sends none.
    rockFlowAt(0, 0, 1, 0, 0, ub, 0, 0, -2, out);
    expect(Math.hypot(out[0], out[1])).toBe(0);
    expect(rockBackwashSpeed(0.5)).toBeCloseTo(Math.sqrt(2 * 9.81 * 0.5), 2);
  });
});
