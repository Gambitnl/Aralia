/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 00:51:22
 * Dependents: services/saveLoadService.ts, state/appState.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/state/reducers/logReducer.ts
 * This file handles game-state changes for player-visible and debug logs.
 *
 * It exists so message history, AI debug traces, and the player's discovery
 * Logbook all update through one reducer surface. Gameplay systems dispatch
 * actions here, and the returned partial state is merged into the central
 * GameState by the app state layer.
 */
import { GameState, DiscoveryEntry } from '../../types';
import { AppAction } from '../actionTypes';
export declare const MAX_DISCOVERY_LOG_ENTRIES = 200;
export declare function retainDiscoveryLogEntries(discoveryLog: DiscoveryEntry[]): DiscoveryEntry[];
export declare function countUnreadDiscoveryEntries(discoveryLog: DiscoveryEntry[]): number;
export declare function logReducer(state: GameState, action: AppAction): Partial<GameState>;
