/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/time/SeasonalSystem.ts
 * Foraging/survival read points over the season contract.
 *
 * Since generational-time G3 (2026-07) the canonical seasonal numbers live in
 * `seasonContract.ts` — this module is a thin consumer that keeps the historic
 * `SeasonalEffect` shape for existing callers. Do NOT add seasonal numbers
 * here; extend the contract instead.
 */

import { Season } from '../../utils/core';
import { SEASON_CONTRACT, getSeasonState } from './seasonContract';

export interface SeasonalEffect {
  season: Season;
  travelCostMultiplier: number; // > 1.0 means slower travel (e.g. 1.5 = 50% slower)
  resourceScarcity: number;     // Multiplier for foraging DC (e.g. 1.2 = 20% harder)
  resourceYield: number;        // Multiplier for amount gathered (e.g. 0.5 = half resources)
  survivalDCModifier: number;   // Flat addition to Survival checks (e.g. +2)
  description: string;
  elements: string[];           // Environmental elements (e.g. 'cold', 'heat')
}

const toSeasonalEffect = (season: Season): Omit<SeasonalEffect, 'season'> => {
  const entry = SEASON_CONTRACT[season];
  return {
    travelCostMultiplier: entry.modifiers.travelCostMultiplier,
    resourceScarcity: entry.modifiers.forageScarcityMultiplier,
    resourceYield: entry.modifiers.forageYieldMultiplier,
    survivalDCModifier: entry.modifiers.survivalDcModifier,
    description: entry.description,
    elements: [...entry.elements],
  };
};

/** Legacy view of the contract table, kept for existing callers. */
export const SEASONAL_CONFIG: Record<Season, Omit<SeasonalEffect, 'season'>> = {
  [Season.Spring]: toSeasonalEffect(Season.Spring),
  [Season.Summer]: toSeasonalEffect(Season.Summer),
  [Season.Autumn]: toSeasonalEffect(Season.Autumn),
  [Season.Winter]: toSeasonalEffect(Season.Winter),
};

/**
 * Retrieves the mechanical effects of the current season (from the contract).
 * @param date The current game date
 * @returns SeasonalEffect object with modifiers
 */
export const getSeasonalEffects = (date: Date): SeasonalEffect => {
  const { season } = getSeasonState(date);
  return { season, ...SEASONAL_CONFIG[season] };
};

/**
 * Calculates the final Difficulty Class (DC) for a foraging check based on season.
 * Winter = high DC (scarcity 1.5x + flat +2); autumn = low DC (scarcity 0.8x).
 * @param baseDC The base DC of the region/biome
 * @param date The current game date
 * @returns Modified DC
 */
export const getForagingDC = (baseDC: number, date: Date): number => {
  const effects = getSeasonalEffects(date);
  // Apply scarcity multiplier to base DC, then add flat modifier
  return Math.ceil(baseDC * effects.resourceScarcity) + effects.survivalDCModifier;
};
