/**
 * @file coarseWater.ts — where water goes when it leaves the detailed grid.
 *
 * THE PROBLEM THIS EXISTS FOR
 *
 * `ShallowWaterField` records what runs off its edge in `boundaryLedgerM3`.
 * Until something owns that number, it is a receipt for water that no longer
 * exists anywhere. The research put the fault plainly: an exterior that is
 * merely "a level" is an INFINITE RESERVOIR. Water entering it vanishes and
 * water leaving it appears, so a world with one cannot claim to conserve mass
 * however careful the interior solver is.
 *
 * So the exterior owns volume. It does not need waves, velocity detail or a
 * pretty surface — the player is not there. It needs to be able to say how much
 * water a region holds, and to give that water back when the player returns.
 *
 * WHY IT IS COARSE
 *
 * A detailed grid at 25 cm over a continent is impossible and pointless. This
 * store uses cells tens of meters across and keeps only volume and a slow
 * discharge. A dam breached and abandoned keeps draining downstream at this
 * resolution; the player who walks back finds the basin emptied and the valley
 * below it wet, which is the fact that matters. The spray is gone, and nobody
 * misses it.
 *
 * SPARSE, BECAUSE MOST OF A WORLD IS DRY
 *
 * Cells exist only where water has been. A continent of empty map costs nothing.
 *
 * CONSERVATION IS STILL THE INVARIANT
 *
 * Every transfer in this file is a MOVE, never a copy and never a clamp.
 * `totalVolumeM3` across the store plus the detailed field must not drift, and
 * the tests check exactly that across a full round trip.
 */

/** One coarse cell's state. Volume, not depth — the bed here is unknown. */
export interface CoarseCell {
  /** Water held, cubic meters. */
  volumeM3: number;
  /** Slow horizontal discharge, cubic meters per second, x and z. */
  dischargeX: number;
  dischargeZ: number;
  /**
   * Volume too small to place when handing back, cubic meters.
   *
   * A promotion that spreads 7 m3 over 3 cells leaves a remainder. Dropping it
   * is a leak that only shows up after a thousand handoffs, so it is kept here
   * and handed over on the next transfer.
   */
  residualM3: number;
}

export interface CoarseWaterOptions {
  /** Cell size in world meters. Tens of meters is the intended scale. */
  cellM?: number;
  /** How fast a cell sheds water to a lower neighbor, per second. */
  drainRate?: number;
}

/**
 * Coarse, sparse, volume-owning water outside the detailed grid.
 *
 * Coordinates are world meters. The store converts them to its own cells, so a
 * caller never has to know the resolution.
 */
export class CoarseWaterStore {
  readonly cellM: number;
  private readonly drainRate: number;
  private readonly cells = new Map<string, CoarseCell>();
  /**
   * Bed elevation per coarse cell, world meters. Optional and lazily filled.
   * Without it the store still conserves; it just cannot decide which way is
   * downhill, so it holds water in place instead of routing it.
   */
  private readonly beds = new Map<string, number>();

  constructor(opts: CoarseWaterOptions = {}) {
    this.cellM = opts.cellM ?? 32;
    this.drainRate = opts.drainRate ?? 0.15;
  }

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  /** Coarse cell coordinate containing a world point. */
  cellOf(xM: number, zM: number): [number, number] {
    return [Math.floor(xM / this.cellM), Math.floor(zM / this.cellM)];
  }

  /** Read a cell without creating it. */
  peek(cx: number, cz: number): CoarseCell | undefined {
    return this.cells.get(this.key(cx, cz));
  }

  private ensure(cx: number, cz: number): CoarseCell {
    const k = this.key(cx, cz);
    let c = this.cells.get(k);
    if (!c) {
      c = { volumeM3: 0, dischargeX: 0, dischargeZ: 0, residualM3: 0 };
      this.cells.set(k, c);
    }
    return c;
  }

  /** Tell the store how high the ground is in a cell, so it can route water. */
  setBed(cx: number, cz: number, bedY: number): void {
    this.beds.set(this.key(cx, cz), bedY);
  }

  bedOf(cx: number, cz: number): number | undefined {
    return this.beds.get(this.key(cx, cz));
  }

  /** Every drop the store holds, including residuals. */
  totalVolumeM3(): number {
    let v = 0;
    for (const c of this.cells.values()) v += c.volumeM3 + c.residualM3;
    return v;
  }

  /** Cells currently holding water. */
  wetCellCount(): number {
    let n = 0;
    for (const c of this.cells.values()) if (c.volumeM3 > 1e-9) n++;
    return n;
  }

  /**
   * Take water that left a detailed grid.
   *
   * This is the other half of `ShallowWaterField.boundaryLedgerM3`. Call it
   * with the ledger and then reset the ledger, or the same water is banked
   * twice — which is why `drainLedger` below exists and should be preferred.
   */
  deposit(xM: number, zM: number, volumeM3: number, vx = 0, vz = 0): void {
    if (volumeM3 <= 0) return;
    const [cx, cz] = this.cellOf(xM, zM);
    const c = this.ensure(cx, cz);
    c.volumeM3 += volumeM3;
    c.dischargeX += vx;
    c.dischargeZ += vz;
  }

  /**
   * Move a field's whole boundary ledger into the store, and clear it.
   *
   * One call, so the ledger cannot be banked twice or forgotten. The deposit
   * lands at the field's center because the field itself does not record WHERE
   * along its edge each drop left. That is a deliberate simplification: at
   * tens of meters per coarse cell, the difference is under one cell for a
   * detailed grid of the shipped size.
   */
  drainLedger(field: { boundaryLedgerM3: number }, fieldCenterXM: number, fieldCenterZM: number): number {
    const moved = field.boundaryLedgerM3;
    if (moved <= 0) return 0;
    this.deposit(fieldCenterXM, fieldCenterZM, moved);
    field.boundaryLedgerM3 = 0;
    return moved;
  }

  /**
   * Advance the coarse world by dt seconds.
   *
   * Water moves to the lowest wet-or-known neighbor, at a rate set by
   * `drainRate` rather than by any wave physics. This is not a solver and does
   * not pretend to be. It exists so a breached dam a kilometer away keeps
   * emptying while nobody watches, and so the valley below it is wet when
   * somebody arrives.
   *
   * Conservative by construction: every cell's outflow is subtracted before it
   * is added to a neighbor, and a cell can never send more than it holds.
   */
  step(dt: number): void {
    if (this.cells.size === 0) return;
    const moves: Array<[string, string, number]> = [];

    for (const [k, c] of this.cells) {
      if (c.volumeM3 <= 1e-9) continue;
      const bed = this.beds.get(k);
      if (bed === undefined) continue; // nowhere known to send it
      const [cxs, czs] = k.split(',');
      const cx = Number(cxs);
      const cz = Number(czs);

      // Lowest known neighbor.
      let bestKey: string | null = null;
      let bestBed = bed;
      for (const [dx, dz] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nk = this.key(cx + dx, cz + dz);
        const nb = this.beds.get(nk);
        if (nb === undefined) continue;
        if (nb < bestBed) {
          bestBed = nb;
          bestKey = nk;
        }
      }
      if (!bestKey) continue;

      const move = Math.min(c.volumeM3, c.volumeM3 * this.drainRate * dt);
      if (move > 1e-9) moves.push([k, bestKey, move]);
    }

    for (const [from, to, amount] of moves) {
      const a = this.cells.get(from)!;
      const b = this.ensure(...(to.split(',').map(Number) as [number, number]));
      a.volumeM3 -= amount;
      b.volumeM3 += amount;
    }
  }

  /**
   * Hand water back to a detailed field that has just covered this ground.
   *
   * Volume is distributed by CAPACITY rather than evenly: a cell whose bed sits
   * low takes more, because that is where water would actually be. A flat
   * spread would put water on hilltops and let it run off again, which looks
   * like a leak and is really a bad handoff.
   *
   * Whatever cannot be placed stays in the coarse cell's residual. Nothing is
   * invented and nothing is dropped.
   */
  promoteInto(
    field: {
      n: number;
      cellM: number;
      bed: Float32Array;
      depth: Float32Array;
      idx(x: number, z: number): number;
    },
    fieldOriginXM: number,
    fieldOriginZM: number,
  ): number {
    // Which coarse cells overlap the field.
    const spanM = field.n * field.cellM;
    const [cx0, cz0] = this.cellOf(fieldOriginXM, fieldOriginZM);
    const [cx1, cz1] = this.cellOf(fieldOriginXM + spanM, fieldOriginZM + spanM);

    let placed = 0;
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = this.cells.get(this.key(cx, cz));
        if (!c) continue;
        const available = c.volumeM3 + c.residualM3;
        if (available <= 1e-9) continue;

        // Field cells inside this coarse cell.
        const x0 = Math.max(0, Math.floor((cx * this.cellM - fieldOriginXM) / field.cellM));
        const x1 = Math.min(field.n - 1, Math.ceil(((cx + 1) * this.cellM - fieldOriginXM) / field.cellM));
        const z0 = Math.max(0, Math.floor((cz * this.cellM - fieldOriginZM) / field.cellM));
        const z1 = Math.min(field.n - 1, Math.ceil(((cz + 1) * this.cellM - fieldOriginZM) / field.cellM));
        if (x1 < x0 || z1 < z0) continue;

        // Rank by bed height. Lowest ground fills first.
        const targets: Array<{ i: number; bed: number }> = [];
        for (let z = z0; z <= z1; z++) {
          for (let x = x0; x <= x1; x++) {
            const i = field.idx(x, z);
            targets.push({ i, bed: field.bed[i] });
          }
        }
        if (targets.length === 0) continue;
        targets.sort((a, b) => a.bed - b.bed);

        /* Fill low ground first, up to the level the volume can reach.
         *
         * Walk the sorted beds and raise a common surface until the volume runs
         * out. That is the same shape as pouring water into a basin, and it is
         * why the handoff does not leave puddles on ridges. */
        const cellArea = field.cellM * field.cellM;
        let remaining = available;
        let surface = targets[0].bed;
        let filled = 0;
        for (let k = 0; k < targets.length && remaining > 0; k++) {
          const nextBed = k + 1 < targets.length ? targets[k + 1].bed : Infinity;
          filled = k + 1;
          const rise = Math.min(nextBed - surface, remaining / (filled * cellArea));
          surface += rise;
          remaining -= rise * filled * cellArea;
          if (rise < nextBed - surface) break;
        }
        for (let k = 0; k < filled; k++) {
          const t = targets[k];
          const d = Math.max(0, surface - t.bed);
          if (d > 0) {
            field.depth[t.i] += d;
            placed += d * cellArea;
          }
        }

        // Whatever could not be placed stays banked, never discarded.
        const leftover = available - placed > 0 ? available - (placed) : 0;
        c.volumeM3 = 0;
        c.residualM3 = Math.max(0, leftover);
      }
    }
    return placed;
  }

  /**
   * Take a detailed field's water back into the store and empty the field.
   *
   * Used when the bubble moves away from ground it was simulating. Volume is
   * summed per coarse cell so the exterior inherits the right distribution
   * rather than one lump at the center.
   */
  demoteFrom(
    field: {
      n: number;
      cellM: number;
      bed: Float32Array;
      depth: Float32Array;
      idx(x: number, z: number): number;
    },
    fieldOriginXM: number,
    fieldOriginZM: number,
  ): number {
    const cellArea = field.cellM * field.cellM;
    let taken = 0;
    for (let z = 0; z < field.n; z++) {
      for (let x = 0; x < field.n; x++) {
        const i = field.idx(x, z);
        const d = field.depth[i];
        if (d <= 0) continue;
        const wx = fieldOriginXM + x * field.cellM;
        const wz = fieldOriginZM + z * field.cellM;
        const [cx, cz] = this.cellOf(wx, wz);
        const c = this.ensure(cx, cz);
        c.volumeM3 += d * cellArea;
        // Carry the bed too, so the coarse store knows which way is downhill.
        if (!this.beds.has(this.key(cx, cz))) this.setBed(cx, cz, field.bed[i]);
        taken += d * cellArea;
        field.depth[i] = 0;
      }
    }
    return taken;
  }
}
