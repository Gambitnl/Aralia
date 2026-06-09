import { sampleChunk } from '../chunkSampler';
import { chunkGridAABB } from '../coords';
import * as polylineClip from '../polylineClip';
import { biomeColor } from '../terrainColor';
import type { Road, WorldData, River, Site } from '@/services/worldSim/types';
import { vi } from 'vitest';

const makeWorld = (cols: number, rows: number, fill: (x: number, y: number) => number): WorldData => {
  const heights: number[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) heights.push(fill(x, y));
  return {
    version: 2,
    seed: 1,
    templateId: 't',
    gridSize: { rows, cols },
    heights,
    temperatures: [],
    moisture: [],
    biomeIds: [],
    rivers: [],
    roads: [],
    sites: [],
    coastlines: [],
    lakes: [],
    biomeZones: [],
  };
};

it('produces a resolution*resolution height buffer', () => {
  const world = makeWorld(4, 4, () => 50);
  const data = sampleChunk(world, 0, 0, 8);
  expect(data.resolution).toBe(8);
  expect(data.heights).toHaveLength(64);
});

it('samples a flat world as a constant height', () => {
  const world = makeWorld(4, 4, () => 42);
  const data = sampleChunk(world, 0, 0, 5);
  for (const h of data.heights) expect(h).toBeCloseTo(42);
});

it('reflects a horizontal height gradient across the world', () => {
  // Height rises with grid X. A chunk far east should sample higher than a chunk at the origin.
  const world = makeWorld(64, 4, (x) => x); // height == column index
  const near = sampleChunk(world, 0, 0, 4);
  const far = sampleChunk(world, 20, 0, 4);
  const avg = (a: Float32Array) => a.reduce((s, v) => s + v, 0) / a.length;
  expect(avg(far.heights)).toBeGreaterThan(avg(near.heights));
});

it('clamps samples that fall outside the grid to the edge value', () => {
  const world = makeWorld(2, 2, () => 30);
  // A chunk well beyond the grid still returns finite, clamped heights (no NaN).
  const data = sampleChunk(world, 9999, 9999, 4);
  for (const h of data.heights) {
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBeCloseTo(30);
  }
});

const worldWithFeatures = (): WorldData => {
  const cols = 64;
  const rows = 8;
  const heights = new Array(cols * rows).fill(40);
  const biomeIds = new Array(cols * rows).fill('forest');
  const river: River = {
    id: 'r0',
    points: [{ x: 0, y: 0.05 }, { x: 5, y: 0.05 }],
    width: [1, 1],
    discharge: [10, 10],
  };
  const town: Site = {
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
  };
  return {
    version: 2, seed: 1, templateId: 't',
    gridSize: { rows, cols },
    heights, temperatures: [], moisture: [], biomeIds,
    rivers: [river], roads: [], sites: [town],
    coastlines: [], lakes: [], biomeZones: [],
  };
};

it('samples a per-vertex biome id buffer', () => {
  const data = sampleChunk(worldWithFeatures(), 0, 0, 4);
  expect(data.biomeIds).toHaveLength(16);
  expect(data.biomeIds.every((b) => b === 'forest')).toBe(true);
});

it('precomputes blended biome colors across biome boundaries', () => {
  const cols = 4;
  const rows = 4;
  const world = makeWorld(cols, rows, () => 40);
  world.biomeIds = [
    'ocean',
    'desert',
    'forest',
    'plains',
    'ocean',
    'desert',
    'forest',
    'plains',
    'ocean',
    'desert',
    'forest',
    'plains',
    'ocean',
    'desert',
    'forest',
    'plains',
  ];
  // This chunk sits at the boundary between biome columns 1 and 2 (gx in [1, 1.125]).
  const data = sampleChunk(world, 8, 0, 16);

  expect(data.biomeColors).toHaveLength(16 * 16 * 3);
  const edge = data.biomeColors!;
  const vertex = data.resolution - 1; // last x sample in the first row
  const idx = vertex * 3;
  const actual = [edge[idx], edge[idx + 1], edge[idx + 2]];
  const left = biomeColor('desert', 40);
  const right = biomeColor('forest', 40);
  const blend = 0.125;
  const expected = [
    left[0] * (1 - blend) + right[0] * blend,
    left[1] * (1 - blend) + right[1] * blend,
    left[2] * (1 - blend) + right[2] * blend,
  ];

  for (let c = 0; c < 3; c++) {
    expect(actual[c]).toBeCloseTo(expected[c]);
    expect(actual[c]).not.toBeCloseTo(left[c], 6);
    expect(actual[c]).not.toBeCloseTo(right[c], 6);
  }
});

it('includes rivers that cross the chunk and excludes distant ones', () => {
  const near = sampleChunk(worldWithFeatures(), 0, 0, 4);
  expect(near.rivers.length).toBeGreaterThanOrEqual(1);
  const far = sampleChunk(worldWithFeatures(), 100, 100, 4);
  expect(far.rivers).toHaveLength(0);
});

it('clips lake polygons into chunk-local lake fill payloads', () => {
  const world = makeWorld(64, 64, () => 40);
  world.biomeIds = new Array(64 * 64).fill('plains');
  world.lakes = [[
    { x: 0.01, y: 0.01 },
    { x: 0.10, y: 0.01 },
    { x: 0.10, y: 0.10 },
    { x: 0.01, y: 0.10 },
  ]];

  const near = sampleChunk(world, 0, 0, 4);
  const far = sampleChunk(world, 100, 100, 4);

  expect(near.lakes).toHaveLength(1);
  expect(near.lakes?.[0].points).toHaveLength(4);
  expect(near.lakes?.[0].surfaceY).toBeGreaterThan(0);
  expect(far.lakes).toHaveLength(0);
});

it('includes sites whose center falls within the chunk', () => {
  const data = sampleChunk(worldWithFeatures(), 0, 0, 4);
  expect(data.sites).toHaveLength(1);
  expect(data.sites[0].id).toBe('t0');
  expect(data.sites[0].walled).toBe(true);
});

// A site sitting exactly on a chunk boundary must belong to exactly one chunk,
// not both — the half-open interval [min, max). Otherwise the same site id is
// emitted by two adjacent chunks and React logs duplicate-key warnings (W3D-G20).
const worldWithSiteAt = (x: number, y: number): WorldData => {
  const cols = 64;
  const rows = 64;
  const site: Site = {
    id: 'edge',
    kind: 'town',
    position: { x, y },
    footprint: [],
    walled: false,
  };
  return {
    version: 2, seed: 1, templateId: 't',
    gridSize: { rows, cols },
    heights: new Array(cols * rows).fill(40),
    temperatures: [], moisture: [],
    biomeIds: new Array(cols * rows).fill('forest'),
    rivers: [], roads: [], sites: [site],
    coastlines: [], lakes: [], biomeZones: [],
  };
};

it('assigns a site on a shared X boundary to exactly one chunk (half-open)', () => {
  // The boundary between chunk (0,0) and (1,0) is chunk0's maxGX === chunk1's minGX.
  const boundaryX = chunkGridAABB(0, 0).maxGX;
  const world = worldWithSiteAt(boundaryX, 0.01);
  const left = sampleChunk(world, 0, 0, 4);
  const right = sampleChunk(world, 1, 0, 4);
  // Owned by the upper chunk (>= min), excluded from the lower chunk (< max).
  expect(left.sites).toHaveLength(0);
  expect(right.sites).toHaveLength(1);
  expect(right.sites[0].id).toBe('edge');
});

it('assigns a site on a shared Y boundary to exactly one chunk (half-open)', () => {
  const boundaryY = chunkGridAABB(0, 0).maxGY;
  const world = worldWithSiteAt(0.01, boundaryY);
  const top = sampleChunk(world, 0, 0, 4);
  const bottom = sampleChunk(world, 0, 1, 4);
  expect(top.sites).toHaveLength(0);
  expect(bottom.sites).toHaveLength(1);
  expect(bottom.sites[0].id).toBe('edge');
});

it('maps each road type to a distinct sampled width', () => {
  const world = makeWorld(64, 8, () => 40);
  world.sites = [];
  world.rivers = [];
  world.coastlines = [];
  world.lakes = [];
  world.biomeZones = [];
  world.temperatures = [];
  world.moisture = [];
  world.biomeIds = [];
  const roadMajor: Road = {
    id: 'major',
    points: [
      { x: 0.01, y: 0.02 },
      { x: 0.05, y: 0.02 },
    ],
    type: 'major',
    fromSiteId: 'a',
    toSiteId: 'b',
  };
  const roadMinor: Road = {
    id: 'minor',
    points: [
      { x: 0.03, y: 0.04 },
      { x: 0.07, y: 0.04 },
    ],
    type: 'minor',
    fromSiteId: 'a',
    toSiteId: 'b',
  };
  const roadTrail: Road = {
    id: 'trail',
    points: [
      { x: 0.09, y: 0.06 },
      { x: 0.11, y: 0.06 },
    ],
    type: 'trail',
    fromSiteId: 'a',
    toSiteId: 'b',
  };
  world.roads = [roadMajor, roadMinor, roadTrail];

  const data = sampleChunk(world, 0, 0, 4);
  const widths = data.roads.map((r) => r.width[0]);
  expect(widths).toHaveLength(3);
  expect(widths).toContain(0.06);
  expect(widths).toContain(0.04);
  expect(widths).toContain(0.025);
  expect(new Set(widths).size).toBe(3);
});

it('clips only nearby polylines by skipping distant roads/rivers before clipping', () => {
  const world = makeWorld(256, 8, () => 40);
  const clipSpy = vi.spyOn(polylineClip, 'clipPolylineToChunk');

  world.rivers = [
    {
      id: 'near-river',
      points: [
        { x: 0.01, y: 0.05 },
        { x: 0.05, y: 0.05 },
      ],
      width: [0.02, 0.02],
      discharge: [1, 1],
    },
    {
      id: 'far-river',
      points: [
        { x: 200, y: 200 },
        { x: 201, y: 200 },
      ],
      width: [0.02, 0.02],
      discharge: [1, 1],
    },
  ];

  world.roads = [
    {
      id: 'near-road',
      points: [
        { x: 0.01, y: 0.01 },
        { x: 0.05, y: 0.01 },
      ],
      type: 'major',
      fromSiteId: 'a',
      toSiteId: 'b',
    },
    {
      id: 'far-road',
      points: [
        { x: 210, y: 210 },
        { x: 211, y: 210 },
      ],
      type: 'trail',
      fromSiteId: 'a',
      toSiteId: 'b',
    },
  ];

  const data = sampleChunk(world, 0, 0, 4);

  expect(data.rivers).toHaveLength(1);
  expect(data.rivers[0].points[0]).toEqual({ x: 0.01, y: 0.05 });
  expect(data.rivers[0].points[1]).toEqual({ x: 0.05, y: 0.05 });
  expect(data.roads).toHaveLength(1);
  expect(data.roads[0].points).toHaveLength(2);
  expect(clipSpy).toHaveBeenCalledTimes(2);

  clipSpy.mockRestore();
});
