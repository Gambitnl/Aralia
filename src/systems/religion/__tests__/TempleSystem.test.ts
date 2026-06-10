
import { describe, it, expect, vi } from 'vitest';
import { TempleSystem } from '../TempleSystem';
import { GameState, TempleService } from '../../../types';

/**
 * This file checks the temple-service runtime used by the religion project.
 *
 * Temple services are loaded from seeded temple data and then executed through
 * `TempleSystem`, which validates gold/favor requirements, deducts cost, and
 * dispatches concrete game effects. These tests protect both the older string
 * service IDs and the newer structured effect objects so future religion work
 * can add service types without accidentally changing healing behavior.
 *
 * Called by: Vitest Religion System checks
 * Depends on: TempleSystem.ts and the shared religion/game-state types
 */

describe('TempleSystem', () => {
    // Mock State
    const mockDeityId = 'pelor';
    const mockService: TempleService = {
        id: 'heal_service',
        name: 'Healing',
        description: 'Heals 20 HP',
        costGp: 50,
        minFavor: 10,
        effect: 'heal_20_hp'
    };

    const mockGameState = {
        gold: 100,
        inventory: [],
        party: [{ id: 'char1', hp: 10, maxHp: 30 }],
        divineFavor: {
            [mockDeityId]: {
                score: 20,
                rank: 'Neutral',
                consecutiveDaysPrayed: 0,
                history: [],
                blessings: []
            }
        }
    } as unknown as GameState;

    it('should validate service request successfully when requirements met', () => {
        const result = TempleSystem.validateServiceRequest(mockService, mockGameState, mockDeityId);
        expect(result.allowed).toBe(true);
    });

    it('should deny service if insufficient gold', () => {
        const poorState = { ...mockGameState, gold: 10 };
        const result = TempleSystem.validateServiceRequest(mockService, poorState, mockDeityId);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Insufficient gold');
    });

    it('should deny service if insufficient favor', () => {
        const sinnerState = {
            ...mockGameState,
            divineFavor: {
                [mockDeityId]: { favor: 0 }
            }
        } as unknown as GameState;

        const result = TempleSystem.validateServiceRequest(mockService, sinnerState, mockDeityId);
        expect(result.allowed).toBe(false);
        // The reason comes from canAffordService or our override.
        // canAffordService returns "Insufficient divine favor."
        // Our override adds standing info.
        expect(result.reason).toContain('standing');
    });

    it('should perform service: deduct gold and dispatch effects', () => {
        const dispatch = vi.fn();

        const result = TempleSystem.performService(
            mockService,
            mockGameState,
            mockDeityId,
            dispatch
        );

        expect(result.success).toBe(true);
        expect(result.costDeducted).toBe(50);

        // Check dispatches
        // 1. Gold removal
        expect(dispatch).toHaveBeenCalledWith({
            type: 'REMOVE_GOLD',
            payload: 50
        });

        // 2. Heal effect
        expect(dispatch).toHaveBeenCalledWith({
            type: 'HEAL_CHARACTER',
            payload: { characterId: 'char1', amount: 20 }
        });
    });

    // The structured branch should still heal when asked, but only that branch.
    it('should heal when the structured effect is heal', () => {
        const complexService: TempleService = {
            id: 'complex_heal',
            name: 'Greater Healing',
            description: 'Heals 50 HP',
            costGp: 100,
            effect: {
                type: 'heal',
                value: 50
            }
        };

        const dispatch = vi.fn();
        const result = TempleSystem.performService(
            complexService,
            mockGameState,
            mockDeityId,
            dispatch
        );

        expect(result.success).toBe(true);
        // effectApplied should be a JSON string now
        expect(typeof result.effectApplied).toBe('string');
        expect(result.effectApplied).toContain('"type":"heal"');

        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
             type: 'HEAL_CHARACTER',
             payload: expect.objectContaining({ amount: 50 })
        }));
    });

    // This is the regression guard for G2: object-shaped services must not
    // inherit the heal path just because they are structured.
    it('should keep structured non-heal services off the heal path', () => {
        const buffService: TempleService = {
            id: 'warding_blessing',
            name: 'Warding Blessing',
            description: 'A blessing that fortifies the party.',
            costGp: 25,
            effect: {
                type: 'buff',
                value: 2,
                stat: 'Strength',
                duration: 60,
                description: 'A blessing of warding settles over the party.'
            }
        };

        const dispatch = vi.fn();
        const result = TempleSystem.performService(
            buffService,
            mockGameState,
            mockDeityId,
            dispatch
        );

        expect(result.success).toBe(true);
        expect(result.costDeducted).toBe(25);
        expect(result.effectApplied).toContain('"type":"buff"');

        const healDispatches = dispatch.mock.calls.filter(([action]) => action.type === 'HEAL_CHARACTER');
        expect(healDispatches).toHaveLength(0);
    });

    // Procedural village temples still use compact legacy IDs. This protects
    // that generator path while the structured service model grows around it.
    it('should keep procedural restore services in the legacy healing adapter', () => {
        const restoreService: TempleService = {
            id: 'restore_hp_full',
            name: 'Restore Health',
            description: 'Restores the party to full health.',
            costGp: 25,
            effect: 'restore_hp_full'
        };

        const dispatch = vi.fn();
        const result = TempleSystem.performService(
            restoreService,
            mockGameState,
            mockDeityId,
            dispatch
        );

        expect(result.success).toBe(true);
        expect(dispatch).toHaveBeenCalledWith({
            type: 'HEAL_CHARACTER',
            payload: { characterId: 'char1', amount: 20 }
        });
    });
});
