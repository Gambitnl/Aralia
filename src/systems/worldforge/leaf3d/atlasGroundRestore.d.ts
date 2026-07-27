/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/07/2026, 22:08:23
 * Dependents: App.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { type AtlasGroundAddress, type AtlasGroundDrilldown } from './atlasGroundDrilldown';
/**
 * This file rebuilds a saved Atlas ground address through the native cartographer pipeline.
 *
 * Save slots retain only a small lineage record. During App hydration this file regenerates
 * World -> Atlas cell -> Region -> Local in the same order AtlasDemo used, validates every
 * persisted boundary, and returns the transient object-rich receipt PLAYING already consumes.
 * Invalid or stale addresses return a closed failure instead of a nearby approximation.
 */
export type AtlasGroundRestoreResult = {
    status: 'absent';
} | {
    status: 'ready';
    address: AtlasGroundAddress;
    drilldown: AtlasGroundDrilldown;
} | {
    status: 'rejected';
    reason: string;
};
/** Reconstruct one saved Atlas address without ever substituting another place. */
export declare function restoreAtlasGroundDrilldown(input: unknown, expectedWorldSeed?: number): AtlasGroundRestoreResult;
