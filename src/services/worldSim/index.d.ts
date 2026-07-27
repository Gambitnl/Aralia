/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/06/2026, 00:45:39
 * Dependents: services/azgaarDerivedMapService.ts, state/migrations/worldDataMigration.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { WorldData, WorldFeatureHints } from './types';
export interface RunWorldSimInput {
    seed: number;
    templateId: string;
    cols: number;
    rows: number;
    heights: number[];
    temperatures: number[];
    moisture: number[];
    biomeIds: string[];
    featureHints?: WorldFeatureHints;
}
/**
 * Runs the complete world simulation generation pipeline from basic height and biome arrays.
 * Produces fully hydrated, deterministic WorldData.
 */
export declare function runWorldSim(input: RunWorldSimInput): WorldData;
