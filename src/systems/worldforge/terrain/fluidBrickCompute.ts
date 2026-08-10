/**
 * @file fluidBrickCompute.ts — the sparse brick fluid as a GPU compute pass.
 *
 * This is the node-for-node mirror of `fluidBricks.ts`, the way
 * `fluidCompute.ts` mirrors `fluidGather.ts`. The arithmetic is identical; only
 * the addressing changed, and the addressing is the entire point.
 *
 * WHAT THE DENSE PASS SPENT, AND ON WHAT
 *
 * The dense pass indexes by position, so every buffer exists over every cell.
 * A census of the running proof (real GPU, 2026-08-10) found 0.23% of cells wet
 * at the fullest moment. The other 99.77% of 320 MB was rock and sky.
 *
 * WHAT THIS PASS DISPATCHES OVER
 *
 * A pool of 8-cubed brick slots. Only bricks that hold water, or sit next to a
 * brick that does, own a slot. The dispatch is `slotHigh * 512` invocations
 * rather than `n * n * n`, and `slotHigh` tracks the water instead of the
 * domain. At 64 m and 12.5 cm that is roughly 3.6 million invocations against
 * the dense form's 134 million for the same bubble.
 *
 * THE WALL RULE, RESTATED FOR THE KERNEL
 *
 * `tap()` returns open = 0 for any cell whose brick has no slot, exactly as it
 * does for a cell outside the domain or inside rock. Every flow is multiplied
 * by the destination's open mask, so no invocation ever computes an outflow
 * into storage that does not exist. Mass is conserved whatever the allocator
 * does, and the allocator is free to be approximate.
 *
 * WHY THE ALLOCATOR RUNS ON THE CPU
 *
 * Because the dispatch size has to reach the CPU regardless. three r172 exposes
 * indirect DRAW (`drawIndirect`, `drawIndexedIndirect`) and no indirect
 * DISPATCH — `dispatchWorkgroupsIndirect` appears nowhere in WebGPUBackend — so
 * the number of active slots must come back across the bus before the next
 * dispatch can be sized. A GPU prefix-sum compaction would still pay that
 * round trip, and would then add a reduce, a multi-pass scan and a compaction
 * write on top of it. Once the round trip is unavoidable, the cheap part is the
 * scan, and the scan is what the CPU does well.
 *
 * The readback is deliberately SLOT-shaped, not brick-shaped: one float per
 * slot, 48 kB at a 12,288-slot pool, against 1 MB if it were one float per
 * brick. It is also written without a scatter — each invocation sums its own
 * slot and writes its own address — which the brick-shaped form could not
 * claim.
 */
import { Fn, If, Loop, float, instanceIndex, int, modInt, select, storage, uint, uniform } from 'three/tsl';
import { StorageBufferAttribute } from 'three/webgpu';
import {
  BRICK,
  BRICK_CELLS,
  DAMPING,
  DRY,
  GRAVITY,
  MAX_MASS,
  RELAX,
  applyWanted,
  bricksInSphere,
  computeBrickOpen,
  createRefreshScratch,
  createSparseFluid,
  ensureBricks,
  markWanted,
  type BrickPolicy,
  type RefreshStats,
  type SparseFluid,
} from './fluidBricks';

/**
 * The bubble this pass exists to reach: 64 m at 12.5 cm.
 *
 * The dense pass could not have it — five buffers over 512 cubed cells is
 * 2.7 GB, past what any browser will hand out and past the card. The sparse
 * pool holds the same bubble in roughly a hundred megabytes, which is the
 * trade ADR 0002 named as "the route out, when 25 cm proves too coarse".
 */
export const SPARSE_EXTENT_M = 64;
export const SPARSE_CELL_M = 0.125;
export const SPARSE_CELLS_PER_EDGE = 512;

/**
 * Slots in the pool.
 *
 * Sized from the census rather than from a guess. The fullest moment of the
 * pour-runnel-pool proof touched 2,752 one-metre cubes — which is exactly the
 * brick count at this resolution — and one round of face dilation took that to
 * 7,184. Twelve thousand leaves the halo room to breathe and the sim reports
 * its own peak, so the number can be corrected by measurement rather than by
 * argument.
 */
export const SPARSE_POOL_SLOTS = 12288;

export interface BrickFluidBuffers {
  /** Cells per edge. */
  n: number;
  /** Bricks per edge. */
  b: number;
  /** Slots in the pool. */
  slots: number;
  massRead: StorageBufferAttribute;
  massWrite: StorageBufferAttribute;
  velRead: StorageBufferAttribute;
  velWrite: StorageBufferAttribute;
  /** Solid, dense, one bit per cell. Static for the life of the bubble. */
  solidBits: StorageBufferAttribute;
  /** Slot per brick, -1 where unallocated. */
  brickSlot: StorageBufferAttribute;
  /** Brick per slot, -1 where free. */
  slotBrick: StorageBufferAttribute;
  /** Mass per slot, written by the census pass and read back for the allocator. */
  slotTotal: StorageBufferAttribute;
  /** Slots to zero on the next zero pass. */
  zeroList: StorageBufferAttribute;
  /** Invocation bound for the step and pour passes: slotHigh * BRICK_CELLS. */
  liveCells: ReturnType<typeof uniform>;
  /** Invocation bound for the census pass: slotHigh. */
  liveSlots: ReturnType<typeof uniform>;
  /** Invocation bound for the zero pass: zeroCount * BRICK_CELLS. */
  zeroCells: ReturnType<typeof uniform>;
}

export function createBrickBuffers(n: number, slots: number): BrickFluidBuffers {
  if (n % BRICK !== 0) throw new Error(`brick fluid needs n divisible by ${BRICK}, got ${n}`);
  const b = n / BRICK;
  const cells = slots * BRICK_CELLS;
  return {
    n,
    b,
    slots,
    massRead: new StorageBufferAttribute(new Float32Array(cells), 1),
    massWrite: new StorageBufferAttribute(new Float32Array(cells), 1),
    velRead: new StorageBufferAttribute(new Float32Array(cells), 1),
    velWrite: new StorageBufferAttribute(new Float32Array(cells), 1),
    solidBits: new StorageBufferAttribute(new Uint32Array(Math.ceil(n ** 3 / 32)), 1),
    brickSlot: new StorageBufferAttribute(new Int32Array(b ** 3).fill(-1), 1),
    slotBrick: new StorageBufferAttribute(new Int32Array(slots).fill(-1), 1),
    slotTotal: new StorageBufferAttribute(new Float32Array(slots), 1),
    zeroList: new StorageBufferAttribute(new Int32Array(slots), 1),
    liveCells: uniform(0, 'int'),
    liveSlots: uniform(0, 'int'),
    zeroCells: uniform(0, 'int'),
  };
}

/** Every byte the pass holds on the GPU, itemized. */
export function brickBufferBytes(bufs: BrickFluidBuffers): Record<string, number> & { total: number } {
  const f = (a: StorageBufferAttribute) => (a.array as ArrayLike<number>).length * 4;
  const parts = {
    mass: f(bufs.massRead) + f(bufs.massWrite),
    vel: f(bufs.velRead) + f(bufs.velWrite),
    solid: f(bufs.solidBits),
    brickSlot: f(bufs.brickSlot),
    slotBrick: f(bufs.slotBrick),
    slotTotal: f(bufs.slotTotal),
    zeroList: f(bufs.zeroList),
  };
  let total = 0;
  for (const v of Object.values(parts)) total += v;
  return { ...parts, total };
}

type IntNode = ReturnType<typeof int>;
type FloatNode = ReturnType<typeof float>;

/**
 * The addressing every kernel shares.
 *
 * `tap` is the one place the sparsity lives. It resolves a cell coordinate to a
 * pool address and an open mask in a single brick lookup, so the flow function
 * pays one indirection per neighbour instead of one per question.
 */
function makeAddressing(bufs: BrickFluidBuffers, mass: ReturnType<typeof storage>) {
  const { n, b } = bufs;
  const N = int(n);
  const Nm1 = int(n - 1);
  const B = int(b);
  const brickSlot = storage(bufs.brickSlot, 'int', bufs.brickSlot.count).toReadOnly();
  const solidBits = storage(bufs.solidBits, 'uint', bufs.solidBits.count).toReadOnly();

  /** Pool address, open mask and mass for one cell. Out, unallocated and solid all read closed. */
  const tap = (x: IntNode, y: IntNode, z: IntNode) => {
    const inside = x
      .greaterThanEqual(int(0))
      .and(x.lessThanEqual(Nm1))
      .and(y.greaterThanEqual(int(0)))
      .and(y.lessThanEqual(Nm1))
      .and(z.greaterThanEqual(int(0)))
      .and(z.lessThanEqual(Nm1));
    const cx = x.clamp(int(0), Nm1);
    const cy = y.clamp(int(0), Nm1);
    const cz = z.clamp(int(0), Nm1);

    const bid = cy.div(int(BRICK)).mul(B).add(cz.div(int(BRICK))).mul(B).add(cx.div(int(BRICK)));
    const slot = brickSlot.element(bid).toVar();
    const live = inside.and(slot.greaterThanEqual(int(0)));

    const local = modInt(cy, int(BRICK))
      .mul(int(BRICK))
      .add(modInt(cz, int(BRICK)))
      .mul(int(BRICK))
      .add(modInt(cx, int(BRICK)));
    const addr = select(live, slot.max(int(0)).mul(int(BRICK_CELLS)).add(local), int(0)).toVar();

    // Solid is dense and bit-packed: bit (i & 31) of word (i >> 5). Unsigned
    // throughout, because WGSL's shift operators take a u32 right-hand side.
    const di = uint(cy.mul(N).add(cz).mul(N).add(cx));
    const word = solidBits.element(di.div(uint(32)));
    const bit = word.bitAnd(uint(1).shiftLeft(di.bitAnd(uint(31))));
    const open = select(live.and(bit.equal(uint(0))), float(1), float(0)).toVar();

    // Mass comes back already masked. A closed cell resolves to address 0,
    // which is a real cell belonging to slot 0, so the mask is not a nicety —
    // it is what stops a wall from reading another brick's water.
    return { addr, open, mass: mass.element(addr).mul(open).toVar() };
  };

  return { tap, N, B };
}

/**
 * The gather step over the allocated bricks.
 *
 * One invocation per cell of one slot. The flow function is called seven times,
 * once for this cell and once for each face neighbour, exactly as the dense
 * kernel does — the gather form is what makes concurrent writes impossible, and
 * sparsity does not change that argument.
 */
export function buildBrickStep(bufs: BrickFluidBuffers) {
  const mass = storage(bufs.massRead, 'float', bufs.massRead.count).toReadOnly();
  const vel = storage(bufs.velRead, 'float', bufs.velRead.count).toReadOnly();
  const massOut = storage(bufs.massWrite, 'float', bufs.massWrite.count);
  const velOut = storage(bufs.velWrite, 'float', bufs.velWrite.count);
  const slotBrick = storage(bufs.slotBrick, 'int', bufs.slotBrick.count).toReadOnly();
  const { tap, B } = makeAddressing(bufs, mass);

  /** The mirror of cellFlowsSparse. Masks where the reference branches. */
  const emitFlows = (x: IntNode, y: IntNode, z: IntNode) => {
    const self = tap(x, y, z);
    const m = self.mass.toVar();
    const wet = select(m.greaterThan(float(DRY)), float(1), float(0)).mul(self.open).toVar();

    // 1. DOWN. Gravity plus retained downward momentum.
    const below = tap(x, y.sub(int(1)), z);
    const room = float(MAX_MASS).sub(below.mass).max(float(0));
    const pull = float(GRAVITY).add(vel.element(self.addr).negate().max(float(0)).mul(float(0.3)));
    const down = m.min(room.mul(pull)).mul(below.open).mul(wet).toVar();
    const rem = m.sub(down).toVar();

    // 2. SIDEWAYS. All four from the same remaining mass, one shared scale.
    const side = (t: ReturnType<typeof tap>): FloatNode =>
      rem.sub(t.mass).mul(float(RELAX * 0.25)).max(float(0)).mul(t.open).mul(wet);
    const xm = side(tap(x.sub(int(1)), y, z)).toVar();
    const xp = side(tap(x.add(int(1)), y, z)).toVar();
    const zm = side(tap(x, y, z.sub(int(1)))).toVar();
    const zp = side(tap(x, y, z.add(int(1)))).toVar();
    const sum = xm.add(xp).add(zm).add(zp).toVar();
    const scale = rem.div(sum.max(rem.max(float(1e-6)))).toVar();

    // 3. UP, only when over-full. That excess is pressure.
    const rem2 = rem.sub(sum.mul(scale));
    const above = tap(x, y.add(int(1)), z);
    const roomAbove = float(MAX_MASS).sub(above.mass).max(float(0));
    const up = rem2.sub(float(1)).max(float(0)).min(roomAbove).mul(above.open).mul(wet).toVar();

    return {
      down,
      xm: xm.mul(scale).toVar(),
      xp: xp.mul(scale).toVar(),
      zm: zm.mul(scale).toVar(),
      zp: zp.mul(scale).toVar(),
      up,
    };
  };

  return Fn(() => {
    const i = int(instanceIndex);
    const slot = i.div(int(BRICK_CELLS)).toVar();
    const bid = slotBrick.element(slot.min(int(bufs.slots - 1))).toVar();

    If(i.lessThan(int(bufs.liveCells)).and(bid.greaterThanEqual(int(0))), () => {
      const local = i.sub(slot.mul(int(BRICK_CELLS))).toVar();
      const lx = modInt(local, int(BRICK)).toVar();
      const lz = modInt(local.div(int(BRICK)), int(BRICK)).toVar();
      const ly = local.div(int(BRICK * BRICK)).toVar();
      const bx = modInt(bid, B).toVar();
      const bz = modInt(bid.div(B), B).toVar();
      const by = bid.div(B.mul(B)).toVar();
      const x = bx.mul(int(BRICK)).add(lx).toVar();
      const y = by.mul(int(BRICK)).add(ly).toVar();
      const z = bz.mul(int(BRICK)).add(lz).toVar();

      const self = emitFlows(x, y, z);
      const above = emitFlows(x, y.add(int(1)), z);
      const belowF = emitFlows(x, y.sub(int(1)), z);
      const left = emitFlows(x.sub(int(1)), y, z);
      const right = emitFlows(x.add(int(1)), y, z);
      const back = emitFlows(x, y, z.sub(int(1)));
      const front = emitFlows(x, y, z.add(int(1)));

      const totalOut = self.down.add(self.xm).add(self.xp).add(self.zm).add(self.zp).add(self.up);
      const downIn = above.down;
      const upIn = belowF.up;
      const inflow = downIn.add(upIn).add(left.xp).add(right.xm).add(back.zp).add(front.zm);

      massOut.element(i).assign(mass.element(i).sub(totalOut).add(inflow));

      const hasDownIn = select(downIn.greaterThan(float(0)), float(1), float(0));
      velOut
        .element(i)
        .assign(
          vel
            .element(i)
            .mul(float(1).sub(float(1 - DAMPING).mul(hasDownIn)))
            .sub(downIn)
            .add(upIn),
        );
    });
  })().compute(bufs.slots * BRICK_CELLS);
}

export interface BrickPourControls {
  x: ReturnType<typeof uniform>;
  y: ReturnType<typeof uniform>;
  z: ReturnType<typeof uniform>;
  radius: ReturnType<typeof uniform>;
  rate: ReturnType<typeof uniform>;
}

/**
 * Add mass inside a sphere of cells, in place in massRead.
 *
 * In place is safe: every invocation writes only its own cell. Cells whose
 * brick has no slot are not reached at all, which is why the driver pins the
 * pour's bricks before the first drop.
 */
export function buildBrickPour(bufs: BrickFluidBuffers) {
  const mass = storage(bufs.massRead, 'float', bufs.massRead.count);
  const slotBrick = storage(bufs.slotBrick, 'int', bufs.slotBrick.count).toReadOnly();
  const solidBits = storage(bufs.solidBits, 'uint', bufs.solidBits.count).toReadOnly();
  const B = int(bufs.b);
  const N = int(bufs.n);

  const controls: BrickPourControls = {
    x: uniform(0),
    y: uniform(0),
    z: uniform(0),
    radius: uniform(3),
    rate: uniform(0),
  };

  const node = Fn(() => {
    const i = int(instanceIndex);
    const slot = i.div(int(BRICK_CELLS)).toVar();
    const bid = slotBrick.element(slot.min(int(bufs.slots - 1))).toVar();
    If(
      i.lessThan(int(bufs.liveCells)).and(bid.greaterThanEqual(int(0))).and(float(controls.rate).greaterThan(float(0))),
      () => {
        const local = i.sub(slot.mul(int(BRICK_CELLS))).toVar();
        const x = modInt(bid, B).mul(int(BRICK)).add(modInt(local, int(BRICK))).toVar();
        const z = modInt(bid.div(B), B).mul(int(BRICK)).add(modInt(local.div(int(BRICK)), int(BRICK))).toVar();
        const y = bid.div(B.mul(B)).mul(int(BRICK)).add(local.div(int(BRICK * BRICK))).toVar();

        const di = uint(y.mul(N).add(z).mul(N).add(x));
        const bit = solidBits.element(di.div(uint(32))).bitAnd(uint(1).shiftLeft(di.bitAnd(uint(31))));

        const dx = float(x).sub(controls.x);
        const dy = float(y).sub(controls.y);
        const dz = float(z).sub(controls.z);
        const d2 = dx.mul(dx).add(dy.mul(dy)).add(dz.mul(dz));
        const r = float(controls.radius);
        If(d2.lessThan(r.mul(r)).and(bit.equal(uint(0))), () => {
          mass.element(i).addAssign(float(controls.rate));
        });
      },
    );
  })().compute(bufs.slots * BRICK_CELLS);

  return { node, controls };
}

/**
 * Sum each slot's 512 cells into `slotTotal`.
 *
 * SLOT-shaped, not brick-shaped, for two reasons. It is race-free by
 * construction — each invocation writes its own slot and nothing else — where a
 * brick-shaped output would be a scatter. And it is the buffer that gets read
 * back every refresh, so it is the one that has to be small: 48 kB at a 12,288
 * slot pool, against a megabyte for one float per brick.
 */
export function buildSlotCensus(bufs: BrickFluidBuffers) {
  const mass = storage(bufs.massRead, 'float', bufs.massRead.count).toReadOnly();
  const out = storage(bufs.slotTotal, 'float', bufs.slotTotal.count);
  return Fn(() => {
    const slot = int(instanceIndex);
    If(slot.lessThan(int(bufs.liveSlots)), () => {
      const base = slot.mul(int(BRICK_CELLS)).toVar();
      const sum = float(0).toVar();
      Loop(int(BRICK_CELLS), ({ i }: { i: IntNode }) => {
        sum.addAssign(mass.element(base.add(int(i))));
      });
      out.element(slot).assign(sum);
    });
  })().compute(bufs.slots);
}

/**
 * Zero the slots named in `zeroList`.
 *
 * A freed slot has zero mass by the allocator's own rule, but its VELOCITY
 * survives, and a stale downward velocity would accelerate the first drop that
 * lands in the reused slot. Both fields, both buffers.
 */
export function buildSlotZero(bufs: BrickFluidBuffers) {
  const a = storage(bufs.massRead, 'float', bufs.massRead.count);
  const c = storage(bufs.velRead, 'float', bufs.velRead.count);
  const d = storage(bufs.velWrite, 'float', bufs.velWrite.count);
  const list = storage(bufs.zeroList, 'int', bufs.zeroList.count).toReadOnly();
  return Fn(() => {
    const i = int(instanceIndex);
    If(i.lessThan(int(bufs.zeroCells)), () => {
      const k = i.div(int(BRICK_CELLS)).toVar();
      const local = i.sub(k.mul(int(BRICK_CELLS))).toVar();
      const slot = list.element(k.min(int(bufs.slots - 1))).toVar();
      If(slot.greaterThanEqual(int(0)), () => {
        const addr = slot.mul(int(BRICK_CELLS)).add(local).toVar();
        a.element(addr).assign(float(0));
        c.element(addr).assign(float(0));
        d.element(addr).assign(float(0));
      });
    });
  })().compute(bufs.slots * BRICK_CELLS);
}

/**
 * Zero the whole pool. Reset only — never on the hot path.
 *
 * `needsUpdate` on a StorageBufferAttribute does not re-upload once the buffer
 * is GPU-resident, so clearing where the data lives is the one honest reset.
 */
export function buildBrickClear(bufs: BrickFluidBuffers) {
  const a = storage(bufs.massRead, 'float', bufs.massRead.count);
  const b = storage(bufs.massWrite, 'float', bufs.massWrite.count);
  const c = storage(bufs.velRead, 'float', bufs.velRead.count);
  const d = storage(bufs.velWrite, 'float', bufs.velWrite.count);
  return Fn(() => {
    const i = int(instanceIndex);
    a.element(i).assign(float(0));
    b.element(i).assign(float(0));
    c.element(i).assign(float(0));
    d.element(i).assign(float(0));
  })().compute(bufs.slots * BRICK_CELLS);
}

/**
 * Reduce the 3D field to one water height and one true depth per column.
 *
 * The dense version walked all n cells of a column. This one walks the b BRICK
 * rows and only descends into the eight cells of a row whose brick exists,
 * which at 64 bricks per edge is an eighth of the work before a single wet cell
 * is found. A dry column writes -1000, which the mesh uses to sink its vertex.
 */
export function buildBrickColumnSurface(
  bufs: BrickFluidBuffers,
  surface: StorageBufferAttribute,
  colDepth: StorageBufferAttribute,
  baseYM: number,
  cellM: number,
  displayMin = 0.25,
) {
  const { n, b } = bufs;
  const mass = storage(bufs.massRead, 'float', bufs.massRead.count).toReadOnly();
  const brickSlot = storage(bufs.brickSlot, 'int', bufs.brickSlot.count).toReadOnly();
  const out = storage(surface, 'float', surface.count);
  const outDepth = storage(colDepth, 'float', colDepth.count);
  const N = int(n);
  const B = int(b);

  return Fn(() => {
    const col = int(instanceIndex);
    const x = modInt(col, N).toVar();
    const z = col.div(N).toVar();
    const bx = x.div(int(BRICK)).toVar();
    const bz = z.div(int(BRICK)).toVar();
    const lx = modInt(x, int(BRICK)).toVar();
    const lz = modInt(z, int(BRICK)).toVar();

    const topY = float(-1).toVar();
    const topM = float(0).toVar();
    const total = float(0).toVar();

    Loop(int(b), ({ i }: { i: IntNode }) => {
      const by = int(i).toVar();
      const slot = brickSlot.element(by.mul(B).add(bz).mul(B).add(bx)).toVar();
      If(slot.greaterThanEqual(int(0)), () => {
        const base = slot.mul(int(BRICK_CELLS)).add(lz.mul(int(BRICK))).add(lx).toVar();
        Loop(int(BRICK), ({ i: j }: { i: IntNode }) => {
          const m = mass.element(base.add(int(j).mul(int(BRICK * BRICK)))).toVar();
          total.addAssign(m);
          const wet = m.greaterThan(float(displayMin));
          topY.assign(select(wet, float(by.mul(int(BRICK)).add(int(j))), topY));
          topM.assign(select(wet, m, topM));
        });
      });
    });

    const h = float(baseYM).add(topY.add(topM.clamp(float(0), float(1))).mul(float(cellM)));
    out.element(col).assign(select(topY.greaterThanEqual(float(0)), h, float(-1000)));
    outDepth.element(col).assign(total.mul(float(cellM)));
  })().compute(n * n);
}

/**
 * Resize a dispatch to the live part of the pool.
 *
 * This is where the sparsity actually turns into saved milliseconds. A compute
 * node keeps its invocation count in a mutable field that WebGPUBackend reads
 * at dispatch time, so shrinking it to `slotHigh * 512` means the card never
 * launches a workgroup for a brick that does not exist. Without this the guard
 * inside the kernel still gives the right answer, but every frame pays for the
 * whole twelve-thousand-slot pool whether or not the water fills it.
 */
export function setDispatchCells(node: unknown, cells: number): void {
  const n = node as { count: number; updateDispatchCount: () => void };
  n.count = Math.max(0, cells);
  n.updateDispatchCount();
}

/** Swap the read and write pairs — mass and velocity together, once per step. */
export function swapBrickBuffers(bufs: BrickFluidBuffers): void {
  const m = bufs.massRead;
  bufs.massRead = bufs.massWrite;
  bufs.massWrite = m;
  const v = bufs.velRead;
  bufs.velRead = bufs.velWrite;
  bufs.velWrite = v;
}

/* ---------------------------------------------------------------------- *
 * The driver: one allocator, running on the CPU, steering a GPU pool.
 * ---------------------------------------------------------------------- */

export interface BrickDriver {
  bufs: BrickFluidBuffers;
  /** The allocator's index. Same code the vitest twin runs; no cells on this side. */
  index: SparseFluid;
  scratch: { totals: Float32Array; want: Uint8Array };
  policy: BrickPolicy;
  /** Bricks that must exist regardless of mass — the pour target. */
  pinned: Int32Array;
  /**
   * Passes whose dispatch covers the live slots: the step pair and the pour.
   * The driver resizes them itself, in the same place it computes the bounds,
   * so a caller cannot leave one dispatching over the whole pool.
   */
  liveNodes: unknown[];
  /** The zero pass, sized to the slots allocated by this refresh alone. */
  zeroNode: unknown | null;
  /** A census readback is in flight. */
  busy: boolean;
  /** A census that has landed and is waiting for the top of a frame. */
  landed: Float32Array | null;
  /** Last refresh's outcome, for the HUD and the report. */
  stats: RefreshStats;
  /** Highest slot count ever in use. This is the number that sizes the pool. */
  peakUsed: number;
  /** Milliseconds of the last refresh, split into its two halves. */
  readbackMs: number;
  scanMs: number;
  uploadMs: number;
}

export function createBrickDriver(bufs: BrickFluidBuffers, policy: BrickPolicy): BrickDriver {
  const index = createSparseFluid(bufs.n, bufs.slots, false);
  // The index shares the solid bits with the GPU buffer rather than copying
  // them: same bytes, one as unsigned for the shader and one as signed for the
  // brick-open scan.
  index.solidBits = new Int32Array((bufs.solidBits.array as Uint32Array).buffer);
  computeBrickOpen(index);
  return {
    bufs,
    index,
    scratch: createRefreshScratch(index),
    policy,
    pinned: new Int32Array(0),
    liveNodes: [],
    zeroNode: null,
    busy: false,
    landed: null,
    stats: { wanted: 0, wet: 0, allocated: 0, freed: 0, used: 0, slotHigh: 0, starved: 0, newSlots: new Int32Array(0) },
    peakUsed: 0,
    readbackMs: 0,
    scanMs: 0,
    uploadMs: 0,
  };
}

/** Recompute which bricks can hold water. Call after the solid field is filled. */
export function driverSolidChanged(driver: BrickDriver): void {
  computeBrickOpen(driver.index);
}

/** Pin the bricks a pour writes into, so they exist before the first drop. */
export function driverPinSphere(driver: BrickDriver, cx: number, cy: number, cz: number, r: number): void {
  driver.pinned = bricksInSphere(driver.index, cx, cy, cz, r);
}

/** Copy the CPU index into the attribute arrays and set the dispatch bounds. */
function writeIndexArrays(driver: BrickDriver, newSlots: Int32Array): void {
  const { bufs, index } = driver;
  (bufs.brickSlot.array as Int32Array).set(index.brickSlot);
  (bufs.slotBrick.array as Int32Array).set(index.slotBrick);
  const zl = bufs.zeroList.array as Int32Array;
  zl.fill(-1);
  const zn = Math.min(newSlots.length, zl.length);
  zl.set(newSlots.subarray(0, zn));

  bufs.liveCells.value = index.slotHigh * BRICK_CELLS;
  bufs.liveSlots.value = index.slotHigh;
  bufs.zeroCells.value = zn * BRICK_CELLS;

  for (const node of driver.liveNodes) setDispatchCells(node, index.slotHigh * BRICK_CELLS);
  if (driver.zeroNode) setDispatchCells(driver.zeroNode, zn * BRICK_CELLS);
}

/**
 * Send the index arrays to the card.
 *
 * They cannot ride on `needsUpdate`: three uploads a storage attribute when its
 * bind group is first built and never again — `Bindings._update` handles uniform
 * buffers and textures and walks straight past storage. `updateAttribute` is the
 * backend's own writeBuffer path and is the only one that lands. It also
 * requires the buffer to exist, so the first index goes out through the arrays
 * alone (see `driverPrime`) and every later one through here.
 */
function pushIndex(driver: BrickDriver, renderer: BrickRenderer): void {
  const backend = renderer.backend;
  backend.updateAttribute(driver.bufs.brickSlot);
  backend.updateAttribute(driver.bufs.slotBrick);
  backend.updateAttribute(driver.bufs.zeroList);
}

/** Just enough of WebGPURenderer to drive the pool, without importing the class. */
interface BrickRenderer {
  backend: { updateAttribute: (a: StorageBufferAttribute) => void };
  getArrayBufferAsync: (a: StorageBufferAttribute) => Promise<ArrayBuffer>;
}

/**
 * Start a census readback. Does NOT wait for it.
 *
 * Measured on the first working build: the readback cost 10.9 ms of a 12.5 ms
 * refresh, and awaiting it inside the frame chain made it 70% of the sim's
 * whole per-frame cost. It is a round trip, not work — the right place for it
 * is off the critical path. The caller runs `buildSlotCensus` immediately
 * before this so the buffer it maps is the one it just wrote.
 */
export function driverKickCensus(driver: BrickDriver, renderer: BrickRenderer): void {
  if (driver.busy || driver.landed !== null) return;
  driver.busy = true;
  const t0 = performance.now();
  void renderer
    .getArrayBufferAsync(driver.bufs.slotTotal)
    .then((buf) => {
      driver.landed = new Float32Array(buf);
      driver.readbackMs = performance.now() - t0;
    })
    .finally(() => {
      driver.busy = false;
    });
}

/**
 * Apply a landed census, if one has landed.
 *
 * Called at ONE defined point in the frame — the top, before any dispatch —
 * because the index it rewrites is read by every pass. Letting an allocation
 * land between two step dispatches would let a brick be read in the same frame
 * it was created and before it was zeroed, which invents water out of a stale
 * slot. Returns the stats when it applied, null when nothing was waiting.
 */
export function driverApplyCensus(driver: BrickDriver, renderer: BrickRenderer): RefreshStats | null {
  const raw = driver.landed;
  if (raw === null) return null;
  driver.landed = null;
  const { index, scratch } = driver;

  const t1 = performance.now();
  // Slot-shaped census to brick-shaped totals. The CPU owns slotBrick, so this
  // is a scan of the live slots and nothing more.
  scratch.totals.fill(0);
  for (let slot = 0; slot < index.slotHigh; slot++) {
    const bid = index.slotBrick[slot];
    if (bid >= 0) scratch.totals[bid] = raw[slot];
  }

  const wet = markWanted(index, scratch.totals, driver.policy, scratch.want, driver.pinned);
  const stats = applyWanted(index, scratch.want, scratch.totals);
  stats.wet = wet;
  const t2 = performance.now();

  writeIndexArrays(driver, stats.newSlots);
  pushIndex(driver, renderer);
  const t3 = performance.now();

  driver.stats = stats;
  driver.peakUsed = Math.max(driver.peakUsed, stats.used);
  driver.scanMs = t2 - t1;
  driver.uploadMs = t3 - t2;
  return stats;
}


/**
 * Allocate the pinned bricks before the first dispatch.
 *
 * No renderer here on purpose: nothing has been bound yet, so there is no GPU
 * buffer to write into. The arrays go up with the bind group.
 */
export function driverPrime(driver: BrickDriver): void {
  const made = ensureBricks(driver.index, driver.pinned);
  writeIndexArrays(driver, made);
}

/** Forget every allocation. Pairs with the clear pass, which zeroes the pool. */
export function driverReset(driver: BrickDriver, renderer: BrickRenderer): void {
  const { index } = driver;
  index.brickSlot.fill(-1);
  index.slotBrick.fill(-1);
  index.slotHigh = 0;
  index.freeCount = 0;
  driver.peakUsed = 0;
  // A census taken before the reset describes a pool that no longer exists.
  driver.landed = null;
  const made = ensureBricks(index, driver.pinned);
  writeIndexArrays(driver, made);
  pushIndex(driver, renderer);
}

/** Fill the dense solid bitfield from a predicate. Run once, when a bubble is built. */
export function fillBrickSolid(
  bufs: BrickFluidBuffers,
  isSolid: (x: number, y: number, z: number) => boolean,
): void {
  const n = bufs.n;
  const bits = bufs.solidBits.array as Uint32Array;
  bits.fill(0);
  for (let y = 0; y < n; y++) {
    for (let z = 0; z < n; z++) {
      const row = (y * n + z) * n;
      for (let x = 0; x < n; x++) {
        if (!isSolid(x, y, z)) continue;
        const i = row + x;
        bits[i >>> 5] |= 1 << (i & 31);
      }
    }
  }
}
