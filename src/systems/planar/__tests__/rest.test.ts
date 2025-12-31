
import { describe, it, expect, vi, beforeEach } from 'vitest';
// TODO(lint-intent): 'RestOutcome' is unused in this test; use it in the assertion path or remove it.
import { checkPlanarRestRules, RestOutcome as _RestOutcome } from '../rest';
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
                // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
                { id: 'c1', name: 'Hero', finalAbilityScores: { Wisdom: 14 } } as unknown,
                // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
                { id: 'c2', name: 'Cleric', finalAbilityScores: { Wisdom: 18 } } as unknown
            ],
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
            currentLocation: { id: 'loc1', planeId: 'material' } as unknown
        } as GameState;
    });

    it('should allow rest on Material Plane (no effects)', () => {
        vi.mocked(getCurrentPlane).mockReturnValue({
            id: 'material',
            name: 'Material Plane',
            effects: {},
            traits: [] // Ensure traits exist
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown);

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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown);

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
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as unknown);

        // Mock saving throws
        // Character 1 fails (Needs to fail one of the two rolls)
        vi.mocked(rollSavingThrow)
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
            .mockReturnValueOnce({ success: true, total: 16 } as unknown) // Roll 1
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
            .mockReturnValueOnce({ success: false, total: 10 } as unknown) // Roll 2 (Disadvantage!) -> FAIL
            // Character 2 succeeds (Needs to pass both)
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
            .mockReturnValueOnce({ success: true, total: 18 } as unknown)
            // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
            .mockReturnValueOnce({ success: true, total: 19 } as unknown);

        const outcome = checkPlanarRestRules(mockGameState);

        expect(outcome.deniedCharacterIds).toContain('c1');
        expect(outcome.deniedCharacterIds).not.toContain('c2');

        expect(outcome.messages.some(m => m.includes('Hero succumbs to despair'))).toBe(true);
        expect(outcome.messages.some(m => m.includes('Cleric resists the gloom'))).toBe(true);
    });
});
