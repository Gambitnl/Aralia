/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 08/06/2026, 13:21:07
 * Dependents: None (Orphan)
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Recipe, CraftingResult, MaterialRequirement } from './types';
import { PlayerCharacter } from '../../types/character';
import { InventoryEntry } from '../../types/items';
export declare const checkMaterials: (inventory: InventoryEntry[], requirements: MaterialRequirement[]) => {
    hasMaterials: boolean;
    missing: string[];
};
/**
 * Attempts to craft an item using the provided recipe.
 */
export declare const attemptCraft: (crafter: PlayerCharacter, recipe: Recipe, inventory: InventoryEntry[]) => CraftingResult;
