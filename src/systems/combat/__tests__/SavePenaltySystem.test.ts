import { describe, it, expect, beforeEach } from 'vitest';
import { SavePenaltySystem } from '../SavePenaltySystem';
import { createMockCombatCharacter, createMockCombatState } from '../../../utils/factories';
import { CombatState, CombatCharacter } from '../../../types/combat';

describe('SavePenaltySystem', () => {
    let system: SavePenaltySystem;
    let mockState: CombatState;
    let mockTarget: CombatCharacter;
    let mockCasterId = 'caster-1';

    beforeEach(() => {
        system = new SavePenaltySystem();
        mockTarget = createMockCombatCharacter({
            id: 'target-1',
            name: 'Goblin'
        });
        mockState = createMockCombatState({
            characters: [mockTarget]
        });
    });

    it('registers a save penalty correctly', () => {
        const penaltyData = {
            dice: '1d4',
            applies: 'next_save',
            duration: { type: 'rounds', value: 2 }
        };

        const newState = system.registerPenalty(
            mockState,
            mockTarget.id,
            mockCasterId,
            'Mind Sliver',
            penaltyData,
            'spell-1'
        );

        const updatedTarget = newState.characters.find(c => c.id === mockTarget.id);
        expect(updatedTarget?.savePenaltyRiders).toHaveLength(1);
        expect(updatedTarget?.savePenaltyRiders?.[0]).toMatchObject({
            dice: '1d4',
            applies: 'next_save',
            sourceName: 'Mind Sliver',
            spellId: 'spell-1'
        });
    });

    it('converts riders to modifiers with negative dice strings', () => {
        mockTarget.savePenaltyRiders = [{
            spellId: 'spell-1',
            casterId: mockCasterId,
            sourceName: 'Mind Sliver',
            dice: '1d4',
            applies: 'next_save',
            duration: { type: 'rounds', value: 2 },
            appliedTurn: 1
        }];

        const modifiers = system.getActivePenalties(mockTarget);
        expect(modifiers).toHaveLength(1);
        expect(modifiers[0].dice).toBe('-1d4');
        expect(modifiers[0].source).toBe('Mind Sliver');
    });

    it('consumes next_save penalties', () => {
        mockTarget.savePenaltyRiders = [
            {
                spellId: 'spell-1',
                casterId: mockCasterId,
                sourceName: 'Mind Sliver',
                dice: '1d4',
                applies: 'next_save',
                duration: { type: 'rounds', value: 2 },
                appliedTurn: 1
            },
            {
                spellId: 'spell-2',
                casterId: mockCasterId,
                sourceName: 'Bane',
                dice: '1d4',
                applies: 'all_saves',
                duration: { type: 'rounds', value: 10 },
                appliedTurn: 1
            }
        ];
        mockState.characters = [mockTarget];

        const newState = system.consumeNextSavePenalties(mockState, mockTarget.id);
        const updatedTarget = newState.characters.find(c => c.id === mockTarget.id);

        expect(updatedTarget?.savePenaltyRiders).toHaveLength(1);
        expect(updatedTarget?.savePenaltyRiders?.[0].sourceName).toBe('Bane');
    });

    it('expires penalties based on duration', () => {
        mockTarget.savePenaltyRiders = [
            {
                spellId: 'spell-1',
                casterId: mockCasterId,
                sourceName: 'Mind Sliver',
                dice: '1d4',
                applies: 'all_saves',
                duration: { type: 'rounds', value: 2 },
                appliedTurn: 1
            }
        ];
        mockState.characters = [mockTarget];

        // Turn 2 (1 round elapsed): should still be there
        let newState = system.expirePenalties(mockState, 2);
        expect(newState.characters[0].savePenaltyRiders).toHaveLength(1);

        // Turn 3 (2 rounds elapsed): should expire (turnsElapsed = 3-1 = 2, which is not < duration.value 2)
        newState = system.expirePenalties(mockState, 3);
        expect(newState.characters[0].savePenaltyRiders).toHaveLength(0);
    });

    it('calculates total penalty correctly (dice and flat)', () => {
        const modifiers = [
            { dice: '-1d4', source: 'Mind Sliver' },
            { flat: -2, source: 'Custom' }
        ];

        // We can't easily test the exact dice roll without mocking rollDice, 
        // but we can check if it sums them.
        const result = system.calculateTotalPenalty(modifiers);

        // Since 1d4 is rolled, result.total should be between -3 (1+2) and -6 (4+2)
        expect(result.total).toBeLessThanOrEqual(-3);
        expect(result.total).toBeGreaterThanOrEqual(-6);
        expect(result.details).toHaveLength(2);
    });
});
