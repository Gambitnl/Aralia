/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:38
 * Dependents: socialUtils.ts, world/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/socialUtils.ts
 * This file contains utility functions for social interactions,
 * like assessing the plausibility of a character's actions.
 */
import { Action, PlayerCharacter, GameState } from '../../types';
/**
 * Assesses the plausibility of a deception-based action and returns a DC modifier.
 * A higher disposition or lower suspicion level makes success easier (negative modifier).
 * @param action - The action being performed.
 * @param character - The character performing the action.
 * @param npcMemory - The memory state of the NPC being targeted.
 * @returns A number to be added to the skill check's DC.
 */
export declare function assessPlausibility(action: Action, character: PlayerCharacter, npcMemory: GameState['npcMemory'][string]): number;
