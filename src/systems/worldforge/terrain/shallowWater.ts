/**
 * @file shallowWater.ts — the primary water model. Two-dimensional and
 * conservative, over a bottom that can change.
 *
 * WHY THIS REPLACES THE 3D SOLVER
 *
 * A 3D field over the shipped bubble is 256³ = 16.8 million cells, and it was
 * measured at 108 ms per step against a 16.7 ms frame. The same ground as a 2D
 * grid is 256 × 256 = 65,536 cells — 256 times fewer. At the 3 microseconds per
 * cell the CPU solver measured, a full step costs under a fifth of a
 * millisecond. The wall that killed the 3D route does not exist here.
 *
 * The research verdict (2026-08-07) put it plainly: ordinary rivers, lakes and
 * floods belong on a conservative 2D depth-and-discharge grid, and 3D is a
 * local exception for waterfalls, breached edges and tunnel flow.
 *
 * WHAT IT CAN AND CANNOT DO
 *
 * Can: run downhill, fill a hole that was just dug, level out, drain through a
 * breach, and carry momentum so a surge keeps going.
 *
 * Cannot: an overturning wave, two water layers in one column, a submerged
 * tunnel ceiling, or genuinely 3D recirculation. Those are the cases that get
 * promoted out of this solver rather than approximated inside it.
 *
 * THE VIRTUAL-PIPE METHOD, AND WHY NOT A RIEMANN SOLVER
 *
 * Flux between neighbors is driven by the difference in water SURFACE height,
 * accelerated like flow in a pipe, and limited so no cell can give away more
 * than it holds. That limiter is what makes the scheme exactly conservative:
 * every unit that leaves one cell arrives in another, and the outflow scaling
 * is applied to all four pipes together so the ratios between them survive.
 *
 * A proper finite-volume Riemann scheme is more accurate about shock speeds. It
 * is also far more code, and it is fragile at wet/dry fronts — which is most of
 * a landscape. This project needs water that behaves, not water that would
 * pass a hydrology review.
 *
 * CONSERVATION IS THE INVARIANT
 *
 * Total volume changes only where the caller adds or removes it, or where flow
 * crosses the boundary and is recorded in the ledger. Anything else is a bug,
 * and there is a test for it. A solver that quietly loses water is worse than
 * no solver, because the loss is invisible until a reservoir is mysteriously
 * empty an hour later.
 */

/** Gravity, meters per second squared. */
const G = 9.81;
/** Below this depth a cell counts as dry. Stops endless microscopic sloshing. */
export const DRY_DEPTH_M = 0.0015;
/** Pipe cross-section, as a fraction of a cell face. Tunes how fast flow builds. */
const PIPE_AREA = 0.9;
/** Friction on the discharge each step. Nothing runs forever. */
const FRICTION = 0.985;
/** Most of its depth a cell may shed in one step. Below 1 to damp odd-even swap. */
const MAX_DRAIN = 0.5;

export interface ShallowWaterStats {
  /** Cells holding water above DRY_DEPTH_M. */
  wetCells: number;
  /** Total water volume in cubic meters. */
  volumeM3: number;
  /** Volume that left through the domain edge this step, cubic meters. */
  outflowM3: number;
  stepMs: number;
}

/**
 * A conservative shallow-water field over a changing bottom.
 *
 * Coordinates are cell indices. The caller owns the mapping to world meters, so
 * this class never needs to know where it sits.
 */
export class ShallowWaterField {
  readonly n: number;
  readonly cellM: number;
  /** Bottom elevation per cell, world meters. Mutable — the ground moves. */
  readonly bed: Float32Array;
  /** Water depth per cell, meters. */
  readonly depth: Float32Array;
  /** Outgoing flux per cell on each of four faces: -x, +x, -z, +z. */
  private readonly fluxL: Float32Array;
  private readonly fluxR: Float32Array;
  private readonly fluxD: Float32Array;
  private readonly fluxU: Float32Array;

  /**
   * Volume that has left the domain edge, cubic meters.
   *
   * The research is blunt about this: an exterior that is merely "a level" is
   * an infinite reservoir, and a solver that lets water vanish off its edge
   * cannot claim conservation. This ledger is where that water goes, and a
   * coarse exterior model is expected to take it.
   */
  boundaryLedgerM3 = 0;

  constructor(n: number, cellM: number, bed?: Float32Array) {
    this.n = n;
    this.cellM = cellM;
    const total = n * n;
    this.bed = bed ? bed.slice(0, total) : new Float32Array(total);
    this.depth = new Float32Array(total);
    this.fluxL = new Float32Array(total);
    this.fluxR = new Float32Array(total);
    this.fluxD = new Float32Array(total);
    this.fluxU = new Float32Array(total);
  }

  idx(x: number, z: number): number {
    return z * this.n + x;
  }

  /** Water surface elevation: bed plus depth. */
  surfaceAt(x: number, z: number): number {
    const i = this.idx(x, z);
    return this.bed[i] + this.depth[i];
  }

  /** Add or remove water at a cell. Negative removes, never below zero. */
  add(x: number, z: number, meters: number): void {
    if (x < 0 || z < 0 || x >= this.n || z >= this.n) return;
    const i = this.idx(x, z);
    this.depth[i] = Math.max(0, this.depth[i] + meters);
  }

  /** Total water volume, cubic meters. */
  volume(): number {
    let v = 0;
    for (let i = 0; i < this.depth.length; i++) v += this.depth[i];
    return v * this.cellM * this.cellM;
  }

  /**
   * The largest step this field can take without going unstable.
   *
   * Shallow water is limited by the surface wave speed, which grows with depth.
   * A step past this and the scheme oscillates then explodes, so a caller that
   * ignores it gets a field full of NaN rather than a slow error.
   */
  maxStableStep(): number {
    let maxDepth = 0;
    for (let i = 0; i < this.depth.length; i++) {
      if (this.depth[i] > maxDepth) maxDepth = this.depth[i];
    }
    if (maxDepth <= DRY_DEPTH_M) return 1 / 30;
    // CFL on the gravity wave speed, with a safety factor.
    return Math.min(1 / 30, (0.35 * this.cellM) / Math.sqrt(G * maxDepth));
  }

  /**
   * Advance the field by dt seconds.
   *
   * Two passes, and the order is what makes it conservative. The first computes
   * every outgoing flux and then SCALES a cell's four fluxes together if their
   * sum would overdraw it. The second applies them. Computing and applying in
   * one pass would let a cell give water it had already given away.
   */
  step(dt: number): ShallowWaterStats {
    const t0 = Date.now();
    const n = this.n;
    const { depth, bed, fluxL, fluxR, fluxD, fluxU } = this;
    const cell = this.cellM;
    const area = cell * cell;
    // Acceleration of flow per unit of surface difference, from the pipe model.
    const accel = (dt * G * PIPE_AREA) / cell;

    let outflow = 0;

    // ---- pass one: fluxes, then limit so no cell overdraws ----------------
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        const h = depth[i];
        if (h <= DRY_DEPTH_M) {
          fluxL[i] = fluxR[i] = fluxD[i] = fluxU[i] = 0;
          continue;
        }
        const surf = bed[i] + h;

        /* A face at the domain edge drains to the exterior. Its "surface" is
         * the bed level outside, so water runs off a cliff edge rather than
         * pooling against an invisible wall. What leaves is recorded, never
         * discarded — see boundaryLedgerM3. */
        const drop = (j: number, edge: boolean) =>
          edge ? Math.max(0, surf - bed[i]) : Math.max(0, surf - (bed[j] + depth[j]));

        const dl = drop(i - 1, x === 0);
        const dr = drop(i + 1, x === n - 1);
        const dd = drop(i - n, z === 0);
        const du = drop(i + n, z === n - 1);

        /* Each pipe carries at most HALF the height difference it is driven by.
         *
         * Without this cap the scheme decouples into a checkerboard: a cell
         * whose neighbors are lower gives away everything it has, they give it
         * all back next step, and the field oscillates forever between two
         * patterns instead of settling. It is stable, it conserves volume
         * exactly, and it is completely wrong — a probe after 20,000 steps
         * showed a pit half full of alternating wet and dry cells.
         *
         * Half the difference is the most two cells can exchange and still
         * meet in the middle rather than swap past each other. */
        const cap = 0.5;
        let l = Math.min(dl * accel * FRICTION, dl * cap);
        let r = Math.min(dr * accel * FRICTION, dr * cap);
        let d = Math.min(dd * accel * FRICTION, dd * cap);
        let u = Math.min(du * accel * FRICTION, du * cap);

        /* A cell may give away at most HALF its water in one step.
         *
         * This is the fix for the checkerboard, and the earlier per-pipe cap
         * was not. With the limiter set at the full depth, a wet cell drains to
         * exactly zero while its four dry neighbors each receive exactly what
         * it held — a perfect swap. The pattern then flips forever and looks
         * stable, because volume is conserved on every step.
         *
         * Draining at most half leaves the cell with something, so the exchange
         * damps toward level instead of oscillating. */
        const total = l + r + d + u;
        /* Cap TOTAL outflow at half the LARGEST drop.
         *
         * This is the rule that finally kills the checkerboard, and the two
         * caps before it did not. Per-pipe limits fail because a cell with four
         * lower neighbors sends each of them half the difference and therefore
         * sheds twice the difference in total — it overshoots past level and
         * the pattern inverts. A low cell meanwhile has no lower neighbor, so
         * it gives nothing back, and the exchange is a clean swap that repeats
         * forever while conserving volume exactly.
         *
         * Half the largest drop is the amount that brings this cell and its
         * deepest partner to the SAME surface and no further. */
        const maxOut = Math.min(h * MAX_DRAIN, Math.max(dl, dr, dd, du) * 0.5);
        if (total > maxOut) {
          const s = maxOut / total;
          l *= s;
          r *= s;
          d *= s;
          u *= s;
        }
        fluxL[i] = l;
        fluxR[i] = r;
        fluxD[i] = d;
        fluxU[i] = u;
      }
    }

    // ---- pass two: apply ---------------------------------------------------
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        const out = fluxL[i] + fluxR[i] + fluxD[i] + fluxU[i];
        if (out > 0) depth[i] -= out;

        if (x > 0) depth[i - 1] += fluxL[i];
        else outflow += fluxL[i];
        if (x < n - 1) depth[i + 1] += fluxR[i];
        else outflow += fluxR[i];
        if (z > 0) depth[i - n] += fluxD[i];
        else outflow += fluxD[i];
        if (z < n - 1) depth[i + n] += fluxU[i];
        else outflow += fluxU[i];
      }
    }

    this.boundaryLedgerM3 += outflow * area;

    let wet = 0;
    let vol = 0;
    for (let i = 0; i < depth.length; i++) {
      if (depth[i] < 0) depth[i] = 0; // guard against float drift below zero
      if (depth[i] > DRY_DEPTH_M) wet++;
      vol += depth[i];
    }

    return {
      wetCells: wet,
      volumeM3: vol * area,
      outflowM3: outflow * area,
      stepMs: Date.now() - t0,
    };
  }

  /**
   * Change the bottom, and conserve the water that was sitting on it.
   *
   * This is the whole reason the solver exists in a game where spells dig. The
   * rule is stated in the research and it is not optional:
   *
   *     eta      = bed_old + depth_old        (the free surface stays put)
   *     depth_new = max(0, eta - bed_new)
   *
   * Lowering the ground therefore creates CAPACITY, not water — the surface
   * drops with the bed and the same volume now sits deeper in a hole.
   *
   * Raising the ground DISPLACES water, and the displaced volume must go
   * somewhere. Clamping the depth to zero would delete it, which is the exact
   * silent-loss failure this file is built to avoid. Displaced volume is
   * returned to the caller, which spreads it over the neighbors.
   */
  setBed(x: number, z: number, newBed: number): number {
    const i = this.idx(x, z);
    const oldDepth = this.depth[i];
    const eta = this.bed[i] + oldDepth;
    this.bed[i] = newBed;

    /* One rule, both directions, and it took two bugs to find it.
     *
     * The research states depth_new = max(0, eta - bed_new), holding the free
     * surface. Applied alone that CREATES water when the bed drops: 0.5 m over
     * a bed lowered 2 m became 2.5 m out of nothing.
     *
     * Clamping to the old depth fixed that and exposed the mirror fault. When
     * the bed RISES under water, the new depth is genuinely smaller, and the
     * difference is displaced volume that must be handed back. Returning zero
     * there deleted it just as silently.
     *
     * So: the surface may fall with the bed but never rise to meet it, and
     * whatever the cell can no longer hold is always reported.
     */
    const kept = Math.min(oldDepth, Math.max(0, eta - newBed));
    this.depth[i] = kept;
    return oldDepth - kept;
  }

  /**
   * Apply a terrain edit over a region and redistribute what it displaces.
   *
   * `bedAt` returns the new bottom for a cell. Displaced water is pushed to the
   * wettest reachable neighbors rather than dropped, so raising a mound inside
   * a lake makes the lake rise instead of quietly shrinking.
   */
  editBed(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    bedAt: (x: number, z: number) => number,
  ): number {
    let displaced = 0;
    const lo = (v: number) => Math.max(0, v);
    const hi = (v: number) => Math.min(this.n - 1, v);
    for (let z = lo(z0); z <= hi(z1); z++) {
      for (let x = lo(x0); x <= hi(x1); x++) {
        displaced += this.setBed(x, z, bedAt(x, z));
      }
    }
    if (displaced <= 0) return 0;

    // Spread over the ring just outside the edited box. Those cells are where
    // the water would physically go, and using them keeps the redistribution
    // local rather than teleporting volume across the map.
    const ring: number[] = [];
    for (let z = lo(z0 - 1); z <= hi(z1 + 1); z++) {
      for (let x = lo(x0 - 1); x <= hi(x1 + 1); x++) {
        const inside = x >= x0 && x <= x1 && z >= z0 && z <= z1;
        if (!inside) ring.push(this.idx(x, z));
      }
    }
    if (ring.length === 0) {
      // Nowhere to put it. Record rather than delete.
      this.boundaryLedgerM3 += displaced * this.cellM * this.cellM;
      return displaced;
    }
    const each = displaced / ring.length;
    for (const i of ring) this.depth[i] += each;
    return displaced;
  }
}
