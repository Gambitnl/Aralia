import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MovementCommand } from '../MovementCommand';
import { runMoveExecutionFlow } from '../../../hooks/combat/actionExecutor/moveExecutionFlow';
import type { MoveExecutionFlowContext } from '../../../hooks/combat/actionExecutor/flowContextTypes';
import { combatEvents, MovementEvent } from '../../../systems/events/CombatEvents';
import { createMockCombatCharacter, createMockCombatState } from '@/utils/core';
import type { MovementEffect } from '@/types/spells';
import type { CombatAction, CombatCharacter } from '@/types/combat';
import type { CommandContext } from '../../base/SpellCommand';

/**
 * Proves GG-262: unit_move combat events are published consistently across
 * all movement paths (voluntary, forced push, pull, teleport, and routed forced movement).
 *
 * Each movement path sends exactly one unit_move event with consistent payload
 * fields and a reason property indicating why the unit moved.
 */
describe('GG-262: unit_move combat event publication', () => {
  let capturedEvents: MovementEvent[];
  let listener: (event: MovementEvent) => void;

  beforeEach(() => {
    capturedEvents = [];
    listener = (e: MovementEvent) => {
      capturedEvents.push(e);
    };
    combatEvents.on('unit_move', listener as (e: unknown) => void);
    return () => {
      combatEvents.off('unit_move', listener as (e: unknown) => void);
    };
  });

  it('publishes exactly one unit_move event for voluntary movement with reason "voluntary"', async () => {
    const character: CombatCharacter = createMockCombatCharacter({
      id: 'mover-1',
      name: 'Mover',
      position: { x: 1, y: 1 }
    });

    const ctx: MoveExecutionFlowContext = {
      addDamageNumber: vi.fn(),
      areaEffectTrackerRef: {
        current: {
          setZones: vi.fn(),
          handleMovement: vi.fn(() => []),
          resetTurnTriggers: vi.fn()
        } as unknown as MoveExecutionFlowContext['areaEffectTrackerRef']['current']
      },
      characters: [character],
      handleDamage: vi.fn((char) => char),
      handleOpportunityAttacks: vi.fn(async (char) => char),
      movementDebuffs: [],
      onLogEntry: vi.fn(),
      processTileEffects: vi.fn((char) => char),
      setMovementDebuffs: vi.fn(),
      setSpellZones: vi.fn(),
      spellZones: [],
      turnState: {
        currentTurn: 0,
        turnOrder: ['mover-1'],
        currentCharacterId: 'mover-1',
        phase: 'action',
        actionsThisTurn: []
      }
    };

    const action: CombatAction = {
      id: 'move-act-1',
      characterId: 'mover-1',
      type: 'move',
      targetPosition: { x: 3, y: 4 },
      cost: { type: 'movement-only', movementCost: 15 },
      timestamp: Date.now()
    };

    const result = await runMoveExecutionFlow(ctx, character, action);

    expect(result.position).toEqual({ x: 3, y: 4 });
    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0]).toEqual({
      type: 'unit_move',
      unitId: 'mover-1',
      from: { x: 1, y: 1 },
      to: { x: 3, y: 4 },
      cost: 15,
      isForced: false,
      reason: 'voluntary'
    });
  });

  it('publishes exactly one unit_move event for push movement with reason "forced"', () => {
    const caster = createMockCombatCharacter({
      id: 'caster-1',
      position: { x: 0, y: 0 }
    });
    const target = createMockCombatCharacter({
      id: 'target-1',
      position: { x: 1, y: 0 }
    });
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 0,
        turnOrder: ['caster-1', 'target-1'],
        currentCharacterId: 'caster-1',
        phase: 'action',
        actionsThisTurn: []
      }
    });

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'push',
      distance: 10,
      duration: { type: 'instant' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const context: CommandContext = {
      spellId: 'spell-thunderwave',
      spellName: 'Thunderwave',
      castAtLevel: 1,
      caster,
      targets: [target]
    };

    const command = new MovementCommand(effect, context);
    const nextState = command.execute(state);
    const movedTarget = nextState.characters.find(c => c.id === 'target-1');

    expect(movedTarget?.position).toEqual({ x: 3, y: 0 });
    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0]).toEqual({
      type: 'unit_move',
      unitId: 'target-1',
      from: { x: 1, y: 0 },
      to: { x: 3, y: 0 },
      cost: 0,
      isForced: true,
      reason: 'forced'
    });
  });

  it('publishes exactly one unit_move event for pull movement with reason "pull"', () => {
    const caster = createMockCombatCharacter({
      id: 'caster-1',
      position: { x: 0, y: 0 }
    });
    const target = createMockCombatCharacter({
      id: 'target-1',
      position: { x: 4, y: 0 }
    });
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 0,
        turnOrder: ['caster-1', 'target-1'],
        currentCharacterId: 'caster-1',
        phase: 'action',
        actionsThisTurn: []
      }
    });

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'pull',
      distance: 10,
      duration: { type: 'instant' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const context: CommandContext = {
      spellId: 'spell-thorn-whip',
      spellName: 'Thorn Whip',
      castAtLevel: 1,
      caster,
      targets: [target]
    };

    const command = new MovementCommand(effect, context);
    const nextState = command.execute(state);
    const movedTarget = nextState.characters.find(c => c.id === 'target-1');

    expect(movedTarget?.position).toEqual({ x: 2, y: 0 });
    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0]).toEqual({
      type: 'unit_move',
      unitId: 'target-1',
      from: { x: 4, y: 0 },
      to: { x: 2, y: 0 },
      cost: 0,
      isForced: true,
      reason: 'pull'
    });
  });

  it('publishes exactly one unit_move event for teleport movement with reason "teleport"', () => {
    const caster = createMockCombatCharacter({
      id: 'caster-1',
      position: { x: 2, y: 2 }
    });
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 0,
        turnOrder: ['caster-1'],
        currentCharacterId: 'caster-1',
        phase: 'action',
        actionsThisTurn: []
      }
    });

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'teleport',
      distance: 30,
      destination: { x: 6, y: 6 },
      duration: { type: 'instant' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const context: CommandContext = {
      spellId: 'spell-misty-step',
      spellName: 'Misty Step',
      castAtLevel: 2,
      caster,
      targets: [caster]
    };

    const command = new MovementCommand(effect, context);
    const nextState = command.execute(state);
    const teleported = nextState.characters.find(c => c.id === 'caster-1');

    expect(teleported?.position).toEqual({ x: 6, y: 6 });
    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0]).toEqual({
      type: 'unit_move',
      unitId: 'caster-1',
      from: { x: 2, y: 2 },
      to: { x: 6, y: 6 },
      cost: 0,
      isForced: false,
      reason: 'teleport'
    });
  });

  it('publishes exactly one unit_move event for routed forced movement with reason "forced"', () => {
    const caster = createMockCombatCharacter({
      id: 'caster-1',
      position: { x: 0, y: 0 }
    });
    const target = createMockCombatCharacter({
      id: 'target-1',
      position: { x: 1, y: 0 }
    });
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 0,
        turnOrder: ['caster-1', 'target-1'],
        currentCharacterId: 'caster-1',
        phase: 'action',
        actionsThisTurn: []
      }
    });

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'stop',
      distance: 0,
      forcedMovement: {
        direction: 'away_from_caster',
        maxDistance: '10'
      },
      duration: { type: 'instant' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const context: CommandContext = {
      spellId: 'spell-dissonant-whispers',
      spellName: 'Dissonant Whispers',
      castAtLevel: 1,
      caster,
      targets: [target]
    };

    const command = new MovementCommand(effect, context);
    const nextState = command.execute(state);
    const movedTarget = nextState.characters.find(c => c.id === 'target-1');

    expect(movedTarget?.position).toEqual({ x: 3, y: 0 });
    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0]).toEqual({
      type: 'unit_move',
      unitId: 'target-1',
      from: { x: 1, y: 0 },
      to: { x: 3, y: 0 },
      cost: 0,
      isForced: true,
      reason: 'forced'
    });
  });

  it('does not publish unit_move when movement fails or is blocked', () => {
    const caster = createMockCombatCharacter({
      id: 'caster-1',
      position: { x: 0, y: 0 }
    });
    // Target is already against an obstacle or blocker at destination
    const blocker = createMockCombatCharacter({
      id: 'blocker-1',
      position: { x: 2, y: 0 }
    });
    const target = createMockCombatCharacter({
      id: 'target-1',
      position: { x: 1, y: 0 }
    });
    const state = createMockCombatState({
      characters: [caster, target, blocker],
      turnState: {
        currentTurn: 0,
        turnOrder: ['caster-1', 'target-1', 'blocker-1'],
        currentCharacterId: 'caster-1',
        phase: 'action',
        actionsThisTurn: []
      }
    });

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'push',
      distance: 5,
      duration: { type: 'instant' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const context: CommandContext = {
      spellId: 'spell-shove',
      spellName: 'Shove',
      castAtLevel: 1,
      caster,
      targets: [target]
    };

    const command = new MovementCommand(effect, context);
    const nextState = command.execute(state);
    const unMovedTarget = nextState.characters.find(c => c.id === 'target-1');

    expect(unMovedTarget?.position).toEqual({ x: 1, y: 0 });
    expect(capturedEvents).toHaveLength(0);
  });
});
