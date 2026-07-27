/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 18:51:15
 * Dependents: systems/worldforge/townsim/townSimRegistry.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { BuildingEventHistory } from '../interior/blueprintTypes';
import type { TownSimState } from './types';
/** At most 23 recent events remain after a compaction pass. */
export declare const BUILDING_HISTORY_BLOCK_SIZE = 24;
/** Number of tail events to fold now; zero means the representation is bounded. */
export declare function foldableBuildingHistoryCount(history: BuildingEventHistory): number;
/**
 * Compact every over-limit plot using the same canonical plan input as 3D.
 * Missing canonical plots fail loudly because approximating them would make
 * snapshot targets irrecoverable after the discarded prefix is gone.
 */
export declare function compactTownBuildingHistories(state: TownSimState, worldSeed: number): TownSimState;
