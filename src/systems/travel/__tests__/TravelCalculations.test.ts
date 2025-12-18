
import { describe, it, expect } from 'vitest';
import {
  calculateEncumbrance,
  calculateGroupTravelStats,
  PACE_MODIFIERS
} from '../TravelCalculations';
import { Item } from '../../../types/items';
import { PlayerCharacter } from '../../../types/character';

// Mock character creation directly to avoid path issues and dependency on other files during this task
const mockChar = (id: string, strength: number, speed: number = 30): PlayerCharacter => ({
  id,
  name: `Char_${id}`,
  finalAbilityScores: { strength, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 } as any,
  abilityScores: { strength, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  speed,
  race: { id: 'human', name: 'Human', description: '', traits: [] },
  class: { id: 'fighter', name: 'Fighter', description: '', hitDie: 10, primaryAbility: ['strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 2, armorProficiencies: [], weaponProficiencies: [], features: [] },
  skills: [],
  transportMode: 'foot',
  hp: 10,
  maxHp: 10,
  armorClass: 10,
  darkvisionRange: 0,
});

const mockItem = (weight: number): Item => ({
  id: 'item',
  name: 'Heavy Rock',
  description: 'It is heavy.',
  type: 'treasure',
  weight,
});

describe('TravelCalculations', () => {
  describe('calculateEncumbrance', () => {
    it('identifies unencumbered state', () => {
      const char = mockChar('hero', 10); // Str 10. Carry: 150. Encumbered > 50.
      const inventory = [mockItem(40)]; // 40 < 50

      const result = calculateEncumbrance(char, inventory);
      expect(result.level).toBe('unencumbered');
      expect(result.speedDrop).toBe(0);
    });

    it('identifies encumbered state', () => {
      const char = mockChar('hero', 10); // Encumbered > 50
      const inventory = [mockItem(51)];

      const result = calculateEncumbrance(char, inventory);
      expect(result.level).toBe('encumbered');
      expect(result.speedDrop).toBe(10);
    });

    it('identifies heavily encumbered state', () => {
      const char = mockChar('hero', 10); // Heavily > 100
      const inventory = [mockItem(101)];

      const result = calculateEncumbrance(char, inventory);
      expect(result.level).toBe('heavily_encumbered');
      expect(result.speedDrop).toBe(20);
    });
  });

  describe('calculateGroupTravelStats', () => {
    it('calculates normal pace speed for single unencumbered character', () => {
      const char = mockChar('hero', 10, 30);
      const inventory = [mockItem(10)];

      const stats = calculateGroupTravelStats([char], { hero: inventory }, 'normal');

      expect(stats.baseSpeed).toBe(30);
      expect(stats.travelSpeedMph).toBe(3.0); // 30 / 10 * 1.0
      expect(stats.dailyDistanceMiles).toBe(24); // 3 * 8
    });

    it('slows down group for encumbered member', () => {
      const fastChar = mockChar('elf', 10, 35);
      const slowChar = mockChar('dwarf', 10, 25);
      const encumberedChar = mockChar('tank', 10, 30); // Encumbered speed -> 20

      // Make tank encumbered (Str 10, Weight 60 > 50)
      const inventories = {
        elf: [],
        dwarf: [],
        tank: [mockItem(60)]
      };

      const stats = calculateGroupTravelStats([fastChar, slowChar, encumberedChar], inventories, 'normal');

      expect(stats.slowestMemberId).toBe('tank'); // 20 vs 35 vs 25
      expect(stats.baseSpeed).toBe(20);
      expect(stats.travelSpeedMph).toBe(2.0); // 20 / 10
    });

    it('applies fast pace modifier', () => {
      const char = mockChar('hero', 10, 30);

      const stats = calculateGroupTravelStats([char], { hero: [] }, 'fast');

      // 3 mph * 1.33 = 3.99
      expect(stats.travelSpeedMph).toBeCloseTo(3.99, 2);
    });

    it('applies slow pace modifier', () => {
      const char = mockChar('hero', 10, 30);

      const stats = calculateGroupTravelStats([char], { hero: [] }, 'slow');

      // 3 mph * 0.67 = 2.01
      expect(stats.travelSpeedMph).toBeCloseTo(2.01, 2);
    });
  });
});
