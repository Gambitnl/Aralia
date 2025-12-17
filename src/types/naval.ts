/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/types/naval.ts
 * Core definitions for the naval system: ships, crew, and maritime mechanics.
 */

// ============================================================================
// SHIP DEFINITIONS
// ============================================================================

export type ShipSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';

export type ShipType =
  | 'Rowboat'
  | 'Keelboat'
  | 'Longship'
  | 'SailingShip'
  | 'Galley'
  | 'Warship'
  | 'Caravel'
  | 'Sloop'
  | 'Galleon'
  | 'Frigate';

export interface ShipStats {
  speed: number;           // Movement speed in ft/round (or hexes/day)
  maneuverability: number; // Bonus to dexterity checks for steering
  hullPoints: number;      // Current HP
  maxHullPoints: number;   // Max HP
  armorClass: number;      // AC
  cargoCapacity: number;   // In tons
  crewMin: number;         // Minimum crew to operate
  crewMax: number;         // Maximum crew capacity
}

export interface Ship {
  id: string;
  name: string;
  type: ShipType;
  size: ShipSize;
  description: string;
  stats: ShipStats;
  crew: Crew;
  cargo: CargoManifest;
  modifications: ShipModification[];
  weapons: ShipWeapon[];
  flags: Record<string, boolean>; // e.g., { 'isPirate': true }
}

export type ModifierOperation = 'add' | 'multiply';

export interface ShipStatModifier {
  stat: keyof ShipStats;
  operation: ModifierOperation;
  value: number;
}

export interface ShipModification {
  id: string;
  name: string;
  description: string;
  modifiers: ShipStatModifier[];
  cost: number;
  requirements?: {
    minSize?: ShipSize[];
    maxSize?: ShipSize[];
  };
}

export interface ShipWeapon {
  id: string;
  name: string;
  type: 'Ballista' | 'Cannon' | 'Mangonel' | 'Ram';
  damage: string; // e.g., "3d10"
  range: { normal: number; long: number };
  position: 'Fore' | 'Aft' | 'Port' | 'Starboard';
}

// ============================================================================
// CREW DEFINITIONS
// ============================================================================

export type CrewRole =
  | 'Captain'
  | 'FirstMate'
  | 'Bosun'
  | 'Quartermaster'
  | 'Surgeon'
  | 'Cook'
  | 'Navigator'
  | 'Sailor';

export interface CrewMember {
  id: string;
  name: string;
  role: CrewRole;
  skills: Record<string, number>; // Bonus to specific checks
  morale: number; // 0-100
  loyalty: number; // 0-100 (loyalty to captain)
  dailyWage: number; // In gp
  traits: string[];
}

export interface Crew {
  members: CrewMember[];
  averageMorale: number; // Calculated
  unrest: number; // 0-100, risk of mutiny
  quality: 'Poor' | 'Average' | 'Experienced' | 'Veteran' | 'Elite';
}

// ============================================================================
// CARGO DEFINITIONS
// ============================================================================

export interface CargoItem {
  id: string;
  name: string;
  quantity: number;
  weightPerUnit: number; // tons
  isContraband: boolean;
}

export interface CargoManifest {
  items: CargoItem[];
  totalWeight: number;
  capacityUsed: number;
}

// ============================================================================
// NAVAL COMBAT & ENVIRONMENT
// ============================================================================

export type WeatherCondition = 'Calm' | 'Breezy' | 'Stormy' | 'Gale' | 'Foggy';

export type WindDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type CombatRange = 'Long' | 'Medium' | 'Short' | 'Boarding';

export type NavalTactic =
  | 'Broadside'         // Standard attack
  | 'Ram'               // High risk, high damage
  | 'Board'             // Attempt to enter boarding range
  | 'EvasiveManeuvers'  // Defensive, harder to hit
  | 'FullSail'          // Close distance / Flee
  | 'Repair';           // Field repairs

export interface NavalCombatParticipant {
  ship: Ship;
  initiative: number;
  currentTactic?: NavalTactic;
  role: 'player' | 'enemy' | 'ally';
}

export interface NavalCombatState {
  id: string;
  participants: NavalCombatParticipant[];
  range: CombatRange;
  weather: WeatherCondition;
  windDirection: WindDirection;
  round: number;
  log: string[];
}
