/**
 * @file createWorkerChunkLoader.ts
 * @description Build a ChunkLoader backed by a single Web Worker. The worker is initialized
 * with the WorldData; each load() call sends a request tagged with a unique id and resolves
 * when the matching response arrives.
 *
 * Why this is built this way:
 * - A single Web Worker handles requests concurrently. Each request maps to a unique ID and a
 *   resolver stored in a `pending` Map, so responses correlate back to the caller even out-of-order.
 * - **Self-healing worker lifecycle.** The loader OWNS its worker and exposes `dispose()`. If the
 *   worker dies (worker `error`, or it was never spawned yet) the next load() respawns it, re-sends
 *   `init`, and re-posts any in-flight requests that were stranded on the dead worker. This is what
 *   prevents the "empty 3D world" bug: previously the host (World3DWrapper) terminated the worker
 *   out-of-band (React StrictMode dev double-mount), leaving the chunk streamer posting forever to a
 *   dead worker that never replied. Now a terminated worker is transparently recreated.
 * - Injected workerFactory: lets unit tests substitute a synchronous in-process FakeWorker.
 */
import type { WorldData } from '@/services/worldSim/types';
import type { ChunkLoader } from '@/systems/world3d/types';
type WorkerFactory = () => Worker;
/** A ChunkLoader that owns a Web Worker and must be disposed when no longer needed. */
export type DisposableChunkLoader = ChunkLoader & {
    dispose: () => void;
};
/**
 * Creates a self-healing, disposable ChunkLoader backed by a single background Web Worker.
 */
export declare function createWorkerChunkLoader(world: WorldData, resolution?: number, workerFactory?: WorkerFactory): DisposableChunkLoader;
export {};
