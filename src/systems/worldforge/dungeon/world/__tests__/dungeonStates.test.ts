/**
 * @file dungeonStates.test.ts — Pillar 2, Task 8 (living ecology): the selector
 * that joins enumerated sites with the party's cleared set into the danger
 * field's `dungeonSites` input.
 */
import { describe, expect, it } from 'vitest';
import { enumerateDungeonSites } from '../dungeonSites';
import { dungeonStatesForWorld } from '../dungeonStates';

const SEED = 7;
const sites = enumerateDungeonSites(SEED);

describe('dungeonStatesForWorld — Pillar 2 Task 8', () => {
  it('has one entry per site, all uncleared by default', () => {
    const states = dungeonStatesForWorld(SEED);
    expect(states.length).toBe(sites.length);
    expect(states.every((s) => s.cleared === false)).toBe(true);
    // Cell ids line up with enumeration order.
    expect(states.map((s) => s.cellId)).toEqual(sites.map((s) => s.cellId));
  });

  it('flips the cleared flag for site paths in the cleared set', () => {
    const target = sites[0];
    const states = dungeonStatesForWorld(SEED, new Set([target.sitePath]));
    const clearedCount = states.filter((s) => s.cleared).length;
    expect(clearedCount).toBe(1);
    // The flipped entry is the one at the target's cell.
    expect(states.find((s) => s.cellId === target.cellId)?.cleared).toBe(true);
  });

  it('accepts an array as well as a Set, and is deterministic', () => {
    const a = dungeonStatesForWorld(SEED, [sites[0].sitePath]);
    const b = dungeonStatesForWorld(SEED, new Set([sites[0].sitePath]));
    expect(a).toEqual(b);
  });
});
