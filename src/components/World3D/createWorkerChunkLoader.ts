/**
 * @file createWorkerChunkLoader.ts
 * @description Build a ChunkLoader backed by a single Web Worker. The worker is initialized
 * once with the WorldData; each load() call sends a request tagged with a unique
 * id and resolves when the matching response arrives.
 *
 * Why this is built this way:
 * - A single Web Worker handles requests sequentially/concurrently. We map each request to a unique ID
 *   and store a resolver promise callback in a `pending` Map. This guarantees that responses
 *   are perfectly correlated back to the caller even if they arrive out-of-order.
 * - Injected workerFactory: By injecting `workerFactory`, we allow unit tests to substitute
 *   a `FakeWorker` that runs synchronously in-process, giving us full testability of the loader
 *   wrapper logic without browser worker environments.
 */

import type { WorldData } from '@/services/worldSim/types';
import type { ChunkGeometryArrays, ChunkLoader } from '@/systems/world3d/types';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';

type WorkerFactory = () => Worker;

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./chunkWorker.ts', import.meta.url), { type: 'module' });

/**
 * Creates a ChunkLoader instance backed by a background Web Worker pool.
 */
export function createWorkerChunkLoader(
  world: WorldData,
  resolution: number = WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION,
  workerFactory: WorkerFactory = defaultWorkerFactory,
): ChunkLoader {
  const worker = workerFactory();
  worker.postMessage({ type: 'init', world });

  let nextId = 1;
  const pending = new Map<number, (geo: ChunkGeometryArrays) => void>();

  worker.onmessage = (ev: MessageEvent) => {
    const { id, geometry } = ev.data as { id: number; geometry: ChunkGeometryArrays };
    const resolve = pending.get(id);
    if (resolve) {
      pending.delete(id);
      resolve(geometry);
    }
  };

  return (cx: number, cy: number): Promise<ChunkGeometryArrays> =>
    new Promise<ChunkGeometryArrays>((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      worker.postMessage({ type: 'load', id, cx, cy, resolution });
    });
}
