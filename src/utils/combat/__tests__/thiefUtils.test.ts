/**
 * This file proves the Thief Fast Hands bonus-action transaction and the
 * Second-Story Work climb/jump modifiers.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  applySecondStoryWorkClimb,
  calculateSecondStoryWorkJumpDistance,
  FAST_HANDS_FEATURE_ID,
  isFastHandsAction,
  resolveFastHands,
  SECOND_STORY_WORK_FEATURE_ID,
} from '../thiefUtils';

function featureAbility(id: string, name: string) {
  return { id, name, description: name, type: 'utility' as const, cost: { type: 'action' as const }, targeting: 'self' as const, range: 0, effects: [] };
}

function createThief(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'thief',
    name: 'Thief',
    team: 'player',
    position: { x: 0, y: 0 },
    stats: {
      strength: 12, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10,
      baseInitiative: 3, speed: 30, cr: '1/4',
    },
    abilities: [featureAbility(FAST_HANDS_FEATURE_ID, 'Fast Hands'), featureAbility(SECOND_STORY_WORK_FEATURE_ID, 'Second-Story Work')],
  });
}

describe('Fast Hands', () => {
  it('recognizes the three canonical actions and rejects unknown ids', () => {
    expect(isFastHandsAction('sleight_of_hand')).toBe(true);
    expect(isFastHandsAction('use_thieves_tools')).toBe(true);
    expect(isFastHandsAction('use_object')).toBe(true);
    expect(isFastHandsAction('attack')).toBe(false);
  });

  it('spends the Cunning Action bonus action for a legal Fast Hands action', () => {
    const thief = createThief();
    const state = createMockCombatState({ characters: [thief] });

    const result = resolveFastHands(state, { thiefId: 'thief', actionType: 'use_object' });
    expect(result.resolved).toBe(true);
    expect(result.actionType).toBe('use_object');
    expect(result.state.characters.find(c => c.id === 'thief')?.actionEconomy.bonusAction.used).toBe(true);
  });

  it('rejects a non-Thief, unknown action, or exhausted bonus action', () => {
    const nonThief = createMockCombatCharacter({ id: 'rogue', name: 'Rogue', team: 'player' });
    const state = createMockCombatState({ characters: [nonThief] });
    expect(resolveFastHands(state, { thiefId: 'rogue', actionType: 'use_object' }).failure)
      .toBe('missing_fast_hands');

    const thief = createThief();
    const thiefState = createMockCombatState({ characters: [thief] });
    expect(resolveFastHands(thiefState, { thiefId: 'thief', actionType: 'nope' }).failure)
      .toBe('unknown_action');

    const spent = createMockCombatCharacter({
      ...createThief(),
      id: 'thief',
      actionEconomy: {
        action: { used: true, remaining: 0 },
        bonusAction: { used: true, remaining: 0 },
        reaction: { used: false, remaining: 1 },
        legendary: { used: 0, total: 0 },
        movement: { used: 0, total: 30 },
        freeActions: 0,
      },
    });
    const spentState = createMockCombatState({ characters: [spent] });
    expect(resolveFastHands(spentState, { thiefId: 'thief', actionType: 'use_object' }).failure)
      .toBe('no_bonus_action');
  });
});

describe('Second-Story Work', () => {
  it('removes the climbing penalty for the Thief only', () => {
    const thief = createThief();
    const nonThief = createMockCombatCharacter({ id: 'rogue', name: 'Rogue' });

    expect(applySecondStoryWorkClimb(thief, { isClimbing: true }).hasClimbSpeed).toBe(true);
    expect(applySecondStoryWorkClimb(nonThief, { isClimbing: true }).hasClimbSpeed).toBeUndefined();
  });

  it('adds Dexterity modifier to the long jump but not the high jump', () => {
    const thief = createThief(); // Str 12 (12 ft long jump), Dex 16 (+3)
    expect(calculateSecondStoryWorkJumpDistance(thief, 'long')).toBe(15); // 12 + 3
    expect(calculateSecondStoryWorkJumpDistance(thief, 'high')).toBe(4); // 3 + Str mod (+1)

    const nonThief = createMockCombatCharacter({
      id: 'rogue', name: 'Rogue',
      stats: { strength: 12, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 3, speed: 30, cr: '1/4' },
    });
    expect(calculateSecondStoryWorkJumpDistance(nonThief, 'long')).toBe(12);
  });
});
