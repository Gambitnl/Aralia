/**
 * @file fluidCompute.ts — the fluid solver as a DENSE GPU compute pass.
 *
 * SUPERSEDED, 2026-08-10 (IMPL-8). `?step=fluid` Grid mode now runs
 * `fluidBrickCompute.ts`: the same gather arithmetic over a sparse pool of
 * 8-cubed brick slots, which holds 64 m at 12.5 cm in 113 MB where this file
 * needs 320 MB for 64 m at 25 cm. A census of this very scene, read off the
 * live GPU, found 0.23% of its cells carrying water.
 *
 * Still live from this file: `buildSurfaceSmoothPass`, which is resolution
 * agnostic and shared, and the BUBBLE_* constants, which `fluidProofTerrain.ts`
 * uses to build the ground both water proofs stand on. Everything else —
 * `createFluidBuffers`, `buildFluidStep`, `buildPourStep`, `buildClearStep`,
 * `buildColumnSurfacePass`, `swapFluidBuffers`, `fillSolidFromVolume` — has no
 * caller left and is kept only as the measured baseline the ADR records. It
 * should be deleted when ADR 0002's item 5 is closed.
 *
 * WHY THIS EXISTS, IN NUMBERS
 *
 * The CPU solver in fluidSolver.ts was measured on real terrain (2026-08-05).
 * It costs about 3 microseconds per moving cell per step, which lands like
 * this:
 *
 *     32 m at 12 cm,   9,137 wet cells  ->   15.7 ms   (30 fps, just)
 *     64 m at 12 cm,  34,170 wet cells  ->  108.5 ms   (no)
 *     64 m at 12 cm, 133,033 wet cells  ->  179.9 ms   (no)
 *
 * A whole frame at 60 fps is 16.7 ms. Remy wants full simulation at 64 m, so
 * the CPU route is short by roughly an order of magnitude and no amount of
 * tuning closes that. Remy's call: GPU compute.
 *
 * THE KERNEL GATHERS. IT MUST NEVER SCATTER.
 *
 * The first draft of this kernel pushed mass into neighbors with
 * `out[neighbor] += flow`. Every cell runs at once on a GPU, so two cells
 * pushing into the same neighbor race, one write lands, and the field silently
 * loses water. The double buffer prevents torn reads; it does nothing about
 * concurrent writes, and WGSL has no float atomics to lean on.
 *
 * So the kernel is gather-form. Each cell recomputes, from the read buffers
 * alone, the outflow of itself and its six neighbors; sums what arrives;
 * writes ONLY ITSELF. No two invocations share a write address, so there is
 * nothing to race. The flow function runs seven times per cell instead of
 * once, and that arithmetic is the fair price of exact conservation.
 *
 * The arithmetic lives twice on purpose: fluidGather.ts is the same step in
 * plain TypeScript, where vitest can prove conservation without a GPU. This
 * file mirrors it node for node, with masks where the reference branches. A
 * divergence between the two is a bug in the mirror, never a judgment call.
 *
 * WHAT ELSE CHANGES ON THE GPU
 *
 *   NO ACTIVE SET. The CPU walked only wet cells, which made a mostly-dry
 *   bubble cheap. A dispatch runs the whole grid and relies on masks that
 *   zero dry work. That trades the CPU's best case for a flat cost, and a
 *   flat cost that fits the frame is worth more than a variable one that
 *   sometimes does not.
 *
 *   EVERY FIELD THE PASS WRITES IS DOUBLE-BUFFERED. Mass, and velocity too:
 *   a neighbor evaluation reads my velocity while I write it, so velocity
 *   gets the same read/write pair mass has. That is five dense buffers where
 *   the ADR counted four — 320 MB, not 256 MB, at the shipped bubble size.
 *   The extra 64 MB buys conservation and is not optional.
 *
 * WHY MASS EXCHANGE RATHER THAN A PROJECTION SOLVE
 *
 * True incompressible flow needs a pressure solve — a global linear system,
 * many iterations per step. That is the research-grade cost, and it is the
 * right next move only if this proves too coarse. Mass exchange with a
 * velocity field gives genuine pressure-driven behavior: water finds a hole,
 * a breached dam empties under its own head, momentum carries a wave across
 * a step. It does not give a correct pressure field, and it will not be
 * mistaken for one.
 */
import { Fn, If, Loop, instanceIndex, float, int, modInt, select, storage, uniform } from 'three/tsl';
import { StorageBufferAttribute } from 'three/webgpu';
import { DRY, RELAX, GRAVITY, MAX_MASS, DAMPING } from './fluidGather';

export { DRY, RELAX, GRAVITY, MAX_MASS, DAMPING };

/**
 * The shipped bubble, decided by measurement on 2026-08-05.
 *
 * 64 m across at 25 cm cells: 256 cubed, 16.8 million cells, five dense
 * buffers at 64 MB each for 320 MB of GPU memory.
 *
 * The alternatives and why they lost:
 *
 *   64 m at 12 cm  — ~2.9 GB. The size Remy wanted, and it does not fit. A
 *                    compute pass indexes by position, so a dense buffer must
 *                    exist everywhere, including the 99% that is solid rock or
 *                    open sky. The CPU's sparse bricks collapsed 147 MB to 6 MB
 *                    and none of that saving survives the move to the GPU.
 *   128 m at 25 cm — ~2.6 GB. Same wall, reached from the other side.
 *   32 m at 12 cm  — ~350 MB and full detail, but one arena only.
 *
 * So GPU compute buys either the AREA or the DETAIL, not both. Remy took the
 * area. The cost is that a 25 cm step is visible on a tunnel wall and on a
 * small splash, and that is a known, accepted limit rather than a bug.
 *
 * Sparse compute — brick allocation on the GPU, dispatched over a live list —
 * would restore 64 m at 12 cm for roughly 100 MB. It is the route to take when
 * 25 cm proves too coarse, and it is meaningfully more work than this file.
 */
export const BUBBLE_EXTENT_M = 64;
export const BUBBLE_CELL_M = 0.25;
export const BUBBLE_CELLS_PER_EDGE = 256;

export interface FluidComputeBuffers {
  /** Water mass per cell, read this step. */
  massRead: StorageBufferAttribute;
  /** Water mass per cell, written this step. */
  massWrite: StorageBufferAttribute;
  /** Vertical velocity per cell, read this step. */
  velRead: StorageBufferAttribute;
  /** Vertical velocity per cell, written this step. */
  velWrite: StorageBufferAttribute;
  /** 1 where the solid blocks water, 0 where it does not. */
  solid: StorageBufferAttribute;
  /** Cells per edge. */
  n: number;
}

/**
 * Allocate the field for one bubble.
 *
 * Dense arrays over the whole grid, unlike the sparse solid. That is
 * deliberate and it is the cost of parallelism: a compute pass indexes by
 * position, so the buffer has to be addressable everywhere even where it is
 * empty. At 256 cubed that is five float buffers, 320 MB, and the reason the
 * measured bubble size matters.
 */
export function createFluidBuffers(n: number): FluidComputeBuffers {
  const count = n ** 3;
  return {
    massRead: new StorageBufferAttribute(new Float32Array(count), 1),
    massWrite: new StorageBufferAttribute(new Float32Array(count), 1),
    velRead: new StorageBufferAttribute(new Float32Array(count), 1),
    velWrite: new StorageBufferAttribute(new Float32Array(count), 1),
    solid: new StorageBufferAttribute(new Float32Array(count), 1),
    n,
  };
}

type IntNode = ReturnType<typeof int>;
type FloatNode = ReturnType<typeof float>;

/**
 * Build the compute node for one fluid step.
 *
 * The node reads massRead/velRead and writes massWrite/velWrite. A material
 * that displays the field captures whichever attribute object it was built
 * with, and a JS-side swap does not rebind it — so the practical pattern is
 * to build TWO nodes, one for each direction, and run them in a pair:
 *
 *   const forward = buildFluidStep(bufs);
 *   swapFluidBuffers(bufs);
 *   const back = buildFluidStep(bufs);
 *   swapFluidBuffers(bufs);
 *   // per frame: computeAsync(forward); computeAsync(back);
 *
 * After the pair, massRead/velRead hold the freshest field and anything bound
 * to them stays current.
 */
export function buildFluidStep(bufs: FluidComputeBuffers) {
  const n = bufs.n;
  const mass = storage(bufs.massRead, 'float', bufs.massRead.count).toReadOnly();
  const vel = storage(bufs.velRead, 'float', bufs.velRead.count).toReadOnly();
  const solid = storage(bufs.solid, 'float', bufs.solid.count).toReadOnly();
  const massOut = storage(bufs.massWrite, 'float', bufs.massWrite.count);
  const velOut = storage(bufs.velWrite, 'float', bufs.velWrite.count);

  const N = int(n);
  const Nm1 = int(n - 1);
  const NN = int(n * n);

  /** Flat index with clamped coordinates, safe to read at any (x,y,z). */
  const idxC = (x: IntNode, y: IntNode, z: IntNode) => {
    const cx = x.clamp(int(0), Nm1);
    const cy = y.clamp(int(0), Nm1);
    const cz = z.clamp(int(0), Nm1);
    return cy.mul(N).add(cz).mul(N).add(cx);
  };

  /** 1 when the cell exists and is not solid; 0 otherwise. Out of bounds is solid. */
  const openAt = (x: IntNode, y: IntNode, z: IntNode): FloatNode => {
    const inside = x
      .greaterThanEqual(int(0))
      .and(x.lessThanEqual(Nm1))
      .and(y.greaterThanEqual(int(0)))
      .and(y.lessThanEqual(Nm1))
      .and(z.greaterThanEqual(int(0)))
      .and(z.lessThanEqual(Nm1));
    const notSolid = solid.element(idxC(x, y, z)).lessThan(float(0.5));
    return select(inside.and(notSolid), float(1), float(0));
  };

  /** Mass at a cell, 0 outside the bubble. */
  const massAt = (x: IntNode, y: IntNode, z: IntNode): FloatNode => {
    const inside = x
      .greaterThanEqual(int(0))
      .and(x.lessThanEqual(Nm1))
      .and(y.greaterThanEqual(int(0)))
      .and(y.lessThanEqual(Nm1))
      .and(z.greaterThanEqual(int(0)))
      .and(z.lessThanEqual(Nm1));
    return mass.element(idxC(x, y, z)).mul(select(inside, float(1), float(0)));
  };

  /**
   * The flow function — the mirror of cellFlows in fluidGather.ts, with masks
   * where the reference branches. Every value is a .toVar() so the emitted
   * shader computes it once.
   */
  const emitFlows = (x: IntNode, y: IntNode, z: IntNode) => {
    const bOpen = openAt(x, y, z).toVar();
    const m = mass
      .element(idxC(x, y, z))
      .mul(bOpen)
      .toVar();
    const wet = select(m.greaterThan(float(DRY)), float(1), float(0)).mul(bOpen).toVar();

    // 1. DOWN. Gravity plus retained downward momentum.
    const oBelow = openAt(x, y.sub(int(1)), z).toVar();
    const room = float(MAX_MASS).sub(massAt(x, y.sub(int(1)), z)).max(float(0));
    const pull = float(GRAVITY).add(
      vel.element(idxC(x, y, z)).negate().max(float(0)).mul(float(0.3)),
    );
    const down = m.min(room.mul(pull)).mul(oBelow).mul(wet).toVar();
    const rem = m.sub(down).toVar();

    // 2. SIDEWAYS. All four flows from the same remaining mass, one shared
    // scale when they oversubscribe it. Order-free, matching the reference.
    const sideF = (sx: IntNode, sy: IntNode, sz: IntNode) =>
      rem
        .sub(massAt(sx, sy, sz))
        .mul(float(RELAX * 0.25))
        .max(float(0))
        .mul(openAt(sx, sy, sz))
        .mul(wet);
    const xm = sideF(x.sub(int(1)), y, z).toVar();
    const xp = sideF(x.add(int(1)), y, z).toVar();
    const zm = sideF(x, y, z.sub(int(1))).toVar();
    const zp = sideF(x, y, z.add(int(1))).toVar();
    const sum = xm.add(xp).add(zm).add(zp).toVar();
    const scale = rem.div(sum.max(rem.max(float(1e-6)))).toVar();

    // 3. UP, only when over-full. That excess is pressure.
    const rem2 = rem.sub(sum.mul(scale));
    const oAbove = openAt(x, y.add(int(1)), z);
    const roomAbove = float(MAX_MASS).sub(massAt(x, y.add(int(1)), z)).max(float(0));
    const up = rem2.sub(float(1)).max(float(0)).min(roomAbove).mul(oAbove).mul(wet).toVar();

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

    // Unpack the flat index. Layout is (y * n + z) * n + x, matching the CPU
    // reference exactly so the two can be compared cell for cell.
    const x = modInt(i, N).toVar();
    const z = modInt(i.div(N), N).toVar();
    const y = i.div(NN).toVar();

    const m = mass.element(i).toVar();

    // My own outflow, and the six neighbor evaluations that decide my inflow.
    // Each neighbor's flow function is the same deterministic arithmetic I
    // would run in their invocation, so the sum is exact and no write races.
    const self = emitFlows(x, y, z);
    const above = emitFlows(x, y.add(int(1)), z);
    const below = emitFlows(x, y.sub(int(1)), z);
    const left = emitFlows(x.sub(int(1)), y, z);
    const right = emitFlows(x.add(int(1)), y, z);
    const back = emitFlows(x, y, z.sub(int(1)));
    const front = emitFlows(x, y, z.add(int(1)));

    const totalOut = self.down.add(self.xm).add(self.xp).add(self.zm).add(self.zp).add(self.up);
    const downIn = above.down;
    const upIn = below.up;
    const inflow = downIn.add(upIn).add(left.xp).add(right.xm).add(back.zp).add(front.zm);

    massOut.element(i).assign(m.sub(totalOut).add(inflow));

    // Mass landing from above damps the cell and drives it down; mass forced
    // up from below pushes it up. Same expression as the reference.
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
  })().compute(bufs.massRead.count);
}

export interface PourControls {
  /** Pour center, in cell coordinates. */
  x: ReturnType<typeof uniform>;
  y: ReturnType<typeof uniform>;
  z: ReturnType<typeof uniform>;
  /** Pour radius in cells. */
  radius: ReturnType<typeof uniform>;
  /** Mass added per cell per pour pass. 0 turns the pour off. */
  rate: ReturnType<typeof uniform>;
}

/**
 * Build a pour pass: add mass inside a sphere of cells.
 *
 * Writes massRead IN PLACE, before the step reads it. In-place is safe here
 * because every invocation writes only its own cell — the race the step
 * kernel gathers to avoid cannot occur in a pure per-cell add.
 */
export function buildPourStep(bufs: FluidComputeBuffers) {
  const n = bufs.n;
  const mass = storage(bufs.massRead, 'float', bufs.massRead.count);
  const solid = storage(bufs.solid, 'float', bufs.solid.count).toReadOnly();
  const N = int(n);
  const NN = int(n * n);

  const controls: PourControls = {
    x: uniform(n / 2),
    y: uniform(n - 8),
    z: uniform(n / 2),
    radius: uniform(3),
    rate: uniform(0),
  };

  const node = Fn(() => {
    const i = int(instanceIndex);
    const x = float(modInt(i, N));
    const z = float(modInt(i.div(N), N));
    const y = float(i.div(NN));
    const dx = x.sub(controls.x);
    const dy = y.sub(controls.y);
    const dz = z.sub(controls.z);
    const d2 = dx.mul(dx).add(dy.mul(dy)).add(dz.mul(dz));
    const r = float(controls.radius);
    If(
      d2
        .lessThan(r.mul(r))
        .and(solid.element(i).lessThan(float(0.5)))
        .and(float(controls.rate).greaterThan(float(0))),
      () => {
        mass.element(i).addAssign(float(controls.rate));
      },
    );
  })().compute(bufs.massRead.count);

  return { node, controls };
}

/**
 * Swap the read and write pairs — mass and velocity together.
 *
 * Call once per step, after the compute finishes. Forgetting this runs every
 * step against the same input and the field appears to freeze while the GPU
 * burns full cost — a failure that looks like a physics bug and is not one.
 */
export function swapFluidBuffers(bufs: FluidComputeBuffers): void {
  const m = bufs.massRead;
  bufs.massRead = bufs.massWrite;
  bufs.massWrite = m;
  const v = bufs.velRead;
  bufs.velRead = bufs.velWrite;
  bufs.velWrite = v;
}

/**
 * Build a clear pass: zero every water buffer on the GPU.
 *
 * This exists because setting `needsUpdate` on a StorageBufferAttribute does
 * not reliably re-upload once the buffer lives GPU-side. Clearing where the
 * data lives is the one honest reset.
 */
export function buildClearStep(bufs: FluidComputeBuffers) {
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
  })().compute(bufs.massRead.count);
}

/**
 * Build the column-surface pass: reduce the 3D field to one water height per
 * (x, z) column, written into `surface` (n * n floats, layout z * n + x).
 *
 * This exists so the water can be DRAWN without reading 64 MB back to the
 * CPU. A heightfield mesh binds `surface` as a storage buffer and moves its
 * vertices in the vertex stage; the whole field never leaves the GPU. A dry
 * column writes -1000, which the mesh uses to sink hidden vertices.
 *
 * Bind it to the same massRead the display mesh uses — after a forward/back
 * step pair that buffer holds the freshest field.
 */
export function buildColumnSurfacePass(
  bufs: FluidComputeBuffers,
  surface: StorageBufferAttribute,
  /**
   * True water depth per column, in meters: the column's total mass times the
   * cell size. The display must shade from THIS, not from surface-minus-
   * terrain: the top wet cell sits anywhere in a 25 cm band above the true
   * ground, so a height difference is quantization noise that renders as
   * checkered mottling. Total mass is continuous and honest.
   */
  colDepth: StorageBufferAttribute,
  baseYM: number,
  cellM: number,
  // A column shows as water only above this fill fraction. The physics DRY
  // threshold (0.0035) is far below anything an eye should see: a spreading
  // millimeter film would read as an ocean.
  displayMin = 0.25,
) {
  const n = bufs.n;
  const mass = storage(bufs.massRead, 'float', bufs.massRead.count).toReadOnly();
  const out = storage(surface, 'float', surface.count);
  const outDepth = storage(colDepth, 'float', colDepth.count);
  const N = int(n);

  return Fn(() => {
    const col = int(instanceIndex);
    const x = modInt(col, N);
    const z = col.div(N);
    const topY = float(-1).toVar();
    const topM = float(0).toVar();
    const total = float(0).toVar();
    Loop(int(n), ({ i }: { i: IntNode }) => {
      const m = mass.element(int(i).mul(N).add(z).mul(N).add(x));
      total.addAssign(m);
      const wet = m.greaterThan(float(displayMin));
      topY.assign(select(wet, float(int(i)), topY));
      topM.assign(select(wet, m, topM));
    });
    // Surface sits at the top wet cell plus its fill fraction, in meters.
    const h = float(baseYM).add(topY.add(topM.clamp(float(0), float(1))).mul(float(cellM)));
    out.element(col).assign(select(topY.greaterThanEqual(float(0)), h, float(-1000)));
    outDepth.element(col).assign(total.mul(float(cellM)));
  })().compute(n * n);
}

/**
 * Build a smoothing pass over the column surface.
 *
 * The raw surface quantizes to 25 cm cells and reads as stair steps — the
 * accepted resolution limit, but the eye should not pay it on a FLAT pond.
 * One weighted average with the wet neighbors melts the steps and leaves the
 * shoreline where it was: a dry column stays dry, and a wet column never
 * averages with a dry one, so the pool edge cannot bleed outward.
 */
export function buildSurfaceSmoothPass(
  surface: StorageBufferAttribute,
  smoothed: StorageBufferAttribute,
  n: number,
) {
  const src = storage(surface, 'float', surface.count).toReadOnly();
  const out = storage(smoothed, 'float', smoothed.count);
  const N = int(n);
  const Nm1 = int(n - 1);

  return Fn(() => {
    const col = int(instanceIndex);
    const x = modInt(col, N);
    const z = col.div(N);
    const self = src.element(col).toVar();

    const sum = self.mul(float(2)).toVar();
    const weight = float(2).toVar();
    const tap = (sx: IntNode, sz: IntNode) => {
      const cx = sx.clamp(int(0), Nm1);
      const cz = sz.clamp(int(0), Nm1);
      const v = src.element(cz.mul(N).add(cx));
      const wet = select(v.greaterThan(float(-999)), float(1), float(0));
      sum.addAssign(v.mul(wet));
      weight.addAssign(wet);
    };
    tap(x.sub(int(1)), z);
    tap(x.add(int(1)), z);
    tap(x, z.sub(int(1)));
    tap(x, z.add(int(1)));

    const smoothedH = sum.div(weight);
    out.element(col).assign(select(self.greaterThan(float(-999)), smoothedH, self));
  })().compute(n * n);
}

/** Mark solid cells from a callback. Run once when a bubble is built. */
export function fillSolidFromVolume(
  bufs: FluidComputeBuffers,
  isSolid: (x: number, y: number, z: number) => boolean,
): void {
  const n = bufs.n;
  const arr = bufs.solid.array as Float32Array;
  for (let y = 0; y < n; y++) {
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        arr[(y * n + z) * n + x] = isSolid(x, y, z) ? 1 : 0;
      }
    }
  }
  bufs.solid.needsUpdate = true;
}
