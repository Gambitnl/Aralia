import { describe, it, expect } from 'vitest';
import {
  CrewManager,
  CREW_LOYALTY_FLOOR,
  FACTION_UNREST_SURCHARGE_MAX,
  FACTION_UNREST_THRESHOLD,
} from '../CrewManager';
import { SeededRandom } from '@/utils/random';
import type { CrewMember, CrewRole, Ship } from '../../../types/naval';

/**
 * Remy's ruling (world sheet q9, 2026-09-20): bad standing with the ship's
 * faction adds an UNREST SURCHARGE to the mutiny check. It never subtracts from
 * the loyalty buffer and never drives a hand's loyalty below its floor — a
 * fallen-out flag reads as grumbling, not as a vanished officer corps.
 */
function member(role: CrewRole, loyalty: number, morale = 50, traits: string[] = []): CrewMember {
  return {
    id: `${role}-${loyalty}-${morale}`,
    name: `${role} ${loyalty}`,
    role,
    skills: {},
    morale,
    loyalty,
    dailyWage: 1,
    traits,
  };
}

function shipWith(members: CrewMember[]): Ship {
  return {
    id: 'test-ship',
    name: 'Test Hull',
    type: 'Sloop',
    size: 'Medium',
    description: 'A test hull.',
    stats: {
      speed: 30, maneuverability: 0, hullPoints: 100, maxHullPoints: 100,
      armorClass: 12, cargoCapacity: 10, crewMin: 1, crewMax: 20,
    },
    crew: CrewManager.calculateCrewStats(members),
    cargo: { items: [], totalWeight: 0, capacityUsed: 0, supplies: { food: 10, water: 10 } },
    modifications: [],
    weapons: [],
    flags: {},
    factionId: 'iron_ledger',
  };
}

describe('CrewManager.factionUnrestSurcharge', () => {
  it('costs nothing while standing sits at or above the grumbling threshold', () => {
    expect(CrewManager.factionUnrestSurcharge(100)).toBe(0);
    expect(CrewManager.factionUnrestSurcharge(0)).toBe(0);
    expect(CrewManager.factionUnrestSurcharge(FACTION_UNREST_THRESHOLD)).toBe(0);
  });

  it('charges the full surcharge to a captain the flag has come to hate', () => {
    expect(CrewManager.factionUnrestSurcharge(-100)).toBeCloseTo(FACTION_UNREST_SURCHARGE_MAX, 10);
  });

  it('rises linearly between the threshold and outright hatred', () => {
    expect(CrewManager.factionUnrestSurcharge(-60)).toBeCloseTo(FACTION_UNREST_SURCHARGE_MAX / 2, 10);
  });

  it('clamps below -100 rather than running away', () => {
    expect(CrewManager.factionUnrestSurcharge(-200)).toBeCloseTo(FACTION_UNREST_SURCHARGE_MAX, 10);
  });

  it('is never negative: good standing does not buy down a mutiny here', () => {
    for (let standing = -100; standing <= 100; standing += 5) {
      expect(CrewManager.factionUnrestSurcharge(standing)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('processDailyCrewUpdate faction surcharge', () => {
  /** A contented-enough crew: unrest lands under the discontent mark on its own. */
  const settledCrew = () => [member('Captain', 50, 55), member('Sailor', 50, 55), member('Sailor', 50, 55)];

  it('leaves the day untouched when the caller passes no faction standing', () => {
    const rng = () => new SeededRandom(101);
    const without = CrewManager.processDailyCrewUpdate(shipWith(settledCrew()), 100, rng());
    const neutral = CrewManager.processDailyCrewUpdate(shipWith(settledCrew()), 100, rng(), 0);

    expect(without.ship.crew.unrest).toBe(neutral.ship.crew.unrest);
    expect(without.logs).toEqual(neutral.logs);
  });

  it("raises unrest when the captain has fallen out with the ship's faction", () => {
    const neutral = CrewManager.processDailyCrewUpdate(shipWith(settledCrew()), 100, new SeededRandom(101), 0);
    const hated = CrewManager.processDailyCrewUpdate(shipWith(settledCrew()), 100, new SeededRandom(101), -100);

    expect(hated.ship.crew.unrest).toBeCloseTo(neutral.ship.crew.unrest + FACTION_UNREST_SURCHARGE_MAX, 10);
  });

  it('turns a settled crew into a discontented one, and says why in the log', () => {
    const neutral = CrewManager.processDailyCrewUpdate(shipWith(settledCrew()), 100, new SeededRandom(101), 0);
    const hated = CrewManager.processDailyCrewUpdate(shipWith(settledCrew()), 100, new SeededRandom(101), -100);

    expect(neutral.logs).not.toContain('Discontent is spreading among the crew.');
    expect(hated.logs).toContain('Discontent is spreading among the crew.');
    expect(hated.logs).toContain('The crew mutters about the company the captain keeps.');
  });

  it('stays silent about the flag when standing is merely poor but not fallen out', () => {
    const result = CrewManager.processDailyCrewUpdate(
      shipWith(settledCrew()), 100, new SeededRandom(101), FACTION_UNREST_THRESHOLD,
    );
    expect(result.logs).not.toContain('The crew mutters about the company the captain keeps.');
  });

  it('never moves crew loyalty, and never pushes a hand below the loyalty floor', () => {
    // Worst case: wages unpaid for a fortnight under a hated flag.
    const rosterFor = (standing: number | undefined) => {
      let ship = shipWith([member('Captain', 1, 10), member('Sailor', 1, 10), member('Sailor', 1, 10)]);
      for (let day = 0; day < 14; day++) {
        ship = CrewManager.processDailyCrewUpdate(ship, 0, new SeededRandom(9001 + day), standing).ship;
        for (const hand of ship.crew.members) {
          expect(hand.loyalty).toBeGreaterThanOrEqual(CREW_LOYALTY_FLOOR);
        }
      }
      return ship.crew.members.map(m => m.loyalty);
    };

    expect(rosterFor(-100)).toEqual(rosterFor(undefined));
  });

  it('leaves the mutiny loyalty buffer alone — the surcharge is unrest, not a lost wardroom', () => {
    const roster = () => [member('Captain', 100, 10), member('Sailor', 80, 10)];
    const neutral = CrewManager.processDailyCrewUpdate(shipWith(roster()), 100, new SeededRandom(7), 0);
    const hated = CrewManager.processDailyCrewUpdate(shipWith(roster()), 100, new SeededRandom(7), -100);

    expect(CrewManager.mutinyLoyaltyBuffer(hated.ship.crew))
      .toBeCloseTo(CrewManager.mutinyLoyaltyBuffer(neutral.ship.crew), 10);
  });

  it('makes a rising more likely under a hated flag than a friendly one', () => {
    // Seeds are spread by a large prime: this Lehmer generator's first draw is
    // proportional to a small seed, so 0,1,2 would roll almost zero every time.
    const SEED_STRIDE = 1299709;
    const risings = (standing: number): number => {
      let count = 0;
      for (let i = 0; i < 200; i++) {
        const roster = [member('Captain', 40, 20), member('Sailor', 40, 20)];
        const result = CrewManager.processDailyCrewUpdate(
          shipWith(roster), 100, new SeededRandom(i * SEED_STRIDE + 7), standing,
        );
        if (result.mutinyTriggered) count++;
      }
      return count;
    };

    const friendly = risings(50);
    const hated = risings(-100);

    expect(friendly).toBeGreaterThan(0);
    expect(hated).toBeGreaterThan(friendly);
  });
});
