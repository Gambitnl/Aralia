import { useMemo } from 'react';
import { PlayerCharacter } from '../types';
import { BACKGROUNDS } from '../data/backgrounds';
import { FEATS_DATA } from '../data/feats/featsData';

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

    const armorProfs = Array.from(new Set([
      ...(character.class.armorProficiencies || []),
      ...(character.armorProficiencies || [])
    ])).join(', ') || 'None';
    
    const weaponProfs = Array.from(new Set([
      ...(character.class.weaponProficiencies || []),
      ...(character.weaponProficiencies || [])
    ])).join(', ') || 'None';

    const toolProfs = new Set<string>();
    const langProfs = new Set<string>();

    // 1. Background Proficiencies
    if (character.background && BACKGROUNDS[character.background]) {
      const bg = BACKGROUNDS[character.background] as { toolProficiencies?: unknown; languages?: unknown };
      const bgTools: string[] = Array.isArray(bg.toolProficiencies) ? bg.toolProficiencies : [];
      const bgLangs: string[] = Array.isArray(bg.languages) ? (bg.languages as string[]) : [];
      bgTools.forEach((t: string) => toolProfs.add(t.replace(/_/g, ' ')));
      (bgLangs ?? []).forEach((lang: string) => langProfs.add(lang));
    }

    // 2. Feat Proficiencies
    character.feats?.forEach(featId => {
      const choices = character.featChoices?.[featId];
      if (choices) {
        const selectedTools: string[] = Array.isArray(choices.selectedTools)
          ? choices.selectedTools
          : Object.values(choices.selectedTools ?? {}) as string[];
        const selectedLanguages: string[] = Array.isArray(choices.selectedLanguages)
          ? choices.selectedLanguages
          : Object.values(choices.selectedLanguages ?? {}) as string[];
        selectedTools.forEach((t: string) => toolProfs.add(t));
        selectedLanguages.forEach((l: string) => langProfs.add(l));
      }
      
      // Fixed benefits from feats (not choices)
      // TODO #320: add logic for fixed feat tool/lang benefits if any added to data
    });

    // 3. Tools from Class Features
    character.class.features?.forEach(f => {
      if (f.id === 'artificer_tool_proficiencies') {
        toolProfs.add("Thieves' Tools");
        toolProfs.add("Tinker's Tools");
        toolProfs.add("Artisan's Tools (Choice)");
      }
    });

    // 4. Tools from Race Traits
    character.race.traits?.forEach(t => {
      const lowerTrait = t.toLowerCase();
      if (lowerTrait.includes("tinker's tools")) {
        toolProfs.add("Tinker's Tools");
      }
      if (lowerTrait.includes("artisan's tools")) {
        toolProfs.add("Artisan's Tools (Choice from race)");
      }
    });

    // 5. Languages from Race Traits
    character.race.traits?.forEach(t => {
      if (t.toLowerCase().startsWith('languages:')) {
        langProfs.add(t.substring(10).trim());
      }
    });

    // 6. Languages from Class Features
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
