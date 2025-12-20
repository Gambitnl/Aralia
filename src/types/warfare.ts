/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/types/warfare.ts
 * Core definitions for the warfare system: units, armies, and mass combat mechanics.
 */

// ============================================================================
// UNIT DEFINITIONS
// ============================================================================

export type UnitType =
  | 'Infantry'
  | 'Cavalry'
  | 'Archers'
  | 'Siege'
  | 'Aerial'
  | 'Magic'
  | 'Support';

export type UnitExperience = 'Recruit' | 'Regular' | 'Veteran' | 'Elite';

export type UnitStatus = 'Active' | 'Routed' | 'Destroyed';

export interface UnitStats {
  attack: number;    // Attack bonus (e.g., +5)
  defense: number;   // Armor Class equivalent
  power: number;     // Damage multiplier
  maneuver: number;  // Mobility/Tactics bonus
  morale: number;    // Base morale save bonus
}

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  experience: UnitExperience;
  commanderId?: string; // Optional link to a Character

  // Health / Strength
  strength: number;    // Current soldier count (HP)
  maxStrength: number; // Initial soldier count (Max HP)

  // Morale
  currentMorale: number; // 0-100 scale (Current condition)

  // Combat Stats
  stats: UnitStats;

  // State
  status: UnitStatus;
  position?: { x: number; y: number }; // Abstract grid coordinates

  // Equipment / Traits
  traits: string[]; // e.g., "Shield Wall", "Charge"
}

// ============================================================================
// BATTLE CONTEXT
// ============================================================================

export type TerrainType = 'Plain' | 'Forest' | 'Hill' | 'City' | 'Swamp' | 'Mountain';
export type FortificationLevel = 'None' | 'Entrenched' | 'Fortified' | 'Stronghold';
export type WeatherCondition = 'Clear' | 'Rain' | 'Fog' | 'Storm' | 'Snow';

export interface BattleContext {
  terrain: TerrainType;
  fortification: FortificationLevel;
  weather: WeatherCondition;
  distance: number; // Abstract distance (0 = Melee, 1 = Range, 2 = Long Range)
}

// ============================================================================
// RESOLUTION TYPES
// ============================================================================

export interface RoundResult {
  attackerId: string;
  defenderId: string;

  attackRoll: number;
  isHit: boolean;
  isCritical: boolean;

  damageDealt: number; // Strength loss
  moraleDamage: number; // Morale loss

  attackerStatus: UnitStatus;
  defenderStatus: UnitStatus;

  narrative: string; // "The cavalry charged but was repelled by pikes."
}
