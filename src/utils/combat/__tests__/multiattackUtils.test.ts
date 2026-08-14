/**
 * This file proves the shared Multiattack sequence resolves real independent attacks.
 *
 * The fixtures exercise one action payment, separate hit and miss outcomes, target
 * selection per authored attack, all-target preflight, hit-gated rider matching and
 * consumption, downing, and the normal poison-immunity damage boundary. These are
 * the engine facts used by the Tactical Sandbox Multiattack & Attack Riders board.
 */

import { describe, expect, it } from 'vitest';
import type { ActiveRider, CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  resolveMultiattackSequence,
  type MultiattackStrikeRequest,
} from '../multiattackUtils';

// ============================================================================
// Canonical Combat Fixtures
// ============================================================================
// A midpoint random stream rolls 5 on a d8 and 4 on a d6. The two authored
// attacks therefore deal 9 and 8 base damage, while the venom rider deals 4.
// ============================================================================

const FIXED_DAMAGE_RNG = (): number => 0.5;

function createRider(targetId: string): ActiveRider {
  return {
    id: 'venom-rider',
    spellId: 'venomous-bite',
    casterId: 'drake',
    sourceName: 'Venom Rider',
    targetId,
    effect: {
      type: 'DAMAGE',
      trigger: {
        type: 'on_attack_hit',
        frequency: 'every_time',
        consumption: 'first_hit',
        attackFilter: { attackType: 'weapon', weaponType: 'melee' },
      },
      condition: { type: 'hit' },
      damage: { dice: '1d6', type: 'Poison' },
    },
    consumption: 'first_hit',
    attackFilter: { attackType: 'weapon', weaponType: 'melee' },
    usedThisTurn: false,
    duration: { type: 'special' },
  };
}

function createActors(poisonImmuneTargetId?: string): CombatCharacter[] {
  const drake = createMockCombatCharacter({
    id: 'drake',
    name: 'Venom Drake',
    team: 'enemy',
  });
  const guard = createMockCombatCharacter({
    id: 'guard',
    name: 'Iron Guard',
    team: 'player',
    armorClass: 16,
    baseAC: 16,
    currentHP: 40,
    maxHP: 40,
  });
  const ward = createMockCombatCharacter({
    id: 'ward',
    name: 'Venom Ward',
    team: 'player',
    armorClass: 16,
    baseAC: 16,
    currentHP: 40,
    maxHP: 40,
    immunities: poisonImmuneTargetId === 'ward' ? ['Poison'] : [],
  });

  return [{ ...drake, riders: [createRider('guard')] }, guard, ward];
}

function strike(
  id: string,
  label: string,
  targetId: string,
  d20Roll: number,
  damageFormula: string,
  damageType: 'Slashing' | 'Piercing',
): MultiattackStrikeRequest {
  return {
    id,
    label,
    targetId,
    d20Roll,
    attackBonus: 6,
    damageFormula,
    damageType,
    attackType: 'weapon',
    weaponType: 'melee',
    damageRng: FIXED_DAMAGE_RNG,
  };
}

function findCharacter(
  characters: CombatCharacter[],
  characterId: string,
): CombatCharacter {
  const character = characters.find(candidate => candidate.id === characterId);
  if (!character) throw new Error(`Missing Multiattack fixture ${characterId}.`);
  return character;
}

// ============================================================================
// Sequence Outcomes
// ============================================================================
// Each assertion checks structured outcomes and final character state together,
// preventing a reasoned log from drifting away from the board's actual HP.
// ============================================================================

describe('resolveMultiattackSequence', () => {
  it('spends one action while independently resolving a hit and a miss', () => {
    const state = createMockCombatState({ characters: createActors() });
    const result = resolveMultiattackSequence({
      state,
      attackerId: 'drake',
      strikes: [
        strike('bite', 'Bite', 'guard', 12, '1d8+4', 'Piercing'),
        strike('claw', 'Claw', 'ward', 7, '1d6+4', 'Slashing'),
      ],
    });

    expect(result.attempted).toBe(true);
    expect(result.actionSpent).toBe(true);
    expect(result.strikes.map(outcome => outcome.isHit)).toEqual([true, false]);
    expect(findCharacter(result.state.characters, 'drake').actionEconomy.action.used)
      .toBe(true);
    expect(findCharacter(result.state.characters, 'guard').currentHP).toBe(27);
    expect(findCharacter(result.state.characters, 'ward').currentHP).toBe(40);
  });

  it('does not apply or consume the target-bound rider when the Bite misses', () => {
    const state = createMockCombatState({ characters: createActors() });
    const result = resolveMultiattackSequence({
      state,
      attackerId: 'drake',
      strikes: [
        strike('bite', 'Bite', 'guard', 7, '1d8+4', 'Piercing'),
        strike('claw', 'Claw', 'ward', 12, '1d6+4', 'Slashing'),
      ],
    });

    expect(result.strikes[0]).toMatchObject({
      isHit: false,
      riderDamageApplied: 0,
      triggeredRiderNames: [],
    });
    expect(result.strikes[1]).toMatchObject({
      isHit: true,
      baseDamageApplied: 8,
      riderDamageApplied: 0,
    });
    expect(findCharacter(result.state.characters, 'guard').currentHP).toBe(40);
    expect(findCharacter(result.state.characters, 'ward').currentHP).toBe(32);
    expect(findCharacter(result.state.characters, 'drake').riders).toHaveLength(1);
  });

  it('lets authored attacks hit different targets without sharing HP truth', () => {
    const state = createMockCombatState({ characters: createActors() });
    const result = resolveMultiattackSequence({
      state,
      attackerId: 'drake',
      strikes: [
        strike('bite', 'Bite', 'guard', 12, '1d8+4', 'Piercing'),
        strike('claw', 'Claw', 'ward', 12, '1d6+4', 'Slashing'),
      ],
    });

    expect(result.strikes.map(outcome => outcome.targetId)).toEqual(['guard', 'ward']);
    expect(findCharacter(result.state.characters, 'guard').currentHP).toBe(27);
    expect(findCharacter(result.state.characters, 'ward').currentHP).toBe(32);
  });

  it('keeps base damage but applies zero poison rider damage to an immune target', () => {
    const actors = createActors('ward').map(character => (
      character.id === 'drake'
        ? { ...character, riders: [createRider('ward')] }
        : character
    ));
    const state = createMockCombatState({ characters: actors });
    const result = resolveMultiattackSequence({
      state,
      attackerId: 'drake',
      strikes: [strike('bite', 'Bite', 'ward', 12, '1d8+4', 'Piercing')],
    });

    expect(result.strikes[0]).toMatchObject({
      baseDamageApplied: 9,
      riderDamageRolled: 4,
      riderDamageApplied: 0,
      triggeredRiderNames: ['Venom Rider'],
    });
    expect(findCharacter(result.state.characters, 'ward').currentHP).toBe(31);
  });

  it('refuses a second Multiattack when the action is already spent', () => {
    const characters = createActors().map(character => (
      character.id === 'drake'
        ? {
          ...character,
          actionEconomy: {
            ...character.actionEconomy,
            action: { ...character.actionEconomy.action, used: true },
          },
        }
        : character
    ));
    const state = createMockCombatState({ characters });
    const result = resolveMultiattackSequence({
      state,
      attackerId: 'drake',
      strikes: [strike('bite', 'Bite', 'guard', 12, '1d8+4', 'Piercing')],
    });

    expect(result).toMatchObject({
      attempted: false,
      actionSpent: false,
      failure: 'action_unavailable',
      strikes: [],
    });
    expect(result.state).toBe(state);
  });

  it('rejects the whole transaction before payment when an authored target is missing', () => {
    const state = createMockCombatState({ characters: createActors() });
    const result = resolveMultiattackSequence({
      state,
      attackerId: 'drake',
      strikes: [
        strike('bite', 'Bite', 'guard', 12, '1d8+4', 'Piercing'),
        strike('claw', 'Claw', 'missing-ward', 12, '1d6+4', 'Slashing'),
      ],
    });

    // A malformed second target must not spend the Action or preserve damage
    // from the otherwise valid first attack.
    expect(result).toMatchObject({
      attempted: false,
      actionSpent: false,
      failure: 'target_missing',
      strikes: [],
    });
    expect(result.state).toBe(state);
    expect(findCharacter(result.state.characters, 'guard').currentHP).toBe(40);
    expect(findCharacter(result.state.characters, 'drake').actionEconomy.action.used)
      .toBe(false);
  });

  it('uses the shared HP transition when a strike downs a target', () => {
    const actors = createActors().map(character => (
      character.id === 'guard'
        ? { ...character, currentHP: 5, maxHP: 40 }
        : character
    ));
    const state = createMockCombatState({ characters: actors });
    const result = resolveMultiattackSequence({
      state,
      attackerId: 'drake',
      strikes: [strike('bite', 'Bite', 'guard', 12, '1d8+4', 'Piercing')],
    });
    const guard = findCharacter(result.state.characters, 'guard');

    // The same HP helper used by production commands owns the 0-HP transition,
    // including death-save state and the Unconscious condition for player actors.
    expect(guard.currentHP).toBe(0);
    expect(guard.deathSaves).toEqual({ successes: 0, failures: 0, isStable: false });
    expect(guard.conditions?.some(condition => condition.name === 'Unconscious')).toBe(true);
  });
});
