/**
 * oceanMouthRound6.test.ts — river mouth round 6, law 2: the middle-ground
 * bar's planform (`SeabedValley.bar.laterM`, `valleyBarDepthAt`), the coast's
 * breaking reference, and the local sea the breakers are taken against
 * (the Battjes and Janssen march differs along the bar's crest).
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';
import { COAST_PLACES, deriveMouthDesign, jetProfileAt, SARCELLE_CONDITIONS } from '../oceanMouthMath';
import { seabedPointAt, valleyBarDepthAt, type SeabedValley } from '../oceanSeabedMath';

const d = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades: oceanSeaState('surf'), n: OCEAN_FFT_N, seed: 0x0cea9, statsSpanS: 120, barLaw: 'break', dayDischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S });
const fr = d.frame;
const P = (s: number, a: number): [number, number] => [fr.originX + s * fr.sX + a * fr.aX, fr.originZ + s * fr.sZ + a * fr.aZ];

describe('the middle-ground bar\'s planform (Wright 1977)', () => {
  it('takes its lateral spread from the jet at the bar: sqrt(rc^2 / 3 + sigma^2)', () => {
    expect(d.bar).not.toBeNull();
    const p = jetProfileAt(d.jet, d.barM);
    expect(d.bar!.laterM).toBeCloseTo(Math.sqrt((p.rc * p.rc) / 3 + p.sigma * p.sigma), 9);
  });
  it('shoals toward the axis and falls to the floor in the channels at its flanks', () => {
    const sBar = d.mouthS - d.barM;
    const dAt = (a: number) => { const [x, z] = P(sBar, a); return seabedPointAt(d.params, x, z).depthM; };
    const axis = dAt(d.mouthA);
    // Round 10: the floor's depths are under the place's still water (its tide), the bar's crest under the mean sea level.
    expect(axis).toBeCloseTo(d.bar!.depthM + d.tideM, 2);
    const s1 = dAt(d.mouthA + d.bar!.laterM);
    const s3 = dAt(d.mouthA + 3 * d.bar!.laterM);
    expect(s1).toBeGreaterThan(axis + 0.05);
    expect(s3).toBeGreaterThan(s1);
    // At three spreads the bar's lift is e^-4.5 of its height: the floor.
    expect(s3 - d.bar!.floorDepthM).toBeLessThan(0.1);
  });
  it('keeps round 5\'s disc where no laterM is given', () => {
    const v: SeabedValley = { ...d.valley, bar: { xM: 0, zM: 0, innerM: 1, outerM: 10, depthM: 0.5 } };
    expect(valleyBarDepthAt(v, 0, 5, 1)).toBeCloseTo(0.5 + 0.5 * (4 / 9) ** 2 * (3 - 2 * (4 / 9)), 9);
    expect(valleyBarDepthAt(v, 0, 11, 1)).toBe(Infinity);
  });
  it('is narrower than one rip spacing (Short 1999: 1.5 to 4 surf-zone widths), so no rip cuts it', () => {
    expect(d.surfRef.depthM).toBeCloseTo(d.hsM / 0.75, 6);
    expect(d.surfRef.widthM).toBeGreaterThan(50);
    expect(4 * d.bar!.laterM).toBeLessThan(1.5 * d.surfRef.widthM);
  });
});

describe('the place\'s deck record', () => {
  it('carries the clip\'s deck: tau, shape, cover, air and the mean sun of the field', () => {
    expect(SARCELLE_CONDITIONS.deckTau).toBe(5);
    expect(SARCELLE_CONDITIONS.deckTauShape).toBe(1.5);
    expect(SARCELLE_CONDITIONS.cloudShare).toBeCloseTo(0.569, 3);
    expect(SARCELLE_CONDITIONS.deckAirK).toBe(0.06);
    expect(SARCELLE_CONDITIONS.deckSunMean).toBe(true);
  });
});
