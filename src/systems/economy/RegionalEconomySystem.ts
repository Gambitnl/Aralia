/**
 * @file src/systems/economy/RegionalEconomySystem.ts
 * Static utility class for regional wealth simulation and price calculations.
 * Activates the previously unused globalInflation and regionalWealth fields
 * on EconomyState, enabling "buy low, sell high" gameplay across regions.
 */

import { EconomyState, MarketEventType } from '../../types/economy';
import { REGIONAL_ECONOMIES } from '../../data/economy/regions';
import type { SeededRandom } from '../../utils/random';

/**
 * Updates regional wealth levels based on trade route health, market events,
 * and faction influence. Called once per day from the world simulation loop.
 */
export const updateRegionalWealth = (
    economy: EconomyState,
    daysPassed: number,
    _rng: SeededRandom
): Record<string, number> => {
    const updatedWealth = { ...economy.regionalWealth };

    // Initialize regions that aren't tracked yet
    for (const region of Object.values(REGIONAL_ECONOMIES)) {
        if (updatedWealth[region.id] === undefined) {
            updatedWealth[region.id] = region.wealthLevel;
        }
    }

    // Trade route effects on regional wealth
    for (const route of economy.tradeRoutes) {
        const originWealth = updatedWealth[route.originId] ?? 50;
        const destWealth = updatedWealth[route.destinationId] ?? 50;

        if (route.status === 'active') {
            // Active trade enriches both endpoints slightly
            const tradeBonus = 0.5 * daysPassed;
            updatedWealth[route.originId] = Math.min(100, originWealth + tradeBonus);
            updatedWealth[route.destinationId] = Math.min(100, destWealth + tradeBonus);
        } else if (route.status === 'blockaded') {
            // Blockaded routes drain wealth from import-dependent regions
            const tradePenalty = 1.0 * daysPassed;
            updatedWealth[route.destinationId] = Math.max(0, destWealth - tradePenalty);
        }
    }

    // Market event effects
    for (const event of economy.marketEvents) {
        if (!event.locationId) continue;
        const currentWealth = updatedWealth[event.locationId] ?? 50;

        switch (event.type) {
            case MarketEventType.BOOM:
            case MarketEventType.FESTIVAL:
                updatedWealth[event.locationId] = Math.min(100, currentWealth + 1.0 * daysPassed);
                break;
            case MarketEventType.BUST:
            case MarketEventType.WAR_TAX:
                updatedWealth[event.locationId] = Math.max(0, currentWealth - 1.5 * daysPassed);
                break;
            case MarketEventType.SHORTAGE:
                updatedWealth[event.locationId] = Math.max(0, currentWealth - 0.5 * daysPassed);
                break;
        }
    }

    // Wealth naturally drifts toward baseline (mean reversion)
    for (const region of Object.values(REGIONAL_ECONOMIES)) {
        const current = updatedWealth[region.id] ?? region.wealthLevel;
        const baseline = region.wealthLevel;
        const drift = (baseline - current) * 0.02 * daysPassed; // 2% pull per day
        updatedWealth[region.id] = current + drift;
    }

    return updatedWealth;
};

/**
 * Updates global inflation based on market conditions.
 * Positive inflation increases all prices; negative (deflation) decreases them.
 * Returns the new inflation value (typically -0.5 to +0.5).
 */
export const updateGlobalInflation = (
    economy: EconomyState,
    daysPassed: number
): number => {
    let inflation = economy.globalInflation;

    // Market events drive inflation
    for (const event of economy.marketEvents) {
        switch (event.type) {
            case MarketEventType.WAR_TAX:
                inflation += 0.01 * event.intensity * daysPassed;
                break;
            case MarketEventType.BOOM:
                inflation += 0.005 * event.intensity * daysPassed;
                break;
            case MarketEventType.BUST:
                inflation -= 0.01 * event.intensity * daysPassed;
                break;
            case MarketEventType.FESTIVAL:
                inflation += 0.002 * event.intensity * daysPassed;
                break;
        }
    }

    // Natural drift toward 0 (price stability)
    inflation *= Math.pow(0.98, daysPassed);

    // Clamp to reasonable range
    return Math.max(-0.5, Math.min(0.5, inflation));
};

/**
 * Calculates a price modifier based on regional wealth and global inflation.
 * Used by economyUtils.calculatePrice() to make prices region-sensitive.
 *
 * @returns Multiplier to apply to base price (e.g., 1.1 = 10% more expensive)
 */
export const getRegionalPriceModifier = (
    regionId: string | undefined,
    economy: EconomyState
): number => {
    if (!regionId) return 1.0 + economy.globalInflation;

    const wealth = economy.regionalWealth[regionId];
    if (wealth === undefined) return 1.0 + economy.globalInflation;

    // Wealthier regions have higher prices (cost of living)
    // Wealth 50 = baseline (1.0x), wealth 100 = 1.25x, wealth 0 = 0.75x
    const wealthModifier = 0.75 + (wealth / 200); // Maps 0-100 to 0.75-1.25

    return wealthModifier + economy.globalInflation;
};
