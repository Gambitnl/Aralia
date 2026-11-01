/**
 * @file groundChunkWorker.ts
 * @description Web Worker entry for GROUND chunk meshing. Thin glue around
 * handleGroundChunkRequest — receives the assembled GroundWorld once via an
 * `init` message, then answers `load` requests with mesh bundles. Mirrors
 * chunkWorker.ts (the continent path).
 *
 * Why this is built this way:
 * - Meshing large ground heightfields per chunk is expensive; running it here
 *   keeps the React main thread smooth while the player walks.
 * - Transferable objects: the Float32Array / Uint32Array backing buffers are
 *   passed as the second argument of postMessage, transferring ownership without
 *   a deep copy (zero-copy hand-off).
 * - GG-573 (2026-11-02): the `init` can also arrive on a MessagePort (an
 *   `init-port` message). The world-gen worker posts the Stage A ground into
 *   that port, so the main thread does not clone a 700-building ground a second
 *   time. A `load` that comes before the ground waits in `waiting` and runs, in
 *   order, when the ground lands. A plain `init` (respawn, cached entry) works
 *   as before.
 *
 * Known limitations/deferred issues:
 * - Web Workers do not run in Node/jsdom/Vitest. All mesh logic therefore lives
 *   in the pure, synchronously-testable groundChunkWorkerCore.ts.
 */

/// <reference lib="webworker" />
import { handleGroundChunkRequest } from '@/systems/worldforge/bridge/groundChunkWorkerCore';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';

interface LoadRequest { type: 'load'; id: number; cx: number; cy: number; resolution: number }
type MeshRequest = { type: 'init'; ground: GroundWorld } | LoadRequest;

let ground: GroundWorld | null = null;
const waiting: LoadRequest[] = [];

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data as MeshRequest | { type: 'init-port'; port: MessagePort };
  if (msg.type === 'init-port') {
    const port = msg.port;
    port.onmessage = (portEv: MessageEvent) => {
      handle(portEv.data as MeshRequest);
      port.close();
    };
    return;
  }
  handle(msg);
};

function handle(msg: MeshRequest): void {
  if (msg.type === 'init') {
    ground = msg.ground;
    for (const queued of waiting.splice(0)) meshAndPost(ground, queued);
    return;
  }
  if (msg.type !== 'load') return;
  if (!ground) {
    waiting.push(msg);
    return;
  }
  meshAndPost(ground, msg);
}

function meshAndPost(world: GroundWorld, msg: LoadRequest): void {
  const bundle = handleGroundChunkRequest(world, { cx: msg.cx, cy: msg.cy, resolution: msg.resolution });

  // Transfer all underlying array buffers so it's a zero-copy transfer to the main thread.
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
  if (bundle.roads) {
    transfer.push(bundle.roads.positions.buffer, bundle.roads.indices.buffer, bundle.roads.normals.buffer);
    if (bundle.roads.colors) transfer.push(bundle.roads.colors.buffer);
  }
  if (bundle.vegetation) transfer.push(bundle.vegetation.positions.buffer, bundle.vegetation.scales.buffer, bundle.vegetation.rotations.buffer);
  if (bundle.bushes) transfer.push(bundle.bushes.positions.buffer, bundle.bushes.scales.buffer, bundle.bushes.rotations.buffer);
  (self as unknown as Worker).postMessage({ id: msg.id, bundle }, transfer);
}
