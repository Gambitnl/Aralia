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
export interface SeasonalEffect {
    season: Season;
    travelCostMultiplier: number;
    resourceScarcity: number;
    resourceYield: number;
    survivalDCModifier: number;
    description: string;
    elements: string[];
}
/** Legacy view of the contract table, kept for existing callers. */
export declare const SEASONAL_CONFIG: Record<Season, Omit<SeasonalEffect, 'season'>>;
/**
 * Retrieves the mechanical effects of the current season (from the contract).
 * @param date The current game date
 * @returns SeasonalEffect object with modifiers
 */
export declare const getSeasonalEffects: (date: Date) => SeasonalEffect;
/**
 * Calculates the final Difficulty Class (DC) for a foraging check based on season.
 * Winter = high DC (scarcity 1.5x + flat +2); autumn = low DC (scarcity 0.8x).
 * @param baseDC The base DC of the region/biome
 * @param date The current game date
 * @returns Modified DC
 */
export declare const getForagingDC: (baseDC: number, date: Date) => number;
