/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/CrewManager.ts
 * Logic for crew generation, management, and daily updates.
 */

import { v4 as uuidv4 } from 'uuid';
import { Crew, CrewMember, CrewRole, Ship } from '../../types/naval';
import { CREW_NAMES, CREW_SURNAMES, CREW_TRAITS, ROLE_BASE_SKILLS, ROLE_DAILY_WAGE } from '../../data/naval/crewTraits';
import { SeededRandom } from '../../utils/seededRandom';

// Initialize a seeded random generator (using date for now, can be replaced)
const rng = new SeededRandom(Date.now());

export class CrewManager {
  /**
   * Generates a new crew member with personality and skills.
   */
  static generateCrewMember(role: CrewRole, level: number = 1): CrewMember {
    const firstName = rng.pick(CREW_NAMES);
    const surname = rng.pick(CREW_SURNAMES);

    // Pick 1-2 random traits
    const traitKeys = Object.keys(CREW_TRAITS);
    const numTraits = rng.nextInt(1, 3); // 1 or 2
    const traits: string[] = [];
    for (let i = 0; i < numTraits; i++) {
        const trait = rng.pick(traitKeys);
        if (!traits.includes(trait)) {
            traits.push(trait);
        }
    }

    // Calculate skills based on role + traits
    const skills: Record<string, number> = { ...ROLE_BASE_SKILLS[role] };

    // Add randomness to skills based on level
    for (const skill in skills) {
        skills[skill] += rng.nextInt(0, level);
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
      id: uuidv4(),
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
  static recruitCrew(ship: Ship, role: CrewRole, level: number = 1): Ship {
    const newMember = this.generateCrewMember(role, level);
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
   * @returns Updated ship, remaining funds, and logs
   */
  static processDailyCrewUpdate(ship: Ship, availableFunds: number): {
      ship: Ship;
      remainingFunds: number;
      logs: string[];
      mutinyTriggered: boolean;
  } {
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

      // 4. Mutiny Check
      let mutinyTriggered = false;
      if (unrest > 80) {
          // High chance of mutiny
          // Reduce chance if Loyalty is high (already factored into unrest, but maybe individual loyalists help?)
          const loyaltyBuffer = Math.max(0, (updatedCrew.averageMorale + 50) / 10); // Placeholder logic

          if (rng.nextInt(0, 100) < (unrest - 50 - loyaltyBuffer)) {
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
  static modifyCrewLoyalty(crew: Crew, amount: number, reason?: string): void {
      crew.members.forEach(member => {
          const modifiedAmount = amount;

          // Trait modifiers could go here (e.g., 'Fickle')

          member.loyalty = Math.max(0, Math.min(100, member.loyalty + modifiedAmount));
      });
  }
}
