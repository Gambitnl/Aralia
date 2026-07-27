/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 08:43:51
 * Dependents: hooks/actions/actionHandlers.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/hooks/actions/handleGeminiCustom.ts
 * Handles 'gemini_custom_action', including social skill checks.
 */
import React from 'react';
import { GameState, Action } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn, GetCurrentLocationFn, GetCurrentNPCsFn } from './actionHandlerTypes';
interface HandleGeminiCustomProps {
    action: Action;
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
    generalActionContext: string;
    getCurrentLocation: GetCurrentLocationFn;
    getCurrentNPCs: GetCurrentNPCsFn;
}
export declare function handleGeminiCustom({ action, gameState, dispatch, addMessage, addGeminiLog, generalActionContext, getCurrentLocation, getCurrentNPCs, }: HandleGeminiCustomProps): Promise<void>;
export {};
