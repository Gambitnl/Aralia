/**
 * This test file systematically verifies that every player class has valid class features,
 * and that these features are correctly added to a character as they level up from Level 1 to 20.
 *
 * It checks all 13 supported classes (Fighter, Barbarian, Bard, Cleric, Druid, Ranger, Rogue,
 * Paladin, Monk, Sorcerer, Warlock, Wizard, and Artificer), validating level 1 base features,
 * level 2-3 tier-one class abilities, and level 3 subclass milestone abilities.
 *
 * Called by: Vitest automated test suite (`npx vitest run src/data/classes/__tests__`)
 * Depends on: `CLASSES_DATA`, `performLevelUp`, `classFeaturesForLevel`, and `SUBCLASSES`
 */
import { describe, it, expect } from 'vitest';
import { CLASSES_DATA } from '../index';
import { SUBCLASSES } from '../subclasses';
import { TIER_ONE_FEATURES } from '../tierOneFeatures';
import { classFeaturesForLevel } from '../classFeatureProgression';
import { performLevelUp } from '../../../utils/character/characterUtils';
import { PlayerCharacter } from '../../../types/character';

// Helper function to build a minimal mock level 1 character for any given class
function createMockLevelOneCharacter(classId: string): PlayerCharacter {
  const baseClass = CLASSES_DATA[classId];
  if (!baseClass) {
    throw new Error(`Unknown class ID: ${classId}`);
  }

  return {
    id: `test-${classId}-character`,
    name: `Test ${baseClass.name}`,
    level: 1,
    xp: 0,
    proficiencyBonus: 2,
    hp: 10 + (baseClass.hitDie / 2),
    maxHp: 10 + (baseClass.hitDie / 2),
    abilityScores: {
      Strength: 10,
      Dexterity: 10,
      Constitution: 10,
      Intelligence: 10,
      Wisdom: 10,
      Charisma: 10,
    },
    finalAbilityScores: {
      Strength: 10,
      Dexterity: 10,
      Constitution: 10,
      Intelligence: 10,
      Wisdom: 10,
      Charisma: 10,
    },
    race: {
      id: 'human',
      name: 'Human',
      description: 'Adaptable humans',
      speed: 30,
      abilityScoreIncreases: { Strength: 1, Dexterity: 1, Constitution: 1, Intelligence: 1, Wisdom: 1, Charisma: 1 },
      traits: [],
    },
    class: { ...baseClass },
    equippedItems: [],
    inventory: [],
    feats: [],
    skills: [],
    weaponProficiencies: [],
    armorProficiencies: [],
    modifiers: { advantage: [], disadvantage: [], bonuses: [] },
  } as unknown as PlayerCharacter;
}

// Helper to calculate total XP required to reach a specific level in 5e rules
function getXpForLevel(level: number): number {
  const xpTable: Record<number, number> = {
    1: 0,
    2: 300,
    3: 900,
    4: 2700,
    5: 6500,
    6: 14000,
    7: 23000,
    8: 34000,
    9: 48000,
    10: 64000,
    11: 85000,
    12: 100000,
    13: 120000,
    14: 140000,
    15: 161000,
    16: 185000,
    17: 210000,
    18: 240000,
    19: 270000,
    20: 305000,
  };
  return xpTable[level] ?? 0;
}

// ============================================================================
// Class Abilities Existence Audit
// ============================================================================

describe('Class Abilities Existence Audit', () => {
  // Verify that all 13 core classes exist in CLASSES_DATA
  it('defines all 13 standard player classes in CLASSES_DATA', () => {
    const expectedClasses = [
      'fighter', 'barbarian', 'bard', 'cleric', 'druid',
      'ranger', 'rogue', 'paladin', 'monk', 'sorcerer',
      'warlock', 'wizard', 'artificer'
    ];

    for (const classId of expectedClasses) {
      expect(CLASSES_DATA[classId], `Missing class definition for ${classId}`).toBeDefined();
      expect(CLASSES_DATA[classId].id).toBe(classId);
      expect(CLASSES_DATA[classId].features, `Class ${classId} has no level-1 features array`).toBeDefined();
    }
  });

  // Verify that every class has tier-one features defined for levels 2 and 3
  it('defines tier-one progression features for every class in TIER_ONE_FEATURES', () => {
    const allClasses = Object.keys(CLASSES_DATA);

    for (const classId of allClasses) {
      const tierOne = TIER_ONE_FEATURES[classId];
      expect(tierOne, `Missing TIER_ONE_FEATURES for class ${classId}`).toBeDefined();
      expect(tierOne.length, `Class ${classId} has empty tier-one features`).toBeGreaterThan(0);
    }
  });

  // Verify that every class has at least two subclass choices defined for level 3
  it('defines at least two subclass options per class in SUBCLASSES', () => {
    const allClasses = Object.keys(CLASSES_DATA);

    for (const classId of allClasses) {
      const subclasses = SUBCLASSES[classId];
      expect(subclasses, `Missing SUBCLASSES for class ${classId}`).toBeDefined();
      expect(subclasses.length, `Class ${classId} should have at least 2 subclasses for specialization choices`).toBeGreaterThanOrEqual(2);

      // Verify that each subclass grants at least one unique subclass feature
      for (const sub of subclasses) {
        expect(sub.features, `Subclass ${sub.name} (${sub.id}) has no features`).toBeDefined();
        expect(sub.features.length, `Subclass ${sub.name} (${sub.id}) feature array is empty`).toBeGreaterThan(0);
      }
    }
  });
});

// ============================================================================
// Level-Up Feature Progression Audit (Levels 1 to 20)
// ============================================================================

describe('Level-Up Class Feature Addition', () => {
  // Test level-up progression for every class from Level 1 to 20
  const allClasses = Object.keys(CLASSES_DATA);

  for (const classId of allClasses) {
    it(`correctly accumulates class features as a ${classId} levels up from Level 1 to 20`, () => {
      let character = createMockLevelOneCharacter(classId);

      // Verify level 1 features
      const level1Features = classFeaturesForLevel(character.class, 1);
      expect(character.class.features.map(f => f.id)).toEqual(level1Features.map(f => f.id));

      // Level up step by step to level 20
      for (let targetLevel = 2; targetLevel <= 20; targetLevel++) {
        // Set XP high enough so canLevelUp always returns true
        character.xp = 999999;

        // Supply subclass choice if stepping onto level 3
        const subclassChoice = targetLevel >= 3 && !character.subclassId
          ? SUBCLASSES[classId][0].id
          : character.subclassId;

        character = performLevelUp(character, { subclassId: subclassChoice });

        expect(character.level).toBe(targetLevel);

        // Expected features derived from classFeaturesForLevel for this level and subclass
        const expectedFeatures = classFeaturesForLevel(
          CLASSES_DATA[classId],
          targetLevel,
          character.subclassId
        );

        const actualFeatureIds = character.class.features.map(f => f.id);
        const expectedFeatureIds = expectedFeatures.map(f => f.id);

        // All expected feature IDs must be present on the character
        for (const expectedId of expectedFeatureIds) {
          expect(
            actualFeatureIds,
            `${classId} at Level ${targetLevel} is missing feature '${expectedId}'`
          ).toContain(expectedId);
        }

        // Verify no duplicate feature IDs exist on the character
        const uniqueFeatureIds = new Set(actualFeatureIds);
        expect(actualFeatureIds.length).toBe(uniqueFeatureIds.size);
      }
    });
  }

  // Verify that choosing different subclasses at level 3 grants their respective subclass features
  it('grants distinct subclass features depending on the chosen subclass at level 3', () => {
    const fighterSubclasses = SUBCLASSES['fighter']; // Champion vs Battle Master
    expect(fighterSubclasses.length).toBeGreaterThanOrEqual(2);

    const sub1 = fighterSubclasses[0].id; // champion
    const sub2 = fighterSubclasses[1].id; // battle_master

    let char1 = createMockLevelOneCharacter('fighter');
    char1.xp = 900; // Level 3 threshold
    char1 = performLevelUp(char1, {}); // Level 2
    char1 = performLevelUp(char1, { subclassId: sub1 }); // Level 3 Champion

    let char2 = createMockLevelOneCharacter('fighter');
    char2.xp = 900;
    char2 = performLevelUp(char2, {});
    char2 = performLevelUp(char2, { subclassId: sub2 }); // Level 3 Battle Master

    expect(char1.subclassId).toBe(sub1);
    expect(char2.subclassId).toBe(sub2);

    const char1FeatureIds = char1.class.features.map(f => f.id);
    const char2FeatureIds = char2.class.features.map(f => f.id);

    // Champion gets improved_critical
    expect(char1FeatureIds).toContain('improved_critical');
    expect(char1FeatureIds).not.toContain('combat_superiority');

    // Battle Master gets combat_superiority
    expect(char2FeatureIds).toContain('combat_superiority');
    expect(char2FeatureIds).not.toContain('improved_critical');
  });
});
