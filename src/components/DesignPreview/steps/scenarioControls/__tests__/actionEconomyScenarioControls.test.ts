/**
 * This file proves the Action Economy adapter exposes the complete CS 18 workflow.
 *
 * It checks every player-facing resource choice, production transaction dispatch,
 * combined payment, spent rejection, stable replay, turn-manager handoff, and
 * the exact defaults restored by Reset Board. Production mechanics themselves
 * are covered beside actionEconomyResolution; these tests guard the thin bridge.
 */

import { describe, expect, it } from 'vitest';
import type { Ability, CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import actionEconomyScenarioControlModule, {
  actionEconomyScenarioControlModule as namedModule,
} from '../actionEconomyScenarioControls';
import { createPreviewCombatScenarioControlDefaults } from '../PreviewCombatScenarioControlTypes';
import type {
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValue,
} from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Mounted-Contract Fixture
// ============================================================================

const ACTION_SURGE: Ability = {
  id: 'action_surge',
  name: 'Action Surge',
  description: 'Gain one additional Action this turn.',
  type: 'utility',
  cost: { type: 'free' },
  targeting: 'self',
  range: 0,
  effects: [],
  maxUses: 1,
  usesRemaining: 1,
};

function createSnapshot(
  controlValues: Record<string, PreviewCombatScenarioControlValue> = { 'resource-case': 'action' },
): PreviewCombatScenarioControlSnapshot {
  const tester = createMockCombatCharacter({ id: 'action_economy-tester', name: 'Tester' });
  tester.abilities = [...tester.abilities, ACTION_SURGE];
  const target = createMockCombatCharacter({
    id: 'action_economy-target',
    name: 'Target',
    team: 'enemy',
  });
  return {
    mapData: null,
    characters: [tester, target],
    activeLightSources: [],
    reactiveTriggers: [],
    turnState: {
      currentTurn: 1,
      phase: 'action', actionsThisTurn: [],
      turnOrder: [tester.id, target.id],
      currentCharacterId: tester.id,
    },
    controlValues,
  };
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Action Economy actor ${id}.`);
  return character;
}

function applyAction(snapshot: PreviewCombatScenarioControlSnapshot, controlId: string) {
  return actionEconomyScenarioControlModule.applyControl({ controlId, value: true, snapshot });
}

// ============================================================================
// Visible Controls And Exact Reset Defaults
// ============================================================================

describe('actionEconomyScenarioControlModule', () => {
  it('default-exports the complete resource, rejection, replay, and turn workflow', () => {
    expect(actionEconomyScenarioControlModule).toBe(namedModule);
    expect(actionEconomyScenarioControlModule.scenarioId).toBe('action_economy');
    expect(actionEconomyScenarioControlModule.controls).toEqual([
      expect.objectContaining({
        id: 'resource-case',
        label: 'Resource event',
        kind: 'select',
        defaultValue: 'action',
        options: [
          { value: 'action', label: 'Action' },
          { value: 'bonus_action', label: 'Bonus Action' },
          { value: 'reaction_outside_turn', label: 'Reaction outside turn' },
          { value: 'free_interaction', label: 'Free object interaction' },
          { value: 'movement', label: 'Movement (30 ft)' },
          { value: 'combined_sequence', label: 'Combined sequence' },
          { value: 'action_surge', label: 'Action Surge (if advertised)' },
        ],
      }),
      expect.objectContaining({ id: 'resolve-resource-event', kind: 'action', defaultValue: false }),
      expect.objectContaining({ id: 'attempt-spent-resource', kind: 'action', defaultValue: false }),
      expect.objectContaining({ id: 'replay-resource-event', kind: 'action', defaultValue: false }),
      expect.objectContaining({ id: 'advance-turn-boundary', kind: 'action', defaultValue: false }),
    ]);
    expect(createPreviewCombatScenarioControlDefaults(actionEconomyScenarioControlModule)).toEqual({
      'resource-case': 'action',
      'resolve-resource-event': false,
      'attempt-spent-resource': false,
      'replay-resource-event': false,
      'advance-turn-boundary': false,
    });
  });

  it('dispatches every independent resource choice through the production transaction', () => {
    const cases = [
      'action',
      'bonus_action',
      'reaction_outside_turn',
      'free_interaction',
      'movement',
    ];

    for (const resourceCase of cases) {
      const snapshot = createSnapshot({ 'resource-case': resourceCase });
      const patch = applyAction(snapshot, 'resolve-resource-event');
      expect(patch.characters, resourceCase).toBeDefined();
      expect(patch.logMessage, resourceCase).not.toContain('rejected');
    }
  });

  it('runs the combined sequence, rejects a distinct spent use, and no-ops stable replay', () => {
    const baseline = createSnapshot({ 'resource-case': 'combined_sequence' });
    const resolved = applyAction(baseline, 'resolve-resource-event');
    expect(resolved.characters).toBeDefined();

    const spentSnapshot = { ...baseline, characters: resolved.characters! };
    const tester = findCharacter(spentSnapshot.characters, 'action_economy-tester');
    expect(tester.actionEconomy).toMatchObject({
      action: { used: true },
      bonusAction: { used: true },
      movement: { used: 30 },
      freeActions: 0,
    });

    const spentAttempt = applyAction(spentSnapshot, 'attempt-spent-resource');
    const replay = applyAction(spentSnapshot, 'replay-resource-event');
    expect(spentAttempt.characters).toBeUndefined();
    expect(spentAttempt.logMessage).toContain('rejected before mutation');
    expect(replay.characters).toBeUndefined();
    expect(replay.logMessage).toContain('Duplicate action economy event');
  });

  it('delegates owner-versus-other reset timing to one real End Turn request', () => {
    const patch = applyAction(createSnapshot(), 'advance-turn-boundary');
    expect(patch.endTurn).toBe(true);
    expect(patch.characters).toBeUndefined();
    expect(patch.logMessage).toContain('only the next owner');
  });

  it('rejects invalid selections and stale controls without changing combat state', () => {
    const snapshot = createSnapshot({ 'resource-case': 'not-a-resource' });
    const invalid = applyAction(snapshot, 'resolve-resource-event');
    const unknown = applyAction(snapshot, 'stale-control');
    expect(invalid.characters).toBeUndefined();
    expect(invalid.logMessage).toContain('choose a valid resource case');
    expect(unknown.characters).toBeUndefined();
    expect(unknown.logMessage).toContain('Unknown Action Economy scenario control');
  });
});
