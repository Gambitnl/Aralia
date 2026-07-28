import { describe, expect, it } from 'vitest';
import type { PlayerCharacter, Item } from '../../../types';
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

// ============================================================================
// Test Fixtures
// ============================================================================
// These compact characters and recipes keep each selector assertion focused on
// the bench contract rather than the much larger game-state factory.
// ============================================================================

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

// ============================================================================
// Selector Contracts
// ============================================================================
// These tests preserve fallback, legacy-save, recipe-filter, and derived-view
// behavior independently from the panel's rendering details.
// ============================================================================

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

    it('backfills a partial legacy state without losing saved progress or mutating the save', () => {
        // This shape mirrors an older save that contains real player progress but
        // predates several current top-level fields and nested statistic counters.
        const partialLegacyState = {
            level: 4,
            xp: 45,
            bonusModifier: 3,
            knownRecipes: ['antitoxin'],
            toolProficiencies: ['Herbalism Kit'],
            stats: {
                totalCrafted: 37,
                categoryCounts: { potion: 19 }
            },
            unlockedAchievements: ['first-brew'],
            currentLocation: 'field'
        } as unknown as CraftingState;
        const savedSnapshot = structuredClone(partialLegacyState);

        const resolvedState = resolveAlchemyBenchCraftingState(
            partialLegacyState,
            ["Poisoner's Kit"]
        );

        expect(resolvedState).toMatchObject({
            level: 4,
            xp: 45,
            xpToNextLevel: 100,
            bonusModifier: 3,
            knownRecipes: ['antitoxin'],
            toolProficiencies: ['Herbalism Kit'],
            unlockedAchievements: ['first-brew'],
            currentLocation: 'field'
        });
        expect(resolvedState.stats).toEqual({
            totalCrafted: 37,
            successfulCrafts: 0,
            failedCrafts: 0,
            masterworkCrafts: 0,
            legendaryRolls: 0,
            ruinedMaterials: 0,
            nat20Count: 0,
            explosionsSurvived: 0,
            recipesDiscovered: 0,
            categoryCounts: { potion: 19 }
        });

        // The bench receives its own collections, so later UI work cannot alter
        // the object retained by the save/load boundary.
        expect(resolvedState).not.toBe(partialLegacyState);
        expect(resolvedState.knownRecipes).not.toBe(partialLegacyState.knownRecipes);
        expect(resolvedState.stats).not.toBe(partialLegacyState.stats);
        expect(resolvedState.stats.categoryCounts).not.toBe(
            partialLegacyState.stats.categoryCounts
        );
        expect(partialLegacyState).toEqual(savedSnapshot);
    });

    it('keeps a complete current state unchanged in value while isolating its collections', () => {
        const currentState = createInitialCraftingState(['Herbalism Kit']);
        const resolvedState = resolveAlchemyBenchCraftingState(
            currentState,
            ["Poisoner's Kit"]
        );

        expect(resolvedState).toEqual(currentState);
        expect(resolvedState).not.toBe(currentState);
        expect(resolvedState.knownRecipes).not.toBe(currentState.knownRecipes);
        expect(resolvedState.toolProficiencies).not.toBe(currentState.toolProficiencies);
        expect(resolvedState.unlockedAchievements).not.toBe(
            currentState.unlockedAchievements
        );
        expect(resolvedState.stats).not.toBe(currentState.stats);
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
                id: 'rowan-berry',
                name: 'Rowan Berry',
                description: 'Stacked row used to prove quantity-aware batch previews.',
                quantity: 4,
                type: 'consumable'
            }
        ] as unknown as Item[];
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
