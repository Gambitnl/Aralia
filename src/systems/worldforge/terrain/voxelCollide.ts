/**
 * A moving body against the voxel volume.
 *
 * The body is a vertical capsule: a cylinder with a hemisphere at each end.
 * That shape is the standard choice for a walking character and it earns its
 * place here for one reason — it has no corners. A box catches on every voxel
 * edge, and at 25 cm cells the ground is nothing but voxel edges. A capsule
 * slides over them.
 *
 * Three ideas carry the whole file.
 *
 * The move is SUB-STEPPED, so a fast body cannot pass through a thin wall
 * between one frame and the next. A single large move tested only at its
 * endpoint is the classic tunneling bug, and it appears exactly when it hurts
 * most: at speed, on the thinnest wall.
 *
 * The axes are resolved SEPARATELY — x, then z, then y. Sliding along a wall
 * falls out of that for free, instead of needing a special case. A body pushed
 * diagonally into a wall keeps the component that is not blocked.
 *
 * The body can STEP UP a small ledge. Without it a character stops dead at
 * every 25 cm voxel lip, which reads as broken rather than as solid.
 */
import { Material, VoxelVolume } from './voxelVolume';

export interface CollideTarget {
  volume: VoxelVolume;
  cellM: number;
  originM: readonly [number, number, number];
}

export interface CapsuleBody {
  /** Radius of the cylinder and of both caps, in meters. */
  radiusM: number;
  /** Total height from sole to crown, in meters. Must be at least 2 x radius. */
  heightM: number;
}

export interface MoveResult {
  /** Where the FEET ended up — the sole, not the center. */
  positionM: [number, number, number];
  /** True when solid is directly underfoot. */
  grounded: boolean;
  /** True when a wall stopped part of the horizontal move. */
  blocked: boolean;
  /** How far the body was lifted to clear a ledge, in meters. */
  steppedUpM: number;
}

/** How many halvings are used to find a contact point. */
const REFINE = 8;

/**
 * Does the capsule overlap any solid cell?
 *
 * The capsule's axis is vertical, which makes the distance test exact rather
 * than approximate: the closest point on a vertical segment to an axis-aligned
 * box shares the segment's x and z, so the three axes separate cleanly. A
 * general capsule-versus-box test would need a proper closest-point solve.
 */
export function capsuleOverlaps(
  target: CollideTarget,
  footM: readonly [number, number, number],
  body: CapsuleBody,
): boolean {
  const { volume, cellM, originM } = target;
  const r = body.radiusM;
  const [sx, fy, sz] = footM;

  // The inner segment: cap centers, not the extremes of the shape.
  const y0 = fy + r;
  const y1 = Math.max(y0, fy + body.heightM - r);

  const lo = (v: number, o: number) => Math.floor((v - o) / cellM);
  const cx0 = lo(sx - r, originM[0]);
  const cx1 = lo(sx + r, originM[0]);
  const cy0 = lo(fy, originM[1]);
  const cy1 = lo(fy + body.heightM, originM[1]);
  const cz0 = lo(sz - r, originM[2]);
  const cz1 = lo(sz + r, originM[2]);

  const r2 = r * r;
  for (let cy = cy0; cy <= cy1; cy++) {
    const by0 = originM[1] + cy * cellM;
    const by1 = by0 + cellM;
    // Segment-to-box gap on y, zero when the ranges overlap.
    const dy = y1 < by0 ? by0 - y1 : y0 > by1 ? y0 - by1 : 0;
    if (dy * dy >= r2) continue;
    for (let cz = cz0; cz <= cz1; cz++) {
      const bz0 = originM[2] + cz * cellM;
      const bz1 = bz0 + cellM;
      const dz = sz < bz0 ? bz0 - sz : sz > bz1 ? sz - bz1 : 0;
      if (dy * dy + dz * dz >= r2) continue;
      for (let cx = cx0; cx <= cx1; cx++) {
        if (volume.get(cx, cy, cz) === Material.Air) continue;
        const bx0 = originM[0] + cx * cellM;
        const bx1 = bx0 + cellM;
        const dx = sx < bx0 ? bx0 - sx : sx > bx1 ? sx - bx1 : 0;
        if (dx * dx + dy * dy + dz * dz < r2) return true;
      }
    }
  }
  return false;
}

/**
 * Move one axis as far as it will go, and report how far that was.
 *
 * The full move is tried first, because it succeeds almost every time and costs
 * one test. Only a blocked move pays for the search that finds the contact
 * point. Reverting the whole axis instead would be simpler and would leave the
 * body hovering up to a sub-step above the floor, which looks like bad
 * collision even though nothing ever penetrates.
 */
function slideAxis(
  target: CollideTarget,
  pos: [number, number, number],
  body: CapsuleBody,
  axis: 0 | 1 | 2,
  amount: number,
): number {
  if (amount === 0) return 0;
  const start = pos[axis];

  pos[axis] = start + amount;
  if (!capsuleOverlaps(target, pos, body)) return amount;

  let good = 0;
  let bad = amount;
  for (let i = 0; i < REFINE; i++) {
    const mid = (good + bad) / 2;
    pos[axis] = start + mid;
    if (capsuleOverlaps(target, pos, body)) bad = mid;
    else good = mid;
  }
  pos[axis] = start + good;
  return good;
}

/**
 * Move a capsule through the volume and report where it stopped.
 *
 * `deltaM` is the whole movement for this frame, gravity included. The caller
 * owns velocity; this function owns geometry.
 */
export function moveCapsule(
  target: CollideTarget,
  footM: readonly [number, number, number],
  body: CapsuleBody,
  deltaM: readonly [number, number, number],
  options: { stepHeightM?: number } = {},
): MoveResult {
  const stepHeight = options.stepHeightM ?? target.cellM * 1.2;
  const pos: [number, number, number] = [footM[0], footM[1], footM[2]];

  /* Sub-step so that no single test can skip a wall.
   *
   * The limit is half the smaller of the radius and a cell. Half a radius
   * cannot pass the body through its own width, and half a cell cannot pass it
   * through the thinnest wall the volume can represent. */
  const maxStep = Math.min(body.radiusM, target.cellM) * 0.5;
  const dist = Math.hypot(deltaM[0], deltaM[1], deltaM[2]);
  const steps = Math.max(1, Math.ceil(dist / maxStep));
  const sx = deltaM[0] / steps;
  const sy = deltaM[1] / steps;
  const sz = deltaM[2] / steps;

  let blocked = false;
  let steppedUpM = 0;

  for (let i = 0; i < steps; i++) {
    const wantX = sx;
    const wantZ = sz;
    const gotX = slideAxis(target, pos, body, 0, wantX);
    const gotZ = slideAxis(target, pos, body, 2, wantZ);

    const stuckX = Math.abs(gotX - wantX) > 1e-9;
    const stuckZ = Math.abs(gotZ - wantZ) > 1e-9;

    if (stuckX || stuckZ) {
      /* Try to climb the thing that stopped us.
       *
       * Lift, retry the horizontal move, then settle back down. If the lift
       * gains nothing the whole attempt is rolled back, so a body never floats
       * up a wall it failed to clear. Order matters: settling must come after
       * the horizontal move, or the body drops into the ledge it just cleared. */
      const before: [number, number, number] = [pos[0], pos[1], pos[2]];
      const lift = slideAxis(target, pos, body, 1, stepHeight);
      if (lift > 1e-9) {
        const climbX = slideAxis(target, pos, body, 0, wantX - gotX);
        const climbZ = slideAxis(target, pos, body, 2, wantZ - gotZ);
        if (Math.abs(climbX) > 1e-9 || Math.abs(climbZ) > 1e-9) {
          const drop = slideAxis(target, pos, body, 1, -lift);
          steppedUpM += lift + drop; // drop is negative
        } else {
          pos[0] = before[0];
          pos[1] = before[1];
          pos[2] = before[2];
          blocked = true;
        }
      } else {
        blocked = true;
      }
    }

    slideAxis(target, pos, body, 1, sy);
  }

  /* Grounded is a probe, not a memory of the last move.
   *
   * Asking "did the downward move get cut short" is wrong on the first frame a
   * body is placed, and wrong again whenever the vertical delta is zero. A body
   * standing still on a floor is still standing on it. */
  const probe: [number, number, number] = [pos[0], pos[1] - target.cellM * 0.05, pos[2]];
  const grounded = capsuleOverlaps(target, probe, body);

  return { positionM: pos, grounded, blocked, steppedUpM };
}
