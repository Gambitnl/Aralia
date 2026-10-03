/**
 * This file proves the Light Domain Warding Flare reaction/resource transaction
 * and the always-prepared domain-spell merge.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  canUseWardingFlare,
  getWardingFlareUses,
  mergeLightDomainPreparedSpells,
  resolveWardingFlare,
  WARDING_FLARE_ABILITY_ID,
} from '../lightDomainUtils';

function createLightCleric(uses = 2): CombatCharacter {
  return createMockCombatCharacter({
    id: 'light-cleric',
    name: 'Light Cleric',
    team: 'player',
    limitedUses: {
      warding_flare: { name: 'Warding Flare', current: uses, max: 3, resetOn: 'long_rest' },
    },
    abilities: [{
      id: WARDING_FLARE_ABILITY_ID,
      name: 'Warding Flare',
      description: 'Use your Reaction to impose Disadvantage on an attack.',
      type: 'utility',
      cost: { type: 'reaction' },
      targeting: 'self',
      range: 6,
      effects: [],
    }],
  });
}

describe('canUseWardingFlare', () => {
  it('requires the feature, an unspent reaction, and remaining uses', () => {
    expect(canUseWardingFlare(createLightCleric())).toBe(true);
    expect(canUseWardingFlare(createLightCleric(0))).toBe(false);

    const noFeature = { ...createLightCleric(), abilities: [] };
    expect(canUseWardingFlare(noFeature)).toBe(false);
  });
});

describe('resolveWardingFlare', () => {
  it('spends a reaction and a use and applies disadvantage', () => {
    const cleric = createLightCleric();
    const state = createMockCombatState({ characters: [cleric] });

    const result = resolveWardingFlare(state, { casterId: 'light-cleric', attackerId: 'goblin' });

    expect(result.resolved).toBe(true);
    expect(result.disadvantageApplied).toBe(true);
    expect(result.remainingUses).toBe(1);

    const updated = result.state.characters.find(character => character.id === 'light-cleric');
    expect(updated?.actionEconomy.reaction.used).toBe(true);
    expect(getWardingFlareUses(updated!)).toBe(1);
  });

  it('rejects when the reaction is already spent without debiting uses', () => {
    const cleric = {
      ...createLightCleric(),
      actionEconomy: {
        ...createLightCleric().actionEconomy,
        reaction: { ...createLightCleric().actionEconomy.reaction, used: true },
      },
    };
    const state = createMockCombatState({ characters: [cleric] });

    const result = resolveWardingFlare(state, { casterId: 'light-cleric', attackerId: 'goblin' });

    expect(result.resolved).toBe(false);
    expect(result.failure).toBe('reaction_unavailable');
    expect(getWardingFlareUses(cleric)).toBe(2);
  });

  it('rejects an exhausted pool and a non-Light caster', () => {
    const exhausted = createMockCombatState({
      characters: [createLightCleric(0)],
    });
    expect(resolveWardingFlare(exhausted, {
      casterId: 'light-cleric', attackerId: 'goblin',
    }).failure).toBe('no_warding_flare_uses');

    const noFeature = createMockCombatState({
      characters: [{ ...createLightCleric(), abilities: [] }],
    });
    expect(resolveWardingFlare(noFeature, {
      casterId: 'light-cleric', attackerId: 'goblin',
    }).failure).toBe('not_light_domain');
  });
});

describe('mergeLightDomainPreparedSpells', () => {
  it('merges always-prepared spells without duplicating', () => {
    const result = mergeLightDomainPreparedSpells(['faerie_fire', 'guidance']);

    expect(result).toEqual(expect.arrayContaining(['faerie_fire', 'burning_hands', 'daylight']));
    expect(result.filter(id => id === 'faerie_fire')).toHaveLength(1);
  });
});
