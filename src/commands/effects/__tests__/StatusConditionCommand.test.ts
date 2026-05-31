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

  it('applies a direct status condition (e.g. Ray of Sickness Poisoned)', () => {
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
    const newState = command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;

    // Check new structured conditions
    expect(updatedTarget.conditions).toHaveLength(1);
    expect(updatedTarget.conditions![0].name).toBe('Poisoned');

    // Check legacy statusEffects
    expect(updatedTarget.statusEffects).toHaveLength(1);
    expect(updatedTarget.statusEffects[0].name).toBe('Poisoned');
  });

  it('respects saving throw successes to avoid applying condition', () => {
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
    const newState = command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;
    expect(updatedTarget.conditions).toHaveLength(0);
    expect(updatedTarget.statusEffects).toHaveLength(0);

    const logs = newState.combatLog.filter(l => l.type === 'status');
    expect(logs.some(l => l.message.includes('resists the Prone condition'))).toBe(true);
  });

  it('removes conditions if conditionRemoval is specified (e.g. Lesser Restoration)', () => {
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
    const newState = command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;

    // Poisoned should be removed, Blinded should remain
    expect(updatedTarget.conditions).toHaveLength(1);
    expect(updatedTarget.conditions![0].name).toBe('Blinded');

    expect(updatedTarget.statusEffects).toHaveLength(1);
    expect(updatedTarget.statusEffects[0].name).toBe('Blinded');
  });
});
