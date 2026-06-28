import { describe, it, expect } from 'vitest';
import { decideTravelProvision } from '../travelProvisionDecision';

/**
 * The travel-provision decision turns a trip + carried supplies into everything
 * the gate needs: the multi-resource status (does food/water cover the trip?),
 * how many travel-days are sustainable (for the partial-stop halt cell), and how
 * many rations/water to actually spend. Pure — no inventory or route objects, so
 * App (in-range spend) and MapPane (choice flow + halt) share one tested rule.
 */
describe('decideTravelProvision', () => {
  it('covers an in-range trip and spends a full day of each resource per day', () => {
    const d = decideTravelProvision({ foodDays: 20, waterDays: 20, partySize: 4, tripDays: 2, mode: 'full' });
    expect(d.status.inRange).toBe(true);
    expect(d.sustainableDays).toBe(2);
    expect(d.rationsToSpend).toBe(8); // 4/day * 2 days
    expect(d.waterToSpend).toBe(8);
  });

  it('caps spend at what is carried and halts at the binding (water) horizon', () => {
    // Food covers 5 days, water only 2 (8 water / 4 per day). Water binds.
    const d = decideTravelProvision({ foodDays: 20, waterDays: 8, partySize: 4, tripDays: 5, mode: 'full' });
    expect(d.status.inRange).toBe(false);
    expect(d.status.binding).toBe('water');
    expect(d.sustainableDays).toBe(2);          // halt after 2 days
    expect(d.rationsToSpend).toBe(20);          // eat all 20 carried (need 20 over 5 days)
    expect(d.waterToSpend).toBe(8);             // drink all 8 carried
  });

  it('half rations stretch the horizon and halve the spend', () => {
    // need = ceil(4/2) = 2/day. 8 food -> 4 days range; 8 water -> 4 days.
    const d = decideTravelProvision({ foodDays: 8, waterDays: 8, partySize: 4, tripDays: 4, mode: 'half' });
    expect(d.status.inRange).toBe(true);
    expect(d.rationsToSpend).toBe(8); // 2/day * 4 days
    expect(d.waterToSpend).toBe(8);
  });

  it('foraged food-days extend the food horizon without changing ration spend', () => {
    // Carry 4 food (1 day for a party of 4), forage +4 food-days -> 2-day range.
    const base = decideTravelProvision({ foodDays: 4, waterDays: 99, partySize: 4, tripDays: 2, mode: 'full' });
    expect(base.status.inRange).toBe(false); // 1-day range vs 2-day trip

    const foraged = decideTravelProvision({ foodDays: 4, waterDays: 99, partySize: 4, tripDays: 2, mode: 'full', forageFoodDays: 4 });
    expect(foraged.status.inRange).toBe(true);
    expect(foraged.rationsToSpend).toBe(4); // still only the 4 carried rations are spent
  });
});
