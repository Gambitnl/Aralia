/**
 * @file src/systems/crafting/alchemySystem.ts
 * Experimental alchemy system allowing property-based ingredient mixing.
 * ALCHEMIST PHILOSOPHY: Creation should cost resources. Failure teaches.
 */

import { Item, ItemType } from '../../types/items';
import { Crafter } from './craftingSystem';
import { CraftingResult } from './types';

// --- Types ---

export type ReagentProperty =
  | 'curative'    // Heals
  | 'reactive'    // Explodes/Reacts
  | 'toxic'       // Harms
  | 'binding'     // Extends duration
  | 'concentrated'// Boosts potency
  | 'inert';      // Filler

export interface AlchemyReagent {
  itemId: string;
  properties: ReagentProperty[];
  power: number; // 1-5 scale of potency
}

export type AlchemyOutcomeType = 'success' | 'volatile' | 'sludge' | 'discovery';

export interface AlchemyResult extends CraftingResult {
  outcomeType: AlchemyOutcomeType;
  discoveredProperties: string[]; // Properties revealed to the player
}

// --- Data ---
// In a full system, this would be in `data/reagents.ts` or on the Item definitions.
// For the framework, we map specific IDs or use a fallback.

const REAGENT_DATABASE: Record<string, ReagentProperty[]> = {
  'herb_red_root': ['curative', 'binding'],
  'herb_blue_leaf': ['reactive', 'concentrated'],
  'mushroom_spotted': ['toxic', 'reactive'],
  'water_purified': ['inert', 'binding'],
  'dust_glow': ['reactive', 'concentrated'],
  'vial_glass': ['inert'] // Container
};

/**
 * Analyzes an item to determine its alchemical properties.
 */
export function getReagentProperties(item: Item): ReagentProperty[] {
  // 1. Check database override
  if (REAGENT_DATABASE[item.id]) {
    return REAGENT_DATABASE[item.id];
  }

  // 2. Check item tags/properties
  if (item.properties) {
    // Filter item properties that match ReagentProperty
    const props = item.properties.filter(p =>
      ['curative', 'reactive', 'toxic', 'binding', 'concentrated', 'inert'].includes(p)
    ) as ReagentProperty[];

    if (props.length > 0) return props;
  }

  // 3. Fallback
  return ['inert'];
}

/**
 * Attempts to mix reagents to create an alchemical effect.
 * Unlike standard crafting, this does not require a recipe ID.
 * It derives the result from the combined properties of the inputs.
 */
export function attemptAlchemy(crafter: Crafter, reagents: Item[]): AlchemyResult {
  // 1. Validation
  if (reagents.length === 0) {
    return {
      success: false,
      quality: 'poor',
      outputs: [],
      consumedMaterials: [],
      materialsLost: false,
      message: 'No reagents provided.',
      outcomeType: 'sludge',
      discoveredProperties: []
    };
  }

  // 2. Analyze Inputs
  const inputProps: ReagentProperty[] = [];
  const consumed: { itemId: string; quantity: number }[] = [];

  reagents.forEach(item => {
    inputProps.push(...getReagentProperties(item));
    consumed.push({ itemId: item.id, quantity: 1 }); // Assume 1 of each for experimentation
  });

  // 3. Skill Check
  // Alchemy is volatile. High skill = stability + potency.
  // Prefer tool skill, fallback to raw intelligence. Handle 0 as a valid roll result.
  const toolRoll = crafter.rollSkill('Alchemist\'s Supplies');
  const roll = toolRoll > 0 ? toolRoll : crafter.rollSkill('Intelligence');
  const dc = 12 + (reagents.length * 2); // Harder with more ingredients

  let outcomeType: AlchemyOutcomeType = 'sludge';
  let outputItemId: string | undefined;
  let quantity = 1;
  let message = '';

  // 4. Reaction Logic
  // Count properties
  const counts = inputProps.reduce((acc, prop) => {
    acc[prop] = (acc[prop] || 0) + 1;
    return acc;
  }, {} as Record<ReagentProperty, number>);

  // Logic:
  // Curative x2 = Healing Potion
  // Toxic x2 = Poison
  // Reactive + X = Volatile X

  if (counts['curative'] >= 2) {
    outputItemId = 'potion_healing';
    outcomeType = 'success';
    message = 'The mixture turns a vibrant red.';

    if (counts['reactive']) {
      outcomeType = 'volatile';
      message = 'The mixture bubbles violently! Unstable healing potion created.';
      // Could output a 'potion_healing_volatile' if it existed, or just standard with side effect text
    }
  } else if (counts['toxic'] >= 2) {
    outputItemId = 'poison_vial'; // Hypothetical item
    outcomeType = 'success';
    message = 'A dark, fuming liquid forms.';
  } else if (counts['reactive'] >= 2 && counts['concentrated']) {
    outputItemId = 'bomb_fire'; // Hypothetical
    outcomeType = 'success';
    message = 'The solution glows with dangerous heat.';
  } else {
    // No match
    outcomeType = 'sludge';
    message = 'The mixture turns into a foul-smelling gray sludge.';
  }

  // 5. Apply Skill Results
  if (outcomeType !== 'sludge') {
    if (roll < dc) {
      // Failure to stabilize
      if (outcomeType === 'volatile' || counts['reactive']) {
        // Explosion!
        outcomeType = 'sludge'; // Or 'explosion'
        message = 'The mixture destabilizes and evaporates violently! (Failure)';
        outputItemId = undefined;
      } else {
        // Just ruined
        outcomeType = 'sludge';
        message = 'You failed to bind the reagents properly. (Failure)';
        outputItemId = undefined;
      }
    } else if (roll >= dc + 10) {
      // Critical Success
      quantity = 2;
      message += ' (Masterful synthesis!)';
    }
  }

  // 6. Construct Result
  const outputs = outputItemId ? [{ itemId: outputItemId, quantity }] : [];

  return {
    success: !!outputItemId && outcomeType !== 'sludge',
    quality: roll >= dc + 10 ? 'superior' : (roll >= dc ? 'standard' : 'poor'),
    outputs,
    consumedMaterials: consumed,
    materialsLost: true, // Always lose ingredients in alchemy
    message,
    outcomeType,
    discoveredProperties: inputProps // In a real system, filter to only properties that contributed
  };
}

// TODO(Architect): Integrate with `src/components/Crafting/AlchemyBench.tsx` to allow drag-and-drop experimentation.
