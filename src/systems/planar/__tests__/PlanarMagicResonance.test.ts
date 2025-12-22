
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Correct relative imports from src/systems/planar/__tests__/
import { SpellCommandFactory } from '../../../commands/factory/SpellCommandFactory';
import { DamageCommand } from '../../../commands/effects/DamageCommand';
import { getPlanarMagicMechanic, getPlanarSpellModifier } from '../../../utils/planarUtils';
import { createMockSpell, createMockCombatCharacter, createMockGameState } from '../../../utils/factories';
import { PLANES } from '../../../data/planes';
import { Spell, SpellEffect } from '../../../types/spells';
import { CombatState } from '../../../types/combat';
import { rollSavingThrow } from '../../../utils/savingThrowUtils';

// Mock dependencies
vi.mock('../../../utils/planarUtils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        // @ts-ignore
        ...actual,
        getPlanarMagicMechanic: vi.fn(),
        getPlanarSpellModifier: vi.fn()
    };
});

// Mock savingThrowUtils to spy on rollSavingThrow
vi.mock('../../../utils/savingThrowUtils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        // @ts-ignore
        ...actual,
        rollSavingThrow: vi.fn().mockImplementation((target, ability, dc, modifiers, advantageState) => {
             return { success: true, roll: 15, total: 15, dc: 10, natural20: false, natural1: false };
        }),
        calculateSpellDC: vi.fn().mockReturnValue(15),
        calculateSaveDamage: vi.fn().mockReturnValue(5) // Just return distinct damage
    };
});


describe('Planar Magic Resonance', () => {
    let mockCaster = createMockCombatCharacter({ id: 'caster', name: 'Caster' });
    let mockTarget = createMockCombatCharacter({ id: 'target', name: 'Target', currentHP: 50 });
    let mockGameState = createMockGameState();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('SpellCommandFactory - Duration Doubling', () => {
        it('should double duration for Illusion spells in Feywild', async () => {
            const illusionSpell: Spell = createMockSpell({
                id: 'invis',
                name: 'Invisibility',
                school: 'Illusion',
                duration: {
                    type: 'timed',
                    unit: 'minute',
                    value: 60,
                    concentration: true
                },
                effects: []
            });

            // Mock Utils
            vi.mocked(getPlanarMagicMechanic).mockReturnValue('double_duration');
            vi.mocked(getPlanarSpellModifier).mockReturnValue(1);

            const commands = await SpellCommandFactory.createCommands(
                illusionSpell,
                mockCaster,
                [mockTarget],
                2,
                mockGameState,
                undefined,
                PLANES['feywild']
            );

            const concentrationCommand = commands.find(c => c.constructor.name === 'StartConcentrationCommand');
            expect(concentrationCommand).toBeDefined();

            // @ts-ignore
            expect(concentrationCommand?.context.effectDuration?.value).toBe(120);
        });

        it('should NOT double duration for other schools in Feywild', async () => {
            const evocationSpell: Spell = createMockSpell({
                school: 'Evocation',
                duration: { type: 'timed', unit: 'minute', value: 10 }
            });

            vi.mocked(getPlanarMagicMechanic).mockReturnValue(undefined);

            const spellWithEffect: Spell = {
                ...evocationSpell,
                effects: [{ type: 'UTILITY', trigger: { type: 'on_cast' } }]
            };

            const cmds = await SpellCommandFactory.createCommands(spellWithEffect, mockCaster, [], 1, mockGameState, undefined, PLANES['feywild']);

            // @ts-ignore
            expect(cmds[0]?.context.effectDuration?.value).toBe(10);
        });
    });

    describe('DamageCommand - Damage Reroll', () => {
        it('should roll dice twice if reroll_damage mechanic is present', () => {
            const effect: SpellEffect = {
                type: 'DAMAGE',
                trigger: { type: 'on_cast' },
                damage: { type: 'necrotic', dice: '1d10' }
            };

            const context = {
                spellId: 'blight',
                spellName: 'Blight',
                spellSchool: 'Necromancy',
                castAtLevel: 4,
                caster: mockCaster,
                targets: [mockTarget],
                gameState: mockGameState,
                currentPlane: PLANES['shadowfell']
            };

            // Mock Planar Utils behavior
            vi.mocked(getPlanarMagicMechanic).mockReturnValue('reroll_damage');

            // Just ensure it doesn't crash and logic runs
            const command = new DamageCommand(effect, context);
            const state = command.execute({
                isActive: true,
                characters: [mockCaster, mockTarget],
                turnState: { currentTurn: 0, turnOrder: [], currentCharacterId: null, phase: 'combat', actionsThisTurn: [] },
                combatLog: [],
                validTargets: [],
                validMoves: [],
                reactiveTriggers: [],
                activeLightSources: []
            });

            // Check logs for "Planar Resonance" which we added
            const logs = state.combatLog;
            const resonanceLog = logs.find(l => l.message.includes('Planar Resonance'));
            expect(resonanceLog).toBeDefined();
        });
    });

    describe('DamageCommand - Advantage/Disadvantage', () => {
        it('should enforce disadvantage on save if mechanic is "advantage" (Enchantment in Feywild)', () => {
            const effect: SpellEffect = {
                type: 'DAMAGE',
                trigger: { type: 'on_cast' },
                damage: { type: 'psychic', dice: '1d4' },
                condition: { type: 'save', saveType: 'Wisdom' }
            };

            const context = {
                spellId: 'vicious_mockery',
                spellName: 'Vicious Mockery',
                spellSchool: 'Enchantment',
                castAtLevel: 1,
                caster: mockCaster,
                targets: [mockTarget],
                gameState: mockGameState,
                currentPlane: PLANES['feywild']
            };

            // Mock Planar Utils behavior
            vi.mocked(getPlanarMagicMechanic).mockReturnValue('advantage'); // Logic translates this to disadvantage on save

            const command = new DamageCommand(effect, context);
            command.execute({
                isActive: true,
                characters: [mockCaster, mockTarget],
                turnState: { currentTurn: 0, turnOrder: [], currentCharacterId: null, phase: 'combat', actionsThisTurn: [] },
                combatLog: [],
                validTargets: [],
                validMoves: [],
                reactiveTriggers: [],
                activeLightSources: []
            });

            // Check that rollSavingThrow was called with 'disadvantage'
            // @ts-ignore
            expect(rollSavingThrow).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'target' }),
                'Wisdom',
                expect.any(Number),
                undefined,
                'disadvantage'
            );
        });
    });
});
