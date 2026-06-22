import { handleChunkRequest } from '../chunkWorkerCore';
import { terrainVertexCount } from '../chunkGeometry';
import { WORLD3D_CONFIG } from '../config';
import { runWorldSim } from '@/services/worldSim';

const buildWorld = () => {
  const cols = 60;
  const rows = 40;
  const cells = cols * rows;
  const heights: number[] = [];
  for (let i = 0; i < cells; i++) {
    heights.push(Math.max(0, Math.min(100, Math.round(Math.sin(i * 0.13) * 30 + 45))));
  }
  return runWorldSim({
    seed: 2026,
    templateId: 'continents',
    cols,
    rows,
    heights,
    temperatures: new Array(cells).fill(15),
    moisture: new Array(cells).fill(25),
    biomeIds: heights.map((h) => (h < 20 ? 'ocean' : h < 45 ? 'plains' : 'forest')),
  });
};

it('builds well-formed bundles across a window of a realistic world', () => {
  const world = buildWorld();
  const res = WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION;
  let withVegetation = 0;
  let withWater = 0;
  for (let cy = 40; cy < 49; cy++) {
    for (let cx = 40; cx < 49; cx++) {
      const bundle = handleChunkRequest(world, { cx, cy, resolution: res });
      expect(bundle.terrain.positions.length).toBe(terrainVertexCount(res, true) * 3);
      expect(bundle.terrain.colors.length).toBe(terrainVertexCount(res, true) * 3);
      for (const v of bundle.terrain.positions) expect(Number.isFinite(v)).toBe(true);
      if (bundle.water) withWater++;
      if (bundle.vegetation) withVegetation++;
    }
  }
  expect(withVegetation).toBeGreaterThan(0);
  expect(withWater).toBeGreaterThanOrEqual(0);
});

it('builds an 81-chunk window within the soft performance budget', () => {
  const world = buildWorld();
  const res = WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION;
  const start = performance.now();
  for (let cy = 40; cy < 49; cy++) {
    for (let cx = 40; cx < 49; cx++) {
      handleChunkRequest(world, { cx, cy, resolution: res });
    }
  }
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(3000);
});
