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

/**
 * What one voxel is made of.
 *
 * These are SUBSTANCES, not color bands. Every member has an entry in
 * `materials.ts` carrying its density, hardness, permeability and angle of
 * repose, because the questions the world asks of the ground are not only "what
 * color is this cut face". They are also "how long does this take to dig",
 * "does water sink through it" and "does this wall stand or slump".
 *
 * Cells are stored in a Uint8Array, so the ceiling is 256 and nowhere near.
 * A test in `materials.test.ts` asserts this list and the registry agree, which
 * is the guard against the two drifting apart.
 */
export const enum Material {
  Air = 0,
  // Organic covers.
  Litter = 1,
  Turf = 2,
  Peat = 3,
  // Soils.
  Topsoil = 4,
  Subsoil = 5,
  Clay = 6,
  Silt = 7,
  // Loose mineral.
  Sand = 8,
  Gravel = 9,
  // Cemented and frozen.
  Hardpan = 10,
  Permafrost = 11,
  // Rock.
  Limestone = 12,
  Sandstone = 13,
  Granite = 14,
  // Frozen water and free water.
  Ice = 15,
  Snow = 16,
  Water = 17,
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

/**
 * The `brickUniform` byte that means "this brick's cells follow in
 * `brickCells`". Outside the `Material` range on purpose.
 */
export const BRICK_ALLOCATED = 255;

/** A volume flattened into transferable buffers. See `VoxelVolume.snapshot`. */
export interface VolumeSnapshot {
  cellsPerEdge: number;
  /**
   * Cells on Y. Absent in a snapshot written before the volume grew an
   * independent vertical resolution, and read back as `cellsPerEdge` — a cubic
   * volume, which is what those snapshots were.
   */
  cellsY?: number;
  /** One byte per brick: a `Material`, or `BRICK_ALLOCATED`. */
  brickUniform: Uint8Array;
  /** Cells of every allocated brick, concatenated in ascending brick index. */
  brickCells: Uint8Array;
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
  /** Cells on X and Z. The horizontal resolution. */
  readonly cells: number;
  /**
   * Cells on Y. Defaults to `cells`, which is what every caller had before this
   * existed, so a cubic volume behaves exactly as it always did.
   *
   * WHY THE AXES CAME APART. A combat arena is 120 units wide and about 14
   * tall. One `cellsPerEdge` sized all three, so buying a fine horizontal cell
   * meant buying 120 units of vertical lattice that is nine tenths open sky —
   * 32,768 brick headers for a board that needs a twelfth of them. Worse, the
   * cell the budget could afford (0.47 m) was COARSER THAN THE FEATURES: the
   * heightfield's stream basin is 0.42 m deep, less than one voxel, so the
   * arena's streams had no bed and 89% of their water ran off the boundary
   * inside the settle. Y is where the detail is, and Y is the cheap axis to
   * refine, because refining it costs a factor and refining X and Z costs that
   * factor squared.
   */
  readonly cellsY: number;
  /** Bricks on X and Z. */
  readonly bricks: number;
  /** Bricks on Y. */
  readonly bricksY: number;
  private readonly grid: Brick[];

  constructor(cellsPerEdge: number, cellsY: number = cellsPerEdge) {
    if (cellsPerEdge % BRICK !== 0) {
      throw new Error(`cellsPerEdge must be a multiple of ${BRICK}`);
    }
    if (cellsY % BRICK !== 0) {
      throw new Error(`cellsY must be a multiple of ${BRICK}`);
    }
    this.cells = cellsPerEdge;
    this.cellsY = cellsY;
    this.bricks = cellsPerEdge / BRICK;
    this.bricksY = cellsY / BRICK;
    const total = this.bricks * this.bricks * this.bricksY;
    this.grid = new Array(total);
    for (let i = 0; i < total; i++) this.grid[i] = { uniform: Material.Air, cells: null };
  }

  /* Y is the OUTER term, so the row count can change without disturbing the
   * XZ layout: a brick's index inside its own Y row is `bz * bricks + bx`
   * either way. That is why the split cost no reshuffling of the grid. */
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
    if (x >= this.cells || y >= this.cellsY || z >= this.cells) return Material.Air;
    const b = this.grid[this.brickIndex(x >> 3, y >> 3, z >> 3)];
    if (!b) return Material.Air;
    if (b.cells === null) return b.uniform;
    return b.cells[((y & 7) * BRICK + (z & 7)) * BRICK + (x & 7)] as Material;
  }

  set(x: number, y: number, z: number, m: Material): void {
    /* Out of range is a NO-OP, and the bound must be explicit here too.
     *
     * `get` was given this guard and `set` was not, which left a silent
     * world-corruption bug: -1 >> 3 is -1, and brickIndex(-1, ...) subtracts one
     * from a valid slot, so an out-of-range write lands inside a REAL brick up
     * to eight cells away. The `if (!b) return` below catches only indices past
     * the end of the array, so the high side was covered by luck and the low
     * side not at all.
     *
     * Every carve loop iterates center plus or minus a radius. A spell cast near
     * the bubble edge therefore wrote rock into, or deleted rock from, a
     * neighboring column — the exact fault the guard on `get` was added to
     * prevent, left half-fixed because only the read path was considered. */
    if (x < 0 || y < 0 || z < 0) return;
    if (x >= this.cells || y >= this.cellsY || z >= this.cells) return;
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
   * The material of a brick that is all one material, or null when it is mixed.
   *
   * This is the sparsity, exposed. A mesher that walks every cell pays for the
   * whole bubble even though the surface is a thin band: at 240 m and 1 m cells
   * that measured 4.3 seconds, against 0.5 MB of actual cell data. Almost every
   * brick is uniform rock or uniform air, and no surface passes through one.
   */
  brickMaterial(bx: number, by: number, bz: number): Material | null {
    if (bx < 0 || by < 0 || bz < 0) return Material.Air; // outside is air
    if (bx >= this.bricks || by >= this.bricksY || bz >= this.bricks) return Material.Air;
    const b = this.grid[this.brickIndex(bx, by, bz)];
    if (!b) return Material.Air;
    return b.cells === null ? b.uniform : null;
  }

  /**
   * Flatten the volume into two plain arrays that a Web Worker can TRANSFER.
   *
   * The storage is an array of small objects, and an array of objects is the
   * one thing `postMessage` cannot hand over cheaply: structured clone walks
   * every brick, allocates a twin, and copies its cells. At 256³ that is
   * 32,768 objects and megabytes of copying on both threads — paid twice, once
   * to serialize and once to rebuild, on top of the fill this whole exercise
   * exists to move off the main thread.
   *
   * Two flat buffers instead:
   *
   * - `brickUniform`, one byte per brick. A material value means the brick is
   *   uniform and costs nothing more. `BRICK_ALLOCATED` (255) means its cells
   *   follow. 255 is safe as a sentinel because `Material` tops out at 17 and
   *   the enum is capped by the Uint8Array it lives in.
   * - `brickCells`, the cells of every allocated brick, concatenated in
   *   ascending brick index. The order is implied, so no index table is sent.
   *
   * Both are `Uint8Array`s, so their buffers go in `postMessage`'s transfer
   * list and change owner without a copy.
   */
  snapshot(): VolumeSnapshot {
    const brickUniform = new Uint8Array(this.grid.length);
    let allocated = 0;
    for (let i = 0; i < this.grid.length; i++) {
      const b = this.grid[i];
      if (b.cells === null) {
        brickUniform[i] = b.uniform;
      } else {
        brickUniform[i] = BRICK_ALLOCATED;
        allocated++;
      }
    }
    const cellsPerBrick = BRICK ** 3;
    const brickCells = new Uint8Array(allocated * cellsPerBrick);
    let at = 0;
    for (const b of this.grid) {
      if (b.cells === null) continue;
      brickCells.set(b.cells, at);
      at += cellsPerBrick;
    }
    return { cellsPerEdge: this.cells, cellsY: this.cellsY, brickUniform, brickCells };
  }

  /**
   * Rebuild a volume from `snapshot`. The inverse, and the receiving half of
   * the worker hand-off: the worker fills, transfers, and is done — after this
   * call the main thread owns the only copy, so an edit cannot desynchronize
   * two versions of the ground because there is only ever one.
   */
  static fromSnapshot(s: VolumeSnapshot): VoxelVolume {
    const vol = new VoxelVolume(s.cellsPerEdge, s.cellsY ?? s.cellsPerEdge);
    const cellsPerBrick = BRICK ** 3;
    let at = 0;
    for (let i = 0; i < vol.grid.length; i++) {
      const u = s.brickUniform[i];
      if (u === BRICK_ALLOCATED) {
        vol.grid[i] = {
          uniform: Material.Air,
          cells: s.brickCells.slice(at, at + cellsPerBrick),
        };
        at += cellsPerBrick;
      } else {
        vol.grid[i] = { uniform: u as Material, cells: null };
      }
    }
    return vol;
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
      denseBytes: this.cells * this.cells * this.cellsY,
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
                : Material.Granite;
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
