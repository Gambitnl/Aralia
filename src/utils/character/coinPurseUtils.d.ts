/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:30:44
 * Dependents: character/index.ts, coinPurseUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
    pp: number;
    gp: number;
    sp: number;
    cp: number;
}
/**
 * Convert a GP value to a coin breakdown.
 * Uses a greedy algorithm to break down into largest denominations first.
 *
 * @param gpValue - The value in gold pieces (can be decimal)
 * @returns CoinBreakdown with discrete coin counts
 */
export declare function gpToCoins(gpValue: number): CoinBreakdown;
/**
 * Convert a coin breakdown back to GP value.
 *
 * @param coins - The coin breakdown
 * @returns Total value in gold pieces
 */
export declare function coinsToGp(coins: CoinBreakdown): number;
/**
 * Format a coin breakdown as a human-readable string.
 * Only shows non-zero denominations.
 *
 * @param coins - The coin breakdown to format
 * @param options - Formatting options
 * @returns Formatted string like "2 GP, 5 SP, 3 CP"
 */
export declare function formatCoins(coins: CoinBreakdown, options?: {
    compact?: boolean;
    showZeros?: boolean;
}): string;
/**
 * Format a GP value directly to a coin display string.
 * Convenience function combining gpToCoins and formatCoins.
 *
 * @param gpValue - The value in gold pieces
 * @param options - Formatting options
 * @returns Formatted string like "2 GP, 5 SP"
 */
export declare function formatGpAsCoins(gpValue: number, options?: {
    compact?: boolean;
}): string;
/**
 * Coin icons for display purposes.
 */
export declare const COIN_ICONS: {
    readonly pp: "💎";
    readonly gp: "🪙";
    readonly sp: "🥈";
    readonly cp: "🥉";
};
/**
 * Coin colors for styled display.
 */
export declare const COIN_COLORS: {
    readonly pp: "text-cyan-300";
    readonly gp: "text-amber-400";
    readonly sp: "text-gray-300";
    readonly cp: "text-orange-600";
};
