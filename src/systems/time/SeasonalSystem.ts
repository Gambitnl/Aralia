/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/time/SeasonalSystem.ts
 * Manages seasonal environmental effects, resource scarcity, and survival mechanics.
 */

import { Season, getSeason } from '../../utils/timeUtils';

export interface SeasonalEffect {
  season: Season;
  travelCostMultiplier: number; // > 1.0 means slower travel (e.g. 1.5 = 50% slower)
  resourceScarcity: number;     // Multiplier for foraging DC (e.g. 1.2 = 20% harder)
  resourceYield: number;        // Multiplier for amount gathered (e.g. 0.5 = half resources)
  survivalDCModifier: number;   // Flat addition to Survival checks (e.g. +2)
  description: string;
  elements: string[];           // Environmental elements (e.g. 'cold', 'heat')
}

export const SEASONAL_CONFIG: Record<Season, Omit<SeasonalEffect, 'season'>> = {
  [Season.Spring]: {
    travelCostMultiplier: 1.0,
    resourceScarcity: 0.9,     // Easier to find food
    resourceYield: 1.2,        // Abundant new growth
    survivalDCModifier: 0,
    description: 'The world is blooming with new life. Rains are frequent.',
    elements: []
  },
  [Season.Summer]: {
    travelCostMultiplier: 1.0,
    resourceScarcity: 1.0,     // Standard
    resourceYield: 1.0,        // Standard
    survivalDCModifier: 0,
    description: 'The air is warm and heavy. Days are long.',
    elements: ['heat']
  },
  [Season.Autumn]: {
    travelCostMultiplier: 1.0,
    resourceScarcity: 0.8,     // Harvest season - very easy to find food
    resourceYield: 1.5,        // Bountiful harvest
    survivalDCModifier: 0,
    description: 'The harvest is ready. The air turns crisp.',
    elements: []
  },
  [Season.Winter]: {
    travelCostMultiplier: 1.5, // Snow and ice slow travel significantly
    resourceScarcity: 1.5,     // Hard to find food
    resourceYield: 0.5,        // Very little to gather
    survivalDCModifier: 2,     // Harder to survive exposure
    description: 'Biting cold winds scour the land. Snow covers the paths.',
    elements: ['cold']
  }
};

/**
 * Retrieves the mechanical effects of the current season.
 * @param date The current game date
 * @returns SeasonalEffect object with modifiers
 */
export const getSeasonalEffects = (date: Date): SeasonalEffect => {
  const season = getSeason(date);
  const config = SEASONAL_CONFIG[season];

  return {
    season,
    ...config
  };
};

/**
 * Calculates the final Difficulty Class (DC) for a foraging check based on season.
 * @param baseDC The base DC of the region/biome
 * @param date The current game date
 * @returns Modified DC
 */
export const getForagingDC = (baseDC: number, date: Date): number => {
  const effects = getSeasonalEffects(date);
  // Apply scarcity multiplier to base DC, then add flat modifier
  return Math.ceil(baseDC * effects.resourceScarcity) + effects.survivalDCModifier;
};
