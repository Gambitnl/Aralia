/**
 * @file src/systems/crafting/creatureHarvestSystem.ts
 * Logic for harvesting parts from defeated creatures using Poisoner's Kit or other tools.
 */
import { Crafter } from './craftingSystem';
import { CreaturePart, HarvestableCreature } from './creatureHarvestData';
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
export declare function attemptCreatureHarvest(crafter: Crafter, creatureId: string, partId: string): CreatureHarvestResult | {
    success: false;
    message: string;
};
/**
 * Gets all harvestable parts from a creature.
 * Useful for UI display when a creature is defeated.
 */
export declare function getHarvestableParts(creatureId: string): CreaturePart[];
