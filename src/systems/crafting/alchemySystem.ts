/**
 * @file src/systems/crafting/alchemySystem.ts
 * Experimental alchemy system allowing property-based ingredient mixing.
 * ALCHEMIST PHILOSOPHY: Creation should cost resources. Failure teaches.
 */
// TODO(lint-intent): 'ItemType' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Item, ItemType as _ItemType } from '../../types/items';
import { Crafter } from './craftingSystem';
import { CraftingResult } from './types';

// --- Constants ---
const BASE_ALCHEMY_DC = 12;
const DC_INCREASE_PER_REAGENT = 2;
const CRITICAL_SUCCESS_DC_MARGIN = 10;

// --- Types ---

export type ReagentProperty =
  | 'curative'    // Heals
  | 'reactive'    // Explodes/Reacts
  | 'toxic'       // Harms
  | 'binding'     // Extends duration
  | 'concentrated'// Boosts potency
  | 'inert';      // Filler

// Extended property type used by experimental alchemy for discovery combinations
export type AlchemicalProperty = ReagentProperty | 'psionic' | 'ethereal' | 'luminous';

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

export interface AlchemyRecipe {
  /** Minimum counts of properties required */
  requirements: Partial<Record<ReagentProperty, number>>;
  /** Output item ID */
  outputItemId: string;
  /** Base success message */
  successMessage: string;
  /** If true, presence of 'reactive' property makes result volatile */
  reactivityMakesVolatile?: boolean;
}

// --- Data ---

export const REAGENT_DATABASE: Record<string, ReagentProperty[]> = {
  // Common
  // Test fixtures reference these IDs; keep explicit mappings for deterministic recipes.
  'herb_red_root': ['curative', 'binding'],
  'herb_blue_leaf': ['reactive'],
  'cats_tongue': ['curative', 'binding'],
  'dreamlilly': ['toxic', 'inert'], // Intoxicating
  'gillyweed': ['binding', 'inert'], // Waterbreathing
  'morning_dew': ['curative', 'concentrated'],
  'red_amanita': ['curative', 'toxic'], // Healing but toxic if raw
  'rowan_berry': ['curative', 'binding'],

  // Uncommon
  'frost_lichen': ['inert', 'binding'],
  'lightning_moss': ['reactive', 'concentrated'],
  'mandrake_root': ['toxic', 'binding'],
  'mindflayer_stinkhorn': ['toxic', 'concentrated'], // Psychic
  'muroosa_twig': ['inert', 'binding'],
  'nightshade': ['toxic', 'reactive'],
  'olisuba_leaf': ['curative', 'concentrated'],
  'singing_nettle': ['reactive', 'binding'],
  'sourgrass': ['curative', 'inert'],
  'theki_root': ['curative', 'binding'],
  'willowshade_fruit': ['curative', 'binding'],

  // Rare
  'ashblossom': ['reactive', 'toxic'], // Fire
  'black_cap': ['toxic', 'concentrated'],
  'black_sap': ['toxic', 'binding'],
  'blight_spores': ['toxic', 'reactive'],
  'death_cap': ['toxic', 'concentrated'],
  'fairy_stool': ['reactive', 'concentrated'], // Magical/Hallucinogenic
  'hagfinger': ['binding', 'inert'],
  'moonstalker': ['reactive', 'binding'],
  'pixies_parasol': ['reactive', 'concentrated'],
  'silverthorn': ['reactive', 'binding'],
  'wolfsbane': ['toxic', 'reactive'],

  // Base
  'water_purified': ['inert', 'binding'],
  'vial_glass': ['inert']
};

const ALCHEMY_RECIPES: AlchemyRecipe[] = [
  {
    requirements: { curative: 2 },
    outputItemId: 'potion_healing',
    successMessage: 'The mixture turns a vibrant red.',
    reactivityMakesVolatile: true
  },
  {
    requirements: { toxic: 2 },
    outputItemId: 'poison_vial',
    successMessage: 'A dark, fuming liquid forms.'
  },
  {
    requirements: { reactive: 2, concentrated: 1 },
    outputItemId: 'bomb_fire',
    successMessage: 'The solution glows with dangerous heat.'
  }
];

// --- Type Guards ---

function isReagentProperty(value: string): value is ReagentProperty {
  return ['curative', 'reactive', 'toxic', 'binding', 'concentrated', 'inert'].includes(value);
}

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
    const props: ReagentProperty[] = [];
    for (const p of item.properties) {
      if (isReagentProperty(p)) {
        props.push(p);
      }
    }
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
  const dc = BASE_ALCHEMY_DC + (reagents.length * DC_INCREASE_PER_REAGENT); // Harder with more ingredients

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

  // Check recipes
  let matchedRecipe: AlchemyRecipe | undefined;

  // Simple matching: First match wins (could be improved to 'best match' later)
  for (const recipe of ALCHEMY_RECIPES) {
    let match = true;
    for (const [prop, minCount] of Object.entries(recipe.requirements)) {
      if ((counts[prop as ReagentProperty] || 0) < minCount!) {
        match = false;
        break;
      }
    }
    if (match) {
      matchedRecipe = recipe;
      break;
    }
  }

  if (matchedRecipe) {
    outputItemId = matchedRecipe.outputItemId;
    outcomeType = 'success';
    message = matchedRecipe.successMessage;

    if (matchedRecipe.reactivityMakesVolatile && counts['reactive']) {
      outcomeType = 'volatile';
      message = 'The mixture bubbles violently! Unstable healing potion created.';
    }
  } else {
    outcomeType = 'sludge';
    message = 'The mixture turns into a foul-smelling gray sludge.';
  }

  // 5. Apply Skill Results
  if (outcomeType !== 'sludge') {
    if (roll < dc) {
      // Failure to stabilize
      const isVolatileFailure = outcomeType === 'volatile' || counts['reactive'];
      outcomeType = 'sludge';
      outputItemId = undefined;

      if (isVolatileFailure) {
        message = 'The mixture destabilizes and evaporates violently! (Failure)';
      } else {
        message = 'You failed to bind the reagents properly. (Failure)';
      }
    } else if (roll >= dc + CRITICAL_SUCCESS_DC_MARGIN) {
      // Critical Success
      quantity = 2;
      message += ' (Masterful synthesis!)';
    }
  }

  // 6. Construct Result
  const outputs = outputItemId ? [{ itemId: outputItemId, quantity }] : [];

  return {
    success: !!outputItemId && outcomeType !== 'sludge',
    quality: roll >= dc + CRITICAL_SUCCESS_DC_MARGIN ? 'superior' : (roll >= dc ? 'standard' : 'poor'),
    outputs,
    consumedMaterials: consumed,
    materialsLost: true, // Always lose ingredients in alchemy
    message,
    outcomeType,
    discoveredProperties: inputProps // In a real system, filter to only properties that contributed
  };
}

// TODO(Architect): Integrate with `src/components/Crafting/AlchemyBench.tsx` to allow drag-and-drop experimentation.
