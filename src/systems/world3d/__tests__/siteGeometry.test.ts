import { buildSiteMeshes } from '../siteGeometry';
import { heightToMeters } from '../config';
import type { ChunkData } from '../types';

const SITE_RAW_HEIGHT = 40;

const chunkWithTown = (): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: 4,
  heights: new Float32Array(16).fill(SITE_RAW_HEIGHT),
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
      population: 1200,
      surfaceY: heightToMeters(SITE_RAW_HEIGHT),
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
  expect(s.surfaceY).toBeCloseTo(heightToMeters(SITE_RAW_HEIGHT));
  expect(s.radius).toBeGreaterThanOrEqual(8);
  expect(s.radius).toBeLessThanOrEqual(30);
  expect(s.population).toBe(1200);
});

it('scales town radius up with population but stays plausible', () => {
  const low = chunkWithTown();
  low.sites = [
    {
      ...low.sites[0],
      id: 'low',
      kind: 'town',
      population: 500,
    },
  ];
  const high = chunkWithTown();
  high.sites = [
    {
      ...high.sites[0],
      id: 'high',
      kind: 'town',
      population: 5000,
    },
  ];

  const [lowPlacement] = buildSiteMeshes(low);
  const [highPlacement] = buildSiteMeshes(high);
  expect(lowPlacement.radius).toBeLessThan(highPlacement.radius);
  expect(lowPlacement.radius).toBeGreaterThanOrEqual(16);
  expect(highPlacement.radius).toBeLessThanOrEqual(30);
});

it('uses kind-based base radius for non-town sites without population', () => {
  const data = chunkWithTown();
  data.sites = [
    {
      ...data.sites[0],
      id: 'd0',
      kind: 'dungeon',
      population: undefined,
    },
  ];
  const [dungeonPlacement] = buildSiteMeshes(data);
  expect(dungeonPlacement.radius).toBe(9);
});
