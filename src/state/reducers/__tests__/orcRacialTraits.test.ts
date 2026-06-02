
import { describe, it, expect } from 'vitest';
import { characterReducer } from '../characterReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { createMockPlayerCharacter } from '../../../utils/factories';

describe('Orc Racial Traits Logic', () => {
    const initialState: GameState = {
        party: [],
        inventory: [],
        gold: 100,
        dynamicLocationItemIds: {},
        currentLocationId: 'loc1',
        merchantModal: undefined,
        characterSheetModal: { isOpen: false, character: null },
    } as unknown as GameState;

    describe('Relentless Endurance', () => {
        const reResourceId = 'racial_feature_orc__relentless_endurance__resource';

        it('should prevent dropping to 0 HP if Relentless Endurance is available', () => {
            const orc = createMockPlayerCharacter({
                id: 'orc1',
                hp: 10,
                maxHp: 20,
                limitedUses: {
                    [reResourceId]: { name: 'Relentless Endurance', current: 1, max: 1, resetOn: 'long_rest' }
                }
            });

            const state = { ...initialState, party: [orc] } as GameState;
            
            // Apply 10 damage (enough to drop to 0)
            const action: AppAction = {
                type: 'MODIFY_PARTY_HEALTH',
                payload: { characterIds: ['orc1'], amount: -10 }
            };

            const newState = characterReducer(state, action);
            const updatedOrc = newState.party![0];

            expect(updatedOrc.hp).toBe(1);
            expect(updatedOrc.limitedUses![reResourceId].current).toBe(0);
        });

        it('should NOT trigger Relentless Endurance if it has already been used', () => {
            const orc = createMockPlayerCharacter({
                id: 'orc1',
                hp: 10,
                maxHp: 20,
                limitedUses: {
                    [reResourceId]: { name: 'Relentless Endurance', current: 0, max: 1, resetOn: 'long_rest' }
                }
            });

            const state = { ...initialState, party: [orc] } as GameState;
            
            // Apply 10 damage
            const action: AppAction = {
                type: 'MODIFY_PARTY_HEALTH',
                payload: { characterIds: ['orc1'], amount: -10 }
            };

            const newState = characterReducer(state, action);
            const updatedOrc = newState.party![0];

            expect(updatedOrc.hp).toBe(0);
        });

        it('should NOT trigger Relentless Endurance if damage is not lethal', () => {
            const orc = createMockPlayerCharacter({
                id: 'orc1',
                hp: 10,
                maxHp: 20,
                limitedUses: {
                    [reResourceId]: { name: 'Relentless Endurance', current: 1, max: 1, resetOn: 'long_rest' }
                }
            });

            const state = { ...initialState, party: [orc] } as GameState;
            
            // Apply 5 damage
            const action: AppAction = {
                type: 'MODIFY_PARTY_HEALTH',
                payload: { characterIds: ['orc1'], amount: -5 }
            };

            const newState = characterReducer(state, action);
            const updatedOrc = newState.party![0];

            expect(updatedOrc.hp).toBe(5);
            expect(updatedOrc.limitedUses![reResourceId].current).toBe(1);
        });
    });

    describe('Adrenaline Rush', () => {
        const arResourceId = 'racial_feature_orc__adrenaline_rush__resource';

        it('should grant Temporary Hit Points equal to proficiency bonus when used', () => {
            const orc = createMockPlayerCharacter({
                id: 'orc1',
                proficiencyBonus: 3,
                limitedUses: {
                    [arResourceId]: { name: 'Adrenaline Rush', current: 3, max: 3, resetOn: 'long_rest' }
                }
            });

            const state = { ...initialState, party: [orc] } as GameState;
            
            const action: AppAction = {
                type: 'USE_LIMITED_ABILITY',
                payload: { characterId: 'orc1', abilityId: arResourceId }
            };

            const newState = characterReducer(state, action);
            const updatedOrc = newState.party![0];

            expect(updatedOrc.tempHP).toBe(3);
            expect(updatedOrc.limitedUses![arResourceId].current).toBe(2);
        });

        it('should NOT stack Temporary Hit Points (keep highest)', () => {
            const orc = createMockPlayerCharacter({
                id: 'orc1',
                proficiencyBonus: 2,
                tempHP: 5, // Already has 5
                limitedUses: {
                    [arResourceId]: { name: 'Adrenaline Rush', current: 1, max: 1, resetOn: 'long_rest' }
                }
            });

            const state = { ...initialState, party: [orc] } as GameState;
            
            const action: AppAction = {
                type: 'USE_LIMITED_ABILITY',
                payload: { characterId: 'orc1', abilityId: arResourceId }
            };

            const newState = characterReducer(state, action);
            const updatedOrc = newState.party![0];

            expect(updatedOrc.tempHP).toBe(5); // Stayed at 5
        });
    });

    describe('Temporary Hit Points Logic', () => {
        it('should absorb damage before regular HP', () => {
            const char = createMockPlayerCharacter({
                id: 'char1',
                hp: 10,
                maxHp: 10,
                tempHP: 5
            });

            const state = { ...initialState, party: [char] } as GameState;
            
            // Apply 3 damage
            const action: AppAction = {
                type: 'MODIFY_PARTY_HEALTH',
                payload: { characterIds: ['char1'], amount: -3 }
            };

            const newState = characterReducer(state, action);
            const updatedChar = newState.party![0];

            expect(updatedChar.tempHP).toBe(2);
            expect(updatedChar.hp).toBe(10);
        });

        it('should apply overflow damage to regular HP', () => {
            const char = createMockPlayerCharacter({
                id: 'char1',
                hp: 10,
                maxHp: 10,
                tempHP: 5
            });

            const state = { ...initialState, party: [char] } as GameState;
            
            // Apply 8 damage
            const action: AppAction = {
                type: 'MODIFY_PARTY_HEALTH',
                payload: { characterIds: ['char1'], amount: -8 }
            };

            const newState = characterReducer(state, action);
            const updatedChar = newState.party![0];

            expect(updatedChar.tempHP).toBe(0);
            expect(updatedChar.hp).toBe(7); // 10 - (8-5) = 7
        });
    });
});
