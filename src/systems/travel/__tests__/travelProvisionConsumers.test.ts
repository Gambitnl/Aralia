import { describe, it, expect } from 'vitest';
import { decideTravelProvision, CONSUMER_WEIGHT } from '../travelProvisionDecision';

/**
 * The travelling column is not only the player characters (agora-a2a9). Hired
 * followers and NPC companions eat and drink as people do; mounts graze for most
 * of their feed but drink far more than a person. Food and water therefore have
 * their own person-equivalent consumer counts, and both the range gate and the
 * spend are computed from those counts rather than from `partySize`.
 */
describe('decideTravelProvision consumers', () => {
  it('counts only the party when no followers or mounts travel', () => {
    const d = decideTravelProvision({ foodDays: 20, waterDays: 20, partySize: 4, tripDays: 2, mode: 'full' });
    expect(d.foodConsumers).toBe(4);
    expect(d.waterConsumers).toBe(4);
    expect(d.rationsToSpend).toBe(8);
    expect(d.waterToSpend).toBe(8);
    expect(d.status.inRange).toBe(true);
  });

  it('counts a follower exactly as it counts a party member', () => {
    const merged = decideTravelProvision({ foodDays: 20, waterDays: 20, partySize: 4, tripDays: 2, mode: 'full' });
    const split = decideTravelProvision({ foodDays: 20, waterDays: 20, partySize: 2, followerCount: 2, tripDays: 2, mode: 'full' });
    expect(split).toEqual(merged);
  });

  it('makes water the binding resource once mounts join the column', () => {
    // 2 people + 2 mounts: food 2*1 + 2*2 = 6/day, water 2*1 + 2*4 = 10/day.
    const d = decideTravelProvision({ foodDays: 12, waterDays: 12, partySize: 2, mountCount: 2, tripDays: 2, mode: 'full' });
    expect(d.foodConsumers).toBe(6);
    expect(d.waterConsumers).toBe(10);
    expect(d.status.inRange).toBe(false);
    expect(d.status.binding).toBe('water');
    expect(d.sustainableDays).toBe(1);  // 12 water / 10 per day
    expect(d.rationsToSpend).toBe(12);  // 6/day * 2 days
    expect(d.waterToSpend).toBe(12);    // capped at the 12 carried
  });

  it('halves both resource needs on half rations, rounding each up on its own', () => {
    // 2 people + 1 mount: food 4/day, water 6/day. Half: ceil(4/2)=2, ceil(6/2)=3.
    const d = decideTravelProvision({ foodDays: 10, waterDays: 10, partySize: 2, mountCount: 1, tripDays: 3, mode: 'half' });
    expect(d.foodConsumers).toBe(4);
    expect(d.waterConsumers).toBe(6);
    expect(d.status.inRange).toBe(true); // water range floor(10/3) = 3 days
    expect(d.sustainableDays).toBe(3);
    expect(d.rationsToSpend).toBe(6);
    expect(d.waterToSpend).toBe(9);
  });

  it('keeps each resource need exact when the two counts do not divide evenly', () => {
    // 5 people + 1 mount: food 7/day, water 9/day — the ratio 7/9 is not exactly
    // representable, so the gate must not round a day of food into existence.
    const d = decideTravelProvision({ foodDays: 14, waterDays: 27, partySize: 5, mountCount: 1, tripDays: 2, mode: 'full' });
    expect(d.foodConsumers).toBe(7);
    expect(d.waterConsumers).toBe(9);
    expect(d.status.inRange).toBe(true); // food range floor(14/7) = 2 days exactly
    expect(d.status.binding).toBe('food');
    expect(d.sustainableDays).toBe(2);
    expect(d.rationsToSpend).toBe(14);
    expect(d.waterToSpend).toBe(18);
  });

  it('leaves an empty column ungated and spends nothing', () => {
    const d = decideTravelProvision({ foodDays: 5, waterDays: 5, partySize: 0, tripDays: 3, mode: 'full' });
    expect(d.foodConsumers).toBe(0);
    expect(d.waterConsumers).toBe(0);
    expect(d.status.inRange).toBe(true);
    expect(d.status.binding).toBeNull();
    expect(d.rationsToSpend).toBe(0);
    expect(d.waterToSpend).toBe(0);
  });

  it('ignores negative and fractional counts rather than crediting supply back', () => {
    const d = decideTravelProvision({ foodDays: 20, waterDays: 20, partySize: 4, followerCount: -3, mountCount: 0.9, tripDays: 1, mode: 'full' });
    expect(d.foodConsumers).toBe(4);
    expect(d.waterConsumers).toBe(4);
  });

  it('publishes the per-traveller weights the model is built on', () => {
    expect(CONSUMER_WEIGHT.person).toEqual({ food: 1, water: 1 });
    expect(CONSUMER_WEIGHT.mount.water).toBeGreaterThan(CONSUMER_WEIGHT.mount.food);
  });
});
