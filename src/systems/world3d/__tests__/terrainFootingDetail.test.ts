import { describe, expect, it } from 'vitest';
import { footingDetailReady, GROUND_EDIT_BLEND_M, groundEditDetail, refineTerrainForDetails, refineTerrainForFooting, type TerrainFootingDetail } from '../terrainFootingDetail';
import { applyGroundShape } from '@/systems/worldforge/bridge/groundRecord';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { groundShapeBounds, type GroundShape } from '@/systems/worldforge/terrain/groundShapeProfile';
import { buildTerrainMesh } from '../chunkGeometry';
import { weldChunkEdgeHeights } from '../edgeWeld';
import { heightToMeters, metersToHeight } from '../config';
import type { TerrainMesh } from '../types';

const plane = (): TerrainMesh => ({
  positions: new Float32Array([0, 0, 0, 16, 0, 0, 0, 0, 16, 16, 0, 16]),
  indices: new Uint32Array([0, 2, 1, 1, 2, 3]),
  normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
  colors: new Float32Array(12).fill(.5),
});
const detail = (overrides: Partial<TerrainFootingDetail> = {}): TerrainFootingDetail => ({
  centerX: 8, centerZ: 8, innerRadius: 4, outerRadius: 6, maxEdgeM: .5,
  heightAt: (x, z) => 2 + .3 * (x - 8) + .02 * (x - 8) * (z - 8), ...overrides,
});
function edges(mesh: TerrainMesh) {
  const counts = new Map<string, number>();
  for (let i = 0; i < mesh.indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = mesh.indices[i + j], b = mesh.indices[i + (j + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
function heightAt(mesh: TerrainMesh, x: number, z: number): number {
  const p = mesh.positions;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] * 3, b = mesh.indices[i + 1] * 3, c = mesh.indices[i + 2] * 3;
    const bx = p[b] - p[a], bz = p[b + 2] - p[a + 2], cx = p[c] - p[a], cz = p[c + 2] - p[a + 2];
    const det = bx * cz - bz * cx;
    if (Math.abs(det) < 1e-12) continue;
    const u = ((x - p[a]) * cz - (z - p[a + 2]) * cx) / det;
    const v = (bx * (z - p[a + 2]) - bz * (x - p[a])) / det;
    if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) return p[a + 1] + u * (p[b + 1] - p[a + 1]) + v * (p[c + 1] - p[a + 1]);
  }
  throw Error('Uncovered land point');
}

describe('canonical near-foot terrain detail', () => {
  it('refuses an excessive finite-grid request before allocating an unbounded mesh', () => {
    expect(() => refineTerrainForFooting(plane(), { x: 0, z: 0 }, detail({ maxEdgeM: 1e-6 }))).toThrow('bounded mesh budget');
  });

  it('keeps exterior partition-line cuts level and matching on an adjacent chunk outside the patch', () => {
    const make = (cy: number, resolution: number) => buildTerrainMesh({ cx: 2, cy, resolution,
      heights: weldChunkEdgeHeights(new Float32Array(resolution * resolution).fill(50), resolution),
      biomeIds: Array(resolution * resolution).fill('plains'), roads: [], rivers: [], sites: [] });
    const d = detail({ centerX: 292.608, centerZ: 268.224, innerRadius: 8, outerRadius: 16,
      maxEdgeM: 1.524 / 8, heightAt: () => 100 });
    const original = make(0, 9), far = refineTerrainForFooting(original, { x: 256, z: 0 }, d);
    const near = refineTerrainForFooting(make(1, 17), { x: 256, z: 128 }, d);
    for (let i = 1; i < far.positions.length; i += 3) expect(far.positions[i]).toBe(original.positions[1]);
    const border = (mesh: TerrainMesh, z: number) => [...edges(mesh)]
      .filter(([key, count]) => count === 1 && key.split(':').every(i => mesh.positions[Number(i) * 3 + 2] === z))
      .map(([key]) => key.split(':').map(i => { const n = Number(i) * 3; return mesh.positions[n].toFixed(5) + ',' + mesh.positions[n + 1].toFixed(5); }).sort().join('|')).sort();
    expect(border(far, 128)).toEqual(border(near, 0));
  });
  it.each([
    { label: 'woodland', cx: 2, cy: 1, centerX: 48 * 6.096, centerZ: 44 * 6.096 },
    { label: 'western road arrival', cx: 0, cy: 3, centerX: 16 * 6.096, centerZ: 85 * 6.096 },
  ])('covers the actual $label failure anchor with a bounded conforming partition', ({ cx, cy, centerX, centerZ }) => {
    const resolution = 17;
    const original = buildTerrainMesh({ cx, cy, resolution,
      heights: new Float32Array(resolution * resolution).fill(50),
      biomeIds: Array(resolution * resolution).fill('plains'), roads: [], rivers: [], sites: [] });
    const snapshot = original.positions.slice();
    const mesh = refineTerrainForFooting(original, { x: cx * 128, z: cy * 128 }, detail({
      centerX, centerZ, innerRadius: 8, outerRadius: 16,
      maxEdgeM: 1.524 / 8, heightAt: (x, z) => x * .01 + z * .02,
    }));
    expect(original.positions).toEqual(snapshot);
    expect(mesh.positions.length / 3).toBeLessThan(250000);
    let area = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]].map(v => v * 3);
      area += Math.abs((mesh.positions[b] - mesh.positions[a]) * (mesh.positions[c + 2] - mesh.positions[a + 2])
        - (mesh.positions[b + 2] - mesh.positions[a + 2]) * (mesh.positions[c] - mesh.positions[a])) / 2;
    }
    expect(area).toBeCloseTo(128 * 128, 4);
    for (const [key, count] of edges(mesh)) {
      expect(count).toBeLessThanOrEqual(2);
      if (count !== 1) continue;
      const [a, b] = key.split(':').map(Number), p = mesh.positions;
      expect((p[a * 3] === p[b * 3] && [0, 128].includes(p[a * 3]))
        || (p[a * 3 + 2] === p[b * 3 + 2] && [0, 128].includes(p[a * 3 + 2]))).toBe(true);
    }
  });
  it('refines the existing triangle partition without holes, overlap or hanging interior edges', () => {
    const original = plane(), snapshot = Array.from(original.positions);
    const refined = refineTerrainForFooting(original, { x: 0, z: 0 }, detail());
    expect(Array.from(original.positions)).toEqual(snapshot);
    let area = 0;
    for (let i = 0; i < refined.indices.length; i += 3) {
      const [a, b, c] = [refined.indices[i], refined.indices[i + 1], refined.indices[i + 2]].map(v => v * 3), p = refined.positions;
      const cross = (p[b] - p[a]) * (p[c + 2] - p[a + 2]) - (p[b + 2] - p[a + 2]) * (p[c] - p[a]);
      expect(cross).toBeLessThan(0); area -= cross / 2;
    }
    expect(area).toBeCloseTo(256, 5);
    for (const [key, count] of edges(refined)) {
      expect(count).toBeLessThanOrEqual(2);
      if (count !== 1) continue;
      const [a, b] = key.split(':').map(Number), p = refined.positions;
      expect((p[a * 3] === p[b * 3] && [0, 16].includes(p[a * 3]))
        || (p[a * 3 + 2] === p[b * 3 + 2] && [0, 16].includes(p[a * 3 + 2]))).toBe(true);
    }
    for (const value of [...refined.positions, ...refined.normals]) expect(Number.isFinite(value)).toBe(true);
  });

  it('approximates the canonical bilinear surface in the inner window without changing exterior height', () => {
    const d = detail(), mesh = refineTerrainForFooting(plane(), { x: 0, z: 0 }, d);
    for (const x of [5.13, 6.21, 8.17, 10.41]) for (const z of [5.51, 7.27, 9.61, 10.33]) {
      expect(Math.abs(heightAt(mesh, x, z) - d.heightAt(x, z))).toBeLessThan(.01);
    }
    expect(heightAt(mesh, .5, .5)).toBe(0);
    expect(heightAt(mesh, 15.5, 15.5)).toBe(0);
  });

  it('also enters a detail window wholly contained inside a large face', () => {
    const d = detail({ centerX: 3, centerZ: 3, innerRadius: .5, outerRadius: 1, maxEdgeM: .25, heightAt: () => 3 });
    const mesh = refineTerrainForFooting(plane(), { x: 0, z: 0 }, d);
    expect(heightAt(mesh, 3, 3)).toBeCloseTo(3, 6);
    expect(heightAt(mesh, 12, 12)).toBe(0);
  });

  it('preserves exterior shading and uses the canonical continuous slope inside', () => {
    const original = plane();
    original.normals.set([.2, .9, .1], 0);
    const mesh = refineTerrainForFooting(original, { x: 0, z: 0 }, detail({ heightAt: (x, z) => 2 + .3 * x + .2 * z }));
    expect(Array.from(mesh.normals.slice(0, 3))).toEqual(Array.from(original.normals.slice(0, 3)));
    let core = 0;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i], z = mesh.positions[i + 2];
      if (Math.max(Math.abs(x - 8), Math.abs(z - 8)) >= 3) continue;
      const length = Math.hypot(.3, 1, .2);
      expect(mesh.normals[i]).toBeCloseTo(-.3 / length, 6);
      expect(mesh.normals[i + 1]).toBeCloseTo(1 / length, 6);
      expect(mesh.normals[i + 2]).toBeCloseTo(-.2 / length, 6);
      core++;
    }
    expect(core).toBeGreaterThan(0);
  });

  it('returns an unrelated chunk unchanged and refuses nonfinite source heights', () => {
    const mesh = plane();
    expect(refineTerrainForFooting(mesh, { x: 1000, z: 1000 }, detail())).toBe(mesh);
    expect(() => refineTerrainForFooting(mesh, { x: 0, z: 0 }, detail({ heightAt: () => NaN }))).toThrow('Nonfinite');
  });

  it('keeps mixed-LOD stitched chunk borders identical after refinement', () => {
    const make = (cx: number, resolution: number) => {
      const heights = new Float32Array(resolution * resolution);
      for (let j = 0; j < resolution; j++) for (let i = 0; i < resolution; i++) heights[j * resolution + i] = metersToHeight((cx * 128 + i * 128 / (resolution - 1)) * .03 + j * 128 / (resolution - 1) * .01);
      return buildTerrainMesh({ cx, cy: 0, resolution, heights: weldChunkEdgeHeights(heights, resolution), biomeIds: Array(heights.length).fill('plains'), roads: [], rivers: [], sites: [] });
    };
    const d = detail({ centerX: 128, centerZ: 64, innerRadius: 4, outerRadius: 10, maxEdgeM: 1, heightAt: (x, z) => .03 * x + .01 * z + 2 * Math.cos((z - 64) / 5) });
    const left = refineTerrainForFooting(make(0, 17), { x: 0, z: 0 }, d), right = refineTerrainForFooting(make(1, 9), { x: 128, z: 0 }, d);
    const border = (mesh: TerrainMesh, x: number) => [...edges(mesh)].filter(([key, count]) => count === 1 && key.split(':').every(index => mesh.positions[Number(index) * 3] === x)).map(([key]) => key.split(':').map(index => { const i = Number(index) * 3; return `${mesh.positions[i + 2].toFixed(5)},${mesh.positions[i + 1].toFixed(5)}`; }).sort().join('|')).sort();
    expect(border(left, 128)).toEqual(border(right, 0));
  });

  it('waits for the entire detail window and its skirt-protecting neighbor ring', () => {
    const keys = new Set<string>();
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) keys.add(`${x}|${z}`);
    expect(footingDetailReady(detail(), keys, 128)).toBe(true);
    keys.delete('1|1');
    expect(footingDetailReady(detail(), keys, 128)).toBe(false);
  });
});

// GG-533: a spell's shape in the world's one ground shows on the drawn ground.
describe('ground edits on the drawn ground', () => {
  const chunk = (cx: number, cy: number) => buildTerrainMesh({ cx, cy, resolution: 17,
    heights: weldChunkEdgeHeights(new Float32Array(17 * 17).fill(50), 17),
    biomeIds: Array(17 * 17).fill('plains'), roads: [], rivers: [], sites: [] });
  /** The world's one ground at 1.524 m, flat at the chunk's own height, with shapes cut into it. */
  const ground = (flatM: number, shapes: GroundShape[]) => {
    const g = { cols: 300, rows: 300, heights: new Array(300 * 300).fill(metersToHeight(flatM)) };
    for (const s of shapes) applyGroundShape(g, s);
    const at = (x: number, z: number) => {
      const gx = x / GROUND_METERS_PER_CELL, gz = z / GROUND_METERS_PER_CELL;
      const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, H = (c: number, r: number) => heightToMeters(g.heights[r * 300 + c]);
      return (H(i, j) * (1 - fx) + H(i + 1, j) * fx) * (1 - fz) + (H(i, j + 1) * (1 - fx) + H(i + 1, j + 1) * fx) * fz;
    };
    return at;
  };
  const hole = (x: number, z: number): GroundShape => ({ shape: 'hole', x, z, radius: 3, depth: 2 });

  it('shows a 3 m hole that falls between the 8 m vertices, and leaves the land past the ease alone', () => {
    const mesh = chunk(2, 0), flat = mesh.positions[1];
    // The hole's center sits on a fine-ground vertex, 4 m from the nearest 8 m vertex.
    const cx = 196 * GROUND_METERS_PER_CELL, cz = 39 * GROUND_METERS_PER_CELL;
    const at = ground(flat, [hole(cx, cz)]);
    expect(heightAt(mesh, cx - 256, cz)).toBeCloseTo(flat, 6); // the coarse ground never saw it
    const out = refineTerrainForDetails(mesh, { x: 256, z: 0 }, [groundEditDetail(groundShapeBounds(hole(cx, cz)), GROUND_METERS_PER_CELL / 2, at)]);
    expect(heightAt(out, cx - 256, cz)).toBeCloseTo(flat - 2, 1);
    // Past the box and its 8 m ease the drawn ground is the coarse ground.
    expect(heightAt(out, cx - 256 + 3 + GROUND_EDIT_BLEND_M + 1, cz)).toBeCloseTo(flat, 6);
  });

  it('draws two edits in one chunk, each at its own depth', () => {
    const mesh = chunk(2, 0), flat = mesh.positions[1];
    const a = hole(190 * GROUND_METERS_PER_CELL, 30 * GROUND_METERS_PER_CELL);
    const b = { ...hole(230 * GROUND_METERS_PER_CELL, 60 * GROUND_METERS_PER_CELL), depth: 4 };
    const at = ground(flat, [a, b]);
    const out = refineTerrainForDetails(mesh, { x: 256, z: 0 },
      [a, b].map((s) => groundEditDetail(groundShapeBounds(s), GROUND_METERS_PER_CELL / 2, at)));
    expect(heightAt(out, a.x - 256, a.z)).toBeCloseTo(flat - 2, 1);
    expect(heightAt(out, b.x - 256, b.z)).toBeCloseTo(flat - 4, 1);
  });

  it('keeps the seam between two chunks watertight under an edit that crosses it', () => {
    const top = chunk(2, 0), flat = top.positions[1];
    const s = hole(200 * GROUND_METERS_PER_CELL, 128);
    const at = ground(flat, [s]);
    const d = [groundEditDetail(groundShapeBounds(s), GROUND_METERS_PER_CELL / 2, at)];
    const a = refineTerrainForDetails(top, { x: 256, z: 0 }, d);
    const b = refineTerrainForDetails(chunk(2, 1), { x: 256, z: 128 }, d);
    const border = (mesh: TerrainMesh, z: number) => [...edges(mesh)]
      .filter(([key, count]) => count === 1 && key.split(':').every(i => mesh.positions[Number(i) * 3 + 2] === z))
      .map(([key]) => key.split(':').map(i => { const n = Number(i) * 3; return mesh.positions[n].toFixed(4) + ',' + mesh.positions[n + 1].toFixed(4); }).sort().join('|')).sort();
    expect(border(a, 128)).toEqual(border(b, 0));
    expect(heightAt(a, s.x - 256, 127.9)).toBeLessThan(flat - 1);
  });
});
