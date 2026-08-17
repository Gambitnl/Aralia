/**
 * This file proves the Warrior of Shadow Shadow Arts Focus-cast spells and the
 * Shadow Step teleport transaction.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  getFocusPoints,
  isShadowArtSpell,
  resolveShadowArtsCast,
  resolveShadowStep,
  SHADOW_ARTS_FEATURE_ID,
} from '../shadowMonkUtils';

function createShadowMonk(focus = 3): CombatCharacter {
  return createMockCombatCharacter({
    id: 'monk',
    name: 'Monk',
    team: 'player',
    level: 3,
    position: { x: 0, y: 0 },
    limitedUses: {
      monks_focus: { name: "Monk's Focus", current: focus, max: 3, resetOn: 'short_rest' },
    },
    abilities: [{
      id: SHADOW_ARTS_FEATURE_ID, name: 'Shadow Arts',
      description: 'Spend Focus to cast Darkness, Darkvision, Pass without Trace, or Silence.',
      type: 'utility', cost: { type: 'action' }, targeting: 'self', range: 0, effects: [],
    }],
  });
}

describe('Shadow Arts', () => {
  it('recognizes the four spells and spends the authored Focus cost', () => {
    expect(isShadowArtSpell('darkness')).toBe(true);
    expect(isShadowArtSpell('silence')).toBe(true);
    expect(isShadowArtSpell('fireball')).toBe(false);

    const monk = createShadowMonk(3);
    const state = createMockCombatState({ characters: [monk] });
    const result = resolveShadowArtsCast(state, { monkId: 'monk', spellId: 'silence' });
    expect(result.resolved).toBe(true);
    expect(result.focusSpent).toBe(2);
    expect(result.remainingFocus).toBe(1);
    expect(getFocusPoints(result.state.characters.find(c => c.id === 'monk')!)).toBe(1);
  });

  it('rejects an unknown spell or insufficient Focus', () => {
    const monk = createShadowMonk(1);
    const state = createMockCombatState({ characters: [monk] });
    expect(resolveShadowArtsCast(state, { monkId: 'monk', spellId: 'nope' }).failure)
      .toBe('unknown_spell');
    expect(resolveShadowArtsCast(state, { monkId: 'monk', spellId: 'silence' }).failure)
      .toBe('not_enough_focus');
  });
});

describe('Shadow Step', () => {
  it('spends one Focus and teleports within range to an unoccupied space', () => {
    const monk = createShadowMonk(3);
    const state = createMockCombatState({ characters: [monk] });

    const result = resolveShadowStep(state, { monkId: 'monk', destination: { x: 6, y: 0 } });
    expect(result.resolved).toBe(true);
    expect(result.remainingFocus).toBe(2);
    expect(result.state.characters.find(c => c.id === 'monk')?.position).toEqual({ x: 6, y: 0 });
  });

  it('rejects out-of-range, occupied, or exhausted-Focus destinations', () => {
    const monk = createShadowMonk(3);
    const state = createMockCombatState({ characters: [monk] });
    expect(resolveShadowStep(state, { monkId: 'monk', destination: { x: 20, y: 0 } }).failure)
      .toBe('destination_out_of_range');

    const blocker = createMockCombatCharacter({ id: 'blocker', name: 'Blocker', position: { x: 1, y: 0 } });
    const occupied = createMockCombatState({ characters: [monk, blocker] });
    expect(resolveShadowStep(occupied, { monkId: 'monk', destination: { x: 1, y: 0 } }).failure)
      .toBe('destination_occupied');

    const broke = createShadowMonk(0);
    const brokeState = createMockCombatState({ characters: [broke] });
    expect(resolveShadowStep(brokeState, { monkId: 'monk', destination: { x: 1, y: 0 } }).failure)
      .toBe('not_enough_focus');
  });
});
