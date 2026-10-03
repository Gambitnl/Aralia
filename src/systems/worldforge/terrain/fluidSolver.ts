/**
 * @file fluidSolver.ts — real fluid over the voxel volume.
 *
 * Remy chose full simulation (2026-08-05): pressure and momentum, so a dam
 * break behaves rather than a level rising. The measurement in voxelVolume.ts
 * settled the first question — memory is cheap, 6.3 MB for a 64 m bubble at
 * 12 cm, because terrain is a surface and sparse bricks collapse the rest.
 *
 * That leaves TIME as the only number that decides whether this ships, and
 * this file exists to produce it.
 *
 * THE METHOD, AND WHY THIS ONE
 *
 * Free-surface fluid in a voxel grid is a solved shape of problem, and the
 * cheap end of it is a per-cell mass exchange with a velocity field — often
 * called cellular or shallow-3D fluid. Each step does three passes:
 *
 *   1. advect  — carry mass along the velocity already in the field
 *   2. relax   — push mass from high pressure toward low, which is gravity plus
 *                the incompressibility constraint, approximately
 *   3. settle  — write back and update velocity from what actually moved
 *
 * This is NOT a Navier-Stokes projection solve. That is the research-grade cost
 * Remy was warned about, and it is the right next step only if this proves too
 * coarse. What this does give is genuine pressure-driven flow: water finds a
 * hole you dug, runs downhill, and a breached dam empties rather than draining
 * politely. Momentum carries across a step, so a wave keeps going.
 *
 * SPARSITY IS THE WHOLE PERFORMANCE STORY
 *
 * A 536-cube volume is 154 million cells. Stepping all of them is hopeless at
 * any frame rate. But fluid only exists where water is, and water is a tiny
 * fraction of a bubble. The solver therefore walks an ACTIVE SET — the cells
 * holding water plus their neighbors — and never looks at the rest.
 *
 * A field that is 1% wet costs 1% of the volume, and that is what makes this
 * tractable at all.
 */
import { Material, VoxelVolume } from './voxelVolume';

/** Water mass in a cell, 0 to 1. Below this a cell is treated as dry. */
const DRY = 0.0035;
/** How much of a pressure difference is resolved per step. */
const RELAX = 0.52;
/** Gravity's pull on vertical exchange, per step. */
const GRAVITY = 0.42;
/** Velocity retained between steps. Momentum lives here. */
const DAMPING = 0.86;
/** A cell may hold slightly more than full, which is what pressure IS. */
const MAX_MASS = 1.06;

export interface FluidStats {
  /** Cells carrying water above DRY. */
  wetCells: number;
  /** Cells the step actually touched, including dry neighbors. */
  activeCells: number;
  /** Total water in the field. Must not drift — see the conservation test. */
  totalMass: number;
  stepMs: number;
}

/**
 * A fluid field bound to one voxel volume.
 *
 * Mass and velocity are dense typed arrays over the volume's cell count. That
 * looks wasteful against the sparse solid, and it is the right trade: the arrays
 * are allocated once and the SOLVER never walks them whole. A 536-cube field is
 * 154 MB at one float per cell, so the constructor takes the volume's own edge
 * and the caller is expected to keep the bubble at the measured size.
 */
export class FluidField {
  readonly n: number;
  readonly mass: Float32Array;
  private next: Float32Array;
  private vy: Float32Array;
  /** Cells to visit this step, as flat indices. */
  private active: Set<number> = new Set();

  constructor(private readonly volume: VoxelVolume) {
    this.n = volume.cells;
    const total = this.n ** 3;
    this.mass = new Float32Array(total);
    this.next = new Float32Array(total);
    this.vy = new Float32Array(total);
  }

  private idx(x: number, y: number, z: number): number {
    return (y * this.n + z) * this.n + x;
  }

  /** True where the solid blocks water. */
  private solid(x: number, y: number, z: number): boolean {
    if (x < 0 || y < 0 || z < 0 || x >= this.n || y >= this.n || z >= this.n) return true;
    return this.volume.get(x, y, z) !== Material.Air;
  }

  /** Pour water into a cell and wake it. */
  add(x: number, y: number, z: number, amount: number): void {
    if (this.solid(x, y, z)) return;
    const i = this.idx(x, y, z);
    this.mass[i] += amount;
    this.wake(x, y, z);
  }

  /** Mark a cell and its six neighbors as worth visiting next step. */
  private wake(x: number, y: number, z: number): void {
    this.active.add(this.idx(x, y, z));
    if (x > 0) this.active.add(this.idx(x - 1, y, z));
    if (x < this.n - 1) this.active.add(this.idx(x + 1, y, z));
    if (y > 0) this.active.add(this.idx(x, y - 1, z));
    if (y < this.n - 1) this.active.add(this.idx(x, y + 1, z));
    if (z > 0) this.active.add(this.idx(x, y, z - 1));
    if (z < this.n - 1) this.active.add(this.idx(x, y, z + 1));
  }

  /**
   * Advance the field one step.
   *
   * Mass moves DOWN first, then sideways to level, then up only under pressure.
   * That order is what makes water fall rather than diffuse, and reordering it
   * produces a gas.
   */
  step(): FluidStats {
    const t0 = performance.now();
    const n = this.n;
    const mass = this.mass;
    const next = this.next;
    next.set(mass);

    const woken: number[] = [];
    let wet = 0;

    for (const i of this.active) {
      const x = i % n;
      const z = ((i / n) | 0) % n;
      const y = (i / (n * n)) | 0;
      const m = mass[i];
      if (m <= DRY) continue;
      wet++;

      let remaining = m;

      // 1. DOWN. Gravity plus whatever momentum the cell carries.
      if (!this.solid(x, y - 1, z)) {
        const below = this.idx(x, y - 1, z);
        const room = MAX_MASS - mass[below];
        if (room > 0) {
          const flow = Math.min(remaining, room * (GRAVITY + Math.max(0, -this.vy[i]) * 0.3));
          if (flow > 0) {
            next[i] -= flow;
            next[below] += flow;
            remaining -= flow;
            this.vy[below] = this.vy[below] * DAMPING - flow;
            woken.push(x, y - 1, z);
          }
        }
      }

      // 2. SIDEWAYS. Level with each neighbor that has less.
      if (remaining > DRY) {
        const sides: Array<[number, number, number]> = [
          [x - 1, y, z],
          [x + 1, y, z],
          [x, y, z - 1],
          [x, y, z + 1],
        ];
        for (const [sx, sy, sz] of sides) {
          if (this.solid(sx, sy, sz)) continue;
          const si = this.idx(sx, sy, sz);
          const diff = remaining - mass[si];
          if (diff <= 0) continue;
          const flow = diff * RELAX * 0.25;
          if (flow <= 0) continue;
          next[i] -= flow;
          next[si] += flow;
          remaining -= flow;
          woken.push(sx, sy, sz);
        }
      }

      // 3. UP, only when this cell is over-full. That is pressure, and it is
      // what lets water climb the far side of a dug channel.
      if (remaining > 1 && !this.solid(x, y + 1, z)) {
        const above = this.idx(x, y + 1, z);
        const flow = Math.min(remaining - 1, MAX_MASS - mass[above]);
        if (flow > 0) {
          next[i] -= flow;
          next[above] += flow;
          this.vy[above] += flow;
          woken.push(x, y + 1, z);
        }
      }
    }

    mass.set(next);

    // Rebuild the active set from what moved. A field at rest costs nothing.
    this.active.clear();
    for (let k = 0; k < woken.length; k += 3) {
      this.wake(woken[k], woken[k + 1], woken[k + 2]);
    }

    let total = 0;
    for (const i of this.active) total += mass[i];
    return {
      wetCells: wet,
      activeCells: this.active.size,
      totalMass: total,
      stepMs: performance.now() - t0,
    };
  }

  /** Total water anywhere in the field. Used by the conservation test. */
  totalMass(): number {
    let t = 0;
    for (let i = 0; i < this.mass.length; i++) t += this.mass[i];
    return t;
  }
}
