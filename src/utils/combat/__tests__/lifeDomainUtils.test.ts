/**
 * This file proves the Life Domain Disciple of Life healing bonus and the
 * always-prepared domain-spell merge.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  applyDiscipleOfLifeHealing,
  calculateDiscipleOfLifeBonus,
  DISCIPLE_OF_LIFE_ABILITY_ID,
  isLifeDomainCaster,
  mergeLifeDomainPreparedSpells,
} from '../lifeDomainUtils';

function createCleric(lifeDomain: boolean): CombatCharacter {
  return createMockCombatCharacter({
    id: 'cleric',
    name: 'Cleric',
    team: 'player',
    abilities: lifeDomain
      ? [{
        id: DISCIPLE_OF_LIFE_ABILITY_ID,
        name: 'Disciple of Life',
        description: 'Healing spells restore 2 + spell level additional HP.',
        type: 'utility',
        cost: { type: 'free' },
        targeting: 'self',
        range: 0,
        effects: [],
      }]
      : [],
  });
}

describe('isLifeDomainCaster', () => {
  it('keys the subclass identity to the disciple_of_life ability', () => {
    expect(isLifeDomainCaster(createCleric(true))).toBe(true);
    expect(isLifeDomainCaster(createCleric(false))).toBe(false);
  });
});

describe('calculateDiscipleOfLifeBonus', () => {
  it('returns 2 + spell level', () => {
    expect(calculateDiscipleOfLifeBonus(1)).toBe(3);
    expect(calculateDiscipleOfLifeBonus(3)).toBe(5);
  });
});

describe('applyDiscipleOfLifeHealing', () => {
  it('adds the bonus only for a Life Domain caster using a leveled spell', () => {
    const lifeCleric = createCleric(true);
    const otherCleric = createCleric(false);

    // Cure Wounds at 1st level: rolled 8 + (2 + 1) = 11.
    expect(applyDiscipleOfLifeHealing(lifeCleric, 8, 1)).toBe(11);
    // A non-Life cleric heals the rolled total unchanged.
    expect(applyDiscipleOfLifeHealing(otherCleric, 8, 1)).toBe(8);
  });

  it('does not apply the bonus to cantrips or zero-level healing', () => {
    const lifeCleric = createCleric(true);
    expect(applyDiscipleOfLifeHealing(lifeCleric, 5, 0)).toBe(5);
  });
});

describe('mergeLifeDomainPreparedSpells', () => {
  it('merges the always-prepared domain spells without duplicating', () => {
    const result = mergeLifeDomainPreparedSpells(['bless', 'guidance']);

    expect(result).toEqual(expect.arrayContaining(['bless', 'cure_wounds', 'revivify']));
    expect(result.filter(id => id === 'bless')).toHaveLength(1);
  });
});
