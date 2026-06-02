import { ChunkStreamer } from '../chunkStreamer';
import type { ChunkMeshBundle, ChunkLoader } from '../types';
import { WORLD3D_CONFIG } from '../config';

// A loader that resolves immediately with a trivial bundle.
const fakeBundle = (cx = 0, cy = 0): ChunkMeshBundle => ({
  cx,
  cy,
  terrain: {
    positions: new Float32Array(0),
    indices: new Uint32Array(0),
    normals: new Float32Array(0),
    colors: new Float32Array(0),
  },
  sites: [],
});
const instantLoader: ChunkLoader = async (cx, cy) => fakeBundle(cx, cy);

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
    return fakeBundle(cx, cy);
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

it('adopts a swapped loader and retries requests stranded on a dead loader', async () => {
  // Simulates the live worker-teardown failure: the original loader never resolves its pending work.
  const deadLoader: ChunkLoader = () => new Promise<ChunkMeshBundle>(() => {});
  const streamer = new ChunkStreamer(deadLoader, { loadRadius: 1, unloadRadius: 2, maxConcurrent: 4 });
  streamer.update(0, 0);
  expect(streamer.getLoaded()).toHaveLength(0);
  expect(streamer.pendingCount).toBeGreaterThan(0);

  streamer.setLoader(instantLoader);
  await streamer.whenSettled();
  expect(streamer.getLoaded()).toHaveLength(9); // 3x3 window now loads through the live loader.
});

it('setLoader is a no-op for the same loader or a disposed streamer', async () => {
  const streamer = new ChunkStreamer(instantLoader, { loadRadius: 1, unloadRadius: 2, maxConcurrent: 8 });
  streamer.update(0, 0);
  await streamer.whenSettled();
  const before = streamer.getLoaded().length;
  streamer.setLoader(instantLoader);
  expect(streamer.getLoaded()).toHaveLength(before);
  streamer.dispose();
  streamer.setLoader(async (cx, cy) => fakeBundle(cx, cy));
  expect(streamer.isDisposed()).toBe(true);
});

it('tags loaded chunks with an LOD tier', async () => {
  const streamer = new ChunkStreamer(instantLoader, { loadRadius: 2, unloadRadius: 3, maxConcurrent: 16 });
  streamer.update(0, 0);
  await streamer.whenSettled();
  const center = streamer.getLoaded().find((c) => c.cx === 0 && c.cy === 0);
  expect(center?.lod).toBe('full');
});
