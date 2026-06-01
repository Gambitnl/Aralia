import { describe, it, expect } from 'vitest';
import { MovementCommand } from '../MovementCommand';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories';
import { MovementEffect } from '@/types/spells';
import { CommandContext } from '../../base/SpellCommand';

describe('MovementCommand - Reaction Usage', () => {
  it('consumes reaction if usesReaction is true', () => {
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster', position: { x: 0, y: 0 } });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target', position: { x: 1, y: 1 } });
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: { currentTurn: 0, turnOrder: [], currentCharacterId: 'caster', phase: 'planning', actionsThisTurn: [] }
    });

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'stop', // Using stop since that's where applyStop is called
      distance: 0,
      duration: {
        type: 'rounds',
        value: 1
      },
      forcedMovement: {
        usesReaction: true,
        direction: 'away_from_caster',
        maxDistance: 'target_speed'
      },
      trigger: { type: 'immediate', frequency: 'every_time', movementType: 'any' },
      condition: { type: 'always' }
    };

    const context: CommandContext = {
      spellId: 'test_spell',
      spellName: 'Test Spell',
      castAtLevel: 1,
      caster,
      targets: [target],
      gameState: createMockGameState()
    };

    const command = new MovementCommand(effect, context);

    // Ensure reaction starts as unused
    expect(target.actionEconomy.reaction.used).toBe(false);

    // Apply command
    const nextState = command.execute(state);

    // After command, reaction should be used
    const updatedTarget = nextState.characters.find(c => c.id === 'target')!;
    expect(updatedTarget.actionEconomy.reaction.used).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Forced Movement Routing
// ----------------------------------------------------------------------------
// Walking-style forced movement, such as fear-like movement away from a caster,
// should use the battle-map pathfinder when map data exists. Physical push/pull
// still stays straight-line, but this branch proves the stop/forcedMovement path
// can route around a wall instead of stopping at the first blocked tile.
// ----------------------------------------------------------------------------
describe('MovementCommand - forced movement routing', () => {
  it('routes away-from-caster forced movement around blocked map tiles', () => {
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster', position: { x: 0, y: 0 } });
    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target',
      position: { x: 1, y: 0 },
      stats: { speed: 15 } as any
    });
    const tiles = new Map([
      ['0-0', { id: '0-0', coordinates: { x: 0, y: 0 }, terrain: 'floor', elevation: 0, movementCost: 1, blocksMovement: false, blocksLoS: false, decoration: null, effects: [] }],
      ['1-0', { id: '1-0', coordinates: { x: 1, y: 0 }, terrain: 'floor', elevation: 0, movementCost: 1, blocksMovement: false, blocksLoS: false, decoration: null, effects: [] }],
      ['2-0', { id: '2-0', coordinates: { x: 2, y: 0 }, terrain: 'wall', elevation: 0, movementCost: 1, blocksMovement: true, blocksLoS: true, decoration: null, effects: [] }],
      ['3-0', { id: '3-0', coordinates: { x: 3, y: 0 }, terrain: 'floor', elevation: 0, movementCost: 1, blocksMovement: false, blocksLoS: false, decoration: null, effects: [] }],
      ['1-1', { id: '1-1', coordinates: { x: 1, y: 1 }, terrain: 'floor', elevation: 0, movementCost: 1, blocksMovement: false, blocksLoS: false, decoration: null, effects: [] }],
      ['2-1', { id: '2-1', coordinates: { x: 2, y: 1 }, terrain: 'floor', elevation: 0, movementCost: 1, blocksMovement: false, blocksLoS: false, decoration: null, effects: [] }],
      ['3-1', { id: '3-1', coordinates: { x: 3, y: 1 }, terrain: 'floor', elevation: 0, movementCost: 1, blocksMovement: false, blocksLoS: false, decoration: null, effects: [] }]
    ]);
    const mapData = { id: 'forced-route-map', name: 'Forced Route Map', dimensions: { width: 4, height: 2 }, tiles } as any;
    const state = createMockCombatState({
      characters: [caster, target],
      mapData,
      turnState: { currentTurn: 0, turnOrder: [], currentCharacterId: 'caster', phase: 'planning', actionsThisTurn: [] }
    });
    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'stop',
      distance: 0,
      duration: { type: 'rounds', value: 1 },
      forcedMovement: {
        usesReaction: false,
        direction: 'away_from_caster',
        maxDistance: 15
      },
      trigger: { type: 'immediate', frequency: 'every_time', movementType: 'any' },
      condition: { type: 'always' }
    };
    const context: CommandContext = {
      spellId: 'forced-route',
      spellName: 'Forced Route',
      castAtLevel: 1,
      caster,
      targets: [target],
      gameState: createMockGameState()
    };

    const nextState = new MovementCommand(effect, context).execute(state);
    const updatedTarget = nextState.characters.find(c => c.id === 'target')!;

    expect(updatedTarget.position).not.toEqual(target.position);
    expect(updatedTarget.position).not.toEqual({ x: 2, y: 0 });
    expect(updatedTarget.position.x).toBeGreaterThan(target.position.x);
  });
});
