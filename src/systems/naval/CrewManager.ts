// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/06/2026, 02:48:37
 * Dependents: data/naval/voyageEvents.ts, state/reducers/navalReducer.ts, systems/naval/VoyageManager.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/CrewManager.ts
 * Logic for crew generation, management, and daily updates.
 */

import { Crew, CrewMember, CrewRole, Ship } from '../../types/naval';
import { CREW_NAMES, CREW_SURNAMES, CREW_TRAITS, ROLE_BASE_SKILLS, ROLE_DAILY_WAGE } from '../../data/naval/crewTraits';
import { SeededRandom } from '@/utils/random';

/**
 * Roles that make up a ship's chain of command. When a rising starts it is the
 * officers who either put it down or lead it, so their loyalty — not the lower
 * deck's average — is what actually buys the captain a margin.
 */
export const OFFICER_ROLES: readonly CrewRole[] = ['Captain', 'FirstMate', 'Bosun', 'Quartermaster'];

/** Loyalty at or above which an ordinary hand stands with the captain. */
const LOYALIST_THRESHOLD = 75;

/**
 * A hand with the 'Loyal' trait stands with the captain from a lower mark: the
 * trait already means this crewman holds on where others would let go.
 */
const LOYAL_TRAIT_THRESHOLD = 60;

/**
 * Percentage points the officer corps is worth. A wholly loyal wardroom (100)
 * adds the full amount; a wholly bought one (0) subtracts it, cancelling what
 * the loyalists below deck are worth. A neutral wardroom (50) is worth nothing.
 */
const OFFICER_BUFFER_MAX = 15;

/** Percentage points a lower deck made up entirely of loyalists is worth. */
const LOYALIST_BUFFER_MAX = 10;

/**
 * The lowest a crew member's loyalty can ever be driven. Loyalty is a 0-100
 * score and nothing — including the faction surcharge below — is allowed to
 * push a hand under it.
 */
export const CREW_LOYALTY_FLOOR = 0;

/**
 * Standing with a ship's faction at or above which the lower deck has nothing
 * to grumble about. Below it the captain has visibly fallen out with the flag
 * his crew signed under.
 */
export const FACTION_UNREST_THRESHOLD = -20;

/**
 * Unrest points a wholly hated faction (standing -100) adds to the daily check.
 * The surcharge only ever ADDS unrest: by Remy's ruling bad standing never
 * subtracts from {@link CrewManager.mutinyLoyaltyBuffer} and never touches crew
 * loyalty, so a fallen-out flag reads as grumbling, not as a vanished officer
 * corps.
 */
export const FACTION_UNREST_SURCHARGE_MAX = 15;

const hashStringToSeed = (value: string): number => {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export class CrewManager {
  /**
   * Generates a new crew member with personality and skills.
   */
  static generateCrewMember(role: CrewRole, level: number = 1, rng?: SeededRandom): CrewMember {
    const randomSource = rng ?? new SeededRandom(hashStringToSeed(`${role}|${level}|crew-generate`));
    const firstName = randomSource.pick(CREW_NAMES);
    const surname = randomSource.pick(CREW_SURNAMES);

    // Pick 1-2 random traits
    const traitKeys = Object.keys(CREW_TRAITS);
    const numTraits = randomSource.nextInt(1, 3); // 1 or 2
    const traits: string[] = [];
    for (let i = 0; i < numTraits; i++) {
        const trait = randomSource.pick(traitKeys);
        if (!traits.includes(trait)) {
            traits.push(trait);
        }
    }

    // Calculate skills based on role + traits
    const skills: Record<string, number> = { ...ROLE_BASE_SKILLS[role] };

    // Add randomness to skills based on level
    for (const skill in skills) {
        skills[skill] += randomSource.nextInt(0, level);
    }

    // Apply trait bonuses
    traits.forEach(trait => {
        const traitData = CREW_TRAITS[trait];
        if (traitData.skillBonus) {
            for (const [skill, bonus] of Object.entries(traitData.skillBonus)) {
                skills[skill] = (skills[skill] || 0) + bonus;
            }
        }
    });

    // Base morale starts high for new recruits
    let morale = 80;
    // Adjust based on traits
    traits.forEach(trait => {
         const traitData = CREW_TRAITS[trait];
         if (traitData.moraleModifier) {
             morale += (traitData.moraleModifier / 2); // Initial morale only partially affected
         }
    });
    morale = Math.max(0, Math.min(100, morale));

    return {
      // The id is derived from the seeded draw stream so repeated runs with
      // the same seed produce the same crew roster.
      id: `crew_${randomSource.nextInt(0, 2147483646).toString(36)}`,
      name: `${firstName} ${surname}`,
      role,
      skills,
      morale,
      loyalty: 50, // Starts neutral
      dailyWage: ROLE_DAILY_WAGE[role] + (level * 0.5), // Higher level costs more
      traits
    };
  }

  /**
   * Percentage points subtracted from a mutiny roll's threshold — the margin
   * standing between a dangerous grumble and an actual rising.
   *
   * Two terms, both drawn from the roster rather than from morale (which the
   * unrest number already accounts for):
   *
   * 1. The officer corps. Mean loyalty across {@link OFFICER_ROLES}, measured
   *    from the neutral 50, scaled to ±{@link OFFICER_BUFFER_MAX}. A crew with
   *    no officers aboard has no chain of command and so gets nothing here.
   * 2. The loyalists below deck. The share of the whole crew standing with the
   *    captain, worth up to {@link LOYALIST_BUFFER_MAX}. A hand counts when its
   *    loyalty clears {@link LOYALIST_THRESHOLD}, or {@link LOYAL_TRAIT_THRESHOLD}
   *    when it carries the 'Loyal' trait.
   *
   * A bought wardroom can cancel the lower deck's loyalists outright, but the
   * buffer never goes negative: officers cannot make a rising more likely than
   * the unrest already makes it.
   */
  static mutinyLoyaltyBuffer(crew: Crew): number {
      const members = crew.members;
      if (members.length === 0) return 0;

      const officers = members.filter(member => OFFICER_ROLES.includes(member.role));
      let officerTerm = 0;
      if (officers.length > 0) {
          const meanOfficerLoyalty = officers.reduce((sum, m) => sum + m.loyalty, 0) / officers.length;
          officerTerm = ((meanOfficerLoyalty - 50) / 50) * OFFICER_BUFFER_MAX;
      }

      const loyalists = members.filter(member => {
          const threshold = member.traits.includes('Loyal') ? LOYAL_TRAIT_THRESHOLD : LOYALIST_THRESHOLD;
          return member.loyalty >= threshold;
      });
      const loyalistTerm = (loyalists.length / members.length) * LOYALIST_BUFFER_MAX;

      return Math.max(0, officerTerm + loyalistTerm);
  }

  /**
   * Unrest points added to the daily mutiny check because the captain has
   * fallen out with the faction his ship sails under.
   *
   * Zero while standing is at or above {@link FACTION_UNREST_THRESHOLD}, then
   * rising linearly to {@link FACTION_UNREST_SURCHARGE_MAX} at standing -100.
   * The result is never negative: good standing with the flag is its own
   * reward elsewhere, it does not buy down a mutiny here.
   *
   * @param standing The player's public standing with the ship's faction, -100 to 100.
   */
  static factionUnrestSurcharge(standing: number): number {
      if (standing >= FACTION_UNREST_THRESHOLD) return 0;

      const span = FACTION_UNREST_THRESHOLD - -100;
      const depth = Math.min(FACTION_UNREST_THRESHOLD - standing, span);

      return (depth / span) * FACTION_UNREST_SURCHARGE_MAX;
  }

  /**
   * Calculates derived stats for the entire crew.
   */
  static calculateCrewStats(members: CrewMember[]): Crew {
    if (members.length === 0) {
        return {
            members: [],
            averageMorale: 0,
            unrest: 0,
            quality: 'Poor'
        };
    }

    const totalMorale = members.reduce((sum, m) => sum + m.morale, 0);
    const averageMorale = Math.round(totalMorale / members.length);

    const totalLoyalty = members.reduce((sum, m) => sum + m.loyalty, 0);
    const averageLoyalty = Math.round(totalLoyalty / members.length);

    // Unrest calculation:
    // Low morale increases unrest.
    // High loyalty dampens unrest.
    // Base Unrest = (100 - Average Morale)
    // Modifier = (Average Loyalty - 50) / 2. If loyalty is 100, reduces unrest by 25. If 0, increases by 25.
    let unrest = (100 - averageMorale);
    const loyaltyModifier = (averageLoyalty - 50) / 2;

    unrest -= loyaltyModifier;

    // Calculate quality based on average skill level or specific key skills
    // For simplicity, using average total skill points
    const totalSkillPoints = members.reduce((sum, m) => sum + Object.values(m.skills).reduce((a, b) => a + b, 0), 0);
    const avgSkill = totalSkillPoints / members.length;

    let quality: Crew['quality'] = 'Poor';
    if (avgSkill > 20) quality = 'Elite';
    else if (avgSkill > 15) quality = 'Veteran';
    else if (avgSkill > 10) quality = 'Experienced';
    else if (avgSkill > 5) quality = 'Average';

    return {
        members,
        averageMorale,
        unrest: Math.max(0, Math.min(100, unrest)), // Clamp 0-100
        quality
    };
  }

  /**
   * Adds a new crew member to the ship.
   */
  static recruitCrew(ship: Ship, role: CrewRole, level: number = 1, rng?: SeededRandom): Ship {
    const newMember = this.generateCrewMember(role, level, rng);
    const newMembers = [...ship.crew.members, newMember];

    // Recalculate crew stats
    const newCrew = this.calculateCrewStats(newMembers);

    return {
        ...ship,
        crew: newCrew
    };
  }

  /**
   * Processes daily updates for the crew: wages, morale decay, mutiny checks.
   * @param ship The ship to update
   * @param availableFunds The captain's gold available for wages
   * @param rng Optional seeded source used by callers that already have a replay seed.
   *            If omitted, the current ship/funds snapshot is hashed so the
   *            fallback path still behaves deterministically.
   * @param factionStanding The player's public standing with the faction this ship
   *            sails under (see systems/naval/shipFaction.ts). Bad standing adds
   *            an unrest surcharge; it never touches crew loyalty and never
   *            reduces the mutiny buffer. Omitted by callers that have no
   *            faction state to hand, and the surcharge is then not applied.
   * @returns Updated ship, remaining funds, and logs
   */
  static processDailyCrewUpdate(
      ship: Ship,
      availableFunds: number,
      rng?: SeededRandom,
      factionStanding?: number
  ): {
      ship: Ship;
      remainingFunds: number;
      logs: string[];
      mutinyTriggered: boolean;
  } {
      const randomSource = rng ?? new SeededRandom(hashStringToSeed([
          ship.id,
          ship.crew.members.length,
          ship.crew.averageMorale,
          ship.crew.unrest,
          availableFunds
      ].join('|')));
      const logs: string[] = [];
      let currentFunds = availableFunds;
      let totalWages = 0;
      let unpaidWages = false;

      // 1. Pay Wages
      ship.crew.members.forEach(member => {
          totalWages += member.dailyWage;
      });

      if (currentFunds >= totalWages) {
          currentFunds -= totalWages;
          logs.push(`Paid ${totalWages}gp in daily wages.`);

          // Small morale boost
          this.modifyCrewMorale(ship.crew, 1, 'Daily wages paid');

          // Tiny loyalty gain (loyalty is hard to earn)
          this.modifyCrewLoyalty(ship.crew, 0.2, 'Daily wages paid');
      } else {
          unpaidWages = true;
          logs.push(`CRITICAL: Insufficient funds for wages! Needed ${totalWages}gp, had ${currentFunds}gp.`);

          // Large morale hit
          this.modifyCrewMorale(ship.crew, -10, 'Wages unpaid');

          // Loyalty hit
          this.modifyCrewLoyalty(ship.crew, -2, 'Wages unpaid');
      }

      // 2. Daily Morale Drift
      // Morale drifts towards 50 naturally if nothing happens
      ship.crew.members.forEach(member => {
          if (member.morale > 50) member.morale -= 1;
          if (member.morale < 50) member.morale += 0.5;
      });

      // 3. Unrest Calculation
      const updatedCrew = this.calculateCrewStats(ship.crew.members);
      let unrest = updatedCrew.unrest;

      if (unpaidWages) {
          unrest += 10;
      }

      // 3b. Faction Surcharge
      // A captain who has fallen out with the flag his crew signed under gets
      // grumbling, not a collapsed wardroom: the term adds unrest only. Crew
      // loyalty is untouched here, so no hand is pushed below CREW_LOYALTY_FLOOR.
      if (factionStanding !== undefined) {
          const factionSurcharge = this.factionUnrestSurcharge(factionStanding);

          if (factionSurcharge > 0) {
              unrest += factionSurcharge;
              logs.push('The crew mutters about the company the captain keeps.');
          }
      }

      // 4. Mutiny Check
      let mutinyTriggered = false;
      if (unrest > 80) {
          // High chance of mutiny. Unrest already folds in the crew's average
          // loyalty; the buffer is the separate weight of the officer corps and
          // of the individual loyalists who would stand against a rising.
          const loyaltyBuffer = this.mutinyLoyaltyBuffer(updatedCrew);

          if (randomSource.nextInt(0, 100) < (unrest - 50 - loyaltyBuffer)) {
              mutinyTriggered = true;
              logs.push('MUTINY! The crew has risen up against you!');
          } else {
              logs.push('The crew is grumbling dangerously...');
          }
      } else if (unrest > 50) {
          logs.push('Discontent is spreading among the crew.');
      }

      // Update ship object
      const finalCrew = {
          ...updatedCrew,
          unrest: Math.min(100, unrest)
      };

      return {
          ship: { ...ship, crew: finalCrew },
          remainingFunds: currentFunds,
          logs,
          mutinyTriggered
      };
  }

  /**
   * Modifies morale for all crew members.
   */
  static modifyCrewMorale(crew: Crew, amount: number, reason?: string): void {
      crew.members.forEach(member => {
          let modifiedAmount = amount;

          // Apply trait modifiers
          if (amount < 0 && member.traits.includes('Superstitious') && reason?.includes('weather')) {
              modifiedAmount *= 1.5;
          }
          if (amount < 0 && member.traits.includes('Loyal')) {
              modifiedAmount *= 0.5; // Loyal crew lose morale slower
          }

          member.morale = Math.max(0, Math.min(100, member.morale + modifiedAmount));
      });
  }

  /**
   * Modifies loyalty for all crew members.
   */
  static modifyCrewLoyalty(crew: Crew, amount: number, _reason?: string): void {
      crew.members.forEach(member => {
          const modifiedAmount = amount;

          // Trait modifiers could go here (e.g., 'Fickle')

          member.loyalty = Math.max(0, Math.min(100, member.loyalty + modifiedAmount));
      });
  }
}
