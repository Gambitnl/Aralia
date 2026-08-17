/**
 * This file proves the Alchemist Experimental Elixir effect catalog, deterministic
 * creation roll, and drink resolution (healing and buff outcomes).
 */

import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  createExperimentalElixir,
  EXPERIMENTAL_ELIXIR_EFFECTS,
  getExperimentalElixirEffect,
  resolveDrinkExperimentalElixir,
  rollExperimentalElixirEffect,
} from '../alchemistUtils';

describe('elixir catalog and creation', () => {
  it('defines the six canonical outcomes', () => {
    expect(EXPERIMENTAL_ELIXIR_EFFECTS).toHaveLength(6);
    expect(EXPERIMENTAL_ELIXIR_EFFECTS.map(e => e.id)).toEqual([
      'healing', 'swiftness', 'resilience', 'boldness', 'flight', 'transformation',
    ]);
  });

  it('rolls a deterministic d6 effect and creates an elixir', () => {
    expect(rollExperimentalElixirEffect(() => 0).id).toBe('healing');
    expect(rollExperimentalElixirEffect(() => 0.999).id).toBe('transformation');
    const created = createExperimentalElixir(() => 0.5);
    expect(created.effectId).toBe(getExperimentalElixirEffect(created.effectId)?.id);
  });
});

describe('drink resolution', () => {
  it('heals 2d4 + 2 on the healing elixir', () => {
    const drinker = createMockCombatCharacter({ id: 'alchemist', name: 'Alchemist', currentHP: 4, maxHP: 20 });
    const state = createMockCombatState({ characters: [drinker] });

    const result = resolveDrinkExperimentalElixir(state, {
      drinkerId: 'alchemist', effectId: 'healing', rng: () => 0.999, // pins 2d4 at 8
    });
    expect(result.resolved).toBe(true);
    expect(result.healingApplied).toBe(10); // 8 + 2, capped at maxHP-currentHP (16)
    expect(result.state.characters.find(c => c.id === 'alchemist')?.currentHP).toBe(14);
  });

  it('applies a buff status for non-healing effects', () => {
    const drinker = createMockCombatCharacter({ id: 'alchemist', name: 'Alchemist' });
    const state = createMockCombatState({ characters: [drinker] });

    const result = resolveDrinkExperimentalElixir(state, {
      drinkerId: 'alchemist', effectId: 'swiftness',
    });
    expect(result.resolved).toBe(true);
    expect(result.state.characters.find(c => c.id === 'alchemist')?.statusEffects.some(e => e.name === 'Swiftness')).toBe(true);
  });

  it('rejects an unknown effect', () => {
    const drinker = createMockCombatCharacter({ id: 'alchemist', name: 'Alchemist' });
    const state = createMockCombatState({ characters: [drinker] });
    expect(resolveDrinkExperimentalElixir(state, {
      drinkerId: 'alchemist', effectId: 'nope',
    }).failure).toBe('unknown_effect');
  });
});
