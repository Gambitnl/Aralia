import { describe, it, expect, vi } from 'vitest';
import { canEquipItem, performLevelUp, applyFeatToCharacter, buildHitPointDicePools } from '../characterUtils';
import { createMockPlayerCharacter, createMockItem } from '../../core/factories';
// TODO(lint-intent): 'ArmorCategory' is unused in this test; use it in the assertion path or remove it.
import { Item, ArmorCategory as _ArmorCategory, Feat } from '../../../types';
// The module is mocked below, so we don't import the real data for use, but we might import types if needed.

// Mock the feats data to control what performLevelUp sees
vi.mock('../../data/feats/featsData', () => ({
  FEATS_DATA: [
    {
      id: 'tough',
      name: 'Tough',
      description: 'HP boost',
      benefits: {
        hpMaxIncreasePerLevel: 2
      }
    },
    {
        id: 'resilient',
        name: 'Resilient',
        benefits: {
            selectableAbilityScores: ['Strength', 'Constitution'],
            savingThrowLinkedToAbility: true
        }
    }
  ]
}));

describe('characterUtils', () => {
  describe('canEquipItem', () => {
    it('should allow equipping item with no requirements', () => {
      const character = createMockPlayerCharacter();
      const item = createMockItem({ requirements: undefined });

      const result = canEquipItem(character, item);
      expect(result.can).toBe(true);
    });

    it('should fail if character level is too low', () => {
      const character = createMockPlayerCharacter({ level: 3 });
      const item = createMockItem({
        requirements: { minLevel: 5 }
      });

      const result = canEquipItem(character, item);
      expect(result.can).toBe(false);
      expect(result.reason).toContain('Requires Level 5');
    });

    it('should fail if character lacks required stats', () => {
      const character = createMockPlayerCharacter({
        finalAbilityScores: {
          Strength: 10,
          Dexterity: 10,
          Constitution: 10,
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10
        }
      });
      const item = createMockItem({
        requirements: { minStrength: 15 }
      });

      const result = canEquipItem(character, item);
      expect(result.can).toBe(false);
      expect(result.reason).toContain('Requires 15 Strength');
    });

    it('should check armor proficiency', () => {
      const character = createMockPlayerCharacter({
        class: {
            id: 'wizard',
            name: 'Wizard',
            hitDie: 6,
            primaryAbility: ['Intelligence'],
            savingThrowProficiencies: ['Intelligence', 'Wisdom'],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 2,
            armorProficiencies: [], // No armor
            weaponProficiencies: [],
            features: [],
            description: 'Wizard'
        }
      });

      const heavyArmor: Item = createMockItem({
        type: 'armor',
        armorCategory: 'Heavy'
      });

      const result = canEquipItem(character, heavyArmor);
      expect(result.can).toBe(false);
      expect(result.reason).toContain('Not proficient with Heavy armor');
    });

    it('should allow armor if proficient', () => {
      const character = createMockPlayerCharacter({
        class: {
            id: 'fighter',
            name: 'Fighter',
            hitDie: 10,
            primaryAbility: ['Strength'],
            savingThrowProficiencies: ['Strength', 'Constitution'],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 2,
            armorProficiencies: ['heavy armor', 'medium armor', 'light armor', 'shields'],
            weaponProficiencies: [],
            features: [],
            description: 'Fighter'
        }
      });

      const heavyArmor: Item = createMockItem({
        type: 'armor',
        armorCategory: 'Heavy'
      });

      const result = canEquipItem(character, heavyArmor);
      expect(result.can).toBe(true);
    });

    it('should check shield proficiency explicitly', () => {
       const character = createMockPlayerCharacter({
        class: {
            id: 'rogue',
            name: 'Rogue',
            hitDie: 8,
            primaryAbility: ['Dexterity'],
            savingThrowProficiencies: ['Dexterity'],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 4,
            armorProficiencies: ['light armor'], // No shields
            weaponProficiencies: [],
            features: [],
            description: 'Rogue'
        }
      });

      const shield: Item = createMockItem({
        type: 'armor',
        armorCategory: 'Shield'
      });

      const result = canEquipItem(character, shield);
      expect(result.can).toBe(false);
      expect(result.reason).toContain('Not proficient with shields');
    });

    it('should allow weapon equip even if not proficient, but warn', () => {
        const character = createMockPlayerCharacter({
            class: {
                id: 'wizard',
                name: 'Wizard',
                hitDie: 6,
                primaryAbility: ['Intelligence'],
                savingThrowProficiencies: ['Intelligence', 'Wisdom'],
                skillProficienciesAvailable: [],
                numberOfSkillProficiencies: 2,
                armorProficiencies: [],
                weaponProficiencies: ['dagger', 'dart', 'sling', 'quarterstaff', 'light crossbow'],
                features: [],
                description: 'Wizard'
            }
        });

        // Greatsword is martial, wizard not proficient
        const greatsword = createMockItem({
            type: 'weapon',
            id: 'greatsword',
            category: 'Martial Weapon'
        });

        const result = canEquipItem(character, greatsword);

        // Should return true (can equip) but with a reason (warning)
        expect(result.can).toBe(true);
        expect(result.reason).toContain('Not proficient with Martial weapons');
    });
  });

  describe('performLevelUp', () => {
    it('should increment level and increase HP', () => {
      // Create character at level 1
      const character = createMockPlayerCharacter({
        level: 1,
        xp: 300, // Enough for level 2
        hp: 10,
        maxHp: 10,
        class: {
          id: 'fighter',
          name: 'Fighter',
          hitDie: 10, // Average roll is 5 + 1 = 6
          primaryAbility: ['Strength'],
          savingThrowProficiencies: ['Strength', 'Constitution'],
          skillProficienciesAvailable: [],
          numberOfSkillProficiencies: 2,
          armorProficiencies: [],
          weaponProficiencies: [],
          features: [],
          description: 'Fighter'
        },
        // IMPORTANT: Ensure base scores match intended final scores to avoid retroactive penalties
        // when performLevelUp recalculates derived stats.
        abilityScores: {
          Strength: 10,
          Dexterity: 10,
          Constitution: 14, // +2 Mod
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10
        },
        finalAbilityScores: {
          Strength: 10,
          Dexterity: 10,
          Constitution: 14, // +2 Mod
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10
        }
      });

      const leveled = performLevelUp(character);

      expect(leveled.level).toBe(2);

      // Expected HP gain:
      // Hit Die Average (10/2 + 1 = 6) + Con Mod (2) = 8
      // New Max HP = 10 + 8 = 18
      expect(leveled.maxHp).toBe(18);
      expect(leveled.hp).toBe(18); // Heals to max on level up
    });

    it('should grant a new hit point die on level up while preserving spent dice', () => {
      const character = createMockPlayerCharacter({
        level: 1,
        xp: 300,
        hitPointDice: [{ die: 10, current: 0, max: 1 }],
        class: {
          id: 'fighter',
          name: 'Fighter',
          hitDie: 10,
          primaryAbility: ['Strength'],
          savingThrowProficiencies: ['Strength', 'Constitution'],
          skillProficienciesAvailable: [],
          numberOfSkillProficiencies: 2,
          armorProficiencies: [],
          weaponProficiencies: [],
          features: [],
          description: 'Fighter'
        },
        abilityScores: {
          Strength: 10,
          Dexterity: 10,
          Constitution: 14,
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10
        },
        finalAbilityScores: {
          Strength: 10,
          Dexterity: 10,
          Constitution: 14,
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10
        },
        classLevels: { fighter: 1 }
      });

      const leveled = performLevelUp(character);

      expect(leveled.classLevels?.fighter).toBe(2);
      expect(leveled.hitPointDice).toEqual([{ die: 10, current: 1, max: 2 }]);
    });

    it('uses the chosen class hit die when leveling a multiclass character', () => {
      const fighterClass = {
        id: 'fighter',
        name: 'Fighter',
        hitDie: 10,
        primaryAbility: ['Strength'],
        savingThrowProficiencies: ['Strength', 'Constitution'],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 2,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
        description: 'Fighter'
      };
      const wizardClass = {
        id: 'wizard',
        name: 'Wizard',
        hitDie: 6,
        primaryAbility: ['Intelligence'],
        savingThrowProficiencies: ['Intelligence', 'Wisdom'],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 2,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
        description: 'Wizard'
      };
      const character = createMockPlayerCharacter({
        level: 2,
        xp: 900,
        class: fighterClass,
        classes: [fighterClass, wizardClass],
        classLevels: { fighter: 1, wizard: 1 },
        abilityScores: {
          Strength: 10,
          Dexterity: 10,
          Constitution: 10,
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10
        },
        finalAbilityScores: {
          Strength: 10,
          Dexterity: 10,
          Constitution: 10,
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10
        },
        hitPointDice: [
          { die: 10, current: 1, max: 1 },
          { die: 6, current: 1, max: 1 }
        ],
        maxHp: 14,
        hp: 10,
      });

      // Level up as Wizard to gain a d6 hit die.
      const leveled = performLevelUp(character, { classId: 'wizard' });

      expect(leveled.classLevels?.wizard).toBe(2);
      expect(leveled.hitPointDice).toEqual([
        { die: 6, current: 2, max: 2 },
        { die: 10, current: 1, max: 1 }
      ]);
      expect(leveled.maxHp).toBe(18);
    });

    it('should apply Ability Score Improvements at level 4', () => {
       const character = createMockPlayerCharacter({
        level: 3,
        xp: 2700,
        class: {
          id: 'fighter',
          name: 'Fighter',
          hitDie: 10,
          primaryAbility: ['Strength'],
          savingThrowProficiencies: [],
          skillProficienciesAvailable: [],
          numberOfSkillProficiencies: 2,
          armorProficiencies: [],
          weaponProficiencies: [],
          features: [],
          description: 'Fighter'
        },
        abilityScores: {
          Strength: 16,
          Dexterity: 10,
          Constitution: 14,
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10
        },
        finalAbilityScores: { // Needs to match for consistency
          Strength: 16,
          Dexterity: 10,
          Constitution: 14,
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10
        }
      });

      // Level up to 4, choosing Strength +2
      const leveled = performLevelUp(character, {
        abilityScoreIncreases: { Strength: 2 }
      });

      expect(leveled.level).toBe(4);
      expect(leveled.abilityScores.Strength).toBe(18);
      // Verify derived stats updated
      expect(leveled.finalAbilityScores.Strength).toBe(18);
    });

    it('should retroactive apply CON bonus to HP', () => {
      // Level 3 character with CON 14 (+2)
      // Level up to 4, increase CON to 16 (+3)
      // Should gain normal level HP using NEW mod (+3)
      // AND gain +1 HP for each of the 3 previous levels

      const character = createMockPlayerCharacter({
        level: 3,
        xp: 2700,
        maxHp: 28, // e.g. 10 + 6 + 6 (assuming base 10 + 4, avg 6+2=8 per level) -> actually 12 + 8 + 8 = 28
        class: {
          id: 'fighter',
          name: 'Fighter',
          hitDie: 10,
          primaryAbility: ['Strength'],
          savingThrowProficiencies: [],
          skillProficienciesAvailable: [],
          numberOfSkillProficiencies: 2,
          armorProficiencies: [],
          weaponProficiencies: [],
          features: [],
          description: 'Fighter'
        },
        abilityScores: {
            Strength: 10, Dexterity: 10, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 10
        },
        finalAbilityScores: {
            Strength: 10, Dexterity: 10, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 10
        }
      });

      const leveled = performLevelUp(character, {
        abilityScoreIncreases: { Constitution: 2 }
      });

      expect(leveled.level).toBe(4);
      expect(leveled.finalAbilityScores.Constitution).toBe(16); // Mod +3

      // Calculation:
      // Old Max HP: 28
      // New Level Gain: 6 (avg) + 3 (new mod) = 9
      // Retroactive: (3 - 2) * 3 levels = 3
      // Total New Max: 28 + 9 + 3 = 40
      expect(leveled.maxHp).toBe(40);
    });

    it('should retroactive apply feat HP bonus (e.g. Tough)', () => {
      // Level 3 character (Fighter), CON 10 (0 mod)
      // Hit die avg 6. Level 1 (10) + Level 2 (6) + Level 3 (6) = 22 HP
      const character = createMockPlayerCharacter({
        level: 3,
        xp: 2700,
        maxHp: 22,
        class: {
          id: 'fighter',
          name: 'Fighter',
          hitDie: 10,
          primaryAbility: ['Strength'],
          savingThrowProficiencies: ['Strength', 'Constitution'],
          skillProficienciesAvailable: [],
          numberOfSkillProficiencies: 2,
          armorProficiencies: [],
          weaponProficiencies: [],
          features: [],
          description: 'Fighter'
        },
        abilityScores: {
            Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10
        },
        finalAbilityScores: {
            Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10
        },
        feats: [] // No prior feats
      });

      // Choose "Tough" feat (ID: 'tough') which gives +2 HP per level
      // Mocked above to have benefits.hpMaxIncreasePerLevel: 2
      const leveled = performLevelUp(character, {
        featId: 'tough'
      });

      expect(leveled.level).toBe(4);
      expect(leveled.feats).toContain('tough');

      // Calculation:
      // Old Max HP: 22
      // Level 4 gain: 6 (avg) + 0 (con) + 2 (feat per level) = 8
      // Retroactive Feat: (2 - 0) * 3 previous levels = 6
      // Total: 22 + 8 + 6 = 36
      // Verification: 4 levels * (6 + 2) + level 1 bonus (4) = 32 + 4 = 36. Correct.
      expect(leveled.maxHp).toBe(36);
    });
  });

  describe('buildHitPointDicePools', () => {
    it('builds pools by die size for multiclass characters', () => {
      const baseScores = {
        Strength: 10,
        Dexterity: 10,
        Constitution: 10,
        Intelligence: 10,
        Wisdom: 10,
        Charisma: 10
      };
      const fighterClass = {
        id: 'fighter',
        name: 'Fighter',
        hitDie: 10,
        primaryAbility: ['Strength'],
        savingThrowProficiencies: ['Strength', 'Constitution'],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 2,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
        description: 'Fighter'
      };
      const wizardClass = {
        id: 'wizard',
        name: 'Wizard',
        hitDie: 6,
        primaryAbility: ['Intelligence'],
        savingThrowProficiencies: ['Intelligence', 'Wisdom'],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 2,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
        description: 'Wizard'
      };

      const character = createMockPlayerCharacter({
        level: 3,
        class: fighterClass,
        classes: [fighterClass, wizardClass],
        classLevels: { fighter: 2, wizard: 1 },
        abilityScores: baseScores,
        finalAbilityScores: baseScores,
        hitPointDice: undefined
      });

      const pools = buildHitPointDicePools(character);

      expect(pools).toEqual([
        { die: 6, current: 1, max: 1 },
        { die: 10, current: 2, max: 2 }
      ]);
    });
  });

  describe('applyFeatToCharacter', () => {
    it('should apply static ability score increases', () => {
      const character = createMockPlayerCharacter({
        abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 }
      });

      const feat: Feat = {
        id: 'athlete',
        name: 'Athlete',
        description: '...',
        benefits: {
          abilityScoreIncrease: { Strength: 1 }
        }
      };

      const result = applyFeatToCharacter(character, feat);
      expect(result.abilityScores.Strength).toBe(11);
    });

    it('should apply selectable ability score increases', () => {
        const character = createMockPlayerCharacter({
            abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 }
        });

        const feat: Feat = {
            id: 'resilient',
            name: 'Resilient',
            description: '...',
            benefits: {
                selectableAbilityScores: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
            }
        };

        const result = applyFeatToCharacter(character, feat, {
            selectedAbilityScore: 'Constitution'
        });

        expect(result.abilityScores.Constitution).toBe(11);
    });

    it('should warn if selectable ability score is required but missing', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const character = createMockPlayerCharacter();
        const feat: Feat = {
            id: 'resilient',
            name: 'Resilient',
            description: '...',
            benefits: {
                selectableAbilityScores: ['Strength']
            }
        };

        // No selection provided
        applyFeatToCharacter(character, feat);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('requires an ability score selection'));
        consoleSpy.mockRestore();
    });

    it('should apply speed bonus', () => {
        const character = createMockPlayerCharacter({ speed: 30 });
        const feat: Feat = {
            id: 'mobile',
            name: 'Mobile',
            description: '...',
            benefits: {
                speedIncrease: 10
            }
        };

        const result = applyFeatToCharacter(character, feat);
        expect(result.speed).toBe(40);
    });

    it('should apply saving throw proficiency based on selection', () => {
        const character = createMockPlayerCharacter({
            savingThrowProficiencies: []
        });

        const feat: Feat = {
            id: 'resilient',
            name: 'Resilient',
            description: '...',
            benefits: {
                savingThrowLinkedToAbility: true,
                selectableAbilityScores: ['Wisdom']
            }
        };

        const result = applyFeatToCharacter(character, feat, {
            selectedAbilityScore: 'Wisdom'
        });

        expect(result.savingThrowProficiencies).toContain('Wisdom');
    });
  });
});
