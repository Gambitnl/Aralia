/**
 * @file fightInPlaceHandoff.ts — the World3D → CombatView bridge for in-place fights.
 *
 * Fight-in-place slice 2 ("kill the teleport"): combat still runs in `CombatView`
 * (which owns the turn manager, ability system, and reducers — the verified
 * machinery we are NOT forking), but when a fight starts from the streamed world
 * we want CombatView to render the fight INSIDE that same world instead of a
 * separate battle-map scene. CombatView doesn't have the live `GroundWorld` (it
 * lives in a ref inside `World3DWrapper`), so this tiny module-level store hands
 * it across the phase change.
 *
 * It is deliberately a plain singleton, not React state: the phase swap unmounts
 * `World3DWrapper` and mounts `CombatView`, so a value that survives that
 * transition can't live in either component's tree. The handoff is SET at fight
 * start (World3DWrapper) and READ once at CombatView init; it is cleared when the
 * fight ends so a later placeless fight never accidentally renders in-place.
 *
 * `GroundWorld` is typed loosely here (`unknown`-backed) so this module carries
 * no import of the heavy worldforge bridge stack — CombatView casts it back to
 * the real type at the render boundary.
 */

import type { PatchAnchor } from './inSceneMovement';

/** The world context a fight needs to render in place. */
export interface FightInPlaceHandoff {
  /** The live streamed ground world (opaque here; cast at the render boundary). */
  ground: unknown;
  /**
   * The ground session's chunk loader (opaque; cast to `ChunkLoader` at the
   * render boundary). It is a closure over the built world, so it survives the
   * phase change that unmounts World3DWrapper and lets the combat scene re-stream
   * the SAME terrain the player was walking.
   */
  loader: unknown;
  /** Scene origin (world meters) the World3D scene is drawn relative to. */
  sceneOrigin: { x: number; z: number };
  /** The extraction anchor — the player's world meters when the patch was cut. */
  anchor: PatchAnchor;
  /** Spawn surface Y (m) at the anchor, for camera framing + fallbacks. */
  surfaceY: number;
  /** The seed the ground session runs on (kept for any re-derivation). */
  worldSeed: number;
}

let current: FightInPlaceHandoff | null = null;

/** Publish the world context for the fight about to start. */
export function setFightInPlaceHandoff(handoff: FightInPlaceHandoff): void {
  current = handoff;
}

/** Read the pending in-place fight context, if any. */
export function getFightInPlaceHandoff(): FightInPlaceHandoff | null {
  return current;
}

/** Clear the handoff (call when the fight ends or is routed to the arena). */
export function clearFightInPlaceHandoff(): void {
  current = null;
}
