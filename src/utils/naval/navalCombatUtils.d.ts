/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:32:53
 * Dependents: naval/index.ts, navalCombatUtils.ts
 * Imports: 3 files
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
 * @file src/utils/navalCombatUtils.ts
 * Logic for resolving naval combat maneuvers and state updates.
 */
import { Ship } from '../../types/naval';
import { NavalCombatState, NavalManeuver, NavalCombatResult, CombatShipState, CombatRange, WindDirection } from '../../types/navalCombat';
/**
 * Initializes a new combat encounter.
 */
export declare function initializeNavalCombat(ships: Ship[], windDirection?: WindDirection): NavalCombatState;
/**
 * Calculates the relative range between two ships.
 * Simplified for this implementation.
 */
export declare function getRange(shipA: CombatShipState, shipB: CombatShipState): CombatRange;
/**
 * Resolves a chosen maneuver.
 */
export declare function resolveManeuver(state: NavalCombatState, maneuver: NavalManeuver, sourceShipId: string, targetShipId: string): NavalCombatResult;
