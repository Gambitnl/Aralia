// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 13:48:54
 * Dependents: components/Crafting/IngredientGlossaryPanel.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/systems/crafting/ingredientGlossary.ts
 * Ingredient glossary - comprehensive data for all gatherable ingredients.
 */
import { GATHERABLE_RESOURCES, Biome } from './gatheringData';
import { HARVESTABLE_CREATURES, CreaturePart } from './creatureHarvestData';
import { ALL_RECIPES, CraftingRecipe } from './alchemyRecipes';

export interface IngredientEntry {
    id: string;
    name: string;
    source: 'flora' | 'creature' | 'purchased';
    description: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'unknown';
    locations: string[];
    harvestDC?: number;
    toolRequired?: string;
    usedInRecipes: string[];
    properties: string[];
    icon: string;
}

// Property icons mapping
const PROPERTY_ICONS: Record<string, string> = {
    curative: '💚',
    toxic: '☠️',
    reactive: '💥',
    psionic: '🔮',
    ethereal: '👻',
    luminous: '✨',
    inert: '⚪'
};

// Ingredient source icons
const SOURCE_ICONS: Record<string, string> = {
    flora: '🌿',
    creature: '🦴',
    purchased: '🪙'
};

/**
 * Builds the complete ingredient glossary from all data sources.
 */
export function buildIngredientGlossary(): IngredientEntry[] {
    const glossary: IngredientEntry[] = [];

    // Add flora ingredients
    for (const resource of GATHERABLE_RESOURCES) {
        const usedIn = findRecipesUsingIngredient(resource.id);

        glossary.push({
            id: resource.id,
            name: resource.name || resource.id,
            source: 'flora',
            description: resource.description || '',
            rarity: resource.rarity || 'common',
            locations: resource.locations,
            harvestDC: resource.harvestDC,
            toolRequired: 'Herbalism Kit',
            usedInRecipes: usedIn,
            properties: resource.properties || ['inert'],
            icon: getIngredientIcon(resource.id, 'flora')
        });
    }

    // Add creature parts
    for (const creature of HARVESTABLE_CREATURES) {
        for (const part of creature.parts) {
            const partId = (part as Partial<CreaturePart> & { itemId?: string }).itemId ?? part.name;
            const usedIn = findRecipesUsingIngredient(partId);

            glossary.push({
                id: partId,
                name: part.name,
                source: 'creature',
                description: `Harvested from ${creature.name}. ${part.description || ''}`.trim(),
                rarity: getCreaturePartRarity(creature),
                locations: creature.locations,
                harvestDC: part.harvestDC,
                toolRequired: (part as Partial<CreaturePart> & { toolRequired?: string }).toolRequired ?? 'Harvesting Tools',
                usedInRecipes: usedIn,
                properties: part.properties || ['inert'],
                icon: getIngredientIcon(partId, 'creature')
            });
        }
    }

    // Add generic purchased ingredients
    const purchasedIngredients = [
        { id: 'oil_flask', name: 'Flask of Oil', description: 'Basic oil for alchemical mixtures.', value: 1 },
        { id: 'ink', name: 'Ink', description: 'Standard writing ink.', value: 10 },
        { id: 'charcoal', name: 'Charcoal', description: 'Burnt wood, used in explosives.', value: 0.5 },
        { id: 'distilled_water', name: 'Distilled Water', description: 'Purified water base.', value: 1 },
        { id: 'empty_vial', name: 'Empty Vial', description: 'Glass container for potions.', value: 1 }
    ];

    for (const item of purchasedIngredients) {
        const usedIn = findRecipesUsingIngredient(item.id);

        glossary.push({
            id: item.id,
            name: item.name,
            source: 'purchased',
            description: item.description,
            rarity: 'common',
            locations: ['any_merchant'],
            usedInRecipes: usedIn,
            properties: ['inert'],
            icon: getIngredientIcon(item.id, 'purchased')
        });
    }

    return glossary;
}

/**
 * Creature rarity is only inferred from challenge rating when the data is present.
 * Missing CR stays visible as `unknown` so we do not silently pretend it is common.
 */
function getCreaturePartRarity(creature: { challengeRating?: number }): IngredientEntry['rarity'] {
    if (typeof creature.challengeRating !== 'number') {
        return 'unknown';
    }

    if (creature.challengeRating >= 10) return 'very_rare';
    if (creature.challengeRating >= 5) return 'rare';
    if (creature.challengeRating >= 2) return 'uncommon';
    return 'common';
}

/**
 * Finds all recipes that use a specific ingredient.
 */
export function findRecipesUsingIngredient(itemId: string): string[] {
    const recipes: string[] = [];

    for (const recipe of ALL_RECIPES) {
        if (recipe.ingredients.some(ing => ing.itemId === itemId)) {
            recipes.push(recipe.id);
        }
    }

    return recipes;
}

/**
 * Gets the icon for an ingredient based on its type.
 */
function getIngredientIcon(itemId: string, source: string): string {
    // Specific icons for certain ingredients
    const specificIcons: Record<string, string> = {
        'red_amanita': '🍄',
        'cats_tongue': '🌱',
        'nightshade': '🌑',
        'mandrake_root': '🌿',
        'ashblossom': '🔥',
        'gillyweed': '🌊',
        'oil_flask': '🛢️',
        'ink': '🖋️',
        'charcoal': '⬛',
        'ankheg_ichor': '💧',
        'wyvern_poison': '💀',
        'dragons_blood': '🩸',
        'ectoplasm': '👻'
    };

    if (specificIcons[itemId]) {
        return specificIcons[itemId];
    }

    return SOURCE_ICONS[source] || '📦';
}

/**
 * Searches the glossary by name, property, or location.
 */
export function searchGlossary(
    glossary: IngredientEntry[],
    query: string
): IngredientEntry[] {
    const lowerQuery = query.toLowerCase();

    return glossary.filter(entry =>
        entry.name.toLowerCase().includes(lowerQuery) ||
        entry.description.toLowerCase().includes(lowerQuery) ||
        entry.locations.some(loc => loc.toLowerCase().includes(lowerQuery)) ||
        entry.properties.some(prop => prop.toLowerCase().includes(lowerQuery))
    );
}

/**
 * Filters glossary by source type.
 */
export function filterBySource(
    glossary: IngredientEntry[],
    source: 'flora' | 'creature' | 'purchased' | 'all'
): IngredientEntry[] {
    if (source === 'all') return glossary;
    return glossary.filter(entry => entry.source === source);
}

/**
 * Filters glossary by rarity.
 */
export function filterByRarity(
    glossary: IngredientEntry[],
    rarity: string | 'all'
): IngredientEntry[] {
    if (rarity === 'all') return glossary;
    return glossary.filter(entry => entry.rarity === rarity);
}

/**
 * Filters glossary to show only ingredients the player is missing.
 */
export function filterMissing(
    glossary: IngredientEntry[],
    inventory: { id: string }[]
): IngredientEntry[] {
    const ownedIds = new Set(inventory.map(item => item.id));
    return glossary.filter(entry => !ownedIds.has(entry.id));
}

/**
 * Gets ingredient entries needed for a specific recipe.
 */
export function getIngredientsForRecipe(
    glossary: IngredientEntry[],
    recipe: CraftingRecipe
): (IngredientEntry | undefined)[] {
    return recipe.ingredients.map(ing =>
        glossary.find(entry => entry.id === ing.itemId)
    );
}

/**
 * Gets a formatted tooltip for an ingredient.
 */
export function getIngredientTooltip(entry: IngredientEntry): string {
    let tooltip = `${entry.icon} ${entry.name}\n`;
    tooltip += `━━━━━━━━━━━━━━━━\n`;
    tooltip += `${entry.description}\n\n`;
    tooltip += `Rarity: ${entry.rarity}\n`;
    tooltip += `Source: ${entry.source}\n`;

    if (entry.locations.length > 0) {
        tooltip += `Found in: ${entry.locations.slice(0, 3).join(', ')}\n`;
    }

    if (entry.harvestDC) {
        tooltip += `Harvest DC: ${entry.harvestDC}\n`;
    }

    if (entry.properties.length > 0 && entry.properties[0] !== 'inert') {
        tooltip += `Properties: ${entry.properties.map(p => PROPERTY_ICONS[p] || p).join(' ')}\n`;
    }

    if (entry.usedInRecipes.length > 0) {
        tooltip += `Used in ${entry.usedInRecipes.length} recipe${entry.usedInRecipes.length > 1 ? 's' : ''}`;
    }

    return tooltip;
}

/**
 * Groups ingredients by their primary property.
 */
export function groupByProperty(glossary: IngredientEntry[]): Record<string, IngredientEntry[]> {
    const groups: Record<string, IngredientEntry[]> = {};

    for (const entry of glossary) {
        const primaryProp = entry.properties[0] || 'inert';
        if (!groups[primaryProp]) {
            groups[primaryProp] = [];
        }
        groups[primaryProp].push(entry);
    }

    return groups;
}

/**
 * Gets biome-specific ingredients for a player's current location.
 */
export function getIngredientsForBiome(
    glossary: IngredientEntry[],
    biome: Biome
): IngredientEntry[] {
    return glossary.filter(entry =>
        entry.source === 'flora' && entry.locations.includes(biome)
    );
}
