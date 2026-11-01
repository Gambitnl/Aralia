/**
 * River mouth round 15: THE LOAD AS A MEASURED INPUT, THE LOW-FLOW CHANNEL, THE DAY'S SEA FROM THE SURF BAND.
 *
 * Ruling 1: the record's fitted day load is the design's load, the rating curve's kept beside it; the water's optics
 * follow the load. Ruling 2: at-a-station hydraulic geometry from the section's own shape (the exponents sum to 1 and
 * continuity holds), the fill and the day's channel in the course's cut on the reach only (the outlet's throat keeps the
 * mean cut and the bar's flanks), the near field's inflow on the day's section at the day's speed, the outlet's
 * two-layer control. Ruling 3: the terrace's top edge at the record's surf band and the day's sea in the record; the
 * march breaks at the front and dies inside it. The switches put round 14's design back, bit for bit on the floor.
 */
import { describe, expect, it } from 'vitest';
import { OCEAN_FFT_N } from '../oceanConfig';
import { oceanSeaState } from '../oceanSeaStates';
import {
  LEOPOLD_MADDOCK_AT_A_STATION, RIVER_REDUCED_G, SARCELLE_CONDITIONS, atAStationExponents, channelSectionFull, createMouthSim,
  daySeaCascades, deriveMouthDesign, deriveSurfCoast, lowFlowChannelOf, mouthChannelAt, mouthEdgeBore, placeRiverOptics, ratingCurveGM3,
  shorelineSOf,
} from '../oceanMouthMath';
import { seabedPointAt } from '../oceanSeabedMath';
import { beachToWorld } from '../oceanBeachMath';

const cas = oceanSeaState('surf');
const seed = 0x0cea9;
const coast = deriveSurfCoast(cas, OCEAN_FFT_N, seed, 300);
const d = deriveMouthDesign({ cascades: cas, n: OCEAN_FFT_N, seed, coast });
const r14 = deriveMouthDesign({ cascades: cas, n: OCEAN_FFT_N, seed, coast, lowFlow: false, dayLoadGM3: null, surfBand: false, daySeaHsM: 0.215 });
const sp = d.spit!;
const lf = d.lowFlow!;
const groundAt = (dd: typeof d, s: number, a: number) => { const [x, z] = beachToWorld(dd.frame, s, a); return -seabedPointAt(dd.params, x, z).depthM; };

describe('ruling 2: at-a-station hydraulic geometry', () => {
  it('derives exponents from the section that sum to 1, near Leopold and Maddock\'s classic set', () => {
    const ex = atAStationExponents(d.shapeP);
    expect(ex.b + ex.f + ex.m).toBeCloseTo(1, 12);
    expect(ex.b).toBeCloseTo(ex.f / d.shapeP, 12);
    expect(ex.m).toBeCloseTo((2 * ex.f) / 3, 12);
    const c = LEOPOLD_MADDOCK_AT_A_STATION;
    expect(Math.abs(ex.b - c.b)).toBeLessThan(0.1);
    expect(Math.abs(ex.f - c.f)).toBeLessThan(0.11);
    expect(Math.abs(ex.m - c.m)).toBeLessThan(0.02);
  });
  it('gives a day channel narrower, shallower and slower than the mean, carrying the day\'s flow by continuity', () => {
    expect(lf.widthM).toBeLessThan(sp.channelWidthM);
    expect(lf.depthM).toBeLessThan(sp.channelDepthM);
    expect(lf.speedMS).toBeLessThan(0.9);
    // Continuity through the section: the speed from Q / A equals the exponent law's within 1 % (b + f + m = 1).
    expect(Math.abs(lf.continuityMS / lf.speedMS - 1)).toBeLessThan(0.01);
    expect(lf.areaM2).toBeCloseTo(channelSectionFull(lf.widthM, lf.depthM, d.shapeP).areaM2, 9);
    // The classic exponents give a channel within a third of the section's own.
    const cl = lowFlowChannelOf({ spit: sp, qMeanM3S: d.meanDischargeM3S, qDayM3S: d.dischargeM3S, shapeP: d.shapeP, manningN: d.manningN, exponents: LEOPOLD_MADDOCK_AT_A_STATION });
    expect(Math.abs(cl.widthM / lf.widthM - 1)).toBeLessThan(0.34);
    expect(Math.abs(cl.speedMS / lf.speedMS - 1)).toBeLessThan(0.05);
  });
  it('at the mean flow the day channel is the mean channel', () => {
    const same = lowFlowChannelOf({ spit: sp, qMeanM3S: d.meanDischargeM3S, qDayM3S: d.meanDischargeM3S, shapeP: d.shapeP, manningN: d.manningN });
    expect(same.widthM).toBeCloseTo(sp.channelWidthM, 9);
    expect(same.depthM).toBeCloseTo(sp.channelDepthM, 9);
    expect(same.speedMS).toBeCloseTo(0.9, 9);
    expect(same.slope).toBeCloseTo(sp.slope, 9);
  });
  it('the design carries the channel, its speed as the outflow, and the day\'s jet leaves through its section', () => {
    expect(d.u0MS).toBeCloseTo(lf.speedMS, 12);
    expect(d.course!.course.lowFlow).toBeDefined();
    expect(d.course!.course.lowFlow!.toM).toBeCloseTo(sp.lengthM, 9);
    expect(d.course!.course.lowFlow!.baseM).toBeCloseTo(d.tideM, 12);
    // The mean-flow design (the day at the mean) has no low-flow channel.
    const mean = deriveMouthDesign({ cascades: cas, n: OCEAN_FFT_N, seed, coast, dayDischargeM3S: d.meanDischargeM3S });
    expect(mean.lowFlow).toBeUndefined();
    expect(r14.lowFlow).toBeUndefined();
  });
});

describe('ruling 2: the fill and the day channel in the course\'s cut', () => {
  const a = 130;
  const sh = shorelineSOf(d, a);
  const c0 = sh + sp.centerOffsetM;
  it('the thalweg stands at the day\'s level less the day\'s depth, the fill at the day\'s level, the banks as before', () => {
    const along = mouthChannelAt(d, c0, a).along;
    const eta = d.tideM + lf.slope * Math.min(along, sp.lengthM);
    expect(groundAt(d, c0, a)).toBeCloseTo(eta - lf.depthM, 2);
    // The fill: between the day channel's edge and the mean width's edge.
    const sFill = c0 + lf.widthM / 2 + (d.widthM / 2 - lf.widthM / 2) * 0.5;
    expect(groundAt(d, sFill, a)).toBeCloseTo(eta, 2);
    // Round 14's bed there was the mean section's, under the fill.
    expect(groundAt(r14, c0, a)).toBeLessThan(groundAt(d, c0, a) - 0.3);
    expect(groundAt(r14, sFill, a)).toBeLessThan(groundAt(d, sFill, a) - 0.1);
    // Past the mean width the ground is round 14's (the platform, the banks).
    for (const s of [sh + 5, sh + 15, c0 + d.widthM / 2 + 3]) expect(groundAt(d, s, a)).toBeCloseTo(groundAt(r14, s, a), 6);
  });
  it('the outlet\'s throat keeps the mean cut and the bar\'s flank channels', () => {
    // Seaward of the mouth's shoreline point, across the outlet: the same floor as round 14's.
    for (const dsS of [-3, -6, -10]) for (const da of [-18, -10, 0, 10, 18]) expect(groundAt(d, d.mouthS + dsS, d.mouthA + da)).toBeCloseTo(groundAt(r14, d.mouthS + dsS, d.mouthA + da), 6);
  });
  it('with the switch off the floor is round 14\'s bit for bit along the reach', () => {
    const off = deriveMouthDesign({ cascades: cas, n: OCEAN_FFT_N, seed, coast, lowFlow: false, daySeaHsM: 0.215, surfBand: false });
    for (const aa of [60, 130, 250]) for (const ds of [-30, -10, 0, 10, 30]) expect(groundAt(off, shorelineSOf(off, aa) + off.spit!.centerOffsetM + ds, aa)).toBeCloseTo(groundAt(r14, shorelineSOf(r14, aa) + r14.spit!.centerOffsetM + ds, aa), 9);
  });
});

describe('ruling 2: the near field on the day channel', () => {
  it('the inflow enters over the day channel\'s cells at its speed and the start guess stands at the day\'s level', () => {
    const sim = createMouthSim(d, daySeaCascades(cas, d.seaEnergy ?? 1), OCEAN_FFT_N, seed, 60, undefined, { coarse: true });
    const f = sim.field;
    const g = d.grid;
    expect(f.inflowSpeedMS).toBeCloseTo(lf.speedMS, 12);
    for (let k = 0; k < f.inflowCells.length; k += 1) {
      const c = f.inflowCells[k];
      const i = c % g.ns; const j = Math.floor(c / g.ns);
      const ch = mouthChannelAt(d, g.s0 + (i + 0.5) * g.ds, g.a0 + (j + 0.5) * g.da);
      expect(ch.across).toBeLessThan(lf.widthM / 2);
    }
  }, 120000);
  it('the outlet is a control at the day: the river layer\'s Froude number over 1, the wedge cannot pass', () => {
    const fr = lf.speedMS / Math.sqrt(RIVER_REDUCED_G * lf.depthM);
    expect(fr).toBeGreaterThan(1);
  });
});

describe('ruling 1: the day load is the record\'s measured input', () => {
  it('the design runs the fitted load where the record has one, and keeps the rating curve\'s beside it', () => {
    const rating = ratingCurveGM3(d.dischargeM3S, d.meanDischargeM3S);
    expect(d.ratingLoadGM3).toBeCloseTo(rating, 9);
    if (SARCELLE_CONDITIONS.dayLoadGM3 !== null) {
      expect(d.sedimentGM3).toBeCloseTo(SARCELLE_CONDITIONS.dayLoadGM3, 9);
      expect(d.sedimentGM3).not.toBeCloseTo(rating, 3);
    } else {
      expect(d.sedimentGM3).toBeCloseTo(rating, 9);
    }
    expect(r14.sedimentGM3).toBeCloseTo(rating, 9);
    const explicit = deriveMouthDesign({ cascades: cas, n: OCEAN_FFT_N, seed, coast, dayLoadGM3: 123 });
    expect(explicit.sedimentGM3).toBe(123);
    expect(explicit.optics.rInfRGB[0]).toBeCloseTo(placeRiverOptics('sarcelle', 123, ratingCurveGM3(d.meanDischargeM3S, d.meanDischargeM3S), 0).rInfRGB[0], 9);
  });
  it('a larger load greys the water: R/G rises toward 1 and Kd grows with the load', () => {
    const lo = placeRiverOptics('sarcelle', 25, 500, 0);
    const hi = placeRiverOptics('sarcelle', 200, 500, 0);
    expect(hi.rInfRGB[0] / hi.rInfRGB[1]).toBeGreaterThan(lo.rInfRGB[0] / lo.rInfRGB[1]);
    expect(hi.kdRGB[1]).toBeGreaterThan(lo.kdRGB[1] * 3);
  });
});

describe('ruling 3: the terrace at the surf band and the day\'s sea', () => {
  it('the terrace\'s top runs to the band\'s inner edge, and its front meets the coast\'s floor near the outer edge', () => {
    const band = SARCELLE_CONDITIONS.surfBandM!;
    expect(d.course!.terrace!.widthM).toBe(band[0]);
    expect(r14.course!.terrace!.widthM).toBeCloseTo(d.surfRef.widthM, 6);
    const a = 130;
    const sh = shorelineSOf(d, a);
    const top = d.course!.terrace!.depthStillM;
    expect(-groundAt(d, sh - band[0] + 2, a) - d.tideM).toBeCloseTo(top, 2);
    // The front: the face's slope from the top edge; it reaches the coast's own floor within 12 m of the outer edge.
    const foot = (() => { for (let off = band[0]; off < 200; off += 0.5) { if (Math.abs(groundAt(d, sh - off, a) - groundAt(r14, sh - off, a)) < 0.02 && off > band[0] + 5) return off; } return NaN; })();
    expect(Math.abs(foot - band[1])).toBeLessThan(12);
  });
  it('the day\'s sea breaks at the front and its bores die inside the terrace; the clip\'s faces fix Hs 0.29', () => {
    expect(SARCELLE_CONDITIONS.daySeaHsM).toBeCloseTo(0.29, 9);
    const a = 130;
    const sh = shorelineSOf(d, a);
    const e = mouthEdgeBore(d, a);
    const at = (off: number) => { const s = sh - off; let k = 0; while (k + 1 < e.sM.length && e.sM[k + 1] <= s) k += 1; return k; };
    const band = SARCELLE_CONDITIONS.surfBandM!;
    const qFront = e.march.qb[at(band[0])];
    const qIn = e.march.qb[at(band[0] - 10)];
    const qOut = e.march.qb[at(band[0] + 6)];
    expect(qFront).toBeGreaterThan(0.3);
    expect(qOut).toBeLessThan(0.1);
    expect(qIn).toBeLessThan(qFront / 3);
    // The significant breaking wave at the front is the clip's face p50 (0.366 m) within 5 %.
    expect(Math.abs((e.march.hrmsM[at(band[0])] * Math.SQRT2) / 0.366 - 1)).toBeLessThan(0.05);
  });
});
