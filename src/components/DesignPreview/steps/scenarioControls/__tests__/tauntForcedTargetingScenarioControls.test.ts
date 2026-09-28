/**
 * This file proves the Taunt & Forced Targeting controls mutate live combat state.
 *
 * The checks protect canonical Compelled Duel facts, pre-payment eligibility,
 * save-and-cost ordering, live turn ownership, atomic attack rejection, willing
 * and forced movement, cleanup, and exact Reset restoration.
 *
 * Exercises: tauntForcedTargetingScenarioControls.
 * Depends on: live Compelled Duel data and the production taunt helpers.
 */

import compelledDuelData from '@/data/spells/level-1/compelled-duel.json';
import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../../types/combat';
import type { Spell } from '../../../../../types/spells';
import { createMockCombatCharacter } from '../../../../../utils/core';
import { hasTauntAttackDisadvantage } from '../../../../../systems/combat/tauntConstraint';
import tauntForcedTargetingScenarioControls, {
  prepareTauntForcedTargetingCharacters,
  prepareTauntForcedTargetingMapData,
  TAUNT_FORCED_TARGETING_CASTER_ID,
  TAUNT_FORCED_TARGETING_CASTER_START,
  TAUNT_FORCED_TARGETING_FORCED_DESTINATION,
  TAUNT_FORCED_TARGETING_OTHER_ID,
  TAUNT_FORCED_TARGETING_OTHER_START,
  TAUNT_FORCED_TARGETING_TARGET_ID,
  TAUNT_FORCED_TARGETING_TARGET_OUT_OF_RANGE,
  TAUNT_FORCED_TARGETING_TARGET_START,
} from '../tauntForcedTargetingScenarioControls';

// ============================================================================
// Mounted-Control Style Fixture
// ============================================================================
// State flows from one selector or button to the next just as it does through
// the React host. This catches controls that change labels but not live actors.
// ============================================================================

interface ScenarioState {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  logMessage: string;
  currentCharacterId: string | null;
}

function createTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: 0,
    movementCost: 5,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    effects: [],
  };
}

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const tile = createTile(x, y);
      tiles.set(tile.id, tile);
    }
  }

  return prepareTauntForcedTargetingMapData({
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 37,
  });
}

function createCharacters(): CombatCharacter[] {
  const caster = createMockCombatCharacter({
    id: TAUNT_FORCED_TARGETING_CASTER_ID,
    name: 'Challenge Knight',
    position: { ...TAUNT_FORCED_TARGETING_CASTER_START },
    team: 'player',
    level: 5,
    currentHP: 30,
    maxHP: 30,
  });
  const target = createMockCombatCharacter({
    id: TAUNT_FORCED_TARGETING_TARGET_ID,
    name: 'Goaded Raider',
    position: { ...TAUNT_FORCED_TARGETING_TARGET_START },
    team: 'enemy',
  });
  const other = createMockCombatCharacter({
    id: TAUNT_FORCED_TARGETING_OTHER_ID,
    name: 'Protected Ally',
    position: { ...TAUNT_FORCED_TARGETING_OTHER_START },
    team: 'player',
    armorClass: 15,
    baseAC: 15,
  });

  return prepareTauntForcedTargetingCharacters([caster, target, other]);
}

function initialState(): ScenarioState {
  return {
    mapData: createMap(),
    characters: createCharacters(),
    logMessage: '',
    currentCharacterId: TAUNT_FORCED_TARGETING_CASTER_ID,
  };
}

function apply(
  state: ScenarioState,
  controlId: string,
  value: string | boolean,
): ScenarioState {
  const patch = tauntForcedTargetingScenarioControls.applyControl({
    controlId,
    value,
    snapshot: {
      mapData: state.mapData,
      characters: state.characters,
      activeLightSources: [],
      reactiveTriggers: [],
      spellZones: [],
      turnState: {
        currentTurn: 1,
        turnOrder: [
          TAUNT_FORCED_TARGETING_CASTER_ID,
          TAUNT_FORCED_TARGETING_TARGET_ID,
          TAUNT_FORCED_TARGETING_OTHER_ID,
        ],
        currentCharacterId: state.currentCharacterId,
        phase: 'action',
        actionsThisTurn: [],
      },
    },
  });

  return {
    mapData: patch.mapData ?? state.mapData,
    characters: patch.characters ?? state.characters,
    logMessage: patch.logMessage,
    currentCharacterId: state.currentCharacterId,
  };
}

function withTurnOwner(state: ScenarioState, currentCharacterId: string): ScenarioState {
  return { ...state, currentCharacterId };
}

function findCharacter(state: ScenarioState, id: string): CombatCharacter {
  const character = state.characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing taunt scenario actor ${id}.`);
  return character;
}

function appliedTauntState(): ScenarioState {
  return apply(initialState(), 'attempt_taunt', true);
}

// ============================================================================
// Canonical Source And Successful Application
// ============================================================================
// The scenario must fail loudly if its live spell source loses the rule facts
// that the rendered lane claims to demonstrate.
// ============================================================================

describe('taunt scenario canonical application', () => {
  it('reads Compelled Duel range, sight, save, cost, duration, and taunt facts', () => {
    const compelledDuel = compelledDuelData as unknown as Spell;
    const taunt = compelledDuel.effects.find(effect => (
      effect.type === 'UTILITY' && effect.taunt?.disadvantageAgainstOthers
    ));

    expect(compelledDuel).toMatchObject({
      level: 1,
      castingTime: { unit: 'bonus_action' },
      range: { distance: 30 },
      targeting: { lineOfSight: true },
      duration: { value: 1, unit: 'minute', concentration: true },
    });
    expect(taunt).toMatchObject({
      condition: { type: 'save', saveType: 'Wisdom' },
      taunt: { disadvantageAgainstOthers: true, leashRangeFeet: 30 },
    });
  });

  it('pays the valid failed-save cast and creates a source-linked restriction', () => {
    const result = appliedTauntState();
    const caster = findCharacter(result, TAUNT_FORCED_TARGETING_CASTER_ID);
    const target = findCharacter(result, TAUNT_FORCED_TARGETING_TARGET_ID);
    const other = findCharacter(result, TAUNT_FORCED_TARGETING_OTHER_ID);

    expect(caster).toMatchObject({
      actionEconomy: { bonusAction: { used: true } },
      spellSlots: { level_1: { current: 0, max: 1 } },
      concentratingOn: { spellId: 'compelled-duel' },
    });
    expect(target.statusEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Taunted',
        duration: 10,
        sourceSpellId: 'compelled-duel',
        sourceCasterId: TAUNT_FORCED_TARGETING_CASTER_ID,
        taunt: expect.objectContaining({ disadvantageAgainstOthers: true }),
      }),
    ]));
    expect(hasTauntAttackDisadvantage(target, caster.id, result.characters)).toBe(false);
    expect(hasTauntAttackDisadvantage(target, other.id, result.characters)).toBe(true);
    expect(result.logMessage).toContain('TAUNT APPLIED');
    expect(result.logMessage).toContain('BA + L1 spent');
  });
});

// ============================================================================
// Save And Pre-Payment Rejections
// ============================================================================
// A successful save consumes a valid cast but adds no restriction. Immunity,
// range, sight, and hostility are eligibility failures and spend nothing.
// ============================================================================

describe('taunt scenario save and eligibility ordering', () => {
  it('rejects an off-turn cast before payment or the Wisdom roll', () => {
    const wrongTurn = withTurnOwner(initialState(), TAUNT_FORCED_TARGETING_TARGET_ID);
    const result = apply(wrongTurn, 'attempt_taunt', true);
    const caster = findCharacter(result, TAUNT_FORCED_TARGETING_CASTER_ID);

    expect(result.characters).toBe(wrongTurn.characters);
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.spellSlots?.level_1.current).toBe(1);
    expect(result.logMessage).toContain('not_turn_owner');
    expect(result.logMessage).toContain('ROLL: not made');
  });

  it('spends a valid cast on a successful save but applies no taunt', () => {
    const configured = apply(initialState(), 'target_case', 'successful_save');
    const result = apply(configured, 'attempt_taunt', true);
    const caster = findCharacter(result, TAUNT_FORCED_TARGETING_CASTER_ID);
    const target = findCharacter(result, TAUNT_FORCED_TARGETING_TARGET_ID);

    expect(caster.actionEconomy.bonusAction.used).toBe(true);
    expect(caster.spellSlots?.level_1.current).toBe(0);
    expect(target.statusEffects.some(status => status.name === 'Taunted')).toBe(false);
    expect(result.logMessage).toContain('TAUNT SAVED');
    expect(result.logMessage).toContain('valid cast spends Bonus Action + L1');
  });

  it.each([
    ['immune', 'forced_targeting_immune'],
    ['out_of_range', 'out_of_range'],
    ['blocked_line_of_sight', 'line_of_sight_blocked'],
    ['non_hostile', 'non_hostile'],
  ] as const)('rejects %s before payment or effect', (targetCase, reason) => {
    const configured = apply(initialState(), 'target_case', targetCase);
    const result = apply(configured, 'attempt_taunt', true);
    const caster = findCharacter(result, TAUNT_FORCED_TARGETING_CASTER_ID);
    const target = findCharacter(result, TAUNT_FORCED_TARGETING_TARGET_ID);

    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.spellSlots?.level_1.current).toBe(1);
    expect(caster.concentratingOn).toBeUndefined();
    expect(target.statusEffects.some(status => status.name === 'Taunted')).toBe(false);
    expect(result.logMessage).toContain(reason);
  });

  it('writes real out-of-range, wall, and team facts into the live board', () => {
    const distant = apply(initialState(), 'target_case', 'out_of_range');
    const blocked = apply(initialState(), 'target_case', 'blocked_line_of_sight');
    const friendly = apply(initialState(), 'target_case', 'non_hostile');

    expect(findCharacter(distant, TAUNT_FORCED_TARGETING_TARGET_ID).position)
      .toEqual(TAUNT_FORCED_TARGETING_TARGET_OUT_OF_RANGE);
    expect(blocked.mapData.tiles.get('5-5')).toMatchObject({
      terrain: 'wall',
      blocksMovement: true,
      blocksLoS: true,
    });
    expect(findCharacter(friendly, TAUNT_FORCED_TARGETING_TARGET_ID).team)
      .toBe(findCharacter(friendly, TAUNT_FORCED_TARGETING_CASTER_ID).team);
  });
});

// ============================================================================
// Attack, Movement, Cleanup, And Reset
// ============================================================================
// Attacks validate the live owner and finite Action before constructing a d20.
// Movement distinguishes willing speed from a source-owned forced effect, and
// cleanup proves stale markers do not continue restricting either contract.
// ============================================================================

describe('taunt scenario follow-up behavior', () => {
  it('keeps attacks against the taunter normal and penalizes attacks on others', () => {
    const targetTurn = withTurnOwner(appliedTauntState(), TAUNT_FORCED_TARGETING_TARGET_ID);
    const attackOther = apply(targetTurn, 'resolve_follow_up', true);
    expect(attackOther.logMessage).toContain('DISADVANTAGE ROLL: d20 16/5 keep 5');
    expect(attackOther.logMessage).toContain('MISS');

    const taunterSelected = apply(
      withTurnOwner(appliedTauntState(), TAUNT_FORCED_TARGETING_TARGET_ID),
      'follow_up_case',
      'attack_taunter',
    );
    const attackTaunter = apply(taunterSelected, 'resolve_follow_up', true);
    expect(attackTaunter.logMessage).toContain('NORMAL ROLL: d20 16 + 5 = 21');
    expect(attackTaunter.logMessage).toContain('HIT');
  });

  it('rejects the wrong turn and an exhausted repeat before any attack roll or mutation', () => {
    const casterTurn = appliedTauntState();
    const wrongTurn = apply(casterTurn, 'resolve_follow_up', true);

    expect(wrongTurn.characters).toBe(casterTurn.characters);
    expect(wrongTurn.logMessage).toContain('not_turn_owner');
    expect(wrongTurn.logMessage).toContain('ROLL: not made');

    const targetTurn = withTurnOwner(casterTurn, TAUNT_FORCED_TARGETING_TARGET_ID);
    const firstAttack = apply(targetTurn, 'resolve_follow_up', true);
    const repeated = apply(firstAttack, 'resolve_follow_up', true);
    const targetAfterFirst = findCharacter(firstAttack, TAUNT_FORCED_TARGETING_TARGET_ID);

    expect(targetAfterFirst.actionEconomy.action).toMatchObject({ used: true, remaining: 0 });
    expect(repeated.characters).toBe(firstAttack.characters);
    expect(repeated.logMessage).toContain('action_unavailable');
    expect(repeated.logMessage).toContain('ROLL: not made');
  });

  it('rejects willing movement beyond the leash without spending target movement', () => {
    const selected = apply(
      withTurnOwner(appliedTauntState(), TAUNT_FORCED_TARGETING_TARGET_ID),
      'follow_up_case',
      'willing_move_beyond_leash',
    );
    const before = findCharacter(selected, TAUNT_FORCED_TARGETING_TARGET_ID);
    const result = apply(selected, 'resolve_follow_up', true);
    const after = findCharacter(result, TAUNT_FORCED_TARGETING_TARGET_ID);

    expect(result.characters).toBe(selected.characters);
    expect(after.position).toEqual(before.position);
    expect(after.actionEconomy.movement).toEqual(before.actionEconomy.movement);
    expect(result.logMessage).toContain('taunt_leash');
    expect(result.logMessage).toContain('movement unchanged');
  });

  it('applies a legal source-owned forced move without spending target movement or Action', () => {
    const selected = apply(appliedTauntState(), 'follow_up_case', 'forced_move_legal');
    const sourceBefore = findCharacter(selected, TAUNT_FORCED_TARGETING_CASTER_ID);
    const targetBefore = findCharacter(selected, TAUNT_FORCED_TARGETING_TARGET_ID);
    const result = apply(selected, 'resolve_follow_up', true);
    const sourceAfter = findCharacter(result, TAUNT_FORCED_TARGETING_CASTER_ID);
    const targetAfter = findCharacter(result, TAUNT_FORCED_TARGETING_TARGET_ID);

    expect(targetAfter.position).toEqual(TAUNT_FORCED_TARGETING_FORCED_DESTINATION);
    expect(targetAfter.actionEconomy.movement).toEqual(targetBefore.actionEconomy.movement);
    expect(targetAfter.actionEconomy.action).toEqual(targetBefore.actionEconomy.action);
    expect(sourceAfter).toEqual(sourceBefore);
    expect(result.logMessage).toContain('FORCED MOVE RESOLVED');
    expect(result.logMessage).toMatch(/target movement unchanged=0\/\d+ -> 0\/\d+/);
  });

  it.each([
    ['forced_move_blocked', 'invalid_destination'],
    ['forced_move_off_board', 'invalid_destination'],
    ['forced_move_occupied', 'invalid_destination'],
    ['forced_move_too_far', 'distance_exceeded'],
  ] as const)('rejects %s atomically with a precise destination reason', (followUp, reason) => {
    const selected = apply(appliedTauntState(), 'follow_up_case', followUp);
    const before = findCharacter(selected, TAUNT_FORCED_TARGETING_TARGET_ID);
    const result = apply(selected, 'resolve_follow_up', true);
    const after = findCharacter(result, TAUNT_FORCED_TARGETING_TARGET_ID);

    expect(result.characters).toBe(selected.characters);
    expect(after.position).toEqual(before.position);
    expect(after.actionEconomy).toEqual(before.actionEconomy);
    expect(result.logMessage).toContain(reason);
    expect(result.logMessage).toContain('ROLL: not applicable');
  });

  it.each([
    ['source_downed', 'source_downed'],
    ['source_incapacitated', 'source_incapacitated'],
    ['expiry', 'expired'],
    ['manual_removal', 'TAUNT REMOVED'],
  ] as const)('clears the restriction for %s', (followUp, proof) => {
    const selected = apply(appliedTauntState(), 'follow_up_case', followUp);
    const result = apply(selected, 'resolve_follow_up', true);
    const caster = findCharacter(result, TAUNT_FORCED_TARGETING_CASTER_ID);
    const target = findCharacter(result, TAUNT_FORCED_TARGETING_TARGET_ID);
    const other = findCharacter(result, TAUNT_FORCED_TARGETING_OTHER_ID);

    expect(target.statusEffects.some(status => status.name === 'Taunted')).toBe(false);
    expect(caster.concentratingOn).toBeUndefined();
    expect(hasTauntAttackDisadvantage(target, other.id, result.characters)).toBe(false);
    expect(result.logMessage).toContain(proof);
    expect(result.logMessage).toContain('disadvantage=false');
  });

  it('clears the restriction when its source is missing from the live roster', () => {
    const selected = apply(appliedTauntState(), 'follow_up_case', 'source_missing');
    const result = apply(selected, 'resolve_follow_up', true);
    const target = findCharacter(result, TAUNT_FORCED_TARGETING_TARGET_ID);
    const other = findCharacter(result, TAUNT_FORCED_TARGETING_OTHER_ID);

    expect(result.characters.some(character => character.id === TAUNT_FORCED_TARGETING_CASTER_ID)).toBe(false);
    expect(target.statusEffects.some(status => status.name === 'Taunted')).toBe(false);
    expect(hasTauntAttackDisadvantage(target, other.id, result.characters)).toBe(false);
    expect(result.logMessage).toContain('source_missing');
    expect(result.logMessage).toContain('ROLL: not made');
  });

  it('restores exact baseline resources, positions, teams, and restriction state', () => {
    const changed = apply(
      apply(appliedTauntState(), 'follow_up_case', 'source_downed'),
      'resolve_follow_up',
      true,
    );
    const resetCharacters = prepareTauntForcedTargetingCharacters(changed.characters);
    const resetMap = prepareTauntForcedTargetingMapData(changed.mapData);
    const reset: ScenarioState = { ...changed, mapData: resetMap, characters: resetCharacters };
    const caster = findCharacter(reset, TAUNT_FORCED_TARGETING_CASTER_ID);
    const target = findCharacter(reset, TAUNT_FORCED_TARGETING_TARGET_ID);

    expect(caster).toMatchObject({
      position: TAUNT_FORCED_TARGETING_CASTER_START,
      currentHP: 30,
      actionEconomy: { bonusAction: { used: false } },
      spellSlots: { level_1: { current: 1, max: 1 } },
    });
    expect(target).toMatchObject({
      position: TAUNT_FORCED_TARGETING_TARGET_START,
      team: 'enemy',
    });
    expect(target.statusEffects.some(status => status.name === 'Taunted')).toBe(false);
    expect(reset.mapData.tiles.get('9-5')).toMatchObject({
      terrain: 'sand',
      blocksMovement: false,
    });
  });
});
