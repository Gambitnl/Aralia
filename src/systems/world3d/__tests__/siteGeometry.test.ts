import { buildSiteMeshes } from '../siteGeometry';
import type { ChunkData } from '../types';

const chunkWithTown = (): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: 4,
  heights: new Float32Array(16).fill(40),
  biomeIds: new Array(16).fill('plains'),
  rivers: [],
  roads: [],
  sites: [
    {
      id: 't0',
      kind: 'town',
      position: { x: 0.05, y: 0.05 },
      footprint: [
        { x: 0.04, y: 0.04 },
        { x: 0.06, y: 0.04 },
        { x: 0.06, y: 0.06 },
        { x: 0.04, y: 0.06 },
      ],
      walled: true,
    },
  ],
});

it('returns no site placements when the chunk has none', () => {
  const data = chunkWithTown();
  data.sites = [];
  expect(buildSiteMeshes(data)).toEqual([]);
});

it('converts a contained site to a local placement with a positive radius', () => {
  const placements = buildSiteMeshes(chunkWithTown());
  expect(placements).toHaveLength(1);
  const s = placements[0];
  expect(s.id).toBe('t0');
  expect(s.kind).toBe('town');
  expect(s.walled).toBe(true);
  expect(s.radius).toBeGreaterThan(0);
  expect(Number.isFinite(s.localX)).toBe(true);
  expect(Number.isFinite(s.localZ)).toBe(true);
});
