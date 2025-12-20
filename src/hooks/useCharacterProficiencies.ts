import { useMemo } from 'react';
import { PlayerCharacter } from '../../types';

export interface CharacterProficiencies {
  armor: string;
  weapons: string;
  tools: string[];
  languages: string[];
}

export const useCharacterProficiencies = (character: PlayerCharacter | null): CharacterProficiencies => {
  return useMemo(() => {
    if (!character) {
      return { armor: 'None', weapons: 'None', tools: [], languages: [] };
    }

    const armorProfs = character.class.armorProficiencies?.join(', ') || 'None';
    const weaponProfs = character.class.weaponProficiencies?.join(', ') || 'None';

    const toolProfs = new Set<string>();
    const langProfs = new Set<string>();

    // Tools from Class Features
    character.class.features?.forEach(f => {
      if (f.id === 'artificer_tool_proficiencies') {
        toolProfs.add("Thieves' Tools");
        toolProfs.add("Tinker's Tools");
        toolProfs.add("Artisan's Tools (Choice)");
      }
    });

    // Tools from Race Traits
    character.race.traits?.forEach(t => {
      const lowerTrait = t.toLowerCase();
      if (lowerTrait.includes("tinker's tools")) {
        toolProfs.add("Tinker's Tools");
      }
      if (lowerTrait.includes("artisan's tools")) {
        toolProfs.add("Artisan's Tools (Choice from race)");
      }
    });

    // Languages from Race Traits
    character.race.traits?.forEach(t => {
      if (t.toLowerCase().startsWith('languages:')) {
        langProfs.add(t.substring(10).trim());
      }
    });

    // Languages from Class Features
    character.class.features?.forEach(f => {
      if (f.id === 'druidic_feature') {
        langProfs.add("Druidic");
      }
      if (f.id === 'thieves_cant_feature') {
        langProfs.add("Thieves' Cant");
      }
    });

    return {
      armor: armorProfs,
      weapons: weaponProfs,
      tools: Array.from(toolProfs),
      languages: Array.from(langProfs),
    };
  }, [character]);
};
