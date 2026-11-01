/**
 * oceanSkyDeck.test.ts — the stratus deck's laws on the CPU (river mouth
 * round 6, law 1; oceanSkyDeckMath.ts): the layer's transmission, the gamma
 * law of its optical depth, the field's cover, the light under it, and the
 * Sarcelle record's fit against the clip's cloud pixels.
 */
import { describe, expect, it } from 'vitest';
import {
  DECK_TEX_N, deckAirTransmission, deckCloudRadiance, deckSceneLight, deckTauField, deckTransmission, gammaP, gammaQuantile,
  type DeckLightIn,
} from '../oceanSkyDeckMath';
import { OCEAN_SUN_DIR, clearSkyIrradianceCpu, oceanSkyGradientCpu } from '../oceanSky';
import { acesFilmicSrgb8 } from '../oceanUnderwaterMath';
import { FLOOR_LIGHT } from '../oceanSeabedMath';
import { SARCELLE_CONDITIONS } from '../oceanMouthMath';

describe('deckTransmission (delta-Eddington, conservative)', () => {
  it('passes the whole beam at tau 0 and less as tau grows', () => {
    const t0 = deckTransmission(0, 0.5);
    expect(t0.total).toBeCloseTo(1, 9);
    expect(t0.direct).toBeCloseTo(1, 9);
    let last = 1;
    for (const tau of [1, 2, 5, 10, 15, 30, 50]) {
      const t = deckTransmission(tau, 0.5);
      expect(t.total).toBeLessThan(last);
      expect(t.forward).toBeGreaterThanOrEqual(t.direct);
      expect(t.total).toBeGreaterThanOrEqual(t.forward);
      last = t.total;
    }
  });
  it('lets a third to a half of the beam through a deck of tau 5 to 15, and under a sixth at tau 50 (a storm deck)', () => {
    expect(deckTransmission(5, 0.5).total).toBeGreaterThan(0.5);
    expect(deckTransmission(15, 0.5).total).toBeGreaterThan(0.3);
    expect(deckTransmission(15, 0.5).total).toBeLessThan(0.35);
    expect(deckTransmission(50, 0.5).total).toBeLessThan(1 / 6);
  });
});

describe('the gamma law of the optical depth', () => {
  it('gammaP is the regularized lower incomplete gamma (shape 1: 1 - e^-x)', () => {
    for (const x of [0.1, 1, 3, 8]) expect(gammaP(1, x)).toBeCloseTo(1 - Math.exp(-x), 10);
  });
  it('the quantile inverts the distribution, and the mean of the quantiles is the mean', () => {
    const q = gammaQuantile(0.3, 1.5, 5);
    expect(gammaP(1.5, q / (5 / 1.5))).toBeCloseTo(0.3, 6);
    let s = 0;
    const n = 2000;
    for (let i = 0; i < n; i += 1) s += gammaQuantile((i + 0.5) / n, 1.5, 5);
    expect(s / n).toBeCloseTo(5, 1);
  });
});

describe('deckTauField', () => {
  it('covers exactly the cloud share and is the same field for the same seed', () => {
    const f = deckTauField(0.569, 5, 1.5);
    const g = deckTauField(0.569, 5, 1.5);
    expect(f).toEqual(g);
    let cloud = 0;
    for (const t of f) if (t > 0) cloud += 1;
    expect(cloud / f.length).toBeCloseTo(0.569, 2);
  });
  it('tiles: the first and the last rows and columns differ no more than neighbors inside', () => {
    const n = DECK_TEX_N;
    const f = deckTauField(1, 5, 1.5);
    let edge = 0;
    let inner = 0;
    for (let i = 0; i < n; i += 1) {
      edge += Math.abs(f[i] - f[(n - 1) * n + i]) + Math.abs(f[i * n] - f[i * n + n - 1]);
      inner += Math.abs(f[n * (n / 2) + i] - f[n * (n / 2 + 1) + i]) + Math.abs(f[i * n + n / 2] - f[i * n + n / 2 + 1]);
    }
    expect(edge).toBeLessThan(inner * 2);
  });
});

describe('deckSceneLight', () => {
  it('a clear field (share 0) gives the clear day: 1, 1, 1', () => {
    const f = deckTauField(0, 5, 1.5);
    const l = deckSceneLight(f, DECK_TEX_N, { baseM: 1500, tileM: 12000, offsetM: [0, 0] }, [0, 0.5, -0.866], 3.81);
    expect(l.sunDirect).toBeCloseTo(1, 9);
    expect(l.skyGain).toBeCloseTo(1, 9);
    expect(l.airGain).toBeCloseTo(1, 9);
  });
});

describe('the clear gradient on the CPU', () => {
  it('holds the shader\'s shipped colors at the zenith and the line', () => {
    const z = oceanSkyGradientCpu(1);
    expect(z[0]).toBeCloseTo(0.085, 3);
    expect(z[2]).toBeCloseTo(0.400, 3);
    const line = oceanSkyGradientCpu(0);
    // At the line the foot's color is mixed in in full (band 1).
    expect(line[0]).toBeCloseTo(0.234, 3);
  });
});

describe('THE SARCELLE DECK: the record against the clip\'s cloud pixels (mouth6/probe/fitDeck6.ts)', () => {
  it('draws the clip\'s cloud luma p10 / p50 / p90 by elevation band within 12 levels rms', () => {
    const c = SARCELLE_CONDITIONS;
    expect(c.deckTau).not.toBeNull();
    const sun = OCEAN_SUN_DIR;
    const clearE = clearSkyIrradianceCpu();
    const ratio = (FLOOR_LIGHT.sunE * sun.y) / FLOOR_LIGHT.skyE;
    const l = 0.2126 + 0.7152 * 0.95 + 0.0722 * 0.85;
    const li: DeckLightIn = { clearE, ratio, sunTint: [1 / l, 0.95 / l, 0.85 / l] };
    // The air's light gain for the gamma deck (the field's mean, as deckSceneLight).
    const f = deckTauField(c.cloudShare, c.deckTau as number, c.deckTauShape);
    const ag = deckSceneLight(f, DECK_TEX_N, { baseM: 1500, tileM: 12000, offsetM: [0, 0] }, [sun.x, sun.y, sun.z], ratio).airGain;
    const clip = [
      { el: [12.3, 15.3], q: [145.7, 185.7, 200.7] },
      { el: [9.2, 12.3], q: [161.1, 180.1, 215.4] },
      { el: [5.9, 9.2], q: [167.9, 196.5, 216.8] },
      { el: [2.6, 5.9], q: [178.2, 191.2, 206.9] },
    ];
    let err = 0;
    for (const b of clip) {
      const ls: number[] = [];
      for (let i = 0; i < 60; i += 1) {
        const tau = gammaQuantile((i + 0.5) / 60, c.deckTauShape, c.deckTau as number);
        for (let k = 0; k < 4; k += 1) {
          const e = ((b.el[0] + ((k + 0.5) / 4) * (b.el[1] - b.el[0])) * Math.PI) / 180;
          const up = Math.sin(e);
          const view = [0, up, Math.cos(e)];
          const cosSun = view[1] * sun.y + view[2] * sun.z;
          const cosWall = Math.max(-(view[2] * sun.z) / Math.abs(view[2]), 0);
          const clear = oceanSkyGradientCpu(up);
          const rad = deckCloudRadiance(up, cosSun, cosWall, tau, sun.y, li, clear, 1500);
          const tA = deckAirTransmission(up, c.deckAirK);
          const s = acesFilmicSrgb8([0, 1, 2].map((j) => rad[j] * tA + clear[j] * ag * (1 - tA)) as unknown as [number, number, number]);
          ls.push(0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]);
        }
      }
      ls.sort((x, y) => x - y);
      [0.1, 0.5, 0.9].forEach((p, j) => { err += (ls[Math.floor(p * ls.length)] - b.q[j]) ** 2; });
    }
    expect(Math.sqrt(err / 12)).toBeLessThan(12);
  });
  it('is a thin deck (tau 5 to 15 lets a third or more of the beam through)', () => {
    const t = deckTransmission(SARCELLE_CONDITIONS.deckTau as number, OCEAN_SUN_DIR.y).total;
    expect(t).toBeGreaterThan(0.33);
  });
});
