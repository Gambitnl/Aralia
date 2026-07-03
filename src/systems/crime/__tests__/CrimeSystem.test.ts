
import { describe, it, expect } from 'vitest';
import { CrimeSystem } from '../CrimeSystem';
import { CrimeType, HeatLevel } from '../../../types/crime';
import { NotorietyState } from '../../../types';

describe('CrimeSystem', () => {

    it('should calculate base risk correctly', () => {
        const mockNotoriety: NotorietyState = {
            globalHeat: 0,
            localHeat: {},
            knownCrimes: [],
            bounties: []
        };

        // Theft (20) + 0 heat factors
        const risk = CrimeSystem.calculateRisk('loc_1', CrimeType.Theft, mockNotoriety);
        expect(risk).toBe(20);
    });

    it('should increase risk with local heat', () => {
        const mockNotoriety: NotorietyState = {
            globalHeat: 0,
            localHeat: { 'loc_1': 50 }, // 50 heat * 0.5 = +25 risk
            knownCrimes: [],
            bounties: []
        };

        // Theft (20) + 25 = 45
        const risk = CrimeSystem.calculateRisk('loc_1', CrimeType.Theft, mockNotoriety);
        expect(risk).toBe(45);
    });

    it('should convert heat values to levels correctly', () => {
        expect(CrimeSystem.getHeatLevel(5)).toBe(HeatLevel.Unknown);
        expect(CrimeSystem.getHeatLevel(20)).toBe(HeatLevel.Suspected);
        expect(CrimeSystem.getHeatLevel(50)).toBe(HeatLevel.Wanted);
        expect(CrimeSystem.getHeatLevel(90)).toBe(HeatLevel.Hunted);
    });

    it('should normalize legacy and canonical crime severity into the same 1-100 scale', () => {
        expect(CrimeSystem.normalizeSeverity(5)).toBe(50);
        expect(CrimeSystem.normalizeSeverity(50)).toBe(50);
        expect(CrimeSystem.normalizeSeverity(0)).toBe(0);
        expect(CrimeSystem.normalizeSeverity(150)).toBe(100);
    });

    it('should calculate heat from normalized severity without overshooting the legacy scale', () => {
        expect(CrimeSystem.calculateCrimeHeat(50, true)).toBe(10);
        expect(CrimeSystem.calculateCrimeHeat(50, false)).toBe(5);
        expect(CrimeSystem.calculateCrimeHeat(100, true)).toBe(20);
        expect(CrimeSystem.calculateCrimeHeat(100, false)).toBe(10);
    });

    it('should generate bounties for serious crimes', () => {
        const crimeTimestamp = Date.UTC(2026, 0, 1);
        const seriousCrime = {
            id: '1',
            type: CrimeType.Murder,
            locationId: 'loc_1',
            timestamp: crimeTimestamp,
            severity: 100,
            witnessed: true
        };

        const bounty = CrimeSystem.generateBounty(seriousCrime);
        expect(bounty).toBeDefined();
        expect(bounty?.amount).toBeGreaterThan(1000); // 100*10 + 500 = 1500
        expect(bounty?.conditions).toBe('DeadOrAlive');
        expect(bounty?.expiration).toBe(crimeTimestamp + 7 * 24 * 60 * 60 * 1000);
    });

    it('should not generate bounties for minor infractions', () => {
        const minorCrime = {
            id: '2',
            type: CrimeType.Vandalism,
            locationId: 'loc_1',
            timestamp: Date.now(),
            severity: 10,
            witnessed: true
        };

        const bounty = CrimeSystem.generateBounty(minorCrime);
        expect(bounty).toBeNull();
    });

    it('should prune expired bounties using the in-game clock', () => {
        const now = Date.UTC(2026, 0, 8);
        const mockNotoriety: NotorietyState = {
            globalHeat: 0,
            localHeat: {},
            knownCrimes: [],
            bounties: [
                {
                    id: 'expired-bounty',
                    targetId: 'player',
                    issuerId: 'local_guard',
                    amount: 250,
                    conditions: 'Alive',
                    isActive: true,
                    expiration: now - 1
                },
                {
                    id: 'future-bounty',
                    targetId: 'player',
                    issuerId: 'local_guard',
                    amount: 500,
                    conditions: 'DeadOrAlive',
                    isActive: true,
                    expiration: now + 1
                },
                {
                    id: 'story-bounty',
                    targetId: 'player',
                    issuerId: 'duke',
                    amount: 1000,
                    conditions: 'Alive',
                    isActive: true
                }
            ]
        };

        // Expired timed warrants disappear, while future and story bounties remain.
        const pruned = CrimeSystem.pruneExpiredBounties(mockNotoriety, now);
        expect(pruned.bounties.map(bounty => bounty.id)).toEqual(['future-bounty', 'story-bounty']);
    });
});
