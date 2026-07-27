/**
 * @file src/data/dndData.ts
 * Stores static data related to D&D 5e rules, such as XP values and encounter thresholds.
 */
import { AbilityScoreName } from '../types';
export declare const ABILITY_SCORE_NAMES: AbilityScoreName[];
export declare const RELEVANT_SPELLCASTING_ABILITIES: AbilityScoreName[];
export declare const XP_THRESHOLDS_BY_LEVEL: Record<number, {
    easy: number;
    medium: number;
    hard: number;
    deadly: number;
}>;
export declare const XP_BY_CR: Record<string, number>;
export declare const ENCOUNTER_MULTIPLIERS: Record<number, number>;
