// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/08/2026 (manual — sync tool timed out in this session)
 * Dependents: systems/entities3d/three/skinnedBody.ts
 * Imports: 2 files (../types, ./gaits)
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file planSkeleton.ts — skeleton pivot slice 4: a real THREE.Bone hierarchy
 * for every plan-driven creature (gait 'plan', compiled text-to-creature
 * PlanSpecs from Describe/Library/EntityForge).
 *
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md (slice 4)
 * Plan: docs/superpowers/plans/2026-07-24-skeleton-creature-skeletons.md
 *
 * This mirrors skeletonBuilder.ts's three-part shape (slice 1) for PlanSpecs:
 *
 *   1. planRestPose(frame, spec)   — pure data: the driver's rest emissions,
 *      captured by stepping a REAL PlanDriver with dt = 0 and recording what
 *      its buildBody() emits. Same parity trick skeletonBuilder.test.ts pins
 *      for bipeds — the bind pose can never drift from the driver because it
 *      IS the driver's own rest output. Never re-derived.
 *
 *   2. buildPlanSkeleton(frame, spec) — Bone hierarchy in bind pose: one bone
 *      per spine segment (`spine.N`), one bone per chain link (`<chainId>.N`),
 *      terminal ball bones (`head<i>` / `<chainId>.foot` / `<chainId>.palm`).
 *
 *   3. createPlanPoseSink(skeleton) — a SegmentSink the assembler hands to
 *      driver.buildBody() in skinned mode; converts emitted joint positions to
 *      bone world transforms, then resolves locals parent-first.
 *
 * Bone ids REUSE the driver's own emission ids, so the pose sink can never
 * drift from the driver. The sink implements seg/ball/tube (+ box); in smooth
 * tube mode the driver's tube(id, flat, radii) polyline IS the joint list in
 * order, so it decomposes into the same per-link bone transforms the seg path
 * receives. Unknown emission ids throw (fail loud, never silent drops).
 *
 * Decorative emissions (junction collars, energy rings, snouts, cilia lashes,
 * toes, fingers, auto S-necks) stay on the anchor path — the skeleton sink
 * ignores them rather than skinning them (Remy-approved design, 2026-07-24).
 * What is preserved: PlanDriver, TreadmillLeg, chain math, and the segment
 * renderer are all untouched; bodyTech 'segments' remains the default.
 * Deferred: creature SMOOTH joint weights, species gaits (quad/hexapod/etc.).
 */
import { Bone, Quaternion, Vector3 } from 'three';
import type { Frame, PlanSpec, SegmentSink } from '../types';
import { createGaitDriver, type PlanHeadSocket } from './gaits';

/** One rigid rest bone: a tapered segment between two joints (meters, entity-local). */
interface RestRel {
  id: string;
  a: [number, number, number];
  b: [number, number, number];
  r0: number;
  r1: number;
}

/** One round rest ball (head / foot / palm terminal). */
interface RestBall {
  id: string;
  center: [number, number, number];
  r: number;
}

/** A head socket the driver holds live (used when a formed head emits no ball). */
interface RestSocket {
  x: number;
  y: number;
  z: number;
}

/** A box-spine link (Gelatinous Cube): slab from a→b (its depth axis), w×h section. */
interface RestBox {
  id: string;
  a: [number, number, number];
  b: [number, number, number];
  w: number;
  h: number;
}

/** The driver's rest emissions, decomposed to the rigid seg path. */
export interface PlanRestPose {
  /** Spine + chain link segments (one per deformable link). */
  rels: RestRel[];
  /** Terminal balls (head<i>, <chainId>.foot, <chainId>.palm). */
  balls: RestBall[];
  /** Box-spine links (one per spine segment on a box body). */
  boxes: RestBox[];
  /** Live head socket positions (index = head i) for formed heads. */
  sockets: RestSocket[];
}


/** Ids of the deformable body that get bones (mirrors the driver's emissions). */
export const PLAN_BONE_KIND = ['root', 'spine', 'chain', 'terminal'] as const;
export type PlanBoneKind = (typeof PLAN_BONE_KIND)[number];

export interface BuiltPlanSkeleton {
  /** The root bone (entity-local origin, identity). Parent it to the SkinnedMesh. */
  root: Bone;
  /** All bones, parent-first (the pose sink resolves down this order). */
  bones: Bone[];
  /** Bone index by id. */
  index: ReadonlyMap<string, number>;
  /** Bind pose (shared with the skinned plan body builder). */
  restPose: PlanRestPose;
  /** Bind world transform per bone (entity-local), kept for the pose sink. */
  bindWorldPos: Vector3[];
  bindWorldQuat: Quaternion[];
  /** Parent id per bone id (root has null). Exposed for tests/diagnostics. */
  parentId: ReadonlyMap<string, string | null>;
}

/** One bone description used to assemble the hierarchy. */
interface BoneSpec {
  id: string;
  kind: PlanBoneKind;
  parent: string | null;
  /** Bind world position. */
  pos: Vector3;
  /** Bind world orientation (Y along the segment; identity for terminals/root). */
  quat: Quaternion;
}

function spineIndexForAttach(attach: number, spineCount: number): number {
  if (spineCount <= 0) return 0;
  return Math.max(0, Math.min(spineCount - 1, Math.round(attach * (spineCount - 1))));
}

/** Record the driver's buildBody() at rest, decomposing tube/box onto the seg path. */
function capturePlanRest(frame: Frame, spec: PlanSpec): PlanRestPose {
  const driver = createGaitDriver('plan', frame, spec);
  driver.update(0, 0, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 0 });

  const rels: RestRel[] = [];
  const balls: RestBall[] = [];
  const boxes: RestBox[] = [];

  const chainIds = spec.chains.map((c) => c.id);

  /** True for a BODY seg/ball id (spine/chain link/terminal) — decorations excluded. */
  const isBodySeg = (id: string): boolean => {
    if (/^spine\.\d+$/.test(id)) return true;
    for (const cid of chainIds) {
      if (id.startsWith(cid + '.') && /^\d+$/.test(id.slice(cid.length + 1))) return true;
    }
    return false;
  };
  const isBodyBall = (id: string): boolean => {
    if (/^head\d+$/.test(id)) return true;
    for (const cid of chainIds) {
      if (id === `${cid}.foot` || id === `${cid}.palm`) return true;
    }
    return false;
  };

  const pushSeg = (
    id: string,
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    r0: number, r1: number,
  ): void => {
    if (!isBodySeg(id)) return; // decorations stay on the anchor path
    rels.push({ id, a: [ax, ay, az], b: [bx, by, bz], r0, r1 });
  };

  const sink: SegmentSink = {
    seg: (id, ax, ay, az, bx, by, bz, r0, r1) => pushSeg(id, ax, ay, az, bx, by, bz, r0, r1),
    ball: (id, x, y, z, r) => {
      if (isBodyBall(id)) balls.push({ id, center: [x, y, z], r });
    },
    // tube decomposes to the per-link seg path — the same transforms the rigid
    // path emits, which is exactly what task 1 (c) requires to be identical.
    tube: (id, flat, radii) => {
      const k = radii.length - 1;
      if (k < 0) return;
      for (let i = 0; i < k; i++) {
        pushSeg(
          `${id}.${i}`,
          flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2],
          flat[(i + 1) * 3], flat[(i + 1) * 3 + 1], flat[(i + 1) * 3 + 2],
          radii[i], radii[i + 1],
        );
      }
    },
    box: (id, ax, ay, az, bx, by, bz, w, h) => {
      // Box spine links are also recorded as rigid rels so `spine.N` bones
      // exist for every fixture (task 1); the real w×h is kept for geometry.
      pushSeg(id, ax, ay, az, bx, by, bz, 1, 1);
      boxes.push({ id, a: [ax, ay, az], b: [bx, by, bz], w, h });
    },
    // decorative — not part of the deformable body; anchor path owns them
    ring: () => {},
    collar: () => {},
  };

  driver.buildBody(sink);
  return { rels, balls, boxes, sockets: driver.headSockets?.().map((s) => ({ x: s.x, y: s.y, z: s.z })) ?? [] };
}

/** Classify the captured pieces and lay out the bone hierarchy. */
function buildBoneSpecs(frame: Frame, spec: PlanSpec): {
  specs: BoneSpec[];
  restPose: PlanRestPose;
} {
  const restPose = capturePlanRest(frame, spec);
  const spine = spec.spine.segments;
  const UP = new Vector3(0, 1, 0);

  const boneSpecs: BoneSpec[] = [];

  // root first, always.
  const rootQuat = new Quaternion();
  boneSpecs.push({ id: 'root', kind: 'root', parent: null, pos: new Vector3(0, 0, 0), quat: rootQuat });

  const relById = new Map(restPose.rels.map((r) => [r.id, r]));

  // --- spine bones: spine.0 .. spine.n-1 ---
  for (let i = 0; i < spine; i++) {
    const id = `spine.${i}`;
    const rel = relById.get(id);
    if (!rel) throw new Error(`planSkeleton: driver emitted no rest segment for spine bone "${id}"`);
    const dir = new Vector3(rel.b[0] - rel.a[0], rel.b[1] - rel.a[1], rel.b[2] - rel.a[2]);
    if (dir.lengthSq() < 1e-12) dir.copy(UP);
    const quat = new Quaternion().setFromUnitVectors(UP, dir.normalize());
    const parent = i === 0 ? 'root' : `spine.${i - 1}`;
    boneSpecs.push({ id, kind: 'spine', parent, pos: new Vector3(rel.a[0], rel.a[1], rel.a[2]), quat });
  }

  // --- chain bones, parent-before-child (tauric parentId chains come first) ---
  const orderedChains = topoSortChains(spec);

  for (const chain of orderedChains) {
    const L = chain.linksCount;
    // chain root parent: tauric parent chain's tip bone, else nearest spine bone
    let rootParent: string;
    if (chain.parentId) {
      const pL = spec.chains.find((c) => c.id === chain.parentId)?.links.length ?? 1;
      rootParent = `${chain.parentId}.${pL - 1}`;
    } else {
      rootParent = `spine.${spineIndexForAttach(chain.attach, spine)}`;
    }
    for (let j = 0; j < L; j++) {
      const id = `${chain.id}.${j}`;
      const rel = relById.get(id);
      if (!rel) throw new Error(`planSkeleton: driver emitted no rest segment for chain bone "${id}"`);
      const dir = new Vector3(rel.b[0] - rel.a[0], rel.b[1] - rel.a[1], rel.b[2] - rel.a[2]);
      if (dir.lengthSq() < 1e-12) dir.copy(UP);
      const quat = new Quaternion().setFromUnitVectors(UP, dir.normalize());
      const parent = j === 0 ? rootParent : `${chain.id}.${j - 1}`;
      boneSpecs.push({ id, kind: 'chain', parent, pos: new Vector3(rel.a[0], rel.a[1], rel.a[2]), quat });
    }
  }

  // --- terminal bones: heads, feet, palms ---
  const ballById = new Map(restPose.balls.map((b) => [b.id, b]));

  const chainTipParent = (chainId: string): string => {
    const L = spec.chains.find((c) => c.id === chainId)?.links.length ?? 1;
    return `${chainId}.${L - 1}`;
  };
  /** Place a terminal bone at an explicit world position (formed heads have no ball). */
  const pushTerminalAt = (id: string, parent: string, x: number, y: number, z: number): void => {
    boneSpecs.push({
      id,
      kind: 'terminal',
      parent,
      pos: new Vector3(x, y, z),
      quat: new Quaternion(),
    });
  };
  const pushTerminal = (id: string, parent: string): void => {
    const ball = ballById.get(id);
    if (!ball) throw new Error(`planSkeleton: driver emitted no rest ball for terminal "${id}"`);
    pushTerminalAt(id, parent, ball.center[0], ball.center[1], ball.center[2]);
  };

  // heads ride their neck-tip bone (or spine-front for neckless). A formed head
  // emits no ball — the assembler owns its sculpted mesh — so its head bone
  // borrows the driver's live socket for the bind pose (Task 3 parents it).
  spec.heads.forEach((h, hi) => {
    const parent = h.chainId ? chainTipParent(h.chainId) : 'spine.0';
    const ball = ballById.get(`head${hi}`);
    if (ball) {
      pushTerminalAt(`head${hi}`, parent, ball.center[0], ball.center[1], ball.center[2]);
    } else {
      const sock = restPose.sockets[hi];
      if (!sock) throw new Error(`planSkeleton: no rest position for head bone "head${hi}"`);
      pushTerminalAt(`head${hi}`, parent, sock.x, sock.y, sock.z);
    }
  });

  // feet on every leg chain tip.
  for (const chain of spec.chains) {
    if (chain.kind === 'leg') pushTerminal(`${chain.id}.foot`, chainTipParent(chain.id));
  }
  // palms on every hand-tipped chain tip.
  for (const chain of spec.chains) {
    if (chain.tips === 'hand') pushTerminal(`${chain.id}.palm`, chainTipParent(chain.id));
  }

  return { specs: boneSpecs, restPose };
}

/** Put tauric parentId chains after their parent chain (parent before child). */
function topoSortChains(
  spec: PlanSpec,
): Array<{ id: string; parentId?: string; attach: number; linksCount: number }> {
  const chains = spec.chains.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    attach: c.attach,
    linksCount: c.links.length,
  }));
  const byId = new Map(chains.map((c) => [c.id, c]));
  const order: typeof chains = [];
  const seen = new Set<string>();
  const temp = new Set<string>();
  const visit = (c: (typeof chains)[number]): void => {
    if (seen.has(c.id)) return;
    if (temp.has(c.id)) throw new Error(`planSkeleton: tauric parent cycle involving chain "${c.id}"`);
    temp.add(c.id);
    if (c.parentId) {
      const p = byId.get(c.parentId);
      if (p) visit(p);
    }
    temp.delete(c.id);
    seen.add(c.id);
    order.push(c);
  };
  for (const c of chains) visit(c);
  return order;
}

export interface BuiltPlanSkeletonWithSpec extends BuiltPlanSkeleton {
  spec: PlanSpec;
}

/** Frame + compiled plan in, bone hierarchy out — pure (no scene, no renderer). */
export function buildPlanSkeleton(frame: Frame, spec: PlanSpec): BuiltPlanSkeletonWithSpec {
  const { specs, restPose } = buildBoneSpecs(frame, spec);
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

  return { root: bones[0], bones, index, restPose, bindWorldPos, bindWorldQuat, parentId, spec };
}

export interface PlanPoseSink {
  /** Hand this to driver.buildBody() each frame instead of the segment renderer's sink. */
  sink: SegmentSink;
  /**
   * Task 3: pose formed-head bones from the driver's live head sockets.
   * Formed heads emit no ball (the assembler owns their sculpted mesh), so
   * their `head<i>` bone never receives an emission — call this with
   * `driver.headSockets()` AFTER buildBody and BEFORE finishFrame, each frame,
   * or those bones freeze at the bind pose. Ball-headed bones are untouched
   * here (their ball emissions already write them).
   */
  writeHeadSockets(sockets: PlanHeadSocket[]): void;
  /** Resolve the received world transforms into local bone transforms (parents first). */
  finishFrame(): void;
}

const UP = new Vector3(0, 1, 0);
const FWD = new Vector3(0, 0, 1);
const DIR = new Vector3();

/**
 * The pose adapter: driver joint positions in, bone transforms out. Each
 * body seg(id, …) sets the owning bone's world position to the A joint and its
 * world orientation to +Y-along-the-segment — the identical rule the segment
 * renderer applies — and each body ball(id, …) sets position only. tube() and
 * box() decompose onto the same per-link bones. Decorative ids (snouts,
 * cilia, toes, fingers, auto S-necks) are ignored by design. Unknown body ids
 * throw: if the driver ever emits something new, this fails loudly instead of
 * silently dropping flesh.
 */
export function createPlanPoseSink(skeleton: BuiltPlanSkeleton, decorativeDelegate?: SegmentSink): PlanPoseSink {
  const n = skeleton.bones.length;
  const worldPos: Vector3[] = Array.from({ length: n }, () => new Vector3());
  const worldQuat: Quaternion[] = Array.from({ length: n }, () => new Quaternion());
  const written: boolean[] = new Array(n).fill(false);
  written[0] = true; // root never receives emissions; stays at the entity origin

  const index = skeleton.index;
  const spec = (skeleton as BuiltPlanSkeletonWithSpec).spec;
  const chainIds = new Set(spec.chains.map((c) => c.id));
  const headCount = spec.heads.length;

  // Formed heads (sculpted skulls from headForms.ts) emit no ball, so no
  // seg/ball/box/tube emission ever names their head<i> bone. The assembler
  // feeds the driver's live sockets through writeHeadSockets instead (Task 3).
  const formedHeads: Array<{ head: number; bone: number }> = [];
  spec.heads.forEach((h, hi) => {
    if (!h.form) return;
    const bone = index.get(`head${hi}`);
    if (bone === undefined) throw new Error(`plan pose sink: no bone mapped for formed head "head${hi}"`);
    formedHeads.push({ head: hi, bone });
  });

  /** True when a seg/ball id is a known decorative emission (no bone). */
  const isDecorative = (id: string): boolean => {
    if (headCount && /^head\d+\.(snout|cilia\d+|neckS[01])$/.test(id)) return true;
    for (const cid of chainIds) {
      const pref = cid + '.';
      if (id.startsWith(pref)) {
        const rest = id.slice(pref.length);
        // fingers (hand tips) and toes (leg claws) are decorative pieces
        if (rest.startsWith('finger') || rest.startsWith('toe')) return true;
      }
    }
    return false;
  };

  /** Write a body joint into its bone's world slot (position + Y-along-segment). */
  const writeSeg = (id: string, ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => {
    const i = index.get(id);
    if (i === undefined) throw new Error(`plan pose sink: no bone mapped for emission id "${id}"`);
    worldPos[i].set(ax, ay, az);
    DIR.set(bx - ax, by - ay, bz - az);
    if (DIR.lengthSq() < 1e-12) DIR.copy(UP);
    worldQuat[i].setFromUnitVectors(UP, DIR.normalize());
    written[i] = true;
  };

  const sink: SegmentSink = {
    seg: (id, ax, ay, az, bx, by, bz, r0, r1) => {
      const i = index.get(id);
      if (i === undefined) {
        // Decorative seg (snout, cilia, S-neck, fingers, toes): keep today's
        // look via the delegate (the segment renderer on the anchor path).
        if (isDecorative(id)) {
          if (decorativeDelegate?.seg) decorativeDelegate.seg(id, ax, ay, az, bx, by, bz, r0, r1);
          return;
        }
        throw new Error(`plan pose sink: no bone mapped for emission id "${id}"`);
      }
      worldPos[i].set(ax, ay, az);
      DIR.set(bx - ax, by - ay, bz - az);
      if (DIR.lengthSq() < 1e-12) DIR.copy(UP);
      worldQuat[i].setFromUnitVectors(UP, DIR.normalize());
      written[i] = true;
    },
    ball: (id, x, y, z, r) => {
      const i = index.get(id);
      if (i === undefined) {
        if (isDecorative(id)) {
          if (decorativeDelegate?.ball) decorativeDelegate.ball(id, x, y, z, r);
          return;
        }
        throw new Error(`plan pose sink: no bone mapped for emission id "${id}"`);
      }
      worldPos[i].set(x, y, z);
      worldQuat[i].identity();
      written[i] = true;
    },
    // smooth spine/organic-chain tubes decompose onto the same per-link bones.
    tube: (id, flat, radii) => {
      const k = radii.length - 1;
      for (let i = 0; i < k; i++) {
        writeSeg(
          `${id}.${i}`,
          flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2],
          flat[(i + 1) * 3], flat[(i + 1) * 3 + 1], flat[(i + 1) * 3 + 2],
        );
      }
    },
    // box spine: box(id, a, b, w, h) → bone at A oriented along the slab.
    box: (id, ax, ay, az, bx, by, bz) => writeSeg(id, ax, ay, az, bx, by, bz),
    // decorative — anchor path owns them, never the skeleton.
    ring: (id, x, y, z, nx, ny, nz, radius, tube) => {
      decorativeDelegate?.ring?.(id, x, y, z, nx, ny, nz, radius, tube);
    },
    collar: (id, rootX, rootY, rootZ, ax, ay, az, limbR, reach) => {
      decorativeDelegate?.collar?.(id, rootX, rootY, rootZ, ax, ay, az, limbR, reach);
    },
  };

  /**
   * Write formed-head bones from live sockets: position at the socket center,
   * orientation facing the socket's look direction — the exact placement the
   * assembler used to apply to the head mesh directly, now carried by the
   * bone so the mesh can ride the skeleton (Task 3).
   */
  function writeHeadSockets(sockets: PlanHeadSocket[]): void {
    for (const { head, bone } of formedHeads) {
      const s = sockets[head];
      if (!s) continue; // no socket this frame: hold the last pose
      worldPos[bone].set(s.x, s.y, s.z);
      DIR.set(s.fx, s.fy, s.fz);
      if (DIR.lengthSq() < 1e-12) DIR.copy(FWD);
      worldQuat[bone].setFromUnitVectors(FWD, DIR.normalize());
      written[bone] = true;
    }
  }

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
      const INV = new Quaternion().copy(worldQuat[p]).invert();
      skeleton.bones[i].position.copy(worldPos[i]).sub(worldPos[p]).applyQuaternion(INV);
      skeleton.bones[i].quaternion.copy(INV).multiply(worldQuat[i]);
      written[i] = false;
    }
  }

  return { sink, writeHeadSockets, finishFrame };
}



