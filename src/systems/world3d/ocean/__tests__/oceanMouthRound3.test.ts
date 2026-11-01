/**
 * River mouth round 3 (2026-10-10): the laws this round added, each test
 * naming the law it holds. The bar by the friction-dominated jet (Wright 1977;
 * Ozsoy and Unluata 1982; Soulsby 1995; Soulsby and van Rijn 1997).
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';
import { MEDIUM_SAND_D50_M } from '../oceanBeachMath';
import { jetLensM,
  JET_ENTRAINMENT, JET_TABLE_REACH_M, bandShareCpu, envelopeHoldCpu, LEAN_PER_ASYMMETRY, LEAN_TABLE_DEPTH_M, LEAN_TABLE_N, RUESSINK_B_MAX, boreLeanTable,
  crestStretchOf, deriveMouthDesign, erfcAS, frictionJet, jetAt, jetDeposit, jetReachM, jetTakeover, localBandShares,
  reflectedStoppedShareCpu, ruessinkAsymmetry, soulsbyVanRijnLoad, vanRijnCritSpeedMS, waveBedOrbitalMS,
  COAST_PLACES,
} from '../oceanMouthMath';
import { waveNumberAt } from '../oceanBeachMath';

const cascades = oceanSeaState('surf');
const seed = 0x0cea9;
const sarcelle = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades, n: OCEAN_FFT_N, seed, statsSpanS: 120, barLaw: 'break', dayDischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S });

describe('the sand load of a current with waves (Soulsby and van Rijn 1997)', () => {
  const d50 = MEDIUM_SAND_D50_M;
  it('moves no sand under the threshold with no waves, and more with a faster current', () => {
    const ucr = vanRijnCritSpeedMS(1.5, d50);
    expect(soulsbyVanRijnLoad(ucr * 0.9, 0, 1.5, d50)).toBe(0);
    expect(soulsbyVanRijnLoad(ucr * 1.5, 0, 1.5, d50)).toBeGreaterThan(0);
    expect(soulsbyVanRijnLoad(1.0, 0, 1.5, d50)).toBeGreaterThan(soulsbyVanRijnLoad(0.7, 0, 1.5, d50));
  });
  it('lets the waves stir and the current carry: waves raise the load, and with no current there is none', () => {
    expect(soulsbyVanRijnLoad(0.5, 0.8, 1.5, d50)).toBeGreaterThan(soulsbyVanRijnLoad(0.5, 0, 1.5, d50));
    expect(soulsbyVanRijnLoad(0, 1.2, 1.5, d50)).toBe(0);
  });
  it('gives van Rijn\'s threshold near the beach\'s 0.3 m/s for its 0.35 mm sand in a meter of water', () => {
    expect(vanRijnCritSpeedMS(1, d50)).toBeGreaterThan(0.25);
    expect(vanRijnCritSpeedMS(1, d50)).toBeLessThan(0.35);
  });
  it('holds the waves\' bed speed to the broken wave in the surf zone (H = 0.55 h)', () => {
    // On 1 m of water a 2.4 m sea is broken: its bed speed is the 0.55 m wave's, not the 1.7 m rms wave's.
    const held = waveBedOrbitalMS(2.4, 6, 1);
    expect(held).toBeLessThan(waveBedOrbitalMS(0.55 * Math.SQRT2, 6, 1) + 1e-9);
  });
});

describe('the friction-dominated jet (round 3)', () => {
  const flat = (h: number) => frictionJet({
    dischargeM3S: 30, u0MS: 1, areaM2: 30, manningN: 0.035, hsM: 0, tzS: 6, d50M: MEDIUM_SAND_D50_M, depthAt: () => h, reachM: 600,
  });
  it('takes the volume flux in by entrainment at its two edges (dQ/dx = 2 alpha h uc)', () => {
    const j = flat(1);
    for (const i of [10, 100, 400]) {
      const dq = (j.qM3S[i + 1] - j.qM3S[i]) / (j.xM[i + 1] - j.xM[i]);
      expect(dq).toBeCloseTo(2 * JET_ENTRAINMENT * j.hM[i] * j.ucMS[i], 9);
    }
  });
  it('slows faster on a shallower shelf (the bed\'s friction over the depth)', () => {
    const shallow = flat(1);
    const deep = flat(4);
    const at = (j: ReturnType<typeof flat>, x: number) => { let i = 0; while (j.xM[i + 1] <= x) i += 1; return j.mM4S2[i] / j.mM4S2[0]; };
    expect(at(shallow, 150)).toBeLessThan(at(deep, 150));
  });
  it('slows far faster than round 2\'s inertia-dominated jet, which held U0 over a 6.2 w core', () => {
    // Round 2 held the outflow's speed to 248 m on the Sarcelle; the friction jet is well under it by 2 w.
    expect(jetAt(sarcelle, 2 * sarcelle.widthM, 0).um).toBeLessThan(0.75 * sarcelle.u0MS);
  });
  it('lays its bar within two outlet widths of the mouth (Wright 1977: the friction-dominated middle-ground bar)', () => {
    expect(sarcelle.deposit).not.toBeNull();
    expect(sarcelle.barM).toBeGreaterThan(0);
    expect(sarcelle.barM).toBeLessThan(2 * sarcelle.widthM);
    expect(sarcelle.bar).not.toBeNull();
  });
  it('puts the bar on the lobe of the fastest bed rise, and the deposit on it is the sand the jet loses there', () => {
    const j = sarcelle.jet;
    const dep = jetDeposit(j)!;
    let peak = 0;
    for (let i = 0; i < j.n; i += 1) peak = Math.max(peak, j.depositM2S[i]);
    expect(dep.peakM2S).toBe(peak);
    expect(dep.fromM).toBeLessThanOrEqual(dep.xM);
    expect(dep.toM).toBeGreaterThanOrEqual(dep.xM);
    // The lobe's sand is the fall of the jet's sand flux across it.
    let i0 = 0; while (j.xM[i0] < dep.fromM) i0 += 1;
    let i1 = i0; while (i1 + 1 < j.n && j.xM[i1] < dep.toM) i1 += 1;
    expect(dep.sandM3S / (j.qsM3S[Math.max(i0 - 1, 0)] - j.qsM3S[Math.min(i1 + 1, j.n - 1)])).toBeCloseTo(1, 1);
  });
  it('stands the bar\'s crest where the sea\'s wave held to the floor there breaks in full', () => {
    const b = sarcelle.bar!;
    expect(b.depthM).toBeCloseTo(Math.min(sarcelle.hsM, 0.55 * b.floorDepthM) / 0.75, 9);
    expect(b.depthM).toBeLessThan(b.floorDepthM);
  });
  it('still carries the discharge as river water at every distance', () => {
    for (const x of [0, 10, 60, 300]) {
      let f = 0;
      const dy = 0.05;
      for (let y = -500; y < 500; y += dy) { const p = jetAt(sarcelle, x, y); f += p.deltaM * p.u * p.c * dy; }
      expect(f / sarcelle.dischargeM3S).toBeCloseTo(1, 2);
    }
  });
});

describe("the plume's sediment settles (round 3)", () => {
  it('keeps less of its load the farther it travels, by exp(-int ws / (h uc) dx)', () => {
    const j = sarcelle.jet;
    for (let i = 1; i < j.n; i += 1) expect(j.settle[i]).toBeLessThanOrEqual(j.settle[i - 1]);
    expect(j.settle[0]).toBe(1);
  });
  it("ends the drawn plume where its load no longer shows, inside the sea's own radius", () => {
    const reach = jetReachM(sarcelle);
    expect(reach).toBeLessThanOrEqual(JET_TABLE_REACH_M);
    const p = jetAt(sarcelle, reach, 0);
    // Round 12: the drawn column is the buoyant lens's (`jetLensM`), at most the depth-filling one.
    const col = Math.min(p.deltaM, jetLensM(sarcelle, reach)) * p.cm * p.settle * jetTakeover(sarcelle, p.um, p.deltaM);
    expect(1 - Math.exp(-2 * Math.min(...sarcelle.optics.kdRGB) * col)).toBeLessThan(1 / 255 + 1e-9);
  });
});

describe("the bore's lean (Ruessink, Ramaekers and van Rijn 2012)", () => {
  it("gives no asymmetry offshore and the fit's ceiling in the surf, rising with the Ursell number", () => {
    expect(ruessinkAsymmetry(1e-3)).toBeLessThan(1e-3);
    expect(ruessinkAsymmetry(1e3)).toBeCloseTo(RUESSINK_B_MAX, 2);
    let prev = 0;
    for (const ur of [0.05, 0.1, 0.3, 1, 3, 10, 30]) { const a = ruessinkAsymmetry(ur); expect(a).toBeGreaterThanOrEqual(prev); prev = a; }
  });
  it('never folds a sine of the held amplitude (kappa k a = As / 1.06 under 0.81) and leaves the ripple alone', () => {
    const t = boreLeanTable(sarcelle.bands);
    for (let i = 0; i < LEAN_TABLE_N; i += 1) {
      const d = ((i + 0.5) / LEAN_TABLE_N) * LEAN_TABLE_DEPTH_M;
      sarcelle.bands.forEach((b, ci) => {
        if (ci > 3) return;
        const kap = t[i * 4 + ci];
        if (!b.forced) { expect(kap).toBe(0); return; }
        expect(kap).toBeGreaterThanOrEqual(0);
        // kappa = As / (1.06 k a): kappa k a is the asymmetry over 1.06, under the fit's ceiling.
        const hsB = sarcelle.bands.map((bb) => (bb.forced ? bb.hsM * bandShareCpu(bb, d, 0, 0, 0) : 0));
        const a = (hsB[ci] * envelopeHoldCpu(Math.hypot(...hsB), d)) / 2;
        if (a > 1e-4) expect(kap * waveNumberAt(b.omega, d) * a).toBeLessThanOrEqual(RUESSINK_B_MAX / LEAN_PER_ASYMMETRY + 1e-6);
      });
    }
    expect(RUESSINK_B_MAX / LEAN_PER_ASYMMETRY).toBeLessThan(0.81);
  });
  it('leans the swell more in shallow water than in deep', () => {
    const t = boreLeanTable(sarcelle.bands);
    const ci = sarcelle.bands.findIndex((b) => b.name === 'swell');
    const at = (d: number) => t[Math.floor((d / LEAN_TABLE_DEPTH_M) * LEAN_TABLE_N) * 4 + ci];
    expect(at(1.5)).toBeGreaterThan(at(6));
    expect(at(12)).toBeLessThan(at(6) + 1e-9);
  });
});

describe("the river's fetch-limited ripple (Donelan, Hamilton and Hui 1985; Hasselmann et al. 1973)", () => {
  const loc = sarcelle.bands.find((b) => b.local)!;
  it("stretches only the wind-locked band, and not at the sea's own fetch", () => {
    for (const b of sarcelle.bands) if (!b.local) expect(crestStretchOf(b, 50)).toBe(1);
    expect(crestStretchOf(loc, loc.fetchM)).toBe(1);
    expect(crestStretchOf(loc, 117)).toBeGreaterThan(1);
  });
  it("keeps the sea's own wind sea at the sea's own fetch, and a young sea's height under it", () => {
    expect(localBandShares(loc, loc.windMS, loc.fetchM)).toEqual({ h: 1, s: 1 });
    const sh = localBandShares(loc, loc.windMS, 117);
    expect(sh.h).toBeLessThan(1);
    expect(sh.s).toBeGreaterThan(sh.h);
  });
});

describe('the reflected ray meets the water (Smith 1967; Cox and Munk 1954)', () => {
  it('matches erfc', () => {
    expect(erfcAS(0)).toBeCloseTo(1, 6);
    expect(erfcAS(1)).toBeCloseTo(0.157299207, 6);
    expect(erfcAS(-1)).toBeCloseTo(1.842700793, 6);
  });
  it('stops every ray far under the horizon, none far over it, and falls smoothly between', () => {
    expect(reflectedStoppedShareCpu(-0.5, 0.1, 0.05)).toBeGreaterThan(0.999);
    expect(reflectedStoppedShareCpu(0.6, 0.1, 0.05)).toBeLessThan(0.01);
    let prev = 1;
    for (let e = -0.3; e <= 0.6; e += 0.01) {
      const v = reflectedStoppedShareCpu(e, 0.1, 0.05);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      // No step: one hundredth of elevation moves the share by under a tenth (round 2's gate jumped by 1).
      expect(prev - v).toBeLessThan(0.1);
      prev = v;
    }
  });
});
