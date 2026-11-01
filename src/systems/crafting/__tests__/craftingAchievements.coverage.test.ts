/**
 * @file src/systems/crafting/__tests__/craftingAchievements.coverage.test.ts
 * Coverage pass (gap C14) for crafting achievements.
 *
 * Deliberately NOT pinned (reported as suspected bugs):
 * - getTotalXPBonus counts first_brew's flat "+25 bonus XP" as a 25% bonus.
 * - getTotalDCModifier adds scoped rewards ("-1 DC on explosives",
 *   "+2 to Nat 20 crafting effects", ...) into the global DC modifier.
 * - getAchievementProgress reports totalCrafted for the explosion achievement
 *   and 0% for level, recipe_count, category_count and nat20 achievements,
 *   even when checkAchievementRequirement says they are met.
 */
import { describe, expect, it } from 'vitest';
import { addCraftingXP, createCrafterProgression } from '../crafterProgression';
import type { CrafterProgression } from '../crafterProgression';
import {
    checkAchievementRequirement,
    checkNewAchievements,
    createExtendedStats,
    CRAFTING_ACHIEVEMENTS,
    getAchievementProgress,
    getTotalDCModifier,
    getTotalXPBonus,
    updateStatsAfterCraft
} from '../craftingAchievements';
import type { CraftingAchievement, ExtendedCraftingStats } from '../craftingAchievements';

function achievement(id: string): CraftingAchievement {
    const found = CRAFTING_ACHIEVEMENTS.find(a => a.id === id);
    if (!found) throw new Error(`fixture achievement ${id} missing`);
    return found;
}

function stats(overrides: Partial<ExtendedCraftingStats> = {}): ExtendedCraftingStats {
    return { ...createExtendedStats(), ...overrides };
}

const fresh: CrafterProgression = createCrafterProgression();

describe('createExtendedStats', () => {
    it('starts every counter at zero with no category counts', () => {
        expect(createExtendedStats()).toEqual({
            totalCrafted: 0,
            successfulCrafts: 0,
            failedCrafts: 0,
            masterworkCrafts: 0,
            legendaryRolls: 0,
            ruinedMaterials: 0,
            nat20Count: 0,
            explosionsSurvived: 0,
            recipesDiscovered: 0,
            categoryCounts: {}
        });
    });

    it('returns a fresh object each call', () => {
        const a = createExtendedStats();
        a.categoryCounts.potion = 3;
        expect(createExtendedStats().categoryCounts).toEqual({});
    });
});

describe('checkAchievementRequirement', () => {
    it('craft_count: met exactly at the threshold', () => {
        expect(checkAchievementRequirement(achievement('apprentice'), fresh, stats({ totalCrafted: 9 }))).toBe(false);
        expect(checkAchievementRequirement(achievement('apprentice'), fresh, stats({ totalCrafted: 10 }))).toBe(true);
    });

    it('craft_count with explosion subtype reads explosionsSurvived, not totalCrafted', () => {
        const survivor = achievement('survivor');
        expect(checkAchievementRequirement(survivor, fresh, stats({ totalCrafted: 500 }))).toBe(false);
        expect(checkAchievementRequirement(survivor, fresh, stats({ explosionsSurvived: 10 }))).toBe(true);
    });

    it('quality_count reads the counter named by the subtype', () => {
        expect(checkAchievementRequirement(achievement('quality_control'), fresh, stats({ masterworkCrafts: 10 }))).toBe(true);
        expect(checkAchievementRequirement(achievement('quality_control'), fresh, stats({ legendaryRolls: 10 }))).toBe(false);
        expect(checkAchievementRequirement(achievement('legendary_touch'), fresh, stats({ legendaryRolls: 5 }))).toBe(true);
        expect(checkAchievementRequirement(achievement('lucky'), fresh, stats({ nat20Count: 2 }))).toBe(false);
        expect(checkAchievementRequirement(achievement('lucky'), fresh, stats({ nat20Count: 3 }))).toBe(true);
    });

    it('quality_count with an unknown subtype is never met', () => {
        const odd: CraftingAchievement = {
            ...achievement('quality_control'),
            requirement: { type: 'quality_count', value: 0, subtype: 'flawed' }
        };
        expect(checkAchievementRequirement(odd, fresh, stats())).toBe(false);
    });

    it('level reads the progression level', () => {
        const grandmaster = achievement('grandmaster');
        expect(checkAchievementRequirement(grandmaster, fresh, stats())).toBe(false);
        expect(checkAchievementRequirement(grandmaster, { ...fresh, level: 10 }, stats())).toBe(true);
    });

    it('recipe_count reads the number of known recipes', () => {
        const collector = achievement('recipe_collector');
        const nineteen = new Set(Array.from({ length: 19 }, (_, i) => `r${i}`));
        expect(checkAchievementRequirement(collector, { ...fresh, knownRecipes: nineteen }, stats())).toBe(false);
        nineteen.add('r19');
        expect(checkAchievementRequirement(collector, { ...fresh, knownRecipes: nineteen }, stats())).toBe(true);
    });

    it('discovery reads recipesDiscovered', () => {
        expect(checkAchievementRequirement(achievement('curious_mind'), fresh, stats())).toBe(false);
        expect(checkAchievementRequirement(achievement('curious_mind'), fresh, stats({ recipesDiscovered: 1 }))).toBe(true);
    });

    it('category_count reads the count for the subtype category only', () => {
        const healer = achievement('healer');
        expect(checkAchievementRequirement(healer, fresh, stats({ categoryCounts: { poison: 99 } }))).toBe(false);
        expect(checkAchievementRequirement(healer, fresh, stats({ categoryCounts: { potion: 25 } }))).toBe(true);
    });
});

describe('checkNewAchievements', () => {
    it('unlocks nothing for a fresh crafter', () => {
        expect(checkNewAchievements(fresh, createExtendedStats(), new Set())).toEqual([]);
    });

    it('returns every newly met achievement and skips ones already unlocked', () => {
        const s = stats({ totalCrafted: 10, recipesDiscovered: 1 });
        expect(checkNewAchievements(fresh, s, new Set()).map(a => a.id)).toEqual(['first_brew', 'apprentice', 'curious_mind']);
        expect(checkNewAchievements(fresh, s, new Set(['first_brew'])).map(a => a.id)).toEqual(['apprentice', 'curious_mind']);
    });

    it('unlocks the level achievement after enough XP', () => {
        const maxed = addCraftingXP(fresh, 1_000_000);
        expect(checkNewAchievements(maxed, createExtendedStats(), new Set()).map(a => a.id)).toEqual(['grandmaster']);
    });
});

describe('getTotalDCModifier', () => {
    it('is 0 with nothing unlocked or only non-DC rewards unlocked', () => {
        expect(getTotalDCModifier(new Set())).toBe(0);
        expect(getTotalDCModifier(new Set(['first_brew', 'grandmaster', 'recipe_collector']))).toBe(0);
    });

    it('sums the global DC rewards', () => {
        expect(getTotalDCModifier(new Set(['journeyman']))).toBe(-1);
        expect(getTotalDCModifier(new Set(['journeyman', 'master_crafter']))).toBe(-3);
    });
});

describe('getTotalXPBonus', () => {
    it('is 0 with nothing unlocked', () => {
        expect(getTotalXPBonus(new Set())).toBe(0);
    });

    it('sums percentage XP rewards', () => {
        expect(getTotalXPBonus(new Set(['apprentice', 'perfectionist', 'lucky']))).toBe(35);
    });

    it('leaves out flat XP rewards of 50 or more and non-XP rewards', () => {
        expect(getTotalXPBonus(new Set(['curious_mind', 'journeyman', 'grandmaster']))).toBe(0);
    });
});

describe('getAchievementProgress', () => {
    it('reports craft count progress and caps at 100', () => {
        const apprentice = achievement('apprentice');
        expect(getAchievementProgress(apprentice, fresh, stats({ totalCrafted: 0 }))).toBe(0);
        expect(getAchievementProgress(apprentice, fresh, stats({ totalCrafted: 5 }))).toBe(50);
        expect(getAchievementProgress(apprentice, fresh, stats({ totalCrafted: 40 }))).toBe(100);
    });

    it('reports masterwork, legendary, and discovery progress', () => {
        expect(getAchievementProgress(achievement('perfectionist'), fresh, stats({ masterworkCrafts: 5 }))).toBe(20);
        expect(getAchievementProgress(achievement('legendary_touch'), fresh, stats({ legendaryRolls: 1 }))).toBe(20);
        expect(getAchievementProgress(achievement('mad_scientist'), fresh, stats({ recipesDiscovered: 3 }))).toBe(30);
    });
});

describe('updateStatsAfterCraft', () => {
    it('counts a standard craft as a success in its category', () => {
        const result = updateStatsAfterCraft(createExtendedStats(), 'standard', 'potion', false);
        expect(result.totalCrafted).toBe(1);
        expect(result.successfulCrafts).toBe(1);
        expect(result.failedCrafts).toBe(0);
        expect(result.categoryCounts).toEqual({ potion: 1 });
    });

    it('counts ruined crafts as failures with ruined materials', () => {
        const result = updateStatsAfterCraft(createExtendedStats(), 'ruined', 'bomb', false);
        expect(result.failedCrafts).toBe(1);
        expect(result.ruinedMaterials).toBe(1);
        expect(result.successfulCrafts).toBe(0);
        expect(result.categoryCounts).toEqual({ bomb: 1 });
    });

    it('counts flawed crafts as successes', () => {
        const result = updateStatsAfterCraft(createExtendedStats(), 'flawed', 'oil', false);
        expect(result.successfulCrafts).toBe(1);
        expect(result.failedCrafts).toBe(0);
    });

    it('tracks masterwork, legendary, and natural 20 counters', () => {
        let s = updateStatsAfterCraft(createExtendedStats(), 'masterwork', 'potion', false);
        s = updateStatsAfterCraft(s, 'legendary', 'potion', true);
        expect(s.masterworkCrafts).toBe(1);
        expect(s.legendaryRolls).toBe(1);
        expect(s.nat20Count).toBe(1);
        expect(s.categoryCounts).toEqual({ potion: 2 });
    });

    it('does not mutate the input stats or its category map', () => {
        const start = stats({ categoryCounts: { potion: 4 } });
        const result = updateStatsAfterCraft(start, 'standard', 'potion', false);
        expect(result.categoryCounts.potion).toBe(5);
        expect(start.categoryCounts.potion).toBe(4);
        expect(start.totalCrafted).toBe(0);
    });
});
