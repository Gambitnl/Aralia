/**
 * This file proves the Warrior of the Open Hand Flurry of Blows riders
 * (knock prone, push, deny reactions) and their Dexterity-save gates.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  calculateOpenHandSaveDc,
  isOpenHandRider,
  OPEN_HAND_TECHNIQUE_FEATURE_ID,
  resolveOpenHandFlurryRider,
} from '../openHandUtils';

function createMonk(wisdom = 16): CombatCharacter {
  return createMockCombatCharacter({
    id: 'monk',
    name: 'Monk',
    team: 'player',
    level: 3,
    position: { x: 0, y: 0 },
    stats: {
      strength: 12, dexterity: 16, constitution: 14, intelligence: 10, wisdom, charisma: 8,
      baseInitiative: 3, speed: 40, cr: '1/4',
    },
    abilities: [{
      id: OPEN_HAND_TECHNIQUE_FEATURE_ID, name: 'Open Hand Technique',
      description: 'Your Flurry of Blows can knock prone, push, or deny reactions.',
      type: 'utility', cost: { type: 'free' }, targeting: 'self', range: 0, effects: [],
    }],
  });
}

describe('catalog and save DC', () => {
  it('recognizes the three riders and computes the Ki save DC', () => {
    expect(isOpenHandRider('knock_prone')).toBe(true);
    expect(isOpenHandRider('push')).toBe(true);
    expect(isOpenHandRider('deny_reactions')).toBe(true);
    expect(isOpenHandRider('stun')).toBe(false);
    // 8 + PB(2) + Wis(16 → +3) = 13
    expect(calculateOpenHandSaveDc(createMonk())).toBe(13);
  });
});

describe('riders', () => {
  it('knocks the target Prone on a failed save', () => {
    const monk = createMonk();
    const target = createMockCombatCharacter({ id: 'goblin', name: 'Goblin', team: 'enemy', position: { x: 1, y: 0 } });
    const state = createMockCombatState({ characters: [monk, target] });

    const result = resolveOpenHandFlurryRider(state, {
      monkId: 'monk', targetId: 'goblin', riderId: 'knock_prone', rng: () => 0.01, // rolls low → fails save
    });
    expect(result.resolved).toBe(true);
    expect(result.applied).toBe('Prone');
    expect(result.state.characters.find(c => c.id === 'goblin')?.conditions?.some(c => c.name === 'Prone')).toBe(true);
  });

  it('pushes the target 15 feet on a failed save', () => {
    const monk = createMonk();
    const target = createMockCombatCharacter({ id: 'goblin', name: 'Goblin', team: 'enemy', position: { x: 1, y: 0 } });
    const state = createMockCombatState({ characters: [monk, target] });

    const result = resolveOpenHandFlurryRider(state, {
      monkId: 'monk', targetId: 'goblin', riderId: 'push', rng: () => 0.01,
    });
    expect(result.resolved).toBe(true);
    expect(result.applied).toBe('pushed');
    expect(result.pushDistanceTiles).toBe(3);
    expect(result.state.characters.find(c => c.id === 'goblin')?.position).toEqual({ x: 4, y: 0 });
  });

  it('denies reactions on a failed save', () => {
    const monk = createMonk();
    const target = createMockCombatCharacter({ id: 'goblin', name: 'Goblin', team: 'enemy', position: { x: 1, y: 0 } });
    const state = createMockCombatState({ characters: [monk, target] });

    const result = resolveOpenHandFlurryRider(state, {
      monkId: 'monk', targetId: 'goblin', riderId: 'deny_reactions', rng: () => 0.01,
    });
    expect(result.resolved).toBe(true);
    expect(result.applied).toBe('deny_reactions');
    expect(result.state.characters.find(c => c.id === 'goblin')?.statusEffects.some(e => e.name === 'Reactions Denied')).toBe(true);
  });

  it('applies nothing on a successful save and rejects non-Open-Hand monks', () => {
    const monk = createMonk();
    const target = createMockCombatCharacter({ id: 'goblin', name: 'Goblin', team: 'enemy', position: { x: 1, y: 0 } });
    const state = createMockCombatState({ characters: [monk, target] });

    const saved = resolveOpenHandFlurryRider(state, {
      monkId: 'monk', targetId: 'goblin', riderId: 'knock_prone', rng: () => 0.99, // rolls high → passes
    });
    expect(saved.resolved).toBe(true);
    expect(saved.applied).toBe('saved');

    const other = createMockCombatCharacter({ id: 'monk', name: 'Monk', team: 'player' });
    const otherState = createMockCombatState({ characters: [other, target] });
    expect(resolveOpenHandFlurryRider(otherState, {
      monkId: 'monk', targetId: 'goblin', riderId: 'knock_prone',
    }).failure).toBe('missing_open_hand_technique');
  });
});
