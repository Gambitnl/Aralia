/**
 * GG-533: a ground edit removes the paving it cuts through and no more: the
 * removed area is the edit's footprint, within the cut's finest piece, even on
 * a paving face many times larger than the hole.
 */
import { describe, expect, it } from 'vitest';
import { CUT_EDGE_M, cutRoadMeshByGroundShapes, triangleMeetsGroundShape } from '../groundEditRoadCut';
import type { GroundShape } from '@/systems/worldforge/terrain/groundShapeProfile';
import type { ChunkGeometryArrays } from '../types';

type Mesh = ChunkGeometryArrays & { road: Float32Array; terrainLift: Float32Array };

/** One mesh from triangles given as [x, z] corners, chunk-local, flat at y = 1. */
function mesh(tris: Array<[[number, number], [number, number], [number, number]]>): Mesh {
  const positions: number[] = [];
  const road: number[] = [];
  const lift: number[] = [];
  for (const t of tris) for (const [x, z] of t) { positions.push(x, 1, z); road.push(x, z, 3, 2); lift.push(0.3); }
  return {
    positions: new Float32Array(positions), normals: new Float32Array(positions.length),
    indices: Uint32Array.from({ length: positions.length / 3 }, (_, i) => i),
    road: new Float32Array(road), terrainLift: new Float32Array(lift),
  };
}

/** The drawn area of a mesh, m^2, and whether any kept piece has its center inside a shape. */
function measure(m: ChunkGeometryArrays, origin: { x: number; z: number }, s: GroundShape) {
  let area = 0;
  let centerInside = false;
  const P = m.positions;
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]].map((v) => [P[v * 3], P[v * 3 + 2]]);
    area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    const cx = (a[0] + b[0] + c[0]) / 3 + origin.x, cz = (a[1] + b[1] + c[1]) / 3 + origin.z;
    const bx = s.x2 ?? s.x, bz = s.z2 ?? s.z, ex = bx - s.x, ez = bz - s.z, len2 = ex * ex + ez * ez;
    const u = len2 > 0 ? Math.max(0, Math.min(1, ((cx - s.x) * ex + (cz - s.z) * ez) / len2)) : 0;
    if (Math.hypot(cx - s.x - ex * u, cz - s.z - ez * u) < s.radius - CUT_EDGE_M) centerInside = true;
  }
  return { area, centerInside };
}

describe('cutRoadMeshByGroundShapes', () => {
  it('cuts a hole the size of the edit out of one 40 m paving face', () => {
    const big = mesh([[[0, 0], [0, 40], [40, 0]]]);
    const hole: GroundShape = { shape: 'hole', x: 108, z: 58, radius: 2, depth: 2 };
    const out = cutRoadMeshByGroundShapes(big, { x: 100, z: 50 }, [hole]);
    const { area, centerInside } = measure(out, { x: 100, z: 50 }, hole);
    // 800 m^2 less the 12.6 m^2 hole, within the cut's jagged edge along the 12.6 m rim.
    expect(Math.abs(area - (800 - Math.PI * 4))).toBeLessThan(2 * Math.PI * 2 * CUT_EDGE_M);
    expect(centerInside).toBe(false);
    // Every per-vertex array grew together, and a road surface kind is copied, not blended.
    const n = out.positions.length / 3;
    expect(out.road.length).toBe(n * 4);
    expect(out.terrainLift.length).toBe(n);
    for (let v = 0; v < n; v += 1) expect(out.road[v * 4 + 3]).toBe(2);
    expect(Math.max(...out.indices)).toBeLessThan(n);
  });

  it('removes a face wholly inside the footprint and keeps faces it does not reach', () => {
    const two = mesh([[[0, 0], [0, 1], [1, 0]], [[20, 0], [20, 1], [21, 0]]]);
    const out = cutRoadMeshByGroundShapes(two, { x: 0, z: 0 }, [{ shape: 'hole', x: 0.4, z: 0.4, radius: 3, depth: 1 }]);
    expect(Array.from(out.indices)).toEqual([3, 4, 5]);
  });

  it('cuts a trench across a strip and returns the same mesh when no shape reaches it', () => {
    const strip = mesh([[[0, 0], [0, 2], [20, 0]], [[20, 0], [0, 2], [20, 2]]]);
    const trench: GroundShape = { shape: 'trench', x: 110, z: 49, x2: 110, z2: 53, radius: 0.5, depth: 1 };
    const out = cutRoadMeshByGroundShapes(strip, { x: 100, z: 50 }, [trench]);
    expect(Math.abs(measure(out, { x: 100, z: 50 }, trench).area - (40 - 2))).toBeLessThan(4 * CUT_EDGE_M);
    expect(cutRoadMeshByGroundShapes(strip, { x: 100, z: 50 }, [{ ...trench, x: 300, x2: 300 }])).toBe(strip);
  });

  it('finds a hole inside a large face that no corner reaches', () => {
    expect(triangleMeetsGroundShape({ shape: 'hole', x: 8, z: 8, radius: 2, depth: 1 }, [0, 0], [40, 0], [0, 40])).toBe(true);
    expect(triangleMeetsGroundShape({ shape: 'hole', x: 40, z: 40, radius: 2, depth: 1 }, [0, 0], [40, 0], [0, 40])).toBe(false);
  });
});
