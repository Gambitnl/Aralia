/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/data/navalCombat.ts
 * Definitions for naval tactics, weather effects, and combat constants.
 */

import { NavalTactic, WeatherCondition, CombatRange } from '../types/naval';

export const WEATHER_EFFECTS: Record<WeatherCondition, {
  visibility: number; // 0-1 multiplier
  speedModifier: number; // multiplier
  description: string;
  roughSeas: boolean; // Affects aim
}> = {
  Calm: {
    visibility: 1.0,
    speedModifier: 0.5, // Lack of wind slows sailing ships
    description: 'The sea is like glass. Movement is slow, but aim is true.',
    roughSeas: false,
  },
  Breezy: {
    visibility: 1.0,
    speedModifier: 1.0,
    description: 'Perfect sailing weather with clear skies.',
    roughSeas: false,
  },
  Stormy: {
    visibility: 0.6,
    speedModifier: 0.8,
    description: 'Heavy rain and high waves make sailing dangerous.',
    roughSeas: true,
  },
  Gale: {
    visibility: 0.4,
    speedModifier: 1.2, // Fast but dangerous
    description: 'Fierce winds threaten to tear the sails.',
    roughSeas: true,
  },
  Foggy: {
    visibility: 0.2,
    speedModifier: 0.5, // Caution required
    description: 'Thick fog obscures everything beyond the bow.',
    roughSeas: false,
  },
};

export const TACTIC_DESCRIPTIONS: Record<NavalTactic, {
  name: string;
  description: string;
  offensiveBonus?: number;
  defensiveBonus?: number;
  speedBonus?: number;
  requiresRange?: CombatRange[];
}> = {
  Broadside: {
    name: 'Broadside Volley',
    description: 'Position the ship to fire all cannons at the enemy.',
    offensiveBonus: 2,
    defensiveBonus: 0,
    requiresRange: ['Medium', 'Short'],
  },
  Ram: {
    name: 'Ramming Speed',
    description: 'Attempt to collide with the enemy ship.',
    offensiveBonus: 4, // High damage if successful
    defensiveBonus: -2, // Vulnerable to broadside
    speedBonus: 1,
    requiresRange: ['Short'],
  },
  Board: {
    name: 'Prepare to Board',
    description: 'Close distance to grapple and board the enemy vessel.',
    defensiveBonus: -1,
    requiresRange: ['Short', 'Boarding'],
  },
  EvasiveManeuvers: {
    name: 'Evasive Maneuvers',
    description: 'Focus on dodging incoming fire rather than attacking.',
    defensiveBonus: 4,
    offensiveBonus: -4,
  },
  FullSail: {
    name: 'Full Sail',
    description: 'Catch every breath of wind to maximize speed.',
    speedBonus: 2,
    defensiveBonus: -2,
  },
  Repair: {
    name: 'Emergency Repairs',
    description: 'Crew focuses on patching hull breaches.',
    offensiveBonus: -100, // Cannot attack
    defensiveBonus: 0,
  },
};
