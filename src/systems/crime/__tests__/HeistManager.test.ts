
import { describe, it, expect } from 'vitest';
import { HeistManager } from '../HeistManager';
import { HeistPhase, HeistIntel, CrimeType } from '../../../types/crime';
import { Location } from '../../../types';

describe('HeistManager', () => {

    const mockLocation: Location = {
        id: 'bank_1',
        name: 'Grand Bank',
        baseDescription: 'A secure bank.',
        exits: {},
        mapCoordinates: { x: 0, y: 0 },
        biomeId: 'city'
    };

    it('should initialize a heist plan', () => {
        const plan = HeistManager.startPlanning(mockLocation, 'player_1');

        expect(plan.targetLocationId).toBe('bank_1');
        expect(plan.phase).toBe(HeistPhase.Recon);
        expect(plan.crew).toContain('player_1');
    });

    it('should add intel to the plan', () => {
        let plan = HeistManager.startPlanning(mockLocation, 'player_1');
        const intel: HeistIntel = {
            id: 'intel_1',
            locationId: 'bank_1',
            type: 'GuardPatrol',
            description: 'Guards change shift at noon.',
            accuracy: 0.9
        };

        plan = HeistManager.addIntel(plan, intel);
        expect(plan.collectedIntel).toHaveLength(1);
        expect(plan.collectedIntel[0].id).toBe('intel_1');
    });

    it('should increase action success chance with intel', () => {
        let plan = HeistManager.startPlanning(mockLocation, 'player_1');
        const baseSuccess = HeistManager.calculateActionSuccessChance(plan, 30);

        // Add intel
        plan = HeistManager.addIntel(plan, {
            id: 'i1', locationId: 'l1', type: 'Trap', description: 'd', accuracy: 1
        });

        const boostedSuccess = HeistManager.calculateActionSuccessChance(plan, 30);

        // 50 base - 30 diff = 20
        // +10 from intel = 30
        expect(boostedSuccess).toBeGreaterThan(baseSuccess);
        expect(boostedSuccess).toBe(30);
    });
});
