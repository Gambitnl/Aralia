import { SeededRandom } from '../../../../utils/random/seededRandom';
import { rollAnnualEconomy } from '../economy';

describe('rollAnnualEconomy', () => {
  it('is deterministic for a given seed', () => {
    const a = rollAnnualEconomy(new SeededRandom(123));
    const b = rollAnnualEconomy(new SeededRandom(123));
    expect(a).toEqual(b);
  });

  it('produces every outcome kind across many seeds, with coherent deltas', () => {
    const seen = new Set<string>();
    for (let i = 1; i <= 400; i++) {
      const o = rollAnnualEconomy(new SeededRandom(i * 2654435761));
      seen.add(o.kind);
      if (o.kind === 'steady') {
        expect(o.wealthDelta).toBe(0);
        expect(o.summary).toBe('');
      } else {
        expect(o.summary.length).toBeGreaterThan(0);
      }
      // good outcomes raise wealth, bad ones lower it
      if (o.kind === 'good_year' || o.kind === 'boom') expect(o.wealthDelta).toBeGreaterThan(0);
      if (o.kind === 'lean_year' || o.kind === 'levy') expect(o.wealthDelta).toBeLessThan(0);
    }
    for (const k of ['good_year', 'lean_year', 'levy', 'boom', 'steady']) {
      expect(seen.has(k)).toBe(true);
    }
  });
});
