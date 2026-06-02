
import { describe, it, expect } from 'vitest';
import { characterReducer } from '../characterReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockPlayerCharacter } from '../../../utils/factories';

describe('Dragonborn Racial Traits Logic', () => {
    const initialState: GameState = {
        party: [],
        inventory: [],
        gold: 100,
        dynamicLocationItemIds: {},
        currentLocationId: 'loc1',
        merchantModal: undefined,
        characterSheetModal: { isOpen: false, character: null },
    } as unknown as GameState;

    describe('Draconic Flight', () => {
        const dfResourceId = 'black_dragonborn__draconic_flight__resource';

        it('should set isFlying to true when Draconic Flight is used', () => {
            const dragonborn = createMockPlayerCharacter({
                id: 'db1',
                level: 5,
                limitedUses: {
                    [dfResourceId]: { name: 'Draconic Flight', current: 1, max: 1, resetOn: 'long_rest' }
                }
            });

            const state = { ...initialState, party: [dragonborn] } as GameState;
            
            const action: AppAction = {
                type: 'USE_LIMITED_ABILITY',
                payload: { characterId: 'db1', abilityId: dfResourceId }
            };

            const newState = characterReducer(state, action);
            const updatedDb = newState.party![0];

            expect(updatedDb.isFlying).toBe(true);
            expect(updatedDb.limitedUses![dfResourceId].current).toBe(0);
        });

        it('should reset isFlying on Long Rest', () => {
            const dragonborn = createMockPlayerCharacter({
                id: 'db1',
                isFlying: true,
                limitedUses: {
                    [dfResourceId]: { name: 'Draconic Flight', current: 0, max: 1, resetOn: 'long_rest' }
                }
            });

            const state = { ...initialState, party: [dragonborn] } as GameState;
            
            const action: AppAction = {
                type: 'LONG_REST',
                payload: {}
            };

            const newState = characterReducer(state, action);
            const updatedDb = newState.party![0];

            expect(updatedDb.isFlying).toBe(false);
            expect(updatedDb.limitedUses![dfResourceId].current).toBe(1);
        });
    });
});
