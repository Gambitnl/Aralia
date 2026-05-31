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
import { chunkKey, worldToChunk } from './coords';
import { computeChunkDiff } from './chunkManager';
import { selectLodTier } from './lod';

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
  private queue: Array<{ cx: number; cy: number }> = [];
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
    this.queue.push(...diff.toLoad);
    this.pump();

    if (this.pending.size === 0 && this.queue.length === 0) {
      this.resolveSettled();
    }
  }

  /** Processes the load queue, respecting concurrent worker-pool limitations. */
  private pump(): void {
    while (this.pending.size < this.maxConcurrent && this.queue.length > 0) {
      const { cx, cy } = this.queue.shift()!;
      const key = chunkKey(cx, cy);
      if (this.loaded.has(key) || this.pending.has(key)) continue;

      this.pending.add(key);
      this.loader(cx, cy)
        .then((geometry) => {
          this.pending.delete(key);
          if (this.disposed) return;

          // Hysteresis boundary safety: drop results if the chunk scrolled out of bounds while loading
          const dist = Math.max(Math.abs(cx - this.centerCx), Math.abs(cy - this.centerCy));
          if (dist <= this.unloadRadius) {
            this.loaded.set(key, { cx, cy, geometry, lod: selectLodTier(dist) });
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
