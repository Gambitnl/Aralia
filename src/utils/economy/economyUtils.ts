/**
 * @file src/utils/economy/economyUtils.ts
 * Utility functions for the living economy system.
 * Handles dynamic price calculations based on market factors (scarcity, surplus).
 */

import { EconomyState, Item } from '../../types';

export interface PriceResult {
    basePrice: number;
    finalPrice: number;
    multiplier: number;
    isModified: boolean;
    factors: string[]; // Explains why (e.g., ["High Demand", "Local Import"])
}

/**
 * Calculates the buy or sell price of an item based on the current economy state.
 *
 * @param item - The item to price.
 * @param economy - The current economy state.
 * @param transactionType - 'buy' (player buying from merchant) or 'sell' (player selling to merchant).
 * @param regionId - (Optional) Region ID to apply local import/export modifiers (future use).
 * @returns detailed PriceResult object.
 */
export const calculatePrice = (
    item: Item,
    economy: EconomyState,
    transactionType: 'buy' | 'sell',
    _regionId?: string
): PriceResult => {
    // 1. Determine Base Price
    // Prefer costInGp, fallback to parsing cost string, fallback to 0
    let basePrice = 0;
    if (typeof item.costInGp === 'number') {
        basePrice = item.costInGp;
    } else if (item.cost) {
        // Updated parser for "10 gp", "5 sp", "50 pp" etc.
        const match = item.cost.match(/(\d+)\s*(pp|gp|sp|cp)/i);
        if (match) {
            const amount = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();
            if (unit === 'pp') basePrice = amount * 10;
            else if (unit === 'gp') basePrice = amount;
            else if (unit === 'sp') basePrice = amount / 10;
            else if (unit === 'cp') basePrice = amount / 100;
        }
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

    // 3. Apply Market Factors (Scarcity / Surplus)
    // We check if the item's tags or type match any active market factors.
    // Item should have tags like ['weapon', 'metal'] or type 'Weapon'.
    // We normalize to lowercase for comparison.

    const itemTags: string[] = [];
    if (item.type) itemTags.push(item.type.toLowerCase());
    if (item.tags) item.tags.forEach(t => itemTags.push(t.toLowerCase()));

    // Helper to check match (including partial matches for robustness)
    const matchesFactor = (factorList: string[]): boolean => {
        return factorList.some(factor => {
            const f = factor.toLowerCase();
            return itemTags.some(t => t.includes(f) || f.includes(t));
        });
    };

    // Check Scarcity (Prices go UP)
    const isScarce = matchesFactor(economy.marketFactors.scarcity);
    if (isScarce) {
        multiplier *= 1.5; // +50% price
        factors.push('Scarcity');
    }

    // Check Surplus (Prices go DOWN)
    const isSurplus = matchesFactor(economy.marketFactors.surplus);
    if (isSurplus) {
        multiplier *= 0.5; // -50% price
        factors.push('Surplus');
    }

    // 4. Calculate Final Price
    let finalPrice = basePrice * multiplier;

    // Rounding rules:
    // - Always round to 2 decimal places (cp precision)
    // - For selling, floor to avoid fractional gp exploits?
    // Let's keep it simple: round to nearest 0.01
    finalPrice = Math.round(finalPrice * 100) / 100;

    return {
        basePrice,
        finalPrice,
        multiplier,
        isModified: Math.abs(multiplier - (transactionType === 'sell' ? economy.sellMultiplier : economy.buyMultiplier)) > 0.01,
        factors
    };
};
