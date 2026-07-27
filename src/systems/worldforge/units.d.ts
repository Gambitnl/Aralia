/**
 * @file units.ts — Worldforge scale canon.
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 (decision #12, "D&D feet
 * everywhere"). ALL Worldforge artifacts author distances in feet; the 5 ft
 * cell is the atomic spatial unit at every layer. Meters exist only at the
 * FMG-port boundary (Azgaar's internals are metric) and must be converted
 * exactly once, on import, via the shim below — metric values never appear
 * in layer artifacts.
 *
 * What changed: new module (build-order item 1, the generation spine).
 * Why: four ad-hoc scales existed (atlas ~128 m cells, submap ~100 ft tiles,
 * battle map 5 ft tiles, World3D meters); Worldforge unifies them.
 * Preserved: nothing replaced yet — legacy surfaces keep their own units
 * until each layer's aggressive cutover (decision #21).
 */
/**
 * Distances in feet. A plain alias (not a branded type) to stay ergonomic
 * with the existing codebase; the convention is enforced by review + the
 * conversion shim, not the type system. Revisit branding if unit bugs appear.
 */
export type Feet = number;
/** The atomic spatial cell: one D&D grid square. */
export declare const CELL_FT: Feet;
/**
 * Exact international conversion. Used ONLY at the FMG-port boundary.
 * 1 ft = 0.3048 m by definition.
 */
export declare const FEET_PER_METER: number;
export declare function feetFromMeters(meters: number): Feet;
export declare function metersFromFeet(feet: Feet): number;
/** Snap a foot value to the atomic 5 ft cell grid (nearest cell corner). */
export declare function snapToCell(feet: Feet): Feet;
/** L1 REGION: neighborhood of atlas cells around one cell. */
export declare const REGION_SIZE_FT: Feet;
/** L2 LOCAL: playable area around a POI/party; replaces the 20×30 submap. */
export declare const LOCAL_SIZE_FT: Feet;
/** Axis-aligned bounds in world feet. */
export interface BoundsFt {
    /** West edge (feet, world space). */
    x: Feet;
    /** North edge (feet, world space — +y grows south, matching screen/grid). */
    y: Feet;
    width: Feet;
    height: Feet;
}
export declare function boundsCenter(b: BoundsFt): {
    x: Feet;
    y: Feet;
};
export declare function boundsContain(b: BoundsFt, x: Feet, y: Feet): boolean;
