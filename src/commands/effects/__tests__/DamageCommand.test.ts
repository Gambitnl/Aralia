
import { describe, it, expect, beforeEach } from 'vitest'
import { DamageCommand } from '../DamageCommand'
import { CombatState, CombatCharacter } from '../../../types/combat'
import { SpellEffect } from '../../../types/spells'
import { CommandContext } from '../base/SpellCommand'
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
});
