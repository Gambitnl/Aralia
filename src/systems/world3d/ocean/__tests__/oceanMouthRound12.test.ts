/**
 * oceanMouthRound12.test.ts — river mouth round 12: the judge's four gaps, each a law.
 * Gap 1: the river water's own color (CDOM, `SARCELLE_CONDITIONS.cdomAg443M`, `placeRiverOptics`) and the buoyant
 * lens (`buoyantLensM`, `jetLensM`, `saltWedgeLengthM`, the pack's column).
 * Gap 2: the day's sea (`daySeaCascades`, `daySeaCoast`, `deriveMouthDesign`'s `daySeaHsM`).
 * Gap 3: the floor's detail rectangles at the mouth (`mouthFloorDetail`).
 * Gap 4: the young sea's second octave (`youngFineOf`).
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import {
  COAST_PLACES, RIVER_REDUCED_G, SARCELLE_CONDITIONS, YOUNG_FINE_PATCH_RATIO, YOUNG_SEA_N, YOUNG_SPLIT_TEXELS,
  buoyantLensM, coastBeachGrid, lensAt, lensShareAt, jetProfileAt, createMouthSim, daySeaCascades, deriveMouthDesign, deriveSurfCoast, jetLensM,
  mouthFloorDetail, packMouthState, placeRiverOptics, ratingCurveGM3, saltWedgeLengthM, youngFineOf, youngSeaOf,
} from '../oceanMouthMath';
import { forcingCascades } from '../oceanBeachMath';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';

const cas = oceanSeaState('surf');
const seed = 0x0cea9;
const coast = deriveSurfCoast(cas, OCEAN_FFT_N, seed, 300);
const dMean = deriveMouthDesign({ planform: 'straight',  cascades: cas, n: OCEAN_FFT_N, seed, coast, daySeaHsM: null });
const d = deriveMouthDesign({ planform: 'straight',  cascades: cas, n: OCEAN_FFT_N, seed, coast });
const qMean = COAST_PLACES.sarcelleMouth.dischargeM3S;

describe('gap 1: the river water\'s own color (CDOM)', () => {
  it('carries the measured dissolved term (none: the clip river is bluer than green) and draws the day water by it', () => {
    expect(SARCELLE_CONDITIONS.cdomAg443M).toBe(0);
    const load = ratingCurveGM3(4.2, qMean);
    const lm = ratingCurveGM3(qMean, qMean);
    const o = placeRiverOptics('sarcelle', load, lm);
    // The particles are the mean flow's fit (round 5's measure where the load carries the light).
    const part = placeRiverOptics('sarcelle', lm, lm, null).iop;
    expect(o.iop.aP443M2G).toBeCloseTo(part.aP443M2G, 12);
    expect(o.iop.sPNm).toBeCloseTo(part.sPNm, 12);
    expect(d.optics.iop?.aP443M2G).toBeCloseTo(part.aP443M2G, 12);
    // A dissolved absorber takes the blue first: any a_g over 0 turns the deep water red over blue.
    const brown = placeRiverOptics('sarcelle', load, lm, 2);
    expect(brown.rInfRGB[0] / brown.rInfRGB[2]).toBeGreaterThan(2 * (o.rInfRGB[0] / o.rInfRGB[2]));
    expect(brown.kdRGB[2]).toBeGreaterThan(o.kdRGB[2]);
  });
  it('lets the river water leave the mouth as a lens at internal criticality', () => {
    expect(RIVER_REDUCED_G).toBeCloseTo((9.81 * (1025 - 997)) / 1025, 3);
    for (const q of [0.01, 0.1, 0.5]) {
      const h = buoyantLensM(q);
      // The densimetric Froude number of the layer is 1: u = q / h = sqrt(g' h).
      expect(q / h / Math.sqrt(RIVER_REDUCED_G * h)).toBeCloseTo(1, 9);
    }
    // At the day the lens is thinner than the water and thins out from the mouth.
    const l0 = jetLensM(d, 0);
    expect(l0).toBeGreaterThan(0.3);
    expect(l0).toBeLessThan(0.6);
    expect(jetLensM(d, 28)).toBeLessThan(l0);
    // The arrested salt wedge runs past the valley at the day and is short at the mean flow.
    expect(saltWedgeLengthM(d.jet.hM[0], d.u0MS)).toBeGreaterThan(d.headM);
    expect(saltWedgeLengthM(1, 2)).toBe(0);
  });
  it('spreads the lens as a gravity current: its side fronts at the Benjamin speed, its flux held', () => {
    const l0 = lensAt(d, 0);
    expect(l0.halfWM).toBeCloseTo(d.widthM / 2, 6);
    const x = 40;
    const dx = 0.5;
    const a = lensAt(d, x);
    const c = lensAt(d, x + dx);
    // dW/dx = 2 sqrt(2 g' h) / u, within the march's own step.
    const rate = (2 * (c.halfWM - a.halfWM)) / dx;
    expect(rate).toBeCloseTo((2 * Math.sqrt(2 * RIVER_REDUCED_G * a.hM)) / a.uMS, 0);
    // The lens carries the day's discharge at every x: u h W = Q.
    for (const xx of [0, 30, 300]) { const l = lensAt(d, xx); expect(l.uMS * l.hM * 2 * l.halfWM).toBeCloseTo(d.dischargeM3S, 1); }
    // Its front is where the share is half the axis share.
    expect(lensShareAt(d, x, a.halfWM) / jetProfileAt(d.jet, x).cm).toBeCloseTo(0.5, 3);
  });
  it('packs the river column as the lens: never over the tracer column, the lens where the tracer is thicker', () => {
    const sim = createMouthSim(d, daySeaCascades(cas, d.seaEnergy ?? 1), OCEAN_FFT_N, seed, 20);
    const pk = packMouthState(d, sim.field, 1);
    const f = sim.field;
    const g = d.grid;
    let over = 0;
    let lensCells = 0;
    for (let c = 0; c < g.ns * g.na; c += 1) {
      if (!(f.h[c] > 1e-3)) continue;
      const col = halfToFloat(pk.b[c * 4 + 2]);
      if (col > f.hc[c] * 1.002 + 1e-3) over += 1;
      if (col < f.hc[c] * 0.95) lensCells += 1;
    }
    expect(over).toBe(0);
    expect(lensCells).toBeGreaterThan(100);
  });
});
/** IEEE half to float (the pack's encoding). */
function halfToFloat(h: number): number {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const m = h & 0x3ff;
  if (e === 0) return s * 2 ** -14 * (m / 1024);
  if (e === 31) return m ? Number.NaN : s * Infinity;
  return s * 2 ** (e - 15) * (1 + m / 1024);
}

describe('gap 2: the day\'s sea', () => {
  it('scales only the forced bands\' energy', () => {
    const e = 0.04;
    const day = daySeaCascades(cas, e);
    const forced = forcingCascades(cas);
    cas.forEach((c, i) => {
      if (forced.includes(c.name)) expect(day[i].energyScale ?? 1).toBeCloseTo((c.energyScale ?? 1) * e, 12);
      else expect(day[i]).toBe(c);
    });
    expect(daySeaCascades(cas, 1)).toEqual(cas.slice());
  });
  it('carries the record\'s day sea beside the mean one: the forcing at the day, the bar at the mean', () => {
    expect(SARCELLE_CONDITIONS.daySeaHsM).not.toBeNull();
    const hs = SARCELLE_CONDITIONS.daySeaHsM as number;
    expect(d.hsM).toBeCloseTo(hs, 9);
    expect(d.meanSeaHsM).toBeCloseTo(coast.hsM, 9);
    expect(d.seaEnergy).toBeCloseTo((hs / coast.hsM) ** 2, 12);
    // The bar and the coast are the mean sea's (morphology).
    expect(d.barCrestDepthM).toBeCloseTo(dMean.barCrestDepthM, 12);
    expect(d.bar).toEqual(dMean.bar);
    expect(d.params).toEqual(dMean.params);
    // The forced bands' heights are the day's.
    d.bands.forEach((b, i) => { if (b.forced) expect(b.hsM).toBeCloseTo(dMean.bands[i].hsM * Math.sqrt(d.seaEnergy as number), 9); });
    // null is the mean sea, node for node.
    expect(dMean.seaEnergy).toBe(1);
    expect(dMean.hsM).toBeCloseTo(coast.hsM, 12);
  });
});

describe('gap 3: one terrain at the spit', () => {
  it('draws the mouth\'s box less the beach\'s patch at the beach\'s cell, sharing its border lines', () => {
    const bg = coastBeachGrid(d);
    const fd = mouthFloorDetail(d, bg);
    const top = bg.s0 + bg.ns * bg.ds;
    expect(fd.cellM).toBe(bg.da);
    for (const [s0, s1, a0, a1] of fd.rects) {
      // No rectangle overlaps the beach's patch (s0 .. top over its a range).
      const overlapS = Math.min(s1, top) - Math.max(s0, bg.s0);
      const overlapA = Math.min(a1, bg.a0 + bg.na * bg.da) - Math.max(a0, bg.a0);
      expect(overlapS <= 1e-9 || overlapA <= 1e-9).toBe(true);
      // Its a lines fall on the beach's own a lattice.
      expect(Math.abs(((a0 - bg.a0) / bg.da) - Math.round((a0 - bg.a0) / bg.da))).toBeLessThan(1e-9);
    }
    expect(fd.rects.some((r) => Math.abs(r[0] - top) < 1e-9)).toBe(true);
  });
});

describe('gap 4: the young sea\'s second octave', () => {
  it('splits the young spectrum at four main cells, the fine patch pi times smaller, the variance kept', () => {
    const y = youngSeaOf(d, cas[d.bands.findIndex((b) => b.local)], 46);
    expect(y).not.toBeNull();
    const yy = y!;
    const s = youngFineOf(yy);
    const cell = yy.cascade.patchM / YOUNG_SEA_N;
    expect(s.splitM).toBeCloseTo(YOUNG_SPLIT_TEXELS * cell, 12);
    expect(s.main.cutoffLowM).toBeCloseTo(s.splitM, 12);
    expect(s.fine.cutoffHighM).toBeCloseTo(s.splitM, 12);
    expect(s.fine.cutoffLowM).toBeCloseTo(yy.cascade.cutoffLowM, 12);
    expect(s.fine.patchM).toBeCloseTo(yy.cascade.patchM / YOUNG_FINE_PATCH_RATIO, 12);
    // The fine patch's cell resolves its shortest wave on at least six texels.
    expect(s.fine.cutoffLowM / (s.fine.patchM / YOUNG_SEA_N)).toBeGreaterThanOrEqual(6);
    expect((s.mainVar + s.fineVar) / yy.slopeVar).toBeCloseTo(1, 2);
  });
});
