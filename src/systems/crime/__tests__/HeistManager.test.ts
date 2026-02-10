
import { describe, it, expect } from 'vitest';
import { HeistManager } from '../HeistManager';
import { HeistPhase, HeistIntel, HeistRole, HeistAction, HeistActionType } from '../../../types/crime';
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
        expect(plan.crew).toHaveLength(1);
        expect(plan.crew[0].characterId).toBe('player_1');
        expect(plan.crew[0].role).toBe(HeistRole.Leader);
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

    it('should assign and update crew roles', () => {
        let plan = HeistManager.startPlanning(mockLocation, 'player_1');

        // Assign new member
        plan = HeistManager.assignCrew(plan, 'player_2', HeistRole.Infiltrator);
        expect(plan.crew).toHaveLength(2);
        expect(plan.crew.find(c => c.characterId === 'player_2')?.role).toBe(HeistRole.Infiltrator);

        // Update existing member
        plan = HeistManager.assignCrew(plan, 'player_2', HeistRole.Face);
        expect(plan.crew).toHaveLength(2);
        expect(plan.crew.find(c => c.characterId === 'player_2')?.role).toBe(HeistRole.Face);
    });

    it('should calculate success chance with roles', () => {
        let plan = HeistManager.startPlanning(mockLocation, 'leader');
        plan = HeistManager.assignCrew(plan, 'rogue', HeistRole.Infiltrator);

        const action: HeistAction = {
            type: HeistActionType.PickLock,
            difficulty: 30,
            requiredRole: HeistRole.Infiltrator,
            risk: 10,
            noise: 5,
            description: 'Pick the lock'
        };

        // Case 1: Wrong Role (Leader attempting specialist action)
        const chanceWrongRole = HeistManager.calculateActionSuccessChance(plan, action, HeistRole.Leader);

        // Case 2: Correct Role
        const chanceRightRole = HeistManager.calculateActionSuccessChance(plan, action, HeistRole.Infiltrator);

        expect(chanceRightRole).toBeGreaterThan(chanceWrongRole);
        expect(chanceRightRole).toBe(95); // 100 - 30 (diff) + 25 (role)
    });

    it('should perform heist action successfully', () => {
        let plan = HeistManager.startPlanning(mockLocation, 'rogue');
        plan = HeistManager.assignCrew(plan, 'rogue', HeistRole.Infiltrator);

        const action: HeistAction = {
            type: HeistActionType.PickLock,
            difficulty: 10,
            requiredRole: HeistRole.Infiltrator,
            risk: 20,
            noise: 5,
            description: 'Pick lock'
        };

        // Force success with roll 0
        const result = HeistManager.performHeistAction(plan, action, 'rogue', 0);

        expect(result.success).toBe(true);
        expect(result.alertGenerated).toBe(5); // Noise
        expect(result.updatedPlan.alertLevel).toBe(5);
        expect(result.message).toContain('Success');
    });

    it('should perform heist action with failure', () => {
        let plan = HeistManager.startPlanning(mockLocation, 'rogue');
        plan = HeistManager.assignCrew(plan, 'rogue', HeistRole.Infiltrator);

        const action: HeistAction = {
            type: HeistActionType.PickLock,
            difficulty: 10,
            requiredRole: HeistRole.Infiltrator,
            risk: 20,
            noise: 5,
            description: 'Pick lock'
        };

        // Force failure with roll 100
        const result = HeistManager.performHeistAction(plan, action, 'rogue', 100);

        expect(result.success).toBe(false);
        expect(result.alertGenerated).toBe(20); // Risk
        expect(result.updatedPlan.alertLevel).toBe(20);
        expect(result.message).toContain('Failure');
    });

    it('should reduce alert gain if Lookout is present', () => {
        let plan = HeistManager.startPlanning(mockLocation, 'leader');
        plan = HeistManager.assignCrew(plan, 'lookout', HeistRole.Lookout);

        const action: HeistAction = {
            type: HeistActionType.KnockoutGuard,
            difficulty: 10,
            risk: 20, // Fail risk
            noise: 0,
            description: 'Knockout'
        };

        // Force failure
        const result = HeistManager.performHeistAction(plan, action, 'leader', 100);

        // Alert should be Risk 20 - 5 (Lookout bonus) = 15
        expect(result.alertGenerated).toBe(15);
    });
});
