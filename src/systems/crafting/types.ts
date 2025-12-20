/**
 * @file src/systems/crafting/types.ts
 * Type definitions for the crafting system.
 */

export type CraftingStationType = 'forge' | 'alchemy_bench' | 'workbench' | 'campfire' | 'loom' | 'tannery' | 'disassembler' | 'enchanters_table';
export type CraftingQuality = 'poor' | 'standard' | 'superior' | 'masterwork';

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

export interface Recipe {
  id: string;
  name: string;
  description: string;
  /** Defaults to 'craft' if undefined. */
  recipeType?: 'craft' | 'salvage' | 'enchant';
  station: CraftingStationType;
  inputs: MaterialRequirement[];
  outputs: CraftingOutput[];
  skillCheck?: CraftingSkillRequirement;
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
