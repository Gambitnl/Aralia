import { buildRoadMesh } from '../roadGeometry';
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
