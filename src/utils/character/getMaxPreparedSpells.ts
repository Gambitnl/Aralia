/**
 * @file getMaxPreparedSpells.ts
 * Calculates daily spell capacity for the campaign edition and actual class level.
 * 2024 uses fixed tables; 2014 daily preparation uses the relevant ability modifier.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 28/10/2026, 13:51:52
 * Dependents: systems/gameplay/spellPreparation.ts, utils/character/characterUtils.ts, utils/character/index.ts, utils/character/progression.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { PlayerCharacter } from '../../types';
import { getRulesEdition, type RulesEdition } from '../../config/rulesEdition';

/**
 * 2024 PHB Prepared Spells Tables by Class Level (1-20)
 * Data sourced from glossary class entries
 */
const PREPARED_SPELLS_TABLES: Record<string, number[]> = {
    // Full Casters (levels 1-20)
    cleric: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
    druid: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
    wizard: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
    bard: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
    sorcerer: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],

    // Half Casters (levels 1-20)
    paladin: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
    ranger: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],

    // Third Caster - Artificer (levels 1-20)
    artificer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],

    // Warlock (uses Pact Magic, but still has prepared spells in 2024)
    warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
};

/**
 * Eldritch Knight (Fighter subclass) - levels 3-20 map to Fighter levels
 * Index 0 = Fighter level 3, Index 17 = Fighter level 20
 */
const ELDRITCH_KNIGHT_SPELLS = [3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];

/**
 * Arcane Trickster (Rogue subclass) - levels 3-20 map to Rogue levels
 * Similar progression to Eldritch Knight
 */
const ARCANE_TRICKSTER_SPELLS = [3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];

/**
 * Gets the maximum number of spells a character can prepare.
 * 
 * @param character - The player character
 * @returns The max prepared spells count, or null if unlimited/not applicable
 * 
 * 2024 capacity tables do not grant permission to change spells at will.
 * Daily changes and level-up changes have separate timing rules.
 */
export function getMaxPreparedSpells(character: PlayerCharacter, edition: RulesEdition = getRulesEdition(undefined)): number | null {
    const classId = character.class.id.toLowerCase();
    const level = Math.max(1, Math.min(20, character.classLevels?.[classId] ?? character.level ?? 1));
    if (edition === '2014') {
        const ability = classId === 'paladin' ? 'Charisma' : ['cleric', 'druid'].includes(classId) ? 'Wisdom' : 'Intelligence';
        const modifier = Math.floor(((character.finalAbilityScores?.[ability] ?? character.abilityScores?.[ability] ?? 10) - 10) / 2);
        if (['cleric', 'druid', 'wizard'].includes(classId)) return Math.max(1, modifier + level);
        if (classId === 'paladin') return level < 2 ? 0 : Math.max(1, modifier + Math.floor(level / 2));
        if (classId === 'artificer') return Math.max(1, modifier + Math.floor(level / 2));
        return null; // Known-spell casters do not choose a daily list in 2014.
    }

    // Check main class table
    const classTable = PREPARED_SPELLS_TABLES[classId];
    if (classTable) {
        return classTable[level - 1]; // Arrays are 0-indexed
    }

    // Check for spellcasting subclasses (Fighter->Eldritch Knight, Rogue->Arcane Trickster)
    const subclassId = character.class.subclass?.id?.toLowerCase();

    if (classId === 'fighter' && subclassId === 'eldritch_knight') {
        // Eldritch Knight gets spellcasting at level 3
        if (level < 3) return null;
        return ELDRITCH_KNIGHT_SPELLS[level - 3];
    }

    if (classId === 'rogue' && subclassId === 'arcane_trickster') {
        // Arcane Trickster gets spellcasting at level 3
        if (level < 3) return null;
        return ARCANE_TRICKSTER_SPELLS[level - 3];
    }

    // Non-spellcasting class or no data available
    return null;
}

export default getMaxPreparedSpells;
