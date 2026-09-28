/**
 * This file proves the Healing & Temporary HP controls use canonical HP rules.
 *
 * The fixture matches the mounted board's healer, wounded ally, health totals,
 * and positions. Assertions cover cumulative live state, finite payment,
 * pre-payment rejection, non-stacking temporary HP, damage absorption, and
 * bystander preservation.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import { resetEconomy } from '../../../../../utils/combat/actionEconomyUtils';
import healingTempHpScenarioControls, {
  HEALING_TEMP_HP_ALLY_ID,
  HEALING_TEMP_HP_ALLY_MAX_HP,
  HEALING_TEMP_HP_ALLY_START,
  HEALING_TEMP_HP_ALLY_START_HP,
  HEALING_TEMP_HP_HEALER_ID,
  HEALING_TEMP_HP_HEALER_START,
} from '../healingTempHpScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Scenario Snapshot
// ============================================================================
// Both actors are allies because this board proves support rules rather than
// target legality. A neutral bystander protects disjoint state preservation.
// ============================================================================

function createTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'grass',
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
  for (let x = 0; x < 12; x += 1) {
    for (let y = 0; y < 12; y += 1) tiles.set(`${x}-${y}`, createTile(x, y));
  }
  return { dimensions: { width: 12, height: 12 }, tiles, theme: 'forest', seed: 22 };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: createMap(),
    characters: [
      createMockCombatCharacter({
        id: HEALING_TEMP_HP_HEALER_ID,
        name: 'Field Cleric',
        team: 'player',
        position: { ...HEALING_TEMP_HP_HEALER_START },
        spellSlots: { level_1: { current: 3, max: 3 } },
      }),
      createMockCombatCharacter({
        id: HEALING_TEMP_HP_ALLY_ID,
        name: 'Wounded Ally',
        team: 'player',
        position: { ...HEALING_TEMP_HP_ALLY_START },
        currentHP: HEALING_TEMP_HP_ALLY_START_HP,
        maxHP: HEALING_TEMP_HP_ALLY_MAX_HP,
      }),
      createMockCombatCharacter({
        id: 'healing-temp-hp-bystander',
        name: 'Unrelated Bystander',
        team: 'neutral',
        position: { x: 2, y: 9 },
      }),
    ],
    activeLightSources: [],
    reactiveTriggers: [],
    turnState: {
      currentTurn: 1,
      turnOrder: [HEALING_TEMP_HP_HEALER_ID, HEALING_TEMP_HP_ALLY_ID],
      currentCharacterId: HEALING_TEMP_HP_HEALER_ID,
      phase: 'action',
      actionsThisTurn: [],
    },
  };
}

function runAction(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
) {
  return healingTempHpScenarioControls.applyControl({
    controlId,
    value: true,
    snapshot,
  });
}

function findCharacter(
  characters: CombatCharacter[],
  characterId: string,
): CombatCharacter {
  const character = characters.find(candidate => candidate.id === characterId);
  if (!character) throw new Error(`Missing Healing & Temporary HP actor ${characterId}.`);
  return character;
}

// ============================================================================
// Canonical Outcomes
// ============================================================================
// HP and log assertions jointly prove that the visible explanation matches the
// character state returned by shared combat helpers.
// ============================================================================

describe('healingTempHpScenarioControls', () => {
  it('registers exactly four inert action controls', () => {
    expect(healingTempHpScenarioControls.scenarioId).toBe('healing_temp_hp');
    expect(healingTempHpScenarioControls.controls).toHaveLength(4);
    expect(healingTempHpScenarioControls.controls.every(control => (
      control.kind === 'action' && control.defaultValue === false
    ))).toBe(true);
  });

  it('raises current HP without changing the separate temporary-HP pool', () => {
    const result = runAction(createSnapshot(), 'heal-wounds');
    const ally = findCharacter(result.characters ?? [], HEALING_TEMP_HP_ALLY_ID);
    const healer = findCharacter(result.characters ?? [], HEALING_TEMP_HP_HEALER_ID);

    expect(ally.currentHP).toBe(20);
    expect(ally.maxHP).toBe(24);
    expect(ally.tempHP ?? 0).toBe(0);
    expect(healer.actionEconomy.bonusAction.used).toBe(true);
    expect(healer.spellSlots?.level_1?.current).toBe(2);
    expect(result.logMessage).toContain('12 → 20/24 HP');
  });

  it('caps healing at maximum HP and reports only the amount actually restored', () => {
    const result = runAction(createSnapshot(), 'heal-to-maximum');
    const ally = findCharacter(result.characters ?? [], HEALING_TEMP_HP_ALLY_ID);

    expect(ally.currentHP).toBe(24);
    expect(findCharacter(result.characters ?? [], HEALING_TEMP_HP_HEALER_ID).actionEconomy.action.used).toBe(true);
    expect(result.logMessage).toContain('restores only 12');
    expect(result.logMessage).toContain('Healing cannot exceed maximum HP');
  });

  it('keeps a larger temporary pool, then replaces it with a still larger offer', () => {
    const snapshot = createSnapshot();
    const bystander = findCharacter(snapshot.characters, 'healing-temp-hp-bystander');
    const result = runAction(snapshot, 'temporary-hp-replacement');
    const ally = findCharacter(result.characters ?? [], HEALING_TEMP_HP_ALLY_ID);

    expect(ally.currentHP).toBe(12);
    expect(ally.tempHP).toBe(12);
    expect(result.logMessage).toContain('smaller offer 5 keeps 8 instead of stacking');
    expect(result.logMessage).toContain('larger offer 12 replaces it with 12');
    expect(findCharacter(result.characters ?? [], bystander.id)).toBe(bystander);
  });

  it('keeps cumulative live HP, refreshes only turn economy, then spends temp HP first', () => {
    const snapshot = createSnapshot();
    const firstHeal = runAction(snapshot, 'heal-wounds');
    const secondHeal = runAction(
      { ...snapshot, characters: firstHeal.characters ?? snapshot.characters },
      'heal-to-maximum',
    );
    const nextRoundCharacters = (secondHeal.characters ?? []).map(character => (
      character.id === HEALING_TEMP_HP_HEALER_ID ? resetEconomy(character) : character
    ));
    const protectedResult = runAction(
      { ...snapshot, characters: nextRoundCharacters },
      'temporary-hp-replacement',
    );
    const result = runAction(
      { ...snapshot, characters: protectedResult.characters ?? nextRoundCharacters },
      'damage-through-buffer',
    );
    const ally = findCharacter(result.characters ?? [], HEALING_TEMP_HP_ALLY_ID);

    expect(ally.tempHP).toBe(0);
    expect(ally.currentHP).toBe(21);
    expect(ally.damagedThisTurn).toBe(true);
    expect(result.logMessage).toContain('temporary HP 12 → 0 absorbs 12');
    expect(result.logMessage).toContain('current HP 24 → 21/24');
  });

  it('rejects repeated and off-turn attempts without changing live HP or payment', () => {
    const snapshot = createSnapshot();
    const first = runAction(snapshot, 'heal-wounds');
    const paidCharacters = first.characters ?? snapshot.characters;
    const repeat = runAction({ ...snapshot, characters: paidCharacters }, 'heal-wounds');
    const offTurn = runAction({
      ...snapshot,
      characters: paidCharacters,
      turnState: { ...snapshot.turnState!, currentCharacterId: HEALING_TEMP_HP_ALLY_ID },
    }, 'heal-to-maximum');

    expect(repeat.characters).toBeUndefined();
    expect(repeat.logMessage).toContain('REJECTED (unaffordable_cost)');
    expect(offTurn.characters).toBeUndefined();
    expect(offTurn.logMessage).toContain('REJECTED (off_turn)');
    expect(findCharacter(paidCharacters, HEALING_TEMP_HP_ALLY_ID).currentHP).toBe(20);
    expect(findCharacter(paidCharacters, HEALING_TEMP_HP_HEALER_ID).spellSlots?.level_1?.current).toBe(2);
  });

  it('rejects a canonical invalid target before payment', () => {
    const snapshot = createSnapshot();
    findCharacter(snapshot.characters, HEALING_TEMP_HP_ALLY_ID).creatureTypes = ['Undead'];
    const result = runAction(snapshot, 'heal-wounds');

    expect(result.characters).toBeUndefined();
    expect(result.logMessage).toContain('invalid_target:target_filter_failed');
    expect(findCharacter(snapshot.characters, HEALING_TEMP_HP_HEALER_ID).spellSlots?.level_1?.current).toBe(3);
    expect(findCharacter(snapshot.characters, HEALING_TEMP_HP_ALLY_ID).currentHP).toBe(12);
  });

  it('keeps defaults and malformed controls state-preserving', () => {
    const snapshot = createSnapshot();
    const inert = healingTempHpScenarioControls.applyControl({
      controlId: 'heal-wounds',
      value: false,
      snapshot,
    });
    const malformed = healingTempHpScenarioControls.applyControl({
      controlId: 'heal-wounds',
      value: '8',
      snapshot,
    });

    expect(inert).toEqual({ logMessage: '' });
    expect(malformed.characters).toBeUndefined();
    expect(malformed.logMessage).toContain('requires an action trigger');
  });
});
