/**
 * @file src/systems/crafting/gatheringSystem.ts
 * Logic for the two-step gathering process: Identification and Harvesting.
 */
import { Crafter } from './craftingSystem';
import { GatherableResource, Biome } from './gatheringData';
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
    catastrophe?: boolean;
}
/**
 * Step 1: Identification
 * The player searches an area for 30 minutes to see what is available.
 */
export declare function attemptIdentification(crafter: Crafter, biome: Biome, timeSpentMultiplier?: number): IdentificationResult;
/**
 * Step 2: Harvesting
 * The player attempts to harvest a specific resource they have identified.
 */
export declare function attemptHarvest(crafter: Crafter, resource: GatherableResource, timeSpentMultiplier?: number): HarvestingResult;
