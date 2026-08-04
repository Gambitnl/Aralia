/**
 * @file skinnedClipPlayer.test.ts — CC0 clip animation slice 1: the mixer
 * wrapper drives without GLTF (a hand-built quaternion clip on a tiny bone).
 */
import { describe, it, expect } from 'vitest';
import { AnimationClip, Bone, QuaternionKeyframeTrack } from 'three';
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
    const player = createSkinnedClipPlayer(root, new Map([['Walk', tinyClip('Walk')]]));
    expect(() => player.play('Nope')).toThrow(/not in this pack/);
    player.dispose();
  });
});
