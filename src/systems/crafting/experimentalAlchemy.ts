/**
 * @file src/systems/crafting/experimentalAlchemy.ts
 * Experimental Alchemy system - mix random ingredients to discover effects.
 * Based on the PDF source material's property-based crafting system.
 */
import { rollDice } from '../../utils/combatUtils';
import { REAGENT_DATABASE, AlchemicalProperty } from './alchemySystem';

export type ExperimentOutcome =
    | 'discovery'
    | 'partial_success'
    | 'inert_mixture'
    | 'minor_explosion'
    | 'toxic_cloud'
    | 'wild_magic'
    | 'mutation';

export interface ExperimentResult {
    outcome: ExperimentOutcome;
    success: boolean;
    message: string;
    discoveredRecipe?: string;
    damage?: { amount: number; type: string };
    condition?: { effect: string; duration: number };
    outputItem?: { itemId: string; quantity: number };
    xpGained: number;
}

export interface IngredientProperties {
    itemId: string;
    name: string;
    properties: AlchemicalProperty[];
}

// Property combinations that can discover recipes
const DISCOVERY_COMBINATIONS: { properties: AlchemicalProperty[]; recipeId: string; dc: number }[] = [
    // Healing combinations
    { properties: ['curative', 'curative'], recipeId: 'healing_salve', dc: 12 },
    { properties: ['curative', 'reactive'], recipeId: 'antitoxin', dc: 15 },

    // Buff combinations
    { properties: ['reactive', 'psionic'], recipeId: 'potion_of_mind_reading', dc: 20 },
    { properties: ['luminous', 'curative'], recipeId: 'potion_of_heroism', dc: 18 },

    // Damage/Bomb combinations
    { properties: ['reactive', 'toxic'], recipeId: 'vial_of_acid', dc: 12 },
    { properties: ['reactive', 'reactive'], recipeId: 'blasting_powder', dc: 14 },
    { properties: ['luminous', 'reactive'], recipeId: 'alchemists_fire', dc: 12 },

    // Utility combinations
    { properties: ['ethereal', 'ethereal'], recipeId: 'potion_of_gaseous_form', dc: 20 },
    { properties: ['psionic', 'ethereal'], recipeId: 'potion_of_invisibility', dc: 22 },

    // Poison combinations
    { properties: ['toxic', 'toxic'], recipeId: 'basic_poison', dc: 10 },
    { properties: ['toxic', 'psionic'], recipeId: 'truth_serum', dc: 16 }
];

// Failure effects based on property combinations
const FAILURE_EFFECTS: { properties: AlchemicalProperty[]; outcome: ExperimentOutcome }[] = [
    { properties: ['reactive', 'reactive'], outcome: 'minor_explosion' },
    { properties: ['toxic', 'reactive'], outcome: 'toxic_cloud' },
    { properties: ['psionic', 'psionic'], outcome: 'wild_magic' },
    { properties: ['ethereal', 'toxic'], outcome: 'mutation' }
];

/**
 * Gets the alchemical properties of an ingredient.
 */
export function getIngredientProperties(itemId: string): AlchemicalProperty[] {
    const reagent = REAGENT_DATABASE[itemId];
    if (reagent) {
        return reagent.properties;
    }
    // Default properties for unknown ingredients
    return ['inert'];
}

/**
 * Combines properties from multiple ingredients.
 */
export function combineProperties(ingredients: string[]): AlchemicalProperty[] {
    const allProperties: AlchemicalProperty[] = [];
    for (const itemId of ingredients) {
        allProperties.push(...getIngredientProperties(itemId));
    }
    return allProperties;
}

/**
 * Checks if properties match a combination (order doesn't matter).
 */
function propertiesMatch(have: AlchemicalProperty[], need: AlchemicalProperty[]): boolean {
    const haveCopy = [...have];
    for (const prop of need) {
        const idx = haveCopy.indexOf(prop);
        if (idx === -1) return false;
        haveCopy.splice(idx, 1);
    }
    return true;
}

/**
 * Attempts experimental alchemy - mixing ingredients without a known recipe.
 */
export function attemptExperiment(
    ingredients: string[],
    crafterModifier: number,
    knownRecipes: Set<string>
): ExperimentResult {
    if (ingredients.length < 2 || ingredients.length > 4) {
        return {
            outcome: 'inert_mixture',
            success: false,
            message: 'Experiments require 2-4 ingredients.',
            xpGained: 0
        };
    }

    const properties = combineProperties(ingredients);

    // Roll for the experiment
    const rawRoll = rollDice('1d20');
    const totalRoll = rawRoll + crafterModifier;
    const isNat1 = rawRoll === 1;
    const isNat20 = rawRoll === 20;

    // Check for catastrophic failure on nat 1
    if (isNat1) {
        const failureType = determineFailure(properties);
        return createFailureResult(failureType, properties);
    }

    // Check if this combination can discover a recipe
    for (const combo of DISCOVERY_COMBINATIONS) {
        if (propertiesMatch(properties, combo.properties)) {
            // Already known? No discovery but might get a partial result
            if (knownRecipes.has(combo.recipeId)) {
                if (totalRoll >= combo.dc) {
                    return {
                        outcome: 'partial_success',
                        success: true,
                        message: `You created a weak version of a known recipe. The mixture bubbles briefly before stabilizing.`,
                        xpGained: 5
                    };
                }
            } else {
                // Chance to discover!
                if (totalRoll >= combo.dc || isNat20) {
                    return {
                        outcome: 'discovery',
                        success: true,
                        message: `🎉 DISCOVERY! You've uncovered the secrets of a new recipe!`,
                        discoveredRecipe: combo.recipeId,
                        xpGained: 50
                    };
                } else if (totalRoll >= combo.dc - 5) {
                    return {
                        outcome: 'partial_success',
                        success: false,
                        message: `The mixture shows promise but fails to stabilize. You sense you're close to something... (DC ${combo.dc}, rolled ${totalRoll})`,
                        xpGained: 10
                    };
                }
            }
        }
    }

    // Check for random failures based on volatile combinations
    if (totalRoll < 10) {
        const failureType = determineFailure(properties);
        if (failureType !== 'inert_mixture') {
            return createFailureResult(failureType, properties);
        }
    }

    // Nothing happened
    return {
        outcome: 'inert_mixture',
        success: false,
        message: 'The ingredients combine but produce nothing useful. The mixture is inert.',
        xpGained: 2
    };
}

/**
 * Determines what type of failure based on ingredient properties.
 */
function determineFailure(properties: AlchemicalProperty[]): ExperimentOutcome {
    for (const effect of FAILURE_EFFECTS) {
        if (propertiesMatch(properties, effect.properties)) {
            return effect.outcome;
        }
    }

    // Random minor failure
    const roll = rollDice('1d6');
    if (roll <= 2) return 'minor_explosion';
    if (roll <= 4) return 'toxic_cloud';
    return 'inert_mixture';
}

/**
 * Creates a failure result with appropriate effects.
 */
function createFailureResult(outcome: ExperimentOutcome, _properties: AlchemicalProperty[]): ExperimentResult {
    switch (outcome) {
        case 'minor_explosion':
            return {
                outcome,
                success: false,
                message: '💥 EXPLOSION! The volatile mixture detonates, dealing damage to everyone nearby!',
                damage: { amount: rollDice('2d6'), type: 'fire' },
                xpGained: 5
            };

        case 'toxic_cloud':
            return {
                outcome,
                success: false,
                message: '☠️ TOXIC CLOUD! Noxious fumes billow from the mixture!',
                condition: { effect: 'poisoned', duration: 60 },
                xpGained: 5
            };

        case 'wild_magic':
            const wildEffect = rollDice('1d4');
            const effects = [
                'You briefly turn blue.',
                'All your hair falls out (it grows back in a day).',
                'You hiccup bubbles for an hour.',
                'You glow faintly for 10 minutes.'
            ];
            return {
                outcome,
                success: false,
                message: `✨ WILD MAGIC! ${effects[wildEffect - 1]}`,
                xpGained: 10
            };

        case 'mutation':
            return {
                outcome,
                success: false,
                message: '🧬 MUTATION! The unstable mixture causes temporary transformation!',
                condition: { effect: 'polymorphed', duration: 10 },
                xpGained: 15
            };

        default:
            return {
                outcome: 'inert_mixture',
                success: false,
                message: 'The mixture fizzles into nothing.',
                xpGained: 1
            };
    }
}

/**
 * Gets a description of what might happen with certain property combinations.
 * Used for UI hints.
 */
export function getPropertyHint(properties: AlchemicalProperty[]): string {
    const uniqueProps = [...new Set(properties)];

    if (uniqueProps.includes('reactive') && uniqueProps.length > 1) {
        return '⚠️ Volatile combination - risk of explosion!';
    }
    if (uniqueProps.includes('toxic') && uniqueProps.includes('reactive')) {
        return '☠️ Dangerous combination - toxic fumes likely!';
    }
    if (uniqueProps.includes('curative')) {
        return '💚 Healing properties detected';
    }
    if (uniqueProps.includes('psionic')) {
        return '🔮 Psychic properties detected';
    }
    if (uniqueProps.includes('ethereal')) {
        return '👻 Ethereal properties detected';
    }

    return '❓ Unknown reaction expected';
}
