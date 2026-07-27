/**
 * @file chunkStreamer.ts
 * @description Stateful sliding-window orchestrator. Holds loaded chunks, drives an injected
 * async ChunkLoader (closest-first, throttled by maxConcurrent), unloads chunks
 * beyond the unload radius, and notifies subscribers on any change.
 *
 * Why this is built this way:
 * - Decoupling the orchestrator from React enables clean unit-testing using synchronous/asynchronous
 *   fakes without rendering hooks or testing-library wrappers.
 * - Concurrency throttling `maxConcurrent` is crucial: spawning too many asynchronous requests
 *   simultaneously causes performance stuttering or network/Web Worker congestion.
 * - Subscription pattern `onChange` matches React's `useSyncExternalStore` paradigm perfectly,
 *   enabling clean, performant, and reactive UI re-renders only when the loaded chunk set changes.
 */
import type { ChunkLoader, LoadedChunk } from './types';
export interface ChunkStreamerOptions {
    loadRadius?: number;
    unloadRadius?: number;
    maxConcurrent?: number;
    resolution?: number;
}
export declare class ChunkStreamer {
    private loader;
    private loadRadius;
    private unloadRadius;
    private maxConcurrent;
    private loaded;
    private pending;
    private queue;
    /** Keys currently sitting in `queue` (dedupe guard for the per-move upgrade scan). */
    private queuedKeys;
    private centerCx;
    private centerCy;
    private listeners;
    private settleResolvers;
    private disposed;
    constructor(loader: ChunkLoader, opts?: ChunkStreamerOptions);
    /**
     * Swap the underlying chunk loader when the host recreates its worker-backed loader.
     * Any requests already pending against the old loader may never resolve after that worker
     * is torn down, so we requeue their coordinates and pump them through the live loader.
     */
    setLoader(loader: ChunkLoader): void;
    /** Recompute the desired window for a world-space position and start loading/unloading. */
    update(worldX: number, worldZ: number): void;
    /** Processes the load queue, respecting concurrent worker-pool limitations. */
    private pump;
    getLoaded(): LoadedChunk[];
    /** True once dispose() has run. A disposed streamer ignores update() and drops in-flight loads. */
    isDisposed(): boolean;
    get pendingCount(): number;
    onChange(cb: () => void): () => void;
    /** Resolves when there are no pending or queued loads, indicating a settled sliding window. */
    whenSettled(): Promise<void>;
    dispose(): void;
    private notify;
    private resolveSettled;
}
