/**
 * @file src/systems/crafting/types.ts
 * Type definitions for the crafting system.
 */

export type CraftingStationType =
  | 'forge'
  | 'alchemy_bench'
  | 'workbench'
  | 'campfire'
  | 'kitchen'
  | 'loom'
  | 'tannery'
  | 'disassembler'
  | 'enchanters_table';

export type CraftingQuality = 'poor' | 'standard' | 'superior' | 'masterwork';

export type RecipeType = 'craft' | 'salvage' | 'enchant' | 'refine' | 'cooking';

export interface MaterialRequirement {
  itemId: string;
  quantity: number;
  consumed: boolean;
}

export interface CraftingSkillRequirement {
  skill: string; // e.g., 'Arcana', 'Smith's Tools'
  dc: number;
}

export interface CraftingOutput {
  itemId: string;
  quantity: number;
  /** If true, the output item quality depends on the craft roll result. */
  qualityBound?: boolean;
}

export interface QualityOutcome {
  /** The roll threshold (inclusive) to achieve this outcome. e.g., DC+5 or absolute value like 15. */
  threshold: number;
  /** The quality label applied to the result. */
  quality: CraftingQuality;
  /** Optional: Override the output item ID (e.g. 'iron_sword' -> 'fine_iron_sword'). */
  itemIdOverride?: string;
  /** Optional: Multiply the output quantity (e.g. x2 potions). */
  quantityMultiplier?: number;
  /** Optional: Additional message to display (e.g. "You crafted a masterpiece!"). */
  message?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  /** Defaults to 'craft' if undefined. */
  recipeType?: RecipeType;
  station: CraftingStationType;
  inputs: MaterialRequirement[];
  outputs: CraftingOutput[];
  skillCheck?: CraftingSkillRequirement;
  /**
   * Optional list of outcomes based on skill check results.
   * If provided, these override the default logic.
   * Outcomes are checked in descending order of threshold.
   */
  qualityOutcomes?: QualityOutcome[];
  timeMinutes: number;
}

export interface CraftingResult {
  success: boolean;
  quality: CraftingQuality;
  outputs: { itemId: string; quantity: number }[];
  consumedMaterials: { itemId: string; quantity: number }[];
  experienceGained?: number;
  message: string;
  /** If failure caused material loss, this is true. */
  materialsLost: boolean;
}
