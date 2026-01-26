// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:37:30
 * Dependents: character/index.ts, coinPurseUtils.ts
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/coinPurseUtils.ts
 * Utility functions for converting GP values to D&D coin denominations.
 * 
 * D&D Coin Exchange Rates (PHB):
 * - 1 PP (Platinum) = 10 GP
 * - 1 GP (Gold) = 1 GP (base)
 * - 1 SP (Silver) = 0.1 GP
 * - 1 CP (Copper) = 0.01 GP
 */

export interface CoinBreakdown {
    pp: number;  // Platinum pieces
    gp: number;  // Gold pieces
    sp: number;  // Silver pieces
    cp: number;  // Copper pieces
}

/**
 * Convert a GP value to a coin breakdown.
 * Uses a greedy algorithm to break down into largest denominations first.
 * 
 * @param gpValue - The value in gold pieces (can be decimal)
 * @returns CoinBreakdown with discrete coin counts
 */
export function gpToCoins(gpValue: number): CoinBreakdown {
    // Convert to copper to avoid floating-point issues
    let totalCopper = Math.round(gpValue * 100);

    // Platinum: 1 PP = 10 GP = 1000 CP
    const pp = Math.floor(totalCopper / 1000);
    totalCopper %= 1000;

    // Gold: 1 GP = 100 CP
    const gp = Math.floor(totalCopper / 100);
    totalCopper %= 100;

    // Silver: 1 SP = 10 CP
    const sp = Math.floor(totalCopper / 10);
    totalCopper %= 10;

    // Copper: remaining
    const cp = totalCopper;

    return { pp, gp, sp, cp };
}

/**
 * Convert a coin breakdown back to GP value.
 * 
 * @param coins - The coin breakdown
 * @returns Total value in gold pieces
 */
export function coinsToGp(coins: CoinBreakdown): number {
    return coins.pp * 10 + coins.gp + coins.sp * 0.1 + coins.cp * 0.01;
}

/**
 * Format a coin breakdown as a human-readable string.
 * Only shows non-zero denominations.
 * 
 * @param coins - The coin breakdown to format
 * @param options - Formatting options
 * @returns Formatted string like "2 GP, 5 SP, 3 CP"
 */
export function formatCoins(
    coins: CoinBreakdown,
    options: { compact?: boolean; showZeros?: boolean } = {}
): string {
    const { compact = false, showZeros = false } = options;

    const parts: string[] = [];

    if (coins.pp > 0 || showZeros) {
        parts.push(compact ? `${coins.pp}PP` : `${coins.pp} PP`);
    }
    if (coins.gp > 0 || (showZeros && coins.pp === 0)) {
        parts.push(compact ? `${coins.gp}GP` : `${coins.gp} GP`);
    }
    if (coins.sp > 0 || showZeros) {
        parts.push(compact ? `${coins.sp}SP` : `${coins.sp} SP`);
    }
    if (coins.cp > 0 || showZeros) {
        parts.push(compact ? `${coins.cp}CP` : `${coins.cp} CP`);
    }

    // If all zeros (shouldn't happen, but safety)
    if (parts.length === 0) {
        return compact ? '0GP' : '0 GP';
    }

    return compact ? parts.join(' ') : parts.join(', ');
}

/**
 * Format a GP value directly to a coin display string.
 * Convenience function combining gpToCoins and formatCoins.
 * 
 * @param gpValue - The value in gold pieces
 * @param options - Formatting options
 * @returns Formatted string like "2 GP, 5 SP"
 */
export function formatGpAsCoins(
    gpValue: number,
    options: { compact?: boolean } = {}
): string {
    const coins = gpToCoins(gpValue);
    return formatCoins(coins, options);
}

/**
 * Coin icons for display purposes.
 */
export const COIN_ICONS = {
    pp: '💎', // Platinum - diamond/gem for premium feel
    gp: '🪙', // Gold - standard coin
    sp: '🥈', // Silver - silver medal
    cp: '🥉', // Copper - bronze medal
} as const;

/**
 * Coin colors for styled display.
 */
export const COIN_COLORS = {
    pp: 'text-cyan-300',
    gp: 'text-amber-400',
    sp: 'text-gray-300',
    cp: 'text-orange-600',
} as const;
