/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/06/2026, 04:24:29
 * Dependents: state/reducers/worldReducer.ts, systems/world/NobleIntrigueManager.ts
 * Imports: 18 files
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
 * @file src/systems/world/WorldEventManager.ts
 * Manages daily world simulation events.
 */
import { GameState, GameMessage } from '../../types';
export declare const DAILY_EVENT_CHANCE = 0.1;
export interface WorldEventResult {
    state: GameState;
    logs: GameMessage[];
}
export type WorldEventType = 'FACTION_SKIRMISH' | 'MARKET_SHIFT' | 'RUMOR_SPREAD' | 'NOBLE_INTRIGUE';
/**
 * Main entry point for processing daily world events.
 */
export declare const processWorldEvents: (state: GameState, daysPassed: number) => WorldEventResult;
