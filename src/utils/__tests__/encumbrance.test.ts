import { describe, it, expect } from 'vitest';
import {
  CARRYING_SIZE_MULTIPLIERS,
  calculateCharacterCarryingCapacity,
  getCharacterEncumbrance,
} from '../character/encumbrance';
import { PlayerCharacter } from '../../types';

/**
 * This test suite verifies carrying capacity, push/drag/lift limits, and 5e variant
 * encumbrance thresholds for player and companion characters.
 *
 * In D&D 5e mechanics, a character's carrying capacity is dictated by their Strength
 * score and physical creature size (Tiny through Gargantuan). Special racial traits
 * such as "Powerful Build" (Goliaths, Firbolgs) allow characters to carry weight
 * as if they were one size category larger.
 *
 * Covers: utils/character/encumbrance.ts
 * Tests: Size multipliers, Strength calculations, Powerful Build scaling,
 * variant encumbrance tiers (none, light, medium, heavy), and edge cases.
 */

// ============================================================================
// Fixtures and Mock Character Builders
// ============================================================================
// Helper to construct minimalist PlayerCharacter instances for capacity testing.
// ============================================================================

function createMockCharacter(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
  return {
    id: 'char-test-1',
    name: 'Valeros',
    level: 1,
    race: { id: 'human', name: 'Human' } as any,
    class: { id: 'fighter', name: 'Fighter' } as any,
    hp: 12,
    maxHp: 12,
    abilityScores: {
      Strength: 10,
      Dexterity: 10,
      Constitution: 10,
      Intelligence: 10,
      Wisdom: 10,
      Charisma: 10,
    },
    inventory: [],
    ...overrides,
  } as PlayerCharacter;
}

// ============================================================================
// Size Multipliers and Base Capacity Tests
// ============================================================================
// Verifies 5e size scaling rules and standard formula (STR × 15).
// ============================================================================

describe('Carrying Capacity Calculations', () => {
  it('should have standard 5e size multipliers for all creature sizes', () => {
    expect(CARRYING_SIZE_MULTIPLIERS.Tiny).toBe(0.5);
    expect(CARRYING_SIZE_MULTIPLIERS.Small).toBe(1);
    expect(CARRYING_SIZE_MULTIPLIERS.Medium).toBe(1);
    expect(CARRYING_SIZE_MULTIPLIERS.Large).toBe(2);
    expect(CARRYING_SIZE_MULTIPLIERS.Huge).toBe(4);
    expect(CARRYING_SIZE_MULTIPLIERS.Gargantuan).toBe(8);
  });

  it('should compute base capacity for standard Medium character with STR 10', () => {
    const char = createMockCharacter({
      abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    });

    const capacity = calculateCharacterCarryingCapacity(char);

    // Standard 5e carry: 10 * 15 = 150 lbs
    expect(capacity.carryingCapacity).toBe(150);
    // Push/drag/lift is double carrying capacity: 300 lbs
    expect(capacity.pushDragLift).toBe(300);
    expect(capacity.sizeMultiplier).toBe(1);
    expect(capacity.effectiveMultiplier).toBe(1);

    // Variant encumbrance thresholds: light = 50 lbs, medium = 100 lbs, heavy = 150 lbs
    expect(capacity.encumbrance.light).toBe(50);
    expect(capacity.encumbrance.medium).toBe(100);
    expect(capacity.encumbrance.heavy).toBe(150);
  });

  it('should prioritize finalAbilityScores over base abilityScores', () => {
    const char = createMockCharacter({
      abilityScores: { Strength: 12, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      finalAbilityScores: { Strength: 18, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    });

    const capacity = calculateCharacterCarryingCapacity(char);

    // Should use STR 18: 18 * 15 = 270 lbs
    expect(capacity.carryingCapacity).toBe(270);
    expect(capacity.pushDragLift).toBe(540);
  });

  it('should apply Powerful Build to double effective multiplier and capacity', () => {
    const goliath = createMockCharacter({
      abilityScores: { Strength: 16, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      modifiers: { powerfulBuild: true } as any,
    });

    const capacity = calculateCharacterCarryingCapacity(goliath);

    // Normal Medium STR 16 carry would be 16 * 15 = 240 lbs.
    // Powerful Build doubles to 480 lbs.
    expect(capacity.sizeMultiplier).toBe(1);
    expect(capacity.effectiveMultiplier).toBe(2);
    expect(capacity.carryingCapacity).toBe(480);
    expect(capacity.pushDragLift).toBe(960);

    // Encumbrance thresholds scale proportionally
    expect(capacity.encumbrance.light).toBe(160);
    expect(capacity.encumbrance.medium).toBe(320);
    expect(capacity.encumbrance.heavy).toBe(480);
  });

  it('should scale carrying capacity with size categories', () => {
    // Tiny Fairy (0.5x)
    const fairy = createMockCharacter({
      ageSizeOverride: 'Tiny',
      abilityScores: { Strength: 8, Dexterity: 14, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    });
    const fairyCap = calculateCharacterCarryingCapacity(fairy);
    // 8 * 15 * 0.5 = 60 lbs
    expect(fairyCap.carryingCapacity).toBe(60);

    // Large Centaur (2x)
    const centaur = createMockCharacter({
      ageSizeOverride: 'Large',
      abilityScores: { Strength: 18, Dexterity: 10, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    });
    const centaurCap = calculateCharacterCarryingCapacity(centaur);
    // 18 * 15 * 2 = 540 lbs
    expect(centaurCap.carryingCapacity).toBe(540);
  });
});

// ============================================================================
// Variant Encumbrance Tier Tests
// ============================================================================
// Verifies threshold classification (none -> light -> medium -> heavy).
// ============================================================================

describe('getCharacterEncumbrance', () => {
  const char = createMockCharacter({
    abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
  });
  // Thresholds: light <= 50, medium <= 100, heavy <= 150

  it('should report "none" when carried weight is within light threshold', () => {
    const { level } = getCharacterEncumbrance(char, 40);
    expect(level).toBe('none');
  });

  it('should report "light" when carried weight exceeds light threshold', () => {
    const { level } = getCharacterEncumbrance(char, 65);
    expect(level).toBe('light');
  });

  it('should report "medium" when carried weight exceeds medium threshold', () => {
    const { level } = getCharacterEncumbrance(char, 120);
    expect(level).toBe('medium');
  });

  it('should report "heavy" when carried weight exceeds total capacity', () => {
    const { level } = getCharacterEncumbrance(char, 160);
    expect(level).toBe('heavy');
  });

  it('should handle zero or missing ability scores with graceful defaults', () => {
    const emptyChar = {
      id: 'blank',
      name: 'Blank',
    } as PlayerCharacter;

    const { level, carrying } = getCharacterEncumbrance(emptyChar, 10);
    // Defaults to STR 10 (capacity 150 lbs)
    expect(carrying.carryingCapacity).toBe(150);
    expect(level).toBe('none');
  });
});
