/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 04:12:09
 * Dependents: state/migrations/worldDataMigration.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
type ClimateField = {
    temperatures: number[];
    moisture: number[];
};
/**
 * Derives a deterministic temperature and moisture field from biome ids.
 *
 * @param biomeIds Row-major biome id per cell.
 * @param cols Grid width.
 * @param rows Grid height.
 * @param seed World seed used to keep the output reproducible.
 */
export declare function climateFromBiomes(biomeIds: string[], cols: number, rows: number, seed: number): ClimateField;
export {};
