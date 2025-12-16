/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/data/ships.ts
 * Base definitions for ship types available in the game.
 */

import { ShipType, ShipSize, ShipStats } from '../types/naval';

export const SHIP_TEMPLATES: Record<ShipType, {
  size: ShipSize;
  baseStats: ShipStats;
  description: string;
  defaultWeapons?: number; // Number of weapon slots
}> = {
  Rowboat: {
    size: 'Small',
    baseStats: {
      speed: 15, // 1.5 mph
      maneuverability: 5,
      hullPoints: 50,
      maxHullPoints: 50,
      armorClass: 11,
      cargoCapacity: 0.5,
      crewMin: 1,
      crewMax: 4,
    },
    description: 'A small open boat propelled by oars.',
  },
  Keelboat: {
    size: 'Large',
    baseStats: {
      speed: 30, // 3 mph
      maneuverability: 2,
      hullPoints: 100,
      maxHullPoints: 100,
      armorClass: 15,
      cargoCapacity: 5,
      crewMin: 1,
      crewMax: 6,
    },
    description: 'A river boat that can also sail in coastal waters.',
  },
  Longship: {
    size: 'Large',
    baseStats: {
      speed: 45, // 4.5 mph
      maneuverability: 3,
      hullPoints: 300,
      maxHullPoints: 300,
      armorClass: 15,
      cargoCapacity: 10,
      crewMin: 10,
      crewMax: 40,
    },
    description: 'A sturdy ship with oars and a sail, favored by raiders.',
  },
  SailingShip: {
    size: 'Huge',
    baseStats: {
      speed: 50, // 5 mph
      maneuverability: 0,
      hullPoints: 500,
      maxHullPoints: 500,
      armorClass: 15,
      cargoCapacity: 100,
      crewMin: 20,
      crewMax: 30,
    },
    description: 'A standard merchant vessel.',
  },
  Galley: {
    size: 'Gargantuan',
    baseStats: {
      speed: 40, // 4 mph
      maneuverability: -1,
      hullPoints: 500,
      maxHullPoints: 500,
      armorClass: 15,
      cargoCapacity: 150,
      crewMin: 40,
      crewMax: 80,
    },
    description: 'A large vessel propelled by banks of oars.',
  },
  Warship: {
    size: 'Gargantuan',
    baseStats: {
      speed: 35, // 3.5 mph
      maneuverability: -2,
      hullPoints: 750,
      maxHullPoints: 750,
      armorClass: 17,
      cargoCapacity: 200,
      crewMin: 40,
      crewMax: 100,
    },
    description: 'A massive ship built for battle.',
  },
  Caravel: {
    size: 'Large',
    baseStats: {
      speed: 55, // 5.5 mph
      maneuverability: 4,
      hullPoints: 200,
      maxHullPoints: 200,
      armorClass: 14,
      cargoCapacity: 50,
      crewMin: 10,
      crewMax: 30,
    },
    description: 'A small, fast Spanish or Portuguese sailing ship.',
  },
  Sloop: {
    size: 'Medium',
    baseStats: {
      speed: 60, // 6 mph
      maneuverability: 6,
      hullPoints: 150,
      maxHullPoints: 150,
      armorClass: 13,
      cargoCapacity: 20,
      crewMin: 4,
      crewMax: 15,
    },
    description: 'A one-masted sailboat with a fore-and-aft rig.',
  },
  Galleon: {
    size: 'Gargantuan',
    baseStats: {
      speed: 40, // 4 mph
      maneuverability: -1,
      hullPoints: 1000,
      maxHullPoints: 1000,
      armorClass: 16,
      cargoCapacity: 500,
      crewMin: 50,
      crewMax: 200,
    },
    description: 'A large multi-decked sailing ship used for war or commerce.',
  },
  Frigate: {
    size: 'Huge',
    baseStats: {
      speed: 55, // 5.5 mph
      maneuverability: 2,
      hullPoints: 600,
      maxHullPoints: 600,
      armorClass: 16,
      cargoCapacity: 150,
      crewMin: 30,
      crewMax: 100,
    },
    description: 'A warship with a mixed armament, generally heavier than a sloop but lighter than a ship of the line.',
  },
};
