/**
 * @file types.ts
 * @description Interior plan contract — SPEC §4 L4 / decision #10 (fully
 * procedural room-packing from the building footprint, furnish by room role)
 * and decision #11 (seamless doors — interiors live inside the exterior
 * shells, so everything here is plot-local feet, not a separate scene).
 *
 * Coordinate frame: PLOT-LOCAL feet. x runs along the frontage edge
 * (footprint corners 0→1, the street wall), y runs inward along the depth
 * edge (corners 0→3). y = 0 IS the street wall — the exterior door the 3D
 * renderer already draws sits on this wall, so the interior entry below
 * matches it by construction.
 *
 * All coordinates are 5 ft grid aligned (decision #12: D&D feet everywhere,
 * 5 ft atomic unit).
 */

import type { Feet } from '../units';

export type RoomRole =
  | 'hall'
  | 'bedroom'
  | 'kitchen'
  | 'storage'
  | 'workshop'
  | 'shopfloor';

/** Axis-aligned room rect in plot-local feet. */
export interface InteriorRoom {
  id: number;
  role: RoomRole;
  x: Feet;
  y: Feet;
  w: Feet;
  d: Feet;
}

/**
 * A doorway between two rooms (or to the street). `a === EXTERIOR` marks
 * the entry door on the street wall. `axis` is the wall direction the door
 * sits in: 'x' = wall parallel to the frontage (door crosses a y boundary),
 * 'y' = wall parallel to the depth edge (door crosses an x boundary).
 */
export interface InteriorDoorway {
  a: number;
  b: number;
  x: Feet;
  y: Feet;
  axis: 'x' | 'y';
}

/** Sentinel room id for the street side of the entry doorway. */
export const EXTERIOR = -1;

export interface InteriorFurnishing {
  kind: string;
  roomId: number;
  x: Feet;
  y: Feet;
  /** Quarter-turn rotation, degrees. */
  rotation: 0 | 90 | 180 | 270;
}

export interface InteriorPlan {
  plotId: number;
  /** Interior envelope dims in feet (5 ft aligned, derived from footprint). */
  widthFt: Feet;
  depthFt: Feet;
  /** Echoed from the plot — upper storeys are a later slice. */
  storeys: number;
  rooms: InteriorRoom[];
  doorways: InteriorDoorway[];
  furnishings: InteriorFurnishing[];
}
