/**
 * This file proves that river and lake payloads become deterministic water
 * triangles. Ground-mode rivers now supply their real shared waterline, while
 * legacy payloads retain the old terrain-relative fallback.
 */
import { buildWaterMesh } from '../waterGeometry';
import { heightToMeters } from '../config';
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

it('renders a ground river at its shared per-point waterline', () => {
  const data = baseChunk();
  data.rivers = [
    {
      points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }],
      width: [0.01, 0.01],
      waterlineY: [7.25, 6.75],
    },
  ];

  const mesh = buildWaterMesh(data);

  // Each centerline point emits a left/right pair at exactly the same shared
  // height, allowing fords and bridges to meet the rendered surface precisely.
  expect(Array.from(mesh.positions).filter((_, index) => index % 3 === 1)).toEqual([
    7.25,
    7.25,
    6.75,
    6.75,
  ]);
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

/**
 * The depth encoding is what stops water reading as a painted-on decal, and it
 * is invisible to every other assertion here: positions, indices and normals are
 * identical whether the bed is a foot down or twenty meters down.
 */
describe('per-vertex depth encoding', () => {
  const bedM = heightToMeters(30); // baseChunk fills its heightfield with 30

  const lakeAt = (surfaceY: number): Float32Array => {
    const data = baseChunk();
    data.lakes = [{
      surfaceY,
      points: [
        { x: 0.01, y: 0.01 },
        { x: 0.08, y: 0.01 },
        { x: 0.08, y: 0.08 },
        { x: 0.01, y: 0.08 },
      ],
    }];
    return buildWaterMesh(data).colors;
  };

  it('emits one encoding per vertex', () => {
    expect(lakeAt(bedM + 5)).toHaveLength(4 * 3);
  });

  it('reads full depth where the bed is far below the surface', () => {
    // LAKE_DROP_M sinks the legacy flat lake slightly, so 5 m of clearance is
    // still comfortably past both ramps' far ends.
    for (const c of lakeAt(bedM + 5)) expect(c).toBeCloseTo(1, 5);
  });

  it('reads zero where the bed reaches the surface', () => {
    // The polygon edge case: measured median depth there is about -0.03 m, so
    // this is the value the whole shoreline feather is built on.
    for (const c of lakeAt(bedM)) expect(c).toBe(0);
  });

  it('ramps opacity ahead of colour', () => {
    // Opacity has to finish inside the first half meter — that is the entire
    // depth range a shoreline gets — while colour keeps deepening well past it.
    // 1.0 m of clearance minus LAKE_DROP_M leaves 0.45 m of real depth.
    const c = lakeAt(bedM + 1.0);
    expect(c[0]).toBeGreaterThan(0.85);
    expect(c[1]).toBeLessThan(0.2);
  });
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
