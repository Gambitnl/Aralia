import { describe, expect, it } from 'vitest';
import {
  RIVER_FLOOD_TO_NORMAL_FLOW,
  riverChannelSection,
  riverFloodFlowM3s,
  riverFloodToNormalFlow,
  riverFlowDepthM,
  riverNormalFlowM3s,
  riverSegmentWater,
  type RiverFallAtlas,
} from '../riverChannel';

/** Manning flow of a trapezoid, written out here so the test does not reuse the code it checks. */
function manningFlow(bottom: number, run: number, depth: number, slope: number, n = 0.04): number {
  const area = (bottom + run * depth) * depth;
  const wet = bottom + 2 * depth * Math.sqrt(1 + run * run);
  return (area * Math.pow(area / wet, 2 / 3) * Math.sqrt(slope)) / n;
}

describe('river channel law (one water, 2026-10-30)', () => {
  it('gives the hydraulic-geometry flow for a width, and the flood as a multiple of it', () => {
    // w = 7.2 Q^0.5 (Moody and Troutman 2002): a 7.2 m river carries 1 m^3/s.
    expect(riverNormalFlowM3s(7.2)).toBeCloseTo(1, 10);
    expect(riverNormalFlowM3s(14.4)).toBeCloseTo(4, 10);
    expect(riverFloodFlowM3s(14.4)).toBeCloseTo(4 * RIVER_FLOOD_TO_NORMAL_FLOW, 10);
  });

  it('cuts a channel that the flood fills exactly to its banks', () => {
    const s = riverChannelSection(35.4, 4e-4);
    expect(s.topWidthM).toBe(35.4);
    expect(s.bottomWidthM).toBeCloseTo(35.4 - 2 * s.run * s.depthM, 9);
    expect(manningFlow(s.bottomWidthM, s.run, s.depthM, 4e-4)).toBeCloseTo(riverFloodFlowM3s(35.4), 6);
    // Sinzheim's river, measured 2026-10-30: about 2.5 m deep, a natural depth to width.
    expect(s.depthM).toBeGreaterThan(2);
    expect(s.depthM).toBeLessThan(3);
  });

  it('runs the normal flow below the banks, and a steeper river shallower', () => {
    const s = riverChannelSection(20, 5e-4);
    const normal = riverFlowDepthM(s, riverNormalFlowM3s(20));
    expect(normal).toBeGreaterThan(0);
    expect(normal).toBeLessThan(s.depthM);
    expect(manningFlow(s.bottomWidthM, s.run, normal, 5e-4)).toBeCloseTo(riverNormalFlowM3s(20), 6);
    expect(riverChannelSection(20, 5e-3).depthM).toBeLessThan(s.depthM);
  });

  it('cuts a channel narrower than its river deeper, so it still passes the river\'s flood', () => {
    // A town's 12 m channel on a 35 m river (Sinzheim, 2026-10-30).
    const own = riverChannelSection(12.2, 4e-4);
    const town = riverChannelSection(12.2, 4e-4, undefined, riverFloodFlowM3s(35.4));
    expect(town.depthM).toBeGreaterThan(own.depthM);
    expect(town.topWidthM).toBe(12.2);
  });

  it('reads the fall from the atlas heights, and on into the parent where its own cells are flat', () => {
    // River 2 runs flat (h 30, 30) into river 1 at cell 2; river 1 falls 30 -> 25 -> sea.
    const atlas: RiverFallAtlas = {
      p: [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0], [20, 10], [20, 20]],
      h: [40, 35, 30, 25, 10, 30, 30],
      fl: [10, 20, 60, 70, 0, 20, 30],
      rivers: [
        { i: 1, cells: [0, 1, 2, 3, 4], parent: 0 },
        { i: 2, cells: [6, 5, 2], parent: 1 },
      ],
    };
    const ft = (h01: number) => h01 * 2000;
    const main = riverSegmentWater(atlas, 1, 1, ft);
    expect(main).toHaveLength(4);
    expect(main[0].count).toBe(10);
    expect(main[2].count).toBe(60);
    // 40 -> 35 over 10 ft: 100 ft of fall per 10 ft of run.
    expect(main[0].slope).toBeCloseTo((0.4 - 0.35) * 2000 / 10, 9);
    const trib = riverSegmentWater(atlas, 2, 1, ft);
    expect(trib).toHaveLength(2);
    for (const seg of trib) expect(seg.slope).toBeGreaterThan(0);
  });

  it('gives a river whose whole path reads flat half a height step of fall', () => {
    const atlas: RiverFallAtlas = {
      p: [[0, 0], [10, 0], [20, 0]],
      h: [30, 30, 30],
      fl: [5, 6, 7],
      rivers: [{ i: 1, cells: [0, 1, 2], parent: 0 }],
    };
    const segs = riverSegmentWater(atlas, 1, 1, (h) => h * 2000);
    // Half of one FMG height unit (0.005 * 2000 = 10 ft) over the 20 ft path.
    for (const seg of segs) expect(seg.slope).toBeCloseTo(10 / 20, 9);
  });
});

describe('flood-to-normal flow ratio from climate (GG-540, 2026-11-02)', () => {
  /** Turc (1954) yearly evaporation, written out here so the test does not reuse the code it checks. */
  const runoffRatio = (p: number, t: number) => {
    const l = 300 + 25 * t + 0.05 * t ** 3;
    return 1 - p / Math.sqrt(0.9 + (p / l) ** 2) / p;
  };

  it('follows Turc, the Guo et al. (2014) Table 1 fits and the 1.5-year lognormal flood', () => {
    const qp = runoffRatio(1100, 9.9);
    const mean = Math.exp(3.41 + 0.89 * Math.log(qp));
    const cv = Math.exp(-1.05 - 0.41 * Math.log(qp));
    const s = Math.sqrt(Math.log(1 + cv * cv));
    const flood = (mean / Math.sqrt(1 + cv * cv)) * Math.exp(-0.430727 * s);
    expect(riverFloodToNormalFlow({ precipMm: 1100, tempC: 9.9 })).toBeCloseTo(flood / ((1100 / 365.25) * qp), 6);
  });

  it('gives a dry catchment a far higher ratio than a wet one', () => {
    const wet = riverFloodToNormalFlow({ precipMm: 1400, tempC: 12 });
    const dry = riverFloodToNormalFlow({ precipMm: 300, tempC: 12 });
    expect(wet).toBeGreaterThan(3);
    expect(wet).toBeLessThan(10);
    expect(dry).toBeGreaterThan(2 * wet);
  });

  it('holds the runoff ratio at the fit\'s data edge where all rain evaporates, and stays finite', () => {
    const desert = riverFloodToNormalFlow({ precipMm: 100, tempC: 25 });
    expect(Number.isFinite(desert)).toBe(true);
    expect(desert).toBeGreaterThan(0);
    expect(() => riverFloodToNormalFlow({ precipMm: 0, tempC: 10 })).toThrow(/rainfall and temperature/);
  });

  it('records each segment\'s ratio from its catchment climate, and the reference ratio without climate', () => {
    const base: RiverFallAtlas = {
      p: [[0, 0], [10, 0], [20, 0]],
      h: [40, 30, 20],
      fl: [10, 10, 10],
      rivers: [{ i: 1, cells: [0, 1, 2] }],
    };
    expect(riverSegmentWater(base, 1, 1, (h) => h * 2000)[0].floodRatio).toBe(RIVER_FLOOD_TO_NORMAL_FLOW);
    const withClimate = { ...base, climate: () => ({ precipMm: 1100, tempC: 9.9 }) };
    expect(riverSegmentWater(withClimate, 1, 1, (h) => h * 2000)[0].floodRatio)
      .toBeCloseTo(riverFloodToNormalFlow({ precipMm: 1100, tempC: 9.9 }), 9);
  });
});
