/**
 * @file oceanSplashPool.ts
 * The complete deterministic splash particle pool and its original state contract.
 * Emission, breakup, integration, landing and random draw order stay in one class.
 * The old oceanSplashMath facade preserves every former public import.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:00:50
 * Dependents: systems/world3d/ocean/oceanSplashMath.ts, systems/world3d/ocean/oceanSplashVolume.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type SplashKindSpec, type SplashShedSpec, type SplashSheetLedger, SPLASH_KINDS, SPLASH_SHED_DEFAULT, SPLASH_SHEET, SPLASH_WATER_RHO, SPLASH_MIST, splashDragPerSpeed, splashTurbulentSigma, splashCapillarySpeed, SPLASH_LIGAMENT, splashCoupledStableDrop, SPLASH_STABLE_DROP_M, splashLigamentDiameter, splashStokesDiameter, splashGammaVolumeBelow, splashCappedDropLaw, splashSauterDiameter, SPLASH_DROP, SPLASH_GAMMA_N, SPLASH_WE_CRIT, SPLASH_WATER_SIGMA, SPLASH_AIR_RHO, splashTerminalSpeedMs, splashBreakupTimeS, SPLASH_BREAK_MIN_SHARE, SPLASH_BREAK_RING_SHARE, SPLASH_BREAK_RING_D, SPLASH_BREAK_BAG_D, SPLASH_AIR_CELL_M, splashCoupledShare, splashBubbleMist, SPLASH_JET_DROP_MS, SPLASH_DROP_MAX_S, SPLASH_RIM_PIECES, splashBubbleRaftM2, splashSpanningHoles, SPLASH_SHEET_GONE_X } from './oceanSplashLaws';


export interface SplashPoolOptions {
  /** The kinds' numbers (default SPLASH_KINDS), indexed by SPLASH_SHEET and the others. */
  readonly kinds?: readonly SplashKindSpec[];
  /** The shedding (default SPLASH_SHED_DEFAULT). */
  readonly shed?: SplashShedSpec;
}

/** The small generator of the buoy burst, 0 to 1. */
export class SplashRng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 4294967296;
  }
  reset(seed: number): void { this.s = seed >>> 0; }
}

/** What the pool asks the caller while it steps. */
export interface SplashEnv {
  /** The air's velocity at a point a meter or more over the water, m/s (x, z). */
  readonly airX: number;
  readonly airZ: number;
  /**
   * The share of that air's velocity at a point, 0 to 1 (round 4). Optional
   * (1 everywhere when absent): a solid slows the air round it (the rocks'
   * stagnation zone in front of a windward face).
   */
  airShare?(owner: number, x: number, y: number, z: number): number;
  /** The sea's height under (x, z) for the owner's particles, meters. */
  seaHeight(owner: number, x: number, z: number): number;
  /**
   * Whether (x, y, z) is inside the owner's solid (a rock). Optional. A
   * particle that falls into it has landed on the solid.
   */
  inSolid?(owner: number, x: number, y: number, z: number): boolean;
  /**
   * A particle reached the sea: its point, its drawn size, its kind. Optional (foam, the sea's own).
   * Round 12: and the foam raft its bubbles make, m^2 (splashBubbleRaftM2; 0 for a parcel with no air).
   */
  onSea?(owner: number, x: number, z: number, sizeM: number, kind: number, raftM2?: number): void;
  /** A particle landed on the solid. Optional (water on a rock's top, a wet face). */
  onSolid?(owner: number, x: number, y: number, z: number, sizeM: number, kind: number): void;
}

/** The pool. Structure of arrays; `aliveIndex[0 .. alive)` lists the live slots in a stable order. */
export class SplashPool {
  readonly capacity: number;
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly size0: Float32Array;
  readonly kind: Uint8Array;
  readonly owner: Uint8Array;
  readonly seedV: Float32Array;
  /** Per particle, the caller's opacity (1 unless the emit gave one); children inherit it. */
  readonly opacity: Float32Array;
  /**
   * Round 6: per particle, the MASS of water it carries, kg (0 for a
   * particle that carries none: the volume does not see it). A parent's
   * mass is shared among its children, so the pool keeps the water thrown.
   */
  readonly mass: Float32Array;
  /**
   * Round 6: per particle, the interfacial area per volume of its water,
   * 1/m (a sheet 2 / h, a ligament 4 / d, drops 6 / D32, bubbles 6 / D_b;
   * see SPLASH_CAUCHY). 0 for a particle with no physical size: it keeps
   * its kind's relaxation drag.
   */
  readonly areaV: Float32Array;
  /**
   * Round 6: per particle, its own length scale, meters: a sheet's
   * thickness, a strand's or a drop's diameter, an aerated lump's size. The
   * drag takes a sphere of this diameter, and a child is never torn thicker
   * than it.
   */
  readonly scaleM: Float32Array;
  /**
   * Round 6: per particle, the speed its pieces spread at, m/s: the
   * capillary speed of its own size (splashCapillarySpeed), or round 5's
   * jitter share of its speed for a particle with no physical size.
   */
  readonly spreadMs: Float32Array;
  /**
   * Round 6: 1 for aerated BULK water (a roller's lump, foam-like: bubbles
   * of 1 mm in a lump of 15 to 30 cm), a continuum at the volume grid's
   * scale. Its children are drops and strands, not bulk.
   */
  readonly bulk: Uint8Array;
  /**
   * Round 7: the puncture state of an aerated sheet (THE SHEET'S BREAK-UP):
   * its void share (0: no holes open), its launch thickness, the axis it
   * spreads round and its distance from it at the launch, and the holes per
   * m^2 born so far with the sums of their radii and squared radii per m^2,
   * and the covered share.
   */
  readonly voidShare: Float32Array;
  readonly h0M: Float32Array;
  readonly axisX: Float32Array;
  readonly axisZ: Float32Array;
  readonly r0M: Float32Array;
  readonly holeN: Float32Array;
  readonly holeS1: Float32Array;
  readonly holeS2: Float32Array;
  readonly holeX: Float32Array;
  /** Round 7: the water a punctured sheet owes its rims, kg, and its mass at the launch. */
  private readonly rimCarry: Float32Array;
  readonly m0Kg: Float32Array;
  /**
   * ROUND 10: per particle, the size of the region its water fills at its
   * birth, meters (A PARCEL IS A POPULATION, see `supportOf`): a child's is
   * its share of its parent's region. Callers' own particles start at their
   * drawn size.
   */
  readonly spanM: Float32Array;
  /** Round 10: a drop parcel's largest drop, m (0: the gamma law's whole tail); a fragment's is the critical diameter it broke at. */
  readonly dMaxM: Float32Array;
  /** Round 10: a drop parcel's breakup clock (A FAST DROP BREAKS IN FLIGHT): the time over the critical speed over T* t_c. */
  readonly breakClock: Float32Array;
  /** Round 10: the critical diameter at the last read of a primed parcel's share (it is read again only once D_c has fallen a tenth). */
  readonly breakCheckM: Float32Array;
  /** Round 10: an aerated lump's void share (markBulk), for its bubbles' mist when it lands. */
  readonly bulkVoid: Float32Array;
  /**
   * Round 11: the path a parcel's water has flown since it left the face, m (a child takes
   * its parent's: its drops are in the same jet of air), for THE JET'S AIR DISPERSES THE DROPS.
   */
  readonly pathM: Float32Array;
  /**
   * Round 11: a jet sheet's width across its face at the launch, m (0: none). One parcel is
   * the jet's water of its face over one parcel's interval, so it is a strip of the curtain
   * as wide as the face (THE SHEET IS A STRIP OF THE CURTAIN, oceanSplash.ts).
   */
  readonly stripM: Float32Array;
  /**
   * Round 19: 1 for the jet sheet parcel that carries its curtain's LEADING RIM (the burst's first parcel on its
   * face; THE CURTAIN'S RIM, sheetShedShare). The curtain's rim is a free edge only there and at the curtain's ends.
   */
  readonly rimLead: Uint8Array;
  /**
   * ROUND 16: per parcel, its air this step (THE PLUME'S AIR): the coupled share kappa, the air's velocity
   * (m/s, the ambient wind slowed at the rock plus kappa of the water's over it), and the loading phi; and
   * its drag rate the last step (1/s, for the next step's grid). Read at the start of its step.
   */
  readonly airK: Float32Array;
  readonly airUx: Float32Array;
  readonly airUy: Float32Array;
  readonly airUz: Float32Array;
  readonly airPhi: Float32Array;
  readonly dragRate: Float32Array;
  /** Round 10: the water given to breakup fragments since the reset, kg (ring, bag), and the mist the bubbles burst into, kg. */
  massRingKg = 0;
  massBagKg = 0;
  massBubbleMistKg = 0;
  /** Round 7: the sheets' ledger (see SplashSheetLedger). */
  readonly sheets: SplashSheetLedger = { gone: 0, goneAgeSumS: 0, landed: 0, landedAgeSumS: 0, landedXSum: 0, rimKg: 0 };
  /** Round 7: a rim's diameter for the ligament now being torn (0: the parent's own scale). */
  private rimDiameterM = 0;
  /** The kinds and the shedding this pool runs. */
  readonly kinds: readonly SplashKindSpec[];
  readonly shed: SplashShedSpec;
  /** Per particle, the shed carry (fractional children owed), ligaments and drops. */
  private readonly shedL: Float32Array;
  private readonly shedD: Float32Array;
  readonly aliveIndex: Int32Array;
  alive = 0;
  /** Particles emitted since the last reset, by kind, and landed in the sea. */
  readonly emitted: number[] = [0, 0, 0, 0, 0];
  landedSea = 0;
  private readonly freeList: Int32Array;
  private freeCount = 0;
  private readonly rng: SplashRng;
  private readonly seed: number;

  constructor(capacity: number, seed = 0x5a1a5, opts: SplashPoolOptions = {}) {
    this.capacity = capacity;
    this.seed = seed;
    this.kinds = opts.kinds ?? SPLASH_KINDS;
    this.shed = opts.shed ?? SPLASH_SHED_DEFAULT;
    this.opacity = new Float32Array(capacity);
    this.mass = new Float32Array(capacity);
    this.areaV = new Float32Array(capacity);
    this.scaleM = new Float32Array(capacity);
    this.spreadMs = new Float32Array(capacity);
    this.bulk = new Uint8Array(capacity);
    this.voidShare = new Float32Array(capacity);
    this.h0M = new Float32Array(capacity);
    this.axisX = new Float32Array(capacity);
    this.axisZ = new Float32Array(capacity);
    this.r0M = new Float32Array(capacity);
    this.holeN = new Float32Array(capacity);
    this.holeS1 = new Float32Array(capacity);
    this.holeS2 = new Float32Array(capacity);
    this.holeX = new Float32Array(capacity);
    this.rimCarry = new Float32Array(capacity);
    this.m0Kg = new Float32Array(capacity);
    this.spanM = new Float32Array(capacity);
    this.dMaxM = new Float32Array(capacity);
    this.breakClock = new Float32Array(capacity);
    this.breakCheckM = new Float32Array(capacity);
    this.bulkVoid = new Float32Array(capacity);
    this.pathM = new Float32Array(capacity);
    this.stripM = new Float32Array(capacity);
    this.rimLead = new Uint8Array(capacity);
    this.airK = new Float32Array(capacity);
    this.airUx = new Float32Array(capacity);
    this.airUy = new Float32Array(capacity);
    this.airUz = new Float32Array(capacity);
    this.airPhi = new Float32Array(capacity);
    this.dragRate = new Float32Array(capacity);
    this.rng = new SplashRng(seed);
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.owner = new Uint8Array(capacity);
    this.seedV = new Float32Array(capacity);
    this.shedL = new Float32Array(capacity);
    this.shedD = new Float32Array(capacity);
    this.aliveIndex = new Int32Array(capacity);
    this.freeList = new Int32Array(capacity);
    this.reset();
  }

  /** Kill every particle and reseed the generator. */
  reset(): void {
    this.layVersion += 1;
    this.alive = 0;
    this.rng.reset(this.seed);
    for (let i = 0; i < this.capacity; i += 1) this.freeList[i] = this.capacity - 1 - i;
    this.freeCount = this.capacity;
    for (let k = 0; k < this.emitted.length; k += 1) this.emitted[k] = 0;
    this.landedSea = 0;
    this.massEmitted = 0;
    this.massLost = 0;
    this.massLanded = 0;
    this.massExpired = 0;
    this.massRingKg = 0;
    this.massBagKg = 0;
    this.massBubbleMistKg = 0;
    this.fineCarry.fill(0);
    const L = this.sheets;
    L.gone = 0; L.goneAgeSumS = 0; L.landed = 0; L.landedAgeSumS = 0; L.landedXSum = 0; L.rimKg = 0;
  }

  /** Round 6: the water thrown by callers since the reset, kg, and the water a full pool could not hold. */
  massEmitted = 0;
  massLost = 0;
  /** Round 6: the water that reached the sea or the solid, kg, and the water left in particles that ended in the air. */
  massLanded = 0;
  massExpired = 0;

  /** Round 6: the water now in the air, kg (for a test of the mass ledger). */
  massAlive(owner = -1): number {
    // Round 10: the bag water carried to its next parcel is in the air too.
    let m = 0;
    if (owner < 0) for (let k = 0; k < this.fineCarry.length; k += 1) m += this.fineCarry[k];
    else m += this.fineCarry[owner] ?? 0;
    for (let a = 0; a < this.alive; a += 1) {
      const i = this.aliveIndex[a];
      if (owner < 0 || this.owner[i] === owner) m += this.mass[i];
    }
    return m;
  }

  /**
   * Round 6: mark particle `i` (an emit's slot) as aerated bulk water (see
   * `bulk`). Round 10: with its void share, its bubbles burst into mist
   * when it lands on the sea (THE BUBBLES OF THE CHURN BURST AT THE SEA).
   */
  markBulk(i: number, voidShare = 0): void {
    if (i < 0) return;
    this.layVersion += 1;
    this.bulk[i] = 1;
    this.bulkVoid[i] = Math.min(Math.max(voidShare, 0), 0.9);
  }

  /**
   * Round 7: make sheet `i` (an emit's slot) an aerated sheet that
   * punctures (THE SHEET'S BREAK-UP): it carries the void share
   * `voidShare` and spreads round the vertical axis at (axisX, axisZ).
   * A sheet with no void share opens no holes (a clear sheet of
   * centimeters); round 9: it still thins as it spreads and tears at its
   * rim (THE CLEAR SHEET THINS AND TEARS AT ITS RIM).
   */
  markSheet(i: number, voidShare: number, axisX: number, axisZ: number, stripM = 0, lead = false): void {
    if (i < 0) return;
    this.layVersion += 1;
    // Round 11: the strip of the curtain this parcel is (THE SHEET IS A STRIP OF THE CURTAIN).
    this.stripM[i] = Math.max(stripM, 0);
    // Round 19: the curtain's leading rim (THE CURTAIN'S RIM).
    this.rimLead[i] = lead ? 1 : 0;
    this.voidShare[i] = Math.min(Math.max(voidShare, 0), 0.9);
    this.h0M[i] = this.scaleM[i];
    this.axisX[i] = axisX;
    this.axisZ[i] = axisZ;
    this.r0M[i] = Math.max(Math.hypot(this.pos[i * 3] - axisX, this.pos[i * 3 + 2] - axisZ), 0.05);
    this.m0Kg[i] = this.mass[i];
  }

  /** The pool's generator, for a caller that must scatter its emits deterministically. */
  random(): number { return this.rng.next(); }

  /**
   * ROUND 10: A PARCEL IS A POPULATION, NOT A DISC. One parcel stands for
   * water spread over a region, not for one ligament: a 1 kg strand parcel
   * of 2 cm ligaments is 3 m of ligament, torn from a sheet patch of about
   * half a square meter. So its drops fill the region its water held at its
   * birth (its share of its parent's region, `spanM`), grown by their own
   * velocity spread (the capillary speed of its size, the same jitter that
   * sends its children apart: 2 v a), and the drops' number density there
   * is n = N / V. A jet sheet's region is its own water's area, m / (rho h)
   * (THE SHEET'S THINNED EXTENT: it widens as it thins). Rounds 6 to 9 drew
   * a parcel as one disc of its own size plus its spread (1.5 to 3.5 cm at
   * its birth), so a parcel of a few hundred drops was a dense dot and the
   * gaps between parcels were empty (GG-393, the confetti).
   */
  supportOf(i: number): number {
    if (this.kind[i] === SPLASH_SHEET && this.h0M[i] > 0 && this.mass[i] > 0 && this.scaleM[i] > 0) {
      return Math.sqrt(this.mass[i] / (SPLASH_WATER_RHO * this.scaleM[i]));
    }
    // Round 11: the region also grows by the jet's air (THE JET'S AIR DISPERSES THE DROPS):
    // the drops' spread sigma_t over a uniform span is sqrt(12) sigma_t wide.
    const turb = Math.sqrt(12) * this.turbSigmaOf(i);
    if (this.spreadMs[i] > 0) return Math.max(this.spanM[i], this.scaleM[i]) + 2 * this.spreadMs[i] * this.age[i] + turb;
    // Round 11: the bubbles' mist (spreadMs 0) spreads by the air alone.
    if (this.kind[i] === SPLASH_MIST && this.mass[i] > 0 && this.areaV[i] > 0) return this.spanM[i] + turb;
    return this.sizeOf(i);
  }

  /**
   * ROUND 11: a drop parcel's offset by the jet's air (splashTurbulentSigma), meters: its
   * drops' drag time at their Sauter diameter and the parcel's speed, over the path it has
   * flown. 0 for a sheet (one piece of water), an aerated lump, or a parcel with no water.
   */
  turbSigmaOf(i: number): number {
    if (this.mass[i] <= 0 || this.areaV[i] <= 0 || this.bulk[i] === 1) return 0;
    const k = this.kind[i];
    if (k === SPLASH_SHEET && this.h0M[i] > 0) return 0;
    const o = i * 3;
    const sp = Math.sqrt(this.vel[o] * this.vel[o] + this.vel[o + 1] * this.vel[o + 1] + this.vel[o + 2] * this.vel[o + 2]);
    const kd = splashDragPerSpeed(this.scaleM[i], Math.max(sp, 0.1));
    return splashTurbulentSigma(this.pathM[i], sp, 1 / Math.max(kd, 1e-6));
  }

  /**
   * ROUND 10: THE POPULATION'S PROFILE. A parcel's drops leave from points
   * spread evenly over its region at its birth (a span L per axis) with
   * velocities spread evenly over +/- v (the capillary jitter of `child`), so
   * after an age a each drop's offset per axis is the sum of two uniform
   * offsets, of variance L^2 / 12 + (2 v a)^2 / 12. The sum of such offsets
   * is close to normal, so the drops' number density is a Gaussian of that
   * variance and their column across the view a Gaussian of the same sigma:
   * dense at the middle, with a soft tail and no rim (rounds 6 to 9 drew a
   * uniform ball's chord, sqrt(1 - u^2), whose rim is a hard step: discs).
   * Returns sigma, meters, for a parcel that carries water (a jet sheet's is
   * its own extent's, `supportOf`, over sqrt(12)).
   */
  spreadSigmaOf(i: number): number {
    if (this.kind[i] === SPLASH_SHEET && this.h0M[i] > 0) return this.supportOf(i) / Math.sqrt(12);
    const L = Math.max(this.spanM[i], this.scaleM[i]);
    const g = 2 * this.spreadMs[i] * this.age[i];
    // Round 11: and the jet's air's offset (THE JET'S AIR DISPERSES THE DROPS), in quadrature.
    const t = this.turbSigmaOf(i);
    return Math.sqrt((L * L + g * g) / 12 + t * t);
  }

  /**
   * ROUND 12: the sigma of one of the parcel's drop trains (THE REGION GROWS, THE DROPS DO NOT):
   * its drops' size and their capillary spread from one another, (s^2 + (2 v a)^2) / 12, with
   * neither the span the parcel was torn from nor the jet's air (those spread the trains, not a
   * train's drops). 0 for a jet sheet (one piece of water), the bubbles' mist (it follows the
   * air: one veil) or a parcel with no water: those draw as their region. With `perTrain`, the
   * drops one train holds: a train of n drops spans the expected range of n draws over the
   * jitter's width, 2 v a (n - 1) / (n + 1), so a train of one drop is the drop itself.
   */
  trainSigmaOf(i: number, perTrain = Infinity): number {
    if (this.mass[i] <= 0 || this.areaV[i] <= 0 || this.bulk[i] === 1) return 0;
    if ((this.kind[i] === SPLASH_SHEET && this.h0M[i] > 0) || this.kind[i] === SPLASH_MIST) return 0;
    const s = this.scaleM[i];
    const n = Math.max(perTrain, 1);
    const g = 2 * this.spreadMs[i] * this.age[i] * (Number.isFinite(n) ? (n - 1) / (n + 1) : 1);
    return Math.sqrt((s * s + g * g) / 12);
  }

  /** The drawn size of particle i now. */
  sizeOf(i: number): number {
    // Round 6: a particle with a physical size grows by its pieces' spread
    // (both sides, 2 v a); the kinds' growMs (0.3 m/s for a sheet) was a look.
    if (this.spreadMs[i] > 0) return this.size0[i] + 2 * this.spreadMs[i] * this.age[i];
    return this.size0[i] + this.kinds[this.kind[i]].growMs * this.age[i];
  }

  /**
   * Throw one particle. Returns its slot, or -1 when the pool is full (the
   * water is not thrown; `emitted` still counts only what flew).
   */
  emit(
    kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, sizeM: number, owner: number,
    opacity = 1, massKg = 0, areaV = 0, scaleM = 0,
  ): number {
    this.layVersion += 1;
    if (this.freeCount === 0) {
      if (!this.inChild) { this.massEmitted += massKg; this.massLost += massKg; }
      return -1;
    }
    const i = this.freeList[--this.freeCount];
    this.aliveIndex[this.alive++] = i;
    const spec = this.kinds[kind];
    this.opacity[i] = opacity;
    this.mass[i] = massKg;
    this.areaV[i] = areaV;
    this.scaleM[i] = scaleM > 0 ? scaleM : areaV > 0 ? 6 / areaV : 0;
    this.spreadMs[i] = this.scaleM[i] > 0 ? splashCapillarySpeed(this.scaleM[i]) : 0;
    this.bulk[i] = 0;
    this.bulkVoid[i] = 0;
    this.voidShare[i] = 0;
    this.spanM[i] = sizeM;
    this.pathM[i] = 0;
    this.stripM[i] = 0;
    this.rimLead[i] = 0;
    // Round 16: a new parcel starts in the ambient air (THE PLUME'S AIR), at its launch's drag rate.
    this.airK[i] = 0; this.airUx[i] = 0; this.airUy[i] = 0; this.airUz[i] = 0; this.airPhi[i] = 0;
    this.dragRate[i] = this.scaleM[i] > 0 ? splashDragPerSpeed(this.scaleM[i], Math.hypot(vx, vy, vz)) : 0;
    this.dMaxM[i] = 0;
    this.breakClock[i] = 0;
    this.breakCheckM[i] = 0;
    this.m0Kg[i] = massKg;
    this.holeN[i] = 0; this.holeS1[i] = 0; this.holeS2[i] = 0; this.holeX[i] = 0; this.rimCarry[i] = 0;
    // Round 9: a reused slot kept the last sheet's launch thickness, so a
    // churn lump in a slot that held a jet sheet drew as a flat piece and
    // spread as one. Every emit starts with no sheet state.
    this.h0M[i] = 0;
    if (!this.inChild) this.massEmitted += massKg;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0;
    this.life[i] = spec.lifeS[0] + (spec.lifeS[1] - spec.lifeS[0]) * this.rng.next();
    this.size0[i] = sizeM;
    this.kind[i] = kind;
    this.owner[i] = owner;
    this.seedV[i] = this.rng.next();
    this.shedL[i] = 0;
    this.shedD[i] = 0;
    this.emitted[kind] += 1;
    return i;
  }

  /**
   * The children a sheet still owes over the rest of its life (its shedding
   * rates times the life left, plus its end children): a shed child takes
   * the parent's mass over (owed + 1), so a sheet's water is shared evenly
   * among all the pieces it breaks into (round 6).
   */
  private owed(i: number): number {
    const sh = this.shed;
    // Round 6: a sheet that carries water sheds by its rim (sheetShedShare), not by an even share.
    if (this.kind[i] === SPLASH_SHEET && this.mass[i] > 0 && this.scaleM[i] > 0) return 0;
    if (this.kind[i] === SPLASH_SHEET) {
      return Math.max(this.life[i] - this.age[i], 0) * (sh.ligamentsPerS + sh.dropsPerS) + sh.endDrops + sh.endMistChance;
    }
    if (this.kind[i] === SPLASH_LIGAMENT) return sh.ligamentEndDrops;
    return 0;
  }

  /**
   * A child's water (round 6): its mass and its interfacial area per
   * volume. A LIGAMENT is torn at the Weber limit of the parent's speed
   * (splashLigamentDiameter), never thicker than the parent's own sheet or
   * strand; a DROP parcel holds the gamma law round its ligament
   * (S_v = 6 / D32); MIST is the law's tail under the Stokes diameter of the
   * mist kind's relaxation time (its share of the volume is the gamma law's
   * share under that diameter, splashGammaVolumeBelow).
   */
  private childWater(i: number, kind: number, share: number): [number, number, number] {
    const m = this.mass[i];
    if (m <= 0) return [0, 0, 0];
    // Round 16: the Weber number of the tear is the parent's SLIP through its own air (THE PLUME'S AIR);
    // with the coupling off, its whole speed (rounds 6 to 15).
    const coupled = this.lawsOn.airCoupling;
    const sp = coupled
      ? Math.hypot(this.vel[i * 3] - this.airUx[i], this.vel[i * 3 + 1] - this.airUy[i], this.vel[i * 3 + 2] - this.airUz[i])
      : Math.hypot(this.vel[i * 3], this.vel[i * 3 + 1], this.vel[i * 3 + 2]);
    // Round 16: the largest stable drop in the parent's air (D_s in free air; THE PLUME'S AIR).
    const cap = coupled ? splashCoupledStableDrop(this.airK[i]) : SPLASH_STABLE_DROP_M;
    this.birthCapM = cap;
    // The parent's own thickness (a sheet's h, a strand's d, a lump's size).
    // Round 7: a punctured sheet's rim ligament has the rim's own diameter.
    const own = this.rimDiameterM > 0 ? this.rimDiameterM : this.scaleM[i] > 0 ? this.scaleM[i] : Infinity;
    const dL = Math.min(splashLigamentDiameter(sp), own);
    // Round 15: a strand thicker than the stable drop is not stable in its own fall either (the same Weber
    // law across it): it is torn at most D_s thick (THE DROP POPULATION ENDS AT THE STABLE DROP).
    if (kind === SPLASH_LIGAMENT) {
      const dS = this.lawsOn.stableDrop ? Math.min(dL, cap) : dL;
      return [m * share, 4 / dS, dS];
    }
    if (kind === SPLASH_MIST) {
      const dM = splashStokesDiameter(this.kinds[SPLASH_MIST].tauS);
      return [m * share * splashGammaVolumeBelow(dM, dL), 6 / dM, dM];
    }
    // Round 15: its drops over the stable drop are broken at its birth (THE DROP POPULATION ENDS AT THE STABLE DROP).
    // The bags' fine drops leave as their own parcel (child(), the bag's parcel budget of round 10), so the
    // parcel keeps its drops under D_s and the ring's: the fines fly as fines (they relax to the air in a few
    // tenths of a second), the larger drops as themselves.
    if (this.lawsOn.stableDrop) {
      const law = splashCappedDropLaw(dL, cap);
      this.birthBagShare = law.bagShare;
      this.birthBagD32 = law.bagD32;
      return [m * share, law.keepAreaV, 6 / law.keepAreaV];
    }
    const d32 = splashSauterDiameter(dL);
    return [m * share, 6 / d32, d32];
  }

  /**
   * ROUND 6: A SHEET SHEDS ONLY ITS RIM (Taylor 1959, Culick 1960;
   * Villermaux 2007, section 3: a torn sheet's free edge gathers into a rim
   * that retracts at the Taylor-Culick speed v = sqrt(2 sigma / (rho h)),
   * and the rim's water leaves as the ligaments). A strip of sheet as wide
   * as its tongue lattice (lambda, its size0) tears on both its edges, so
   * it loses the share 2 v / lambda of its water each second; the rest
   * flies on as one sheet and falls back whole (green water, not spray).
   * Rounds 2 to 5 broke every sheet into drops and mist within 0.3 to 0.65
   * s at fixed counts, so all the jet's water became spray. The share a
   * shed child takes is the rim's water since the last child (the shed
   * counts set only how finely it is cut).
   */
  /**
   * ROUND 19: THE CURTAIN'S RIM (the lead's ruling 2 on the round-18 judge: "a big flat beige-gray cloud ... it should be
   * a sheet of white water thrown up ..., dense and bright at the base, that tears into streaks and droplets at the
   * top"). A rock's jet parcel is not a lone tongue: it is one strip of a continuous curtain (THE SHEET IS A STRIP OF
   * THE CURTAIN, round 11), as wide as its face (stripM, W) and as long along its flight as its water's area over that
   * width, L = m / (rho h W). Taylor and Culick's rim retracts only at a FREE edge, eating the sheet at v = sqrt(2 sigma
   * / (rho h)) per meter of edge (Taylor 1959, Culick 1960): the curtain's free edges are its leading rim (the top of the
   * burst's first parcel, W long; markSheet's lead) and its two ends (each strip holds its own length L of them), so a
   * strip loses the share v (2 L + lead W) / (W L) = v (2 / W + lead / L) of its water a second. A strip widens as it
   * thins (h0 / h, round 9). Rounds 6 to 18 took every parcel as an isolated strip one Rayleigh-Plateau wavelength wide
   * (2 v / (4.51 h)), with free edges on both its sides: the rim law then shed every strip of the curtain at once, 194 kg
   * of the strike's 1,253 kg by the judged instant (rocks/r19/flows19.ts), and the visible area went to the drops and
   * the mist. The edge's water leaves as LIGAMENTS (the rim's fingers pinch into ligaments; Villermaux 2007, Annu. Rev.
   * Fluid Mech. 39: 419-446), which break into drops at their own end (die); rounds 6 to 18 also shed drops straight
   * from the rim, 26 a second beside the 18 ligaments, a path the rim law does not have. And the rim's water leaves by
   * MASS, in pieces of the strip's launch water over SPLASH_RIM_PIECES (the puncture's own pieces; a parcel is a unit of
   * mass, round 9): rounds 6 to 18 cut a child off at a fixed 44 a second whatever water the rim gave, so a strip that
   * shed a few grams a second still threw 44 parcels a second (the strike's live count, 15,900 parcels, GG-406).
   * Returns the share rate, 1/s; 0 for a parcel with no strip (a skipping stone's crown, the churn's lumps), which keeps
   * the round-6 law (sheetShedShare).
   */
  curtainRimRate(i: number): number {
    if (!(this.stripM[i] > 0) || !(this.scaleM[i] > 0) || !(this.mass[i] > 0)) return 0;
    const widen = this.h0M[i] > 0 ? this.h0M[i] / this.scaleM[i] : 1;
    const W = Math.max(this.stripM[i] * widen, 1e-3);
    const L = this.mass[i] / (SPLASH_WATER_RHO * this.scaleM[i] * W);
    return this.spreadMs[i] * (2 / W + (this.rimLead[i] ? 1 / Math.max(L, 1e-3) : 0));
  }

  private sheetShedShare(i: number): number {
    const sh = this.shed;
    // Round 9: a spreading jet sheet's strip widens as h0 / h (THE CLEAR SHEET THINS AND TEARS AT ITS RIM).
    const widen = this.h0M[i] > 0 && this.scaleM[i] > 0 ? this.h0M[i] / this.scaleM[i] : 1;
    const rate = (2 * this.spreadMs[i]) / Math.max(this.size0[i] * widen, 1e-3);
    const perChild = 1 / Math.max(sh.ligamentsPerS + sh.dropsPerS, 1e-6);
    return 1 - Math.exp(-rate * perChild);
  }

  /**
   * A child of particle i: its velocity jittered, from a point within its
   * parent's region (round 10: `supportOf`; rounds 6 to 9: within its drawn
   * size, so a sheet's children stood in a clump a lattice wavelength wide).
   * A jet sheet's children leave from its plane (its width round the rock's
   * axis, its length along its flight, its thickness across); every other
   * parent's from its ball. The child's region is its water's share of its
   * parent's: share^(1/2) of a sheet's side, share^(1/3) of a ball's.
   */
  private child(i: number, kind: number, sizeRange: readonly [number, number], share = -1): void {
    const r = this.rng;
    const s = this.supportOf(i);
    const m0 = this.mass[i];
    const vx = this.vel[i * 3]; const vy = this.vel[i * 3 + 1]; const vz = this.vel[i * 3 + 2];
    // Round 6: a physical parent spreads its pieces at its capillary speed.
    const sp = this.spreadMs[i] > 0 ? this.spreadMs[i] : Math.hypot(vx, vy, vz) * this.shed.childJitter;
    // Round 6: the child's water out of the parent's (a shed child takes 1 / (owed + 1),
    // a sheet's shed child its rim's water since the last child, sheetShedShare).
    const f = share >= 0 ? share
      : this.kind[i] === SPLASH_SHEET && this.mass[i] > 0 && this.scaleM[i] > 0 ? this.sheetShedShare(i)
        : 1 / (this.owed(i) + 1);
    const [cm, ca, cs] = this.childWater(i, kind, f);
    this.mass[i] = Math.max(this.mass[i] - cm, 0);
    if (this.freeCount === 0) this.massLost += cm;
    // Round 10: the point it leaves from, in its parent's region.
    const ra = r.next() - 0.5; const rb = r.next() - 0.5; const rc = r.next() - 0.5;
    let px: number; let py: number; let pz: number;
    const flat = this.kind[i] === SPLASH_SHEET && this.h0M[i] > 0 && this.bulk[i] === 0;
    if (flat) {
      // The sheet's plane: t round the rock's axis, v along its flight, n across.
      const o = i * 3;
      const ex = this.pos[o] - this.axisX[i]; const ez = this.pos[o + 2] - this.axisZ[i];
      const el = Math.hypot(ex, ez) || 1;
      const tX = -ez / el; const tZ = ex / el;
      const vl = Math.hypot(vx, vy, vz) || 1;
      const aX = vx / vl; const aY = vy / vl; const aZ = vz / vl;
      // n = a x t (t has no y).
      const nX = aY * tZ; const nY = aZ * tX - aX * tZ; const nZ = -aY * tX;
      const hh = this.scaleM[i];
      px = this.pos[o] + tX * ra * s + aX * rb * s + nX * rc * hh;
      py = this.pos[o + 1] + aY * rb * s + nY * rc * hh;
      pz = this.pos[o + 2] + tZ * ra * s + aZ * rb * s + nZ * rc * hh;
    } else {
      px = this.pos[i * 3] + ra * s; py = this.pos[i * 3 + 1] + rb * s; pz = this.pos[i * 3 + 2] + rc * s;
    }
    const childShare = m0 > 0 ? Math.min(cm / m0, 1) : 0;
    this.inChild = true;
    const j = this.emit(
      kind,
      px,
      py,
      pz,
      vx + (r.next() - 0.5) * 2 * sp,
      vy + (r.next() - 0.5) * 2 * sp,
      vz + (r.next() - 0.5) * 2 * sp,
      sizeRange[0] + (sizeRange[1] - sizeRange[0]) * r.next() ** 2,
      this.owner[i],
      this.opacity[i],
      cm,
      ca,
      cs,
    );
    this.inChild = false;
    if (j >= 0 && childShare > 0) this.spanM[j] = Math.max(s * childShare ** (flat ? 0.5 : 1 / 3), this.size0[j]);
    // Round 15: a drop parcel's law ends at the stable drop (none of its drops is larger); the bags' fine
    // drops of its birth go to its owner's bag carry and leave as one parcel when the carry makes a whole one.
    if (j >= 0 && kind === SPLASH_DROP && this.lawsOn.stableDrop) {
      // Round 16: its cap is its birth air's stable drop (THE PLUME'S AIR); D_s in free air.
      this.dMaxM[j] = this.birthCapM;
      const bag = this.mass[j] * this.birthBagShare;
      if (bag > 0 && this.birthBagD32 > 0) {
        const unit = this.mass[j];
        this.mass[j] -= bag;
        this.massBagKg += bag;
        const ow = this.owner[j];
        this.fineCarry[ow] += bag;
        if (this.fineCarry[ow] >= unit) {
          const kg = this.fineCarry[ow];
          this.fineCarry[ow] = 0;
          this.mass[j] += kg;
          this.fragment(j, kg, this.birthBagD32, this.birthCapM);
        }
      }
      this.birthBagShare = 0;
      this.birthBagD32 = 0;
    }
    // Round 11: a child's drops are in its parent's jet of air (THE JET'S AIR DISPERSES THE DROPS).
    if (j >= 0) this.pathM[j] = this.pathM[i];
  }
  private inChild = false;
  /** Round 15: the bags' share and size of the last drop parcel childWater broke at its birth (child() sends them on). */
  private birthBagShare = 0;
  private birthBagD32 = 0;
  /** Round 16: the stable drop of the parent's air at the last childWater (THE PLUME'S AIR). */
  private birthCapM = SPLASH_STABLE_DROP_M;

  /**
   * Round 10: one step of a drop parcel's breakup (A FAST DROP BREAKS IN
   * FLIGHT), at its relative speed to the air (ax, az). Its clock runs while
   * its drops over the critical diameter hold water; at 1 that share breaks
   * into the ring's and the bag's fragments (two child parcels), and the
   * parcel's law is cut at the critical diameter.
   */
  private breakUp(i: number, dt: number, ax: number, ay: number, az: number): void {
    const o = i * 3;
    // Round 16: the slip through the parcel's own air (THE PLUME'S AIR; ay is 0 with the coupling off).
    const ux = this.vel[o] - ax; const uy = this.vel[o + 1] - ay; const uz = this.vel[o + 2] - az;
    const u2 = ux * ux + uy * uy + uz * uz;
    const d32 = 6 / this.areaV[i];
    const mean = (d32 * SPLASH_GAMMA_N) / (SPLASH_GAMMA_N + 2);
    // D_c over 5 means (the law's volume above D_c under 1e-4, P(7, 20)) breaks
    // nothing: read on the squared speed first, the cheap test for most drops.
    const weS = (SPLASH_WE_CRIT * SPLASH_WATER_SIGMA) / SPLASH_AIR_RHO;
    // Round 15: the critical diameter is the smaller of the air speed's and the stable drop's (a drop
    // over D_s breaks in its own fall, its clock at its terminal speed: THE DROP POPULATION ENDS AT THE STABLE DROP).
    const stable = this.lawsOn.stableDrop;
    const dAir = u2 >= 0.25 ? weS / u2 : Infinity;
    // Round 16: the stable drop of the parcel's own air, D_s / sqrt(1 - kappa) (THE PLUME'S AIR).
    const kap = this.lawsOn.airCoupling ? Math.min(Math.max(this.airK[i], 0), 0.999999) : 0;
    const dC = stable ? Math.min(dAir, splashCoupledStableDrop(kap)) : dAir;
    if (5 * mean < dC || (!stable && u2 < 0.25)) return;
    const u = Math.sqrt(u2);
    const dMax = this.dMaxM[i] > 0 ? this.dMaxM[i] : Infinity;
    if (dC >= dMax) return;
    // The breaking drops' size: the law's Sauter diameter, at least the critical one.
    const dS = Math.max(d32, dC);
    // Round 16: the coupled terminal slip, v_t sqrt(1 - kappa) (THE PLUME'S AIR).
    const uB = stable && dAir > dC ? Math.max(u, splashTerminalSpeedMs(dS) * Math.sqrt(1 - kap)) : u;
    if (this.breakClock[i] < 1) this.breakClock[i] += dt / splashBreakupTimeS(dS, uB);
    if (this.breakClock[i] < 1) return;
    // The share over D_c, read once the clock has run (the gamma law's cost is
    // paid then only), and again only when D_c has fallen a tenth since.
    if (this.breakCheckM[i] > 0 && dC > 0.9 * this.breakCheckM[i]) return;
    this.breakCheckM[i] = dC;
    const S = (dMax === Infinity ? 1 : splashGammaVolumeBelow(dMax, mean)) - splashGammaVolumeBelow(dC, mean);
    if (S < SPLASH_BREAK_MIN_SHARE) return;
    this.breakClock[i] = 0;
    this.breakCheckM[i] = 0;
    this.dMaxM[i] = dC;
    const brk = this.mass[i] * S;
    const ring = brk * SPLASH_BREAK_RING_SHARE;
    // The ring's fragments stay in the parcel (its parcel budget, round 10's
    // CPU pass: two new parcels a break raised the live count by 60%): the
    // parcel's drops are now its unbroken drops and the ring's, and its area
    // per volume is their mix, sum(m S_v) / sum(m), so its cross-section is
    // exactly the sum of both (SPLASH_CAUCHY is linear in the area); its drag
    // takes the mix's Sauter diameter. The bag's fine drops leave as one parcel.
    const sv = (this.areaV[i] * (this.mass[i] - brk) + ring * (6 / (SPLASH_BREAK_RING_D * dS))) / Math.max(this.mass[i] - brk + ring, 1e-12);
    this.areaV[i] = sv;
    this.scaleM[i] = 6 / sv;
    this.massRingKg += ring;
    // THE BAG'S PARCEL BUDGET (round 10's CPU pass: one fine parcel a break put
    // 2,000 more parcels in the air at the first strike, and the splat and the
    // sprites cost 2 us a parcel). A parcel is a unit of mass (round 9): the
    // bag's water is carried per owner and leaves as one parcel when the carry
    // reaches the mass of the parcel now breaking, from that parcel's region.
    const unit = this.mass[i];
    const bag = brk - ring;
    this.massBagKg += bag;
    this.mass[i] -= bag;
    const ow = this.owner[i];
    this.fineCarry[ow] += bag;
    if (this.fineCarry[ow] >= unit) {
      const kg = this.fineCarry[ow];
      this.fineCarry[ow] = 0;
      this.mass[i] += kg;
      this.fragment(i, kg, SPLASH_BREAK_BAG_D * dS, dC);
    }
  }
  /** Round 10: the round's two new laws, on unless a cost ablation turns one off (the probe's `ablateLaw`). */
  readonly lawsOn = { breakup: true, bubbleMist: true, stableDrop: true, airCoupling: true };
  /** Round 17: the lay cache's stamp: a step, an emit, a mark or a reset moves it on (SplashVolume.layCache). */
  layVersion = 0;
  /**
   * ROUND 16: THE PLUME'S AIR's grid, per owner (see SPLASH_AIR_CELL_M): the cells' window this step (its
   * low corner and its size in cells, -1 when the owner holds no water) and its offset in airBuf; per
   * cell AIR_F floats: after the deposit (mass, momentum x y z, mass x age, mass x drag rate), after the
   * derive (kappa, kappa u x y z, phi, 0).
   */
  private airBuf = new Float32Array(0);
  private readonly airLo = new Int32Array(256 * 3);
  private readonly airN = new Int32Array(256 * 3);
  private readonly airOff = new Int32Array(256);
  private readonly airC = new Float64Array(256 * 4);
  /** At most this many cells a side of an owner's window (77 m at 0.8 m): a lone parcel farther off is in free air. */
  static readonly AIR_MAX_CELLS = 96;

  /** Round 16: lay every parcel's water on its owner's air grid and derive each cell's air (THE PLUME'S AIR). */
  private airPass(): void {
    const L = SPLASH_AIR_CELL_M;
    const inv = 1 / L;
    const F = 6;
    const lo = this.airLo; const n = this.airN; const C = this.airC;
    n.fill(-1);
    C.fill(0);
    lo.fill(1 << 30);
    const hi = this.airHiTmp;
    hi.fill(-(1 << 30));
    for (let a = 0; a < this.alive; a += 1) {
      const i = this.aliveIndex[a];
      if (!(this.mass[i] > 0) || !(this.areaV[i] > 0)) continue;
      const ow = this.owner[i];
      const o = i * 3;
      const m = this.mass[i];
      C[ow * 4] += m; C[ow * 4 + 1] += m * this.pos[o]; C[ow * 4 + 2] += m * this.pos[o + 1]; C[ow * 4 + 3] += m * this.pos[o + 2];
      for (let c = 0; c < 3; c += 1) {
        // The deposit's cell (floor) and the read's 8 cells (floor of x - L / 2, and the next).
        const f = Math.floor(this.pos[o + c] * inv - 0.5);
        if (f < lo[ow * 3 + c]) lo[ow * 3 + c] = f;
        if (f + 1 > hi[ow * 3 + c]) hi[ow * 3 + c] = f + 1;
      }
    }
    let off = 0;
    const M = SplashPool.AIR_MAX_CELLS;
    for (let ow = 0; ow < 256; ow += 1) {
      this.airOff[ow] = -1;
      if (!(C[ow * 4] > 0)) continue;
      let cells = 1;
      for (let c = 0; c < 3; c += 1) {
        // A window wider than AIR_MAX_CELLS keeps the cells round the water's center of mass.
        if (hi[ow * 3 + c] - lo[ow * 3 + c] + 1 > M) {
          const mid = Math.floor((C[ow * 4 + 1 + c] / C[ow * 4]) * inv - 0.5);
          lo[ow * 3 + c] = mid - (M >> 1);
          hi[ow * 3 + c] = lo[ow * 3 + c] + M - 1;
        }
        n[ow * 3 + c] = hi[ow * 3 + c] - lo[ow * 3 + c] + 1;
        cells *= n[ow * 3 + c];
      }
      this.airOff[ow] = off;
      off += cells * F;
    }
    if (this.airBuf.length < off) this.airBuf = new Float32Array(Math.ceil(off * 1.5));
    const B = this.airBuf;
    B.fill(0, 0, off);
    // The deposit: each parcel's water in the cell that holds it (read back by trilinear weights: the
    // kernel's sigma per axis L / 2, a box of L and a tent of 2 L in quadrature).
    for (let a = 0; a < this.alive; a += 1) {
      const i = this.aliveIndex[a];
      if (!(this.mass[i] > 0) || !(this.areaV[i] > 0)) continue;
      const ow = this.owner[i];
      const b = this.airOff[ow];
      if (b < 0) continue;
      const o = i * 3;
      const X = Math.floor(this.pos[o] * inv) - lo[ow * 3]; const Y = Math.floor(this.pos[o + 1] * inv) - lo[ow * 3 + 1]; const Z = Math.floor(this.pos[o + 2] * inv) - lo[ow * 3 + 2];
      const nx = n[ow * 3]; const ny = n[ow * 3 + 1];
      if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= n[ow * 3 + 2]) continue;
      const m = this.mass[i];
      const q = b + ((Z * ny + Y) * nx + X) * F;
      B[q] += m; B[q + 1] += this.vel[o] * m; B[q + 2] += this.vel[o + 1] * m; B[q + 3] += this.vel[o + 2] * m;
      B[q + 4] += this.age[i] * m; B[q + 5] += this.dragRate[i] * m;
    }
    // The derive: per cell, phi, kappa and kappa times the water's mean velocity.
    const airPerCell = SPLASH_AIR_RHO * L * L * L;
    for (let q = 0; q < off; q += F) {
      const mq = B[q];
      if (!(mq > 0)) continue;
      const phi = mq / airPerCell;
      const k = splashCoupledShare(phi, B[q + 4] / mq, B[q + 5] / mq);
      B[q] = k; B[q + 1] = (k * B[q + 1]) / mq; B[q + 2] = (k * B[q + 2]) / mq; B[q + 3] = (k * B[q + 3]) / mq; B[q + 4] = phi; B[q + 5] = 0;
    }
  }
  private readonly airHiTmp = new Int32Array(256 * 3);

  /** Round 16: parcel i's air from its owner's grid (THE PLUME'S AIR), over the ambient air (ambX, 0, ambZ). */
  private airRead(i: number, ambX: number, ambZ: number): void {
    const ow = this.owner[i];
    const b = this.airOff[ow];
    let k = 0; let kx = 0; let ky = 0; let kz = 0; let ph = 0;
    if (b >= 0) {
      const inv = 1 / SPLASH_AIR_CELL_M;
      const F = 6;
      const o = i * 3;
      const lo = this.airLo; const n = this.airN; const B = this.airBuf;
      const fx = this.pos[o] * inv - 0.5 - lo[ow * 3]; const fy = this.pos[o + 1] * inv - 0.5 - lo[ow * 3 + 1]; const fz = this.pos[o + 2] * inv - 0.5 - lo[ow * 3 + 2];
      const x0 = Math.floor(fx); const y0 = Math.floor(fy); const z0 = Math.floor(fz);
      const tx = fx - x0; const ty = fy - y0; const tz = fz - z0;
      const nx = n[ow * 3]; const ny = n[ow * 3 + 1]; const nz = n[ow * 3 + 2];
      if (x0 >= 0 && y0 >= 0 && z0 >= 0 && x0 + 1 < nx && y0 + 1 < ny && z0 + 1 < nz) {
        const sy = nx * F; const sz = nx * ny * F;
        const q0 = b + ((z0 * ny + y0) * nx + x0) * F;
        for (let c = 0; c < 8; c += 1) {
          const ix = c & 1; const iy = (c >> 1) & 1; const iz = c >> 2;
          const w = (ix ? tx : 1 - tx) * (iy ? ty : 1 - ty) * (iz ? tz : 1 - tz);
          const q = q0 + ix * F + iy * sy + iz * sz;
          k += w * B[q]; kx += w * B[q + 1]; ky += w * B[q + 2]; kz += w * B[q + 3]; ph += w * B[q + 4];
        }
      } else {
        for (let dz = 0; dz < 2; dz += 1) {
          const Z = z0 + dz; if (Z < 0 || Z >= nz) continue;
          const wz = dz ? tz : 1 - tz;
          for (let dy = 0; dy < 2; dy += 1) {
            const Y = y0 + dy; if (Y < 0 || Y >= ny) continue;
            const wyz = wz * (dy ? ty : 1 - ty);
            for (let dx = 0; dx < 2; dx += 1) {
              const X = x0 + dx; if (X < 0 || X >= nx) continue;
              const w = wyz * (dx ? tx : 1 - tx);
              const q = b + ((Z * ny + Y) * nx + X) * F;
              k += w * B[q]; kx += w * B[q + 1]; ky += w * B[q + 2]; kz += w * B[q + 3]; ph += w * B[q + 4];
            }
          }
        }
      }
    }
    this.airK[i] = k;
    this.airUx[i] = ambX * (1 - k) + kx;
    this.airUy[i] = ky;
    this.airUz[i] = ambZ * (1 - k) + kz;
    this.airPhi[i] = ph;
  }
  /** Round 10: the bag water each owner carries until it makes a whole parcel, kg (THE BAG'S PARCEL BUDGET). */
  readonly fineCarry = new Float64Array(256);

  /** Round 10: a breakup fragment parcel of drop parcel i: `kg` of drops of Sauter diameter `d32`, none over `dMax`. */
  private fragment(i: number, kg: number, d32: number, dMax: number): void {
    const m = this.mass[i];
    if (kg <= 0 || m <= 0) return;
    const r = this.rng;
    const s = this.supportOf(i);
    const sp = this.spreadMs[i];
    const o = i * 3;
    this.mass[i] = Math.max(m - kg, 0);
    if (this.freeCount === 0) this.massLost += kg;
    this.inChild = true;
    const j = this.emit(
      SPLASH_DROP,
      this.pos[o] + (r.next() - 0.5) * s, this.pos[o + 1] + (r.next() - 0.5) * s, this.pos[o + 2] + (r.next() - 0.5) * s,
      this.vel[o] + (r.next() - 0.5) * 2 * sp, this.vel[o + 1] + (r.next() - 0.5) * 2 * sp, this.vel[o + 2] + (r.next() - 0.5) * 2 * sp,
      d32, this.owner[i], this.opacity[i], kg, 6 / d32, d32,
    );
    this.inChild = false;
    if (j >= 0) {
      this.spanM[j] = Math.max(s * Math.min(kg / m, 1) ** (1 / 3), d32);
      this.dMaxM[j] = dMax;
      this.pathM[j] = this.pathM[i];
    }
  }

  /** Round 10: an aerated lump i that lands on the sea at (x, y, z) bursts its bubbles into mist (THE BUBBLES OF THE CHURN BURST AT THE SEA). */
  private burstMist(i: number, x: number, y: number, z: number, ax: number, az: number): void {
    const e = this.bulkVoid[i];
    const m = this.mass[i];
    if (e <= 0 || m <= 0 || this.areaV[i] <= 0) return;
    // The lump's bubbles: S_v = 6 e / ((1 - e) D_b) (its emit's area per volume).
    const dB = (6 * e) / ((1 - e) * this.areaV[i]);
    const [kg, dJ] = splashBubbleMist(m, e, dB);
    if (kg <= 0) return;
    this.mass[i] = m - kg;
    if (this.freeCount === 0) this.massLost += kg;
    this.inChild = true;
    const j = this.emit(SPLASH_MIST, x, y + 0.02, z, ax, SPLASH_JET_DROP_MS, az, this.scaleM[i], this.owner[i], this.opacity[i], kg, 6 / dJ, dJ);
    this.inChild = false;
    if (j >= 0) {
      this.massBubbleMistKg += kg;
      // The burst's region is the lump's footprint; the jet drops do not
      // spread by a capillary speed of their own (the model has no air
      // turbulence to mix them; GG-397).
      this.spanM[j] = this.scaleM[i];
      this.spreadMs[j] = 0;
    }
  }

  /** One fixed step of every live particle. Children born this step start next step. */
  step(dt: number, env: SplashEnv): void {
    // Round 17: a step, an emit or a mark moves the lay cache's stamp on (SplashVolume.layCache: THE PARCEL'S PROFILE IS READ ONCE A STEP).
    this.layVersion += 1;
    const n0 = this.alive;
    // Children are appended after n0 by emit; walk only the old ones, then
    // keep the new ones in order after the survivors.
    const survivors: number[] = [];
    const g = 9.81;
    // Round 16: the air the water drags (THE PLUME'S AIR), from the water as it stands at the step's start.
    const coupled = this.lawsOn.airCoupling;
    if (coupled) this.airPass();
    for (let a = 0; a < n0; a += 1) {
      const i = this.aliveIndex[a];
      const kind = this.kind[i];
      const spec = this.kinds[kind];
      this.age[i] += dt;
      // Round 6: a drop or a jet sheet that carries water flies until it
      // lands (ballistic); its kind's life (0.3 to 2.5 s, a look of rounds 2
      // to 5) would end it in mid air. SPLASH_DROP_MAX_S is a guard for one
      // that never lands. The aerated bulk keeps its kind's life.
      // Round 10: mist that carries water (the bubbles' jet drops) flies until it lands too.
      const flies = this.mass[i] > 0 && (kind === SPLASH_DROP || (kind === SPLASH_MIST && this.areaV[i] > 0)
        || (kind === SPLASH_SHEET && this.scaleM[i] > 0 && this.bulk[i] === 0));
      const lifeNow = flies ? SPLASH_DROP_MAX_S : this.life[i];
      if (this.age[i] >= lifeNow) {
        this.die(i, kind);
        continue;
      }
      // Round 16: this parcel's air before it sheds (its children tear at its slip; THE PLUME'S AIR).
      const oA = i * 3;
      const airA = env.airShare ? env.airShare(this.owner[i], this.pos[oA], this.pos[oA + 1], this.pos[oA + 2]) : 1;
      if (coupled && this.areaV[i] > 0 && this.mass[i] > 0) this.airRead(i, env.airX * airA, env.airZ * airA);
      else { this.airK[i] = 0; this.airUx[i] = env.airX * airA; this.airUy[i] = 0; this.airUz[i] = env.airZ * airA; this.airPhi[i] = 0; }
      // Round 7: an aerated sheet punctures (THE SHEET'S BREAK-UP); one
      // whose holes have met is gone, its water in its rims' ligaments.
      // Round 9: every jet sheet thins as it spreads (h = h0 r0 / r), clear
      // or aerated; only an aerated one opens holes.
      if (kind === SPLASH_SHEET && this.h0M[i] > 0 && this.mass[i] > 0) this.spread(i);
      if (kind === SPLASH_SHEET && this.voidShare[i] > 0 && this.mass[i] > 0 && this.puncture(i, dt)) {
        this.kill(i);
        continue;
      }
      // Shedding (a sheet sheds ligaments and drops as it flies).
      if (kind === SPLASH_SHEET && this.stripM[i] > 0 && this.mass[i] > 0) {
        // Round 19: a curtain strip's rim (THE CURTAIN'S RIM): its water owed by the rate, kg (in shedD), left as
        // ligaments of the strip's launch water over SPLASH_RIM_PIECES.
        const sh = this.shed;
        this.shedD[i] += this.mass[i] * (1 - Math.exp(-this.curtainRimRate(i) * dt));
        const piece = this.m0Kg[i] / SPLASH_RIM_PIECES;
        while (this.shedD[i] >= piece && this.mass[i] > 0) {
          this.shedD[i] -= piece;
          this.child(i, SPLASH_LIGAMENT, sh.ligamentSizeM, Math.min(piece / this.mass[i], 1));
        }
      } else if (kind === SPLASH_SHEET) {
        const sh = this.shed;
        this.shedL[i] += sh.ligamentsPerS * dt;
        this.shedD[i] += sh.dropsPerS * dt;
        while (this.shedL[i] >= 1) { this.shedL[i] -= 1; this.child(i, SPLASH_LIGAMENT, sh.ligamentSizeM); }
        while (this.shedD[i] >= 1) { this.shedD[i] -= 1; this.child(i, SPLASH_DROP, sh.dropSizeM); }
      }
      const o = i * 3;
      const air = airA;
      if (this.areaV[i] > 0) {
        // ROUND 6: BALLISTIC UNDER GRAVITY AND ITS OWN DRAG. A particle with a
        // physical size (its water's area per volume) feels full gravity and
        // the drag of a sphere of its own length scale (`scaleM`: a drop's
        // diameter, a sheet's thickness, a lump's size), by Schiller and Naumann's law
        // (splashDragPerSpeed), integrated exactly for this step's drag rate.
        // Round 16: through the parcel's own air (THE PLUME'S AIR): the ambient air plus kappa of its
        // water's velocity over it; with the coupling off, the ambient air alone (ay 0, rounds 6 to 15).
        const ax = this.airUx[i]; const ay = this.airUy[i]; const az = this.airUz[i];
        const rx = this.vel[o] - ax; const ry = this.vel[o + 1] - ay; const rz = this.vel[o + 2] - az;
        const kd = splashDragPerSpeed(this.scaleM[i], Math.hypot(rx, ry, rz));
        this.dragRate[i] = kd;
        const e = Math.exp(-kd * dt);
        this.vel[o] = ax + rx * e;
        this.vel[o + 2] = az + rz * e;
        this.vel[o + 1] = ay + ry * e - g * dt;
        // Round 10: a fast drop breaks (A FAST DROP BREAKS IN FLIGHT).
        if (kind === SPLASH_DROP && this.mass[i] > 0 && this.lawsOn.breakup) this.breakUp(i, dt, ax, ay, az);
      } else {
        const k = 1 - Math.exp(-dt / spec.tauS);
        this.vel[o] += (env.airX * air - this.vel[o]) * k;
        this.vel[o + 2] += (env.airZ * air - this.vel[o + 2]) * k;
        this.vel[o + 1] += (spec.terminalMs - this.vel[o + 1]) * k * 0.5 - g * spec.gravityShare * dt;
      }
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      // Round 11: the path flown (THE JET'S AIR DISPERSES THE DROPS).
      this.pathM[i] += Math.sqrt(this.vel[o] * this.vel[o] + this.vel[o + 1] * this.vel[o + 1] + this.vel[o + 2] * this.vel[o + 2]) * dt;
      const x = this.pos[o]; const y = this.pos[o + 1]; const z = this.pos[o + 2];
      const owner = this.owner[i];
      if (this.vel[o + 1] < 0) {
        if (env.inSolid && env.inSolid(owner, x, y, z)) {
          env.onSolid?.(owner, x, y, z, this.sizeOf(i), kind);
          this.noteLanded(i);
          this.kill(i);
          continue;
        }
        // Round 10: mist that carries water lands too (rounds 2 to 9: mist never landed).
        if ((kind !== SPLASH_MIST || this.areaV[i] > 0) && y < env.seaHeight(owner, x, z)) {
          // Round 12: an aerated lump's bubbles surface as a raft (THE CHURN'S BUBBLES SURFACE AS A FOAM RAFT).
          const eB = this.bulk[i] === 1 ? this.bulkVoid[i] : 0;
          const raft = eB > 0 && this.areaV[i] > 0 ? splashBubbleRaftM2(this.mass[i], eB, (6 * eB) / ((1 - eB) * this.areaV[i])) : 0;
          env.onSea?.(owner, x, z, this.sizeOf(i), kind, raft);
          this.landedSea += 1;
          this.noteLanded(i);
          if (this.bulk[i] === 1 && this.lawsOn.bubbleMist) this.burstMist(i, x, env.seaHeight(owner, x, z), z, env.airX * air, env.airZ * air);
          this.kill(i);
          continue;
        }
      }
      survivors.push(i);
    }
    // The new children sit at aliveIndex[n0 .. alive).
    const born: number[] = [];
    for (let a = n0; a < this.alive; a += 1) born.push(this.aliveIndex[a]);
    let w = 0;
    for (const i of survivors) this.aliveIndex[w++] = i;
    for (const i of born) this.aliveIndex[w++] = i;
    this.alive = w;
  }

  /** Round 7: a sheet that lands before its holes meet (the ledger). */
  private noteLanded(i: number): void {
    if (this.kind[i] !== SPLASH_SHEET || this.voidShare[i] <= 0 || this.mass[i] <= 0) return;
    this.sheets.landed += 1;
    this.sheets.landedAgeSumS += this.age[i];
    this.sheets.landedXSum += this.holeX[i];
  }

  /**
   * Round 7: one step of an aerated sheet's puncture (THE SHEET'S BREAK-UP).
   * Thins the sheet by its spread, opens the holes its bubbles make, grows
   * them at the Taylor-Culick speed, and gives the water of the opened area
   * to rim ligaments. Returns true when the holes have met (the sheet is
   * gone; its water is in its children).
   */
  /**
   * ROUND 9: THE CLEAR SHEET THINS AND TEARS AT ITS RIM. Round 7 thinned
   * only an aerated sheet (inside its puncture), so a clear jet sheet flew
   * at its launch thickness until it landed. Every jet sheet spreads round
   * its rock's axis and keeps its volume, so h = h0 r0 / r (Savart's radial
   * sheet); its free edges retract at the Taylor-Culick speed of the
   * thickness it has now, sqrt(2 sigma / (rho h)), which grows as it thins,
   * and the strip between its edges widens as r / r0 = h0 / h
   * (sheetShedShare). A clear sheet of centimeters opens no hole in its
   * flight (THE SHEET'S BREAK-UP), so its rim is its only loss.
   */
  private spread(i: number): void {
    const o = i * 3;
    const r = Math.hypot(this.pos[o] - this.axisX[i], this.pos[o + 2] - this.axisZ[i]);
    // h = h0 r0 / r; r is bounded at a quarter of r0 (a sheet thrown back over its rock's axis).
    const h = (this.h0M[i] * this.r0M[i]) / Math.max(r, 0.25 * this.r0M[i]);
    this.scaleM[i] = h;
    this.areaV[i] = 2 / h;
    this.spreadMs[i] = splashCapillarySpeed(h);
  }

  private puncture(i: number, dt: number): boolean {
    // Round 9: the sheet's thickness now is spread()'s (called first in the step).
    const h = this.scaleM[i];
    const v = this.spreadMs[i];
    const nNow = splashSpanningHoles(h, this.h0M[i], this.voidShare[i]);
    if (nNow > this.holeN[i]) this.holeN[i] = nNow;
    const N = this.holeN[i];
    // Every hole's radius grows by v dt: sum R^2 by 2 v dt sum R + N (v dt)^2, sum R by N v dt.
    const g = v * dt;
    this.holeS2[i] += 2 * g * this.holeS1[i] + N * g * g;
    this.holeS1[i] += N * g;
    const X = 1 - Math.exp(-Math.PI * this.holeS2[i]);
    const x0 = this.holeX[i];
    if (X <= x0) return false;
    this.holeX[i] = X;
    // The rim shed (sheetShedShare) also takes this sheet's water, so a sheet
    // whose water is all given before its holes meet is gone too.
    let gone = X >= SPLASH_SHEET_GONE_X;
    const give = gone ? this.mass[i] : (this.mass[i] * (X - x0)) / Math.max(1 - x0, 1e-6);
    const meanR = N > 0 ? this.holeS1[i] / N : 0;
    this.rimDiameterM = Math.max(Math.sqrt((2 * meanR * h) / Math.PI), h);
    const piece = this.m0Kg[i] / SPLASH_RIM_PIECES;
    this.rimCarry[i] += give;
    const sh = this.shed;
    while (this.rimCarry[i] >= piece && this.mass[i] > 0) {
      this.rimCarry[i] -= piece;
      const before = this.mass[i];
      this.child(i, SPLASH_LIGAMENT, sh.ligamentSizeM, Math.min(piece / Math.max(before, 1e-9), 1));
      this.sheets.rimKg += before - this.mass[i];
    }
    if (this.mass[i] <= 1e-6 * this.m0Kg[i]) gone = true;
    if (gone) {
      if (this.mass[i] > 0) {
        const before = this.mass[i];
        this.child(i, SPLASH_LIGAMENT, sh.ligamentSizeM, 1);
        this.sheets.rimKg += before - this.mass[i];
      }
      this.sheets.gone += 1;
      this.sheets.goneAgeSumS += this.age[i];
    }
    this.rimDiameterM = 0;
    return gone;
  }

  private kill(i: number): void {
    this.massLanded += this.mass[i];
    this.mass[i] = 0;
    this.age[i] = this.life[i];
    this.freeList[this.freeCount++] = i;
  }

  /** The end of a life: a sheet breaks into drops and mist, a ligament into drops. */
  private die(i: number, kind: number): void {
    const sh = this.shed;
    // Round 6: the end children share all the water left (the mist first:
    // its share is the gamma law's tail and is not taken from the drops).
    if (kind === SPLASH_SHEET) {
      if (this.rng.next() < sh.endMistChance) this.child(i, SPLASH_MIST, sh.mistSizeM, 1);
      const m0 = this.mass[i];
      for (let k = 0; k < sh.endDrops; k += 1) {
        this.mass[i] = m0 * (1 - k / sh.endDrops);
        this.child(i, SPLASH_DROP, sh.dropSizeM, 1 / (sh.endDrops - k));
      }
    } else if (kind === SPLASH_LIGAMENT) {
      const m0 = this.mass[i];
      for (let k = 0; k < sh.ligamentEndDrops; k += 1) {
        this.mass[i] = m0 * (1 - k / sh.ligamentEndDrops);
        this.child(i, SPLASH_DROP, sh.dropSizeM, 1 / (sh.ligamentEndDrops - k));
      }
    }
    // Water still in a particle at the end of its life (mist, a guarded drop) leaves the ledger as expired.
    this.massExpired += this.mass[i];
    this.mass[i] = 0;
    this.kill(i);
  }
}
