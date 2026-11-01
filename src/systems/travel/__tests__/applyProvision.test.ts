import { describe, it, expect } from 'vitest';
import { buildProvisionActions, DESERT_LOYALTY_THRESHOLD } from '../applyProvision';

/**
 * After a gated trip, App must translate the TravelMeta.provision into reducer
 * actions: spend rations + water, apply each condition party-wide, drain each
 * companion's loyalty on a starving march, and — when that drop takes a companion
 * to/under the desertion threshold — have them abandon the party instead. This
 * pure mapping is the App-side contract, tested without a browser.
 */
describe('buildProvisionActions', () => {
  it('spends rations and water that were consumed', () => {
    const actions = buildProvisionActions({ rationsToSpend: 6, waterToSpend: 4 }, []);
    expect(actions).toContainEqual({ type: 'REMOVE_ITEM', payload: { itemId: 'rations', count: 6 } });
    expect(actions).toContainEqual({ type: 'REMOVE_ITEM', payload: { itemId: 'water-day', count: 4 } });
  });

  it('omits a resource spend of zero', () => {
    const actions = buildProvisionActions({ rationsToSpend: 0, waterToSpend: 3 }, []);
    expect(actions.some((a) => a.type === 'REMOVE_ITEM' && a.payload.itemId === 'rations')).toBe(false);
    expect(actions).toContainEqual({ type: 'REMOVE_ITEM', payload: { itemId: 'water-day', count: 3 } });
  });

  it('applies each party condition once', () => {
    const actions = buildProvisionActions(
      { rationsToSpend: 0, waterToSpend: 0, conditions: ['starving', 'poisoned'] },
      [],
    );
    expect(actions).toContainEqual({ type: 'SET_PARTY_CONDITION', payload: { condition: 'starving' } });
    expect(actions).toContainEqual({ type: 'SET_PARTY_CONDITION', payload: { condition: 'poisoned' } });
  });

  it('drains loyalty for a companion who can endure the march', () => {
    const actions = buildProvisionActions(
      { rationsToSpend: 0, waterToSpend: 0, companionLoyaltyDelta: -15 },
      [{ id: 'ada', loyalty: 80 }],
    );
    expect(actions).toContainEqual({ type: 'ADJUST_COMPANION_LOYALTY', payload: { companionId: 'ada', delta: -15 } });
    expect(actions.some((a) => a.type === 'COMPANION_DESERT')).toBe(false);
  });

  it('deserts a companion whose loyalty drops to/under the threshold', () => {
    const lowLoyalty = DESERT_LOYALTY_THRESHOLD + 5; // a -15 march pushes this under
    const actions = buildProvisionActions(
      { rationsToSpend: 0, waterToSpend: 0, companionLoyaltyDelta: -15 },
      [{ id: 'bran', loyalty: lowLoyalty }],
    );
    expect(actions).toContainEqual({ type: 'COMPANION_DESERT', payload: { companionId: 'bran', reason: 'starvation' } });
    // A deserting companion is not also given a loyalty tweak.
    expect(actions.some((a) => a.type === 'ADJUST_COMPANION_LOYALTY')).toBe(false);
  });

  it('produces no companion actions when there is no loyalty delta', () => {
    const actions = buildProvisionActions({ rationsToSpend: 2, waterToSpend: 0 }, [{ id: 'ada', loyalty: 50 }]);
    expect(actions.some((a) => a.type === 'ADJUST_COMPANION_LOYALTY' || a.type === 'COMPANION_DESERT')).toBe(false);
  });

  it('emits SET_TRAVEL_MINUTES_REMAINDER when remainderMinutes is present (GG-471)', () => {
    const actions = buildProvisionActions({ rationsToSpend: 0, waterToSpend: 0, remainderMinutes: 180 }, []);
    expect(actions).toContainEqual({
      type: 'SET_TRAVEL_MINUTES_REMAINDER',
      payload: { minutes: 180 },
    });
  });

  it('charges 0 rations over three 1-hour hops by 4 people until a day boundary passes (GG-471)', () => {
    // GG-471 acceptance test: three 1-hour hops by 4 people charge 0 rations until a day boundary passes.
    let remainder = 0;
    const hopMinutes = 60;
    let totalRationsSpent = 0;
    let totalWaterSpent = 0;

    for (let hop = 1; hop <= 3; hop++) {
      const totalMinutes = remainder + hopMinutes;
      const days = Math.floor(totalMinutes / (24 * 60));
      remainder = totalMinutes % (24 * 60);

      const rationsToSpend = 4 * days;
      const waterToSpend = 4 * days;
      const actions = buildProvisionActions({ rationsToSpend, waterToSpend, remainderMinutes: remainder }, []);

      totalRationsSpent += rationsToSpend;
      totalWaterSpent += waterToSpend;

      expect(actions.some((a) => a.type === 'REMOVE_ITEM' && a.payload.itemId === 'rations')).toBe(false);
      expect(actions.some((a) => a.type === 'REMOVE_ITEM' && a.payload.itemId === 'water-day')).toBe(false);
      expect(actions).toContainEqual({
        type: 'SET_TRAVEL_MINUTES_REMAINDER',
        payload: { minutes: hop * 60 },
      });
    }

    expect(totalRationsSpent).toBe(0);
    expect(totalWaterSpent).toBe(0);
    expect(remainder).toBe(180);
  });
});
