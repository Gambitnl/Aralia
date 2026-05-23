import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useCharacterAssembly } from '../useCharacterAssembly';
import { initialCharacterCreatorState, type CharacterCreationState } from '../../state/characterCreatorState';
import { CLASSES_DATA, RACES_DATA } from '../../../../constants';
import type { AbilityScores, PlayerCharacter, Race, Class as CharClass, Spell } from '../../../../types';
import fireBolt from '../../../../../public/data/spells/level-0/fire-bolt.json';
import mageHand from '../../../../../public/data/spells/level-0/mage-hand.json';
import minorIllusion from '../../../../../public/data/spells/level-0/minor-illusion.json';
import detectMagic from '../../../../../public/data/spells/level-1/detect-magic.json';
import findFamiliar from '../../../../../public/data/spells/level-1/find-familiar.json';
import mageArmor from '../../../../../public/data/spells/level-1/mage-armor.json';
import magicMissile from '../../../../../public/data/spells/level-1/magic-missile.json';
import shield from '../../../../../public/data/spells/level-1/shield.json';
import sleep from '../../../../../public/data/spells/level-1/sleep.json';

const onCharacterCreate = vi.fn();

// The creator hook should assemble only the spells the player actually picked.
// The full class spell list stays in the picker and spellbook "show all" view,
// so the assembled character does not accidentally look fully known at level 1.
const buildWizardPreviewState = (): CharacterCreationState => {
  const abilityScores: AbilityScores = {
    Strength: 8,
    Dexterity: 14,
    Constitution: 14,
    Intelligence: 16,
    Wisdom: 12,
    Charisma: 10
  };

  return {
    ...initialCharacterCreatorState,
    selectedRace: RACES_DATA.hill_dwarf as unknown as Race,
    selectedClass: CLASSES_DATA.wizard as unknown as CharClass,
    baseAbilityScores: abilityScores,
    finalAbilityScores: abilityScores,
    selectedSkills: [],
    selectedCantrips: [fireBolt, mageHand, minorIllusion] as Spell[],
    selectedSpellsL1: [detectMagic, findFamiliar, mageArmor, magicMissile, shield, sleep] as Spell[],
    characterAge: 25,
    selectedBackground: null,
    selectedWeaponMasteries: [],
    selectedFeat: null,
    featChoices: {},
    racialSelections: {}
  };
};

describe('useCharacterAssembly', () => {
  it('keeps the assembled spellbook limited to the spells the player selected', () => {
    const { result } = renderHook(() => useCharacterAssembly({ onCharacterCreate }));

    const preview = result.current.generatePreviewCharacter(buildWizardPreviewState(), 'Aster Vale');

    expect(preview).not.toBeNull();

    const character = preview as PlayerCharacter;
    expect(character.spellbook?.cantrips).toEqual(['fire-bolt', 'mage-hand', 'minor-illusion']);
    expect(character.spellbook?.preparedSpells).toEqual([
      'detect-magic',
      'find-familiar',
      'mage-armor',
      'magic-missile',
      'shield',
      'sleep'
    ]);
    expect(character.spellbook?.knownSpells).toEqual([
      'detect-magic',
      'find-familiar',
      'mage-armor',
      'magic-missile',
      'shield',
      'sleep'
    ]);
    expect(character.spellbook?.knownSpells).not.toContain('burning-hands');
  });
});
