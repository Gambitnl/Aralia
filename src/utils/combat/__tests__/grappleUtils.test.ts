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
  reconcileGrappleMaintenance,
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
    }));
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
});
