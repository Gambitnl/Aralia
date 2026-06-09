import { buildWaterMesh } from '../waterGeometry';
import type { ChunkData } from '../types';

const baseChunk = (): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: 4,
  heights: new Float32Array(16).fill(30),
  biomeIds: new Array(16).fill('plains'),
  rivers: [],
  roads: [],
  sites: [],
});

it('returns empty geometry when there are no rivers', () => {
  const mesh = buildWaterMesh(baseChunk());
  expect(mesh.positions).toHaveLength(0);
  expect(mesh.indices).toHaveLength(0);
});

it('builds a ribbon with 2 vertices per polyline point', () => {
  const data = baseChunk();
  data.rivers = [
    { points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }], width: [0.01, 0.01] },
  ];
  const mesh = buildWaterMesh(data);
  expect(mesh.positions).toHaveLength(4 * 3);
  expect(mesh.indices).toHaveLength(6);
  for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
});

it('fills lake polygons as triangulated water surfaces', () => {
  const data = baseChunk();
  data.lakes = [{
    surfaceY: 12,
    points: [
      { x: 0.01, y: 0.01 },
      { x: 0.08, y: 0.01 },
      { x: 0.08, y: 0.08 },
      { x: 0.01, y: 0.08 },
    ],
  }];

  const mesh = buildWaterMesh(data);

  expect(mesh.positions).toHaveLength(4 * 3);
  expect(mesh.indices).toHaveLength(6);
  expect(Array.from(mesh.normals)).toEqual(new Array(4 * 3).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)));
  for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
});

it('keeps river ribbon triangles after lake fill triangles', () => {
  const data = baseChunk();
  data.lakes = [{
    surfaceY: 12,
    points: [
      { x: 0.01, y: 0.01 },
      { x: 0.08, y: 0.01 },
      { x: 0.08, y: 0.08 },
      { x: 0.01, y: 0.08 },
    ],
  }];
  data.rivers = [
    { points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }], width: [0.01, 0.01] },
  ];

  const mesh = buildWaterMesh(data);

  expect(mesh.positions).toHaveLength((4 + 4) * 3);
  expect(mesh.indices).toHaveLength(12);
});
