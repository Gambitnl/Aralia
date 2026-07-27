/**
 * @file src/systems/economy/RegionalEconomySystem.ts
 * Static utility class for regional wealth simulation and price calculations.
 * Activates the previously unused globalInflation and regionalWealth fields
 * on EconomyState, enabling "buy low, sell high" gameplay across regions.
 */
import { EconomyState } from '../../types/economy';
import type { SeededRandom } from '../../utils/random';
/**
 * Updates regional wealth levels based on trade route health, market events,
 * and faction influence. Called once per day from the world simulation loop.
 */
export declare const updateRegionalWealth: (economy: EconomyState, daysPassed: number, _rng: SeededRandom) => Record<string, number>;
/**
 * Updates global inflation based on market conditions.
 * Positive inflation increases all prices; negative (deflation) decreases them.
 * Returns the new inflation value (typically -0.5 to +0.5).
 */
export declare const updateGlobalInflation: (economy: EconomyState, daysPassed: number) => number;
/**
 * Calculates a price modifier based on regional wealth and global inflation.
 * Used by economyUtils.calculatePrice() to make prices region-sensitive.
 *
 * @returns Multiplier to apply to base price (e.g., 1.1 = 10% more expensive)
 */
export declare const getRegionalPriceModifier: (regionId: string | undefined, economy: EconomyState) => number;
