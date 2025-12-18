
import { describe, it, expect, vi } from 'vitest';
import { ThievesGuildSystem } from '../ThievesGuildSystem';
import { GuildJobType, HeistPlan } from '../../../types/crime';
import { Location } from '../../../types';

describe('ThievesGuildSystem', () => {
    const mockLocation: Location = {
        id: 'loc_market',
        name: 'Market District',
        type: 'district',
        description: 'A busy market.',
        coordinates: { x: 0, y: 0 },
        // ... other properties mocked as needed
    } as unknown as Location;

    describe('generateJobs', () => {
        it('should generate jobs appropriate for the rank', () => {
            const jobs = ThievesGuildSystem.generateJobs('guild_1', 1, [mockLocation]);

            expect(jobs.length).toBeGreaterThanOrEqual(3);
            jobs.forEach(job => {
                expect(job.guildId).toBe('guild_1');
                expect(job.status).toBe('Available');
                expect(job.difficulty).toBeGreaterThan(0);
                // Rank 1 usually gets difficulty 1-3
                expect(job.requiredRank).toBeLessThanOrEqual(3);
            });
        });

        it('should generate higher reward jobs for higher difficulty', () => {
            const jobsLow = ThievesGuildSystem.generateJobs('guild_1', 1, [mockLocation]);
            const jobsHigh = ThievesGuildSystem.generateJobs('guild_1', 5, [mockLocation]);

            const avgRewardLow = jobsLow.reduce((acc, j) => acc + j.rewardGold, 0) / jobsLow.length;
            const avgRewardHigh = jobsHigh.reduce((acc, j) => acc + j.rewardGold, 0) / jobsHigh.length;

            expect(avgRewardHigh).toBeGreaterThan(avgRewardLow);
        });
    });

    describe('getAvailableServices', () => {
        it('should return no services for rank 0', () => {
            const services = ThievesGuildSystem.getAvailableServices(0);
            expect(services).toHaveLength(0);
        });

        it('should return basic fence for rank 1', () => {
            const services = ThievesGuildSystem.getAvailableServices(1);
            expect(services.some(s => s.type === 'Fence')).toBe(true);
            expect(services.some(s => s.id === 'service_fence_basic')).toBe(true);
        });

        it('should return forgery for rank 5', () => {
            const services = ThievesGuildSystem.getAvailableServices(5);
            expect(services.some(s => s.type === 'Forgery')).toBe(true);
        });
    });

    describe('completeJob', () => {
        const mockJob = {
            id: 'job_1',
            guildId: 'guild_1',
            type: GuildJobType.Burglary,
            targetLocationId: 'loc_market',
            rewardGold: 100,
            rewardReputation: 10,
            status: 'Active'
        } as any; // Cast as any to avoid full mock

        it('should fail if location does not match', () => {
            const plan: HeistPlan = {
                targetLocationId: 'loc_wrong',
                lootSecured: [{ id: 'item_1', value: 50 } as any],
                alertLevel: 0
            } as any;

            const result = ThievesGuildSystem.completeJob(mockJob, plan);
            expect(result.success).toBe(false);
            expect(result.message).toContain('not at the correct location');
        });

        it('should fail burglary if no loot secured', () => {
            const plan: HeistPlan = {
                targetLocationId: 'loc_market',
                lootSecured: [],
                alertLevel: 0
            } as any;

            const result = ThievesGuildSystem.completeJob(mockJob, plan);
            expect(result.success).toBe(false);
            expect(result.message).toContain('empty-handed');
        });

        it('should succeed with loot and reduce reward based on alert', () => {
            const plan: HeistPlan = {
                targetLocationId: 'loc_market',
                lootSecured: [{ id: 'item_1', value: 50 } as any],
                alertLevel: 20 // Should trigger penalty
            } as any;

            const result = ThievesGuildSystem.completeJob(mockJob, plan);
            expect(result.success).toBe(true);
            // 20 alert -> 10% penalty. 100 * 0.9 = 90
            expect(result.rewardGold).toBe(90);
        });
    });
});
