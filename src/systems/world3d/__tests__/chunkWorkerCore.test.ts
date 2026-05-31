import { handleChunkRequest } from '../chunkWorkerCore';
import type { WorldData } from '@/services/worldSim/types';

const flatWorld = (cols: number, rows: number, h: number): WorldData => ({
  version: 2,
  seed: 1,
  templateId: 't',
  gridSize: { rows, cols },
  heights: new Array(cols * rows).fill(h),
  temperatures: [],
  moisture: [],
  biomeIds: [],
  rivers: [],
  roads: [],
  sites: [],
  coastlines: [],
  lakes: [],
  biomeZones: [],
});

it('produces a bundle with terrain geometry for a chunk request', () => {
  const bundle = handleChunkRequest(flatWorld(8, 8, 40), { cx: 0, cy: 0, resolution: 6 });
  expect(bundle.terrain.positions.length).toBe(6 * 6 * 3);
  expect(bundle.terrain.indices.length).toBe((6 - 1) * (6 - 1) * 6);
  expect(bundle.terrain.colors.length).toBe(6 * 6 * 3);
});

it('is deterministic for the same world + request', () => {
  const world = flatWorld(8, 8, 55);
  const a = handleChunkRequest(world, { cx: 1, cy: 2, resolution: 5 });
  const b = handleChunkRequest(world, { cx: 1, cy: 2, resolution: 5 });
  expect(Array.from(a.terrain.positions)).toEqual(Array.from(b.terrain.positions));
});
