import { createWorkerChunkLoader } from '../createWorkerChunkLoader';
import { handleChunkRequest } from '@/systems/world3d/chunkWorkerCore';
import type { WorldData } from '@/services/worldSim/types';

const flatWorld = (cols: number, rows: number, h: number): WorldData => ({
  version: 2, seed: 1, templateId: 't',
  gridSize: { rows, cols },
  heights: new Array(cols * rows).fill(h),
  temperatures: [], moisture: [], biomeIds: [],
  rivers: [], roads: [], sites: [], coastlines: [], lakes: [], biomeZones: [],
});

/**
 * Minimal fake Worker that runs handleChunkRequest synchronously in-process and
 * posts the result back via the message event. Mirrors the real worker protocol:
 *   { type: 'init', world }   → store world
 *   { type: 'load', id, cx, cy, resolution } → reply { id, bundle }
 */
class FakeWorker {
  onmessage: ((ev: { data: any }) => void) | null = null;
  private world: WorldData | null = null;
  postMessage(msg: any) {
    if (msg.type === 'init') {
      this.world = msg.world;
      return;
    }
    if (msg.type === 'load' && this.world) {
      const bundle = handleChunkRequest(this.world, { cx: msg.cx, cy: msg.cy, resolution: msg.resolution });
      // Simulate async dispatch.
      queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, bundle } }));
    }
  }
  terminate() {}
}

it('resolves a chunk load with geometry from the worker', async () => {
  const loader = createWorkerChunkLoader(flatWorld(8, 8, 25), 4, () => new FakeWorker() as unknown as Worker);
  const bundle = await loader(0, 0);
  expect(bundle.terrain.positions.length).toBe(4 * 4 * 3);
  expect(bundle.terrain.indices.length).toBe((4 - 1) * (4 - 1) * 6);
});

it('correlates concurrent requests to the right responses', async () => {
  const loader = createWorkerChunkLoader(flatWorld(64, 8, 10), 3, () => new FakeWorker() as unknown as Worker);
  const [a, b] = await Promise.all([loader(0, 0), loader(5, 1)]);
  expect(a.terrain.positions.length).toBe(3 * 3 * 3);
  expect(b.terrain.positions.length).toBe(3 * 3 * 3);
});
