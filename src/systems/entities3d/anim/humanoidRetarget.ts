/**
 * @file humanoidRetarget.ts — CC0 clip animation slice 1: map the Mesh2Motion
 * human rig onto our 17-bone biped, and strip clips to in-place rotation-only.
 *
 * The rig is Unreal-style (github.com/Mesh2Motion/mesh2motion-app, CC0). Their
 * bind pose is an A-pose with a rotated root, so clips must be retargeted in
 * world space (SkeletonUtils.retargetClip) — this module supplies the name map
 * and the in-place strip; the actual retarget lives in clipStore.ts.
 *
 * We keep ONLY rotation tracks: bone translations bake in the source
 * skeleton's proportions and would distort a dwarf or a goliath, while
 * rotations are proportion-independent. Root/hip translation (locomotion) is
 * dropped — our gait system moves the entity group.
 */
import type { AnimationBlendMode, AnimationClip } from 'three';
import { AnimationClip as ThreeAnimationClip } from 'three';
import type { BipedBoneName } from '../three/skeletonBuilder';

/** Our bone → Mesh2Motion rig bone. Their fingers, toe-balls, clavicles, and
 * spine_01/02 have no equal on our skeleton and are simply not referenced. */
export const HUMANOID_BONE_MAP: Readonly<Record<BipedBoneName, string>> = Object.freeze({
  root: 'root',
  pelvis: 'pelvis',
  chest: 'spine_03',
  neck: 'neck_01',
  head: 'head',
  upperArmL: 'upperarm_l',
  foreArmL: 'lowerarm_l',
  handL: 'hand_l',
  upperArmR: 'upperarm_r',
  foreArmR: 'lowerarm_r',
  handR: 'hand_r',
  thighL: 'thigh_l',
  shinL: 'calf_l',
  footL: 'foot_l',
  thighR: 'thigh_r',
  shinR: 'calf_r',
  footR: 'foot_r',
});

/** The same map as a plain record for SkeletonUtils.retargetClip
 * (`options.names[ourBone] = theirBone`). */
export function retargetNames(): Record<string, string> {
  return { ...HUMANOID_BONE_MAP };
}

/** Return a copy of the clip with only `.quaternion` tracks — drops every
 * position and scale track (proportion-independent, in-place). Pure. */
export function stripToInPlace(clip: AnimationClip): AnimationClip {
  const kept = clip.tracks.filter((track) => track.name.endsWith('.quaternion'));
  return new ThreeAnimationClip(clip.name, clip.duration, kept, (clip as { blendMode?: AnimationBlendMode }).blendMode);
}
