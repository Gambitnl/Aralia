import { describe, it, expect } from 'vitest';
import { createMockSpell } from '../factories';
import { isSpell, AreaTargeting } from '@/types/spells';

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
});
