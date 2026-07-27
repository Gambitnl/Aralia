import { buildRoadMesh } from '../roadGeometry';
import { STREET_TIER_SPECS } from '../../worldforge/town/streetRibbons';
import { WORLD3D_CONFIG, heightToMeters } from '../config';
import type { ChunkData } from '../types';

const baseChunk = (): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: 4,
  heights: new Float32Array(16).fill(50),
  biomeIds: new Array(16).fill('plains'),
  rivers: [],
  roads: [],
  sites: [],
});

it('returns empty geometry when there are no roads', () => {
  const mesh = buildRoadMesh(baseChunk());
  expect(mesh.positions).toHaveLength(0);
  expect(mesh.indices).toHaveLength(0);
});

it('builds a ribbon for a road crossing the chunk', () => {
  const data = baseChunk();
  data.roads = [
    { points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }], width: [0.04, 0.04] },
  ];
  const mesh = buildRoadMesh(data);
  expect(mesh.positions).toHaveLength(4 * 3);
  expect(mesh.indices).toHaveLength(6);
  for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
});

it('emits one packed-dirt vertex color per position when no tint is given', () => {
  const data = baseChunk();
  data.roads = [
    { points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }], width: [0.04, 0.04] },
  ];
  const mesh = buildRoadMesh(data);
  // 2 points × 2 ribbon sides × rgb — one color per position vertex.
  expect(mesh.colors).toHaveLength(4 * 3);
  // Default packed dirt #a08b62.
  expect(mesh.colors[0]).toBeCloseTo(0xa0 / 255, 5);
  expect(mesh.colors[1]).toBeCloseTo(0x8b / 255, 5);
  expect(mesh.colors[2]).toBeCloseTo(0x62 / 255, 5);
});

it('tints every vertex from the ribbon colorHex when present (street hierarchy)', () => {
  const data = baseChunk();
  data.roads = [
    { points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }], width: [0.06, 0.06], colorHex: '#ff8000' },
  ];
  const mesh = buildRoadMesh(data);
  for (let i = 0; i < mesh.colors.length; i += 3) {
    expect(mesh.colors[i]).toBeCloseTo(1, 5);
    expect(mesh.colors[i + 1]).toBeCloseTo(0x80 / 255, 5);
    expect(mesh.colors[i + 2]).toBeCloseTo(0, 5);
  }
});

// --- Streets-unify slice: town-street tints trigger the shared LAYERED recipe --

/** One straight 2-point ribbon carrying the given town street tier tint. */
const streetChunk = (colorHex: string): ChunkData => {
  const data = baseChunk();
  data.roads = [
    { points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }], width: [0.06, 0.06], colorHex },
  ];
  return data;
};

it('renders an avenue as an edging band under an inset pale core (two layers)', () => {
  const spec = STREET_TIER_SPECS.avenue;
  const mesh = buildRoadMesh(streetChunk(spec.colorHex));
  // 2 layers × 2 points × 2 sides = 8 vertices; 2 layers × 1 segment × 2 tris.
  expect(mesh.positions).toHaveLength(8 * 3);
  expect(mesh.indices).toHaveLength(12);
  // First 4 vertices: edging tint; last 4: the avenue core tint.
  const hex = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
  const [er, eg, eb] = hex(spec.edgeHex!);
  const [cr, cg, cb] = hex(spec.colorHex);
  for (let v = 0; v < 4; v++) {
    expect(mesh.colors[v * 3]).toBeCloseTo(er, 5);
    expect(mesh.colors[v * 3 + 1]).toBeCloseTo(eg, 5);
    expect(mesh.colors[v * 3 + 2]).toBeCloseTo(eb, 5);
  }
  for (let v = 4; v < 8; v++) {
    expect(mesh.colors[v * 3]).toBeCloseTo(cr, 5);
    expect(mesh.colors[v * 3 + 1]).toBeCloseTo(cg, 5);
    expect(mesh.colors[v * 3 + 2]).toBeCloseTo(cb, 5);
  }
  // The core band is narrower than the edging band and floats just above it.
  const spread = (from: number) => Math.abs(mesh.positions[from * 3 + 2] - mesh.positions[from * 3 + 5]);
  expect(spread(4)).toBeLessThan(spread(0));
  expect(mesh.positions[4 * 3 + 1]).toBeGreaterThan(mesh.positions[0 * 3 + 1]);
});

it('renders a lane as dirt with a narrow dark rut stripe on top', () => {
  const spec = STREET_TIER_SPECS.lane;
  const mesh = buildRoadMesh(streetChunk(spec.colorHex));
  expect(mesh.positions).toHaveLength(8 * 3);
  const spread = (from: number) => Math.abs(mesh.positions[from * 3 + 2] - mesh.positions[from * 3 + 5]);
  // Rut stripe ≤ half the dirt width, painted above it.
  expect(spread(4)).toBeLessThan(spread(0) * 0.5);
  expect(mesh.positions[4 * 3 + 1]).toBeGreaterThan(mesh.positions[0 * 3 + 1]);
});

it('renders the mid street tier as a single plain band (legacy vertex layout)', () => {
  const spec = STREET_TIER_SPECS.street;
  const mesh = buildRoadMesh(streetChunk(spec.colorHex));
  expect(mesh.positions).toHaveLength(4 * 3);
  expect(mesh.indices).toHaveLength(6);
});

it('is deterministic — identical chunk input produces identical buffers', () => {
  const a = buildRoadMesh(streetChunk(STREET_TIER_SPECS.plaza.colorHex));
  const b = buildRoadMesh(streetChunk(STREET_TIER_SPECS.plaza.colorHex));
  expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  expect(Array.from(a.indices)).toEqual(Array.from(b.indices));
  expect(Array.from(a.colors)).toEqual(Array.from(b.colors));
});

it('drapes every ribbon vertex on the RENDERED slope, not the nearest height vertex (burial fix)', () => {
  // Regression for the streets-unify height fix: with nearest-vertex sampling a
  // ribbon on a slope sat up to half a cell's height delta under the terrain
  // (live seed-42 probe: street vertices ~0.4 m below the surface). Every road
  // vertex must now sit exactly ROAD_LIFT (0.3 m) above the surface the terrain
  // mesh interpolates at that exact XZ.
  const data = baseChunk();
  const res = data.resolution;
  // Steep slope along x: one full cell rises by 40 height units.
  const heights = new Float32Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) heights[j * res + i] = i * 40;
  data.heights = heights;
  const span = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / WORLD3D_CONFIG.METERS_PER_CELL;
  // A mid-cell grid point where rounding to the nearest vertex is clearly wrong.
  const gx = span * (1.4 / (res - 1));
  const gy = span * (0.05 / (res - 1));
  data.roads = [
    { points: [{ x: gx, y: gy }, { x: gx + span * 0.02, y: gy }], width: [0.001, 0.001] },
  ];
  const mesh = buildRoadMesh(data);
  expect(mesh.positions.length).toBeGreaterThan(0);
  // Expected surface: interpolate the same (a,c,b)/(b,c,d) terrain split.
  const surface = (fgx: number, fgy: number) => {
    const fx = Math.max(0, Math.min(res - 1, (fgx / span) * (res - 1)));
    const fy = Math.max(0, Math.min(res - 1, (fgy / span) * (res - 1)));
    const i0 = Math.min(res - 2, Math.floor(fx));
    const j0 = Math.min(res - 2, Math.floor(fy));
    const u = fx - i0, v = fy - j0;
    const h = (i: number, j: number) => heightToMeters(heights[j * res + i]);
    return u + v <= 1
      ? h(i0, j0) + u * (h(i0 + 1, j0) - h(i0, j0)) + v * (h(i0, j0 + 1) - h(i0, j0))
      : h(i0 + 1, j0 + 1) + (1 - u) * (h(i0, j0 + 1) - h(i0 + 1, j0 + 1)) + (1 - v) * (h(i0 + 1, j0) - h(i0 + 1, j0 + 1));
  };
  const M = WORLD3D_CONFIG.METERS_PER_CELL;
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  for (let v = 0; v < mesh.positions.length / 3; v++) {
    const x = mesh.positions[v * 3], y = mesh.positions[v * 3 + 1], z = mesh.positions[v * 3 + 2];
    const lift = y - surface((x + 0 * S) / M, (z + 0 * S) / M); // chunk (0,0)
    // Positions live in Float32Array — assert to mm precision, not f64 epsilon.
    expect(lift).toBeCloseTo(0.3, 3);
  }
  // Prove the test bites: the nearest-vertex height differs from the surface here.
  const nearest = heightToMeters(heights[Math.round((gx / span) * (res - 1))]);
  expect(Math.abs(nearest - surface(gx, gy))).toBeGreaterThan(0.3);
});
