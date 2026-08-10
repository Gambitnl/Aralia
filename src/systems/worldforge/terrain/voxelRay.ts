/**
 * Rays against the voxel volume.
 *
 * The volume answers "is this point solid" and nothing else. A ray is the first
 * thing built on top of that, and almost everything else needs one: a player
 * pointing at the ground to read its material, a spell choosing where its cut
 * begins, a camera keeping itself out of rock, a falling body finding what it
 * is about to land on.
 *
 * The march is the Amanatides and Woo grid traversal. It steps cell to cell and
 * never samples a point twice, so it cannot miss a thin wall the way a fixed
 * step size can. That property is the reason to use it rather than marching a
 * point along the ray at some small interval, which is simpler to write and
 * silently wrong at grazing angles.
 *
 * Meters in, meters out. The volume thinks in cell indices, and no caller
 * should have to.
 */
import { Material, VoxelVolume } from './voxelVolume';

export interface RayHit {
  /** Where the ray met solid, in world meters. */
  pointM: [number, number, number];
  /** The face it came through. One axis is 1 or -1, the others are 0. */
  normal: [number, number, number];
  /** Distance from the ray origin, in meters. */
  distanceM: number;
  /** The cell that was hit. */
  cell: [number, number, number];
  /** What that cell is made of. */
  material: Material;
}

export interface RayTarget {
  volume: VoxelVolume;
  /** Cell size on X and Z, meters. */
  cellM: number;
  /** Cell size on Y, meters. Defaults to `cellM` — see `SurfaceTarget`. */
  cellHM?: number;
  originM: readonly [number, number, number];
}

/**
 * March a ray until it meets solid, or until it runs out of volume or range.
 *
 * `dir` need not be normalized. It is normalized here, so `distanceM` is always
 * meters and never a multiple of some caller's vector length. Getting that
 * wrong is a quiet class of bug: everything looks right until one caller passes
 * a scaled direction and its distances are all off by that scale.
 */
export function raycastVoxels(
  target: RayTarget,
  originM: readonly [number, number, number],
  dir: readonly [number, number, number],
  maxDistanceM = 200,
): RayHit | null {
  const { volume, cellM } = target;
  const cellHM = target.cellHM ?? cellM;
  const n = volume.cells;
  const nY = volume.cellsY;

  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (len === 0) return null;
  const dx = dir[0] / len;
  const dy = dir[1] / len;
  const dz = dir[2] / len;

  /* The march runs on a lattice whose cells are no longer cubes, so the
   * traversal parameter `t` is now WORLD METERS and the direction is carried
   * in CELLS PER METER, one rate per axis. That is the whole adaptation: with
   * cubic cells `t` was cells and every distance was multiplied by `cellM` on
   * the way out, and the two forms agree exactly there.
   *
   * Doing it the other way round — keeping `t` in cells and scaling only the
   * Y index — would have made `distanceM` a lie on any ray with vertical
   * component, and every caller of this file trusts that number. */
  const rx = dx / cellM;
  const ry = dy / cellHM;
  const rz = dz / cellM;

  // Ray position in cell units, where cell (i,j,k) spans [i, i+1).
  const px = (originM[0] - target.originM[0]) / cellM;
  const py = (originM[1] - target.originM[1]) / cellHM;
  const pz = (originM[2] - target.originM[2]) / cellM;

  /* Skip the empty space before the volume.
   *
   * A camera sits well outside the bubble, so a march that starts at the ray
   * origin spends most of its steps in cells that cannot be solid. Worse, the
   * step budget would have to grow with how far away the camera is, which makes
   * the cost of a pick depend on the view rather than on the volume. The slab
   * test below jumps straight to the entry face. */
  let tMin = 0;
  let tMax = maxDistanceM;
  /* Which face the ray came in through, if it came in from outside.
   *
   * This is needed because the entry cell may already be solid — a ray fired
   * horizontally at a cliff meets rock on its very first cell. That is a hit
   * ON the entry face, not a ray that began underground, and the two must not
   * be confused. See the buried check below. */
  let entryAxis = -1;
  let entryStep = 0;
  const slab = (p: number, d: number, axis: number): boolean => {
    const lim = axis === 1 ? nY : n;
    if (Math.abs(d) < 1e-12) return p >= 0 && p <= lim; // parallel: inside or never
    let t0 = (0 - p) / d;
    let t1 = (lim - p) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    if (t0 > tMin) {
      tMin = t0;
      entryAxis = axis;
      entryStep = d > 0 ? 1 : -1;
    }
    tMax = Math.min(tMax, t1);
    return tMin <= tMax;
  };
  if (!slab(px, rx, 0) || !slab(py, ry, 1) || !slab(pz, rz, 2)) return null;

  // Nudge inside so the entry cell is unambiguous on an exact face hit.
  const t0 = tMin + 1e-6;
  if (t0 > tMax) return null;

  let x = Math.floor(px + rx * t0);
  let y = Math.floor(py + ry * t0);
  let z = Math.floor(pz + rz * t0);
  x = Math.min(n - 1, Math.max(0, x));
  y = Math.min(nY - 1, Math.max(0, y));
  z = Math.min(n - 1, Math.max(0, z));

  /* The entry cell may already be solid, and there are two ways that happens.
   *
   * The ray began OUTSIDE and struck rock on the volume's own face — a shot at
   * a cliff wall. That is an ordinary hit, and it carries the face it came
   * through. Reporting it as "buried" was the first bug this file had: a
   * sideways ray at a hillside came back with a zero normal and zero distance,
   * so a caller could not tell which way the wall faced.
   *
   * Or the ray began INSIDE solid, with a camera pushed into a cliff. There is
   * no entry face to report. Returning zero distance and a zero normal is the
   * honest answer; the tempting alternative reports the face the ray LEAVES
   * through, which reads as a hit on the far side of the wall the caller is
   * already inside, and the camera then sees through it. */
  if (volume.get(x, y, z) !== Material.Air) {
    const fromOutside = tMin > 0 && entryAxis >= 0;
    const normal: [number, number, number] = [0, 0, 0];
    if (fromOutside) normal[entryAxis] = -entryStep;
    const t = fromOutside ? tMin : 0;
    return {
      pointM: fromOutside
        ? [originM[0] + dx * t, originM[1] + dy * t, originM[2] + dz * t]
        : [originM[0], originM[1], originM[2]],
      normal,
      distanceM: t,
      cell: [x, y, z],
      material: volume.get(x, y, z),
    };
  }

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;

  // Distance along the ray to the next cell boundary on each axis, and the
  // distance between boundaries. Infinity handles an axis the ray never crosses.
  const big = Number.POSITIVE_INFINITY;
  const tDeltaX = Math.abs(rx) < 1e-12 ? big : Math.abs(1 / rx);
  const tDeltaY = Math.abs(ry) < 1e-12 ? big : Math.abs(1 / ry);
  const tDeltaZ = Math.abs(rz) < 1e-12 ? big : Math.abs(1 / rz);

  const bound = (p: number, cell: number, step: number, d: number): number => {
    if (Math.abs(d) < 1e-12) return big;
    const next = step > 0 ? cell + 1 : cell;
    return (next - p) / d;
  };
  let tMaxX = bound(px, x, stepX, rx);
  let tMaxY = bound(py, y, stepY, ry);
  let tMaxZ = bound(pz, z, stepZ, rz);

  let normal: [number, number, number] = [0, 0, 0];
  // Three cells per axis crossed is the worst case, plus slack for the entry.
  const budget = 2 * n + nY + 8;

  for (let i = 0; i < budget; i++) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      if (tMaxX > tMax) return null;
      normal = [-stepX, 0, 0];
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      if (tMaxY > tMax) return null;
      normal = [0, -stepY, 0];
      tMaxY += tDeltaY;
    } else {
      z += stepZ;
      if (tMaxZ > tMax) return null;
      normal = [0, 0, -stepZ];
      tMaxZ += tDeltaZ;
    }

    if (x < 0 || y < 0 || z < 0 || x >= n || y >= nY || z >= n) return null;

    const m = volume.get(x, y, z);
    if (m === Material.Air) continue;

    // The crossing just made is the entry distance: undo the delta added above.
    const tHit =
      normal[0] !== 0 ? tMaxX - tDeltaX : normal[1] !== 0 ? tMaxY - tDeltaY : tMaxZ - tDeltaZ;
    return {
      pointM: [originM[0] + dx * tHit, originM[1] + dy * tHit, originM[2] + dz * tHit],
      normal,
      distanceM: tHit,
      cell: [x, y, z],
      material: m,
    };
  }
  return null;
}

/**
 * Drop a ray straight down and report where it lands.
 *
 * This is the query a spawn point, a dropped item and a placed prop all want,
 * and writing it once stops three callers each inventing a downward ray with a
 * different idea of what "the ground" means over a tunnel.
 */
export function groundBelow(
  target: RayTarget,
  xM: number,
  yM: number,
  zM: number,
  maxDropM = 200,
): RayHit | null {
  return raycastVoxels(target, [xM, yM, zM], [0, -1, 0], maxDropM);
}
