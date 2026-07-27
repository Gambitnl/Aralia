/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 09/06/2026, 02:48:37
 * Dependents: None (Orphan)
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/state/reducers/navalReducer.ts
 * Reducer for managing naval state: ships, crew, and voyages.
 */
import { AppAction } from '../actionTypes';
import { GameState } from '../../types';
/**
 * Default price of the starter sloop offered from the naval dashboard's
 * "No Active Ship" state. A modest figure: out of reach for a fresh level-1
 * character (who starts with ~10 gp) but affordable after some adventuring,
 * so acquiring a ship is an earned milestone rather than a free handout.
 */
export declare const STARTER_SHIP_COST = 500;
export declare const navalReducer: (state: GameState, action: AppAction) => GameState;
