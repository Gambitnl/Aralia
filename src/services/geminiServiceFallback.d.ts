/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 00:42:56
 * Dependents: services/gemini/encounters.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Monster } from '../types';
/**
 * Generates a fallback encounter when the AI service is unavailable or fails.
 * It attempts to select monsters from the static data that fit the XP budget.
 *
 * @param xpBudget The target XP budget for the encounter.
 * @param themeTags Tags to filter monsters by (e.g., 'forest', 'goblinoid').
 * @param seed Optional deterministic seed for replayable fallback runs.
 * @returns An array of Monster objects.
 */
export declare function getFallbackEncounter(xpBudget: number, themeTags: string[], seed?: number): Monster[];
/**
 * Generates a fallback encounter when the AI service is unavailable or fails.
 * It attempts to select monsters from static data that fit the XP budget.
 *
 * @param xpBudget The target XP budget for the encounter.
 * @param themeTags Tags to filter monsters by (e.g., 'forest', 'goblinoid').
 * @param seed Deterministic seed for replayable fallback runs.
 * @returns An array of Monster objects.
 */
export declare function getFallbackEncounterWithSeed(xpBudget: number, themeTags: string[], seed: number | undefined): Monster[];
