/**
 * Turn-coordinator coverage for repeat saves.
 *
 * The combat engine owns repeat-save resolution, but the turn manager must call
 * it at the correct lifecycle moments. This file protects the turn-start bridge
 * so `turn_start` repeat-save metadata is not stranded in runtime status state.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTurnManager } from '../useTurnManager';
import type { CombatCharacter } from '@/types/combat';
import type { Class } from '@/types';
import * as savingThrowUtils from '@/utils/savingThrowUtils';

vi.mock('@/utils/savingThrowUtils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/savingThrowUtils')>();
  return {
    ...actual,
    rollSavingThrow: vi.fn()
  };
});

const mockClass: Class = {
  id: 'fighter',
  name: 'Fighter',
  description: 'A martial combatant.',
  hitDie: 10,
  primaryAbility: ['Strength'],
  savingThrowProficiencies: ['Strength', 'Constitution'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: []
};

const makeCharacter = (overrides: Partial<CombatCharacter> = {}): CombatCharacter => ({
  id: 'target',
  name: 'Target',
  level: 3,
  class: mockClass,
  position: { x: 0, y: 0 },
  stats: {
    strength: 10,
    dexterity: 12,
    constitution: 12,
    intelligence: 10,
    wisdom: 10,
    charisma: 8,
    baseInitiative: 0,
    speed: 30,
    cr: '0'
  },
  abilities: [],
  team: 'enemy',
  currentHP: 20,
  maxHP: 20,
  initiative: 0,
  statusEffects: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    legendary: { used: 0, total: 0 },
    movement: { used: 0, total: 30 },
    freeActions: 0
  },
  ...overrides
});

describe('useTurnManager repeat-save lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes turn_start repeat saves when a character turn begins', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 18,
      success: true,
      modifiersApplied: []
    } as any);

    const target = makeCharacter({
      statusEffects: [{
        id: 'morning-fear',
        name: 'Morning Fear',
        type: 'debuff',
        duration: 2,
        repeatSave: {
          timing: 'turn_start',
          saveType: 'Wisdom',
          successEnds: true,
          useOriginalDC: true,
          dc: 17
        }
      }]
    });
    const onCharacterUpdate = vi.fn();

    const { result } = renderHook(() => useTurnManager({
      characters: [target],
      mapData: null,
      onCharacterUpdate,
      onLogEntry: vi.fn()
    }));

    act(() => {
      result.current.initializeCombat([target]);
    });

    const updatedTarget = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .find(character => character.id === target.id && character.statusEffects.length === 0);

    expect(updatedTarget).toBeDefined();
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalled();
    // The status command stores the original caster DC on repeat-save metadata.
    // The turn engine must use that stored value; otherwise Blinding Smite-style
    // turn-end saves silently fall back to the generic placeholder DC.
    expect(vi.mocked(savingThrowUtils.rollSavingThrow).mock.calls[0][2]).toBe(17);
  });
});
