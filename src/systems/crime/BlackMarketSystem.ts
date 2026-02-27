// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 27/02/2026, 09:29:37
 * Dependents: None (Orphan)
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
    BlackMarketListing,
    ContrabandDefinition,
    ContrabandCategory
} from '../../types/crime';
import { SeededRandom } from '@/utils/random';
import { Item, ItemType } from '../../types/items';
import { generateId } from '../../utils/core/idGenerator';

export class BlackMarketSystem {

    /**
     * Generates listings for a black market in a specific location.
     * Prices and availability depend on the location's supply/demand.
     */
    static generateListings(
        locationId: string,
        demandCategories: ContrabandCategory[],
        baseSupplyLevel: number, // 1-10
        seed?: number
    ): BlackMarketListing[] {
        const rng = new SeededRandom(seed || Date.now());
        const listings: BlackMarketListing[] = [];
        const count = 3 + rng.nextInt(0, baseSupplyLevel);

        for (let i = 0; i < count; i++) {
            const category = this.getRandomCategory(rng);
            const isHighDemand = demandCategories.includes(category);

            const item = this.generateContrabandItem(category, rng);
            const basePrice = item.costInGp || 100;

            const priceMultiplier = isHighDemand ? 1.5 : 0.8;
            const variance = 0.9 + (rng.next() * 0.2); // +/- 10%
            const finalPrice = Math.floor(basePrice * priceMultiplier * variance);

            listings.push({
                id: generateId(),
                sellerId: `smuggler_${rng.nextInt(1000, 9999)}`,
                item,
                price: finalPrice,
                isIllegal: true,
                heatGenerated: isHighDemand ? 5 : 2
            });
        }

        return listings;
    }

    /**
     * Calculates the sell price for contraband the player wants to SELL to the market.
     */
    static getSellPrice(
        item: ContrabandDefinition,
        locationDemand: ContrabandCategory[]
    ): number {
        const isHighDemand = locationDemand.includes(item.category);

        // Base: 50% of value
        let multiplier = 0.5;

        if (isHighDemand) {
            multiplier = 1.2; // Massive profit for smuggling to high demand zones!
        } else {
            multiplier = 0.4; // Low ball if they don't need it
        }

        return Math.floor(item.baseValue * multiplier);
    }

    private static getRandomCategory(rng: SeededRandom): ContrabandCategory {
        const categories = Object.values(ContrabandCategory);
        return rng.pick(categories);
    }

    private static generateContrabandItem(category: ContrabandCategory, rng: SeededRandom): Item {
        // Mock item generation based on category
        const names = {
            [ContrabandCategory.Narcotics]: ['Dreammist', 'Red Sand', 'Fey Dust'],
            [ContrabandCategory.DarkMagic]: ['Necromancer\'s Skull', 'Blood Ink', 'Cursed Idol'],
            [ContrabandCategory.StolenGoods]: ['Marked Gold Bars', 'Noble Jewelry', 'Royal Seal'],
            [ContrabandCategory.ForbiddenTech]: ['Black Powder', 'Clockwork Bomb', 'Gnomish Trigger'],
            [ContrabandCategory.ExoticCreatures]: ['Basilisk Egg', 'Pseudodragon', 'Cockatrice Feather'],
            [ContrabandCategory.Slaves]: ['Indentured Contract', 'Thrall Collar', 'Gladiator Bond']
        };

        const name = rng.pick(names[category]);

        return {
            id: generateId(),
            name,
            description: `Illegal contraband of type ${category}.`,
            type: ItemType.Treasure, // Using generic type for now, strictly it's Contraband
            category: 'contraband', // Tag for Fence/Black Market
            // Add custom props that might be used by Contraband systems if we cast it
            costInGp: 100 + rng.nextInt(0, 500),
            weight: 1 + rng.next() * 5
        };
    }
}
