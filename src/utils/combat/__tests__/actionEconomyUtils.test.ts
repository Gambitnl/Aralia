import { describe, it, expect } from 'vitest';
import { createDefaultActionEconomy, resetEconomy } from '../actionEconomyUtils';
import { createMockCombatCharacter } from '../../factories';

describe('actionEconomyUtils', () => {
  describe('createDefaultActionEconomy', () => {
    it('should initialize with correct default values', () => {
      const moveTotal = 30;
      const economy = createDefaultActionEconomy(moveTotal);

      expect(economy.action).toEqual({ used: false, remaining: 1 });
      expect(economy.bonusAction).toEqual({ used: false, remaining: 1 });
      expect(economy.reaction).toEqual({ used: false, remaining: 1 });
      expect(economy.movement).toEqual({ used: 0, total: moveTotal });
      expect(economy.freeActions).toBe(1);
    });

    it('should handle zero movement', () => {
      const economy = createDefaultActionEconomy(0);
      expect(economy.movement).toEqual({ used: 0, total: 0 });
    });
  });

  describe('resetEconomy', () => {
    it('should reset a character\'s action economy', () => {
      const character = createMockCombatCharacter({
        stats: { speed: 40, strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, cr: "1" },
        actionEconomy: {
          action: { used: true, remaining: 0 },
          bonusAction: { used: true, remaining: 1 }, // partially used case
          reaction: { used: true, remaining: 0 },
          movement: { used: 30, total: 40 },
          freeActions: 0
        }
      });

      const resetCharacter = resetEconomy(character);

      expect(resetCharacter.actionEconomy.action.used).toBe(false);
      expect(resetCharacter.actionEconomy.action.remaining).toBe(1);
      expect(resetCharacter.actionEconomy.bonusAction.used).toBe(false);
      expect(resetCharacter.actionEconomy.bonusAction.remaining).toBe(1);
      expect(resetCharacter.actionEconomy.reaction.used).toBe(false);
      expect(resetCharacter.actionEconomy.reaction.remaining).toBe(1);
      expect(resetCharacter.actionEconomy.movement.used).toBe(0);
      expect(resetCharacter.actionEconomy.movement.total).toBe(40);
      expect(resetCharacter.actionEconomy.freeActions).toBe(1);
    });

    it('should handle characters with 0 speed', () => {
       const character = createMockCombatCharacter({
        stats: { speed: 0, strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, cr: "1" }
      });
      const resetCharacter = resetEconomy(character);
      expect(resetCharacter.actionEconomy.movement.total).toBe(0);
    });

    it('should return a new object reference', () => {
        const character = createMockCombatCharacter();
        const resetCharacter = resetEconomy(character);
        expect(resetCharacter).not.toBe(character);
        expect(resetCharacter.actionEconomy).not.toBe(character.actionEconomy);
    });
  });
});
