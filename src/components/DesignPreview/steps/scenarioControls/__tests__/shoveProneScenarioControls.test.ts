/**
 * This file proves the Shove & Knock Prone controls mutate real combat state.
 *
 * The tests use the live scenario ids and coordinates, then inspect movement,
 * paired Prone records, size eligibility, and wall collision. An unrelated
 * bystander confirms the disjoint control module preserves foreign actors.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import shoveProneScenarioControls, {
  SHOVE_PRONE_DESTINATION_TILE_ID,
  SHOVE_PRONE_SHOVER_ID,
  SHOVE_PRONE_TARGET_ID,
} from '../shoveProneScenarioControls';
import type {
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValue,
} from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Scenario Snapshot
// ============================================================================
// The exact horizontal lane mirrors the live 16-by-12 board. Destination 8-5
// begins as sand and can become the blocking wall owned by the edge selector.
// ============================================================================

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();

  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: y === 5 && x >= 6 && x <= 9 ? 'sand' : 'floor',
        elevation: 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
      });
    }
  }

  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 211,
  };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const shover = createMockCombatCharacter({
    id: SHOVE_PRONE_SHOVER_ID,
    name: 'Shove Tester (Medium)',
    level: 5,
    position: { x: 6, y: 5 },
    team: 'player',
    stats: {
      ...createMockCombatCharacter().stats,
      strength: 16,
      size: 'Medium',
    },
  });
  const target = createMockCombatCharacter({
    id: SHOVE_PRONE_TARGET_ID,
    name: 'Shove Target (Medium)',
    position: { x: 7, y: 5 },
    team: 'enemy',
    stats: {
      ...createMockCombatCharacter().stats,
      strength: 14,
      dexterity: 8,
      size: 'Medium',
    },
  });
  const bystander = createMockCombatCharacter({
    id: 'shove-prone-bystander',
    name: 'Unrelated Bystander',
    position: { x: 12, y: 9 },
    team: 'neutral',
  });

  return {
    mapData: createMap(),
    characters: [shover, target, bystander],
    activeLightSources: [],
    reactiveTriggers: [],
    turnState: {
      currentTurn: 1,
      turnOrder: [SHOVE_PRONE_SHOVER_ID, SHOVE_PRONE_TARGET_ID, bystander.id],
      currentCharacterId: SHOVE_PRONE_SHOVER_ID,
      phase: 'action',
      actionsThisTurn: [],
    },
    controlValues: { 'edge-case': 'open_strength' },
  };
}

function applyControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
) {
  return shoveProneScenarioControls.applyControl({ controlId, value, snapshot });
}

function findCharacter(characters: CombatCharacter[], characterId: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === characterId);
  if (!character) throw new Error(`Missing Shove & Knock Prone actor ${characterId}.`);
  return character;
}

function applyPatch(
  snapshot: PreviewCombatScenarioControlSnapshot,
  patch: ReturnType<typeof applyControl>,
  controlValues: PreviewCombatScenarioControlSnapshot['controlValues'] = snapshot.controlValues,
): PreviewCombatScenarioControlSnapshot {
  // Mounted controls apply these same state fragments to the host. Rebuilding
  // the next pure snapshot proves repeat and select-then-action behavior.
  return {
    ...snapshot,
    mapData: patch.mapData ?? snapshot.mapData,
    characters: patch.characters ?? snapshot.characters,
    controlValues,
  };
}

// ============================================================================
// Control Contract And Outcomes
// ============================================================================
// Each action changes one rule fact. The edge selector owns two validation cases
// while its default restores the open, eligible launch state.
// ============================================================================

describe('shoveProneScenarioControls', () => {
  it('registers three action controls and one four-state defense/edge selector', () => {
    expect(shoveProneScenarioControls.scenarioId).toBe('shove_prone');
    expect(shoveProneScenarioControls.controls).toHaveLength(4);
    expect(shoveProneScenarioControls.controls.map(control => control.kind)).toEqual([
      'action',
      'action',
      'action',
      'select',
    ]);
    expect(shoveProneScenarioControls.controls[3].options).toHaveLength(4);
  });

  it('shows the successful-save reason without changing target state', () => {
    const snapshot = createSnapshot();
    const originalTarget = findCharacter(snapshot.characters, SHOVE_PRONE_TARGET_ID);
    const result = applyControl(snapshot, 'save-succeeds', true);
    const target = findCharacter(result.characters ?? [], SHOVE_PRONE_TARGET_ID);

    expect(target.position).toEqual({ x: 7, y: 5 });
    expect(target.conditions).toHaveLength(0);
    expect(result.logMessage).toContain('Strength save d20 18, total 20 vs DC 14');
    expect(result.logMessage).toContain('Attack spent; 0 remaining');
    expect(result.logMessage).toContain('position and conditions are unchanged');
    expect(originalTarget.position).toEqual({ x: 7, y: 5 });
  });

  it('pushes on a failed save and preserves the unrelated bystander', () => {
    const snapshot = createSnapshot();
    const originalBystander = findCharacter(snapshot.characters, 'shove-prone-bystander');
    const result = applyControl(snapshot, 'push-away', true);
    const target = findCharacter(result.characters ?? [], SHOVE_PRONE_TARGET_ID);

    expect(target.position).toEqual({ x: 8, y: 5 });
    expect(result.logMessage).toContain('failed its Strength save d20 1, total 3 vs DC 14');
    expect(result.logMessage).toContain('pushed 5 feet to 8,5');
    expect(findCharacter(result.characters ?? [], 'shove-prone-bystander')).toBe(originalBystander);
  });

  it('applies paired Prone state on the alternate failed-save choice', () => {
    const snapshot = createSnapshot();
    const result = applyControl(snapshot, 'knock-prone', true);
    const target = findCharacter(result.characters ?? [], SHOVE_PRONE_TARGET_ID);

    expect(target.position).toEqual({ x: 7, y: 5 });
    expect(target.conditions).toContainEqual(expect.objectContaining({
      name: 'Prone',
      source: 'Unarmed Strike: Shove',
    }));
    expect(target.statusEffects).toContainEqual(expect.objectContaining({
      name: 'Prone',
      effect: { type: 'condition' },
    }));
    expect(result.logMessage).toContain('gained Prone');
    expect(target.statusEffects).toContainEqual(expect.objectContaining({
      name: 'Prone',
      persistsUntilRemoved: true,
    }));
    expect(target.conditions).toContainEqual(expect.objectContaining({
      name: 'Prone',
      duration: { type: 'permanent' },
    }));
  });

  it('routes the defender-selected Dexterity modifier through the shared save', () => {
    const snapshot = createSnapshot();
    const setup = applyControl(snapshot, 'edge-case', 'open_dexterity');
    const prepared = applyPatch(snapshot, setup, { 'edge-case': 'open_dexterity' });
    const result = applyControl(prepared, 'save-succeeds', true);

    expect(result.logMessage).toContain('Dexterity save d20 18, total 17 vs DC 14');
    expect(result.logMessage).not.toContain('Strength save');
  });

  it('does not let a setup selector clear Prone or refresh the spent attack', () => {
    const snapshot = createSnapshot();
    const prone = applyControl(snapshot, 'knock-prone', true);
    const afterProne = applyPatch(snapshot, prone);
    const selected = applyControl(afterProne, 'edge-case', 'open_dexterity');
    const target = findCharacter(selected.characters ?? [], SHOVE_PRONE_TARGET_ID);
    const shover = findCharacter(selected.characters ?? [], SHOVE_PRONE_SHOVER_ID);

    // The selector changes only authored setup facts. Stand Up or Reset Board
    // must own condition removal, and turn resources never refresh here.
    expect(target.statusEffects.map(effect => effect.name)).toContain('Prone');
    expect(target.conditions?.map(condition => condition.name)).toContain('Prone');
    expect(shover.actionEconomy.action).toEqual({ used: true, remaining: 0 });
  });

  it('distinguishes a blocked destination from an ineligible Huge target', () => {
    const snapshot = createSnapshot();
    const blockedSetup = applyControl(snapshot, 'edge-case', 'blocked_destination');
    const blockedSnapshot = applyPatch(
      snapshot,
      blockedSetup,
      { 'edge-case': 'blocked_destination' },
    );
    const blocked = applyControl(blockedSnapshot, 'push-away', true);
    const blockedTarget = findCharacter(blocked.characters ?? [], SHOVE_PRONE_TARGET_ID);

    expect(blockedSnapshot.mapData?.tiles.get(SHOVE_PRONE_DESTINATION_TILE_ID)).toMatchObject({
      terrain: 'wall',
      blocksMovement: true,
      blocksLoS: true,
    });
    expect(blockedTarget.position).toEqual({ x: 7, y: 5 });
    expect(blocked.logMessage).toContain('failed its Strength save d20 1');
    expect(blocked.logMessage).toContain('destination is blocked');

    const tooLargeSetup = applyControl(snapshot, 'edge-case', 'too_large');
    const tooLargeSnapshot = applyPatch(
      snapshot,
      tooLargeSetup,
      { 'edge-case': 'too_large' },
    );
    const tooLarge = applyControl(tooLargeSnapshot, 'push-away', true);
    const hugeTarget = findCharacter(tooLarge.characters ?? [], SHOVE_PRONE_TARGET_ID);

    expect(hugeTarget.stats.size).toBe('Huge');
    expect(hugeTarget.position).toEqual({ x: 7, y: 5 });
    expect(tooLarge.logMessage).toContain('more than one size larger');
    expect(tooLarge.logMessage).not.toContain('d20');
  });

  it('rejects off-turn use and exhausted repeats without changing canonical state', () => {
    const snapshot = createSnapshot();
    const offTurnSnapshot = {
      ...snapshot,
      turnState: {
        ...snapshot.turnState!,
        currentCharacterId: SHOVE_PRONE_TARGET_ID,
      },
    };
    const offTurn = applyControl(offTurnSnapshot, 'knock-prone', true);

    expect(offTurn.logMessage).toContain('not Shove Tester');
    expect(offTurn.logMessage).toContain('no attack was spent');
    expect(offTurn.characters).toEqual(snapshot.characters);

    const first = applyControl(snapshot, 'save-succeeds', true);
    const afterFirst = applyPatch(snapshot, first);
    const repeat = applyControl(afterFirst, 'knock-prone', true);
    const targetAfterRepeat = findCharacter(repeat.characters ?? [], SHOVE_PRONE_TARGET_ID);
    const shoverAfterRepeat = findCharacter(repeat.characters ?? [], SHOVE_PRONE_SHOVER_ID);

    expect(first.logMessage).toContain('Attack spent; 0 remaining');
    expect(repeat.logMessage).toContain('no Attack-action attack remaining');
    expect(repeat.logMessage).toContain('before the roll');
    expect(shoverAfterRepeat.actionEconomy.action).toEqual({ used: true, remaining: 0 });
    expect(targetAfterRepeat.statusEffects.map(effect => effect.name)).not.toContain('Prone');
  });

  it('keeps action defaults and malformed ids as state-preserving no-ops', () => {
    const snapshot = createSnapshot();
    const inert = applyControl(snapshot, 'push-away', false);
    const unknown = applyControl(snapshot, 'old-shove-control', true);

    expect(inert.characters).toBeUndefined();
    expect(unknown.characters).toBeUndefined();
    expect(unknown.logMessage).toContain('Unknown');
  });
});
