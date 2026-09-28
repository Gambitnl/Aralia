import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactiveEffectCommand, type ReactiveEventEmitters } from '../ReactiveEffectCommand';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../../utils/core';
import { CombatCharacter, CombatState } from '../../../types/combat';
import { CombatEventEmitter } from '../../../systems/events/CombatEvents';
import type { CommandContext } from '../../base/SpellCommand';

/**
 * This file proves that reactive spell effects do more than register a future listener.
 *
 * ReactiveEffectCommand is the command that stores a waiting trigger such as "when this
 * target moves" or "when this target attacks". These tests cover the registration path and
 * the delegated-payload path where the later trigger replays normal effect commands against
 * the current combat state.
 *
 * `on_target_move` and `on_target_attack` register NO event listener (agora-f821.45).
 * They only write a row into `state.reactiveTriggers`, and the hook layer reads
 * that array: `useActionExecutor.resolveOnTargetAttackReactiveEffects` for an
 * attack and the movement-debuff pipeline for a move. The emitters those two
 * branches used to listen on had no production caller and were deleted, so the
 * tests that fired them went with them.
 *
 * Called by: focused command-effect test runs.
 * Depends on: a fresh combat emitter for an isolated cast signal, plus the shared
 * command context shape from SpellCommand.ts.
 */

// Keep command diagnostics quiet while the assertions focus on state changes.
vi.mock('../../../utils/core/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('ReactiveEffectCommand event listeners', () => {
    let mockState: CombatState;
    let caster: CombatCharacter;
    let target: CombatCharacter;
    let combatEmitter: CombatEventEmitter;
    let emitters: ReactiveEventEmitters;

    beforeEach(() => {
        caster = createMockCombatCharacter({ id: 'caster-1', name: 'Wizard' });
        target = createMockCombatCharacter({ id: 'target-1', name: 'Goblin' });

        mockState = createMockCombatState({
            characters: [caster, target],
            turnState: {
                currentTurn: 1,
                turnOrder: [caster.id, target.id],
                currentCharacterId: caster.id,
                phase: 'action',
                actionsThisTurn: [],
            },
            combatLog: [],
            reactiveTriggers: [],
            activeLightSources: []
        });

        // Every test owns a fresh bus. This proves the constructor dependency
        // works and prevents listeners surviving into another test process.
        combatEmitter = new CombatEventEmitter();
        emitters = {
            combat: combatEmitter
        };

        vi.clearAllMocks();
    });

    const createDamageContext = (
        getState: () => CombatState,
        commitState: (nextState: CombatState) => void
    ): CommandContext => ({
        spellId: 'spell-1',
        spellName: 'Reactive Spark',
        castAtLevel: 1,
        caster,
        targets: [target],
        gameState: createMockGameState(),
        delegatedReactivePayload: {
            // A 1d1 payload gives every listener a deterministic visible result.
            effects: [{
                type: 'DAMAGE',
                trigger: { type: 'immediate' },
                condition: { type: 'always' },
                damage: { dice: '1d1', type: 'Fire' }
            }],
            getState,
            commitState
        }
    });

    it.each([
        ['on_target_move'] as const,
        ['on_target_attack'] as const,
    ])('records a %s trigger on combat state instead of registering an emitter listener', (triggerType) => {
        let liveState = mockState;
        const context = createDamageContext(
            () => liveState,
            nextState => { liveState = nextState; }
        );
        const command = new ReactiveEffectCommand({
            type: 'REACTIVE',
            trigger: { type: triggerType },
            condition: { type: 'always' }
        }, context, emitters);

        try {
            liveState = command.execute(liveState);

            // The trigger row is the whole registration. It names the protected
            // creature so the hook-side resolver can match it later.
            const registered = liveState.reactiveTriggers
                .filter(trigger => trigger.sourceEffect.trigger.type === triggerType);
            expect(registered).toHaveLength(1);
            expect(registered[0].targetId).toBe(target.id);
            expect(registered[0].casterId).toBe(caster.id);
            expect(registered[0].sourceSpellId).toBe('spell-1');

            // Nothing was applied at registration time.
            expect(liveState.characters.find(character => character.id === target.id)?.currentHP)
                .toBe(target.currentHP);
        } finally {
            command.cleanup();
        }
    });

    it('executes only when the protected creature casts a spell', async () => {
        let liveState = mockState;
        const context = createDamageContext(
            () => liveState,
            nextState => { liveState = nextState; }
        );
        const command = new ReactiveEffectCommand({
            type: 'REACTIVE',
            trigger: { type: 'on_target_cast' },
            condition: { type: 'always' }
        }, context, emitters);

        try {
            liveState = command.execute(liveState);

            // A different caster must not trigger the protected creature's effect.
            combatEmitter.emit({
                type: 'unit_cast',
                casterId: 'other-caster',
                spellId: 'other-spell',
                targets: [target.id]
            });
            expect(liveState.characters.find(character => character.id === target.id)?.currentHP).toBe(target.currentHP);

            combatEmitter.emit({
                type: 'unit_cast',
                casterId: target.id,
                spellId: 'triggering-spell',
                targets: [caster.id]
            });

            // CombatEventEmitter dispatches synchronously but does not await an
            // asynchronous listener, so wait for the delegated command to commit.
            await vi.waitFor(() => {
                expect(liveState.characters.find(character => character.id === target.id)?.currentHP).toBe(target.currentHP - 1);
            });
        } finally {
            command.cleanup();
        }
    });
});
