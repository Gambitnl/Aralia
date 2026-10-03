/**
 * This file proves the shared action-economy transaction is atomic and actor-local.
 *
 * The cases cover every independent resource, the all-resource sequence,
 * out-of-turn Reactions, spent rejection, stable replay, advertised Action
 * Surge, and own-turn reset timing. These are production-state assertions, not
 * labels or teaching-UI simulations.
 */

import { describe, expect, it } from 'vitest';
import type { Ability, CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core';
import {
  resetOnlyTurnOwnerEconomy,
  resolveActionEconomyEvent,
  type ActionEconomyResourceCase,
} from '../actionEconomyResolution';

// ============================================================================
// Deterministic Combat Fixture
// ============================================================================
// The tester owns the turn. The target is deliberately off-turn so its Reaction
// can be spent without accidentally refreshing or spending any tester resource.
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

function createCharacters(): CombatCharacter[] {
  const tester = createMockCombatCharacter({
    id: 'action_economy-tester',
    name: 'Action Economy Tester',
  });
  tester.abilities = [...tester.abilities, ACTION_SURGE];
  const target = createMockCombatCharacter({
    id: 'action_economy-target',
    name: 'Action Economy Target',
    team: 'enemy',
  });
  return [tester, target];
}

function resolveCase(
  characters: CombatCharacter[],
  resourceCase: ActionEconomyResourceCase,
  eventId = `cs18-${resourceCase}-1`,
  delivery: 'resolve' | 'replay' = 'resolve',
) {
  return resolveActionEconomyEvent({
    characters,
    actorId: 'action_economy-tester',
    reactionActorId: 'action_economy-target',
    currentTurnOwnerId: 'action_economy-tester',
    eventId,
    resourceCase,
    delivery,
  });
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing action-economy fixture ${id}.`);
  return character;
}

// ============================================================================
// Independent Payments And Atomic Rejection
// ============================================================================

describe('resolveActionEconomyEvent', () => {
  it.each([
    ['action', 'action'],
    ['bonus_action', 'bonusAction'],
    ['free_interaction', 'freeActions'],
    ['movement', 'movement'],
  ] as const)('spends only the selected %s resource', (resourceCase, resourceKey) => {
    const before = createCharacters();
    const result = resolveCase(before, resourceCase);
    const tester = findCharacter(result.characters, 'action_economy-tester');

    expect(result.outcome).toBe('accepted');
    if (resourceKey === 'action') expect(tester.actionEconomy.action.used).toBe(true);
    if (resourceKey === 'bonusAction') expect(tester.actionEconomy.bonusAction.used).toBe(true);
    if (resourceKey === 'freeActions') expect(tester.actionEconomy.freeActions).toBe(0);
    if (resourceKey === 'movement') expect(tester.actionEconomy.movement.used).toBe(30);
    expect(tester.actionEconomy.reaction.used).toBe(false);
  });

  it('spends a Reaction outside its owner turn without changing the active actor', () => {
    const before = createCharacters();
    const result = resolveCase(before, 'reaction_outside_turn');

    expect(result.outcome).toBe('accepted');
    expect(findCharacter(result.characters, 'action_economy-target').actionEconomy.reaction.used).toBe(true);
    expect(findCharacter(result.characters, 'action_economy-tester')).toBe(before[0]);
  });

  it('applies the combined sequence atomically, then rejects a new spent attempt without mutation', () => {
    const first = resolveCase(createCharacters(), 'combined_sequence');
    const tester = findCharacter(first.characters, 'action_economy-tester');
    const target = findCharacter(first.characters, 'action_economy-target');

    expect(tester.actionEconomy).toMatchObject({
      action: { used: true },
      bonusAction: { used: true },
      movement: { used: 30, total: 30 },
      freeActions: 0,
    });
    expect(target.actionEconomy.reaction.used).toBe(true);

    const rejected = resolveCase(first.characters, 'combined_sequence', 'cs18-combined-2');
    expect(rejected.outcome).toBe('rejected');
    expect(rejected.characters).toBe(first.characters);
  });

  it('makes stable replay a complete no-op after the first accepted delivery', () => {
    const first = resolveCase(createCharacters(), 'movement', 'cs18-move-stable');
    const replay = resolveCase(first.characters, 'movement', 'cs18-move-stable', 'replay');

    expect(replay.outcome).toBe('duplicate');
    expect(replay.characters).toBe(first.characters);
    expect(findCharacter(replay.characters, 'action_economy-tester').actionEconomy.movement.used).toBe(30);
  });

  it('refreshes one Action only when Action Surge is advertised and preserves every other resource', () => {
    const spentAction = resolveCase(createCharacters(), 'action');
    const beforeSurge = findCharacter(spentAction.characters, 'action_economy-tester');
    const surged = resolveCase(spentAction.characters, 'action_surge');
    const afterSurge = findCharacter(surged.characters, 'action_economy-tester');

    expect(surged.outcome).toBe('accepted');
    expect(afterSurge.actionEconomy.action).toEqual({ used: false, remaining: 1 });
    expect(afterSurge.actionEconomy.bonusAction).toEqual(beforeSurge.actionEconomy.bonusAction);
    expect(afterSurge.actionEconomy.reaction).toEqual(beforeSurge.actionEconomy.reaction);
    expect(afterSurge.actionEconomy.movement).toEqual(beforeSurge.actionEconomy.movement);
    expect(afterSurge.actionEconomy.freeActions).toBe(beforeSurge.actionEconomy.freeActions);
    expect(afterSurge.abilities.find(ability => ability.id === 'action_surge')?.usesRemaining).toBe(0);

    const hidden = createCharacters().map(character => (
      character.id === 'action_economy-tester'
        ? { ...character, abilities: character.abilities.filter(ability => ability.id !== 'action_surge') }
        : character
    ));
    const rejected = resolveCase(hidden, 'action_surge');
    expect(rejected.outcome).toBe('rejected');
    expect(rejected.characters).toBe(hidden);
  });
});

// ============================================================================
// Turn-Owner Reset Timing
// ============================================================================

describe('resetOnlyTurnOwnerEconomy', () => {
  it('leaves the previous actor spent on another turn and resets it only on its own next turn', () => {
    const spent = resolveCase(createCharacters(), 'combined_sequence').characters;
    const testerBefore = findCharacter(spent, 'action_economy-tester');

    const targetTurn = resetOnlyTurnOwnerEconomy(spent, 'action_economy-target');
    expect(findCharacter(targetTurn, 'action_economy-tester')).toBe(testerBefore);
    expect(findCharacter(targetTurn, 'action_economy-target').actionEconomy.reaction.used).toBe(false);

    const testerTurn = resetOnlyTurnOwnerEconomy(targetTurn, 'action_economy-tester');
    expect(findCharacter(testerTurn, 'action_economy-tester').actionEconomy).toMatchObject({
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      movement: { used: 0, total: 30 },
      freeActions: 1,
    });
  });
});
