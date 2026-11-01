/**
 * @file src/systems/crafting/__tests__/crafterProgression.coverage.test.ts
 * Coverage pass (gap C14) for the crafter progression helpers: level
 * thresholds, bonus tiers, XP carry-over, quality bands, research cost, and
 * the save round-trip.
 *
 * Deliberately NOT pinned here: starting recipes for display-form tool names
 * such as "Alchemist's Supplies". The normalizer turns the apostrophe AND the
 * space into underscores ("alchemist__supplies"), which matches no starting
 * recipe key. That looks like a bug, so it is reported instead of tested.
 */
import { describe, expect, it } from 'vitest';
import {
    addCraftingXP,
    createCrafterProgression,
    determineCraftingQuality,
    deserializeProgression,
    getBonusForLevel,
    getResearchCost,
    getXpForLevel,
    learnRecipe,
    serializeProgression,
    XP_REWARDS
} from '../crafterProgression';
import { getResearchCost as getRecipeResearchCost } from '../alchemyRecipes';

describe('createCrafterProgression', () => {
    it('starts at level 1 with zero XP, zero bonus, and empty stats', () => {
        const progression = createCrafterProgression();

        expect(progression.level).toBe(1);
        expect(progression.xp).toBe(0);
        expect(progression.xpToNextLevel).toBe(100);
        expect(progression.bonusModifier).toBe(0);
        expect(progression.knownRecipes.size).toBe(0);
        expect(progression.toolProficiencies.size).toBe(0);
        expect(progression.stats).toEqual({
            totalCrafted: 0,
            successfulCrafts: 0,
            failedCrafts: 0,
            masterworkCrafts: 0,
            legendaryRolls: 0,
            ruinedMaterials: 0
        });
    });

    it('grants the three starting recipes for a tool given by id or by a space-separated name', () => {
        const byId = createCrafterProgression(['alchemist_supplies']);
        expect([...byId.knownRecipes].sort()).toEqual(['alchemists_fire', 'smokebomb', 'vial_of_acid']);

        const byName = createCrafterProgression(['Herbalism Kit']);
        expect([...byName.knownRecipes].sort()).toEqual(['antitoxin', 'healing_salve', 'potion_of_climbing']);
        // The raw proficiency string is kept as given.
        expect(byName.toolProficiencies.has('Herbalism Kit')).toBe(true);
    });

    it('merges starting recipes across several tools and ignores unknown tools', () => {
        const progression = createCrafterProgression(['herbalism_kit', 'poisoners_kit', 'lute']);
        expect(progression.knownRecipes.size).toBe(6);
        expect(progression.knownRecipes.has('truth_serum')).toBe(true);
        expect(progression.toolProficiencies.size).toBe(3);
    });
});

describe('getXpForLevel', () => {
    it('returns the threshold for each level and clamps above level 10', () => {
        expect(getXpForLevel(1)).toBe(0);
        expect(getXpForLevel(2)).toBe(100);
        expect(getXpForLevel(5)).toBe(1000);
        expect(getXpForLevel(10)).toBe(12000);
        expect(getXpForLevel(11)).toBe(12000);
        expect(getXpForLevel(99)).toBe(12000);
    });
});

describe('getBonusForLevel', () => {
    it('steps up only at levels 3, 5, 7, 9 and 10', () => {
        const bonuses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(getBonusForLevel);
        expect(bonuses).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 5]);
    });

    it('caps at +5 above level 10 and gives 0 below level 1', () => {
        expect(getBonusForLevel(15)).toBe(5);
        expect(getBonusForLevel(0)).toBe(0);
    });
});

describe('addCraftingXP', () => {
    it('stays at level 1 one XP short of the threshold', () => {
        const result = addCraftingXP(createCrafterProgression(), 99);
        expect(result.level).toBe(1);
        expect(result.xp).toBe(99);
        expect(result.xpToNextLevel).toBe(100);
    });

    it('levels up exactly at the threshold and carries the remainder', () => {
        const exact = addCraftingXP(createCrafterProgression(), 100);
        expect(exact.level).toBe(2);
        expect(exact.xp).toBe(0);
        expect(exact.xpToNextLevel).toBe(250);

        const over = addCraftingXP(createCrafterProgression(), 130);
        expect(over.level).toBe(2);
        expect(over.xp).toBe(30);
    });

    it('applies several level-ups in one award and updates the bonus', () => {
        // 100 (to L2) + 250 (to L3) = 350, plus 10 left over.
        const result = addCraftingXP(createCrafterProgression(), 360);
        expect(result.level).toBe(3);
        expect(result.xp).toBe(10);
        expect(result.bonusModifier).toBe(1);
    });

    it('stops at level 10 with xpToNextLevel 0 and keeps the excess XP', () => {
        const total = 100 + 250 + 500 + 1000 + 2000 + 3500 + 5500 + 8000 + 12000;
        const result = addCraftingXP(createCrafterProgression(), total + 42);
        expect(result.level).toBe(10);
        expect(result.xpToNextLevel).toBe(0);
        expect(result.bonusModifier).toBe(5);
        expect(result.xp).toBe(42);
    });

    it('does not mutate the input progression', () => {
        const start = createCrafterProgression();
        addCraftingXP(start, 500);
        expect(start.level).toBe(1);
        expect(start.xp).toBe(0);
    });
});

describe('determineCraftingQuality', () => {
    it('treats a natural 20 as legendary even when the total misses the DC', () => {
        const result = determineCraftingQuality(5, 25, true, false);
        expect(result.quality).toBe('legendary');
        expect(result.quantityMultiplier).toBe(2);
    });

    it('treats a natural 1 as ruined even when the total beats the DC', () => {
        const result = determineCraftingQuality(30, 10, false, true);
        expect(result.quality).toBe('ruined');
        expect(result.quantityMultiplier).toBe(0);
    });

    it('maps roll minus DC onto the quality bands at each boundary', () => {
        const dc = 15;
        expect(determineCraftingQuality(dc - 6, dc, false, false).quality).toBe('ruined');
        expect(determineCraftingQuality(dc - 5, dc, false, false).quality).toBe('flawed');
        expect(determineCraftingQuality(dc - 1, dc, false, false).quality).toBe('flawed');
        expect(determineCraftingQuality(dc, dc, false, false).quality).toBe('standard');
        expect(determineCraftingQuality(dc + 4, dc, false, false).quality).toBe('standard');
        expect(determineCraftingQuality(dc + 5, dc, false, false).quality).toBe('masterwork');
    });

    it('gives flawed results half effect but full quantity', () => {
        const result = determineCraftingQuality(12, 15, false, false);
        expect(result.effectMultiplier).toBe(0.5);
        expect(result.durationMultiplier).toBe(0.5);
        expect(result.quantityMultiplier).toBe(1);
    });
});

describe('learnRecipe', () => {
    it('adds a new recipe and grants discovery XP', () => {
        const result = learnRecipe(createCrafterProgression(), 'potion_of_healing');
        expect(result.knownRecipes.has('potion_of_healing')).toBe(true);
        expect(result.xp).toBe(XP_REWARDS.discovery);
    });

    it('returns the same object when the recipe is already known', () => {
        const start = createCrafterProgression(['herbalism_kit']);
        expect(learnRecipe(start, 'antitoxin')).toBe(start);
    });
});

describe('getResearchCost', () => {
    it('returns the cost table for each rarity and a fallback for unknown rarity', () => {
        expect(getResearchCost('common')).toEqual({ gold: 50, days: 1 });
        expect(getResearchCost('uncommon')).toEqual({ gold: 250, days: 5 });
        expect(getResearchCost('rare')).toEqual({ gold: 500, days: 10 });
        expect(getResearchCost('very_rare')).toEqual({ gold: 1000, days: 30 });
        expect(getResearchCost('legendary')).toEqual({ gold: 100, days: 3 });
    });

    it('agrees with the duplicate getResearchCost in alchemyRecipes for every rarity', () => {
        for (const rarity of ['common', 'uncommon', 'rare', 'very_rare', 'mythic', '']) {
            expect(getResearchCost(rarity)).toEqual(getRecipeResearchCost(rarity));
        }
    });
});

describe('serializeProgression / deserializeProgression', () => {
    it('turns sets into arrays and restores them on the round trip', () => {
        let progression = createCrafterProgression(['herbalism_kit']);
        progression = addCraftingXP(progression, 400);
        progression = { ...progression, stats: { ...progression.stats, totalCrafted: 7, masterworkCrafts: 2 } };

        const serialized = serializeProgression(progression) as { knownRecipes: unknown; toolProficiencies: unknown };
        expect(Array.isArray(serialized.knownRecipes)).toBe(true);
        expect(Array.isArray(serialized.toolProficiencies)).toBe(true);

        // JSON pass proves the saved shape survives a real save file.
        const restored = deserializeProgression(JSON.parse(JSON.stringify(serialized)));
        expect(restored).toEqual(progression);
        expect(restored.knownRecipes).toBeInstanceOf(Set);
        expect(restored.toolProficiencies).toBeInstanceOf(Set);
    });

    it('fills defaults for an empty save object', () => {
        const restored = deserializeProgression({});
        expect(restored).toEqual(createCrafterProgression());
    });
});
