/**
 * @file surfaceNets.ts — voxels to a drawable surface.
 *
 * A volume you cannot see is a measurement, not ground. This turns a filled
 * VoxelVolume into a mesh, and it is the last piece needed before anyone can
 * judge whether volume ground is worth what it costs.
 *
 * WHY SURFACE NETS RATHER THAN CUBES OR MARCHING CUBES
 *
 * Blocky face extraction — draw a quad wherever solid meets air — is the
 * simplest thing that works and it produces Minecraft. At 25 cm cells every
 * hillside becomes a staircase, and the ADR already concedes a 25 cm step is
 * visible; there is no need to make it the dominant feature of the landscape.
 *
 * Marching cubes gives a smooth surface and a 256-case table, plus the sliver
 * triangles that table is famous for.
 *
 * Surface nets sit between them and are the right trade here. One vertex per
 * cell that straddles the boundary, placed at the average of the crossings on
 * that cell's edges, then a quad joining the four vertices around each crossed
 * edge. No case table. No slivers. Roughly a hundred lines, and the result is
 * smooth enough that a 25 cm cell reads as a soft undulation rather than a step.
 *
 * COLOR COMES FROM DEPTH, NOT FROM THE CELL
 *
 * Each surface vertex asks how far below the original ground it sits, and reads
 * the layer stack at that depth — the same function that colors the shell in
 * groundSolid.ts. So a pit wall grades from litter to soil to rock for the same
 * reason it does there, and a cut made by a spell needs no extra work to look
 * like it cut something.
 */
import { Material, VoxelVolume } from './voxelVolume';

export interface SurfaceMeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  triangles: number;
}

/** Which corner of a cell each of the 8 samples sits at. */
const CORNER: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];

/** The 12 edges of a cell, as pairs of corner indices. */
const EDGE: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/**
 * Build a surface from a volume.
 *
 * `colorAtDepth` is handed the depth below the ORIGINAL surface, so the caller
 * decides what the ground is made of. `surfaceYAt` supplies that original
 * height; without it every vertex reads depth zero and the mesh comes back one
 * flat tone, which is exactly the "no inside" fault this whole campaign exists
 * to remove.
 */
export function voxelsToSurface(
  vol: VoxelVolume,
  cellM: number,
  originM: readonly [number, number, number],
  colorAtDepth: (depthM: number) => readonly [number, number, number],
  surfaceYAt?: (xM: number, zM: number) => number,
): SurfaceMeshData {
  const n = vol.cells;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];

  // One vertex per boundary cell. -1 marks a cell that produced none.
  const vertexAt = new Int32Array((n - 1) ** 3).fill(-1);
  const cellIndex = (x: number, y: number, z: number) => (y * (n - 1) + z) * (n - 1) + x;

  const solid = (x: number, y: number, z: number) =>
    vol.get(x, y, z) !== Material.Air ? 1 : 0;

  // Pass one: place a vertex in every cell whose corners disagree.
  for (let z = 0; z < n - 1; z++) {
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const [dx, dy, dz] = CORNER[c];
          if (solid(x + dx, y + dy, z + dz)) mask |= 1 << c;
        }
        // All in or all out: no surface passes through this cell.
        if (mask === 0 || mask === 255) continue;

        // Average the midpoints of every edge that crosses the boundary. That
        // average is what smooths the staircase a blocky extraction would give.
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let crossings = 0;
        for (const [a, b] of EDGE) {
          const inA = (mask >> a) & 1;
          const inB = (mask >> b) & 1;
          if (inA === inB) continue;
          const ca = CORNER[a];
          const cb = CORNER[b];
          sx += (ca[0] + cb[0]) / 2;
          sy += (ca[1] + cb[1]) / 2;
          sz += (ca[2] + cb[2]) / 2;
          crossings++;
        }
        const vx = originM[0] + (x + sx / crossings) * cellM;
        const vy = originM[1] + (y + sy / crossings) * cellM;
        const vz = originM[2] + (z + sz / crossings) * cellM;

        vertexAt[cellIndex(x, y, z)] = pos.length / 3;
        pos.push(vx, vy, vz);

        const depth = surfaceYAt ? Math.max(0, surfaceYAt(vx, vz) - vy) : 0;
        const c = colorAtDepth(depth);
        col.push(c[0], c[1], c[2]);
      }
    }
  }

  /* Pass two: one quad per crossed edge, joining the four cells around it.
   *
   * Only the three edges leaving a cell in +x, +y and +z are walked. Every
   * edge in the grid is the +axis edge of exactly one cell, so this visits each
   * once — walking all twelve would emit every quad four times. */
  const emitQuad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, b, c, d);
    else idx.push(a, b, c, b, d, c);
  };

  for (let z = 0; z < n - 1; z++) {
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const here = solid(x, y, z);

        if (x > 0 && y > 0 && solid(x, y, z + 1) !== here) {
          emitQuad(
            vertexAt[cellIndex(x, y, z)],
            vertexAt[cellIndex(x - 1, y, z)],
            vertexAt[cellIndex(x, y - 1, z)],
            vertexAt[cellIndex(x - 1, y - 1, z)],
            here === 1,
          );
        }
        if (x > 0 && z > 0 && solid(x, y + 1, z) !== here) {
          emitQuad(
            vertexAt[cellIndex(x, y, z)],
            vertexAt[cellIndex(x, y, z - 1)],
            vertexAt[cellIndex(x - 1, y, z)],
            vertexAt[cellIndex(x - 1, y, z - 1)],
            here === 1,
          );
        }
        if (y > 0 && z > 0 && solid(x + 1, y, z) !== here) {
          emitQuad(
            vertexAt[cellIndex(x, y, z)],
            vertexAt[cellIndex(x, y - 1, z)],
            vertexAt[cellIndex(x, y, z - 1)],
            vertexAt[cellIndex(x, y - 1, z - 1)],
            here === 1,
          );
        }
      }
    }
  }

  // Normals from the faces. A surface-nets vertex has no natural normal, and
  // averaging its faces is both the cheapest and the smoothest answer.
  const positions = new Float32Array(pos);
  const normals = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [i0, i1, i2] = [idx[t], idx[t + 1], idx[t + 2]];
    const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
    const ux = positions[i1 * 3] - ax, uy = positions[i1 * 3 + 1] - ay, uz = positions[i1 * 3 + 2] - az;
    const vx = positions[i2 * 3] - ax, vy = positions[i2 * 3 + 1] - ay, vz = positions[i2 * 3 + 2] - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const i of [i0, i1, i2]) {
      normals[i * 3] += nx;
      normals[i * 3 + 1] += ny;
      normals[i * 3 + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l;
    normals[i + 1] /= l;
    normals[i + 2] /= l;
  }

  return {
    positions,
    normals,
    colors: new Float32Array(col),
    indices: new Uint32Array(idx),
    triangles: idx.length / 3,
  };
}
