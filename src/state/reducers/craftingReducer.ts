/**
 * @file src/state/reducers/craftingReducer.ts
 * Reducer for crafting-related actions.
 */
import { GameState } from '../../types/state';
import { AppAction } from '../actionTypes';
import { CraftingState, createInitialCraftingState } from '../../types/crafting';

// XP thresholds for each level
const LEVEL_XP_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000];

/**
 * Calculates the bonus modifier for a given level.
 */
function getBonusForLevel(level: number): number {
    if (level >= 10) return 5;
    if (level >= 9) return 4;
    if (level >= 7) return 3;
    if (level >= 5) return 2;
    if (level >= 3) return 1;
    return 0;
}

/**
 * Adds XP and handles level ups.
 */
function addXpToState(crafting: CraftingState, amount: number): CraftingState {
    let newXp = crafting.xp + amount;
    let newLevel = crafting.level;

    // Check for level up (max level 10)
    while (newLevel < 10 && newXp >= LEVEL_XP_THRESHOLDS[newLevel]) {
        newXp -= LEVEL_XP_THRESHOLDS[newLevel];
        newLevel++;
    }

    return {
        ...crafting,
        xp: newXp,
        level: newLevel,
        xpToNextLevel: newLevel < 10 ? LEVEL_XP_THRESHOLDS[newLevel] : 0,
        bonusModifier: getBonusForLevel(newLevel)
    };
}

export function craftingReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'INIT_CRAFTING_STATE': {
            // Only initialize if not already present
            if (state.crafting) return {};

            const crafting = createInitialCraftingState(action.payload.toolProficiencies);
            return { crafting };
        }

        case 'LEARN_RECIPE': {
            if (!state.crafting) return {};
            const { recipeId } = action.payload;

            // Already known?
            if (state.crafting.knownRecipes.includes(recipeId)) return {};

            const newKnownRecipes = [...state.crafting.knownRecipes, recipeId];
            const newStats = {
                ...state.crafting.stats,
                recipesDiscovered: state.crafting.stats.recipesDiscovered + 1
            };

            // Add discovery XP
            let newCrafting: CraftingState = {
                ...state.crafting,
                knownRecipes: newKnownRecipes,
                stats: newStats
            };
            newCrafting = addXpToState(newCrafting, 30); // Discovery XP

            return { crafting: newCrafting };
        }

        case 'ADD_CRAFTING_XP': {
            if (!state.crafting) return {};
            const { amount } = action.payload;

            const newCrafting = addXpToState(state.crafting, amount);
            return { crafting: newCrafting };
        }

        case 'UPDATE_CRAFTING_STATS': {
            if (!state.crafting) return {};
            const { quality, category, isNat20 } = action.payload;

            const newStats = { ...state.crafting.stats };
            newStats.totalCrafted++;

            if (quality === 'ruined') {
                newStats.failedCrafts++;
                newStats.ruinedMaterials++;
            } else {
                newStats.successfulCrafts++;
            }

            if (quality === 'masterwork') newStats.masterworkCrafts++;
            if (quality === 'legendary') newStats.legendaryRolls++;
            if (isNat20) newStats.nat20Count++;

            // Update category counts
            newStats.categoryCounts = { ...newStats.categoryCounts };
            newStats.categoryCounts[category] = (newStats.categoryCounts[category] || 0) + 1;

            return {
                crafting: { ...state.crafting, stats: newStats }
            };
        }

        case 'UNLOCK_ACHIEVEMENT': {
            if (!state.crafting) return {};
            const { achievementId } = action.payload;

            // Already unlocked?
            if (state.crafting.unlockedAchievements.includes(achievementId)) return {};

            return {
                crafting: {
                    ...state.crafting,
                    unlockedAchievements: [...state.crafting.unlockedAchievements, achievementId]
                }
            };
        }

        case 'SET_CRAFTING_LOCATION': {
            if (!state.crafting) return {};

            return {
                crafting: {
                    ...state.crafting,
                    currentLocation: action.payload.locationId
                }
            };
        }

        default:
            return {};
    }
}
