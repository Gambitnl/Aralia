/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 22:01:48
 * Dependents: systems/worldforge/interior/blueprintTypes.ts, systems/worldforge/interior/buildingExtensions.ts, systems/worldforge/interior/buildingHistory.ts, systems/worldforge/interior/generateBuilding.ts, systems/worldforge/interior/partition.ts, systems/worldforge/interior/roofPlan.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file footprint.ts — irregular building footprints on the 5 ft cell grid.
 *
 * Task 2 of the Building Blueprint Pipeline. A footprint is the union of a
 * main rectangle plus 0–4 wings/towers chosen by building type, snapped to
 * whole 5 ft cells. Guarantees pinned by tests:
 *   - deterministic per seed path (all randomness via the 'footprint' stream)
 *   - single 4-connected region (wings overlap the main by one cell)
 *   - never a bare rectangle (a wing is forced when none breaks the shape)
 *   - normalized so the min occupied cell is (0,0)
 *
 * Pure data — no three.js, no rendering concerns.
 */
import type { BuildingLotProfile, BuildingType, Cell } from './blueprintTypes';
import { type SeedPath } from '../seedPath';
export type MassKind = 'main' | 'wing' | 'tower';
export interface FootprintMass {
    kind: MassKind;
    /** Post-normalize cell coords (same frame as Footprint.cells). */
    x: number;
    y: number;
    w: number;
    h: number;
    /** Ordered event that introduced this mass; absent on canonical generation. */
    extensionEventIndex?: number;
}
export interface Footprint {
    cols: number;
    rows: number;
    /** occ[y][x], row-major over the normalized bounding box. */
    occ: boolean[][];
    cells: Cell[];
    /** Exact decomposition, main first. Union of masses === cells. */
    masses: FootprintMass[];
}
/**
 * Build directly inside a town-negotiated lot. The street-facing main mass
 * fills the frontage. Returns extend only on their named side, while a rear
 * court keeps both party-wall columns complete and removes only the rear
 * center. Small lots degrade to a full envelope rather than producing a
 * disconnected or one-cell decorative appendage.
 */
export declare function footprintForLotProfile(profile: BuildingLotProfile, maxCols: number, maxRows: number): Footprint;
/**
 * Clamp a footprint into a maxCols × maxRows cell window (lot fit — Task 10 /
 * C3-T2). Cells outside the window anchored at (0,0) are dropped, then only
 * the largest 4-connected component is kept (a crop can sever a wing), and
 * the result is re-normalized so the min occupied cell is (0,0). RNG-free and
 * deterministic; returns the input unchanged when it already fits. The
 * "never a bare rectangle" shape guarantee does NOT survive clamping — a
 * tight lot may legitimately force a plain rectangle.
 */
export declare function clampFootprint(fp: Footprint, maxCols: number, maxRows: number): Footprint;
/**
 * Generate an irregular footprint for a building. Deterministic: all
 * randomness derives from the 'footprint' stream of the given seed path.
 */
export declare function genFootprint(path: SeedPath, type: BuildingType): Footprint;
