import { WORLD3D_CONFIG, CHUNKS_PER_CELL } from '../config';

it('exposes coherent chunk sizing constants', () => {
  expect(WORLD3D_CONFIG.CHUNK_WORLD_SIZE).toBeGreaterThan(0);
  expect(WORLD3D_CONFIG.METERS_PER_CELL).toBeGreaterThan(0);
  // One grid cell must be an integer number of chunks.
  expect(WORLD3D_CONFIG.METERS_PER_CELL % WORLD3D_CONFIG.CHUNK_WORLD_SIZE).toBe(0);
  expect(CHUNKS_PER_CELL).toBe(WORLD3D_CONFIG.METERS_PER_CELL / WORLD3D_CONFIG.CHUNK_WORLD_SIZE);
});

it('unload radius is at least the load radius (hysteresis)', () => {
  expect(WORLD3D_CONFIG.UNLOAD_RADIUS).toBeGreaterThanOrEqual(WORLD3D_CONFIG.LOAD_RADIUS);
});

it('heightfield resolution is at least 2 vertices per edge', () => {
  expect(WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION).toBeGreaterThanOrEqual(2);
});
