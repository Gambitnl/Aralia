
import { describe, it, expect } from 'vitest';
import { canTakeReaction } from '../combatUtils';
import { createMockCombatCharacter } from '../factories';
import { ConditionName } from '../../types/spells';
import { CombatCharacter, StatusEffect } from '../../types/combat';

describe('combatUtils: canTakeReaction', () => {
  it('should return true for a healthy character with reaction available', () => {
    const char = createMockCombatCharacter({
      currentHP: 10,
      actionEconomy: { reaction: { used: false, remaining: 1 }, action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 }, freeActions: 1 }
    });
    expect(canTakeReaction(char)).toBe(true);
  });

  it('should return false if character is dead (0 HP)', () => {
    const char = createMockCombatCharacter({
      currentHP: 0,
       actionEconomy: { reaction: { used: false, remaining: 1 }, action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 }, freeActions: 1 }
    });
    expect(canTakeReaction(char)).toBe(false);
  });

  it('should return false if reaction is already used', () => {
    const char = createMockCombatCharacter({
      currentHP: 10,
      actionEconomy: { reaction: { used: true, remaining: 0 }, action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 }, freeActions: 1 }
    });
    expect(canTakeReaction(char)).toBe(false);
  });

  it('should return false if character has incapacitating condition (Incapacitated)', () => {
    const char = createMockCombatCharacter({
      currentHP: 10,
      conditions: [{ name: 'Incapacitated', duration: { type: 'rounds', value: 1 }, appliedTurn: 1 }]
    });
    expect(canTakeReaction(char)).toBe(false);
  });

  it('should return false if character has incapacitating condition (Stunned)', () => {
    const char = createMockCombatCharacter({
      currentHP: 10,
      conditions: [{ name: 'Stunned', duration: { type: 'rounds', value: 1 }, appliedTurn: 1 }]
    });
    expect(canTakeReaction(char)).toBe(false);
  });

  it('should return false if character has legacy status effect (Stunned)', () => {
    const char = createMockCombatCharacter({
      currentHP: 10,
      statusEffects: [{
        id: 'stun-effect',
        name: 'Stunned',
        type: 'debuff',
        description: 'Stunned',
        duration: 1
      }]
    });
    expect(canTakeReaction(char)).toBe(false);
  });

  it('should return true if character has non-incapacitating condition (Prone)', () => {
    const char = createMockCombatCharacter({
      currentHP: 10,
      conditions: [{ name: 'Prone', duration: { type: 'rounds', value: 1 }, appliedTurn: 1 }]
    });
    expect(canTakeReaction(char)).toBe(true);
  });
});
