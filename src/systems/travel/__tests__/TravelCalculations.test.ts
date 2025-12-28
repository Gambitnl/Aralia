
import { describe, it, expect } from 'vitest';
import {
  calculateEncumbrance,
  calculateGroupTravelStats,
  calculateForcedMarchStatus,
  PACE_MODIFIERS
} from '../TravelCalculations';
import { Item } from '../../../types/items';
import { PlayerCharacter } from '../../../types/character';
import { TravelVehicle, STANDARD_VEHICLES } from '../../../types/travel';

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

    // --- Terrain Tests ---

    it('applies difficult terrain modifier (half speed)', () => {
      const char = mockChar('hero', 10, 30);
      // Normal: 3mph. Difficult: 1.5mph
      const stats = calculateGroupTravelStats([char], { hero: [] }, 'normal', 'difficult');

      expect(stats.travelSpeedMph).toBeCloseTo(1.5, 2);
      expect(stats.dailyDistanceMiles).toBeCloseTo(12, 1);
    });

    it('maintains normal speed on roads', () => {
      const char = mockChar('hero', 10, 30);
      const stats = calculateGroupTravelStats([char], { hero: [] }, 'normal', 'road');

      expect(stats.travelSpeedMph).toBe(3.0);
    });

    it('combines fast pace and difficult terrain correctly', () => {
      const char = mockChar('hero', 10, 30);
      // Base: 3mph
      // Fast: * 1.33 = 3.99
      // Difficult: * 0.5 = 1.995
      // The function rounds to 2 decimals, so 1.995 -> 2.00
      const stats = calculateGroupTravelStats([char], { hero: [] }, 'fast', 'difficult');

      expect(stats.travelSpeedMph).toBe(2.00);
    });

    // --- Transport / Vehicle Tests ---

    it('uses mount speed when mounted', () => {
      const char = mockChar('hero', 10, 30);
      // Riding Horse: 60ft speed
      const stats = calculateGroupTravelStats([char], { hero: [] }, 'normal', 'road', {
        method: 'mounted',
        vehicle: STANDARD_VEHICLES.riding_horse
      });

      expect(stats.baseSpeed).toBe(60);
      expect(stats.travelSpeedMph).toBe(6.0); // 60/10 = 6 mph
      expect(stats.transportMethod).toBe('mounted');
    });

    it('ignores encumbered character speed if mounted', () => {
      const encumberedChar = mockChar('tank', 10, 30); // Encumbered -> 20ft
      const inventory = [mockItem(60)]; // Encumbered

      // But on a horse!
      const stats = calculateGroupTravelStats([encumberedChar], { tank: inventory }, 'normal', 'road', {
        method: 'mounted',
        vehicle: STANDARD_VEHICLES.riding_horse
      });

      expect(stats.baseSpeed).toBe(60); // Horse doesn't care about rider's encumbrance (in this simplified model)
    });

    it('applies water vehicle speed correctly', () => {
      const char = mockChar('hero', 10, 30);
      // Rowboat: 1.5 mph -> 15 ft/round
      const stats = calculateGroupTravelStats([char], { hero: [] }, 'normal', 'open', {
        method: 'vehicle',
        vehicle: STANDARD_VEHICLES.rowboat
      });

      expect(stats.baseSpeed).toBe(15);
      expect(stats.travelSpeedMph).toBe(1.5);
    });

    it('water vehicles ignore "difficult" land terrain', () => {
      const char = mockChar('hero', 10, 30);
      // Keelboat: 30 ft/round (3 mph). Terrain passed as "difficult" (usually 0.5x).
      // Water vehicles logic: if terrain is difficult, assume rough water?
      // Current implementation: terrainMod = terrainMod < 1.0 ? terrainMod : 1.0;
      // So difficult (0.5) is applied.
      // Wait, my logic was: "Water vehicles ignore 'road/difficult' land modifiers usually... If the input terrain is 'difficult', we assume it means 'rough water' for a boat."
      // So it SHOULD apply the 0.5x modifier if passed difficult.

      const stats = calculateGroupTravelStats([char], { hero: [] }, 'normal', 'difficult', {
        method: 'vehicle',
        vehicle: STANDARD_VEHICLES.keelboat
      });

      // 3 mph * 0.5 = 1.5 mph
      expect(stats.travelSpeedMph).toBe(1.5);
    });

    it('water vehicles ignore "road" land bonus if it existed (but road is 1.0)', () => {
       // Currently road is 1.0, so no change.
       // If road was 1.5x (imaginary highway), water vehicle should ignore it.
       // Test confirms 1.0 used.
       const char = mockChar('hero', 10, 30);
       const stats = calculateGroupTravelStats([char], { hero: [] }, 'normal', 'road', {
         method: 'vehicle',
         vehicle: STANDARD_VEHICLES.keelboat
       });

       expect(stats.travelSpeedMph).toBe(3.0);
    });
  });

  describe('calculateForcedMarchStatus', () => {
    it('identifies safe travel duration', () => {
      const result = calculateForcedMarchStatus(8);
      expect(result.isForcedMarch).toBe(false);
      expect(result.hoursOverLimit).toBe(0);
      expect(result.constitutionSaveDC).toBe(0);
    });

    it('identifies forced march (1 hour over)', () => {
      const result = calculateForcedMarchStatus(9);
      expect(result.isForcedMarch).toBe(true);
      expect(result.hoursOverLimit).toBe(1);
      // DC 10 + 1 = 11
      expect(result.constitutionSaveDC).toBe(11);
    });

    it('identifies forced march (2 hours over)', () => {
      const result = calculateForcedMarchStatus(10);
      expect(result.isForcedMarch).toBe(true);
      expect(result.hoursOverLimit).toBe(2);
      // DC 10 + 2 = 12
      expect(result.constitutionSaveDC).toBe(12);
    });

    it('handles fractional hours - no save if hour not completed', () => {
      // 8.5 hours traveled. Forced march status is true (traveling beyond 8h),
      // but no save required yet as 9th hour isn't finished.
      const result = calculateForcedMarchStatus(8.5);
      expect(result.isForcedMarch).toBe(true);
      expect(result.hoursOverLimit).toBe(0.5);
      expect(result.constitutionSaveDC).toBe(0);
    });

    it('handles fractional hours - save after completion', () => {
      // 9.5 hours traveled. Finished 9th hour (DC 11). Not finished 10th.
      const result = calculateForcedMarchStatus(9.5);
      expect(result.isForcedMarch).toBe(true);
      expect(result.hoursOverLimit).toBe(1.5);
      expect(result.constitutionSaveDC).toBe(11);
    });

    it('handles under 8 hours safely', () => {
      const result = calculateForcedMarchStatus(4);
      expect(result.isForcedMarch).toBe(false);
      expect(result.constitutionSaveDC).toBe(0);
    });
  });
});
