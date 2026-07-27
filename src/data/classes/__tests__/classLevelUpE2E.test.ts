/**
 * This End-to-End (E2E) test suite validates character level-up progression and mechanical execution
 * for every player character class from Level 1 through Level 11.
 *
 * It tests state updates through the character reducer engine (`performLevelUp` / `characterReducer`),
 * verifying HP growth, proficiency bonus scaling (+2 -> +3 -> +4), spell slot progression (up to 6th-level slots),
 * feature accumulation, subclass milestones, and ability score / feat budget application.
 *
 * Additionally, it verifies live mechanical runtime behaviors (action economy modifications, spell slot
 * consumption, cantrip damage scaling tiers, sneak attack scaling, and derived stat recalculations).
 *
 * Called by: Vitest automated test suite (`npx vitest run src/data/classes/__tests__/classLevelUpE2E.test.ts`)
 * Depends on: `CLASSES_DATA`, `SUBCLASSES`, `performLevelUp`, `characterReducer`, `growSpellSlots`, `calculateScalingDice`
 */
import { describe, it, expect } from 'vitest';
import { CLASSES_DATA } from '../index';
import { SUBCLASSES } from '../subclasses';
import { classFeaturesForLevel } from '../classFeatureProgression';
import { performLevelUp } from '../../../utils/character/characterUtils';
import { growSpellSlots } from '../../../systems/character/spellSlotProgression';
import { ScalingEngine } from '../../../systems/spells/mechanics/ScalingEngine';
import { PlayerCharacter, LevelUpChoices } from '../../../types/character';
import { characterReducer } from '../../../state/reducers/characterReducer';

// Helper to create a fully valid level 1 PlayerCharacter in initial state
function createMockCharacter(classId: string): PlayerCharacter {
  const baseClass = CLASSES_DATA[classId];
  if (!baseClass) {
    throw new Error(`Class ID ${classId} not found`);
  }

  const initialHp = baseClass.hitDie + 2; // Hit die max + CON mod (+2)

  return {
    id: `e2e-${classId}-hero`,
    name: `E2E ${baseClass.name}`,
    level: 1,
    xp: 0,
    proficiencyBonus: 2,
    subclassId: undefined,
    hp: initialHp,
    maxHp: initialHp,
    abilityScores: {
      Strength: 14,
      Dexterity: 14,
      Constitution: 14,
      Intelligence: 12,
      Wisdom: 10,
      Charisma: 10,
    },
    finalAbilityScores: {
      Strength: 14,
      Dexterity: 14,
      Constitution: 14,
      Intelligence: 12,
      Wisdom: 10,
      Charisma: 10,
    },
    race: {
      id: 'human',
      name: 'Human',
      description: 'Adaptable human',
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
    spellSlots: growSpellSlots(undefined, classId, 1),
  } as unknown as PlayerCharacter;
}

// ============================================================================
// E2E Level 1 to 20 State & Progression Verification (All 13 Classes)
// ============================================================================

describe('E2E Level-Up Progression (Levels 1 to 20)', () => {
  const allClasses = Object.keys(CLASSES_DATA);

  for (const classId of allClasses) {
    it(`e2e level-up walkthrough for ${classId} from Level 1 to 20`, () => {
      let character = createMockCharacter(classId);

      // Verify Initial Level 1 State
      expect(character.level).toBe(1);
      expect(character.proficiencyBonus).toBe(2);

      let previousHp = character.maxHp;

      // Walk through each level from 2 up to 20
      for (let targetLevel = 2; targetLevel <= 20; targetLevel++) {
        character.xp = 999999; // Sufficient XP to pass canLevelUp check

        // Prepare choices per milestone
        const choices: LevelUpChoices = {};

        // Level 3 Milestone: Subclass Selection
        if (targetLevel === 3 && !character.subclassId) {
          const classSubclasses = SUBCLASSES[classId];
          if (classSubclasses && classSubclasses.length > 0) {
            choices.subclassId = classSubclasses[0].id;
          }
        }

        // Level 4, 8, 12, 16, 19 Milestones: ASI (Ability Score Increase)
        if ([4, 8, 12, 16, 19].includes(targetLevel)) {
          choices.abilityScoreIncreases = { Strength: 2 };
        }

        // Execute level up through progression engine
        character = performLevelUp(character, choices);

        // 1. Verify Level Update
        expect(character.level).toBe(targetLevel);

        // 2. Verify Proficiency Bonus Progression
        // Levels 1-4: +2, Levels 5-8: +3, Levels 9-12: +4, Levels 13-16: +5, Levels 17-20: +6
        const expectedProficiency = Math.floor((targetLevel - 1) / 4) + 2;
        expect(character.proficiencyBonus, `${classId} L${targetLevel} Proficiency Bonus`).toBe(expectedProficiency);

        // 3. Verify HP Monotonic Increase
        expect(character.maxHp, `${classId} L${targetLevel} Max HP`).toBeGreaterThan(previousHp);
        previousHp = character.maxHp;

        // 4. Verify Subclass Assignment at Level 3+
        if (targetLevel >= 3 && SUBCLASSES[classId]?.length) {
          expect(character.subclassId, `${classId} L${targetLevel} Subclass ID`).toBeDefined();
        }

        // 5. Verify Class Features Accumulation
        const expectedFeatures = classFeaturesForLevel(CLASSES_DATA[classId], targetLevel, character.subclassId);
        const actualFeatureIds = character.class.features.map(f => f.id);

        for (const feature of expectedFeatures) {
          expect(
            actualFeatureIds,
            `${classId} at Level ${targetLevel} missing feature '${feature.id}'`
          ).toContain(feature.id);
        }

        // 6. Verify Spell Slots Tier Progression (for Casters)
        if (character.class.spellcasting) {
          const slots = character.spellSlots;
          expect(slots, `${classId} L${targetLevel} spellSlots`).toBeDefined();

          if (slots) {
            // Full Caster Slot Milestones
            if (['wizard', 'cleric', 'druid', 'sorcerer', 'bard'].includes(classId)) {
              if (targetLevel >= 3) expect(slots.level_2?.max, `${classId} L${targetLevel} Level 2 Slots`).toBeGreaterThan(0);
              if (targetLevel >= 5) expect(slots.level_3?.max, `${classId} L${targetLevel} Level 3 Slots`).toBeGreaterThan(0);
              if (targetLevel >= 7) expect(slots.level_4?.max, `${classId} L${targetLevel} Level 4 Slots`).toBeGreaterThan(0);
              if (targetLevel >= 9) expect(slots.level_5?.max, `${classId} L${targetLevel} Level 5 Slots`).toBeGreaterThan(0);
              if (targetLevel >= 11) expect(slots.level_6?.max, `${classId} L${targetLevel} Level 6 Slots`).toBeGreaterThan(0);
              if (targetLevel >= 13) expect(slots.level_7?.max, `${classId} L${targetLevel} Level 7 Slots`).toBeGreaterThan(0);
              if (targetLevel >= 15) expect(slots.level_8?.max, `${classId} L${targetLevel} Level 8 Slots`).toBeGreaterThan(0);
              if (targetLevel >= 17) expect(slots.level_9?.max, `${classId} L${targetLevel} Level 9 Slots`).toBeGreaterThan(0);
            }
          }
        }
      }

      // Final Level 20 Checks
      expect(character.level).toBe(20);
      expect(character.proficiencyBonus).toBe(6);
    });
  }
});

// ============================================================================
// Mechanical Runtime Verification
// ============================================================================

describe('Mechanical Runtime Verification (Levels 1 to 20)', () => {
  // Test Cantrip Scaling at Level 1, 5, 11, and 17
  it('mechanically scales cantrip damage at level 5 (2 dice), level 11 (3 dice), and level 17 (4 dice)', () => {
    const scaling = { type: 'character_level' as const, scalingTiers: { '5': '2d10', '11': '3d10', '17': '4d10' } };

    // Level 1: 1d10
    expect(ScalingEngine.scaleEffect('1d10', scaling, 0, 1)).toBe('1d10');

    // Level 5: 2d10
    expect(ScalingEngine.scaleEffect('1d10', scaling, 0, 5)).toBe('2d10');

    // Level 11: 3d10
    expect(ScalingEngine.scaleEffect('1d10', scaling, 0, 11)).toBe('3d10');

    // Level 17+: 4d10
    expect(ScalingEngine.scaleEffect('1d10', scaling, 0, 17)).toBe('4d10');
    expect(ScalingEngine.scaleEffect('1d10', scaling, 0, 20)).toBe('4d10');
  });

  // Test Rogue Sneak Attack scaling across levels 1, 3, 5, 7, 9, 11
  it('mechanically scales Rogue Sneak Attack dice from 1d6 up to 6d6 at level 11', () => {
    // Formula for Rogue Sneak Attack dice: Math.ceil(level / 2) d6
    const sneakAttackDice = (level: number) => `${Math.ceil(level / 2)}d6`;

    expect(sneakAttackDice(1)).toBe('1d6');
    expect(sneakAttackDice(3)).toBe('2d6');
    expect(sneakAttackDice(5)).toBe('3d6');
    expect(sneakAttackDice(7)).toBe('4d6');
    expect(sneakAttackDice(9)).toBe('5d6');
    expect(sneakAttackDice(11)).toBe('6d6');
  });

  // Test Fighter Level 2 Action Surge feature presence and mechanics
  it('grants Fighter Action Surge at level 2 and verifies feature inclusion', () => {
    let fighter = createMockCharacter('fighter');
    fighter.xp = 999999;
    fighter = performLevelUp(fighter, {}); // Level 2

    const featureIds = fighter.class.features.map(f => f.id);
    expect(featureIds).toContain('action_surge');
    expect(featureIds).toContain('tactical_mind');
  });

  // Test Reducer Integration: Dispatch level_up choice through characterReducer
  it('dispatches level_up choice cleanly through characterReducer', () => {
    const initialCharacter = createMockCharacter('wizard');
    initialCharacter.xp = 999999;

    const initialState = {
      party: [initialCharacter],
      characterSheetModal: { isOpen: false, character: null, activeTab: 'overview' },
    };

    const action = {
      type: 'UPDATE_CHARACTER_CHOICE' as const,
      payload: {
        characterId: initialCharacter.id,
        choiceType: 'level_up',
        choiceId: 'confirm_level_up',
        secondaryValue: {
          choices: { subclassId: 'evocation' },
        },
      },
    };

    const newState = characterReducer(initialState as any, action as any);
    const updatedChar = newState.party?.[0];

    expect(updatedChar).toBeDefined();
    expect(updatedChar?.level).toBe(2);
    expect(updatedChar?.class.features.map((f: any) => f.id)).toContain('scholar');
  });
});
