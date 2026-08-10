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
 *
 * RANGE MESHING, so an edit re-meshes a REGION and not the world
 *
 * `meshCellRange` builds the surface for a sub-range of lattice cells. Chunks
 * partition the lattice disjointly; each chunk also COMPUTES (but does not
 * emit) a two-cell apron of border vertices and a one-cell apron of quads, so
 * seam vertices land at identical positions in both neighbors and their
 * normals see every face that touches them. The seams are watertight and
 * shade continuously by construction, with no cross-chunk bookkeeping.
 *
 * This is what turned a 4–7 second full re-mesh per brush stroke at 240³ into
 * a handful of chunk rebuilds. `voxelsToSurface` remains the whole-volume
 * call, built on the same range mesher.
 */
import { Material, VoxelVolume } from './voxelVolume';

export interface SurfaceMeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  triangles: number;
  /**
   * The height of the DRAWN top surface per voxel column, world meters.
   *
   * Laid out `z * cells + x`, `-Infinity` where no surface was placed over the
   * column. Reported because the drawn surface is NOT the top of the voxel
   * column: this mesher averages the edge crossings around each cell, so a
   * vertex sits up to a cell below the column it belongs to. That is what
   * smooths the staircase, and it means anything that has to SIT on the ground
   * — water, a footprint, a decal — must ask the mesh where the ground is
   * rather than ask the voxels.
   *
   * Water asked the voxels, and floated a metre above the hillside.
   */
  columnTopY: Float32Array;
  /**
   * Depth below the ORIGINAL surface per vertex, meters — the value that chose
   * its color. Exported so a shader can re-derive strata per FRAGMENT: vertex
   * colors interpolate across a whole cell, and at 1 m cells that smears a
   * 6 cm soil horizon into a meter-wide gradient. The attribute lets the
   * fragment shader draw the horizon at its true thickness.
   */
  cutDepth: Float32Array;
  /**
   * Baked ambient occlusion per vertex, 0 buried to 1 open sky.
   *
   * Sampled from voxel OCCUPANCY, not from the mesh: a handful of probes fan
   * out from each vertex along its normal, and every solid probe occludes.
   * That is what gives a bore hole contact-shadow depth and a crater a dark
   * floor seam — the mesh alone cannot know it sits inside a pocket.
   */
  ao: Float32Array;
}

/** An inclusive range of LATTICE cells (0 .. vol.cells, 0 .. vol.cellsY). */
export interface CellRange {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}

/** What one range-mesh call produces. Everything a chunk needs, nothing more. */
export interface ChunkMeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  triangles: number;
  cutDepth: Float32Array;
  ao: Float32Array;
  /**
   * Max drawn vertex Y per dual column OWNED by this range, or -Infinity.
   * Compact: laid out `(z - rect.z0) * rect.w + (x - rect.x0)` in lattice
   * coordinates. A caller stitching chunks folds these per column stack.
   */
  dualTopY: Float32Array;
  dualRect: { x0: number; z0: number; w: number; h: number };
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
 * A deterministic hash on lattice-cell coordinates, 0..1.
 *
 * Keyed on the CELL, never on the float position: two chunks that both compute
 * a border vertex must jitter it identically, and integer coordinates hash the
 * same everywhere while float math might not.
 */
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393);
  h = Math.imul((h + y) | 0, 668265263);
  h = Math.imul((h + z) | 0, 2246822519);
  h = (h + Math.imul(seed, 40503)) | 0;
  h = Math.imul(h ^ (h >>> 15), 2654435761);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/* Rim damage: vertices INSIDE a cut are jittered off the lattice.
 *
 * A voxel dig leaves clean stairsteps, and clean stairsteps read as molded
 * plastic — the strongest anti-substance signal the round-one critique named.
 * Real broken ground has chipped, irregular edges. The jitter is deterministic
 * per cell, fades in over the first cell of depth (so the untouched top
 * surface never moves), and is small enough vertically that the drawn floor
 * stays within the one-cell correction the water bed allows.
 */
const JITTER_XZ = 0.3; // of a cell
const JITTER_Y = 0.14;

/* Graded occupancy AO: five directions fanned around the normal, each sampled
 * at three distances. The old two-distance fan went to full dark two voxels
 * into any pit — "underexposed black", the critique called it. The far ring
 * lets a shaft darken over five cells instead, so interior walls stay readable
 * on the way down. Runs at (re)mesh time only, never per frame. */
const AO_DIST = [1.4, 2.9, 5.2] as const;
const AO_W = [1.0, 0.55, 0.3] as const;
const AO_W_TOTAL = 5 * (AO_W[0] + AO_W[1] + AO_W[2]);

/** How far (in cells) an edit can change the baked AO of nearby vertices. */
export const AO_REACH_CELLS = Math.ceil(AO_DIST[AO_DIST.length - 1]);

/**
 * The same reach counted in VERTICAL cells.
 *
 * The fan is a fixed length in world meters, so a volume whose vertical cell is
 * finer than its horizontal one needs proportionally more Y cells of re-mesh
 * padding around an edit. Getting this wrong does not corrupt anything — it
 * leaves a lit seam one slab above or below a fresh carve, which is exactly the
 * artefact the padding exists to prevent.
 */
export function aoReachCellsY(cellM: number, cellHM: number): number {
  return Math.ceil(AO_DIST[AO_DIST.length - 1] * (cellM / cellHM));
}

/**
 * Build the surface for a range of lattice cells.
 *
 * `colorAtDepth` is handed the depth below the ORIGINAL surface, so the caller
 * decides what the ground is made of. `surfaceYAt` supplies that original
 * height; without it every vertex reads depth zero and the mesh comes back one
 * flat tone, which is exactly the "no inside" fault this whole campaign exists
 * to remove.
 */
export function meshCellRange(
  vol: VoxelVolume,
  cellM: number,
  originM: readonly [number, number, number],
  colorAtDepth: (depthM: number) => readonly [number, number, number],
  surfaceYAt?: (xM: number, zM: number) => number,
  range?: CellRange,
  cellHM: number = cellM,
): ChunkMeshData {
  const n = vol.cells;
  /* The VERTICAL lattice, which no longer has to match the horizontal one.
   * Every Y bound below reads `nY`/`cellHM`; when they equal `n`/`cellM` - the
   * cubic volume every caller had before - the arithmetic is identical. */
  const nY = vol.cellsY;

  /* The lattice extends ONE step past the volume on all six sides.
   *
   * Without the pad, the border cell at y = 0 samples corners at y = 0 and
   * y = 1, both solid, so it is never a boundary and no floor is emitted. The
   * result was an open shell — a crater carved inside it appeared to hang in
   * the middle of the "solid" ground.
   *
   * Lattice cell i straddles voxels i - 1 and i, and `vol.get` reports Air
   * outside. */
  const cn = n + 1; // lattice cells across, 0..n
  const cnY = nY + 1; // lattice cells up, 0..nY
  const pos0 = -1; // lattice-to-voxel offset

  const hiOf = (axis: number) => (axis === 1 ? cnY - 1 : cn - 1);
  const clampCell = (v: number, axis: number) => Math.min(hiOf(axis), Math.max(0, v));
  const eLo = range ? range.min.map(clampCell) : [0, 0, 0];
  const eHi = range ? range.max.map(clampCell) : [cn - 1, cnY - 1, cn - 1];
  /* Aprons. Emitted quads at eLo reference vertices one cell below; those
   * border vertices need their OWN neighboring quads (one more cell out) for
   * face-averaged normals that match the neighbor chunk exactly. */
  const vLo = eLo.map((v) => Math.max(0, v - 2));
  const vHi = eHi.map((v, a) => Math.min(hiOf(a), v + 1));
  const qLo = eLo.map((v) => Math.max(0, v - 1));
  const qHi = eHi.map((v, a) => Math.min(hiOf(a), v + 1));

  const pos: number[] = [];
  const col: number[] = [];
  const dep: number[] = [];
  const idx: number[] = []; // emitted triangles
  const idxN: number[] = []; // apron triangles: normal support only, never drawn

  // One vertex per boundary cell in the vertex window. -1 marks none.
  const vw = [vHi[0] - vLo[0] + 1, vHi[1] - vLo[1] + 1, vHi[2] - vLo[2] + 1];
  const vertexAt = new Int32Array(vw[0] * vw[1] * vw[2]).fill(-1);
  const cellIndex = (x: number, y: number, z: number) =>
    ((y - vLo[1]) * vw[2] + (z - vLo[2])) * vw[0] + (x - vLo[0]);

  /* The highest OWNED vertex per dual column, gathered as we go. Owned means
   * inside the emit range on all three axes: every lattice cell has exactly
   * one owner, so folding the chunks' maxima per column is exact. */
  const dualRect = {
    x0: eLo[0],
    z0: eLo[2],
    w: eHi[0] - eLo[0] + 1,
    h: eHi[2] - eLo[2] + 1,
  };
  const dualTopY = new Float32Array(dualRect.w * dualRect.h).fill(-Infinity);

  /* Skip the bricks no surface can pass through.
   *
   * The volume is sparse — at 240 m and 1 m cells it holds 13.8 million cells
   * in half a megabyte, because almost every brick is uniform rock or uniform
   * air. A mesher that walks every cell pays for all of it: 4.3 seconds
   * measured, against a surface that is a thin band.
   *
   * A brick can hold no boundary when it is uniform AND its six face neighbors
   * are uniform with the same solidness. The band is computed per BRICK column
   * — only the columns this range touches — and widened by one brick, so the
   * padded lattice and the diagonal neighbors are always inside it.
   */
  const nb = vol.bricks;
  const nbY = vol.bricksY;
  const bandLo = new Int32Array(nb * nb).fill(nbY);
  const bandHi = new Int32Array(nb * nb).fill(-1);
  const isSolid = (m: Material | null) => (m === null ? null : m !== Material.Air);
  const bxLo = Math.max(0, (vLo[0] + pos0) >> 3);
  const bxHi = Math.min(nb - 1, (vHi[0] + 1 + pos0) >> 3);
  const bzLo = Math.max(0, (vLo[2] + pos0) >> 3);
  const bzHi = Math.min(nb - 1, (vHi[2] + 1 + pos0) >> 3);
  /* The Y scan is bounded by the RANGE's own brick rows, never the column.
   *
   * It used to walk every brick row of every footprint column. On open
   * ground that was noise, but a column that is dirty ALL the way down — a
   * pre-bored shaft, any deep player carve — made every thin slab over that
   * footprint pay for the full column height: at 240³ beside the shafts, a
   * 4-cell slab emitting ZERO triangles cost ~20 ms of pure band scan and
   * corner sampling, and 28 of them stacked into the critic's 154 ms worst
   * slice. A brick can only widen this range's CLAMPED per-column y window
   * when `(by + 2) * 8 - pos0 >= vLo[1]` and `(by - 1) * 8 - pos0 <=
   * vHi[1]`; scanning two brick rows past the window on each side covers
   * both bounds exactly, so the clamped result is identical and the cost is
   * proportional to the slab, not to the void beneath it. */
  const byLo = Math.max(0, ((vLo[1] + pos0) >> 3) - 2);
  const byHi = Math.min(nbY - 1, ((vHi[1] + 1 + pos0) >> 3) + 2);
  for (let bz = bzLo; bz <= bzHi; bz++) {
    for (let bx = bxLo; bx <= bxHi; bx++) {
      for (let by = byLo; by <= byHi; by++) {
        const here = isSolid(vol.brickMaterial(bx, by, bz));
        let interesting = here === null;
        if (!interesting) {
          for (const [dx, dy, dz] of [
            [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
          ] as const) {
            const there = isSolid(vol.brickMaterial(bx + dx, by + dy, bz + dz));
            if (there === null || there !== here) {
              interesting = true;
              break;
            }
          }
        }
        if (!interesting) continue;
        const c = bz * nb + bx;
        if (by < bandLo[c]) bandLo[c] = by;
        if (by > bandHi[c]) bandHi[c] = by;
      }
    }
  }
  /** Cell-space y range worth visiting for a lattice column, padded one brick. */
  const yRange = (x: number, z: number): [number, number] => {
    const bx = Math.min(nb - 1, Math.max(0, (x + pos0) >> 3));
    const bz = Math.min(nb - 1, Math.max(0, (z + pos0) >> 3));
    const c = bz * nb + bx;
    if (bandHi[c] < 0) return [0, -1]; // nothing in this column at all
    const lo = Math.max(0, (bandLo[c] - 1) * 8 - pos0);
    const hi = Math.min(cnY - 1, (bandHi[c] + 2) * 8 - pos0);
    return [lo, hi];
  };

  const solid = (x: number, y: number, z: number) =>
    vol.get(x + pos0, y + pos0, z + pos0) !== Material.Air ? 1 : 0;

  /* Pass one: place a vertex in every cell whose corners disagree.
   *
   * Restructured around Y-LEVEL PLANES. The corner masks used to be built by
   * eight `solid()` probes per visited cell. On open ground the visited band
   * is thin and that was noise, but a slab whose footprint borders a
   * full-height shaft wall visits its ENTIRE y window across most columns —
   * ~68,000 volume reads for a slab that emits zero triangles, ~16 of the
   * ~20 ms such slabs cost, 28 of them behind the round-7 critic's 154 ms
   * worst slice. Each voxel level is now read ONCE into a plane and a cell's
   * mask is eight array reads; the loop runs y-major so two planes cover
   * every cell at that level. Vertex ORDER changes (y-major); nothing
   * consumes that order — quads resolve vertices through `vertexAt`, and
   * triangle order is still set by pass two. */
  const cw = vHi[0] - vLo[0] + 1;
  const cd = vHi[2] - vLo[2] + 1;
  const colLo = new Int32Array(cw * cd);
  const colHi = new Int32Array(cw * cd);
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let z = vLo[2]; z <= vHi[2]; z++) {
    for (let x = vLo[0]; x <= vHi[0]; x++) {
      const [yBandLo, yBandHi] = yRange(x, z);
      const lo = Math.max(yBandLo, vLo[1]);
      const hi = Math.min(yBandHi, vHi[1]);
      const ci = (z - vLo[2]) * cw + (x - vLo[0]);
      colLo[ci] = lo;
      colHi[ci] = hi;
      if (lo <= hi) {
        if (lo < yMin) yMin = lo;
        if (hi > yMax) yMax = hi;
      }
    }
  }
  const pw = cw + 1; // corner planes reach one past the cell window
  const pd = cd + 1;
  let pl0 = new Uint8Array(pw * pd);
  let pl1 = new Uint8Array(pw * pd);
  const fillPlane = (plane: Uint8Array, y: number): void => {
    let i = 0;
    for (let z = vLo[2]; z <= vHi[2] + 1; z++) {
      for (let x = vLo[0]; x <= vHi[0] + 1; x++) plane[i++] = solid(x, y, z);
    }
  };
  if (yMin <= yMax) {
    fillPlane(pl0, yMin);
    fillPlane(pl1, yMin + 1);
  }
  for (let y = yMin; y <= yMax; y++) {
    if (y > yMin) {
      const swap = pl0;
      pl0 = pl1;
      pl1 = swap;
      fillPlane(pl1, y + 1);
    }
    for (let z = vLo[2]; z <= vHi[2]; z++) {
      for (let x = vLo[0]; x <= vHi[0]; x++) {
        const ci = (z - vLo[2]) * cw + (x - vLo[0]);
        if (y < colLo[ci] || y > colHi[ci]) continue;
        const p00 = (z - vLo[2]) * pw + (x - vLo[0]);
        const mask =
          pl0[p00] |
          (pl0[p00 + 1] << 1) |
          (pl1[p00] << 2) |
          (pl1[p00 + 1] << 3) |
          (pl0[p00 + pw] << 4) |
          (pl0[p00 + pw + 1] << 5) |
          (pl1[p00 + pw] << 6) |
          (pl1[p00 + pw + 1] << 7);
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
        let vx = originM[0] + (x + pos0 + sx / crossings) * cellM;
        let vy = originM[1] + (y + pos0 + sy / crossings) * cellHM;
        let vz = originM[2] + (z + pos0 + sz / crossings) * cellM;

        const depth = surfaceYAt ? Math.max(0, surfaceYAt(vx, vz) - vy) : 0;

        /* Rim damage. Depth-gated so the untouched top never moves, ramped in
         * over a cell so no seam line appears where the jitter starts.
         *
         * The jittered vertex is CLAMPED inside its own lattice cell. Surface
         * nets guarantees quad sanity by construction — one vertex per cell,
         * cells in order — and an unclamped jitter could push two neighbors
         * past each other, folding their shared quad into the thin dark
         * sliver triangles the round-two critique saw floating at 1 m. Inside
         * the cell, order is preserved and no quad can fold. */
        /* DEPTH is a vertical quantity, so its ramp is measured in VERTICAL
         * cells; the amplitude on each axis is that axis's own cell, so the
         * clamp still keeps the vertex inside its own (now possibly flat)
         * lattice box. Identical arithmetic when cellHM === cellM. */
        if (surfaceYAt && depth > cellHM * 0.4) {
          const ramp = Math.min(1, depth / cellHM - 0.4);
          vx += (hash3(x, y, z, 1) - 0.5) * 2 * JITTER_XZ * ramp * cellM;
          vy += (hash3(x, y, z, 2) - 0.5) * 2 * JITTER_Y * ramp * cellHM;
          vz += (hash3(x, y, z, 3) - 0.5) * 2 * JITTER_XZ * ramp * cellM;
          const clampIn = (v: number, lo: number, size: number) =>
            Math.min(lo + 0.96 * size, Math.max(lo + 0.04 * size, v));
          vx = clampIn(vx, originM[0] + (x + pos0) * cellM, cellM);
          vy = clampIn(vy, originM[1] + (y + pos0) * cellHM, cellHM);
          vz = clampIn(vz, originM[2] + (z + pos0) * cellM, cellM);
        }

        vertexAt[cellIndex(x, y, z)] = pos.length / 3;
        pos.push(vx, vy, vz);
        if (
          x >= eLo[0] && x <= eHi[0] &&
          y >= eLo[1] && y <= eHi[1] &&
          z >= eLo[2] && z <= eHi[2]
        ) {
          const dc = (z - dualRect.z0) * dualRect.w + (x - dualRect.x0);
          if (vy > dualTopY[dc]) dualTopY[dc] = vy;
        }

        dep.push(depth);
        const c = colorAtDepth(depth);
        col.push(c[0], c[1], c[2]);
      }
    }
  }

  /* Pass two: one quad per crossed edge, joining the four cells around it.
   *
   * Only the three edges leaving a cell in +x, +y and +z are walked. Every
   * edge in the grid is the +axis edge of exactly one cell, so this visits each
   * once — walking all twelve would emit every quad four times.
   *
   * Quads in the one-cell apron go into `idxN`: they are never drawn (the
   * neighbor chunk owns them) but their faces feed the normals of the border
   * vertices, which is what makes the seam shade continuously. */
  const emitQuad = (
    a: number, b: number, c: number, d: number, flip: boolean, owned: boolean,
  ) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const out = owned ? idx : idxN;
    if (flip) out.push(a, c, b, b, c, d);
    else out.push(a, b, c, b, d, c);
  };

  for (let z = qLo[2]; z <= qHi[2]; z++) {
    for (let x = qLo[0]; x <= qHi[0]; x++) {
      const [yBandLo, yBandHi] = yRange(x, z);
      const yLo = Math.max(yBandLo, qLo[1]);
      const yHi = Math.min(yBandHi, qHi[1]);
      for (let y = yLo; y <= yHi; y++) {
        const here = solid(x, y, z);
        const owned =
          x >= eLo[0] && x <= eHi[0] &&
          y >= eLo[1] && y <= eHi[1] &&
          z >= eLo[2] && z <= eHi[2];

        if (x > vLo[0] && y > vLo[1] && solid(x, y, z + 1) !== here) {
          emitQuad(
            vertexAt[cellIndex(x, y, z)],
            vertexAt[cellIndex(x - 1, y, z)],
            vertexAt[cellIndex(x, y - 1, z)],
            vertexAt[cellIndex(x - 1, y - 1, z)],
            here === 1,
            owned,
          );
        }
        if (x > vLo[0] && z > vLo[2] && solid(x, y + 1, z) !== here) {
          emitQuad(
            vertexAt[cellIndex(x, y, z)],
            vertexAt[cellIndex(x, y, z - 1)],
            vertexAt[cellIndex(x - 1, y, z)],
            vertexAt[cellIndex(x - 1, y, z - 1)],
            here === 1,
            owned,
          );
        }
        if (y > vLo[1] && z > vLo[2] && solid(x + 1, y, z) !== here) {
          emitQuad(
            vertexAt[cellIndex(x, y, z)],
            vertexAt[cellIndex(x, y - 1, z)],
            vertexAt[cellIndex(x, y, z - 1)],
            vertexAt[cellIndex(x, y - 1, z - 1)],
            here === 1,
            owned,
          );
        }
      }
    }
  }

  // Normals from the faces — emitted AND apron, so a border vertex sees every
  // face that touches it and both copies of a seam vertex agree exactly.
  const positions = new Float32Array(pos);
  const normals = new Float32Array(pos.length);
  const accumulate = (list: number[]) => {
    for (let t = 0; t < list.length; t += 3) {
      const [i0, i1, i2] = [list[t], list[t + 1], list[t + 2]];
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
  };
  accumulate(idx);
  accumulate(idxN);
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l;
    normals[i + 1] /= l;
    normals[i + 2] /= l;
  }

  /* Baked AO from voxel occupancy — the cheap kind, and enough.
   *
   * On open ground every probe is air and the vertex reads 1. On a pit floor
   * the wall side reads solid and the corner darkens. Down a bore hole most of
   * the fan is rock and the shaft darkens by degrees — graded contact shadow,
   * not a two-voxel drop to black. */
  const vcount = positions.length / 3;
  const ao = new Float32Array(vcount);
  const invCell = 1 / cellM;
  const invCellH = 1 / cellHM;
  /* The fan reaches a fixed distance in WORLD METERS (AO_DIST counted in
   * horizontal cells, which is the length it always was), then converts to
   * cell steps per axis. Stepping in raw cell indices instead would shrink the
   * fan's vertical reach exactly in proportion to a finer vertical cell - the
   * occlusion of a pit would quietly weaken every time the lattice got better,
   * which is the wrong way round. Identical when cellHM === cellM. */
  const yScale = cellM * invCellH;
  const solidAt = (x: number, y: number, z: number): number =>
    vol.get(Math.floor(x), Math.floor(y), Math.floor(z)) !== Material.Air ? 1 : 0;
  for (let i = 0; i < vcount; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const px = (positions[i * 3] - originM[0]) * invCell;
    const py = (positions[i * 3 + 1] - originM[1]) * invCellH;
    const pz = (positions[i * 3 + 2] - originM[2]) * invCell;
    // A tangent frame around the normal, so the fan tilts the same way
    // everywhere: cross with up, or with x when the normal IS up.
    let tx: number;
    let ty: number;
    let tz: number;
    if (Math.abs(ny) < 0.9) {
      tx = -nz; ty = 0; tz = nx;
    } else {
      tx = 0; ty = nz; tz = -ny;
    }
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty;
    const by = nz * tx - nx * tz;
    const bz = nx * ty - ny * tx;
    let occ = 0;
    for (let d = 0; d < 5; d++) {
      // Direction d: the normal itself, then n ± 0.8t and n ± 0.8b.
      let dx = nx;
      let dy = ny;
      let dz = nz;
      if (d === 1) { dx += 0.8 * tx; dy += 0.8 * ty; dz += 0.8 * tz; }
      else if (d === 2) { dx -= 0.8 * tx; dy -= 0.8 * ty; dz -= 0.8 * tz; }
      else if (d === 3) { dx += 0.8 * bx; dy += 0.8 * by; dz += 0.8 * bz; }
      else if (d === 4) { dx -= 0.8 * bx; dy -= 0.8 * by; dz -= 0.8 * bz; }
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl; dy /= dl; dz /= dl;
      for (let k = 0; k < AO_DIST.length; k++) {
        occ += AO_W[k] * solidAt(
          px + dx * AO_DIST[k],
          py + dy * AO_DIST[k] * yScale,
          pz + dz * AO_DIST[k],
        );
      }
    }
    ao[i] = 1 - occ / AO_W_TOTAL;
  }

  return {
    positions,
    normals,
    colors: new Float32Array(col),
    indices: new Uint32Array(idx),
    triangles: idx.length / 3,
    cutDepth: new Float32Array(dep),
    ao,
    dualTopY,
    dualRect,
  };
}

/**
 * Build a surface from the WHOLE volume — the range mesher over the full
 * lattice, plus the per-voxel-column drawn-height fold the water bed needs.
 */
export function voxelsToSurface(
  vol: VoxelVolume,
  cellM: number,
  originM: readonly [number, number, number],
  colorAtDepth: (depthM: number) => readonly [number, number, number],
  surfaceYAt?: (xM: number, zM: number) => number,
  cellHM: number = cellM,
): SurfaceMeshData {
  const n = vol.cells;
  const cn = n + 1;
  const pos0 = -1;
  const chunk = meshCellRange(vol, cellM, originM, colorAtDepth, surfaceYAt, undefined, cellHM);

  /* Fold the dual columns down to one height per voxel column.
   *
   * A voxel column is touched by the four dual columns around it, and the
   * drawn surface over that voxel is the mesh interpolated between their
   * vertices. The MEAN of the four is that interpolation at the column center;
   * the max would put the water back on the staircase this mesher exists to
   * remove. Dual columns that never produced a vertex are skipped rather than
   * counted as zero. */
  const columnTopY = foldColumnTopY(chunk.dualTopY, cn, n, pos0);

  return {
    positions: chunk.positions,
    normals: chunk.normals,
    colors: chunk.colors,
    indices: chunk.indices,
    triangles: chunk.triangles,
    columnTopY,
    cutDepth: chunk.cutDepth,
    ao: chunk.ao,
  };
}

/**
 * Fold a full-grid dual-column height field (cn × cn, laid out z * cn + x)
 * into per-voxel-column drawn heights (n × n). Exposed so a chunked caller can
 * run the identical fold over its stitched global dual field.
 */
export function foldColumnTopY(
  dualTopY: Float32Array,
  cn: number,
  n: number,
  pos0 = -1,
): Float32Array {
  const columnTopY = new Float32Array(n * n).fill(-Infinity);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      let sum = 0;
      let hits = 0;
      for (let dz = 0; dz <= 1; dz++) {
        for (let dx = 0; dx <= 1; dx++) {
          // Voxel (x,z) is spanned by dual cells x - pos0 and x - pos0 + 1.
          const lx = x - pos0 + dx;
          const lz = z - pos0 + dz;
          if (lx < 0 || lz < 0 || lx >= cn || lz >= cn) continue;
          const v = dualTopY[lz * cn + lx];
          if (v === -Infinity) continue;
          sum += v;
          hits++;
        }
      }
      if (hits > 0) columnTopY[z * n + x] = sum / hits;
    }
  }
  return columnTopY;
}
