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
import type { ChunkMeshBundle, ChunkLoader, LodTier } from '@/systems/world3d/types';
import { WORLD3D_CONFIG, resolutionForLod } from '@/systems/world3d/config';

type WorkerFactory = () => Worker;

/** A ChunkLoader that owns a Web Worker and must be disposed when no longer needed. */
export type DisposableChunkLoader = ChunkLoader & { dispose: () => void };

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./chunkWorker.ts', import.meta.url), { type: 'module' });

interface PendingRequest {
  cx: number;
  cy: number;
  /** Resolution this request was dispatched at (per requested LOD tier). */
  resolution: number;
  resolve: (bundle: ChunkMeshBundle) => void;
}

/**
 * Creates a self-healing, disposable ChunkLoader backed by a single background Web Worker.
 */
export function createWorkerChunkLoader(
  world: WorldData,
  resolution: number = WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION,
  workerFactory: WorkerFactory = defaultWorkerFactory,
): DisposableChunkLoader {
  let worker: Worker | null = null;
  let disposed = false;
  let nextId = 1;
  const pending = new Map<number, PendingRequest>();

  const spawn = (): void => {
    const w = workerFactory();
    w.onmessage = (ev: MessageEvent) => {
      const { id, bundle } = ev.data as { id: number; bundle: ChunkMeshBundle };
      const req = pending.get(id);
      if (req) {
        pending.delete(id);
        req.resolve(bundle);
      }
    };
    // If the worker dies, drop it so the next load() transparently respawns a fresh one.
    w.onerror = () => {
      if (worker === w) worker = null;
    };
    w.postMessage({ type: 'init', world });
    // Re-send any in-flight requests stranded on a previous (now-dead) worker,
    // each at the resolution it was originally dispatched with.
    for (const [id, req] of pending) {
      w.postMessage({ type: 'load', id, cx: req.cx, cy: req.cy, resolution: req.resolution });
    }
    worker = w;
  };

  const load = ((cx: number, cy: number, lod?: LodTier): Promise<ChunkMeshBundle> =>
    new Promise<ChunkMeshBundle>((resolve) => {
      if (disposed) return;
      if (!worker) spawn();
      const id = nextId++;
      // Honor the requested LOD tier's resolution (W3D-G10 / T7); fall back to
      // the loader's default resolution when no tier is supplied.
      const reqResolution = lod ? resolutionForLod(lod) : resolution;
      pending.set(id, { cx, cy, resolution: reqResolution, resolve });
      worker!.postMessage({ type: 'load', id, cx, cy, resolution: reqResolution });
    })) as DisposableChunkLoader;

  load.dispose = (): void => {
    disposed = true;
    pending.clear();
    try {
      worker?.terminate();
    } catch {
      /* worker may already be gone */
    }
    worker = null;
  };

  // Warm the worker up front so the first chunk doesn't pay spawn+init latency.
  spawn();

  return load;
}
