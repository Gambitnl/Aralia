/**
 * @file speciesSkeleton.ts — skeleton pivot slice 5: real THREE.Bone hierarchies
 * for the SPECIES gaits (quad, hexapod, hopper, flyer, float).
 *
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md
 *
 * Slice 1 skinned the biped (skeletonBuilder.ts); slice 4 skinned the
 * plan-driven creatures (planSkeleton.ts). Those two are the precedent this
 * file follows exactly, in the same three parts:
 *
 *   1. speciesRestPose(gait, frame) — pure data: the driver's OWN rest
 *      emissions, captured by stepping a REAL driver with t = 0, dt = 0,
 *      speed = 0 (which zeroes bob, stride, squash and flap) and recording
 *      what buildBody() emits. Nothing is re-derived by hand, so the bind pose
 *      cannot drift from the driver — the identical trick planSkeleton uses.
 *
 *   2. buildSpeciesSkeleton(gait, frame) — the Bone hierarchy in bind pose.
 *      Bone names ARE the driver's emission ids (`spine.rear`, `leg2.upper`,
 *      `foot2`, `body.lobeL`, `armR`, `handR`, `head`, …), so the pose sink can
 *      never look a bone up under a name the driver does not emit.
 *
 *   3. createSpeciesPoseSink(skeleton) — a SegmentSink the assembler hands to
 *      driver.buildBody() in skinned mode; each seg(id, …) sets the owning
 *      bone's world position to the A joint and its world orientation to
 *      +Y-along-the-segment (the exact rule the segment renderer applies), each
 *      ball(id, …) sets position only, and finishFrame() resolves locals
 *      parent-first. Unknown ids throw — never a silent drop.
 *
 * Topology comes from SPECIES_TOPOLOGY below plus one derived rule (which spine
 * bone each leg hangs off, read from the captured hip z, not hardcoded), so
 * adding a leg row to MultiLegDriver needs no edit here.
 *
 * What is preserved: gaits.ts, legs.ts and the segment renderer are untouched;
 * bodyTech 'segments' remains the default. Decided (Remy 2026-07-21): a skinned
 * body renders SOLID SHADED — there is no skinned wireframe path.
 */
import { Bone, Quaternion, Vector3 } from 'three';
import type { Frame, Gait, SegmentSink } from '../types';
import { createGaitDriver } from './gaits';

/** The gaits this file covers (biped → skeletonBuilder, plan → planSkeleton). */
export const SPECIES_GAITS = ['quad', 'hexapod', 'hopper', 'flyer', 'float'] as const;
export type SpeciesGait = (typeof SPECIES_GAITS)[number];

export function isSpeciesGait(gait: Gait): gait is SpeciesGait {
  return (SPECIES_GAITS as readonly string[]).includes(gait);
}

/** One rigid rest bone: a tapered segment between two joints (meters, entity-local). */
export interface SpeciesRestSeg {
  id: string;
  a: [number, number, number];
  b: [number, number, number];
  r0: number;
  r1: number;
}

/** One round rest ball (head, foot, hand). */
export interface SpeciesRestBall {
  id: string;
  center: [number, number, number];
  r: number;
}

/** The driver's rest emissions, in emission order. */
export interface SpeciesRestPose {
  segs: SpeciesRestSeg[];
  balls: SpeciesRestBall[];
}

/**
 * Fixed parent per emission id, per gait. Every id a species driver emits is
 * listed here EXCEPT the multi-leg rows (`leg<i>.upper` / `leg<i>.lower` /
 * `foot<i>`), whose count varies with the driver — those are laid out by
 * pattern below, with the spine attachment read from the captured hip z.
 */
const SPECIES_TOPOLOGY: Readonly<Record<SpeciesGait, Readonly<Record<string, string>>>> = {
  // MultiLegDriver: horizontal spine rear→front, neck to a ball head, N legs.
  quad: {
    'spine.rear': 'root',
    'spine.front': 'spine.rear',
    neck: 'spine.front',
    head: 'neck',
  },
  hexapod: {
    'spine.rear': 'root',
    'spine.front': 'spine.rear',
    neck: 'spine.front',
    head: 'neck',
  },
  // HopperDriver: a squat vertical torso column, ball head, two stubby arms.
  hopper: {
    'torso.lower': 'root',
    'torso.upper': 'torso.lower',
    head: 'torso.upper',
    armL: 'torso.upper',
    handL: 'armL',
    armR: 'torso.upper',
    handR: 'armR',
  },
  // AirborneDriver(flapping): bird fuselage rear→front, neck+head, tail fin,
  // two tucked feet.
  flyer: {
    'body.rear': 'root',
    'body.front': 'body.rear',
    neck: 'body.front',
    head: 'neck',
    tail: 'body.rear',
    footL: 'body.front',
    footR: 'body.front',
  },
  // AirborneDriver(!flapping): a hovering core with two side lobes and a head.
  float: {
    'body.core': 'root',
    'body.lobeL': 'body.core',
    'body.lobeR': 'body.core',
    head: 'body.core',
  },
};

/** `leg<i>.upper`, `leg<i>.lower`, `foot<i>` — the MultiLegDriver row pattern. */
const LEG_UPPER = /^leg(\d+)\.upper$/;
const LEG_LOWER = /^leg(\d+)\.lower$/;
const LEG_FOOT = /^foot(\d+)$/;

/**
 * Step a real driver to its rest state and record what buildBody() emits.
 *
 * t = 0, dt = 0, speed = 0 is the driver's own rest: BaseDriver.update leaves
 * gaitPhase at 0 (cadence × 0), strideHalf() returns 0, MultiLegDriver's bob is
 * sin(0), HopperDriver's idle squish is sin(0), and AirborneDriver's flap is
 * sin(0). Nothing here is a mirror of the driver's math — it IS the driver.
 */
export function speciesRestPose(gait: SpeciesGait, frame: Frame): SpeciesRestPose {
  const driver = createGaitDriver(gait, frame);
  driver.update(0, 0, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 0 });

  const segs: SpeciesRestSeg[] = [];
  const balls: SpeciesRestBall[] = [];
  const sink: SegmentSink = {
    seg: (id, ax, ay, az, bx, by, bz, r0, r1) => {
      segs.push({ id, a: [ax, ay, az], b: [bx, by, bz], r0, r1 });
    },
    ball: (id, x, y, z, r) => {
      balls.push({ id, center: [x, y, z], r });
    },
    // Species drivers emit no tubes, boxes, rings, collars or fins today. If one
    // ever starts, fail loudly here rather than silently dropping flesh from the
    // skinned body — the same rule the plan pose sink applies to unknown ids.
    tube: (id) => {
      throw new Error(`speciesSkeleton: gait "${gait}" emitted an unexpected tube "${id}" — extend the skeleton before shipping it`);
    },
    box: (id) => {
      throw new Error(`speciesSkeleton: gait "${gait}" emitted an unexpected box "${id}" — extend the skeleton before shipping it`);
    },
    ring: (id) => {
      throw new Error(`speciesSkeleton: gait "${gait}" emitted an unexpected ring "${id}" — extend the skeleton before shipping it`);
    },
    collar: (id) => {
      throw new Error(`speciesSkeleton: gait "${gait}" emitted an unexpected collar "${id}" — extend the skeleton before shipping it`);
    },
    fin: (id) => {
      throw new Error(`speciesSkeleton: gait "${gait}" emitted an unexpected fin "${id}" — extend the skeleton before shipping it`);
    },
  };
  driver.buildBody(sink);
  return { segs, balls };
}

export interface BuiltSpeciesSkeleton {
  gait: SpeciesGait;
  /** The root bone (entity-local origin, identity). Parent it to the SkinnedMesh. */
  root: Bone;
  /** All bones, parent-first (the pose sink resolves down this order). */
  bones: Bone[];
  /** Bone index by id (the id IS the driver emission id). */
  index: ReadonlyMap<string, number>;
  /** Bind pose (shared with the skinned species body builder). */
  restPose: SpeciesRestPose;
  /** Bind world transform per bone (entity-local). */
  bindWorldPos: Vector3[];
  bindWorldQuat: Quaternion[];
  /** Parent id per bone id (root has null). Exposed for tests/diagnostics. */
  parentId: ReadonlyMap<string, string | null>;
}

interface BoneSpec {
  id: string;
  parent: string | null;
  pos: Vector3;
  /** Bind orientation (+Y along the segment; identity for balls and root). */
  quat: Quaternion;
}

const UP = new Vector3(0, 1, 0);

/**
 * Parent of one emission id. Fixed rows come from SPECIES_TOPOLOGY; leg rows
 * are patterned, and a leg's spine attachment is read from the captured hip z
 * (the driver plants fore legs at z >= 0 and hind legs behind the mid-point),
 * so the hexapod's mid pair rides the front spine like its fore pair does.
 */
function parentOf(gait: SpeciesGait, id: string, hipZ: (leg: number) => number): string {
  const fixed = SPECIES_TOPOLOGY[gait][id];
  if (fixed) return fixed;
  let m = LEG_UPPER.exec(id);
  if (m) return hipZ(Number(m[1])) >= 0 ? 'spine.front' : 'spine.rear';
  m = LEG_LOWER.exec(id);
  if (m) return `leg${m[1]}.upper`;
  m = LEG_FOOT.exec(id);
  if (m) return `leg${m[1]}.lower`;
  throw new Error(`speciesSkeleton: gait "${gait}" emitted id "${id}" with no bone topology — add it to SPECIES_TOPOLOGY`);
}

function boneSpecs(gait: SpeciesGait, restPose: SpeciesRestPose): BoneSpec[] {
  // Hip z per leg row, straight off the captured upper-leg A joint.
  const hips = new Map<number, number>();
  for (const s of restPose.segs) {
    const m = LEG_UPPER.exec(s.id);
    if (m) hips.set(Number(m[1]), s.a[2]);
  }
  const hipZ = (leg: number): number => {
    const z = hips.get(leg);
    if (z === undefined) throw new Error(`speciesSkeleton: no rest hip for leg ${leg} on gait "${gait}"`);
    return z;
  };

  const specs: BoneSpec[] = [
    { id: 'root', parent: null, pos: new Vector3(0, 0, 0), quat: new Quaternion() },
  ];
  const seen = new Set<string>(['root']);
  const dir = new Vector3();

  // Emission order IS bone order after the root. Every species driver emits a
  // parent before its children (spine → neck → head, upper → lower → foot), so
  // this walk is already parent-first; the assert below proves it per gait.
  for (const s of restPose.segs) {
    if (seen.has(s.id)) throw new Error(`speciesSkeleton: duplicate rest segment id "${s.id}" on gait "${gait}"`);
    dir.set(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
    if (dir.lengthSq() < 1e-12) dir.copy(UP);
    specs.push({
      id: s.id,
      parent: parentOf(gait, s.id, hipZ),
      pos: new Vector3(s.a[0], s.a[1], s.a[2]),
      quat: new Quaternion().setFromUnitVectors(UP, dir.normalize()),
    });
    seen.add(s.id);
  }
  for (const b of restPose.balls) {
    if (seen.has(b.id)) throw new Error(`speciesSkeleton: duplicate rest ball id "${b.id}" on gait "${gait}"`);
    specs.push({
      id: b.id,
      parent: parentOf(gait, b.id, hipZ),
      pos: new Vector3(b.center[0], b.center[1], b.center[2]),
      quat: new Quaternion(),
    });
    seen.add(b.id);
  }

  // Parent-first is a hard requirement of the bind build and the pose resolve.
  const placed = new Set<string>();
  for (const s of specs) {
    if (s.parent !== null && !placed.has(s.parent)) {
      throw new Error(`speciesSkeleton: bone "${s.id}" on gait "${gait}" precedes its parent "${s.parent}"`);
    }
    placed.add(s.id);
  }
  return specs;
}

/** Frame + species gait in, bone hierarchy out — pure (no scene, no renderer). */
export function buildSpeciesSkeleton(gait: SpeciesGait, frame: Frame): BuiltSpeciesSkeleton {
  const restPose = speciesRestPose(gait, frame);
  const specs = boneSpecs(gait, restPose);

  const bones: Bone[] = [];
  const index = new Map<string, number>();
  const parentId = new Map<string, string | null>();
  const bindWorldPos: Vector3[] = [];
  const bindWorldQuat: Quaternion[] = [];
  const invQuat = new Quaternion();

  for (const [i, bs] of specs.entries()) {
    const bone = new Bone();
    bone.name = bs.id;
    bindWorldPos.push(bs.pos);
    bindWorldQuat.push(bs.quat);
    parentId.set(bs.id, bs.parent);

    if (bs.parent === null) {
      bone.position.copy(bs.pos);
      bone.quaternion.copy(bs.quat);
    } else {
      const p = index.get(bs.parent)!;
      // local = parentWorld⁻¹ ∘ world (rigid, so quaternion math is exact)
      invQuat.copy(bindWorldQuat[p]).invert();
      bone.position.copy(bs.pos).sub(bindWorldPos[p]).applyQuaternion(invQuat);
      bone.quaternion.copy(invQuat).multiply(bs.quat);
      bones[p].add(bone);
    }
    bones.push(bone);
    index.set(bs.id, i);
  }

  return { gait, root: bones[0], bones, index, restPose, bindWorldPos, bindWorldQuat, parentId };
}

export interface SpeciesPoseSink {
  /** Hand this to driver.buildBody() each frame instead of the segment renderer's sink. */
  sink: SegmentSink;
  /** Resolve the received world transforms into local bone transforms (parents first). */
  finishFrame(): void;
}

const DIR = new Vector3();

/**
 * The pose adapter: driver joint positions in, bone transforms out. seg(id, …)
 * puts the bone at the A joint with +Y along the segment — the identical rule
 * the segment renderer applies — and ball(id, …) sets position only. Species
 * drivers emit nothing decorative, so EVERY emission owns a bone and an
 * unknown id is a real defect: it throws.
 */
export function createSpeciesPoseSink(skeleton: BuiltSpeciesSkeleton): SpeciesPoseSink {
  const n = skeleton.bones.length;
  const worldPos: Vector3[] = Array.from({ length: n }, () => new Vector3());
  const worldQuat: Quaternion[] = Array.from({ length: n }, () => new Quaternion());
  const written: boolean[] = new Array(n).fill(false);
  written[0] = true; // root never receives emissions; stays at the entity origin

  const index = skeleton.index;
  const boneFor = (id: string): number => {
    const i = index.get(id);
    if (i === undefined) throw new Error(`species pose sink: no bone mapped for emission id "${id}"`);
    return i;
  };

  const sink: SegmentSink = {
    seg: (id, ax, ay, az, bx, by, bz) => {
      const i = boneFor(id);
      worldPos[i].set(ax, ay, az);
      DIR.set(bx - ax, by - ay, bz - az);
      if (DIR.lengthSq() < 1e-12) DIR.copy(UP);
      worldQuat[i].setFromUnitVectors(UP, DIR.normalize());
      written[i] = true;
    },
    ball: (id, x, y, z) => {
      const i = boneFor(id);
      worldPos[i].set(x, y, z);
      worldQuat[i].identity();
      written[i] = true;
    },
  };

  const INV = new Quaternion();
  function finishFrame(): void {
    for (let i = 1; i < n; i++) {
      if (!written[i]) continue;
      const parent = skeleton.bones[i].parent;
      if (!parent || !(parent as Bone).isBone) {
        skeleton.bones[i].position.copy(worldPos[i]);
        skeleton.bones[i].quaternion.copy(worldQuat[i]);
        continue;
      }
      const p = skeleton.index.get(parent.name)!;
      INV.copy(worldQuat[p]).invert();
      skeleton.bones[i].position.copy(worldPos[i]).sub(worldPos[p]).applyQuaternion(INV);
      skeleton.bones[i].quaternion.copy(INV).multiply(worldQuat[i]);
      written[i] = false;
    }
  }

  return { sink, finishFrame };
}
