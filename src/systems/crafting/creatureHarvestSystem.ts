/**
 * @file src/systems/crafting/creatureHarvestSystem.ts
 * Logic for harvesting parts from defeated creatures using Poisoner's Kit or other tools.
 */
import { Crafter } from './craftingSystem';
import { CreaturePart, HarvestableCreature, getCreatureById } from './creatureHarvestData';
import { rollDice } from '../../utils/combatUtils';

export interface CreatureHarvestResult {
    success: boolean;
    roll: number;
    dc: number;
    part: CreaturePart;
    creature: HarvestableCreature;
    yield: number;
    yieldMessage: string;
    toolUsed: string;
}

/**
 * Attempts to harvest a specific part from a creature.
 * Creature must be Dead or Incapacitated for most harvests.
 */
export function attemptCreatureHarvest(
    crafter: Crafter,
    creatureId: string,
    partId: string
): CreatureHarvestResult | { success: false; message: string } {
    const creature = getCreatureById(creatureId);
    if (!creature) {
        return { success: false, message: `Unknown creature: ${creatureId}` };
    }

    const part = creature.parts.find(p => p.id === partId);
    if (!part) {
        return { success: false, message: `Unknown part '${partId}' for creature ${creature.name}` };
    }

    // Determine which skill to roll based on the harvest tool
    let skillName: string;
    switch (part.harvestTool) {
        case 'poisoners_kit':
            skillName = "Poisoner's Kit";
            break;
        case 'alchemists_kit':
            skillName = "Alchemist's Supplies";
            break;
        case 'knife':
            skillName = 'Sleight of Hand'; // Or Survival, depending on preference
            break;
        case 'none':
            skillName = 'None'; // Auto-success or flat DC check
            break;
        default:
            skillName = 'Survival';
    }

    // Roll the skill check
    const roll = part.harvestTool === 'none'
        ? rollDice('1d20') // Flat roll, no proficiency
        : crafter.rollSkill(skillName);

    const dc = part.harvestDC;

    if (roll >= dc) {
        // Success - calculate yield
        const yieldAmount = rollDice(part.baseYield);

        return {
            success: true,
            roll,
            dc,
            part,
            creature,
            yield: yieldAmount,
            yieldMessage: `Harvest Success (${roll} vs DC ${dc})! You extract ${yieldAmount} doses of ${part.name} from the ${creature.name}.`,
            toolUsed: skillName
        };
    } else {
        // Failure - part is lost/damaged
        return {
            success: false,
            roll,
            dc,
            part,
            creature,
            yield: 0,
            yieldMessage: `Harvest Failed (${roll} vs DC ${dc}). The ${part.name} was damaged during extraction and is unusable.`,
            toolUsed: skillName
        };
    }
}

/**
 * Gets all harvestable parts from a creature.
 * Useful for UI display when a creature is defeated.
 */
export function getHarvestableParts(creatureId: string): CreaturePart[] {
    const creature = getCreatureById(creatureId);
    return creature?.parts || [];
}
