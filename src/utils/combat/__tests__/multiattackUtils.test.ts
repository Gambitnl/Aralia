/**
 * This file proves the shared Multiattack sequence resolves real independent attacks.
 *
 * The fixtures exercise one action payment, separate hit and miss outcomes, target
 * selection per authored attack, all-target preflight, hit-gated rider matching and
 * consumption, downing, and the normal poison-immunity damage boundary. These are
 * the engine facts used by the Tactical Sandbox Multiattack & Attack Riders board.
 */

import { describe, expect, it } from 'vitest';
import type { Ability, ActiveRider, CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  dispatchMultiattack,
  expandMultiattackStrikes,
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

describe('expandMultiattackStrikes', () => {
  function createDragonAbilities(): Ability[] {
    return [
      {
        id: 'multiattack',
        name: 'Multiattack',
        description: 'The dragon makes three Rend attacks.',
        type: 'attack',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 2,
        effects: [{ type: 'damage', dice: '3d10+24', damageType: 'slashing', value: 42 }],
        multiattackCount: 3,
        subAttackIds: ['rend', 'scorching_ray_will_b0'],
        isProficient: true,
      },
      {
        id: 'rend',
        name: 'Rend',
        description: 'Rend',
        type: 'attack',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 2,
        effects: [{ type: 'damage', dice: '1d10 + 8', damageType: 'slashing', value: 14 }],
        attackBonus: 14,
        isProficient: true,
      },
      {
        id: 'scorching_ray_will_b0',
        name: 'Scorching Ray',
        description: 'Scorching Ray',
        type: 'spell',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 6,
        effects: [{ type: 'damage', dice: '2d6', damageType: 'fire', value: 7 }],
        attackBonus: 14,
        isMagical: true,
        isProficient: true,
      },
    ];
  }

  function createDragonAttacker(): CombatCharacter {
    return createMockCombatCharacter({
      id: 'dragon',
      name: 'Adult Red Dragon',
      team: 'enemy',
      abilities: createDragonAbilities(),
    });
  }

  const ability = (attacker: CombatCharacter, id: string): Ability => {
    const found = attacker.abilities.find(candidate => candidate.id === id);
    if (!found) throw new Error(`Missing ability ${id}.`);
    return found;
  };

  it('expands three authored attacks into independent per-hit strike requests', () => {
    const attacker = createDragonAttacker();
    const result = expandMultiattackStrikes({
      attacker,
      ability: ability(attacker, 'multiattack'),
      targetIds: ['a', 'b', 'c'],
      rng: () => 0.5,
    });

    expect(result.failure).toBeUndefined();
    expect(result.strikes).toHaveLength(3);
    expect(result.strikes.map(strike => strike.label)).toEqual(['Rend', 'Rend', 'Rend']);
    expect(result.strikes.map(strike => strike.attackBonus)).toEqual([14, 14, 14]);
    expect(result.strikes.map(strike => strike.damageFormula)).toEqual(['1d10 + 8', '1d10 + 8', '1d10 + 8']);
    expect(result.strikes.map(strike => strike.damageType)).toEqual(['slashing', 'slashing', 'slashing']);
    expect(result.strikes.map(strike => strike.attackType)).toEqual(['weapon', 'weapon', 'weapon']);
    expect(result.strikes.map(strike => strike.weaponType)).toEqual(['melee', 'melee', 'melee']);
    expect(result.strikes.map(strike => strike.d20Roll)).toEqual([11, 11, 11]);
    expect(result.strikes.map(strike => strike.targetId)).toEqual(['a', 'b', 'c']);
  });

  it('honors a legal authored replacement for one strike', () => {
    const attacker = createDragonAttacker();
    const result = expandMultiattackStrikes({
      attacker,
      ability: ability(attacker, 'multiattack'),
      targetIds: ['a', 'b', 'c'],
      replacementByIndex: { 1: 'scorching_ray_will_b0' },
      rng: () => 0.5,
    });

    expect(result.strikes[1]).toMatchObject({
      label: 'Scorching Ray',
      damageType: 'fire',
      attackType: 'spell',
      weaponType: 'ranged',
      damageFormula: '2d6',
      isMagical: true,
    });
    expect(result.strikes[0].label).toBe('Rend');
    expect(result.strikes[2].label).toBe('Rend');
  });

  it('rejects an illegal replacement id before producing any strike', () => {
    const attacker = createDragonAttacker();
    const result = expandMultiattackStrikes({
      attacker,
      ability: ability(attacker, 'multiattack'),
      targetIds: ['a', 'b', 'c'],
      replacementByIndex: { 1: 'not_an_authored_sub_attack' },
    });

    expect(result.strikes).toEqual([]);
    expect(result.failure).toBe('missing_sub_attack');
  });

  it('rejects a target list that does not match the authored hit count', () => {
    const attacker = createDragonAttacker();
    const result = expandMultiattackStrikes({
      attacker,
      ability: ability(attacker, 'multiattack'),
      targetIds: ['a'],
    });

    expect(result.strikes).toEqual([]);
    expect(result.failure).toBe('target_count_mismatch');
  });
});

describe('dispatchMultiattack', () => {
  it('resolves three ordered attacks for one Action through the shared sequence resolver', () => {
    const attacker = createMockCombatCharacter({
      id: 'dragon',
      name: 'Adult Red Dragon',
      team: 'enemy',
      abilities: [
        {
          id: 'multiattack',
          name: 'Multiattack',
          description: 'The dragon makes three Rend attacks.',
          type: 'attack',
          cost: { type: 'action' },
          targeting: 'single_enemy',
          range: 2,
          effects: [{ type: 'damage', dice: '3d10+24', damageType: 'slashing', value: 42 }],
          multiattackCount: 3,
          subAttackIds: ['rend'],
          isProficient: true,
        },
        {
          id: 'rend',
          name: 'Rend',
          description: 'Rend',
          type: 'attack',
          cost: { type: 'action' },
          targeting: 'single_enemy',
          range: 2,
          effects: [{ type: 'damage', dice: '1d10 + 8', damageType: 'slashing', value: 14 }],
          attackBonus: 14,
          isProficient: true,
        },
      ],
    });
    const guard = createMockCombatCharacter({
      id: 'guard',
      name: 'Guard',
      team: 'player',
      armorClass: 16,
      baseAC: 16,
      currentHP: 100,
      maxHP: 100,
    });
    const state = createMockCombatState({ characters: [attacker, guard] });

    const result = dispatchMultiattack({
      state,
      attackerId: 'dragon',
      abilityId: 'multiattack',
      targetIds: ['guard', 'guard', 'guard'],
      rng: () => 0.5,
      damageRng: () => 0.5,
    });

    expect(result.attempted).toBe(true);
    expect(result.actionSpent).toBe(true);
    expect(result.strikes).toHaveLength(3);
    expect(result.strikes.map(strike => strike.isHit)).toEqual([true, true, true]);
    expect(findCharacter(result.state.characters, 'dragon').actionEconomy.action.used)
      .toBe(true);
    // Three 1d10+8 (6+8=14) rends against an unresistant target = 42 damage.
    expect(findCharacter(result.state.characters, 'guard').currentHP).toBe(58);
  });

  it('returns no_authored_attacks when the ability is missing or is not a Multiattack', () => {
    const attacker = createMockCombatCharacter({ id: 'dragon', name: 'Dragon', team: 'enemy' });
    const state = createMockCombatState({ characters: [attacker] });

    const result = dispatchMultiattack({
      state,
      attackerId: 'dragon',
      abilityId: 'multiattack',
      targetIds: ['guard'],
    });

    expect(result).toMatchObject({
      attempted: false,
      actionSpent: false,
      failure: 'no_authored_attacks',
      strikes: [],
    });
  });
});
