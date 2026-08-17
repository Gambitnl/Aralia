/**
 * This file proves the Battle Master resource and maneuver resolver changes real
 * combat state. It covers the four-d8 dice pool lifecycle, the maneuver save DC,
 * dice spending, save-gated Prone/Frightened riders, Precision Attack's attack
 * bonus, and the rejections that must never spend a die.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  BATTLE_MASTER_SUPERIORITY_DICE_MAX,
  calculateManeuverSaveDc,
  getSuperiorityDice,
  grantSuperiorityDice,
  resolveBattleMasterManeuver,
  restoreSuperiorityDice,
  spendSuperiorityDie,
} from '../battleMasterUtils';

function createBattleMaster(): CombatCharacter {
  return grantSuperiorityDice(createMockCombatCharacter({
    id: 'battle-master',
    name: 'Battle Master',
    team: 'player',
    level: 3,
    stats: {
      ...createMockCombatCharacter().stats,
      strength: 16,
      dexterity: 12,
    },
  }));
}

function createTarget(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'target',
    name: 'Target',
    team: 'enemy',
  });
}

describe('Superiority dice resource', () => {
  it('grants the canonical four d8 dice with short-rest reset metadata', () => {
    const character = createBattleMaster();

    expect(getSuperiorityDice(character)).toEqual({
      current: BATTLE_MASTER_SUPERIORITY_DICE_MAX,
      max: BATTLE_MASTER_SUPERIORITY_DICE_MAX,
    });
    expect(character.limitedUses?.superiority_dice?.resetOn).toBe('short_rest');
  });

  it('spends a die without mutating the original snapshot', () => {
    const character = createBattleMaster();
    const spent = spendSuperiorityDie(character);

    expect(getSuperiorityDice(character).current).toBe(4);
    expect(getSuperiorityDice(spent).current).toBe(3);
  });

  it('does not spend below zero and restores to the full pool', () => {
    let character = createBattleMaster();
    for (let i = 0; i < 6; i += 1) {
      character = spendSuperiorityDie(character);
    }

    expect(getSuperiorityDice(character).current).toBe(0);
    expect(getSuperiorityDice(restoreSuperiorityDice(character)).current).toBe(4);
  });
});

describe('Maneuver save DC', () => {
  it('uses 8 + proficiency + the higher of Strength or Dexterity', () => {
    // Level 3 → PB +2; STR 16 → +3, DEX 12 → +1. DC = 8 + 2 + 3 = 13.
    expect(calculateManeuverSaveDc(createBattleMaster())).toBe(13);
  });
});

describe('resolveBattleMasterManeuver', () => {
  it('spends a die and applies Prone on a failed Trip Attack save', () => {
    const attacker = createBattleMaster();
    const target = createTarget();
    const state = createMockCombatState({ characters: [attacker, target] });

    const result = resolveBattleMasterManeuver(state, {
      attackerId: 'battle-master',
      targetId: 'target',
      maneuverId: 'trip_attack',
      dieRng: () => 0.5,   // d8 → 5
      saveRng: () => 0.05, // d20 → 2, fails DC 13
    });

    expect(result.resolved).toBe(true);
    expect(result.dieRolled).toBe(5);
    expect(result.damageBonus).toBe(5);
    expect(result.attackRollBonus).toBeUndefined();
    expect(result.save?.success).toBe(false);
    expect(result.conditionApplied).toBe('Prone');

    const spent = result.state.characters.find(character => character.id === 'battle-master');
    const affected = result.state.characters.find(character => character.id === 'target');
    expect(getSuperiorityDice(spent!).current).toBe(3);
    expect(affected?.conditions?.some(condition => condition.name === 'Prone')).toBe(true);
    expect(affected?.statusEffects.some(effect => effect.name === 'Prone')).toBe(true);
  });

  it('does not apply the rider when the target succeeds the save', () => {
    const attacker = createBattleMaster();
    const target = createTarget();
    const state = createMockCombatState({ characters: [attacker, target] });

    const result = resolveBattleMasterManeuver(state, {
      attackerId: 'battle-master',
      targetId: 'target',
      maneuverId: 'menacing_attack',
      dieRng: () => 0.5,
      saveRng: () => 0.95, // d20 → 20, succeeds
    });

    expect(result.resolved).toBe(true);
    expect(result.save?.success).toBe(true);
    expect(result.conditionApplied).toBeUndefined();
    const affected = result.state.characters.find(character => character.id === 'target');
    expect(affected?.conditions?.some(condition => condition.name === 'Frightened')).toBe(false);
  });

  it('resolves Precision Attack as an attack-roll bonus with no save or condition', () => {
    const attacker = createBattleMaster();
    const target = createTarget();
    const state = createMockCombatState({ characters: [attacker, target] });

    const result = resolveBattleMasterManeuver(state, {
      attackerId: 'battle-master',
      targetId: 'target',
      maneuverId: 'precision_attack',
      dieRng: () => 0.5,
    });

    expect(result.resolved).toBe(true);
    expect(result.dieRolled).toBe(5);
    expect(result.attackRollBonus).toBe(5);
    expect(result.damageBonus).toBeUndefined();
    expect(result.save).toBeUndefined();
    expect(result.conditionApplied).toBeUndefined();
    expect(getSuperiorityDice(
      result.state.characters.find(character => character.id === 'battle-master')!,
    ).current).toBe(3);
  });

  it('rejects an unknown maneuver without spending a die', () => {
    const attacker = createBattleMaster();
    const state = createMockCombatState({ characters: [attacker] });

    const result = resolveBattleMasterManeuver(state, {
      attackerId: 'battle-master',
      targetId: 'target',
      maneuverId: 'not_a_maneuver',
    });

    expect(result.resolved).toBe(false);
    expect(result.failure).toBe('unknown_maneuver');
    expect(getSuperiorityDice(attacker).current).toBe(4);
  });

  it('rejects an exhausted dice pool without changing state', () => {
    let attacker = createBattleMaster();
    for (let i = 0; i < 4; i += 1) {
      attacker = spendSuperiorityDie(attacker);
    }
    const state = createMockCombatState({ characters: [attacker, createTarget()] });

    const result = resolveBattleMasterManeuver(state, {
      attackerId: 'battle-master',
      targetId: 'target',
      maneuverId: 'trip_attack',
    });

    expect(result.resolved).toBe(false);
    expect(result.failure).toBe('no_superiority_dice');
    expect(result.state).toBe(state);
  });
});
