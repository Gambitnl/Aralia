/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:32:55
 * Dependents: naval/index.ts, navalCombatUtils.ts, navalUtils.ts
 * Imports: 2 files
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
 * @file src/utils/navalUtils.ts
 * Logic for ship mechanics, crew management, and naval calculations.
 */
import { Ship, ShipStats, CrewMember, ShipModification, ShipSize } from '../../types/naval';
import { SHIP_TEMPLATES } from '../../data/ships';
/**
 * Gets the numeric rank of a ship size for comparison (Tiny=1 to Gargantuan=6).
 */
export declare function getShipSizeRank(size: ShipSize): number;
/**
 * Creates a new ship instance from a template.
 */
export declare function createShip(name: string, type: keyof typeof SHIP_TEMPLATES): Ship;
/**
 * Calculates current ship stats including modifications and crew effects.
 */
export declare function calculateShipStats(ship: Ship): ShipStats;
/**
 * Installs a modification on a ship.
 * Does not check costs (should be handled by business logic), but can check compatibility.
 */
export declare function installModification(ship: Ship, modification: ShipModification): {
    success: boolean;
    reason?: string;
    ship?: Ship;
};
/**
 * Adds a crew member to the ship and recalculates morale.
 */
export declare function addCrewMember(ship: Ship, member: CrewMember): Ship;
/**
 * The one authoritative conversion from a ship's base speed (`ShipStats.speed`,
 * in ft/round) to miles per hour. Centralizing this removes ambiguity about what
 * the raw stat means at call sites (it is ft/round, NOT hexes/day).
 *
 * D&D 5e standard:
 * Speed 30 ft/round = 3 mph
 * Speed 20 ft/round = 2 mph
 * So mph = speed / 10
 */
export declare function shipSpeedMph(ship: Ship): number;
/**
 * Calculates travel time in hours for a given distance in miles.
 * Takes into account ship speed (see {@link shipSpeedMph}).
 */
export declare function calculateTravelTime(ship: Ship, distanceMiles: number, windFactor?: number): number;
/**
 * Checks if a mutiny is likely.
 */
export declare function checkMutinyRisk(ship: Ship): boolean;
