
import { describe, it, expect } from 'vitest';
import { PortalSystem } from '../PortalSystem';
import { Portal } from '../../../types/planes';
// TODO(lint-intent): 'GamePhase' is unused in this test; use it in the assertion path or remove it.
import { GameState, GamePhase as _GamePhase } from '../../../types/index';
import { createMockGameState } from '../../../utils/factories';

describe('PortalSystem', () => {
    const mockGameState = createMockGameState();

    const portal: Portal = {
        id: 'portal1',
        originLocationId: 'loc1',
        destinationPlaneId: 'feywild',
        activationRequirements: [],
        stability: 'permanent',
        isActive: true
    };

    it('should activate a portal with no requirements', () => {
        const result = PortalSystem.activate(portal, mockGameState);
        expect(result.success).toBe(true);
    });

    it('should fail if portal is inactive', () => {
        const inactivePortal = { ...portal, isActive: false };
        const result = PortalSystem.activate(inactivePortal, mockGameState);
        expect(result.success).toBe(false);
        expect(result.message).toContain('dormant');
    });

    it('should fail if item requirement is missing', () => {
        const itemPortal: Portal = {
            ...portal,
            activationRequirements: [{ type: 'item', value: 'Moon Key', description: 'Requires Moon Key' }]
        };
        const result = PortalSystem.activate(itemPortal, mockGameState);
        expect(result.success).toBe(false);
        expect(result.message).toContain('Moon Key');
    });

    it('should succeed if item requirement is met', () => {
        const itemPortal: Portal = {
            ...portal,
            activationRequirements: [{ type: 'item', value: 'Moon Key', description: 'Requires Moon Key' }]
        };
        const stateWithItem = {
            ...mockGameState,
            inventory: [{ id: '1', name: 'Moon Key', description: 'A glowing key', quantity: 1, type: 'misc', weight: 0, value: 0 }]
        } as GameState;

        const result = PortalSystem.activate(itemPortal, stateWithItem);
        expect(result.success).toBe(true);
    });

    it('should check for Bloodied condition', () => {
         const bloodiedPortal: Portal = {
            ...portal,
            activationRequirements: [{ type: 'condition', value: 'Bloodied', description: 'Sacrifice required' }]
        };

        // Healthy party
        const result1 = PortalSystem.activate(bloodiedPortal, mockGameState);
        expect(result1.success).toBe(false);

        // Damaged party
        const hurtState = {
            ...mockGameState,
            party: [{
                ...mockGameState.party[0],
                hp: 10,
                maxHp: 30
            }]
        };

        const result2 = PortalSystem.activate(bloodiedPortal, hurtState);
        expect(result2.success).toBe(true);
    });
});
