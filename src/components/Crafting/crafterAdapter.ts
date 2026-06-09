// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 14:31:44
 * Dependents: components/Crafting/CreatureHarvestPanel.tsx, components/Crafting/GatheringPanel.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/Crafting/crafterAdapter.ts
 * Shared adapter that turns live party state into the lightweight Crafter
 * contract used by the gathering and creature-harvest systems.
 *
 * The panels used to fabricate a random local crafter. This helper keeps the
 * roll tied to an actual party member or selected sheet character instead,
 * while still honoring the older Crafter callback shape those systems expect.
 *
 * Remaining limitation: if a save truly has no party yet, the adapter falls
 * back to an explicit placeholder so the UI does not crash in empty states.
 */
import { SKILLS_DATA } from '../../data/skills';
import { PlayerCharacter, AbilityScoreName } from '../../types';
import { getAbilityModifierValue } from '../../utils/character/statUtils';
import { rollDice } from '../../utils/combatUtils';
import { Crafter } from '../../systems/crafting/craftingSystem';

interface CraftingStateSnapshot {
  party: PlayerCharacter[];
  characterSheetModal?: {
    isOpen: boolean;
    character: PlayerCharacter | null;
  };
}

export interface CraftingCrafterSelectionOptions {
  /**
   * Explicit character to prefer. Gathering can pass the character-sheet
   * selection here, while creature harvesting can leave it empty and stay on
   * the lead party member.
   */
  selectedCharacter?: PlayerCharacter | null;
  /**
   * When true, the helper may read from the open character sheet modal if no
   * explicit selected character was passed in.
   */
  allowCharacterSheetSelection?: boolean;
}

export interface CraftingCrafterResolution {
  crafter: Crafter;
  sourceCharacter: PlayerCharacter | null;
  sourceLabel: 'selected_character' | 'party_lead' | 'fallback';
}

const TOOL_CHECK_ABILITY_MAP: Record<string, AbilityScoreName> = {
  alchemists_supplies: 'Intelligence',
  herbalism_kit: 'Intelligence',
  poisoners_kit: 'Intelligence',
  sleight_of_hand: 'Dexterity',
  survival: 'Wisdom',
};

const normalizeKey = (value: string): string =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const getProficiencyBonus = (character: PlayerCharacter): number => {
  if (typeof character.proficiencyBonus === 'number') {
    return character.proficiencyBonus;
  }

  const level = character.level ?? 1;
  return Math.floor(Math.max(0, level - 1) / 4) + 2;
};

const collectToolProficiencies = (character: PlayerCharacter): Set<string> => {
  const toolProficiencies = new Set<string>();

  (character.toolProficiencies ?? []).forEach(tool => {
    toolProficiencies.add(normalizeKey(tool));
  });

  Object.values(character.featChoices ?? {}).forEach(choice => {
    const selectedTools = Array.isArray(choice.selectedTools)
      ? choice.selectedTools
      : Object.values(choice.selectedTools ?? {});

    selectedTools.forEach(tool => {
      if (typeof tool === 'string') {
        toolProficiencies.add(normalizeKey(tool));
      }
    });
  });

  return toolProficiencies;
};

const hasSkillProficiency = (character: PlayerCharacter, skillName: string): boolean => {
  const target = normalizeKey(skillName);
  const explicitSkillIds = new Set((character.skills ?? []).map(skill => normalizeKey(skill.id)));
  const explicitSkillNames = new Set((character.skills ?? []).map(skill => normalizeKey(skill.name)));
  const racialSkillProfs = new Set((character.modifiers?.skillProficiencies ?? []).map(normalizeKey));

  return explicitSkillIds.has(target) || explicitSkillNames.has(target) || racialSkillProfs.has(target);
};

const hasToolProficiency = (character: PlayerCharacter, skillName: string): boolean => {
  const target = normalizeKey(skillName);
  return collectToolProficiencies(character).has(target);
};

const getCheckAbility = (skillName: string): AbilityScoreName => {
  const normalized = normalizeKey(skillName);
  const skill = SKILLS_DATA[normalized];

  if (skill) {
    return skill.ability;
  }

  return TOOL_CHECK_ABILITY_MAP[normalized] ?? 'Intelligence';
};

const createPlaceholderCrafter = (): Crafter => ({
  id: 'no-crafter',
  name: 'Unassigned',
  inventory: [],
  rollSkill: () => rollDice('1d20'),
});

/**
 * Turns a character into the lightweight Crafter contract expected by the
 * legacy gathering and harvest systems.
 */
export function createCraftingCrafter(character: PlayerCharacter): Crafter {
  return {
    id: character.id,
    name: character.name,
    inventory: [],
    rollSkill: (skillName: string) => {
      const rawRoll = rollDice('1d20');
      const normalizedSkill = normalizeKey(skillName);

      if (normalizedSkill === 'none') {
        return rawRoll;
      }

      const ability = getCheckAbility(skillName);
      const abilityScore = character.finalAbilityScores?.[ability] ?? character.abilityScores?.[ability] ?? 10;
      const proficiencyBonus = getProficiencyBonus(character);
      const abilityModifier = getAbilityModifierValue(abilityScore);
      const hasProficiency = hasToolProficiency(character, skillName) || hasSkillProficiency(character, skillName);

      return rawRoll + abilityModifier + (hasProficiency ? proficiencyBonus : 0);
    },
  };
}

/**
 * Resolves the actual crafting actor from live game state.
 *
 * Gathering can prefer the selected character from the open sheet. Creature
 * harvesting intentionally stays on the party lead because the combat panel
 * does not expose a separate selection prop yet.
 */
export function resolveCraftingCrafter(
  state: CraftingStateSnapshot,
  options: CraftingCrafterSelectionOptions = {}
): CraftingCrafterResolution {
  const selectedCharacter = options.selectedCharacter
    ?? (options.allowCharacterSheetSelection ? state.characterSheetModal?.character ?? null : null);
  const sourceCharacter = selectedCharacter ?? state.party[0] ?? null;

  if (!sourceCharacter) {
    return {
      crafter: createPlaceholderCrafter(),
      sourceCharacter: null,
      sourceLabel: 'fallback',
    };
  }

  return {
    crafter: createCraftingCrafter(sourceCharacter),
    sourceCharacter,
    sourceLabel: selectedCharacter ? 'selected_character' : 'party_lead',
  };
}
