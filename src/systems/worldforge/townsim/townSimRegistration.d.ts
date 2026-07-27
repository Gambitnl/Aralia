/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 18:51:44
 * Dependents: state/reducers/worldReducer.ts
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { TownSimState } from './types';
import type { TownPlan } from '../artifacts';
import type { SeedPath } from '../seedPath';
import type { StyleContext } from '../interior/blueprintTypes';
/**
 * Precompute a bounded future-growth vocabulary while canonical lot geometry
 * is available. The live sim stores these outcomes and never regenerates them.
 */
export declare function buildingEvolutionForTown(plan: TownPlan, seedPath: SeedPath, styleBase: Pick<StyleContext, 'cultureType' | 'climate'>): NonNullable<TownSimState['buildingEvolution']>;
/**
 * Rebuild only immutable growth briefs for a previously saved burg. This is
 * intentionally separate from full registration so migration never replaces
 * its villagers, prosperity, chronicle, or existing building history.
 */
export declare function buildingEvolutionForBurg(worldSeed: number, burgId: number): NonNullable<TownSimState['buildingEvolution']>;
/**
 * Build the TownSimState for a burg, current as of `currentDay`. The town is
 * seeded BACKSTORY_YEARS in the past and simulated forward to `currentDay` so it
 * arrives with real recent history. Deterministic from (worldSeed, burgId): the
 * per-(burg,day) re-seeding in advanceTown makes the backfill reproducible.
 */
export declare function buildTownSimStateForBurg(worldSeed: number, burgId: number, currentDay: number): TownSimState;
