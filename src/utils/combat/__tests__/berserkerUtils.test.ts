/**
 * This file proves the Berserker lifecycle resolver owns Rage state, Frenzy
 * eligibility, the end-of-Rage exhaustion cost, and the incapacity reconciliation
 * that closes a rage the barbarian can no longer sustain.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter, StatusEffect } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  applyExhaustion,
  canUseFrenzy,
  endRage,
  EXHAUSTION_CONDITION_NAME,
  FRENZY_ABILITY_ID,
  isRaging,
  RAGE_STATUS_ID,
  reconcileRageLifecycle,
} from '../berserkerUtils';

const ragingStatus: StatusEffect = {
  id: RAGE_STATUS_ID,
  name: 'Raging',
  type: 'buff',
  duration: 10,
  source: 'Rage',
  effect: { type: 'condition' },
};

function createBerserker(raging: boolean): CombatCharacter {
  return createMockCombatCharacter({
    id: 'berserker',
    name: 'Berserker',
    team: 'player',
    statusEffects: raging ? [ragingStatus] : [],
    abilities: [
      {
        id: FRENZY_ABILITY_ID,
        name: 'Frenzy',
        description: 'While raging, make a melee weapon attack as a bonus action.',
        type: 'attack',
        cost: { type: 'bonus' },
        targeting: 'single_enemy',
        range: 1,
        effects: [{ type: 'damage', value: 0, dice: '1d8', damageType: 'physical' }],
      },
    ],
  });
}

describe('isRaging', () => {
  it('detects the executor-written Rage status on either mirror', () => {
    expect(isRaging(createBerserker(true))).toBe(true);
    expect(isRaging(createBerserker(false))).toBe(false);

    const conditionOnly = {
      ...createBerserker(false),
      conditions: [{ name: 'Raging', duration: { type: 'rounds' as const, value: 10 }, appliedTurn: 0 }],
    };
    expect(isRaging(conditionOnly)).toBe(true);
  });
});

describe('canUseFrenzy', () => {
  it('requires raging, an unspent bonus action, and the frenzy ability', () => {
    expect(canUseFrenzy(createBerserker(true))).toBe(true);
    expect(canUseFrenzy(createBerserker(false))).toBe(false);

    const spentBonus = {
      ...createBerserker(true),
      actionEconomy: {
        ...createBerserker(true).actionEconomy,
        bonusAction: { ...createBerserker(true).actionEconomy.bonusAction, used: true },
      },
    };
    expect(canUseFrenzy(spentBonus)).toBe(false);

    const noAbility = { ...createBerserker(true), abilities: [] };
    expect(canUseFrenzy(noAbility)).toBe(false);
  });
});

describe('endRage and exhaustion', () => {
  it('removes Rage from both mirrors without applying exhaustion by default', () => {
    const raging = {
      ...createBerserker(true),
      conditions: [{ name: 'Raging', duration: { type: 'rounds' as const, value: 10 }, appliedTurn: 0 }],
    };

    const ended = endRage(raging);

    expect(isRaging(ended)).toBe(false);
    expect(ended.statusEffects.some(effect => effect.name === 'Raging')).toBe(false);
    expect(ended.conditions?.some(condition => condition.name === 'Raging')).toBe(false);
    expect(ended.conditions?.some(condition => condition.name === EXHAUSTION_CONDITION_NAME)).toBe(false);
  });

  it('applies Exhaustion when the Berserker rage-end cost is requested', () => {
    const ended = endRage(createBerserker(true), { applyExhaustion: true });

    expect(isRaging(ended)).toBe(false);
    expect(ended.statusEffects.some(effect => effect.name === EXHAUSTION_CONDITION_NAME)).toBe(true);
    expect(ended.conditions?.some(condition => condition.name === EXHAUSTION_CONDITION_NAME)).toBe(true);
  });

  it('applyExhaustion writes both condition mirrors', () => {
    const exhausted = applyExhaustion(createBerserker(false));

    expect(exhausted.statusEffects.some(effect => effect.name === EXHAUSTION_CONDITION_NAME)).toBe(true);
    expect(exhausted.conditions?.some(condition => condition.name === EXHAUSTION_CONDITION_NAME)).toBe(true);
  });
});

describe('reconcileRageLifecycle', () => {
  it('closes the rage and applies exhaustion when an incapacitated Berserker cannot sustain it', () => {
    const incapacitated = {
      ...createBerserker(true),
      conditions: [
        { name: 'Incapacitated', duration: { type: 'rounds' as const, value: 1 }, appliedTurn: 0 },
      ],
    };

    const reconciled = reconcileRageLifecycle(incapacitated, { berserker: true });

    expect(isRaging(reconciled)).toBe(false);
    expect(reconciled.conditions?.some(condition => condition.name === EXHAUSTION_CONDITION_NAME)).toBe(true);
  });

  it('leaves a healthy barbarian raging untouched', () => {
    const raging = createBerserker(true);
    expect(reconcileRageLifecycle(raging, { berserker: true })).toBe(raging);
  });
});
