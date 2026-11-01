/**
 * @file src/systems/crafting/__tests__/ingredientGlossary.coverage.test.ts
 * Coverage pass (gap C14) for the glossary search, filter, and display
 * helpers. Search and filter helpers run on hand-built entries so each test
 * controls its corpus; findRecipesUsingIngredient runs on the real recipes.
 *
 * Deliberately NOT pinned: buildIngredientGlossary keys creature parts by
 * their display NAME (CreaturePart has `id`, not `itemId`), so creature entry
 * ids never match recipe ingredient ids. Reported as a suspected bug.
 */
import { describe, expect, it } from 'vitest';
import { ALL_RECIPES } from '../alchemyRecipes';
import type { CraftingRecipe } from '../alchemyRecipes';
import {
    filterByRarity,
    filterBySource,
    filterMissing,
    findRecipesUsingIngredient,
    getIngredientsForBiome,
    getIngredientsForRecipe,
    getIngredientTooltip,
    groupByProperty,
    searchGlossary
} from '../ingredientGlossary';
import type { IngredientEntry } from '../ingredientGlossary';

function entry(overrides: Partial<IngredientEntry> & Pick<IngredientEntry, 'id' | 'name' | 'source'>): IngredientEntry {
    return {
        description: '',
        rarity: 'common',
        locations: [],
        usedInRecipes: [],
        properties: ['inert'],
        icon: '📦',
        ...overrides
    };
}

const nightshade = entry({
    id: 'nightshade',
    name: 'Nightshade',
    source: 'flora',
    description: 'A deadly purple bloom.',
    rarity: 'uncommon',
    locations: ['Forest'],
    harvestDC: 20,
    properties: ['toxic', 'psionic'],
    usedInRecipes: ['basic_poison', 'truth_serum'],
    icon: '🌑'
});
const frostLichen = entry({
    id: 'frost_lichen',
    name: 'Frost Lichen',
    source: 'flora',
    rarity: 'uncommon',
    locations: ['Arctic', 'Mountain', 'Hill', 'Tundra'],
    properties: ['curative'],
    usedInRecipes: ['potion_of_resistance']
});
const venom = entry({
    id: 'serpents_venom',
    name: "Serpent's Venom",
    source: 'creature',
    description: 'Harvested from Giant Poisonous Snake.',
    rarity: 'unknown',
    locations: ['Forest', 'Swamp'],
    properties: ['toxic']
});
const oil = entry({
    id: 'oil_flask',
    name: 'Flask of Oil',
    source: 'purchased',
    description: 'Basic oil for alchemical mixtures.',
    locations: ['any_merchant'],
    properties: []
});
const corpus = [nightshade, frostLichen, venom, oil];

describe('findRecipesUsingIngredient', () => {
    it('returns exactly the recipes whose ingredients include the item', () => {
        const result = findRecipesUsingIngredient('oil_flask');
        const expected = ALL_RECIPES.filter(r => r.ingredients.some(i => i.itemId === 'oil_flask')).map(r => r.id);
        expect(result).toEqual(expected);
        expect(result).toContain('alchemists_fire');
    });

    it('returns an empty list for an unused item', () => {
        expect(findRecipesUsingIngredient('not_an_ingredient')).toEqual([]);
    });
});

describe('searchGlossary', () => {
    it('matches by name case-insensitively', () => {
        expect(searchGlossary(corpus, 'NIGHT').map(e => e.id)).toEqual(['nightshade']);
    });

    it('matches by description, location, and property', () => {
        expect(searchGlossary(corpus, 'alchemical').map(e => e.id)).toEqual(['oil_flask']);
        expect(searchGlossary(corpus, 'arctic').map(e => e.id)).toEqual(['frost_lichen']);
        expect(searchGlossary(corpus, 'toxic').map(e => e.id)).toEqual(['nightshade', 'serpents_venom']);
    });

    it('returns everything for an empty query and nothing for a miss', () => {
        expect(searchGlossary(corpus, '')).toEqual(corpus);
        expect(searchGlossary(corpus, 'zzz')).toEqual([]);
    });
});

describe('filterBySource', () => {
    it('returns only entries with the source, or all for "all"', () => {
        expect(filterBySource(corpus, 'flora').map(e => e.id)).toEqual(['nightshade', 'frost_lichen']);
        expect(filterBySource(corpus, 'creature').map(e => e.id)).toEqual(['serpents_venom']);
        expect(filterBySource(corpus, 'purchased').map(e => e.id)).toEqual(['oil_flask']);
        expect(filterBySource(corpus, 'all')).toBe(corpus);
        expect(filterBySource([], 'flora')).toEqual([]);
    });
});

describe('filterByRarity', () => {
    it('returns only entries with the rarity, or all for "all"', () => {
        expect(filterByRarity(corpus, 'uncommon').map(e => e.id)).toEqual(['nightshade', 'frost_lichen']);
        expect(filterByRarity(corpus, 'unknown').map(e => e.id)).toEqual(['serpents_venom']);
        expect(filterByRarity(corpus, 'very_rare')).toEqual([]);
        expect(filterByRarity(corpus, 'all')).toBe(corpus);
    });
});

describe('filterMissing', () => {
    it('drops entries whose id is in the inventory', () => {
        expect(filterMissing(corpus, [{ id: 'nightshade' }, { id: 'oil_flask' }]).map(e => e.id)).toEqual(['frost_lichen', 'serpents_venom']);
        expect(filterMissing(corpus, [])).toEqual(corpus);
    });
});

describe('getIngredientsForRecipe', () => {
    it('maps each recipe ingredient to its entry, keeping undefined for gaps in order', () => {
        const recipe: CraftingRecipe = {
            id: 'glossary_coverage_oil',
            name: 'Glossary Coverage Oil',
            description: 'Fixture.',
            rarity: 'common',
            craftingDC: 10,
            craftingDays: 1,
            goldCost: 1,
            ingredients: [
                { itemId: 'oil_flask', quantity: 1 },
                { itemId: 'missing_reagent', quantity: 1 },
                { itemId: 'nightshade', quantity: 2 }
            ],
            outputItemId: 'glossary_coverage_oil',
            outputQuantity: 1,
            toolRequired: 'poisoners_kit',
            category: 'oil'
        };
        expect(getIngredientsForRecipe(corpus, recipe)).toEqual([oil, undefined, nightshade]);
    });
});

describe('getIngredientTooltip', () => {
    it('includes rarity, source, harvest DC, property icons, and plural recipe count', () => {
        const tooltip = getIngredientTooltip(nightshade);
        expect(tooltip.startsWith('🌑 Nightshade\n')).toBe(true);
        expect(tooltip).toContain('A deadly purple bloom.');
        expect(tooltip).toContain('Rarity: uncommon');
        expect(tooltip).toContain('Source: flora');
        expect(tooltip).toContain('Found in: Forest\n');
        expect(tooltip).toContain('Harvest DC: 20');
        expect(tooltip).toContain('Properties: ☠️ 🔮');
        expect(tooltip).toContain('Used in 2 recipes');
    });

    it('lists only the first three locations and uses the singular for one recipe', () => {
        const tooltip = getIngredientTooltip(frostLichen);
        expect(tooltip).toContain('Found in: Arctic, Mountain, Hill\n');
        expect(tooltip).not.toContain('Tundra');
        expect(tooltip).toContain('Used in 1 recipe');
        expect(tooltip).not.toContain('1 recipes');
    });

    it('omits the harvest DC, inert properties, and recipe line when absent', () => {
        const tooltip = getIngredientTooltip(entry({ id: 'x', name: 'Plain', source: 'purchased', locations: [] }));
        expect(tooltip).not.toContain('Harvest DC');
        expect(tooltip).not.toContain('Properties');
        expect(tooltip).not.toContain('Used in');
        expect(tooltip).not.toContain('Found in');
    });

    it('falls back to the raw property name when it has no icon', () => {
        const tooltip = getIngredientTooltip(entry({ id: 'y', name: 'Odd', source: 'flora', properties: ['sticky'] }));
        expect(tooltip).toContain('Properties: sticky');
    });
});

describe('groupByProperty', () => {
    it('groups by the first property and puts entries with none under inert', () => {
        const groups = groupByProperty(corpus);
        expect(Object.keys(groups).sort()).toEqual(['curative', 'inert', 'toxic']);
        expect(groups.toxic.map(e => e.id)).toEqual(['nightshade', 'serpents_venom']);
        expect(groups.curative.map(e => e.id)).toEqual(['frost_lichen']);
        expect(groups.inert.map(e => e.id)).toEqual(['oil_flask']);
        expect(groupByProperty([])).toEqual({});
    });
});

describe('getIngredientsForBiome', () => {
    it('returns only flora entries found in the biome', () => {
        // The venom also lists Forest but is a creature part, so it is excluded.
        expect(getIngredientsForBiome(corpus, 'Forest').map(e => e.id)).toEqual(['nightshade']);
        expect(getIngredientsForBiome(corpus, 'Arctic').map(e => e.id)).toEqual(['frost_lichen']);
        expect(getIngredientsForBiome(corpus, 'Desert')).toEqual([]);
    });
});
