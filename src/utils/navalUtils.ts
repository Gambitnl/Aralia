/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/navalUtils.ts
 * Logic for ship mechanics, crew management, and naval calculations.
 */

import { Ship, ShipStats, CrewMember, ShipModification, WeatherCondition, WindDirection, NavalCombatState, NavalTactic } from '../types/naval';
import { SHIP_TEMPLATES } from '../data/ships';
import { WEATHER_EFFECTS, TACTIC_DESCRIPTIONS } from '../data/navalCombat';

/**
 * Creates a new ship instance from a template.
 */
export function createShip(name: string, type: keyof typeof SHIP_TEMPLATES): Ship {
  const template = SHIP_TEMPLATES[type];

  return {
    id: `ship_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    name,
    type,
    size: template.size,
    description: template.description,
    stats: { ...template.baseStats },
    crew: {
      members: [],
      averageMorale: 100,
      unrest: 0,
      quality: 'Average',
    },
    cargo: {
      items: [],
      totalWeight: 0,
      capacityUsed: 0,
    },
    modifications: [],
    weapons: [],
    flags: {},
  };
}

/**
 * Calculates current ship stats including modifications and crew effects.
 */
export function calculateShipStats(ship: Ship): ShipStats {
  const stats = { ...ship.stats };

  // Apply modifications
  // We apply 'add' modifiers first, then 'multiply' modifiers to ensure consistency
  const addModifiers = ship.modifications.flatMap(m => m.modifiers.filter(mod => mod.operation === 'add'));
  const multiplyModifiers = ship.modifications.flatMap(m => m.modifiers.filter(mod => mod.operation === 'multiply'));

  for (const mod of addModifiers) {
    if (stats[mod.stat] !== undefined) {
        stats[mod.stat] += mod.value;
    }
  }

  for (const mod of multiplyModifiers) {
    if (stats[mod.stat] !== undefined) {
        stats[mod.stat] *= mod.value;
    }
  }

  // Ensure non-negative values for critical stats
  stats.maxHullPoints = Math.max(1, stats.maxHullPoints);
  stats.hullPoints = Math.min(stats.hullPoints, stats.maxHullPoints); // Cap current HP at max
  stats.speed = Math.max(0, stats.speed);


  // Apply Crew Effects
  // If crew is below minimum, speed and maneuverability suffer
  const crewCount = ship.crew.members.length;
  if (crewCount < stats.crewMin) {
    const penaltyFactor = crewCount / stats.crewMin;
    stats.speed *= penaltyFactor;
    stats.maneuverability -= (stats.crewMin - crewCount); // Significant penalty
  }

  // Morale bonus/penalty
  if (ship.crew.averageMorale > 80) {
    stats.maneuverability += 1;
    stats.speed *= 1.1; // 10% speed boost for high morale
  } else if (ship.crew.averageMorale < 40) {
    stats.maneuverability -= 2;
    stats.speed *= 0.8; // 20% penalty for low morale
  }

  return stats;
}

/**
 * Installs a modification on a ship.
 * Does not check costs (should be handled by business logic), but can check compatibility.
 */
export function installModification(ship: Ship, modification: ShipModification): { success: boolean; reason?: string; ship?: Ship } {
  // Check if already installed
  if (ship.modifications.some(m => m.id === modification.id)) {
    return { success: false, reason: 'Modification already installed' };
  }

  // Check size requirements
  if (modification.requirements?.minSize) {
     // Logic to check size rank if we had an ordered list, but for now exact match or list check
     // Assuming requirements.minSize is a list of allowed sizes for simplicity or we implement a size rank comparison
     if (!modification.requirements.minSize.includes(ship.size)) {
         // This is a strict include check. If we wanted "Medium or larger", we'd need size ranking.
         // Let's assume for now the data provides the allowed list.
         // Re-reading type: minSize?: ShipSize[];
         // Wait, type definition I wrote was minSize?: ShipSize[]; which implies a list of allowed sizes?
         // Or is it "Minimum Size"?
         // "minSize" usually implies "This size or larger".
         // But logic is easier if it's just "allowedSizes".
         // Let's treat it as "Allowed Sizes" for now unless I implement a size rank map.

         const sizeRank: Record<string, number> = { 'Tiny': 1, 'Small': 2, 'Medium': 3, 'Large': 4, 'Huge': 5, 'Gargantuan': 6 };
         const shipRank = sizeRank[ship.size];
         // Actually, let's implement true "minSize" check if it's an array of length 1, or just check if it's in the list?
         // The type says `minSize?: ShipSize[]`.
         // Let's assume if the array is present, the ship size must be in it.
          if (!modification.requirements.minSize.includes(ship.size)) {
               return { success: false, reason: `Ship size ${ship.size} not supported (requires ${modification.requirements.minSize.join(', ')})` };
          }
     }
  }

  return {
    success: true,
    ship: {
      ...ship,
      modifications: [...ship.modifications, modification],
    },
  };
}


/**
 * Adds a crew member to the ship and recalculates morale.
 */
export function addCrewMember(ship: Ship, member: CrewMember): Ship {
  const newMembers = [...ship.crew.members, member];

  // Recalculate average morale
  const totalMorale = newMembers.reduce((sum, m) => sum + m.morale, 0);
  const averageMorale = Math.round(totalMorale / newMembers.length);

  return {
    ...ship,
    crew: {
      ...ship.crew,
      members: newMembers,
      averageMorale,
    },
  };
}

/**
 * Calculates travel time in hours for a given distance in miles.
 * Takes into account ship speed (which is roughly ft/round / 10 in mph).
 *
 * D&D 5e standard:
 * Speed 30 ft/round = 3 mph
 * Speed 20 ft/round = 2 mph
 * So mph = speed / 10
 */
export function calculateTravelTime(ship: Ship, distanceMiles: number, windFactor: number = 1.0): number {
  const stats = calculateShipStats(ship);

  // Base speed in mph
  const speedMph = stats.speed / 10;

  // Adjusted speed cannot be less than 0.5 mph unless ship is wrecked
  const adjustedSpeed = Math.max(0.5, speedMph * windFactor);

  return distanceMiles / adjustedSpeed;
}

/**
 * Checks if a mutiny is likely.
 */
export function checkMutinyRisk(ship: Ship): boolean {
  const unrest = ship.crew.unrest;
  const morale = ship.crew.averageMorale;

  // High risk if unrest is high and morale is low
  if (unrest > 70 && morale < 30) return true;

  // Critical risk if unrest is very high
  if (unrest > 90) return true;

  return false;
}

/**
 * Generates a random weather condition.
 */
export function generateWeather(): { condition: WeatherCondition; windDirection: WindDirection } {
  const conditions: WeatherCondition[] = ['Calm', 'Breezy', 'Breezy', 'Breezy', 'Stormy', 'Gale', 'Foggy'];
  const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  return {
    condition: conditions[Math.floor(Math.random() * conditions.length)],
    windDirection: directions[Math.floor(Math.random() * directions.length)],
  };
}

/**
 * Resolves a round of naval combat.
 *
 * @param state Current combat state
 * @returns Updated combat state with log messages
 */
export function resolveNavalRound(state: NavalCombatState): NavalCombatState {
  const newState = { ...state, round: state.round + 1, log: [] as string[] };
  const weatherEffect = WEATHER_EFFECTS[newState.weather];

  newState.log.push(`Round ${newState.round}: Weather is ${weatherEffect.description}`);

  // Sort participants by initiative
  const sortedParticipants = [...newState.participants].sort((a, b) => b.initiative - a.initiative);

  for (const participant of sortedParticipants) {
    if (participant.ship.stats.hullPoints <= 0) continue; // Skip sunk ships

    const tactic = participant.currentTactic || 'Broadside';
    const tacticData = TACTIC_DESCRIPTIONS[tactic];

    // Identify target (first enemy)
    const target = newState.participants.find(p => p.role !== participant.role && p.ship.stats.hullPoints > 0);

    if (!target) {
       newState.log.push(`${participant.ship.name} has no valid targets.`);
       continue;
    }

    // Apply Tactic
    newState.log.push(`${participant.ship.name} attempts ${tacticData.name} against ${target.ship.name}.`);

    // Simple resolution logic
    // 1. Calculate Attack Roll
    const attackRoll = Math.floor(Math.random() * 20) + 1;
    const weatherMod = weatherEffect.roughSeas ? -2 : 0;
    const tacticMod = tacticData.offensiveBonus || 0;
    const crewMod = participant.ship.crew.quality === 'Elite' ? 4 : participant.ship.crew.quality === 'Veteran' ? 2 : 0;

    const totalAttack = attackRoll + weatherMod + tacticMod + crewMod;

    // 2. Calculate AC
    const targetAC = calculateShipStats(target.ship).armorClass;
    const targetTacticDef = target.currentTactic ? (TACTIC_DESCRIPTIONS[target.currentTactic].defensiveBonus || 0) : 0;
    const totalAC = targetAC + targetTacticDef;

    // 3. Resolve
    if (tactic === 'Repair') {
        const repairAmount = Math.floor(Math.random() * 10) + 5 + crewMod;
        participant.ship.stats.hullPoints = Math.min(participant.ship.stats.maxHullPoints, participant.ship.stats.hullPoints + repairAmount);
        newState.log.push(`${participant.ship.name} repairs ${repairAmount} hull points.`);
    } else if (tactic === 'EvasiveManeuvers') {
        newState.log.push(`${participant.ship.name} is taking evasive action (AC ${totalAC}).`);
    } else if (totalAttack >= totalAC) {
        // Hit!
        // Base damage calculation (placeholder - should come from weapons)
        let damage = 0;
        if (tactic === 'Ram') {
            damage = Math.floor(Math.random() * 50) + 25; // 25-75 damage
        } else {
             // Broadside
             damage = Math.floor(Math.random() * 20) + 10; // 10-30 damage
        }

        target.ship.stats.hullPoints -= damage;
        newState.log.push(`HIT! ${participant.ship.name} deals ${damage} damage to ${target.ship.name}!`);

        if (target.ship.stats.hullPoints <= 0) {
            newState.log.push(`${target.ship.name} has been SUNK!`);
        }
    } else {
        newState.log.push(`MISS! (${totalAttack} vs AC ${totalAC})`);
    }
  }

  return newState;
}
