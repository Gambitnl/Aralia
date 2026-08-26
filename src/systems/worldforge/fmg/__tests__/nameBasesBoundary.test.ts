// WF-G146 (2026-09-09): the real-world / fantasy boundary of the name bases is
// pinned HERE, next to the data, so tools/agora/seat-names.ts (and any other
// consumer) can read it instead of restating thirty-two culture names.
import { describe, expect, it } from 'vitest';
import { REAL_WORLD_BASE_COUNT, fantasyNameBases, getNameBases, isFantasyBaseIndex } from '../name-bases';

const FANTASY = [
  'Human Generic', 'Elven', 'Dark Elven', 'Dwarven', 'Goblin', 'Orc',
  'Giant', 'Draconic', 'Arachnid', 'Serpents', 'Levantine',
];

describe('name bases: the real-world / fantasy boundary', () => {
  it('declares the boundary the seat namer depends on', () => {
    const all = getNameBases();
    expect(all.length).toBe(REAL_WORLD_BASE_COUNT + FANTASY.length);
    expect(all[REAL_WORLD_BASE_COUNT].name).toBe('Human Generic');
    expect(all[REAL_WORLD_BASE_COUNT - 1].name).not.toBe('Human Generic');
  });

  it('fantasyNameBases() is exactly the eleven Dopu bases, in order, with their original indices', () => {
    const fantasy = fantasyNameBases();
    expect(fantasy.map((b) => b.name)).toEqual(FANTASY);
    fantasy.forEach((base, k) => expect(base.i).toBe(REAL_WORLD_BASE_COUNT + k));
  });

  it('no real-world culture is reachable through the fantasy accessor', () => {
    const realWorld = getNameBases().slice(0, REAL_WORLD_BASE_COUNT).map((b) => b.name);
    expect(realWorld).toHaveLength(32);
    for (const name of realWorld) expect(FANTASY).not.toContain(name);
    expect(isFantasyBaseIndex(REAL_WORLD_BASE_COUNT - 1)).toBe(false);
    expect(isFantasyBaseIndex(REAL_WORLD_BASE_COUNT)).toBe(true);
    expect(isFantasyBaseIndex(getNameBases().length)).toBe(false);
  });
});
