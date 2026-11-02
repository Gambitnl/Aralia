// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/08/2026, 15:06:21
 * Dependents: components/World3D/GroundAgents.tsx, components/World3D/crowdInstancePlan.ts, systems/entities3d/recipeFromOccupant.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file crowdBake.ts — crowd stand-ins: bake a generated entity into static
 * walk-cycle keyframe geometries so hundreds of street commuters render as
 * instanced meshes instead of live metaball fields.
 *
 * One archetype = one representative body per ancestry group, baked to
 * [idle, walkPhase0 … walkPhaseN-1] merged geometries with per-vertex colors
 * (body v2: the segment skeleton is posed, its meshes are snapshotted —
 * no field extraction)
 * (body = skin tone, gear/features = their part colors). A crowd renderer
 * buckets agents by (group, phase) and swaps instances between phase
 * geometries as their gait advances — the blobfolk look at instancing cost.
 *
 * Bake-time only: nothing here runs per frame.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type AnimationClip,
  type Bone,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EntityBlueprint, PartAnchors, PartPhase, Vec3Like } from '../types';
import { ANCHORS, headRadiusM, heightM } from '../types';
import { getPart } from '../registry';
import { createGaitDriver } from './gaits';
import type { LocomotionState } from './gaits';
import { createSegmentBody } from './segmentBody';
import { buildHeadForm } from './headForms';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { assembleEntity, gameBodyOptions } from './assembleEntity';
import { createSkinnedClipPlayer } from './skinnedClipPlayer';

export const CROWD_WALK_PHASES = 8;
const WALK_SPEED = 1.15;
const FORWARD = new Vector3(0, 0, 1);

export interface CrowdArchetype {
  /** [idle, walk phase 0 … walk phase N-1] — feet at y=0, meters. */
  geometries: BufferGeometry[];
  heightM: number;
}


/** Colorize a part mesh's geometry (world-transformed) for merging. */
function partMeshToGeometry(mesh: Mesh): BufferGeometry {
  let geo = mesh.geometry.clone();
  if (geo.index) geo = geo.toNonIndexed();
  geo.applyMatrix4(mesh.matrixWorld);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const c = (material as MeshBasicMaterial).color ?? new Color('#888888');
  // Countershaded tubes carry real per-vertex colors — bake them; everything
  // else takes its material's flat color.
  const attrColor = geo.attributes.color as BufferAttribute | undefined;
  for (let i = 0; i < count; i++) {
    colors[i * 3] = attrColor ? attrColor.getX(i) : c.r;
    colors[i * 3 + 1] = attrColor ? attrColor.getY(i) : c.g;
    colors[i * 3 + 2] = attrColor ? attrColor.getZ(i) : c.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  // merged output only needs position/normal/color
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') geo.deleteAttribute(name);
  }
  return geo;
}

/** Bake one pose (idle, or a specific walk phase in [0,1)). */
function bakePose(blueprint: EntityBlueprint, walkPhase: number | null): BufferGeometry {
  const { frame, palette, gait } = blueprint;

  // same wing-garnish hint as the assembler — baked walk phases sample the
  // flap cycle, so winged archetypes freeze mid-beat without it
  const winged = blueprint.parts.some((p) => p.partId.startsWith('wings'));
  const driver = createGaitDriver(gait, frame, blueprint.planSpec, { winged });
  const loco: LocomotionState = {
    position: new Vector3(),
    heading: new Vector3(0, 0, 1),
    speed: walkPhase === null ? 0 : WALK_SPEED,
  };
  if (walkPhase === null) {
    driver.update(0.35, 1 / 60, loco); // settle a neutral stance
  } else {
    // gaitPhase integrates cadence·dt from 0 — step until the target phase
    let t = 0;
    let guard = 0;
    while (driver.gaitPhase < 1 + walkPhase && guard < 4000) {
      driver.update(t, 1 / 120, loco);
      t += 1 / 120;
      guard += 1;
    }
  }

  // pose the segment skeleton (solid mode) and snapshot its meshes
  const body = createSegmentBody({
    renderMode: 'solid',
    colorHex: palette.skinHex,
    bellyHex: blueprint.planSpec ? palette.secondaryHex : undefined,
    outlineThickness: 0.001,
  });
  body.beginFrame();
  driver.buildBody(body.sink);
  // Sculpted head forms are assembler-owned (the driver emits no ball for
  // them) — bake them at their live sockets or plan creatures go headless.
  if (blueprint.planSpec && driver.headSockets) {
    const sockets = driver.headSockets();
    blueprint.planSpec.heads.forEach((headSpec, h) => {
      if (!headSpec.form) return;
      const socket = sockets[h];
      if (!socket) return;
      const formGroup = buildHeadForm(
        headSpec.form,
        new MeshBasicMaterial({ color: palette.skinHex }),
        new MeshBasicMaterial({ color: '#e8e2d4' }),
      );
      formGroup.position.set(socket.x, socket.y, socket.z);
      formGroup.quaternion.setFromUnitVectors(FORWARD, new Vector3(socket.fx, socket.fy, socket.fz));
      formGroup.scale.setScalar(socket.r);
      body.root.add(formGroup);
    });
  }
  const anchorsView = Object.fromEntries(
    ANCHORS.map((a) => [a, driver.pose.anchors[a].pos as Vec3Like]),
  ) as PartAnchors;
  const phase: PartPhase = { t: 0.35, gaitPhase: driver.gaitPhase, flap: driver.flap };
  const geometries: BufferGeometry[] = [];
  for (const instance of blueprint.parts) {
    const def = getPart(instance.partId);
    const params = instance.params ?? {};
    if (def.kind === 'chain') {
      for (const seg of def.buildChain!(frame, params, phase, anchorsView)) {
        body.sink.seg(instance.partId + ':' + seg.id, seg.ax, seg.ay, seg.az, seg.bx, seg.by, seg.bz, seg.r0, seg.r1);
      }
      continue;
    }
    const { object } = def.buildMesh!({
      frame,
      palette,
      params,
      material: (hex) => new MeshBasicMaterial({ color: hex }),
    });
    const container = new Group();
    const a = driver.pose.anchors[instance.anchor];
    container.position.copy(a.pos);
    container.quaternion.copy(a.quat as Quaternion);
    container.add(object);
    container.updateMatrixWorld(true);
    container.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) geometries.push(partMeshToGeometry(m));
    });
  }
  body.finishFrame();
  body.root.updateMatrixWorld(true);
  const bodyGeometries: BufferGeometry[] = [];
  body.root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && m.name !== 'segOutline' && m.visible !== false && m.parent?.visible !== false) {
      bodyGeometries.push(partMeshToGeometry(m));
    }
  });
  body.dispose();
  geometries.unshift(...bodyGeometries);

  const merged = mergeGeometries(geometries, false);
  if (!merged) {
    throw new Error(`entities3d: crowd bake produced no geometry for "${blueprint.label}"`);
  }
  // lift by the driver's airborne offset so hoppers/floaters bake believably
  if (driver.verticalOffsetM > 0) {
    merged.applyMatrix4(new Matrix4().makeTranslation(0, driver.verticalOffsetM, 0));
  }
  return merged;
}

// ============================================================================
// Archetype Keyframe Baking
// ============================================================================
// Bakes a compiled blueprint's idle and walking phases into standalone
// geometries.
// ============================================================================

/** Bake the full keyframe set for one blueprint. */
export function bakeCrowdArchetype(blueprint: EntityBlueprint): CrowdArchetype {
  const geometries: BufferGeometry[] = [bakePose(blueprint, null)];
  for (let p = 0; p < CROWD_WALK_PHASES; p++) {
    geometries.push(bakePose(blueprint, p / CROWD_WALK_PHASES));
  }
  return { geometries, heightM: heightM(blueprint.frame) };
}

// ============================================================================
// Activity Frames From Clips (NPC life, 2026-11-02)
// ============================================================================
// The crowd's idle and walk frames come from the procedural gait. Activities
// (talking, listening) come from the entity generator's CC0 clip system
// (anim/clipStore.ts): the same retargeted clips the debugger plays, sampled
// here into static frames. No second animation system: the clip player poses
// the game's own skinned body, and this only freezes that pose.
//
// Limit (kept honest): the clip drives the skinned body, while modular parts
// (brow, beard, ears) ride the procedural anchors. This bake moves each part
// with the bone under its anchor, so a beard stays on a nodding jaw. The look
// is the skinned body, not the segment body of the idle and walk frames.
// ============================================================================

/** One activity to bake: a clip name and how many frames to sample. */
export interface CrowdClipRequest {
  clip: string;
  frames: number;
}

/** True when a Bone is among the object's ancestors (it already follows the pose). */
function hasBoneAncestor(o: Object3D): boolean {
  for (let p = o.parent; p; p = p.parent) if ((p as Bone).isBone) return true;
  return false;
}

/** The biped bone that carries each part anchor. */
const ANCHOR_BONE: Record<string, string> = {
  head: 'head', browL: 'head', browR: 'head', earL: 'head', earR: 'head', jaw: 'head', crown: 'head',
  chest: 'chest', back: 'chest', hips: 'pelvis', hipL: 'pelvis', hipR: 'pelvis', tailRoot: 'pelvis',
  handL: 'handL', handR: 'handR',
};

/** The part container ('part:<id>') above a mesh, if any. */
function partIdOf(o: Object3D): string | undefined {
  for (let q: Object3D | null = o; q; q = q.parent) if (q.name.startsWith('part:')) return q.name.slice(5);
  return undefined;
}

/** The skinned fill as a static, world-space, vertex-colored geometry. */
function skinnedMeshToGeometry(mesh: SkinnedMesh): BufferGeometry {
  const src = mesh.geometry;
  const count = src.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const v = new Vector3();
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(src.attributes.position as BufferAttribute, i);
    mesh.applyBoneTransform(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  if (src.index) geo.setIndex(src.index.clone());
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const c = (material as MeshBasicMaterial).color ?? new Color('#888888');
  const srcColor = (material as MeshBasicMaterial).vertexColors ? (src.attributes.color as BufferAttribute | undefined) : undefined;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // vertexColors multiply the material color, as the toon shader does.
    colors[i * 3] = (srcColor ? srcColor.getX(i) : 1) * c.r;
    colors[i * 3 + 1] = (srcColor ? srcColor.getY(i) : 1) * c.g;
    colors[i * 3 + 2] = (srcColor ? srcColor.getZ(i) : 1) * c.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  // Smooth normals across shared vertices. The frame stays indexed: the
  // skinned body shares most corners, so this is about a quarter of the size
  // of a flat copy, and it costs no vertex search.
  geo.computeVertexNormals();
  if (!geo.index) geo.setIndex([...Array(count).keys()]);
  return geo;
}

/** A part mesh in world space, indexed (its own index, or 0..n-1). */
function partMeshToIndexedGeometry(mesh: Mesh): BufferGeometry {
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const c = (material as MeshBasicMaterial).color ?? new Color('#888888');
  const attrColor = geo.attributes.color as BufferAttribute | undefined;
  for (let i = 0; i < count; i++) {
    colors[i * 3] = attrColor ? attrColor.getX(i) : c.r;
    colors[i * 3 + 1] = attrColor ? attrColor.getY(i) : c.g;
    colors[i * 3 + 2] = attrColor ? attrColor.getZ(i) : c.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') geo.deleteAttribute(name);
  }
  if (!geo.index) geo.setIndex([...Array(count).keys()]);
  return geo;
}

/** A bake in progress: one frame per `step()`, so a caller can spread the
 * work over many tasks (a whole group in one task froze the page for 0.3 to
 * 0.8 s in the World3D demo, 2026-11-02). */
export interface CrowdClipBaker {
  /** Bake the next frame. Returns true once every frame is done. */
  step(): boolean;
  /** The frames by clip name; complete only after step() returned true. */
  result(): Map<string, BufferGeometry[]>;
  /** Release the posed entity and the clip player. Safe to call twice. */
  dispose(): void;
}

/**
 * Start an activity-frame bake for one blueprint from retargeted clips. Each
 * request yields `frames` geometries sampled evenly through its clip (feet at
 * y = 0, same frame as the idle/walk frames). Throws at once when a clip is
 * missing, so a renamed pack fails loudly.
 */
export function createCrowdClipBaker(
  blueprint: EntityBlueprint,
  clips: Map<string, AnimationClip>,
  requests: CrowdClipRequest[],
): CrowdClipBaker {
  for (const r of requests) {
    if (!clips.has(r.clip)) throw new Error(`entities3d: crowd clip bake has no clip "${r.clip}"`);
  }
  const handle = assembleEntity(blueprint, { ...gameBodyOptions(blueprint), renderMode: 'solid' });
  let player: ReturnType<typeof createSkinnedClipPlayer> | null = null;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    player?.dispose();
    handle.dispose();
  };
  try {
    // Settle the procedural idle once: it builds the body and the parts.
    handle.update(0.35, 1 / 60);
    handle.group.updateMatrixWorld(true);
    let fill: SkinnedMesh | undefined;
    handle.group.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh && o.name === 'skinnedFill' && !fill) fill = o as SkinnedMesh;
    });
    if (!fill) throw new Error(`entities3d: crowd clip bake found no skinned fill for "${blueprint.label}"`);
    const body = fill;
    const bones = new Map(body.skeleton.bones.map((b) => [b.name, b]));
    // Every visible plain mesh except outlines and the ground shadow. A mesh
    // under a bone (the head form, the eyes) already follows the clip pose. A
    // modular part follows the bone under its anchor: the bake applies that
    // bone's motion from rest to the part's rest transform.
    const parts: Array<{ mesh: Mesh; rest: Matrix4; bone?: Bone; boneRestInv?: Matrix4 }> = [];
    handle.group.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || (m as unknown as SkinnedMesh).isSkinnedMesh) return;
      if (/outline/i.test(m.name) || m.name === 'blobShadow') return;
      for (let q: Object3D | null = m; q; q = q.parent) if (!q.visible) return;
      if (hasBoneAncestor(m)) { parts.push({ mesh: m, rest: m.matrixWorld.clone() }); return; }
      const partId = partIdOf(m);
      const anchor = partId ? blueprint.parts.find((pt) => pt.partId === partId)?.anchor : undefined;
      const bone = anchor ? bones.get(ANCHOR_BONE[anchor] ?? '') : undefined;
      parts.push({ mesh: m, rest: m.matrixWorld.clone(), bone, boneRestInv: bone?.matrixWorld.clone().invert() });
    });
    const clipPlayer = createSkinnedClipPlayer(body, clips);
    player = clipPlayer;
    const out = new Map<string, BufferGeometry[]>(requests.map((r) => [r.clip, []] as [string, BufferGeometry[]]));
    const delta = new Matrix4();
    let requestIndex = 0;
    let frameIndex = 0;
    let playing = -1;
    return {
      step() {
        if (disposed) throw new Error('entities3d: crowd clip bake stepped after dispose');
        if (requestIndex >= requests.length) return true;
        const r = requests[requestIndex];
        if (playing !== requestIndex) { clipPlayer.play(r.clip, { fadeSec: 0 }); playing = requestIndex; }
        clipPlayer.sampleAtPhase(frameIndex / r.frames);
        handle.group.updateMatrixWorld(true);
        const geometries: BufferGeometry[] = [skinnedMeshToGeometry(body)];
        for (const { mesh, rest, bone, boneRestInv } of parts) {
          if (bone && boneRestInv) {
            delta.multiplyMatrices(bone.matrixWorld, boneRestInv);
            mesh.matrixWorld.multiplyMatrices(delta, rest);
          }
          geometries.push(partMeshToIndexedGeometry(mesh));
        }
        const merged = mergeGeometries(geometries, false);
        if (!merged) throw new Error(`entities3d: crowd clip bake produced no geometry for "${blueprint.label}"`);
        out.get(r.clip)!.push(merged);
        frameIndex++;
        if (frameIndex >= r.frames) { requestIndex++; frameIndex = 0; }
        return requestIndex >= requests.length;
      },
      result: () => out,
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

/** Bake every activity frame at once (tests and offline tools). */
export function bakeCrowdClipFrames(
  blueprint: EntityBlueprint,
  clips: Map<string, AnimationClip>,
  requests: CrowdClipRequest[],
): Map<string, BufferGeometry[]> {
  const baker = createCrowdClipBaker(blueprint, clips, requests);
  try {
    while (!baker.step()) { /* one frame per step */ }
    return baker.result();
  } finally {
    baker.dispose();
  }
}
