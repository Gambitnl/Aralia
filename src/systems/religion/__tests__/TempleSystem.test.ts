
import { describe, it, expect, vi } from 'vitest';
import { TempleSystem } from '../TempleSystem';
// TODO(lint-intent): 'DivineFavor' is unused in this test; use it in the assertion path or remove it.
import { GameState, TempleService, DivineFavor as _DivineFavor } from '../../../types';

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

    it('should handle complex object effects', () => {
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
});
