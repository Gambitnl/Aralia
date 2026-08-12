/**
 * This file proves Shove uses Aralia's real save, movement, size, and condition rules.
 *
 * Each case starts from the same three-actor board, resolves one deterministic
 * request, and inspects canonical combat state rather than a scenario-only flag.
 * The bystander protects unrelated actors from accidental roster rewrites.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../types/combat';
import {
  createMockCombatCharacter,
  createMockCombatState,
  createMockGameState,
} from '../../core';
import {
  calculateShoveSaveDc,
  isTargetSizeEligibleForShove,
  resolveShoveAttempt,
} from '../shoveUtils';

// ============================================================================
// Stable Combat Fixture
// ============================================================================
// The shover and target are adjacent on a horizontal lane. The third square is
// the exact five-foot destination used by MovementCommand's collision checks.
// ============================================================================

function createMap(destinationBlocked = false): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();

  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      const isDestination = x === 3 && y === 1;
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: isDestination && destinationBlocked ? 'wall' : 'floor',
        elevation: 0,
        movementCost: 5,
        blocksLoS: isDestination && destinationBlocked,
        blocksMovement: isDestination && destinationBlocked,
        decoration: null,
        effects: [],
      });
    }
  }

  return {
    dimensions: { width: 5, height: 3 },
    tiles,
    theme: 'dungeon',
    seed: 211,
  };
}

function createActors(targetSize: CombatCharacter['stats']['size'] = 'Medium'): {
  shover: CombatCharacter;
  target: CombatCharacter;
  bystander: CombatCharacter;
} {
  const shover = createMockCombatCharacter({
    id: 'shover',
    name: 'Shove Tester',
    level: 5,
    position: { x: 1, y: 1 },
    stats: {
      ...createMockCombatCharacter().stats,
      strength: 16,
      size: 'Medium',
    },
  });
  const target = createMockCombatCharacter({
    id: 'target',
    name: 'Shove Target',
    position: { x: 2, y: 1 },
    stats: {
      ...createMockCombatCharacter().stats,
      strength: 10,
      dexterity: 10,
      size: targetSize,
    },
  });
  const bystander = createMockCombatCharacter({
    id: 'bystander',
    name: 'Unrelated Bystander',
    position: { x: 0, y: 0 },
  });

  return { shover, target, bystander };
}

function resolveFixture(
  options: {
    choice?: 'push' | 'prone';
    rng?: () => number;
    destinationBlocked?: boolean;
    targetSize?: CombatCharacter['stats']['size'];
  } = {},
) {
  const actors = createActors(options.targetSize);
  const state = createMockCombatState({
    characters: [actors.shover, actors.target, actors.bystander],
    mapData: createMap(options.destinationBlocked),
  });
  const result = resolveShoveAttempt({
    state,
    gameState: createMockGameState(),
    shoverId: actors.shover.id,
    targetId: actors.target.id,
    choice: options.choice ?? 'push',
    saveAbility: 'Strength',
    rng: options.rng ?? (() => 0.01),
  });

  return { actors, result };
}

function findTarget(result: ReturnType<typeof resolveFixture>['result']): CombatCharacter {
  const target = result.state.characters.find(character => character.id === 'target');
  if (!target) throw new Error('Expected the canonical shove target to remain in combat.');
  return target;
}

// ============================================================================
// Save And Effect Outcomes
// ============================================================================
// High and low injected d20 samples prove both sides of the shared saving-throw
// path. Failed saves then split into the two player choices.
// ============================================================================

describe('resolveShoveAttempt', () => {
  it('calculates the unarmed shove DC from proficiency and Strength', () => {
    const { shover } = createActors();
    expect(calculateShoveSaveDc(shover)).toBe(14);
  });

  it('leaves the board unchanged when the target succeeds on its save', () => {
    const { actors, result } = resolveFixture({ rng: () => 0.89 });

    expect(result).toMatchObject({
      attempted: true,
      shoveSucceeded: false,
      reason: 'save_succeeded',
      saveDc: 14,
      save: { roll: 18, total: 18, success: true },
    });
    expect(findTarget(result)).toBe(actors.target);
    expect(result.message).toContain('position and conditions are unchanged');
  });

  it('pushes a failed-save target through the canonical MovementCommand path', () => {
    const { actors, result } = resolveFixture();
    const target = findTarget(result);

    expect(result).toMatchObject({
      attempted: true,
      shoveSucceeded: true,
      reason: 'resolved_push',
      save: { roll: 1, total: 1, success: false },
    });
    expect(target.position).toEqual({ x: 3, y: 1 });
    expect(result.state.combatLog.at(-1)?.message).toBe('Shove Target is pushed 5 feet onto floor');
    expect(result.state.characters.find(character => character.id === 'bystander')).toBe(actors.bystander);
  });

  it('applies paired Prone state after a failed save without moving the target', () => {
    const { result } = resolveFixture({ choice: 'prone' });
    const target = findTarget(result);

    expect(result.reason).toBe('resolved_prone');
    expect(target.position).toEqual({ x: 2, y: 1 });
    expect(target.conditions).toContainEqual(expect.objectContaining({
      name: 'Prone',
      source: 'Unarmed Strike: Shove',
      sourceCasterId: 'shover',
    }));
    expect(target.statusEffects).toContainEqual(expect.objectContaining({
      name: 'Prone',
      effect: { type: 'condition' },
    }));
  });

  // ========================================================================
  // Size And Collision Rejections
  // ========================================================================
  // Size is checked before rolling. A legal failed save can still stop at its
  // original cell when MovementCommand finds a wall at the destination.
  // ========================================================================

  it('allows one-size-larger targets and rejects targets two sizes larger', () => {
    const { shover } = createActors('Medium');
    const large = createActors('Large').target;
    const huge = createActors('Huge').target;

    expect(isTargetSizeEligibleForShove(shover, large)).toBe(true);
    expect(isTargetSizeEligibleForShove(shover, huge)).toBe(false);

    const { result } = resolveFixture({ targetSize: 'Huge' });
    expect(result).toMatchObject({
      attempted: false,
      shoveSucceeded: false,
      reason: 'target_too_large',
    });
    expect(result.save).toBeUndefined();
    expect(result.message).toContain('more than one size larger');
  });

  it('reports a failed save but no movement when the destination is blocked', () => {
    const { result } = resolveFixture({ destinationBlocked: true });

    expect(result).toMatchObject({
      attempted: true,
      shoveSucceeded: false,
      reason: 'blocked_destination',
      save: { success: false },
    });
    expect(findTarget(result).position).toEqual({ x: 2, y: 1 });
    expect(result.state.combatLog.at(-1)?.message).toBe('Shove Target cannot be pushed (blocked)');
    expect(result.message).toContain('destination is blocked');
  });
});
