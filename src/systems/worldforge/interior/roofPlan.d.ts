/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 21:37:35
 * Dependents: systems/worldforge/interior/generateBuilding.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file roofPlan.ts — the roof solver (Building Generator v2, Phase 1B Task 3).
 *
 * Pure geometry: footprint masses + resolved style → RoofPlan. Per-mass roofs
 * joined with valleys, chimneys from hearths, dormers for windowless upper
 * bedrooms, caps on towers. RNG-FREE — every taste decision arrives through the
 * `style` input. No three.js, no rendering concerns.
 *
 * Units: masses are cell coords (5 ft cells); ALL emitted geometry is in FEET.
 * A RoofPlane's z is height ABOVE the wall-top (wallTopFt), never absolute.
 *
 * Coordinate convention (matches the rest of Worldforge): +y grows south.
 */
import type { Feet } from '../units';
import type { FootprintMass } from './footprint';
import type { Cell, RoofPlan, RoofPlane } from './blueprintTypes';
export interface SolveRoofInput {
    masses: FootprintMass[];
    footprintCells: Cell[];
    style: {
        roofForm: 'gable' | 'hip' | 'steep' | 'flat';
        pitchRiseFt: Feet;
        eaveOverhangFt: Feet;
    };
    /** Hearth/forge-hearth furnishings of the TOPMOST habitable floor, feet. */
    hearths: Array<{
        x: Feet;
        y: Feet;
    }>;
    /** Upper-floor bedrooms owning no window edge (dormer candidates). */
    windowlessUpperRooms: Cell[];
    /**
     * Attached frontage sides terminate at the lot line instead of carrying an
     * eave through the neighboring roof. Structural party walls remain complete.
     */
    partyWallLeft?: boolean;
    partyWallRight?: boolean;
    wallTopFt: Feet;
}
type Pt3 = [Feet, Feet, Feet];
interface RectFt {
    x: Feet;
    y: Feet;
    w: Feet;
    h: Feet;
}
type Axis = 'x' | 'y';
/**
 * Evaluate a planar face's z at (x,y). The face is (near-)planar by
 * construction; we fit the plane from the first three non-collinear corners.
 * Returns 0 for a degenerate face.
 */
export declare function planeZAt(plane: RoofPlane, x: Feet, y: Feet): Feet;
/**
 * Remove the part of a convex planar polygon (triangle, quad, trapezoid, or
 * any n-gon from earlier clips) whose XY projection lies inside `rect`.
 * Returns 0-4 convex pieces that exactly tile the remainder, via a band
 * decomposition of the rect's complement (above / below / left-of / right-of),
 * each piece cut with Sutherland–Hodgman so z stays on the source plane.
 * Pieces may have more than 4 vertices — RoofPlane.pts allows that.
 */
export declare function clipPolyToRectXY(poly: Pt3[], rect: RectFt): RoofPlane[];
/**
 * Two sloped quads for a gable/steep roof over a rectangle. Ridge runs along
 * the longer axis; the shorter axis carries the slope. Eaves extend
 * `eaveOverhangFt` on the two eave (long) sides. Height at the ridge is
 * `slope * halfSpan` where halfSpan is the un-eaved short half-extent, so all
 * masses sharing `slope` line up. Also returns the ridge record.
 */
declare function gablePrism(rect: RectFt, slope: number, eave: Feet): {
    planes: RoofPlane[];
    ridge: RoofPlan['ridges'][number];
    ridgeAxis: Axis;
};
/**
 * Hipped roof over a rectangle: ridge shortened by half the shorter extent at
 * each end → 2 trapezoids (long sides) + 2 triangles (short ends). Same slope
 * as a gable so it lines up with wings. Eaves on all four sides.
 */
declare function hipPrism(rect: RectFt, slope: number, eave: Feet): {
    planes: RoofPlane[];
    ridge: RoofPlan['ridges'][number];
};
/**
 * Valley segments where a wing's roof meets the main's roof. The wing ridge
 * axis MUST be derived by the SAME rule gablePrism uses (`w >= h` → ridge along
 * x), because the crease pattern depends on how the wing ridge is oriented
 * relative to the main edge the wing crosses. Both roofs share the pitch slope
 * `s`, which cancels out of every crease equation below (the creases' XY
 * positions are slope-independent; only their z depends on s).
 *
 * Three cases per wing (derivations pinned in roofPlan.test.ts):
 *
 * 1. PERPENDICULAR ridge (T-shape: wing ridge along the protrusion axis, e.g.
 *    a deep south wing crossing the main's south eave). The wing's two side
 *    planes meet the main's facing plane along two diagonal valleys, each from
 *    the outer eave corner (wing side edge × main edge line, z=0) to the
 *    wing-ridge/main-slope junction, which sits half the wing's cross-width
 *    inside the crossed edge (equal slopes ⇒ 45° in plan).
 *
 * 2. PARALLEL ridge (wide wing: run ≥ depth, ridge parallel to the crossed
 *    eave). The wing's INNER plane z = s·(dist from the wing's inner eave) and
 *    the main's facing plane z = s·(dist from the crossed edge) are equal
 *    halfway across the overlap: a HORIZONTAL crease across the wing width,
 *    plus two short stubs where each wing sidewall descends the main slope
 *    from the crease to the crossed edge (z 0).
 *
 * 3. GABLE-END crossing (main ridge parallel to the protrusion axis): the
 *    crossed main side is a vertical gable end with NO facing slope — the
 *    junction is wall flashing, not a roof valley. Emit nothing.
 *
 * Returns [] for case 3 and for wings that do not protrude past the main.
 */
declare function wingValleys(wing: RectFt, main: RectFt): RoofPlan['valleys'];
export declare function solveRoof(input: SolveRoofInput): RoofPlan;
/** Downhill horizontal unit normal of a plane (direction of steepest descent). */
declare function downhillNormal(plane: RoofPlane): {
    nx: number;
    ny: number;
};
declare function pointInPolyXY(px: Feet, py: Feet, pts: Pt3[]): boolean;
/** Test-only surface for unit-testing internal helpers. */
export declare const __private: {
    pitchSlope: (mainRect: RectFt, pitchRiseFt: Feet) => number;
    massRectFt: (m: FootprintMass) => RectFt;
    gablePrism: typeof gablePrism;
    hipPrism: typeof hipPrism;
    wingValleys: typeof wingValleys;
    downhillNormal: typeof downhillNormal;
    pointInPolyXY: typeof pointInPolyXY;
};
export {};
