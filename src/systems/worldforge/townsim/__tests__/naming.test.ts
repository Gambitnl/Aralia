import { SeededRandom } from '../../../../utils/random/seededRandom';
import { newbornName } from '../naming';

describe('newbornName', () => {
  it('is deterministic for the same seed + inputs', () => {
    const a = newbornName(new SeededRandom(42), 'Human', 'Bryn Stone');
    const b = newbornName(new SeededRandom(42), 'Human', 'Bryn Stone');
    expect(a).toBe(b);
  });

  it('inherits the family surname from the parent', () => {
    for (let s = 1; s <= 20; s++) {
      const name = newbornName(new SeededRandom(s * 7919), 'Human', 'Bryn Stone');
      expect(name.endsWith(' Stone')).toBe(true);
      expect(name.split(' ').length).toBe(2);
    }
  });

  it('gives a fresh surname when the parent has no surname', () => {
    const name = newbornName(new SeededRandom(5), 'Dwarf', 'Adrik');
    expect(name.split(/\s+/).length).toBe(2); // given + a generated surname
    expect(name.startsWith('Adrik')).toBe(false); // not just echoing the parent
  });

  it('falls back to human pool for an unknown race without throwing', () => {
    const name = newbornName(new SeededRandom(3), 'Nonsense', 'Mara Crane');
    expect(name.endsWith(' Crane')).toBe(true);
    expect(name.length).toBeGreaterThan(' Crane'.length);
  });

  it('uses race-appropriate given names (dwarf names differ from a tiny generic pool)', () => {
    // Sample many dwarf newborns; their given names should come from the dwarf set.
    const dwarfGiven = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      dwarfGiven.add(newbornName(new SeededRandom(s * 104729), 'Dwarf', 'X Ironfist').split(' ')[0]);
    }
    // At least some recognizably-dwarven given names appear.
    expect([...dwarfGiven].some((g) => ['Adrik', 'Baern', 'Dain', 'Diesa', 'Eldeth', 'Helja', 'Vistra'].includes(g))).toBe(true);
  });
});
