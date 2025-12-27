import { describe, expect, it } from 'vitest';
import { UtilityCommand } from '../effects/UtilityCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState, Position } from '@/types/combat';
import type { UtilityEffect } from '@/types/spells';

const baseStats = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    baseInitiative: 0,
    speed: 30,
    cr: '0'
};

const baseEconomy = {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    movement: { used: 0, total: 30 },
    freeActions: 0
};

// TODO: Supply a strongly typed class enum or `CharacterClass` instead of casting `'Wizard' as any` once those helpers are available.
const makeCharacter = (id: string, position: Position): CombatCharacter => ({
    id,
    name: id,
    level: 2,
    class: 'Wizard' as any,
    position,
    stats: { ...baseStats },
    abilities: [],
    team: 'player',
    currentHP: 10,
    maxHP: 10,
    initiative: 0,
    statusEffects: [],
    conditions: [],
    actionEconomy: { ...baseEconomy }
});

const makeState = (characters: CombatCharacter[]): CombatState => ({
    isActive: true,
    characters,
    turnState: {
        currentTurn: 1,
        turnOrder: characters.map(c => c.id),
        currentCharacterId: characters[0]?.id ?? null,
        phase: 'action',
        actionsThisTurn: []
    },
    selectedCharacterId: null,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: [],
    activeLightSources: []
});

// TODO: Replace the `{} as any` gameState with a minimal typed mock so the `CommandContext` shape is satisfied without masking lint rules.
const makeContext = (caster: CombatCharacter, targets: CombatCharacter[]): CommandContext => ({
    spellId: 'light',
    spellName: 'Light',
    castAtLevel: 0,
    caster,
    targets,
    gameState: {} as any
});

describe('LightMechanics', () => {
    describe('UtilityCommand with light effect', () => {
        it('creates a light source when light config is provided', () => {
            const caster = makeCharacter('caster', { x: 0, y: 0 });
            const target = makeCharacter('target', { x: 1, y: 0 });
            const state = makeState([caster, target]);

            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'light',
                description: 'Object sheds bright light in a 20-foot radius.',
                trigger: { type: 'immediate' },
                condition: { type: 'always' },
                light: {
                    brightRadius: 20,
                    dimRadius: 20,
                    attachedTo: 'target',
                    color: 'warm'
                }
            };

            const command = new UtilityCommand(effect, makeContext(caster, [target]));
            const result = command.execute(state);

            // Verify light source was created
            expect(result.activeLightSources).toHaveLength(1);
            const lightSource = result.activeLightSources[0];
            expect(lightSource.brightRadius).toBe(20);
            expect(lightSource.dimRadius).toBe(20);
            expect(lightSource.attachedTo).toBe('target');
            expect(lightSource.attachedToCharacterId).toBe('target');
            expect(lightSource.color).toBe('warm');
            expect(lightSource.casterId).toBe('caster');
            expect(lightSource.sourceSpellId).toBe('light');
        });

        it('attaches light to caster when attachedTo is caster', () => {
            const caster = makeCharacter('caster', { x: 0, y: 0 });
            const state = makeState([caster]);

            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'light',
                description: 'Caster glows.',
                trigger: { type: 'immediate' },
                condition: { type: 'always' },
                light: {
                    brightRadius: 10,
                    attachedTo: 'caster'
                }
            };

            const command = new UtilityCommand(effect, makeContext(caster, []));
            const result = command.execute(state);

            expect(result.activeLightSources).toHaveLength(1);
            const lightSource = result.activeLightSources[0];
            expect(lightSource.attachedTo).toBe('caster');
            expect(lightSource.attachedToCharacterId).toBe('caster');
            expect(lightSource.dimRadius).toBe(0); // Should default to 0
        });

        it('sets position for point-attached light without targets', () => {
            const caster = makeCharacter('caster', { x: 5, y: 5 });
            const state = makeState([caster]);

            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'light',
                description: 'Light at a point.',
                trigger: { type: 'immediate' },
                condition: { type: 'always' },
                light: {
                    brightRadius: 15,
                    dimRadius: 10,
                    attachedTo: 'point'
                }
            };

            const command = new UtilityCommand(effect, makeContext(caster, []));
            const result = command.execute(state);

            expect(result.activeLightSources).toHaveLength(1);
            const lightSource = result.activeLightSources[0];
            expect(lightSource.attachedTo).toBe('point');
            expect(lightSource.position).toEqual({ x: 5, y: 5 }); // Falls back to caster position
        });

        it('does not create light source without light config', () => {
            const caster = makeCharacter('caster', { x: 0, y: 0 });
            const state = makeState([caster]);

            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'light',
                description: 'Just narrative light.',
                trigger: { type: 'immediate' },
                condition: { type: 'always' }
                // No light config
            };

            const command = new UtilityCommand(effect, makeContext(caster, []));
            const result = command.execute(state);

            expect(result.activeLightSources).toHaveLength(0);
        });

        it('logs light source creation', () => {
            const caster = makeCharacter('caster', { x: 0, y: 0 });
            const state = makeState([caster]);

            const effect: UtilityEffect = {
                type: 'UTILITY',
                utilityType: 'light',
                description: 'Light appears.',
                trigger: { type: 'immediate' },
                condition: { type: 'always' },
                light: {
                    brightRadius: 20,
                    dimRadius: 20,
                    attachedTo: 'caster'
                }
            };

            const command = new UtilityCommand(effect, makeContext(caster, []));
            const result = command.execute(state);

            // Check for log entries
            const lightLog = result.combatLog.find(entry =>
                entry.message.includes('light source appears')
            );
            expect(lightLog).toBeDefined();
            expect(lightLog?.message).toContain('20 ft bright');
            expect(lightLog?.message).toContain('20 ft dim');
        });
    });
});
