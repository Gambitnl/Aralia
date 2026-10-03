/**
 * @file skinnedClipPlayer.ts — CC0 clip animation slice 1: play retargeted
 * clips on a skinned entity's own skeleton via an AnimationMixer.
 *
 * The clips are already retargeted to our bone names (clipStore), so the mixer
 * binds them to whatever biped skeleton this entity carries. Playback rate can
 * be synced to real move speed the way the procedural cadence() does, and the
 * debugger scrub can freeze the mixer at a phase.
 *
 * AUTHORITY SPLIT (do not blur): procedural gaits stay authoritative for
 * locomotion and facing (the entity group moves; the driver still runs in
 * clip mode), and curated clips stay authoritative for combat timing. This
 * player is the ONE contract for everything else — ambient motion, unusual-
 * creature variation, in-between transitions — including the clips a later,
 * reviewed offline BVH-to-clip AnyTop import will supply as plain
 * AnimationClips. Because clips are in-place and rotation-only, clip root
 * translation can never drive locomotion.
 */
import { AnimationMixer, LoopOnce, LoopRepeat, Object3D, type AnimationAction, type AnimationClip, type Bone } from 'three';

export interface PlayOptions {
  loop?: boolean;
  fadeSec?: number;
}

export interface SkinnedClipPlayer {
  play(clipName: string, opts?: PlayOptions): void;
  /** Scale playback to real ground speed against the clip's authored base. */
  setSpeed(mps: number): void;
  /** Debugger scrub: pause and set the active action to phase 0..1 of its clip. */
  sampleAtPhase(phase01: number): void;
  update(dt: number): void;
  dispose(): void;
  clipNames(): string[];
  current(): string | null;
}

/** Authored ground speed of the Walk clip (m/s); timeScale = mps / this. */
const WALK_BASE_MPS = 1.4;

// ============================================================================
// Clip contract validation
// ============================================================================
// Every clip played through this file must satisfy ONE contract — the same
// contract the future reviewed AnyTop BVH-to-clip importer will target:
//   1. Rotation-only: every track is a `.quaternion` track. Position/scale
//      tracks bake in foreign proportions, and root translation would let a
//      clip drive locomotion (which belongs to the procedural gait system).
//   2. Every track names a real Bone on the target skeleton, so a mismatched
//      pack fails loudly at player creation instead of playing nothing.
// Track names come in two forms: SkeletonUtils.retargetClip emits
// `.bones[<name>].quaternion`; hand-built clips may use `<name>.quaternion`.
// ============================================================================

/** `.bones[name].property` (the retarget form — brackets tolerate any name). */
const BONES_TRACK = /^\.bones\[(.+)\]\.(\w+)$/;
/** `name.property` (the plain form three's PropertyBinding parses). */
const NODE_TRACK = /^(.+)\.(\w+)$/;

/** Find a bone by name under the root (the root itself counts). */
function resolveBone(skeletonRoot: Object3D, name: string): Bone | null {
  const hit = name === skeletonRoot.name ? skeletonRoot : skeletonRoot.getObjectByName(name);
  return hit && (hit as Bone).isBone ? (hit as Bone) : null;
}

/**
 * Enforce the canonical clip contract on one clip against one skeleton.
 * Throws on the first violation — never warns-and-continues.
 */
export function assertClipContract(clip: AnimationClip, skeletonRoot: Object3D): void {
  if (clip.tracks.length === 0) {
    throw new Error(`clip "${clip.name}" has no tracks — nothing to play`);
  }
  for (const track of clip.tracks) {
    const match = BONES_TRACK.exec(track.name) ?? NODE_TRACK.exec(track.name);
    if (!match) {
      throw new Error(`clip "${clip.name}" track "${track.name}" is not a bone track this player can parse`);
    }
    const [, boneName, property] = match;
    if (property !== 'quaternion') {
      throw new Error(
        `clip "${clip.name}" track "${track.name}" breaks the in-place rotation-only contract: ` +
          `only .quaternion tracks may play (strip position/scale tracks — see humanoidRetarget.stripToInPlace)`,
      );
    }
    if (!resolveBone(skeletonRoot, boneName)) {
      throw new Error(`clip "${clip.name}" track "${track.name}": no bone named "${boneName}" on this skeleton`);
    }
  }
}

export function createSkinnedClipPlayer(
  skeletonRoot: Object3D,
  clips: Map<string, AnimationClip>,
): SkinnedClipPlayer {
  // Fail fast: a bad pack errors here, at wiring time, not mid-fight.
  for (const [, clip] of clips) assertClipContract(clip, skeletonRoot);

  const mixer = new AnimationMixer(skeletonRoot);
  const actions = new Map<string, AnimationAction>();
  let active: AnimationAction | null = null;
  let activeName: string | null = null;
  let scrub = false;

  const action = (name: string): AnimationAction => {
    let a = actions.get(name);
    if (!a) {
      const clip = clips.get(name);
      if (!clip) throw new Error(`clip "${name}" not in this pack`);
      a = mixer.clipAction(clip);
      actions.set(name, a);
    }
    return a;
  };

  return {
    play(name, opts = {}) {
      const next = action(name);
      next.loop = opts.loop === false ? LoopOnce : LoopRepeat;
      next.clampWhenFinished = opts.loop === false;
      scrub = false;
      next.paused = false;
      if (active && active !== next) {
        next.reset().play();
        if (opts.fadeSec && opts.fadeSec > 0) {
          active.crossFadeTo(next, opts.fadeSec, false);
        } else {
          active.stop();
        }
      } else if (!active) {
        next.reset().play();
      }
      active = next;
      activeName = name;
    },
    setSpeed(mps) {
      mixer.timeScale = Math.max(0, mps / WALK_BASE_MPS);
    },
    sampleAtPhase(phase01) {
      if (!active) return;
      scrub = true;
      active.paused = true;
      const dur = active.getClip().duration;
      active.time = Math.max(0, Math.min(1, phase01)) * dur;
      mixer.timeScale = 1;
      mixer.update(0);
    },
    update(dt) {
      if (!scrub) mixer.update(dt);
    },
    dispose() {
      mixer.stopAllAction();
      for (const [, a] of actions) mixer.uncacheAction(a.getClip());
      mixer.uncacheRoot(skeletonRoot);
      actions.clear();
      active = null;
      activeName = null;
    },
    clipNames() {
      return [...clips.keys()];
    },
    current() {
      return activeName;
    },
  };
}
