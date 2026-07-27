/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 04:34:00
 * Dependents: components/ConversationPanel/ConversationPanel.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
export interface UseConversationResult {
    /** Start a new conversation with a companion */
    startConversation: (companionId: string) => void;
    /** Send a player message and get AI response */
    sendPlayerMessage: (text: string) => Promise<void>;
    /** End the conversation and generate memory summary */
    endConversation: () => Promise<void>;
    /** Whether currently blocked from sending because it's not player turn or waiting for AI response */
    isInteractionLocked: boolean;
}
export declare function useConversation(gameState: GameState, dispatch: React.Dispatch<AppAction>): UseConversationResult;
