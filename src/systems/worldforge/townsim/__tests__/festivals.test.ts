import {
  festivalsOnDayOfYear,
  foundingDayOfYear,
  patronFeastDayOfYear,
  patronDeityName,
  SEASONAL_FESTIVALS,
} from '../festivals';
import { DAYS_PER_YEAR } from '../constants';

describe('festivalsOnDayOfYear', () => {
  it('returns each shared seasonal festival on its own day-of-year', () => {
    for (const f of SEASONAL_FESTIVALS) {
      expect(festivalsOnDayOfYear(f.dayOfYear, 1)).toContain(f.name);
    }
  });

  it('returns the burg Founding Day and a deity-named Patron Feast on their derived days', () => {
    const burgId = 7;
    expect(festivalsOnDayOfYear(foundingDayOfYear(burgId), burgId)).toContain("the town's Founding Day");
    expect(festivalsOnDayOfYear(patronFeastDayOfYear(burgId), burgId)).toContain(`the Feast of ${patronDeityName(burgId)}`);
  });

  it('patron deity is a real, deterministic pantheon name', () => {
    expect(patronDeityName(7)).toBe(patronDeityName(7)); // deterministic
    expect(patronDeityName(7).length).toBeGreaterThan(0);
    // different burgs can honour different gods
    const gods = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(patronDeityName));
    expect(gods.size).toBeGreaterThan(1);
  });

  it('returns [] on an ordinary day with no festival', () => {
    const burgId = 1;
    const taken = new Set<number>([
      ...SEASONAL_FESTIVALS.map((f) => f.dayOfYear),
      foundingDayOfYear(burgId),
      patronFeastDayOfYear(burgId),
    ]);
    const free = [...Array(DAYS_PER_YEAR).keys()].find((d) => !taken.has(d));
    expect(free).toBeDefined();
    expect(festivalsOnDayOfYear(free!, burgId)).toEqual([]);
  });
});

describe('foundingDayOfYear / patronFeastDayOfYear determinism', () => {
  it('is deterministic and in [0, DAYS_PER_YEAR)', () => {
    for (const burgId of [0, 1, 2, 42, 1337]) {
      const a = foundingDayOfYear(burgId);
      const b = patronFeastDayOfYear(burgId);
      expect(a).toBe(foundingDayOfYear(burgId));
      expect(b).toBe(patronFeastDayOfYear(burgId));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(DAYS_PER_YEAR);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(DAYS_PER_YEAR);
    }
  });

  it('founding differs from patron feast for at least some burgs', () => {
    const burgs = [...Array(50).keys()];
    const someDiffer = burgs.some((id) => foundingDayOfYear(id) !== patronFeastDayOfYear(id));
    expect(someDiffer).toBe(true);
  });
});
