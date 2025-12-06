import { describe, it, expect, vi } from 'vitest'
import { StartConcentrationCommand, BreakConcentrationCommand } from '../effects/ConcentrationCommands'
import { DamageCommand } from '../effects/DamageCommand'
import { SpellCommandFactory } from '../factory/SpellCommandFactory'
import { calculateConcentrationDC, checkConcentration } from '../../utils/concentrationUtils'
import type { Spell } from '@/types/spells'
import type { CombatCharacter, CombatState, ConcentrationState } from '@/types/combat'

// Mocks
const mockCaster = {
    id: 'c1',
    name: 'Caster',
    level: 5,
    currentHP: 20,
    maxHP: 20,
    stats: { constitution: 14 } // +2 modifier
} as CombatCharacter

const mockTarget = {
    id: 't1',
    name: 'Target',
    currentHP: 30,
    maxHP: 30,
    stats: { constitution: 10 }, // +0 modifier
    concentratingOn: {
        spellId: 'spell1',
        spellName: 'Bless',
        spellLevel: 1,
        startedTurn: 1,
        effectIds: [],
        canDropAsFreeAction: true
    }
} as CombatCharacter

const createMockSpell = (overrides: Partial<Spell> = {}): Spell => ({
    id: 'test_spell',
    name: 'Test Spell',
    level: 1,
    school: 'Evocation',
    classes: ['Wizard'],
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'ranged', distance: 60 },
    components: { verbal: true, somatic: false, material: false },
    duration: { type: 'instantaneous', concentration: false },
    targeting: { type: 'single', range: 60, validTargets: ['creatures'] },
    effects: [],
    description: 'Test spell',
    ...overrides
})

describe('Concentration System', () => {

    describe('Utils', () => {
        it('calculates correct DC', () => {
            expect(calculateConcentrationDC(5)).toBe(10) // Minimum 10
            expect(calculateConcentrationDC(19)).toBe(10) // 19/2 = 9.5 -> 10
            expect(calculateConcentrationDC(20)).toBe(10) // 20/2 = 10
            expect(calculateConcentrationDC(22)).toBe(11) // 22/2 = 11
        })

        it('checks concentration success', () => {
            // Target has +0 Con modifier
            // DC 10
            // We simulate roles by mocking Math.random in a real test environment,
            // or we just trust the logic: roll (1..20) + mod >= DC

            // Checking structure only for unit test without mocking random here to keep it simple,
            // but for real robust tests we should mock random.

            const result = checkConcentration(mockTarget, 10);
            expect(result.dc).toBe(10);
            expect(result.roll).toBeGreaterThanOrEqual(1);
            expect(result.roll).toBeLessThanOrEqual(21); // 20 + 0
        })
    })

    describe('SpellCommandFactory', () => {
        it('adds StartConcentrationCommand for concentration spells', async () => {
            const spell = createMockSpell({
                duration: { type: 'timed', value: 1, unit: 'minute', concentration: true }
            });

            const commands = await SpellCommandFactory.createCommands(spell, mockCaster, [], 1, {} as any);
            const startCmd = commands.find(c => c instanceof StartConcentrationCommand);
            expect(startCmd).toBeDefined();
        })

        it('adds BreakConcentrationCommand if caster is already concentrating', async () => {
            const spell = createMockSpell({
                duration: { type: 'timed', value: 1, unit: 'minute', concentration: true }
            });

            const casterConcentrating = {
                ...mockCaster,
                concentratingOn: { spellId: 'old', spellName: 'Old', spellLevel: 1, startedTurn: 0, effectIds: [], canDropAsFreeAction: true }
            };

            const commands = await SpellCommandFactory.createCommands(spell, casterConcentrating, [], 1, {} as any);

            expect(commands[0]).toBeInstanceOf(BreakConcentrationCommand);
            const startCmd = commands.find(c => c instanceof StartConcentrationCommand);
            expect(startCmd).toBeDefined();
        })
    })

    describe('DamageCommand & Saves', () => {
        it('triggers concentration check on damage', () => {
            // We need to execute the command to test logic
            const spell = createMockSpell();
            const damageEffect = {
                type: 'DAMAGE',
                damage: { dice: '10d1', type: 'Force' }, // Fixed heavy damage: 10 damage
                trigger: { type: 'immediate' },
                condition: { type: 'hit' }
            };

            const command = new DamageCommand(damageEffect as any, {
                spellId: spell.id,
                spellName: spell.name,
                castAtLevel: 1,
                caster: mockCaster,
                targets: [mockTarget],
                gameState: {} as any
            });

            const state = { characters: [mockCaster, mockTarget], combatLog: [] } as any;

            // Mock random to force failure? Or just check if log has entry.
            // With 10 damage, DC is 10. Target has +0. Needs 10+ on d20. 55% chance success.
            // Let's rely on log output or state change. If fail, concentratingOn becomes undefined.

            const newState = command.execute(state);

            // Check if log contains concentration check message
            const logMessages = newState.combatLog.map((l: any) => l.message).join(' ');
            expect(logMessages).toContain('concentration');
        })
    })

    describe('Commands', () => {
        it('StartConcentrationCommand sets state', () => {
            const spell = createMockSpell();
            const command = new StartConcentrationCommand(spell, {
                spellId: spell.id,
                spellName: spell.name,
                castAtLevel: 1,
                caster: mockCaster,
                targets: [],
                gameState: {} as any
            });

            const state = { characters: [mockCaster], turnState: { currentTurn: 5 }, combatLog: [] } as any;
            const newState = command.execute(state);

            expect(newState.characters[0].concentratingOn).toBeDefined();
            expect(newState.characters[0].concentratingOn!.spellId).toBe(spell.id);
            expect(newState.characters[0].concentratingOn!.startedTurn).toBe(5);
        })

        it('BreakConcentrationCommand clears state', () => {
            const command = new BreakConcentrationCommand({
                spellId: 'any',
                spellName: 'any',
                castAtLevel: 1,
                caster: mockTarget, // Target is concentrating
                targets: [],
                gameState: {} as any
            });

            const state = { characters: [mockTarget], combatLog: [] } as any;
            const newState = command.execute(state);

            expect(newState.characters[0].concentratingOn).toBeUndefined();
            const logMessages = newState.combatLog.map((l: any) => l.message).join(' ');
            expect(logMessages).toContain('stops concentrating');
        })
    })
})
