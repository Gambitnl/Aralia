/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:34:38
 * Dependents: travel/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { TravelParameters, TravelResult } from '../../types/travel';
/**
 * Calculates travel metrics based on 5th Edition rules.
 *
 * Standard Rules (PHB):
 * - Normal Pace: 3 miles/hour (300 ft/min), 24 miles/day
 * - Fast Pace: 4 miles/hour (400 ft/min), 30 miles/day (-5 Passive Perception)
 * - Slow Pace: 2 miles/hour (200 ft/min), 18 miles/day (Able to Stealth)
 *
 * Assumption: Base speed of 30ft translates to these standard rates.
 * Creatures with different base speeds scale proportionally.
 */
export declare class TravelCalculator {
    /**
     * Calculates travel details between two points.
     * Assumes a 1-unit grid corresponds to a specific distance (e.g., 6 miles per hex/tile).
     *
     * @param params Travel parameters
     * @param milesPerTile Distance represented by one grid unit (default 6 miles for province scale)
     */
    static calculateTravel(params: TravelParameters, milesPerTile?: number): TravelResult;
}
