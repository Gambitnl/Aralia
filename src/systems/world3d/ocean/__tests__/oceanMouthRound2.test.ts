/**
 * The river mouth's round-2 laws (the Sarcelle place, the rating curve, the
 * river's own wind sea, the jet's own texture coordinates, the plume front
 * from the share's gradient, the subcell wet edge). Each test names its law.
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';
import { lensAt,
  CATCHMENT_RUNOFF_M_YR, CATCHMENT_YIELD_T_KM2_YR, COAST_PLACES, HG_WIDTH_A, MouthClock, coastBeachGrid, createMouthSim,
  deriveMouthDesign, deriveSurfCoast, jetAt, jetDomain, jetFrontFoamOf, jetTexelXY, jetUvOf, localBandShares, meanSedimentGM3,
  mouthBands, mouthCellM, mouthHandoverLengthM, mouthSpinUpS, mouthSwashWalls, packMouthState, ratingCurveGM3,
  riverFetchM, turbidOptics, windLockedBands,
} from '../oceanMouthMath';

const cascades = oceanSeaState('surf');
const seed = 0x0cea9;
const coast = deriveSurfCoast(cascades, OCEAN_FFT_N, seed, 120);
const sarcelle = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades, n: OCEAN_FFT_N, seed, coast, barLaw: 'break', dayDischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S });
const creek = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades, n: OCEAN_FFT_N, seed, coast, place: 'creek', barLaw: 'break' });

describe('the places on the coast', () => {
  it('sizes the Sarcelle from the clip\'s 40 m width by the channel\'s own hydraulic geometry', () => {
    expect(COAST_PLACES.sarcelleMouth.dischargeM3S).toBeCloseTo((40 / HG_WIDTH_A) ** 2, 9);
    expect(sarcelle.widthM).toBeCloseTo(40, 9);
    expect(sarcelle.place).toBe('sarcelle');
    expect(sarcelle.mouthA).toBe(40);
  });

  it('keeps the round-1 river as the creek mouth on the same coast', () => {
    expect(creek.dischargeM3S).toBe(1.5);
    expect(creek.mouthA).toBe(COAST_PLACES.creekMouth.a);
    expect(creek.params.island!.semiMajorM).toBe(sarcelle.params.island!.semiMajorM);
  });

  it('derives the grid cell from the shortest forced wave and the channel (1 m and 0.5 m)', () => {
    expect(mouthCellM(cascades, sarcelle.widthM)).toBe(1);
    expect(mouthCellM(cascades, creek.widthM)).toBe(0.5);
    expect(sarcelle.grid.ds).toBe(1);
  });

  it('spins up for at least one long-wave round trip over the valley', () => {
    expect(mouthSpinUpS(creek)).toBe(60);
    expect(mouthSpinUpS(sarcelle)).toBeGreaterThan(90);
  });

  it('runs the beach grid on 38 m of bank each side, and walls only the mouth grid less its overlap', () => {
    const bg = coastBeachGrid(sarcelle);
    const a1 = sarcelle.grid.a0 + sarcelle.grid.na * sarcelle.grid.da;
    expect(bg.a0).toBeLessThanOrEqual(sarcelle.grid.a0 - 38);
    expect(bg.a0 + bg.na * bg.da).toBeGreaterThanOrEqual(a1 + 38);
    const blend = mouthHandoverLengthM(cascades);
    const w = mouthSwashWalls(sarcelle, bg, blend);
    for (let j = 0; j < bg.na; j += 1) {
      const a = bg.a0 + (j + 0.5) * bg.da;
      const inner = a >= sarcelle.grid.a0 + blend && a <= a1 - blend;
      expect(w[j * bg.ns + 10]).toBe(inner ? 1 : 0);
    }
  });
});

describe('the turbidity by a rating curve (Asselman 2000; Syvitski et al. 2000)', () => {
  it('sets the mean load as the yield over the runoff, and the curve through it', () => {
    expect(meanSedimentGM3()).toBeCloseTo(CATCHMENT_YIELD_T_KM2_YR / CATCHMENT_RUNOFF_M_YR, 9);
    expect(ratingCurveGM3(31, 31)).toBeCloseTo(500, 9);
    expect(ratingCurveGM3(62, 31)).toBeCloseTo(500 * 2 ** 1.5, 6);
    expect(sarcelle.sedimentGM3).toBeCloseTo(500, 6);
  });

  it('hides the bed under the judged near river (e^(-2 Kd H) under 1e-6 through 0.6 m)', () => {
    const o = turbidOptics(sarcelle.sedimentGM3);
    for (const k of o.kdRGB) expect(Math.exp(-2 * k * 0.6)).toBeLessThan(1e-6);
    expect(o.kdRGB[1]).toBeGreaterThan(turbidOptics(40).kdRGB[1] * 5);
  });
});

describe('the river\'s own wind sea', () => {
  it('wind-locks the ripple band only (Plant 1982 growth length under the channel width)', () => {
    expect(windLockedBands(cascades, 40)).toEqual(['ripple']);
    // The creek's 8.8 m channel is under the ripple's 9.0 m growth length: there no band is wind-locked.
    expect(windLockedBands(cascades, 8.8)).toEqual([]);
  });

  it('keeps the sea\'s own share at the sea\'s fetch and loses the long waves first at a short fetch', () => {
    const b = mouthBands(cascades, {}, 40).find((x) => x.local)!;
    expect(localBandShares(b, b.windMS, b.fetchM)).toEqual({ h: 1, s: 1 });
    const s100 = localBandShares(b, 13, 100);
    const s20 = localBandShares(b, 13, 20);
    expect(s100.h).toBeLessThan(s100.s);
    expect(s20.s).toBeLessThan(s100.s);
    expect(s100.s).toBeGreaterThan(0.4);
    expect(s100.s).toBeLessThan(1);
  });

  it('walks the fetch upwind to the bank, and to the open sea out of the grid over water', () => {
    const sim = createMouthSim(sarcelle, cascades, OCEAN_FFT_N, seed);
    const f = sim.field;
    const g = sarcelle.grid;
    const b = sarcelle.bands.find((x) => x.local)!;
    // Up the valley the wind leaves the bank within the valley's width.
    const j = Math.floor((sarcelle.mouthA - g.a0) / g.da);
    const iUp = Math.floor((sarcelle.mouthS + 100 - g.s0) / g.ds);
    const up = riverFetchM(sarcelle, f, iUp, j, b);
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThan(300);
    // At the grid's sea edge the walk leaves over the sea.
    expect(riverFetchM(sarcelle, f, 0, j, b)).toBe(b.fetchM);
  }, 60000);
});

describe('the plume in the jet\'s own coordinates', () => {
  it('maps a texel center back to its own uv', () => {
    const dom = jetDomain(sarcelle);
    for (const [i, j] of [[0, 80], [100, 10], [500, 150], [767, 80]]) {
      const p = jetTexelXY(dom, i, j);
      const [u, v] = jetUvOf(dom, p.x, p.y);
      expect(u).toBeCloseTo(i / (dom.ns - 1), 9);
      expect(v).toBeCloseTo((j + 0.5) / dom.na, 9);
    }
  });

  it('lays the front\'s foam where the drawn share falls fastest, not on the axis', () => {
    const x = 150;
    const onAxis = jetFrontFoamOf(sarcelle, x, 0);
    let best = 0;
    let bestY = 0;
    // Round 12: the front is the buoyant lens's (`lensAt`), which spreads wider than round 2's jet: search to past it.
    for (let y = 0; y < Math.max(120, 1.5 * lensAt(sarcelle, x).halfWM); y += 1) {
      const v = jetFrontFoamOf(sarcelle, x, y);
      if (v > best) { best = v; bestY = y; }
    }
    expect(onAxis).toBeLessThan(best * 0.2);
    // The steepest line of the share's Gaussian shoulder lies past the core's edge.
    expect(bestY).toBeGreaterThan(jetAt(sarcelle, x, 0).deltaM);
    expect(best).toBeLessThanOrEqual(0.057 + 1e-9);
  });
});

describe('the subcell wet edge', () => {
  it('carries the wet neighbors\' level flat into a dry cell whose ground stands over it', () => {
    const sim = createMouthSim(creek, cascades, OCEAN_FFT_N, seed);
    new MouthClock(sim).advanceTo(10);
    const f = sim.field;
    const g = creek.grid;
    const blend = mouthHandoverLengthM(cascades);
    const pack = packMouthState(creek, f, blend);
    const half = (x: number) => {
      const sg = (x & 0x8000) ? -1 : 1;
      const e = (x >> 10) & 0x1f;
      const m = x & 0x3ff;
      return e === 0 ? sg * 2 ** -14 * (m / 1024) : sg * 2 ** (e - 15) * (1 + m / 1024);
    };
    let checked = 0;
    for (let j = 1; j < g.na - 1; j += 1) {
      for (let i = 20; i < g.ns - 1; i += 1) {
        const c = j * g.ns + i;
        if (f.h[c] > 1e-3) continue;
        const nb = [c - 1, c + 1, c - g.ns, c + g.ns].filter((k) => f.h[k] > 1e-3);
        if (nb.length === 0) continue;
        const lv = nb.reduce((p, k) => p + f.bed[k] + f.h[k], 0) / nb.length;
        if (f.bed[c] <= lv) continue;
        const s = g.s0 + (i + 0.5) * g.ds;
        const a = g.a0 + (j + 0.5) * g.da;
        // Inside the hand-over the drawn level is the flat level (half-float precision).
        if (s - g.s0 < blend || a - g.a0 < blend || g.a0 + g.na * g.da - a < blend) continue;
        expect(half(pack.a[c * 4])).toBeCloseTo(lv, 2);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
  }, 60000);
});
