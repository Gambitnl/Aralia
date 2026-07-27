/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 17:22:06
 * Dependents: components/Trade/MerchantModal.tsx, hooks/actions/handleMerchantInteraction.ts, utils/economy/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file handles all calculations for item prices in the game's economy.
 *
 * It centralizes how gold (GP), silver (SP), and copper (CP) are valued and how merchant
 * transaction multipliers apply based on scarcity, regional wealth, and faction standing.
 * By using this hub, we ensure that buying a torch in a rich capital city feels
 * appropriately different from selling one in a struggling border village.
 *
 * Called by: MerchantModal.tsx (for display), handleMerchantInteraction.ts (for execution)
 * Depends on: RegionalEconomySystem for local wealth data, FactionEconomyManager for standing bonuses
 */
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/economy/economyUtils.ts
 * Utility functions for the dynamic economy system.
 */
import { Item, EconomyState } from '../../types';
import { Faction, PlayerFactionStanding } from '../../types/factions';
export interface PriceContext {
    factions?: Record<string, Faction>;
    standings?: Record<string, PlayerFactionStanding>;
}
/**
 * Parses a cost string like "10 GP" into a gold value.
 */
export declare const parseCost: (costStr: string | undefined) => number;
export interface PriceCalculationResult {
    finalPrice: number;
    basePrice: number;
    multiplier: number;
    isModified: boolean;
}
/**
 * Calculates the dynamic price of an item based on the current economy state.
 *
 * @param item The item to price.
 * @param economy The current global economy state.
 * @param transactionType 'buy' (player buying from merchant) or 'sell' (player selling to merchant).
 * @param regionId Optional region ID to apply local import/export modifiers.
 * @param context Optional faction data and player standings for faction trade bonuses.
 * @returns Detailed calculation result including final price and modifiers.
 */
export declare const calculatePrice: (item: Item, economy: EconomyState | undefined, transactionType: "buy" | "sell", regionId?: string, context?: PriceContext) => PriceCalculationResult;
