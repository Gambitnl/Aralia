/**
 * @file placedObject.ts — the one shape the refinement loop scores.
 *
 * The loop must judge a prop, a tree and a creature with the same four checks.
 * So every source (props/placementEngine.ts, world3d vegetation scatter, the
 * battle-map actor list) adapts INTO this shape. Nothing in this file renders
 * and nothing reads a scene graph: the scorer runs headless.
 *
 * Units: FEET, +Y up, +X east, +Z south. Matches surfaceProbe.ts.
 */

/** Axis-aligned local bounds of a mesh, BEFORE scale and rotation. Feet. */
export interface LocalBoundsFt {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/**
 * One placed instance, as the loop sees it.
 *
 * `positionFt.y` is the object's ORIGIN height, not its base height. The base
 * sits at `positionFt.y + localBounds.minY * scale`, which is what the contact
 * and penetration checks read.
 */
export interface PlacedObject {
  /** Stable id — the report names failures by this. */
  id: string;
  /**
   * Key into the height table (`DEFAULT_HEIGHT_RANGES`): a creature size
   * category ('Large') or a prop size class ('prop-M'). Unknown keys skip the
   * scale check and say so — they are never silently passed.
   */
  speciesKey: string;
  positionFt: { x: number; y: number; z: number };
  /** Facing about +Y, radians. */
  rotationRad: number;
  /** Uniform scale applied to `localBounds`. */
  scale: number;
  localBounds: LocalBoundsFt;
  /**
   * Height of the object's lower hull above its base plane, at a point in
   * LOCAL, unscaled XZ. A flat-bottomed crate returns 0 everywhere. A rock
   * with a domed underside returns a positive value away from its contact
   * points. Absent = flat base.
   */
  lowerHullFt?: (localX: number, localZ: number) => number;
  /**
   * false = the town plan or the encounter author pinned this transform. The
   * corrector may not move it; only a ground co-deformation can save it.
   */
  transformMutable?: boolean;
  /** false = paved, scripted or shared ground. The corrector may not deform it. */
  groundMutable?: boolean;
  /** false = the scale is authored (a boss, a landmark). The corrector may not rescale it. */
  scaleMutable?: boolean;
}

/** A footprint sample in WORLD feet, carrying the local point it came from. */
export interface FootprintSample {
  xFt: number;
  zFt: number;
  localX: number;
  localZ: number;
}

/**
 * Footprint sample grid resolution per axis.
 *
 * 5 x 5 = 25 samples. A 3 x 3 grid cannot tell a corner lift from a bowed
 * base, because it has one interior sample. A 9 x 9 grid quadruples the probe
 * cost for a contact ratio that moves by under 2% in testing. 5 x 5 also puts
 * a sample on each edge midpoint, which is where a rigid base first lifts.
 */
export const FOOTPRINT_GRID = 5;

/**
 * Sample the object's base footprint in world feet.
 *
 * The footprint is the object's local XZ extent, scaled, rotated about +Y and
 * translated. Samples are deterministic: same object in, same samples out.
 */
export function footprintSamples(obj: PlacedObject, grid = FOOTPRINT_GRID): FootprintSample[] {
  const b = obj.localBounds;
  const s = obj.scale;
  const cos = Math.cos(obj.rotationRad);
  const sin = Math.sin(obj.rotationRad);
  const out: FootprintSample[] = [];
  for (let i = 0; i < grid; i++) {
    const tx = grid === 1 ? 0.5 : i / (grid - 1);
    const localX = b.minX + (b.maxX - b.minX) * tx;
    for (let j = 0; j < grid; j++) {
      const tz = grid === 1 ? 0.5 : j / (grid - 1);
      const localZ = b.minZ + (b.maxZ - b.minZ) * tz;
      const sx = localX * s;
      const sz = localZ * s;
      out.push({
        xFt: obj.positionFt.x + sx * cos - sz * sin,
        zFt: obj.positionFt.z + sx * sin + sz * cos,
        localX,
        localZ,
      });
    }
  }
  return out;
}

/** World Y of the object's lower hull at one footprint sample, feet. */
export function hullYAt(obj: PlacedObject, sample: FootprintSample): number {
  const baseY = obj.positionFt.y + obj.localBounds.minY * obj.scale;
  const lift = obj.lowerHullFt ? obj.lowerHullFt(sample.localX, sample.localZ) * obj.scale : 0;
  return baseY + lift;
}

/** Scaled bounding-box height, feet. Feeds the scale-sanity check. */
export function objectHeightFt(obj: PlacedObject): number {
  return (obj.localBounds.maxY - obj.localBounds.minY) * obj.scale;
}

/**
 * Horizontal radius of the footprint, feet. Used as the co-deformation radius
 * and as the feather scale. Half the diagonal, so the whole base is covered
 * whatever the facing.
 */
export function footprintRadiusFt(obj: PlacedObject): number {
  const b = obj.localBounds;
  const w = (b.maxX - b.minX) * obj.scale;
  const d = (b.maxZ - b.minZ) * obj.scale;
  return 0.5 * Math.hypot(w, d);
}
