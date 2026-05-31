import { describe, it, expect, beforeAll } from 'vitest';
import { ASTRAL_ELF_DATA } from '../../races/astral_elf';
import {
  buildRacialTraitLibrary,
  setRacialTraitLibraryInstance,
  getRacialChoiceRequirementsForRace,
} from '../racialTraits';
import { createMockPlayerCharacter } from '../../../utils/core/factories';
import { 
  getRacialSpellGrantsForCharacter, 
  resolveRacialSpellCastingAbility 
} from '../../../utils/character/characterUtils';

describe('Astral Fire Choice Integration', () => {
  beforeAll(() => {
    const library = buildRacialTraitLibrary({ astral_elf: ASTRAL_ELF_DATA });
    setRacialTraitLibraryInstance(library);
  });

  it('should identify Astral Fire as choice requirements', () => {
    const choices = getRacialChoiceRequirementsForRace('astral_elf');
    const astralFireChoices = choices.filter(c => c.sourceTraitName === 'Astral Fire');
    
    expect(astralFireChoices.length).toBe(2);
    
    const spellChoice = astralFireChoices.find(c => c.type === 'spellChoice');
    expect(spellChoice).toBeDefined();
    expect(spellChoice?.availableSpellIds).toContain('dancing-lights');
    expect(spellChoice?.availableSpellIds).toContain('light');
    expect(spellChoice?.availableSpellIds).toContain('sacred-flame');

    const abilityChoice = astralFireChoices.find(c => c.type === 'spellAbility');
    expect(abilityChoice).toBeDefined();
    expect(abilityChoice?.availableAbilities).toContain('Intelligence');
    expect(abilityChoice?.availableAbilities).toContain('Wisdom');
    expect(abilityChoice?.availableAbilities).toContain('Charisma');
  });

  it('should not grant a spell automatically for Astral Fire', () => {
    const character = createMockPlayerCharacter({ 
      race: ASTRAL_ELF_DATA,
      level: 1
    });
    const grants = getRacialSpellGrantsForCharacter(character);
    const astralFireSpell = grants.find(g => g.traitName === 'Astral Fire');
    
    // If it's correctly identified as a choice, it shouldn't be automatically granted 
    // until the choice is made in racialSelections.
    expect(astralFireSpell).toBeUndefined();
  });

  it('should grant the selected spell with the selected ability when choices are made', () => {
    const character = createMockPlayerCharacter({ 
      race: ASTRAL_ELF_DATA,
      level: 1,
      racialSelections: {
        astral_elf: {
          selectedSpellIds: ['sacred-flame'],
          spellAbility: 'Charisma'
        }
      }
    });

    const grants = getRacialSpellGrantsForCharacter(character);
    const sacredFlameGrant = grants.find(g => g.spellId === 'sacred-flame');
    
    expect(sacredFlameGrant).toBeDefined();
    
    const ability = resolveRacialSpellCastingAbility(character, 'sacred-flame');
    expect(ability).toBe('Charisma');
  });
});
