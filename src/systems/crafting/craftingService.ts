import { Recipe, CraftResult, MaterialRequirement } from '../../types/crafting';
import { PlayerCharacter } from '../../types/character';
import { InventoryEntry } from '../../types/items';
import { getSkillModifierValue } from '../../utils/statUtils';
import { rollDice } from '../../utils/combatUtils';

// Mock inventory check function - in a real system this would interface with inventory state
export const checkMaterials = (
  inventory: InventoryEntry[],
  requirements: MaterialRequirement[]
): { hasMaterials: boolean; missing: string[] } => {
  const missing: string[] = [];

  for (const req of requirements) {
    // Basic implementation only checking exact item IDs
    // TODO: Implement matchByItemType logic
    const found = inventory.find(i => i.id === req.itemId);
    const available = (found && 'quantity' in found && typeof found.quantity === 'number') ? found.quantity : (found ? 1 : 0);

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
): CraftResult => {

  // 1. Validate Materials
  const { hasMaterials, missing } = checkMaterials(inventory, recipe.inputs);

  if (!hasMaterials) {
    return {
      success: false,
      quality: 'poor',
      itemsCreated: [],
      materialsConsumed: [],
      message: `Missing materials: ${missing.join(', ')}`
    };
  }
  // TODO(lint-intent): 'success' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  const _success = true;
  // TODO(lint-intent): '_quality' is declared but unused, suggesting an unfinished craft-quality path.
  // TODO(lint-intent): If quality should affect outputs, thread it into item creation or result messaging.
  // TODO(lint-intent): Otherwise drop it to keep the crafting result minimal.
  const _quality: CraftResult['quality'] = 'common';
  let isCrit = false;

  // 2. Skill Check
  if (recipe.skillCheck) {
    const modifier = getSkillModifierValue(crafter, recipe.skillCheck.skill);
    const roll = rollDice('1d20');
    const total = roll + modifier;

    if (total < recipe.skillCheck.difficultyClass) {
      // Failed check
      return {
        success: false,
        quality: 'poor',
        itemsCreated: [],
        materialsConsumed: recipe.inputs
          .filter(i => i.consumed)
          .map(i => ({ itemId: i.itemId, quantity: Math.ceil(i.quantity * 0.5) })), // Lost 50% on fail
        message: `Crafting failed. Rolled ${total} vs DC ${recipe.skillCheck.difficultyClass}. Materials lost.`
      };
    }

    // Check for Critical Success (Beat DC by 10 or more)
    if (total >= recipe.skillCheck.difficultyClass + 10) {
      isCrit = true;
      // TODO(lint-intent): 'quality' is declared but unused, suggesting an unfinished state/behavior hook in this block.
      // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
      // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
      _quality = 'rare'; // Or boost based on recipe.outputs
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
    quality: isCrit ? 'rare' : 'common', // Simplification for MVP
    itemsCreated: createdItems,
    materialsConsumed: consumedItems,
    experienceGained: recipe.timeMinutes * 10, // Placeholder XP formula
    message: isCrit ? 'Critical success! Created superior item.' : 'Crafting successful.'
  };
};
