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
import { AnimationClip, BufferGeometry, MeshBasicMaterial, Object3D, Skeleton, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { deriveFrame } from '../types';
import { buildBipedSkeleton } from '../three/skeletonBuilder';
import { retargetNames, stripToInPlace } from './humanoidRetarget';

const cache = new Map<string, Promise<Map<string, AnimationClip>>>();

/** A retarget target: a SkinnedMesh whose skeleton is a reference biped. */
function referenceTarget(): SkinnedMesh {
  const built = buildBipedSkeleton(deriveFrame('biped', 6, 1, 1));
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.add(built.root);
  mesh.bind(new Skeleton(built.bones));
  mesh.updateMatrixWorld(true);
  return mesh;
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

async function loadAndRetarget(packUrl: string): Promise<Map<string, AnimationClip>> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(packUrl);
  const source = sourceFromScene(gltf.scene);
  const target = referenceTarget();
  const names = retargetNames();

  const out = new Map<string, AnimationClip>();
  for (const clip of gltf.animations) {
    const retargeted = retargetClip(target, source, clip, { names, hip: 'pelvis' }) as AnimationClip;
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
