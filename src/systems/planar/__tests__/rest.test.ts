
import { describe, it, expect, vi, beforeEach } from 'vitest';
// TODO(lint-intent): 'RestOutcome' is unused in this test; use it in the assertion path or remove it.
import { checkPlanarRestRules, RestOutcome as _RestOutcome } from '../rest';
import { GameState, Location } from '../../../types';
import { Plane } from '../../../types/planes';
import { getCurrentPlane } from '../../../utils/planarUtils';
import { rollSavingThrow } from '../../../utils/savingThrowUtils';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/factories';

// Mock dependencies
vi.mock('../../../utils/planarUtils');
vi.mock('../../../utils/savingThrowUtils');

describe('checkPlanarRestRules', () => {
    let mockGameState: GameState;
    const mockLocation: Location = {
        id: 'loc1',
        name: 'Rest Site',
        baseDescription: 'Test location for rest',
        exits: {},
        mapCoordinates: { x: 0, y: 0 },
        biomeId: 'test_biome',
        planeId: 'material'
    };
    const basePlane: Plane = {
        id: 'material',
        name: 'Material Plane',
        description: 'Default plane',
        traits: [],
        natives: [],
        hazards: [],
        emotionalValence: 'neutral',
        timeFlow: 'normal',
        atmosphereDescription: 'Calm and familiar.',
        effects: {}
    };
    const makeSaveResult = (success: boolean, total: number) => ({
        success,
        total,
        roll: total,
        dc: 15,
        natural20: false,
        natural1: false
    });

    beforeEach(() => {
        vi.clearAllMocks();

        const hero = createMockPlayerCharacter({ id: 'c1', name: 'Hero' });
        hero.finalAbilityScores = { ...hero.finalAbilityScores, Wisdom: 14 };
        const cleric = createMockPlayerCharacter({ id: 'c2', name: 'Cleric' });
        cleric.finalAbilityScores = { ...cleric.finalAbilityScores, Wisdom: 18 };

        mockGameState = createMockGameState({
            party: [hero, cleric],
            currentLocationId: mockLocation.id,
            dynamicLocations: { [mockLocation.id]: mockLocation }
        });
    });

    it('should allow rest on Material Plane (no effects)', () => {
        vi.mocked(getCurrentPlane).mockReturnValue({
            ...basePlane,
            id: 'material',
            name: 'Material Plane'
        });

        const outcome = checkPlanarRestRules(mockGameState);
        expect(outcome.deniedCharacterIds).toEqual([]);
        expect(outcome.messages).toEqual([]);
    });

    it('should deny rest if longRestAllowed is false', () => {
        vi.mocked(getCurrentPlane).mockReturnValue({
            ...basePlane,
            id: 'hades',
            name: 'Hades',
            effects: {
                affectsRest: {
                    longRestAllowed: false,
                    // Was missing shortRestAllowed; add required field for RestModifier.
                    shortRestAllowed: false,
                    effects: ['No rest here']
                }
            }
        });

        const outcome = checkPlanarRestRules(mockGameState);
        expect(outcome.deniedCharacterIds).toEqual(['c1', 'c2']);
        expect(outcome.messages).toContain('Long rests are not possible in Hades.');
    });

    it('should enforce Shadowfell Despair logic', () => {
        vi.mocked(getCurrentPlane).mockReturnValue({
            ...basePlane,
            id: 'shadowfell',
            name: 'The Shadowfell',
            effects: {
                affectsRest: {
                    longRestAllowed: true,
                    // Was missing shortRestAllowed; add required field for RestModifier.
                    shortRestAllowed: true,
                    effects: ['Wisdom save required']
                }
            },
            traits: [
                { id: 'shadowfell_despair', name: 'Shadowfell Despair', type: 'environmental', description: '' }
            ]
        });

        // Mock saving throws
        // Character 1 fails (Needs to fail one of the two rolls)
        vi.mocked(rollSavingThrow)
            .mockReturnValueOnce(makeSaveResult(true, 16)) // Roll 1
            .mockReturnValueOnce(makeSaveResult(false, 10)) // Roll 2 (Disadvantage!) -> FAIL
            // Character 2 succeeds (Needs to pass both)
            .mockReturnValueOnce(makeSaveResult(true, 18))
            .mockReturnValueOnce(makeSaveResult(true, 19));

        const outcome = checkPlanarRestRules(mockGameState);

        expect(outcome.deniedCharacterIds).toContain('c1');
        expect(outcome.deniedCharacterIds).not.toContain('c2');

        expect(outcome.messages.some(m => m.includes('Hero succumbs to despair'))).toBe(true);
        expect(outcome.messages.some(m => m.includes('Cleric resists the gloom'))).toBe(true);
    });
});
