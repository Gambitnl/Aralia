/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/navalUtils.ts
 * Logic for ship mechanics, crew management, and naval calculations.
 */

import { Ship, ShipStats, CrewMember } from '../types/naval';
import { SHIP_TEMPLATES } from '../data/ships';

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
  let stats = { ...ship.stats };

  // Apply modifications
  for (const mod of ship.modifications) {
    stats = mod.effect(stats);
  }

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
