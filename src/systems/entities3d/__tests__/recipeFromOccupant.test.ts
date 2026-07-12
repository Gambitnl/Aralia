/**
 * @file recipeFromOccupant.test.ts — interior villagers map to entity recipes
 * (slice 4): race GROUP → concrete race id (deterministic), age bands scale
 * the frame, commoners carry no gear.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { recipeFromOccupant } from '../recipeFromOccupant';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';

describe('recipeFromOccupant', () => {
  beforeAll(() => registerAllParts());

  it('maps a human adult to an unarmed human commoner', () => {
    const r = recipeFromOccupant({ id: 101, ageBand: 'adult', race: 'Human' });
    expect(r.kind).toBe('humanoid');
    if (r.kind !== 'humanoid') return;
    expect(r.raceId).toBe('human');
    expect(r.gearOverride).toEqual([]);
    const bp = generateEntityBlueprint(r);
    expect(bp.parts.some((p) => p.partId.endsWith('Main'))).toBe(false);
  });

  it('resolves group ancestries to concrete race ids, deterministically per id', () => {
    const a = recipeFromOccupant({ id: 202, ageBand: 'adult', race: 'Greenskins' });
    const b = recipeFromOccupant({ id: 202, ageBand: 'adult', race: 'Greenskins' });
    expect(a).toEqual(b);
    if (a.kind !== 'humanoid') return;
    expect(['orc', 'half_orc', 'hobgoblin', 'goblin']).toContain(a.raceId);
    const elf = recipeFromOccupant({ id: 7, ageBand: 'adult', race: 'Elf' });
    if (elf.kind !== 'humanoid') return;
    expect(elf.raceId).toMatch(/elf/);
  });

  it('different members of one group can get different concrete races', () => {
    const ids = Array.from({ length: 24 }, (_, i) => i * 31 + 5);
    const races = new Set(
      ids.map((id) => {
        const r = recipeFromOccupant({ id, ageBand: 'adult', race: 'Elf' });
        return r.kind === 'humanoid' ? r.raceId : '?';
      }),
    );
    expect(races.size).toBeGreaterThan(1);
  });

  it('children come out visibly smaller than adults of the same seed', () => {
    const adult = generateEntityBlueprint(recipeFromOccupant({ id: 303, ageBand: 'adult', race: 'Human' }));
    const child = generateEntityBlueprint(recipeFromOccupant({ id: 303, ageBand: 'child', race: 'Human' }));
    expect(child.frame.heightFt).toBeLessThan(adult.frame.heightFt * 0.75);
    expect(child.frame.headScale).toBeGreaterThan(adult.frame.headScale);
  });

  it('a missing race renders the commoner default (packets from older bakes)', () => {
    const r = recipeFromOccupant({ id: 404, ageBand: 'adult' });
    if (r.kind !== 'humanoid') return;
    expect(r.raceId).toBe('human');
  });

  it('throws on an unknown ancestry group — no silent shape', () => {
    expect(() => recipeFromOccupant({ id: 9, ageBand: 'adult', race: 'Modrons' })).toThrow(/Modrons/);
  });
});
