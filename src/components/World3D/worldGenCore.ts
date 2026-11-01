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
 * Saved business names and stock travel with the entry request. Both stages
 * use that same read-only registry, so a returning player's existing shop keeps
 * its sign and stock-based dressing. New businesses retain deterministic naming.
 *
 * See docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 15:48:08
 * Dependents: components/World3D/createWorldGenClient.ts, components/World3D/worldGenWorker.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { getWorldforgeLocalForCell } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld, computeGroundProps } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { GroundWorld, MakeGroundWorldOptions } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { LocalArtifact, RegionArtifact } from '@/systems/worldforge/artifacts';
import type { WorldDelta } from '@/systems/worldforge/delta/types';
import type { PropInstance } from '@/systems/worldforge/props/propSchema';
import type { BuildingEventLogsByBurg } from '@/systems/worldforge/interior/blueprintTypes';
import type { BuildingSourcesByBurg } from '@/systems/worldforge/interior/buildingSource';
import type { TownLifeRegistry } from '@/systems/worldforge/roster/agentLife';

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
  /** Existing shop identities and stock; rendering must not regenerate a save. */
  worldBusinesses?: MakeGroundWorldOptions['worldBusinesses'];
  /** Sparse chronological building logs copied from the town-sim registry. */
  buildingEventLogs?: BuildingEventLogsByBurg;
  /** Observed foundations, identities and possessions remain stable on entry. */
  buildingSources?: BuildingSourcesByBurg;
  propGenerationRevision?: MakeGroundWorldOptions['propGenerationRevision'];
  propSources?: MakeGroundWorldOptions['propSources'];
  /** Read-only genealogy; a deceased keeper cannot be baked alive. */
  townLife?: TownLifeRegistry;
  day?: number;
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
  emitStageB: (props: PropInstance[], propSource?: GroundWorld['propSource']) => void;
}

/**
 * Run the two-stage world assembly, emitting each stage as it finishes.
 *
 * Async so a worker host can `await` it, but the work itself is synchronous CPU
 * — the point is that it runs OFF the main thread, not that it yields.
 */
export async function runWorldGen(req: WorldGenRequest, emit: WorldGenEmit): Promise<void> {
  const { wfSeed, entryCellId, centerPx, hour, deltas, worldBusinesses, buildingEventLogs, buildingSources, propGenerationRevision, propSources, townLife, day } = req;

  const { local, region } = getWorldforgeLocalForCell(wfSeed, entryCellId, {
    centerPx,
    townLayouts: townLife,
  });

  // The land/region is resolved; the town is next. This boundary drives the
  // loading screen from "Shaping the land…" to "Raising the town…".
  emit.emitProgress?.('town');

  // Stage A: terrain + town, no props. This is the "you can look around" world.
  // The entry cell doubles as the canopy anchor (forests Task 11): the window's
  // atlas cell decides whether the woods close overhead in the 3D scene.
  const ground = makeGroundWorld(local, wfSeed, region, {
    hour,
    deltas,
    worldBusinesses,
    buildingEventLogs,
    buildingSources,
    propGenerationRevision,
    propSources,
    townLife,
    day,
    skipProps: true,
    anchorCellId: entryCellId,
  });
  emit.emitStageA({ ground, local, region });

  // Both stages read the same saved sources. Otherwise a retained correction
  // can admit successfully while the worker silently redraws its old prop.
  // Neither pass registers a shop or replaces the saved stock or property.
  const props = computeGroundProps(ground, wfSeed, region, {
    hour, deltas, worldBusinesses, buildingSources, propGenerationRevision, propSources, anchorCellId: entryCellId,
  });
  emit.emitStageB(props, ground.propSource);
}
