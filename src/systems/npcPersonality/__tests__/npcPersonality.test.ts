/**
 * @file src/systems/npcPersonality/__tests__/npcPersonality.test.ts
 * Proof for board task agora-d9e1 (NPC Personality System).
 *
 * Covers the four acceptance areas: archetype assignment from the role x biome
 * table, quirk generation, the disposition/aggression/tone effects, and the
 * generateNPC wiring. Determinism is asserted explicitly, because the whole
 * point of seeding on world seed + identity is that a reloaded save reads the same.
 */

import { describe, it, expect } from 'vitest';

import {
  ARCHETYPES,
  ARCHETYPE_BASE_TRAITS,
  ARCHETYPE_TABLE,
  ARCHETYPE_TABLE_COMBINATIONS,
  ARCHETYPE_TONES,
  DEFAULT_TONE,
  MAX_QUIRKS,
  MIN_QUIRKS,
  QUIRK_POOLS,
  TRAIT_JITTER,
  TRAIT_KEYS,
  combatAggression,
  composeCombatAggression,
  describePersonality,
  dialogueTone,
  dispositionModifier,
  applyDispositionModifier,
  fleeHealthThreshold,
  generatePersonality,
  generateQuirks,
  generateTraits,
  normalizePersonalityBiome,
  normalizePersonalityRole,
  resolveArchetype,
} from '../index.js';
import type { NPCPersonality } from '../index.js';
import { generateNPC } from '../../../services/npcGenerator.js';

/** Builds a personality with exact traits, for effect assertions that must not jitter. */
const fixed = (archetype: NPCPersonality['archetype']): NPCPersonality => ({
  archetype,
  quirks: [],
  traits: { ...ARCHETYPE_BASE_TRAITS[archetype] },
});

describe('archetype table (agora-d9e1)', () => {
  it('covers at least 20 distinct role/biome combinations', () => {
    expect(ARCHETYPE_TABLE_COMBINATIONS.length).toBeGreaterThanOrEqual(20);
    // No duplicate rows: a duplicate would make the resolver's answer depend on
    // array order, which the file's docs promise it does not.
    expect(new Set(ARCHETYPE_TABLE_COMBINATIONS).size).toBe(ARCHETYPE_TABLE_COMBINATIONS.length);
    for (const rule of ARCHETYPE_TABLE) {
      expect(ARCHETYPES).toContain(rule.archetype);
    }
  });

  it('assigns the archetypes named in the task spec', () => {
    expect(resolveArchetype({ role: 'guard', biomeId: 'forest' })).toBe('gruff');
    expect(resolveArchetype({ role: 'merchant', biomeId: 'city' })).toBe('greedy');
    expect(resolveArchetype({ role: 'civilian', occupation: 'Priest', biomeId: 'tundra' })).toBe('pious');
    expect(resolveArchetype({ role: 'civilian', occupation: 'Priest' })).toBe('pious');
  });

  it('lets a specific occupation outrank the functional role', () => {
    // Same functional role, different trade -> different person.
    expect(resolveArchetype({ role: 'civilian', occupation: 'Temple Acolyte', biomeId: 'city' })).toBe('pious');
    expect(resolveArchetype({ role: 'civilian', biomeId: 'city' })).toBe('suspicious');
  });

  it('normalizes free-form biome and role tags', () => {
    expect(normalizePersonalityBiome('boreal_forest_01')).toBe('forest');
    expect(normalizePersonalityBiome('harbour_district')).toBe('city'); // settlement beats terrain
    expect(normalizePersonalityBiome('deep_ocean_shelf')).toBe('coastal'); // open water is not a cave
    expect(normalizePersonalityBiome('mine_tunnel_lvl3')).toBe('underdark');
    expect(normalizePersonalityBiome(undefined)).toBe('any');
    expect(normalizePersonalityRole('merchant', 'Weaponsmith')).toBe('blacksmith');
    expect(normalizePersonalityRole(undefined, undefined)).toBe('civilian');
  });

  it('always answers, even for an unmapped role in an unmapped biome', () => {
    const archetype = resolveArchetype({ role: 'xyzzy', biomeId: 'nowhere' });
    expect(ARCHETYPES).toContain(archetype);
  });
});

describe('quirk generation (agora-d9e1)', () => {
  it('produces 2-3 distinct quirks drawn from the archetype pool', () => {
    for (const archetype of ARCHETYPES) {
      for (let i = 0; i < 25; i += 1) {
        const quirks = generateQuirks({ archetype, worldSeed: 7, identity: `npc-${i}` });
        expect(quirks.length).toBeGreaterThanOrEqual(MIN_QUIRKS);
        expect(quirks.length).toBeLessThanOrEqual(MAX_QUIRKS);
        expect(new Set(quirks).size).toBe(quirks.length);
        for (const quirk of quirks) {
          expect(QUIRK_POOLS[archetype]).toContain(quirk);
        }
      }
    }
  });

  it('has a distinct pool for every archetype', () => {
    expect(Object.keys(QUIRK_POOLS).sort()).toEqual([...ARCHETYPES].sort());
    const seen = new Set<string>();
    for (const archetype of ARCHETYPES) {
      expect(QUIRK_POOLS[archetype].length).toBeGreaterThanOrEqual(MAX_QUIRKS);
      for (const quirk of QUIRK_POOLS[archetype]) {
        expect(seen.has(quirk)).toBe(false); // no quirk shared between archetypes
        seen.add(quirk);
      }
    }
  });

  it('is deterministic per world seed and identity, and varies between NPCs', () => {
    const a1 = generateQuirks({ archetype: 'greedy', worldSeed: 42, identity: 'npc-a' });
    const a2 = generateQuirks({ archetype: 'greedy', worldSeed: 42, identity: 'npc-a' });
    const b = generateQuirks({ archetype: 'greedy', worldSeed: 42, identity: 'npc-b' });
    expect(a1).toEqual(a2);
    expect(a1).not.toEqual(b);
  });

  it('jitters traits around the archetype baseline without leaving the 0-10 scale', () => {
    for (const archetype of ARCHETYPES) {
      const traits = generateTraits({ archetype, worldSeed: 3, identity: 'trait-npc' });
      for (const key of TRAIT_KEYS) {
        expect(traits[key]).toBeGreaterThanOrEqual(0);
        expect(traits[key]).toBeLessThanOrEqual(10);
        const drift = Math.abs(traits[key] - ARCHETYPE_BASE_TRAITS[archetype][key]);
        expect(drift).toBeLessThanOrEqual(TRAIT_JITTER);
      }
    }
  });
});

describe('disposition modifier (agora-d9e1)', () => {
  it('makes a greedy NPC value a gift less than a friendly one', () => {
    const greedy = dispositionModifier(fixed('greedy'), 'gift');
    const friendly = dispositionModifier(fixed('friendly'), 'gift');
    expect(greedy).toBeLessThan(1);
    expect(greedy).toBeLessThan(friendly);
    expect(friendly).toBeGreaterThan(1);
  });

  it('routes each archetype to what it actually cares about', () => {
    expect(dispositionModifier(fixed('greedy'), 'bribe')).toBeGreaterThan(1);
    expect(dispositionModifier(fixed('pious'), 'bribe')).toBeLessThan(0.5);
    expect(dispositionModifier(fixed('pious'), 'almsgiving')).toBeGreaterThan(1.5);
    expect(dispositionModifier(fixed('gruff'), 'praise')).toBeLessThan(
      dispositionModifier(fixed('gruff'), 'protect')
    );
    expect(dispositionModifier(fixed('naive'), 'betray')).toBeGreaterThan(1);
  });

  it('is a neutral 1 for an NPC with no personality, and scales a real delta', () => {
    expect(dispositionModifier(undefined, 'gift')).toBe(1);
    expect(applyDispositionModifier(undefined, 'gift', 10)).toBe(10);
    // 10 is the matrix's own `gift` dispositionDelta; personality only scales it.
    expect(applyDispositionModifier(fixed('greedy'), 'gift', 10)).toBeLessThan(10);
    expect(applyDispositionModifier(fixed('friendly'), 'gift', 10)).toBeGreaterThan(10);
  });

  it('never zeroes out or inverts a delta', () => {
    for (const archetype of ARCHETYPES) {
      for (const action of ['gift', 'insult', 'bribe', 'kill', 'praise', 'unknown_action']) {
        const modifier = dispositionModifier(fixed(archetype), action);
        expect(modifier).toBeGreaterThan(0);
        expect(modifier).toBeLessThanOrEqual(2.5);
      }
    }
  });
});

describe('combat aggression and morale (agora-d9e1)', () => {
  it('has gruff fighting harder than naive, inside 0-1', () => {
    const gruff = combatAggression(fixed('gruff'));
    const naive = combatAggression(fixed('naive'));
    expect(gruff).toBeGreaterThan(naive);
    for (const archetype of ARCHETYPES) {
      const value = combatAggression(fixed(archetype));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('has naive NPCs fleeing sooner than gruff ones', () => {
    expect(fleeHealthThreshold(fixed('naive'))).toBeGreaterThan(fleeHealthThreshold(fixed('gruff')));
    expect(fleeHealthThreshold(undefined)).toBe(0.25);
  });

  it('composes with the emotional-memory aggression instead of replacing it', () => {
    const friendly = fixed('friendly');
    // No grudge history -> the personality baseline is the answer.
    expect(composeCombatAggression(friendly)).toBe(combatAggression(friendly));
    // A grudge can only ever raise aggression, never dilute a hostile personality.
    const grudged = composeCombatAggression(friendly, { combatAggression: 0.9 });
    expect(grudged).toBeGreaterThanOrEqual(0.9);
    const calm = composeCombatAggression(fixed('gruff'), { combatAggression: 0 });
    expect(calm).toBeGreaterThan(0);
    expect(calm).toBeLessThanOrEqual(combatAggression(fixed('gruff')));
  });
});

describe('dialogue tone (agora-d9e1)', () => {
  it('gives each archetype its own adverb', () => {
    expect(dialogueTone(fixed('suspicious'))).toBe('suspiciously');
    expect(dialogueTone(fixed('friendly'))).toBe('warmly');
    expect(dialogueTone(fixed('gruff'))).toBe('curtly');
    expect(new Set(Object.values(ARCHETYPE_TONES)).size).toBe(ARCHETYPES.length);
  });

  it('lets extreme traits override the archetype default', () => {
    const anxiousScholar: NPCPersonality = {
      archetype: 'scholarly',
      quirks: [],
      traits: { ...ARCHETYPE_BASE_TRAITS.scholarly, neuroticism: 10 },
    };
    expect(dialogueTone(anxiousScholar)).toBe('nervously');
  });

  it('falls back to the neutral tone with no personality', () => {
    expect(dialogueTone(undefined)).toBe(DEFAULT_TONE);
    expect(describePersonality(undefined)).toBe('');
  });

  it('builds a prompt hint carrying tone and quirks', () => {
    const hint = describePersonality(generatePersonality({ role: 'guard', biomeId: 'forest', identity: 'g1' }));
    expect(hint).toContain('gruff');
    expect(hint).toContain('curtly');
    expect(hint).toContain('Your habits:');
  });
});

describe('generateNPC wiring (agora-d9e1)', () => {
  it('gives every generated NPC a complete personality', () => {
    const roles = ['merchant', 'guard', 'civilian', 'quest_giver', 'unique'] as const;
    for (const role of roles) {
      const npc = generateNPC({ role, biomeId: 'city', worldSeed: 11 });
      expect(npc.personality).toBeDefined();
      expect(ARCHETYPES).toContain(npc.personality!.archetype);
      expect(npc.personality!.quirks.length).toBeGreaterThanOrEqual(MIN_QUIRKS);
      expect(npc.personality!.quirks.length).toBeLessThanOrEqual(MAX_QUIRKS);
      for (const key of TRAIT_KEYS) {
        expect(typeof npc.personality!.traits[key]).toBe('number');
      }
      // The personality must reach dialogue, not just the character sheet.
      expect(npc.initialPersonalityPrompt).toContain(npc.personality!.archetype);
    }
  });

  it('picks the archetype from the NPC context, deterministically', () => {
    const guard = generateNPC({ id: 'npc-guard-1', role: 'guard', biomeId: 'deep_forest', worldSeed: 5 });
    const merchant = generateNPC({ id: 'npc-merch-1', role: 'merchant', biomeId: 'walled_city', worldSeed: 5 });
    expect(guard.personality!.archetype).toBe('gruff');
    expect(merchant.personality!.archetype).toBe('greedy');

    // Same id + same world seed -> the same person after a reload, even though the
    // rest of the generator is still time-seeded.
    const guardAgain = generateNPC({ id: 'npc-guard-1', role: 'guard', biomeId: 'deep_forest', worldSeed: 5 });
    expect(guardAgain.personality).toEqual(guard.personality);
  });

  it('leaves NPCs in the same town distinguishable', () => {
    const crowd = Array.from({ length: 12 }, (_, i) =>
      generateNPC({ id: `townsfolk-${i}`, role: 'civilian', biomeId: 'plains', worldSeed: 99 })
    );
    const quirkSets = new Set(crowd.map((npc) => npc.personality!.quirks.join('|')));
    expect(quirkSets.size).toBeGreaterThan(1);
  });
});
