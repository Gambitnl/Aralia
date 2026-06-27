/**
 * This file tests defensive spell AC lifecycle behavior at turn start.
 *
 * DefensiveCommand applies the first combat-state change when a spell is cast,
 * but useTurnManager owns round-by-round ticking. These tests make sure Shield,
 * Mage Armor, and Barkskin-style active effects keep the right Armor Class as
 * durations count down.
 *
 * Called by: Vitest
 * Depends on: useTurnManager.ts and the shared combat-character test factory
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTurnManager } from '../useTurnManager';
import { createMockCombatCharacter } from '../../../utils/core';
import type { ActiveEffect, CombatCharacter } from '../../../types/combat';

// ============================================================================
// Combat AI Test Boundary
// ============================================================================
// These checks advance turn-start bookkeeping directly. Combat AI timing is not
// part of the defensive AC contract, so the AI hook is disabled to keep the
// assertions focused on spell lifecycle math.
// ============================================================================
vi.mock('../useCombatAI', () => ({
  useCombatAI: () => ({ aiState: 'idle' })
}));

// ============================================================================
// Test Character Builder
// ============================================================================
// Each test creates one player combatant, initializes combat, and inspects the
// first turn-start update emitted by useTurnManager.
// ============================================================================
const createDefensiveAcCharacter = (overrides: Partial<CombatCharacter>): CombatCharacter => {
  const baseCharacter = createMockCombatCharacter();

  return createMockCombatCharacter({
    ...overrides,
    stats: {
      ...baseCharacter.stats,
      ...(overrides.stats || {})
    },
    team: 'player'
  });
};

const runInitialTurnStart = (character: CombatCharacter): CombatCharacter | undefined => {
  const onCharacterUpdate = vi.fn<(updated: CombatCharacter) => void>();
  const { result } = renderHook(() => useTurnManager({
    characters: [character],
    mapData: null,
    onCharacterUpdate,
    onLogEntry: vi.fn()
  }));

  act(() => {
    result.current.initializeCombat([character]);
  });

  return onCharacterUpdate.mock.calls
    .map(call => call[0])
    .reverse()
    .find(updated => updated.id === character.id);
};

// ============================================================================
// Defensive AC Lifecycle
// ============================================================================
// These cases cover the three defensive AC mechanics currently represented by
// DefensiveCommand active-effect metadata.
// ============================================================================
describe('useTurnManager defensive AC lifecycle', () => {
  it('expires Shield-style AC bonuses back to the pre-effect Armor Class', () => {
    const shieldEffect: ActiveEffect = {
      id: 'shield-effect',
      spellId: 'shield',
      casterId: 'hero',
      sourceName: 'Shield',
      type: 'buff',
      duration: { type: 'rounds', value: 1 },
      startTime: 1,
      mechanics: { acBonus: 5 }
    };
    const character = createDefensiveAcCharacter({
      id: 'shielded-hero',
      name: 'Shielded Hero',
      armorClass: 17,
      activeEffects: [shieldEffect]
    });

    const updated = runInitialTurnStart(character);

    expect(updated?.activeEffects).toHaveLength(0);
    expect(updated?.armorClass).toBe(12);
  });

  it('keeps Mage Armor as base 13 plus Dexterity modifier while active', () => {
    const mageArmorEffect: ActiveEffect = {
      id: 'mage-armor-effect',
      spellId: 'mage-armor',
      casterId: 'hero',
      sourceName: 'Mage Armor',
      type: 'buff',
      duration: { type: 'rounds', value: 2 },
      startTime: 1,
      mechanics: {
        baseAC: 13,
        baseACFormula: '13 + dex_mod'
      }
    };
    const character = createDefensiveAcCharacter({
      id: 'mage-armored-hero',
      name: 'Mage Armored Hero',
      armorClass: 14,
      stats: { dexterity: 12 } as CombatCharacter['stats'],
      activeEffects: [mageArmorEffect]
    });

    const updated = runInitialTurnStart(character);

    expect(updated?.activeEffects).toHaveLength(1);
    expect(updated?.armorClass).toBe(14);
  });

  it('keeps Barkskin-style AC minimums as floors instead of flat overrides', () => {
    const barkskinEffect: ActiveEffect = {
      id: 'barkskin-effect',
      spellId: 'barkskin',
      casterId: 'druid',
      sourceName: 'Barkskin',
      type: 'buff',
      duration: { type: 'rounds', value: 2 },
      startTime: 1,
      mechanics: { acMinimum: 17 }
    };
    const character = createDefensiveAcCharacter({
      id: 'barkskin-hero',
      name: 'Barkskin Hero',
      armorClass: 12,
      activeEffects: [barkskinEffect]
    });

    const updated = runInitialTurnStart(character);

    expect(updated?.activeEffects).toHaveLength(1);
    expect(updated?.armorClass).toBe(17);
  });

  it('removes expired resistance and immunity flags owned by defensive active effects', () => {
    const protectionEffect: ActiveEffect = {
      id: 'protection-effect',
      spellId: 'shield',
      casterId: 'hero',
      sourceName: 'Shield',
      type: 'buff',
      duration: { type: 'rounds', value: 1 },
      startTime: 1,
      mechanics: {
        damageResistance: ['fire'],
        damageImmunity: ['force']
      }
    };
    const character = createDefensiveAcCharacter({
      id: 'protected-hero',
      name: 'Protected Hero',
      resistances: ['fire'],
      immunities: ['force'],
      activeEffects: [protectionEffect]
    });

    const updated = runInitialTurnStart(character);

    expect(updated?.activeEffects).toHaveLength(0);
    expect(updated?.resistances).not.toContain('fire');
    expect(updated?.immunities).not.toContain('force');
  });

  it('clears source-owned temporary HP when its defensive active effect expires', () => {
    const armorEffect: ActiveEffect = {
      id: 'armor-of-agathys-effect',
      spellId: 'armor-of-agathys',
      casterId: 'hero',
      sourceName: 'Armor of Agathys',
      type: 'buff',
      duration: { type: 'rounds', value: 1 },
      startTime: 1,
      mechanics: {}
    };
    const character = createDefensiveAcCharacter({
      id: 'agathys-hero',
      name: 'Agathys Hero',
      tempHP: 5,
      temporaryHitPointSource: {
        spellId: 'armor-of-agathys',
        spellName: 'Armor of Agathys',
        casterId: 'hero'
      },
      activeEffects: [armorEffect]
    });

    const updated = runInitialTurnStart(character);

    expect(updated?.activeEffects).toHaveLength(0);
    expect(updated?.tempHP).toBe(0);
    expect(updated?.temporaryHitPointSource).toBeUndefined();
  });
});
