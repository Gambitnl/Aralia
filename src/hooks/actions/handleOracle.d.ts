/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:19
 * Dependents: actionHandlers.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/hooks/actions/handleOracle.ts
 * Handles 'ask_oracle' actions.
 */
import React from 'react';
import { GameState, Action } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn, PlayPcmAudioFn } from './actionHandlerTypes';
interface HandleOracleProps {
    action: Action;
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
    playPcmAudio: PlayPcmAudioFn;
    generalActionContext: string;
}
export declare function handleOracle({ action, gameState, dispatch, addMessage, addGeminiLog, playPcmAudio, generalActionContext, }: HandleOracleProps): Promise<void>;
export {};
