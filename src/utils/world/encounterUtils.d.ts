/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/06/2026, 00:38:08
 * Dependents: services/gemini/encounters.ts, services/geminiServiceFallback.ts, utils/encounterUtils.ts, utils/world/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/encounterUtils.ts
 * This file contains utility functions for calculating encounter parameters.
 */
import type { GameMessage, Monster, TempPartyMember } from '../../types';
interface EncounterParameters {
    xpBudget: number;
    themeTags: string[];
}
/**
 * Calculates encounter parameters based on the current game state.
 * @param party - The array of temporary party members.
 * @param currentLocationId - The ID of the party's current location.
 * @param messages - A recent slice of the game message log.
 * @returns An object containing the calculated XP budget and thematic tags.
 */
export declare function calculateEncounterParameters(party: TempPartyMember[], currentLocationId: string, messages: GameMessage[]): EncounterParameters;
export declare const MAX_ENCOUNTER_MONSTER_COUNT = 4;
/**
 * Validates an AI-suggested encounter. If it's unreasonable (e.g., too many monsters),
 * it rebuilds a more appropriate encounter using the same XP budget.
 * @param aiSuggestions - The array of monster suggestions from the AI.
 * @param themeTags - The thematic tags for the encounter.
 * @returns A new, validated array of Monster objects for the encounter.
 */
export declare function processAndValidateEncounter(aiSuggestions: Monster[], themeTags: string[], seed?: number): Monster[];
export {};
