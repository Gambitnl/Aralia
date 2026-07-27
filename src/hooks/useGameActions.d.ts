/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 01:22:36
 * Dependents: App.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/hooks/useGameActions.ts
 * This hook is the front door for player actions from the exploration interface.
 *
 * It prepares the shared game context, finds the specialised handler for each action,
 * and owns the global loading/error lifecycle around handlers that do not manage that
 * lifecycle themselves. App.tsx calls this hook and passes the resulting processAction
 * function to action-producing controls throughout the game.
 */
import React from 'react';
import { GameState, Action } from '../types';
import { AppAction } from '../state/actionTypes';
import { AddMessageFn, PlayPcmAudioFn, GetCurrentLocationFn, GetCurrentNPCsFn, GetTileTooltipTextFn } from './actions/actionHandlerTypes';
interface UseGameActionsProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    playPcmAudio: PlayPcmAudioFn;
    getCurrentLocation: GetCurrentLocationFn;
    getCurrentNPCs: GetCurrentNPCsFn;
    getTileTooltipText: GetTileTooltipTextFn;
}
export declare function useGameActions({ gameState, dispatch, addMessage, playPcmAudio, getCurrentLocation, getCurrentNPCs, getTileTooltipText, }: UseGameActionsProps): {
    processAction: (action: Action) => Promise<void>;
};
export {};
