/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:32
 * Dependents: world/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/world/sceneUtils.ts
 * Utilities for assessing player focus and scene-wide interactions.
 */
import { GameState } from '../../types/state';
/**
 * Checks if the player is currently engaged in a focus-intensive activity
 * that should suppress atmospheric background features (banter, weather popups, etc.).
 */
export declare function isPlayerFocused(state: GameState): boolean;
/**
 * Checks if a specific NPC is currently "occupied" by an interaction or script.
 */
export declare function isNpcOccupied(state: GameState, npcId: string): boolean;
