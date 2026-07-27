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
import { StolenItem, Fence } from '../../../types/crime';
import { PlayerCharacter } from '../../../types/character';
export interface FenceTransactionResult {
    success: boolean;
    goldEarned: number;
    heatGenerated: number;
    message: string;
}
export declare class FenceSystem {
    /**
     * Generates a fence NPC for a given location.
     */
    static generateFence(locationId: string, _locationName: string): Fence;
    /**
     * Evaluates how much a fence is willing to pay for an item.
     * Returns null if the fence refuses the item.
     */
    static evaluateItem(item: StolenItem, fence: Fence, player: PlayerCharacter): number | null;
    /**
     * Executes the sale of a stolen item.
     */
    static sellItem(item: StolenItem, fence: Fence, player: PlayerCharacter): FenceTransactionResult;
    /**
     * Processes a transaction, returning the updated entities.
     * NOTE: This is a pure function that returns new object states.
     * It is up to the caller (Reducer/ActionHandler) to apply these changes to the GameState.
     */
    static processTransaction(item: StolenItem, fence: Fence, player: PlayerCharacter): {
        updatedPlayer: PlayerCharacter;
        updatedFence: Fence;
        result: FenceTransactionResult;
    };
    private static calculateSocialBonus;
    private static getRandomCategories;
}
