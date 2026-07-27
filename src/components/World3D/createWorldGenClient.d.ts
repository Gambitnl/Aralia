/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 23:01:56
 * Dependents: App.tsx, components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file createWorldGenClient.ts
 * @description Host-side client for staged, off-thread 3D world entry. Owns a
 * single world-gen worker and streams the two build stages back to the consumer:
 *
 *   Stage A — terrain + town. The worker returns the `ground` data (props empty)
 *             plus the local + region artifacts. The client rebuilds the cheap
 *             per-chunk loader closure from `ground` (via buildGroundLoaderFromWorld)
 *             and hands it to the consumer so the scene can render immediately.
 *   Stage B — props. The worker returns the props array; the client patches it
 *             into the SAME `ground` object the scene already holds, so dressing
 *             pops in without a second world.
 *
 * Correlation + supersession: each request gets a monotonic id and only the
 * latest id is "live". A re-entry (React StrictMode double-mount, or a fast
 * re-entry to a new cell) supersedes the previous request — late replies from a
 * superseded request are dropped, exactly like createWorkerChunkLoader's pending
 * map. The worker is owned here and disposed on unmount; a dead worker respawns
 * on the next generate().
 *
 * A workerFactory is injectable so tests can drive a synchronous fake worker.
 * See docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 */
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { ChunkLoader } from '@/systems/world3d/types';
import type { LocalArtifact, RegionArtifact } from '@/systems/worldforge/artifacts';
import type { WorldGenRequest, WorldGenProgress } from './worldGenCore';
type WorkerFactory = () => Worker;
/** Stage A delivered to the consumer: the render-ready world + rebuilt loader. */
export interface WorldGenStageAResult {
    ground: GroundWorld;
    local: LocalArtifact;
    region: RegionArtifact | undefined;
    loader: ChunkLoader;
}
/** Consumer callbacks for one generate() request. */
export interface WorldGenStages {
    /** A sub-step boundary was crossed (drives the loading-screen label). */
    onProgress?: (stage: WorldGenProgress) => void;
    /** Terrain + town ready — render now. */
    onStageA: (result: WorldGenStageAResult) => void;
    /** Props patched into the Stage A ground — dressing can render. */
    onStageB: (ground: GroundWorld) => void;
    /** The worker failed to build this world (no-fallback: surface it). */
    onError?: (message: string) => void;
}
/** A world-gen client that owns a worker and must be disposed when done. */
export interface DisposableWorldGenClient {
    generate: (req: WorldGenRequest, stages: WorldGenStages) => void;
    dispose: () => void;
}
export declare function createWorldGenClient(workerFactory?: WorkerFactory): DisposableWorldGenClient;
/**
 * Build one complete GroundWorld and dispose its worker immediately afterward.
 *
 * World3D uses the streaming client because it can render Stage A before props
 * arrive. Production systems such as a travel encounter need the opposite
 * contract: do not project combat until the full source artifact is ready. This
 * adapter preserves the same worker pipeline while giving those callers one
 * promise and one explicit error boundary.
 */
export declare function loadCompleteGroundWorld(req: WorldGenRequest, workerFactory?: WorkerFactory): Promise<GroundWorld>;
export {};
