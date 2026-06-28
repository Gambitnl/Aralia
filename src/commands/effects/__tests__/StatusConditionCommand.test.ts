/**
 * Focused coverage for applying spell status conditions through the command
 * layer. These tests protect both the structured condition mirror and the
 * legacy statusEffects bridge that current combat runtime systems still read.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusConditionCommand } from '../StatusConditionCommand';
import { CombatState } from '@/types/combat';
import { StatusConditionEffect, SpellEffect } from '@/types/spells';
import { createMockCombatCharacter, createMockCombatState } from '@/utils/factories';
import { CommandContext } from '../../base/SpellCommand';
import * as savingThrowUtils from '@/utils/savingThrowUtils';
import { generateId } from '@/utils/combatUtils';

// We mock saving throws so we don't have to deal with RNG in tests
vi.mock('@/utils/savingThrowUtils', () => ({
  calculateSpellDC: vi.fn(() => 13),
  rollSavingThrow: vi.fn()
}));

// Mock unique ID generation for predictable tests
vi.mock('@/utils/combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/combatUtils')>();
  return {
    ...actual,
    generateId: vi.fn(() => 'test-id')
  };
});

describe('StatusConditionCommand', () => {
  let state: CombatState;
  let context: CommandContext;

  beforeEach(() => {
    vi.clearAllMocks();

    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster' });
    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target',
      conditions: [],
      statusEffects: []
    });

    state = createMockCombatState({
      characters: [caster, target],
      turnState: { currentTurn: 1, currentCharacterId: 'caster', turnOrder: ['caster', 'target'], phase: 'planning', actionsThisTurn: [] }
    });

    context = {
      caster,
      castAtLevel: 1,
      targets: [target],
      spellId: 'test-spell',
      spellName: 'Test Spell',
      gameState: createMockCombatState()
    } as any;
  });

  it('applies a direct status condition (e.g. Ray of Sickness Poisoned)', async () => {
    const effect: StatusConditionEffect = {
      type: 'STATUS_CONDITION',
      statusCondition: {
        name: 'Poisoned',
        duration: { type: 'rounds', value: 1 },
        level: 0
      },
      condition: { type: 'hit' } as any,
      trigger: { type: 'immediate' } as any
    };

    const command = new StatusConditionCommand(effect, context);
    const newState = await command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;

    // Check new structured conditions
    expect(updatedTarget.conditions).toHaveLength(1);
    expect(updatedTarget.conditions![0].name).toBe('Poisoned');

    // Check legacy statusEffects
    expect(updatedTarget.statusEffects).toHaveLength(1);
    expect(updatedTarget.statusEffects[0].name).toBe('Poisoned');
  });

  it('preserves repeat-save metadata when mirroring spell conditions to runtime status state', async () => {
    const repeatSave = {
      timing: 'turn_end',
      saveType: 'Wisdom',
      successEnds: true,
      useOriginalDC: true
    } as const;

    const escapeCheck = {
      ability: 'Strength',
      dc: 'spell_save_dc',
      actionCost: 'action'
    } as const;

    const effect: StatusConditionEffect = {
      type: 'STATUS_CONDITION',
      statusCondition: {
        name: 'Restrained',
        duration: { type: 'rounds', value: 2 },
        repeatSave,
        escapeCheck,
        breakTriggers: ['target_takes_damage']
      },
      condition: { type: 'always' } as any,
      trigger: { type: 'immediate' } as any
    };

    const command = new StatusConditionCommand(effect, context);
    const newState = await command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;

    // The status mirror and the structured condition must both remember which
    // spell created the condition. Blinding Smite depends on that source label
    // for human-readable proof and future cleanup logic even though the weapon
    // hit delivered the condition.
    expect(updatedTarget.statusEffects[0].source).toBe('Test Spell');
    expect(updatedTarget.statusEffects[0].sourceCasterId).toBe('caster');
    expect(updatedTarget.conditions![0].source).toBe('Test Spell');
    expect(updatedTarget.conditions![0].sourceCasterId).toBe('caster');
    expect(updatedTarget.statusEffects[0].repeatSave).toEqual({
      ...repeatSave,
      dc: 13
    });
    expect(updatedTarget.statusEffects[0].escapeCheck).toEqual(escapeCheck);
    expect(updatedTarget.statusEffects[0].breakTriggers).toEqual(['target_takes_damage']);
    expect(updatedTarget.conditions![0].repeatSave).toEqual({
      ...repeatSave,
      dc: 13
    });
    expect(updatedTarget.conditions![0].escapeCheck).toEqual(escapeCheck);
    expect(updatedTarget.conditions![0].breakTriggers).toEqual(['target_takes_damage']);
  });

  it('respects saving throw successes to avoid applying condition', async () => {
    // Simulate a successful save
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 15,
      success: true,
      modifiersApplied: []
    } as any);

    const effect: StatusConditionEffect = {
      type: 'STATUS_CONDITION',
      statusCondition: {
        name: 'Prone',
        duration: { type: 'rounds', value: 1 }
      },
      condition: {
        type: 'save',
        saveType: 'Wisdom',
        saveEffect: 'negates_condition'
      } as any,
      trigger: { type: 'immediate' } as any
    };

    const command = new StatusConditionCommand(effect, context);
    const newState = await command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;
    expect(updatedTarget.conditions).toHaveLength(0);
    expect(updatedTarget.conditions).toHaveLength(0);
    expect(updatedTarget.statusEffects).toHaveLength(0);

    const logs = newState.combatLog.filter(l => l.type === 'status');
    expect(logs.some(l => l.message.includes('resists the Prone condition'))).toBe(true);
  });

  it('removes conditions if conditionRemoval is specified (e.g. Lesser Restoration)', async () => {
    // Setup target with Poisoned and Blinded
    const targetWithConditions = createMockCombatCharacter({
      id: 'target',
      name: 'Target',
      conditions: [
        { name: 'Poisoned', duration: { type: 'rounds', value: 1 }, appliedTurn: 1, source: 'something' },
        { name: 'Blinded', duration: { type: 'rounds', value: 1 }, appliedTurn: 1, source: 'something' }
      ],
      statusEffects: [
        { id: '1', name: 'Poisoned', type: 'debuff', duration: 1 },
        { id: '2', name: 'Blinded', type: 'debuff', duration: 1 }
      ]
    });

    state = {
      ...state,
      characters: [state.characters[0], targetWithConditions]
    };

    const effect: SpellEffect = {
      type: 'STATUS_CONDITION',
      // Dummy condition, removal logic runs first
      statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 0 } },
      conditionRemoval: ['Poisoned', 'Deafened'], // Blinded should remain
      condition: { type: 'always' } as any,
      trigger: { type: 'immediate' } as any
    };

    const command = new StatusConditionCommand(effect, context);
    const newState = await command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;

    // Poisoned should be removed, Blinded should remain
    expect(updatedTarget.conditions).toHaveLength(1);
    expect(updatedTarget.conditions![0].name).toBe('Blinded');

    expect(updatedTarget.statusEffects).toHaveLength(1);
    expect(updatedTarget.statusEffects[0].name).toBe('Blinded');
  });

  describe('Elemental state transitions', () => {
    it('applies Burning state when Ignited condition is applied', async () => {
      const effect: StatusConditionEffect = {
        type: 'STATUS_CONDITION',
        statusCondition: {
          name: 'Ignited',
          duration: { type: 'rounds', value: 1 },
          level: 0
        },
        condition: { type: 'always' } as any,
        trigger: { type: 'immediate' } as any
      };

      const command = new StatusConditionCommand(effect, context);
      const newState = await command.execute(state);

      const updatedTarget = newState.characters.find(c => c.id === 'target')!;
      
      // Target should have 'burning' state tag
      expect(updatedTarget.stateTags).toContain('burning');
    });

    it('interacts with existing state tags', async () => {
      // Setup target who is already Wet
      const targetWithWet = createMockCombatCharacter({
        id: 'target',
        name: 'Target',
        conditions: [],
        statusEffects: [],
        stateTags: ['wet']
      });

      state = {
        ...state,
        characters: [state.characters[0], targetWithWet]
      };

      const effect: StatusConditionEffect = {
        type: 'STATUS_CONDITION',
        statusCondition: {
          name: 'Chilled',
          duration: { type: 'rounds', value: 1 },
          level: 0
        },
        condition: { type: 'always' } as any,
        trigger: { type: 'immediate' } as any
      };

      const command = new StatusConditionCommand(effect, context);
      const newState = await command.execute(state);

      const updatedTarget = newState.characters.find(c => c.id === 'target')!;
      
      // Wet + Chilled (Cold) = Frozen state tag
      expect(updatedTarget.stateTags).toContain('frozen');
      expect(updatedTarget.stateTags).not.toContain('wet');
      expect(updatedTarget.stateTags).not.toContain('cold');
      
      // Should also have interaction log
      const logs = newState.combatLog.filter(l => l.type === 'status');
      expect(logs.some(l => l.message.includes('elemental states reacted') && l.message.toLowerCase().includes('frozen'))).toBe(true);
    });
  });
});
