/**
 * This file proves paired runtime conditions obey source ownership.
 *
 * The tests cover independent same-name sources, same-source replacement,
 * exact removal, source-loss cleanup, one turn-end boundary, and stable replay.
 * These are production-helper checks rather than Tactical Sandbox-only state.
 *
 * Exercises: statusConditionUtils.
 * Depends on: canonical combat fixtures and movement calculation.
 */

import { describe, expect, it } from 'vitest';
import type { ActiveCondition, CombatCharacter, StatusEffect } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  advanceRuntimeStatusConditionsAtTurnEnd,
  applyRuntimeStatusCondition,
  removeRuntimeStatusCondition,
  removeRuntimeStatusConditionsFromSource,
} from '../statusConditionUtils';

// ============================================================================
// Owned Pair Fixtures
// ============================================================================
// Stable ids and source keys make every assertion describe one exact runtime
// effect rather than relying on the shared condition name alone.
// ============================================================================

function status(
  id: string,
  name: string,
  source: string,
  sourceCasterId: string,
  duration = 3,
): StatusEffect {
  return {
    id,
    name,
    type: 'debuff',
    duration,
    source,
    sourceSpellId: source,
    sourceCasterId,
    effect: { type: 'condition' },
  };
}

function condition(
  name: string,
  source: string,
  sourceCasterId: string,
  duration: ActiveCondition['duration'] = { type: 'rounds', value: 3 },
  turnEndEventsRemaining?: number,
): ActiveCondition {
  return {
    name,
    source,
    sourceCasterId,
    duration,
    appliedTurn: 1,
    ...(turnEndEventsRemaining === undefined ? {} : { turnEndEventsRemaining }),
  };
}

function target(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  return createMockCombatCharacter({
    id: 'condition-target',
    name: 'Condition Target',
    stats: { speed: 30 },
    statusEffects: [],
    conditions: [],
    ...overrides,
  });
}

// ============================================================================
// Application, Replacement, And Replay
// ============================================================================
// Different sources may coexist. Reapplying one source replaces only its own
// pair, while delivering the exact same event again returns the original state.
// ============================================================================

describe('paired runtime condition ownership', () => {
  it('stacks independent sources, replaces one owner, and treats exact replay as a no-op', () => {
    const trapStatus = status('trap-restrained', 'Restrained', 'iron-trap', 'condition-target', 8);
    const trapCondition = condition('Restrained', 'iron-trap', 'condition-target', { type: 'rounds', value: 8 });
    const netStatus = status('net-restrained', 'Restrained', 'training-net', 'condition-source', 3);
    const netCondition = condition('Restrained', 'training-net', 'condition-source');
    const trapped = applyRuntimeStatusCondition(target(), trapStatus, trapCondition).character;
    const stacked = applyRuntimeStatusCondition(trapped, netStatus, netCondition);

    expect(stacked.outcome).toBe('applied');
    expect(stacked.character.statusEffects.filter(effect => effect.name === 'Restrained')).toHaveLength(2);
    expect(stacked.character.conditions?.filter(entry => entry.name === 'Restrained')).toHaveLength(2);
    expect(stacked.character.actionEconomy.movement).toEqual({ total: 0, used: 0 });

    const replacementStatus = { ...netStatus, duration: 5 };
    const replacementCondition = {
      ...netCondition,
      duration: { type: 'rounds' as const, value: 5 },
    };
    const replaced = applyRuntimeStatusCondition(
      stacked.character,
      replacementStatus,
      replacementCondition,
    );

    expect(replaced.outcome).toBe('replaced');
    expect(replaced.character.statusEffects).toHaveLength(2);
    expect(replaced.character.statusEffects.find(effect => effect.id === 'net-restrained')?.duration).toBe(5);
    expect(replaced.character.statusEffects.find(effect => effect.id === 'trap-restrained')?.duration).toBe(8);

    const replayed = applyRuntimeStatusCondition(
      replaced.character,
      replacementStatus,
      replacementCondition,
    );
    expect(replayed.outcome).toBe('unchanged');
    expect(replayed.character).toBe(replaced.character);
  });

  it('removes only the exact owner and restores movement only after all Restrained sources end', () => {
    const trapStatus = status('trap-restrained', 'Restrained', 'iron-trap', 'condition-target');
    const netStatus = status('net-restrained', 'Restrained', 'training-net', 'condition-source');
    const trapped = applyRuntimeStatusCondition(
      target(),
      trapStatus,
      condition('Restrained', 'iron-trap', 'condition-target'),
    ).character;
    const stacked = applyRuntimeStatusCondition(
      trapped,
      netStatus,
      condition('Restrained', 'training-net', 'condition-source'),
    ).character;

    const netRemoved = removeRuntimeStatusCondition(stacked, netStatus);
    expect(netRemoved.removedStatusEffects).toBe(1);
    expect(netRemoved.removedConditions).toBe(1);
    expect(netRemoved.character.statusEffects.map(effect => effect.id)).toEqual(['trap-restrained']);
    expect(netRemoved.character.actionEconomy.movement.total).toBe(0);

    const trapRemoved = removeRuntimeStatusCondition(netRemoved.character, trapStatus);
    expect(trapRemoved.character.statusEffects).toEqual([]);
    expect(trapRemoved.character.conditions).toEqual([]);
    expect(trapRemoved.character.actionEconomy.movement.total).toBe(30);
  });
});

// ============================================================================
// Source Loss And Turn Boundary
// ============================================================================
// Source cleanup is explicit because not every spell ends when its caster is
// absent. Turn-end expiry advances exactly once and removes only the owned pair.
// ============================================================================

describe('paired runtime condition lifecycle', () => {
  it('cleans one lost source while preserving another source and unrelated conditions', () => {
    const owned = status('net-restrained', 'Restrained', 'training-net', 'condition-source');
    const other = status('trap-restrained', 'Restrained', 'iron-trap', 'condition-target');
    const poisoned = status('poisoned', 'Poisoned', 'spider-venom', 'condition-target');
    let character = target();
    character = applyRuntimeStatusCondition(character, owned, condition('Restrained', 'training-net', 'condition-source')).character;
    character = applyRuntimeStatusCondition(character, other, condition('Restrained', 'iron-trap', 'condition-target')).character;
    character = applyRuntimeStatusCondition(character, poisoned, condition('Poisoned', 'spider-venom', 'condition-target')).character;

    const cleanup = removeRuntimeStatusConditionsFromSource(character, 'condition-source');

    expect(cleanup.removedStatusEffects).toBe(1);
    expect(cleanup.removedConditions).toBe(1);
    expect(cleanup.character.statusEffects.map(effect => effect.id)).toEqual([
      'trap-restrained',
      'poisoned',
    ]);
    expect(cleanup.character.conditions?.map(entry => entry.name)).toEqual([
      'Restrained',
      'Poisoned',
    ]);
    expect(cleanup.character.actionEconomy.movement.total).toBe(0);
  });

  it('expires one Blinded owner at one target turn end and keeps same-name ownership intact', () => {
    const timedStatus = status('flash-blinded', 'Blinded', 'flash-powder', 'condition-source', 1);
    const wardStatus = status('ward-blinded', 'Blinded', 'shadow-ward', 'condition-target', 4);
    let character = target();
    character = applyRuntimeStatusCondition(
      character,
      timedStatus,
      condition(
        'Blinded',
        'flash-powder',
        'condition-source',
        { type: 'until_end_of_current_turn', value: 0 },
        1,
      ),
    ).character;
    character = applyRuntimeStatusCondition(
      character,
      wardStatus,
      condition('Blinded', 'shadow-ward', 'condition-target', { type: 'rounds', value: 4 }),
    ).character;

    const expired = advanceRuntimeStatusConditionsAtTurnEnd(character);
    expect(expired.expiredNames).toEqual(['Blinded']);
    expect(expired.character.statusEffects.map(effect => effect.id)).toEqual(['ward-blinded']);
    expect(expired.character.conditions?.map(entry => entry.source)).toEqual(['shadow-ward']);

    const replayedBoundary = advanceRuntimeStatusConditionsAtTurnEnd(expired.character);
    expect(replayedBoundary.expiredNames).toEqual([]);
    expect(replayedBoundary.character).toBe(expired.character);
  });
});
