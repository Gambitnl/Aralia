/**
 * This file proves the Stealth & Hidden adapter against canonical state.
 *
 * It covers exact defaults, cover/light/sense preparation, Hide and observer
 * resolution, movement reveal, attack bridging, and stable replay ids. The
 * adapter is pure; production runtime tests own the underlying rule details.
 *
 * Called by: focused Tactical Sandbox Vitest proof.
 * Depends on: stealthHiddenScenarioControls and combat-state factories.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core/factories';
import stealthHiddenScenarioControls, {
  STEALTH_HIDDEN_OBSERVER_ID,
  STEALTH_HIDDEN_STATUS_ID,
  STEALTH_HIDDEN_TARGET_ID,
} from '../stealthHiddenScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

function tile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'grass',
    elevation: 0,
    movementCost: 5,
    blocksLoS: false,
    blocksMovement: false,
    providesCover: x === 5 || x === 10,
    decoration: null,
    effects: [],
  };
}

function mapData(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const next = tile(x, y);
      tiles.set(next.id, next);
    }
  }
  return { dimensions: { width: 16, height: 12 }, tiles, theme: 'forest', seed: 238 };
}

function characters(): CombatCharacter[] {
  return [
    createMockCombatCharacter({
      id: STEALTH_HIDDEN_OBSERVER_ID,
      team: 'player',
      position: { x: 3, y: 5 },
      stats: { wisdom: 12, senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 } },
    }),
    createMockCombatCharacter({
      id: STEALTH_HIDDEN_TARGET_ID,
      team: 'enemy',
      position: { x: 10, y: 5 },
      statusEffects: [{
        id: 'other-hidden',
        name: 'Hidden',
        type: 'buff',
        duration: 3,
        source: 'another-feature',
      }],
    }),
  ];
}

function snapshot(
  controlValues: Record<string, string> = {
    'environment-case': 'cover_bright',
    'perception-case': 'passive_low',
    'stealth-step': 'apply_hide',
  },
): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: mapData(),
    characters: characters(),
    activeLightSources: [],
    reactiveTriggers: [],
    controlValues,
  };
}

describe('stealthHiddenScenarioControls', () => {
  it('publishes deterministic selectors, resolve, and replay defaults', () => {
    expect(stealthHiddenScenarioControls.controls.map(control => [control.id, control.defaultValue]))
      .toEqual([
        ['environment-case', 'cover_bright'],
        ['perception-case', 'passive_low'],
        ['stealth-step', 'apply_hide'],
        ['resolve-step', false],
        ['replay-step', false],
      ]);
  });

  it('changes canonical cover, darkness, and Darkvision facts', () => {
    const input = snapshot({
      'environment-case': 'open_dark_darkvision',
      'perception-case': 'passive_low',
      'stealth-step': 'apply_hide',
    });
    const patch = stealthHiddenScenarioControls.applyControl({
      controlId: 'environment-case',
      value: 'open_dark_darkvision',
      snapshot: input,
    });
    const observer = patch.characters?.find(character => character.id === STEALTH_HIDDEN_OBSERVER_ID);

    expect(patch.mapData?.theme).toBe('dungeon');
    expect(patch.mapData?.tiles.get('10-5')?.providesCover).toBe(false);
    expect(observer?.stats.senses?.darkvision).toBe(60);
  });

  it('resolves and atomically replays a DC 14 Hide while preserving other Hidden', () => {
    const input = snapshot();
    const prepared = stealthHiddenScenarioControls.applyControl({
      controlId: 'environment-case',
      value: 'cover_bright',
      snapshot: input,
    });
    const preparedSnapshot = {
      ...input,
      mapData: prepared.mapData ?? input.mapData,
      characters: prepared.characters ?? input.characters,
    };
    const first = stealthHiddenScenarioControls.applyControl({
      controlId: 'resolve-step',
      value: true,
      snapshot: preparedSnapshot,
    });
    const firstCharacters = first.characters ?? input.characters;
    const hidden = firstCharacters.find(character => character.id === STEALTH_HIDDEN_TARGET_ID);
    const replay = stealthHiddenScenarioControls.applyControl({
      controlId: 'replay-step',
      value: true,
      snapshot: { ...preparedSnapshot, characters: firstCharacters },
    });

    expect(hidden?.statusEffects.map(status => status.id)).toEqual(['other-hidden', STEALTH_HIDDEN_STATUS_ID]);
    expect(hidden?.statusEffects.find(status => status.id === STEALTH_HIDDEN_STATUS_ID)?.stealth?.stealthDc).toBe(14);
    expect(replay.logMessage).toContain('REPLAY REPLAYED');
    expect(replay.characters?.find(character => character.id === STEALTH_HIDDEN_TARGET_ID)).toBe(hidden);
  });

  it('uses live high passive Perception and reveals only owned Hidden after open movement', () => {
    const observeSetup = snapshot({
      'environment-case': 'cover_bright',
      'perception-case': 'passive_high',
      'stealth-step': 'observe',
    });
    const preparedObserve = stealthHiddenScenarioControls.applyControl({
      controlId: 'stealth-step',
      value: 'observe',
      snapshot: observeSetup,
    });
    const observed = stealthHiddenScenarioControls.applyControl({
      controlId: 'resolve-step',
      value: true,
      snapshot: {
        ...observeSetup,
        mapData: preparedObserve.mapData ?? observeSetup.mapData,
        characters: preparedObserve.characters ?? observeSetup.characters,
      },
    });
    expect(observed.logMessage).toContain('DETECTED');

    const moveSetup = snapshot({
      'environment-case': 'open_bright',
      'perception-case': 'passive_low',
      'stealth-step': 'move_open',
    });
    const preparedMove = stealthHiddenScenarioControls.applyControl({
      controlId: 'stealth-step',
      value: 'move_open',
      snapshot: moveSetup,
    });
    const moved = stealthHiddenScenarioControls.applyControl({
      controlId: 'resolve-step',
      value: true,
      snapshot: {
        ...moveSetup,
        mapData: preparedMove.mapData ?? moveSetup.mapData,
        characters: preparedMove.characters ?? moveSetup.characters,
      },
    });
    const movedTarget = moved.characters?.find(character => character.id === STEALTH_HIDDEN_TARGET_ID);

    expect(moved.logMessage).toContain('REVEALED');
    expect(movedTarget?.position).toEqual({ x: 8, y: 5 });
    expect(movedTarget?.statusEffects.map(status => status.id)).toEqual(['other-hidden']);
  });

  it('bridges attack and replay through one stable production execution id', () => {
    const input = snapshot({
      'environment-case': 'cover_bright',
      'perception-case': 'passive_low',
      'stealth-step': 'attack',
    });
    const first = stealthHiddenScenarioControls.applyControl({
      controlId: 'resolve-step',
      value: true,
      snapshot: input,
    });
    const replay = stealthHiddenScenarioControls.applyControl({
      controlId: 'replay-step',
      value: true,
      snapshot: input,
    });

    expect(first.abilityExecution).toMatchObject({
      casterId: STEALTH_HIDDEN_TARGET_ID,
      targetId: STEALTH_HIDDEN_OBSERVER_ID,
      executionEventId: 'cs11-attack-cover_bright-passive_low-001',
    });
    expect(replay.abilityExecution?.executionEventId).toBe(first.abilityExecution?.executionEventId);
  });
});
