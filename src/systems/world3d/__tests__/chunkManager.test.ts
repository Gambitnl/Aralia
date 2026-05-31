import { computeChunkDiff } from '../chunkManager';
import { chunkKey } from '../coords';

it('loads the full square window around the center when nothing is loaded', () => {
  const diff = computeChunkDiff({ cx: 0, cy: 0 }, 1, 2, new Set());
  // Chebyshev radius 1 → 3x3 = 9 chunks.
  expect(diff.toLoad).toHaveLength(9);
  expect(diff.toUnload).toHaveLength(0);
});

it('does not reload already-loaded chunks', () => {
  const loaded = new Set([chunkKey(0, 0), chunkKey(1, 0)]);
  const diff = computeChunkDiff({ cx: 0, cy: 0 }, 1, 2, loaded);
  expect(diff.toLoad).toHaveLength(7); // 9 in window - 2 already loaded
  expect(diff.toLoad.some((c) => c.cx === 0 && c.cy === 0)).toBe(false);
});

it('unloads chunks beyond the unload radius', () => {
  // A chunk far away (cx 10) should be unloaded; one inside the window kept.
  const loaded = new Set([chunkKey(10, 10), chunkKey(0, 0)]);
  const diff = computeChunkDiff({ cx: 0, cy: 0 }, 1, 2, loaded);
  expect(diff.toUnload).toEqual([{ cx: 10, cy: 10 }]);
});

it('keeps chunks within unload radius even if outside load radius (hysteresis)', () => {
  // Chunk at distance 2: outside loadRadius 1 but inside unloadRadius 2 → not unloaded, not reloaded.
  const loaded = new Set([chunkKey(2, 0)]);
  const diff = computeChunkDiff({ cx: 0, cy: 0 }, 1, 2, loaded);
  expect(diff.toUnload).toHaveLength(0);
  expect(diff.toLoad.some((c) => c.cx === 2 && c.cy === 0)).toBe(false);
});

it('orders toLoad closest-first', () => {
  const diff = computeChunkDiff({ cx: 0, cy: 0 }, 2, 3, new Set());
  // First entry must be the center itself (distance 0).
  expect(diff.toLoad[0]).toEqual({ cx: 0, cy: 0 });
  // Distances must be non-decreasing.
  const dist = (c: { cx: number; cy: number }) => Math.max(Math.abs(c.cx), Math.abs(c.cy));
  for (let i = 1; i < diff.toLoad.length; i++) {
    expect(dist(diff.toLoad[i])).toBeGreaterThanOrEqual(dist(diff.toLoad[i - 1]));
  }
});
