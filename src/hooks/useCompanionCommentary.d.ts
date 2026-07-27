/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 04:34:01
 * Dependents: App.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { GameState, OllamaLogEntry } from '../types';
type CompanionAction = {
    type: 'ADD_COMPANION_REACTION';
    payload: {
        companionId: string;
        reaction: string;
    };
} | {
    type: 'UPDATE_COMPANION_APPROVAL';
    payload: {
        companionId: string;
        change: number;
        reason: string;
        source: string;
    };
} | {
    type: 'ADD_OLLAMA_LOG_ENTRY';
    payload: OllamaLogEntry;
};
export declare const useCompanionCommentary: (gameState: GameState, dispatch: React.Dispatch<CompanionAction>) => any;
export {};
