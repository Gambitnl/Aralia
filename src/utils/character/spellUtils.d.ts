/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:07
 * Dependents: character/index.ts, spellUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/spellUtils.ts
 * This file contains utility functions related to player character spellcasting.
 */
import { PlayerCharacter, Spell } from '../../types';
interface CharacterSpells {
    cantrips: Spell[];
    spells: Spell[];
}
/**
 * Gets a character's complete list of known cantrips and spells from all sources.
 * This is the new single source of truth for spell aggregation.
 * @param {PlayerCharacter} character - The character object.
 * @param {Record<string, Spell>} allSpellsData - A map of all spells in the game.
 * @returns {CharacterSpells} An object containing arrays of final cantrips and spells.
 */
export declare function getCharacterSpells(character: PlayerCharacter, allSpellsData: Record<string, Spell>): CharacterSpells;
export {};
