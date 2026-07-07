/**
 * @file worldGenCore.ts
 * @description Pure orchestration for staged, off-thread 3D world entry — the
 * work the world-gen worker performs. Kept DOM-free and framework-free so it
 * runs unchanged inside a Web Worker (worldGenWorker.ts) and is directly
 * testable in a node environment.
 *
 * Two stages, in the order the player perceives them:
 *   Stage A — resolve the local + region for the entry cell and assemble the
 *             ground WITHOUT props (terrain + town). This is what lets the scene
 *             render fast so the player can look around.
 *   Stage B — compute the WAVE-1 props (dressing) for that world.
 *
 * The worker has no access to Redux state, so props are built WITHOUT registered
 * businesses. That is safe by construction: `makeGroundWorld`'s deterministic
 * name fallback derives from the same seed formula the main-thread registration
 * uses, so the names match (see the design doc's Stage C invariant).
 *
 * See docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 */
import { getWorldforgeLocalForCell } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld, computeGroundProps } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { LocalArtifact, RegionArtifact } from '@/systems/worldforge/artifacts';
import type { WorldDelta } from '@/systems/worldforge/delta/types';
import type { PropInstance } from '@/systems/worldforge/props/propSchema';

/** Everything the worker needs to build a world — all structured-clone-safe. */
export interface WorldGenRequest {
  wfSeed: number;
  entryCellId: number;
  /** Burg pixel position so the window frames the town; omit for wilderness. */
  centerPx?: readonly [number, number];
  /** In-game hour 0–23 (drives occupant placement). */
  hour: number;
  /** Saved plot edits replayed onto the town before it assembles. */
  deltas?: WorldDelta[];
}

/** Stage A payload: the fast terrain + town world plus the artifacts the main
 * thread needs for tile identity and NPC/shop registration. */
export interface WorldGenStageA {
  /** Assembled world with `props: []` — dressing arrives in Stage B. */
  ground: GroundWorld;
  local: LocalArtifact;
  region: RegionArtifact | undefined;
}

/** A named boundary between heavy steps, for the staged loading screen. */
export type WorldGenProgress = 'town';

/** Callbacks the core invokes as each stage completes. */
export interface WorldGenEmit {
  /** Fired when real work crosses a sub-step boundary (drives loading labels). */
  emitProgress?: (stage: WorldGenProgress) => void;
  emitStageA: (a: WorldGenStageA) => void;
  emitStageB: (props: PropInstance[]) => void;
}

/**
 * Run the two-stage world assembly, emitting each stage as it finishes.
 *
 * Async so a worker host can `await` it, but the work itself is synchronous CPU
 * — the point is that it runs OFF the main thread, not that it yields.
 */
export async function runWorldGen(req: WorldGenRequest, emit: WorldGenEmit): Promise<void> {
  const { wfSeed, entryCellId, centerPx, hour, deltas } = req;

  const { local, region } = getWorldforgeLocalForCell(wfSeed, entryCellId, {
    centerPx,
  });

  // The land/region is resolved; the town is next. This boundary drives the
  // loading screen from "Shaping the land…" to "Raising the town…".
  emit.emitProgress?.('town');

  // Stage A: terrain + town, no props. This is the "you can look around" world.
  const ground = makeGroundWorld(local, wfSeed, region, { hour, deltas, skipProps: true });
  emit.emitStageA({ ground, local, region });

  // Stage B: dressing. Built without registered businesses — the deterministic
  // fallback matches what registration produces (design doc Stage C invariant).
  const props = computeGroundProps(ground, wfSeed, region, { hour, deltas });
  emit.emitStageB(props);
}
