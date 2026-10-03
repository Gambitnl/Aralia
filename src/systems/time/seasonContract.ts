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

import { Season, getSeason, TimeOfDay, getTimeOfDay } from '../../utils/core/timeUtils';

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
export const SEASON_CONTRACT: Record<Season, SeasonContractEntry> = {
  [Season.Spring]: {
    modifiers: {
      travelCostMultiplier: 1.0,
      forageScarcityMultiplier: 0.9, // easier to find food
      forageYieldMultiplier: 1.2,    // abundant new growth
      survivalDcModifier: 0,
      encounterRateMultiplier: 1.0,
      priceMultiplier: 1.0,
      growthMultiplier: 1.0,
    },
    description: 'The world is blooming with new life. Rains are frequent.',
    elements: [],
  },
  [Season.Summer]: {
    modifiers: {
      travelCostMultiplier: 1.0,
      forageScarcityMultiplier: 1.0,
      forageYieldMultiplier: 1.0,
      survivalDcModifier: 0,
      encounterRateMultiplier: 1.0,
      priceMultiplier: 1.0,
      growthMultiplier: 1.0,
    },
    description: 'The air is warm and heavy. Days are long.',
    elements: ['heat'],
  },
  [Season.Autumn]: {
    modifiers: {
      travelCostMultiplier: 1.0,
      forageScarcityMultiplier: 0.8, // harvest season
      forageYieldMultiplier: 1.5,    // bountiful harvest
      survivalDcModifier: 0,
      encounterRateMultiplier: 1.0,
      priceMultiplier: 1.0,
      growthMultiplier: 1.0,
    },
    description: 'The harvest is ready. The air turns crisp.',
    elements: [],
  },
  [Season.Winter]: {
    modifiers: {
      travelCostMultiplier: 1.5,     // snow and ice slow travel
      forageScarcityMultiplier: 1.5, // hard to find food
      forageYieldMultiplier: 0.5,
      survivalDcModifier: 2,         // exposure
      encounterRateMultiplier: 1.0,
      priceMultiplier: 1.0,
      growthMultiplier: 1.0,
    },
    description: 'Biting cold winds scour the land. Snow covers the paths.',
    elements: ['cold'],
  },
};

/**
 * THE read point. Pure and deterministic: (gameTime) → seasonal state.
 * `gameTime` is the persisted in-world UTC clock, so this is save-safe by
 * construction — no seasonal data needs to be stored in saves.
 */
export function getSeasonState(gameTime: Date): SeasonState {
  const season = getSeason(gameTime);
  return { season, ...SEASON_CONTRACT[season] };
}

/** Movement read point: seasonal travel-time multiplier for route planning. */
export function getSeasonalTravelCostMultiplier(gameTime: Date): number {
  return getSeasonState(gameTime).modifiers.travelCostMultiplier;
}

// ---------------------------------------------------------------------------
// Combined season × time-of-day travel/vision modifiers.
// Moved here from utils/core/timeUtils so the seasonal component reads the
// contract instead of duplicating a (diverged) number. The night multiplier is
// a time-of-day effect, not a seasonal one, so it lives here beside the
// composition rather than in the seasonal table.
// ---------------------------------------------------------------------------

/** Instantaneous (right now) travel/vision modifiers for HUD and AI flavor. */
export interface TimeModifiers {
  travelCostMultiplier: number; // > 1 is slower
  visionModifier: number;       // light level 0-1
  description: string;
}

/** Extra travel-time factor for moving in darkness (time-of-day, not season). */
export const NIGHT_TRAVEL_MULTIPLIER = 1.5;

const TIME_OF_DAY_SENTENCE: Record<TimeOfDay, string> = {
  [TimeOfDay.Night]: 'Darkness covers the land.',
  [TimeOfDay.Dawn]: 'The sun is rising.',
  [TimeOfDay.Dusk]: 'Shadows are lengthening.',
  [TimeOfDay.Day]: 'The sun is high.',
};

/**
 * Combined environmental modifiers: contract seasonal travel cost × night
 * navigation penalty, plus a composed flavor line. Winter night =
 * 1.5 (contract) × 1.5 (night) = 2.25x travel cost.
 */
export const getTimeModifiers = (gameTime: Date): TimeModifiers => {
  const state = getSeasonState(gameTime);
  const timeOfDay = getTimeOfDay(gameTime);
  const night = timeOfDay === TimeOfDay.Night ? NIGHT_TRAVEL_MULTIPLIER : 1;
  return {
    travelCostMultiplier: state.modifiers.travelCostMultiplier * night,
    visionModifier: timeOfDay === TimeOfDay.Night ? 0.2 : 1.0,
    description: `${state.description} ${TIME_OF_DAY_SENTENCE[timeOfDay]}`.trim(),
  };
};
