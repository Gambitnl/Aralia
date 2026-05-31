import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpellCommandFactory } from '../../factory/SpellCommandFactory';
import { createAbilityFromSpell } from '../../../utils/character/spellAbilityFactory';
import { consumeActionCost } from '../../../utils/combat/actionEconomyUtils';
import { CombatState, CombatCharacter } from '../../../types/combat';
import { GameState } from '../../../types';
import { DamageCommand } from '../../effects/DamageCommand';
import { HealingCommand } from '../../effects/HealingCommand';
import { StatusConditionCommand } from '../../effects/StatusConditionCommand';
import { CommandExecutor } from '../../base/CommandExecutor';
import { createMockGameState } from '../../../utils/factories';
import { createMockCombatCharacter } from '../../../utils/core/factories';

// Mock Spells
const mockFireBolt = {
  id: 'fire-bolt',
  name: 'Fire Bolt',
  level: 0,
  school: 'Evocation',
  classes: ['Sorcerer'],
  castingTime: { value: 1, unit: 'action' },
  range: { type: 'ranged', distance: 120 },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'instantaneous' },
  effects: [
    {
      type: 'DAMAGE',
      damage: { dice: '1d10', type: 'fire' },
      trigger: { type: 'immediate' },
      condition: { type: 'hit' }
    }
  ]
};

const mockMagicMissile = {
  id: 'magic-missile',
  name: 'Magic Missile',
  level: 1,
  school: 'Evocation',
  classes: ['Sorcerer'],
  castingTime: { value: 1, unit: 'action' },
  range: { type: 'ranged', distance: 120 },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'instantaneous' },
  effects: [
    {
      type: 'DAMAGE',
      damage: { dice: '3d4+3', type: 'force' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }
  ]
};

const mockCureWounds = {
  id: 'cure-wounds',
  name: 'Cure Wounds',
  level: 1,
  school: 'Evocation',
  classes: ['Cleric'],
  castingTime: { value: 1, unit: 'action' },
  range: { type: 'touch' },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'instantaneous' },
  effects: [
    {
      type: 'HEALING',
      healing: { dice: '1d8+3' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }
  ]
};

const mockBless = {
  id: 'bless',
  name: 'Bless',
  level: 1,
  school: 'Enchantment',
  classes: ['Cleric'],
  castingTime: { value: 1, unit: 'action' },
  range: { type: 'ranged', distance: 30 },
  components: { verbal: true, somatic: true, material: true },
  duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
  effects: [
    {
      type: 'STATUS_CONDITION',
      statusCondition: {
        name: 'Blessed',
        duration: { type: 'minutes', value: 1 }
      },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }
  ]
};

describe('Combat Simulator Deterministic Spell Pilot', () => {
  let mockCaster: CombatCharacter;
  let mockTarget: CombatCharacter;
  let mockAlly: CombatCharacter;
  let gameState: GameState;

  beforeEach(() => {
    mockCaster = {
      ...createMockCombatCharacter({ id: 'c1', name: 'Caster' }),
      spellSlots: {
        level_1: { current: 2, max: 2 },
        level_2: { current: 0, max: 0 },
        level_3: { current: 0, max: 0 },
        level_4: { current: 0, max: 0 },
        level_5: { current: 0, max: 0 },
        level_6: { current: 0, max: 0 },
        level_7: { current: 0, max: 0 },
        level_8: { current: 0, max: 0 },
        level_9: { current: 0, max: 0 }
      },
      actionEconomy: {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        legendary: { used: 0, total: 0 },
        movement: { used: 0, total: 30 },
        freeActions: 1
      }
    };

    mockTarget = {
      ...createMockCombatCharacter({ id: 't1', name: 'Target' }),
      currentHP: 10,
      maxHP: 10
    };

    mockAlly = {
      ...createMockCombatCharacter({ id: 'a1', name: 'Ally' }),
      currentHP: 5,
      maxHP: 15
    };

    gameState = createMockGameState();
  });

  describe('fire-bolt (Cantrip Damage)', () => {
    it('creates ability, consumes no slots, creates DamageCommand, and updates state', async () => {
      // 1. Create ability
      const ability = createAbilityFromSpell(mockFireBolt as any, { name: 'Caster' } as any);
      expect(ability.cost.spellSlotLevel).toBe(0);

      // 2. Consume cost
      const casterAfterCost = consumeActionCost(mockCaster, ability.cost);
      expect(casterAfterCost.actionEconomy.action.used).toBe(true);
      expect(casterAfterCost.spellSlots!.level_1.current).toBe(2);

      // 3. Create Commands
      const commands = await SpellCommandFactory.createCommands(
        mockFireBolt as any,
        casterAfterCost,
        [mockTarget],
        0,
        gameState
      );

      expect(commands).toHaveLength(1);
      expect(commands[0]).toBeInstanceOf(DamageCommand);

      // 4. Execute Command
      const combatState: CombatState = {
        isActive: true,
        characters: [casterAfterCost, mockTarget],
        turnState: { currentTurn: 1, turnOrder: [], currentCharacterId: casterAfterCost.id, phase: 'planning', actionsThisTurn: [] },
        combatLog: [],
        selectedCharacterId: null, selectedAbilityId: null, actionMode: 'select',
        validTargets: [], validMoves: [], reactiveTriggers: [], activeLightSources: []
      };

      const result = await CommandExecutor.execute(commands, combatState);
      expect(result.success).toBe(true);

      const finalTarget = result.finalState.characters.find(c => c.id === mockTarget.id);
      expect(finalTarget!.currentHP).toBeLessThan(mockTarget.maxHP);

      const logEntry = result.finalState.combatLog.find(l => l.type === 'damage');
      expect(logEntry).toBeDefined();
      expect(logEntry!.message).toContain('fire damage');
    });
  });

  describe('magic-missile (L1 Damage)', () => {
    it('consumes L1 slot, creates DamageCommand, updates HP and logs', async () => {
      const ability = createAbilityFromSpell(mockMagicMissile as any, { name: 'Caster' } as any);
      expect(ability.cost.spellSlotLevel).toBe(1);

      const casterAfterCost = consumeActionCost(mockCaster, ability.cost);
      expect(casterAfterCost.spellSlots!.level_1.current).toBe(1); // 1 slot used

      const commands = await SpellCommandFactory.createCommands(
        mockMagicMissile as any,
        casterAfterCost,
        [mockTarget],
        1,
        gameState
      );

      expect(commands).toHaveLength(1);

      const combatState: CombatState = {
        isActive: true,
        characters: [casterAfterCost, mockTarget],
        turnState: { currentTurn: 1, turnOrder: [], currentCharacterId: casterAfterCost.id, phase: 'planning', actionsThisTurn: [] },
        combatLog: [],
        selectedCharacterId: null, selectedAbilityId: null, actionMode: 'select',
        validTargets: [], validMoves: [], reactiveTriggers: [], activeLightSources: []
      };

      const result = await CommandExecutor.execute(commands, combatState);
      expect(result.success).toBe(true);

      const finalTarget = result.finalState.characters.find(c => c.id === mockTarget.id);
      expect(finalTarget!.currentHP).toBeLessThan(mockTarget.maxHP);
    });
  });

  describe('cure-wounds (L1 Healing)', () => {
    it('consumes L1 slot, heals target, logs action', async () => {
      const ability = createAbilityFromSpell(mockCureWounds as any, { name: 'Caster' } as any);

      const casterAfterCost = consumeActionCost(mockCaster, ability.cost);
      expect(casterAfterCost.spellSlots!.level_1.current).toBe(1);

      const commands = await SpellCommandFactory.createCommands(
        mockCureWounds as any,
        casterAfterCost,
        [mockAlly],
        1,
        gameState
      );

      expect(commands).toHaveLength(1);
      expect(commands[0]).toBeInstanceOf(HealingCommand);

      const combatState: CombatState = {
        isActive: true,
        characters: [casterAfterCost, mockAlly],
        turnState: { currentTurn: 1, turnOrder: [], currentCharacterId: casterAfterCost.id, phase: 'planning', actionsThisTurn: [] },
        combatLog: [],
        selectedCharacterId: null, selectedAbilityId: null, actionMode: 'select',
        validTargets: [], validMoves: [], reactiveTriggers: [], activeLightSources: []
      };

      const result = await CommandExecutor.execute(commands, combatState);
      const finalAlly = result.finalState.characters.find(c => c.id === mockAlly.id);

      expect(finalAlly!.currentHP).toBeGreaterThan(mockAlly.currentHP);

      const logEntry = result.finalState.combatLog.find(l => l.type === 'heal');
      expect(logEntry).toBeDefined();
    });
  });

  describe('bless (L1 Buff)', () => {
    it('consumes L1 slot, applies status condition, logs action', async () => {
      const ability = createAbilityFromSpell(mockBless as any, { name: 'Caster' } as any);

      const casterAfterCost = consumeActionCost(mockCaster, ability.cost);
      expect(casterAfterCost.spellSlots!.level_1.current).toBe(1);

      const commands = await SpellCommandFactory.createCommands(
        mockBless as any,
        casterAfterCost,
        [mockAlly],
        1,
        gameState
      );

      // Might also have a start concentration command, we'll check if StatusConditionCommand is present
      const statusCommand = commands.find(c => c instanceof StatusConditionCommand);
      expect(statusCommand).toBeDefined();

      const combatState: CombatState = {
        isActive: true,
        characters: [casterAfterCost, mockAlly],
        turnState: { currentTurn: 1, turnOrder: [], currentCharacterId: casterAfterCost.id, phase: 'planning', actionsThisTurn: [] },
        combatLog: [],
        selectedCharacterId: null, selectedAbilityId: null, actionMode: 'select',
        validTargets: [], validMoves: [], reactiveTriggers: [], activeLightSources: []
      };

      const result = await CommandExecutor.execute(commands, combatState);

      const finalAlly = result.finalState.characters.find(c => c.id === mockAlly.id);
      expect(finalAlly!.conditions?.some(c => c.name === 'Blessed') || finalAlly!.statusEffects.some(se => se.name === 'Blessed')).toBe(true);

      const logEntry = result.finalState.combatLog.find(l => l.type === 'status');
      expect(logEntry).toBeDefined();
      expect(logEntry!.message).toContain('Blessed');
    });
  });
});
