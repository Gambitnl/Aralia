/**
 * @file clipStore.ts — CC0 clip animation slice 1: load a Mesh2Motion human
 * clip pack, retarget every clip onto our biped bone names, cache the result.
 *
 * Retarget runs ONCE per pack against a reference biped (SkeletonUtils works in
 * world space, so the source A-pose bind and our bind reconcile). Rotation
 * retargeting is proportion-independent, so the cached clips — keyed by our
 * bone names — play on ANY generated humanoid's skeleton, dwarf to goliath.
 *
 * Async + browser only (GLTFLoader fetches a multi-MB GLB): the pure map and
 * strip live in humanoidRetarget.ts and are unit-tested there; this module is
 * proven by the debugger.
 */
import { AnimationClip, BufferGeometry, Matrix4, MeshBasicMaterial, Object3D, Quaternion, Skeleton, SkinnedMesh, Vector3, type Bone } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { deriveFrame } from '../types';
import { buildBipedSkeleton, limbFrames, type BipedBoneName, type BuiltSkeleton } from '../three/skeletonBuilder';
import { retargetNames, stripToInPlace } from './humanoidRetarget';

const cache = new Map<string, Promise<Map<string, AnimationClip>>>();

/** A retarget target: a SkinnedMesh whose skeleton is a reference biped. */
function referenceTarget(): { mesh: SkinnedMesh; built: BuiltSkeleton } {
  const built = buildBipedSkeleton(deriveFrame('biped', 6, 1, 1));
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.add(built.root);
  mesh.bind(new Skeleton(built.bones));
  mesh.updateMatrixWorld(true);
  return { mesh, built };
}

/** Find the first SkinnedMesh in a loaded scene and hoist its skeleton onto the
 * scene root so SkeletonUtils and the sampling mixer both resolve bones. */
function sourceFromScene(scene: Object3D): Object3D {
  let skinned: SkinnedMesh | null = null;
  scene.traverse((o) => {
    if (!skinned && (o as SkinnedMesh).isSkinnedMesh) skinned = o as SkinnedMesh;
  });
  if (!skinned) throw new Error('clip pack has no SkinnedMesh (no rig to retarget from)');
  (scene as Object3D & { skeleton?: Skeleton }).skeleton = (skinned as SkinnedMesh).skeleton;
  scene.updateMatrixWorld(true);
  return scene;
}

/**
 * Per-bone frame offsets for SkeletonUtils.retarget (2026-08-23 repair).
 *
 * retarget() copies each SOURCE bone's world rotation onto our bone. The
 * Mesh2Motion rig runs +X along a limb and carries a −90° root; our bones run
 * +Y along the limb with a minimal rotation from world +Y (the pose sink's
 * frame). Copied raw, every bone lands rotated by that difference and the
 * body collapses (Entity Debug ?clip=1, 2026-08-23). The offset for a bone is
 *   inv(sourceBindWorld) × R,  R = our frame aimed along the source's BIND
 *   direction (bone → its child joint),
 * so at the source's bind the target points where the source points, and in
 * motion it follows the source's delta from bind exactly.
 *
 * R uses limbFrames — the SAME pole/hinge rule the skin bind
 * (alignBindFramesToSink) and the FK drive use — NOT a minimal rotation
 * from +Y (2026-08-23 evening, Remy's warped clip bodies). The minimal
 * rotation is degenerate on a straight-down leg (UP onto −Y picks an
 * arbitrary 180° roll axis) and carries no bend-plane twist on raised
 * arms. The probe measured the damage as pure TWIST against the skin
 * bind: thighs and shins 176–180° on EVERY clip body (directions agreed
 * to 0.0°), arms 36–62°, the wave hand 97° — flesh warped around
 * correctly aimed bones. Same directions through limbFrames instead:
 * poles compose parents-first over OUR hierarchy, so the baked tracks
 * land in the exact convention the skin was bound in.
 */
function conventionOffsets(source: Object3D, names: Record<string, string>, ref: BuiltSkeleton): Record<string, Matrix4> {
  // the source's REST is its nodes' own rest transforms as loaded (what the
  // animation tracks replace), not the skin's bind from the inverse matrices
  const srcSkeleton = (source as Object3D & { skeleton: Skeleton }).skeleton;
  source.updateMatrixWorld(true);
  const byName = new Map(srcSkeleton.bones.map((b) => [b.name, b] as const));
  // the joint each SOURCE bone points at — its limb continuation, never a
  // sibling limb (the pelvis has thigh children; its direction is the spine)
  const DIR_CHILD: Record<string, string> = {
    pelvis: 'spine_01', spine_03: 'neck_01', neck_01: 'head',
    clavicle_l: 'upperarm_l', upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', hand_l: 'middle_01_l',
    clavicle_r: 'upperarm_r', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r', hand_r: 'middle_01_r',
    thigh_l: 'calf_l', calf_l: 'foot_l', foot_l: 'ball_l',
    thigh_r: 'calf_r', calf_r: 'foot_r', foot_r: 'ball_r',
  };
  // Pass 1 — the source's bind direction for each of OUR bones, stored over
  // OUR skeleton order so limbFrames composes poles and hinges parents-first.
  const ourNames = ref.bones.map((b) => b.name as BipedBoneName);
  const parentOf = ref.bones.map((b) => (b.parent && (b.parent as Bone).isBone ? ref.index.get(b.parent.name as BipedBoneName)! : -1));
  const dirs: (Vector3 | null)[] = ourNames.map(() => null);
  const srcQuat = new Map<string, Quaternion>();
  for (const [ours, theirs] of Object.entries(names)) {
    const s = byName.get(theirs);
    if (!s) throw new Error(`clip pack has no bone "${theirs}" (mapped from our "${ours}")`);
    const sPos = s.getWorldPosition(new Vector3());
    srcQuat.set(ours, s.getWorldQuaternion(new Quaternion()));
    const childName = DIR_CHILD[theirs];
    const child = childName ? byName.get(childName) : undefined;
    if (childName && !child) throw new Error(`clip pack has no bone "${childName}" (direction child of "${theirs}")`);
    const i = ref.index.get(ours as BipedBoneName);
    if (i !== undefined && ours !== 'root' && ours !== 'head' && child) {
      dirs[i] = child.getWorldPosition(new Vector3()).sub(sPos).normalize();
    }
  }
  // Pass 2 — canonical frames for those directions (null dirs → identity,
  // which keeps root and head exactly as before).
  const frames = ourNames.map(() => new Quaternion());
  limbFrames(frames, ourNames, parentOf, ref.index, dirs);
  const offsets: Record<string, Matrix4> = {};
  for (const ours of Object.keys(names)) {
    const i = ref.index.get(ours as BipedBoneName);
    const R = i === undefined ? new Quaternion() : frames[i];
    offsets[ours] = new Matrix4().makeRotationFromQuaternion(srcQuat.get(ours)!.clone().invert().multiply(R));
  }
  return offsets;
}

async function loadAndRetarget(packUrl: string): Promise<Map<string, AnimationClip>> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(packUrl);
  const source = sourceFromScene(gltf.scene);
  const { mesh: target, built } = referenceTarget();
  const names = retargetNames();
  const localOffsets = conventionOffsets(source, names, built);

  const out = new Map<string, AnimationClip>();
  for (const clip of gltf.animations) {
    const retargeted = retargetClip(target, source, clip, { names, hip: 'pelvis', localOffsets } as Parameters<typeof retargetClip>[3]) as AnimationClip;
    const inPlace = stripToInPlace(retargeted);
    inPlace.name = clip.name;
    out.set(clip.name, inPlace);
  }
  return out;
}

/** Load + retarget a humanoid clip pack, cached per URL. Concurrent callers
 * share one in-flight load. */
export function loadHumanoidClips(packUrl: string): Promise<Map<string, AnimationClip>> {
  let hit = cache.get(packUrl);
  if (!hit) {
    hit = loadAndRetarget(packUrl);
    cache.set(packUrl, hit);
  }
  return hit;
}

/** Test/HMR aid: drop the cache. */
export function clearClipCache(): void {
  cache.clear();
}
