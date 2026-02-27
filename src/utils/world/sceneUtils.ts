// @dependencies-start
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
// @dependencies-end

/**
 * @file src/utils/world/sceneUtils.ts
 * Utilities for assessing player focus and scene-wide interactions.
 */
import { GameState } from '../../types/state';
import { GamePhase } from '../../types/core';

/**
 * Checks if the player is currently engaged in a focus-intensive activity
 * that should suppress atmospheric background features (banter, weather popups, etc.).
 */
export function isPlayerFocused(state: GameState): boolean {
    // If we are not in the main playing phase, player is busy
    if (state.phase !== GamePhase.PLAYING) return true;

    // If the dialogue interface or an interactive conversation is open, player is busy
    if (state.isDialogueInterfaceOpen) return true;
    if (state.activeConversation) return true;

    // If a ritual is active and requires focus
    if (state.activeRitual) return true;

    return false;
}

/**
 * Checks if a specific NPC is currently "occupied" by an interaction or script.
 */
export function isNpcOccupied(state: GameState, npcId: string): boolean {
    // Check if they are the current participant in an interactive conversation
    if (state.activeConversation?.participants.includes(npcId)) return true;

    // Check if they are the last interacted NPC (likely still "in focus" for the player)
    if (state.lastInteractedNpcId === npcId && state.isDialogueInterfaceOpen) return true;

    return false;
}
