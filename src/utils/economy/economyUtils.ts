/**
 * @file src/utils/economy/economyUtils.ts
 * Utility functions for the living economy system.
 * Handles dynamic price calculations based on market factors (scarcity, surplus) and regional economics.
 */

import { EconomyState, Item } from '../../types';
import { REGIONAL_ECONOMIES } from '../../data/economy/regions';

export interface PriceCalculationResult {
    basePrice: number;
    finalPrice: number;
    multiplier: number;
    isModified: boolean;
    factors: string[]; // Explains why (e.g., ["High Demand", "Local Import"])
}

// Alias for backward compatibility if needed, though we primarily use PriceCalculationResult now
export type PriceResult = PriceCalculationResult;

/**
 * Parses a cost string (e.g., "10 gp") into a gold value.
 * @param costString - The cost string to parse.
 * @returns The value in Gold Pieces (gp).
 */
export const parseCost = (costString: string): number => {
    if (!costString) return 0;
    const match = costString.match(/(\d+)\s*(pp|gp|sp|cp)/i);
    if (match) {
        const amount = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        if (unit === 'pp') return amount * 10;
        if (unit === 'gp') return amount;
        if (unit === 'sp') return amount / 10;
        if (unit === 'cp') return amount / 100;
    }
    return 0;
};

/**
 * Calculates the buy or sell price of an item based on the current economy state.
 *
 * @param item - The item to price.
 * @param economy - The current economy state.
 * @param transactionType - 'buy' (player buying from merchant) or 'sell' (player selling to merchant).
 * @param regionId - (Optional) Region ID to apply local import/export modifiers.
 * @returns detailed PriceCalculationResult object.
 */
export const calculatePrice = (
    item: Item,
    economy: EconomyState,
    transactionType: 'buy' | 'sell',
    regionId?: string
): PriceCalculationResult => {
    // 1. Determine Base Price
    // Prefer costInGp, fallback to parsing cost string
    let basePrice = 0;
    if (typeof item.costInGp === 'number') {
        basePrice = item.costInGp;
    } else if (item.cost) {
        basePrice = parseCost(item.cost);
    }

    if (basePrice <= 0) {
        return { basePrice: 0, finalPrice: 0, multiplier: 1, isModified: false, factors: [] };
    }

    let multiplier = 1.0;
    const factors: string[] = [];

    // 2. Apply Transaction Type Multiplier (Base Economy)
    if (transactionType === 'sell') {
        // Selling to merchant usually yields 50% value
        multiplier *= (economy.sellMultiplier || 0.5);
    } else {
        // Buying from merchant usually costs 100% value
        multiplier *= (economy.buyMultiplier || 1.0);
    }

    // 3. Collect Item Tags
    const itemTags: string[] = [];
    if (item.type) itemTags.push(item.type.toLowerCase());
    if (item.tags) item.tags.forEach(t => itemTags.push(t.toLowerCase()));

    // Helper to check match (including partial matches for robustness)
    const matchesList = (list: string[]): boolean => {
        return list.some(entry => {
            const e = entry.toLowerCase();
            return itemTags.some(t => t.includes(e) || e.includes(t));
        });
    };

    // 4. Apply Regional Economics (Imports/Exports)
    if (regionId && REGIONAL_ECONOMIES[regionId]) {
        const region = REGIONAL_ECONOMIES[regionId];

        // If Region IMPORTS this item (High Demand) -> Price UP
        if (matchesList(region.imports)) {
            // Buying: More expensive. Selling: More profit.
            multiplier *= 1.25;
            factors.push(`Regional Import (${region.name})`);
        }

        // If Region EXPORTS this item (High Supply) -> Price DOWN
        if (matchesList(region.exports)) {
             // Buying: Cheaper. Selling: Less profit.
             multiplier *= 0.75;
             factors.push(`Regional Export (${region.name})`);
        }
    }

    // 5. Apply Market Factors (Scarcity / Surplus)
    // Check Scarcity (Prices go UP)
    const isScarce = matchesList(economy.marketFactors.scarcity);
    if (isScarce) {
        multiplier *= 1.5; // +50% price
        factors.push('Global Scarcity');
    }

    // Check Surplus (Prices go DOWN)
    const isSurplus = matchesList(economy.marketFactors.surplus);
    if (isSurplus) {
        multiplier *= 0.5; // -50% price
        factors.push('Global Surplus');
    }

    // 6. Calculate Final Price
    let finalPrice = basePrice * multiplier;

    // Rounding rules:
    // - Always round to 2 decimal places (cp precision)
    finalPrice = Math.round(finalPrice * 100) / 100;

    return {
        basePrice,
        finalPrice,
        multiplier,
        isModified: Math.abs(multiplier - (transactionType === 'sell' ? economy.sellMultiplier : economy.buyMultiplier)) > 0.01,
        factors
    };
};
