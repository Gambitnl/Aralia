import { describe, it, expect, vi } from 'vitest';
import {
  canEquipItem,
  performLevelUp,
  applyFeatToCharacter,
  buildHitPointDicePools,
  normalizeCharacterRaceData,
  applyRacialSpellGrantsByLevel,
  getPreparedSpellsAffectingLimit,
  isRacialSpellCastLevelAllowed,
  isRacialSpellLockedForPreparation,
  resolveRacialSpellLimitedUseId,
} from '../characterUtils';
import { createMockPlayerCharacter, createMockItem } from '../../core/factories';
// TODO(lint-intent): 'ArmorCategory' is unused in this test; use it in the assertion path or remove it.
import { Item, ArmorCategory as _ArmorCategory, Feat, AbilityScoreName, Class } from '../../../types';
import { DEEP_GNOME_DATA } from '../../../data/races/deep_gnome';
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
          primaryAbility: ['Intelligence'] as AbilityScoreName[],
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
          primaryAbility: ['Strength'] as AbilityScoreName[],
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
          primaryAbility: ['Dexterity'] as AbilityScoreName[],
          savingThrowProficiencies: ['Dexterity'] as AbilityScoreName[],
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
          primaryAbility: ['Intelligence'] as AbilityScoreName[],
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
          primaryAbility: ['Strength'] as AbilityScoreName[],
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
          primaryAbility: ['Strength'] as AbilityScoreName[],
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
      const fighterClass: Class = {
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
      const wizardClass: Class = {
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
          primaryAbility: ['Strength'] as AbilityScoreName[],
          savingThrowProficiencies: [] as AbilityScoreName[],
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
          primaryAbility: ['Strength'] as AbilityScoreName[],
          savingThrowProficiencies: [] as AbilityScoreName[],
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
          primaryAbility: ['Strength'] as AbilityScoreName[],
          savingThrowProficiencies: ['Strength', 'Constitution'] as AbilityScoreName[],
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
      const fighterClass: Class = {
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
      const wizardClass: Class = {
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

  describe('normalizeCharacterRaceData', () => {
    it('reattaches serialized characters to canonical race data and derived race mechanics', () => {
      const character = createMockPlayerCharacter({
        race: {
          id: 'half_orc',
          name: 'Stale Half-Orc',
          description: 'Old serialized data',
          traits: ['Speed: 5 feet'],
        },
        speed: 5,
        darkvisionRange: 0,
        abilityScores: {
          Strength: 15,
          Dexterity: 10,
          Constitution: 14,
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10,
        },
        finalAbilityScores: {
          Strength: 15,
          Dexterity: 10,
          Constitution: 14,
          Intelligence: 10,
          Wisdom: 10,
          Charisma: 10,
        },
      });

      const normalized = normalizeCharacterRaceData(character);

      expect(normalized.race.name).toBe('Half-Orc');
      expect(normalized.speed).toBe(30);
      expect(normalized.darkvisionRange).toBe(60);
      expect(normalized.finalAbilityScores.Strength).toBe(17);
      expect(normalized.finalAbilityScores.Constitution).toBe(15);
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
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
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

  describe('Deep Gnome racial spell mechanics', () => {
    const wizardClass: Class = {
      id: 'wizard',
      name: 'Wizard',
      description: 'A master of arcane magic.',
      hitDie: 6,
      primaryAbility: ['Intelligence'] as AbilityScoreName[],
      savingThrowProficiencies: ['Intelligence', 'Wisdom'],
      skillProficienciesAvailable: [],
      numberOfSkillProficiencies: 2,
      armorProficiencies: [],
      weaponProficiencies: [],
      features: [],
      spellcasting: {
        ability: 'Intelligence',
        knownCantrips: 4,
        knownSpellsL1: 8,
        spellList: [],
      },
    };

    const createDeepGnomeWithSpells = (level = 5) => createMockPlayerCharacter({
      level,
      race: DEEP_GNOME_DATA,
      class: wizardClass,
      racialSelections: {
        deep_gnome: { spellAbility: 'Intelligence' },
      },
      spellbook: {
        knownSpells: ['fireball'],
        cantrips: [],
        preparedSpells: ['fireball'],
      },
    });

    it('should add deep gnome racial spell grants and long-rest limited use resources', () => {
      const character = createDeepGnomeWithSpells(5);
      const updated = applyRacialSpellGrantsByLevel(character, 5);

      expect(updated.spellbook?.racialSpellGrants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceRaceId: 'deep_gnome',
            spellId: 'disguise-self',
            minLevel: 3,
            castingMethod: 'once_per_long_rest',
            upcastable: false,
            maxCastLevel: 3,
            countsAsPrepared: false,
          }),
          expect.objectContaining({
            sourceRaceId: 'deep_gnome',
            spellId: 'nondetection',
            minLevel: 5,
            castingMethod: 'once_per_long_rest',
            upcastable: false,
            maxCastLevel: 5,
            countsAsPrepared: false,
          }),
        ])
      );
      expect(updated.limitedUses?.[resolveRacialSpellLimitedUseId('deep_gnome', 'disguise-self')]).toMatchObject({
        current: 1,
        max: 1,
        resetOn: 'long_rest',
      });
      expect(updated.limitedUses?.[resolveRacialSpellLimitedUseId('deep_gnome', 'nondetection')]).toMatchObject({
        current: 1,
        max: 1,
        resetOn: 'long_rest',
      });
      expect(updated.spellbook?.preparedSpells).toEqual(expect.arrayContaining(['disguise-self', 'nondetection']));
    });

    it('should prevent racial spell upcast when upcastability is explicitly disabled', () => {
      const character = createDeepGnomeWithSpells(5);
      const updated = applyRacialSpellGrantsByLevel(character, 5);

      expect(isRacialSpellCastLevelAllowed(updated, 'disguise-self', 3)).toBe(true);
      expect(isRacialSpellCastLevelAllowed(updated, 'disguise-self', 4)).toBe(false);
      expect(isRacialSpellCastLevelAllowed(updated, 'nondetection', 5)).toBe(true);
      expect(isRacialSpellCastLevelAllowed(updated, 'nondetection', 6)).toBe(false);
    });

    it('should not count deep gnome racial spells against prepared-spell limits', () => {
      const character = createDeepGnomeWithSpells(5);
      const updated = applyRacialSpellGrantsByLevel(character, 5);
      const limitSet = getPreparedSpellsAffectingLimit(updated);

      expect(Array.from(limitSet).sort()).toEqual(['fireball']);
      expect(isRacialSpellLockedForPreparation(updated, 'disguise-self')).toBe(true);
      expect(isRacialSpellLockedForPreparation(updated, 'fireball')).toBe(false);
    });
  });

  describe('Racial Modifier Buckets & Movement Speed updates (Slice 2)', () => {
    it('should correctly parse and grant Satyr Performance and Persuasion proficiencies', () => {
      // Create a Satyr character.
      const satyr = createMockPlayerCharacter({
        race: {
          id: 'satyr',
          name: 'Satyr',
          description: 'Fey revelers.',
          traits: [
            'Creature Type: Fey',
            'Size: Medium',
            'Speed: 35 feet',
            'Reveler: You are proficient in Performance and Persuasion.',
          ],
        },
      });

      // Assemble the character and apply racial modifiers.
      const assembled = applyRacialSpellGrantsByLevel(satyr, 1);

      // Verify that Performance and Persuasion are added to the character's skill list.
      const skillNames = assembled.skills.map(s => s.name);
      expect(skillNames).toContain('Performance');
      expect(skillNames).toContain('Persuasion');
      expect(assembled.modifiers?.skillProficiencies).toContain('Performance');
      expect(assembled.modifiers?.skillProficiencies).toContain('Persuasion');
    });

    it('should correctly parse Tortle Natural Armor and set base AC to 17', () => {
      // Create a Tortle character.
      const tortle = createMockPlayerCharacter({
        race: {
          id: 'tortle',
          name: 'Tortle',
          description: 'Shell-bound humanoids.',
          traits: [
            'Creature Type: Humanoid',
            'Size: Medium',
            'Speed: 30 feet',
            'Natural Armor (Tortle): Your shell grants you a base AC of 17; you can still gain the benefit of a shield but not wear armor.',
          ],
        },
      });

      // Assemble the character and apply racial modifiers.
      const assembled = applyRacialSpellGrantsByLevel(tortle, 1);

      // Verify the base Armor Class is set to 17.
      expect(assembled.modifiers?.baseArmorClass).toBe(17);
    });

    it('should correctly parse Thri-Kreen Chameleon Carapace and set base AC to 13', () => {
      // Create a Thri-Kreen character.
      const thriKreen = createMockPlayerCharacter({
        race: {
          id: 'thri_kreen',
          name: 'Thri-Kreen',
          description: 'Insectoid monstrosities.',
          traits: [
            'Creature Type: Monstrosity',
            'Size: Medium',
            'Speed: 30 feet',
            'Chameleon Carapace: While unarmored, your base AC is 13 + your Dexterity modifier, and you can change color to gain advantage on Stealth checks once per rest.',
          ],
        },
      });

      // Assemble the character and apply racial modifiers.
      const assembled = applyRacialSpellGrantsByLevel(thriKreen, 1);

      // Verify the base Armor Class is set to 13.
      expect(assembled.modifiers?.baseArmorClass).toBe(13);
    });

    it('should correctly calculate Wood Elf and Wood Half-Elf base speed as 35 feet', () => {
      // Create a Wood Elf character.
      const woodElf = createMockPlayerCharacter({
        race: {
          id: 'wood_elf',
          name: 'Wood Elf',
          description: 'Woodland protectors.',
          traits: [
            'Speed: 35 feet',
            'Fleet of Foot: Your base walking speed increases to 35 feet.',
          ],
        },
      });

      // Normalize the character.
      const normalizedElf = normalizeCharacterRaceData(woodElf);

      // Verify speed is 35.
      expect(normalizedElf.speed).toBe(35);

      // Create a Wood Half-Elf character.
      const woodHalfElf = createMockPlayerCharacter({
        race: {
          id: 'half_elf_wood',
          name: 'Wood Half-Elf',
          description: 'Half-elves with wood elf heritage.',
          traits: [
            'Speed: 35 feet',
            'Fleet of Foot: Your base walking speed increases to 35 feet.',
          ],
        },
      });

      // Normalize the character.
      const normalizedHalfElf = normalizeCharacterRaceData(woodHalfElf);

      // Verify speed is 35.
      expect(normalizedHalfElf.speed).toBe(35);
    });
  });
});
