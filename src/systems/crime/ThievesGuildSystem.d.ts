/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:29:51
 * Dependents: ThievesGuildInterface.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { GuildJob, GuildService, HeistPlan } from '../../types/crime';
import { Location } from '../../types';
export declare class ThievesGuildSystem {
    /**
     * Generates a list of available jobs for a player based on their rank.
     * Uses Regional Economies to provide context-aware targets.
     * @param seed Optional seed for deterministic generation
     */
    static generateJobs(guildId: string, playerRank: number, availableLocations: Location[], // Deprecated in favor of regional logic, but kept for interface compat
    seed?: number): GuildJob[];
    /**
     * Creates a single procedural job.
     */
    private static createProceduralJob;
    private static generateJobTitle;
    /**
     * Returns services available to a player of a certain rank.
     */
    static getAvailableServices(rank: number): GuildService[];
    /**
     * Calculates the outcome of a job based on the heist plan execution.
     */
    static completeJob(job: GuildJob, plan: HeistPlan): {
        success: boolean;
        rewardGold: number;
        rewardRep: number;
        message: string;
    };
}
