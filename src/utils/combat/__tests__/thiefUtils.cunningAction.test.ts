/**
 * This file proves the Cunning Action bonus-action transaction that Fast Hands
 * extends, and the Second-Story Work climbing cost against the shared physics
 * movement rules.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  calculateSecondStoryWorkMovementCost,
  cunningActionOptionsFor,
  CUNNING_ACTION_FEATURE_ID,
  FAST_HANDS_FEATURE_ID,
  hasCunningAction,
  resolveCunningAction,
  SECOND_STORY_WORK_FEATURE_ID,
} from '../thiefUtils';

function featureAbility(id: string, name: string) {
  return {
    id,
    name,
    description: name,
    type: 'utility' as const,
    cost: { type: 'action' as const },
    targeting: 'self' as const,
    range: 0,
    effects: [],
  };
}

const THIEF_STATS = {
  strength: 12, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10,
  baseInitiative: 3, speed: 30, cr: '1/4',
};

function createThief(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'thief',
    name: 'Thief',
    team: 'player',
    stats: THIEF_STATS,
    abilities: [
      featureAbility(CUNNING_ACTION_FEATURE_ID, 'Cunning Action'),
      featureAbility(FAST_HANDS_FEATURE_ID, 'Fast Hands'),
      featureAbility(SECOND_STORY_WORK_FEATURE_ID, 'Second-Story Work'),
    ],
  });
}

function createPlainRogue(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'rogue',
    name: 'Rogue',
    team: 'player',
    stats: THIEF_STATS,
    abilities: [featureAbility(CUNNING_ACTION_FEATURE_ID, 'Cunning Action')],
  });
}

describe('Cunning Action options', () => {
  it('widens from three base options to six only for a Thief', () => {
    const novice = createMockCombatCharacter({ id: 'fighter', name: 'Fighter', team: 'player' });
    expect(hasCunningAction(novice)).toBe(false);
    expect(cunningActionOptionsFor(novice)).toEqual([]);

    expect(cunningActionOptionsFor(createPlainRogue()).map(option => option.id))
      .toEqual(['dash', 'disengage', 'hide']);

    const thiefOptions = cunningActionOptionsFor(createThief());
    expect(thiefOptions.map(option => option.id))
      .toEqual(['dash', 'disengage', 'hide', 'sleight_of_hand', 'use_thieves_tools', 'use_object']);
    expect(thiefOptions.filter(option => option.requiresFastHands)).toHaveLength(3);
  });
});

describe('resolveCunningAction', () => {
  it('spends one bonus action on a base option for any rogue', () => {
    const state = createMockCombatState({ characters: [createPlainRogue()] });

    const result = resolveCunningAction(state, { rogueId: 'rogue', actionType: 'disengage' });
    expect(result.resolved).toBe(true);
    expect(result.actionType).toBe('disengage');
    expect(result.usedFastHands).toBe(false);
    expect(result.state.characters.find(c => c.id === 'rogue')?.actionEconomy.bonusAction.used).toBe(true);
  });

  it('resolves an object option for a Thief through the same transaction', () => {
    const state = createMockCombatState({ characters: [createThief()] });

    const result = resolveCunningAction(state, { rogueId: 'thief', actionType: 'use_thieves_tools' });
    expect(result.resolved).toBe(true);
    expect(result.usedFastHands).toBe(true);
    expect(result.state.characters.find(c => c.id === 'thief')?.actionEconomy.bonusAction.used).toBe(true);
  });

  it('refuses an object option to a rogue without Fast Hands, and names every other failure', () => {
    const rogueState = createMockCombatState({ characters: [createPlainRogue()] });
    expect(resolveCunningAction(rogueState, { rogueId: 'rogue', actionType: 'use_object' }).failure)
      .toBe('requires_fast_hands');
    expect(resolveCunningAction(rogueState, { rogueId: 'rogue', actionType: 'somersault' }).failure)
      .toBe('unknown_action');
    expect(resolveCunningAction(rogueState, { rogueId: 'nobody', actionType: 'dash' }).failure)
      .toBe('rogue_missing');

    const fighterState = createMockCombatState({
      characters: [createMockCombatCharacter({ id: 'fighter', name: 'Fighter', team: 'player' })],
    });
    expect(resolveCunningAction(fighterState, { rogueId: 'fighter', actionType: 'dash' }).failure)
      .toBe('missing_cunning_action');

    const spent = resolveCunningAction(rogueState, { rogueId: 'rogue', actionType: 'dash' }).state;
    expect(resolveCunningAction(spent, { rogueId: 'rogue', actionType: 'hide' }).failure)
      .toBe('no_bonus_action');
  });
});

describe('Second-Story Work movement cost', () => {
  it('removes the climbing surcharge for the Thief only', () => {
    const thief = createThief();
    const rogue = createPlainRogue();

    expect(calculateSecondStoryWorkMovementCost(thief, 30, { isClimbing: true })).toBe(30);
    expect(calculateSecondStoryWorkMovementCost(rogue, 30, { isClimbing: true })).toBe(60);
  });

  it('still charges the Thief for difficult terrain while climbing', () => {
    const thief = createThief();
    expect(calculateSecondStoryWorkMovementCost(thief, 10, { isClimbing: true, isDifficultTerrain: true }))
      .toBe(20);
  });
});
