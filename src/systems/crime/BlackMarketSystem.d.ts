/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 25/06/2026, 01:16:49
 * Dependents: None (Orphan)
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { BlackMarketListing, ContrabandDefinition, ContrabandCategory } from '../../types/crime';
export declare class BlackMarketSystem {
    /**
     * Generates listings for a black market in a specific location.
     * Prices and availability depend on the location's supply/demand.
     */
    static generateListings(locationId: string, demandCategories: ContrabandCategory[], baseSupplyLevel: number, // 1-10
    seed?: number): BlackMarketListing[];
    /**
     * Calculates the sell price for contraband the player wants to SELL to the market.
     */
    static getSellPrice(item: ContrabandDefinition, locationDemand: ContrabandCategory[]): number;
    private static getRandomCategory;
    private static generateContrabandItem;
}
