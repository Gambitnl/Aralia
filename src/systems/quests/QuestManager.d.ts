/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 02:06:39
 * Dependents: systems/world/WorldEventManager.ts
 * Imports: 3 files
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
 * @file src/systems/quests/QuestManager.ts
 * Manages quest states, including deadline checks and updates.
 */
import { GameState, GameMessage } from '../../types';
export interface QuestUpdateResult {
    state: GameState;
    logs: GameMessage[];
}
/**
 * Checks all active quests for missed deadlines based on the current game time.
 * @param state Current game state
 * @returns Updated state and any logs generated from missed deadlines
 */
export declare const checkQuestDeadlines: (state: GameState) => QuestUpdateResult;
