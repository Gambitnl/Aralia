/**
 * This file proves the CS26 adapter consumes cumulative mounted state.
 *
 * The tests use the same prepared two-actor fixture as the host, then pass each
 * returned roster into the next click. They cover exact base/upcast payment,
 * repeat and off-turn rejection, empty/below-base/cantrip boundaries, visible
 * reason logs, reset scope, and preservation of unrelated actors.
 */

import { describe, expect, it } from 'vitest';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import spellSlotsUpcastingScenarioControls, {
  SPELL_SLOTS_UPCASTING_BASE_DAMAGE,
  SPELL_SLOTS_UPCASTING_BASE_FORMULA,
  SPELL_SLOTS_UPCASTING_CASTER_ID,
  SPELL_SLOTS_UPCASTING_CASTER_START,
  SPELL_SLOTS_UPCASTING_TARGET_HP,
  SPELL_SLOTS_UPCASTING_TARGET_ID,
  SPELL_SLOTS_UPCASTING_TARGET_START,
  SPELL_SLOTS_UPCASTING_UPCAST_DAMAGE,
  SPELL_SLOTS_UPCASTING_UPCAST_FORMULA,
  prepareSpellSlotsUpcastingCharacters,
} from '../spellSlotsUpcastingScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Live Snapshot
// ============================================================================
// The map carries real line-of-sight evidence. The fixture helper runs once,
// exactly as scenario loading does; action controls never call it themselves.
// ============================================================================

function createTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'stone',
    elevation: 0,
    movementCost: 1,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 16; x += 1) {
    for (let y = 0; y < 12; y += 1) tiles.set(`${x}-${y}`, createTile(x, y));
  }
  return { dimensions: { width: 16, height: 12 }, tiles, theme: 'dungeon', seed: 26 };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const characters = prepareSpellSlotsUpcastingCharacters([
    createMockCombatCharacter({
      id: SPELL_SLOTS_UPCASTING_CASTER_ID,
      name: 'Evoker',
      position: { ...SPELL_SLOTS_UPCASTING_CASTER_START },
    }),
    createMockCombatCharacter({
      id: SPELL_SLOTS_UPCASTING_TARGET_ID,
      name: 'Fireball Target',
      position: { ...SPELL_SLOTS_UPCASTING_TARGET_START },
    }),
    createMockCombatCharacter({
      id: 'spell-slots-bystander',
      name: 'Unrelated Bystander',
      position: { x: 2, y: 9 },
    }),
  ]);

  return {
    mapData: createMap(),
    characters,
    activeLightSources: [],
    reactiveTriggers: [],
    spellZones: [],
    turnState: {
      currentTurn: 1,
      turnOrder: [SPELL_SLOTS_UPCASTING_CASTER_ID, SPELL_SLOTS_UPCASTING_TARGET_ID],
      currentCharacterId: SPELL_SLOTS_UPCASTING_CASTER_ID,
      phase: 'action',
      actionsThisTurn: [],
    },
  };
}

function runAction(
  controlId: string,
  snapshot: PreviewCombatScenarioControlSnapshot = createSnapshot(),
) {
  return spellSlotsUpcastingScenarioControls.applyControl({
    controlId,
    value: true,
    snapshot,
  });
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Spell Slots & Upcasting actor ${id}.`);
  return character;
}

// ============================================================================
// Live Resource, Scaling, Failure, And Reset Outcomes
// ============================================================================
// Rejection patches omit characters. That identity-level signal proves the
// adapter did not silently rebuild, move, heal, or clear effects before saying no.
// ============================================================================

describe('spellSlotsUpcastingScenarioControls', () => {
  it('registers six inert live-state actions including both slot boundaries', () => {
    expect(spellSlotsUpcastingScenarioControls.scenarioId).toBe('spell_slots_upcasting');
    expect(spellSlotsUpcastingScenarioControls.controls.map(control => control.id)).toEqual([
      'cast-level-3',
      'cast-level-4',
      'cast-unavailable-level-5',
      'cast-below-base-level-2',
      'cast-cantrip-with-slot',
      'reset-slots-board',
    ]);
    expect(spellSlotsUpcastingScenarioControls.controls.every(control => (
      control.kind === 'action' && control.defaultValue === false
    ))).toBe(true);
  });

  it('pays the live Action and exactly one level-3 slot for base Fireball', () => {
    const result = runAction('cast-level-3');
    const characters = result.characters ?? [];
    const caster = findCharacter(characters, SPELL_SLOTS_UPCASTING_CASTER_ID);
    const target = findCharacter(characters, SPELL_SLOTS_UPCASTING_TARGET_ID);

    expect(caster.actionEconomy.action.used).toBe(true);
    expect(caster.spellSlots?.level_3).toEqual({ current: 0, max: 1 });
    expect(caster.spellSlots?.level_4).toEqual({ current: 1, max: 1 });
    expect(target.currentHP).toBe(SPELL_SLOTS_UPCASTING_TARGET_HP - SPELL_SLOTS_UPCASTING_BASE_DAMAGE);
    expect(result.logMessage).toContain(`${SPELL_SLOTS_UPCASTING_BASE_FORMULA} scales to ${SPELL_SLOTS_UPCASTING_BASE_FORMULA}`);
    expect(result.logMessage).toContain('L3 0/1; L4 1/1; Action spent');
  });

  it('pays only level 4 and applies canonical 8d6 to 9d6 scaling', () => {
    const result = runAction('cast-level-4');
    const characters = result.characters ?? [];
    const caster = findCharacter(characters, SPELL_SLOTS_UPCASTING_CASTER_ID);
    const target = findCharacter(characters, SPELL_SLOTS_UPCASTING_TARGET_ID);

    expect(caster.actionEconomy.action.used).toBe(true);
    expect(caster.spellSlots?.level_3).toEqual({ current: 1, max: 1 });
    expect(caster.spellSlots?.level_4).toEqual({ current: 0, max: 1 });
    expect(target.currentHP).toBe(SPELL_SLOTS_UPCASTING_TARGET_HP - SPELL_SLOTS_UPCASTING_UPCAST_DAMAGE);
    expect(result.logMessage).toContain(`${SPELL_SLOTS_UPCASTING_BASE_FORMULA} scales to ${SPELL_SLOTS_UPCASTING_UPCAST_FORMULA}`);
    expect(result.logMessage).toContain('defenses settle 36 to 36');
  });

  it('rejects a repeated cast from the paid roster without restoring Action, slot, HP, position, or effects', () => {
    const snapshot = createSnapshot();
    const first = runAction('cast-level-3', snapshot);
    const paidCharacters = first.characters ?? snapshot.characters;
    const paidCaster = findCharacter(paidCharacters, SPELL_SLOTS_UPCASTING_CASTER_ID);
    const damagedTarget = findCharacter(paidCharacters, SPELL_SLOTS_UPCASTING_TARGET_ID);
    paidCaster.position = { x: 5, y: 6 };
    damagedTarget.position = { x: 8, y: 6 };
    damagedTarget.activeEffects = [{
      id: 'preserved-effect',
      spellId: 'bless',
      casterId: paidCaster.id,
      sourceName: 'Preserved Effect',
      duration: { type: 'rounds', value: 3 },
      mechanics: {},
    }];
    const repeat = runAction('cast-level-4', { ...snapshot, characters: paidCharacters });

    expect(repeat.characters).toBeUndefined();
    expect(repeat.logMessage).toContain('REJECTED (action_unavailable)');
    expect(paidCaster.actionEconomy.action.used).toBe(true);
    expect(paidCaster.spellSlots?.level_4?.current).toBe(1);
    expect(damagedTarget.currentHP).toBe(28);
    expect(paidCaster.position).toEqual({ x: 5, y: 6 });
    expect(damagedTarget.position).toEqual({ x: 8, y: 6 });
    expect(damagedTarget.activeEffects?.map(effect => effect.id)).toEqual(['preserved-effect']);
  });

  it.each([
    ['cast-unavailable-level-5', 'slot_unavailable'],
    ['cast-below-base-level-2', 'below_base_slot'],
    ['cast-cantrip-with-slot', 'cantrip_slot_forbidden'],
  ])('rejects %s atomically with visible reason %s', (controlId, reason) => {
    const snapshot = createSnapshot();
    const before = snapshot.characters;
    const result = runAction(controlId, snapshot);

    expect(result.characters).toBeUndefined();
    expect(result.logMessage).toContain(`REJECTED (${reason})`);
    expect(snapshot.characters).toBe(before);
    expect(findCharacter(snapshot.characters, SPELL_SLOTS_UPCASTING_CASTER_ID).actionEconomy.action.used).toBe(false);
    expect(findCharacter(snapshot.characters, SPELL_SLOTS_UPCASTING_TARGET_ID).currentHP).toBe(60);
  });

  it('rejects off-turn use before a roll, effect, Action, or slot payment', () => {
    const snapshot = createSnapshot();
    const result = runAction('cast-level-4', {
      ...snapshot,
      turnState: { ...snapshot.turnState!, currentCharacterId: SPELL_SLOTS_UPCASTING_TARGET_ID },
    });

    expect(result.characters).toBeUndefined();
    expect(result.logMessage).toContain('REJECTED (off_turn)');
    expect(findCharacter(snapshot.characters, SPELL_SLOTS_UPCASTING_CASTER_ID).spellSlots?.level_4?.current).toBe(1);
    expect(findCharacter(snapshot.characters, SPELL_SLOTS_UPCASTING_TARGET_ID).currentHP).toBe(60);
  });

  it('Reset restores only the two CS26 actors and requests deterministic turn reinitialization', () => {
    const snapshot = createSnapshot();
    const cast = runAction('cast-level-4', snapshot);
    const liveCharacters = cast.characters ?? snapshot.characters;
    const caster = findCharacter(liveCharacters, SPELL_SLOTS_UPCASTING_CASTER_ID);
    const target = findCharacter(liveCharacters, SPELL_SLOTS_UPCASTING_TARGET_ID);
    const bystander = findCharacter(liveCharacters, 'spell-slots-bystander');
    caster.position = { x: 1, y: 1 };
    target.position = { x: 14, y: 10 };
    bystander.currentHP = 3;
    bystander.position = { x: 2, y: 8 };
    const reset = runAction('reset-slots-board', { ...snapshot, characters: liveCharacters });
    const resetCharacters = reset.characters ?? [];

    expect(reset.reinitializeCombat).toBe(true);
    expect(findCharacter(resetCharacters, SPELL_SLOTS_UPCASTING_CASTER_ID)).toMatchObject({
      position: SPELL_SLOTS_UPCASTING_CASTER_START,
      spellSlots: {
        level_3: { current: 1, max: 1 },
        level_4: { current: 1, max: 1 },
      },
    });
    expect(findCharacter(resetCharacters, SPELL_SLOTS_UPCASTING_CASTER_ID).actionEconomy.action.used).toBe(false);
    expect(findCharacter(resetCharacters, SPELL_SLOTS_UPCASTING_TARGET_ID)).toMatchObject({
      position: SPELL_SLOTS_UPCASTING_TARGET_START,
      currentHP: SPELL_SLOTS_UPCASTING_TARGET_HP,
    });
    expect(findCharacter(resetCharacters, 'spell-slots-bystander')).toBe(bystander);
    expect(bystander).toMatchObject({ currentHP: 3, position: { x: 2, y: 8 } });
    expect(reset.logMessage).toContain('Reset complete');
  });
});
