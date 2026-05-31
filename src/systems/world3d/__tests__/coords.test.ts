import {
  worldToChunk,
  chunkKey,
  parseChunkKey,
  chunkOriginWorld,
  worldToGrid,
  chunkGridAABB,
} from '../coords';
import { WORLD3D_CONFIG } from '../config';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

it('worldToChunk floors world meters into integer chunk coords', () => {
  expect(worldToChunk(0, 0)).toEqual({ cx: 0, cy: 0 });
  expect(worldToChunk(S - 1, S - 1)).toEqual({ cx: 0, cy: 0 });
  expect(worldToChunk(S, S)).toEqual({ cx: 1, cy: 1 });
  expect(worldToChunk(-1, -1)).toEqual({ cx: -1, cy: -1 });
});

it('chunkKey round-trips through parseChunkKey', () => {
  const k = chunkKey(3, -7);
  expect(typeof k).toBe('string');
  expect(parseChunkKey(k)).toEqual({ cx: 3, cy: -7 });
});

it('chunkOriginWorld returns the min corner in meters', () => {
  expect(chunkOriginWorld(0, 0)).toEqual({ x: 0, y: 0 });
  expect(chunkOriginWorld(2, 3)).toEqual({ x: 2 * S, y: 3 * S });
});

it('worldToGrid divides by METERS_PER_CELL', () => {
  const g = worldToGrid(WORLD3D_CONFIG.METERS_PER_CELL, WORLD3D_CONFIG.METERS_PER_CELL * 2);
  expect(g.x).toBeCloseTo(1);
  expect(g.y).toBeCloseTo(2);
});

it('chunkGridAABB bounds a chunk in grid space', () => {
  const aabb = chunkGridAABB(0, 0);
  expect(aabb.minGX).toBeCloseTo(0);
  expect(aabb.minGY).toBeCloseTo(0);
  // One chunk spans CHUNK_WORLD_SIZE / METERS_PER_CELL grid cells.
  const span = S / WORLD3D_CONFIG.METERS_PER_CELL;
  expect(aabb.maxGX).toBeCloseTo(span);
  expect(aabb.maxGY).toBeCloseTo(span);
});
