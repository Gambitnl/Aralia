/**
 * oceanMouthRound10.test.ts — river mouth round 10.
 * Law 1: the tide (`SeabedParams.stillLevelM`, `SARCELLE_CONDITIONS.tideM`): every depth is under the still water;
 * the coast's range bounds the low water; round 9's crest stays under it. The swash bar (`swashBarCrestM`): its crest
 * by Stockdon's dissipative setup over the low water, the slope form's missing fixed point, the near field out past
 * it, and the one water's finding: the record's river drowns it, a low flow bares it. The sea edge's forcing at the
 * warped places sums its cascades' own modes.
 * Law 2: the young sea's patch does not repeat over the channel (YOUNG_SEA_N at round 9's cell).
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import {
  MouthClock, SARCELLE_CONDITIONS, STOCKDON_DISSIPATIVE_SETUP, YOUNG_SEA_N, createMouthSim, deriveMouthDesign,
  mouthHandoverLengthM, swashBarCrestM, youngSeaOf,
  COAST_PLACES,
} from '../oceanMouthMath';
import { BEACH_GRID, IncidentWaves, beachToWorld, forcingCascades, stockdonRunup2 } from '../oceanBeachMath';
import { seabedPointAt } from '../oceanSeabedMath';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';

const cas = oceanSeaState('surf');
const seed = 0x0cea9;
const d = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades: cas, n: OCEAN_FFT_N, seed, statsSpanS: 300, barLaw: 'break', dayDischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S });
const G = 9.81;

describe('the tide (law 1)', () => {
  it('moves every depth by the still water level and nothing else', () => {
    const { stillLevelM: _drop, ...msl } = d.params;
    void _drop;
    for (const [s, a] of [[-60, 40], [-12, 40], [0, 20], [10, 40], [30, 5]] as const) {
      const [x, z] = beachToWorld(d.frame, s, a);
      expect(seabedPointAt(d.params, x, z).depthM).toBeCloseTo(seabedPointAt(msl, x, z).depthM + d.tideM, 12);
    }
    // Absent or 0: the mean sea level, the same numbers (every other piece's floor).
    const [x, z] = beachToWorld(d.frame, -5, 33);
    expect(seabedPointAt({ ...msl, stillLevelM: 0 }, x, z)).toEqual(seabedPointAt(msl, x, z));
  });
  it('puts the Sarcelle at its low water inside the coast range, where round 9 bar stays under the water', () => {
    expect(SARCELLE_CONDITIONS.tideM).toBe(-0.2);
    expect(Math.abs(SARCELLE_CONDITIONS.tideM)).toBeLessThanOrEqual(SARCELLE_CONDITIONS.tidalRangeM / 2 + 1e-12);
    expect(d.tideM).toBe(SARCELLE_CONDITIONS.tideM);
    expect(d.barLaw).toBe('break');
    // Round 9's crest, 0.61 m under the mean sea level: 0.41 m under the low water. No tide inside the range bares it.
    expect(d.barCrestDepthM).toBeCloseTo(0.611, 2);
    expect(d.barCrestDepthM - SARCELLE_CONDITIONS.tidalRangeM / 2).toBeGreaterThan(0.4);
    // The grid keeps the beach's sea edge.
    expect(d.grid.s0).toBe(BEACH_GRID.s0);
  });
});

describe('the swash bar (law 1)', () => {
  const sw = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades: cas, n: OCEAN_FFT_N, seed, statsSpanS: 300, barLaw: 'swash', dayDischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S });
  it('stands at the low water plus Stockdon dissipative setup of the coast sea', () => {
    const l0 = (G * 12.7469 * 12.7469) / (2 * Math.PI);
    const zc = swashBarCrestM({ tideM: -0.2, hsM: sw.hsM, tpS: 12.7469 });
    expect(zc).toBeCloseTo(-0.2 + STOCKDON_DISSIPATIVE_SETUP * Math.sqrt(sw.hsM * l0), 9);
    expect(-sw.barCrestDepthM - sw.tideM).toBeGreaterThan(0.35);
    expect(-sw.barCrestDepthM - sw.tideM).toBeLessThan(0.45);
  });
  it('has no fixed point in the slope form on the lobe face: the face steepens faster than the run-up', () => {
    let zc = sw.tideM;
    const run = sw.bar!.outerM - sw.bar!.innerM;
    for (let k = 0; k < 40; k += 1) zc = sw.tideM + stockdonRunup2(sw.hsM, 12.7469, (sw.bar!.floorDepthM + zc) / run).r2;
    expect(zc).toBeGreaterThan(10);
  });
  it('takes the near field out past the bar toe by one hand-over length', () => {
    const toe = sw.mouthS - (sw.barM + sw.bar!.outerM) - mouthHandoverLengthM(cas);
    expect(sw.grid.s0).toBe(Math.floor(toe));
    expect(sw.grid.s0).toBeLessThan(BEACH_GRID.s0);
  });
  it('is drowned by the record river and bared by a low flow (the one water)', () => {
    const crestCells = (sim: ReturnType<typeof createMouthSim>): number[] => {
      const g = sw.grid;
      const out: number[] = [];
      for (let c = 0; c < g.ns * g.na; c += 1) {
        const s = g.s0 + ((c % g.ns) + 0.5) * g.ds;
        if (sim.field.bed[c] > 0 && s < sw.mouthS - 3 && s > sw.mouthS - 30) out.push(c);
      }
      return out;
    };
    const run = (q: number): { bare: number; sheet: number } => {
      const sim = createMouthSim({ ...sw, dischargeM3S: q }, cas, OCEAN_FFT_N, seed);
      sim.field.waves = false;
      const clock = new MouthClock(sim);
      const cells = crestCells(sim);
      let bare = 0; let n = 0; const sh: number[] = [];
      for (let t = 5; t <= 20; t += 1) {
        clock.advanceTo(t);
        for (const c of cells) { n += 1; if (sim.field.h[c] <= 5e-3) bare += 1; else sh.push(sim.field.h[c]); }
      }
      sh.sort((a, b) => a - b);
      return { bare: bare / n, sheet: sh.length ? sh[Math.floor(sh.length / 2)] : 0 };
    };
    const record = run(sw.dischargeM3S);
    expect(record.bare).toBe(0);
    expect(record.sheet).toBeGreaterThan(0.1);
    const low = run(3);
    expect(low.bare).toBeGreaterThan(0.8);
  }, 120000);
});

describe("the sea edge's forcing at warped places (law 1)", () => {
  it('sums the cascades own modes: one IncidentWaves a cascade equals the one sum', () => {
    const px = Float64Array.of(-40, -30, -50);
    const pz = Float64Array.of(10, 12, 8);
    const use = forcingCascades(cas);
    const one = new IncidentWaves({ cascades: cas, n: OCEAN_FFT_N, seed, use, share: 0.95, maxModes: 700, px, pz });
    const parts = use.map((name) => new IncidentWaves({ cascades: cas, n: OCEAN_FFT_N, seed, use: [name], share: 0.95, maxModes: 700, px, pz }));
    const a = new Float64Array(3);
    const b = new Float64Array(3);
    const tmp = new Float64Array(3);
    for (const t of [0, 3.7, 42]) {
      one.heights(t, a);
      b.fill(0);
      for (const p of parts) { p.heights(t, tmp); for (let j = 0; j < 3; j += 1) b[j] += tmp[j]; }
      for (let j = 0; j < 3; j += 1) expect(b[j]).toBeCloseTo(a[j], 9);
    }
  });
});

describe('the young sea does not tile (law 2)', () => {
  it('is 1024 cells at round 9 cell: a 52 m patch, over 50 m, with an even stage count', () => {
    const y = youngSeaOf(d, cas[0], SARCELLE_CONDITIONS.chopFetchM)!;
    expect(YOUNG_SEA_N).toBe(1024);
    expect(Math.log2(YOUNG_SEA_N) % 2).toBe(0);
    // Round 9's cell: half the open band's shortest wave (13 m / 256).
    expect(y.cascade.patchM / YOUNG_SEA_N).toBeCloseTo(13 / 256, 6);
    expect(y.cascade.patchM).toBeGreaterThan(50);
    // The patch holds its longest wave (twice the peak) over 50 times.
    expect(y.cascade.patchM / (2 * y.peakM)).toBeGreaterThan(50);
  });
});
