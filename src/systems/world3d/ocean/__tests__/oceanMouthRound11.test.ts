/**
 * oceanMouthRound11.test.ts — river mouth round 11.
 * Law 1: the clip's day discharge (`SARCELLE_CONDITIONS.dayDischargeM3S`) beside the mean flow; the design's two
 * discharges; the swash bar as the default; the near field owns the broken water (`mouthHandoverStarts`); the
 * phase warp's first-arrival march in the mouth's box (`phaseWarpMap`'s `box`).
 * Law 2: the open band's diffraction round the mouth (`youngCellField`); the young sea's strain memory
 * (`youngStrainMemoryS`). The display curve's CPU twin (`mouthDisplayCurve`, the lead's ruling 3).
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import {
  COAST_PLACES, FRESNEL_EDGE_SIGMA, HG_WIDTH_A, HG_WIDTH_B, MCCOWAN_GAMMA, MouthClock, SARCELLE_CONDITIONS,
  createMouthSim, deriveMouthDesign, mouthDisplayCurve, mouthEdgeBore, mouthHandoverAt, mouthHandoverLengthM,
  mouthHandoverStarts, phaseWarpMap, riverFetchM, youngCellField, youngPlumeExits, youngSeaOf, youngStrainMemoryS,
  type MouthBand,
} from '../oceanMouthMath';
import { beachToWorld } from '../oceanBeachMath';
import { seabedPointAt } from '../oceanSeabedMath';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';

const cas = oceanSeaState('surf');
const seed = 0x0cea9;
const d = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades: cas, n: OCEAN_FFT_N, seed, statsSpanS: 300 });
const mean = COAST_PLACES.sarcelleMouth.dischargeM3S;

describe('the clip\'s day (law 1)', () => {
  it('carries two discharges: the channel and the bar at the mean flow, the near field and the jet at the day', () => {
    expect(SARCELLE_CONDITIONS.dayDischargeM3S).toBe(4.2);
    expect(d.dischargeM3S).toBe(4.2);
    expect(d.meanDischargeM3S).toBeCloseTo(mean, 9);
    expect(d.widthM).toBeCloseTo(HG_WIDTH_A * mean ** HG_WIDTH_B, 9);
    expect(d.u0MS).toBeCloseTo(4.2 / d.areaM2, 12);
    expect(d.jet.xM.length).toBeGreaterThan(1);
    // The bar is the mean flow's deposit: the same bar as the design run at the mean flow.
    const atMean = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades: cas, n: OCEAN_FFT_N, seed, statsSpanS: 300, dayDischargeM3S: mean });
    expect(d.barM).toBeCloseTo(atMean.barM, 9);
    expect(d.bar).toEqual(atMean.bar);
  });
  it('makes the swash bar the default, with the break crest the control', () => {
    expect(d.barLaw).toBe('swash');
    expect(deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades: cas, n: OCEAN_FFT_N, seed, statsSpanS: 300, barLaw: 'break' }).barLaw).toBe('break');
  });
  it('holds the record to the law: at the day the waves-off crest stands bare for the clip\'s share', () => {
    const sim = createMouthSim(d, cas, OCEAN_FFT_N, seed);
    const f = sim.field;
    f.waves = false;
    const g = d.grid;
    const crest: number[] = [];
    for (let c = 0; c < g.ns * g.na; c += 1) {
      const s = g.s0 + ((c % g.ns) + 0.5) * g.ds;
      if (f.bed[c] > 0 && s < d.mouthS - 3 && s > d.mouthS - 30) crest.push(c);
    }
    const clock = new MouthClock(sim);
    let bare = 0;
    let tot = 0;
    for (let t = 20; t <= 40; t += 1) {
      clock.advanceTo(t);
      for (const c of crest) { tot += 1; if (f.h[c] <= 5e-3) bare += 1; }
    }
    expect(crest.length).toBeGreaterThan(100);
    expect(Math.abs(bare / tot - (SARCELLE_CONDITIONS.barBareShare as number))).toBeLessThan(0.04);
  }, 60000);
});

describe('the near field owns the broken water (law 1)', () => {
  const hr = new Float64Array(d.grid.na);
  for (let j = 0; j < d.grid.na; j += 1) hr[j] = mouthEdgeBore(d, d.grid.a0 + (j + 0.5) * d.grid.da).hrmsM;
  const st = mouthHandoverStarts(d, hr);
  const g = d.grid;
  it('starts each row where the edge waves break in full, seaward of the bare crest', () => {
    const jA = Math.floor((d.mouthA - g.a0) / g.da);
    const s = st[jA];
    expect(s).toBeGreaterThan(g.s0);
    expect(s).toBeLessThan(d.mouthS);
    const [x, z] = beachToWorld(d.frame, s + 0.5 * g.ds, d.mouthA);
    expect(seabedPointAt(d.params, x, z).depthM).toBeLessThanOrEqual(hr[jA] / MCCOWAN_GAMMA + 1e-9);
    // Every cell seaward of it is deeper than the full-break depth; the crest's dry cells lie landward of it.
    for (let sc = g.s0 + 0.5; sc < s; sc += g.ds) {
      const [xx, zz] = beachToWorld(d.frame, sc, d.mouthA);
      expect(seabedPointAt(d.params, xx, zz).depthM).toBeGreaterThan(hr[jA] / MCCOWAN_GAMMA);
    }
    const blend = mouthHandoverLengthM(cas);
    expect(mouthHandoverAt(d, blend, s - 0.5, d.mouthA, st)).toBe(0);
    expect(mouthHandoverAt(d, blend, s + blend + 0.5, d.mouthA, st)).toBeCloseTo(1, 9);
  });
});

describe('the warp passes round the bare crest (law 1)', () => {
  it('equals the straight sweep where the depth changes only across the shore', () => {
    // A synthetic straight coast: depth by z only, the frame's s along -Z, a along -X (the coast's).
    const res = 96;
    const texelM = 1;
    const data = new Float32Array(res * res * 4);
    for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) data[(j * res + i) * 4] = Math.max(0.05 + 0.04 * j, 0);
    const map = { res, texelM, originX: -48, originZ: -48, data };
    const frame = { originX: 0, originZ: 0, sX: 0, sZ: -1, aX: -1, aZ: 0 };
    const band = (dx: number, dz: number): MouthBand => ({ ...d.bands.find((b) => b.forced)!, dirX: dx, dirZ: dz });
    const th = (18 * Math.PI) / 180;
    const bands = [band(Math.sin(th), -Math.cos(th))];
    const hrmsM = new Float32Array(res * res);
    const base = { map, hrmsM, frame, anchorS: -10, bands, patchM: [89] };
    const w0 = phaseWarpMap(base);
    const w1 = phaseWarpMap({ ...base, box: { s0: -30, a0: -15, a1: 15 } });
    let worst = 0;
    for (let j = 0; j < res; j += 1) for (let i = 30; i < 66; i += 1) worst = Math.max(worst, Math.abs(w1.data[(j * res + i) * 4] - w0.data[(j * res + i) * 4]));
    expect(worst).toBeLessThan(0.05 * Math.max(...w0.edgeW));
  });
});

describe('the open band diffracts round the mouth (law 2)', () => {
  it('has the Fresnel edge width: a Gaussian whose 10 to 90 % rise is 1.35 sqrt(lambda x)', () => {
    expect(FRESNEL_EDGE_SIGMA * 2.563).toBeCloseTo(1.35, 3);
  });
  it('lights the river by a smooth share: no step over 0.5 between wet neighbors across a run over 20 m', () => {
    const sim = createMouthSim(d, cas, OCEAN_FFT_N, seed);
    const f = sim.field;
    const loc = d.bands.find((b) => b.local)!;
    const all: number[] = [];
    for (let j = 0; j < f.na; j += 2) for (let i = 0; i < f.ns; i += 2) if (f.h[j * f.ns + i] > 1e-2) all.push(riverFetchM(d, f, i, j, loc));
    all.sort((x, y) => x - y);
    const y = youngSeaOf(d, cas[d.bands.findIndex((b) => b.local)], all[Math.floor(all.length / 2)])!;
    youngPlumeExits(d, y);
    const fld = youngCellField(d, f, y);
    const g = d.grid;
    let worst = 0;
    for (let j = 0; j + 1 < g.na; j += 1) {
      for (let i = 0; i < g.ns; i += 1) {
        const c = j * g.ns + i;
        const c2 = c + g.ns;
        if (!(f.h[c] > 0.05 && f.h[c2] > 0.05) || g.s0 + i * g.ds < d.mouthS + 20) continue;
        worst = Math.max(worst, Math.abs(fld.lit[c] - fld.lit[c2]));
      }
    }
    expect(worst).toBeLessThan(0.5);
    for (const v of fld.lit) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  }, 60000);
  it('remembers the current\'s strain over Plant\'s wind-input time at its peak', () => {
    const y = youngSeaOf(d, cas[d.bands.findIndex((b) => b.local)], 46)!;
    const t = youngStrainMemoryS(y);
    const u = y.windRelMS;
    const uStar = Math.sqrt((0.49 + 0.065 * u) * 1e-3) * u;
    const c = 9.81 / y.omegaP;
    expect(t).toBeCloseTo(1 / (0.04 * (uStar / c) ** 2 * y.omegaP), 9);
    expect(t).toBeGreaterThan(4);
    expect(t).toBeLessThan(15);
  });
});

describe('the display curve (the lead\'s ruling 3)', () => {
  it('is 0 at 0, rises, and stays under 1 (Reinhard on a gamma)', () => {
    const c = { exposure: 2, gamma: 1.2 };
    expect(mouthDisplayCurve(c, 0)).toBe(0);
    let last = 0;
    for (let l = 0.01; l < 20; l *= 1.3) { const v = mouthDisplayCurve(c, l); expect(v).toBeGreaterThanOrEqual(last); expect(v).toBeLessThanOrEqual(1); last = v; }
  });
});
