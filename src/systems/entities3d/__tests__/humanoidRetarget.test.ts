/**
 * @file humanoidRetarget.test.ts — CC0 clip animation slice 1: the pure bone
 * map from the Mesh2Motion human rig onto our 17-bone biped, plus the
 * in-place track strip. Spec: docs/superpowers/specs/2026-07-24-cc0-clip-animation-design.md
 */
import { describe, it, expect } from 'vitest';
import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import { BIPED_BONE_NAMES } from '../three/skeletonBuilder';
import { HUMANOID_BONE_MAP, retargetNames, stripToInPlace } from '../anim/humanoidRetarget';

describe('HUMANOID_BONE_MAP', () => {
  it('maps every one of our 17 bones to a non-empty rig bone name', () => {
    for (const bone of BIPED_BONE_NAMES) {
      expect(HUMANOID_BONE_MAP[bone], `${bone} mapping`).toBeTruthy();
      expect(typeof HUMANOID_BONE_MAP[bone]).toBe('string');
    }
    expect(Object.keys(HUMANOID_BONE_MAP).length).toBe(BIPED_BONE_NAMES.length);
  });

  it('only keys are real BipedBoneNames', () => {
    const valid = new Set<string>(BIPED_BONE_NAMES);
    for (const key of Object.keys(HUMANOID_BONE_MAP)) {
      expect(valid.has(key), `${key} is a real bone`).toBe(true);
    }
  });

  it('retargetNames is our→their and covers the arm + leg chain', () => {
    const names = retargetNames();
    expect(names.upperArmL).toBe('upperarm_l');
    expect(names.foreArmR).toBe('lowerarm_r');
    expect(names.shinL).toBe('calf_l');
    expect(names.chest).toBe('spine_03');
    expect(names.neck).toBe('neck_01');
  });
});

describe('stripToInPlace', () => {
  function sampleClip(): AnimationClip {
    const t = [0, 1];
    const quat = new QuaternionKeyframeTrack('upperArmL.quaternion', t, [0, 0, 0, 1, 0, 0, 0, 1]);
    const rootPos = new VectorKeyframeTrack('root.position', t, [0, 0, 0, 0, 0, 1]);
    const pelvisPos = new VectorKeyframeTrack('pelvis.position', t, [0, 1, 0, 0, 1.1, 0]);
    const scale = new VectorKeyframeTrack('chest.scale', t, [1, 1, 1, 1, 1, 1]);
    return new AnimationClip('Walk', 1, [quat, rootPos, pelvisPos, scale]);
  }

  it('keeps only quaternion tracks (no position, no scale)', () => {
    const stripped = stripToInPlace(sampleClip());
    expect(stripped.tracks.every((tr) => tr.name.endsWith('.quaternion'))).toBe(true);
    expect(stripped.tracks.length).toBe(1);
    expect(stripped.name).toBe('Walk');
    expect(stripped.duration).toBe(1);
  });

  it('does not mutate the input clip', () => {
    const original = sampleClip();
    stripToInPlace(original);
    expect(original.tracks.length).toBe(4);
  });
});
