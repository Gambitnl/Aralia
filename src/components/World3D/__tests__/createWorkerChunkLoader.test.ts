import { createWorkerChunkLoader } from '../createWorkerChunkLoader';
import { handleChunkRequest } from '@/systems/world3d/chunkWorkerCore';
import { terrainVertexCount } from '@/systems/world3d/chunkGeometry';
import { resolutionForLod } from '@/systems/world3d/config';
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

it('resolves a chunk load with geometry from the worker (default resolution, skirted)', async () => {
  const loader = createWorkerChunkLoader(flatWorld(8, 8, 25), 4, () => new FakeWorker() as unknown as Worker);
  const bundle = await loader(0, 0);
  // No LOD tier supplied → loader's default resolution (4); terrain is skirted.
  expect(bundle.terrain.positions.length).toBe(terrainVertexCount(4, true) * 3);
});

it('correlates concurrent requests to the right responses', async () => {
  const loader = createWorkerChunkLoader(flatWorld(64, 8, 10), 3, () => new FakeWorker() as unknown as Worker);
  const [a, b] = await Promise.all([loader(0, 0), loader(5, 1)]);
  expect(a.terrain.positions.length).toBe(terrainVertexCount(3, true) * 3);
  expect(b.terrain.positions.length).toBe(terrainVertexCount(3, true) * 3);
});

it('honors the requested LOD tier resolution (W3D-G10 / T7)', async () => {
  const loader = createWorkerChunkLoader(flatWorld(64, 64, 30), 16, () => new FakeWorker() as unknown as Worker);
  const [full, mid, low] = await Promise.all([loader(0, 0, 'full'), loader(2, 0, 'mid'), loader(5, 0, 'low')]);
  expect(full.terrain.positions.length).toBe(terrainVertexCount(resolutionForLod('full'), true) * 3);
  expect(mid.terrain.positions.length).toBe(terrainVertexCount(resolutionForLod('mid'), true) * 3);
  expect(low.terrain.positions.length).toBe(terrainVertexCount(resolutionForLod('low'), true) * 3);
  // Coarser tiers must have strictly fewer vertices than finer ones.
  expect(low.terrain.positions.length).toBeLessThan(mid.terrain.positions.length);
  expect(mid.terrain.positions.length).toBeLessThan(full.terrain.positions.length);
});
