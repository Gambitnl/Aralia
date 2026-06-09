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
        maxDistance: '15'
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

// ----------------------------------------------------------------------------
// Per-Target Teleport Destinations
// ----------------------------------------------------------------------------
// Scatter-style spells choose several creatures and then choose a different
// landing space for each creature. The movement command needs a runtime payload
// that can carry those assignments without pretending a single shared
// destination applies to every target.
// ----------------------------------------------------------------------------
describe('MovementCommand - per-target teleport destinations', () => {
  it('uses assigned destinations for each teleported target', () => {
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster', position: { x: 0, y: 0 } });
    const firstTarget = createMockCombatCharacter({ id: 'first', name: 'First', position: { x: 1, y: 0 } });
    const secondTarget = createMockCombatCharacter({ id: 'second', name: 'Second', position: { x: 2, y: 0 } });
    const state = createMockCombatState({
      characters: [caster, firstTarget, secondTarget],
      turnState: { currentTurn: 0, turnOrder: [], currentCharacterId: 'caster', phase: 'planning', actionsThisTurn: [] }
    });
    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'teleport',
      distance: 20,
      destinationsByTargetId: {
        first: { x: 1, y: 2 },
        second: { x: 2, y: 2 }
      },
      duration: { type: 'rounds', value: 0 },
      trigger: { type: 'immediate', frequency: 'every_time', movementType: 'any' },
      condition: { type: 'always' }
    };
    const context: CommandContext = {
      spellId: 'scatter',
      spellName: 'Scatter',
      castAtLevel: 6,
      caster,
      targets: [firstTarget, secondTarget],
      gameState: createMockGameState()
    };

    const nextState = new MovementCommand(effect, context).execute(state);

    expect(nextState.characters.find(character => character.id === 'first')?.position).toEqual({ x: 1, y: 2 });
    expect(nextState.characters.find(character => character.id === 'second')?.position).toEqual({ x: 2, y: 2 });
  });
});

// ----------------------------------------------------------------------------
// Teleport Budget Contract
// ----------------------------------------------------------------------------
// Teleportation still resolves through the same command path, but the combat
// log now carries enough metadata to explain how much of the requested budget
// was actually spent and whether the landing tile had to be clamped or
// negotiated.
// ----------------------------------------------------------------------------
describe('MovementCommand - teleport budget metadata', () => {
  it('records requested budget, actual travel, and bounds clamping in the combat log', () => {
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster', position: { x: 0, y: 0 } });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target', position: { x: 1, y: 1 } });
    const tiles = new Map<string, any>();

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        tiles.set(`${x}-${y}`, {
          id: `${x}-${y}`,
          coordinates: { x, y },
          terrain: 'floor',
          elevation: 0,
          movementCost: 1,
          blocksMovement: false,
          blocksLoS: false,
          decoration: null,
          effects: []
        });
      }
    }

    const mapData = { id: 'teleport-budget-map', name: 'Teleport Budget Map', dimensions: { width: 3, height: 3 }, tiles } as any;
    const state = createMockCombatState({
      characters: [caster, target],
      mapData,
      turnState: { currentTurn: 0, turnOrder: [], currentCharacterId: 'caster', phase: 'planning', actionsThisTurn: [] }
    });
    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'teleport',
      distance: 20,
      destination: { x: 5, y: 5 },
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate', frequency: 'every_time', movementType: 'any' },
      condition: { type: 'always' }
    };
    const context: CommandContext = {
      spellId: 'teleport-budget',
      spellName: 'Teleport Budget',
      castAtLevel: 3,
      caster,
      targets: [target],
      gameState: createMockGameState()
    };

    const nextState = new MovementCommand(effect, context).execute(state);
    const updatedTarget = nextState.characters.find(character => character.id === 'target')!;
    const teleportLog = nextState.combatLog[nextState.combatLog.length - 1];

    expect(updatedTarget.position).toEqual({ x: 2, y: 2 });
    expect(teleportLog.data).toMatchObject({
      requestedDestination: { x: 5, y: 5 },
      requestedDistanceFeet: 20,
      requestedBudgetTiles: 4,
      actualDistanceTiles: 1,
      actualDistanceFeet: 5,
      budgetSpentFeet: 5,
      budgetRemainingFeet: 15,
      clampedByBounds: true,
      usedFallbackDestination: false,
      maxDistance: 20
    });
  });
});
