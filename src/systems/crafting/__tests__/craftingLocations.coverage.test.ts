/**
 * @file src/systems/crafting/__tests__/craftingLocations.coverage.test.ts
 * Coverage pass (gap C14) for crafting location availability and bonuses.
 *
 * Deliberately NOT pinned: getYieldBonus and getQualityChanceBonus on the
 * apothecary and black market. Their bonus descriptions are scoped
 * ("healing potion yields", "on poisons") but the data has no category, so
 * the bonus applies to every category. The yield-bonus category logic is
 * tested with a purpose-built location instead.
 */
import { describe, expect, it } from 'vitest';
import {
    calculateLocationModifier,
    canCraftRarityAtLocation,
    canUseToolAtLocation,
    CRAFTING_LOCATIONS,
    getAvailableLocations,
    getQualityChanceBonus,
    getYieldBonus
} from '../craftingLocations';
import type { CraftingLocation } from '../craftingLocations';

function ids(locations: CraftingLocation[]): string[] {
    return locations.map(l => l.id);
}

describe('getAvailableLocations', () => {
    it('offers field and campsite in the wilderness, whatever the gold or reputation', () => {
        const result = getAvailableLocations('Forest', false, { wizards_guild: 'respected', thieves_guild: 'member' }, 1000);
        expect(ids(result)).toEqual(['field', 'campsite']);
    });

    it('offers field and workshop in town with no gold', () => {
        expect(ids(getAvailableLocations('Urban', true))).toEqual(['field', 'workshop']);
    });

    it('unlocks the apothecary at 25 gold and the lab at 50 gold', () => {
        expect(ids(getAvailableLocations('Urban', true, {}, 24))).toEqual(['field', 'workshop']);
        expect(ids(getAvailableLocations('Urban', true, {}, 25))).toEqual(['field', 'workshop', 'apothecary']);
        expect(ids(getAvailableLocations('Urban', true, {}, 50))).toEqual(['field', 'workshop', 'alchemy_lab', 'apothecary']);
    });

    it("needs both 'respected' wizard standing and 100 gold for the wizard's tower", () => {
        const respected = { wizards_guild: 'respected' };
        expect(ids(getAvailableLocations('Urban', true, respected, 99))).not.toContain('wizards_tower');
        expect(ids(getAvailableLocations('Urban', true, { wizards_guild: 'known' }, 500))).not.toContain('wizards_tower');
        expect(ids(getAvailableLocations('Urban', true, respected, 100))).toContain('wizards_tower');
    });

    it("unlocks the black market for thieves' guild members at any gold", () => {
        expect(ids(getAvailableLocations('Urban', true, { thieves_guild: 'member' }, 0))).toEqual(['field', 'workshop', 'black_market']);
        expect(ids(getAvailableLocations('Urban', true, { thieves_guild: 'outsider' }, 0))).not.toContain('black_market');
    });
});

describe('calculateLocationModifier', () => {
    it('returns the base DC modifier when no category bonus matches', () => {
        expect(calculateLocationModifier(CRAFTING_LOCATIONS.field, 'potion')).toBe(5);
        expect(calculateLocationModifier(CRAFTING_LOCATIONS.campsite, 'bomb')).toBe(2);
        expect(calculateLocationModifier(CRAFTING_LOCATIONS.alchemy_lab, 'potion')).toBe(-2);
    });

    it('adds a matching category DC bonus', () => {
        expect(calculateLocationModifier(CRAFTING_LOCATIONS.campsite, 'potion')).toBe(1);
        expect(calculateLocationModifier(CRAFTING_LOCATIONS.apothecary, 'potion')).toBe(-4);
        expect(calculateLocationModifier(CRAFTING_LOCATIONS.black_market, 'poison')).toBe(-5);
        expect(calculateLocationModifier(CRAFTING_LOCATIONS.wizards_tower, 'utility')).toBe(-6);
    });

    it('ignores non-DC bonuses', () => {
        // Workshop has only a failure_reduction bonus.
        expect(calculateLocationModifier(CRAFTING_LOCATIONS.workshop, 'potion')).toBe(0);
    });
});

describe('canCraftRarityAtLocation', () => {
    it('allows rarities up to and including the location maximum', () => {
        expect(canCraftRarityAtLocation(CRAFTING_LOCATIONS.field, 'common')).toBe(true);
        expect(canCraftRarityAtLocation(CRAFTING_LOCATIONS.field, 'uncommon')).toBe(false);
        expect(canCraftRarityAtLocation(CRAFTING_LOCATIONS.campsite, 'uncommon')).toBe(true);
        expect(canCraftRarityAtLocation(CRAFTING_LOCATIONS.campsite, 'rare')).toBe(false);
        expect(canCraftRarityAtLocation(CRAFTING_LOCATIONS.workshop, 'rare')).toBe(true);
        expect(canCraftRarityAtLocation(CRAFTING_LOCATIONS.workshop, 'very_rare')).toBe(false);
        expect(canCraftRarityAtLocation(CRAFTING_LOCATIONS.alchemy_lab, 'very_rare')).toBe(true);
    });
});

describe('canUseToolAtLocation', () => {
    it('allows only the listed tools', () => {
        expect(canUseToolAtLocation(CRAFTING_LOCATIONS.field, 'herbalism_kit')).toBe(true);
        expect(canUseToolAtLocation(CRAFTING_LOCATIONS.field, 'alchemist_supplies')).toBe(false);
        expect(canUseToolAtLocation(CRAFTING_LOCATIONS.alchemy_lab, 'alchemist_supplies')).toBe(true);
        expect(canUseToolAtLocation(CRAFTING_LOCATIONS.alchemy_lab, 'poisoners_kit')).toBe(false);
        expect(canUseToolAtLocation(CRAFTING_LOCATIONS.black_market, 'poisoners_kit')).toBe(true);
        expect(canUseToolAtLocation(CRAFTING_LOCATIONS.black_market, 'herbalism_kit')).toBe(false);
    });
});

describe('getQualityChanceBonus', () => {
    it('returns the unscoped quality bonus, or 0 when there is none', () => {
        expect(getQualityChanceBonus(CRAFTING_LOCATIONS.field)).toBe(0);
        expect(getQualityChanceBonus(CRAFTING_LOCATIONS.workshop)).toBe(0);
        expect(getQualityChanceBonus(CRAFTING_LOCATIONS.alchemy_lab)).toBe(10);
        expect(getQualityChanceBonus(CRAFTING_LOCATIONS.wizards_tower)).toBe(20);
    });
});

describe('getYieldBonus', () => {
    const scopedLocation: CraftingLocation = {
        ...CRAFTING_LOCATIONS.workshop,
        bonuses: [
            { type: 'quality_chance', value: 5, description: 'unrelated bonus' },
            { type: 'yield_bonus', value: 3, category: 'poison', description: '+3 poison yield' }
        ]
    };
    const globalLocation: CraftingLocation = {
        ...CRAFTING_LOCATIONS.workshop,
        bonuses: [{ type: 'yield_bonus', value: 1, description: '+1 to every yield' }]
    };

    it('returns 0 for locations without a yield bonus', () => {
        expect(getYieldBonus(CRAFTING_LOCATIONS.field, 'potion')).toBe(0);
        expect(getYieldBonus(CRAFTING_LOCATIONS.alchemy_lab, 'potion')).toBe(0);
    });

    it('applies a category-scoped yield bonus only to that category', () => {
        expect(getYieldBonus(scopedLocation, 'poison')).toBe(3);
        expect(getYieldBonus(scopedLocation, 'potion')).toBe(0);
    });

    it('applies an unscoped yield bonus to every category', () => {
        expect(getYieldBonus(globalLocation, 'potion')).toBe(1);
        expect(getYieldBonus(globalLocation, 'bomb')).toBe(1);
    });
});
