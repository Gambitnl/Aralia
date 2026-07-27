/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 00:38:54
 * Dependents: components/Combat/EncounterModal.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/world/bestiaryEncounterGenerator.ts
 *
 * Offline encounter generator that selects creatures entirely from the
 * ingested 5eTools bestiary (MONSTERS_DATA) with no API dependency.
 *
 * CR-spread philosophy:
 *   Rather than filling a budget with identically-priced monsters, this
 *   generator uses D&D encounter templates that mix challenge ratings the
 *   way a real DM would. A "Deadly" threat might be one dragon; a "Medium"
 *   fight might be one caster + two melee flankers + a pack of weaklings.
 *   The DMG encounter multiplier is respected — the generator works in raw
 *   XP but the caller receives the adjusted tier for display.
 */
import type { Monster, TempPartyMember } from '../../types';
import type { MonsterData } from '../../types/ui';
import type { DifficultyTier } from '../combat/encounterDifficulty';
export type EncounterDifficultyTarget = 'Easy' | 'Medium' | 'Hard' | 'Deadly';
/** Returns true if the monster has at least one lair action ability. */
export declare function hasLairActions(monster: MonsterData): boolean;
export interface BestiaryEncounterResult {
    monsters: Monster[];
    /** Human-readable label for the chosen structural template. */
    templateLabel: string;
    /** Raw XP sum (before multiplier). */
    rawXp: number;
    /** Adjusted XP (after DMG encounter multiplier). */
    adjustedXp: number;
    /** Resulting difficulty tier against the provided party. */
    tier: DifficultyTier;
}
/**
 * Generates a balanced encounter from the internal 5eTools bestiary.
 *
 * Algorithm:
 *  1. Pick a random structural template (solo / elite+minions / pack / ambush).
 *  2. Calculate a raw XP budget scaled for that template's expected multiplier.
 *  3. For each slot in the template, pick a creature whose CR × qty fits the
 *     allocated budget fraction. Elite slots pick one unique creature; minion
 *     slots fill qty by dividing remaining budget by creature XP.
 *  4. Deduplicate: if a random pick duplicates an existing entry, retry up to
 *     3 times before falling back to stacking qty on the existing entry.
 *  5. Return the result with the real calculated difficulty tier.
 *
 * @param party   Party members used for budget calculation.
 * @param difficulty   Target difficulty tier (Easy / Medium / Hard / Deadly).
 * @returns Encounter result, or null if MONSTERS_DATA is empty.
 */
export interface BestiaryEncounterOptions {
    difficulty?: EncounterDifficultyTarget;
    /** When true, only monsters with lair actions are eligible. */
    lairOnly?: boolean;
    /** Optional deterministic seed for local bestiary output replay. */
    seed?: number;
}
export declare function generateBestiaryEncounter(party: TempPartyMember[], difficultyOrOptions?: EncounterDifficultyTarget | BestiaryEncounterOptions): BestiaryEncounterResult | null;
