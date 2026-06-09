// @dependencies-start
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
// @dependencies-end

import { Recipe, CraftingResult, MaterialRequirement } from './types';
import { PlayerCharacter } from '../../types/character';
import { InventoryEntry } from '../../types/items';
// TODO(2026-01-03 pass 4 Codex-CLI): use ability modifier helper until dedicated skill calc is exposed.
import { getAbilityModifierValue as getSkillModifierValue } from '../../utils/statUtils';
import { rollDice } from '../../utils/combatUtils';

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
 * Attempts to craft an item using the provided recipe.
 */
export const attemptCraft = (
  crafter: PlayerCharacter,
  recipe: Recipe,
  inventory: InventoryEntry[] // Passed in to verify, though consumption logic would be in a reducer
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
  let materialsLost = false;

  // 2. Skill Check
  if (recipe.skillCheck) {
    // TODO(2026-01-03 pass 4 Codex-CLI): skill modifier helper expects different signature; casting to accept character + skill for now.
    const modifier = (getSkillModifierValue as unknown as (pc: PlayerCharacter, skill: string) => number)(crafter, recipe.skillCheck.skill);
    const roll = rollDice('1d20');
    const total = roll + modifier;

    if (total < recipe.skillCheck.dc) { // difficultyClass -> dc
      // Failed check
      materialsLost = true;
      return {
        success: false,
        quality: 'poor',
        outputs: [],
        consumedMaterials: recipe.inputs
          .filter(i => i.consumed)
          .map(i => ({ itemId: i.itemId, quantity: Math.ceil(i.quantity * 0.5) })), // Lost 50% on fail
        materialsLost: true,
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

  // TODO(Architect): Integrate with Redux/State to actually remove items and add outputs to inventory.

  return {
    success: true,
    quality: _quality, // Use the calculated quality
    outputs: createdItems,
    consumedMaterials: consumedItems,
    materialsLost: false,
    experienceGained: recipe.timeMinutes * 10, // Placeholder XP formula
    message: isCrit ? 'Critical success! Created superior item.' : 'Crafting successful.'
  };
};
