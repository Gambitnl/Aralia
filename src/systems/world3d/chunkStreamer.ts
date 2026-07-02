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
import { WORLD3D_CONFIG } from './config';
import { chunkKey, parseChunkKey, worldToChunk } from './coords';
import { computeChunkDiff } from './chunkManager';
import { isFinerLod, selectLodTier } from './lod';

export interface ChunkStreamerOptions {
  loadRadius?: number;
  unloadRadius?: number;
  maxConcurrent?: number;
  resolution?: number;
}

export class ChunkStreamer {
  private loader: ChunkLoader;
  private loadRadius: number;
  private unloadRadius: number;
  private maxConcurrent: number;

  private loaded = new Map<string, LoadedChunk>();
  private pending = new Set<string>();
  private queue: Array<{ cx: number; cy: number; upgrade?: boolean }> = [];
  /** Keys currently sitting in `queue` (dedupe guard for the per-move upgrade scan). */
  private queuedKeys = new Set<string>();
  private centerCx = 0;
  private centerCy = 0;
  private listeners = new Set<() => void>();
  private settleResolvers: Array<() => void> = [];
  private disposed = false;

  constructor(loader: ChunkLoader, opts: ChunkStreamerOptions = {}) {
    this.loader = loader;
    this.loadRadius = opts.loadRadius ?? WORLD3D_CONFIG.LOAD_RADIUS;
    this.unloadRadius = opts.unloadRadius ?? WORLD3D_CONFIG.UNLOAD_RADIUS;
    this.maxConcurrent = opts.maxConcurrent ?? WORLD3D_CONFIG.MAX_CONCURRENT_LOADS;
  }

  /**
   * Swap the underlying chunk loader when the host recreates its worker-backed loader.
   * Any requests already pending against the old loader may never resolve after that worker
   * is torn down, so we requeue their coordinates and pump them through the live loader.
   */
  setLoader(loader: ChunkLoader): void {
    if (this.disposed || loader === this.loader) return;
    this.loader = loader;
    for (const key of [...this.pending]) {
      const { cx, cy } = parseChunkKey(key);
      // A pending key that is ALSO loaded was an in-flight LOD upgrade — keep
      // the flag or pump() would drop the requeued entry as already loaded.
      this.queue.unshift({ cx, cy, upgrade: this.loaded.has(key) });
      this.queuedKeys.add(key);
    }
    this.pending.clear();
    this.pump();
  }

  /** Recompute the desired window for a world-space position and start loading/unloading. */
  update(worldX: number, worldZ: number): void {
    if (this.disposed) return;
    const { cx, cy } = worldToChunk(worldX, worldZ);
    this.centerCx = cx;
    this.centerCy = cy;

    const loadedKeys = new Set([...this.loaded.keys(), ...this.pending]);
    const diff = computeChunkDiff({ cx, cy }, this.loadRadius, this.unloadRadius, loadedKeys);

    // Unload chunks strictly beyond hysteresis bounds
    let changed = false;
    for (const { cx: ux, cy: uy } of diff.toUnload) {
      if (this.loaded.delete(chunkKey(ux, uy))) {
        changed = true;
      }
    }
    if (changed) this.notify();

    // Enqueue new load targets (computed nearest-first)
    for (const target of diff.toLoad) {
      this.queue.push(target);
      this.queuedKeys.add(chunkKey(target.cx, target.cy));
    }

    // LOD upgrade pass: a loaded chunk whose required tier is now FINER than
    // the tier it was built at re-queues for a rebuild at the finer tier.
    // Without this, pump() skips loaded keys forever and a stale low-res chunk
    // sits next to full-res ones as the camera approaches. Upgrade-only by
    // design: downgrades keep the finer (still watertight) mesh until the
    // chunk unloads, which also prevents reload churn at tier boundaries.
    for (const chunk of this.loaded.values()) {
      const key = chunkKey(chunk.cx, chunk.cy);
      if (this.pending.has(key) || this.queuedKeys.has(key)) continue;
      const dist = Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cy - cy));
      if (isFinerLod(selectLodTier(dist), chunk.lod)) {
        this.queue.push({ cx: chunk.cx, cy: chunk.cy, upgrade: true });
        this.queuedKeys.add(key);
      }
    }
    this.pump();

    if (this.pending.size === 0 && this.queue.length === 0) {
      this.resolveSettled();
    }
  }

  /** Processes the load queue, respecting concurrent worker-pool limitations. */
  private pump(): void {
    while (this.pending.size < this.maxConcurrent && this.queue.length > 0) {
      const entry = this.queue.shift()!;
      const { cx, cy } = entry;
      const key = chunkKey(cx, cy);
      this.queuedKeys.delete(key);
      if (this.pending.has(key)) continue;
      if (this.loaded.has(key) && !entry.upgrade) continue;

      this.pending.add(key);
      // Carry the requested LOD tier into the loader so it builds the chunk at
      // the matching mesh resolution (W3D-G10 / T7). The tier is computed from
      // the chunk's distance at request time; the final stored tier is
      // recomputed on resolve in case the camera moved while loading.
      const requestDist = Math.max(Math.abs(cx - this.centerCx), Math.abs(cy - this.centerCy));
      this.loader(cx, cy, selectLodTier(requestDist))
        .then((bundle) => {
          this.pending.delete(key);
          if (this.disposed) return;

          // Hysteresis boundary safety: drop results if the chunk scrolled out of bounds while loading
          const dist = Math.max(Math.abs(cx - this.centerCx), Math.abs(cy - this.centerCy));
          if (dist <= this.unloadRadius) {
            this.loaded.set(key, { cx, cy, bundle, lod: selectLodTier(dist) });
            this.notify();
          }
          this.pump();
          if (this.pending.size === 0 && this.queue.length === 0) {
            this.resolveSettled();
          }
        })
        .catch(() => {
          this.pending.delete(key);
          this.pump();
          if (this.pending.size === 0 && this.queue.length === 0) {
            this.resolveSettled();
          }
        });
    }
  }

  getLoaded(): LoadedChunk[] {
    return [...this.loaded.values()];
  }

  /** True once dispose() has run. A disposed streamer ignores update() and drops in-flight loads. */
  isDisposed(): boolean {
    return this.disposed;
  }

  get pendingCount(): number {
    return this.pending.size + this.queue.length;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Resolves when there are no pending or queued loads, indicating a settled sliding window. */
  whenSettled(): Promise<void> {
    if (this.pending.size === 0 && this.queue.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.settleResolvers.push(resolve));
  }

  dispose(): void {
    this.disposed = true;
    this.loaded.clear();
    this.pending.clear();
    this.queue = [];
    this.queuedKeys.clear();
    this.listeners.clear();
    this.resolveSettled();
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private resolveSettled(): void {
    const resolvers = this.settleResolvers;
    this.settleResolvers = [];
    for (const r of resolvers) r();
  }
}
