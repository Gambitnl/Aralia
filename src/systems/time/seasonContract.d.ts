/**
 * @file src/systems/time/seasonContract.ts
 *
 * THE season contract (generational-time G3, decided 2026-07: hard global
 * contract, not a movement-only subsystem).
 *
 * One source of truth for what a season means mechanically. Any system that
 * cares about seasons — movement, foraging, survival, encounters, economy,
 * farming — reads THIS table through `getSeasonState` (or one of the narrow
 * read points below). Nothing else in the codebase may hard-code a seasonal
 * number.
 *
 * Determinism & save-safety: everything here is a pure function of the game
 * clock (`gameState.gameTime`, a UTC `Date` persisted in saves). No hidden
 * state, no randomness — reviving `gameTime` from a save reproduces the exact
 * same seasonal state.
 *
 * Wired consumers today:
 * - Movement: route planning multiplies travel minutes by
 *   `getSeasonalTravelCostMultiplier` (MapPane → planRoutesFrom
 *   `timeCostMultiplier`), and `getTimeModifiers` (HUD/AI flavor) composes the
 *   same contract value with the time-of-day multiplier.
 * - Foraging/survival: `SeasonalSystem.getSeasonalEffects` /
 *   `getForagingDC` delegate here.
 *
 * Extension seams (present on the contract, neutral at 1.0 until a consuming
 * system lands — set real values WITH that system, not before):
 * - `encounterRateMultiplier`: multiply random-encounter chance per season.
 * - `priceMultiplier`: multiply market prices per season (economy).
 * - `growthMultiplier`: multiply crop/plant growth per season (farming).
 */
import { Season } from '../../utils/core/timeUtils';
/** Every seasonal knob the simulation exposes. All multipliers are neutral at 1. */
export interface SeasonModifiers {
    /** Movement: multiplies travel time (route minutes). > 1 is slower. */
    travelCostMultiplier: number;
    /** Foraging: multiplies the base forage DC (before `survivalDcModifier`). */
    forageScarcityMultiplier: number;
    /** Foraging: multiplies the quantity gathered. */
    forageYieldMultiplier: number;
    /** Survival checks: flat DC addition (e.g. +2 in winter exposure). */
    survivalDcModifier: number;
    /** SEAM — encounters: multiplies random-encounter chance. Neutral today. */
    encounterRateMultiplier: number;
    /** SEAM — economy: multiplies market prices. Neutral today. */
    priceMultiplier: number;
    /** SEAM — farming: multiplies crop growth. Neutral today. */
    growthMultiplier: number;
}
export interface SeasonContractEntry {
    modifiers: SeasonModifiers;
    /** One-sentence player/AI-facing flavor for the season. */
    description: string;
    /** Environmental elements in play (e.g. 'cold', 'heat'). */
    elements: string[];
}
/** The season as a system reads it: which season, and everything it changes. */
export interface SeasonState extends SeasonContractEntry {
    season: Season;
}
/**
 * The canonical table. Numbers carried over from the pre-contract
 * `SEASONAL_CONFIG` (winter travel 1.5x etc.); the diverged winter 1.25 that
 * used to live in `timeUtils.getTimeModifiers` is gone — this table wins.
 */
export declare const SEASON_CONTRACT: Record<Season, SeasonContractEntry>;
/**
 * THE read point. Pure and deterministic: (gameTime) → seasonal state.
 * `gameTime` is the persisted in-world UTC clock, so this is save-safe by
 * construction — no seasonal data needs to be stored in saves.
 */
export declare function getSeasonState(gameTime: Date): SeasonState;
/** Movement read point: seasonal travel-time multiplier for route planning. */
export declare function getSeasonalTravelCostMultiplier(gameTime: Date): number;
/** Instantaneous (right now) travel/vision modifiers for HUD and AI flavor. */
export interface TimeModifiers {
    travelCostMultiplier: number;
    visionModifier: number;
    description: string;
}
/** Extra travel-time factor for moving in darkness (time-of-day, not season). */
export declare const NIGHT_TRAVEL_MULTIPLIER = 1.5;
/**
 * Combined environmental modifiers: contract seasonal travel cost × night
 * navigation penalty, plus a composed flavor line. Winter night =
 * 1.5 (contract) × 1.5 (night) = 2.25x travel cost.
 */
export declare const getTimeModifiers: (gameTime: Date) => TimeModifiers;
