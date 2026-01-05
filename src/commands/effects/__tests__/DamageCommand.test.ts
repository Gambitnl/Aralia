
import { describe, it, expect, beforeEach } from 'vitest'
import { DamageCommand } from '../DamageCommand'
import { CombatState, CombatCharacter } from '../../../types/combat'
import { SpellEffect } from '../../../types/spells'
import { CommandContext } from '../../base/SpellCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../../utils/factories'

describe('DamageCommand', () => {
    let mockState: CombatState;
    let mockCaster: CombatCharacter;
    let mockTarget: CombatCharacter;
    let mockContext: CommandContext;

    beforeEach(() => {
        mockCaster = createMockCombatCharacter({
            id: 'caster-1',
            name: 'Hero',
            position: { x: 0, y: 0 },
            currentHP: 10,
            maxHP: 20
        });
        mockCaster.stats.intelligence = 16;

        mockTarget = createMockCombatCharacter({
            id: 'target-1',
            name: 'Goblin',
            position: { x: 1, y: 1 },
            currentHP: 10,
            maxHP: 10,
            armorClass: 12,
            resistances: [],
            vulnerabilities: [],
            immunities: []
        });
        mockTarget.stats.constitution = 10;

        mockState = createMockCombatState({
            characters: [mockCaster, mockTarget],
            combatLog: []
        });

        mockContext = {
            spellId: 'spell-1',
            spellName: 'Fireball',
            caster: mockCaster,
            targets: [mockTarget],
            gameState: createMockGameState(),
            castAtLevel: 3
        };
    });

    it('generates a descriptive log message for fire damage', () => {
        const effect: SpellEffect = {
            type: "DAMAGE",
            damage: {
                dice: '2d6',
                type: 'Fire'
            },
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        };

        const command = new DamageCommand(effect, mockContext);

        const newState = command.execute(mockState);
        const logEntry = newState.combatLog.find(l => l.type === 'damage');

        expect(logEntry).toBeDefined();
        // Expected: "Hero scorches Goblin with Fireball for X fire damage"
        expect(logEntry?.message).toMatch(/Hero (scorches|incinerates|burns|chars) Goblin with Fireball for \d+ fire damage/);
    });

    it('generates a descriptive log message for slashing damage', () => {
        const effect: SpellEffect = {
            type: "DAMAGE",
            damage: {
                dice: '1d6',
                type: 'Slashing'
            },
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        };

        // Update context for a weapon attack
        const weaponContext = { ...mockContext, spellName: 'Longsword' };

        const command = new DamageCommand(effect, weaponContext);
        const newState = command.execute(mockState);
        const logEntry = newState.combatLog.find(l => l.type === 'damage');

        expect(logEntry).toBeDefined();
        // Updated regex to include 'slices' which is in the map
        expect(logEntry?.message).toMatch(/Hero (slashes|cleaves|cuts|slices) Goblin with Longsword for \d+ slashing damage/);
    });

    it('handles generic "Attack" name gracefully', () => {
        const effect: SpellEffect = {
            type: "DAMAGE",
            damage: {
                dice: '1d6',
                type: 'Bludgeoning'
            },
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        };

        const genericContext = { ...mockContext, spellName: 'Attack' };
        const command = new DamageCommand(effect, genericContext);
        const newState = command.execute(mockState);
        const logEntry = newState.combatLog.find(l => l.type === 'damage');

        expect(logEntry?.message).toMatch(/Hero (batters|crushes|bludgeons|pummels) Goblin/);
    });

    describe('Slasher Feat', () => {
        beforeEach(() => {
            // Robustly update the caster in the state to ensure feats are present
            const casterIndex = mockState.characters.findIndex(c => c.id === mockCaster.id);
            if (casterIndex >= 0) {
                const updatedCaster = {
                    ...mockState.characters[casterIndex],
                    feats: ['slasher']
                };
                const newCharacters = [...mockState.characters];
                newCharacters[casterIndex] = updatedCaster;

                mockState = {
                    ...mockState,
                    characters: newCharacters
                };
            }
        });

        it('applies speed reduction on slashing damage', () => {
            const effect: SpellEffect = {
                type: "DAMAGE",
                damage: { dice: '1d6', type: 'Slashing' },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            };

            const command = new DamageCommand(effect, mockContext);
            const newState = command.execute(mockState);

            // Check if speed reduction effect was applied to target
            const speedEffect = newState.characters.find(c => c.id === mockTarget.id)
                ?.statusEffects.find(e => e.name === 'Slasher Slow');

            expect(speedEffect).toBeDefined();
            expect(speedEffect?.effect?.stat).toBe('speed');
            expect(speedEffect?.effect?.value).toBe(-10);

            // Check if usage was tracked on caster
            const updatedCaster = newState.characters.find(c => c.id === mockCaster.id);
            expect(updatedCaster?.featUsageThisTurn).toContain('slasher_slow');
        });

        it('applies grievous wound on critical hit with slashing damage', () => {
            const effect: SpellEffect = {
                type: "DAMAGE",
                damage: { dice: '1d6', type: 'Slashing' },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            };

            const criticalContext = { ...mockContext, isCritical: true };
            const command = new DamageCommand(effect, criticalContext);
            const newState = command.execute(mockState);

            // Check for Grievous Wound active effect
            const targetChar = newState.characters.find(c => c.id === mockTarget.id);
            const grievousWound = targetChar?.activeEffects?.find(e => e.sourceName === 'Slasher Grievous Wound');

            expect(grievousWound).toBeDefined();
            expect(grievousWound?.mechanics?.disadvantageOnAttacks).toBe(true);

            // Should also apply speed slow (if not used)
            const speedEffect = targetChar?.statusEffects.find(e => e.name === 'Slasher Slow');
            expect(speedEffect).toBeDefined();
        });

        it('does not apply slasher effects for non-slashing damage', () => {
            const effect: SpellEffect = {
                type: "DAMAGE",
                damage: { dice: '1d6', type: 'Bludgeoning' },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            };

            const command = new DamageCommand(effect, mockContext);
            const newState = command.execute(mockState);

            const speedEffect = newState.characters.find(c => c.id === mockTarget.id)
                ?.statusEffects.find(e => e.name === 'Slasher Slow');
            expect(speedEffect).toBeUndefined();
        });

        it('only applies speed reduction once per turn', () => {
            const effect: SpellEffect = {
                type: "DAMAGE",
                damage: { dice: '1d6', type: 'Slashing' },
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
            };

            const command = new DamageCommand(effect, mockContext);

            // First hit
            let newState = command.execute(mockState);

            // Verify first application
            let updatedCaster = newState.characters.find(c => c.id === mockCaster.id);
            expect(updatedCaster?.featUsageThisTurn).toContain('slasher_slow');

            // Reset logs for clarity, keep state
            newState = { ...newState, combatLog: [] };

            // Second hit (simulate by running command again on the new state)
            // Note: In a real turn, we'd reuse the same state. 
            // We need to ensure the command uses the *updated* caster from newState to see the usage flag.

            // Important: The command.execute implementation calls this.getCaster(currentState).
            // So if we pass the newState, it should fetch the updated caster.
            const command2 = new DamageCommand(effect, mockContext);
            const finalState = command2.execute(newState);

            // Check logs to ensure "Slasher feat slows" message appears only once (in the first execution's log history, effectively)
            // But here we cleared logs. So we expect NO new log about slowing.
            const slowLog = finalState.combatLog.find(l => l.message.includes('Slasher feat slows'));
            expect(slowLog).toBeUndefined();
        });
    });
});
