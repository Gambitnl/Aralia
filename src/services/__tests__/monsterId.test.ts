import { describe, it, expect, beforeAll } from 'vitest';
import type { Monster } from '../../types';
import { getFallbackEncounterWithSeed } from '../geminiServiceFallback';
import { loadMonstersData, MONSTERS_DATA } from '../../data/monsters';

/**
 * `Monster.id` is the optional bestiary key on an encounter entry (agora-0df3).
 * Before it existed, lootService reached for it through a
 * `(monster as { id?: string })` cast and no producer ever set it, so the field
 * was unreachable by design. These tests pin both halves: the type carries the
 * field, and the fallback encounter builder fills it from the bestiary entry it
 * picked.
 */
describe('Monster.id', () => {
  // The generated bestiary module is large; loading it once outside the per-test
  // timeout matches how geminiServiceFallback.test.ts primes MONSTERS_DATA.
  beforeAll(async () => {
    await loadMonstersData();
  }, 60_000);

  it('is optional, so a name-only encounter entry is still a valid Monster', () => {
    const nameOnly: Monster = {
      name: 'Ambush Bandit',
      quantity: 2,
      cr: '1/8',
      description: 'An AI-authored encounter entry with no bestiary key.',
    };

    expect(nameOnly.id).toBeUndefined();
  });

  it('accepts a bestiary key without a cast', () => {
    const fromBestiary: Monster = {
      id: 'goblin_boss',
      name: 'Goblin Boss',
      quantity: 1,
      cr: '1',
      description: 'A bestiary-backed encounter entry.',
    };

    expect(fromBestiary.id).toBe('goblin_boss');
  });

  it('is populated by the fallback encounter builder from the chosen bestiary entry', async () => {
    const byId = new Map(Object.values(MONSTERS_DATA).map(m => [m.id, m]));

    const encounter = getFallbackEncounterWithSeed(500, ['humanoid'], 20260920);

    expect(encounter.length).toBeGreaterThan(0);
    for (const entry of encounter) {
      expect(entry.id).toBeDefined();
      // The id must resolve back to the bestiary entry the name came from.
      expect(byId.get(entry.id as string)?.name).toBe(entry.name);
    }
  });
});
