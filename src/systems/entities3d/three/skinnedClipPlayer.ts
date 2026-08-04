/**
 * @file skinnedClipPlayer.ts — CC0 clip animation slice 1: play retargeted
 * clips on a skinned entity's own skeleton via an AnimationMixer.
 *
 * The clips are already retargeted to our bone names (clipStore), so the mixer
 * binds them to whatever biped skeleton this entity carries. Playback rate can
 * be synced to real move speed the way the procedural cadence() does, and the
 * debugger scrub can freeze the mixer at a phase.
 */
import { AnimationMixer, LoopOnce, LoopRepeat, Object3D, type AnimationAction, type AnimationClip } from 'three';

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

export function createSkinnedClipPlayer(
  skeletonRoot: Object3D,
  clips: Map<string, AnimationClip>,
): SkinnedClipPlayer {
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
