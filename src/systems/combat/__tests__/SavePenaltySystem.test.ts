import { describe, it, expect, beforeEach } from 'vitest';
import { SavePenaltySystem } from '../SavePenaltySystem';
import { createMockCombatCharacter, createMockCombatState } from '../../../utils/factories';
import { CombatState, CombatCharacter } from '../../../types/combat';

describe('SavePenaltySystem', () => {
    let system: SavePenaltySystem;
    let mockState: CombatState;
    let mockTarget: CombatCharacter;
    const mockCasterId = 'caster-1';

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
            id: 'rider-1', // IDs are required for SavePenaltyRider cleanup.
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
                id: 'rider-2',
                spellId: 'spell-1',
                casterId: mockCasterId,
                sourceName: 'Mind Sliver',
                dice: '1d4',
                applies: 'next_save',
                duration: { type: 'rounds', value: 2 },
                appliedTurn: 1
            },
            {
                id: 'rider-3',
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

    it('expires next_save penalties at the caster-turn boundary when no save is rolled', () => {
        const secondActor = createMockCombatCharacter({
            id: 'actor-2',
            name: 'Skeleton'
        });

        mockTarget.savePenaltyRiders = [{
            id: 'rider-5',
            spellId: 'spell-1',
            casterId: mockCasterId,
            sourceName: 'Mind Sliver',
            dice: '1d4',
            applies: 'next_save',
            duration: { type: 'rounds', value: 2 },
            appliedTurn: 1
        }];
        mockState.characters = [mockTarget, secondActor];

        // Before the documented boundary, the rider still exists if no save
        // has been rolled yet. This same-round check matters because the
        // caster's current turn is not yet the "next turn" boundary.
        mockState.turnState.currentTurn = 1;
        let newState = system.expirePenalties(mockState, mockCasterId);
        expect(newState.characters[0].savePenaltyRiders).toHaveLength(1);

        // Once the caster-relative turn window closes, the skipped save rider
        // is cleared so it cannot linger forever. The extra actor protects
        // against dividing round numbers by participant count.
        mockState.turnState.currentTurn = 2;
        newState = system.expirePenalties(mockState, mockCasterId);
        expect(newState.characters[0].savePenaltyRiders).toHaveLength(0);
    });

    it('expires penalties based on duration', () => {
        mockTarget.savePenaltyRiders = [
            {
                id: 'rider-4',
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
        mockState.turnState.currentTurn = 2; // currentTurn drives duration expiry math.
        // Use caster ID so duration-based expiration runs.
        let newState = system.expirePenalties(mockState, mockCasterId);
        expect(newState.characters[0].savePenaltyRiders).toHaveLength(1);

        // Turn 3 (2 rounds elapsed): should expire (turnsElapsed = 3-1 = 2, which is not < duration.value 2)
        mockState.turnState.currentTurn = 3;
        newState = system.expirePenalties(mockState, mockCasterId);
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
    it('collects saving throw modifiers from active effects (e.g. Bless/Bane)', () => {
        const target: any = {
            id: 'target_1',
            activeEffects: [
                {
                    id: 'bless_1',
                    sourceName: 'Bless',
                    mechanics: {
                        savingThrowModifier: 'bonus',
                        savingThrowDice: '1d4'
                    }
                },
                {
                    id: 'bane_1',
                    sourceName: 'Bane',
                    mechanics: {
                        savingThrowModifier: 'penalty',
                        savingThrowDice: '1d4'
                    }
                }
            ]
        };

        const modifiers = system.getActivePenalties(target);
        expect(modifiers).toHaveLength(2);

        const blessMod = modifiers.find(m => m.source === 'Bless');
        expect(blessMod?.dice).toBe('1d4');

        const baneMod = modifiers.find(m => m.source === 'Bane');
        expect(baneMod?.dice).toBe('-1d4');
    });
});
