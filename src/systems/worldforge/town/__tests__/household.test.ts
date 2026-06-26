import { describe, it, expect } from 'vitest';
import { generateHousehold } from '../household';
import { rootSeedPath } from '../../seedPath';

const seed = rootSeedPath(99);

describe('household — lazy named family', () => {
  it('names exactly the resident count', () => {
    const h = generateHousehold(seed, 'b12', 5, 'cottage');
    expect(h.members).toHaveLength(5);
    expect(h.members.every((m) => m.name.length > 0)).toBe(true);
  });

  it('is deterministic per (seed, homeId)', () => {
    const a = generateHousehold(seed, 'b7', 4, 'townhouse');
    const b = generateHousehold(seed, 'b7', 4, 'townhouse');
    expect(a).toEqual(b);
  });

  it('different homeIds yield different families', () => {
    const a = generateHousehold(seed, 'b1', 4, 'cottage');
    const b = generateHousehold(seed, 'b2', 4, 'cottage');
    expect(a.surname === b.surname && a.members[0].name === b.members[0].name).toBe(false);
  });

  it('a lone occupant lives alone', () => {
    const h = generateHousehold(seed, 'b3', 1, 'cottage');
    expect(h.members).toHaveLength(1);
    expect(h.summary).toMatch(/alone/);
  });

  it('children are aged below adults', () => {
    const h = generateHousehold(seed, 'b20', 5, 'cottage');
    const kids = h.members.filter((m) => m.ageBand === 'child');
    const adults = h.members.filter((m) => m.ageBand !== 'child');
    if (kids.length && adults.length) {
      expect(Math.max(...kids.map((k) => k.age))).toBeLessThan(Math.max(...adults.map((a) => a.age)) + 1);
    }
  });
});
