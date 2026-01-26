// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:37:35
 * Dependents: characterUtils.ts
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file getMaxPreparedSpells.ts
 * Calculates the maximum number of spells a character can prepare based on D&D 5e 2024 rules.
 * Uses fixed level-based tables from the PHB instead of ability modifier formulas.
 */
import type { PlayerCharacter } from '../../types';

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
    warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
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
 * In 2024 rules, ALL spellcasters use prepared spells with fixed level-based tables.
 * There is no longer a distinction between "known" and "prepared" casters.
 */
export function getMaxPreparedSpells(character: PlayerCharacter): number | null {
    const classId = character.class.id.toLowerCase();
    const level = Math.max(1, Math.min(20, character.level ?? 1)); // Clamp to 1-20

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
