export type DifficultyTier = 'Easy' | 'Medium' | 'Hard' | 'Deadly';
interface Thresholds {
    easy: number;
    medium: number;
    hard: number;
    deadly: number;
}
export interface DifficultyResult {
    /** Raw XP (sum of individual monster awards). */
    rawXp: number;
    /** Adjusted XP (raw × encounter multiplier). */
    adjustedXp: number;
    /** Encounter multiplier applied. */
    multiplier: number;
    /** Party thresholds (summed across all characters). */
    thresholds: Thresholds;
    /** Difficulty tier: Easy / Medium / Hard / Deadly. */
    tier: DifficultyTier;
}
export interface CombatantForDifficulty {
    cr: string;
    quantity: number;
    crLair?: string;
    xpLair?: number;
    isLair?: boolean;
}
/** Returns the XP award for a single monster of the given CR. */
export declare function crToXp(cr: string, xpLair?: number): number;
/**
 * Calculates encounter difficulty against a party of given levels.
 * @param monsters - list of combatants
 * @param partyLevels - one number per character (e.g. [5, 5, 4, 6])
 */
export declare function calculateDifficulty(monsters: CombatantForDifficulty[], partyLevels: number[]): DifficultyResult;
export {};
