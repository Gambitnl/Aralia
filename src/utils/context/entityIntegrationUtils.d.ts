/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:47
 * Dependents: context/index.ts, entityIntegrationUtils.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/entityIntegrationUtils.ts
 * Shared utility for integrating EntityResolverService with the game state.
 * Handles the "Scan Text -> Resolve -> Register in Redux" loop.
 */
import type { Dispatch } from 'react';
import { GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddGeminiLogFn } from '../../hooks/actions/actionHandlerTypes';
/**
 * Service Integration:
 * Scans the provided text for entity references, ensures they exist (creating stubs if needed),
 * and dispatches actions to register any newly created entities into the game state.
 *
 * @param text The narrative text to scan (e.g. from AI).
 * @param gameState Current game state.
 * @param dispatch Redux dispatch function.
 * @param addGeminiLog Function to log AI/System events.
 */
export declare function resolveAndRegisterEntities(text: string, gameState: GameState, dispatch: Dispatch<AppAction>, addGeminiLog: AddGeminiLogFn): Promise<void>;
