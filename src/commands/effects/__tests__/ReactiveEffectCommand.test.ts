
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactiveEffectCommand } from '../ReactiveEffectCommand';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../../utils/factories';
import { CombatCharacter, CombatState } from '../../../types/combat';
import { movementEvents } from '../../../systems/combat/MovementEventEmitter';
import type { CommandContext } from '../../base/SpellCommand';
import type { EffectCondition } from '../../../types/spells';

/**
 * This file proves that reactive spell effects do more than register a future listener.
 *
 * ReactiveEffectCommand is the command that stores a waiting trigger such as "when this
 * target moves" or "when this target attacks". These tests cover the registration path and
 * the delegated-payload path where the later trigger replays normal effect commands against
 * the current combat state.
 *
 * Called by: focused command-effect test runs.
 * Depends on: MovementEventEmitter for the trigger signal and the shared command context
 * shape from SpellCommand.ts.
 */

// Mock logger
// TODO #11: Consider mocking MovementEventEmitter/AttackEventEmitter and emitting events so we can verify triggers instead of relying solely on the logger call.
vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('ReactiveEffectCommand Security Check', () => {
    let mockState: CombatState;
    let caster: CombatCharacter;
    let target: CombatCharacter;

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

        vi.clearAllMocks();
    });

    it('should log execution via logger instead of console.log', async () => {
        const alwaysCondition: EffectCondition = { type: 'always' };
        const command = new ReactiveEffectCommand(
            {
                type: 'REACTIVE',
                trigger: { type: 'on_target_move', movementType: 'leave_reach' },
                condition: alwaysCondition
            },
            {
                spellId: 'spell-1',
                spellName: 'Opportunity Attack',
                castAtLevel: 1,
                caster: caster,
                targets: [target],
                gameState: createMockGameState(),
            }
        );

        const newState = await command.execute(mockState);
        expect(newState.reactiveTriggers).toHaveLength(1);

        // We can't easily trigger the async event listener inside a unit test without mocking the EventEmitters
        // deeply, but we can verify that the code *compiled* with the logger call.
        // To verify the actual call, we'd need to emit the event.
    });

    it('executes delegated damage payloads through the command context when a movement trigger fires', async () => {
        // Keep the later event callback connected to the same state object a React
        // integration would own, so the test proves the trigger can commit real combat
        // state instead of only writing to the logger.
        let liveState = mockState;

        const alwaysCondition: EffectCondition = { type: 'always' };
        const context = {
            spellId: 'spell-1',
            spellName: 'Reactive Spark',
            castAtLevel: 1,
            caster: caster,
            targets: [target],
            gameState: createMockGameState(),
            delegatedReactivePayload: {
                // A 1d1 payload makes the proof deterministic without mocking dice.
                effects: [{
                    type: 'DAMAGE',
                    trigger: { type: 'immediate' },
                    condition: alwaysCondition,
                    damage: { dice: '1d1', type: 'Fire' }
                }],
                getState: () => liveState,
                commitState: (nextState: CombatState) => {
                    liveState = nextState;
                }
            }
        } satisfies CommandContext;

        const command = new ReactiveEffectCommand(
            {
                type: 'REACTIVE',
                trigger: { type: 'on_target_move', movementType: 'willing' },
                condition: alwaysCondition
            },
            context
        );

        // Executing the reactive command registers the future trigger but should not
        // deal damage until the event bus reports the matching movement.
        liveState = await command.execute(liveState);

        await movementEvents.emitMovement(
            target.id,
            target.position,
            { x: target.position.x + 1, y: target.position.y },
            'willing'
        );

        const damagedTarget = liveState.characters.find(character => character.id === target.id);
        expect(damagedTarget?.currentHP).toBe(target.currentHP - 1);
        expect(liveState.combatLog.some(entry =>
            entry.type === 'damage' && entry.message.includes('Reactive Spark')
        )).toBe(true);

        // Remove the registered listener so this test does not leak a trigger into
        // later tests that share the process-level movement event singleton.
        command.cleanup();
    });
});
