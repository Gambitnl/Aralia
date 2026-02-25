/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/types/naval.ts
 * Core definitions for the naval system: ships, crew, and maritime mechanics.
 */
export type ShipSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
export type ShipType = 'Rowboat' | 'Keelboat' | 'Longship' | 'SailingShip' | 'Galley' | 'Warship' | 'Caravel' | 'Sloop' | 'Galleon' | 'Frigate';
export interface ShipStats {
    speed: number;
    maneuverability: number;
    hullPoints: number;
    maxHullPoints: number;
    armorClass: number;
    cargoCapacity: number;
    crewMin: number;
    crewMax: number;
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
    flags: Record<string, boolean>;
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
    damage: string;
    range: {
        normal: number;
        long: number;
    };
    position: 'Fore' | 'Aft' | 'Port' | 'Starboard';
}
export type CrewRole = 'Captain' | 'FirstMate' | 'Bosun' | 'Quartermaster' | 'Surgeon' | 'Cook' | 'Navigator' | 'Sailor';
export interface CrewMember {
    id: string;
    name: string;
    role: CrewRole;
    skills: Record<string, number>;
    morale: number;
    loyalty: number;
    dailyWage: number;
    traits: string[];
}
export interface Crew {
    members: CrewMember[];
    averageMorale: number;
    unrest: number;
    quality: 'Poor' | 'Average' | 'Experienced' | 'Veteran' | 'Elite';
}
export interface CargoItem {
    id: string;
    name: string;
    quantity: number;
    weightPerUnit: number;
    isContraband: boolean;
}
export interface CargoManifest {
    items: CargoItem[];
    totalWeight: number;
    capacityUsed: number;
    supplies: {
        food: number;
        water: number;
    };
}
export type VoyageStatus = 'Docked' | 'Sailing' | 'Lost' | 'Combat' | 'Storm';
export type RationingLevel = 'normal' | 'half' | 'starvation';
export interface VoyageState {
    shipId: string;
    destinationId?: string;
    status: VoyageStatus;
    rationingLevel?: RationingLevel;
    daysAtSea: number;
    distanceTraveled: number;
    distanceToDestination: number;
    currentWeather: string;
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
    probability: number;
    conditions?: (state: VoyageState) => boolean;
    effect: (state: VoyageState, ship: Ship) => {
        log: string;
        type: VoyageLogEntry['type'];
    };
}
export interface NavalState {
    playerShips: Ship[];
    activeShipId: string | null;
    currentVoyage: VoyageState | null;
    knownPorts: string[];
}
