/**
 * This file proves repeated-save and duration cleanup keep combat state aligned.
 *
 * The tests use Paralyzed because it carries both action and movement penalties.
 * They also seed unrelated Bless and Mage Armor records, proving a successful
 * save or expired duration removes only the Hold Person-owned records.
 *
 * Exercises: repeatSaveUtils.ts.
 * Depends on: the shared mock combat-character factory.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  advanceStatusConditionDurationsAtTurnStart,
  removeRepeatSaveLinkedEffects,
} from '../repeatSaveUtils';

// ============================================================================
// Canonical Hold Person Runtime Fixture
// ============================================================================
// The fixture mirrors StatusConditionCommand ownership fields. One remaining
// round makes the duration boundary deterministic without changing the rule.
// ============================================================================

function createHeldTarget(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'held-target',
    stats: {
      ...createMockCombatCharacter().stats,
      speed: 30,
    },
    actionEconomy: {
      ...createMockCombatCharacter().actionEconomy,
      movement: { used: 0, total: 0 },
    },
    statusEffects: [
      {
        id: 'hold-person-status',
        name: 'Paralyzed',
        type: 'debuff',
        duration: 1,
        source: 'Hold Person',
        sourceSpellId: 'hold-person',
        sourceCasterId: 'enchanter',
        repeatSave: {
          timing: 'turn_end',
          saveType: 'Wisdom',
          successEnds: true,
          useOriginalDC: true,
          dc: 15,
        },
        effect: { type: 'condition' },
      },
      {
        id: 'bless-status',
        name: 'Blessed',
        type: 'buff',
        duration: 10,
        source: 'Bless',
        sourceSpellId: 'bless',
        sourceCasterId: 'cleric',
      },
    ],
    conditions: [{
      name: 'Paralyzed',
      duration: { type: 'rounds', value: 1 },
      appliedTurn: 4,
      source: 'hold-person',
      sourceCasterId: 'enchanter',
    }],
    activeEffects: [
      {
        id: 'hold-person-active',
        spellId: 'hold-person',
        casterId: 'enchanter',
        sourceName: 'Hold Person',
        type: 'debuff',
        duration: { type: 'rounds', value: 1 },
        startTime: 4,
      },
      {
        id: 'mage-armor-active',
        spellId: 'mage-armor',
        casterId: 'held-target',
        sourceName: 'Mage Armor',
        type: 'buff',
        duration: { type: 'hours', value: 8 },
        startTime: 0,
      },
    ],
  });
}

// ============================================================================
// Selective Cleanup Proof
// ============================================================================
// Both endings restore movement and preserve records with different ownership.
// ============================================================================

describe('repeatSaveUtils', () => {
  it('removes every Hold Person-owned record after a successful repeat save', () => {
    const result = removeRepeatSaveLinkedEffects(createHeldTarget(), ['hold-person-status']);

    expect(result).toMatchObject({
      removedStatusEffects: 1,
      removedConditions: 1,
      removedActiveEffects: 1,
    });
    expect(result.character.statusEffects.map(status => status.id)).toEqual(['bless-status']);
    expect(result.character.conditions).toEqual([]);
    expect(result.character.activeEffects?.map(effect => effect.id)).toEqual(['mage-armor-active']);
    expect(result.character.actionEconomy.movement.total).toBe(30);
  });

  it('expires both condition mirrors at turn start without removing unrelated effects', () => {
    const result = advanceStatusConditionDurationsAtTurnStart(createHeldTarget());

    expect(result.expiredNames).toEqual(['Paralyzed']);
    expect(result.character.statusEffects.map(status => status.id)).toEqual(['bless-status']);
    expect(result.character.conditions).toEqual([]);
    expect(result.character.activeEffects?.map(effect => effect.id)).toEqual([
      'hold-person-active',
      'mage-armor-active',
    ]);
    expect(result.character.actionEconomy.movement.total).toBe(30);
  });

  it('leaves an unknown saved status id as a true no-op', () => {
    const target = createHeldTarget();
    const result = removeRepeatSaveLinkedEffects(target, ['missing-status']);

    expect(result.character).toBe(target);
    expect(result.removedStatusEffects).toBe(0);
  });

  it('preserves paired until-removed conditions across any number of turn starts', () => {
    const proneTarget = createMockCombatCharacter({
      id: 'prone-target',
      statusEffects: [{
        id: 'prone-status',
        name: 'Prone',
        type: 'debuff',
        duration: 0,
        persistsUntilRemoved: true,
        source: 'Unarmed Strike: Shove',
        effect: { type: 'condition' },
      }],
      conditions: [{
        name: 'Prone',
        duration: { type: 'permanent' },
        appliedTurn: 1,
        source: 'Unarmed Strike: Shove',
      }],
    });

    // Repeated turns must not invent an expiry for a physical posture. Stand
    // Up, not the duration clock, owns removal of both Prone records.
    const afterFirstTurn = advanceStatusConditionDurationsAtTurnStart(proneTarget);
    const afterThirdTurn = advanceStatusConditionDurationsAtTurnStart(
      advanceStatusConditionDurationsAtTurnStart(afterFirstTurn.character).character,
    );

    expect(afterFirstTurn.expiredNames).toEqual([]);
    expect(afterThirdTurn.expiredNames).toEqual([]);
    expect(afterThirdTurn.character.statusEffects).toContainEqual(expect.objectContaining({
      name: 'Prone',
      persistsUntilRemoved: true,
    }));
    expect(afterThirdTurn.character.conditions).toContainEqual(expect.objectContaining({
      name: 'Prone',
      duration: { type: 'permanent' },
    }));
  });
});
