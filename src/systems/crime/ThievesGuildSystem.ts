// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 02:41:04
 * Dependents: ThievesGuildInterface.tsx
 * Imports: 5 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
    GuildJob,
    GuildJobType,
    GuildService,
    HeistPlan
} from '../../types/crime';
import { Location } from '../../types';
import { SeededRandom } from '@/utils/random';
import { REGIONAL_ECONOMIES } from '../../data/economy/regions';
import { generateId } from '../../utils/core/idGenerator';

export class ThievesGuildSystem {

    /**
     * Generates a list of available jobs for a player based on their rank.
     * Uses Regional Economies to provide context-aware targets.
     * @param seed Optional seed for deterministic generation
     */
    static generateJobs(
        guildId: string,
        playerRank: number,
        availableLocations: Location[], // Deprecated in favor of regional logic, but kept for interface compat
        seed?: number
    ): GuildJob[] {
        const rng = new SeededRandom(seed || Date.now());
        const jobs: GuildJob[] = [];
        const jobCount = 3 + rng.nextInt(0, 3); // 3-5 jobs

        // Convert regions to potential targets
        const regionalTargets = Object.values(REGIONAL_ECONOMIES).map(r => ({
            id: r.id,
            name: r.name,
            // Mock other location props for now, or fetch real Location if linked
            baseDescription: `A wealthy region known for ${r.exports.join(', ')}.`,
            mapCoordinates: { x: 0, y: 0 },
            biomeId: 'city',
            exits: {}
        } as Location));

        // Merge with passed locations if any
        const allTargets = [...availableLocations, ...regionalTargets];

        for (let i = 0; i < jobCount; i++) {
            // Determine difficulty based on rank +/- 1
            const difficultyBase = Math.max(1, playerRank);
            // Difficulty = base + (-1 to 1)
            const difficulty = Math.max(1, Math.min(10, difficultyBase + rng.nextInt(0, 3) - 1));

            const targetLoc = allTargets.length > 0
                ? rng.pick(allTargets)
                : { id: 'loc_capital', name: 'The Capital', baseDescription: 'The seat of power.', mapCoordinates: { x: 0, y: 0 }, biomeId: 'city', exits: {} } as Location;

            jobs.push(this.createProceduralJob(guildId, difficulty, targetLoc, rng));
        }

        return jobs;
    }

    /**
     * Creates a single procedural job.
     */
    private static createProceduralJob(
        guildId: string,
        difficulty: number,
        location: Location,
        rng: SeededRandom
    ): GuildJob {
        const types = Object.values(GuildJobType);
        const type = rng.pick(types);

        const rewardBase = difficulty * 100;
        const rewardGold = rewardBase + Math.floor(rng.next() * (rewardBase * 0.5));

        return {
            id: generateId(),
            guildId,
            title: this.generateJobTitle(type, location.name, rng),
            description: `The guild requires a ${type} operation at ${location.name}. Discretion is advised.`,
            type,
            difficulty,
            requiredRank: Math.max(0, difficulty - 2), // Allow punching slightly above weight
            targetLocationId: location.id,
            rewardGold,
            rewardReputation: difficulty * 5,
            status: 'Available'
        };
    }

    private static generateJobTitle(type: GuildJobType, locationName: string, rng: SeededRandom): string {
        const prefixes = {
            [GuildJobType.Burglary]: ['The Midnight', 'Silent', 'Golden'],
            [GuildJobType.Smuggling]: ['Hidden', 'Shadow', 'Moonlight'],
            [GuildJobType.Assassination]: ['Crimson', 'Final', 'Silent'],
            [GuildJobType.Espionage]: ['Whispering', 'Secret', 'Watching'],
            [GuildJobType.Intimidation]: ['Heavy', 'Broken', 'Forceful'],
            [GuildJobType.Protection]: ['Shield', 'Guardian', 'Iron']
        };

        const nouns = {
            [GuildJobType.Burglary]: ['Acquisition', 'Lift', 'Heist'],
            [GuildJobType.Smuggling]: ['Run', 'Transport', 'Delivery'],
            [GuildJobType.Assassination]: ['Solution', 'Removal', 'Contract'],
            [GuildJobType.Espionage]: ['Observation', 'Listen', 'Eye'],
            [GuildJobType.Intimidation]: ['Message', 'Warning', 'Visit'],
            [GuildJobType.Protection]: ['Duty', 'Watch', 'Detail']
        };

        const p = rng.pick(prefixes[type]);
        const n = rng.pick(nouns[type]);

        return `${p} ${n} at ${locationName}`;
    }

    /**
     * Returns services available to a player of a certain rank.
     */
    static getAvailableServices(rank: number): GuildService[] {
        const services: GuildService[] = [];

        // Rank 1: Basic Fence
        if (rank >= 1) {
            services.push({
                id: 'service_fence_basic',
                name: 'Street Fence',
                description: 'Access to a fence who buys common stolen goods (30% cut).',
                type: 'Fence',
                requiredRank: 1,
                costGold: 0,
                cooldownHours: 0
            });
        }

        // Rank 2: Safehouse
        if (rank >= 2) {
            services.push({
                id: 'service_safehouse',
                name: 'Safehouse Network',
                description: 'Use guild safehouses to rest and hide from the law.',
                type: 'Safehouse',
                requiredRank: 2,
                costGold: 50, // Rent
                cooldownHours: 24
            });
        }

        // Rank 3: Heat Reduction
        if (rank >= 3) {
            services.push({
                id: 'service_bribe',
                name: 'Bribe Officials',
                description: 'Pay to reduce your local heat level significantly.',
                type: 'HeatReduction',
                requiredRank: 3,
                costGold: 500,
                cooldownHours: 72
            });
        }

        // Rank 4: Master Fence
        if (rank >= 4) {
            services.push({
                id: 'service_fence_master',
                name: 'Master Fence',
                description: 'Access to a fence who buys high-value and magical items (15% cut).',
                type: 'Fence',
                requiredRank: 4,
                costGold: 0,
                cooldownHours: 0
            });
        }

        // Rank 5: Forgery
        if (rank >= 5) {
            services.push({
                id: 'service_forgery',
                name: 'Master Forger',
                description: 'Create flawless identity papers or falsify ownership documents.',
                type: 'Forgery',
                requiredRank: 5,
                costGold: 1000,
                cooldownHours: 48
            });
        }

        return services;
    }

    /**
     * Calculates the outcome of a job based on the heist plan execution.
     */
    static completeJob(
        job: GuildJob,
        plan: HeistPlan
    ): { success: boolean; rewardGold: number; rewardRep: number; message: string } {
        // Validation
        if (job.targetLocationId !== plan.targetLocationId) {
            return {
                success: false,
                rewardGold: 0,
                rewardRep: -5,
                message: "This heist was not at the correct location for the job."
            };
        }

        // Did they get the loot? (For burglary)
        const hasLoot = plan.lootSecured.length > 0;

        // Did they survive? (Implied by reaching this step, but good to check state)
        // ...

        if (job.type === GuildJobType.Burglary && !hasLoot) {
            return {
                success: false,
                rewardGold: 0,
                rewardRep: -2,
                message: "You returned empty-handed. The guild is not impressed."
            };
        }

        // Calculate rewards
        // Alert level penalizes reward
        const alertPenalty = Math.floor(plan.alertLevel / 20) * 0.1; // 10% penalty per 20 alert
        const finalReward = Math.floor(job.rewardGold * (1 - alertPenalty));

        return {
            success: true,
            rewardGold: finalReward,
            rewardRep: job.rewardReputation,
            message: `Job complete. The guild pays out ${finalReward}gp.`
        };
    }
}
