import { buildRoadMesh, buildRoadVergeMesh, refineRoadMeshForFooting, refineRoadMeshesForFooting, ROAD_SURFACE, vergeWidthM } from '../roadGeometry';
import { ROAD_3D_TIERS } from '../../worldforge/travel/roadTunables';
import { STREET_TIER_SPECS } from '../../worldforge/town/streetRibbons';
import { WORLD3D_CONFIG, heightToMeters, metersToHeight } from '../config';
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

it('keeps the interiors of road faces above a terrain crest, not just their corners', () => {
  const data = baseChunk();
  data.resolution = 3;
  data.heights = new Float32Array([50, 70, 50, 50, 70, 50, 50, 70, 50]);
  const span = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / WORLD3D_CONFIG.METERS_PER_CELL;
  data.roads = [{ points: [{ x: 0, y: span / 2 }, { x: span, y: span / 2 }], width: [0.01, 0.01] }];
  const mesh = buildRoadMesh(data);
  expect(mesh.indices.length).toBeGreaterThan(6);
  const low = heightToMeters(50), high = heightToMeters(70);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    let x = 0, y = 0;
    for (let j = 0; j < 3; j++) {
      const v = mesh.indices[i + j] * 3;
      x += mesh.positions[v] / 3;
      y += mesh.positions[v + 1] / 3;
    }
    const fraction = x / WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
    const surface = low + (high - low) * (1 - Math.abs(2 * fraction - 1));
    expect(y - surface).toBeCloseTo(0.3, 3);
  }
});

it('preserves each paving layer across a nonplanar terrain-cell diagonal', () => {
  const data = streetChunk(STREET_TIER_SPECS.plaza.colorHex);
  data.resolution = 2;
  data.heights = new Float32Array([50, 50, 50, 70]);
  const low = heightToMeters(50), rise = heightToMeters(70) - low;
  const lifts = new Set<number>();
  const mesh = buildRoadMesh(data);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    let x = 0, y = 0, z = 0;
    for (let j = 0; j < 3; j++) {
      const v = mesh.indices[i + j] * 3;
      x += mesh.positions[v] / 3;
      y += mesh.positions[v + 1] / 3;
      z += mesh.positions[v + 2] / 3;
    }
    const surface = low + rise * Math.max(0, (x + z) / WORLD3D_CONFIG.CHUNK_WORLD_SIZE - 1);
    const lift = y - surface;
    // Plaza tier: rank 4 x 0.03 + layer x 0.01 over the 0.3 m lift (the square fill takes rank 3).
    expect(Math.min(Math.abs(lift - 0.42), Math.abs(lift - 0.43))).toBeLessThan(0.001);
    lifts.add(Math.round(lift * 1000));
  }
  expect([...lifts].sort()).toEqual([420, 430]);
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

it('fills the outside corner between separate street ends', () => {
  const data = baseChunk();
  data.roads = [
    { points: [{ x: 0.03, y: 0.05 }, { x: 0.05, y: 0.05 }], width: [0.004, 0.004], colorHex: STREET_TIER_SPECS.plaza.colorHex },
    { points: [{ x: 0.05, y: 0.05 }, { x: 0.05, y: 0.07 }], width: [0.004, 0.004], colorHex: STREET_TIER_SPECS.plaza.colorHex },
  ];
  const mesh = buildRoadMesh(data);
  // This point lies outside both square-ended strips, inside their bevel.
  const px = 0.05 * WORLD3D_CONFIG.METERS_PER_CELL + 0.5;
  const pz = 0.05 * WORLD3D_CONFIG.METERS_PER_CELL - 0.5;
  let paved = false;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const verts = Array.from(mesh.indices.slice(i, i + 3), v => [mesh.positions[v * 3], mesh.positions[v * 3 + 2]]);
    const signs = verts.map((a, j) => {
      const b = verts[(j + 1) % 3];
      return (b[0] - a[0]) * (pz - a[1]) - (b[1] - a[1]) * (px - a[0]);
    });
    if (signs.every(s => s <= 0) || signs.every(s => s >= 0)) paved = true;
  }
  expect(paved).toBe(true);
});

it('keeps the whole plaza surface above an intersecting lane rut', () => {
  const plaza = buildRoadMesh(streetChunk(STREET_TIER_SPECS.plaza.colorHex));
  const lane = buildRoadMesh(streetChunk(STREET_TIER_SPECS.lane.colorHex));
  const heights = (mesh: ReturnType<typeof buildRoadMesh>) => Array.from(mesh.positions).filter((_, i) => i % 3 === 1);
  expect(Math.min(...heights(plaza))).toBeGreaterThan(Math.max(...heights(lane)));
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

// agora-257c (2026-10-27): ROAD SPACE for the WebGPU road material.
describe('road space attribute', () => {
  const kindsOf = (mesh: ReturnType<typeof buildRoadMesh>): Set<number> => {
    const out = new Set<number>();
    for (let i = 3; i < mesh.road.length; i += 4) out.add(mesh.road[i]);
    return out;
  };
  const straight = (colorHex?: string, alongM?: number[]) => {
    const data = baseChunk();
    data.roads = [{ points: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }], width: [0.2, 0.2], colorHex, ...(alongM ? { alongM } : {}) }];
    return buildRoadMesh(data);
  };

  it('carries four road-space values per vertex', () => {
    const mesh = straight();
    expect(mesh.road.length).toBe((mesh.positions.length / 3) * 4);
  });

  it('names each street tier layer as the surface it is', () => {
    expect(kindsOf(straight(STREET_TIER_SPECS.plaza.colorHex))).toEqual(new Set([ROAD_SURFACE.curb, ROAD_SURFACE.flagstone]));
    expect(kindsOf(straight(STREET_TIER_SPECS.avenue.colorHex))).toEqual(new Set([ROAD_SURFACE.curb, ROAD_SURFACE.setts]));
    expect(kindsOf(straight(STREET_TIER_SPECS.street.colorHex))).toEqual(new Set([ROAD_SURFACE.cobble]));
    expect(kindsOf(straight(STREET_TIER_SPECS.lane.colorHex))).toEqual(new Set([ROAD_SURFACE.lane, ROAD_SURFACE.rutStripe]));
  });

  it('names region roads by their tier, and an untinted road as packed earth', () => {
    expect(kindsOf(straight(ROAD_3D_TIERS.highway.colorHex))).toEqual(new Set([ROAD_SURFACE.highway]));
    expect(kindsOf(straight(ROAD_3D_TIERS.trail.colorHex))).toEqual(new Set([ROAD_SURFACE.trail]));
    expect(kindsOf(straight(ROAD_3D_TIERS.path.colorHex))).toEqual(new Set([ROAD_SURFACE.path]));
    expect(kindsOf(straight())).toEqual(new Set([ROAD_SURFACE.road]));
  });

  it('runs the distance along on from the loader, and the distance across to each edge', () => {
    const mesh = straight(undefined, [100, 104]);
    const along = new Set<number>(), across = new Set<number>();
    for (let i = 0; i < mesh.road.length; i += 4) { along.add(mesh.road[i]); across.add(+mesh.road[i + 1].toFixed(4)); }
    // Flat chunk: the two ends keep the loader's distances, no restart at 0.
    expect([...along].sort((a, b) => a - b)).toEqual([100, 104]);
    const halfW = (0.2 * WORLD3D_CONFIG.METERS_PER_CELL) / 2;
    expect([...across].sort((a, b) => a - b)).toEqual([+(-halfW).toFixed(4), +halfW.toFixed(4)]);
  });
});

// agora-257c (2026-10-28): roads step 3, the verge strips.
describe('road verges', () => {
  const vergeOf = (colorHex?: string) => {
    const data = baseChunk();
    data.roads = [{ points: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }], width: [0.2, 0.2], colorHex }];
    return buildRoadVergeMesh(data);
  };

  it('lays a dirt verge beside a dirt road and a paved verge beside paving', () => {
    const kinds = (m: ReturnType<typeof buildRoadVergeMesh>) => new Set(Array.from({ length: m.road.length / 4 }, (_, i) => m.road[i * 4 + 3]));
    expect(kinds(vergeOf())).toEqual(new Set([ROAD_SURFACE.vergeDirt]));
    expect(kinds(vergeOf(STREET_TIER_SPECS.street.colorHex))).toEqual(new Set([ROAD_SURFACE.vergePaved]));
  });

  it('runs from the road edge out to the verge width on both sides', () => {
    const m = vergeOf();
    const halfW = (0.2 * WORLD3D_CONFIG.METERS_PER_CELL) / 2;
    const vw = vergeWidthM(ROAD_SURFACE.vergeDirt, halfW);
    const across = Array.from({ length: m.road.length / 4 }, (_, i) => m.road[i * 4 + 1]);
    expect(Math.min(...across.map(Math.abs))).toBeCloseTo(halfW, 4);
    expect(Math.max(...across)).toBeCloseTo(halfW + vw, 4);
    expect(Math.min(...across)).toBeCloseTo(-(halfW + vw), 4);
  });
});

describe('junction plates (roads step 5)', () => {
  /** Lifts over the flat ground, in millimeters, of every vertex of two avenues meeting at (0.06, 0.06). */
  const liftsMm = (second: { x: number; y: number }): number[] => {
    const data = baseChunk();
    const hex = STREET_TIER_SPECS.avenue.colorHex;
    data.roads = [
      { points: [{ x: 0.03, y: 0.06 }, { x: 0.06, y: 0.06 }], width: [0.008, 0.008], colorHex: hex },
      { points: [{ x: 0.06, y: 0.06 }, second], width: [0.008, 0.008], colorHex: hex },
    ];
    const mesh = buildRoadMesh(data);
    const ground = heightToMeters(50);
    const out: number[] = [];
    for (let v = 1; v < mesh.positions.length; v += 3) out.push(Math.round((mesh.positions[v] - ground) * 1000));
    return out;
  };

  it('lays one plate over a corner, just over the streets it joins', () => {
    // A plate vertex sits 5 mm over its layer; every street layer sits on a whole centimeter.
    expect(liftsMm({ x: 0.06, y: 0.09 }).some((mm) => mm % 10 === 5)).toBe(true);
  });

  it('keeps the flat bevel on a straight run', () => {
    expect(liftsMm({ x: 0.09, y: 0.06 }).some((mm) => mm % 10 === 5)).toBe(false);
  });
});

describe('roads beside canonical near-foot terrain', () => {
  it('shares identical paving attributes without dropping overlapping source faces or raising the budget', () => {
    const data = baseChunk(), m = WORLD3D_CONFIG.METERS_PER_CELL;
    const road = {points: [{x: 44 / m, y: 64 / m}, {x: 84 / m, y: 64 / m}], width: [24 / m, 24 / m]};
    data.roads = [road];
    const one = buildRoadMesh(data);
    data.roads = Array.from({length: 8}, () => road);
    const repeated = buildRoadMesh(data), snapshot = repeated.positions.slice();
    const d = {centerX: 64, centerZ: 64, innerRadius: 8, outerRadius: 16, maxEdgeM: .1905,
      heightAt: (x: number, z: number) => 20 + .02 * x + .005 * z};
    const first = refineRoadMeshForFooting(one, {x: 0, z: 0}, d);
    const all = refineRoadMeshForFooting(repeated, {x: 0, z: 0}, d);
    // Repeated faces still draw, including their road coordinates. Only the
    // identical vertex records are shared; no road or layer is discarded.
    expect(all.indices.length).toBe(first.indices.length * 8);
    expect(all.positions.length).toBe(first.positions.length);
    expect(all.road).toEqual(first.road);
    expect(all.positions.length / 3).toBeLessThan(250000);
    expect(repeated.positions).toEqual(snapshot);
  });

  const origin = {x: 0, z: 0};
  const fixture = (colorHex?: string) => {
    const data = baseChunk(), m = WORLD3D_CONFIG.METERS_PER_CELL;
    data.roads = [{points: [{x: 44 / m, y: 64 / m}, {x: 84 / m, y: 64 / m}], width: [6 / m, 6 / m], alongM: [100, 140], colorHex}];
    return buildRoadMesh(data);
  };
  const detail = (centerX = 64) => ({centerX, centerZ: 64, innerRadius: 4, outerRadius: 6, maxEdgeM: .5,
    heightAt: (x: number, z: number) => heightToMeters(50) - .7 + .04 * (x - centerX) + .005 * (z - 64) ** 2});
  type Mesh = ReturnType<typeof refineRoadMeshForFooting>;
  // structuredClone crosses the jsdom/Node realm boundary. Compare actual
  // buffer bytes, including signed zero, rather than typed-array prototypes.
  const bytes = (mesh: Mesh) => JSON.stringify(Object.entries(mesh).map(([key, value]) => [key,
    ArrayBuffer.isView(value) ? Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) : value]));
  const sample = (mesh: Mesh, x: number, z: number, kind?: number) => {
    let highest: {y: number; road: number[]} | undefined;
    const heights: number[] = [];
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const vertices = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]], p = mesh.positions;
      if (kind != null && mesh.road![vertices[0] * 4 + 3] !== kind) continue;
      const [a, b, c] = vertices.map(v => [p[v * 3], p[v * 3 + 2]]);
      const det = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(det) < 1e-12) continue;
      const u = ((x - a[0]) * (c[1] - a[1]) - (z - a[1]) * (c[0] - a[0])) / det;
      const v = ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])) / det;
      if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const weights = [1 - u - v, u, v], y = vertices.reduce((sum, vertex, i) => sum + p[vertex * 3 + 1] * weights[i], 0);
      heights.push(y);
      if (!highest || y > highest.y) highest = {y, road: [0, 1, 2, 3].map(k => vertices.reduce((sum, vertex, i) => sum + mesh.road![vertex * 4 + k] * weights[i], 0))};
    }
    if (!highest) throw Error('Road coverage missing at sample');
    return {...highest, heights};
  };
  const area = (mesh: Mesh) => {
    let result = 0;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]].map(v => [mesh.positions[v * 3], mesh.positions[v * 3 + 2]]);
      const signed = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      expect(signed).toBeLessThan(0);
      result -= signed / 2;
    }
    return result;
  };

  it('keeps the captured Sedanes stone face above its curb at the played inversion point', () => {
    // These two source triangles and encoded heights came from the actual
    // square replay. The narrower strip's different triangulation previously
    // put its curb above the flagstones despite their intended layer order.
    const positions = new Float32Array([
      59.74874496459961,27.55817222595215,97.31806182861328,
      57.86335372924805,26.733928680419922,102.13664245605469,
      61.25497817993164,27.467754364013672,98.7450180053711,
      56,26.441600799560547,103.18387603759766,
      57.880435943603516,26.732624053955078,102.11956024169922,
      62.22716522216797,27.673099517822266,97.77283477783203,
    ]);
    const heights = [
      1.5388506874565395,1.5398196205620083,1.5121299235026042,1.5140192138671877,1.5147447509765626,1.5248641779833763,1.5350931590266481,1.5350931590266481,
      1.5006360514322918,1.5011259440104168,1.5013316162109376,1.501019490559896,1.500237109375,1.517162839278949,1.5350931590266481,1.5350931590266481,
      1.4915854410807294,1.4909033121744792,1.4892465657552085,1.4869562662760416,1.4882533447265625,1.5135635757698345,1.5156668065641052,1.5169540664924908,
      1.480022322591146,1.4786187906901043,1.475297029622396,1.4711980550130208,1.4767873779296876,1.4888455566406251,1.5017584635416665,1.5099130045572917,
      1.4681491455078126,1.4659466959635417,1.4608731038411458,1.454876570638021,1.4646702880859377,1.4849274495442708,1.506482722981771,1.520168709309896,
      1.4581662923177083,1.4545561767578126,1.4473628173828126,1.4391224934895834,1.45073935546875,1.4755461100260416,1.502078857421875,1.5188778320312502,
      1.4524446777343751,1.4465545979817709,1.4367639811197919,1.4257651692708333,1.434962540690104,1.4577570149739583,1.482670222981771,1.4982289632161458,
      1.4528405192057292,1.445077685546875,1.4331300944010417,1.419378995768229,1.4236660725911459,1.440427840169271,1.4596401041666667,1.4712817708333334,
    ];
    const mesh = {positions, indices: new Uint32Array([0,1,2,3,4,5]),
      normals: new Float32Array(Array.from({length: 6}, () => [0,1,0]).flat()), colors: new Float32Array(18).fill(.4),
      road: new Float32Array(Array.from({length: 6}, (_, i) => [0,0,1,i < 3 ? ROAD_SURFACE.flagstone : ROAD_SURFACE.curb]).flat()),
      terrainLift: new Float32Array([.43000033497810364,.43000033497810364,.43000033497810364,.42499932646751404,.42499932646751404,.42499932646751404])};
    const heightAt = (x: number, z: number) => {
      const gx = x / 1.524, gz = z / 1.524, ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
      const h = (a: number, b: number) => heights[(b - 314) * 8 + a - 287];
      return heightToMeters((h(ix,iz) * (1-u) + h(ix+1,iz) * u) * (1-v)
        + (h(ix,iz+1) * (1-u) + h(ix+1,iz+1) * u) * v);
    };
    const refined = refineRoadMeshForFooting(mesh, {x:384,z:384}, {centerX:438.912,centerZ:487.68,
      innerRadius:8,outerRadius:16,maxEdgeM:.1905,heightAt});
    const x = 59.01326703792063, z = 100.60042328406377;
    expect(sample(refined,x,z,ROAD_SURFACE.flagstone).y - sample(refined,x,z,ROAD_SURFACE.curb).y).toBeGreaterThan(.0001);
    expect(sample(refined,x,z,ROAD_SURFACE.flagstone).y - sample(refined,x,z,ROAD_SURFACE.curb).y).toBeCloseTo(.00025,5);
  });

  it('renders every face of a dense road in bounded partitions while single-mesh callers still refuse it', () => {
    const data = baseChunk(), m = WORLD3D_CONFIG.METERS_PER_CELL;
    const makeRoad = (index: number) => ({points:[{x:44/m,y:64/m},{x:84/m,y:64/m}],width:[24/m,24/m],alongM:[index*100,index*100+40]});
    data.roads = [makeRoad(0)];
    const d = {...detail(),innerRadius:8,outerRadius:16,maxEdgeM:.1905};
    const single = refineRoadMeshForFooting(buildRoadMesh(data),origin,d);
    data.roads = Array.from({length:7},(_,index)=>makeRoad(index));
    const source = buildRoadMesh(data), before = bytes(source);
    expect(()=>refineRoadMeshForFooting(source,origin,d)).toThrow('bounded mesh budget');
    const parts = refineRoadMeshesForFooting(source,origin,d);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.length).toBeLessThanOrEqual(4);
    expect(parts.reduce((sum,part)=>sum+part.indices.length,0)).toBe(single.indices.length*7);
    for(const part of parts){
      expect(part.positions.length/3).toBeLessThanOrEqual(250000);
      expect(part.road).toHaveLength(part.positions.length/3*4);
      expect(part.colors).toHaveLength(part.positions.length);
      expect(Math.max(...part.indices.slice(-100))).toBeLessThan(part.positions.length/3);
    }
    expect(bytes(source)).toBe(before);
    expect(()=>refineRoadMeshesForFooting(source,origin,{...d,maxEdgeM:1e-6})).toThrow('bounded mesh budget');
  });

  it('retains source draw-offset metadata across the worker structured-clone boundary', () => {
    const mesh = fixture(STREET_TIER_SPECS.avenue.colorHex), copy = structuredClone(mesh);
    expect(mesh.terrainLift).toHaveLength(mesh.positions.length / 3);
    expect(bytes(copy)).toBe(bytes(mesh));
    expect(new Set(Array.from(mesh.terrainLift!, lift => Math.round(lift * 1000)))).toEqual(new Set([360, 370]));
  });

  it('keeps paving close to continuous source feet instead of the old coarse road plane', () => {
    const mesh = fixture(), d = detail(), x = 64.123, z = 64.456;
    expect(sample(mesh, x, z).y - d.heightAt(x, z)).toBeGreaterThan(.9);
    const refined = refineRoadMeshForFooting(mesh, origin, d);
    expect(sample(refined, x, z).y).toBeCloseTo(d.heightAt(x, z) + .003, 3);
  });

  it('preserves road-space placement, kinds and source buffers while subdividing', () => {
    const mesh = fixture(), before = structuredClone(mesh), d = detail(), x = 64.123, z = 64.456;
    const refined = refineRoadMeshForFooting(mesh, origin, d);
    const original = sample(mesh, x, z), projected = sample(refined, x, z);
    projected.road.forEach((value, index) => expect(value).toBeCloseTo(original.road[index], 4));
    expect(refined.road).toHaveLength(refined.positions.length / 3 * 4);
    expect(refined.colors).toHaveLength(refined.positions.length);
    expect(refined.normals).toHaveLength(refined.positions.length);
    expect(bytes(mesh)).toBe(bytes(before));
  });

  it('preserves planar coverage and upward winding without overlapping new paving', () => {
    const mesh = fixture(), refined = refineRoadMeshForFooting(mesh, origin, detail());
    expect(area(refined)).toBeCloseTo(area(mesh), 3);
    for (const x of [44.1, 57.9, 58, 60.2, 64.3, 67.9, 70, 70.1, 83.9]) sample(refined, x, 64.2);
  });

  it('keeps the old exterior plane and declines stale or distant artifacts', () => {
    const mesh = fixture(), refined = refineRoadMeshForFooting(mesh, origin, detail());
    expect(sample(refined, 46, 64).y).toBe(sample(mesh, 46, 64).y);
    expect(refineRoadMeshForFooting(mesh, origin, detail(10000))).toBe(mesh);
    const stale = {...mesh, terrainLift: undefined};
    expect(refineRoadMeshForFooting(stale, origin, detail())).toBe(stale);
  });

  it('retains the ordering of avenue layers without introducing a walking platform', () => {
    const mesh = fixture(STREET_TIER_SPECS.avenue.colorHex), d = detail(), x = 64.123, z = 64.456;
    const refined = refineRoadMeshForFooting(mesh, origin, d);
    const curb = sample(refined, x, z, ROAD_SURFACE.curb).y, core = sample(refined, x, z, ROAD_SURFACE.setts).y;
    expect(core).toBeGreaterThan(curb);
    expect(core - d.heightAt(x, z)).toBeLessThan(.01);
    expect(core - curb).toBeCloseTo(.0005, 4);
  });

  it('uses the same global projection on both sides of a chunk boundary', () => {
    const m = WORLD3D_CONFIG.METERS_PER_CELL;
    const segment = (cx: number, from: number, to: number) => {
      const data = {...baseChunk(), cx};
      data.roads = [{points: [{x: from / m, y: 64 / m}, {x: to / m, y: 64 / m}], width: [6 / m, 6 / m], alongM: [from, to]}];
      return buildRoadMesh(data);
    };
    const d = detail(128), left = refineRoadMeshForFooting(segment(0, 116, 128), origin, d);
    const right = refineRoadMeshForFooting(segment(1, 128, 140), {x: 128, z: 0}, d);
    for (const z of [62.2, 63.7, 64.4, 66.1]) {
      const a = sample(left, 128, z), b = sample(right, 0, z);
      expect(a.y).toBeCloseTo(b.y, 5);
      a.road.forEach((value, index) => expect(value).toBeCloseTo(b.road[index], 4));
    }
  });

  it('keeps overlapping source road faces on the same projected plane', () => {
    const data = baseChunk(), m = WORLD3D_CONFIG.METERS_PER_CELL;
    // Use the played ground-height scale. At the older900m fixture height,
    // Float32 quantization alone exceeds the2micrometer comparison limit.
    data.heights.fill(metersToHeight(15));
    data.roads = [
      {points: [{x: 44 / m, y: 64 / m}, {x: 84 / m, y: 64 / m}], width: [6 / m, 6 / m]},
      {points: [{x: 44 / m, y: 62 / m}, {x: 84 / m, y: 66 / m}], width: [6 / m, 6 / m]},
    ];
    const d = {...detail(), maxEdgeM: .1905, heightAt: (x: number, z: number) => 14.3 + .04 * (x - 64) + .005 * (z - 64) ** 2};
    const refined = refineRoadMeshForFooting(buildRoadMesh(data), origin, d);
    for (const [x, z] of [[63.123, 64.456], [64.321, 63.789], [65.234, 64.345]]) {
      const heights = sample(refined, x, z).heights;
      expect(heights.length).toBeGreaterThanOrEqual(2);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(.000002);
    }
  });

  it('rejects invalid or nonfinite projection without changing the source mesh', () => {
    const mesh = fixture(), before = structuredClone(mesh);
    expect(() => refineRoadMeshForFooting(mesh, origin, {...detail(), maxEdgeM: 0})).toThrow('Invalid road footing');
    expect(() => refineRoadMeshForFooting(mesh, origin, {...detail(), heightAt: () => NaN})).toThrow('Nonfinite canonical road');
    expect(bytes(mesh)).toBe(bytes(before));
  });
});

it('keeps distinct paving colors when vertex lookup hashes collide', () => {
  // These two paints collide at the retained corner in the numeric lookup.
  // They must remain distinct: a cache hash is never a material identity.
  const paints = [[0.5, 0.25, 0.75], [0.5000001192092896, 1.1756706341690996e-38, 0.75]];
  const mesh = {
    positions: new Float32Array([-4,.3,-4, -3,.3,-4, 0,.3,0, -4,.3,-4, -3,.3,-4, 0,.3,0]),
    indices: new Uint32Array([0,2,1, 3,5,4]),
    normals: new Float32Array(Array.from({length:6}, () => [0,1,0]).flat()),
    colors: new Float32Array(paints.flatMap(color => Array.from({length:3}, () => color).flat())),
    road: new Float32Array(Array.from({length:6}, () => [0,0,1,0]).flat()),
    terrainLift: new Float32Array(6).fill(.3),
  };
  const refined = refineRoadMeshForFooting(mesh, {x:0,z:0}, {
    centerX:0,centerZ:0,innerRadius:1,outerRadius:2,maxEdgeM:.5,heightAt:() => 0,
  });
  const retainedPaints: number[][] = [];
  for (let i=0;i<refined.positions.length/3;i++) {
    if (refined.positions[i*3] === -4 && refined.positions[i*3+2] === -4) {
      retainedPaints.push(Array.from(refined.colors!.slice(i*3,i*3+3)));
    }
  }
  expect(retainedPaints).toEqual(paints.map(color => Array.from(new Float32Array(color))));
});
