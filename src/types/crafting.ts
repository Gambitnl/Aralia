import { SkillName } from './core';
import { ItemType } from './items';

export type CraftingStationType = 'forge' | 'alchemy_bench' | 'workbench' | 'campfire' | 'loom' | 'enchanters_table';

export type ItemQuality = 'poor' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface MaterialRequirement {
  itemId: string;
  quantity: number;
  consumed: boolean;
  qualityMin?: ItemQuality;
  /**
   * If true, any item of the specified `itemType` (e.g., 'wood') can be used
   * instead of a specific itemId.
   */
  matchByItemType?: ItemType;
}

export interface SkillRequirement {
  skill: SkillName;
  difficultyClass: number; // The DC to beat for success
}

export interface CraftBonus {
  attribute: 'damage' | 'durability' | 'value' | 'potency';
  value: number;
}

export interface CraftingOutput {
  itemId: string;
  quantity: number;
  qualityFromRoll: boolean; // If true, the result quality depends on the skill check
  bonusOnCrit?: CraftBonus; // Applied if the check exceeds DC by 10+
}

/**
 * A recipe for crafting items.
 * Includes requirements, outputs, and skill checks.
 */
export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: 'smithing' | 'alchemy' | 'woodworking' | 'weaving' | 'enchanting' | 'cooking' | 'tinkering';
  inputs: MaterialRequirement[];
  outputs: CraftingOutput[];
  station?: CraftingStationType;
  skillCheck?: SkillRequirement;
  timeMinutes: number;

  /**
   * Required tools that are not consumed but must be present.
   * e.g., 'hammer', 'mortar_pestle'
   */
  toolsRequired?: string[];
}

export interface CraftResult {
  success: boolean;
  quality: ItemQuality;
  itemsCreated: Array<{ itemId: string; quantity: number }>;
  materialsConsumed: Array<{ itemId: string; quantity: number }>;
  experienceGained?: number;
  message: string;
}
