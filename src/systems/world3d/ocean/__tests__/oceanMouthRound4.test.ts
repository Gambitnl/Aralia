/**
 * River mouth round 4 (2026-10-10): the laws this round added, each test
 * naming the law it holds. The sea's waves past the bar as bores (Battjes and
 * Janssen 1978; Battjes and Stive 1985), the fine chop as drawn roughness
 * (Elfouhaily et al. 1997), the place's conditions by measure, the plume's
 * silt kept up by the waves (Krone 1962) and the wave-stirred sand (van Rijn
 * 1984, 1993).
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';
import { MEDIUM_SAND_D50_M, waveNumberAt } from '../oceanBeachMath';
import {
  ELF_CM_MS, ELF_KM_RAD_M, KRONE_TAU_CD_PA, SARCELLE_CONDITIONS, battjesJanssenMarch, battjesStiveGamma, bjBreakFraction,
  capillaryPhaseSpeed, coxMunkMss, deriveMouthDesign, elfouhailyBh, elfouhailySlopeVar, fineChopPatch, frictionVelocityMS,
  groupSpeed, kroneDepositShare, mouthEdgeBore, mouthPlaceConditions, sandScatterM2PerG, shieldsCritical, stirredSandLoad,
  waveBedStressPa, waveNumberOnCurrent, SED_SCATTER_M2_G, sedimentSlopeOf, srgbToLinear, turbidOptics,
  COAST_PLACES,
} from '../oceanMouthMath';

const cascades = oceanSeaState('surf');
const seed = 0x0cea9;
const sarcelle = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades, n: OCEAN_FFT_N, seed, statsSpanS: 120, barLaw: 'break', dayDischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S });

describe('the share of broken waves (Battjes and Janssen 1978)', () => {
  it('is the root of (1 - Q) / ln Q = -b^2, and 1 at b >= 1', () => {
    for (const b of [0.3, 0.5, 0.7, 0.9, 0.99]) {
      const q = bjBreakFraction(b);
      expect(q).toBeGreaterThan(0);
      expect(q).toBeLessThan(1);
      expect((1 - q) / Math.log(q)).toBeCloseTo(-b * b, 6);
    }
    expect(bjBreakFraction(1)).toBe(1);
    expect(bjBreakFraction(1.4)).toBe(1);
    expect(bjBreakFraction(0)).toBe(0);
  });
  it('takes Battjes and Stive\'s (1985) breaker index from the deep-water steepness', () => {
    expect(battjesStiveGamma(0.001, 10)).toBeCloseTo(0.5, 2);
    expect(battjesStiveGamma(1.7, 5.45)).toBeGreaterThan(0.8);
    expect(battjesStiveGamma(1.7, 5.45)).toBeLessThan(0.9);
  });
});

describe('the wave number on a current (Doppler: (omega - k U)^2 = g k tanh k h)', () => {
  it('is linear theory\'s with no current, shorter against a current, and NaN where the current blocks the wave', () => {
    const w = (2 * Math.PI) / 5.45;
    // waveNumberAt is Fenton and McKee's explicit fit (within about 1.5%); this root is exact.
    expect(waveNumberOnCurrent(w, 1.2, 0) / waveNumberAt(w, 1.2)).toBeCloseTo(1, 1);
    const k0 = waveNumberOnCurrent(w, 1.2, 0);
    expect(Math.sqrt(9.81 * k0 * Math.tanh(k0 * 1.2))).toBeCloseTo(w, 8);
    expect(waveNumberOnCurrent(w, 1.2, -1)).toBeGreaterThan(waveNumberAt(w, 1.2));
    expect(waveNumberOnCurrent(w, 1.2, 1)).toBeLessThan(waveNumberAt(w, 1.2));
    // A 1 s wave in deep water: cg 0.78 m/s; a 2 m/s current against it blocks it.
    expect(Number.isNaN(waveNumberOnCurrent(2 * Math.PI, 20, -2))).toBe(true);
  });
});

describe('the random waves\' energy across a surf zone (Battjes and Janssen 1978)', () => {
  it('conserves the energy flux where nothing breaks: linear shoaling', () => {
    const n = 200;
    const x = Array.from({ length: n }, (_, i) => i * 5);
    const h = x.map((xx) => 40 - xx * 0.02);
    const tS = 8;
    const m = battjesJanssenMarch({ xM: x, depthM: h, hrms0M: 0.3, tS, d50M: MEDIUM_SAND_D50_M });
    const w = (2 * Math.PI) / tS;
    const f0 = m.hrmsM[0] ** 2 * groupSpeed(w, h[0]);
    const f1 = m.hrmsM[n - 1] ** 2 * groupSpeed(w, h[n - 1]);
    // The bed's friction takes a little: under 2% of the flux over a kilometer.
    expect(f1 / f0).toBeGreaterThan(0.98);
    // groupSpeed is the explicit fit's: the flux holds to its 1%.
    expect(f1 / f0).toBeLessThan(1.01);
  });
  it('holds the rms height near 0.4 h on a 1:50 beach\'s inner surf (the saturated surf zone)', () => {
    const n = 800;
    const x = Array.from({ length: n }, (_, i) => i * 0.5);
    const h = x.map((xx) => Math.max(8 - xx / 50, 0.05));
    const m = battjesJanssenMarch({ xM: x, depthM: h, hrms0M: 1.2, tS: 8, d50M: MEDIUM_SAND_D50_M });
    for (const hh of [2, 1.5, 1]) {
      const i = h.findIndex((v) => v <= hh);
      expect(m.hrmsM[i] / h[i]).toBeGreaterThan(0.3);
      expect(m.hrmsM[i] / h[i]).toBeLessThan(0.6);
    }
  });
  it('conserves the wave action on an opposing current where nothing breaks: H^2 (cg + U) / sigma holds', () => {
    const n = 100;
    const x = Array.from({ length: n }, (_, i) => i);
    const h = x.map(() => 30);
    const u = x.map((xx) => -0.5 * (xx / (n - 1)));
    const tS = 6;
    const m = battjesJanssenMarch({ xM: x, depthM: h, currentMS: u, hrms0M: 0.05, tS, d50M: MEDIUM_SAND_D50_M, gamma: 5 });
    const w = (2 * Math.PI) / tS;
    const act = (i: number) => {
      const k = waveNumberOnCurrent(w, h[i], u[i]);
      return (m.hrmsM[i] ** 2 * m.cgU[i]) / (w - k * u[i]);
    };
    expect(act(n - 1) / act(0)).toBeCloseTo(1, 3);
    // The opposing current shortens and steepens the wave: it grows.
    expect(m.hrmsM[n - 1]).toBeGreaterThan(m.hrmsM[0]);
  });
  it('leaves the Sarcelle\'s edge a train of bores: the 2.4 m sea at Hrms under 0.55 of the edge depth', () => {
    const eb = mouthEdgeBore(sarcelle, sarcelle.mouthA);
    const hEdge = 0.72;
    expect(eb.hrmsM).toBeGreaterThan(0.1);
    expect(eb.hrmsM * Math.SQRT2).toBeLessThan(0.55 * 1.2 * hEdge);
    // It broke on the way: the share of broken waves rose over the bar.
    expect(Math.max(...eb.march.qb)).toBeGreaterThan(0.3);
  });
});

describe('the fine chop (Elfouhaily, Chapron, Katsaros and Vandemark 1997)', () => {
  it('has its curvature peak near the gravity-capillary minimum: c(k_m) = c_m', () => {
    expect(capillaryPhaseSpeed(ELF_KM_RAD_M)).toBeCloseTo(Math.sqrt(2 * 9.81 / ELF_KM_RAD_M), 6);
    expect(Math.abs(capillaryPhaseSpeed(ELF_KM_RAD_M) - ELF_CM_MS)).toBeLessThan(0.005);
    // At u* = c_m, alpha_m is 0.01: B_h(k_m) = 0.005 c_m / c(k_m).
    const u10AtCm = (() => { let u = 5; for (let i = 0; i < 60; i += 1) u -= (frictionVelocityMS(u) - ELF_CM_MS) / 0.04; return u; })();
    expect(elfouhailyBh(ELF_KM_RAD_M, u10AtCm)).toBeCloseTo(0.005 * ELF_CM_MS / capillaryPhaseSpeed(ELF_KM_RAD_M), 5);
  });
  it('rises with the wind', () => {
    expect(elfouhailyBh(150, 12)).toBeGreaterThan(elfouhailyBh(150, 6));
  });
  it('draws the patch with the spectrum\'s slope variance over its band, as a real field', () => {
    const p = fineChopPatch({ u10: 12, dirX: 0, dirZ: -1, cpMS: 1.1, seed: 7, n: 256, patchM: 1.28 });
    expect(p.drawnVar / p.lawVar).toBeGreaterThan(0.9);
    expect(p.drawnVar / p.lawVar).toBeLessThan(1.1);
    let mx = 0;
    let mz = 0;
    for (let i = 0; i < p.n * p.n; i += 1) { mx += p.data[4 * i]; mz += p.data[4 * i + 1]; }
    expect(Math.abs(mx / (p.n * p.n))).toBeLessThan(1e-6);
    expect(Math.abs(mz / (p.n * p.n))).toBeLessThan(1e-6);
    // The second moments are the slopes squared (LEAN's level 0).
    expect(p.data[2]).toBeCloseTo(p.data[0] * p.data[0], 6);
    expect(p.subVar).toBeGreaterThan(0);
    // The patch, its remainder and the FFT's band from 10 cm to 6.5 m stay within Cox and Munk's whole sea at the wind.
    const fft = elfouhailySlopeVar((2 * Math.PI) / 6.5, (2 * Math.PI) / 0.102, 12);
    expect(p.lawVar + p.subVar + fft).toBeGreaterThan(0.5 * coxMunkMss(12));
    expect(p.lawVar + p.subVar + fft).toBeLessThan(1.5 * coxMunkMss(12));
  });
});

describe('the place\'s conditions (sheet q34: by measure)', () => {
  it('gives the Sarcelle the clip\'s conditions and the creek the open sea\'s', () => {
    expect(mouthPlaceConditions('sarcelle')).toBe(SARCELLE_CONDITIONS);
    // The clip's reflected band is as bright as the fair sky's: no deck.
    expect(SARCELLE_CONDITIONS.overcast).toBe(0);
    expect(mouthPlaceConditions('creek')).toBeNull();
  });
  it('takes the sediment\'s hue from the clip\'s sand: the deep turbid water\'s red over blue is the sand\'s', () => {
    const sl = sedimentSlopeOf('sarcelle', sarcelle.sedimentGM3);
    const o = turbidOptics(sarcelle.sedimentGM3, 0.9, sl);
    const want = srgbToLinear(SARCELLE_CONDITIONS.sandSrgb[0]) / srgbToLinear(SARCELLE_CONDITIONS.sandSrgb[2]);
    expect(o.rInfRGB[0] / o.rInfRGB[2]).toBeCloseTo(want, 3);
    // Round 5: the Sarcelle's river optics are now fit to the clip's own water (\`placeRiverOptics\`; the
    // round-5 tests hold it); the sand's hue law stays for a place with a clip of its sand only.
    expect(sarcelle.optics.rInfRGB[0]).not.toBeCloseTo(o.rInfRGB[0], 3);
    // The creek keeps round 2's soil mineral.
    expect(sedimentSlopeOf('creek', 500)).toBe(0.0123);
  });
});

describe('the sediment the waves hold up (Krone 1962; van Rijn 1984, 1993)', () => {
  it('lets silt settle only under the critical stress for deposition', () => {
    expect(kroneDepositShare(0)).toBe(1);
    expect(kroneDepositShare(KRONE_TAU_CD_PA / 2)).toBeCloseTo(0.5, 9);
    expect(kroneDepositShare(KRONE_TAU_CD_PA * 3)).toBe(0);
  });
  it('gives the waves a bed stress over the sand\'s threshold in the surf zone and under it on the deep shelf', () => {
    const d50 = MEDIUM_SAND_D50_M;
    const tauCr = shieldsCritical(d50) * 1.65 * 1025 * 9.81 * d50;
    expect(tauCr).toBeGreaterThan(0.1);
    expect(tauCr).toBeLessThan(0.4);
    expect(waveBedStressPa(0.45, 5.45, 1, d50)).toBeGreaterThan(tauCr);
    expect(waveBedStressPa(1.6, 5.45, 40, d50)).toBeLessThan(tauCr);
  });
  it('stirs no sand under the threshold and a falling profile over it', () => {
    const d50 = MEDIUM_SAND_D50_M;
    expect(stirredSandLoad({ hrmsM: 1.6, tS: 5.45, hM: 40, d50M: d50 }).columnGM2).toBe(0);
    const s = stirredSandLoad({ hrmsM: 0.45, tS: 5.45, hM: 1, d50M: d50 });
    expect(s.columnGM2).toBeGreaterThan(0);
    expect(s.surfGM3).toBeLessThan(s.meanGM3);
  });
  it('scatters per gram of sand a small share of the silt\'s (the grain\'s cross-section)', () => {
    expect(sandScatterM2PerG(MEDIUM_SAND_D50_M) / SED_SCATTER_M2_G).toBeLessThan(0.01);
  });
});
