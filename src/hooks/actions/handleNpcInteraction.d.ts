/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 13:30:02
 * Dependents: hooks/actions/actionHandlers.ts
 * Imports: 23 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/hooks/actions/handleNpcInteraction.ts
 * Handles NPC interaction actions like 'talk'.
 */
import React from 'react';
import { GameState, Action } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn, PlayPcmAudioFn } from './actionHandlerTypes';
interface HandleTalkProps {
    action: Action;
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
    playPcmAudio: PlayPcmAudioFn;
    playerContext: string;
    generalActionContext: string;
}
export declare function handleStartDialogue({ action, gameState, dispatch, addMessage }: HandleTalkProps): Promise<void>;
export declare function handleTalk({ action, gameState, dispatch, addMessage, addGeminiLog, playPcmAudio, playerContext, generalActionContext, }: HandleTalkProps): Promise<void>;
export {};
