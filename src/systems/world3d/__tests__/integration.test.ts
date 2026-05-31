/**
 * @file integration.test.ts
 * @description End-to-end integration and performance smoke test for the 3D chunk streaming pipeline.
 *
 * Why this is built this way:
 * - Direct inline loader integration connects config, coords, diff logic, lod, sampler,
 *   geometry builders, and the stateful ChunkStreamer orchestration.
 * - Confirms Chebyshev load window geometry correctness (non-NaN positions, index counts).
 * - Implements a soft performance budget check (2000ms) for loading the entire sliding window (81 chunks)
 *   to guard against quadratic slowdowns or sampling regression.
 */

import { ChunkStreamer } from '../chunkStreamer';
import { handleChunkRequest } from '../chunkWorkerCore';
import { WORLD3D_CONFIG } from '../config';
import type { ChunkLoader } from '../types';
import type { WorldData } from '@/services/worldSim/types';

const buildWorld = (): WorldData => {
  const cols = 60;
  const rows = 40;
  const cells = cols * rows;
  const heights: number[] = [];
  for (let i = 0; i < cells; i++) {
    heights.push(Math.max(0, Math.min(100, Math.round(Math.sin(i * 0.13) * 30 + 40))));
  }
  return {
    version: 2, seed: 1, templateId: 'continents',
    gridSize: { rows, cols },
    heights,
    temperatures: new Array(cells).fill(15),
    moisture: new Array(cells).fill(25),
    biomeIds: new Array(cells).fill('plains'),
    rivers: [], roads: [], sites: [], coastlines: [], lakes: [], biomeZones: [],
  };
};

const inlineLoader = (world: WorldData): ChunkLoader => async (cx, cy) =>
  handleChunkRequest(world, { cx, cy, resolution: WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION });

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

it('streams a full window of well-formed chunk geometry', async () => {
  const world = buildWorld();
  const streamer = new ChunkStreamer(inlineLoader(world), { loadRadius: 4, unloadRadius: 6, maxConcurrent: 8 });
  streamer.update(S * 200, S * 100); // somewhere inside the world
  await streamer.whenSettled();

  const loaded = streamer.getLoaded();
  expect(loaded.length).toBe(9 * 9); // (2*4+1)^2
  for (const c of loaded) {
    const res = WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION;
    expect(c.bundle.terrain.positions.length).toBe(res * res * 3);
    expect(c.bundle.terrain.indices.length).toBe((res - 1) * (res - 1) * 6);
    // No NaN in positions.
    for (const v of c.bundle.terrain.positions) expect(Number.isFinite(v)).toBe(true);
  }
});

it('streams the window within the soft performance budget', async () => {
  const world = buildWorld();
  const streamer = new ChunkStreamer(inlineLoader(world), { loadRadius: 4, unloadRadius: 6, maxConcurrent: 8 });
  const startMs = performance.now();
  streamer.update(S * 200, S * 100);
  await streamer.whenSettled();
  const elapsed = performance.now() - startMs;
  expect(elapsed).toBeLessThan(2000); // 81 placeholder chunks well under 2s on the main thread
});
