/**
 * @file buildingModels.ts
 * Procedural roof-form geometry for styled town buildings (2026-07-01).
 * Origin at the roof BASE center; walls place it at wall-top Y. Plain arrays
 * so the React layer wraps them in BufferGeometry (memoized per form+dims).
 */
import type { ChunkGeometryArrays } from './types';
import type { RoofForm } from '../worldforge/town/architectureStyle';

export function buildRoofGeometry(form: RoofForm, width: number, depth: number, rise: number): ChunkGeometryArrays {
  switch (form) {
    case 'gable': return gable(width, depth, rise);
    case 'steep': return gable(width, depth, rise * 1.7);
    case 'flat': return flatParapet(width, depth);
    case 'hip': return hip(width, depth, rise);
  }
}

/** Ridge prism: two sloped faces + two triangular gable ends. Ridge runs along X (width). */
function gable(w: number, d: number, h: number): ChunkGeometryArrays {
  const hw = w / 2, hd = d / 2;
  const P: number[][] = [
    [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], // eaves 0-3
    [-hw, h, 0], [hw, h, 0],                                 // ridge 4-5
  ];
  const tris = [
    [0, 1, 5], [5, 4, 0],   // north slope
    [2, 3, 4], [4, 5, 2],   // south slope
    [3, 0, 4],              // west gable end
    [1, 2, 5],              // east gable end
  ];
  return fromTris(P, tris);
}

/** Pyramid (the old cone-as-pyramid, made explicit). Apex at center. */
function hip(w: number, d: number, h: number): ChunkGeometryArrays {
  const hw = w / 2, hd = d / 2;
  const P: number[][] = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [0, h, 0]];
  const tris = [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
  return fromTris(P, tris);
}

/** Flat roof slab + parapet rim (0.5 m lip). */
function flatParapet(w: number, d: number): ChunkGeometryArrays {
  const hw = w / 2, hd = d / 2, slab = 0.25, lip = 0.5, t = 0.3;
  const P: number[][] = [];
  const tris: number[][] = [];
  const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) => {
    const b = P.length;
    P.push([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
           [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
    const q = (a: number, bb: number, c: number, dd: number) => tris.push([a, bb, c], [c, dd, a]);
    q(b + 4, b + 5, b + 6, b + 7);                       // top
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; q(b + i, b + j, b + 4 + j, b + 4 + i); }
  };
  box(-hw, hw, -hd, hd, 0, slab);                        // slab
  box(-hw, hw, -hd, -hd + t, slab, slab + lip);          // rims
  box(-hw, hw, hd - t, hd, slab, slab + lip);
  box(-hw, -hw + t, -hd, hd, slab, slab + lip);
  box(hw - t, hw, -hd, hd, slab, slab + lip);
  return fromTris(P, tris);
}

/** Faceted mesh: duplicate verts per face for flat normals, both windings. */
function fromTris(P: number[][], tris: number[][]): ChunkGeometryArrays {
  const positions: number[] = [], indices: number[] = [], normals: number[] = [];
  for (const [a, b, c] of tris) {
    const A = P[a], B = P[b], C = P[c];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const base = positions.length / 3;
    for (const V of [A, B, C]) { positions.push(V[0], V[1], V[2]); normals.push(nx, ny, nz); }
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices), normals: new Float32Array(normals) };
}
