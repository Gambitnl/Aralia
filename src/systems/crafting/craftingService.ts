// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: None (Orphan)
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Recipe, CraftingResult, MaterialRequirement, CraftingStationType, CraftingQuality } from './types';
import { PlayerCharacter } from '../../types/character';
import { AbilityScoreName } from '../../types/core';
import { InventoryEntry } from '../../types/items';
import { SKILLS_DATA } from '../../data/skills';
import { rollAbilityCheck } from '../../utils/character/checkUtils';
import { getCraftingBlessingBonus } from '../../data/religion/blessings';
import { XP_REWARDS } from './crafterProgression';

// Mock inventory check function - in a real system this would interface with inventory state
export const checkMaterials = (
  inventory: InventoryEntry[],
  requirements: MaterialRequirement[]
): { hasMaterials: boolean; missing: string[] } => {
  const missing: string[] = [];

  // Exact item IDs stay authoritative, but legacy recipe data can also point at
  // the broader type/category fields that already exist on inventory entries.
  const matchesRequirement = (entry: InventoryEntry, requirement: MaterialRequirement): boolean => {
    if (entry.id === requirement.itemId) {
      return true;
    }

    if (entry.type === requirement.itemId) {
      return true;
    }

    return entry.category === requirement.itemId;
  };

  const getAvailableQuantity = (entry: InventoryEntry): number => {
    return typeof entry.quantity === 'number' ? entry.quantity : 1;
  };

  for (const req of requirements) {
    const available = inventory.reduce((count, entry) => {
      if (!matchesRequirement(entry, req)) {
        return count;
      }

      return count + getAvailableQuantity(entry);
    }, 0);

    if (available < req.quantity) {
      missing.push(`${req.itemId} (Need ${req.quantity}, Have ${available})`);
    }
  }

  return { hasMaterials: missing.length === 0, missing };
};

/**
 * The ability that governs a craft at each station when the recipe names a tool
 * rather than one of the eighteen skills. Exhaustive over CraftingStationType so
 * a new station cannot silently inherit someone else's ability.
 */
const STATION_ABILITY: Record<CraftingStationType, AbilityScoreName> = {
  forge: 'Strength',
  alchemy_bench: 'Intelligence',
  workbench: 'Dexterity',
  campfire: 'Wisdom',
  kitchen: 'Wisdom',
  loom: 'Dexterity',
  tannery: 'Dexterity',
  disassembler: 'Intelligence',
  enchanters_table: 'Intelligence'
};

/**
 * Resolves which ability a craft check rolls against. A recipe that names a real
 * skill uses that skill's ability; a recipe that names a tool kit uses the
 * station's ability.
 */
export const getCraftingCheckAbility = (recipe: Recipe): AbilityScoreName => {
  const label = recipe.skillCheck?.skill?.trim();
  if (label) {
    const key = label.toLowerCase().replace(/[\s-]+/g, '_');
    const skill = SKILLS_DATA[key] ?? Object.values(SKILLS_DATA).find(
      candidate => candidate.name.toLowerCase() === label.toLowerCase()
    );
    if (skill) {
      return skill.ability;
    }
  }

  return STATION_ABILITY[recipe.station];
};

/**
 * Crafting rarity tier, derived from the check DC.
 *
 * The recipe corpus in alchemyRecipes.ts pairs every rarity with one DC:
 * common 10, uncommon 15, rare 20, very rare 25. `Recipe` carries a DC but no
 * rarity, so the same DC ladder names its tier and keeps one XP scale for both
 * recipe shapes.
 */
export type CraftingTier = 'common' | 'uncommon' | 'rare' | 'very_rare';

export const getCraftingTier = (dc: number): CraftingTier => {
  if (dc >= 25) return 'very_rare';
  if (dc >= 20) return 'rare';
  if (dc >= 15) return 'uncommon';
  return 'common';
};

/**
 * Crafting experience for one attempt.
 *
 * Aligned with craftingEngine: the tier sets the base award, masterwork adds its
 * bonus, and a failed attempt still teaches something. A recipe with no skill
 * check is common tier because nothing could be got wrong.
 */
export const calculateCraftingExperience = (params: {
  dc: number;
  success: boolean;
  quality: CraftingQuality;
}): number => {
  const { dc, success, quality } = params;
  if (!success) {
    return XP_REWARDS.failure;
  }

  const tier = getCraftingTier(dc);
  const tierKey: keyof typeof XP_REWARDS = `${tier}_success`;
  const base = XP_REWARDS[tierKey];
  return quality === 'masterwork' ? base + XP_REWARDS.masterwork_bonus : base;
};

/** Roll controls and outside bonuses for a craft attempt. */
export interface CraftAttemptOptions {
  /** Supplies the random stream without replacing the shared dice engine. */
  rng?: () => number;
  /** Bonus from outside the character sheet, e.g. crafter progression or station quality. */
  externalModifier?: number;
}

/**
 * Attempts to craft an item using the provided recipe.
 */
export const attemptCraft = (
  crafter: PlayerCharacter,
  recipe: Recipe,
  inventory: InventoryEntry[], // Passed in to verify, though consumption logic would be in a reducer
  options?: CraftAttemptOptions
): CraftingResult => {

  // 1. Validate Materials
  const { hasMaterials, missing } = checkMaterials(inventory, recipe.inputs);

  if (!hasMaterials) {
    return {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [],
      materialsLost: false,
      message: `Missing materials: ${missing.join(', ')}`
    };
  }

  let _quality: CraftingResult['quality'] = 'standard';
  let isCrit = false;

  // 2. Skill Check
  if (recipe.skillCheck) {
    // Divine blessings such as Artisan's Touch bless the craft, not one ability,
    // so their bonus enters the shared check as an external modifier.
    const blessing = getCraftingBlessingBonus(crafter.statusEffects);
    const externalModifier = (options?.externalModifier ?? 0) + blessing.bonus;

    // One roll path: rollAbilityCheck carries proficiency, expertise, racial
    // bonuses and status riders such as Guidance into the craft check.
    const check = rollAbilityCheck(
      crafter,
      getCraftingCheckAbility(recipe),
      recipe.skillCheck.skill,
      { externalModifier, rng: options?.rng }
    );
    const total = check.total;

    if (total < recipe.skillCheck.dc) { // difficultyClass -> dc
      // Failed check
      return {
        success: false,
        quality: 'poor',
        outputs: [],
        consumedMaterials: recipe.inputs
          .filter(i => i.consumed)
          .map(i => ({ itemId: i.itemId, quantity: Math.ceil(i.quantity * 0.5) })), // Lost 50% on fail
        materialsLost: true,
        experienceGained: calculateCraftingExperience({
          dc: recipe.skillCheck.dc,
          success: false,
          quality: 'poor'
        }),
        message: `Crafting failed. Rolled ${total} vs DC ${recipe.skillCheck.dc}. Materials lost.`
      };
    }

    // Check for Critical Success (Beat DC by 10 or more)
    if (total >= recipe.skillCheck.dc + 10) {
      isCrit = true;
      _quality = 'masterwork'; // Boost quality on crit (rare -> masterwork)
    }
  }

  // 3. Generate Output
  const createdItems = recipe.outputs.map(out => ({
    itemId: out.itemId,
    quantity: out.quantity
  }));

  // 4. Calculate Consumed Materials
  const consumedItems = recipe.inputs
    .filter(req => req.consumed)
    .map(req => ({
      itemId: req.itemId,
      quantity: req.quantity
    }));

  return {
    success: true,
    quality: _quality, // Use the calculated quality
    outputs: createdItems,
    consumedMaterials: consumedItems,
    materialsLost: false,
    experienceGained: calculateCraftingExperience({
      dc: recipe.skillCheck?.dc ?? 0,
      success: true,
      quality: _quality
    }),
    message: isCrit ? 'Critical success! Created superior item.' : 'Crafting successful.'
  };
};
