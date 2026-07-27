/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 04:34:00
 * Dependents: App.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
export interface BanterHistoryLine {
    speakerId: string;
    speakerName: string;
    text: string;
    /** True when this line was generated as a player-directed opening or escalation. */
    isDirectedAtPlayer?: boolean;
}
export declare const useCompanionBanter: (gameState: GameState, dispatch: React.Dispatch<AppAction>, isBanterPaused?: boolean) => {
    forceBanter: () => Promise<void>;
    isBanterActive: boolean;
    isWaitingForNextLine: boolean;
    isGenerating: boolean;
    generatingSpeakerName: string;
    secondsUntilNextLine: number;
    playerInterrupt: (playerMessage: string) => void;
    endBanter: () => void;
    banterHistory: BanterHistoryLine[];
    isPlayerDirected: boolean;
    isWaitingForPlayerResponse: boolean;
    playerResponseDeadlineSeconds: number;
    extendPlayerResponseDeadline: () => void;
    extendNpcLineDelay: () => void;
};
