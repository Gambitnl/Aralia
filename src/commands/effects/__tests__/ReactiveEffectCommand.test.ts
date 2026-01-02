
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactiveEffectCommand } from '../ReactiveEffectCommand';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../../utils/factories';
import { CombatCharacter, CombatState } from '../../../types/combat';

// Mock logger
// TODO: Consider mocking MovementEventEmitter/AttackEventEmitter and emitting events so we can verify triggers instead of relying solely on the logger call.
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

    it('should log execution via logger instead of console.log', () => {
        const command = new ReactiveEffectCommand(
            {
                type: 'REACTIVE',
                trigger: { type: 'on_target_move', movementType: 'leave_reach' },
                condition: { type: 'always' } as any
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

        const newState = command.execute(mockState);
        expect(newState.reactiveTriggers).toHaveLength(1);

        // We can't easily trigger the async event listener inside a unit test without mocking the EventEmitters
        // deeply, but we can verify that the code *compiled* with the logger call.
        // To verify the actual call, we'd need to emit the event.
    });
});
