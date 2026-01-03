
import { describe, it, expect } from 'vitest';
import { TravelService } from '../travelService';
import { GroupTravelParameters } from '../../types/travel';
import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';

// Helpers
const mockChar = (id: string, speed: number = 30): PlayerCharacter => ({
  id,
  name: `Char_${id}`,
  race: { id: 'human', name: 'Human', description: '', traits: [] },
  class: { id: 'fighter', name: 'Fighter', description: '', hitDie: 10, primaryAbility: ['Strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] },
  abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
  finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
  skills: [],
  hp: 10,
  maxHp: 10,
  armorClass: 10,
  speed,
  darkvisionRange: 0,
  transportMode: 'foot',
  equippedItems: {},
  statusEffects: [],
});

const mockItem = (weight: number): Item => ({
  id: 'item',
  name: 'Item',
  description: '',
  weight,
  type: 'treasure',
});

describe('TravelService', () => {
  describe('calculateTravel', () => {
    it('calculates standard travel correctly', () => {
      const params: GroupTravelParameters = {
        origin: { x: 0, y: 0 },
        destination: { x: 4, y: 0 }, // 4 tiles = 24 miles (at 6 miles/tile)
        travelers: [mockChar('p1', 30)],
        inventories: { p1: [] },
        pace: 'normal'
      };

      const result = TravelService.calculateTravel(params);

      expect(result.distanceMiles).toBe(24);
      // Speed 30ft -> 3mph. Normal pace = 3mph.
      // 24 miles / 3 mph = 8 hours.
      expect(result.travelTimeHours).toBe(8);
      expect(result.encounterChecks).toBe(2); // 8 / 4 = 2
    });

    it('accounts for slow group members', () => {
      const params: GroupTravelParameters = {
        origin: { x: 0, y: 0 },
        destination: { x: 4, y: 0 }, // 24 miles
        travelers: [
          mockChar('fast', 40),
          mockChar('slow', 20) // Slowest! 20ft -> 2mph
        ],
        inventories: { fast: [], slow: [] },
        pace: 'normal'
      };

      const result = TravelService.calculateTravel(params);

      // Speed 20ft -> 2mph.
      // 24 miles / 2 mph = 12 hours.
      expect(result.travelTimeHours).toBe(12);
    });

    it('applies fast pace', () => {
      const params: GroupTravelParameters = {
        origin: { x: 0, y: 0 },
        destination: { x: 4, y: 0 }, // 24 miles
        travelers: [mockChar('p1', 30)],
        inventories: { p1: [] },
        pace: 'fast' // +33% speed -> 4mph
      };

      const result = TravelService.calculateTravel(params);

      // 3mph * 1.33 = 4mph
      // 24 / 4 = 6 hours
      expect(result.travelTimeHours).toBeCloseTo(6, 0); // Approx 6
      expect(result.travelSpeedMph).toBeCloseTo(4, 1);
    });

    it('handles encumbrance via the system layer', () => {
       const params: GroupTravelParameters = {
        origin: { x: 0, y: 0 },
        destination: { x: 4, y: 0 }, // 24 miles
        travelers: [mockChar('strong', 30)], // Str 10 -> Carry 150, Encumbered 50
        inventories: { strong: [mockItem(60)] }, // 60lb > 50lb -> -10ft speed
        pace: 'normal'
      };

      const result = TravelService.calculateTravel(params);

      // Speed 30 - 10 = 20ft -> 2mph
      // 24 miles / 2 mph = 12 hours
      expect(result.travelTimeHours).toBe(12);
    });
  });

  describe('generateTravelSummary', () => {
    it('formats message correctly', () => {
      // TODO(2026-01-03 Codex-CLI): Keep this aligned with TravelResult shape when summary formatting expands.
      const result = {
        distanceMiles: 10.5,
        travelTimeHours: 3.5,
        travelSpeedMph: 3,
        encounterChecks: 1,
        usedTerrain: 'open' as const
      };

      const summary = TravelService.generateTravelSummary(result, 'normal');
      expect(summary).toBe('Traveled 10.5 miles in 3 hr 30 min at normal pace over open terrain.');
    });
  });
});
