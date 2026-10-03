/**
 * This file proves the reusable grapple resolver changes real combat state.
 *
 * The checks cover paired condition application, action-spending escape rolls,
 * movement restoration, and both incapacity and reach maintenance exits. These
 * are production helpers; the Tactical Sandbox is only one caller.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import { calculateMovementTotal } from '../actionEconomyUtils';
import {
  applyGrappledCondition,
  dragCarrySizeExceptionApplies,
  hasGrappledAttackDisadvantage,
  reconcileGrappleMaintenance,
  resolveDragCarryMovement,
  resolveGrappleEscapeAttempt,
} from '../grappleUtils';

// ============================================================================
// Stable Combatants
// ============================================================================
// Both ordinary actors begin adjacent with fresh turn resources. Individual
// tests move or incapacitate only the grappler fact they are proving.
// ============================================================================

function createActors(): { grappler: CombatCharacter; target: CombatCharacter } {
  const grappler = createMockCombatCharacter({
    id: 'grappler',
    name: 'Grappler',
    position: { x: 4, y: 4 },
    team: 'player',
  });
  const target = createMockCombatCharacter({
    id: 'target',
    name: 'Target',
    position: { x: 5, y: 4 },
    team: 'enemy',
    stats: {
      ...createMockCombatCharacter().stats,
      dexterity: 14,
    },
  });

  return { grappler, target };
}

function grappleTarget(target: CombatCharacter): CombatCharacter {
  return applyGrappledCondition(target, {
    grapplerId: 'grappler',
    escapeDc: 13,
    source: 'Focused grapple test',
  });
}

describe('grappleUtils', () => {
  it('applies paired Grappled metadata and immediately sets movement to zero', () => {
    const { target } = createActors();
    const grappled = grappleTarget(target);

    expect(grappled.statusEffects).toContainEqual(expect.objectContaining({
      name: 'Grappled',
      sourceCasterId: 'grappler',
      escapeCheck: expect.objectContaining({ dc: 13, actionCost: 'action' }),
    }));
    expect(grappled.conditions).toContainEqual(expect.objectContaining({
      name: 'Grappled',
      sourceCasterId: 'grappler',
      duration: { type: 'permanent' },
    }));
    expect(grappled.statusEffects.find(effect => effect.name === 'Grappled')?.duration)
      .toBe(Number.POSITIVE_INFINITY);
    expect(grappled.statusEffects.find(effect => effect.name === 'Grappled')?.description)
      .toContain('does not also apply Restrained');
    expect(calculateMovementTotal(grappled)).toBe(0);
    expect(grappled.actionEconomy.movement.total).toBe(0);
  });

  it('spends the real action and keeps Grappled after a failed escape roll', () => {
    const { target } = createActors();
    const grappled = grappleTarget(target);
    const failed = resolveGrappleEscapeAttempt(
      grappled,
      'Dexterity',
      'Acrobatics',
      { rng: () => 0.05 },
    );

    expect(failed.attempted).toBe(true);
    expect(failed.success).toBe(false);
    expect(failed.check?.roll).toBe(2);
    expect(failed.character.actionEconomy.action.used).toBe(true);
    expect(failed.character.conditions?.some(condition => condition.name === 'Grappled')).toBe(true);
    expect(calculateMovementTotal(failed.character)).toBe(0);
  });

  it('ends Grappled and restores movement after a successful escape roll', () => {
    const { target } = createActors();
    const grappled = grappleTarget(target);
    const escaped = resolveGrappleEscapeAttempt(
      grappled,
      'Dexterity',
      'Acrobatics',
      { rng: () => 0.89 },
    );

    expect(escaped.success).toBe(true);
    expect(escaped.check?.roll).toBe(18);
    expect(escaped.character.actionEconomy.action.used).toBe(true);
    expect(escaped.character.statusEffects.some(effect => effect.name === 'Grappled')).toBe(false);
    expect(escaped.character.actionEconomy.movement.total).toBe(30);
  });

  it('auto-releases for incapacitation and for separation beyond reach', () => {
    const { grappler, target } = createActors();
    const grappled = grappleTarget(target);
    const incapacitated = {
      ...grappler,
      conditions: [{
        name: 'Incapacitated',
        duration: { type: 'rounds', value: 1 },
        appliedTurn: 0,
      }],
    } as CombatCharacter;
    const incapResult = reconcileGrappleMaintenance([incapacitated, grappled]);

    expect(incapResult.releases).toEqual([expect.objectContaining({
      reason: 'grappler_incapacitated',
      targetId: 'target',
    })]);
    expect(calculateMovementTotal(incapResult.characters[1])).toBe(30);

    const distantGrappler = { ...grappler, position: { x: 2, y: 2 } };
    const reachResult = reconcileGrappleMaintenance([distantGrappler, grappled]);
    expect(reachResult.releases).toEqual([expect.objectContaining({ reason: 'out_of_reach' })]);
    expect(reachResult.characters[1].conditions?.some(condition => condition.name === 'Grappled')).toBe(false);
  });

  it('preserves an in-reach hold and repeats maintenance as a state-preserving no-op', () => {
    const { grappler, target } = createActors();
    const grappled = grappleTarget(target);
    const inReachGrappler = { ...grappler, position: { x: 4, y: 5 } };

    const first = reconcileGrappleMaintenance([inReachGrappler, grappled]);
    const repeated = reconcileGrappleMaintenance(first.characters);

    expect(first.releases).toEqual([]);
    expect(first.characters[1]).toBe(grappled);
    expect(repeated.releases).toEqual([]);
    expect(repeated.characters[1]).toBe(grappled);
    expect(calculateMovementTotal(repeated.characters[1])).toBe(0);
  });

  it('allows a forced target position change while releasing the now-distant hold', () => {
    const { grappler, target } = createActors();
    const grappled = grappleTarget(target);
    const forcedTarget = { ...grappled, position: { x: 8, y: 4 } };

    // Forced movement does not spend the target's Speed. Maintenance only
    // inspects the resulting positions and must not reject or undo the move.
    const result = reconcileGrappleMaintenance([grappler, forcedTarget]);
    const releasedTarget = result.characters[1];

    expect(releasedTarget.position).toEqual({ x: 8, y: 4 });
    expect(result.releases).toEqual([expect.objectContaining({ reason: 'out_of_reach' })]);
    expect(releasedTarget.statusEffects.some(effect => effect.name === 'Grappled')).toBe(false);
    expect(releasedTarget.conditions?.some(condition => condition.name === 'Grappled')).toBe(false);
    expect(calculateMovementTotal(releasedTarget)).toBe(30);
  });

  it('keys attack disadvantage to the grappler so only third-party attacks are penalized', () => {
    const { grappler, target } = createActors();
    const grappled = grappleTarget(target);
    const bystander = createMockCombatCharacter({ id: 'bystander', name: 'Bystander', position: { x: 6, y: 4 } });

    // Attacking the grappler itself is a normal roll — no disadvantage.
    expect(hasGrappledAttackDisadvantage(grappled, 'grappler')).toBe(false);
    // Attacking anyone other than the grappler has disadvantage.
    expect(hasGrappledAttackDisadvantage(grappled, 'bystander')).toBe(true);
    // The grappler and bystanders attack normally.
    expect(hasGrappledAttackDisadvantage(grappler, 'target')).toBe(false);
    expect(hasGrappledAttackDisadvantage(bystander, 'target')).toBe(false);
  });

  it('keeps the disadvantage rule keyed to the same condition mirrors that release the hold', () => {
    const { grappler, target } = createActors();
    const grappled = grappleTarget(target);
    const bystander = createMockCombatCharacter({ id: 'bystander', name: 'Bystander', position: { x: 6, y: 4 } });

    // The rule reads the same Grappled fact escape and maintenance consume, so
    // a released target loses the penalty at once rather than after a re-sync.
    const released = reconcileGrappleMaintenance([
      { ...grappler, conditions: [{ name: 'Incapacitated', duration: { type: 'rounds', value: 1 }, appliedTurn: 0 }] },
      grappled,
    ]).characters[1];

    expect(hasGrappledAttackDisadvantage(released, 'bystander')).toBe(false);
  });
});

describe('resolveDragCarryMovement', () => {
  it('drags a held target by the same delta and doubles the grappler movement cost', () => {
    const { grappler, target } = createActors();
    const grappled = grappleTarget(target);

    const result = resolveDragCarryMovement([grappler, grappled], {
      grapplerId: 'grappler',
      targetId: 'target',
      destination: { x: 6, y: 4 },
    });

    expect(result.moved).toBe(true);
    expect(result.baseMovementCost).toBe(10);
    expect(result.movementCost).toBe(20);
    expect(result.sizeExceptionApplied).toBe(false);
    expect(result.grappler?.position).toEqual({ x: 6, y: 4 });
    expect(result.target?.position).toEqual({ x: 7, y: 4 });
    expect(result.grappler?.actionEconomy.movement.used).toBe(20);
    // The hold survives a legal drag.
    expect(result.target?.conditions?.some(condition => condition.name === 'Grappled')).toBe(true);
  });

  it('applies the size exception so a Tiny target costs normal movement', () => {
    const { grappler } = createActors();
    const tiny = createMockCombatCharacter({
      id: 'target',
      name: 'Tiny Target',
      position: { x: 5, y: 4 },
      team: 'enemy',
      stats: { ...createMockCombatCharacter().stats, size: 'Tiny' },
    });
    const grappled = grappleTarget(tiny);

    expect(dragCarrySizeExceptionApplies(grappler, tiny)).toBe(true);

    const result = resolveDragCarryMovement([grappler, grappled], {
      grapplerId: 'grappler',
      targetId: 'target',
      destination: { x: 6, y: 4 },
    });

    expect(result.moved).toBe(true);
    expect(result.sizeExceptionApplied).toBe(true);
    expect(result.movementCost).toBe(10);
    expect(result.grappler?.actionEconomy.movement.used).toBe(10);
  });

  it('applies the size exception for a target at least two sizes smaller', () => {
    const large = createMockCombatCharacter({
      id: 'grappler',
      name: 'Large Grappler',
      position: { x: 4, y: 4 },
      team: 'player',
      stats: { ...createMockCombatCharacter().stats, size: 'Large' },
    });
    const small = createMockCombatCharacter({
      id: 'target',
      name: 'Small Target',
      position: { x: 5, y: 4 },
      team: 'enemy',
      stats: { ...createMockCombatCharacter().stats, size: 'Small' },
    });

    expect(dragCarrySizeExceptionApplies(large, small)).toBe(true);
  });

  it('rejects a blocked held-target destination atomically without moving either combatant', () => {
    const { grappler, target } = createActors();
    const grappled = grappleTarget(target);
    const bystander = createMockCombatCharacter({ id: 'bystander', name: 'Bystander', position: { x: 7, y: 4 } });

    const result = resolveDragCarryMovement([grappler, grappled, bystander], {
      grapplerId: 'grappler',
      targetId: 'target',
      destination: { x: 6, y: 4 },
    });

    expect(result.moved).toBe(false);
    expect(result.reason).toBe('target_destination_blocked');
    // Neither combatant moved and no movement was paid.
    expect(result.characters.find(character => character.id === 'grappler')?.position)
      .toEqual({ x: 4, y: 4 });
    expect(result.characters.find(character => character.id === 'target')?.position)
      .toEqual({ x: 5, y: 4 });
    expect(result.characters.find(character => character.id === 'grappler')?.actionEconomy.movement.used)
      .toBe(0);
  });

  it('rejects a drag when the target is not held by the requesting grappler', () => {
    const { grappler, target } = createActors();

    const result = resolveDragCarryMovement([grappler, target], {
      grapplerId: 'grappler',
      targetId: 'target',
      destination: { x: 6, y: 4 },
    });

    expect(result.moved).toBe(false);
    expect(result.reason).toBe('not_grappling');
  });
});
