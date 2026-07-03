/**
 * @file chunkWorker.ts
 * @description Web Worker entry. Thin glue around handleChunkRequest — receives the WorldData
 * once via an `init` message, then answers `load` requests with geometry arrays.
 *
 * Why this is built this way:
 * - Real-time mesh generation of large 3D heightfields is computationally expensive.
 *   Running this task on a background worker thread keeps the React main render thread
 *   silky-smooth at 60fps.
 * - Transferable objects: The Float32Array and Uint32Array backing buffers are passed in
 *   the second argument of postMessage. This transfers ownership of the memory instantly
 *   without doing any deep copies, making off-thread rendering zero-overhead.
 *
 * Known limitations/deferred issues:
 * - Web Workers do not run in Node/jsdom/Vitest environments. Therefore, all worker core logic
 *   lives inside pure, synchronously-testable modules (chunkWorkerCore.ts) so we maintain test coverage.
 */

/// <reference lib="webworker" />
import { handleChunkRequest } from '@/systems/world3d/chunkWorkerCore';
import type { WorldData } from '@/services/worldSim/types';

let world: WorldData | null = null;

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    world = msg.world as WorldData;
    return;
  }
  if (msg.type === 'load' && world) {
    const bundle = handleChunkRequest(world, { cx: msg.cx, cy: msg.cy, resolution: msg.resolution });

    // Transfer all underlying array buffers so it's a zero-copy transfer to the main thread
    const transfer: Transferable[] = [
      bundle.terrain.positions.buffer,
      bundle.terrain.indices.buffer,
      bundle.terrain.normals.buffer,
      bundle.terrain.colors.buffer,
    ];
    if (bundle.terrain.skirts) {
      for (const strip of Object.values(bundle.terrain.skirts)) {
        transfer.push(strip.positions.buffer, strip.indices.buffer, strip.normals.buffer, strip.colors.buffer);
      }
    }
    if (bundle.water) transfer.push(bundle.water.positions.buffer, bundle.water.indices.buffer, bundle.water.normals.buffer);
    if (bundle.roads) transfer.push(bundle.roads.positions.buffer, bundle.roads.indices.buffer, bundle.roads.normals.buffer);
    if (bundle.vegetation) transfer.push(bundle.vegetation.positions.buffer, bundle.vegetation.scales.buffer, bundle.vegetation.rotations.buffer);
    (self as unknown as Worker).postMessage({ id: msg.id, bundle }, transfer);
  }
};
