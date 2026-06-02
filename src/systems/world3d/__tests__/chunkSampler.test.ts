import { sampleChunk } from '../chunkSampler';
import { chunkGridAABB } from '../coords';
import type { WorldData, River, Site } from '@/services/worldSim/types';

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

it('includes rivers that cross the chunk and excludes distant ones', () => {
  const near = sampleChunk(worldWithFeatures(), 0, 0, 4);
  expect(near.rivers.length).toBeGreaterThanOrEqual(1);
  const far = sampleChunk(worldWithFeatures(), 100, 100, 4);
  expect(far.rivers).toHaveLength(0);
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
