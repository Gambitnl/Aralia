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
export const CELL_FT: Feet = 5;

/**
 * Exact international conversion. Used ONLY at the FMG-port boundary.
 * 1 ft = 0.3048 m by definition.
 */
export const FEET_PER_METER = 1 / 0.3048;

export function feetFromMeters(meters: number): Feet {
  return meters * FEET_PER_METER;
}

export function metersFromFeet(feet: Feet): number {
  return feet * 0.3048;
}

/** Snap a foot value to the atomic 5 ft cell grid (nearest cell corner). */
export function snapToCell(feet: Feet): Feet {
  return Math.round(feet / CELL_FT) * CELL_FT;
}

// ---------------------------------------------------------------------------
// Layer scale targets (SPEC §4). These are design targets, not hard clamps —
// generators may size bounds to terrain/context, but tests and tooling use
// these as the canonical orders of magnitude per layer.
// ---------------------------------------------------------------------------

/** L1 REGION: neighborhood of atlas cells around one cell. */
export const REGION_SIZE_FT: Feet = 25_000;

/** L2 LOCAL: playable area around a POI/party; replaces the 20×30 submap. */
export const LOCAL_SIZE_FT: Feet = 3_000;

/** Axis-aligned bounds in world feet. */
export interface BoundsFt {
  /** West edge (feet, world space). */
  x: Feet;
  /** North edge (feet, world space — +y grows south, matching screen/grid). */
  y: Feet;
  width: Feet;
  height: Feet;
}

export function boundsCenter(b: BoundsFt): { x: Feet; y: Feet } {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export function boundsContain(b: BoundsFt, x: Feet, y: Feet): boolean {
  return x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
}
