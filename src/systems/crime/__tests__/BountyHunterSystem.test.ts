// TODO(lint-intent): 'vi' is unused in this test; use it in the assertion path or remove it.
import { describe, it, expect, vi as _vi } from 'vitest';
import { BountyHunterSystem } from '../BountyHunterSystem';
// TODO(lint-intent): 'GameState' is unused in this test; use it in the assertion path or remove it.
import { NotorietyState, GameState as _GameState, HeatLevel as _HeatLevel } from '../../../types';
import { Bounty, HunterTier } from '../../../types/crime';
import { createMockGameState } from '../../../utils/factories';

describe('BountyHunterSystem', () => {

    const mockBounty: Bounty = {
        id: 'b1',
        targetId: 'player',
        issuerId: 'guard_captain',
        amount: 2000,
        conditions: 'Alive',
        isActive: true,
        expiration: Date.now() + 100000
    };

    const baseNotoriety: NotorietyState = {
        globalHeat: 0,
        localHeat: {},
        knownCrimes: [],
        bounties: [mockBounty]
    };

    describe('checkForAmbush', () => {
        it('should return null if no active bounties exist', () => {
            const safeNotoriety = { ...baseNotoriety, bounties: [] };
            const result = BountyHunterSystem.checkForAmbush(safeNotoriety, 'loc_1');
            expect(result).toBeNull();
        });

        it('should trigger ambush with high heat and bounty (deterministic seed)', () => {
            const highNotoriety: NotorietyState = {
                ...baseNotoriety,
                globalHeat: 100, // Hunted status
                localHeat: { 'loc_1': 50 }
            };

            // Using a specific seed to guarantee the RNG roll <= 35% + bonus
            const result = BountyHunterSystem.checkForAmbush(highNotoriety, 'loc_1', 12345);

            expect(result).not.toBeNull();
            if (result) {
                expect(result.locationId).toBe('loc_1');
                expect(result.bountiesChased).toContain('b1');
                expect(result.hunter).toBeDefined();
            }
        });

        it('should generate appropriate hunter tier based on threat', () => {
             const huntedNotoriety: NotorietyState = {
                ...baseNotoriety,
                globalHeat: 90,
                bounties: [{ ...mockBounty, amount: 10000 }] // High value
            };

            const result = BountyHunterSystem.checkForAmbush(huntedNotoriety, 'loc_1', 12345);
            expect(result?.tier).toBe(HunterTier.Elite);
        });
    });

    describe('generateAmbushEncounter', () => {
        it('should create a combat team with leader and minions', () => {
             const event = {
                hunter: {
                    id: 'h1',
                    name: 'Test Hunter',
                    tier: HunterTier.Mercenary,
                    className: 'Fighter',
                    level: 5,
                    specialAbilities: []
                },
                tier: HunterTier.Mercenary,
                bountiesChased: ['b1'],
                locationId: 'loc_1'
            };

            const encounter = BountyHunterSystem.generateAmbushEncounter(event);
            expect(encounter.length).toBeGreaterThan(1); // Leader + Minions
            expect(encounter[0].id).toBe('h1');
        });
    });

    describe('payOffBounty', () => {
        it('should fail if player lacks gold', () => {
            const gameState = createMockGameState({
                gold: 10,
                notoriety: baseNotoriety
            });

            const result = BountyHunterSystem.payOffBounty('b1', gameState);
            expect(result.success).toBe(false);
            expect(result.message).toContain('You need');
        });

        it('should succeed if player has gold', () => {
             const gameState = createMockGameState({
                gold: 5000,
                notoriety: baseNotoriety
            });

            const result = BountyHunterSystem.payOffBounty('b1', gameState);
            expect(result.success).toBe(true);
            expect(result.cost).toBeGreaterThan(mockBounty.amount); // Bribe markup
        });
    });
});
