/**
 * @file oceanMouthField.ts
 * Owns the river mouth grid, bank soil and conservation ledger.
 * These intact classes keep their original state, flux order and fixed-step rules.
 * oceanMouthMath still exposes the same constructors; this move changes no solver law.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:09:29
 * Dependents: systems/world3d/ocean/oceanMouthMath.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SoilTables, BEACH_SAND, SKIN_M, DEEP_M, equilibriumSaturation, BEACH_SWASH, type IncidentFn, type SwashGridSpec, HLL_OUT, G, hllFaceInto } from './oceanBeachMath';


/* ------------------------------------------------------------------ */
/* The near field                                                        */
/* ------------------------------------------------------------------ */

export interface MouthLedger {
  /** River water in at the head, m^3. */
  riverIn: number;
  /** Water in and out across the sea edge, m^3 (both positive). */
  seaIn: number;
  seaOut: number;
  /** Water added by clipping a depth under zero, m^3 (0 under the step's bound). */
  clipped: number;
  /** Water out across the side edges on land, m^3 (round 2; the side edges' outflow). */
  sideOut: number;
  /** River water out across the side edges, m^3. */
  tracerSideOut: number;
  /** River water (the tracer) out across the sea edge, m^3. */
  tracerOut: number;
  /**
   * ROUND 5 (GG-394): water the bank's sand took in (the beach's Green-Ampt
   * intake), m^3, and the river water in it. Present when the grid has a soil.
   */
  soaked?: number;
  tracerSoaked?: number;
  tracerIn: number;
  /**
   * River water the share's bounds (0 to the cell's water) took off (+) or
   * put on (-), m^3: a drying cell's last film. Booked, so the tracer's
   * ledger closes to rounding with it.
   */
  tracerClipped: number;
}

/** Depth under which a cell is dry, m (the beach's 0.1 mm film). */
export const MOUTH_H_DRY = 1e-4;

/**
 * THE BANKS' SAND (river mouth round 5, GG-394; the judge of round 4: "the
 * sand spits are flat tan polygons with hard clean edges: no wet-sand
 * darkening, swash film or foam"; \`mouth4/shots/f4-mouth-bank.png\`: the pond).
 * The mouth's grid carried water over its banks with no sand under it: the
 * swash and the overtopping that ran up the banks stood there as a pond of a
 * few centimeters for good, and the sea's one surface drew it as a hard-edged
 * mirror beside the beach's own sheet, whose water soaks into its sand. One
 * coast has one sand: the mouth's land cells now carry the beach's soil, by
 * the beach's own laws and numbers (\`oceanBeachMath.ts\`: BEACH_SAND, Rawls et
 * al. 1982; two stores, the 1 cm skin and the 30 cm under it; Green and
 * Ampt's intake at the skin, Ks (1 + (h + psi_f (1 - Se)) / (skin / 2));
 * Brooks and Corey's drainage to the water table; the beach's slow update
 * every BEACH_SWASH.slowEvery steps). The water table is the beach's law
 * about the water beside the bank (\`mouthWaterTable\`). The skin's saturation
 * and the time since the water left are what the beach's look reads for its
 * wet band (the pack's D texture). The ledger books the intake (\`soaked\`),
 * so it still closes.
 */
export class MouthSoil {
  readonly cap1: Float64Array;
  readonly cap2: Float64Array;
  readonly zc2: Float64Array;
  readonly zc1: Float64Array;
  w1: Float64Array;
  w2: Float64Array;
  /** The intake rate for the next steps, m/s, and the seconds since a cell's water left it. */
  rate: Float64Array;
  dryS: Float64Array;
  private readonly tables = new SoilTables(BEACH_SAND);
  constructor(readonly bed: Float64Array, waterTable: Float64Array) {
    const n = bed.length;
    this.cap1 = new Float64Array(n);
    this.cap2 = new Float64Array(n);
    this.zc1 = new Float64Array(n);
    this.zc2 = new Float64Array(n);
    this.w1 = new Float64Array(n);
    this.w2 = new Float64Array(n);
    this.rate = new Float64Array(n);
    this.dryS = new Float64Array(n);
    const dTheta = BEACH_SAND.thetaS - BEACH_SAND.thetaR;
    for (let c = 0; c < n; c += 1) {
      const z1 = bed[c] - SKIN_M / 2 - waterTable[c];
      const z2 = bed[c] - SKIN_M - DEEP_M / 2 - waterTable[c];
      this.zc1[c] = z1;
      this.zc2[c] = z2;
      // As on the beach: a skin in the capillary fringe or under the water table is saturated for good.
      this.cap1[c] = z1 > BEACH_SAND.psiBM ? dTheta * SKIN_M : 0;
      this.cap2[c] = z1 > BEACH_SAND.psiBM ? dTheta * DEEP_M : 0;
    }
  }
  /** The start: the sand at equilibrium with its water table; a wet cell's water left long ago only if it is dry. */
  reset(h: Float64Array): void {
    for (let c = 0; c < this.cap1.length; c += 1) {
      this.w1[c] = this.cap1[c] * equilibriumSaturation(BEACH_SAND, this.zc1[c]);
      this.w2[c] = this.cap2[c] * equilibriumSaturation(BEACH_SAND, this.zc2[c]);
      this.rate[c] = 0;
      this.dryS[c] = h[c] > MOUTH_H_DRY ? 0 : 600;
    }
  }
  snapshot(): { w1: Float64Array; w2: Float64Array; rate: Float64Array; dryS: Float64Array } {
    return { w1: this.w1.slice(), w2: this.w2.slice(), rate: this.rate.slice(), dryS: this.dryS.slice() };
  }
  restore(s: { w1: Float64Array; w2: Float64Array; rate: Float64Array; dryS: Float64Array }): void {
    this.w1.set(s.w1); this.w2.set(s.w2); this.rate.set(s.rate); this.dryS.set(s.dryS);
  }
  /** The skin's effective saturation (1 on a saturated cell), for the look. */
  skinSaturation(c: number): number {
    return this.cap1[c] > 0 ? Math.min(Math.max(this.w1[c] / this.cap1[c], 0), 1) : 1;
  }
  /**
   * One step: each land cell takes the intake out of its water (never more
   * than the water, nor than the skin has room for; the river's share of it
   * goes with it), then every slowEvery steps the stores exchange and drain
   * (the beach's \`slowUpdate\`, the same fluxes) and the intake is set anew.
   * Returns the water and the river water taken, m (per cell area, summed).
   */
  take(h: Float64Array, hc: Float64Array, dt: number, step: number): { water: number; tracer: number } {
    const { cap1, w1 } = this;
    let water = 0;
    let tracer = 0;
    for (let c = 0; c < h.length; c += 1) {
      if (h[c] > MOUTH_H_DRY) this.dryS[c] = 0; else this.dryS[c] += dt;
      const c1 = cap1[c];
      if (c1 <= 0) continue;
      const hh = h[c];
      if (hh <= 0) continue;
      let q = this.rate[c] * dt;
      if (q > hh) q = hh;
      if (q > c1 - w1[c] + this.cap2[c] - this.w2[c]) q = Math.max(c1 - w1[c] + this.cap2[c] - this.w2[c], 0);
      if (q <= 0) continue;
      const share = hc[c] / hh;
      h[c] = hh - q;
      hc[c] -= q * share;
      // The skin takes it; what the skin has no room for goes straight on to the deep store (the skin passes it down).
      const room1 = c1 - w1[c];
      if (q <= room1) w1[c] += q; else { w1[c] = c1; this.w2[c] += q - room1; }
      water += q;
      tracer += q * share;
    }
    const every = BEACH_SWASH.slowEvery;
    if ((step + 1) % every === 0) this.slow(h, dt * every);
    return { water, tracer };
  }
  /** The beach's slow update, the sand alone (\`SwashField.slowUpdate\`): skin to deep, deep to the water table, the next intake. */
  private slow(h: Float64Array, dtm: number): void {
    const { cap1, cap2, w1, w2, zc2 } = this;
    const tab = this.tables;
    const dz12 = (SKIN_M + DEEP_M) / 2;
    for (let c = 0; c < cap1.length; c += 1) {
      const c1 = cap1[c];
      if (c1 <= 0) { this.rate[c] = 0; continue; }
      const c2 = cap2[c];
      const se1 = w1[c] / c1;
      const se2 = w2[c] / c2;
      const psi1 = tab.psiAt(se1);
      const psi2 = tab.psiAt(se2);
      const grad = 1 + (psi2 - psi1) / dz12;
      const q12 = grad > 0 ? tab.kAt(se1) * grad : tab.kAt(se2) * grad;
      const zc = Math.max(zc2[c], 0.05);
      const q2 = (tab.kAt(se2) * (zc - psi2)) / Math.max(zc, DEEP_M);
      let a1 = w1[c];
      let a2 = w2[c];
      let d12 = q12 * dtm;
      if (d12 > 0) { if (d12 > a1) d12 = a1; if (d12 > c2 - a2) d12 = c2 - a2; } else { if (-d12 > a2) d12 = -a2; if (-d12 > c1 - a1) d12 = -(c1 - a1); }
      a1 -= d12; a2 += d12;
      let d2 = q2 * dtm;
      if (d2 > a2) d2 = a2;
      if (-d2 > c2 - a2) d2 = -(c2 - a2);
      a2 -= d2;
      w1[c] = a1; w2[c] = a2;
      const se1n = a1 / c1;
      const head = (h[c] + BEACH_SAND.psiFM * (1 - se1n)) / (SKIN_M / 2);
      this.rate[c] = se1n < 0.999 ? BEACH_SAND.ksMS * (1 + head) : Math.max(d12 / dtm, 0);
    }
  }
  /** Water in the sand over the water table's equilibrium start, m^3 per cell area (summed): the ledger's twin. */
  stored(): number {
    let s = 0;
    for (let c = 0; c < this.cap1.length; c += 1) s += this.w1[c] + this.w2[c];
    return s;
  }
}

/**
 * THE MOUTH'S NEAR FIELD: depth, flow and the share of river water on the
 * grid, stepped at a fixed dt from a fixed start. Cell (i, j) is i along s
 * (seaward edge i = 0), j along a; index j * ns + i, as the swash.
 */
export class MouthField {
  readonly ns: number;
  readonly na: number;
  readonly dx: number;
  /** The fixed step, s. The spin-up alone runs a longer one (MOUTH_SPINUP_DT). */
  dt: number;
  readonly bed: Float64Array;
  readonly manningN2: number;
  /** ROUND 14 (ruling 1): each cell's n^2, or null (the one n). */
  readonly manningN2Cell: Float64Array | null;
  h: Float64Array;
  hu: Float64Array;
  hv: Float64Array;
  /** River water per cell, m (h times the river's share). */
  hc: Float64Array;
  /** Foam made by a breaking bore, 0 to 1 cover (Kennedy et al. 2000, the beach's rule). */
  foam: Float64Array;
  step = 0;
  readonly ledger: MouthLedger = { riverIn: 0, seaIn: 0, seaOut: 0, clipped: 0, tracerOut: 0, tracerIn: 0, tracerClipped: 0, sideOut: 0, tracerSideOut: 0 };
  readonly edgeDepth: Float64Array;
  readonly edgeEta: Float64Array;
  lastCourant = 0;
  /** The inflow: discharge, cells and their shares, and the speed the water arrives with (along -s). */
  readonly dischargeM3S: number;
  readonly inflowCells: Int32Array;
  readonly inflowShare: Float64Array;
  readonly inflowSpeedMS: number;
  /** ROUND 13: the inflow's momentum along a (the deflected course's root edge) and its sign; null: along -s. */
  readonly inflowAlong: { readonly axis: 'a'; readonly sign: 1 | -1 } | null;
  /** When false the sea edge holds the still sea (the spin-up). */
  waves = true;
  /**
   * ROUND 5, THE BANKS' SAND (GG-394; \`MouthSoil\`): the beach's two stores
   * per land cell (skin and deep, m of water), their capacities, the
   * intake rate for the next steps, and the seconds since the water left
   * each cell. Null: round 4's grid (no sand under its water).
   */
  readonly soil: MouthSoil | null;
  private readonly incident: IncidentFn;
  private readonly u: Float64Array;
  private readonly v: Float64Array;
  private readonly dh: Float64Array;
  private readonly dhu: Float64Array;
  private readonly dhv: Float64Array;
  private readonly dhc: Float64Array;
  private readonly etaPrev: Float64Array;

  constructor(opts: {
    grid: SwashGridSpec;
    bed: Float64Array;
    manningN: number;
    dt: number;
    incident: IncidentFn;
    dischargeM3S: number;
    inflowCells: Int32Array;
    inflowShare: Float64Array;
    inflowSpeedMS: number;
    /** ROUND 13: the inflow along a (the deflected course), with its sign. Absent: along -s. */
    inflowAlong?: { axis: 'a'; sign: 1 | -1 };
    /** Round 5: the water table under each cell, m over the mean sea level (\`mouthWaterTable\`); absent: no soil. */
    waterTable?: Float64Array;
    /** ROUND 14 (ruling 1): each cell's own Manning n (the channel's bed, the coast's sand). Absent: `manningN` on every cell. */
    manningNCell?: Float64Array;
  }) {
    const g = opts.grid;
    if (Math.abs(g.ds - g.da) > 1e-9) throw new Error('[ocean] The mouth grid needs square cells.');
    this.ns = g.ns;
    this.na = g.na;
    this.dx = g.ds;
    this.dt = opts.dt;
    const n = g.ns * g.na;
    if (opts.bed.length !== n) throw new Error(`[ocean] The mouth bed needs ${n} cells.`);
    this.bed = opts.bed.slice();
    this.manningN2 = opts.manningN * opts.manningN;
    this.manningN2Cell = opts.manningNCell ? Float64Array.from(opts.manningNCell, (x) => x * x) : null;
    this.incident = opts.incident;
    this.dischargeM3S = opts.dischargeM3S;
    this.inflowCells = opts.inflowCells;
    this.inflowShare = opts.inflowShare;
    this.inflowSpeedMS = opts.inflowSpeedMS;
    this.inflowAlong = opts.inflowAlong ?? null;
    this.h = new Float64Array(n);
    this.hu = new Float64Array(n);
    this.hv = new Float64Array(n);
    this.hc = new Float64Array(n);
    this.foam = new Float64Array(n);
    this.u = new Float64Array(n);
    this.v = new Float64Array(n);
    this.dh = new Float64Array(n);
    this.dhu = new Float64Array(n);
    this.dhv = new Float64Array(n);
    this.dhc = new Float64Array(n);
    this.etaPrev = new Float64Array(n);
    this.edgeDepth = new Float64Array(g.na);
    this.edgeEta = new Float64Array(g.na);
    for (let j = 0; j < g.na; j += 1) this.edgeDepth[j] = Math.max(-this.bed[j * g.ns], 0.05);
    this.soil = opts.waterTable === undefined ? null : new MouthSoil(this.bed, opts.waterTable);
    this.reset();
  }

  /** THE START: the sea at rest at its mean level (sea water), the valley dry above it. */
  reset(): void {
    const n = this.ns * this.na;
    for (let c = 0; c < n; c += 1) {
      this.h[c] = Math.max(-this.bed[c], 0);
      this.hu[c] = 0;
      this.hv[c] = 0;
      this.hc[c] = 0;
      this.foam[c] = 0;
      this.etaPrev[c] = this.bed[c] + this.h[c];
    }
    this.step = 0;
    const l = this.ledger;
    l.riverIn = 0; l.seaIn = 0; l.seaOut = 0; l.clipped = 0; l.tracerOut = 0; l.tracerIn = 0; l.tracerClipped = 0; l.sideOut = 0; l.tracerSideOut = 0;
    if (this.soil !== null) { this.soil.reset(this.h); l.soaked = 0; l.tracerSoaked = 0; }
  }

  volume(): number {
    let s = 0;
    for (let c = 0; c < this.h.length; c += 1) s += this.h[c];
    return s * this.dx * this.dx;
  }

  tracerVolume(): number {
    let s = 0;
    for (let c = 0; c < this.hc.length; c += 1) s += this.hc[c];
    return s * this.dx * this.dx;
  }

  /** A copy of the state, for the clock's checkpoints. */
  snapshot(): MouthState {
    return {
      step: this.step, h: this.h.slice(), hu: this.hu.slice(), hv: this.hv.slice(), hc: this.hc.slice(), foam: this.foam.slice(), ledger: { ...this.ledger },
      ...(this.soil !== null ? { soil: this.soil.snapshot() } : {}),
    };
  }

  restore(s: MouthState): void {
    this.h.set(s.h); this.hu.set(s.hu); this.hv.set(s.hv); this.hc.set(s.hc); this.foam.set(s.foam);
    if (this.soil !== null && s.soil !== undefined) this.soil.restore(s.soil);
    Object.assign(this.ledger, s.ledger);
    this.step = s.step;
    for (let c = 0; c < this.h.length; c += 1) this.etaPrev[c] = this.bed[c] + this.h[c];
  }

  /** Advance one fixed step. `tNow` is the sea's time for the forcing. */
  advance(tNow: number = this.step * this.dt): void {
    const { ns, na, dx, dt, bed, h, hu, hv, hc, u, v, dh, dhu, dhv, dhc } = this;
    const hDry = MOUTH_H_DRY;
    const inv = 1 / dx;
    if (this.waves) this.incident(tNow, this.edgeEta); else this.edgeEta.fill(0);
    const n = ns * na;
    for (let c = 0; c < n; c += 1) {
      const d = h[c];
      if (d > hDry) { u[c] = hu[c] / d; v[c] = hv[c] / d; } else { u[c] = 0; v[c] = 0; }
      dh[c] = 0; dhu[c] = 0; dhv[c] = 0; dhc[c] = 0;
    }
    let maxS = 0;
    let seaIn = 0;
    let seaOut = 0;
    let trIn = 0;
    let trOut = 0;
    const F = HLL_OUT;
    // ---- faces across s, with the sea edge at face 0 and a wall at face ns ----
    for (let j = 0; j < na; j += 1) {
      const row = j * ns;
      {
        // THE SEA EDGE: the beach's absorbing-generating boundary (Kobayashi,
        // Otta and Roy 1987). The incoming characteristic u + 2c carries the
        // FFT sea's height in; the outgoing u - 2c comes from the first cell,
        // so the river's outflow and a reflected wave both leave. The ghost's
        // bed is the first cell's.
        const c0 = row;
        const d = this.edgeDepth[j];
        const eta = this.edgeEta[j];
        const alpha = 2 * Math.sqrt(G * d) + 2 * eta * Math.sqrt(G / d);
        const h1 = h[c0];
        const beta = u[c0] - 2 * Math.sqrt(G * (h1 > 0 ? h1 : 0));
        let cg = (alpha - beta) / 4;
        if (cg < 0) cg = 0;
        const hg = (cg * cg) / G;
        const ug = (alpha + beta) / 2;
        hllFaceInto(hg, ug, v[c0], h1, u[c0], v[c0]);
        dh[c0] += F[0] * inv;
        dhu[c0] += F[1] * inv;
        dhv[c0] += F[2] * inv;
        // The tracer rides the mass flux upwind: sea water (0) in, the cell's share out.
        const cShare = h1 > hDry ? hc[c0] / h1 : 0;
        const fc = F[0] > 0 ? 0 : F[0] * cShare;
        dhc[c0] += fc * inv;
        if (F[0] > 0) seaIn += F[0] * dt * dx; else { seaOut -= F[0] * dt * dx; trOut -= fc * dt * dx; }
        if (F[3] > maxS) maxS = F[3];
      }
      for (let i = 1; i < ns; i += 1) {
        const cL = row + i - 1;
        const cR = cL + 1;
        const hL = h[cL];
        const hR = h[cR];
        if (hL <= hDry && hR <= hDry) continue;
        const zL = bed[cL];
        const zR = bed[cR];
        const zM = zL > zR ? zL : zR;
        let hLs = hL + zL - zM; if (hLs < 0) hLs = 0;
        let hRs = hR + zR - zM; if (hRs < 0) hRs = 0;
        hllFaceInto(hLs, u[cL], v[cL], hRs, u[cR], v[cR]);
        dh[cL] -= F[0] * inv;
        dh[cR] += F[0] * inv;
        dhu[cL] -= (F[1] + 0.5 * G * (hL * hL - hLs * hLs)) * inv;
        dhu[cR] += (F[1] + 0.5 * G * (hR * hR - hRs * hRs)) * inv;
        dhv[cL] -= F[2] * inv;
        dhv[cR] += F[2] * inv;
        const fc = F[0] > 0 ? F[0] * (hL > hDry ? hc[cL] / hL : 0) : F[0] * (hR > hDry ? hc[cR] / hR : 0);
        dhc[cL] -= fc * inv;
        dhc[cR] += fc * inv;
        if (F[3] > maxS) maxS = F[3];
      }
      // The head: a wall (the river comes in as a source in the last column).
      const cE = row + ns - 1;
      if (h[cE] > hDry) {
        hllFaceInto(h[cE], u[cE], v[cE], h[cE], -u[cE], v[cE]);
        dhu[cE] -= F[1] * inv;
      }
    }
    // ---- faces across a, walls at both ends ----
    for (let j = 1; j < na; j += 1) {
      const rowL = (j - 1) * ns;
      const rowR = j * ns;
      for (let i = 0; i < ns; i += 1) {
        const cL = rowL + i;
        const cR = rowR + i;
        const hL = h[cL];
        const hR = h[cR];
        if (hL <= hDry && hR <= hDry) continue;
        const zL = bed[cL];
        const zR = bed[cR];
        const zM = zL > zR ? zL : zR;
        let hLs = hL + zL - zM; if (hLs < 0) hLs = 0;
        let hRs = hR + zR - zM; if (hRs < 0) hRs = 0;
        hllFaceInto(hLs, v[cL], u[cL], hRs, v[cR], u[cR]);
        dh[cL] -= F[0] * inv;
        dh[cR] += F[0] * inv;
        dhv[cL] -= (F[1] + 0.5 * G * (hL * hL - hLs * hLs)) * inv;
        dhv[cR] += (F[1] + 0.5 * G * (hR * hR - hRs * hRs)) * inv;
        dhu[cL] -= F[2] * inv;
        dhu[cR] += F[2] * inv;
        const fc = F[0] > 0 ? F[0] * (hL > hDry ? hc[cL] / hL : 0) : F[0] * (hR > hDry ? hc[cR] / hR : 0);
        dhc[cL] -= fc * inv;
        dhc[cR] += fc * inv;
        if (F[3] > maxS) maxS = F[3];
      }
    }
    // THE SIDE EDGES (round 2): walls under the mean sea level, and on land
    // (bed over it: the swash and the overtopping on the banks' tops) an
    // OUTFLOW edge: water that runs out across the edge leaves the grid
    // (a zero-gradient ghost, the reach solver's transmissive outflow), and
    // the ledger books it (`sideOut`; the beach's grid holds its own water
    // past the edge). Round 1's wall there held the overtopping water against
    // the edge in a flat pool a few centimeters deep that the sea's one
    // surface drew as a hard-edged mirror on both banks.
    let sideOut = 0;
    let trSide = 0;
    for (let e = 0; e < 2; e += 1) {
      const row = (e === 0 ? 0 : na - 1) * ns;
      for (let i = 0; i < ns; i += 1) {
        const c = row + i;
        const d = h[c];
        if (d <= hDry) continue;
        const out = bed[c] > 0 && (e === 1 ? v[c] > 0 : v[c] < 0);
        if (out) {
          const vn = e === 1 ? v[c] : -v[c];
          hllFaceInto(d, vn, u[c], d, vn, u[c]);
          dh[c] -= F[0] * inv;
          dhu[c] -= F[2] * inv;
          if (e === 1) dhv[c] -= F[1] * inv; else dhv[c] += F[1] * inv;
          const fc = F[0] * (hc[c] / d);
          dhc[c] -= fc * inv;
          sideOut += F[0] * dt * dx;
          trSide += fc * dt * dx;
        } else if (e === 1) { hllFaceInto(d, v[c], u[c], d, -v[c], u[c]); dhv[c] -= F[1] * inv; }
        else { hllFaceInto(d, -v[c], u[c], d, v[c], u[c]); dhv[c] += F[1] * inv; }
      }
    }
    // ---- the river: mass, momentum (toward the sea, along -s) and its water ----
    const area = dx * dx;
    for (let k = 0; k < this.inflowCells.length; k += 1) {
      const c = this.inflowCells[k];
      const rate = (this.dischargeM3S * this.inflowShare[k]) / area;
      dh[c] += rate;
      if (this.inflowAlong !== null) dhv[c] += this.inflowAlong.sign * rate * this.inflowSpeedMS;
      else dhu[c] -= rate * this.inflowSpeedMS;
      dhc[c] += rate;
    }
    this.lastCourant = (maxS * dt) / dx;
    // ---- update, positivity, friction, bore foam ----
    const n2g = G * this.manningN2;
    const n2c = this.manningN2Cell;
    let clipped = 0;
    let trClip = 0;
    const foamKeep = Math.exp(-dt / BEACH_SWASH.foamLifeS);
    const breakK = BEACH_SWASH.foamBreakK;
    const etaPrev = this.etaPrev;
    const foam = this.foam;
    for (let c = 0; c < n; c += 1) {
      // A dry cell no face touched stays as it is (no water, no foam to fade).
      if (h[c] === 0 && dh[c] === 0) {
        if (foam[c] !== 0) foam[c] *= foamKeep;
        continue;
      }
      let hn = h[c] + dt * dh[c];
      let mu = hu[c] + dt * dhu[c];
      let mv = hv[c] + dt * dhv[c];
      let cn = hc[c] + dt * dhc[c];
      if (hn < 0) { clipped -= hn; hn = 0; }
      if (hn <= hDry) {
        // A drying cell keeps its film at rest (the river solver's rule).
        mu = 0; mv = 0;
      } else {
        const sp = Math.sqrt(mu * mu + mv * mv) / hn;
        const k = 1 + (dt * (n2c === null ? n2g : G * n2c[c]) * sp) / (hn * Math.cbrt(hn));
        mu /= k; mv /= k;
      }
      if (cn < 0) { trClip += cn; cn = 0; }
      if (cn > hn) { trClip += cn - hn; cn = hn; }
      h[c] = hn; hu[c] = mu; hv[c] = mv; hc[c] = cn;
      // A BORE makes foam: the surface rising faster than 0.15 sqrt(g h)
      // (Kennedy et al. 2000, the beach's foamBreakK), at the beach's own
      // gain; the foam fades with the beach's surf life.
      const eta = bed[c] + hn;
      const rise = (eta - etaPrev[c]) / dt;
      etaPrev[c] = eta;
      let f = foam[c] * foamKeep;
      if (hn > 0.01) {
        const cw = Math.sqrt(G * hn);
        const over = rise - breakK * cw;
        if (over > 0) f += (BEACH_SWASH.foamGain * over * dt) / Math.max(cw, 0.05);
      }
      foam[c] = f > 1 ? 1 : f;
    }
    // ROUND 5: the banks' sand takes its intake and, every few steps, updates its stores (\`MouthSoil\`).
    if (this.soil !== null) {
      const r = this.soil.take(h, hc, dt, this.step);
      this.ledger.soaked = (this.ledger.soaked ?? 0) + r.water * area;
      this.ledger.tracerSoaked = (this.ledger.tracerSoaked ?? 0) + r.tracer * area;
    }
    const l = this.ledger;
    l.riverIn += this.dischargeM3S * dt;
    l.seaIn += seaIn;
    l.seaOut += seaOut;
    l.sideOut += sideOut;
    l.tracerSideOut += trSide;
    l.tracerOut += trOut;
    l.tracerIn += trIn;
    l.clipped += clipped * area;
    l.tracerClipped += trClip * area;
    this.step += 1;
  }
}

export interface MouthState {
  readonly step: number;
  readonly h: Float64Array;
  readonly hu: Float64Array;
  readonly hv: Float64Array;
  readonly hc: Float64Array;
  readonly foam: Float64Array;
  readonly ledger: MouthLedger;
  /** Round 5: the banks' sand (\`MouthSoil.snapshot\`). */
  readonly soil?: { readonly w1: Float64Array; readonly w2: Float64Array; readonly rate: Float64Array; readonly dryS: Float64Array };
}
