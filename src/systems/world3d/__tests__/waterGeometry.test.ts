/**
 * This file proves that river and lake payloads become deterministic water
 * triangles. Ground-mode rivers now supply their real shared waterline, while
 * legacy payloads retain the old terrain-relative fallback.
 */
import { buildWaterMesh, RIBBON_ACROSS, RIBBON_ROW_STEP_M } from '../waterGeometry';
import { WORLD3D_CONFIG, heightToMeters } from '../config';
import type { ChunkData } from '../types';

/**
 * Rows a two-point ribbon draws (2026-10-30): one at least every
 * RIBBON_ROW_STEP_M along it, plus the last. The fixtures' 0.1 grid units is
 * 102.4 m (1,024 m cells).
 */
const rowsFor = (gridLength: number): number =>
  Math.max(1, Math.ceil((gridLength * WORLD3D_CONFIG.METERS_PER_CELL) / RIBBON_ROW_STEP_M)) + 1;

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

it('builds a ribbon with RIBBON_ACROSS vertices per row, a row at least every RIBBON_ROW_STEP_M', () => {
  const data = baseChunk();
  data.rivers = [
    { points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }], width: [0.01, 0.01] },
  ];
  const mesh = buildWaterMesh(data);
  const rows = rowsFor(0.1);
  expect(mesh.positions).toHaveLength(rows * RIBBON_ACROSS * 3);
  // A legacy ribbon (no shared waterline) keeps every triangle.
  expect(mesh.indices).toHaveLength((rows - 1) * (RIBBON_ACROSS - 1) * 6);
  expect(mesh.flow).toHaveLength(rows * RIBBON_ACROSS * 2);
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

  // Each centerline point emits its row across at exactly the same shared
  // height, allowing fords and bridges to meet the rendered surface precisely;
  // the rows between interpolate it.
  const ys = Array.from(mesh.positions).filter((_, index) => index % 3 === 1);
  const rows = rowsFor(0.1);
  expect(ys).toHaveLength(rows * RIBBON_ACROSS);
  expect(ys.slice(0, RIBBON_ACROSS)).toEqual(new Array(RIBBON_ACROSS).fill(7.25));
  expect(ys.slice(-RIBBON_ACROSS)).toEqual(new Array(RIBBON_ACROSS).fill(6.75));
  for (let r = 1; r < rows; r++) expect(ys[r * RIBBON_ACROSS]).toBeLessThanOrEqual(ys[(r - 1) * RIBBON_ACROSS]);
});

it('flows a ground river downstream, faster where its waterline falls faster', () => {
  const ribbonFlow = (waterlineY: number[]): Float32Array => {
    const data = baseChunk();
    data.rivers = [
      {
        points: [{ x: 0.0, y: 0.05 }, { x: 0.1, y: 0.05 }],
        width: [0.01, 0.01],
        waterlineY,
      },
    ];
    return buildWaterMesh(data).flow;
  };
  const gentle = ribbonFlow([7.25, 7.2]);
  const steep = ribbonFlow([7.25, 6.25]);
  // Flow points along +x (the polyline direction) and has no cross component.
  expect(gentle[0]).toBeGreaterThan(0);
  expect(gentle[1]).toBeCloseTo(0, 6);
  expect(steep[0]).toBeGreaterThan(gentle[0]);
});

it('gives the deep middle of a ribbon its own depth', () => {
  // A trough: the bed is deep under the ribbon's middle and level with the
  // surface under both banks. Two vertices across saw only the banks.
  const data = baseChunk();
  data.resolution = 9;
  data.heights = new Float32Array(81).fill(30);
  for (let j = 0; j < 9; j++) data.heights[j * 9 + 4] = 0;
  const span = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / WORLD3D_CONFIG.METERS_PER_CELL;
  const midX = span / 2;
  data.rivers = [
    {
      points: [{ x: midX, y: span * 0.2 }, { x: midX, y: span * 0.8 }],
      width: [span / 4, span / 4],
      waterlineY: [heightToMeters(30), heightToMeters(30)],
    },
  ];
  const colors = buildWaterMesh(data).colors;
  const middle = Math.floor(RIBBON_ACROSS / 2);
  // Bank vertices: no depth. Middle vertex: full opacity.
  expect(colors[0]).toBe(0);
  expect(colors[middle * 3]).toBeCloseTo(1, 5);
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

  const rows = rowsFor(0.1);
  expect(mesh.positions).toHaveLength((4 + rows * RIBBON_ACROSS) * 3);
  expect(mesh.indices).toHaveLength(6 + (rows - 1) * (RIBBON_ACROSS - 1) * 6);
});

describe('a body filled from inner samples (2026-10-30, water under bridges)', () => {
  // A square body 0.1 grid units on a side, its outline on the shore (bed at
  // the water) and one inner point 2 m deep. The drawn ground stands far below,
  // so the fine bed alone sets the depth.
  const filled = (centerBed: number, shoreBed = 10): ChunkData => {
    const data = baseChunk();
    data.heights = new Float32Array(16).fill(0);
    data.lakes = [{
      points: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0.1, y: 0.1 }, { x: 0, y: 0.1 }],
      bedY: [shoreBed, shoreBed, shoreBed, shoreBed],
      interior: [{ x: 0.05, y: 0.05 }],
      interiorBedY: [centerBed],
      surfaceY: 10,
      kind: 'lake',
    }];
    return data;
  };
  const verts = (m: ReturnType<typeof buildWaterMesh>) => m.positions.length / 3;

  it('goes deep and opaque at an inner point, not only shore-pale from its outline', () => {
    const mesh = buildWaterMesh(filled(8));
    expect(verts(mesh)).toBe(5);
    // The inner vertex (index 4): opacity ramp full, color ramp most of the way.
    expect(mesh.colors[4 * 3]).toBeCloseTo(1, 6);
    expect(mesh.colors[4 * 3 + 1]).toBeGreaterThan(0.6);
    // The four triangles round the inner point, every one inside the outline.
    expect(mesh.indices.length).toBe(12);
    expect(Array.from(mesh.indices)).toContain(4);
  });

  it('drops a triangle that stands over dry ground', () => {
    // The bed is above the water everywhere: nothing of the sheet is wet.
    const mesh = buildWaterMesh(filled(11, 11));
    expect(mesh.indices.length).toBe(0);
  });

  it('keeps every triangle inside a concave outline', () => {
    const data = filled(8);
    // An L-shape: the Delaunay hull covers the notch, the outline does not.
    data.lakes![0].points = [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0.1, y: 0.05 }, { x: 0.05, y: 0.05 }, { x: 0.05, y: 0.1 }, { x: 0, y: 0.1 }];
    data.lakes![0].bedY = new Array(6).fill(10);
    data.lakes![0].interior = [{ x: 0.025, y: 0.025 }];
    const mesh = buildWaterMesh(data);
    const P = mesh.positions, I = mesh.indices;
    const M = WORLD3D_CONFIG.METERS_PER_CELL;
    for (let t = 0; t < I.length; t += 3) {
      const cx = (P[I[t] * 3] + P[I[t + 1] * 3] + P[I[t + 2] * 3]) / 3 / M;
      const cz = (P[I[t] * 3 + 2] + P[I[t + 1] * 3 + 2] + P[I[t + 2] * 3 + 2]) / 3 / M;
      // Not in the notch (x > 0.05 and y > 0.05).
      expect(cx > 0.05 + 1e-9 && cz > 0.05 + 1e-9).toBe(false);
    }
    expect(I.length).toBeGreaterThan(0);
  });
});

it('drops a ground ribbon triangle that stands over dry ground', () => {
  // A ground river (shared waterline) over drawn ground 1 m ABOVE its water:
  // every vertex is dry, so no triangle stands as a flat sheet on the bank.
  const data = baseChunk();
  const ground = heightToMeters(30);
  data.rivers = [
    { points: [{ x: 0.0, y: 0.05 }, { x: 0.004, y: 0.05 }], width: [0.01, 0.01], waterlineY: [ground - 1, ground - 1] },
  ];
  expect(buildWaterMesh(data).indices).toHaveLength(0);
  // The same river 1 m above the ground keeps its sheet.
  data.rivers[0].waterlineY = [ground + 1, ground + 1];
  expect(buildWaterMesh(data).indices.length).toBeGreaterThan(0);
});
