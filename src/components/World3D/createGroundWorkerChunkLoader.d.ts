/**
 * @file createGroundWorkerChunkLoader.ts
 * @description A ChunkLoader for GROUND mode backed by a single Web Worker. The
 * worker is init'd once with the assembled `GroundWorld`; each load() sends a
 * request tagged with a unique id and resolves when the matching response
 * arrives. Mirrors createWorkerChunkLoader (the continent path).
 *
 * Why this is built this way:
 * - Ground chunk meshing (sampleGroundChunk + buildChunkBundle +
 *   buildGroundVegetation) is heavy and ran on the main thread as the player
 *   walked, causing stutter. This moves it off-thread.
 * - **Self-healing worker lifecycle.** The loader OWNS its worker and exposes
 *   `dispose()`. If the worker dies (worker `error`, or it was never spawned yet)
 *   the next load() respawns it, re-sends `init`, and re-posts any in-flight
 *   requests stranded on the dead worker. This is what prevents the "empty 3D
 *   world" bug: a prior ground-worker attempt (W3DUI-1) terminated the worker out
 *   of band under React StrictMode's dev double-mount, leaving the streamer
 *   posting forever to a dead worker.
 * - Injected workerFactory: lets unit tests substitute a synchronous FakeWorker.
 *
 * See docs/superpowers/specs/2026-07-07-offthread-ground-chunk-meshing-design.md.
 */
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { ChunkLoader } from '@/systems/world3d/types';
type WorkerFactory = () => Worker;
/** A ChunkLoader that owns a Web Worker and must be disposed when no longer needed. */
export type DisposableChunkLoader = ChunkLoader & {
    dispose: () => void;
};
/**
 * Creates a self-healing, disposable ChunkLoader backed by a single background
 * Web Worker that meshes ground chunks from an assembled GroundWorld.
 */
export declare function createGroundWorkerChunkLoader(ground: GroundWorld, resolution?: number, workerFactory?: WorkerFactory): DisposableChunkLoader;
export {};
