/**
 * River mouth round 5 (2026-10-12): the laws this round added, each test
 * naming the law it holds. The river's color fit to the clip's water through
 * Gordon's reflectance (Gordon, Brown and Jacobs 1975; Bricaud, Morel and
 * Prieur 1981), the sea's own water with the shelf's sand under the plume,
 * the plume front's eddies (Michalke 1964; Winant and Browand 1974), the
 * river's film (Cox and Munk 1954) and the banks' sand on the mouth's grid
 * (the beach's soil laws; GG-394).
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';
import { BEACH_SWASH } from '../oceanBeachMath';
import {
  COX_MUNK_SLICK_A, COX_MUNK_SLICK_B, CDOM_SLOPE_NM, FILM_LONGEST_M, KH_MODES, KH_MOST_AMPLIFIED_ALPHA, MouthSoil, SARCELLE_CONDITIONS,
  coxMunkMss, coxMunkSlickMss, createMouthSim, deriveMouthDesign, filmBandTake, filmSlick, frontEddyShiftM, frontEddyTable,
  frontEnvelopeNorm, frontModeEnvelope, gordonR, gordonX, jetDomain, jetProfileAt, mouthWaterTable, placeRiverOptics,
  riverIopForReflectance, sandSeaCpu, sandSeaIop, sedimentSlopeOf, turbidOptics, turbidOpticsIop, twoWatersCpu, MouthClock,
  COAST_PLACES,
} from '../oceanMouthMath';

const cascades = oceanSeaState('surf');
const seed = 0x0cea9;
const sarcelle = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades, n: OCEAN_FFT_N, seed, statsSpanS: 120, barLaw: 'break', dayDischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S });
const C = sarcelle.sedimentGM3;

describe('the river\'s color fit to the clip (Gordon et al. 1975)', () => {
  it('inverts Gordon\'s polynomial', () => {
    for (const x of [0.05, 0.2, 0.5, 0.8]) expect(gordonX(gordonR(x))).toBeCloseTo(x, 9);
  });
  it('recovers the clip\'s measured reflectance within the fit\'s residual, lighter than round 4\'s', () => {
    const iop = riverIopForReflectance(SARCELLE_CONDITIONS.waterRInf!, C);
    const o = turbidOpticsIop(C, iop);
    for (let k = 0; k < 3; k += 1) expect(Math.abs(o.rInfRGB[k] - SARCELLE_CONDITIONS.waterRInf![k])).toBeLessThan(0.02);
    expect(iop.residualR).toBeLessThan(0.01);
    const r4 = turbidOptics(C, 0.9, sedimentSlopeOf('sarcelle', C));
    for (let k = 0; k < 3; k += 1) expect(o.rInfRGB[k]).toBeGreaterThan(r4.rInfRGB[k] * 2);
    // The design carries the fit.
    expect(sarcelle.optics.rInfRGB[1]).toBeCloseTo(o.rInfRGB[1], 9);
    expect(placeRiverOptics('sarcelle', C).iop.aG443M).toBe(iop.aG443M);
  });
  it('takes a slope and dissolved matter for a brown water, none for a grey one', () => {
    // A grey water: the particles' absorption near flat; the water's own red absorption is the only spectral term.
    const grey = riverIopForReflectance([0.21, 0.21, 0.21], C);
    expect(grey.residualR).toBeLessThan(0.005);
    expect(grey.aG443M).toBeLessThan(0.05 * C * grey.aP443M2G);
    const brown = riverIopForReflectance([0.30, 0.22, 0.10], C);
    expect(brown.sPNm).toBeGreaterThan(grey.sPNm + 0.005);
    const o = turbidOpticsIop(C, brown);
    expect(o.rInfRGB[0] / o.rInfRGB[2]).toBeGreaterThan(2);
    // The dissolved term falls with Bricaud's slope.
    expect(CDOM_SLOPE_NM).toBe(0.014);
  });
});

describe('the sea\'s own water with the shelf\'s sand under the plume', () => {
  const river = sarcelle.optics;
  const sand = sandSeaIop(C, sarcelle.optics.iop!);
  it('reads bluer than the river where the sand is thin, and like the river where it is thick', () => {
    const thin = sandSeaCpu(sand, 300, 0.01).r;
    expect(thin[2] / thin[0]).toBeGreaterThan(3);
    expect(river.rInfRGB[2] / river.rInfRGB[0]).toBeLessThan(1.1);
    const thick = sandSeaCpu(sand, 1, 10).r;
    for (let k = 0; k < 3; k += 1) expect(thick[k]).toBeCloseTo(river.rInfRGB[k], 1);
  });
  it('lays the river\'s layer over the sea\'s (Maritorena et al. 1994): the river alone under a deep layer, the sea with none', () => {
    const body: [number, number, number] = [0.01, 0.03, 0.05];
    const deep = twoWatersCpu(river, sand, 2, 30, 0.1, body);
    for (let k = 0; k < 3; k += 1) expect(deep[k]).toBeCloseTo(river.rInfRGB[k], 6);
    const none = twoWatersCpu(river, sand, 0, 30, 0.1, body);
    const s = sandSeaCpu(sand, 30, 0.1);
    for (let k = 0; k < 3; k += 1) expect(none[k]).toBeCloseTo(s.r[k] * (1 - s.trans[k]) + s.trans[k] * body[k], 9);
    const bare = twoWatersCpu(river, sand, 0, 30, 0, body);
    for (let k = 0; k < 3; k += 1) expect(bare[k]).toBeCloseTo(body[k], 12);
  });
});

describe('the plume front\'s eddies (Michalke 1964; Winant and Browand 1974)', () => {
  const dom = jetDomain(sarcelle);
  const tab = frontEddyTable(sarcelle, dom, seed);
  it('rolls up at the most amplified wavelength and rides at the mean speed', () => {
    for (const x of [20, 80, 200]) {
      const p = jetProfileAt(sarcelle.jet, x);
      const delta = (Math.sqrt(2 * Math.PI) * p.sigma) / 2;
      const lam = (2 * Math.PI * delta) / KH_MOST_AMPLIFIED_ALPHA;
      // The table's local most amplified frequency is (uc / 2) / lambda.
      let i = 0;
      while (i < tab.n - 1 && tab.xM[i + 1] < x) i += 1;
      const pi = jetProfileAt(sarcelle.jet, tab.xM[i]);
      const di = (Math.sqrt(2 * Math.PI) * pi.sigma) / 2;
      expect(tab.data[i * 4 + 1]).toBeCloseTo(Math.log2((pi.uc / 2) / ((2 * Math.PI * di) / KH_MOST_AMPLIFIED_ALPHA)), 4);
      expect(lam).toBeGreaterThan(0);
    }
  });
  it('halves the frequency at each pairing, the modes\' squares summing to 1', () => {
    for (const lf of [Math.log2(tab.f0Hz) - 0.3, Math.log2(tab.f0Hz) - 3.7, Math.log2(tab.f0Hz) - 8]) {
      let s = 0;
      for (let m = 0; m < KH_MODES; m += 1) s += frontModeEnvelope(m, lf, tab.f0Hz) ** 2;
      expect(s * frontEnvelopeNorm(lf, tab.f0Hz) ** 2).toBeCloseTo(1, 9);
    }
  });
  it('moves nothing off the jet, is continuous on the axis past the core, and grows with the layer', () => {
    expect(frontEddyShiftM(tab, -5, 10, 42)).toBe(0);
    for (const x of [150, 300, 600]) {
      expect(Math.abs(frontEddyShiftM(tab, x, 1e-6, 42) - frontEddyShiftM(tab, x, -1e-6, 42))).toBeLessThan(1e-3);
    }
    const rms = (x: number) => { let s = 0; for (let t = 0; t < 400; t += 2) s += frontEddyShiftM(tab, x, 30, t) ** 2; return Math.sqrt(s / 200); };
    expect(rms(80)).toBeGreaterThan(rms(20));
  });
  it('is a pure function of the seed and the time', () => {
    const t2 = frontEddyTable(sarcelle, dom, seed);
    expect(frontEddyShiftM(t2, 60, 20, 42.5)).toBe(frontEddyShiftM(tab, 60, 20, 42.5));
  });
});

describe('the river\'s film (Cox and Munk 1954)', () => {
  it('removes Cox and Munk\'s clean less slick variance, shortest waves first', () => {
    expect(coxMunkSlickMss(10)).toBeCloseTo(COX_MUNK_SLICK_A + COX_MUNK_SLICK_B * 10, 12);
    const f = filmSlick({ windMS: 5.12, fineVar: 0.008, baseVar: 0.009, bandLowM: 0, bandHighM: 6.5 });
    expect(f.removedVar).toBeCloseTo(coxMunkMss(5.12) - coxMunkSlickMss(5.12), 12);
    expect(f.kFine).toBe(1);
    expect(f.kBase).toBe(1);
    expect(f.restNearVar).toBeCloseTo(f.removedVar - 0.008, 12);
    expect(f.bandShortShare).toBeCloseTo(Math.log2(FILM_LONGEST_M / 0.1) / Math.log2(6.5 / 0.1), 12);
    // The band gives no more than its waves under 30 cm.
    expect(filmBandTake(f, 1, 0.41)).toBe(f.bandShortShare);
    expect(filmBandTake(f, 1e-4, 0.41)).toBeCloseTo(1e-4 / (f.bandVarUnit * 0.41 * 0.41), 12);
  });
});

describe('the banks\' sand on the mouth\'s grid (GG-394; the beach\'s soil laws)', () => {
  it('puts the water table at the beach\'s law about the water beside the bank', () => {
    const g = sarcelle.grid;
    const n = g.ns * g.na;
    const bed = new Float64Array(n).fill(1);
    // One row of water (bed under the mean sea level) at j = 0, seaward of the mouth.
    for (let i = 0; i < g.ns; i += 1) bed[i] = -1;
    const wt = mouthWaterTable(sarcelle, bed);
    expect(wt[0]).toBeCloseTo(BEACH_SWASH.wtShoreM, 9);
    const c5 = 5 * g.ns;
    expect(wt[c5]).toBeCloseTo(Math.min(BEACH_SWASH.wtShoreM + BEACH_SWASH.wtSlope * 5 * g.ds, BEACH_SWASH.wtMaxM), 6);
  });
  it('soaks a pond on the sand by Green and Ampt, and books it', () => {
    const bed = new Float64Array(4).fill(1);
    const soil = new MouthSoil(bed, new Float64Array(4).fill(0));
    const h = new Float64Array(4).fill(0.02);
    const hc = new Float64Array(4).fill(0.01);
    soil.reset(new Float64Array(4));
    let took = 0;
    for (let k = 0; k < 3000; k += 1) took += soil.take(h, hc, 0.02, k).water;
    expect(h[0]).toBeLessThan(0.02);
    expect(took).toBeCloseTo(4 * 0.02 - (h[0] + h[1] + h[2] + h[3]), 12);
    // The river's share goes with the water.
    expect(hc[0] / Math.max(h[0], 1e-12)).toBeCloseTo(0.5, 6);
    expect(soil.skinSaturation(0)).toBeGreaterThan(0.9);
  });
  it('restores its sand with the near field (the clock\'s checkpoints)', () => {
    const sim = createMouthSim(sarcelle, cascades, OCEAN_FFT_N, seed);
    expect(sim.field.soil).not.toBeNull();
    const clock = new MouthClock(sim);
    clock.advanceTo(6);
    const a = sim.field.soil!.w1.slice();
    const l = { ...sim.field.ledger };
    clock.advanceTo(3);
    clock.advanceTo(6);
    expect(Array.from(sim.field.soil!.w1)).toEqual(Array.from(a));
    expect(sim.field.ledger.soaked).toBeCloseTo(l.soaked!, 12);
  }, 120000);
});
