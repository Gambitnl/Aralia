/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 01:17:38
 * Dependents: hooks/useGameActions.ts
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/hooks/actions/actionHandlers.ts
 * Central registry builder for action handlers.
 *
 * Architectural note:
 * - This module is intentionally stateless; dependencies are injected from
 *   src/hooks/useGameActions.ts so we do not import hooks or global state here.
 * - Domain-specific handler implementations live in src/hooks/actions/handle*.ts.
 * - Dispatch types come from src/state/actionTypes, and core data shapes from src/types.
 */
import type { Dispatch } from 'react';
import type { Action, ActionType, GameState, PlayerCharacter } from '../../types';
import type { AppAction } from '../../state/actionTypes';
import type { AddGeminiLogFn, AddMessageFn, GetCurrentLocationFn, GetCurrentNPCsFn, GetTileTooltipTextFn, LogDiscoveryFn, PlayPcmAudioFn } from './actionHandlerTypes';
export type ActionHandler = (action: Action) => Promise<void> | void;
export interface ActionHandlerContext {
    gameState: GameState;
    dispatch: Dispatch<AppAction>;
    addMessage: AddMessageFn;
    playPcmAudio: PlayPcmAudioFn;
    getCurrentLocation: GetCurrentLocationFn;
    getCurrentNPCs: GetCurrentNPCsFn;
    getTileTooltipText: GetTileTooltipTextFn;
    addGeminiLog: AddGeminiLogFn;
    logDiscovery: LogDiscoveryFn;
    playerCharacter: PlayerCharacter | undefined;
    playerContext: string;
    generalActionContext: string;
}
/**
 * Builds a handler registry so useGameActions can route by action.type.
 * The registry is strictly typed against ActionType to ensure all actions are handled.
 */
export declare function buildActionHandlers({ gameState, dispatch, addMessage, playPcmAudio, getCurrentLocation, getCurrentNPCs, getTileTooltipText, addGeminiLog, logDiscovery, playerCharacter, playerContext, generalActionContext, }: ActionHandlerContext): Record<ActionType, ActionHandler>;
