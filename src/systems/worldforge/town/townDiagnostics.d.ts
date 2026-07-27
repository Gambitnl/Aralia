/**
 * @file townDiagnostics.ts — invariant checker for generated `TownPlan`s.
 *
 * Surfaces the town-generator failure modes (building/civic overlaps, buildings
 * outside the walls or footprint, empty/degenerate output) both as counts AND as
 * the offending geometry, so a design-preview overlay can draw exactly what is
 * wrong. Pure + deterministic; mirrors `.agent/scratch/town-audit.ts` but lives in
 * the tree so it ships with the Towns diagnostics preview.
 */
import { type Pt } from '../submap/submapEngine';
import type { TownPlan } from './townEngine';
export interface TownDiagnostics {
    buildingCount: number;
    /** Building polygons whose centroid lies outside the footprint. */
    outsideFootprint: Pt[][];
    /** Building polygons outside the wall ring (only when the town is walled). */
    outsideWalls: Pt[][];
    /** Buildings overlapping another building (each offending polygon, deduped). */
    buildingOverlaps: Pt[][];
    /** Buildings sitting under a solid civic structure. */
    civicOnBuilding: Pt[][];
    /** Solid civic structures overlapping another solid civic structure. */
    civicOverlaps: Pt[][];
    /** True when no invariant is violated. */
    clean: boolean;
    /** Flat count per category (for the readout). */
    counts: {
        buildings: number;
        outsideFootprint: number;
        outsideWalls: number;
        buildingOverlaps: number;
        civicOnBuilding: number;
        civicOverlaps: number;
    };
}
/** Analyze a generated town for invariant violations (geometry + counts). */
export declare function analyzeTownPlan(plan: TownPlan): TownDiagnostics;
