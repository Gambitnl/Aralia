/**
 * THE WORLD'S GROUND, FOR THE RIVER (ADR 0009 step 6, slice 10, 2026-10-26).
 *
 * The live river's world mode builds its bed from the streamed ground world
 * (its terrain heights and its river lines) and places it in the scene, whose
 * coordinates are world meters less the scene origin. `World3DScene` publishes
 * both here when it mounts the ground profile; the river site reads them when
 * the post chain is ready. A small module of its own, so the scene does not
 * import the river modules (they load only on the river addresses).
 */
import { groundSurfaceY, type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { editGround, groundEditsThisSession } from '@/systems/worldforge/bridge/groundRecord';
import type { GroundShape } from '@/systems/worldforge/terrain/groundShapeProfile';

export interface WorldGroundForRiver {
  ground: GroundWorld;
  origin: SceneOrigin;
}

let current: WorldGroundForRiver | null = null;
const listeners = new Set<(g: WorldGroundForRiver | null) => void>();

/** The scene publishes its ground world and scene origin (null on unmount). */
export function publishWorldGround(g: WorldGroundForRiver | null): void {
  current = g;
  installGroundEditHook();
  for (const l of listeners) l(g);
}

/**
 * `window.__wf3dGround` (agora-257c, 2026-10-29, GG-533): cut a shape into the
 * world's ONE ground (`groundRecord.ts`) from a probe or the console, as a
 * spell will. Coordinates are ground meters (`toGround` turns a scene point
 * into them). `edit` returns the event, or null when the shape changed nothing.
 */
function installGroundEditHook(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __wf3dGround?: unknown }).__wf3dGround = {
    edit: (shape: GroundShape) => {
      if (!current) throw new Error('[ground] No ground world is published.');
      return editGround(current.ground, shape);
    },
    edits: () => groundEditsThisSession(),
    toGround: (sceneX: number, sceneZ: number) => (current ? { x: sceneX + current.origin.x, z: sceneZ + current.origin.z } : null),
    /** The ground's height at a ground-meter point (the record's own sampler; scene y is world y). */
    heightAt: (x: number, z: number) => (current ? groundSurfaceY(current.ground, x, z) : null),
    /**
     * PROBE ONLY (one water, step 1, 2026-10-30): publish a player foot, world
     * m, as if the player stood there, for a check of the river's follow where
     * the town blocks a long walk. The avatar publishes its foot every frame,
     * so the probe foot holds for `holdMs` (the avatar's publishes are
     * ignored until then); `releasePlayerFoot` ends the hold.
     */
    placePlayerFoot: (x: number, z: number, holdMs = 30000) => {
      probeFootUntil = 0;
      publishWorldPlayer({ x, z });
      probeFootUntil = performance.now() + holdMs;
    },
    releasePlayerFoot: () => { probeFootUntil = 0; },
  };
}

export function getWorldGround(): WorldGroundForRiver | null {
  return current;
}

/** Hear each publish; returns the unsubscribe. */
export function onWorldGround(l: (g: WorldGroundForRiver | null) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * THE PLAYER'S FOOT, FOR THE RIVER (one water, step 1, 2026-10-30): world m
 * (the ground world's x and z). The scene publishes it as the player moves;
 * the live river moves its reach along the world's river to follow it.
 */
export interface WorldPlayerFoot { x: number; z: number }

let player: WorldPlayerFoot | null = null;
const playerListeners = new Set<(p: WorldPlayerFoot | null) => void>();
/** While a probe foot holds (`placePlayerFoot`), the scene's publishes are ignored. */
let probeFootUntil = 0;

export function publishWorldPlayer(p: WorldPlayerFoot | null): void {
  if (p && performance.now() < probeFootUntil) return;
  if (p && player && p.x === player.x && p.z === player.z) return;
  player = p;
  for (const l of playerListeners) l(p);
}

export function getWorldPlayer(): WorldPlayerFoot | null {
  return player;
}

/** Hear each move; returns the unsubscribe. */
export function onWorldPlayer(l: (p: WorldPlayerFoot | null) => void): () => void {
  playerListeners.add(l);
  return () => { playerListeners.delete(l); };
}
