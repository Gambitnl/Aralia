/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 17:22:06
 * Dependents: systems/world/WorldEventManager.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/TradeRouteManager.ts
 * Manages the simulation of trade routes and their impact on the global economy.
 */
import { GameState, GameMessage, EconomyState } from '../../types';
import { SeededRandom } from '@/utils/random';
export interface TradeRouteUpdateResult {
    state: GameState;
    logs: GameMessage[];
}
/**
 * Initializes trade routes if they don't exist in the state.
 */
export declare const initializeTradeRoutes: (state: GameState) => EconomyState;
/**
 * Simulates daily changes in trade routes.
 * - Routes can be disrupted by risks (bandits, weather).
 * - Routes can recover from disruption.
 * - Routes can enter a "booming" state.
 */
export declare const processDailyRoutes: (state: GameState, daysPassed: number, rng: SeededRandom) => TradeRouteUpdateResult;
