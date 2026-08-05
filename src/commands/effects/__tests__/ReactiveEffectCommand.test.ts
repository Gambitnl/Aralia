
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactiveEffectCommand, type ReactiveEventEmitters } from '../ReactiveEffectCommand';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../../utils/core';
import { CombatCharacter, CombatState } from '../../../types/combat';
import { MovementEventEmitter } from '../../../systems/combat/MovementEventEmitter';
import { AttackEventEmitter } from '../../../systems/combat/AttackEventEmitter';
import { CombatEventEmitter } from '../../../systems/events/CombatEvents';
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
 * Depends on: fresh movement, attack and combat emitters for isolated trigger signals,
 * plus the shared command context shape from SpellCommand.ts.
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
    let movementEmitter: MovementEventEmitter;
    let attackEmitter: AttackEventEmitter;
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

        // Every test owns fresh buses. This proves the constructor dependency
        // works and prevents listeners surviving into another test process.
        movementEmitter = MovementEventEmitter.createFresh();
        attackEmitter = AttackEventEmitter.createFresh();
        combatEmitter = new CombatEventEmitter();
        emitters = {
            movement: movementEmitter,
            attack: attackEmitter,
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

    it('executes delegated damage payloads through the command context when a movement trigger fires', async () => {
        // Keep the later event callback connected to the same state object a React
        // integration would own, so the test proves the trigger can commit real combat
        // state instead of only writing to the logger.
        let liveState = mockState;

        const alwaysCondition: EffectCondition = { type: 'always' };
        const context = createDamageContext(
            () => liveState,
            nextState => { liveState = nextState; }
        );

        const command = new ReactiveEffectCommand(
            {
                type: 'REACTIVE',
                trigger: { type: 'on_target_move', movementType: 'willing' },
                condition: alwaysCondition
            },
            context,
            emitters
        );

        try {
            // Register now, then prove a matching movement reaches the normal
            // damage command through this test's private movement bus.
            liveState = await command.execute(liveState);
            await movementEmitter.emitMovement(
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
        } finally {
            command.cleanup();
        }
    });

    it('executes only when an attack targets the protected creature', async () => {
        let liveState = mockState;
        const context = createDamageContext(
            () => liveState,
            nextState => { liveState = nextState; }
        );
        const command = new ReactiveEffectCommand({
            type: 'REACTIVE',
            trigger: { type: 'on_target_attack' },
            condition: { type: 'always' }
        }, context, emitters);

        try {
            liveState = command.execute(liveState);

            // An attack on somebody else must leave the waiting effect untouched.
            await attackEmitter.emitPreAttack('attacker-1', 'other-target', 'weapon', 'melee');
            expect(liveState.characters.find(character => character.id === target.id)?.currentHP).toBe(target.currentHP);

            // The protected target now matches, so the delegated damage fires once.
            await attackEmitter.emitPreAttack('attacker-1', target.id, 'weapon', 'melee');
            expect(liveState.characters.find(character => character.id === target.id)?.currentHP).toBe(target.currentHP - 1);
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
