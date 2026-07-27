/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 09/06/2026, 03:06:22
 * Dependents: components/Naval/ShipPane.tsx, data/dev/mockShips.ts, data/naval/crewTraits.ts, data/naval/voyageEvents.ts, data/naval/voyageEvents/index.ts, data/shipModifications.ts, data/ships.ts, state/initialState.ts, systems/naval/CrewManager.ts, systems/naval/NavalCombatSystem.ts, systems/naval/NavalLogic.ts, systems/naval/VoyageManager.ts, types/index.ts, utils/naval/navalCombatUtils.ts, utils/naval/navalUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
    /** FMG burg id of the port where this ship is currently docked (its embarkation point); undefined if never docked. */
    dockedPortBurgId?: number;
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
    /**
     * Aggregate sea-danger of the route in [0,1] (Plan 3A tiers: lane/coastal/open),
     * carried from the multi-modal route at embark. Drives the per-day sea-encounter
     * roll. Optional so pre-existing saves without it default to a calm crossing.
     */
    routeDanger?: number;
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
export type VoyageEventRandomSource = () => number;
export interface VoyageEvent {
    id: string;
    name: string;
    description: string;
    type: 'Weather' | 'Encounter' | 'Discovery' | 'Crew' | 'Fluff';
    probability: number;
    conditions?: (state: VoyageState) => boolean;
    effect: (state: VoyageState, ship: Ship, random?: VoyageEventRandomSource) => {
        log: string;
        type: VoyageLogEntry['type'];
    };
}
/**
 * A hostile sea encounter awaiting resolution on the tactical battle map.
 * Produced by NAVAL_ADVANCE_VOYAGE when the per-day sea-encounter roll comes up
 * hostile; consumed by the useSeaEncounter hook, which hands the monsters to the
 * existing battle-map flow and then clears this field (idempotent, like arrival).
 */
export interface PendingSeaEncounter {
    /** Table outcome id (e.g. 'pirates', 'sea_beast') — for logging/dedup. */
    id: string;
    /** Combat foes, in the shared TravelEncounterMonster stub shape. */
    monsters: {
        name: string;
        quantity: number;
        cr: string;
        description: string;
    }[];
    /** The one-line summary already shown in the voyage/adventure log. */
    summary: string;
}
export interface NavalState {
    playerShips: Ship[];
    activeShipId: string | null;
    currentVoyage: VoyageState | null;
    knownPorts: string[];
    /** Set when a day at sea rolls a hostile encounter; null otherwise. */
    pendingSeaEncounter?: PendingSeaEncounter | null;
}
