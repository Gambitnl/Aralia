/**
 * This file proves the Circle of the Land land choice, Land's Aid, and Natural
 * Recovery transactions.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import type { SpellSlots } from '../../../types/character';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  applyLandChoice,
  LANDS_AID_ABILITY_ID,
  recoverSpellSlot,
  resolveLandsAid,
} from '../circleOfTheLandUtils';

function createLandDruid(wildShapeUses = 2): CombatCharacter {
  return createMockCombatCharacter({
    id: 'land-druid',
    name: 'Land Druid',
    team: 'player',
    limitedUses: {
      wild_shape: { name: 'Wild Shape', current: wildShapeUses, max: 2, resetOn: 'short_rest' },
    },
    abilities: [{
      id: LANDS_AID_ABILITY_ID,
      name: "Land's Aid",
      description: 'Expend a Wild Shape use to heal an ally and damage a foe.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'single_ally',
      range: 12,
      effects: [],
    }],
  });
}

describe('applyLandChoice', () => {
  it('merges the chosen land circle spells and rejects unknown lands', () => {
    const result = applyLandChoice('forest', ['entangle']);
    expect(result.rejected).toBeUndefined();
    expect(result.preparedSpells).toEqual(expect.arrayContaining(['entangle', 'barkskin', 'spike_growth']));

    expect(applyLandChoice('atlantis', ['entangle']).rejected).toBe(true);
  });
});

describe('resolveLandsAid', () => {
  it('expends a Wild Shape use and applies the same surge as healing and damage', () => {
    const druid = createLandDruid();
    const ally = createMockCombatCharacter({ id: 'ally', name: 'Ally', currentHP: 10, maxHP: 40 });
    const foe = createMockCombatCharacter({ id: 'foe', name: 'Foe', currentHP: 30, maxHP: 30 });
    const state = createMockCombatState({ characters: [druid, ally, foe] });

    const result = resolveLandsAid(state, {
      casterId: 'land-druid',
      allyId: 'ally',
      foeId: 'foe',
      wisdomMod: 3,
      rng: () => 0.5, // 1d8 → 5, +3 = 8
    });

    expect(result.resolved).toBe(true);
    expect(result.healingApplied).toBe(8);
    expect(result.damageApplied).toBe(8);
    expect(result.remainingWildShapeUses).toBe(1);

    expect(result.state.characters.find(c => c.id === 'ally')?.currentHP).toBe(18);
    expect(result.state.characters.find(c => c.id === 'foe')?.currentHP).toBe(22);
  });

  it('caps healing at max HP and refuses without Wild Shape uses', () => {
    const druid = createLandDruid(0);
    const ally = createMockCombatCharacter({ id: 'ally', name: 'Ally', currentHP: 10, maxHP: 40 });
    const foe = createMockCombatCharacter({ id: 'foe', name: 'Foe', currentHP: 30, maxHP: 30 });
    const state = createMockCombatState({ characters: [druid, ally, foe] });

    const result = resolveLandsAid(state, {
      casterId: 'land-druid', allyId: 'ally', foeId: 'foe', wisdomMod: 3,
    });

    expect(result.resolved).toBe(false);
    expect(result.failure).toBe('no_wild_shape_uses');
  });

  it('rejects a caster without the feature', () => {
    const druid = { ...createLandDruid(), abilities: [] };
    const state = createMockCombatState({ characters: [druid] });

    const result = resolveLandsAid(state, {
      casterId: 'land-druid', allyId: 'ally', foeId: 'foe', wisdomMod: 3,
    });

    expect(result.failure).toBe('not_circle_of_the_land');
  });
});

function fullSlots(overrides: Partial<SpellSlots>): SpellSlots {
  const base: SpellSlots = {
    level_1: { current: 0, max: 0 },
    level_2: { current: 0, max: 0 },
    level_3: { current: 0, max: 0 },
    level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 },
    level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 },
    level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 },
  };
  return { ...base, ...overrides };
}

describe('recoverSpellSlot', () => {
  it('restores one spent slot up to its maximum', () => {
    const druid = createMockCombatCharacter({
      id: 'land-druid',
      name: 'Land Druid',
      spellSlots: fullSlots({
        level_1: { current: 1, max: 4 },
        level_2: { current: 0, max: 2 },
      }),
    });

    const recovered = recoverSpellSlot(druid, 2);

    expect(recovered.spellSlots?.level_2.current).toBe(1);
    expect(recovered.spellSlots?.level_1.current).toBe(1);
  });

  it('leaves an already-full slot unchanged', () => {
    const druid = createMockCombatCharacter({
      id: 'land-druid',
      name: 'Land Druid',
      spellSlots: fullSlots({ level_2: { current: 2, max: 2 } }),
    });

    expect(recoverSpellSlot(druid, 2)).toBe(druid);
  });
});
