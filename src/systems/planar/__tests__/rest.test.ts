
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPlanarRestRules, RestOutcome } from '../rest';
import { GameState } from '../../../types';
import { getCurrentPlane } from '../../../utils/planarUtils';
import { rollSavingThrow } from '../../../utils/savingThrowUtils';

// Mock dependencies
vi.mock('../../../utils/planarUtils');
vi.mock('../../../utils/savingThrowUtils');

describe('checkPlanarRestRules', () => {
    let mockGameState: GameState;

    beforeEach(() => {
        vi.clearAllMocks();

        // Basic mock of GameState
        mockGameState = {
            party: [
                { id: 'c1', name: 'Hero', finalAbilityScores: { Wisdom: 14 } } as any,
                { id: 'c2', name: 'Cleric', finalAbilityScores: { Wisdom: 18 } } as any
            ],
            currentLocation: { id: 'loc1', planeId: 'material' } as any
        } as GameState;
    });

    it('should allow rest on Material Plane (no effects)', () => {
        vi.mocked(getCurrentPlane).mockReturnValue({
            id: 'material',
            name: 'Material Plane',
            effects: {},
            traits: [] // Ensure traits exist
        } as any);

        const outcome = checkPlanarRestRules(mockGameState);
        expect(outcome.deniedCharacterIds).toEqual([]);
        expect(outcome.messages).toEqual([]);
    });

    it('should deny rest if longRestAllowed is false', () => {
        vi.mocked(getCurrentPlane).mockReturnValue({
            id: 'hades',
            name: 'Hades',
            effects: {
                affectsRest: {
                    longRestAllowed: false,
                    effects: ['No rest here']
                }
            },
            traits: []
        } as any);

        const outcome = checkPlanarRestRules(mockGameState);
        expect(outcome.deniedCharacterIds).toEqual(['c1', 'c2']);
        expect(outcome.messages).toContain('Long rests are not possible in Hades.');
    });

    it('should enforce Shadowfell Despair logic', () => {
        vi.mocked(getCurrentPlane).mockReturnValue({
            id: 'shadowfell',
            name: 'The Shadowfell',
            effects: {
                affectsRest: {
                    longRestAllowed: true,
                    effects: ['Wisdom save required']
                }
            },
            traits: [
                { id: 'shadowfell_despair', name: 'Shadowfell Despair', type: 'environmental', description: '' }
            ]
        } as any);

        // Mock saving throws
        // Character 1 fails (Needs to fail one of the two rolls)
        vi.mocked(rollSavingThrow)
            .mockReturnValueOnce({ success: true, total: 16 } as any) // Roll 1
            .mockReturnValueOnce({ success: false, total: 10 } as any) // Roll 2 (Disadvantage!) -> FAIL
            // Character 2 succeeds (Needs to pass both)
            .mockReturnValueOnce({ success: true, total: 18 } as any)
            .mockReturnValueOnce({ success: true, total: 19 } as any);

        const outcome = checkPlanarRestRules(mockGameState);

        expect(outcome.deniedCharacterIds).toContain('c1');
        expect(outcome.deniedCharacterIds).not.toContain('c2');

        expect(outcome.messages.some(m => m.includes('Hero succumbs to despair'))).toBe(true);
        expect(outcome.messages.some(m => m.includes('Cleric resists the gloom'))).toBe(true);
    });
});
