import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTurnManager } from '@/hooks/combat/useTurnManager';
import { DamageCommand } from '../DamageCommand';
import {
    createMockCombatCharacter,
    createMockCombatState,
    createMockGameState,
    createMockPlayerCharacter
} from '@/utils/factories';
import { createMockSpell } from '@/utils/core/factories';
import type { CombatCharacter, LightSource } from '@/types/combat';
import type { DamageEffect } from '@/types/spells';
import type { PlayerCharacter } from '@/types';
import type { ScheduledSpellEffect } from '@/systems/spells/effects';

// These fixtures deliberately build the same concentration setup through the
// hook path and the command path so future cleanup changes cannot drift apart.
const SPELL_ID = 'bless-spell-id';
const SPELL_NAME = 'Bless';
const LINKED_STATUS_ID = 'linked-status-id';
const UNRELATED_STATUS_ID = 'unrelated-status-id';
const LINKED_CONDITION_SOURCE = SPELL_ID;
const UNRELATED_CONDITION_SOURCE = 'other-spell';
const LINKED_LIGHT_ID = 'linked-light-id';
const UNRELATED_LIGHT_ID = 'unrelated-light-id';

const makeConcentratingCaster = (currentHP: number): CombatCharacter => createMockCombatCharacter({
    id: 'caster',
    name: 'Caster',
    currentHP,
    maxHP: 1,
    concentratingOn: {
        spellId: SPELL_ID,
        spellName: SPELL_NAME,
        spellLevel: 2,
        startedTurn: 5,
        effectIds: [LINKED_STATUS_ID, LINKED_LIGHT_ID],
        canDropAsFreeAction: true
    },
    actionEconomy: {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        legendary: { used: 0, total: 0 },
        movement: { used: 0, total: 30 },
        freeActions: 1
    },
    conditions: []
});

const makeLinkedAlly = (): CombatCharacter => createMockCombatCharacter({
    id: 'ally',
    name: 'Ally',
    team: 'player',
    statusEffects: [
        {
            id: LINKED_STATUS_ID,
            name: 'Blessed',
            type: 'buff',
            duration: 3,
            source: SPELL_NAME,
            sourceCasterId: 'caster',
            effect: { type: 'condition' }
        },
        {
            id: UNRELATED_STATUS_ID,
            name: 'Blessed',
            type: 'buff',
            duration: 3,
            source: 'other-spell',
            sourceCasterId: 'other',
            effect: { type: 'condition' }
        }
    ],
    conditions: [
        {
            name: 'Blessed',
            duration: { type: 'rounds', value: 3 },
            appliedTurn: 1,
            source: LINKED_CONDITION_SOURCE
        },
        {
            name: 'Courageous',
            duration: { type: 'rounds', value: 3 },
            appliedTurn: 1,
            source: UNRELATED_CONDITION_SOURCE
        }
    ]
});

const makeUnrelatedAlly = (): CombatCharacter => createMockCombatCharacter({
    id: 'unrelated',
    name: 'Unrelated',
    team: 'player',
    statusEffects: [
        {
            id: 'unrelated-only',
            name: 'Braced',
            type: 'buff',
            duration: 3,
            source: 'other-spell',
            effect: { type: 'condition' }
        }
    ],
    conditions: [
        {
            name: 'Braced',
            duration: { type: 'rounds', value: 3 },
            appliedTurn: 1,
            source: 'other-spell'
        }
    ]
});

const buildBaseLightSources = (): LightSource[] => [
    {
        id: LINKED_LIGHT_ID,
        sourceSpellId: SPELL_ID,
        casterId: 'caster',
        brightRadius: 20,
        dimRadius: 20,
        attachedTo: 'caster',
        createdTurn: 1
    },
    {
        id: UNRELATED_LIGHT_ID,
        sourceSpellId: 'other-spell',
        casterId: 'other',
        brightRadius: 10,
        dimRadius: 10,
        attachedTo: 'point',
        position: { x: 2, y: 2 },
        createdTurn: 1
    }
];

const getLatestById = (updates: CombatCharacter[], characterId: string): CombatCharacter | undefined => {
    return [...updates].reverse().find(update => update.id === characterId);
};

const extractLossMessage = (messages: string[]): string | undefined => {
    return messages.find(message =>
        message.includes('falls unconscious') &&
        message.includes(`concentration on ${SPELL_NAME}`)
    );
};

const sanitizeLossMessage = (message: string): string => message.replace('automatically ', '');

const buildOutcomeFromState = (character: CombatCharacter | undefined, ally: CombatCharacter | undefined, logs: string[], activeLightSources: LightSource[]) => ({
    concentrationCleared: character?.concentratingOn === undefined,
    linkedStatusRemoved: ally ? !ally.statusEffects.some(effect => effect.id === LINKED_STATUS_ID) : false,
    linkedConditionRemoved: ally ? !ally.conditions?.some(condition => condition.source === LINKED_CONDITION_SOURCE) : false,
    unrelatedConditionPreserved: ally ? ally.conditions?.some(condition => condition.source === UNRELATED_CONDITION_SOURCE) : false,
    unrelatedStatusPreserved: ally ? ally.statusEffects.some(effect => effect.id === UNRELATED_STATUS_ID) : false,
    activeLights: activeLightSources.map(light => light.id),
    hasLossMessage: extractLossMessage(logs) !== undefined,
    rawLossMessage: extractLossMessage(logs),
    logs
});

const assertEquivalentConcentrationCleanup = (
    hookOutcome: ReturnType<typeof buildOutcomeFromState>,
    commandOutcome: ReturnType<typeof buildOutcomeFromState>
) => {
    expect(hookOutcome.concentrationCleared).toBe(true);
    expect(commandOutcome.concentrationCleared).toBe(true);

    expect(hookOutcome.linkedStatusRemoved).toBe(true);
    expect(commandOutcome.linkedStatusRemoved).toBe(true);

    expect(hookOutcome.linkedConditionRemoved).toBe(true);
    expect(commandOutcome.linkedConditionRemoved).toBe(true);

    expect(hookOutcome.unrelatedConditionPreserved).toBe(true);
    expect(commandOutcome.unrelatedConditionPreserved).toBe(true);
    expect(hookOutcome.unrelatedStatusPreserved).toBe(true);
    expect(commandOutcome.unrelatedStatusPreserved).toBe(true);

    expect(hookOutcome.activeLights).toContain(UNRELATED_LIGHT_ID);
    expect(commandOutcome.activeLights).toContain(UNRELATED_LIGHT_ID);
    expect(hookOutcome.activeLights).not.toContain(LINKED_LIGHT_ID);
    expect(commandOutcome.activeLights).not.toContain(LINKED_LIGHT_ID);

    expect(hookOutcome.hasLossMessage).toBe(true);
    expect(commandOutcome.hasLossMessage).toBe(true);

    expect(sanitizeLossMessage(hookOutcome.rawLossMessage ?? '')).toEqual(
        sanitizeLossMessage(commandOutcome.rawLossMessage ?? '')
    );
};

describe('Concentration break parity between hook and command paths', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('applies equivalent ally cleanup, light cleanup, and concentration-loss messaging at 0 HP', async () => {
        const caster = makeConcentratingCaster(1);
        const ally = makeLinkedAlly();
        const unrelatedAlly = makeUnrelatedAlly();

        const onCharacterUpdate = vi.fn();
        const onLogEntry = vi.fn();

        const { result: hookResult } = renderHook(() => useTurnManager({
            characters: [caster, ally, unrelatedAlly],
            mapData: null,
            onCharacterUpdate,
            onLogEntry
        }));

        const scheduledEffect: ScheduledSpellEffect = {
            id: 'scheduled-bless-damage',
            spellId: SPELL_ID,
            casterId: caster.id,
            targetId: caster.id,
            timing: 'turn_start',
            createdAtRound: 1,
            effects: [{
                type: 'DAMAGE',
                damage: { dice: '1d1', type: 'Force' },
                trigger: {
                    type: 'turn_start',
                    frequency: 'once',
                    consumption: 'unlimited',
                    movementType: 'any'
                },
                condition: { type: 'hit' }
            } as DamageEffect]
        };

        act(() => {
            hookResult.current.setActiveLightSources(buildBaseLightSources());
            hookResult.current.addScheduledSpellEffect(scheduledEffect);
            hookResult.current.initializeCombat([caster, ally, unrelatedAlly]);
        });

        act(() => {
            hookResult.current.skipToCharacter(caster.id);
        });

        const hookUpdates = onCharacterUpdate.mock.calls.map(call => call[0] as CombatCharacter);
        const hookCaster = getLatestById(hookUpdates, caster.id);
        const hookAlly = getLatestById(hookUpdates, ally.id);

        const hookOutcome = buildOutcomeFromState(
            hookCaster,
            hookAlly,
            onLogEntry.mock.calls.map(call => call[0].message),
            hookResult.current.activeLightSources
        );

        const commandCaster = createMockCombatCharacter({
            id: 'command-caster',
            name: 'Command Caster',
            team: 'enemy',
            currentHP: 15,
            maxHP: 15
        });

        const commandTarget = makeConcentratingCaster(1);
        commandTarget.team = 'player';
        const commandAlly = makeLinkedAlly();
        const commandUnrelatedAlly = makeUnrelatedAlly();
        const playerCharacters: PlayerCharacter[] = [
            createMockPlayerCharacter({ id: caster.id, name: 'Caster' }),
            createMockPlayerCharacter({ id: commandAlly.id, name: 'Ally' })
        ];
        const commandState = createMockCombatState({
            characters: [commandCaster, commandTarget, commandAlly, commandUnrelatedAlly],
            activeLightSources: buildBaseLightSources(),
            combatLog: [],
            turnState: { ...createMockCombatState().turnState, currentTurn: 0 }
        });
        const spell = createMockSpell({
            id: SPELL_ID,
            name: SPELL_NAME
        });
        const damageEffect: DamageEffect = {
            type: 'DAMAGE',
            damage: { dice: '1d1', type: 'Force' },
            trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', movementType: 'any' },
            condition: { type: 'hit' }
        };

        const command = new DamageCommand(damageEffect, {
            spellId: spell.id,
            spellName: SPELL_NAME,
            castAtLevel: 2,
            caster: commandCaster,
            targets: [commandTarget],
            gameState: createMockGameState({ party: playerCharacters })
        });

        const commandResult = await command.execute(commandState);
        const commandOutcome = buildOutcomeFromState(
            commandResult.characters.find(stateChar => stateChar.id === commandTarget.id),
            commandResult.characters.find(stateChar => stateChar.id === commandAlly.id),
            commandResult.combatLog.map(entry => entry.message),
            commandResult.activeLightSources
        );

        assertEquivalentConcentrationCleanup(hookOutcome, commandOutcome);
    });
});
