/**
 * oceanMouthRound8.test.ts — river mouth round 8.
 * Law 1: the river's film ends at the plume's front (`riverFilmAt`): whole where the surface water is at least
 * half the river's, 0 past it.
 * Law 2: the breaking on the bar is depth-limited (`depthLimitedBreakShare`): the march's record over
 * McCowan's limit; the source takes the larger of it and round 7's group rule (`sourceBreakingShareCpu`).
 * Law 3: the place's chop is fit at the near field's own fetch (the record's `chopFetchM` is its median), so the
 * drawn young sea's peak is the clip's.
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import {
  MCCOWAN_GAMMA, PLUME_FRONT_SHARE, battjesJanssenMarch, battjesStiveGamma, depthLimitedBreakShare, deriveMouthDesign,
  jetAt, jetTakeover, riverFilmAt, sourceBreakingShareCpu, SARCELLE_CONDITIONS, createMouthSim, riverFetchM,
  COAST_PLACES,
} from '../oceanMouthMath';
import { jonswapPeakOmega } from '../oceanSpectrum';
import { bathyShoalGain, beachToWorld } from '../oceanBeachMath';
import { seabedPointAt } from '../oceanSeabedMath';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';

// Round 10 put the Sarcelle at its low water (the record's tide); round 8's laws are held here at the mean sea level.
const d = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades: oceanSeaState('surf'), n: OCEAN_FFT_N, seed: 0x0cea9, tideM: 0, barLaw: 'break', dayDischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S });

describe('the film ends at the front (law 1)', () => {
  it("is whole where the surface water is at least half the river's, and 0 past it", () => {
    expect(PLUME_FRONT_SHARE).toBe(0.5);
    expect(riverFilmAt(1)).toBe(1);
    expect(riverFilmAt(0.5)).toBe(1);
    expect(riverFilmAt(0.49)).toBe(0);
    expect(riverFilmAt(0)).toBe(0);
  });
  // The drawn share on the plume: the jet's share times the sea's takeover at the floor's depth.
  const drawn = (x: number, y: number) => {
    const [wx, wz] = beachToWorld(d.frame, d.mouthS - x, d.mouthA + y);
    const j = jetAt(d, x, y);
    return j.c * jetTakeover(d, j.um, Math.max(seabedPointAt(d.params, wx, wz).depthM, 0));
  };
  it("draws a tongue: the front where the axis is all river water is the scalar's half value across the jet", () => {
    // Near the mouth the axis is river water, so the film's edge is the jet's own front (gc = 0.5).
    let y = 0;
    while (riverFilmAt(drawn(40, y)) === 1 && y < 200) y += 0.25;
    expect(y).toBeGreaterThan(10);
    expect(Math.abs(jetAt(d, 40, y).gc - 0.5)).toBeLessThan(0.1);
    // The film ends along the axis where the axis share falls to half, a few hundred meters out, far inside the
    // plume's optical reach (round 5 to 7's share film ran on, thinning, to the reach).
    let x = 0;
    while (riverFilmAt(drawn(x, 0)) === 1 && x < 5000) x += 5;
    expect(x).toBeGreaterThan(100);
    expect(x).toBeLessThan(400);
  });
});

describe('the breaking on the bar is depth-limited (law 2)', () => {
  it("rises from 0.6 of McCowan's limit to all of it", () => {
    expect(MCCOWAN_GAMMA).toBe(0.78);
    expect(depthLimitedBreakShare(0.59 * MCCOWAN_GAMMA, 1)).toBe(0);
    expect(depthLimitedBreakShare(MCCOWAN_GAMMA, 1)).toBeCloseTo(1, 12);
    expect(depthLimitedBreakShare(2, 1)).toBe(1);
    expect(depthLimitedBreakShare(0.8 * MCCOWAN_GAMMA, 1)).toBeCloseTo(0.5, 12);
    expect(depthLimitedBreakShare(1, 0)).toBe(0);
  });
  // The march over the coast's floor along s (the coast's sea edge 740 m out), as `coastStirredColumns` runs it.
  const fr = d.frame;
  const marchAt = (a: number) => {
    const xs: number[] = []; const hs: number[] = []; const ss: number[] = [];
    for (let s = -740; s <= 20; s += 0.5) {
      const h = seabedPointAt(d.params, fr.originX + s * fr.sX + a * fr.aX, fr.originZ + s * fr.sZ + a * fr.aZ).depthM;
      if (h <= 0.02) break;
      xs.push(s + 740); hs.push(h); ss.push(s);
    }
    const hrmsDeep = d.hsM / Math.SQRT2;
    const m = battjesJanssenMarch({ xM: xs, depthM: hs, hrms0M: hrmsDeep * bathyShoalGain(d.tzS, hs[0]), tS: d.tzS, d50M: 0.00035, gamma: battjesStiveGamma(hrmsDeep, d.tzS) });
    return (s: number) => { const i = ss.findIndex((x) => Math.abs(x - s) < 0.26); return { h: hs[i], hrms: m.hrmsM[i], qb: m.qb[i] }; };
  };
  it("breaks every crest on the bar's crest, and none in the channels or on the outer shelf", () => {
    const axis = marchAt(d.mouthA);
    const crest = axis(-15);
    expect(crest.h).toBeLessThan(0.75);
    expect(depthLimitedBreakShare(crest.hrms, crest.h)).toBeGreaterThan(0.9);
    // Round 7's group rule alone: the share of the record over H_q is the march's Q_b, under 1.
    expect(crest.qb).toBeLessThan(1);
    for (const s of [-40, -60]) { const p = axis(s); expect(depthLimitedBreakShare(p.hrms, p.h)).toBeLessThan(0.01); }
    // A channel at the bar's flank, the mouth line (10 m off the axis).
    const ch = marchAt(d.mouthA - 10)(0);
    expect(depthLimitedBreakShare(ch.hrms, ch.h)).toBe(0);
  });
  it('takes the larger of the group rule and the depth-limited share', () => {
    const hrmsDeep = d.hsM / Math.SQRT2;
    // A crest whose group is low (envelope 0) on a saturated bar still breaks.
    expect(sourceBreakingShareCpu({ hEnvM: 0, qb: 0.4, hrmsDeepM: hrmsDeep, depthLimited: 1 })).toBe(1);
    // Seaward of the bar (no depth limit) the group rule alone: the envelope over H_q breaks, under 0.6 H_q not.
    const hQ = Math.sqrt(-Math.log(0.1)) * hrmsDeep;
    expect(sourceBreakingShareCpu({ hEnvM: hQ * 1.01, qb: 0.1, hrmsDeepM: hrmsDeep, depthLimited: 0 })).toBe(1);
    expect(sourceBreakingShareCpu({ hEnvM: hQ * 0.59, qb: 0.1, hrmsDeepM: hrmsDeep, depthLimited: 0 })).toBe(0);
    expect(sourceBreakingShareCpu({ hEnvM: 5, qb: 0, hrmsDeepM: hrmsDeep, depthLimited: 0 })).toBe(0);
  });
});

describe("the place's chop at the near field's own fetch (law 3)", () => {
  it("records the near field's median fetch over its wet cells", () => {
    const cas = oceanSeaState('surf');
    const sim = createMouthSim(d, cas, OCEAN_FFT_N, 0x0cea9, 0);
    const f = sim.field;
    const loc = d.bands.find((b) => b.local)!;
    const all: number[] = [];
    for (let j = 0; j < f.na; j += 2) for (let i = 0; i < f.ns; i += 2) if (f.h[j * f.ns + i] > 1e-2) all.push(riverFetchM(d, f, i, j, loc));
    all.sort((x, y) => x - y);
    expect(Math.abs(all[Math.floor(all.length / 2)] / SARCELLE_CONDITIONS.chopFetchM - 1)).toBeLessThan(0.1);
  });
  it("draws the young sea's peak at the clip's chop peak there (the wind over the water: the ground's plus the outflow)", () => {
    const loc = d.bands.find((b) => b.local)!;
    const wp = jonswapPeakOmega(loc.localWindMS + d.u0MS, SARCELLE_CONDITIONS.chopFetchM);
    expect(Math.abs((2 * Math.PI * 9.81) / (wp * wp) / (SARCELLE_CONDITIONS.chopPeakM as number) - 1)).toBeLessThan(0.02);
  });
});
