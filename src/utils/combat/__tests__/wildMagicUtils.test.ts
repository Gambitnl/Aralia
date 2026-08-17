/**
 * This file proves the Wild Magic Sorcery surge check, deterministic surge table
 * roll, and Tides of Chaos resource transaction.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  resolveTidesOfChaos,
  resolveWildMagicSurgeCheck,
  rollWildMagicSurgeEffect,
  TIDES_OF_CHAOS_FEATURE_ID,
  WILD_MAGIC_SURGE_FEATURE_ID,
  WILD_MAGIC_SURGE_TABLE,
} from '../wildMagicUtils';

function ability(id: string, name: string) {
  return { id, name, description: name, type: 'utility' as const, cost: { type: 'free' as const }, targeting: 'self' as const, range: 0, effects: [] };
}

function createWildMagic(uses = 1): CombatCharacter {
  return createMockCombatCharacter({
    id: 'sorcerer',
    name: 'Sorcerer',
    team: 'player',
    limitedUses: {
      tides_of_chaos: { name: 'Tides of Chaos', current: uses, max: 1, resetOn: 'long_rest' },
    },
    abilities: [ability(WILD_MAGIC_SURGE_FEATURE_ID, 'Wild Magic Surge'), ability(TIDES_OF_CHAOS_FEATURE_ID, 'Tides of Chaos')],
  });
}

describe('Wild Magic Surge', () => {
  it('triggers only on a natural 1 and only for a Wild Magic sorcerer', () => {
    const sorcerer = createWildMagic();
    expect(resolveWildMagicSurgeCheck(sorcerer, 1).surgeTriggered).toBe(true);
    expect(resolveWildMagicSurgeCheck(sorcerer, 2).surgeTriggered).toBe(false);

    const other = createMockCombatCharacter({ id: 'wizard', name: 'Wizard' });
    expect(resolveWildMagicSurgeCheck(other, 1).surgeTriggered).toBe(false);
  });

  it('rolls a deterministic table effect', () => {
    expect(rollWildMagicSurgeEffect(() => 0)).toEqual(WILD_MAGIC_SURGE_TABLE[0]);
    expect(rollWildMagicSurgeEffect(() => 0.999)).toEqual(WILD_MAGIC_SURGE_TABLE[WILD_MAGIC_SURGE_TABLE.length - 1]);
  });
});

describe('Tides of Chaos', () => {
  it('spends the once-per-long-rest use and grants advantage', () => {
    const sorcerer = createWildMagic(1);
    const state = createMockCombatState({ characters: [sorcerer] });

    const result = resolveTidesOfChaos(state, { sorcererId: 'sorcerer' });
    expect(result.resolved).toBe(true);
    expect(result.advantageGranted).toBe(true);
    expect(result.remainingUses).toBe(0);
    expect(result.state.characters.find(c => c.id === 'sorcerer')?.statusEffects.some(e => e.name === 'Tides of Chaos')).toBe(true);

    expect(resolveTidesOfChaos(result.state, { sorcererId: 'sorcerer' }).failure).toBe('no_uses');
  });

  it('rejects a non-Wild-Magic sorcerer', () => {
    const other = createMockCombatCharacter({ id: 'sorcerer', name: 'Sorcerer' });
    const state = createMockCombatState({ characters: [other] });
    expect(resolveTidesOfChaos(state, { sorcererId: 'sorcerer' }).failure)
      .toBe('missing_tides_of_chaos');
  });
});
