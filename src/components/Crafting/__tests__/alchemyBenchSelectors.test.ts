import { describe, expect, it } from 'vitest';
import type { PlayerCharacter } from '../../../types';
import type { CraftingRecipe } from '../../../systems/crafting/alchemyRecipes';
import type { RecipeCraftability } from '../../../systems/crafting/craftingEngine';
import { checkRecipeCraftability } from '../../../systems/crafting/craftingEngine';
import { createInitialCraftingState, type CraftingState } from '../../../types/crafting';
import { CRAFTING_LOCATIONS } from '../../../systems/crafting/craftingLocations';
import { getRecipeById } from '../../../systems/crafting/alchemyRecipes';
import {
    buildAlchemyBenchDerivedState,
    collectPartyToolProficiencies,
    resolveAlchemyBenchCraftingState,
    selectDisplayedAlchemyRecipes
} from '../alchemyBenchSelectors';

/**
 * These tests protect the alchemy bench selector boundary.
 *
 * The bench panel still owns rendering and player actions, but the recipe list,
 * location filter, live crafting-state fallback, and batch preview are now built
 * in a pure helper so future modularization can change the shell without pruning
 * recipes or changing batch math.
 */

const makeCharacter = (overrides: Partial<PlayerCharacter> = {}): PlayerCharacter => ({
    id: 'bench-lead',
    name: 'Bench Lead',
    level: 5,
    proficiencyBonus: 3,
    abilityScores: {
        Strength: 10,
        Dexterity: 12,
        Constitution: 12,
        Intelligence: 16,
        Wisdom: 12,
        Charisma: 8,
    },
    finalAbilityScores: {
        Strength: 10,
        Dexterity: 12,
        Constitution: 12,
        Intelligence: 16,
        Wisdom: 12,
        Charisma: 8,
    },
    skills: [{ id: 'nature', name: 'Nature', ability: 'Intelligence' }],
    featChoices: {
        herbalist: {
            selectedTools: ['Herbalism Kit'],
        },
    },
    race: { id: 'human', name: 'Human', description: '', traits: [] },
    class: {
        id: 'wizard',
        name: 'Wizard',
        description: '',
        hitDie: 6,
        primaryAbility: ['Intelligence'],
        savingThrowProficiencies: [],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 0,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
    },
    statusEffects: [],
    hp: 10,
    maxHp: 10,
    armorClass: 10,
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot',
    equippedItems: {},
    ...overrides,
});

const makeCraftability = (
    recipe: CraftingRecipe,
    canCraft: boolean
): RecipeCraftability => ({
    recipe,
    canCraft,
    hasAllIngredients: canCraft,
    hasEnoughGold: canCraft,
    hasTool: true,
    isKnown: true,
    ingredientStatuses: [],
    missingGold: 0
});

describe('alchemyBenchSelectors', () => {
    it('reuses the starter crafting state from the live party tool proficiencies', () => {
        const party = [
            makeCharacter(),
            makeCharacter({
                id: 'bench-support',
                name: 'Bench Support',
                featChoices: {
                    poisoner: {
                        selectedTools: ["Poisoner's Kit"],
                    },
                },
            }),
        ];

        const proficiencies = collectPartyToolProficiencies(party);
        const resolvedState = resolveAlchemyBenchCraftingState(undefined, proficiencies);

        expect(proficiencies).toEqual(['Herbalism Kit', "Poisoner's Kit"]);
        expect(resolvedState.toolProficiencies).toEqual(['Herbalism Kit', "Poisoner's Kit"]);
        expect(resolvedState.knownRecipes).toEqual(
            expect.arrayContaining(['antitoxin', 'basic_poison'])
        );
        expect(resolvedState.currentLocation).toBe('workshop');
    });

    it('keeps only craftable recipes that still fit the current location cap', () => {
        const allowedRecipe = makeCraftability(
            {
                id: 'allowed_recipe',
                name: 'Allowed Recipe',
                description: '',
                rarity: 'common',
                craftingDC: 10,
                craftingDays: 1,
                goldCost: 1,
                ingredients: [],
                outputItemId: 'allowed_recipe',
                outputQuantity: 1,
                toolRequired: 'alchemist_supplies',
                category: 'potion'
            },
            true
        );
        const tooRareRecipe = makeCraftability(
            {
                id: 'too_rare_recipe',
                name: 'Too Rare Recipe',
                description: '',
                rarity: 'rare',
                craftingDC: 20,
                craftingDays: 10,
                goldCost: 1,
                ingredients: [],
                outputItemId: 'too_rare_recipe',
                outputQuantity: 1,
                toolRequired: 'alchemist_supplies',
                category: 'utility'
            },
            true
        );
        const lockedRecipe = makeCraftability(
            {
                id: 'locked_recipe',
                name: 'Locked Recipe',
                description: '',
                rarity: 'common',
                craftingDC: 10,
                craftingDays: 1,
                goldCost: 1,
                ingredients: [],
                outputItemId: 'locked_recipe',
                outputQuantity: 1,
                toolRequired: 'alchemist_supplies',
                category: 'potion'
            },
            false
        );

        const displayed = selectDisplayedAlchemyRecipes(
            [allowedRecipe, tooRareRecipe, lockedRecipe],
            true,
            CRAFTING_LOCATIONS.field
        );

        expect(displayed.map(recipe => recipe.recipe.id)).toEqual(['allowed_recipe']);
    });

    it('builds a bench view model that keeps the quantity-aware batch preview and current modifier', () => {
        const recipe = getRecipeById('antitoxin');
        expect(recipe).toBeDefined();

        const antitoxin = recipe as CraftingRecipe;
        const party = [
            makeCharacter({
                featChoices: {
                    herbalist: {
                        selectedTools: ['Herbalism Kit'],
                    },
                },
            }),
        ];
        const partyToolProficiencies = collectPartyToolProficiencies(party);
        const craftingState: CraftingState = {
            ...createInitialCraftingState(['Herbalism Kit']),
            knownRecipes: ['antitoxin'],
            bonusModifier: 1
        };
        const inventory = [
            {
                id: 'rowan_berry',
                name: 'Rowan Berry',
                description: 'Stacked row used to prove quantity-aware batch previews.',
                quantity: 4,
                type: 'consumable'
            }
        ];
        const selectedRecipe = checkRecipeCraftability(
            antitoxin,
            inventory,
            100,
            partyToolProficiencies,
            new Set(craftingState.knownRecipes)
        );

        const derived = buildAlchemyBenchDerivedState({
            inventory,
            gold: 100,
            party,
            partyToolProficiencies,
            craftingState,
            selectedTool: 'herbalism_kit',
            selectedRecipe,
            selectedLocation: 'workshop',
            filterCraftable: true,
            showUnknown: false
        });

        expect(derived.knownRecipesSet.has('antitoxin')).toBe(true);
        expect(derived.allRecipes.map(entry => entry.recipe.id)).toEqual(['antitoxin']);
        expect(derived.displayedRecipes.map(entry => entry.recipe.id)).toEqual(['antitoxin']);
        expect(derived.summary).toMatchObject({
            known: 1,
            craftable: 1
        });
        expect(derived.summary.total).toBeGreaterThan(1);
        expect(derived.batchInfo?.maxCraftable).toBe(2);
        expect(derived.crafterModifier).toBe(7);
        expect(derived.currentLocation.id).toBe('workshop');
    });
});
