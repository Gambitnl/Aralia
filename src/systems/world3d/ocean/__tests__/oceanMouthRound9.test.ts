/**
 * oceanMouthRound9.test.ts — river mouth round 9.
 * Law 1: the local sea is its own young wind sea (`youngSeaOf`): its own JONSWAP at the wind over the water and the
 * near field's fetch, Donelan's spread about its own peak, the cascade's drawn spectrum, the slope budget against
 * Cox and Munk, the current's block of the open band (`openBandBlockR`, `youngBlockedShare`), the fetch walk that
 * starts where the current blocks the sea's band (`youngFetchWalk`, `youngCellShares`), the film's take.
 * Law 2: the crest moves at the shallow speed (`phaseWarpMap`, `phaseWarpRatio`, `hedgesK`): the warp's anchor on
 * the near fields' sea edge, its integral, and the warped mode's phase speed.
 */
// ROUND 13: these tests hold the straight valley of rounds 1 to 12 (`planform: 'straight'`); the Sarcelle's default
// is now the deflected mouth (oceanMouthRound13.test.ts).
import { describe, expect, it } from 'vitest';
import {
  BLOCK_BREAK_R, FILM_LONGEST_M, YOUNG_SEA_N, coxMunkMss, currentShare, deriveMouthDesign, donelanBeta, fentonMcKeeK, hedgesK,
  mouthFinePatch, openBandBlockR, youngFilmRest, coxMunkSlickMss, phaseWarpMap, phaseWarpRatio, youngBlockedShare, youngFilmTake, youngSeaMoments, youngSeaOf,
  youngSeaShare, SARCELLE_CONDITIONS, createMouthSim, youngCellShares, youngPlumeExits, type MouthBand,
  COAST_PLACES,
} from '../oceanMouthMath';
import { buildCascadeSpectrum, jonswapPeakOmega, significantWaveHeightM } from '../oceanSpectrum';
import { oceanSeaState } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';

const cas = oceanSeaState('surf');
// Round 10 put the Sarcelle at its low water (the record's tide); round 9's laws are held here at the mean sea level.
const d = deriveMouthDesign({ planform: 'straight',  daySeaHsM: null, cdomAg443M: null, cascades: cas, n: OCEAN_FFT_N, seed: 0x0cea9, tideM: 0, barLaw: 'break', dayDischargeM3S: COAST_PLACES.sarcelleMouth.dischargeM3S });
const G = 9.81;
const young = youngSeaOf(d, cas[0], SARCELLE_CONDITIONS.chopFetchM)!;

describe('the local sea is its own young wind sea (law 1)', () => {
  it('stands at the wind over the water and the near field fetch, with the clip chop as its peak', () => {
    expect(young).not.toBeNull();
    // The wind over the ground along the band, less the mouth's outflow: about 11.2 m/s over the water.
    expect(young.windRelMS).toBeGreaterThan(11);
    expect(young.windRelMS).toBeLessThan(11.5);
    expect(young.fetchM).toBe(SARCELLE_CONDITIONS.chopFetchM);
    // Its peak is the clip's measured chop (0.477 m) within 1 cm: the wind was fit at that fetch.
    expect(Math.abs(young.peakM - (SARCELLE_CONDITIONS.chopPeakM as number))).toBeLessThan(0.01);
    expect(young.omegaP).toBeCloseTo(jonswapPeakOmega(young.windRelMS, young.fetchM), 12);
    // Donelan's spread at its own peak.
    expect(young.betaPeak).toBe(2.28);
    expect(donelanBeta(1)).toBe(2.28);
  });
  it('is one cascade from the open band shortest wave to the patch, YOUNG_SEA_N cells at half that wave', () => {
    const b = d.bands.find((x) => x.local) as MouthBand;
    const shortM = (2 * Math.PI * G) / (b.omegaHi * b.omegaHi);
    expect(young.cascade.cutoffLowM).toBeCloseTo(shortM, 12);
    expect(young.cascade.patchM).toBeCloseTo((YOUNG_SEA_N * shortM) / 2, 9);
    expect(young.cascade.spreading).toBe('donelan');
    expect(young.cascade.tailPower).toBe(5);
    expect(young.cascade.windSpeedMs).toBe(young.windRelMS);
    // The pipeline's sign: the waves travel toward windDirRad + pi, the young sea's heading.
    expect(-Math.cos(young.cascade.windDirRad)).toBeCloseTo(young.dirX, 9);
    expect(-Math.sin(young.cascade.windDirRad)).toBeCloseTo(young.dirZ, 9);
    // The heading is the wind relative to the water: a few degrees off the open band's.
    const turn = Math.acos(young.dirX * b.dirX + young.dirZ * b.dirZ) * (180 / Math.PI);
    expect(turn).toBeGreaterThan(0.5);
    expect(turn).toBeLessThan(5);
  });
  it('draws its own spectrum: the cascade holds the law height within 2 %', () => {
    const sp = buildCascadeSpectrum(young.cascade, YOUNG_SEA_N, 1234);
    const hs = significantWaveHeightM(sp.m0);
    expect(Math.abs(hs / young.hsM - 1)).toBeLessThan(0.02);
    expect(young.hsM).toBeGreaterThan(0.02);
    expect(young.hsM).toBeLessThan(0.08);
  });
  it('with the fine chop and its remainder, its slope variance is Cox and Munk clean at that wind, within 15 %', () => {
    const fine = mouthFinePatch(d, young.fetchM, 0x0cea9);
    expect(fine).not.toBeNull();
    const sum = young.slopeVar + (fine as NonNullable<typeof fine>).drawnVar + (fine as NonNullable<typeof fine>).subVar;
    expect(Math.abs(sum / coxMunkMss(young.windRelMS) - 1)).toBeLessThan(0.15);
    const m = youngSeaMoments(young.windRelMS, young.fetchM, young.omegaLo, young.omegaHi, Math.sqrt((2 * Math.PI * G) / FILM_LONGEST_M));
    expect(young.shortShare).toBeCloseTo(m.shortVar / m.slopeVar, 12);
  });
  it('takes a share by its own fetch: 1 at the median, less on a short fetch, more on a long one', () => {
    expect(youngSeaShare(young, young.windRelMS, young.fetchM)).toBeCloseTo(1, 9);
    expect(youngSeaShare(young, young.windRelMS, 5)).toBeLessThan(0.6);
    expect(youngSeaShare(young, young.windRelMS, 200)).toBeGreaterThan(1);
    expect(youngSeaShare(young, young.windRelMS, 0)).toBe(0);
  });
  it('the current blocks the open band at its slope carrier: r = -U.k / cg, and the young sea takes what it took', () => {
    expect(young.openCgS).toBeCloseTo(G / (2 * young.openOmegaS), 12);
    // An outflow of 1 m/s along the channel's seaward axis against the band.
    const uX = d.frame.sX * -1;
    const uZ = d.frame.sZ * -1;
    const r = openBandBlockR(young, uX, uZ);
    expect(r).toBeGreaterThan(1.5);
    expect(youngBlockedShare(r)).toBe(1);
    expect(currentShare(r)).toBe(0);
    expect(youngBlockedShare(BLOCK_BREAK_R)).toBe(0);
    expect(youngBlockedShare(0)).toBe(0);
    // Under the break, the open band grows by wave action and the young sea is absent.
    expect(currentShare(0.3)).toBeCloseTo(1 / Math.sqrt(0.7), 12);
    expect(youngBlockedShare(0.75)).toBeCloseTo(0.5, 12);
  });
  it('the young sea fills the channel the current blocks; the fetch starts where the block does', () => {
    const sim = createMouthSim(d, cas, OCEAN_FFT_N, 0x0cea9, 10);
    youngPlumeExits(d, young);
    // The jet blocks the band at the grid's sea edge on the axis, and lets it through off the jet.
    const jAxis = Math.floor((d.mouthA - d.grid.a0) / d.grid.da);
    expect(young.exitR[jAxis]).toBeGreaterThan(1);
    expect(young.exitRunM[jAxis]).toBeGreaterThan(20);
    expect(young.exitR[0]).toBeLessThan(BLOCK_BREAK_R);
    const g = d.grid;
    for (const s of [5, 20, 40]) {
      const sh = youngCellShares(d, sim.field, Math.floor((s - g.s0) / g.ds), jAxis, young);
      expect(sh.open).toBe(0);
      expect(sh.young).toBeGreaterThan(0.85);
    }
  });
  it("the film leaves Cox and Munk's slick slope variance, the shorter waves first", () => {
    const fine = mouthFinePatch(d, young.fetchM, 0x0cea9) as NonNullable<ReturnType<typeof mouthFinePatch>>;
    const shorter = fine.drawnVar + fine.subVar;
    const rest = youngFilmRest(young, shorter);
    const take = youngFilmTake(young, rest);
    expect(take).toBeGreaterThan(0.2);
    expect(take).toBeLessThan(young.shortShare);
    // What is left: the young sea's untaken share, and nothing of the shorter waves: Cox and Munk's slick value.
    expect(young.slopeVar * (1 - take)).toBeCloseTo(coxMunkSlickMss(young.windRelMS), 9);
    expect(youngFilmRest(young, 0)).toBeCloseTo(young.slopeVar - coxMunkSlickMss(young.windRelMS), 12);
  });
  it('the film takes at most its share under 30 cm, and nothing with nothing left to take', () => {
    expect(youngFilmTake(young, 0)).toBe(0);
    expect(youngFilmTake(young, 1)).toBeCloseTo(young.shortShare, 12);
    expect(youngFilmTake(young, young.slopeVar * 0.1)).toBeCloseTo(0.1, 12);
  });
});

describe('the crest moves at the shallow speed (law 2)', () => {
  it('Hedges dispersion by Fenton and McKee: on the bar the crest runs at sqrt(g (h + H)) within 6 %', () => {
    const tz = d.tzS;
    const omega = (2 * Math.PI) / tz;
    const h = d.barCrestDepthM;
    const hh = 0.4;
    const c = omega / hedgesK(omega, h, hh);
    expect(Math.abs(c / Math.sqrt(G * (h + hh)) - 1)).toBeLessThan(0.06);
    expect(hedgesK(omega, h, hh)).toBeCloseTo(fentonMcKeeK((omega * omega) / G, h + hh), 12);
    // Deep water: no warp.
    expect(phaseWarpRatio(omega, 500, 1)).toBeCloseTo(1, 6);
    expect(phaseWarpRatio(omega, 0.6, 0.4)).toBeGreaterThan(2);
  });
  // A synthetic map: a plane slope in z, the frame's s along -z, one forced band heading toward -z (landward).
  const res = 64;
  const tx = 2;
  const map = { res, texelM: tx, originX: 0, originZ: 0, data: new Float32Array(res * res * 4) };
  for (let j = 0; j < res; j += 1) for (let i = 0; i < res; i += 1) map.data[(j * res + i) * 4] = 0.5 + 0.1 * (j * tx);
  const hrms = new Float32Array(res * res);
  const frame = { originX: 0, originZ: 0, sX: 0, sZ: -1, aX: -1, aZ: 0 };
  const omega = 2 * Math.PI / 6;
  const band = { ...d.bands[1], forced: true, local: false, dirX: 0, dirZ: -1, omega } as MouthBand;
  const pw = phaseWarpMap({ map, hrmsM: hrms, frame: frame as never, anchorS: -20, bands: [d.bands[0], band], patchM: [13, 89] });
  const W = (i: number, j: number) => pw.data[(j * res + i) * 4 + 1];
  it('is 0 on the anchor line and the integral of (k / k0 - 1) along the heading from it', () => {
    // The anchor s = -20 is z = 20: row 10.
    expect(Math.abs(W(30, 10))).toBeLessThan(1e-6);
    // Seaward (larger z) the read place lies further out: W < 0, and it is the integral of J - 1.
    const jAt = (z: number) => phaseWarpRatio(omega, 0.5 + 0.1 * z, 0);
    let integ = 0;
    for (let z = 20; z < 60; z += 0.01) integ += (jAt(z + 0.005) - 1) * 0.01;
    expect(W(30, 30)).toBeLessThan(0);
    expect(Math.abs(-W(30, 30) / integ - 1)).toBeLessThan(0.01);
    // Landward of the anchor W > 0; the band not forced keeps 0.
    expect(W(30, 5)).toBeGreaterThan(0);
    expect(pw.data[(30 * res + 30) * 4]).toBe(0);
  });
  it("the warped mode's crest moves at omega / k: its phase gradient along the heading is k", () => {
    // The phase of the deep mode read at X = x + W dir: k0 (X . dir); along dir its gradient is k0 (1 + dW/dl) = k.
    const k0 = (omega * omega) / G;
    const j = 30;
    // Along the heading (toward -z) one row is tx: dW/dl = (W(row j - 1) - W(row j)) / tx.
    const dWdl = (W(30, j - 1) - W(30, j)) / tx;
    const kLocal = hedgesK(omega, 0.5 + 0.1 * ((j - 0.5) * tx), 0);
    expect(Math.abs((k0 * (1 + dWdl)) / kLocal - 1)).toBeLessThan(0.01);
  });
  it('the taper past the map holds the warp slope to the band wave-number step on its patch', () => {
    const lam = (2 * Math.PI * G) / (omega * omega);
    expect(pw.taperM).toBeCloseTo(pw.edgeW[1] / (lam / 89), 6);
  });
});
