// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/07/2026, 00:51:43
 * Dependents: systems/entities3d/three/assembleEntity.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file skinnedBody.ts — slice 1 of the entity skeleton pivot: the rigid-weight
 * skinned biped body. One bind-pose BufferGeometry (the same tapered cylinders
 * and joint spheres the segment renderer builds, at the same radii and
 * tessellation), each vertex owned 100% by one bone, drawn as one fill
 * SkinnedMesh plus one inverse-hull ink shell SkinnedMesh — 2 draw calls where
 * the segment body needs ~60.
 *
 * Spec: docs/superpowers/specs/2026-07-17-entity-skeleton-pivot-design.md
 * Plan: docs/superpowers/plans/2026-07-18-entity-skeleton-pivot-slice1.md
 *
 * What changed: new file — the first SkinnedMesh in the codebase. Why: rigid
 * weights reproduce the segment look exactly, de-risking the skeleton chain
 * before smooth weights (slice 3) change the look. What is preserved: the
 * segment renderer (segmentBody.ts) is untouched and remains the default via
 * bodyTech: 'segments'; eyes, shadow, and parts keep the anchor pathway.
 * Shipped since: smooth biped weights (slice 3, smoothBipedGeometry.ts),
 * creature and species skeletons (slices 4-5, planSkeleton.ts /
 * speciesSkeleton.ts), and — agora-bc64 — smooth two-bone joint weights on
 * the creature and species bodies (see JointBlend below).
 * Decided (Remy 2026-07-21): deforming bodies are SOLID SHADED — there is no
 * skinned wireframe path and none is planned; wireframe remains a
 * segment-body debug look until the segment renderer dies.
 *
 * Known micro-divergence, accepted for slice 1: the segment renderer inflates
 * a unit cylinder and then scales it to length, which squashes the ink shell's
 * lengthwise inflation; this geometry is built at real length, so its shell
 * inflates uniformly. Difference is a fraction of the outline thickness and
 * only on tapered slopes — the A/B eyeball gate judges it.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Matrix4,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  Uint16BufferAttribute,
  Vector3,
  type Bone,
} from 'three';
import type { Frame, SegmentSink } from '../types';
import { FT_TO_M, heightM } from '../types';
import type { PlanHeadSocket } from './gaits';
import { BIPED_BONE_NAMES, bipedRestPose, buildBipedSkeleton, createBipedPoseSink, limbFrames, type BipedBoneName, type BuiltSkeleton } from './skeletonBuilder';
import { buildPlanSkeleton, createPlanPoseSink } from './planSkeleton';
import {
  buildSpeciesSkeleton,
  createSpeciesPoseSink,
  type SpeciesGait,
  type SpeciesRestPose,
} from './speciesSkeleton';
import {
  buildChainSkeleton,
  chainRestPose,
  createChainPoseSink,
  type ChainPartInput,
} from './chainSkeleton';
import type { PartAnchors } from '../types';
import { buildSmoothBipedGeometry } from './smoothBipedGeometry';
import type { PartChoice } from './partVariants';
import { outlineMaterial, toonMaterial } from './toon';

export interface SkinnedBodyOptions {
  colorHex: string;
  /** Inverse-hull outline thickness, meters (same value the segment body uses). */
  outlineThickness: number;
  /** Body translucency (< 1 = ghosts). Mirrors segmentBody's solid-mode handling. */
  opacity?: number;
  /** 'rigid' (default) = slice-1 segment-look pieces; 'smooth' = joint-blended
   * weights. On the BIPED that means slice-3's one-piece chain tubes
   * (smoothBipedGeometry). On creature and species bodies (agora-bc64) it
   * keeps the segment-look pieces and blends each link across its root joint
   * with the parent bone, so the bind pose is unchanged and only the bend is. */
  weights?: 'rigid' | 'smooth';
  /** Part Lab slot variants — the smooth biped only; rigid + parts throws. */
  parts?: PartChoice;
}

export interface SkinnedBody {
  /** Add this under the entity's bodyRoot (holds fill mesh, ink shell, bones). */
  readonly root: Group;
  /** The fill SkinnedMesh — the object carrying `.skeleton`. An AnimationMixer
   * that plays retargeted clips (`.bones[name].quaternion` tracks) MUST bind to
   * this, not the wrapping group, or PropertyBinding can't resolve the bones. */
  readonly skinnedMesh: SkinnedMesh;
  /** Hand this to driver.buildBody() each frame (the pose adapter). */
  readonly sink: SegmentSink;
  /**
   * Plan bodies only (Task 3): pose the formed-head bones from the driver's
   * live head sockets. Formed heads emit no ball, so the pose sink never
   * writes their `head<i>` bones — call this after buildBody and before
   * finishFrame each frame. Absent on biped bodies (no formed heads).
   */
  readonly poseHeadSockets?: (sockets: PlanHeadSocket[]) => void;
  /**
   * Look up a bone by its driver emission id (e.g. 'head0'). Task 3 uses this
   * to parent formed-head meshes to their head bone in skinned mode.
   */
  boneNamed(id: string): Bone | undefined;
  /** Resolve this frame's emissions into bone transforms — call after buildBody. */
  finishFrame(): void;
  /** Foreign rigs only: pose from a reference biped's world frames (a mocap
   * clip played on our own skeleton). See BipedPoseSink.applyWorldPose. */
  applyWorldPose?(worldQuats: readonly Quaternion[], pelvisWorldPos: Vector3): void;
  /** Fill + shell triangles (2 draw calls total). */
  triangles(): number;
  dispose(): void;
}

const UP = new Vector3(0, 1, 0);
const IDENTITY = new Matrix4();

/** Bone lookup by driver emission id, shared by both skinned body factories. */
function boneLookup(index: ReadonlyMap<string, number>, bones: Bone[]): (id: string) => Bone | undefined {
  return (id) => {
    const i = index.get(id);
    return i === undefined ? undefined : bones[i];
  };
}

/** One geometry piece bound rigidly to one bone. */
interface Piece {
  geometry: CylinderGeometry | SphereGeometry | BoxGeometry;
  bone: number;
  /**
   * GG-152 (agora-2976): countershade participation. Set on the pieces that
   * the segment renderer draws through a countershaded swept tube (spine/chain
   * links and their joint spheres); left undefined on pieces the segment path
   * draws with the flat body fill (terminal balls, box slabs), so both paths
   * tint the same surfaces. `axisY` is |tangent.y| of the owning link — the
   * sweptTube "vertical run keeps its dorsal tone" rule.
   */
  shade?: { axisY: number };
  /**
   * agora-bc64: SMOOTH weights only. When set, this piece's vertices are
   * shared between `bone` and the bone's parent across the joint at the
   * link's root, instead of following `bone` rigidly. Left undefined on
   * every rigid-weight build, so the rigid path is bit-identical.
   */
  parentBlend?: JointBlend;
}

/**
 * agora-bc64 — a two-bone vertex weight ramp across ONE joint.
 *
 * `origin` is the joint itself (a link's `a` end, which is also the owning
 * bone's bind position), `axis` is the unit link direction pointing AWAY
 * from that joint, and `span` is the ramp half-width in meters. A vertex
 * sitting exactly on the joint plane splits 50/50 between the link's own bone
 * and its parent — the classic blend that stops a rigid seam from pinching
 * shut on the inside of a bend and tearing open on the outside.
 *
 * Only the joint at the link's ROOT is blended. The joint at its TIP is the
 * root joint of every child link, so each joint is written exactly once, from
 * the child's side — which is what keeps a BRANCHING joint (a spine link with
 * four legs hanging off it) unambiguous.
 */
interface JointBlend {
  parentBone: number;
  origin: readonly [number, number, number];
  axis: readonly [number, number, number];
  span: number;
}

/**
 * Ramp half-width for one link's root joint, in meters. Two clamps, both
 * load-bearing: never more than half the link, so a short link cannot blend
 * past its own midpoint into the next joint's zone; and never more than 1.25
 * joint radii, so a long limb keeps hinging at the joint instead of bowing
 * like rubber along its whole length.
 */
function jointBlendSpan(len: number, jointRadius: number): number {
  return Math.max(1e-4, Math.min(len * 0.5, jointRadius * 1.25));
}

/**
 * The OWN-bone share at signed axial distance `s` from the joint plane
 * (positive = along the link, away from the joint). Smootherstep over
 * [-span, +span]: 0 (all parent) → 0.5 on the plane → 1 (all own bone). C2
 * continuous, so the shading normal does not crease where the ramp ends.
 */
function jointBlendWeight(s: number, span: number): number {
  const t = Math.min(1, Math.max(0, (s / span + 1) / 2));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * agora-bc64: the opt-in context that turns a creature/species bind build from
 * rigid weights into smooth ones. It is just the bone parent map the skeleton
 * builder already publishes (`BuiltPlanSkeleton.parentId`,
 * `BuiltSpeciesSkeleton.parentId`) — no second topology to drift.
 */
export interface SmoothJointWeights {
  parentId: ReadonlyMap<string, string | null>;
}

/**
 * Build the root-joint blend for one link, or undefined when that link must
 * stay rigid.
 *
 * Rigid cases, both deliberate:
 *  - no smooth context (the rigid build, unchanged);
 *  - the parent is the ROOT bone. The root carries no flesh and never receives
 *    a driver emission — it sits at the entity origin for the whole animation
 *    — so blending the first spine link into it would drag that link's base
 *    toward the origin instead of softening a bend.
 * An unknown parent id throws: the parent map and the bone index come from the
 * same builder, so a miss is a real defect, not a case to paper over.
 */
function resolveJointBlend(
  smooth: SmoothJointWeights | undefined,
  index: ReadonlyMap<string, number>,
  linkId: string,
  jointPos: readonly [number, number, number],
  axis: Vector3,
  len: number,
  jointRadius: number,
): JointBlend | undefined {
  if (!smooth) return undefined;
  const parent = smooth.parentId.get(linkId);
  if (parent === undefined || parent === null || parent === 'root') return undefined;
  const parentBone = index.get(parent);
  if (parentBone === undefined) {
    throw new Error(`skinnedBody: no bone for parent "${parent}" of link "${linkId}"`);
  }
  return {
    parentBone,
    origin: [jointPos[0], jointPos[1], jointPos[2]],
    axis: [axis.x, axis.y, axis.z],
    span: jointBlendSpan(len, jointRadius),
  };
}

/**
 * GG-152: the countershade tint sweptTube.ts computes per frame, evaluated
 * once at BIND time from a vertex normal. `ny` is the bind-pose normal's y
 * (the tube's radial DIR.y) and `axisY` is |tangent.y| of the link. The
 * formula is copied from sweptTube.update so the two paths agree; what
 * differs is WHEN it runs. A rigid-skinned vertex keeps its bind tint while
 * its bone rotates, so a link that swings from horizontal to vertical keeps
 * the bind-pose blend instead of re-fading. Accepted: plan spines undulate
 * mostly in the horizontal plane, and the alternative (re-tinting per frame)
 * would give up the whole point of the skinned path — no per-frame geometry
 * work. Revisit if a creature rears its trunk through 90°.
 */
function countershadeTint(out: Color, body: Color, belly: Color, ny: number, axisY: number): Color {
  const under = Math.min(1, Math.max(0, -ny * 1.5 + 0.2)) * (1 - 0.75 * Math.min(1, Math.abs(axisY)));
  return out.copy(body).lerp(belly, under);
}

/** Merge pieces into one indexed geometry with skin attributes.
 * Vertex order follows piece order (deterministic — piece order follows the
 * driver's emission order via bipedRestPose).
 * `shade` (GG-152) additionally bakes a `color` attribute: body→belly
 * countershading on the pieces that carry a `shade` marker, flat body tone
 * everywhere else. The fill material must then be white with vertexColors on
 * (exactly the segment renderer's tube material contract).
 * A piece carrying `parentBlend` (agora-bc64, SMOOTH weights) fills TWO skin
 * slots instead of one; every other piece keeps the 100%-one-bone rigid
 * weights unchanged. */
function mergePieces(pieces: Piece[], shade?: { body: Color; belly: Color }): BufferGeometry {
  let vertCount = 0;
  let indexCount = 0;
  for (const piece of pieces) {
    vertCount += piece.geometry.attributes.position.count;
    indexCount += piece.geometry.index!.count;
  }
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const skinIndex = new Uint16Array(vertCount * 4);
  const skinWeight = new Float32Array(vertCount * 4);
  const index = vertCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  const colors = shade ? new Float32Array(vertCount * 3) : null;
  const TINT = shade ? new Color() : null;

  let vertOffset = 0;
  let indexOffset = 0;
  for (const piece of pieces) {
    const pos = piece.geometry.attributes.position;
    const nor = piece.geometry.attributes.normal;
    positions.set(pos.array as Float32Array, vertOffset * 3);
    normals.set(nor.array as Float32Array, vertOffset * 3);
    const blend = piece.parentBlend;
    for (let v = 0; v < pos.count; v++) {
      // RIGID weights: 100% of this vertex follows one bone; slots y/z/w stay
      // zero-weighted (they index the root, harmlessly)
      skinIndex[(vertOffset + v) * 4] = piece.bone;
      skinWeight[(vertOffset + v) * 4] = 1;
      if (blend) {
        // SMOOTH weights (agora-bc64): split this vertex with the parent bone
        // by how far it sits along the link from the joint. Slot 0 keeps the
        // own bone so the rigid reader above stays the single writer of it.
        const s =
          (pos.getX(v) - blend.origin[0]) * blend.axis[0] +
          (pos.getY(v) - blend.origin[1]) * blend.axis[1] +
          (pos.getZ(v) - blend.origin[2]) * blend.axis[2];
        const w = jointBlendWeight(s, blend.span);
        skinWeight[(vertOffset + v) * 4] = w;
        skinIndex[(vertOffset + v) * 4 + 1] = blend.parentBone;
        skinWeight[(vertOffset + v) * 4 + 1] = 1 - w;
      }
      if (colors && shade && TINT) {
        // Unshaded pieces (terminal balls, box slabs) take the flat body tone,
        // matching what the segment renderer's shared fill draws for them.
        if (piece.shade) countershadeTint(TINT, shade.body, shade.belly, nor.getY(v), piece.shade.axisY);
        else TINT.copy(shade.body);
        colors[(vertOffset + v) * 3] = TINT.r;
        colors[(vertOffset + v) * 3 + 1] = TINT.g;
        colors[(vertOffset + v) * 3 + 2] = TINT.b;
      }
    }
    const idx = piece.geometry.index!;
    for (let k = 0; k < idx.count; k++) index[indexOffset + k] = idx.getX(k) + vertOffset;
    indexOffset += idx.count;
    vertOffset += pos.count;
    piece.geometry.dispose(); // merged copy is the survivor
  }

  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(positions, 3));
  merged.setAttribute('normal', new BufferAttribute(normals, 3));
  merged.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndex, 4));
  merged.setAttribute('skinWeight', new BufferAttribute(skinWeight, 4));
  if (colors) merged.setAttribute('color', new BufferAttribute(colors, 3));
  merged.setIndex(new BufferAttribute(index, 1));
  return merged;
}

/** Bind-pose geometry for a biped frame: cylinder + two joint spheres per rest
 * segment, one sphere per rest ball — segmentBody's solid-mode shapes exactly
 * (CylinderGeometry(r1, r0, len, 10, 1); joint SphereGeometry(r·0.98, 8, 6);
 * ball SphereGeometry(r, 12, 9)). Exported for the parity tests. */
export function buildBipedBindGeometry(frame: Frame, skeleton: ReturnType<typeof buildBipedSkeleton>): BufferGeometry {
  const pieces: Piece[] = [];
  const quat = new Quaternion();
  const dir = new Vector3();
  const mid = new Vector3();
  const matrix = new Matrix4();
  const one = new Vector3(1, 1, 1);

  for (const seg of skeleton.restPose.segments) {
    const bone = skeleton.index.get(seg.bone)!;
    dir.set(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1], seg.b[2] - seg.a[2]);
    const len = Math.max(dir.length(), 1e-4);
    mid.set((seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2, (seg.a[2] + seg.b[2]) / 2);
    quat.setFromUnitVectors(UP, dir.normalize());
    matrix.compose(mid, quat, one);

    const cylinder = new CylinderGeometry(seg.r1, seg.r0, len, 10, 1);
    cylinder.applyMatrix4(matrix);
    pieces.push({ geometry: cylinder, bone });

    for (const [end, r] of [
      [seg.a, seg.r0],
      [seg.b, seg.r1],
    ] as const) {
      const joint = new SphereGeometry(r * 0.98, 8, 6);
      joint.translate(end[0], end[1], end[2]);
      pieces.push({ geometry: joint, bone });
    }
  }
  for (const ball of skeleton.restPose.balls) {
    // round 7 (humanoid-anatomy): the head ball is not baked — the sculpted
    // humanoid head (headForms.buildHumanoidHead) mounts on the head bone in
    // assembleEntity, and the old sphere would poke through its skull planes.
    // The rest-pose ball itself stays: it binds and drives the head bone.
    if (ball.id === 'head') continue;
    const sphere = new SphereGeometry(ball.r, 12, 9);
    sphere.translate(ball.center[0], ball.center[1], ball.center[2]);
    pieces.push({ geometry: sphere, bone: skeleton.index.get(ball.bone)! });
  }
  return mergePieces(pieces);
}

export function createSkinnedBiped(frame: Frame, options: SkinnedBodyOptions): SkinnedBody {
  const built = buildBipedSkeleton(frame);
  if (options.parts && options.weights !== 'smooth') {
    throw new Error("skinnedBody: part variants apply to the smooth biped only — pass weights 'smooth'");
  }
  const geometry =
    options.weights === 'smooth'
      ? buildSmoothBipedGeometry(built.restPose, built.index, frame, options.parts)
      : buildBipedBindGeometry(frame, built);

  // Skeleton inverses must be captured while the bones hold their bind pose
  // in entity-local space, before anything reparents or animates them.
  built.root.updateMatrixWorld(true);
  const skeleton = new Skeleton(built.bones);

  const fillMaterial = toonMaterial(options.colorHex);
  // round 13 (humanoid-anatomy): the smooth loft carries greyscale value
  // tints (trousers/boots/belt band) in its color attribute — multiplicative
  // over the skin tone, so the material color stays the entity's skin hex.
  // Same 2 draw calls; the ink shell's shader ignores vertex colors.
  if (geometry.hasAttribute('color')) fillMaterial.vertexColors = true;
  if (options.opacity !== undefined && options.opacity < 1) {
    fillMaterial.transparent = true;
    fillMaterial.opacity = options.opacity;
    fillMaterial.depthWrite = false; // translucent bodies must not self-occlude harshly
  }
  // round 16 (humanoid-anatomy): the smooth loft carries a per-vertex ink
  // weight (`aInk`) — hands attenuate the hull so the ink stops swallowing
  // the thumb/knuckle creases. Gate on the attribute: without it the shader's
  // aInk reads 0 and the whole outline vanishes.
  const inkMaterial = outlineMaterial(options.colorHex, options.outlineThickness, 1, geometry.hasAttribute('aInk'));

  const root = new Group();
  root.name = 'skinnedBody';

  const fill = new SkinnedMesh(geometry, fillMaterial);
  fill.name = 'skinnedFill';
  // bind-pose bounds do not track animation; the figure is small and never
  // worth a wrong cull, so opt out (segment bodies are per-piece culled today)
  fill.frustumCulled = false;
  fill.add(built.root); // bones live under the fill mesh (standard three setup)
  fill.bind(skeleton, IDENTITY);

  const shell = new SkinnedMesh(geometry, inkMaterial);
  shell.name = 'skinnedOutline';
  shell.frustumCulled = false;
  shell.bind(skeleton, IDENTITY); // shares skeleton + geometry; no second bone tree

  root.add(fill, shell);

  const pose = createBipedPoseSink(built);

  return {
    root,
    skinnedMesh: fill,
    sink: pose.sink,
    // bipeds have no formed heads, so no poseHeadSockets — the head ball is
    // an ordinary emission the biped sink already writes.
    boneNamed: boneLookup(built.index, built.bones),
    finishFrame: pose.finishFrame,
    triangles: () => (geometry.index!.count / 3) * 2,
    dispose: () => {
      geometry.dispose();
      fillMaterial.dispose();
      inkMaterial.dispose();
      skeleton.dispose(); // frees the bone texture once a renderer has made one
    },
  };
}

const FWD = new Vector3(0, 0, 1);

/**
 * Bind-pose geometry for a plan-driven creature (slice 4): one rigid cylinder
 * per spine/chain rest link + joint spheres, one sphere per terminal ball, and
 * one rigid Box per box-spine link — every vertex owned by exactly one bone.
 * Reuses the segment renderer's shapes (CylinderGeometry(r1,r0,len,10,1),
 * joint SphereGeometry(r·0.98,8,6), ball SphereGeometry(r,12,9)) plus
 * BoxGeometry for cube bodies. Decorations (rings, collars, snouts, cilia,
 * toes, fingers) are NOT skinned — they stay on the anchor path.
 *
 * `countershade` (GG-152) bakes the segment renderer's belly gradient into a
 * vertex `color` attribute on the spine/chain links and their joint spheres —
 * the surfaces the segment path draws through a countershaded swept tube.
 *
 * `smooth` (agora-bc64) switches the links and box slabs from rigid weights to
 * a two-bone blend across each link's root joint. The SHAPES are untouched, so
 * the bind pose is identical to the rigid build; only what happens as the
 * joint bends changes. Terminal balls stay rigid: a ball is centered on its own
 * bone and has no link axis to ramp along.
 */
export function buildPlanBindGeometry(
  restPose: import('./planSkeleton').PlanRestPose,
  index: ReadonlyMap<string, number>,
  countershade?: { body: Color; belly: Color },
  smooth?: SmoothJointWeights,
): BufferGeometry {
  const pieces: Piece[] = [];
  const quat = new Quaternion();
  const dir = new Vector3();
  const mid = new Vector3();
  const matrix = new Matrix4();
  const one = new Vector3(1, 1, 1);

  const boxIds = new Set(restPose.boxes.map((b) => b.id));

  for (const seg of restPose.rels) {
    const bone = index.get(seg.id);
    if (bone === undefined) throw new Error(`skinnedBody: no bone for rest link "${seg.id}"`);
    // box-spine links are built as boxes below; skip their cylinder twin.
    if (boxIds.has(seg.id)) continue;
    dir.set(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1], seg.b[2] - seg.a[2]);
    const len = Math.max(dir.length(), 1e-4);
    mid.set((seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2, (seg.a[2] + seg.b[2]) / 2);
    quat.setFromUnitVectors(UP, dir.normalize());
    matrix.compose(mid, quat, one);
    // GG-152: |tangent.y| of this link, the sweptTube vertical-run damper.
    const shade = countershade ? { axisY: Math.abs(dir.y) } : undefined;
    const parentBlend = resolveJointBlend(smooth, index, seg.id, seg.a, dir, len, seg.r0);

    const cylinder = new CylinderGeometry(seg.r1, seg.r0, len, 10, 1);
    cylinder.applyMatrix4(matrix);
    pieces.push({ geometry: cylinder, bone, shade, parentBlend });

    for (const [end, r] of [
      [seg.a, seg.r0],
      [seg.b, seg.r1],
    ] as const) {
      const joint = new SphereGeometry(r * 0.98, 8, 6);
      joint.translate(end[0], end[1], end[2]);
      pieces.push({ geometry: joint, bone, shade, parentBlend });
    }
  }

  // box-spine links: a rigid slab from a→b (depth axis), w×h cross-section.
  for (const box of restPose.boxes) {
    const bone = index.get(box.id);
    if (bone === undefined) throw new Error(`skinnedBody: no bone for box link "${box.id}"`);
    dir.set(box.b[0] - box.a[0], box.b[1] - box.a[1], box.b[2] - box.a[2]);
    const len = Math.max(dir.length(), 1e-4);
    mid.set((box.a[0] + box.b[0]) / 2, (box.a[1] + box.b[1]) / 2, (box.a[2] + box.b[2]) / 2);
    quat.setFromUnitVectors(FWD, dir.normalize());
    matrix.compose(mid, quat, one);
    const slab = new BoxGeometry(box.w, box.h, len);
    slab.applyMatrix4(matrix);
    // A slab has no joint sphere; its half-thickness plays the joint radius.
    pieces.push({
      geometry: slab,
      bone,
      parentBlend: resolveJointBlend(smooth, index, box.id, box.a, dir, len, Math.max(box.w, box.h) / 2),
    });
  }

  for (const ball of restPose.balls) {
    const bone = index.get(ball.id)!;
    const sphere = new SphereGeometry(ball.r, 12, 9);
    sphere.translate(ball.center[0], ball.center[1], ball.center[2]);
    pieces.push({ geometry: sphere, bone });
  }
  return mergePieces(pieces, countershade);
}

/**
 * Bind-pose geometry for a species gait (slice 5): one rigid cylinder per rest
 * segment plus its two joint spheres, one sphere per rest ball — every vertex
 * owned 100% by one bone. Shapes and tessellation are the segment renderer's
 * exactly (CylinderGeometry(r1, r0, len, 10, 1); joint SphereGeometry(r·0.98,
 * 8, 6); ball SphereGeometry(r, 12, 9)), so the skinned body reads as the same
 * creature the segment body draws. Exported for the parity tests.
 *
 * `smooth` (agora-bc64) switches the segments from rigid weights to a two-bone
 * blend across each segment's root joint — same shapes, same bind pose, softer
 * hips/shoulders/neck under the gait. Balls stay rigid (see the plan builder).
 */
export function buildSpeciesBindGeometry(
  restPose: SpeciesRestPose,
  index: ReadonlyMap<string, number>,
  smooth?: SmoothJointWeights,
): BufferGeometry {
  const pieces: Piece[] = [];
  const quat = new Quaternion();
  const dir = new Vector3();
  const mid = new Vector3();
  const matrix = new Matrix4();
  const one = new Vector3(1, 1, 1);

  for (const seg of restPose.segs) {
    const bone = index.get(seg.id);
    if (bone === undefined) throw new Error(`skinnedBody: no bone for species rest segment "${seg.id}"`);
    dir.set(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1], seg.b[2] - seg.a[2]);
    const len = Math.max(dir.length(), 1e-4);
    mid.set((seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2, (seg.a[2] + seg.b[2]) / 2);
    quat.setFromUnitVectors(UP, dir.normalize());
    matrix.compose(mid, quat, one);
    const parentBlend = resolveJointBlend(smooth, index, seg.id, seg.a, dir, len, seg.r0);

    const cylinder = new CylinderGeometry(seg.r1, seg.r0, len, 10, 1);
    cylinder.applyMatrix4(matrix);
    pieces.push({ geometry: cylinder, bone, parentBlend });

    for (const [end, r] of [
      [seg.a, seg.r0],
      [seg.b, seg.r1],
    ] as const) {
      const joint = new SphereGeometry(r * 0.98, 8, 6);
      joint.translate(end[0], end[1], end[2]);
      pieces.push({ geometry: joint, bone, parentBlend });
    }
  }

  // Species heads are BALL heads (no sculpted skull mounts on these gaits), so
  // unlike the biped every ball is baked into the skinned body.
  for (const ball of restPose.balls) {
    const bone = index.get(ball.id);
    if (bone === undefined) throw new Error(`skinnedBody: no bone for species rest ball "${ball.id}"`);
    const sphere = new SphereGeometry(ball.r, 12, 9);
    sphere.translate(ball.center[0], ball.center[1], ball.center[2]);
    pieces.push({ geometry: sphere, bone });
  }
  return mergePieces(pieces);
}

/**
 * Slice 5: a rigid-weight skinned species body (quad, hexapod, hopper, flyer,
 * float). One bind-pose BufferGeometry, one fill SkinnedMesh + one inverse-hull
 * ink shell SkinnedMesh sharing it — 2 draw calls, matching slice 1. The
 * gait driver's own emissions drive the bones through the species pose sink.
 * `weights: 'smooth'` (agora-bc64) keeps these exact shapes and shares each
 * segment's vertices with its parent bone across the segment's root joint —
 * the hip, shoulder and neck stop pinching when the gait bends them.
 */
export function createSkinnedSpecies(gait: SpeciesGait, frame: Frame, options: SkinnedBodyOptions): SkinnedBody {
  const built = buildSpeciesSkeleton(gait, frame);
  const geometry = buildSpeciesBindGeometry(
    built.restPose,
    built.index,
    options.weights === 'smooth' ? { parentId: built.parentId } : undefined,
  );

  // Skeleton inverses must be captured while the bones hold their bind pose
  // in entity-local space, before anything reparents or animates them.
  built.root.updateMatrixWorld(true);
  const skeleton = new Skeleton(built.bones);

  const fillMaterial = toonMaterial(options.colorHex);
  if (options.opacity !== undefined && options.opacity < 1) {
    fillMaterial.transparent = true;
    fillMaterial.opacity = options.opacity;
    fillMaterial.depthWrite = false; // translucent bodies must not self-occlude harshly
  }
  const inkMaterial = outlineMaterial(options.colorHex, options.outlineThickness);

  const root = new Group();
  root.name = 'skinnedBody';

  const fill = new SkinnedMesh(geometry, fillMaterial);
  fill.name = 'skinnedFill';
  fill.frustumCulled = false;
  fill.add(built.root); // bones live under the fill mesh (standard three setup)
  fill.bind(skeleton, IDENTITY);

  const shell = new SkinnedMesh(geometry, inkMaterial);
  shell.name = 'skinnedOutline';
  shell.frustumCulled = false;
  shell.bind(skeleton, IDENTITY); // shares skeleton + geometry; no second bone tree

  root.add(fill, shell);

  const pose = createSpeciesPoseSink(built);

  return {
    root,
    skinnedMesh: fill,
    sink: pose.sink,
    boneNamed: boneLookup(built.index, built.bones),
    finishFrame: pose.finishFrame,
    triangles: () => (geometry.index!.count / 3) * 2,
    dispose: () => {
      geometry.dispose();
      fillMaterial.dispose();
      inkMaterial.dispose();
      skeleton.dispose(); // frees the bone texture once a renderer has made one
    },
  };
}

export interface PlanSkinnedBodyOptions extends SkinnedBodyOptions {
  /** Forward decorative emissions here (the segment renderer on the anchor path),
   * so snouts, cilia, toes, fingers, rings and collars keep rendering in
   * skinned mode instead of being dropped. */
  decorativeDelegate?: SegmentSink;
  /**
   * GG-152 (agora-2976): belly tone for countershading, the same
   * `palette.secondaryHex` the segment renderer takes as `bellyHex`. When
   * given, the bind geometry carries a baked body→belly vertex tint and the
   * fill material switches to white + vertexColors. Omit for one flat tone
   * (gels, which take no countershade — one gel is one tint).
   */
  bellyHex?: string;
}

/**
 * Slice 4: a rigid-weight skinned plan creature. One bind-pose BufferGeometry
 * (cylinders + joint spheres + terminal balls, plus boxes for cube bodies),
 * each vertex owned 100% by one bone, drawn as one fill SkinnedMesh plus one
 * inverse-hull ink shell — 2 draw calls, PLAN_TRIANGLE_BUDGET-respecting.
 * The PlanDriver's emissions drive the bones through the plan pose sink.
 * `weights: 'smooth'` (agora-bc64) keeps these exact shapes and shares each
 * link's vertices with its parent bone across the link's root joint, so a
 * bending spine or limb no longer pinches shut on the inside of the bend.
 */
export function createSkinnedPlan(frame: Frame, spec: import('../types').PlanSpec, options: PlanSkinnedBodyOptions): SkinnedBody {
  const built = buildPlanSkeleton(frame, spec);
  // GG-152: countershade the trunk exactly as the segment renderer does —
  // white base material, the baked vertex color attribute carries the tint.
  const countershade = options.bellyHex
    ? { body: new Color(options.colorHex), belly: new Color(options.bellyHex) }
    : undefined;
  const geometry = buildPlanBindGeometry(
    built.restPose,
    built.index,
    countershade,
    options.weights === 'smooth' ? { parentId: built.parentId } : undefined,
  );

  // Skeleton inverses must be captured while the bones hold their bind pose
  // in entity-local space, before anything reparents or animates them.
  built.root.updateMatrixWorld(true);
  const skeleton = new Skeleton(built.bones);

  const fillMaterial = toonMaterial(countershade ? '#ffffff' : options.colorHex);
  if (countershade) fillMaterial.vertexColors = true;
  if (options.opacity !== undefined && options.opacity < 1) {
    fillMaterial.transparent = true;
    fillMaterial.opacity = options.opacity;
    fillMaterial.depthWrite = false; // translucent bodies must not self-occlude harshly
  }
  const inkMaterial = outlineMaterial(options.colorHex, options.outlineThickness);

  const root = new Group();
  root.name = 'skinnedBody';

  const fill = new SkinnedMesh(geometry, fillMaterial);
  fill.name = 'skinnedFill';
  fill.frustumCulled = false;
  fill.add(built.root); // bones live under the fill mesh (standard three setup)
  fill.bind(skeleton, IDENTITY);

  const shell = new SkinnedMesh(geometry, inkMaterial);
  shell.name = 'skinnedOutline';
  shell.frustumCulled = false;
  shell.bind(skeleton, IDENTITY); // shares skeleton + geometry; no second bone tree

  root.add(fill, shell);

  const pose = createPlanPoseSink(built, options.decorativeDelegate);

  return {
    root,
    skinnedMesh: fill,
    sink: pose.sink,
    // Task 3: formed-head bones are posed from live sockets (they emit no
    // ball), and the assembler parents sculpted head meshes to these bones.
    poseHeadSockets: pose.writeHeadSockets,
    boneNamed: boneLookup(built.index, built.bones),
    finishFrame: pose.finishFrame,
    triangles: () => (geometry.index!.count / 3) * 2,
    dispose: () => {
      geometry.dispose();
      fillMaterial.dispose();
      inkMaterial.dispose();
      skeleton.dispose(); // frees the bone texture once a renderer has made one
    },
  };
}

export interface SkinnedChains {
  /** Add this under the entity's bodyRoot (holds fill mesh, ink shell, bones). */
  readonly root: Group;
  /** Feed the per-frame chain builds here (seg calls only). */
  readonly sink: SegmentSink;
  /** Resolve this frame's emissions into bone transforms — call after the chain builds. */
  finishFrame(): void;
  /** Fill + shell triangles (2 draw calls total). */
  triangles(): number;
  /** Bone count including the root (tests/diagnostics). */
  boneCount(): number;
  dispose(): void;
}

/**
 * Bind-pose geometry for the chain parts (slice 6): one rigid cylinder per
 * rest link plus its two joint spheres — the segment renderer's exact shapes
 * (CylinderGeometry(r1, r0, len, 10, 1); joint SphereGeometry(r·0.98, 8, 6)),
 * every vertex owned 100% by its link bone. Exported for the parity tests.
 */
export function buildChainBindGeometry(
  restPose: import('./chainSkeleton').ChainRestPose,
  index: ReadonlyMap<string, number>,
): BufferGeometry {
  const pieces: Piece[] = [];
  const quat = new Quaternion();
  const dir = new Vector3();
  const mid = new Vector3();
  const matrix = new Matrix4();
  const one = new Vector3(1, 1, 1);

  for (const seg of restPose.segs) {
    const bone = index.get(seg.id);
    if (bone === undefined) throw new Error(`skinnedBody: no bone for chain rest link "${seg.id}"`);
    dir.set(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1], seg.b[2] - seg.a[2]);
    const len = Math.max(dir.length(), 1e-4);
    mid.set((seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2, (seg.a[2] + seg.b[2]) / 2);
    quat.setFromUnitVectors(UP, dir.normalize());
    matrix.compose(mid, quat, one);

    const cylinder = new CylinderGeometry(seg.r1, seg.r0, len, 10, 1);
    cylinder.applyMatrix4(matrix);
    pieces.push({ geometry: cylinder, bone });

    for (const [end, r] of [
      [seg.a, seg.r0],
      [seg.b, seg.r1],
    ] as const) {
      const joint = new SphereGeometry(r * 0.98, 8, 6);
      joint.translate(end[0], end[1], end[2]);
      pieces.push({ geometry: joint, bone });
    }
  }
  return mergePieces(pieces);
}

/**
 * Slice 6: rigid-weight skinned chain parts (tails, tentacles, antennae, fin
 * ridges) — the last flesh that still rendered boneless in skinned mode. One
 * bind-pose BufferGeometry, one fill SkinnedMesh + one inverse-hull ink shell
 * sharing it — 2 draw calls for ALL of an entity's chains together. The
 * per-frame chain builds drive the bones through the chain pose sink. Link
 * length breathes a few percent with the wag; the joint spheres cover those
 * seams (the slice-1 trick).
 */
export function createSkinnedChains(
  chains: ChainPartInput[],
  frame: Frame,
  restAnchors: PartAnchors,
  options: SkinnedBodyOptions,
): SkinnedChains | null {
  const restPose = chainRestPose(chains, frame, restAnchors);
  if (restPose.segs.length === 0) return null;
  const built = buildChainSkeleton(restPose);
  const geometry = buildChainBindGeometry(restPose, built.index);

  // Skeleton inverses must be captured while the bones hold their bind pose
  // in entity-local space, before anything reparents or animates them.
  built.root.updateMatrixWorld(true);
  const skeleton = new Skeleton(built.bones);

  const fillMaterial = toonMaterial(options.colorHex);
  if (options.opacity !== undefined && options.opacity < 1) {
    fillMaterial.transparent = true;
    fillMaterial.opacity = options.opacity;
    fillMaterial.depthWrite = false; // translucent bodies must not self-occlude harshly
  }
  const inkMaterial = outlineMaterial(options.colorHex, options.outlineThickness);

  const root = new Group();
  root.name = 'skinnedChains';

  const fill = new SkinnedMesh(geometry, fillMaterial);
  fill.name = 'skinnedChainFill';
  fill.frustumCulled = false;
  fill.add(built.root); // bones live under the fill mesh (standard three setup)
  fill.bind(skeleton, IDENTITY);

  const shell = new SkinnedMesh(geometry, inkMaterial);
  shell.name = 'skinnedChainOutline';
  shell.frustumCulled = false;
  shell.bind(skeleton, IDENTITY); // shares skeleton + geometry; no second bone tree

  root.add(fill, shell);

  const pose = createChainPoseSink(built);

  return {
    root,
    sink: pose.sink,
    finishFrame: pose.finishFrame,
    triangles: () => (geometry.index!.count / 3) * 2,
    boneCount: () => built.bones.length,
    dispose: () => {
      geometry.dispose();
      fillMaterial.dispose();
      inkMaterial.dispose();
      skeleton.dispose(); // frees the bone texture once a renderer has made one
    },
  };
}


/**
 * A FOREIGN rig as the biped body (Part Lab base meshes, 2026-08-21): a
 * SkinnedMesh whose skeleton carries OUR bone names and hierarchy, bound in
 * its own pose (T-pose from tools/blender/rig_basemesh.py), normalized to
 * height 1. The pose sink writes the driver's absolute bone transforms, so
 * the skin deforms from its bind straight into the driven pose — the rig's
 * rest bones were set to the sink's own frame (+Y along the bone).
 *
 * Scale: the GLB is height 1; the driver emits meters for `frame`, so the
 * geometry and the bone chain are scaled to heightM(frame) and re-bound.
 * No fallbacks: a missing bone name throws.
 */
/**
 * Re-aim every bone's REST rotation to the pose sink's convention — the
 * minimal rotation from +Y onto the bone's direction (head → next joint) —
 * while every joint keeps its world position. The driver writes exactly
 * that frame each frame, so the inverse binds computed after this step
 * deform the skin from bind to pose with no roll error. Direction rules
 * mirror what the sink writes per bone:
 *   - chain bones: toward the mean of their child joints
 *   - finger and thumb tips (no child): along their own link (parent → self)
 *   - feet (no child): the rest pose's heel → toe direction
 *   - head (a ball: the sink writes position only) and root: identity
 */
function alignBindFramesToSink(bones: Bone[], index: ReadonlyMap<BipedBoneName, number>, restPose: ReturnType<typeof bipedRestPose>): void {
  const worldPos = new Map<Bone, Vector3>();
  for (const b of bones) worldPos.set(b, b.getWorldPosition(new Vector3()));
  const restDir = (name: BipedBoneName): Vector3 => {
    const seg = restPose.segments.find((sg) => sg.bone === name);
    if (!seg) throw new Error(`alignBindFramesToSink: no rest segment for leaf bone "${name}"`);
    return new Vector3(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1], seg.b[2] - seg.a[2]);
  };
  const worldQuat = new Map<Bone, Quaternion>();
  const dirs = new Map<Bone, Vector3 | null>();
  const byName = new Map(bones.map((b) => [b.name as BipedBoneName, b] as const));
  // the joint each bone points AT — the driver's own segment convention
  // (torso.pelvis ends at the chest root, armL.upper at the elbow, …). The
  // pelvis has three children, so "mean of children" pointed it down-forward
  // and the alignment stood that axis up: a body-dependent torso lean
  // (the female, 2026-08-23).
  const DIRECTION_TARGET: Partial<Record<BipedBoneName, BipedBoneName>> = {
    pelvis: 'chest', chest: 'neck', neck: 'head',
    clavicleL: 'upperArmL', upperArmL: 'foreArmL', foreArmL: 'handL',
    clavicleR: 'upperArmR', upperArmR: 'foreArmR', foreArmR: 'handR',
    thighL: 'shinL', shinL: 'footL', thighR: 'shinR', shinR: 'footR',
    thumbLa: 'thumbLb', thumbRa: 'thumbRb',
    fingerL0a: 'fingerL0b', fingerL1a: 'fingerL1b', fingerL2a: 'fingerL2b', fingerL3a: 'fingerL3b',
    fingerR0a: 'fingerR0b', fingerR1a: 'fingerR1b', fingerR2a: 'fingerR2b', fingerR3a: 'fingerR3b',
  };
  // parent-first order (BIPED_BONE_NAMES lists parents before children)
  for (const b of bones) {
    const name = b.name as BipedBoneName;
    const parent = b.parent && (b.parent as Bone).isBone ? (b.parent as Bone) : null;
    let dir: Vector3 | null = null;
    if (name !== 'root' && name !== 'head') {
      const target = DIRECTION_TARGET[name];
      if (target) {
        dir = worldPos.get(byName.get(target)!)!.clone().sub(worldPos.get(b)!);
      } else if (name === 'handL' || name === 'handR') {
        // the palm points at the mean finger root
        const kids = b.children.filter((c) => (c as Bone).isBone && /^finger/.test(c.name)) as Bone[];
        dir = new Vector3();
        for (const k of kids) dir.add(worldPos.get(k)!);
        dir.multiplyScalar(1 / Math.max(1, kids.length)).sub(worldPos.get(b)!);
      } else if (/^(finger|thumb)/.test(name) && parent) {
        dir = worldPos.get(b)!.clone().sub(worldPos.get(parent)!); // tip links: along their own link
      } else {
        dir = restDir(name); // feet: the rest heel → toe
      }
    }
    dirs.set(b, dir && dir.lengthSq() > 1e-12 ? dir.normalize() : null);
  }
  // pass 2: the canonical limb frames (the same rule set the pose sink uses
  // for rest and pose), then locals from them, parents first
  const names = bones.map((b) => b.name as BipedBoneName);
  const parentOf = bones.map((b) => (b.parent && (b.parent as Bone).isBone ? index.get(b.parent.name as BipedBoneName)! : -1));
  const frames = bones.map(() => new Quaternion());
  limbFrames(frames, names, parentOf, index, bones.map((b) => dirs.get(b) ?? null));
  for (const [k, b] of bones.entries()) {
    const parent = b.parent && (b.parent as Bone).isBone ? (b.parent as Bone) : null;
    const q = frames[k];
    worldQuat.set(b, q);
    if (!parent) {
      b.quaternion.copy(q);
      continue;
    }
    const pq = worldQuat.get(parent)!;
    const inv = pq.clone().invert();
    b.quaternion.copy(inv).multiply(q);
    b.position.copy(worldPos.get(b)!).sub(worldPos.get(parent)!).applyQuaternion(inv);
  }
}

/**
 * A Frame measured from a foreign rig's bind skeleton (unit height), so the
 * gait driver plans motion for THAT body's proportions: its arm and leg
 * lengths, shoulder width, and stance. Height, bulk, and head scale come
 * from `base` (the lab's chosen race). The inverse of the rest-pose
 * formulas in bipedRestPose: shoulder x = width/2 + 0.35 r; stance half =
 * (stance/2) × 1.12 × 0.85.
 */
export function frameFromRig(rig: SkinnedMesh, base: Frame): Frame {
  const byName = new Map(rig.skeleton.bones.map((b) => [b.name, b] as const));
  const need = (name: BipedBoneName): Bone => {
    const b = byName.get(name);
    if (!b) throw new Error(`frameFromRig: rig has no bone "${name}"`);
    return b;
  };
  rig.updateMatrixWorld(true);
  const at = (name: BipedBoneName) => need(name).getWorldPosition(new Vector3());
  const s = heightM(base); // unit rig → meters
  const ft = (m: number) => (m * s) / FT_TO_M;
  const chain = (names: BipedBoneName[]) => {
    let len = 0;
    for (let i = 1; i < names.length; i++) len += at(names[i]).distanceTo(at(names[i - 1]));
    return len;
  };
  const upper = at('upperArmL');
  const fingertipReach = chain(['upperArmL', 'foreArmL', 'handL', 'fingerL1a', 'fingerL1b']) + at('fingerL1b').distanceTo(at('fingerL1a')) * 0.85;
  const hip = at('thighL');
  const heel = at('footL');
  const r = s * 0.105 * base.bulk;
  return {
    ...base,
    limbLengthFt: ft(hip.y - heel.y + 0.03),
    armLengthFt: ft(fingertipReach),
    shoulderWidthFt: Math.max(0.3, ft(2 * (Math.abs(upper.x) - 0.35 * r / s))),
    stanceWidthFt: Math.max(0.2, ft((2 * Math.abs(heel.x)) / (1.12 * 0.85))),
  };
}

export function createSkinnedFromRig(frame: Frame, rig: SkinnedMesh, options: Pick<SkinnedBodyOptions, 'colorHex' | 'outlineThickness'>): SkinnedBody {
  const byName = new Map(rig.skeleton.bones.map((b) => [b.name, b] as const));
  const bones: Bone[] = BIPED_BONE_NAMES.map((name) => {
    const b = byName.get(name);
    if (!b) throw new Error(`createSkinnedFromRig: rig has no bone "${name}" (bones: ${rig.skeleton.bones.map((x) => x.name).join(', ')})`);
    return b;
  });
  const index = new Map<BipedBoneName, number>(BIPED_BONE_NAMES.map((n, i) => [n, i] as const));
  const rootBone = bones[0];
  // our driver writes the root at the entity origin; a rig whose root bone
  // binds elsewhere would lift the whole body by that offset every frame
  if (rootBone.position.length() > 1e-3) {
    throw new Error(`createSkinnedFromRig: root bone binds at (${rootBone.position.toArray().map((v) => v.toFixed(3)).join(', ')}), expected the origin — re-run tools/entities3d/rigBaseMeshes.mjs`);
  }

  // meters: scale the bind geometry and every bone's local offset uniformly
  const s = heightM(frame);
  const geometry = rig.geometry.clone();
  geometry.scale(s, s, s);
  for (const b of bones) b.position.multiplyScalar(s);

  const fillMaterial = toonMaterial(options.colorHex);
  const inkMaterial = outlineMaterial(options.colorHex, options.outlineThickness, 1, false);
  const root = new Group();
  root.name = 'skinnedBody';
  const fill = new SkinnedMesh(geometry, fillMaterial);
  fill.name = 'skinnedFill';
  fill.frustumCulled = false;
  rootBone.removeFromParent();
  fill.add(rootBone);
  fill.updateMatrixWorld(true);
  alignBindFramesToSink(bones, index, bipedRestPose(frame));
  fill.updateMatrixWorld(true);
  // The geometry's skinIndex values address the GLB skin's OWN joint order —
  // the Skeleton must keep that order. The sink addresses bones by our
  // name order through `bones`/`index` above; the two orders are separate.
  const skeleton = new Skeleton(rig.skeleton.bones.slice());
  fill.bind(skeleton, IDENTITY); // inverse binds from the scaled T-pose
  const shell = new SkinnedMesh(geometry, inkMaterial);
  shell.name = 'skinnedOutline';
  shell.frustumCulled = false;
  shell.bind(skeleton, IDENTITY);
  root.add(fill, shell);

  const bindWorldPos = bones.map((b) => new Vector3().setFromMatrixPosition(b.matrixWorld));
  const bindWorldQuat = bones.map((b) => new Quaternion().setFromRotationMatrix(b.matrixWorld));
  const built: BuiltSkeleton = { root: rootBone, bones, index, restPose: bipedRestPose(frame), bindWorldPos, bindWorldQuat };
  // rotations only: the rig keeps its own limb lengths — its shape
  const pose = createBipedPoseSink(built, { fk: true });

  return {
    root,
    skinnedMesh: fill,
    sink: pose.sink,
    boneNamed: boneLookup(index, bones),
    finishFrame: pose.finishFrame,
    applyWorldPose: pose.applyWorldPose,
    triangles: () => ((geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3) * 2,
    dispose: () => {
      geometry.dispose();
      fillMaterial.dispose();
      inkMaterial.dispose();
      skeleton.dispose();
    },
  };
}
