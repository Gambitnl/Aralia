/**
 * @file fluidGather.ts — the gather-form fluid step, as plain TypeScript.
 *
 * WHY A SECOND FORMULATION EXISTS
 *
 * The first GPU kernel scatter-wrote: cell i pushed mass into its neighbors
 * with `out[neighbor] += flow`. On a GPU every cell runs at once, so two cells
 * that push into the same neighbor race, one write lands and one is lost, and
 * the field silently loses water. The double buffer prevents torn READS; it
 * does nothing about concurrent WRITES. Atomics would fix it but WGSL has no
 * float atomics.
 *
 * The standard fix is to GATHER. Each cell computes, deterministically and
 * from the read buffers alone, the outflow of every cell around it. Then it
 * sums what flows in, subtracts what flows out, and writes ONLY ITSELF. No two
 * invocations ever write the same address, so there is nothing to race. The
 * cost is arithmetic: the flow function runs seven times per cell (self plus
 * six neighbors) instead of once. On a GPU that trade is almost free; lost
 * mass is not.
 *
 * WHY THIS FILE HAS NO THREE.JS IN IT
 *
 * This is the reference the GPU kernel must match and the tests can run. It
 * imports nothing, so vitest exercises it without a GPU: conservation, water
 * falls, water levels. fluidCompute.ts mirrors this arithmetic node for node,
 * masks instead of branches, and any divergence between the two is a bug in
 * the mirror, not a judgment call.
 *
 * ONE DELIBERATE CHANGE FROM THE SCATTER SOLVER
 *
 * The scatter solver leveled sideways in a fixed neighbor order, updating its
 * remaining mass between neighbors. Order-dependence is fine sequentially and
 * poison in a gather: the neighbor recomputing my outflow must reproduce it
 * bit for bit, so every input has to come from the read buffer. The gather
 * form computes all four side flows from the same remaining mass, then scales
 * them down together if they oversubscribe it. Same behavior at the eyeball
 * level, order-free by construction.
 */

/** Below this a cell is dry. */
export const DRY = 0.0035;
/** Fraction of a level difference resolved per step. */
export const RELAX = 0.52;
/** Gravity's pull on downward exchange, per step. */
export const GRAVITY = 0.42;
/** A cell may hold more than full. That excess IS the pressure. */
export const MAX_MASS = 1.06;
/** Velocity retained when new mass lands on a cell. Momentum lives here. */
export const DAMPING = 0.86;

/** Outflow of one cell along its six faces, in this fixed order. */
export interface CellFlows {
  down: number;
  xm: number;
  xp: number;
  zm: number;
  zp: number;
  up: number;
}

export interface GatherField {
  /** Cells per edge. */
  n: number;
  /** Water mass per cell, layout (y * n + z) * n + x. */
  mass: Float32Array;
  /** Vertical velocity per cell. */
  vel: Float32Array;
  /** 1 where solid blocks water, 0 where it does not. */
  solid: Float32Array;
}

/**
 * The pure flow function. Everything reads from the field; nothing writes.
 *
 * Out-of-bounds counts as solid, so the bubble wall holds water. The GPU
 * kernel mirrors each line of this with mask arithmetic instead of branches.
 */
export function cellFlows(f: GatherField, x: number, y: number, z: number, out: CellFlows): void {
  const n = f.n;
  out.down = out.xm = out.xp = out.zm = out.zp = out.up = 0;
  if (x < 0 || y < 0 || z < 0 || x >= n || y >= n || z >= n) return;
  const i = (y * n + z) * n + x;
  if (f.solid[i] >= 0.5) return;
  const m = f.mass[i];
  if (m <= DRY) return;

  const open = (ox: number, oy: number, oz: number): number => {
    if (ox < 0 || oy < 0 || oz < 0 || ox >= n || oy >= n || oz >= n) return -1;
    const j = (oy * n + oz) * n + ox;
    return f.solid[j] >= 0.5 ? -1 : j;
  };

  // 1. DOWN. Gravity plus retained downward momentum.
  let down = 0;
  const below = open(x, y - 1, z);
  if (below >= 0) {
    const room = Math.max(0, MAX_MASS - f.mass[below]);
    const pull = GRAVITY + Math.max(0, -f.vel[i]) * 0.3;
    down = Math.min(m, room * pull);
  }
  const rem = m - down;

  // 2. SIDEWAYS. All four flows from the same remaining mass, then one shared
  // scale if they ask for more than the cell holds. Order-free on purpose —
  // see the file header.
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

  // 3. UP, only when over-full. That excess is pressure, and it is what lets
  // water climb the far wall of a channel instead of pooling against it.
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
 * Advance the whole field one step, gather-form.
 *
 * Writes results into `massOut` and `velOut`; never touches the read arrays.
 * O(n^3) with seven flow evaluations per cell — a test-sized field only. The
 * shipped path is the GPU mirror in fluidCompute.ts.
 */
export function stepGather(f: GatherField, massOut: Float32Array, velOut: Float32Array): void {
  const n = f.n;
  const self: CellFlows = { down: 0, xm: 0, xp: 0, zm: 0, zp: 0, up: 0 };
  const nb: CellFlows = { down: 0, xm: 0, xp: 0, zm: 0, zp: 0, up: 0 };
  for (let y = 0; y < n; y++) {
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = (y * n + z) * n + x;
        cellFlows(f, x, y, z, self);
        const totalOut = self.down + self.xm + self.xp + self.zm + self.zp + self.up;

        cellFlows(f, x, y + 1, z, nb);
        const downIn = nb.down;
        cellFlows(f, x, y - 1, z, nb);
        const upIn = nb.up;
        cellFlows(f, x - 1, y, z, nb);
        const fromXm = nb.xp;
        cellFlows(f, x + 1, y, z, nb);
        const fromXp = nb.xm;
        cellFlows(f, x, y, z - 1, nb);
        const fromZm = nb.zp;
        cellFlows(f, x, y, z + 1, nb);
        const fromZp = nb.zm;

        const inflow = downIn + upIn + fromXm + fromXp + fromZm + fromZp;
        massOut[i] = f.mass[i] - totalOut + inflow;

        // New mass landing from above damps the cell and drives it downward;
        // mass forced up from below pushes it upward. Branchless so the GPU
        // mirror is the same expression.
        const hasDownIn = downIn > 0 ? 1 : 0;
        velOut[i] = f.vel[i] * (1 - (1 - DAMPING) * hasDownIn) - downIn + upIn;
      }
    }
  }
}
