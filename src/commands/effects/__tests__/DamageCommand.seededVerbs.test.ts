/**
 * This file pins the damage log's flavor verb to a seeded source.
 *
 * The verb used to come from `Math.random`, which made a combat log
 * unreproducible. These tests prove the same combat seed and log index always
 * produce the same verb, that a later log index is free to produce a different
 * one, and that an injected RNG overrides the seeded draw.
 *
 * @file src/commands/effects/__tests__/DamageCommand.seededVerbs.test.ts
 */

import { describe, it, expect } from 'vitest';
import { selectDamageVerb } from '../DamageCommand';

const VERBS = ['slashes', 'cleaves', 'cuts', 'slices'];

describe('selectDamageVerb', () => {
  it('returns the same verb for the same seed and log index', () => {
    const first = selectDamageVerb(VERBS, 12345, 7);
    const second = selectDamageVerb(VERBS, 12345, 7);
    expect(second).toBe(first);
    expect(VERBS).toContain(first);
  });

  it('returns the same verb on a repeated sweep of seeds and indices', () => {
    const sweep = () => {
      const picked: string[] = [];
      for (let seed = 0; seed < 20; seed++) {
        for (let index = 0; index < 20; index++) {
          picked.push(selectDamageVerb(VERBS, seed, index));
        }
      }
      return picked;
    };
    expect(sweep()).toEqual(sweep());
  });

  it('varies the verb across log indices within one combat', () => {
    const picked = new Set<string>();
    for (let index = 0; index < 40; index++) {
      picked.add(selectDamageVerb(VERBS, 9876, index));
    }
    // A seeded stream must still give the log variety, not one verb forever.
    expect(picked.size).toBeGreaterThan(1);
  });

  it('varies the verb across combats at the same log index', () => {
    const picked = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      picked.add(selectDamageVerb(VERBS, seed, 0));
    }
    expect(picked.size).toBeGreaterThan(1);
  });

  it('draws from the injected RNG when the caller supplies one', () => {
    expect(selectDamageVerb(VERBS, 12345, 7, () => 0)).toBe('slashes');
    expect(selectDamageVerb(VERBS, 12345, 7, () => 0.5)).toBe('cuts');
    expect(selectDamageVerb(VERBS, 12345, 7, () => 0.999999)).toBe('slices');
  });

  it('stays inside the verb list for an RNG that returns its upper bound', () => {
    expect(selectDamageVerb(VERBS, 1, 1, () => 1)).toBe('slices');
  });

  it('keeps a clock-sized combat seed deterministic', () => {
    const clockSeed = 1758412800000;
    expect(selectDamageVerb(VERBS, clockSeed, 3)).toBe(selectDamageVerb(VERBS, clockSeed, 3));
    expect(VERBS).toContain(selectDamageVerb(VERBS, clockSeed, 3));
  });
});
