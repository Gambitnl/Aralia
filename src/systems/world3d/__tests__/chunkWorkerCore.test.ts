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

it('produces geometry arrays for a chunk request', () => {
  const geo = handleChunkRequest(flatWorld(8, 8, 40), { cx: 0, cy: 0, resolution: 6 });
  expect(geo.positions.length).toBe(6 * 6 * 3);
  expect(geo.indices.length).toBe((6 - 1) * (6 - 1) * 6);
  expect(geo.normals.length).toBe(6 * 6 * 3);
});

it('is deterministic for the same world + request', () => {
  const world = flatWorld(8, 8, 55);
  const a = handleChunkRequest(world, { cx: 1, cy: 2, resolution: 5 });
  const b = handleChunkRequest(world, { cx: 1, cy: 2, resolution: 5 });
  expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
});
