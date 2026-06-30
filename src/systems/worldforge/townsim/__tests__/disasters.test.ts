import { SeededRandom } from '../../../../utils/random/seededRandom';
import {
  rollAnnualDisaster,
  disasterSummary,
  fireDeaths,
  plagueDeaths,
  crimeWaveWealthLoss,
  type DisasterKind,
} from '../disasters';

describe('rollAnnualDisaster', () => {
  it('is deterministic for a given seed', () => {
    const a = rollAnnualDisaster(new SeededRandom(123));
    const b = rollAnnualDisaster(new SeededRandom(123));
    expect(a).toEqual(b);
  });

  it('returns every disaster kind AND null across many seeds', () => {
    const seen = new Set<string>();
    for (let i = 1; i <= 400; i++) {
      const d = rollAnnualDisaster(new SeededRandom(i * 2654435761));
      seen.add(d ? d.kind : 'none');
    }
    for (const k of ['fire', 'plague', 'crime_wave', 'none']) {
      expect(seen.has(k)).toBe(true);
    }
  });

  it('disasters are rare — most years are calm', () => {
    let calm = 0;
    const total = 2000;
    for (let i = 1; i <= total; i++) {
      if (rollAnnualDisaster(new SeededRandom(i * 2654435761)) === null) calm++;
    }
    expect(calm / total).toBeGreaterThan(0.8); // ~88% calm
  });
});

describe('disasterSummary', () => {
  it('gives a verbatim announcement for each kind', () => {
    const kinds: DisasterKind[] = ['fire', 'plague', 'crime_wave'];
    for (const k of kinds) expect(disasterSummary(k).length).toBeGreaterThan(0);
    expect(disasterSummary('fire')).toBe('A fire swept through the town.');
    expect(disasterSummary('plague')).toBe('A plague struck the town.');
    expect(disasterSummary('crime_wave')).toBe('A crime wave troubled the town.');
  });
});

describe('disaster magnitude helpers', () => {
  it('fireDeaths is a small absolute count, capped at 3 and the population', () => {
    expect(fireDeaths(0)).toBe(0);
    expect(fireDeaths(1)).toBe(1); // never exceeds the living count
    expect(fireDeaths(10)).toBeGreaterThanOrEqual(1);
    for (const pop of [5, 50, 200, 1000]) {
      const d = fireDeaths(pop);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(3);
      expect(d).toBeLessThanOrEqual(pop);
    }
  });

  it('plagueDeaths is a bounded fraction that never wipes the town out', () => {
    expect(plagueDeaths(0)).toBe(0);
    expect(plagueDeaths(1)).toBe(0); // a town of one always has a survivor
    for (const pop of [2, 10, 100, 500]) {
      const d = plagueDeaths(pop);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(Math.floor(pop / 2)); // never more than half
      expect(d).toBeLessThanOrEqual(pop - 1); // always a survivor
    }
    expect(plagueDeaths(100)).toBeGreaterThan(0); // a real plague kills somebody
  });

  it('crimeWaveWealthLoss is a negative per-villager delta', () => {
    expect(crimeWaveWealthLoss()).toBeLessThan(0);
  });
});
