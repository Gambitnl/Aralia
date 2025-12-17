/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/data/shipModifications.ts
 * Standard ship modifications available in the game.
 */

import { ShipModification } from '../types/naval';

export const SHIP_MODIFICATIONS: Record<string, ShipModification> = {
  REINFORCED_HULL: {
    id: 'reinforced_hull',
    name: 'Reinforced Hull',
    description: 'Additional plating and bracing improves durability but slightly reduces speed.',
    cost: 500,
    modifiers: [
      { stat: 'maxHullPoints', operation: 'add', value: 50 },
      { stat: 'armorClass', operation: 'add', value: 2 },
      { stat: 'speed', operation: 'add', value: -5 }, // Penalty
    ],
  },
  SILK_SAILS: {
    id: 'silk_sails',
    name: 'Silk Sails',
    description: 'Lightweight and durable sails that capture the wind more efficiently.',
    cost: 800,
    modifiers: [
      { stat: 'speed', operation: 'multiply', value: 1.1 }, // +10% speed
      { stat: 'maneuverability', operation: 'add', value: 1 },
    ],
  },
  EXTENDED_HOLD: {
    id: 'extended_hold',
    name: 'Extended Cargo Hold',
    description: 'Reconfigured internal space to allow for more cargo.',
    cost: 300,
    modifiers: [
      { stat: 'cargoCapacity', operation: 'add', value: 20 },
    ],
    requirements: {
      minSize: ['Large', 'Huge', 'Gargantuan'],
    },
  },
  SMUGGLERS_CACHE: {
    id: 'smugglers_cache',
    name: "Smuggler's Cache",
    description: 'Hidden compartments for illicit goods.',
    cost: 200,
    modifiers: [
      { stat: 'cargoCapacity', operation: 'add', value: -1 }, // Loses a bit of legit space
      // Note: We might want a 'hiddenCapacity' stat later, but for now it's just flavor + logic elsewhere
    ],
  },
  OAR_BANK: {
    id: 'oar_bank',
    name: 'Additional Oar Bank',
    description: 'Extra rowing stations for increased speed independent of wind.',
    cost: 400,
    modifiers: [
      { stat: 'speed', operation: 'add', value: 10 },
      { stat: 'crewMin', operation: 'add', value: 10 }, // Requires more crew
      { stat: 'crewMax', operation: 'add', value: 10 },
    ],
    requirements: {
      minSize: ['Large', 'Huge', 'Gargantuan'],
    },
  },
  LIGHTWEIGHT_FRAME: {
    id: 'lightweight_frame',
    name: 'Lightweight Frame',
    description: 'Stripped down structure for maximum speed.',
    cost: 600,
    modifiers: [
      { stat: 'speed', operation: 'multiply', value: 1.2 }, // +20% speed
      { stat: 'maxHullPoints', operation: 'multiply', value: 0.8 }, // -20% HP
    ],
  },
};
