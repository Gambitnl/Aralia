import { describe, it, expect } from 'vitest';
import { CrewManager, OFFICER_ROLES } from '../CrewManager';
import { SeededRandom } from '@/utils/random';
import type { Crew, CrewMember, CrewRole, Ship } from '../../../types/naval';

/**
 * The mutiny loyalty buffer is the margin between a dangerous grumble and an
 * actual rising (agora-cc98). It replaces a morale-derived placeholder, so it is
 * built from the roster: the chain of command's loyalty, plus the share of the
 * crew who would stand with the captain.
 */
function member(role: CrewRole, loyalty: number, traits: string[] = [], morale = 50): CrewMember {
  return {
    id: `${role}-${loyalty}-${traits.join('+')}`,
    name: `${role} ${loyalty}`,
    role,
    skills: {},
    morale,
    loyalty,
    dailyWage: 1,
    traits,
  };
}

const crewOf = (members: CrewMember[]): Crew => CrewManager.calculateCrewStats(members);

describe('CrewManager.mutinyLoyaltyBuffer', () => {
  it('names the chain of command it weighs', () => {
    expect([...OFFICER_ROLES]).toEqual(['Captain', 'FirstMate', 'Bosun', 'Quartermaster']);
  });

  it('gives a neutral crew no margin at all', () => {
    const crew = crewOf([member('Captain', 50), member('Sailor', 50), member('Sailor', 50)]);
    expect(CrewManager.mutinyLoyaltyBuffer(crew)).toBe(0);
  });

  it('returns nothing for an empty roster', () => {
    expect(CrewManager.mutinyLoyaltyBuffer(crewOf([]))).toBe(0);
  });

  it('pays the full officer term for a devoted wardroom plus its loyalist share', () => {
    // Officer mean 100 -> 15. One of four hands clears the loyalist mark -> 2.5.
    const crew = crewOf([member('Captain', 100), member('Sailor', 50), member('Sailor', 50), member('Sailor', 50)]);
    expect(CrewManager.mutinyLoyaltyBuffer(crew)).toBeCloseTo(17.5, 10);
  });

  it('lets a bought wardroom cancel the loyalists below deck, but never goes negative', () => {
    // Officer mean 0 -> -15; three of four hands are loyalists -> +7.5.
    const crew = crewOf([member('Captain', 0), member('Sailor', 80), member('Sailor', 80), member('Sailor', 80)]);
    expect(CrewManager.mutinyLoyaltyBuffer(crew)).toBe(0);
  });

  it('gives an officerless crew only its loyalist term', () => {
    const crew = crewOf([member('Sailor', 100), member('Sailor', 100)]);
    expect(CrewManager.mutinyLoyaltyBuffer(crew)).toBeCloseTo(10, 10);
  });

  it("counts a 'Loyal' hand as a loyalist below the ordinary mark", () => {
    const withTrait = crewOf([member('Sailor', 65, ['Loyal']), member('Sailor', 65)]);
    expect(CrewManager.mutinyLoyaltyBuffer(withTrait)).toBeCloseTo(5, 10);

    const withoutTrait = crewOf([member('Sailor', 65), member('Sailor', 65)]);
    expect(CrewManager.mutinyLoyaltyBuffer(withoutTrait)).toBe(0);
  });

  it('does not move with morale — unrest already accounts for that', () => {
    const roster = () => [member('Captain', 90, [], 0), member('Sailor', 90, [], 0)];
    const bleak = crewOf(roster());
    const cheerful = crewOf(roster().map(m => ({ ...m, morale: 100 })));
    expect(CrewManager.mutinyLoyaltyBuffer(bleak)).toBe(CrewManager.mutinyLoyaltyBuffer(cheerful));
  });

  it('weighs where the loyalty sits, not just its average', () => {
    // Both crews average 50 loyalty, so both reach the same unrest.
    const loyalOfficer = crewOf([member('Captain', 100), member('Sailor', 0)]);
    const boughtOfficer = crewOf([member('Captain', 0), member('Sailor', 100)]);
    expect(loyalOfficer.unrest).toBe(boughtOfficer.unrest);
    expect(CrewManager.mutinyLoyaltyBuffer(loyalOfficer)).toBeGreaterThan(
      CrewManager.mutinyLoyaltyBuffer(boughtOfficer),
    );
  });
});

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
  };
}

describe('processDailyCrewUpdate mutiny check', () => {
  /**
   * Unpaid wages on a near-broken crew: unrest clears the mutiny threshold, so
   * the roll decides and the buffer is what shifts the odds. Seeds are spread by
   * a large prime because this Lehmer generator's first draw is proportional to
   * a small seed — counting 0, 1, 2 would roll almost zero every time.
   */
  const SEED_STRIDE = 1299709;

  const mutiniesOver = (members: () => CrewMember[], seeds: number): number => {
    let mutinies = 0;
    for (let i = 0; i < seeds; i++) {
      const rng = new SeededRandom(i * SEED_STRIDE + 7);
      const result = CrewManager.processDailyCrewUpdate(shipWith(members()), 0, rng);
      if (result.mutinyTriggered) mutinies++;
    }
    return mutinies;
  };

  it('rises less often under a loyal wardroom than a bought one at the same unrest', () => {
    const SEEDS = 200;
    const loyalOfficer = mutiniesOver(() => [member('Captain', 100, [], 5), member('Sailor', 0, [], 5)], SEEDS);
    const boughtOfficer = mutiniesOver(() => [member('Captain', 0, [], 5), member('Sailor', 100, [], 5)], SEEDS);

    expect(loyalOfficer).toBeGreaterThan(0);
    expect(boughtOfficer).toBeGreaterThan(loyalOfficer);
  });
});
