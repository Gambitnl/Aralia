
import { describe, it, expect, vi } from 'vitest';
import {
  calculateEncumbrance,
  calculateGroupTravelStats,
  calculateTravelTimeHours,
  getTerrainCost
} from '../TravelCalculations';
import { PlayerCharacter } from '../../../types/character';
import { Item } from '../../../types/items';
import { TerrainType } from '../../../types/travel';

// Mock factories
const createMockCharacter = (id: string, strength: number, speed: number = 30): PlayerCharacter => ({
  id,
  name: `Char ${id}`,
  speed,
  finalAbilityScores: { strength, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  // ... other required fields mocked minimally
} as unknown as PlayerCharacter);

const createMockItem = (weight: number): Item => ({
  id: 'item1',
  name: 'Heavy Thing',
  weight,
} as unknown as Item);

describe('TravelCalculations', () => {
  describe('calculateEncumbrance', () => {
    it('should be unencumbered when weight is low', () => {
      const char = createMockCharacter('1', 10); // STR 10 -> Max Carry 150, Encumbered 50
      const items = [createMockItem(20)];
      const result = calculateEncumbrance(char, items);

      expect(result.level).toBe('unencumbered');
      expect(result.speedDrop).toBe(0);
    });

    it('should be encumbered when weight exceeds 5xSTR', () => {
      const char = createMockCharacter('1', 10); // Threshold 50
      const items = [createMockItem(51)];
      const result = calculateEncumbrance(char, items);

      expect(result.level).toBe('encumbered');
      expect(result.speedDrop).toBe(10);
    });

    it('should be heavily encumbered when weight exceeds 10xSTR', () => {
      const char = createMockCharacter('1', 10); // Threshold 100
      const items = [createMockItem(101)];
      const result = calculateEncumbrance(char, items);

      expect(result.level).toBe('heavily_encumbered');
      expect(result.speedDrop).toBe(20);
    });
  });

  describe('getTerrainCost', () => {
      it('should return correct modifiers', () => {
          expect(getTerrainCost('road')).toBe(0.8);
          expect(getTerrainCost('plains')).toBe(1.0);
          expect(getTerrainCost('mountains')).toBe(2.0);
          expect(getTerrainCost('swamp')).toBe(2.0);
      });

      it('should default to 1.0 for unknown types (casted)', () => {
           expect(getTerrainCost('space' as TerrainType)).toBe(1.0);
      });
  });

  describe('calculateGroupTravelStats', () => {
    it('should base speed on the slowest member', () => {
      const c1 = createMockCharacter('1', 10, 30);
      const c2 = createMockCharacter('2', 10, 25); // Slow dwarf

      const stats = calculateGroupTravelStats([c1, c2], {});

      expect(stats.slowestMemberId).toBe('2');
      expect(stats.baseSpeed).toBe(25);
      expect(stats.travelSpeedMph).toBe(2.5); // 25 / 10
    });

    it('should account for encumbrance of specific members', () => {
      const c1 = createMockCharacter('1', 10, 30); // Encumbered -> speed -10 = 20
      const c2 = createMockCharacter('2', 10, 30); // Unencumbered -> speed 30

      const inventories = {
        '1': [createMockItem(60)] // > 50 (5x10)
      };

      const stats = calculateGroupTravelStats([c1, c2], inventories);

      expect(stats.slowestMemberId).toBe('1');
      expect(stats.baseSpeed).toBe(20);
      expect(stats.travelSpeedMph).toBe(2.0);
    });

    it('should apply pace modifiers', () => {
      const c1 = createMockCharacter('1', 10, 30);

      const statsFast = calculateGroupTravelStats([c1], {}, 'fast');
      // 3 mph * 1.33 = 3.99
      expect(statsFast.travelSpeedMph).toBeCloseTo(3.99);

      const statsSlow = calculateGroupTravelStats([c1], {}, 'slow');
      // 3 mph * 0.67 = 2.01
      expect(statsSlow.travelSpeedMph).toBeCloseTo(2.01);
    });

    it('should apply terrain modifiers', () => {
        const c1 = createMockCharacter('1', 10, 30); // 3 MPH base

        // Mountains: Cost 2.0 -> Speed should be halved
        const stats = calculateGroupTravelStats([c1], {}, 'normal', 'mountains');

        expect(stats.terrainModifier).toBe(2.0);
        expect(stats.travelSpeedMph).toBe(1.5); // 3.0 / 2.0
    });

    it('should apply both pace and terrain modifiers', () => {
        const c1 = createMockCharacter('1', 10, 30); // 3 MPH base

        // Fast (1.33) on Mountains (2.0)
        // 3 * 1.33 / 2.0 = 1.995
        const stats = calculateGroupTravelStats([c1], {}, 'fast', 'mountains');

        expect(stats.travelSpeedMph).toBeCloseTo(2.0);
    });
  });

  describe('calculateTravelTimeHours', () => {
    it('should calculate time correctly', () => {
      const stats = { travelSpeedMph: 3 } as any;
      const time = calculateTravelTimeHours(12, stats);
      expect(time).toBe(4);
    });

    it('should handle zero speed gracefully', () => {
      const stats = { travelSpeedMph: 0 } as any;
      const time = calculateTravelTimeHours(12, stats);
      expect(time).toBe(Infinity);
    });
  });
});
