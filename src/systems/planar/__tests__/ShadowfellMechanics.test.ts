
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShadowfellMechanics, ShadowfellDespairEffect } from '../ShadowfellMechanics';
import { PlayerCharacter, GameState } from '../../../types';
import { createMockPlayerCharacter, createMockGameState } from '../../../utils/factories';
import * as SavingThrowUtils from '../../../utils/savingThrowUtils';

// Mock factories if not fully available or simply create objects
const mockCharacter = (id: string, name: string): PlayerCharacter => ({
    ...createMockPlayerCharacter(),
    id,
    name,
    finalAbilityScores: {
        Strength: 10, Dexterity: 10, Constitution: 10,
        Intelligence: 10, Wisdom: 10, Charisma: 10
    },
    conditions: []
});

describe('ShadowfellMechanics', () => {
    let gameState: GameState;
    let character: PlayerCharacter;

    beforeEach(() => {
        character = mockCharacter('char1', 'Test Character');
        gameState = createMockGameState();
        gameState.party = [character];
        gameState.notifications = [];
        vi.restoreAllMocks();
    });

    describe('checkDespair', () => {
        it('should return no despair if save is passed', () => {
            // Mock rollSavingThrow to succeed
            vi.spyOn(SavingThrowUtils, 'rollSavingThrow').mockReturnValue({     
                success: true,
                total: 20,
                roll: 20,
                dc: 15,
                natural20: true,
                natural1: false
            });

            const result = ShadowfellMechanics.checkDespair(character);

            expect(result.hasDespair).toBe(false);
            expect(result.effect).toBeUndefined();
            expect(result.message).toContain('resists');
        });

        it('should return despair if save is failed', () => {
             // Mock rollSavingThrow to fail
            vi.spyOn(SavingThrowUtils, 'rollSavingThrow').mockReturnValue({     
                success: false,
                total: 5,
                roll: 5,
                dc: 15,
                natural20: false,
                natural1: false
            });

            // Mock Math.random to deterministic value
            const mathSpy = vi.spyOn(Math, 'random');
            mathSpy.mockReturnValue(0.1); // Corresponds to roll 1 (1-2 is Apathy)

            const result = ShadowfellMechanics.checkDespair(character);

            expect(result.hasDespair).toBe(true);
            expect(result.effect?.id).toBe('apathy');
            expect(result.message).toContain('succumbs to despair');
        });
    });

    describe('applyDespairEffect', () => {
        it('should add the condition to the character', () => {
            const effect: ShadowfellDespairEffect = {
                id: 'apathy',
                name: 'Apathy',
                description: 'Descript',
                mechanicalEffect: 'Mech'
            };

            ShadowfellMechanics.applyDespairEffect(gameState, 'char1', effect);

            const updatedChar = gameState.party.find(p => p.id === 'char1');
            expect(updatedChar?.conditions).toContain('Despair: Apathy');
        });

        it('should replace existing despair effect', () => {
             const effect1: ShadowfellDespairEffect = {
                id: 'apathy',
                name: 'Apathy',
                description: 'Descript',
                mechanicalEffect: 'Mech'
            };
            const effect2: ShadowfellDespairEffect = {
                id: 'dread',
                name: 'Dread',
                description: 'Descript',
                mechanicalEffect: 'Mech'
            };

            ShadowfellMechanics.applyDespairEffect(gameState, 'char1', effect1);
            let updatedChar = gameState.party.find(p => p.id === 'char1');
            expect(updatedChar?.conditions).toContain('Despair: Apathy');

            ShadowfellMechanics.applyDespairEffect(gameState, 'char1', effect2);
            updatedChar = gameState.party.find(p => p.id === 'char1');
            expect(updatedChar?.conditions).toContain('Despair: Dread');
            expect(updatedChar?.conditions).not.toContain('Despair: Apathy');
        });
    });

    describe('clearDespair', () => {
        it('should remove despair conditions', () => {
            character.conditions = ['Despair: Apathy', 'Poisoned'];
            ShadowfellMechanics.clearDespair(gameState, 'char1');

            const updatedChar = gameState.party.find(p => p.id === 'char1');
            expect(updatedChar?.conditions).toEqual(['Poisoned']);
            expect(gameState.notifications.length).toBeGreaterThan(0);
        });

         it('should do nothing if no despair present', () => {
            character.conditions = ['Poisoned'];
            ShadowfellMechanics.clearDespair(gameState, 'char1');

            const updatedChar = gameState.party.find(p => p.id === 'char1');
            expect(updatedChar?.conditions).toEqual(['Poisoned']);
            expect(gameState.notifications.length).toBe(0);
        });
    });
});
