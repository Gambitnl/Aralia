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
 * Deferred: smooth joint weights (slice 3), creature skeletons (slice 4).
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
  CylinderGeometry,
  Group,
  Matrix4,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import type { Frame, SegmentSink } from '../types';
import { buildBipedSkeleton, createBipedPoseSink } from './skeletonBuilder';
import { buildPlanSkeleton, createPlanPoseSink } from './planSkeleton';
import { buildSmoothBipedGeometry } from './smoothBipedGeometry';
import { outlineMaterial, toonMaterial } from './toon';

export interface SkinnedBodyOptions {
  colorHex: string;
  /** Inverse-hull outline thickness, meters (same value the segment body uses). */
  outlineThickness: number;
  /** Body translucency (< 1 = ghosts). Mirrors segmentBody's solid-mode handling. */
  opacity?: number;
  /** 'rigid' (default) = slice-1 segment-look pieces; 'smooth' = slice-3
   * one-piece chain tubes with joint-blended weights. */
  weights?: 'rigid' | 'smooth';
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
  /** Resolve this frame's emissions into bone transforms — call after buildBody. */
  finishFrame(): void;
  /** Fill + shell triangles (2 draw calls total). */
  triangles(): number;
  dispose(): void;
}

const UP = new Vector3(0, 1, 0);
const IDENTITY = new Matrix4();

/** One geometry piece bound rigidly to one bone. */
interface Piece {
  geometry: CylinderGeometry | SphereGeometry | BoxGeometry;
  bone: number;
}

/** Merge pieces into one indexed geometry with rigid skin attributes.
 * Vertex order follows piece order (deterministic — piece order follows the
 * driver's emission order via bipedRestPose). */
function mergePieces(pieces: Piece[]): BufferGeometry {
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

  let vertOffset = 0;
  let indexOffset = 0;
  for (const piece of pieces) {
    const pos = piece.geometry.attributes.position;
    const nor = piece.geometry.attributes.normal;
    positions.set(pos.array as Float32Array, vertOffset * 3);
    normals.set(nor.array as Float32Array, vertOffset * 3);
    for (let v = 0; v < pos.count; v++) {
      // RIGID weights: 100% of this vertex follows one bone; slots y/z/w stay
      // zero-weighted (they index the root, harmlessly)
      skinIndex[(vertOffset + v) * 4] = piece.bone;
      skinWeight[(vertOffset + v) * 4] = 1;
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
    const sphere = new SphereGeometry(ball.r, 12, 9);
    sphere.translate(ball.center[0], ball.center[1], ball.center[2]);
    pieces.push({ geometry: sphere, bone: skeleton.index.get(ball.bone)! });
  }
  return mergePieces(pieces);
}

export function createSkinnedBiped(frame: Frame, options: SkinnedBodyOptions): SkinnedBody {
  const built = buildBipedSkeleton(frame);
  const geometry =
    options.weights === 'smooth'
      ? buildSmoothBipedGeometry(built.restPose, built.index)
      : buildBipedBindGeometry(frame, built);

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
 */
export function buildPlanBindGeometry(
  restPose: import('./planSkeleton').PlanRestPose,
  index: ReadonlyMap<string, number>,
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
    pieces.push({ geometry: slab, bone });
  }

  for (const ball of restPose.balls) {
    const bone = index.get(ball.id)!;
    const sphere = new SphereGeometry(ball.r, 12, 9);
    sphere.translate(ball.center[0], ball.center[1], ball.center[2]);
    pieces.push({ geometry: sphere, bone });
  }
  return mergePieces(pieces);
}

export interface PlanSkinnedBodyOptions extends SkinnedBodyOptions {
  /** Forward decorative emissions here (the segment renderer on the anchor path),
   * so snouts, cilia, toes, fingers, rings and collars keep rendering in
   * skinned mode instead of being dropped. */
  decorativeDelegate?: SegmentSink;
}

/**
 * Slice 4: a rigid-weight skinned plan creature. One bind-pose BufferGeometry
 * (cylinders + joint spheres + terminal balls, plus boxes for cube bodies),
 * each vertex owned 100% by one bone, drawn as one fill SkinnedMesh plus one
 * inverse-hull ink shell — 2 draw calls, PLAN_TRIANGLE_BUDGET-respecting.
 * The PlanDriver's emissions drive the bones through the plan pose sink.
 * Creature SMOOTH joint weights are deferred (slice 4 scope).
 */
export function createSkinnedPlan(frame: Frame, spec: import('../types').PlanSpec, options: PlanSkinnedBodyOptions): SkinnedBody {
  if (options.weights === 'smooth') {
    // Deferred explicitly (skeleton pivot slice 4) — no silent fallback.
    throw new Error("skinnedBody: creature SMOOTH joint weights are deferred (slice 4) — use 'rigid'");
  }
  const built = buildPlanSkeleton(frame, spec);
  const geometry = buildPlanBindGeometry(built.restPose, built.index);

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

  const pose = createPlanPoseSink(built, options.decorativeDelegate);

  return {
    root,
    skinnedMesh: fill,
    sink: pose.sink,
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

