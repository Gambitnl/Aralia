/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:30:50
 * Dependents: characterReducer.ts, characterUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file getMaxPreparedSpells.ts
 * Calculates the maximum number of spells a character can prepare based on D&D 5e 2024 rules.
 * Uses fixed level-based tables from the PHB instead of ability modifier formulas.
 */
import type { PlayerCharacter } from '../../types';
/**
 * Gets the maximum number of spells a character can prepare.
 *
 * @param character - The player character
 * @returns The max prepared spells count, or null if unlimited/not applicable
 *
 * In 2024 rules, ALL spellcasters use prepared spells with fixed level-based tables.
 * There is no longer a distinction between "known" and "prepared" casters.
 */
export declare function getMaxPreparedSpells(character: PlayerCharacter): number | null;
export default getMaxPreparedSpells;
