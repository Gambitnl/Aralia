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
  supplies: {
    food: number; // Days of rations
    water: number; // Days of water
  };
}

// ============================================================================
// VOYAGE DEFINITIONS
// ============================================================================

export type VoyageStatus = 'Docked' | 'Sailing' | 'Lost' | 'Combat' | 'Storm';

export interface VoyageState {
  shipId: string;
  status: VoyageStatus;
  daysAtSea: number;
  distanceTraveled: number; // Miles
  distanceToDestination: number; // Miles
  currentWeather: string; // e.g., 'Calm', 'Storm', 'Fog'
  suppliesConsumed: {
    food: number;
    water: number;
  };
  log: VoyageLogEntry[];
}

export interface VoyageLogEntry {
  day: number;
  event: string;
  type: 'Info' | 'Warning' | 'Combat' | 'Discovery' | 'Fluff';
}

export interface VoyageEvent {
  id: string;
  name: string;
  description: string;
  type: 'Weather' | 'Encounter' | 'Discovery' | 'Crew' | 'Fluff';
  probability: number; // 0-1
  conditions?: (state: VoyageState) => boolean;
  effect: (state: VoyageState, ship: Ship) => { log: string; type: VoyageLogEntry['type'] };
}
