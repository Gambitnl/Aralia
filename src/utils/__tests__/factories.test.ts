import { describe, it, expect } from 'vitest';
import {
  createMockSpell,
  createMockPlayerCharacter,
  createMockGameState,
  createMockCombatCharacter,
  createMockCombatState,
  createMockItem,
  createMockQuest,
  createMockMonster,
  createMockGameMessage
} from '../factories';
import { isSpell } from '@/types/spells';

describe('Mimic Factories', () => {
  describe('createMockSpell', () => {
    it('should create a valid Spell object with defaults', () => {
      const spell = createMockSpell();

      expect(isSpell(spell)).toBe(true);
      expect(spell.name).toBe("Mock Spell");
      expect(spell.level).toBe(1);
      expect(spell.effects).toHaveLength(1);
    });

    it('should allow overriding properties', () => {
      const spell = createMockSpell({
        name: "Fireball",
        level: 3,
        range: { type: "ranged", distance: 150 }
      });

      expect(spell.name).toBe("Fireball");
      expect(spell.level).toBe(3);
      expect(spell.range.distance).toBe(150);
      expect(isSpell(spell)).toBe(true);
    });

    it('should handle nested overrides', () => {
      // Overriding targeting
      const spell = createMockSpell({
        targeting: {
          type: "area",
          range: 150,
          areaOfEffect: { shape: "Sphere", size: 20 },
          validTargets: ["creatures"]
        }
      });

      expect(spell.targeting.type).toBe("area");

      // Type narrowing
      if (spell.targeting.type === 'area') {
         expect(spell.targeting.areaOfEffect.shape).toBe("Sphere");
      } else {
         throw new Error("Targeting type mismatch");
      }
    });
  });

  describe('createMockItem', () => {
    it('creates a default item', () => {
      const item = createMockItem();
      expect(item).toBeDefined();
      expect(item.name).toBe('Mock Item');
      expect(item.type).toBe('misc');
    });

    it('accepts overrides', () => {
      const item = createMockItem({ name: 'Sword', type: 'weapon' });
      expect(item.name).toBe('Sword');
      expect(item.type).toBe('weapon');
    });
  });

  describe('createMockQuest', () => {
    it('creates a default quest', () => {
      const quest = createMockQuest();
      expect(quest).toBeDefined();
      expect(quest.name).toBe('Mock Quest');
      expect(quest.status).toBe('Active');
    });

    it('accepts overrides', () => {
      const quest = createMockQuest({ name: 'Save the King', status: 'Completed' });
      expect(quest.name).toBe('Save the King');
      expect(quest.status).toBe('Completed');
    });
  });

  describe('createMockMonster', () => {
    it('creates a default monster', () => {
      const monster = createMockMonster();
      expect(monster).toBeDefined();
      expect(monster.name).toBe('Mock Monster');
      expect(monster.hp).toBe(20);
    });

    it('accepts overrides', () => {
      const monster = createMockMonster({ name: 'Dragon', hp: 200 });
      expect(monster.name).toBe('Dragon');
      expect(monster.hp).toBe(200);
    });
  });

  describe('createMockGameMessage', () => {
    it('creates a default message', () => {
      const msg = createMockGameMessage();
      expect(msg).toBeDefined();
      expect(msg.text).toBe('This is a mock message.');
      expect(msg.type).toBe('info');
    });

    it('accepts overrides', () => {
      const msg = createMockGameMessage({ text: 'Error!', type: 'error' });
      expect(msg.text).toBe('Error!');
      expect(msg.type).toBe('error');
    });
  });
});
