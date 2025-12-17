
import { describe, it, expect } from 'vitest';
import { CrimeSystem } from '../CrimeSystem';
import { CrimeType, HeatLevel } from '../../../types/crime';
import { NotorietyState } from '../../../types';

describe('CrimeSystem', () => {

    it('should calculate base risk correctly', () => {
        const mockNotoriety: NotorietyState = {
            globalHeat: 0,
            localHeat: {},
            knownCrimes: []
        };

        // Theft (20) + 0 heat factors
        const risk = CrimeSystem.calculateRisk('loc_1', CrimeType.Theft, mockNotoriety);
        expect(risk).toBe(20);
    });

    it('should increase risk with local heat', () => {
        const mockNotoriety: NotorietyState = {
            globalHeat: 0,
            localHeat: { 'loc_1': 50 }, // 50 heat * 0.5 = +25 risk
            knownCrimes: []
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

    it('should generate bounties for serious crimes', () => {
        const seriousCrime = {
            id: '1',
            type: CrimeType.Murder,
            locationId: 'loc_1',
            timestamp: Date.now(),
            severity: 100,
            witnessed: true
        };

        const bounty = CrimeSystem.generateBounty(seriousCrime);
        expect(bounty).toBeDefined();
        expect(bounty?.amount).toBeGreaterThan(1000); // 100*10 + 500 = 1500
        expect(bounty?.conditions).toBe('DeadOrAlive');
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
});
