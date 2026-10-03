/**
 * This file proves the College of Lore Cutting Words reaction/resource
 * transaction and the three-skill Bonus Proficiencies state path.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  applyLoreBonusProficiencies,
  canUseCuttingWords,
  CUTTING_WORDS_ABILITY_ID,
  resolveCuttingWords,
} from '../collegeOfLoreUtils';

function createLoreBard(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'lore-bard',
    name: 'Lore Bard',
    team: 'player',
    limitedUses: {
      bardic_inspiration: { name: 'Bardic Inspiration', current: 3, max: 3, resetOn: 'long_rest' },
    },
    abilities: [
      {
        id: CUTTING_WORDS_ABILITY_ID,
        name: 'Cutting Words',
        description: 'Spend a Reaction and a Bardic Inspiration die to subtract from an enemy roll.',
        type: 'utility',
        cost: { type: 'reaction' },
        targeting: 'single_enemy',
        range: 12,
        effects: [],
      },
    ],
  });
}

describe('canUseCuttingWords', () => {
  it('requires the feature, an unspent reaction, and a remaining inspiration die', () => {
    expect(canUseCuttingWords(createLoreBard())).toBe(true);

    const noFeature = { ...createLoreBard(), abilities: [] };
    expect(canUseCuttingWords(noFeature)).toBe(false);

    const spentReaction = {
      ...createLoreBard(),
      actionEconomy: {
        ...createLoreBard().actionEconomy,
        reaction: { ...createLoreBard().actionEconomy.reaction, used: true },
      },
    };
    expect(canUseCuttingWords(spentReaction)).toBe(false);

    const noDice = {
      ...createLoreBard(),
      limitedUses: { bardic_inspiration: { name: 'Bardic Inspiration', current: 0, max: 3, resetOn: 'long_rest' as const } },
    };
    expect(canUseCuttingWords(noDice)).toBe(false);
  });
});

describe('resolveCuttingWords', () => {
  it('spends a reaction and a die, and subtracts the deterministic d6 from the roll', () => {
    const bard = createLoreBard();
    const state = createMockCombatState({ characters: [bard] });

    const result = resolveCuttingWords(state, {
      bardId: 'lore-bard',
      rollType: 'attack',
      rollValue: 17,
      rng: () => 0.5, // d6 → 4
    });

    expect(result.resolved).toBe(true);
    expect(result.dieRolled).toBe(4);
    expect(result.subtractedValue).toBe(4);
    expect(result.newRollValue).toBe(13);

    const updated = result.state.characters.find(character => character.id === 'lore-bard');
    expect(updated?.actionEconomy.reaction.used).toBe(true);
    expect(updated?.limitedUses?.bardic_inspiration.current).toBe(2);
  });

  it('rejects when the reaction is already spent without debiting the resource', () => {
    const bard = {
      ...createLoreBard(),
      actionEconomy: {
        ...createLoreBard().actionEconomy,
        reaction: { ...createLoreBard().actionEconomy.reaction, used: true },
      },
    };
    const state = createMockCombatState({ characters: [bard] });

    const result = resolveCuttingWords(state, { bardId: 'lore-bard', rollType: 'damage', rollValue: 20 });

    expect(result.resolved).toBe(false);
    expect(result.failure).toBe('reaction_unavailable');
    expect(result.state).toBe(state);
    expect(bard.limitedUses?.bardic_inspiration.current).toBe(3);
  });

  it('rejects a bard without the feature and an exhausted pool', () => {
    const noFeature = createMockCombatState({
      characters: [{ ...createLoreBard(), abilities: [] }],
    });
    expect(resolveCuttingWords(noFeature, {
      bardId: 'lore-bard', rollType: 'check', rollValue: 10,
    }).failure).toBe('not_college_of_lore');

    const exhausted = createMockCombatState({
      characters: [{
        ...createLoreBard(),
        limitedUses: { bardic_inspiration: { name: 'Bardic Inspiration', current: 0, max: 3, resetOn: 'long_rest' as const } },
      }],
    });
    expect(resolveCuttingWords(exhausted, {
      bardId: 'lore-bard', rollType: 'attack', rollValue: 10,
    }).failure).toBe('no_bardic_inspiration');
  });
});

describe('applyLoreBonusProficiencies', () => {
  it('merges up to three chosen skills and reports unknown ids', () => {
    const result = applyLoreBonusProficiencies([], ['arcana', 'history', 'investigation']);

    expect(result.applied).toEqual(['arcana', 'history', 'investigation']);
    expect(result.rejected).toEqual([]);
    expect(result.skills.map(skill => skill.id)).toEqual(['arcana', 'history', 'investigation']);
  });

  it('dedupes existing skills and rejects unknown ids', () => {
    const existing = [{ id: 'arcana', name: 'Arcana', ability: 'Intelligence' }];
    const result = applyLoreBonusProficiencies(existing as any, ['arcana', 'history', 'not_a_skill', 'perception']);

    expect(result.applied).toEqual(['arcana', 'history', 'perception']);
    expect(result.rejected).toEqual(['not_a_skill']);
    expect(result.skills.map(skill => skill.id)).toEqual(['arcana', 'history', 'perception']);
  });
});
