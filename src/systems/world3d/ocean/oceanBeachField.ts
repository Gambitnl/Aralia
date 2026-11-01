/**
 * @file oceanBeachField.ts
 * The beach swash grid, bank soil and their flux bookkeeping.
 * The intact solver and its shared mutable flux scratch remain in one module.
 * Existing soil laws, state, ledgers and operation order are unchanged. The public
 * oceanBeachMath facade retains every former import path.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:51:10
 * Dependents: systems/world3d/ocean/oceanBeachMath.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SUBSTANCES } from '../../worldforge/terrain/materials';
import { Material } from '../../worldforge/terrain/voxelVolume';


/** Gravity, m/s^2. */
export const G = 9.81;

/* ------------------------------------------------------------------ */
/* The sand                                                             */
/* ------------------------------------------------------------------ */

/**
 * Density of a quartz grain, kg/m^3. Beach sand is mostly quartz (2650) with
 * some feldspar (2560 to 2760) and shell (2710 to 2930).
 */
export const GRAIN_DENSITY_KG_M3 = 2650;

/**
 * The sand's water physics. Every number is the registry's or a published
 * fit for sand; none is tuned to a look.
 *
 *   ksMS     saturated hydraulic conductivity: the registry's Material.Sand
 *            (1e-4 m/s, a fine to medium sand; Freeze and Cherry 1979 give
 *            1e-5 to 1e-3 for clean sand).
 *   thetaS   porosity: 1 minus the registry's bulk density (1600) over the
 *            grain density (2650), 0.396. Rawls et al. (1982) measured 0.437
 *            for their sand class; a packed beach face is denser than a
 *            field soil.
 *   thetaR   residual water content: 0.020 (Rawls et al. 1982, sand).
 *   psiBM    air entry (bubbling) suction head: 0.0726 m (Rawls et al. 1982).
 *            Sand within this height over the water table stays saturated
 *            (the capillary fringe).
 *   lambda   Brooks-Corey pore size index: 0.592 (Rawls et al. 1982). The
 *            conductivity falls as Se^(3 + 2/lambda) = Se^6.38, which is why
 *            wet sand drains fast at first and then very slowly.
 *   psiFM    Green-Ampt wetting-front suction: 0.0495 m (Rawls, Brakensiek and
 *            Miller 1983, sand). It drives water into a dry skin faster than
 *            gravity alone (the "seeps into the sand" of the tip).
 *   evapMS   evaporation from a wet sand face in sun: 6 mm/day (6.9e-8 m/s),
 *            a clear-sky summer rate; negligible over a minute, kept so the
 *            ledger names it.
 */
export interface SandSoil {
  readonly ksMS: number;
  readonly thetaS: number;
  readonly thetaR: number;
  readonly psiBM: number;
  readonly lambda: number;
  readonly psiFM: number;
  readonly evapMS: number;
}

const SAND_SUBSTANCE = SUBSTANCES[Material.Sand];

export const BEACH_SAND: SandSoil = {
  ksMS: SAND_SUBSTANCE.permeabilityMS,
  thetaS: 1 - SAND_SUBSTANCE.densityKgM3 / GRAIN_DENSITY_KG_M3,
  thetaR: 0.020,
  psiBM: 0.0726,
  lambda: 0.592,
  psiFM: 0.0495,
  evapMS: 6.9e-8,
};

/**
 * The two sand stores of one cell, meters of depth.
 *
 *   SKIN_M   the top centimeter: what the eye sees, and what the sheet fills
 *            first. Wet-sand color is a property of the top few grain layers
 *            (a 0.3 mm grain: about 30 layers in 1 cm).
 *   DEEP_M   the sand under the skin, down to where the water table's own
 *            store takes over: 0.30 m, about the depth a swash's water reaches
 *            in the minutes this piece shows (the wetting front of 5 mm of
 *            infiltration in sand at 0.1 saturation moves 1.3 cm; a minute of
 *            repeated swash wets the top 10 to 30 cm, Turner and Masselink
 *            1998).
 */
export const SKIN_M = 0.01;
export const DEEP_M = 0.30;
/** Suction cap, m: a dry skin's suction is metres; Brooks-Corey runs off to infinity at Se 0. */
const PSI_MAX_M = 2.0;

/** Effective saturation of a store holding `w` meters of water over capacity `cap`. */
export function saturation(w: number, cap: number): number {
  return cap > 0 ? Math.min(Math.max(w / cap, 0), 1) : 1;
}

/** Brooks-Corey unsaturated conductivity, m/s: Ks Se^(3 + 2/lambda). */
export function conductivity(soil: SandSoil, se: number): number {
  const s = Math.min(Math.max(se, 0), 1);
  return soil.ksMS * s ** (3 + 2 / soil.lambda);
}

/** Brooks-Corey suction head, m (positive): psiB Se^(-1/lambda), capped. */
export function suction(soil: SandSoil, se: number): number {
  const s = Math.max(se, 1e-6);
  return Math.min(soil.psiBM * s ** (-1 / soil.lambda), PSI_MAX_M);
}

/**
 * Saturation at hydrostatic equilibrium, a height `z` (m) over the water
 * table: 1 inside the capillary fringe, (psiB / z)^lambda above it.
 */
export function equilibriumSaturation(soil: SandSoil, z: number): number {
  if (z <= soil.psiBM) return 1;
  return (soil.psiBM / z) ** soil.lambda;
}

/**
 * Lookup tables for the two Brooks-Corey curves: the stores update tens of
 * thousands of cells a few dozen times a second, and a power costs as much
 * as the rest of a cell's update. 1025 entries over Se in [0, 1], linear
 * between them: the conductivity's largest table error is under 0.4% of Ks.
 */
export class SoilTables {
  readonly k: Float64Array;
  readonly psi: Float64Array;
  private readonly n = 1024;
  constructor(readonly soil: SandSoil) {
    this.k = new Float64Array(this.n + 1);
    this.psi = new Float64Array(this.n + 1);
    for (let i = 0; i <= this.n; i += 1) {
      const se = i / this.n;
      this.k[i] = conductivity(soil, se);
      this.psi[i] = suction(soil, se);
    }
  }
  kAt(se: number): number {
    const x = Math.min(Math.max(se, 0), 1) * this.n;
    const i = Math.min(Math.floor(x), this.n - 1);
    const f = x - i;
    return this.k[i] + (this.k[i + 1] - this.k[i]) * f;
  }
  psiAt(se: number): number {
    const x = Math.min(Math.max(se, 0), 1) * this.n;
    const i = Math.min(Math.floor(x), this.n - 1);
    const f = x - i;
    return this.psi[i] + (this.psi[i + 1] - this.psi[i]) * f;
  }
}

/** The grid: `ns` cells of `ds` from `s0` onshore, `na` cells of `da` from `a0` along. */
export interface SwashGridSpec {
  readonly s0: number;
  readonly ds: number;
  readonly ns: number;
  readonly a0: number;
  readonly da: number;
  readonly na: number;
}

/* ------------------------------------------------------------------ */
/* The swash                                                            */
/* ------------------------------------------------------------------ */

/**
 * The swash model's numbers, each with its reason.
 *
 *   manningN   bed friction, Manning's n, s/m^(1/3): 0.018, a smooth sand
 *              bed (Chow 1959: 0.016 to 0.020 for clean sand). On a 2 cm
 *              sheet it gives a friction coefficient of 0.012, inside the
 *              0.005 to 0.025 measured in swash (Puleo and Holland 2001).
 *   hDryM      below this depth a cell carries no velocity: 1e-5 m (a
 *              hundredth of a millimeter). The water stays and is booked;
 *              only its momentum is dropped.
 *   waterTable the beach water table, m over the mean sea level:
 *              wtShoreM at the still-water line, rising landward by wtSlope,
 *              capped at wtMaxM. A beach under waves holds its water table
 *              over the sea's level by the wave setup and the swash's own
 *              infiltration (Nielsen 1990: 0.1 to 0.3 m at the shore on
 *              sandy beaches; Turner 1993: the exit point sits in the lower
 *              swash zone). 0.05 + 0.02 per meter puts the exit point, the
 *              top of the glassy saturated band, 1.7 m up a 1:11 face.
 *   foam*      the foam the sheet carries. It is born where the water
 *              surface rises faster than a bore's threshold (Kennedy et al.
 *              2000 start breaking at d(eta)/dt = 0.65 sqrt(g h) and keep it
 *              to 0.15 sqrt(g h); a bore already formed is past both, so the
 *              lower one is used), rides with the water, and pops. Swash foam
 *              lives a few seconds (bubbles over 1 mm rise out in about a
 *              second; the raft pops over 5 to 20 s); stranded on the sand it
 *              drains into the pores faster. THE GAIN: a bore's roller is
 *              white across its face. This first-order scheme spreads a bore's
 *              front over 0.5 to 1 m, so a 0.2 m bore at 2 m/s raises the
 *              surface about 0.5 m/s over its threshold for the 0.25 s it
 *              takes to pass a cell; gain 12 brings that cell to full cover
 *              (12 x 0.54 x 0.25 / sqrt(g 0.3) = 0.95). At 1.2 (the first
 *              try) the surf's foam never passed 0.32 and drew as scattered
 *              specks. THE LIFE BY DEPTH: in the surf (over 0.3 m) bubbles
 *              rise out of the column and the raft pops in about 4 s; in a
 *              swash sheet under 5 cm the bubbles are already at the surface
 *              and ride it, so the front's foam lasts 7 s, through its
 *              backwash; stranded on wet sand it lasts 25 s (a swash's foam
 *              line, drying bubble by bubble, holds tens of seconds). At 4
 *              s and 9 s the swash edge had no foam between uprushes.
 *   markLifeS  the swash mark, the line of fine grains and foam scum a swash
 *              leaves where it stops: it lasts until the next swash washes
 *              it or the sand dries under it, about a minute.
 *   sed*       THE SAND IN THE WATER. A fast sheet lifts sand off the bed and
 *              carries it; a slow one lets it settle. Depth-mean suspended
 *              concentrations measured in swash are 1 to 50 kg/m^3 in the
 *              uprush, highest at the bore front (Puleo et al. 2000;
 *              Masselink et al. 2005), and a fine-sand grain of 0.2 mm
 *              settles at 0.023 m/s (Soulsby 1997). Pickup here is
 *              sedPickupK (U^2 - Uc^2) kg/m^2/s over Uc = 0.3 m/s, the depth-
 *              mean flow at which fine sand starts to move under a thin sheet
 *              (a Shields number of 0.05); the balance with settling, P = ws C,
 *              puts a 1.5 m/s uprush at 5 kg/m^3, inside the measured band.
 *              It is the sandy veil of the surf's water and the reason the
 *              inner surf shows no caustic web.
 */
export interface SwashParams {
  readonly manningN: number;
  readonly hDryM: number;
  readonly wtShoreM: number;
  readonly wtSlope: number;
  readonly wtMaxM: number;
  readonly foamBreakK: number;
  readonly foamGain: number;
  readonly foamLifeS: number;
  /** Foam's life in a sheet thinner than 5 cm, s (see foam* above). */
  readonly foamThinLifeS: number;
  readonly foamStrandLifeS: number;
  readonly markLifeS: number;
  readonly sedPickupK: number;
  readonly sedCritUMS: number;
  readonly sedSettleMS: number;
  /** Steps between two updates of the sand stores and the foam (their dt is this many steps). */
  readonly slowEvery: number;
  /**
   * ROUND 20 (the match only; absent in BEACH_SWASH, so the default runs as
   * before, bit for bit). THE THIN-FILM FORCE ON A SLOPE. True: the faces use
   * the subcell hydrostatic reconstruction of Chen and Noelle (2017) in place
   * of Audusse et al. (2004). See `SwashField.advance`.
   */
  readonly subcellHR?: boolean;
  /**
   * ROUND 20 (the match only): the water's kinematic viscosity, m^2/s. Set,
   * the bed stress is the larger of the turbulent (Manning) stress and the
   * laminar film's stress 3 nu U / h (a sheet thinner than a few
   * millimeters is laminar, Re = U h / nu under 1000). Absent: Manning alone.
   */
  readonly laminarNuM2S?: number;
  /**
   * ROUND 20 (the match only): the foam is born from the bore's energy loss
   * (the hydraulic jump's relative head loss, the bore analogy of Battjes and
   * Janssen 1978), not from `foamGain`. See `SwashField.foamUpdate`.
   */
  readonly boreFoam?: boolean;
}

export const BEACH_SWASH: SwashParams = {
  manningN: 0.018,
  hDryM: 1e-5,
  wtShoreM: 0.05,
  wtSlope: 0.02,
  wtMaxM: 0.40,
  foamBreakK: 0.15,
  foamGain: 5,
  foamLifeS: 4,
  foamThinLifeS: 7,
  foamStrandLifeS: 25,
  markLifeS: 60,
  sedPickupK: 0.046,
  sedCritUMS: 0.3,
  sedSettleMS: 0.023,
  slowEvery: 3,
};

/** The water that has crossed each boundary and each sink, m^3, since the start. */
export interface SwashLedger {
  /** Net water in across the sea edge (in minus out). */
  arrived: number;
  /** Gross water in and out across the sea edge. */
  inflow: number;
  outflow: number;
  /** Into the sand from the sheet (the skin's intake), gross. */
  infiltrated: number;
  /** From the deep store down to the water table (signed: a rise is negative). */
  drained: number;
  /** Out of the skin to the air. */
  evaporated: number;
  /** Water the positivity guard would have created (should stay 0). */
  clipped: number;
}

/** What the grid holds at one time. `data()` of `SwashField`; also its checkpoints. */
export interface SwashState {
  readonly step: number;
  readonly h: Float64Array;
  readonly hu: Float64Array;
  readonly hv: Float64Array;
  readonly w1: Float64Array;
  readonly w2: Float64Array;
  readonly foam: Float64Array;
  readonly strand: Float64Array;
  readonly mark: Float64Array;
  readonly sed: Float64Array;
  readonly wetAge: Float64Array;
  /** The foam's age, s (round 7). */
  readonly foamAge: Float64Array;
  /** The intake rates the last slow update set, and the tips' velocities. */
  readonly infil: Float64Array;
  readonly tipU: Float64Array;
  readonly ledger: SwashLedger;
  readonly debris: Float64Array;
}

/** The incident water level at each row's sea edge, meters: filled by the caller per step. */
export type IncidentFn = (tS: number, out: Float64Array) => void;

/**
 * THE SWASH FIELD. A first-order finite-volume solver of the 2D shallow
 * water equations: HLL fluxes (Harten, Lax and van Leer 1983) with the
 * hydrostatic reconstruction of Audusse et al. (2004), which keeps a lake at
 * rest exactly at rest over any bed and never drives a depth negative at a
 * wet and dry front under the time step's bound. Manning friction is applied
 * semi-implicitly, so the thin tip stops without ringing. This is the class
 * of scheme the swash literature validates against the Shen and Meyer (1963)
 * run-up (Hubbard and Dodd 2002; Brocchini and Dodd 2008).
 *
 * WHY NOT THE LAND PAGE'S SOLVER. `shallowWater.ts` is a virtual-pipe grid
 * whose face flux is recomputed each step from the surface drop alone: it
 * holds no momentum, so water can only flow downhill of its surface. A swash
 * climbs ABOVE the sea's level on its own momentum; that needs the momentum
 * equations. The soak and its exact ledger are the same idea as the land
 * page's (poured = pool + soaked + runoff), here arrived = sheet + soaked.
 */
export class SwashField {
  readonly ns: number;
  readonly na: number;
  readonly ds: number;
  readonly da: number;
  readonly cellArea: number;
  readonly dt: number;
  readonly bed: Float64Array;
  /** Water table height under each cell, m. */
  readonly wt: Float64Array;
  /** Capacities of the skin and deep stores, m of water (0 where the cell is under the water table). */
  readonly cap1: Float64Array;
  readonly cap2: Float64Array;
  /** Height of each store's center over the water table, m. */
  readonly zc1: Float64Array;
  readonly zc2: Float64Array;

  h: Float64Array;
  hu: Float64Array;
  hv: Float64Array;
  w1: Float64Array;
  w2: Float64Array;
  foam: Float64Array;
  strand: Float64Array;
  mark: Float64Array;
  /** Depth-mean suspended sand, kg/m^3. */
  sed: Float64Array;
  /** Seconds since the cell last held a sheet (0 while wet; capped). */
  wetAge: Float64Array;
  /**
   * THE FOAM'S AGE, s (round 7): the mean age of the foam a cell's water
   * carries. The foam piece's age clock (`oceanFoamMath.ts`, foamAgeStep:
   * the age of a mix is the mix of the ages): carried with the water as the
   * foam is, one step older each step, and new foam from a breaking bore
   * pulls it toward 0 by the share of the cell's foam it adds. The look reads
   * it: fresh foam is a dense raft, old foam is torn into clumps and
   * threads (the wake's round-11 look). Capped at FOAM_AGE_MAX_S.
   */
  foamAge: Float64Array;

  /** The still-water depth at each row's sea edge, m (bed below 0 there). */
  readonly edgeDepth: Float64Array;
  /** The incident level at each row's sea edge for the current step, m. */
  readonly edgeEta: Float64Array;

  step = 0;
  readonly ledger: SwashLedger = {
    arrived: 0, inflow: 0, outflow: 0, infiltrated: 0, drained: 0, evaporated: 0, clipped: 0,
  };
  /** Largest Courant number of the last step (both directions summed). */
  lastCourant = 0;

  private readonly soil: SandSoil;
  private readonly tables: SoilTables;
  private readonly p: SwashParams;
  /** Round 20: the faces use the Chen and Noelle (2017) reconstruction (`SwashParams.subcellHR`). */
  private readonly subcellHR: boolean;
  private readonly incident: IncidentFn;
  /**
   * RIVER MOUTH ROUND 1: 1 for a cell the mouth's grid owns (its water is the
   * river's, `oceanMouthMath.ts`), else 0; null for every beach before the
   * mouth. A wall cell holds no water and its faces are walls.
   */
  readonly wall: Uint8Array | null;
  private readonly dh: Float64Array;
  private readonly dhu: Float64Array;
  private readonly dhv: Float64Array;
  private readonly u: Float64Array;
  private readonly v: Float64Array;
  private readonly etaPrev: Float64Array;
  private readonly riseRate: Float64Array;
  private readonly infilRate: Float64Array;
  private readonly foamTmp: Float64Array;
  private readonly strandTmp: Float64Array;
  private readonly sedTmp: Float64Array;
  private readonly ageTmp: Float64Array;
  /** Round 20: the foam each cell's bore front adds this slow update (`boreFoamSource`). */
  private readonly boreAdd: Float64Array;
  /** One past the last wet cell of each row after the last step. */
  private readonly reach: Int32Array;
  /** The loop end of each row this step (the active range, see `advance`). */
  private readonly lim: Int32Array;
  /** The first cell of each row whose bed stands over the mean sea level. */
  private readonly shoreIndex: Int32Array;
  /** The tip's velocity along s at the last slow update, per row (for the swash mark). */
  private readonly tipU: Float64Array;

  constructor(opts: {
    grid: SwashGridSpec;
    /** Bed height at each cell center, m, row-major (a, s): index j * ns + i. */
    bed: Float64Array;
    /** Mean-sea-level shoreline distance of each cell, m (for the water table): s, positive onshore. */
    shoreDist: Float64Array;
    dt: number;
    incident: IncidentFn;
    soil?: SandSoil;
    params?: SwashParams;
    /** River mouth round 1: the cells the mouth's grid owns (see `wall`). Absent: none. */
    wall?: Uint8Array;
  }) {
    const g = opts.grid;
    if (opts.wall && opts.wall.length !== g.ns * g.na) throw new Error(`[ocean] The beach's wall mask needs ${g.ns * g.na} cells.`);
    this.wall = opts.wall ?? null;
    this.ns = g.ns;
    this.na = g.na;
    this.ds = g.ds;
    this.da = g.da;
    this.cellArea = g.ds * g.da;
    this.dt = opts.dt;
    this.soil = opts.soil ?? BEACH_SAND;
    this.tables = new SoilTables(this.soil);
    this.p = opts.params ?? BEACH_SWASH;
    this.subcellHR = this.p.subcellHR === true;
    this.incident = opts.incident;
    const n = g.ns * g.na;
    if (opts.bed.length !== n || opts.shoreDist.length !== n) {
      throw new Error(`[ocean] The beach bed and shore distance need ${n} cells.`);
    }
    this.bed = opts.bed.slice();
    this.wt = new Float64Array(n);
    this.cap1 = new Float64Array(n);
    this.cap2 = new Float64Array(n);
    this.zc1 = new Float64Array(n);
    this.zc2 = new Float64Array(n);
    const soil = this.soil;
    const dTheta = soil.thetaS - soil.thetaR;
    for (let c = 0; c < n; c += 1) {
      const s = opts.shoreDist[c];
      const wt = Math.min(this.p.wtShoreM + this.p.wtSlope * Math.max(s, 0), this.p.wtMaxM);
      this.wt[c] = wt;
      const z1 = this.bed[c] - SKIN_M / 2 - wt;
      const z2 = this.bed[c] - SKIN_M - DEEP_M / 2 - wt;
      this.zc1[c] = z1;
      this.zc2[c] = z2;
      // A cell whose skin sits in the capillary fringe or under the water
      // table is saturated for good: it takes no water and gives none.
      this.cap1[c] = z1 > soil.psiBM ? dTheta * SKIN_M : 0;
      this.cap2[c] = z1 > soil.psiBM ? dTheta * DEEP_M : 0;
    }
    this.h = new Float64Array(n);
    this.hu = new Float64Array(n);
    this.hv = new Float64Array(n);
    this.w1 = new Float64Array(n);
    this.w2 = new Float64Array(n);
    this.foam = new Float64Array(n);
    this.strand = new Float64Array(n);
    this.mark = new Float64Array(n);
    this.sed = new Float64Array(n);
    this.wetAge = new Float64Array(n);
    this.foamAge = new Float64Array(n);
    this.dh = new Float64Array(n);
    this.dhu = new Float64Array(n);
    this.dhv = new Float64Array(n);
    this.u = new Float64Array(n);
    this.v = new Float64Array(n);
    this.etaPrev = new Float64Array(n);
    this.riseRate = new Float64Array(n);
    this.infilRate = new Float64Array(n);
    this.foamTmp = new Float64Array(n);
    this.strandTmp = new Float64Array(n);
    this.sedTmp = new Float64Array(n);
    this.ageTmp = new Float64Array(n);
    this.boreAdd = new Float64Array(n);
    this.reach = new Int32Array(g.na).fill(g.ns);
    this.shoreIndex = new Int32Array(g.na);
    this.tipU = new Float64Array(g.na);
    for (let j = 0; j < g.na; j += 1) {
      let i = 0;
      while (i < g.ns - 1 && this.bed[j * g.ns + i] < 0) i += 1;
      this.shoreIndex[j] = i;
    }
    this.lim = new Int32Array(g.na);
    this.edgeDepth = new Float64Array(g.na);
    this.edgeEta = new Float64Array(g.na);
    for (let j = 0; j < g.na; j += 1) this.edgeDepth[j] = Math.max(-this.bed[j * g.ns], 0.05);
    this.reset();
  }

  /**
   * THE FIXED START (t = 0): the sea at rest at its mean level, no sheet, and
   * the sand in hydrostatic equilibrium with the water table (saturated in the
   * capillary fringe, drier with height over it). The waves start at t = 0.
   */
  reset(): void {
    const n = this.ns * this.na;
    for (let c = 0; c < n; c += 1) {
      this.h[c] = this.wall !== null && this.wall[c] !== 0 ? 0 : Math.max(-this.bed[c], 0);
      this.hu[c] = 0;
      this.hv[c] = 0;
      this.w1[c] = this.cap1[c] * equilibriumSaturation(this.soil, this.zc1[c]);
      this.w2[c] = this.cap2[c] * equilibriumSaturation(this.soil, this.zc2[c]);
      this.foam[c] = 0;
      this.strand[c] = 0;
      this.mark[c] = 0;
      this.sed[c] = 0;
      this.wetAge[c] = this.h[c] > this.p.hDryM ? 0 : 600;
      this.etaPrev[c] = this.bed[c] + this.h[c];
    }
    this.step = 0;
    const l = this.ledger;
    l.arrived = 0; l.inflow = 0; l.outflow = 0; l.infiltrated = 0; l.drained = 0; l.evaporated = 0; l.clipped = 0;
    this.infilRate.fill(0);
    this.reach.fill(this.ns);
    this.tipU.fill(0);
  }

  /** Sheet volume on the grid, m^3 (all water over the bed). */
  sheetVolume(mask?: (c: number) => boolean): number {
    let v = 0;
    for (let c = 0; c < this.h.length; c += 1) if (!mask || mask(c)) v += this.h[c];
    return v * this.cellArea;
  }

  /** Water held in the sand's two stores, m^3. */
  soakedVolume(mask?: (c: number) => boolean): number {
    let v = 0;
    for (let c = 0; c < this.h.length; c += 1) if (!mask || mask(c)) v += this.w1[c] + this.w2[c];
    return v * this.cellArea;
  }

  /** Skin saturation of cell c, 0 to 1 (1 under the water table). */
  skinSaturation(c: number): number {
    return this.cap1[c] > 0 ? this.w1[c] / this.cap1[c] : 1;
  }

  /** Advance one fixed step of `dt`. */
  advance(): void {
    const { ns, na, ds, da, dt, bed, h, hu, hv, u, v, dh, dhu, dhv, reach, wall } = this;
    const lim = this.lim;
    const hDry = this.p.hDryM;
    const subHR = this.subcellHR;
    const tNow = this.step * dt;
    this.incident(tNow, this.edgeEta);

    // THE ACTIVE RANGE. `reach[j]` is one past the last wet cell of row j
    // after the last step. The Courant number stays under 1, so no water
    // passes more than one cell in a step: every face and cell beyond
    // reach + 1 is dry and stays dry, and the loops stop there. On the
    // judged sea the upper beach is dry most of the time, and this halves
    // the work.
    let maxSpeedS = 0;
    let maxSpeedA = 0;
    let inflow = 0;
    let outflow = 0;
    const invDs = 1 / ds;
    const invDa = 1 / da;
    for (let j = 0; j < na; j += 1) {
      const row = j * ns;
      const end = Math.min(Math.max(reach[j], j > 0 ? reach[j - 1] : 0, j < na - 1 ? reach[j + 1] : 0) + 2, ns);
      lim[j] = end;
      for (let i = 0; i < end; i += 1) {
        const c = row + i;
        dh[c] = 0;
        dhu[c] = 0;
        dhv[c] = 0;
      }
    }

    // ---- faces across s (the cross-shore direction) --------------------
    for (let j = 0; j < na; j += 1) {
      const row = j * ns;
      const end = lim[j];
      // THE SEA EDGE (face 0): an absorbing-generating boundary (Kobayashi,
      // Otta and Roy 1987). The incoming characteristic u + 2c carries the
      // incident wave in; the outgoing one, u - 2c, is taken from the first
      // cell, so a reflected wave leaves the grid instead of bouncing back.
      // The ghost's bed is the first cell's (a flat extension), so the face
      // needs no reconstruction.
      // River mouth round 1: a row whose sea cell is a wall takes no sea.
      if (wall === null || wall[row] === 0) {
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
        hllFace(hg, ug, v[c0], h1, u[c0], v[c0]);
        dh[c0] += fH * invDs;
        dhu[c0] += fN * invDs;
        dhv[c0] += fT * invDs;
        if (fH > 0) inflow += fH * dt * da; else outflow -= fH * dt * da;
        if (fS > maxSpeedS) maxSpeedS = fS;
      }
      const iEnd = end < ns ? end : ns;
      for (let i = 1; i < iEnd; i += 1) {
        const cL = row + i - 1;
        const cR = cL + 1;
        const hL = h[cL];
        const hR = h[cR];
        if (hL <= hDry && hR <= hDry) continue;
        // RIVER MOUTH ROUND 1: A WALL CELL belongs to the mouth's grid
        // (`oceanMouthMath.ts`), which owns the water of the river's valley.
        // The face is a wall: the mirror state gives no mass flux and the
        // pressure the wall pushes back with, as at the grid's own edges.
        // Without walls (every beach before the mouth) the branch never runs.
        if (wall !== null && (wall[cL] | wall[cR]) !== 0) {
          if (wall[cL] === 0 && hL > hDry) {
            hllFace(hL, u[cL], v[cL], hL, -u[cL], v[cL]);
            dhu[cL] -= fN * invDs;
          } else if (wall[cR] === 0 && hR > hDry) {
            hllFace(hR, -u[cR], v[cR], hR, u[cR], v[cR]);
            dhu[cR] += fN * invDs;
          }
          continue;
        }
        const zL = bed[cL];
        const zR = bed[cR];
        if (subHR) {
          // ROUND 20 (the match): THE SUBCELL RECONSTRUCTION of Chen and
          // Noelle (2017). Audusse's step puts the face's bed at the higher
          // cell's bed, so a film thinner than the bed's step per cell (here
          // 0.125 m x 1/11 = 11 mm) meets the face as dry and its weight
          // pushes it down the slope with 0.5 g h^2 in place of g h dz: a
          // 1 mm backwash film felt 4% of gravity's pull along the face
          // (Delestre et al. 2012 name this limit of the scheme). Here the
          // face's bed is clamped to the lower of the two water surfaces, and
          // each half cell takes the bed's slope force g (h + h*) / 2 dz, so
          // the film feels the whole slope. A lake at rest stays at rest (the
          // terms are Audusse's where both sides are wet over the step).
          const wL = hL + zL;
          const wR = hR + zR;
          let zs = zL > zR ? zL : zR;
          const wm = wL < wR ? wL : wR;
          if (zs > wm) zs = wm;
          let hLs = wL - zs; if (hLs > hL) hLs = hL;
          let hRs = wR - zs; if (hRs > hR) hRs = hR;
          hllFace(hLs, u[cL], v[cL], hRs, u[cR], v[cR]);
          dh[cL] -= fH * invDs;
          dh[cR] += fH * invDs;
          dhu[cL] -= (fN + 0.5 * G * (hL + hLs) * (zs - zL)) * invDs;
          dhu[cR] += (fN + 0.5 * G * (hR + hRs) * (zs - zR)) * invDs;
          dhv[cL] -= fT * invDs;
          dhv[cR] += fT * invDs;
          if (fS > maxSpeedS) maxSpeedS = fS;
          continue;
        }
        const zM = zL > zR ? zL : zR;
        let hLs = hL + zL - zM; if (hLs < 0) hLs = 0;
        let hRs = hR + zR - zM; if (hRs < 0) hRs = 0;
        hllFace(hLs, u[cL], v[cL], hRs, u[cR], v[cR]);
        dh[cL] -= fH * invDs;
        dh[cR] += fH * invDs;
        dhu[cL] -= (fN + 0.5 * G * (hL * hL - hLs * hLs)) * invDs;
        dhu[cR] += (fN + 0.5 * G * (hR * hR - hRs * hRs)) * invDs;
        dhv[cL] -= fT * invDs;
        dhv[cR] += fT * invDs;
        if (fS > maxSpeedS) maxSpeedS = fS;
      }
      // The landward edge (face ns) is a wall: the mirror state gives zero
      // mass flux and the pressure the wall pushes back with.
      if (end >= ns) {
        const c1 = row + ns - 1;
        const h1 = h[c1];
        if (h1 > hDry) {
          hllFace(h1, u[c1], v[c1], h1, -u[c1], v[c1]);
          dhu[c1] -= fN * invDs;
        }
      }
    }

    // ---- faces across a (alongshore) ------------------------------------
    for (let j = 1; j < na; j += 1) {
      const rowL = (j - 1) * ns;
      const rowR = j * ns;
      const end = lim[j] < lim[j - 1] ? lim[j] : lim[j - 1];
      for (let i = 0; i < end; i += 1) {
        const cL = rowL + i;
        const cR = rowR + i;
        const hL = h[cL];
        const hR = h[cR];
        if (hL <= hDry && hR <= hDry) continue;
        // River mouth round 1: a wall cell (see the faces across s).
        if (wall !== null && (wall[cL] | wall[cR]) !== 0) {
          if (wall[cL] === 0 && hL > hDry) {
            hllFace(hL, v[cL], u[cL], hL, -v[cL], u[cL]);
            dhv[cL] -= fN * invDa;
          } else if (wall[cR] === 0 && hR > hDry) {
            hllFace(hR, -v[cR], u[cR], hR, v[cR], u[cR]);
            dhv[cR] += fN * invDa;
          }
          continue;
        }
        const zL = bed[cL];
        const zR = bed[cR];
        if (subHR) {
          // Round 20: the subcell reconstruction along the shore (as across it).
          const wL = hL + zL;
          const wR = hR + zR;
          let zs = zL > zR ? zL : zR;
          const wm = wL < wR ? wL : wR;
          if (zs > wm) zs = wm;
          let hLs = wL - zs; if (hLs > hL) hLs = hL;
          let hRs = wR - zs; if (hRs > hR) hRs = hR;
          hllFace(hLs, v[cL], u[cL], hRs, v[cR], u[cR]);
          dh[cL] -= fH * invDa;
          dh[cR] += fH * invDa;
          dhv[cL] -= (fN + 0.5 * G * (hL + hLs) * (zs - zL)) * invDa;
          dhv[cR] += (fN + 0.5 * G * (hR + hRs) * (zs - zR)) * invDa;
          dhu[cL] -= fT * invDa;
          dhu[cR] += fT * invDa;
          if (fS > maxSpeedA) maxSpeedA = fS;
          continue;
        }
        const zM = zL > zR ? zL : zR;
        let hLs = hL + zL - zM; if (hLs < 0) hLs = 0;
        let hRs = hR + zR - zM; if (hRs < 0) hRs = 0;
        hllFace(hLs, v[cL], u[cL], hRs, v[cR], u[cR]);
        dh[cL] -= fH * invDa;
        dh[cR] += fH * invDa;
        dhv[cL] -= (fN + 0.5 * G * (hL * hL - hLs * hLs)) * invDa;
        dhv[cR] += (fN + 0.5 * G * (hR * hR - hRs * hRs)) * invDa;
        dhu[cL] -= fT * invDa;
        dhu[cR] += fT * invDa;
        if (fS > maxSpeedA) maxSpeedA = fS;
      }
    }
    // The two alongshore ends are walls, as the landward edge.
    for (let e = 0; e < 2; e += 1) {
      const j = e === 0 ? 0 : na - 1;
      const row = j * ns;
      const end = lim[j];
      for (let i = 0; i < end; i += 1) {
        const c = row + i;
        const hc = h[c];
        if (hc <= hDry) continue;
        if (e === 1) {
          hllFace(hc, v[c], u[c], hc, -v[c], u[c]);
          dhv[c] -= fN * invDa;
        } else {
          hllFace(hc, -v[c], u[c], hc, v[c], u[c]);
          dhv[c] += fN * invDa;
        }
      }
    }

    this.lastCourant = (maxSpeedS * dt) / ds + (maxSpeedA * dt) / da;
    this.ledger.inflow += inflow;
    this.ledger.outflow += outflow;
    this.ledger.arrived += inflow - outflow;

    // ---- update: flux divergence, positivity, friction, infiltration ----
    // The velocities and the surface's rise rate for the next step are
    // written here too, so no other pass over the grid is needed.
    const n2g = G * this.p.manningN * this.p.manningN;
    const lamNu = this.p.laminarNuM2S ?? 0;
    const cellA = this.cellArea;
    const w1 = this.w1;
    const cap1 = this.cap1;
    const infilRate = this.infilRate;
    const etaPrev = this.etaPrev;
    const riseRate = this.riseRate;
    const invDt = 1 / dt;
    let clipped = 0;
    let infil = 0;
    for (let j = 0; j < na; j += 1) {
      const row = j * ns;
      const end = lim[j];
      let last = -1;
      for (let i = 0; i < end; i += 1) {
        const c = row + i;
        let hn = h[c] + dt * dh[c];
        let mu = hu[c] + dt * dhu[c];
        let mv = hv[c] + dt * dhv[c];
        if (hn < 0) {
          clipped -= hn;
          hn = 0;
        }
        if (hn > hDry) {
          // Manning friction, semi-implicit: tau/rho = g n^2 |U| U / h^(1/3).
          const sp = Math.sqrt(mu * mu + mv * mv) / hn;
          let k = 1 + (dt * n2g * sp) / (hn * Math.cbrt(hn));
          if (lamNu > 0) {
            // Round 20 (the match): THE FLOW REGIME. A film's Reynolds number
            // Re = U h / nu; open-channel flow is laminar under 500 and
            // turbulent over 2000 (Chow 1959, section 1-3). Laminar, the bed
            // stress is the parabolic film's 3 nu U / h (a rate 3 nu / h^2);
            // turbulent, Manning's; between, the two rates mix by log Re.
            // A 1 mm backwash film at 0.3 m/s is laminar (Re 290).
            const re = (sp * hn) / lamNu;
            const kt = k - 1;
            const kl = (dt * 3 * lamNu) / (hn * hn);
            const w = re <= 500 ? 0 : re >= 2000 ? 1 : Math.log(re / 500) / Math.log(4);
            k = 1 + kl + (kt - kl) * w;
          }
          mu /= k;
          mv /= k;
          // The sheet soaks into the skin at the rate the slow update set.
          const f = infilRate[c];
          if (f > 0) {
            const room = cap1[c] - w1[c];
            let take = f * dt;
            if (take > hn) take = hn;
            if (take > room) take = room;
            if (take > 0) {
              const keep = (hn - take) / hn;
              hn -= take;
              mu *= keep;
              mv *= keep;
              w1[c] += take;
              infil += take;
            }
          }
        } else {
          mu = 0;
          mv = 0;
          // A film thinner than hDry soaks in whole where the skin has room;
          // under the water table it stays, booked, until the sea takes it.
          if (hn > 0) {
            const room = cap1[c] - w1[c];
            if (room > 0) {
              const take = hn < room ? hn : room;
              hn -= take;
              w1[c] += take;
              infil += take;
            }
          }
        }
        h[c] = hn;
        hu[c] = mu;
        hv[c] = mv;
        if (hn > hDry) {
          u[c] = mu / hn;
          v[c] = mv / hn;
          last = i;
        } else {
          u[c] = 0;
          v[c] = 0;
        }
        const eta = bed[c] + hn;
        riseRate[c] = (eta - etaPrev[c]) * invDt;
        etaPrev[c] = eta;
      }
      reach[j] = last + 1;
    }
    this.ledger.clipped += clipped * cellA;
    this.ledger.infiltrated += infil * cellA;

    this.step += 1;
    if (this.step % this.p.slowEvery === 0) this.slowUpdate(this.p.slowEvery * dt);
  }

  /**
   * THE SLOW PART, every `slowEvery` steps: the sand's two stores exchange
   * water and drain; the infiltration capacity for the next steps is set;
   * the foam rides, is born and pops; the swash mark fades.
   */
  private slowUpdate(dtm: number): void {
    const { ns, na, h, w1, w2, cap1, cap2, zc2 } = this;
    const soil = this.soil;
    const tab = this.tables;
    const n = ns * na;
    const dz12 = (SKIN_M + DEEP_M) / 2;
    const cellA = this.cellArea;
    const hDry = this.p.hDryM;
    let drained = 0;
    let evap = 0;
    for (let c = 0; c < n; c += 1) {
      const c1 = cap1[c];
      if (c1 <= 0) {
        this.infilRate[c] = 0;
        continue;
      }
      const c2 = cap2[c];
      const se1 = w1[c] / c1;
      const se2 = w2[c] / c2;
      const psi1 = tab.psiAt(se1);
      const psi2 = tab.psiAt(se2);
      // SKIN TO DEEP: Darcy across the half-layers, head difference over the
      // distance, with the conductivity of the store the water leaves.
      const grad = 1 + (psi2 - psi1) / dz12;
      let q12 = grad > 0 ? tab.kAt(se1) * grad : tab.kAt(se2) * grad;
      // DEEP TO THE WATER TABLE: the store's center stands zc2 over it.
      const zc = Math.max(zc2[c], 0.05);
      let q2 = tab.kAt(se2) * (zc - psi2) / Math.max(zc, DEEP_M);
      // EVAPORATION from the skin, falling with its wetness.
      let e = soil.evapMS * se1;
      // Limit each flux to what the stores hold and have room for, then apply
      // exactly what was limited, so the ledger closes to rounding.
      let a1 = w1[c];
      let a2 = w2[c];
      let dE = e * dtm; if (dE > a1) dE = a1;
      a1 -= dE;
      let d12 = q12 * dtm;
      if (d12 > 0) {
        if (d12 > a1) d12 = a1;
        if (d12 > c2 - a2) d12 = c2 - a2;
      } else {
        if (-d12 > a2) d12 = -a2;
        if (-d12 > c1 - a1) d12 = -(c1 - a1);
      }
      a1 -= d12;
      a2 += d12;
      let d2 = q2 * dtm;
      if (d2 > a2) d2 = a2;
      if (-d2 > c2 - a2) d2 = -(c2 - a2);
      a2 -= d2;
      w1[c] = a1;
      w2[c] = a2;
      drained += d2;
      evap += dE;
      q12 = d12 / dtm;
      q2 = d2 / dtm;
      e = dE / dtm;
      // THE INTAKE for the next steps: Green-Ampt at the skin (Ks times one
      // plus the ponded head and the wetting-front suction over the skin's
      // half depth; the suction falls as the skin fills), and never more than
      // the skin can pass down once it is full.
      const se1n = a1 / c1;
      const head = (h[c] + soil.psiFM * (1 - se1n)) / (SKIN_M / 2);
      this.infilRate[c] = se1n < 0.999 ? soil.ksMS * (1 + head) : Math.max(q12, 0);
    }
    this.ledger.drained += drained * cellA;
    this.ledger.evaporated += evap * cellA;
    this.foamUpdate(dtm, hDry);
  }

  /** The foam: born where a bore rises, carried with the water, popped with time; stranded on the sand. */
  private foamUpdate(dtm: number, hDry: number): void {
    const { ns, na, h, u, v, foam, strand, mark, ds, da } = this;
    const n = ns * na;
    const p = this.p;
    const fTmp = this.foamTmp;
    const sTmp = this.strandTmp;
    const decay = Math.exp(-dtm / p.foamLifeS);
    const decayThin = Math.exp(-dtm / p.foamThinLifeS);
    const decayS = Math.exp(-dtm / p.foamStrandLifeS);
    const decayM = Math.exp(-dtm / p.markLifeS);
    // Semi-Lagrangian: each wet cell reads the foam where its water came from.
    for (let j = 0; j < na; j += 1) {
      for (let i = 0; i < ns; i += 1) {
        const c = j * ns + i;
        if (h[c] <= hDry) {
          fTmp[c] = 0;
          continue;
        }
        const x = i - (u[c] * dtm) / ds;
        const y = j - (v[c] * dtm) / da;
        fTmp[c] = bilinear(foam, ns, na, x, y);
        this.sedTmp[c] = bilinear(this.sed, ns, na, x, y);
        this.ageTmp[c] = bilinear(this.foamAge, ns, na, x, y);
      }
    }
    // THE SAND IN THE WATER: pickup over the threshold speed, settling out
    // of the column at ws / h; a dry cell has let it all down.
    {
      const sed = this.sedTmp;
      const kP = p.sedPickupK;
      const uc2 = p.sedCritUMS * p.sedCritUMS;
      for (let c = 0; c < n; c += 1) {
        const hc = h[c];
        if (hc <= hDry) {
          sed[c] = 0;
          continue;
        }
        const u2 = u[c] * u[c] + v[c] * v[c];
        const hh = Math.max(hc, 0.002);
        let cs = sed[c] + (u2 > uc2 ? (kP * (u2 - uc2) * dtm) / hh : 0);
        cs *= Math.exp((-p.sedSettleMS * dtm) / hh);
        sed[c] = cs;
      }
      this.sed.set(sed);
    }
    const boreFoam = p.boreFoam === true;
    if (boreFoam) this.boreFoamSource(dtm, hDry);
    for (let c = 0; c < n; c += 1) {
      const wet = h[c] > hDry;
      let f = fTmp[c];
      if (wet) {
        const cw = Math.sqrt(G * Math.max(h[c], 1e-4));
        const over = this.riseRate[c] - p.foamBreakK * cw;
        // The age: one step older; new foam pulls it toward 0 by its share.
        let age = Math.min(this.ageTmp[c] + dtm, FOAM_AGE_MAX_S);
        if (over > 0) {
          // Round 20 (the match): the bore's own energy loss (boreFoamSource);
          // the default keeps the fitted gain.
          const add = boreFoam ? this.boreAdd[c] : (p.foamGain * over * dtm) / Math.max(cw, 0.05);
          age *= f / Math.max(f + add, 1e-9);
          f += add;
        }
        this.foamAge[c] = age;
        // Deep water loses its foam fastest; a thin sheet keeps it.
        const thin = Math.min(Math.max((0.3 - h[c]) / 0.25, 0), 1);
        f *= decay + (decayThin - decay) * thin;
        if (f > 1) f = 1;
        // Stranded foam and the mark under a sheet are lifted back into it.
        f = Math.max(f, strand[c] * 0.6);
        sTmp[c] = 0;
        this.wetAge[c] = 0;
      } else {
        // THE SHEET LEFT THIS CELL: its foam stays on the sand.
        sTmp[c] = Math.max(strand[c] * decayS, foam[c]);
        f = 0;
        this.foamAge[c] = 0;
        this.wetAge[c] = Math.min(this.wetAge[c] + dtm, 600);
      }
      fTmp[c] = f;
      mark[c] = wet && h[c] > 0.01 ? mark[c] * 0.8 : mark[c] * decayM;
    }
    foam.set(fTmp);
    strand.set(sTmp);
    // THE SWASH MARK: where an uprush stops. The tip of each row is its last
    // cell with a sheet; when the tip's velocity turns from onshore to
    // offshore, the sheet has reached its highest point for this swash, and
    // the fine grains and foam scum it carried stay there as a line. Only
    // above the still-water line; a sheet over 1 cm deep washes it out again.
    for (let j = 0; j < na; j += 1) {
      const tip = this.reach[j] - 1;
      if (tip < this.shoreIndex[j]) {
        this.tipU[j] = 0;
        continue;
      }
      const c = j * ns + tip;
      const ut = u[c];
      if (this.tipU[j] > 0.02 && ut <= 0.02) {
        mark[c] = 1;
        if (tip > 0) mark[c - 1] = Math.max(mark[c - 1], 0.4);
      }
      this.tipU[j] = ut;
    }
  }

  /**
   * ROUND 20 (the match): THE FOAM A BORE MAKES, FROM ITS ENERGY LOSS. A bore
   * is a moving hydraulic jump (Stoker 1957); Battjes and Janssen (1978) and
   * Thornton and Guza (1983) take a breaking wave's dissipation from that
   * analogy. The jump destroys the share
   *   L = dH / E1 = (h2 - h1)^3 / (h2 (4 h1^2 + h2 (h1 + h2)))
   * of the energy the water ahead brings into it, in the bore's frame
   * (Belanger's head loss (h2 - h1)^3 / (4 h1 h2) over the specific energy
   * h1 + V1^2 / 2g, V1^2 = g h2 (h1 + h2) / 2 h1): 0 for a vanishing step,
   * 0.05 for a bore twice the depth ahead, 1 as the water ahead thins to
   * nothing (a bore that collapses on the film the last backwash left).
   * Callaghan, Deane and Stokes (2016) measured the time-integrated foam area
   * of a breaker linear in the energy it dissipated; here the jump whitens the
   * share L of each cell it passes, spread over the passage by the cell's
   * share of the rise (the scheme spreads a bore's front over two to four
   * cells; each cell rises by the whole step once). No gain is fitted.
   *
   * A front: a run of wet cells along s whose surface rises faster than
   * Kennedy et al.'s (2000) 0.15 sqrt(g h). The step is the highest surface
   * in the run and the cell behind it, over the surface of the cell ahead.
   * A front that runs onto DRY sand is not a jump: the wet-dry tip of a
   * run-up is the rarefaction's edge (Ritter's dam-break tip), with no shock
   * and no breaking, so it makes no foam (the foam there rode up from the
   * bore).
   */
  private boreFoamSource(dtm: number, hDry: number): void {
    const { ns, na, h, bed, riseRate, boreAdd } = this;
    const kB = this.p.foamBreakK;
    boreAdd.fill(0);
    for (let j = 0; j < na; j += 1) {
      const row = j * ns;
      let i = 0;
      while (i < ns) {
        const c = row + i;
        const hc = h[c];
        if (!(hc > hDry && riseRate[c] > kB * Math.sqrt(G * Math.max(hc, 1e-4)))) { i += 1; continue; }
        const i0 = i;
        let i1 = i;
        while (i1 + 1 < ns) {
          const cn = row + i1 + 1;
          const hn = h[cn];
          if (hn > hDry && riseRate[cn] > kB * Math.sqrt(G * Math.max(hn, 1e-4))) i1 += 1; else break;
        }
        i = i1 + 1;
        if (i1 + 1 >= ns) continue;
        const ca = row + i1 + 1;
        const h1 = h[ca];
        if (h1 <= hDry) continue;
        const etaAhead = bed[ca] + h1;
        let etaBehind = -Infinity;
        for (let q = Math.max(i0 - 1, 0); q <= i1; q += 1) {
          const e = bed[row + q] + h[row + q];
          if (e > etaBehind) etaBehind = e;
        }
        const step = etaBehind - etaAhead;
        if (!(step > 0)) continue;
        const h2 = h1 + step;
        const loss = (step * step * step) / (h2 * (4 * h1 * h1 + h2 * (h1 + h2)));
        for (let q = i0; q <= i1; q += 1) boreAdd[row + q] = (loss * riseRate[row + q] * dtm) / step;
      }
    }
  }

  /** A snapshot of the whole state (for the checkpoints of `BeachClock`). */
  snapshot(debris: Float64Array): SwashState {
    return {
      step: this.step,
      h: this.h.slice(),
      hu: this.hu.slice(),
      hv: this.hv.slice(),
      w1: this.w1.slice(),
      w2: this.w2.slice(),
      foam: this.foam.slice(),
      strand: this.strand.slice(),
      mark: this.mark.slice(),
      sed: this.sed.slice(),
      wetAge: this.wetAge.slice(),
      foamAge: this.foamAge.slice(),
      infil: this.infilRate.slice(),
      tipU: this.tipU.slice(),
      ledger: { ...this.ledger },
      debris: debris.slice(),
    };
  }

  /** Put a snapshot back. The derived per-step arrays are rebuilt from it. */
  restore(s: SwashState): void {
    this.h.set(s.h); this.hu.set(s.hu); this.hv.set(s.hv);
    this.w1.set(s.w1); this.w2.set(s.w2);
    this.foam.set(s.foam); this.strand.set(s.strand); this.mark.set(s.mark); this.wetAge.set(s.wetAge);
    this.foamAge.set(s.foamAge);
    this.sed.set(s.sed);
    Object.assign(this.ledger, s.ledger);
    this.step = s.step;
    const n = this.ns * this.na;
    const hDry = this.p.hDryM;
    for (let c = 0; c < n; c += 1) {
      this.etaPrev[c] = this.bed[c] + this.h[c];
      // The velocities the next step reads, as the last step wrote them.
      const hc = this.h[c];
      this.u[c] = hc > hDry ? this.hu[c] / hc : 0;
      this.v[c] = hc > hDry ? this.hv[c] / hc : 0;
    }
    this.infilRate.set(s.infil);
    this.tipU.set(s.tipU);
    // A full active range: the skipped faces carry no flux, so a wider
    // range than needed changes nothing.
    this.reach.fill(this.ns);
  }

  /** Velocity (along s, along a) of cell c, m/s; 0 when dry. */
  velocityAt(c: number): [number, number] {
    const hc = this.h[c];
    return hc > this.p.hDryM ? [this.hu[c] / hc, this.hv[c] / hc] : [0, 0];
  }
}

/**
 * RIVER MOUTH ROUND 1: THE SAME FACE FLUX for the mouth's grid
 * (`oceanMouthMath.ts`), so the swash and the river mouth step one scheme:
 * `hllFaceInto` runs `hllFace` and copies its four results (mass, normal
 * momentum, tangential momentum, fastest signal speed) into `HLL_OUT`.
 */
export const HLL_OUT = new Float64Array(4);
export function hllFaceInto(hL: number, unL: number, utL: number, hR: number, unR: number, utR: number): void {
  hllFace(hL, unL, utL, hR, unR, utR);
  HLL_OUT[0] = fH; HLL_OUT[1] = fN; HLL_OUT[2] = fT; HLL_OUT[3] = fS;
}

/* The HLL face flux, written to three module scalars so the hot loop makes no
 * object. Inputs: the two reconstructed depths, their normal velocities and
 * their tangential velocities. */
let fH = 0;
let fN = 0;
let fT = 0;
/** The face's fastest signal speed, m/s, for the Courant number. */
let fS = 0;
function hllFace(hL: number, unL: number, utL: number, hR: number, unR: number, utR: number): void {
  const DRY = 1e-10;
  if (hL <= DRY && hR <= DRY) {
    fH = 0; fN = 0; fT = 0; fS = 0;
    return;
  }
  const cL = Math.sqrt(G * hL);
  const cR = Math.sqrt(G * hR);
  let sL: number;
  let sR: number;
  if (hL <= DRY) {
    sL = unR - 2 * cR;
    sR = unR + cR;
  } else if (hR <= DRY) {
    sL = unL - cL;
    sR = unL + 2 * cL;
  } else {
    sL = Math.min(unL - cL, unR - cR);
    sR = Math.max(unL + cL, unR + cR);
  }
  fS = sR > -sL ? sR : -sL;
  const qL = hL * unL;
  const qR = hR * unR;
  const pL = qL * unL + 0.5 * G * hL * hL;
  const pR = qR * unR + 0.5 * G * hR * hR;
  if (sL >= 0) {
    fH = qL; fN = pL;
  } else if (sR <= 0) {
    fH = qR; fN = pR;
  } else {
    const inv = 1 / (sR - sL);
    fH = (sR * qL - sL * qR + sL * sR * (hR - hL)) * inv;
    fN = (sR * pL - sL * pR + sL * sR * (qR - qL)) * inv;
  }
  // The tangential momentum rides with the mass flux, upwind.
  fT = fH > 0 ? fH * utL : fH * utR;
}

/** Bilinear read of a cell array at fractional cell indices (clamped at the edges). */
export function bilinear(arr: Float64Array, ns: number, na: number, x: number, y: number): number {
  const xc = Math.min(Math.max(x, 0), ns - 1);
  const yc = Math.min(Math.max(y, 0), na - 1);
  const i0 = Math.min(Math.floor(xc), ns - 2);
  const j0 = Math.min(Math.floor(yc), na - 2);
  const fx = xc - i0;
  const fy = yc - j0;
  const c = j0 * ns + i0;
  return (arr[c] * (1 - fx) + arr[c + 1] * fx) * (1 - fy) + (arr[c + ns] * (1 - fx) + arr[c + ns + 1] * fx) * fy;
}
/** The foam's age is capped here, s (round 7): past it the look draws it all as old. */
export const FOAM_AGE_MAX_S = 30;
