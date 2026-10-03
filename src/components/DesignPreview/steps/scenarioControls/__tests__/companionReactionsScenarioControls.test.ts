/**
 * This file proves the Companion Reactions controls mutate canonical state.
 *
 * It covers the qualifying Interception, every mounted rejection, ownership
 * metadata, independent Reaction ledgers, actor-local turn resets, and the full
 * authored reset without relying on rendered labels as mechanics.
 *
 * Exercises: companionReactionsScenarioControls.
 * Depends on: shared mock actors and the production protection transaction.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import companionReactionsScenarioControls, {
  COMPANION_REACTIONS_ALLY_ID,
  COMPANION_REACTIONS_ALLY_MAX_HP,
  COMPANION_REACTIONS_ALLY_START,
  COMPANION_REACTIONS_ATTACKER_ID,
  COMPANION_REACTIONS_ATTACKER_START,
  COMPANION_REACTIONS_COMPANION_ID,
  COMPANION_REACTIONS_COMPANION_START,
  COMPANION_REACTIONS_SECOND_COMPANION_ID,
  COMPANION_REACTIONS_SECOND_COMPANION_START,
  COMPANION_REACTIONS_OWNER_ID,
  COMPANION_REACTIONS_OWNER_START,
  prepareCompanionReactionsCharacters,
  prepareCompanionReactionsMapData,
} from '../companionReactionsScenarioControls';

interface ScenarioState {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  logMessage: string;
  controlValues: Record<string, string | boolean | number>;
}

function makeMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`, coordinates: { x, y }, terrain: 'floor', elevation: 0,
        movementCost: 5, blocksMovement: false, blocksLoS: false, decoration: null, effects: [],
      });
    }
  }
  return prepareCompanionReactionsMapData({
    dimensions: { width: 16, height: 12 }, tiles, theme: 'dungeon', seed: 38,
  });
}

function makeCharacters(): CombatCharacter[] {
  return prepareCompanionReactionsCharacters([
    createMockCombatCharacter({
      id: COMPANION_REACTIONS_OWNER_ID, name: 'Ranger Owner', team: 'player',
      position: { ...COMPANION_REACTIONS_OWNER_START },
    }),
    createMockCombatCharacter({
      id: COMPANION_REACTIONS_COMPANION_ID, name: 'Guardian Companion', team: 'player',
      position: { ...COMPANION_REACTIONS_COMPANION_START },
    }),
    createMockCombatCharacter({
      id: COMPANION_REACTIONS_SECOND_COMPANION_ID, name: 'Second Guardian', team: 'player',
      position: { ...COMPANION_REACTIONS_SECOND_COMPANION_START },
    }),
    createMockCombatCharacter({
      id: COMPANION_REACTIONS_ALLY_ID, name: 'Protected Ally', team: 'player',
      position: { ...COMPANION_REACTIONS_ALLY_START }, currentHP: 30, maxHP: 30,
    }),
    createMockCombatCharacter({
      id: COMPANION_REACTIONS_ATTACKER_ID, name: 'Hostile Attacker', team: 'enemy',
      position: { ...COMPANION_REACTIONS_ATTACKER_START },
    }),
  ]);
}

function initialState(): ScenarioState {
  return {
    mapData: makeMap(),
    characters: makeCharacters(),
    logMessage: '',
    controlValues: {
      reaction_case: 'qualifying_attack',
      responder_choice: 'accept_primary',
      turn_reset_actor: 'owner',
    },
  };
}

function apply(state: ScenarioState, controlId: string, value: string | boolean): ScenarioState {
  const controlValues = { ...state.controlValues, [controlId]: value };
  const patch = companionReactionsScenarioControls.applyControl({
    controlId,
    value,
    snapshot: {
      mapData: state.mapData,
      characters: state.characters,
      activeLightSources: [],
      reactiveTriggers: [],
      spellZones: [],
      controlValues,
      turnState: {
        currentTurn: 1,
        turnOrder: [
          COMPANION_REACTIONS_ATTACKER_ID,
          COMPANION_REACTIONS_SECOND_COMPANION_ID,
          COMPANION_REACTIONS_OWNER_ID,
          COMPANION_REACTIONS_COMPANION_ID,
          COMPANION_REACTIONS_ALLY_ID,
        ],
        currentCharacterId: COMPANION_REACTIONS_ATTACKER_ID,
        phase: 'resolution',
        actionsThisTurn: [],
      },
    },
  });
  return {
    mapData: patch.mapData ?? state.mapData,
    characters: patch.characters ?? state.characters,
    logMessage: patch.logMessage,
    controlValues,
  };
}

function actor(state: ScenarioState, id: string): CombatCharacter {
  const found = state.characters.find(character => character.id === id);
  if (!found) throw new Error(`Missing Companion Reactions actor ${id}.`);
  return found;
}

describe('companion reactions successful mounted transaction', () => {
  it('accepts the primary responder, reduces before HP, and spends only that Reaction', () => {
    const result = apply(initialState(), 'resolve_attack', true);

    expect(actor(result, COMPANION_REACTIONS_ALLY_ID).currentHP).toBe(25);
    expect(actor(result, COMPANION_REACTIONS_COMPANION_ID).actionEconomy.reaction.used).toBe(true);
    expect(actor(result, COMPANION_REACTIONS_OWNER_ID).actionEconomy.reaction.used).toBe(false);
    expect(actor(result, COMPANION_REACTIONS_SECOND_COMPANION_ID).actionEconomy.reaction.used).toBe(false);
    expect(actor(result, COMPANION_REACTIONS_ALLY_ID).actionEconomy.reaction.used).toBe(false);
    expect(actor(result, COMPANION_REACTIONS_COMPANION_ID).summonMetadata).toMatchObject({
      casterId: COMPANION_REACTIONS_OWNER_ID,
      sourceName: 'Primal Companion',
      initiativePolicy: 'shared',
    });
    expect(result.logMessage).toContain('14 Slashing incoming - 6 (1d10) - 3 proficiency = 5 damage');
    expect(result.mapData.tiles.get('6-5')?.environmentalEffects?.[0]?.effect.name)
      .toBe('Interception Protected');
  });

  it('orders two eligible responders and spends only the explicitly selected second companion', () => {
    let state = apply(initialState(), 'reaction_case', 'multiple_responders');
    state = apply(state, 'responder_choice', 'accept_secondary');
    const result = apply(state, 'resolve_attack', true);

    expect(actor(result, COMPANION_REACTIONS_ALLY_ID).currentHP).toBe(25);
    expect(actor(result, COMPANION_REACTIONS_COMPANION_ID).actionEconomy.reaction.used).toBe(false);
    expect(actor(result, COMPANION_REACTIONS_SECOND_COMPANION_ID).actionEconomy.reaction.used).toBe(true);
    expect(result.logMessage).toContain('selected Second Guardian');
  });

  it('declines explicitly, applies full damage, and spends no Reaction', () => {
    const chosen = apply(initialState(), 'responder_choice', 'decline');
    const result = apply(chosen, 'resolve_attack', true);

    expect(actor(result, COMPANION_REACTIONS_ALLY_ID).currentHP).toBe(16);
    expect(actor(result, COMPANION_REACTIONS_COMPANION_ID).actionEconomy.reaction.used).toBe(false);
    expect(actor(result, COMPANION_REACTIONS_SECOND_COMPANION_ID).actionEconomy.reaction.used).toBe(false);
    expect(result.logMessage).toContain('DECLINED');
  });
});

describe('companion reactions rejection and reset controls', () => {
  it.each([
    ['wrong_attacker_sight', 'attacker_not_visible', 16],
    ['out_of_range', 'protected_target_out_of_range', 16],
    ['companion_incapacitated', 'protector_incapacitated', 16],
    ['companion_reaction_spent', 'protector_reaction_unavailable', 16],
    ['missing_equipment', 'protector_missing_weapon_or_shield', 16],
    ['missing_feature', 'protector_missing_interception', 16],
    ['attack_missed', 'attack_missed', 30],
    ['zero_damage', 'no_incoming_damage', 30],
    ['nonqualifying_attack', 'attacker_not_hostile', 16],
  ] as const)('rejects %s without reaction effect or payment', (choice, reason, expectedHP) => {
    const configured = apply(initialState(), 'reaction_case', choice);
    const result = apply(configured, 'resolve_attack', true);

    expect(result.logMessage).toContain(reason);
    expect(actor(result, COMPANION_REACTIONS_ALLY_ID).currentHP).toBe(expectedHP);
    expect(actor(result, COMPANION_REACTIONS_OWNER_ID).actionEconomy.reaction.used).toBe(false);
    if (choice !== 'companion_reaction_spent') {
      expect(actor(result, COMPANION_REACTIONS_COMPANION_ID).actionEconomy.reaction.used).toBe(false);
    }
  });

  it('claims a duplicate stable event so prompt, reduction, Reaction, and HP happen once', () => {
    const configured = apply(initialState(), 'reaction_case', 'duplicate_event');
    const result = apply(configured, 'resolve_attack', true);

    expect(actor(result, COMPANION_REACTIONS_ALLY_ID).currentHP).toBe(25);
    expect(actor(result, COMPANION_REACTIONS_COMPANION_ID).actionEconomy.reaction.used).toBe(true);
    expect(result.logMessage).toContain('REPLAY duplicate_event');
    expect(result.logMessage).toContain('no prompt, reduction, Reaction payment, or HP effect may repeat');
  });

  it('resets only the actor whose own turn starts, then restores the board baseline', () => {
    const resolved = apply(initialState(), 'resolve_attack', true);
    const ownerTurn = apply(resolved, 'turn_reset_actor', 'owner');

    expect(actor(ownerTurn, COMPANION_REACTIONS_OWNER_ID).actionEconomy.reaction.used).toBe(false);
    expect(actor(ownerTurn, COMPANION_REACTIONS_COMPANION_ID).actionEconomy.reaction.used).toBe(true);

    const companionTurn = apply(ownerTurn, 'turn_reset_actor', 'primary_companion');
    expect(actor(companionTurn, COMPANION_REACTIONS_COMPANION_ID).actionEconomy.reaction.used).toBe(false);
    expect(actor(companionTurn, COMPANION_REACTIONS_OWNER_ID).actionEconomy.reaction.used).toBe(false);

    const reset = prepareCompanionReactionsCharacters(companionTurn.characters);
    expect(reset.find(character => character.id === COMPANION_REACTIONS_ALLY_ID)).toMatchObject({
      currentHP: COMPANION_REACTIONS_ALLY_MAX_HP,
      position: COMPANION_REACTIONS_ALLY_START,
    });
    expect(reset.find(character => character.id === COMPANION_REACTIONS_COMPANION_ID)?.actionEconomy.reaction.used)
      .toBe(false);
  });
});
