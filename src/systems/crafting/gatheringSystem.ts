
/**
 * @file src/systems/crafting/gatheringSystem.ts
 * Logic for the two-step gathering process: Identification and Harvesting.
 */
import { Crafter } from './craftingSystem';
import { GatherableResource, getResourcesForBiome, Biome } from './gatheringData';
import { rollDice } from '../../utils/combatUtils';

export interface IdentificationResult {
    success: boolean;
    roll: number;
    identifiedResources: GatherableResource[];
    message: string;
}

export interface HarvestingResult {
    success: boolean;
    roll: number;
    yield: number;
    yieldMessage: string;
    resource: GatherableResource;
    critical?: boolean;
    catastrophe?: boolean; // Ingredient destroyed
}

/**
 * Step 1: Identification
 * The player searches an area for 30 minutes to see what is available.
 */
export function attemptIdentification(crafter: Crafter, biome: Biome, timeSpentMultiplier: number = 1): IdentificationResult {
    const baseRoll = crafter.rollSkill('Nature');
    // Optional rule: +3 for every extra 30 mins (max +6, so multiplier 2 or 3)
    // Multiplier 1 = 30m (+0), 2 = 60m (+3), 3 = 90m (+6)
    const bonus = Math.min((timeSpentMultiplier - 1) * 3, 6);
    const totalRoll = baseRoll + bonus;

    const availableResources = getResourcesForBiome(biome);
    const identified: GatherableResource[] = [];

    // Rules from PDF:
    // DC 10: Common
    // DC 15: Common + Uncommon
    // DC 20: Common + Uncommon + Rare

    let tier = 'none';
    if (totalRoll >= 20) {
        tier = 'rare';
        identified.push(...availableResources); // All
    } else if (totalRoll >= 15) {
        tier = 'uncommon';
        identified.push(...availableResources.filter(r => r.rarity === 'common' || r.rarity === 'uncommon'));
    } else if (totalRoll >= 10) {
        tier = 'common';
        identified.push(...availableResources.filter(r => r.rarity === 'common'));
    }

    const success = identified.length > 0;

    let message = `Nature Check: ${totalRoll} (${baseRoll} + ${bonus}). `;
    if (success) {
        message += `You identify ${identified.length} types of flora in the area.`;
    } else {
        message += `You fail to find any useful herbs or fungi.`;
    }

    return {
        success,
        roll: totalRoll,
        identifiedResources: identified,
        message
    };
}

/**
 * Step 2: Harvesting
 * The player attempts to harvest a specific resource they have identified.
 */
export function attemptHarvest(crafter: Crafter, resource: GatherableResource, timeSpentMultiplier: number = 1): HarvestingResult {
    const baseRoll = crafter.rollSkill('Herbalism Kit');
    // Optional rule: same time bonus logic
    const bonus = Math.min((timeSpentMultiplier - 1) * 3, 6);

    // TODO: Add "Potion Making Level" modifier if that system is ever implemented.
    const potionMakingMod = 0;

    const totalRoll = baseRoll + bonus + potionMakingMod;
    const dc = resource.harvestDC;

    if (totalRoll >= dc) {
        // Success! Calculate yield using the baseYield dice notation directly
        const totalYield = rollDice(resource.baseYield);

        return {
            success: true,
            roll: totalRoll,
            yield: totalYield,
            resource,
            yieldMessage: `Harvest Success (${totalRoll} vs DC ${dc})! You collect ${totalYield} units of ${resource.name}.`
        };
    } else {
        // Failure Table - roll 1d4 to determine failure severity
        const failRoll = rollDice('1d4');
        let yieldAmount = 0;
        let failMsg = '';
        let catastrophe = false;

        // Roll the base yield to calculate partials on failure
        const rawYield = rollDice(resource.baseYield);

        switch (failRoll) {
            case 1:
                failMsg = 'Catastrophe! The ingredient was destroyed.';
                catastrophe = true;
                yieldAmount = 0;
                break;
            case 2:
                failMsg = 'Poor technique. Yield reduced by 50%.';
                yieldAmount = Math.floor(rawYield * 0.5);
                break;
            case 3:
                failMsg = 'Slight mishap. Yield reduced by 25%.';
                yieldAmount = Math.floor(rawYield * 0.75);
                break;
            case 4:
                failMsg = 'Failure, but the patch is unharmed. (You can try again)';
                yieldAmount = 0; // But technically retryable
                break;
        }

        return {
            success: false,
            roll: totalRoll,
            yield: yieldAmount,
            resource,
            yieldMessage: `Harvest Failed (${totalRoll} vs DC ${dc}). ${failMsg}`,
            catastrophe
        };
    }
}
