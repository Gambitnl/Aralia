/**
 * @file src/systems/crafting/types.ts
 * Type definitions for the crafting system.
 */

export type CraftingStationType = 'forge' | 'alchemy_bench' | 'workbench' | 'campfire' | 'loom' | 'tannery';
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

export interface SalvageOutcome {
  itemId: string;
  quantityMin: number;
  quantityMax: number;
  chance: number; // 0.0 to 1.0
}

export interface SalvageRule {
  id: string;
  targetItemId: string;
  station?: CraftingStationType;
  timeMinutes: number;
  skillCheck?: CraftingSkillRequirement;
  outputs: SalvageOutcome[];
}

export interface SalvageResult {
  success: boolean;
  quality: CraftingQuality;
  outputs: { itemId: string; quantity: number }[];
  message: string;
  experienceGained?: number;
}
