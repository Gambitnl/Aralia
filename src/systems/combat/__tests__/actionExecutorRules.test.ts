/**
 * Pure Opportunity Attack decisions lifted out of the effectful
 * hooks/combat/actionExecutor/opportunityAttackFlow.ts (C2, agora-9ed9.2).
 * The flow's behavior stays covered by the existing useActionExecutor tests.
 *
 * Exercises: src/systems/combat/opportunityAttackPlanning.ts
 */
import { describe, it, expect } from 'vitest';
import {
  buildOpportunityAttackReactiveAction,
  opportunityAttackRollSources,
  spendOpportunityAttackReaction,
} from '../opportunityAttackPlanning';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import type { Ability } from '../../../types/combat';

const longsword = {
  id: 'longsword', name: 'Longsword', type: 'attack', range: 1, weapon: {},
  effects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }],
} as unknown as Ability;

describe('opportunityAttackRollSources', () => {
  it('gives no die sources without a supplied decision', () => {
    expect(opportunityAttackRollSources(undefined, longsword)).toEqual({ attackRollRng: undefined, damageRng: undefined });
  });

  it('maps a pinned d20 face to a source that lands on that face', () => {
    const { attackRollRng } = opportunityAttackRollSources({ decision: 'accept', attackRoll: 17 } as never, longsword);
    expect(Math.floor((attackRollRng?.() ?? 0) * 20) + 1).toBe(17);
  });

  it('ignores an out-of-range or fractional d20 pin', () => {
    for (const attackRoll of [0, 21, 4.5]) {
      expect(opportunityAttackRollSources({ decision: 'accept', attackRoll } as never, longsword).attackRollRng).toBeUndefined();
    }
  });

  it('derives the damage source from the weapon die and caps the face at its sides', () => {
    const exact = opportunityAttackRollSources({ decision: 'accept', damageRoll: 6 } as never, longsword).damageRng;
    expect(Math.floor((exact?.() ?? 0) * 8) + 1).toBe(6);
    const capped = opportunityAttackRollSources({ decision: 'accept', damageRoll: 99 } as never, longsword).damageRng;
    expect(Math.floor((capped?.() ?? 0) * 8) + 1).toBe(8);
  });

  it('gives no damage source for a weapon with no damage die', () => {
    const flat = { ...longsword, effects: [{ type: 'damage', value: 3 }] } as unknown as Ability;
    expect(opportunityAttackRollSources({ decision: 'accept', damageRoll: 2 } as never, flat).damageRng).toBeUndefined();
  });
});

describe('spendOpportunityAttackReaction', () => {
  it('marks the reaction used and leaves the input untouched', () => {
    const attacker = createMockCombatCharacter({ id: 'guard' });
    const spent = spendOpportunityAttackReaction(attacker);
    expect(spent.actionEconomy.reaction.used).toBe(true);
    expect(spent.actionEconomy.reaction.remaining).toBe(0);
    expect(spent).not.toBe(attacker);
    expect(attacker.actionEconomy.reaction.used).toBe(false);
  });
});

describe('buildOpportunityAttackReactiveAction', () => {
  it('builds the same reactive-events-only record for any result, with the given id and time', () => {
    const attacker = createMockCombatCharacter({ id: 'guard' });
    const mover = createMockCombatCharacter({ id: 'thief' });
    const result = { isHit: false, isCritical: false } as never;
    const action = buildOpportunityAttackReactiveAction(attacker, longsword, mover, result, { id: 'x-opportunity-attack-reactive', timestamp: 42 });
    expect(action).toEqual({
      id: 'x-opportunity-attack-reactive', characterId: 'guard', type: 'ability', abilityId: 'longsword',
      targetCharacterIds: ['thief'], targetPosition: mover.position, cost: { type: 'free' },
      timestamp: 42, attackResults: [result], reactiveEventsOnly: true,
    });
    expect(Object.keys(action)).toEqual(['id', 'characterId', 'type', 'abilityId', 'targetCharacterIds', 'targetPosition', 'cost', 'timestamp', 'attackResults', 'reactiveEventsOnly']);
  });
});
