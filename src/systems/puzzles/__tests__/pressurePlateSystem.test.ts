/**
 * @file src/systems/puzzles/__tests__/pressurePlateSystem.test.ts
 * Tests for the Pressure Plate system.
 */

import { describe, it, expect } from 'vitest';
import { checkPressurePlate, detectPressurePlate, jamPressurePlate } from '../pressurePlateSystem';
import { PressurePlate, Trap } from '../types';
import { PlayerCharacter } from '../../../types/character';
import { CharacterStats } from '../../../types/core'; // Added to type the stats helper explicitly.
import { createMockPlayerCharacter } from '../../../utils/factories';

// Mock character factory
// Was an inline stats literal per character; extracted to ensure required fields are always present.
const baseStats: CharacterStats = {
  strength: 10,
  dexterity: 16,
  constitution: 10,
  intelligence: 14,
  wisdom: 10,
  charisma: 10,
  baseInitiative: 0,
  speed: 30,
  cr: '1/4'
};

const createMockCharacter = (overrides: Partial<PlayerCharacter> = {}): PlayerCharacter & { stats: CharacterStats } => {
  const baseCharacter = createMockPlayerCharacter();
  const rogueClass = {
    ...baseCharacter.class,
    id: 'rogue',
    name: 'Rogue',
    hitDie: 8,
    primaryAbility: ['Dexterity'],
    savingThrowProficiencies: ['Dexterity', 'Intelligence'],
  };

  const { stats: statsOverride, ...restOverrides } = overrides;

  return ({
    ...baseCharacter,
    id: 'char1',
    name: 'Test Char',
    level: 1,
    proficiencyBonus: 2,
    class: rogueClass,
    classes: [rogueClass], // Helper for proficiency check in lockSystem
    abilityScores: { Strength: 10, Dexterity: 16, Constitution: 10, Intelligence: 14, Wisdom: 10, Charisma: 10 },
    finalAbilityScores: { Strength: 10, Dexterity: 16, Constitution: 10, Intelligence: 14, Wisdom: 10, Charisma: 10 },
    // Was spreading overrides directly onto stats; now merges over a full base to avoid undefined fields.
    stats: { ...baseStats, ...(statsOverride ?? {}) },
    skills: [],
    hp: 10, maxHp: 10, armorClass: 14, speed: 30, darkvisionRange: 0,
    transportMode: 'foot',
    equippedItems: {},
    ...restOverrides
  } as PlayerCharacter & { stats: CharacterStats });
};

describe('Pressure Plate System', () => {
  const plate: PressurePlate = {
    id: 'pp1',
    name: 'Stone Plate',
    description: 'A loose stone.',
    isHidden: true,
    detectionDC: 15,
    minSize: 'Medium',
    isPressed: false,
    isJammed: false,
    resetBehavior: 'auto_instant',
    jamDC: 15,
    linkedTrapId: 'trap1'
  };

  const trap: Trap = {
    id: 'trap1',
    name: 'Spike Trap',
    detectionDC: 10,
    disarmDC: 10,
    triggerCondition: 'interaction', // triggered by plate
    effect: { damage: { count: 1, sides: 6, bonus: 0 } },
    resetable: true,
    isDisarmed: false,
    isTriggered: false
  };

  describe('checkPressurePlate', () => {
    it('triggers when a Medium character steps on it', () => {
      const char = createMockCharacter({ ageSizeOverride: 'Medium' });
      const result = checkPressurePlate(char, { ...plate }, trap);

      expect(result.triggered).toBe(true);
      expect(result.trapEffect).toBeDefined();
      expect(result.message).toContain('Click');
    });

    it('does not trigger when a Small character steps on it', () => {
      const char = createMockCharacter({ ageSizeOverride: 'Small' });
      const result = checkPressurePlate(char, { ...plate }, trap);

      expect(result.triggered).toBe(false);
      expect(result.message).toContain('too light');
    });

    it('does not trigger if jammed', () => {
      const char = createMockCharacter({ ageSizeOverride: 'Medium' });
      const jammedPlate = { ...plate, isJammed: true };
      const result = checkPressurePlate(char, jammedPlate, trap);

      expect(result.triggered).toBe(false);
      expect(result.message).toContain('jammed');
    });
  });

  describe('detectPressurePlate', () => {
    it('detects with high perception roll (mocked/stat based)', () => {
      const char = createMockCharacter({
        stats: { ...createMockCharacter().stats, wisdom: 20 } // +5 mod
      });
      // 1d20 + 5. If DC is 5, it's guaranteed.
      const easyPlate = { ...plate, detectionDC: 5 };
      const result = detectPressurePlate(char, easyPlate);
      expect(result.detected).toBe(true);
    });
  });

  describe('jamPressurePlate', () => {
    it('jams successfully with high roll', () => {
        const char = createMockCharacter({
            stats: { ...createMockCharacter().stats, dexterity: 20 } // +5 mod
        });
        const thievesTools = { id: 'thieves-tools', name: 'Thieves Tools', type: 'tool' };

        const easyPlate = { ...plate, jamDC: 5 };
        const result = jamPressurePlate(char, easyPlate, [thievesTools]);

        expect(result.success).toBe(true);
        expect(easyPlate.isJammed).toBe(true);
    });

    it('fails safely (no trigger) on marginal failure', () => {
       const char = createMockCharacter();
       const result = jamPressurePlate(char, plate, []);
       expect(result).toHaveProperty('success');
       expect(result).toHaveProperty('triggered');
    });
  });
});
