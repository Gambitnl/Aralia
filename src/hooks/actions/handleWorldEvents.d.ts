/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:21
 * Dependents: handleGeminiCustom.ts, handleMovement.ts, handleResourceActions.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/hooks/actions/handleWorldEvents.ts
 * This file contains handlers for world-level events that occur outside of direct player actions.
 */
import React from 'react';
import { GameState, KnownFact } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddGeminiLogFn } from './actionHandlerTypes';
/**
 * Simulates the spread of information (gossip) between NPCs.
 */
export declare function handleGossipEvent(gameState: GameState, addGeminiLog: AddGeminiLogFn, dispatch: React.Dispatch<AppAction>): Promise<void>;
export declare function handleResidueChecks(gameState: GameState, dispatch: React.Dispatch<AppAction>): Promise<void>;
export declare function handleImmediateGossip(gameState: GameState, dispatch: React.Dispatch<AppAction>, addGeminiLog: AddGeminiLogFn, witnesses: string[], factToSpread: KnownFact, originalTargetNpcId?: string | null): Promise<void>;
export declare function handleLongRestWorldEvents(gameState: GameState): GameState['npcMemory'];
