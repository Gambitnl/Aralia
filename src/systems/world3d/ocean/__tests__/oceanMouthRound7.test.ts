/**
 * oceanMouthRound7.test.ts — river mouth round 7.
 * Law 1: the break line's coverage from the roller (Svendsen 1984's area, Duncan 1981's length, Battjes and
 * Janssen's Q_b and H_m), the foam source's CPU twin (`rollerSourceCpu`) against the mean the law gives.
 * Law 2: the effective Fresnel reflectance of a rough sea at grazing (`effectiveFresnelCpu`).
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import {
  ROLLER_LENGTH_PER_H, deriveMouthDesign, effectiveFresnelCpu, slantFetchStretch, fentonMcKeeK, rollerCoastOf, rollerMeanCoverage, rollerOnDepth, rollerSourceCpu,
  COAST_PLACES,
} from '../oceanMouthMath';
import { waveNumberAt } from '../oceanBeachMath';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';

const rc = rollerCoastOf({ hsM: 2.428, tzS: 5.4545 });

describe('the roller law (law 1a)', () => {
  it('has the roller length from Svendsen\'s area and Duncan\'s shape: L_r = sqrt(0.9 / 0.11) H', () => {
    expect(ROLLER_LENGTH_PER_H).toBeCloseTo(2.8604, 3);
  });
  it('takes the wave number by Fenton and McKee within 2% of the exact dispersion', () => {
    const w = (2 * Math.PI) / rc.tS;
    for (const h of [0.3, 0.6, 1, 2, 5, 20]) {
      expect(Math.abs(fentonMcKeeK(rc.k0, h) / waveNumberAt(w, h) - 1)).toBeLessThan(0.02);
    }
  });
  it('gives the broken height H_m near gamma h in shallow water and the roller a few tenths of a radian', () => {
    const r = rollerOnDepth(0.61, rc);
    expect(r.hmM / 0.61).toBeGreaterThan(0.75);
    expect(r.hmM / 0.61).toBeLessThan(rc.gamma + 1e-9);
    expect(r.thetaR).toBeGreaterThan(0.5);
    expect(r.thetaR).toBeLessThan(1);
  });
  it('covers Q_b times the roller\'s share of the wave on the mean', () => {
    expect(rollerMeanCoverage(0.4, 0.61, rc)).toBeCloseTo(0.4 * rollerOnDepth(0.61, rc).phaseShare, 12);
    expect(rollerMeanCoverage(0, 1, rc)).toBe(0);
  });
});

describe('the foam source\'s roller (law 1b: the wave\'s envelope breaks, the roller rides its face)', () => {
  it('lays foam only on the front face, from the crest over theta_r', () => {
    const h = 0.8;
    const { thetaR } = rollerOnDepth(h, rc);
    const a = 2.5; // a tall crest: it breaks at any Q_b over 0.1
    const at = (th: number) => rollerSourceCpu(a * Math.cos(th), a * Math.sin(th), h, 0.4, rc);
    expect(at(0.5 * thetaR)).toBeCloseTo(1, 6);
    expect(at(1.1 * thetaR)).toBe(0);
    expect(at(-0.3)).toBe(0); // the back face
  });
  it('breaks the top Q_b of a Rayleigh sea: the mean cover over a random sea matches the law', () => {
    // A random linear sea, one period: heights Rayleigh with Hrms (deep), phases uniform.
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (const [h, qb] of [[0.61, 0.38], [1.0, 0.41], [2.0, 0.07]]) {
      let sum = 0;
      const N = 200000;
      for (let i = 0; i < N; i += 1) {
        const H = rc.hrmsDeepM * Math.sqrt(-Math.log(Math.max(rnd(), 1e-12)));
        const th = 2 * Math.PI * rnd();
        const a = H / 2;
        sum += rollerSourceCpu(a * Math.cos(th), a * Math.sin(th), h, qb, rc, 1 - 1e-6);
      }
      const law = rollerMeanCoverage(qb, h, rc);
      // The source's edge (a smoothstep in cos theta over the last fifth of theta_r) moves the mean by under a fifth.
      expect(sum / N).toBeGreaterThan(0.8 * law);
      expect(sum / N).toBeLessThan(1.2 * law);
    }
  });
});

describe('the effective Fresnel reflectance at grazing (law 2)', () => {
  it('is the flat Schlick value when the sea is smooth', () => {
    for (const e of [3, 10, 30, 60]) {
      const s = Math.sin((e * Math.PI) / 180);
      expect(effectiveFresnelCpu(s, 1e-5).weighted).toBeCloseTo(0.02 + 0.98 * (1 - s) ** 5, 4);
    }
  });
  it('falls under the flat value at grazing as the slopes grow (Mobley 1999)', () => {
    const s = Math.sin((5.6 * Math.PI) / 180);
    const flat = 0.02 + 0.98 * (1 - s) ** 5;
    const r05 = effectiveFresnelCpu(s, 0.05).weighted;
    const r10 = effectiveFresnelCpu(s, 0.1).weighted;
    expect(r05).toBeLessThan(flat);
    expect(r10).toBeLessThan(r05);
    // A 2D Monte Carlo of the same law (mouth7 probe): 0.54 at 0.05, 0.43 at 0.1.
    expect(r05).toBeCloseTo(0.54, 1);
    expect(r10).toBeCloseTo(0.43, 1);
  });
  it('weights the facets that face the eye: the weighted mean is under the plain mean at grazing', () => {
    const s = Math.sin((4 * Math.PI) / 180);
    const r = effectiveFresnelCpu(s, 0.1);
    expect(r.weighted).toBeLessThan(r.plain);
    // Near the vertical the two agree.
    const v = effectiveFresnelCpu(Math.sin((70 * Math.PI) / 180), 0.1);
    expect(Math.abs(v.weighted - v.plain)).toBeLessThan(0.01);
  });
});

describe('the local sea spread by the fetch in each direction (law 3, the slanting fetch)', () => {
  const d = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades: oceanSeaState('surf'), n: OCEAN_FFT_N, seed: 0x0cea9, statsSpanS: 120, barLaw: 'break', dayDischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S });
  const loc = d.bands.find((b) => b.local)!;
  it('keeps the sea spread where every direction has the open fetch (the sum quantization only)', () => {
    expect(slantFetchStretch(loc, () => loc.fetchM).stretch).toBeLessThan(1.25);
  });
  it('narrows the spread when the directions off the heading have only a channel width of water', () => {
    const open = slantFetchStretch(loc, () => loc.fetchM);
    const channel = slantFetchStretch(loc, (t) => (Math.abs(t) < 0.3 ? loc.fetchM : 20 / Math.max(Math.sin(Math.abs(t)), 0.05)));
    expect(channel.thetaHalf).toBeLessThan(open.thetaHalf);
    expect(channel.stretch).toBeGreaterThan(open.stretch);
  });
});
