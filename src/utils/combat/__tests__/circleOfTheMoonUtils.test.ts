/**
 * This file proves the Circle of the Moon Circle Forms temp-HP grant and the
 * Moonlight Step teleport resource transaction.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  applyCircleFormsTempHp,
  calculateCircleFormsTempHp,
  resolveMoonlightStep,
} from '../circleOfTheMoonUtils';

function createMoonDruid(uses = 2): CombatCharacter {
  return createMockCombatCharacter({
    id: 'moon-druid',
    name: 'Moon Druid',
    team: 'player',
    position: { x: 0, y: 0 },
    limitedUses: {
      moonlight_step: { name: 'Moonlight Step', current: uses, max: 2, resetOn: 'long_rest' },
    },
  });
}

describe('Circle Forms temp HP', () => {
  it('grants three-times-level temporary hit points', () => {
    expect(calculateCircleFormsTempHp(3)).toBe(9);
    expect(calculateCircleFormsTempHp(6)).toBe(18);
  });

  it('applies the temp HP and keeps the higher existing pool', () => {
    const base = createMockCombatCharacter({ id: 'druid', name: 'Druid', tempHP: 5 });
    const shaped = applyCircleFormsTempHp(base, 3); // grants 9

    expect(shaped.tempHP).toBe(9);
    expect(shaped.statusEffects.some(effect => effect.name === 'Circle Forms')).toBe(true);
    expect(shaped.conditions?.some(condition => condition.name === 'Circle Forms')).toBe(true);
  });
});

describe('resolveMoonlightStep', () => {
  it('spends a use and teleports within range to an unoccupied space', () => {
    const druid = createMoonDruid();
    const state = createMockCombatState({ characters: [druid] });

    const result = resolveMoonlightStep(state, {
      casterId: 'moon-druid',
      destination: { x: 3, y: 0 },
    });

    expect(result.resolved).toBe(true);
    expect(result.remainingUses).toBe(1);
    expect(result.state.characters.find(c => c.id === 'moon-druid')?.position)
      .toEqual({ x: 3, y: 0 });
  });

  it('rejects an out-of-range destination without spending a use', () => {
    const druid = createMoonDruid();
    const state = createMockCombatState({ characters: [druid] });

    const result = resolveMoonlightStep(state, {
      casterId: 'moon-druid',
      destination: { x: 8, y: 0 }, // 8 tiles > 6-tile range
    });

    expect(result.resolved).toBe(false);
    expect(result.failure).toBe('destination_out_of_range');
    expect(druid.limitedUses?.moonlight_step.current).toBe(2);
  });

  it('rejects an occupied destination and an exhausted pool', () => {
    const druid = createMoonDruid(0);
    const state = createMockCombatState({ characters: [druid] });

    expect(resolveMoonlightStep(state, {
      casterId: 'moon-druid', destination: { x: 1, y: 0 },
    }).failure).toBe('no_moonlight_step_uses');

    const blocker = createMockCombatCharacter({ id: 'blocker', name: 'Blocker', position: { x: 1, y: 0 } });
    const occupied = createMockCombatState({ characters: [createMoonDruid(), blocker] });
    expect(resolveMoonlightStep(occupied, {
      casterId: 'moon-druid', destination: { x: 1, y: 0 },
    }).failure).toBe('destination_occupied');
  });
});
