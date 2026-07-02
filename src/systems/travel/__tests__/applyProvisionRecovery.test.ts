/**
 * @file applyProvisionRecovery.test.ts — PRV9 (recovery + starvation bite).
 * A fully-provisioned travel leg is the party eating properly on the road, so it
 * CLEARS starving/fatigued; a starving march wears the party down (non-lethal HP
 * drain, never below 1). Kept in its own file so the original applyProvision
 * suite stays untouched in the shared checkout.
 */
import { describe, it, expect } from 'vitest';
import { buildProvisionActions, STARVATION_HP_DAMAGE } from '../applyProvision';
import type { TravelProvisionEffect } from '../../../types/travelMeta';

const fullLeg: TravelProvisionEffect = { rationsToSpend: 3, waterToSpend: 3, note: null };
const halfLeg: TravelProvisionEffect = { rationsToSpend: 2, waterToSpend: 3, conditions: ['fatigued'], note: null };
const starvingHalt: TravelProvisionEffect = {
  rationsToSpend: 3, waterToSpend: 3, conditions: ['starving'], companionLoyaltyDelta: -15, note: null,
};

describe('buildProvisionActions — condition recovery (PRV9)', () => {
  it('a fully-provisioned leg clears starving and fatigued', () => {
    const actions = buildProvisionActions(fullLeg, []);
    const cleared = actions
      .filter((a) => a.type === 'CLEAR_PARTY_CONDITION')
      .map((a) => (a as { payload: { condition: string } }).payload.condition);
    expect(cleared).toContain('starving');
    expect(cleared).toContain('fatigued');
  });

  it('a half-rations leg clears first, then re-applies fatigued (net: fatigued stays)', () => {
    const actions = buildProvisionActions(halfLeg, []);
    const clearIdx = actions.findIndex(
      (a) => a.type === 'CLEAR_PARTY_CONDITION' && (a as { payload: { condition: string } }).payload.condition === 'fatigued',
    );
    const setIdx = actions.findIndex(
      (a) => a.type === 'SET_PARTY_CONDITION' && (a as { payload: { condition: string } }).payload.condition === 'fatigued',
    );
    expect(clearIdx).toBeGreaterThanOrEqual(0);
    expect(setIdx).toBeGreaterThan(clearIdx);
  });

  it('a starving halt clears nothing', () => {
    const actions = buildProvisionActions(starvingHalt, []);
    expect(actions.some((a) => a.type === 'CLEAR_PARTY_CONDITION')).toBe(false);
  });

  it('a leg that spends no water clears nothing (not fully provisioned)', () => {
    const actions = buildProvisionActions({ rationsToSpend: 3, waterToSpend: 0, note: null }, []);
    expect(actions.some((a) => a.type === 'CLEAR_PARTY_CONDITION')).toBe(false);
  });
});

describe('buildProvisionActions — starvation HP drain (PRV9)', () => {
  it('a starving march damages each member, floored at 1 HP (non-lethal)', () => {
    const actions = buildProvisionActions(starvingHalt, [], [
      { id: 'player', hp: 10 },
      { id: 'c1', hp: 2 },
      { id: 'c2', hp: 1 },
    ]);
    const dmg = actions.filter((a) => a.type === 'MODIFY_PARTY_HEALTH') as Array<{
      payload: { amount: number; characterIds?: string[] };
    }>;
    const byId = Object.fromEntries(dmg.map((a) => [a.payload.characterIds![0], a.payload.amount]));
    expect(byId['player']).toBe(-STARVATION_HP_DAMAGE);
    expect(byId['c1']).toBe(-1); // clamped: 2 HP → 1 HP, never 0
    expect(byId['c2']).toBeUndefined(); // already at the floor — no action
  });

  it('a provisioned leg deals no starvation damage', () => {
    const actions = buildProvisionActions(fullLeg, [], [{ id: 'player', hp: 10 }]);
    expect(actions.some((a) => a.type === 'MODIFY_PARTY_HEALTH')).toBe(false);
  });
});
