/**
 * @file gaits/poseUtils.ts — the gait drivers' shared vocabulary: the public
 * driver interfaces, the pose factory, and the math + scratch objects more than
 * one driver reaches for.
 *
 * Split out of gaits.ts (MOD-3.8, 2026-09-09). Every declaration here is
 * verbatim from that file. The four scratch vectors below stay MODULE
 * singletons on purpose: BipedDriver, MultiLegDriver and PlanDriver each borrow
 * them inside one synchronous method and never across a yield, exactly as they
 * did when all three classes shared one file. Giving each driver its own copy
 * would allocate per frame for no behavioral gain.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:48:40
 * Dependents: systems/entities3d/three/gaits.ts, systems/entities3d/three/gaits/baseDriver.ts, systems/entities3d/three/gaits/bipedDriver.ts, systems/entities3d/three/gaits/multiLegDriver.ts, systems/entities3d/three/gaits/planDriver.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Quaternion, Vector3 } from 'three';
import type { Anchor, SegmentSink } from '../../types';
import { ANCHORS } from '../../types';
import { BallSocketConstraint, type JointConstraint } from '../jointConstraints';

export interface LocomotionState {
  position: Vector3;
  heading: Vector3;
  /** Ground speed in m/s (or air speed for flyers). */
  speed: number;
  /** Optional gesture overlay (biped only). 'wave': the free hand rises
   * beside the head, palm out, digits EXTENDED, and rocks side to side.
   * 'wave_both': both hands wave (a held weapon rides its raised hand). */
  gesture?: 'wave' | 'wave_both';
}

export interface PoseAnchor {
  pos: Vector3;
  quat: Quaternion;
}

export interface Pose {
  anchors: Record<Anchor, PoseAnchor>;
}

/** A planned head's live position + look direction (for per-socket eyes). */
export interface PlanHeadSocket {
  x: number;
  y: number;
  z: number;
  /** Head ball radius in meters. */
  r: number;
  /** Unit look direction (where the face points). */
  fx: number;
  fy: number;
  fz: number;
  eyes: { count: number; sizeScale: number };
}

export interface GaitDriver {
  update(t: number, dt: number, loco: LocomotionState): void;
  /** Emit this frame's body skeleton (entity-local meters, ground at y=0):
   * tapered bone segments + round lumps (head, hands, feet). Segment ids are
   * stable across frames and radii are frame-constant per id. */
  buildBody(sink: SegmentSink): void;
  readonly pose: Pose;
  readonly gaitPhase: number;
  /** Debugger scrub: jump the gait cycle to `phase` (wrapped into 0–1). */
  setPhase(phase: number): void;
  /** Wing flap angle in radians. Flyers own the power stroke; grounded
   * gaits emit a gentle speed-scaled wing beat (harmless on wingless
   * bodies — the assembler only applies flap to parts with wingL/wingR
   * groups); hopper stays 0 (no winged hopper profiles exist). */
  readonly flap: number;
  /** 0 spread … 1 folded along the body. Grounded winged gaits fold at rest
   * (idle dragons carry wings swept back, not vertical sails) and open as
   * speed builds; flyers stay 0. The assembler sweeps wingL/wingR by this. */
  readonly wingFold: number;
  /** Extra body lift (hopper airtime, flyer altitude), applied by the assembler. */
  readonly verticalOffsetM: number;
  /** Plan-driven bodies: live head positions for per-socket eye placement. */
  headSockets?(): PlanHeadSocket[];
}

export function makePose(): Pose {
  return {
    anchors: Object.fromEntries(
      ANCHORS.map((a) => [a, { pos: new Vector3(), quat: new Quaternion() }]),
    ) as Record<Anchor, PoseAnchor>,
  };
}

// Body v2: bones go straight to the sink as segments — no interpolated balls.

/** Shared per-frame scratch — borrowed by the biped, multi-leg and plan
 * drivers (see the file header on why they stay module singletons). */
export const V_HIP = new Vector3();
export const V_KNEE = new Vector3();
export const V_BEND = new Vector3();
export const V_HAND = new Vector3();

/** Real-finger grip solve: intersect circle(p, len) with circle(c, R) in the
 * palm's local Y–Z plane and return the solution the curl prefers ('minZ' =
 * toward the knuckle front, 'minY' = onward toward the palm heel). A digit
 * that cannot reach the wrap circle lands on the chord's nearest point (h
 * clamps to 0) — a geometric clamp that keeps the link length exact. */
export function wrapIntersectYZ(
  py: number,
  pz: number,
  len: number,
  cy: number,
  cz: number,
  R: number,
  prefer: 'minZ' | 'minY',
): [number, number] {
  let dy = cy - py;
  let dz = cz - pz;
  let d = Math.hypot(dy, dz);
  if (d < 1e-9) {
    d = 1e-9;
    dy = 1e-9;
    dz = 0;
  }
  const a = (len * len - R * R + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, len * len - a * a));
  const uy = dy / d;
  const uz = dz / d;
  const my = py + uy * a;
  const mz = pz + uz * a;
  // the two solutions sit ±h along the perpendicular (rotate u by 90°)
  const y1 = my - uz * h;
  const z1 = mz + uy * h;
  const y2 = my + uz * h;
  const z2 = mz - uy * h;
  if (prefer === 'minZ') return z1 <= z2 ? [y1, z1] : [y2, z2];
  return y1 <= y2 ? [y1, z1] : [y2, z2];
}

/** Quadratic bezier point (allocates — driver-construction and per-frame chain math only). */
/**
 * A multi-link limb may kink hard at each joint, but it must not fold back
 * through itself. 75 degrees is loose enough to leave every authored insect and
 * arachnid bend untouched, and tight enough to reject the fold.
 */
const LEG_JOINT_LIMIT = new BallSocketConstraint(75, 0, 0);
const LEG_LIMITS_BY_LENGTH = new Map<number, readonly (JointConstraint | null)[]>();

/** Per-joint limits for a leg of `linkCount` links. Entry 0 is never used. */
export function legJointLimits(linkCount: number): readonly (JointConstraint | null)[] {
  let limits = LEG_LIMITS_BY_LENGTH.get(linkCount);
  if (!limits) {
    limits = Array.from({ length: linkCount }, (_, j) => (j === 0 ? null : LEG_JOINT_LIMIT));
    LEG_LIMITS_BY_LENGTH.set(linkCount, limits);
  }
  return limits;
}

export function bezier2(a: Vector3, m: Vector3, b: Vector3, u: number): Vector3 {
  const w = 1 - u;
  return new Vector3(
    w * w * a.x + 2 * w * u * m.x + u * u * b.x,
    w * w * a.y + 2 * w * u * m.y + u * u * b.y,
    w * w * a.z + 2 * w * u * m.z + u * u * b.z,
  );
}

