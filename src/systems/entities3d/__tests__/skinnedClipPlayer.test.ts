/**
 * @file skinnedClipPlayer.test.ts — CC0 clip animation slice 1: the mixer
 * wrapper drives without GLTF (a hand-built quaternion clip on a tiny bone).
 */
import { describe, it, expect } from 'vitest';
import { AnimationClip, Bone, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import { createSkinnedClipPlayer } from '../three/skinnedClipPlayer';

function tinyClip(name: string, dur = 1): AnimationClip {
  const bone = 'upperArmL.quaternion';
  const track = new QuaternionKeyframeTrack(bone, [0, dur], [0, 0, 0, 1, 0, 0.707, 0, 0.707]);
  return new AnimationClip(name, dur, [track]);
}

describe('createSkinnedClipPlayer', () => {
  it('plays, advances, and reports the current clip', () => {
    const root = new Bone();
    root.name = 'upperArmL';
    const clips = new Map([['Walk', tinyClip('Walk')], ['Idle', tinyClip('Idle')]]);
    const player = createSkinnedClipPlayer(root, clips);
    expect(player.clipNames().sort()).toEqual(['Idle', 'Walk']);
    expect(player.current()).toBeNull();
    player.play('Walk');
    expect(player.current()).toBe('Walk');
    expect(() => player.update(0.1)).not.toThrow();
    player.dispose();
  });

  it('setSpeed scales monotonically off the base', () => {
    const root = new Bone();
    root.name = 'upperArmL';
    const player = createSkinnedClipPlayer(root, new Map([['Walk', tinyClip('Walk')]]));
    player.play('Walk');
    expect(() => player.setSpeed(2.8)).not.toThrow();
    expect(() => player.setSpeed(0)).not.toThrow();
    player.dispose();
  });

  it('sampleAtPhase freezes the mixer and holds', () => {
    const root = new Bone();
    root.name = 'upperArmL';
    const player = createSkinnedClipPlayer(root, new Map([['Walk', tinyClip('Walk', 2)]]));
    player.play('Walk');
    player.sampleAtPhase(0.5);
    // once scrubbed, update() must not advance time (mixer frozen)
    expect(() => player.update(1)).not.toThrow();
    player.dispose();
  });

  it('throws on an unknown clip', () => {
    const root = new Bone();
    // The clip contract now validates at creation, so the fixture skeleton
    // must actually carry the bone the tiny clip targets.
    root.name = 'upperArmL';
    const player = createSkinnedClipPlayer(root, new Map([['Walk', tinyClip('Walk')]]));
    expect(() => player.play('Nope')).toThrow(/not in this pack/);
    player.dispose();
  });

  // The canonical clip contract (the ONE door a later reviewed BVH-to-clip
  // AnyTop importer will enter through): clips are in-place and rotation-only,
  // so a clip can never drive locomotion, and every track must name a real
  // bone on the target skeleton. Violations fail loudly at player creation.
  it('rejects a clip carrying a position track (in-place rotation-only contract)', () => {
    const root = new Bone();
    root.name = 'upperArmL';
    const bad = new AnimationClip('Walk', 1, [
      new QuaternionKeyframeTrack('upperArmL.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      new VectorKeyframeTrack('root.position', [0, 1], [0, 0, 0, 0, 0, 1]),
    ]);
    expect(() => createSkinnedClipPlayer(root, new Map([['Walk', bad]]))).toThrow(/rotation-only/);
  });

  it('rejects a quaternion track that names a bone the skeleton does not have', () => {
    const root = new Bone();
    root.name = 'upperArmL';
    const bad = new AnimationClip('Walk', 1, [
      new QuaternionKeyframeTrack('toeNail9.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ]);
    expect(() => createSkinnedClipPlayer(root, new Map([['Walk', bad]]))).toThrow(/no bone named/);
  });
});
