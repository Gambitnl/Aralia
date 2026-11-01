/**
 * npcPersonality exports that npcPersonality.test.ts does not call directly
 * (C14, agora-9ed9.14): clampTrait, generatePersonality as a public entry,
 * and the empty cases of describePersonality.
 *
 * Exercises: src/systems/npcPersonality/index.ts, types.ts, personalityEffects.ts
 */
import { describe, it, expect } from 'vitest';
import {
  ARCHETYPES,
  DEFAULT_ARCHETYPE,
  MAX_QUIRKS,
  MIN_QUIRKS,
  TRAIT_KEYS,
  TRAIT_MAX,
  TRAIT_MIN,
  clampTrait,
  describePersonality,
  generatePersonality,
  resolveArchetype,
} from '../index';

describe('clampTrait', () => {
  it('keeps in-range values and clamps both ends of the 0-10 scale', () => {
    expect(clampTrait(5)).toBe(5);
    expect(clampTrait(TRAIT_MIN)).toBe(TRAIT_MIN);
    expect(clampTrait(TRAIT_MAX)).toBe(TRAIT_MAX);
    expect(clampTrait(-3)).toBe(TRAIT_MIN);
    expect(clampTrait(14)).toBe(TRAIT_MAX);
  });
});

describe('generatePersonality', () => {
  it('answers with no input at all, using the table default', () => {
    const personality = generatePersonality();
    expect(personality.archetype).toBe(resolveArchetype({}));
    expect(personality.archetype).toBe(DEFAULT_ARCHETYPE);
    expect(personality.quirks.length).toBeGreaterThanOrEqual(MIN_QUIRKS);
    expect(personality.quirks.length).toBeLessThanOrEqual(MAX_QUIRKS);
    for (const key of TRAIT_KEYS) {
      expect(personality.traits[key]).toBeGreaterThanOrEqual(TRAIT_MIN);
      expect(personality.traits[key]).toBeLessThanOrEqual(TRAIT_MAX);
    }
  });

  it('lets an authored archetype skip the table for every archetype', () => {
    for (const archetype of ARCHETYPES) {
      const personality = generatePersonality({ archetype, role: 'guard', biomeId: 'desert' });
      expect(personality.archetype).toBe(archetype);
    }
  });

  it('matches the table when no archetype is forced', () => {
    const input = { role: 'merchant', occupation: 'Blacksmith', biomeId: 'temperate_forest' };
    expect(generatePersonality(input).archetype).toBe(resolveArchetype(input));
  });

  it('rebuilds the identical personality for the same seed and identity', () => {
    const input = { role: 'guard', worldSeed: 1234, identity: 'npc-guard-7' };
    expect(generatePersonality(input)).toEqual(generatePersonality(input));
  });
});

describe('describePersonality', () => {
  it('returns an empty string for a missing personality, so callers can append it', () => {
    expect(describePersonality(undefined)).toBe('');
    expect(describePersonality(null)).toBe('');
  });

  it('omits the habits sentence when there are no quirks', () => {
    const base = generatePersonality({ archetype: 'friendly', worldSeed: 1, identity: 'x' });
    const text = describePersonality({ ...base, quirks: [] });
    expect(text).toMatch(/^You come across as friendly, and you speak .+\.$/);
    expect(text).not.toContain('Your habits');
  });
});
