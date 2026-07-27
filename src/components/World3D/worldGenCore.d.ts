/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 15:48:46
 * Dependents: components/World3D/createWorldGenClient.ts, components/World3D/worldGenWorker.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { LocalArtifact, RegionArtifact } from '@/systems/worldforge/artifacts';
import type { WorldDelta } from '@/systems/worldforge/delta/types';
import type { PropInstance } from '@/systems/worldforge/props/propSchema';
import type { BuildingEventLogsByBurg } from '@/systems/worldforge/interior/blueprintTypes';
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
    /** Sparse chronological building logs copied from the town-sim registry. */
    buildingEventLogs?: BuildingEventLogsByBurg;
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
export declare function runWorldGen(req: WorldGenRequest, emit: WorldGenEmit): Promise<void>;
