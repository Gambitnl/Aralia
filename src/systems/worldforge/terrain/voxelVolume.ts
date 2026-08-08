/**
 * @file voxelVolume.ts — sparse voxel storage for the ground, and the bench
 * that decides how big a bubble of it Aralia can afford.
 *
 * WHY THIS EXISTS
 *
 * Remy chose real fluid simulation (2026-08-05). Fluid needs to ask "is this
 * point solid" thousands of times per step, and a surface mesh cannot answer
 * that — it only knows where its skin is. So the ground under the fluid has to
 * be a volume, and this is that volume.
 *
 * THE CONSTRAINT THAT SHAPES EVERYTHING
 *
 * Aralia streams a continent. Teardown, the reference, is one small level.
 * Voxels over a continent do not fit in memory at any useful resolution, so
 * volume exists in a BUBBLE around the player and the classic heightfield holds
 * everywhere else. Fluid exists exactly where volume exists.
 *
 * WHY SPARSE, FROM THE FIRST LINE
 *
 * A dense 64 m cube at 12 cm is about 150 million cells. At one byte each that
 * is 150 MB for one bubble, and it is nearly all air or nearly all rock. Real
 * ground is overwhelmingly uniform: only the thin band near the surface, and
 * whatever a spell has carved, holds any detail.
 *
 * So the storage is a brick grid. The volume is cut into small cubes, and a
 * brick that is entirely one material stores that material and nothing else.
 * Only a brick with a boundary in it allocates cells. That is the difference
 * between 150 MB and something a browser can hold.
 *
 * NOTHING HERE GUESSES AT THE SIZE. `measureBubble` fills a bubble from real
 * terrain and reports what it actually cost, because Remy asked for the number
 * to come from a measurement rather than from my estimate.
 */

/** What a cell is made of. Kept to a byte; 0 is always air. */
export const enum Material {
  Air = 0,
  Litter = 1,
  Topsoil = 2,
  Subsoil = 3,
  Bedrock = 4,
  Water = 5,
}

/** Cells per brick edge. 8 gives 512 cells, which fits a cache line run. */
export const BRICK = 8;

/**
 * One brick: either uniform, or an array of cells.
 *
 * `cells` is null while the brick is uniform. It allocates the moment the brick
 * stops being one material, and never shrinks back — a brick that has been cut
 * once is likely to be cut again, and the churn costs more than the memory.
 */
interface Brick {
  uniform: Material;
  cells: Uint8Array | null;
}

export interface VolumeStats {
  /** Bricks that hold a boundary and therefore allocate cells. */
  allocatedBricks: number;
  /** Bricks that are one material and cost nothing but a header. */
  uniformBricks: number;
  /** Bytes held by cell arrays. The number that decides feasibility. */
  cellBytes: number;
  /** What a dense volume of the same extent would have cost. */
  denseBytes: number;
}

/**
 * A cube of ground as voxels, stored sparsely.
 *
 * Coordinates are cell indices, not meters. The caller owns the mapping, so
 * this class never needs to know where in the world it sits.
 */
export class VoxelVolume {
  readonly cells: number;
  readonly bricks: number;
  private readonly grid: Brick[];

  constructor(cellsPerEdge: number) {
    if (cellsPerEdge % BRICK !== 0) {
      throw new Error(`cellsPerEdge must be a multiple of ${BRICK}`);
    }
    this.cells = cellsPerEdge;
    this.bricks = cellsPerEdge / BRICK;
    const total = this.bricks ** 3;
    this.grid = new Array(total);
    for (let i = 0; i < total; i++) this.grid[i] = { uniform: Material.Air, cells: null };
  }

  private brickIndex(bx: number, by: number, bz: number): number {
    return (by * this.bricks + bz) * this.bricks + bx;
  }

  get(x: number, y: number, z: number): Material {
    /* Outside the volume is Air, and the bound must be explicit.
     *
     * A negative index used to fall out as Air by luck: -1 >> 3 is -1, and a
     * negative array slot is undefined. The HIGH side had no such luck — x = n
     * indexes a real brick belonging to a different column, so a mesher that
     * samples one step past the edge would read a neighbor's rock and seal the
     * volume against the wrong thing. */
    if (x < 0 || y < 0 || z < 0) return Material.Air;
    if (x >= this.cells || y >= this.cells || z >= this.cells) return Material.Air;
    const b = this.grid[this.brickIndex(x >> 3, y >> 3, z >> 3)];
    if (!b) return Material.Air;
    if (b.cells === null) return b.uniform;
    return b.cells[((y & 7) * BRICK + (z & 7)) * BRICK + (x & 7)] as Material;
  }

  set(x: number, y: number, z: number, m: Material): void {
    const bi = this.brickIndex(x >> 3, y >> 3, z >> 3);
    const b = this.grid[bi];
    if (!b) return;
    if (b.cells === null) {
      // Still uniform. Writing the same material changes nothing, and that is
      // the common case while a bubble fills with solid rock or open air.
      if (b.uniform === m) return;
      b.cells = new Uint8Array(BRICK ** 3).fill(b.uniform);
    }
    b.cells[((y & 7) * BRICK + (z & 7)) * BRICK + (x & 7)] = m;
  }

  /**
   * Collapse any brick whose cells all agree back to uniform.
   *
   * Worth running after a bulk fill, because a bubble filled from terrain
   * allocates every brick it touches even where the result is one material.
   * Not worth running per edit — see the note on `cells` above.
   */
  compact(): void {
    for (const b of this.grid) {
      if (b.cells === null) continue;
      const first = b.cells[0];
      let same = true;
      for (let i = 1; i < b.cells.length; i++) {
        if (b.cells[i] !== first) {
          same = false;
          break;
        }
      }
      if (same) {
        b.uniform = first as Material;
        b.cells = null;
      }
    }
  }

  stats(): VolumeStats {
    let allocated = 0;
    for (const b of this.grid) if (b.cells !== null) allocated++;
    return {
      allocatedBricks: allocated,
      uniformBricks: this.grid.length - allocated,
      cellBytes: allocated * BRICK ** 3,
      denseBytes: this.cells ** 3,
    };
  }
}

/** Deterministic value noise, shared with the surface builder's character. */
function hash2(i: number, j: number): number {
  let h = Math.imul(i + 374761393, 668265263) ^ Math.imul(j + 1442695041, 1597334677);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

function valueNoise(x: number, z: number, freq: number): number {
  const u = x * freq;
  const v = z * freq;
  const i = Math.floor(u);
  const j = Math.floor(v);
  let fu = u - i;
  let fv = v - j;
  fu = fu * fu * (3 - 2 * fu);
  fv = fv * fv * (3 - 2 * fv);
  const a = hash2(i, j);
  const b = hash2(i + 1, j);
  const c = hash2(i, j + 1);
  const d = hash2(i + 1, j + 1);
  return a + (b - a) * fu + ((c + (d - c) * fu) - (a + (b - a) * fu)) * fv;
}

/** Terrain height in meters at a world point. Same character as the patch. */
export function benchHeightM(x: number, z: number): number {
  return (
    (valueNoise(x, z, 0.035) - 0.5) * 9 +
    (valueNoise(x, z, 0.12) - 0.5) * 2.2 +
    (valueNoise(x, z, 0.6) - 0.5) * 0.4
  );
}

export interface BubbleMeasurement {
  extentM: number;
  cellM: number;
  cellsPerEdge: number;
  fillMs: number;
  stats: VolumeStats;
  /** Cell memory in MB — the number that decides whether this size ships. */
  cellMB: number;
  /** What a dense volume would have cost, in MB. */
  denseMB: number;
  /** How much the sparse form saved, as a multiple. */
  savedTimes: number;
}

/**
 * Fill one bubble from real terrain and report what it cost.
 *
 * This is the measurement Remy asked for. It answers three questions that no
 * estimate can: whether the memory fits, how long a bubble takes to fill, and
 * how much the sparse form actually saves on ground of this character.
 *
 * The fill is the honest worst case for storage — a terrain surface crosses
 * every column exactly once, so the boundary band is as large as it can be for
 * a landscape. A cave system would allocate more; open sky or deep rock, less.
 */
export function measureBubble(extentM: number, cellM: number): BubbleMeasurement {
  const cellsPerEdge = Math.round(extentM / cellM / BRICK) * BRICK;
  const t0 = Date.now();
  const vol = new VoxelVolume(cellsPerEdge);

  // Vertical origin so the surface sits near the middle of the bubble, which is
  // where a player standing on the ground actually puts it.
  const baseY = -extentM / 2;
  for (let z = 0; z < cellsPerEdge; z++) {
    const wz = z * cellM;
    for (let x = 0; x < cellsPerEdge; x++) {
      const wx = x * cellM;
      const h = benchHeightM(wx, wz);
      // Only the column below the surface holds matter; above it is air, and
      // air is the uniform the bricks started in, so it costs nothing to skip.
      const topCell = Math.min(cellsPerEdge - 1, Math.floor((h - baseY) / cellM));
      for (let y = 0; y <= topCell; y++) {
        const depth = h - (baseY + y * cellM);
        const m =
          depth < 0.12
            ? Material.Litter
            : depth < 0.55
              ? Material.Topsoil
              : depth < 2
                ? Material.Subsoil
                : Material.Bedrock;
        vol.set(x, y, z, m);
      }
    }
  }
  vol.compact();
  const fillMs = Date.now() - t0;
  const stats = vol.stats();
  return {
    extentM,
    cellM,
    cellsPerEdge,
    fillMs,
    stats,
    cellMB: stats.cellBytes / (1024 * 1024),
    denseMB: stats.denseBytes / (1024 * 1024),
    savedTimes: stats.denseBytes / Math.max(1, stats.cellBytes),
  };
}
