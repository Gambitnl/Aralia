
import { describe, it, expect } from 'vitest';
import { validateCharacterChoices } from '../characterValidation';
import { createMockPlayerCharacter } from '../../core/factories';
import { PlayerCharacter , Race, Class } from '../../../types/index';


describe('validateCharacterChoices', () => {
  // Helper to create basic character
  const createTestChar = (raceId: string, classId: string, level: number = 1): PlayerCharacter => {
    return createMockPlayerCharacter({
      level,
      race: {
        id: raceId,
        name: raceId.charAt(0).toUpperCase() + raceId.slice(1),
        description: 'Mock Race',
        traits: []
      } as Race,
      class: {
        id: classId,
        name: classId.charAt(0).toUpperCase() + classId.slice(1),
        description: 'Mock Class',
        hitDie: 8,
        primaryAbility: ['Strength'],
        savingThrowProficiencies: ['Strength'],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 2,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: []
      } as Class,
      racialSelections: {},
      spellbook: {
        knownSpells: [],
        preparedSpells: [],
        cantrips: []
      } as any
    });
  };

  describe('Race Validation', () => {
    it('should report missing Dragonborn Ancestry', () => {
      const char = createTestChar('dragonborn', 'fighter');
      const issues = validateCharacterChoices(char);
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'dragonborn_ancestry',
        type: 'race'
      }));
    });

    it('should NOT report Dragonborn Ancestry if selected', () => {
      const char = createTestChar('dragonborn', 'fighter');
      char.racialSelections = {
        dragonborn: { choiceId: 'red' }
      };
      const issues = validateCharacterChoices(char);
      expect(issues).not.toContainEqual(expect.objectContaining({
        id: 'dragonborn_ancestry'
      }));
    });

    it('should report missing Elf Lineage', () => {
      const char = createTestChar('elf', 'wizard');
      // Mock elven lineages requirement by adding it to race definition
      // The validator checks race.elvenLineages existence
      char.race.elvenLineages = [{ id: 'high_elf', name: 'High Elf', description: '', benefits: [] }];

      const issues = validateCharacterChoices(char);
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'elf_lineage',
        type: 'race'
      }));
    });

    it('should report missing Gnome Subrace', () => {
      const char = createTestChar('gnome', 'wizard');
      char.race.gnomeSubraces = [{ id: 'rock_gnome', name: 'Rock Gnome', description: '', traits: [] }];

      const issues = validateCharacterChoices(char);
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'gnome_subrace',
        type: 'race'
      }));
    });

    it('should report missing Tiefling Legacy', () => {
      const char = createTestChar('tiefling', 'warlock');
      char.race.fiendishLegacies = [{ id: 'infernal', name: 'Infernal', description: '', level1Benefit: '', level3SpellId: '', level5SpellId: '', resistance: { resistanceType: 'Fire', cantripId: 'fire_bolt' } }] as unknown as typeof char.race.fiendishLegacies;

      const issues = validateCharacterChoices(char);
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'tiefling_legacy',
        type: 'race'
      }));
    });

    it('should report missing Goliath Ancestry', () => {
      const char = createTestChar('goliath', 'barbarian');
      char.race.giantAncestryChoices = [{ id: 'Stone', name: 'Stone Giant', description: '', ancestry: 'Stone', benefit: 'Stone resilience' }] as unknown as typeof char.race.giantAncestryChoices;

      const issues = validateCharacterChoices(char);
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'goliath_ancestry',
        type: 'race'
      }));
    });
  });

  describe('Racial Spellcasting Ability Validation', () => {
    it('should report missing racial spell ability when race requires it', () => {
      const char = createTestChar('tiefling', 'warlock');
      char.race.racialSpellChoice = {
        traitName: 'Infernal Legacy',
        traitDescription: 'Cast spells using...'
      };

      const issues = validateCharacterChoices(char);
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'racial_spell_ability',
        type: 'race'
      }));
    });

    it('should NOT report missing racial spell ability when selected', () => {  
      const char = createTestChar('tiefling', 'warlock');
      char.race.racialSpellChoice = {
        traitName: 'Infernal Legacy',
        traitDescription: 'Cast spells using...'
      };
      char.racialSelections = {
        tiefling: { spellAbility: 'Charisma', resistance: { resistanceType: 'Fire', cantripId: 'thaumaturgy' } }
      } as unknown as typeof char.racialSelections;

      const issues = validateCharacterChoices(char);
      expect(issues).not.toContainEqual(expect.objectContaining({
        id: 'racial_spell_ability'
      }));
    });
  });

  describe('Spell Validation', () => {
    it('should report missing Drow spells at appropriate levels', () => {
      const char = createTestChar('elf', 'rogue', 5);
      char.racialSelections = {
        elf: { choiceId: 'drow', spellAbility: 'Charisma' }
      };

      const issues = validateCharacterChoices(char);

      // Should miss dancing_lights (1), faerie_fire (3), darkness (5)
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'missing_racial_spell',
        label: 'Missing Spell: Drow Magic',
        options: expect.arrayContaining([expect.objectContaining({ id: 'dancing_lights' })])
      }));
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'missing_racial_spell',
        options: expect.arrayContaining([expect.objectContaining({ id: 'faerie_fire' })])
      }));
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'missing_racial_spell',
        options: expect.arrayContaining([expect.objectContaining({ id: 'darkness' })])
      }));
    });

    it('should report missing High Elf Prestidigitation', () => {
      const char = createTestChar('elf', 'wizard', 1);
      char.racialSelections = {
        elf: { choiceId: 'high_elf', spellAbility: 'Intelligence' }
      };

      const issues = validateCharacterChoices(char);
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'missing_racial_spell',
        label: 'Missing Spell: Cantrip',
        options: expect.arrayContaining([expect.objectContaining({ id: 'prestidigitation' })])
      }));
    });

    it('should NOT report present racial spells', () => {
      const char = createTestChar('elf', 'rogue', 1);
      char.racialSelections = {
        elf: { choiceId: 'drow', spellAbility: 'Charisma' }
      };
      // Add dancing_lights to known cantrips
      if (char.spellbook) {
        char.spellbook.cantrips = ['dancing_lights'];
      }

      const issues = validateCharacterChoices(char);
      expect(issues).not.toContainEqual(expect.objectContaining({
        options: expect.arrayContaining([expect.objectContaining({ id: 'dancing_lights' })])
      }));
    });
  });

  describe('Class Validation', () => {
    it('should report missing Fighter Fighting Style', () => {
      const char = createTestChar('human', 'fighter');
      char.class.fightingStyles = [{ id: 'archery', name: 'Archery', description: '', levelAvailable: 1 } as any];

      const issues = validateCharacterChoices(char);
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'fighting_style',
        type: 'class'
      }));
    });

    it('should report missing Cleric Divine Order', () => {
      const char = createTestChar('human', 'cleric');
      char.class.divineOrders = [{ id: 'Thaumaturge', name: 'Thaumaturge', description: '' }];

      const issues = validateCharacterChoices(char);
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'divine_order',
        type: 'class'
      }));
    });

    it('should report missing Druid Primal Order', () => {
      const char = createTestChar('human', 'druid');
      char.class.primalOrders = [{ id: 'Magician', name: 'Magician', description: '' }];

      const issues = validateCharacterChoices(char);
      expect(issues).toContainEqual(expect.objectContaining({
        id: 'primal_order',
        type: 'class'
      }));
    });

    it('should NOT report class choices if selected', () => {
      const char = createTestChar('human', 'fighter');
      char.class.fightingStyles = [{ id: 'archery', name: 'Archery', description: '', levelAvailable: 1 }];
      // TODO(2026-01-03 pass 4 Codex-CLI): fighting style selection cast until union includes string ids.
      char.selectedFightingStyle = 'archery' as unknown as typeof char.selectedFightingStyle;

      const issues = validateCharacterChoices(char);
      expect(issues).not.toContainEqual(expect.objectContaining({
        id: 'fighting_style'
      }));
    });
  });
});
