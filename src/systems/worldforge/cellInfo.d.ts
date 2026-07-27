/**
 * @file src/systems/worldforge/cellInfo.ts
 * Pure cell inspector for the Worldforge atlas. Given a generated atlas and a
 * Voronoi cell id, returns a structured, render-agnostic summary of that
 * cell's contents (terrain, biome, political/cultural ownership, settlement,
 * population). Used by the atlas cartographer's cell-selection info panel.
 *
 * Pure: no React, no canvas. Tolerant of partial atlases (atlas-only artifacts
 * with no civilization layers return the geographic fields and omit the rest).
 */
import type { FmgAtlasResult } from "./fmg/generateAtlas";
/** Land/water classification derived from cell height (FMG: >= 20 is land). */
export type CellTerrain = "land" | "water";
/** A named reference into one of the atlas civilization collections. */
export interface CellOwnership {
    id: number;
    name: string;
}
/** Settlement (burg) summary when a cell hosts one. */
export interface CellBurg {
    id: number;
    name: string;
    population: number;
    capital: boolean;
    port: boolean;
}
/** Structured, render-agnostic summary of a single atlas cell's contents. */
export interface CellInfo {
    cellId: number;
    terrain: CellTerrain;
    /** Raw FMG height value (0–100; >= 20 is land). */
    height: number;
    /** Cell centroid in world feet (feet-canon, per spec §4). */
    positionFt: {
        x: number;
        y: number;
    };
    biome?: string;
    state?: CellOwnership;
    culture?: CellOwnership;
    religion?: CellOwnership;
    province?: CellOwnership;
    burg?: CellBurg;
    /** Estimated rural population on the cell (FMG `pop`, ×1000 inhabitants). */
    ruralPopulation?: number;
    /** True when a river channel runs through the cell. */
    hasRiver: boolean;
}
/**
 * Build a structured summary of the given cell. `cellId` is clamped/validated;
 * an out-of-range id returns a minimal water entry rather than throwing.
 */
export declare function describeCell(atlas: FmgAtlasResult, cellId: number): CellInfo;
