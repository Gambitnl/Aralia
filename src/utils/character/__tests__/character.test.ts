import { describe, it, expect } from 'vitest';
import { canEquipItem, performLevelUp, applyFeatToCharacter } from '../index';
import { createMockPlayerCharacter, createMockItem } from '../../factories';
import { Item, ArmorCategory, Feat } from '../../../types';
import { FEATS_DATA } from '../../../data/feats/featsData';

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
