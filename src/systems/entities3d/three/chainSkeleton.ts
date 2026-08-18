/**
 * @file chainSkeleton.ts — skeleton pivot slice 6: real THREE.Bone chains for
 * the animated chain parts (tails, tentacles, antennae, fin ridges).
 *
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md
 *
 * Slices 1/4/5 gave every GAIT a bone hierarchy, but chain parts stayed on the
 * segment renderer — the one path that still drew flesh with no bones in
 * skinned mode. This file follows the speciesSkeleton.ts precedent exactly, in
 * the same three parts:
 *
 *   1. chainRestPose(chains, frame, anchors) — pure data: each chain part's
 *      OWN build() output at the rest phase (t = 0, gaitPhase = 0, flap = 0),
 *      against the driver's rest anchors. Every wag/wave/twitch term in
 *      chainParts.ts is sin(t·k), so t = 0 IS the rest of those functions —
 *      nothing here re-derives chain math.
 *
 *   2. buildChainSkeleton(restPose) — the Bone hierarchy in bind pose. Bone
 *      names ARE the runtime emission ids (`tailThick:tailThick.0`,
 *      `tentacles:tentacle3.1`, …the `partId:segId` form assembleEntity
 *      already emits), so the pose sink can never miss a lookup. Within one
 *      id prefix, link i parents to link i−1; the first link parents to the
 *      root (chain builders emit entity-local absolutes each frame, so the
 *      resolve needs no anchor bone).
 *
 *   3. createChainPoseSink(skeleton) — a SegmentSink the assembler feeds the
 *      per-frame chain builds in skinned mode; seg(id, …) places the owning
 *      bone at the A joint with +Y along the segment (the segment renderer's
 *      exact rule) and finishFrame() resolves locals parent-first. Unknown
 *      ids throw — never a silent drop.
 *
 * Chain radii are frame-constant by contract (chainParts.ts header); only the
 * endpoints move. Link LENGTH breathes a few percent with the wag, which rigid
 * pieces cannot follow — the joint spheres in the bind geometry cover those
 * seams, the same accepted trick as slice 1.
 */
import { Bone, Quaternion, Vector3 } from 'three';
import type { BodySegment, Frame, PartAnchors, PartPhase, SegmentSink } from '../types';

/** One chain part instance, as the assembler collects them. */
export interface ChainPartInput {
  partId: string;
  build: (
    frame: Frame,
    params: Record<string, number | string>,
    phase: PartPhase,
    anchors: PartAnchors,
  ) => BodySegment[];
  params: Record<string, number | string>;
}

/** One rigid rest link (meters, entity-local). Id is the full runtime form. */
export interface ChainRestSeg {
  id: string;
  a: [number, number, number];
  b: [number, number, number];
  r0: number;
  r1: number;
}

export interface ChainRestPose {
  segs: ChainRestSeg[];
}

/** The rest phase: every animated term in a chain build is sin(t·k) or rides
 * gaitPhase/flap, so zeros ARE the chain's own rest. */
const REST_PHASE: PartPhase = { t: 0, gaitPhase: 0, flap: 0 };

/**
 * Capture every chain part's rest emissions against the driver's rest anchors.
 * Ids are prefixed `partId:segId` — the exact ids assembleEntity emits at
 * runtime, so bind and runtime can never diverge on a name.
 */
export function chainRestPose(chains: ChainPartInput[], frame: Frame, anchors: PartAnchors): ChainRestPose {
  const segs: ChainRestSeg[] = [];
  for (const chain of chains) {
    for (const s of chain.build(frame, chain.params, REST_PHASE, anchors)) {
      segs.push({ id: `${chain.partId}:${s.id}`, a: [s.ax, s.ay, s.az], b: [s.bx, s.by, s.bz], r0: s.r0, r1: s.r1 });
    }
  }
  return { segs };
}

export interface BuiltChainSkeleton {
  /** The root bone (entity-local origin, identity). Parent it to the SkinnedMesh. */
  root: Bone;
  /** All bones, parent-first (the pose sink resolves down this order). */
  bones: Bone[];
  /** Bone index by id (the id IS the runtime emission id). */
  index: ReadonlyMap<string, number>;
  /** Bind pose (shared with the skinned chain body builder). */
  restPose: ChainRestPose;
  /** Bind world transform per bone (entity-local). */
  bindWorldPos: Vector3[];
  bindWorldQuat: Quaternion[];
  /** Parent id per bone id (root has null). Exposed for tests/diagnostics. */
  parentId: ReadonlyMap<string, string | null>;
}

const UP = new Vector3(0, 1, 0);
/** `<prefix>.<index>` — the taperedChain link form every chain part emits. */
const LINK = /^(.*)\.(\d+)$/;

/**
 * Parent of one link id: the previous link of the same prefix when it exists,
 * else the root (link 0 of each chain). Fin-ridge blades share a prefix and
 * therefore chain to their neighbor even though they are separate spikes —
 * harmless, because the per-frame world write fully determines every bone's
 * world transform whatever its parent is; the parent only shapes the helper's
 * line drawing and the bind locals.
 */
function parentOf(id: string, seen: ReadonlySet<string>): string {
  const m = LINK.exec(id);
  if (m) {
    const prev = `${m[1]}.${Number(m[2]) - 1}`;
    if (seen.has(prev)) return prev;
  }
  return 'root';
}

/** Rest pose in, bone hierarchy out — pure (no scene, no renderer). */
export function buildChainSkeleton(restPose: ChainRestPose): BuiltChainSkeleton {
  const bones: Bone[] = [];
  const index = new Map<string, number>();
  const parentId = new Map<string, string | null>();
  const bindWorldPos: Vector3[] = [];
  const bindWorldQuat: Quaternion[] = [];
  const invQuat = new Quaternion();
  const dir = new Vector3();

  const root = new Bone();
  root.name = 'root';
  bones.push(root);
  index.set('root', 0);
  parentId.set('root', null);
  bindWorldPos.push(new Vector3());
  bindWorldQuat.push(new Quaternion());

  const seen = new Set<string>();
  for (const s of restPose.segs) {
    if (index.has(s.id)) throw new Error(`chainSkeleton: duplicate rest link id "${s.id}"`);
    const parent = parentOf(s.id, seen);
    const p = index.get(parent);
    // taperedChain emits links in order, so a link's predecessor is always
    // captured before it — parent-first holds by construction; assert anyway.
    if (p === undefined) throw new Error(`chainSkeleton: link "${s.id}" precedes its parent "${parent}"`);

    const pos = new Vector3(s.a[0], s.a[1], s.a[2]);
    dir.set(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
    if (dir.lengthSq() < 1e-12) dir.copy(UP);
    const quat = new Quaternion().setFromUnitVectors(UP, dir.normalize());

    const bone = new Bone();
    bone.name = s.id;
    // local = parentWorld⁻¹ ∘ world (rigid, so quaternion math is exact)
    invQuat.copy(bindWorldQuat[p]).invert();
    bone.position.copy(pos).sub(bindWorldPos[p]).applyQuaternion(invQuat);
    bone.quaternion.copy(invQuat).multiply(quat);
    bones[p].add(bone);

    index.set(s.id, bones.length);
    parentId.set(s.id, parent);
    bindWorldPos.push(pos);
    bindWorldQuat.push(quat);
    bones.push(bone);
    seen.add(s.id);
  }

  return { root, bones, index, restPose, bindWorldPos, bindWorldQuat, parentId };
}

export interface ChainPoseSink {
  /** Feed the per-frame chain builds here in skinned mode (seg calls only). */
  sink: SegmentSink;
  /** Resolve the received world transforms into local bone transforms (parents first). */
  finishFrame(): void;
}

const DIR = new Vector3();

/**
 * The pose adapter: chain link endpoints in, bone transforms out. seg(id, …)
 * puts the bone at the A joint with +Y along the segment — the identical rule
 * the segment renderer applies. Chains emit segments only, and every emission
 * owns a bone, so an unknown id is a real defect: it throws.
 */
export function createChainPoseSink(skeleton: BuiltChainSkeleton): ChainPoseSink {
  const n = skeleton.bones.length;
  const worldPos: Vector3[] = Array.from({ length: n }, () => new Vector3());
  const worldQuat: Quaternion[] = Array.from({ length: n }, () => new Quaternion());
  const written: boolean[] = new Array(n).fill(false);
  written[0] = true; // root never receives emissions; stays at the entity origin

  const index = skeleton.index;
  const boneFor = (id: string): number => {
    const i = index.get(id);
    if (i === undefined) throw new Error(`chain pose sink: no bone mapped for emission id "${id}"`);
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
    ball: (id) => {
      throw new Error(`chain pose sink: chain parts emit segments only — unexpected ball "${id}"`);
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
