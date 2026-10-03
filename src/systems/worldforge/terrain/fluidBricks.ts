/**
 * @file fluidBricks.ts — the grid fluid on SPARSE BRICKS, as plain TypeScript.
 *
 * WHY THIS REPLACES THE DENSE FIELD
 *
 * ADR 0002 shipped the fluid as five dense buffers over 256 cubed cells: 320 MB
 * to cover 64 m at 25 cm, and 2.6 GB if the same 64 m is asked for at 12 cm. A
 * compute pass indexes by position, so a dense buffer has to exist everywhere,
 * including the part of the domain that is solid rock or open sky.
 *
 * A census of the shipped proof, read off the live GPU on 2026-08-10, says how
 * much of that is waste. Measured at the fullest moment of the pour-runnel-pool
 * scene, 64 m at 25 cm:
 *
 *     wet cells                       38,509 of 16,777,216   = 0.23%
 *     2 m cubes touched (8^3 @ 25 cm)    711 of      32,768  = 2.2%
 *     1 m cubes touched (8^3 @ 12.5 cm) 2,752 of     262,144 = 1.05%
 *
 * With one round of face dilation the 1 m figure becomes 7,184 bricks. So a
 * pool of ten to twelve thousand bricks holds everything the proof ever wets at
 * 12.5 cm, and 99% of the domain never needs a cell at all.
 *
 * THE STRUCTURE
 *
 * The domain is cut into 8-cubed bricks — 512 cells, the same brick size
 * voxelVolume.ts already uses for the ground. A brick that can hold water gets
 * a SLOT out of a fixed pool; every other brick has no storage whatsoever.
 * `brickSlot` maps brick to slot and holds -1 where there is none.
 *
 * THE ONE INVARIANT THAT MAKES CONSERVATION EXACT
 *
 * AN UNALLOCATED BRICK IS A SOLID WALL. `isOpen` returns false for any cell
 * whose brick has no slot, exactly as it already does for a cell outside the
 * domain. Without that rule the frontier cell computes an outflow into a brick
 * whose invocation never runs, the mass leaves and never arrives, and the field
 * bleeds water at every brick face — the same silent loss the scatter kernel
 * had, reintroduced by the sparsity. With it, mass is conserved to the bit
 * regardless of which bricks happen to be allocated, and the allocator's only
 * job is to keep that wall far enough from the water to be invisible.
 *
 * The allocator therefore dilates: every brick holding water, its six face
 * neighbours, and a few bricks straight down (gravity is the only direction the
 * water front moves fast) are kept allocated. A brick is FREED only when it
 * holds exactly zero mass, so freeing can never discard water.
 *
 * SOLID STAYS DENSE, AS A BITFIELD
 *
 * The solid field is static for the life of a bubble and is needed for bricks
 * the water has not reached yet, so making it sparse would mean filling slots
 * on allocation — a per-frame upload of megabytes. One bit per cell is 16.8 MB
 * at 512 cubed and 2.1 MB at 256 cubed, uploaded once. That is cheaper than the
 * machinery it replaces.
 *
 * WHY THIS FILE HAS NO THREE.JS IN IT
 *
 * It is the reference the GPU kernel must match and the tests can run without a
 * GPU. `fluidBrickCompute.ts` mirrors the arithmetic node for node, and
 * `fluidBricks.test.ts` proves conservation across brick boundaries — the case
 * the dense twin could not have, because it had no boundaries.
 */
import { DRY, RELAX, GRAVITY, MAX_MASS, DAMPING, type CellFlows } from './fluidGather';

export { DRY, RELAX, GRAVITY, MAX_MASS, DAMPING };
export type { CellFlows };

/** Cells per brick edge. 512 cells per brick, matching voxelVolume.ts. */
export const BRICK = 8;
/** log2(BRICK) — the shift that turns a cell coordinate into a brick coordinate. */
export const BRICK_SHIFT = 3;
/** BRICK - 1 — the mask that turns a cell coordinate into a local coordinate. */
export const BRICK_MASK = 7;
/** Cells in one brick. */
export const BRICK_CELLS = BRICK * BRICK * BRICK;

/** A brick with no slot. */
export const NO_SLOT = -1;

export interface SparseFluid {
  /** Cells per edge. Must be a multiple of BRICK. */
  n: number;
  /** Bricks per edge, n / BRICK. */
  b: number;
  /** Slots in the pool. This number IS the memory budget. */
  slots: number;
  /** Slot per brick, NO_SLOT where unallocated. Layout (by * b + bz) * b + bx. */
  brickSlot: Int32Array;
  /** Brick per slot, -1 where free. */
  slotBrick: Int32Array;
  /** One past the highest slot ever used. The dispatch covers [0, slotHigh). */
  slotHigh: number;
  /** Free slots below slotHigh, most recently freed last. */
  freeSlots: Int32Array;
  freeCount: number;
  /** Water mass, slot-major: slot * BRICK_CELLS + local. */
  mass: Float32Array;
  /** Vertical velocity, same layout. */
  vel: Float32Array;
  /** Solid, dense, one bit per cell: bit (i & 31) of solidBits[i >> 5]. */
  solidBits: Int32Array;
  /** 1 where a brick holds at least one non-solid cell. Solid-through bricks never allocate. */
  brickOpen: Uint8Array;
}

/**
 * Allocate a sparse field. Nothing is allocated to a brick until the water asks.
 *
 * `withCells` is false for the GPU driver, which keeps the same index and the
 * same allocator but holds its cells on the card. One allocator, two consumers:
 * the plain-TypeScript solver here and the compute pass in
 * fluidBrickCompute.ts, which is why the allocation policy cannot drift between
 * what the tests prove and what the GPU runs.
 */
export function createSparseFluid(n: number, slots: number, withCells = true): SparseFluid {
  if (n % BRICK !== 0) throw new Error(`sparse fluid needs n divisible by ${BRICK}, got ${n}`);
  const b = n / BRICK;
  const bricks = b * b * b;
  const cells = withCells ? slots * BRICK_CELLS : 0;
  return {
    n,
    b,
    slots,
    brickSlot: new Int32Array(bricks).fill(NO_SLOT),
    slotBrick: new Int32Array(slots).fill(-1),
    slotHigh: 0,
    freeSlots: new Int32Array(slots),
    freeCount: 0,
    mass: new Float32Array(cells),
    vel: new Float32Array(cells),
    solidBits: new Int32Array(withCells ? Math.ceil(n * n * n / 32) : 0),
    brickOpen: new Uint8Array(bricks),
  };
}

/** Byte cost of every buffer the sparse field needs, GPU side included. */
export function sparseBytes(n: number, slots: number): {
  mass: number; vel: number; solid: number; index: number; totals: number; total: number;
} {
  const cells = slots * BRICK_CELLS;
  const bricks = (n / BRICK) ** 3;
  // Two mass buffers and two velocity buffers: the gather form reads a
  // neighbour's value while writing its own, so both fields are double-buffered.
  const mass = cells * 4 * 2;
  const vel = cells * 4 * 2;
  const solid = Math.ceil(n ** 3 / 32) * 4;
  const index = bricks * 4 + slots * 4;
  const totals = bricks * 4;
  return { mass, vel, solid, index, totals, total: mass + vel + solid + index + totals };
}

/** Byte cost of the dense field this replaces: five buffers over every cell. */
export function denseBytes(n: number): number {
  return n ** 3 * 4 * 5;
}

/* ---------------------------------------------------------------------- *
 * Addressing. Every read goes through these, and they are the whole reason
 * an unallocated brick behaves as a wall.
 * ---------------------------------------------------------------------- */

/** Brick id containing a cell. No bounds check — callers check first. */
export function brickOf(f: SparseFluid, x: number, y: number, z: number): number {
  return (((y >> BRICK_SHIFT) * f.b + (z >> BRICK_SHIFT)) * f.b) + (x >> BRICK_SHIFT);
}

/** Index of a cell inside its brick. */
export function localOf(x: number, y: number, z: number): number {
  return (((y & BRICK_MASK) * BRICK + (z & BRICK_MASK)) * BRICK) + (x & BRICK_MASK);
}

/**
 * Pool address of a cell, or -1 when the cell is outside the domain OR its
 * brick has no slot. A -1 here is what makes an unallocated brick a wall.
 */
export function cellAddr(f: SparseFluid, x: number, y: number, z: number): number {
  const n = f.n;
  if (x < 0 || y < 0 || z < 0 || x >= n || y >= n || z >= n) return -1;
  const slot = f.brickSlot[brickOf(f, x, y, z)];
  if (slot === NO_SLOT) return -1;
  return slot * BRICK_CELLS + localOf(x, y, z);
}

/** Dense cell index, used only by the solid bitfield. */
export function denseIndex(n: number, x: number, y: number, z: number): number {
  return (y * n + z) * n + x;
}

export function isSolid(f: SparseFluid, x: number, y: number, z: number): boolean {
  const i = denseIndex(f.n, x, y, z);
  return (f.solidBits[i >> 5] & (1 << (i & 31))) !== 0;
}

export function setSolid(f: SparseFluid, x: number, y: number, z: number, solid: boolean): void {
  const i = denseIndex(f.n, x, y, z);
  const w = i >> 5;
  const bit = 1 << (i & 31);
  if (solid) f.solidBits[w] |= bit;
  else f.solidBits[w] &= ~bit;
}

/**
 * Recompute which bricks contain any open cell. Run once, after the solid field
 * is filled: a brick that is solid all the way through can never hold water and
 * is kept out of the pool, which is what stops the halo below a pool floor from
 * eating slots.
 */
export function computeBrickOpen(f: SparseFluid): void {
  const { b, n } = f;
  f.brickOpen.fill(0);
  for (let by = 0; by < b; by++) {
    for (let bz = 0; bz < b; bz++) {
      for (let bx = 0; bx < b; bx++) {
        let open = 0;
        outer: for (let ly = 0; ly < BRICK; ly++) {
          const y = by * BRICK + ly;
          for (let lz = 0; lz < BRICK; lz++) {
            const z = bz * BRICK + lz;
            for (let lx = 0; lx < BRICK; lx++) {
              const i = denseIndex(n, bx * BRICK + lx, y, z);
              if ((f.solidBits[i >> 5] & (1 << (i & 31))) === 0) {
                open = 1;
                break outer;
              }
            }
          }
        }
        f.brickOpen[(by * b + bz) * b + bx] = open;
      }
    }
  }
}

/* ---------------------------------------------------------------------- *
 * The flow function. Line for line the same arithmetic as cellFlows in
 * fluidGather.ts; the only change is that every lookup goes through the
 * brick index and an unallocated brick reads as closed.
 * ---------------------------------------------------------------------- */

export function cellFlowsSparse(
  f: SparseFluid,
  x: number,
  y: number,
  z: number,
  out: CellFlows,
): void {
  out.down = out.xm = out.xp = out.zm = out.zp = out.up = 0;
  const a = cellAddr(f, x, y, z);
  if (a < 0) return;
  if (isSolid(f, x, y, z)) return;
  const m = f.mass[a];
  if (m <= DRY) return;

  /** Pool address of an open neighbour, or -1. Outside, unallocated and solid all read the same. */
  const open = (ox: number, oy: number, oz: number): number => {
    const j = cellAddr(f, ox, oy, oz);
    if (j < 0) return -1;
    return isSolid(f, ox, oy, oz) ? -1 : j;
  };

  // 1. DOWN. Gravity plus retained downward momentum.
  let down = 0;
  const below = open(x, y - 1, z);
  if (below >= 0) {
    const room = Math.max(0, MAX_MASS - f.mass[below]);
    const pull = GRAVITY + Math.max(0, -f.vel[a]) * 0.3;
    down = Math.min(m, room * pull);
  }
  const rem = m - down;

  // 2. SIDEWAYS. All four flows from the same remaining mass, then one shared
  // scale if they oversubscribe it. Order-free by construction.
  const side = (j: number): number => (j >= 0 ? Math.max(0, (rem - f.mass[j]) * RELAX * 0.25) : 0);
  let xm = side(open(x - 1, y, z));
  let xp = side(open(x + 1, y, z));
  let zm = side(open(x, y, z - 1));
  let zp = side(open(x, y, z + 1));
  const sum = xm + xp + zm + zp;
  const scale = rem / Math.max(sum, Math.max(rem, 1e-6));
  xm *= scale;
  xp *= scale;
  zm *= scale;
  zp *= scale;

  // 3. UP, only when over-full. That excess is pressure.
  let up = 0;
  const rem2 = rem - sum * scale;
  const above = open(x, y + 1, z);
  if (above >= 0) {
    up = Math.min(Math.max(0, rem2 - 1), Math.max(0, MAX_MASS - f.mass[above]));
  }

  out.down = down;
  out.xm = xm;
  out.xp = xp;
  out.zm = zm;
  out.zp = zp;
  out.up = up;
}

/**
 * Advance the field one step over the ALLOCATED bricks only.
 *
 * Writes into `massOut`/`velOut`, which are pool-shaped and never the read
 * arrays. Cost is O(allocated bricks), not O(domain) — that is the whole point,
 * and it is the same saving the CPU solver's active set used to give before the
 * dense GPU pass threw it away.
 */
export function stepSparse(f: SparseFluid, massOut: Float32Array, velOut: Float32Array): void {
  const self: CellFlows = { down: 0, xm: 0, xp: 0, zm: 0, zp: 0, up: 0 };
  const nb: CellFlows = { down: 0, xm: 0, xp: 0, zm: 0, zp: 0, up: 0 };
  const b = f.b;
  for (let slot = 0; slot < f.slotHigh; slot++) {
    const bid = f.slotBrick[slot];
    if (bid < 0) continue;
    const bx = (bid % b) * BRICK;
    const bz = (((bid / b) | 0) % b) * BRICK;
    const by = ((bid / (b * b)) | 0) * BRICK;
    for (let ly = 0; ly < BRICK; ly++) {
      const y = by + ly;
      for (let lz = 0; lz < BRICK; lz++) {
        const z = bz + lz;
        for (let lx = 0; lx < BRICK; lx++) {
          const x = bx + lx;
          const a = slot * BRICK_CELLS + ((ly * BRICK + lz) * BRICK + lx);

          cellFlowsSparse(f, x, y, z, self);
          const totalOut = self.down + self.xm + self.xp + self.zm + self.zp + self.up;

          cellFlowsSparse(f, x, y + 1, z, nb);
          const downIn = nb.down;
          cellFlowsSparse(f, x, y - 1, z, nb);
          const upIn = nb.up;
          cellFlowsSparse(f, x - 1, y, z, nb);
          const fromXm = nb.xp;
          cellFlowsSparse(f, x + 1, y, z, nb);
          const fromXp = nb.xm;
          cellFlowsSparse(f, x, y, z - 1, nb);
          const fromZm = nb.zp;
          cellFlowsSparse(f, x, y, z + 1, nb);
          const fromZp = nb.zm;

          const inflow = downIn + upIn + fromXm + fromXp + fromZm + fromZp;
          massOut[a] = f.mass[a] - totalOut + inflow;

          const hasDownIn = downIn > 0 ? 1 : 0;
          velOut[a] = f.vel[a] * (1 - (1 - DAMPING) * hasDownIn) - downIn + upIn;
        }
      }
    }
  }
}

/** Total water in the field. Only allocated slots can hold any. */
export function totalMass(f: SparseFluid): number {
  let sum = 0;
  let c = 0;
  for (let slot = 0; slot < f.slotHigh; slot++) {
    if (f.slotBrick[slot] < 0) continue;
    const base = slot * BRICK_CELLS;
    for (let i = 0; i < BRICK_CELLS; i++) {
      const v = f.mass[base + i];
      const t = sum + v;
      c += Math.abs(sum) >= Math.abs(v) ? sum - t + v : v - t + sum;
      sum = t;
    }
  }
  return sum + c;
}

/**
 * Mass per brick, into a b^3 array. This is the reduce the GPU runs and reads
 * back: it is the only field the allocator needs, and at 64 bricks per edge it
 * is one megabyte rather than the hundred the cells would cost.
 */
export function brickTotals(f: SparseFluid, out: Float32Array): void {
  out.fill(0);
  for (let slot = 0; slot < f.slotHigh; slot++) {
    const bid = f.slotBrick[slot];
    if (bid < 0) continue;
    const base = slot * BRICK_CELLS;
    let sum = 0;
    for (let i = 0; i < BRICK_CELLS; i++) sum += f.mass[base + i];
    out[bid] = sum;
  }
}

/* ---------------------------------------------------------------------- *
 * The allocator.
 * ---------------------------------------------------------------------- */

export interface BrickPolicy {
  /**
   * Rounds of FACE dilation around every wet brick. Water crosses faces only,
   * so a brick reachable in k cell-steps lies inside the L1 ball of k cells and
   * a 26-neighbour box dilation would buy nothing for four times the slots.
   */
  dilate: number;
  /**
   * Extra bricks marked straight down from every wet brick. Falling water is
   * the only front that advances a cell per step for many steps in a row, so
   * the halo is stretched in that one direction instead of everywhere.
   */
  fall: number;
}

export interface RefreshStats {
  /** Bricks the policy wants allocated. */
  wanted: number;
  /** Bricks that held water when the census was taken. */
  wet: number;
  allocated: number;
  freed: number;
  /** Slots in use after the refresh. */
  used: number;
  /** One past the highest slot in use — the dispatch bound. */
  slotHigh: number;
  /** Bricks the policy wanted and the pool could not give. Non-zero means the pool is too small. */
  starved: number;
  /** Slots that were allocated this refresh and must be zeroed before the next step. */
  newSlots: Int32Array;
}

/**
 * Decide which bricks should be allocated, from a per-brick mass census.
 *
 * `pinned` carries bricks that must exist regardless of their current mass —
 * the pour target, which has to have storage before the first drop lands.
 */
export function markWanted(
  f: SparseFluid,
  totals: Float32Array,
  policy: BrickPolicy,
  want: Uint8Array,
  pinned?: ArrayLike<number>,
): number {
  const { b } = f;
  const bricks = b * b * b;
  want.fill(0);

  // Seed: any brick holding water, plus the pinned ones.
  let wet = 0;
  const frontier: number[] = [];
  for (let i = 0; i < bricks; i++) {
    if (totals[i] > 0) {
      want[i] = 1;
      wet++;
      frontier.push(i);
    }
  }
  if (pinned) {
    for (let k = 0; k < pinned.length; k++) {
      const i = pinned[k];
      if (i >= 0 && i < bricks && want[i] === 0) {
        want[i] = 1;
        frontier.push(i);
      }
    }
  }

  // Gravity extension, straight down from the seed. Done before the dilation so
  // the dilation widens the fall corridor too.
  const seedCount = frontier.length;
  for (let k = 0; k < seedCount; k++) {
    const id = frontier[k];
    const bx = id % b;
    const bz = ((id / b) | 0) % b;
    let by = (id / (b * b)) | 0;
    for (let d = 1; d <= policy.fall; d++) {
      by -= 1;
      if (by < 0) break;
      const j = (by * b + bz) * b + bx;
      if (want[j] === 0) {
        want[j] = 1;
        frontier.push(j);
      }
    }
  }

  // Face dilation, breadth-first over the frontier.
  let start = 0;
  let end = frontier.length;
  for (let round = 0; round < policy.dilate; round++) {
    for (let k = start; k < end; k++) {
      const id = frontier[k];
      const bx = id % b;
      const bz = ((id / b) | 0) % b;
      const by = (id / (b * b)) | 0;
      const push = (ax: number, ay: number, az: number) => {
        if (ax < 0 || ay < 0 || az < 0 || ax >= b || ay >= b || az >= b) return;
        const j = (ay * b + az) * b + ax;
        if (want[j] === 0) {
          want[j] = 1;
          frontier.push(j);
        }
      };
      push(bx - 1, by, bz);
      push(bx + 1, by, bz);
      push(bx, by - 1, bz);
      push(bx, by + 1, bz);
      push(bx, by, bz - 1);
      push(bx, by, bz + 1);
    }
    start = end;
    end = frontier.length;
  }

  // A brick that is solid all the way through can never hold water. Dropping
  // those is what keeps the halo under a pool floor from eating the pool.
  for (let i = 0; i < bricks; i++) {
    if (want[i] === 1 && f.brickOpen[i] === 0) want[i] = 0;
  }
  return wet;
}

/**
 * Bring the pool in line with `want`.
 *
 * Slots are STABLE: a brick keeps its slot for as long as it is allocated, so
 * no water is ever copied between slots and the buffers never need a remap
 * pass. A brick is freed only when it holds exactly zero mass — freeing a brick
 * with any mass in it, however small, would discard that mass and break the one
 * property this whole design exists to keep.
 */
export function applyWanted(f: SparseFluid, want: Uint8Array, totals: Float32Array): RefreshStats {
  const bricks = f.b ** 3;
  let freed = 0;
  const newSlots: number[] = [];

  // 1. Free what the policy no longer wants AND which holds nothing.
  for (let slot = 0; slot < f.slotHigh; slot++) {
    const bid = f.slotBrick[slot];
    if (bid < 0) continue;
    if (want[bid] === 1) continue;
    if (totals[bid] !== 0) continue;
    f.slotBrick[slot] = -1;
    f.brickSlot[bid] = NO_SLOT;
    f.freeSlots[f.freeCount++] = slot;
    freed++;
  }

  // 2. Allocate what is wanted and has no slot.
  let allocated = 0;
  let starved = 0;
  let wanted = 0;
  for (let bid = 0; bid < bricks; bid++) {
    if (want[bid] === 0) continue;
    wanted++;
    if (f.brickSlot[bid] !== NO_SLOT) continue;
    let slot: number;
    if (f.freeCount > 0) {
      slot = f.freeSlots[--f.freeCount];
    } else if (f.slotHigh < f.slots) {
      slot = f.slotHigh++;
    } else {
      starved++;
      continue;
    }
    f.slotBrick[slot] = bid;
    f.brickSlot[bid] = slot;
    newSlots.push(slot);
    allocated++;
  }

  // 3. Trim the dispatch bound when the top of the pool went quiet.
  while (f.slotHigh > 0 && f.slotBrick[f.slotHigh - 1] < 0) f.slotHigh--;
  // The free list may now name slots above the bound; drop those.
  let w = 0;
  for (let r = 0; r < f.freeCount; r++) {
    const s = f.freeSlots[r];
    if (s < f.slotHigh) f.freeSlots[w++] = s;
  }
  f.freeCount = w;

  return {
    wanted,
    wet: 0,
    allocated,
    freed,
    used: countUsed(f),
    slotHigh: f.slotHigh,
    starved,
    newSlots: Int32Array.from(newSlots),
  };
}

function countUsed(f: SparseFluid): number {
  let n = 0;
  for (let slot = 0; slot < f.slotHigh; slot++) if (f.slotBrick[slot] >= 0) n++;
  return n;
}

/** Zero a freshly allocated slot. Its previous tenant's residue must not reappear. */
export function zeroSlot(f: SparseFluid, slot: number): void {
  const base = slot * BRICK_CELLS;
  f.mass.fill(0, base, base + BRICK_CELLS);
  f.vel.fill(0, base, base + BRICK_CELLS);
}

/** One full CPU-side refresh: census, policy, allocation, zeroing. */
export function refreshBricks(
  f: SparseFluid,
  scratch: { totals: Float32Array; want: Uint8Array },
  policy: BrickPolicy,
  pinned?: ArrayLike<number>,
): RefreshStats {
  brickTotals(f, scratch.totals);
  const wet = markWanted(f, scratch.totals, policy, scratch.want, pinned);
  const stats = applyWanted(f, scratch.want, scratch.totals);
  for (let i = 0; i < stats.newSlots.length; i++) zeroSlot(f, stats.newSlots[i]);
  stats.wet = wet;
  return stats;
}

/** Scratch buffers the refresh needs, sized to the field. */
export function createRefreshScratch(f: SparseFluid): { totals: Float32Array; want: Uint8Array } {
  const bricks = f.b ** 3;
  return { totals: new Float32Array(bricks), want: new Uint8Array(bricks) };
}

/** Read one cell's mass. 0 where the brick has no slot, which is the truth. */
export function getMass(f: SparseFluid, x: number, y: number, z: number): number {
  const a = cellAddr(f, x, y, z);
  return a < 0 ? 0 : f.mass[a];
}

/**
 * Write one cell's mass. Fails loudly when the brick has no slot: silently
 * dropping water on the floor is exactly the class of bug this file exists to
 * make impossible, so a caller that has not allocated first must hear about it.
 */
export function setMass(f: SparseFluid, x: number, y: number, z: number, m: number): void {
  const a = cellAddr(f, x, y, z);
  if (a < 0) throw new Error(`setMass at (${x},${y},${z}): brick is not allocated`);
  f.mass[a] = m;
}

/** Force a set of bricks to be allocated right now, outside the refresh cadence. */
export function ensureBricks(f: SparseFluid, ids: ArrayLike<number>): Int32Array {
  const made: number[] = [];
  for (let k = 0; k < ids.length; k++) {
    const bid = ids[k];
    if (bid < 0 || bid >= f.b ** 3) continue;
    if (f.brickSlot[bid] !== NO_SLOT) continue;
    let slot: number;
    if (f.freeCount > 0) slot = f.freeSlots[--f.freeCount];
    else if (f.slotHigh < f.slots) slot = f.slotHigh++;
    else continue;
    f.slotBrick[slot] = bid;
    f.brickSlot[bid] = slot;
    zeroSlot(f, slot);
    made.push(slot);
  }
  return Int32Array.from(made);
}

/** Brick ids touched by a sphere of cells, for pinning a pour. */
export function bricksInSphere(f: SparseFluid, cx: number, cy: number, cz: number, r: number): Int32Array {
  const b = f.b;
  const ids = new Set<number>();
  const lo = (v: number) => Math.max(0, Math.floor((v - r) / BRICK));
  const hi = (v: number) => Math.min(b - 1, Math.floor((v + r) / BRICK));
  for (let by = lo(cy); by <= hi(cy); by++) {
    for (let bz = lo(cz); bz <= hi(cz); bz++) {
      for (let bx = lo(cx); bx <= hi(cx); bx++) {
        ids.add((by * b + bz) * b + bx);
      }
    }
  }
  return Int32Array.from(ids);
}
