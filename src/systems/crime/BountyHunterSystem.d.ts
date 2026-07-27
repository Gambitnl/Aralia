/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/05/2026, 23:24:08
 * Dependents: systems/world/WorldEventManager.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/crime/BountyHunterSystem.ts
 * Logic for spawning and managing Bounty Hunters tracking the player.
 */
import { GameState, NotorietyState, NPC } from '../../types';
import { AmbushEvent } from '../../types/crime';
import { SeededRandom } from '@/utils/random';
export declare class BountyHunterSystem {
    /**
     * Checks if a bounty hunter should spawn based on current heat.
     * @returns The generated Bounty Hunter NPC or null.
     */
    static checkForHunterSpawn(state: GameState, rng: SeededRandom): {
        npc: NPC;
        message: string;
    } | null;
    private static generateBountyHunter;
    private static getSpawnMessage;
    /**
     * Checks if a bounty hunter ambush should occur based on notoriety.
     */
    static checkForAmbush(notoriety: NotorietyState, locationId: string, seed?: number): AmbushEvent | null;
    /**
     * Generates a simple NPC encounter from an ambush event.
     */
    static generateAmbushEncounter(event: AmbushEvent): NPC[];
    /**
     * Attempts to pay off a bounty and returns the outcome.
     */
    static payOffBounty(bountyId: string, state: GameState): {
        success: boolean;
        message: string;
        cost?: number;
    };
}
