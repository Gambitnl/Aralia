/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 20:18:41
 * Dependents: systems/worldforge/roster/agentLife.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { TownSimState } from '../townsim/types';
import type { TownRoster } from './types';
/** Advance one already-life-processed day of optional agent-sim deepening. */
export declare function advanceAgentDeepeningDay(state: TownSimState, roster: TownRoster, worldSeed: number, day: number): TownSimState;
