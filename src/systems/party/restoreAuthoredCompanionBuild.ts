/** Recover only the exact identity-only recruit scaffold discarded by the old
 * authored promotion path. The retained world person supplies the mechanics;
 * earned HP, conditions, experience and spell resources are never refreshed.
 * Customized or progressed builds remain untouched for deliberate review. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 12:10:45
 * Dependents: state/appState.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { PlayerCharacter } from '../../types/character';
import type { Companion } from '../../types/companions';
import type { RichNPC } from '../../types/world';
import { promoteCompanionToMember } from './npcToPartyMember';
import { authoredCompanionCapabilities } from './authoredCompanionCapabilities';
import type { RulesEdition } from '../../config/rulesEdition';

export function restoreAuthoredCompanionBuild(
  character: PlayerCharacter,
  companion: Companion | undefined,
  npc: RichNPC | undefined,
  campaign?: { rulesEdition?: RulesEdition },
): PlayerCharacter {
  return authoredCompanionCapabilities(restoreMechanics(character, companion, npc), companion, 'legacy', campaign);
}

function restoreMechanics(
  character: PlayerCharacter,
  companion: Companion | undefined,
  npc: RichNPC | undefined,
): PlayerCharacter {
  if (character.retainedNpcBuild || !companion?.inParty || !npc
    || companion.id !== character.id || npc.id !== character.id
    || character.level !== 1 || (character.xp ?? 0) !== 0
    || companion.identity.class.trim().toLowerCase() !== character.class.id
    || npc.biography.classId !== character.class.id || npc.biography.level !== 1
    || !Number.isFinite(character.hp) || character.hp < 0) return character;

  const scaffold = promoteCompanionToMember(companion, character.class.id, 1).character;
  const untouchedFields = ['abilityScores', 'finalAbilityScores', 'maxHp', 'armorClass',
    'equippedItems', 'skills', 'spellbook', 'classLevels', 'proficiencyBonus', 'speed'] as const;
  if (character.hp > scaffold.maxHp || untouchedFields.some(key => JSON.stringify(character[key]) !== JSON.stringify(scaffold[key]))) return character;

  const source = promoteCompanionToMember(companion, character.class.id, 1, npc).character;
  if (![source.maxHp, source.armorClass, source.speed, source.proficiencyBonus,
    ...Object.values(source.finalAbilityScores)].every(Number.isFinite) || source.maxHp <= 0) return character;
  // Worn gear comes from this same retained person's world record, rather than
  // a fresh item grant or regenerated loadout. The once-only marker protects
  // future sales, losses and deliberate equipment changes on later reloads.
  return { ...character,
    abilityScores: source.abilityScores, finalAbilityScores: source.finalAbilityScores,
    maxHp: source.maxHp, hp: Math.min(character.hp, source.maxHp),
    armorClass: source.armorClass, speed: source.speed,
    proficiencyBonus: source.proficiencyBonus, equippedItems: source.equippedItems,
    retainedNpcBuild: { version: 1, npcId: npc.id },
  };
}
