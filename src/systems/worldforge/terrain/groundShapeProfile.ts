/**
 * @file groundShapeProfile.ts - the exact ground shapes a spell or a tool cuts
 * into the land, as pure math on any height grid.
 *
 * WHY THIS FILE EXISTS (agora-257c, 2026-10-29, GG-533). The live river's
 * brush (`riverTerrainBrush.ts`) got three exact shapes for spells on
 * 2026-10-25: a hole, a trench and a wall. Remy then set the rule that the
 * water must react to the land, and that spells change the land, so the world
 * needs ONE ground that every edit writes into (`groundRecord.ts`). That
 * record and the river's brush must cut the SAME shape for the same spell, so
 * the shape math moved here and both call it. The numbers are the brush's own,
 * term for term: the brush's tests hold its behavior.
 *
 * The shapes (each cell's new height comes from its distance to the shape, so
 * two overlapping shapes never add up inside one call):
 *  - hole: a bowl `depth` m deep, radius `radius` m, at (x, z);
 *  - trench: the same profile along the segment (x, z) to (x2, z2); it follows
 *    the ground less `depth`, so a channel slopes with the land;
 *  - wall: a dam with a level crest at the lowest ground under its core plus
 *    `depth` m (its height); ground already higher (a bank) stays, so the wall
 *    ties into the banks and water ponds to the crest, then spills.
 * The edge of those three eases over the outer quarter of `radius` (steep
 * sides).
 *  - crater (GG-533 step 3, 2026-10-29): the cut of a sphere of radius
 *    `radius` m whose center sits `depth` m below the ground at (x, z). It is
 *    the 3D arena's blast crater term for term (`groundImpact.ts` sizes it,
 *    `VolumeArenaGround` carves the same sphere), so one blast digs one hole
 *    in the arena and in the world. Its rim is where the sphere meets the
 *    ground (`groundShapeFootprintRadius`), inside `radius`. The arena then
 *    slumps the walls; the record does not (yet).
 */

export type GroundShapeKind = 'hole' | 'trench' | 'wall' | 'crater';

/** The part of `radius` a hole, a trench or a wall holds at full depth; the rest is the eased edge. */
export const GROUND_SHAPE_FULL_FRACTION = 0.75;

/** One exact shape, in the grid's own axes and meters. */
export interface GroundShape {
  shape: GroundShapeKind;
  x: number;
  z: number;
  /** The trench's or the wall's second end (a hole and a crater ignore it). */
  x2?: number;
  z2?: number;
  /** Half width of the shape, m (at most 60). */
  radius: number;
  /** Depth of a hole or a trench, the height of a wall, or how far a crater's sphere center sits below the ground, m (at most 30). */
  depth: number;
}

/** A box in the grid's axes, m. */
export interface GroundShapeBounds { x0: number; z0: number; x1: number; z1: number }

/**
 * A height grid the shape reads: vertex (i, j) stands at (x0 + i step, z0 + j
 * step), and `read(index)` gives its height in meters (index = j nx + i).
 */
export interface GroundShapeGrid {
  nx: number;
  nz: number;
  step: number;
  x0: number;
  z0: number;
  read: (index: number) => number;
}

/** Throw on a shape no tool may cut (the brush's limits). */
export function validateGroundShape(s: GroundShape): void {
  const line = s.shape === 'trench' || s.shape === 'wall';
  if (!['hole', 'trench', 'wall', 'crater'].includes(s.shape) || ![s.x, s.z, s.radius, s.depth].every(Number.isFinite)
    || (line && ![s.x2, s.z2].every(Number.isFinite)) || s.radius <= 0 || s.depth <= 0 || s.radius > 60 || s.depth > 30) {
    throw Error('Invalid terrain shape');
  }
}

/**
 * The radius of the ground a shape changes around its center line, m: the
 * crater's rim (where its sphere meets level ground), else `radius`.
 */
export function groundShapeFootprintRadius(s: GroundShape): number {
  return s.shape === 'crater' ? Math.sqrt(Math.max(0, s.radius * s.radius - s.depth * s.depth)) : s.radius;
}

/** The box a shape can change, m. */
export function groundShapeBounds(s: GroundShape): GroundShapeBounds {
  const r = s.radius;
  const bx = s.x2 ?? s.x;
  const bz = s.z2 ?? s.z;
  return { x0: Math.min(s.x, bx) - r, z0: Math.min(s.z, bz) - r, x1: Math.max(s.x, bx) + r, z1: Math.max(s.z, bz) + r };
}

/**
 * The height change the shape makes at each grid vertex it reaches, as
 * [index, delta m] pairs. The grid is read, never written: the caller stores
 * the change its own way (the brush as an undoable offset, the ground record
 * in its height grid).
 */
export function groundShapeDeltas(s: GroundShape, g: GroundShapeGrid): Array<[number, number]> {
  const r = s.radius, ax = s.x, az = s.z, bx = s.x2 ?? ax, bz = s.z2 ?? az;
  const bounds = groundShapeBounds(s);
  const ex = bx - ax, ez = bz - az, len2 = ex * ex + ez * ez;
  const distance = (x: number, z: number) => {
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2)) : 0;
    return Math.hypot(x - ax - ex * t, z - az - ez * t) / r;
  };
  // Steep sides: full depth over the inner three quarters, a smooth edge outside.
  const profile = (d: number) => { if (d >= 1) return 0; const t = Math.min(1, (1 - d) / (1 - GROUND_SHAPE_FULL_FRACTION)); return t * t * (3 - 2 * t); };
  const { nx, nz, step, x0, z0, read } = g;
  const i0 = Math.max(0, Math.ceil((bounds.x0 - x0) / step)), i1 = Math.min(nx - 1, Math.floor((bounds.x1 - x0) / step));
  const j0 = Math.max(0, Math.ceil((bounds.z0 - z0) / step)), j1 = Math.min(nz - 1, Math.floor((bounds.z1 - z0) / step));
  if (s.shape === 'crater') {
    // The sphere's center: `depth` under the ground at (x, z), read
    // bilinearly from the grid as it stood before this shape.
    const fx = (ax - x0) / step, fz = (az - z0) / step;
    const ci = Math.floor(fx), cj = Math.floor(fz);
    if (ci < 0 || cj < 0 || ci + 1 >= nx || cj + 1 >= nz) return [];
    const tx = fx - ci, tz = fz - cj;
    const h00 = read(cj * nx + ci), h10 = read(cj * nx + ci + 1), h01 = read((cj + 1) * nx + ci), h11 = read((cj + 1) * nx + ci + 1);
    const centerY = (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz - s.depth;
    if (!Number.isFinite(centerY)) return [];
    const out: Array<[number, number]> = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = distance(x0 + i * step, z0 + j * step) * r;
      if (d >= r) continue;
      const index = j * nx + i, h = read(index);
      // The sphere spans centerY +- half over this point. Ground inside it
      // goes, down to its lower surface. Ground above its top would leave a
      // buried void, which a height grid cannot hold, so that column stays.
      const half = Math.sqrt(r * r - d * d);
      const bottom = centerY - half;
      if (Number.isFinite(h) && h > bottom && h <= centerY + half) out.push([index, bottom - h]);
    }
    return out;
  }
  // A wall's crest: the lowest ground under its core, plus its height.
  let crest = Infinity;
  if (s.shape === 'wall') {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const h = read(j * nx + i);
      if (Number.isFinite(h) && distance(x0 + i * step, z0 + j * step) < 0.75) crest = Math.min(crest, h);
    }
    if (!Number.isFinite(crest)) return [];
    crest += s.depth;
  }
  const out: Array<[number, number]> = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const index = j * nx + i, h = read(index), w = profile(distance(x0 + i * step, z0 + j * step));
    if (w <= 0 || !Number.isFinite(h)) continue;
    const target = s.shape === 'wall' ? Math.max(h, crest) : h - s.depth;
    const delta = (target - h) * w;
    if (delta !== 0) out.push([index, delta]);
  }
  return out;
}
