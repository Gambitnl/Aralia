import { ChunkStreamer } from '../chunkStreamer';
import type { ChunkGeometryArrays, ChunkLoader } from '../types';
import { WORLD3D_CONFIG } from '../config';

// A loader that resolves immediately with trivial geometry.
const fakeGeometry = (): ChunkGeometryArrays => ({
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
  normals: new Float32Array(0),
});
const instantLoader: ChunkLoader = async () => fakeGeometry();

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

it('loads the window around the initial position', async () => {
  const streamer = new ChunkStreamer(instantLoader, { loadRadius: 1, unloadRadius: 2, maxConcurrent: 8 });
  streamer.update(0, 0);
  await streamer.whenSettled();
  expect(streamer.getLoaded()).toHaveLength(9); // 3x3
});

it('unloads chunks that fall outside the unload radius after moving', async () => {
  const streamer = new ChunkStreamer(instantLoader, { loadRadius: 1, unloadRadius: 1, maxConcurrent: 8 });
  streamer.update(0, 0);
  await streamer.whenSettled();
  // Move far east so the original window is well outside unloadRadius.
  streamer.update(S * 20, 0);
  await streamer.whenSettled();
  const loaded = streamer.getLoaded();
  // None of the loaded chunks should be near the origin anymore.
  expect(loaded.every((c) => c.cx >= 19)).toBe(true);
});

it('does not double-load a chunk already loaded or in flight', async () => {
  let calls = 0;
  const countingLoader: ChunkLoader = async (cx, cy) => {
    calls++;
    return fakeGeometry();
  };
  const streamer = new ChunkStreamer(countingLoader, { loadRadius: 1, unloadRadius: 2, maxConcurrent: 8 });
  streamer.update(0, 0);
  streamer.update(0, 0); // same position again before settle
  await streamer.whenSettled();
  expect(calls).toBe(9); // exactly one load per chunk, no duplicates
});

it('notifies subscribers when the loaded set changes', async () => {
  const streamer = new ChunkStreamer(instantLoader, { loadRadius: 1, unloadRadius: 2, maxConcurrent: 8 });
  let notifications = 0;
  streamer.onChange(() => { notifications++; });
  streamer.update(0, 0);
  await streamer.whenSettled();
  expect(notifications).toBeGreaterThan(0);
});

it('tags loaded chunks with an LOD tier', async () => {
  const streamer = new ChunkStreamer(instantLoader, { loadRadius: 2, unloadRadius: 3, maxConcurrent: 16 });
  streamer.update(0, 0);
  await streamer.whenSettled();
  const center = streamer.getLoaded().find((c) => c.cx === 0 && c.cy === 0);
  expect(center?.lod).toBe('full');
});
