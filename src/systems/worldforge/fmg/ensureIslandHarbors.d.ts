/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 19:15:38
 * Dependents: systems/worldforge/fmg/generateWorld.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { Burg } from './burgs-generator';
import type { Route } from './routes-generator';
/**
 * This file guarantees that important islands can be reached by maritime travel.
 *
 * The FMG world generator can create islands with no port, which means the
 * multimodal travel graph has nowhere legal to board or leave a ferry. This
 * post-generation pass finds each landmass, promotes or spawns one small port on
 * significant portless landmasses, and updates sea-route links so the travel UI
 * can discover the new harbor without hand-authored map data.
 *
 * Called by: generateWorld.ts after the normal FMG route generation stage.
 * Depends on: the packed FMG cells, burg list, and route list that earlier FMG
 * stages already produced.
 */
export interface IslandHarborCells {
    i: ArrayLike<number>;
    c: number[][];
    h: ArrayLike<number>;
    p: ArrayLike<[number, number]>;
    haven?: ArrayLike<number>;
    harbor?: ArrayLike<number>;
    f?: ArrayLike<number>;
    burg?: Uint16Array;
    culture?: ArrayLike<number>;
    state?: ArrayLike<number>;
    pop?: ArrayLike<number>;
    routes?: Record<number, Record<number, number>>;
}
export interface IslandHarborFeature {
    i: number;
    type: string;
    land: boolean;
    cells: number;
}
export interface IslandHarborPack {
    cells: IslandHarborCells;
    features: Array<IslandHarborFeature | 0>;
    burgs?: Array<Burg | 0>;
    routes?: Route[];
}
export interface EnsureIslandHarborsOptions {
    /**
     * Minimum connected land cells before a landmass is considered worth docking.
     * Components with a burg are always significant even when they are smaller.
     */
    minLandCells?: number;
}
export interface EnsureIslandHarborsReport {
    promotedBurgIds: number[];
    spawnedBurgIds: number[];
    skippedComponentCells: number[][];
}
export declare function ensureIslandHarbors(pack: IslandHarborPack, options?: EnsureIslandHarborsOptions): EnsureIslandHarborsReport;
