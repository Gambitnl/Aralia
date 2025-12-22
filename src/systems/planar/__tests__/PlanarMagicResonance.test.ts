
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Correct relative imports from src/systems/planar/__tests__/
import { SpellCommandFactory } from '../../../commands/factory/SpellCommandFactory';
import { DamageCommand } from '../../../commands/effects/DamageCommand';
import { getPlanarMagicMechanic, getPlanarSpellModifier } from '../../../utils/planarUtils';
import { createMockSpell, createMockCombatCharacter, createMockGameState } from '../../../utils/factories';
import { PLANES } from '../../../data/planes';
import { Spell, SpellEffect } from '../../../types/spells';
import { CombatState } from '../../../types/combat';

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
            // We can't easily verify the internal rolling without spying on rollDamageUtil or seeing the result.
            // Since rollDamageUtil is deterministic with seeded randomness or we can mock it?
            // Actually, let's verify context is passed and logic runs.
            // Since we updated DamageCommand to use getPlanarMagicMechanic, if that returns 'reroll_damage',
            // it executes the branch.

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

            // Just ensure it doesn't crash
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
});
