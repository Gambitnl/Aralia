/**
 * This file proves Shove uses Aralia's real save, movement, size, and condition rules.
 *
 * Each case starts from the same three-actor board, resolves one deterministic
 * request, and inspects canonical combat state rather than a scenario-only flag.
 * The bystander protects unrelated actors from accidental roster rewrites.
 */

import { describe, expect, it } from 'vitest';
import type { Ability, BattleMapData, BattleMapTile, CombatCharacter } from '../../../types/combat';
import { applyImmediateAbilityTurnEffects } from '../../../hooks/combat/useActionExecutor';
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
import { consumeActionCost } from '../actionEconomyUtils';
import { advanceStatusConditionDurationsAtTurnStart } from '../repeatSaveUtils';

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
      // Different modifiers make the defender's chosen save auditable. The
      // same d20 must total +2 higher on Strength than on Dexterity.
      strength: 14,
      dexterity: 8,
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
    saveAbility?: 'Strength' | 'Dexterity';
    currentCharacterId?: string;
    attackRemaining?: number;
  } = {},
) {
  const actors = createActors(options.targetSize);
  const shover = {
    ...actors.shover,
    actionEconomy: {
      ...actors.shover.actionEconomy,
      action: {
        used: (options.attackRemaining ?? 1) <= 0,
        remaining: options.attackRemaining ?? 1,
      },
    },
  };
  const state = createMockCombatState({
    characters: [shover, actors.target, actors.bystander],
    mapData: createMap(options.destinationBlocked),
    turnState: {
      currentTurn: 1,
      turnOrder: [shover.id, actors.target.id, actors.bystander.id],
      currentCharacterId: options.currentCharacterId ?? shover.id,
      phase: 'action',
      actionsThisTurn: [],
    },
  });
  const result = resolveShoveAttempt({
    state,
    gameState: createMockGameState(),
    shoverId: actors.shover.id,
    targetId: actors.target.id,
    choice: options.choice ?? 'push',
    saveAbility: options.saveAbility ?? 'Strength',
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
      save: { roll: 18, total: 20, success: true },
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
      save: { roll: 1, total: 3, success: false },
    });
    expect(result.attackSpent).toBe(true);
    expect(result.attacksRemaining).toBe(0);
    expect(result.state.characters.find(character => character.id === 'shover')?.actionEconomy.action)
      .toEqual({ used: true, remaining: 0 });
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
      duration: 0,
      persistsUntilRemoved: true,
      effect: { type: 'condition' },
    }));
    expect(target.conditions).toContainEqual(expect.objectContaining({
      duration: { type: 'permanent' },
    }));
  });

  it('uses the defender-selected Strength or Dexterity modifier with the same d20', () => {
    const strength = resolveFixture({ saveAbility: 'Strength', rng: () => 0.49 }).result;
    const dexterity = resolveFixture({ saveAbility: 'Dexterity', rng: () => 0.49 }).result;

    expect(strength.save).toMatchObject({ roll: 10, total: 12 });
    expect(dexterity.save).toMatchObject({ roll: 10, total: 9 });
    expect(strength.message).toContain('Strength save');
    expect(dexterity.message).toContain('Dexterity save');
  });

  it('rejects off-turn and exhausted repeats before rolling, spending, or applying an effect', () => {
    let rolls = 0;
    const offTurn = resolveFixture({
      currentCharacterId: 'target',
      rng: () => {
        rolls += 1;
        return 0.01;
      },
    }).result;

    expect(offTurn).toMatchObject({
      attempted: false,
      attackSpent: false,
      reason: 'not_turn_owner',
    });
    expect(offTurn.state.characters.find(character => character.id === 'shover')?.actionEconomy.action)
      .toEqual({ used: false, remaining: 1 });

    const first = resolveFixture({
      rng: () => {
        rolls += 1;
        return 0.89;
      },
    }).result;
    const repeat = resolveShoveAttempt({
      state: first.state,
      gameState: createMockGameState(),
      shoverId: 'shover',
      targetId: 'target',
      choice: 'push',
      saveAbility: 'Strength',
      rng: () => {
        rolls += 1;
        return 0.01;
      },
    });

    expect(first.reason).toBe('save_succeeded');
    expect(repeat).toMatchObject({
      attempted: false,
      attackSpent: false,
      attacksRemaining: 0,
      reason: 'attack_unavailable',
    });
    expect(repeat.state).toBe(first.state);
    expect(rolls).toBe(1);
  });

  it('keeps Shove Prone across turns and removes both mirrors through canonical Stand Up', () => {
    const prone = resolveFixture({ choice: 'prone' }).result;
    const target = findTarget(prone);
    const afterTurns = advanceStatusConditionDurationsAtTurnStart(
      advanceStatusConditionDurationsAtTurnStart(target).character,
    ).character;
    const standUp: Ability = {
      id: 'stand_up',
      name: 'Stand Up',
      description: 'Spend half Speed to right yourself.',
      type: 'movement',
      cost: { type: 'movement-only', movementCost: 15 },
      targeting: 'self',
      range: 0,
      effects: [],
      icon: 'Stand',
    };

    expect(afterTurns.statusEffects.map(effect => effect.name)).toContain('Prone');
    expect(afterTurns.conditions?.map(condition => condition.name)).toContain('Prone');

    // The ordinary executor order pays the movement cost first, then applies
    // Stand Up's immediate paired cleanup. It does not spend the Action.
    const paid = consumeActionCost(afterTurns, standUp.cost);
    const standing = applyImmediateAbilityTurnEffects(paid, standUp, 3).character;

    expect(standing.actionEconomy.movement.used).toBe(15);
    expect(standing.actionEconomy.action.used).toBe(false);
    expect(standing.statusEffects.map(effect => effect.name)).not.toContain('Prone');
    expect(standing.conditions?.map(condition => condition.name)).not.toContain('Prone');
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
