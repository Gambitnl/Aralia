/**
 * This file proves CS36's adapter stays a deterministic input layer.
 *
 * It verifies the canonical spell is mounted on the retaliator, selectors write
 * real actor/map/resource facts, Resolve Attack requests the normal ability
 * path with fixed rolls, Replay requests stable event redelivery, and Reset
 * restores only scenario-owned state.
 *
 * Exercises: reactiveDamageRetaliationScenarioControls.
 * Depends on: shared scenario control snapshot and mock combat characters.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import reactiveDamageRetaliationScenarioControls, {
  REACTIVE_DAMAGE_ATTACKER_ID,
  REACTIVE_DAMAGE_ATTACKER_MAX_HP,
  REACTIVE_DAMAGE_ATTACKER_OUT_OF_RANGE,
  REACTIVE_DAMAGE_ATTACKER_START,
  REACTIVE_DAMAGE_ATTACK,
  REACTIVE_DAMAGE_RETALIATOR_ID,
  REACTIVE_DAMAGE_RETALIATOR_MAX_HP,
  REACTIVE_DAMAGE_RETALIATOR_START,
  REACTIVE_DAMAGE_SIGHT_BLOCKER,
  prepareReactiveDamageRetaliationCharacters,
  prepareReactiveDamageRetaliationMapData,
} from '../reactiveDamageRetaliationScenarioControls';

interface ScenarioState {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  controlValues: Record<string, string | boolean>;
}

function makeTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`, coordinates: { x, y }, terrain: 'floor', elevation: 0,
    movementCost: 5, blocksMovement: false, blocksLoS: false,
    decoration: null, effects: [], environmentalEffects: [],
  };
}

function makeMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const tile = makeTile(x, y);
      tiles.set(tile.id, tile);
    }
  }
  return prepareReactiveDamageRetaliationMapData({
    dimensions: { width: 16, height: 12 }, tiles, theme: 'dungeon', seed: 36,
  });
}

function makeCharacters(): CombatCharacter[] {
  const attacker = createMockCombatCharacter({
    id: REACTIVE_DAMAGE_ATTACKER_ID, name: 'Blade Initiate',
    position: { ...REACTIVE_DAMAGE_ATTACKER_START }, team: 'player',
    currentHP: REACTIVE_DAMAGE_ATTACKER_MAX_HP, maxHP: REACTIVE_DAMAGE_ATTACKER_MAX_HP,
  });
  const retaliator = createMockCombatCharacter({
    id: REACTIVE_DAMAGE_RETALIATOR_ID, name: 'Infernal Adept',
    position: { ...REACTIVE_DAMAGE_RETALIATOR_START }, team: 'enemy', level: 5,
    currentHP: REACTIVE_DAMAGE_RETALIATOR_MAX_HP, maxHP: REACTIVE_DAMAGE_RETALIATOR_MAX_HP,
    spellcastingAbility: 'charisma',
  });
  return prepareReactiveDamageRetaliationCharacters([attacker, retaliator]);
}

function initialState(): ScenarioState {
  return {
    mapData: makeMap(),
    characters: makeCharacters(),
    controlValues: { trigger_case: 'qualifying_hit', attacker_defense: 'failed_save' },
  };
}

function apply(state: ScenarioState, controlId: string, value: string | boolean) {
  const controlValues = { ...state.controlValues, [controlId]: value };
  const patch = reactiveDamageRetaliationScenarioControls.applyControl({
    controlId,
    value,
    snapshot: {
      mapData: state.mapData,
      characters: state.characters,
      activeLightSources: [], reactiveTriggers: [], spellZones: [], controlValues,
    },
  });
  return {
    state: {
      mapData: patch.mapData ?? state.mapData,
      characters: patch.characters ?? state.characters,
      controlValues,
    },
    patch,
  };
}

function actor(state: ScenarioState, id: string): CombatCharacter {
  return state.characters.find(character => character.id === id)!;
}

describe('reactive damage scenario registration and reset', () => {
  it('registers four visible controls including normal resolve and stable replay', () => {
    expect(reactiveDamageRetaliationScenarioControls.controls.map(control => control.id)).toEqual([
      'trigger_case', 'attacker_defense', 'resolve_exchange', 'replay_event',
    ]);
    expect(reactiveDamageRetaliationScenarioControls.controls[0].options?.map(option => option.value))
      .toContain('empty_spell_slot');
    expect(reactiveDamageRetaliationScenarioControls.controls[1].options?.map(option => option.value))
      .toContain('successful_save');
  });

  it('mounts canonical Hellish Rebuke and restores HP, Reaction, slot, positions, and event markers', () => {
    const state = initialState();
    const retaliator = actor(state, REACTIVE_DAMAGE_RETALIATOR_ID);

    expect(retaliator.abilities?.map(ability => ability.spell?.id)).toContain('hellish-rebuke');
    expect(retaliator.actionEconomy.reaction.used).toBe(false);
    expect(retaliator.spellSlots?.level_1).toEqual({ current: 1, max: 1 });
    expect(retaliator.currentHP).toBe(REACTIVE_DAMAGE_RETALIATOR_MAX_HP);
    expect(actor(state, REACTIVE_DAMAGE_ATTACKER_ID).position).toEqual(REACTIVE_DAMAGE_ATTACKER_START);

    const marked = {
      ...state.mapData,
      tiles: new Map(state.mapData.tiles),
    };
    const tile = marked.tiles.get('7-5')!;
    marked.tiles.set('7-5', { ...tile, effects: ['reactive-damage-event-damage-1', 'foreign'] });
    expect(prepareReactiveDamageRetaliationMapData(marked).tiles.get('7-5')?.effects).toEqual(['foreign']);
  });
});

describe('reactive damage scenario deterministic inputs', () => {
  it.each([
    ['out_of_range', (state: ScenarioState) => expect(actor(state, REACTIVE_DAMAGE_ATTACKER_ID).position).toEqual(REACTIVE_DAMAGE_ATTACKER_OUT_OF_RANGE)],
    ['blocked_line_of_sight', (state: ScenarioState) => expect(state.mapData.tiles.get(`${REACTIVE_DAMAGE_SIGHT_BLOCKER.x}-${REACTIVE_DAMAGE_SIGHT_BLOCKER.y}`)).toMatchObject({ blocksLoS: true, blocksMovement: true })],
    ['reaction_spent', (state: ScenarioState) => expect(actor(state, REACTIVE_DAMAGE_RETALIATOR_ID).actionEconomy.reaction.used).toBe(true)],
    ['empty_spell_slot', (state: ScenarioState) => expect(actor(state, REACTIVE_DAMAGE_RETALIATOR_ID).spellSlots?.level_1.current).toBe(0)],
    ['retaliator_incapacitated', (state: ScenarioState) => expect(actor(state, REACTIVE_DAMAGE_RETALIATOR_ID).conditions?.map(condition => condition.name)).toContain('Incapacitated')],
    ['retaliator_downed_by_hit', (state: ScenarioState) => expect(actor(state, REACTIVE_DAMAGE_RETALIATOR_ID).currentHP).toBe(6)],
  ] as const)('writes real state for %s', (choice, assertState) => {
    assertState(apply(initialState(), 'trigger_case', choice).state);
  });

  it('requests a normal attack with fixed hit, damage, and failed-save sources', () => {
    const result = apply(initialState(), 'resolve_exchange', true).patch.abilityExecution;

    expect(result).toMatchObject({
      ability: REACTIVE_DAMAGE_ATTACK,
      casterId: REACTIVE_DAMAGE_ATTACKER_ID,
      targetId: REACTIVE_DAMAGE_RETALIATOR_ID,
    });
    expect(Math.floor(result!.attackRollRng!() * 20) + 1).toBe(15);
    expect(Math.floor(result!.damageRng!() * 10) + 1).toBe(6);
    expect(Math.floor(result!.saveRng!() * 20) + 1).toBe(5);
  });

  it('selects a natural miss and a successful Dexterity save without authoring results', () => {
    const missed = apply(apply(initialState(), 'trigger_case', 'attack_missed').state, 'resolve_exchange', true).patch.abilityExecution!;
    const saved = apply(apply(initialState(), 'attacker_defense', 'successful_save').state, 'resolve_exchange', true).patch.abilityExecution!;

    expect(Math.floor(missed.attackRollRng!() * 20) + 1).toBe(1);
    expect(Math.floor(saved.saveRng!() * 20) + 1).toBe(18);
  });

  it('requests exact production replay on a separate control invocation', () => {
    expect(apply(initialState(), 'replay_event', true).patch).toMatchObject({
      replayLatestPostDamageEvent: true,
      logMessage: '',
    });
  });
});
