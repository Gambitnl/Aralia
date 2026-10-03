/**
 * @file townVegetationKeepOut.ts — the town footprint that wilderness plants
 * must not grow inside.
 *
 * The wilderness scatter and the town generator never spoke to each other. The
 * scatter refuses water, paved cells and rock, and nothing else, so a tree
 * whose candidate point landed on a town's grass cell was placed — inside the
 * walls, between houses, in the middle of a street's grass verge. Found in a
 * live 3D look at Hafting (2026-08-03): trees standing among the roofs.
 *
 * The fix is a keep-out polygon per town, tested per plant. Two things about
 * its shape are deliberate:
 *
 * 1. A WALLED town uses its wall ring, unmodified. The ring already IS the
 *    town envelope by the town generator's own invariant, so deriving a second
 *    boundary beside it would be a second source of truth that can disagree.
 *
 * 2. An UNWALLED town gets the convex hull of its plot corners and street
 *    centerlines. A hull is too generous for a straggling village — it fills
 *    in every concavity — and that is the right error to make here. The
 *    failure it prevents (a tree inside the settlement) is glaring; the
 *    failure it causes (a bare patch in a notch of open ground at the village
 *    edge) is not something a player can name.
 *
 * The boundary is soft on the way out. Clearance runs from 0 at the edge to 1
 * a margin away, and a plant's survival chance rises across it, so the woods
 * thin toward the town instead of stopping on a line. That is the same lesson
 * the clearing gate taught in forests/clumpField.ts: a hard cutoff draws a
 * contour the eye finds immediately.
 */

export interface Pt {
  x: number;
  z: number;
}

/** One town's exclusion footprint, ground meters. */
export interface TownKeepOut {
  burgId: number;
  /** Closed ring, ground meters. Wound either way; the tests do not care. */
  ring: Pt[];
  /** Cheap reject box, inflated by the widest margin any caller uses. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Andrew's monotone chain. Returns the hull counter-clockwise. */
function convexHull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts.slice();
  const p = pts.slice().sort((a, b) => (a.x - b.x) || (a.z - b.z));
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const half = (src: Pt[]) => {
    const out: Pt[] = [];
    for (const q of src) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half(p.reverse())];
}

/**
 * Build one town's keep-out.
 *
 * `wallRing` wins when the town has one. `fallbackPoints` should carry every
 * plot corner and street vertex the town owns; it is only read for unwalled
 * towns. Returns null when there is not enough geometry to enclose anything,
 * which is correct for a lone waypoint or an empty plan — a keep-out that is
 * not a polygon should clear nothing rather than guess.
 */
export function buildTownKeepOut(
  burgId: number,
  wallRing: Pt[] | null | undefined,
  fallbackPoints: Pt[],
  padM: number,
): TownKeepOut | null {
  const ring = wallRing && wallRing.length >= 3 ? wallRing.slice() : convexHull(fallbackPoints);
  if (ring.length < 3) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { burgId, ring, minX: minX - padM, maxX: maxX + padM, minZ: minZ - padM, maxZ: maxZ + padM };
}

function pointInRing(x: number, z: number, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(x: number, z: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
  const px = a.x + t * dx;
  const pz = a.z + t * dz;
  return Math.hypot(x - px, z - pz);
}

/** Distance from a point to a ring's boundary, ignoring which side it is on. */
function distToRing(x: number, z: number, ring: Pt[]): number {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const d = distToSegment(x, z, ring[i], ring[j]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * How free a point is of every town, from 0 to 1.
 *
 * 0 means inside a town or right against its edge — nothing wild grows there.
 * 1 means at least `marginM` clear of every town. In between the value ramps
 * smoothly, and callers use it as a survival probability so the treeline
 * feathers toward the settlement.
 *
 * The bounding-box test in front matters: this runs per plant per chunk, and
 * almost every plant in a world is nowhere near a town.
 */
export function townClearance(
  x: number,
  z: number,
  keepOuts: readonly TownKeepOut[],
  marginM: number,
): number {
  let worst = 1;
  for (const k of keepOuts) {
    if (x < k.minX || x > k.maxX || z < k.minZ || z > k.maxZ) continue;
    if (pointInRing(x, z, k.ring)) return 0;
    if (marginM <= 0) continue;
    const d = distToRing(x, z, k.ring);
    if (d >= marginM) continue;
    const t = d / marginM;
    const eased = t * t * (3 - 2 * t);
    if (eased < worst) worst = eased;
  }
  return worst;
}
