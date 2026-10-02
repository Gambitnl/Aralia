/**
 * @file oceanSplashMath.ts — water thrown into the air: the one splash
 * model, pure and deterministic, for every piece that throws water.
 *
 * WHY THIS EXISTS (rocks round 2, 2026-09-29; Remy: all water is one
 * system; the lead: no third spray system). The sea had two splash systems
 * and neither can take water thrown by a solid:
 *
 *   - the spray piece (`oceanSpray.ts`) roots its strands on the sea's own
 *     whitecaps, inside its GPU update kernel, and streams them with the
 *     wind from a root that stays on the water; it has no way to be told
 *     "a jet leaves this rock face at 9 m/s";
 *   - the buoy's burst is a private pool inside `oceanExtras/buoys.ts`,
 *     drawn as one kind of drop, with nothing else able to call it.
 *
 * This module is the shared model a solid's splash needs: a caller EMITS
 * water with a position, a velocity and a kind, and the pool breaks it up,
 * flies it, lights it and lands it. The rocks use it; the buoy's burst and
 * the skip stones' splash can move onto it (the calls are listed in the
 * rocks report), and the spray piece's wind-torn spume stays its own,
 * because it is born on the sea, not thrown by a solid.
 *
 * THE BREAKUP. Water leaves a solid as a SHEET: a dense, aerated mass that
 * is white and opaque where it is thick. As it flies it sheds LIGAMENTS
 * (strands drawn out of its edge) and DROPS, and when it thins out it breaks
 * into drops and a puff of MIST, which the air carries (the sheet, ligament,
 * drop sequence of Villermaux 2007, Annu. Rev. Fluid Mech. 39: 419-446).
 * Ligaments end in drops too. A FALL is a stream poured off an edge. Every
 * kind has its own drag time, growth and life (SPLASH_KINDS).
 *
 * THE LIGHT. A plume is a volume: its top and its sun side are bright, its
 * core and its underside are shadowed grey, and its thin edges are lit
 * through. `splashLight` splats every live particle's optical depth into a
 * coarse grid round the plume and marches from each particle toward the sun
 * and straight up, so each particle knows how much sun and how much sky
 * reach it (Beer-Lambert through the plume itself).
 *
 * DETERMINISM. One seeded generator (the LCG of the buoy burst), a fixed
 * step, a stable live list: the same emits from the same start give the same
 * pool, bit for bit. No three import, no clock, no Math.random.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/09/2026, 19:24:38
 * Dependents: systems/world3d/ocean/oceanRocks.ts, systems/world3d/ocean/oceanRocksMath.ts, systems/world3d/ocean/oceanSplash.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** Particle kinds. */
export const SPLASH_SHEET = 0;
export const SPLASH_LIGAMENT = 1;
export const SPLASH_DROP = 2;
export const SPLASH_MIST = 3;
export const SPLASH_FALL = 4;

export interface SplashKindSpec {
  /** Relaxation time toward the air's velocity, s (a drop's Stokes time; a sheet's is long). */
  readonly tauS: number;
  /** Share of gravity felt (mist is carried, its fall is its terminal speed). */
  readonly gravityShare: number;
  /** Terminal fall speed the vertical drag relaxes toward, m/s (negative is down). */
  readonly terminalMs: number;
  /** Growth of the drawn size with age, m/s (a spreading mass, a dispersing puff). */
  readonly growMs: number;
  /** Life, s, drawn between these. */
  readonly lifeS: readonly [number, number];
  /** The drawn opacity of a fresh particle of this kind. */
  readonly alpha: number;
  /** The optical depth one particle adds per m^2 of its drawn area (the light's density). */
  readonly extinction: number;
}

/**
 * THE KINDS. Tau: a centimeter drop's relaxation time is over a second (a
 * sheet or a ligament is heavier still), a millimeter drop's 0.3 s (the
 * spray piece's `SPRAY_DROP_TAU_S`), mist's under 0.1 s. Growth: a sheet
 * opens as it flies (a jet sheet thins and widens at about its speed's
 * tenth), mist disperses. Opacity: a sheet is dense white, mist a veil.
 */
export const SPLASH_KINDS: readonly SplashKindSpec[] = [
  { tauS: 2.5, gravityShare: 1, terminalMs: -9, growMs: 0.3, lifeS: [0.3, 0.65], alpha: 0.9, extinction: 1.6 },
  { tauS: 1.4, gravityShare: 1, terminalMs: -7, growMs: 0.05, lifeS: [0.25, 0.6], alpha: 0.65, extinction: 0.9 },
  { tauS: 0.9, gravityShare: 1, terminalMs: -5, growMs: 0.01, lifeS: [0.6, 2.5], alpha: 0.55, extinction: 0.6 },
  { tauS: 0.12, gravityShare: 0.05, terminalMs: -0.4, growMs: 0.45, lifeS: [1.2, 3.0], alpha: 0.07, extinction: 0.35 },
  { tauS: 3, gravityShare: 1, terminalMs: -8, growMs: 0.02, lifeS: [1.5, 3.0], alpha: 0.5, extinction: 0.4 },
];

/**
 * SHEDDING. A sheet sheds ligaments and drops as it flies, per second of
 * its life, and breaks into drops and mist when it dies; a ligament ends in
 * drops. A child leaves at its parent's velocity with a jitter of this share
 * of the parent's speed (the capillary breakup's velocity spread, a fifth
 * to a third of the sheet's speed), from a point in the parent's drawn size.
 */
export const SPLASH_SHEET_SHED_LIGAMENTS_PER_S = 18;
export const SPLASH_SHEET_SHED_DROPS_PER_S = 26;
export const SPLASH_SHEET_END_DROPS = 5;
export const SPLASH_SHEET_END_MIST = 0.2;
export const SPLASH_LIGAMENT_END_DROPS = 2;
export const SPLASH_CHILD_JITTER = 0.22;
export const SPLASH_LIGAMENT_SIZE_M: readonly [number, number] = [0.03, 0.07];
export const SPLASH_DROP_SIZE_M: readonly [number, number] = [0.015, 0.035];
export const SPLASH_MIST_SIZE_M: readonly [number, number] = [0.35, 0.8];

/**
 * How a caller tunes the model to its own water (round 2): a rock's jet is a
 * thick, opaque sheet; a skipping stone's crown is a thin sheet mostly seen
 * through, brighter only where it folds or froths, whose rim tears into jets
 * and beads. Both are the same breakup with other numbers, so a caller
 * passes its own kinds and shedding, and each emit may carry an opacity.
 */
export interface SplashShedSpec {
  readonly ligamentsPerS: number;
  readonly dropsPerS: number;
  readonly endDrops: number;
  readonly endMistChance: number;
  readonly ligamentEndDrops: number;
  readonly childJitter: number;
  readonly ligamentSizeM: readonly [number, number];
  readonly dropSizeM: readonly [number, number];
  readonly mistSizeM: readonly [number, number];
}

/** The shedding the rocks use (the constants above). */
export const SPLASH_SHED_DEFAULT: SplashShedSpec = {
  ligamentsPerS: SPLASH_SHEET_SHED_LIGAMENTS_PER_S,
  dropsPerS: SPLASH_SHEET_SHED_DROPS_PER_S,
  endDrops: SPLASH_SHEET_END_DROPS,
  endMistChance: SPLASH_SHEET_END_MIST,
  ligamentEndDrops: SPLASH_LIGAMENT_END_DROPS,
  childJitter: SPLASH_CHILD_JITTER,
  ligamentSizeM: SPLASH_LIGAMENT_SIZE_M,
  dropSizeM: SPLASH_DROP_SIZE_M,
  mistSizeM: SPLASH_MIST_SIZE_M,
};

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
  /** A particle reached the sea: its point, its drawn size, its kind. Optional (foam, the sea's own). */
  onSea?(owner: number, x: number, z: number, sizeM: number, kind: number): void;
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
    this.alive = 0;
    this.rng.reset(this.seed);
    for (let i = 0; i < this.capacity; i += 1) this.freeList[i] = this.capacity - 1 - i;
    this.freeCount = this.capacity;
    for (let k = 0; k < this.emitted.length; k += 1) this.emitted[k] = 0;
    this.landedSea = 0;
  }

  /** The pool's generator, for a caller that must scatter its emits deterministically. */
  random(): number { return this.rng.next(); }

  /** The drawn size of particle i now. */
  sizeOf(i: number): number {
    return this.size0[i] + this.kinds[this.kind[i]].growMs * this.age[i];
  }

  /**
   * Throw one particle. Returns its slot, or -1 when the pool is full (the
   * water is not thrown; `emitted` still counts only what flew).
   */
  emit(
    kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, sizeM: number, owner: number,
    opacity = 1,
  ): number {
    if (this.freeCount === 0) return -1;
    const i = this.freeList[--this.freeCount];
    this.aliveIndex[this.alive++] = i;
    const spec = this.kinds[kind];
    this.opacity[i] = opacity;
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

  /** A child of particle i: its velocity jittered, from a point within its drawn size. */
  private child(i: number, kind: number, sizeRange: readonly [number, number]): void {
    const r = this.rng;
    const s = this.sizeOf(i);
    const vx = this.vel[i * 3]; const vy = this.vel[i * 3 + 1]; const vz = this.vel[i * 3 + 2];
    const sp = Math.hypot(vx, vy, vz) * this.shed.childJitter;
    this.emit(
      kind,
      this.pos[i * 3] + (r.next() - 0.5) * s,
      this.pos[i * 3 + 1] + (r.next() - 0.5) * s,
      this.pos[i * 3 + 2] + (r.next() - 0.5) * s,
      vx + (r.next() - 0.5) * 2 * sp,
      vy + (r.next() - 0.5) * 2 * sp,
      vz + (r.next() - 0.5) * 2 * sp,
      sizeRange[0] + (sizeRange[1] - sizeRange[0]) * r.next() ** 2,
      this.owner[i],
      this.opacity[i],
    );
  }

  /** One fixed step of every live particle. Children born this step start next step. */
  step(dt: number, env: SplashEnv): void {
    const n0 = this.alive;
    // Children are appended after n0 by emit; walk only the old ones, then
    // keep the new ones in order after the survivors.
    const survivors: number[] = [];
    const g = 9.81;
    for (let a = 0; a < n0; a += 1) {
      const i = this.aliveIndex[a];
      const kind = this.kind[i];
      const spec = this.kinds[kind];
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.die(i, kind);
        continue;
      }
      // Shedding (a sheet sheds ligaments and drops as it flies).
      if (kind === SPLASH_SHEET) {
        const sh = this.shed;
        this.shedL[i] += sh.ligamentsPerS * dt;
        this.shedD[i] += sh.dropsPerS * dt;
        while (this.shedL[i] >= 1) { this.shedL[i] -= 1; this.child(i, SPLASH_LIGAMENT, sh.ligamentSizeM); }
        while (this.shedD[i] >= 1) { this.shedD[i] -= 1; this.child(i, SPLASH_DROP, sh.dropSizeM); }
      }
      const o = i * 3;
      const k = 1 - Math.exp(-dt / spec.tauS);
      const air = env.airShare ? env.airShare(this.owner[i], this.pos[o], this.pos[o + 1], this.pos[o + 2]) : 1;
      this.vel[o] += (env.airX * air - this.vel[o]) * k;
      this.vel[o + 2] += (env.airZ * air - this.vel[o + 2]) * k;
      this.vel[o + 1] += (spec.terminalMs - this.vel[o + 1]) * k * 0.5 - g * spec.gravityShare * dt;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      const x = this.pos[o]; const y = this.pos[o + 1]; const z = this.pos[o + 2];
      const owner = this.owner[i];
      if (this.vel[o + 1] < 0) {
        if (env.inSolid && env.inSolid(owner, x, y, z)) {
          env.onSolid?.(owner, x, y, z, this.sizeOf(i), kind);
          this.kill(i);
          continue;
        }
        if (kind !== SPLASH_MIST && y < env.seaHeight(owner, x, z)) {
          env.onSea?.(owner, x, z, this.sizeOf(i), kind);
          this.landedSea += 1;
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

  private kill(i: number): void {
    this.age[i] = this.life[i];
    this.freeList[this.freeCount++] = i;
  }

  /** The end of a life: a sheet breaks into drops and mist, a ligament into drops. */
  private die(i: number, kind: number): void {
    const sh = this.shed;
    if (kind === SPLASH_SHEET) {
      for (let k = 0; k < sh.endDrops; k += 1) this.child(i, SPLASH_DROP, sh.dropSizeM);
      if (this.rng.next() < sh.endMistChance) this.child(i, SPLASH_MIST, sh.mistSizeM);
    } else if (kind === SPLASH_LIGAMENT) {
      for (let k = 0; k < sh.ligamentEndDrops; k += 1) this.child(i, SPLASH_DROP, sh.dropSizeM);
    }
    this.kill(i);
  }
}

/* ------------------------------------------------------------------ */
/* The light through the plume                                          */
/* ------------------------------------------------------------------ */

/** The light grid's cells a side, and its largest side, meters. */
export const SPLASH_LIGHT_N = 18;
export const SPLASH_LIGHT_MAX_M = 36;

/**
 * The light each live particle receives, into `out` (two floats a slot:
 * the sun's share and the sky's share, 0 to 1). Every live particle adds
 * its kind's extinction times its drawn area times its alpha to the cell it
 * is in (an optical density per m^3); then from each particle the pool is
 * marched toward the sun and straight up to the grid's edge, and the share
 * is exp(-tau) (Beer-Lambert), with a floor for the light scattered many
 * times inside the plume (0.15 of the sun, 0.45 of the sky).
 */
export function splashLight(
  pool: SplashPool, sunX: number, sunY: number, sunZ: number, out: Float32Array,
  alphaOf: (i: number) => number,
): void {
  const n = pool.alive;
  if (n === 0) return;
  let x0 = Infinity; let y0 = Infinity; let z0 = Infinity;
  let x1 = -Infinity; let y1 = -Infinity; let z1 = -Infinity;
  for (let a = 0; a < n; a += 1) {
    const i = pool.aliveIndex[a];
    const x = pool.pos[i * 3]; const y = pool.pos[i * 3 + 1]; const z = pool.pos[i * 3 + 2];
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z;
    if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
  }
  const N = SPLASH_LIGHT_N;
  const side = Math.min(Math.max(x1 - x0, y1 - y0, z1 - z0, 1) + 1, SPLASH_LIGHT_MAX_M);
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2; const cz = (z0 + z1) / 2;
  const ox = cx - side / 2; const oy = cy - side / 2; const oz = cz - side / 2;
  const cell = side / N;
  // One grid and one per-cell cache for every call (no allocation a frame).
  const grid = LIGHT_GRID;
  grid.fill(0);
  LIGHT_MARK.fill(0);
  const idx = (fx: number, fy: number, fz: number) => {
    const ix = Math.floor((fx - ox) / cell); const iy = Math.floor((fy - oy) / cell); const iz = Math.floor((fz - oz) / cell);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= N || iy >= N || iz >= N) return -1;
    return (iz * N + iy) * N + ix;
  };
  const vol = cell * cell * cell;
  for (let a = 0; a < n; a += 1) {
    const i = pool.aliveIndex[a];
    const jx = Math.floor((pool.pos[i * 3] - ox) / cell);
    const jy = Math.floor((pool.pos[i * 3 + 1] - oy) / cell);
    const jz = Math.floor((pool.pos[i * 3 + 2] - oz) / cell);
    if (jx < 0 || jy < 0 || jz < 0 || jx >= N || jy >= N || jz >= N) continue;
    const c = (jz * N + jy) * N + jx;
    const s = pool.sizeOf(i);
    grid[c] += (pool.kinds[pool.kind[i]].extinction * s * s * alphaOf(i)) / vol;
  }
  const sl = Math.hypot(sunX, sunY, sunZ) || 1;
  const sx = sunX / sl; const sy = sunY / sl; const sz = sunZ / sl;
  const stepM = cell;
  const steps = N;
  // THE MARCH IS PER CELL (rocks round 2 cost pass): every particle in a
  // cell takes the light marched from that cell's center, once, and cached.
  // A plume of 10,000 particles fills a few hundred cells, so this is the
  // march's cost cut by the particles per cell (round 2's first A/B had the
  // piece's CPU update at 1.4 to 2.8 ms with a march per particle). The
  // grid's cell (1/18 of the plume) is the light's resolution either way.
  for (let a = 0; a < n; a += 1) {
    const i = pool.aliveIndex[a];
    const px = pool.pos[i * 3]; const py = pool.pos[i * 3 + 1]; const pz = pool.pos[i * 3 + 2];
    // The cell, inline (the closure's call was most of this loop's cost).
    const jx = Math.floor((px - ox) / cell); const jy = Math.floor((py - oy) / cell); const jz = Math.floor((pz - oz) / cell);
    const c = jx < 0 || jy < 0 || jz < 0 || jx >= N || jy >= N || jz >= N ? -1 : (jz * N + jy) * N + jx;
    if (c >= 0 && LIGHT_MARK[c] === 1) {
      out[i * 2] = LIGHT_CACHE[c * 2];
      out[i * 2 + 1] = LIGHT_CACHE[c * 2 + 1];
      continue;
    }
    // The march starts at the cell's center (the particle's own position
    // for a particle outside the grid), half a cell out, so a cell does not
    // shadow itself.
    let qx = px; let qy = py; let qz = pz;
    if (c >= 0) {
      const ix = c % N; const iy = Math.floor(c / N) % N; const iz = Math.floor(c / (N * N));
      qx = ox + (ix + 0.5) * cell; qy = oy + (iy + 0.5) * cell; qz = oz + (iz + 0.5) * cell;
    }
    let tauS = 0;
    let tauU = 0;
    for (let k = 0; k < steps; k += 1) {
      const d = (k + 0.5) * stepM;
      const cs = idx(qx + sx * d, qy + sy * d, qz + sz * d);
      if (cs >= 0) tauS += grid[cs] * stepM;
      const cu = idx(qx, qy + d, qz);
      if (cu >= 0) tauU += grid[cu] * stepM;
      if (cs < 0 && cu < 0) break;
    }
    // Floors for the light scattered many times inside the plume: a dense
    // white cloud's core is grey, not black (a thick cloud's shaded base is
    // about a third to a half of its lit top).
    const lS = 0.15 + 0.85 * Math.exp(-tauS);
    const lU = 0.45 + 0.55 * Math.exp(-0.6 * tauU);
    out[i * 2] = lS;
    out[i * 2 + 1] = lU;
    if (c >= 0) {
      LIGHT_MARK[c] = 1;
      LIGHT_CACHE[c * 2] = lS;
      LIGHT_CACHE[c * 2 + 1] = lU;
    }
  }
}
const LIGHT_GRID = new Float32Array(SPLASH_LIGHT_N ** 3);
const LIGHT_MARK = new Uint8Array(SPLASH_LIGHT_N ** 3);
const LIGHT_CACHE = new Float32Array(SPLASH_LIGHT_N ** 3 * 2);

/* ------------------------------------------------------------------ */
/* The plume as a volume (rocks round 3)                                */
/* ------------------------------------------------------------------ */

/**
 * WHY A VOLUME (rocks round 3). Both round-2 judges read the burst as "a
 * cloud of billboard puffs and straight streak sprites ... no shading, no
 * see-through falloff and no light direction". A real plume is ONE soft
 * medium: it is opaque where it is dense (its base on the rock), thinner as
 * it climbs, lit on its sun side and grey in its core and underside, and it
 * dissolves at its rim. Particles cannot give that: each is lit and blended
 * alone, so a stack of them is a stack of flat cutouts.
 *
 * So the pool's water is splatted into a DENSITY GRID (the extinction
 * coefficient sigma, 1/m, of the air-and-water mixture in each cell), the
 * light through that grid is marched once per light cell (Beer-Lambert
 * toward the sun, and up toward the sky), and the draw ray-marches the grid
 * as a stack of slices (`oceanSplash.ts`). Only the rim's drops stay as
 * particles.
 *
 * WHAT ADDS DENSITY. A particle of kind k with drawn size s and opacity a
 * adds an optical cross-section of extinction_k s^2 a (m^2), the same
 * measure `splashLight` uses, spread over the cells its size covers (a
 * smooth kernel, weights summed to 1) and divided by the cell's volume. A
 * 0.3 m sheet then gives sigma of about 7 per meter over its 0.3 m: 88%
 * opaque, the white wall at the plume's base. The kinds splatted are the
 * sheet, the ligament, the drop and the mist, each times its parcel gain
 * (SPLASH_VOLUME_GAIN). A FALL is not splatted: water poured off an edge
 * is drawn on the rock's faces (`oceanRocks.ts`).
 *
 * THE GRID follows the plume. Its cell is fixed (so the drawn texture does
 * not change scale from frame to frame), its origin is snapped to whole
 * cells at the live particles' bounds, and a plume larger than the grid
 * keeps the grid on its mass (the rest is not drawn as volume).
 *
 * THE LIGHT is on a grid of half the resolution (the light changes slowly
 * across a plume; the density's detail is the draw's noise, see
 * oceanSplash.ts). From each light cell: tau toward the sun and tau straight
 * up to the grid's edge, and the shares exp(-tau) with floors for the
 * many-times-scattered light that keeps a thick cloud's core grey, not
 * black: round 3 took 0.15 of the sun and 0.3 of the sky (0.45 in the
 * particle light; at 0.45 the volume's core read as flat white, rk3c);
 * round 4 takes SPLASH_VOLUME_SUN_FLOOR and SPLASH_VOLUME_SKY_FLOOR (below).
 */
export const SPLASH_VOLUME_SIGMA_MAX = 80;
/**
 * THE LIGHT'S FLOORS in the volume (round 4). Both round-3 judges saw "the
 * same lighting all over": at floors of 0.15 (sun) and 0.3 (sky) the
 * shadowed core drew at 0.6 of the lit side. The clips' plumes spread wider:
 * k2_012's pink-lit top at a luma of 125 to 135 against its grey underside
 * at 45 to 80, and sl_003's cream at 205 to 210 against its shade at 140
 * (measured, rocks/r4/lumaClips.py). A thick cloud's core keeps a share of
 * light scattered many times, but a plume of drops a few meters across is
 * optically thinner than a cloud and its shaded side is lit mostly by the
 * sky: 0.06 of the sun and 0.18 of the sky.
 */
export const SPLASH_VOLUME_SUN_FLOOR = 0.06;
export const SPLASH_VOLUME_SKY_FLOOR = 0.18;

/**
 * A particle's drawn opacity now: its kind's alpha times the emit's
 * opacity, a 40 ms fade in, a fade out over the last 35% of its life, and a
 * sheet's thinning as it opens (its drawn area grows, its water does not).
 * The particle draw and the volume take the same value.
 */
export function splashDrawnAlpha(pool: SplashPool, i: number): number {
  const kind = pool.kind[i];
  const age = pool.age[i];
  const life = pool.life[i];
  const fadeIn = Math.min(1, age / 0.04);
  const fadeOut = Math.max(0, Math.min(1, (life - age) / (life * 0.35)));
  const thin = kind === SPLASH_SHEET ? Math.min(1, (pool.size0[i] / pool.sizeOf(i)) ** 0.7 + 0.25) : 1;
  return pool.kinds[kind].alpha * pool.opacity[i] * fadeIn * fadeOut * thin;
}
/**
 * THE PARCEL GAIN per kind (sheet, ligament, drop, mist, fall): how many
 * pieces of water of its size one simulated particle stands for in the
 * volume. A real burst is millions of drops; the pool holds 40,000
 * particles, and its 10,000 live drops of 1.5 to 3.5 cm give a 4 m plume a
 * sigma of under 0.1 per meter (invisible), where the reference plumes are
 * opaque white over a meter or two (sigma 2 to 5 per meter). So a drop is a
 * parcel of 11 drops (16 veiled the whole rock from the shore, rk3F) of its size, a strand of 6, a sheet 1.5 (its water is
 * already a mass), mist 0.4 (its puff is wide and thin). A fall is drawn on
 * the rock (0). The first volume build (round 3, rk3b) drew the sheets
 * alone as a few round white balls with no body: the plume's body IS the
 * drops.
 */
// Round 4: the sheet 2.5 (was 1.5): the struck face's sheets are the
// plume's opaque root (sl_003's white wall), and the round-3 daylight plume
// drew with see-through gaps at its base.
export const SPLASH_VOLUME_GAIN: readonly number[] = [2.5, 6, 11, 0.4, 0];
/** The largest kernel radius a particle is splatted over, cells, by kind (a grown mist puff is capped low: at 3 it drew balls; a lone sheet at 3 drew a cotton ball, rk3fin). */
const SPLASH_VOLUME_MAX_R_CELLS: readonly number[] = [2, 2, 2, 1.5, 2];
/** The smallest kernel radius, cells: a parcel is a cloud, not a point (a trilinear point drew speckle). */
const SPLASH_VOLUME_MIN_R_CELLS = 0.9;
/**
 * THE KERNEL IS DRAWN OUT ALONG THE FLIGHT (rocks round 4). Both round-3
 * judges read the volume as "round cauliflower lumps": every parcel was a
 * sphere. Water thrown off a rock is torn sheets and strands, long along
 * their flight and thin across it (k2_012: fibers 0.3 to 0.6 m long, a few
 * centimeters wide; sl_003: its rim in streaks along the throw). So a
 * parcel is splatted as an ellipsoid along its velocity: its long radius is
 * the round radius plus its travel in SPLASH_VOLUME_STRETCH_S (the time
 * over which its water is spread along its path: a parcel stands for many
 * pieces thrown one after another), capped at SPLASH_VOLUME_MAX_ELONG times
 * the round radius, and its cross radius falls by the square root, so the
 * ellipsoid holds the sphere's volume (and the splat keeps its mass).
 * Order sheet, strand, drop, mist, fall: mist is a puff (no stretch).
 */
export const SPLASH_VOLUME_STRETCH_S: readonly number[] = [0.07, 0.12, 0.1, 0, 0];
export const SPLASH_VOLUME_MAX_ELONG = 4;
/** The smallest cross radius of a drawn-out kernel, cells (under 1.1 a kernel between cell centers holds only its middle row of cells). */
const SPLASH_VOLUME_MIN_CROSS_CELLS = 1.1;

export interface SplashVolumeSpec {
  /** Cells a side, x (across), y (up) and z. */
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  /** The cell's side, meters. */
  readonly cellM: number;
}

/** One owner's plume as a density grid and a light grid. Pure: the same pool gives the same grids. */
export class SplashVolume {
  readonly spec: SplashVolumeSpec;
  /** The grid's corner, meters (world). */
  ox = 0;
  oy = 0;
  oz = 0;
  /** sigma per cell, 1/m, index (iz ny + iy) nx + ix. */
  readonly sigma: Float32Array;
  /** The light grid's cells a side (half the density grid's, rounded up). */
  readonly lx: number;
  readonly ly: number;
  readonly lz: number;
  /** The sun's share and the sky's share per light cell, 0 to 1. */
  readonly sun: Float32Array;
  readonly sky: Float32Array;
  /** The occupied cells' bounds (inclusive), or empty when no cell holds density. */
  bx0 = 0; by0 = 0; bz0 = 0; bx1 = -1; by1 = -1; bz1 = -1;
  /** The largest sigma in the grid. */
  peak = 0;
  /**
   * THE FLIGHT AXIS (round 4): the mass-weighted mean axis of the water's
   * motion, a unit vector with y >= 0 (an axis, not a direction: a rising
   * and a falling parcel stretch the same way). The draw stretches its
   * detail along it, so the plume's texture is fibers along its flight.
   */
  axisX = 0;
  axisY = 1;
  axisZ = 0;
  /** Per light cell, the local flight axis (x and z; y >= 0 from the unit length), for the draw. */
  readonly flowX: Float32Array;
  readonly flowZ: Float32Array;
  private readonly coarse: Float32Array;

  constructor(spec: SplashVolumeSpec) {
    this.spec = spec;
    this.sigma = new Float32Array(spec.nx * spec.ny * spec.nz);
    this.lx = Math.ceil(spec.nx / 2);
    this.ly = Math.ceil(spec.ny / 2);
    this.lz = Math.ceil(spec.nz / 2);
    this.coarse = new Float32Array(this.lx * this.ly * this.lz);
    this.sun = new Float32Array(this.lx * this.ly * this.lz).fill(1);
    this.sky = new Float32Array(this.lx * this.ly * this.lz).fill(1);
    this.flowX = new Float32Array(this.lx * this.ly * this.lz);
    this.flowZ = new Float32Array(this.lx * this.ly * this.lz);
    this.flowY = new Float32Array(this.lx * this.ly * this.lz);
  }
  private readonly flowY: Float32Array;

  /** Whether any cell holds density. */
  get empty(): boolean { return this.bx1 < this.bx0; }

  /** The last kernel (`kernelOf`): speed, unit axis (y >= 0), long and cross radii and box half-sides, in cells. */
  private kSp = 0; private kDx = 0; private kDy = 1; private kDz = 0;
  private kRb = 1; private kRa = 1; private kEx = 1; private kEy = 1; private kEz = 1;
  /**
   * Particle i's drawn-out kernel (see SPLASH_VOLUME_STRETCH_S), in cells:
   * the round radius r (its size, clamped by kind) plus half a cell, drawn
   * out along the flight axis to Rb and thinned across it to Ra, and the
   * half-sides of the box that holds it.
   */
  private kernelOf(pool: SplashPool, i: number): void {
    const { cellM } = this.spec;
    const kind = pool.kind[i];
    const s = pool.sizeOf(i);
    const r = Math.min(Math.max(s / (2 * cellM), SPLASH_VOLUME_MIN_R_CELLS), SPLASH_VOLUME_MAX_R_CELLS[kind] ?? 2);
    const vx = pool.vel[i * 3]; const vy = pool.vel[i * 3 + 1]; const vz = pool.vel[i * 3 + 2];
    const sp = Math.hypot(vx, vy, vz);
    const flip = vy < 0 ? -1 : 1;
    const dx = sp > 1e-4 ? (vx / sp) * flip : 0;
    const dy = sp > 1e-4 ? (vy / sp) * flip : 1;
    const dz = sp > 1e-4 ? (vz / sp) * flip : 0;
    const R = r + 0.5;
    const along = (sp * (SPLASH_VOLUME_STRETCH_S[kind] ?? 0)) / cellM;
    const e = Math.min(1 + along / R, SPLASH_VOLUME_MAX_ELONG);
    const Rb = R * e;
    const Ra = Math.max(R / Math.sqrt(e), SPLASH_VOLUME_MIN_CROSS_CELLS);
    this.kSp = sp; this.kDx = dx; this.kDy = dy; this.kDz = dz; this.kRb = Rb; this.kRa = Ra;
    this.kEx = Math.sqrt((Rb * dx) ** 2 + Ra * Ra * (1 - dx * dx));
    this.kEy = Math.sqrt((Rb * dy) ** 2 + Ra * Ra * (1 - dy * dy));
    this.kEz = Math.sqrt((Rb * dz) ** 2 + Ra * Ra * (1 - dz * dz));
  }

  /** The kinds that add density, and their share. */
  static shareOf(kind: number): number {
    return SPLASH_VOLUME_GAIN[kind] ?? 0;
  }

  /**
   * Splat the owner's live particles. `alphaOf(i)` is the particle's drawn
   * opacity (its kind's alpha times its fades), the same the light uses.
   */
  build(pool: SplashPool, owner: number, alphaOf: (i: number) => number): void {
    const { nx, ny, nz, cellM } = this.spec;
    const sig = this.sigma;
    sig.fill(0);
    this.peak = 0;
    this.bx0 = 0; this.by0 = 0; this.bz0 = 0; this.bx1 = -1; this.by1 = -1; this.bz1 = -1;
    // The bounds and the mass centroid of what adds density.
    let x0 = Infinity; let y0 = Infinity; let z0 = Infinity;
    let x1 = -Infinity; let y1 = -Infinity; let z1 = -Infinity;
    let mx = 0; let my = 0; let mz = 0; let mw = 0;
    let count = 0;
    for (let a = 0; a < pool.alive; a += 1) {
      const i = pool.aliveIndex[a];
      if (pool.owner[i] !== owner) continue;
      const share = SplashVolume.shareOf(pool.kind[i]);
      if (share === 0) continue;
      const x = pool.pos[i * 3]; const y = pool.pos[i * 3 + 1]; const z = pool.pos[i * 3 + 2];
      // Round 4: the bounds hold each drawn-out kernel's reach (its box, beyond the grid's own margin).
      this.kernelOf(pool, i);
      const kx = this.kEx * cellM; const ky = this.kEy * cellM; const kz = this.kEz * cellM;
      if (x - kx < x0) x0 = x - kx; if (y - ky < y0) y0 = y - ky; if (z - kz < z0) z0 = z - kz;
      if (x + kx > x1) x1 = x + kx; if (y + ky > y1) y1 = y + ky; if (z + kz > z1) z1 = z + kz;
      const s = pool.sizeOf(i);
      const w = pool.kinds[pool.kind[i]].extinction * s * s * share;
      mx += x * w; my += y * w; mz += z * w; mw += w;
      count += 1;
    }
    if (count === 0) return;
    mx /= mw; my /= mw; mz /= mw;
    // Fit the grid: a cell of margin past the kernels' reach; a plume larger than the grid keeps the grid on its mass.
    const pad = cellM;
    const fit = (lo: number, hi: number, m: number, n: number) => {
      const size = n * cellM;
      const start = hi - lo + 2 * pad <= size ? lo - pad : Math.min(Math.max(m - size / 2, lo - pad), hi + pad - size);
      return Math.floor(start / cellM) * cellM;
    };
    this.ox = fit(x0, x1, mx, nx);
    this.oy = fit(y0, y1, my, ny);
    this.oz = fit(z0, z1, mz, nz);
    const vol = cellM * cellM * cellM;
    let bx0 = nx; let by0 = ny; let bz0 = nz; let bx1 = -1; let by1 = -1; let bz1 = -1;
    const fX = this.flowX; const fY = this.flowY; const fZ = this.flowZ;
    fX.fill(0); fY.fill(0); fZ.fill(0);
    const { lx, ly } = this;
    let ax = 0; let ay = 0; let az = 0;
    for (let a = 0; a < pool.alive; a += 1) {
      const i = pool.aliveIndex[a];
      if (pool.owner[i] !== owner) continue;
      const kind = pool.kind[i];
      const share = SplashVolume.shareOf(kind);
      if (share === 0) continue;
      const alpha = alphaOf(i);
      if (alpha <= 0) continue;
      const s = pool.sizeOf(i);
      const mass = (pool.kinds[kind].extinction * s * s * alpha * share) / vol;
      // The particle in cell units, cell centers at integer + 0.5.
      const fx = (pool.pos[i * 3] - this.ox) / cellM - 0.5;
      const fy = (pool.pos[i * 3 + 1] - this.oy) / cellM - 0.5;
      const fz = (pool.pos[i * 3 + 2] - this.oz) / cellM - 0.5;
      this.kernelOf(pool, i);
      const sp = this.kSp; const dx = this.kDx; const dy = this.kDy; const dz = this.kDz;
      const Rb = this.kRb; const Ra = this.kRa;
      // The flow axis, weighted by the mass, into the light cell and the whole.
      {
        const lxI = Math.min(Math.max(Math.floor((fx + 0.5) / 2), 0), lx - 1);
        const lyI = Math.min(Math.max(Math.floor((fy + 0.5) / 2), 0), ly - 1);
        const lzI = Math.min(Math.max(Math.floor((fz + 0.5) / 2), 0), this.lz - 1);
        const lc = (lzI * ly + lyI) * lx + lxI;
        const m = mass * sp;
        fX[lc] += dx * m; fY[lc] += dy * m; fZ[lc] += dz * m;
        ax += dx * m; ay += dy * m; az += dz * m;
      }
      // The ellipsoid: d2 = (r.r - (r.d)^2) / Ra^2 + (r.d)^2 / Rb^2 < 1; its box per axis.
      const iRa2 = 1 / (Ra * Ra);
      const iRb2 = 1 / (Rb * Rb);
      const ex = this.kEx; const ey = this.kEy; const ez = this.kEz;
      const x0c = Math.max(0, Math.ceil(fx - ex)); const x1c = Math.min(nx - 1, Math.floor(fx + ex));
      const y0c = Math.max(0, Math.ceil(fy - ey)); const y1c = Math.min(ny - 1, Math.floor(fy + ey));
      const z0c = Math.max(0, Math.ceil(fz - ez)); const z1c = Math.min(nz - 1, Math.floor(fz + ez));
      if (x0c > x1c || y0c > y1c || z0c > z1c) continue;
      // A smooth kernel (1 - d2)^2, normalized over the cells inside the grid, so the mass is kept.
      let wsum = 0;
      for (let cz = z0c; cz <= z1c; cz += 1) {
        const rz = cz - fz;
        for (let cy = y0c; cy <= y1c; cy += 1) {
          const ry = cy - fy;
          for (let cx = x0c; cx <= x1c; cx += 1) {
            const rx = cx - fx;
            const rd = rx * dx + ry * dy + rz * dz;
            const d2 = (rx * rx + ry * ry + rz * rz - rd * rd) * iRa2 + rd * rd * iRb2;
            if (d2 < 1) { const q = 1 - d2; wsum += q * q; }
          }
        }
      }
      if (wsum <= 0) continue;
      const k = mass / wsum;
      for (let cz = z0c; cz <= z1c; cz += 1) {
        const rz = cz - fz;
        for (let cy = y0c; cy <= y1c; cy += 1) {
          const ry = cy - fy;
          for (let cx = x0c; cx <= x1c; cx += 1) {
            const rx = cx - fx;
            const rd = rx * dx + ry * dy + rz * dz;
            const d2 = (rx * rx + ry * ry + rz * rz - rd * rd) * iRa2 + rd * rd * iRb2;
            if (d2 >= 1) continue;
            const q = 1 - d2;
            sig[(cz * ny + cy) * nx + cx] += k * q * q;
            if (cx < bx0) bx0 = cx; if (cx > bx1) bx1 = cx;
            if (cy < by0) by0 = cy; if (cy > by1) by1 = cy;
            if (cz < bz0) bz0 = cz; if (cz > bz1) bz1 = cz;
          }
        }
      }
    }
    // The flight axes, as unit vectors (straight up where no water moves).
    {
      const al = Math.hypot(ax, ay, az);
      if (al > 1e-9) { this.axisX = ax / al; this.axisY = ay / al; this.axisZ = az / al; } else { this.axisX = 0; this.axisY = 1; this.axisZ = 0; }
      for (let c = 0; c < fX.length; c += 1) {
        const l = Math.hypot(fX[c], fY[c], fZ[c]);
        if (l > 1e-9) { fX[c] /= l; fZ[c] /= l; fY[c] /= l; } else { fX[c] = this.axisX; fZ[c] = this.axisZ; fY[c] = this.axisY; }
      }
    }
    let peak = 0;
    for (let c = 0; c < sig.length; c += 1) if (sig[c] > peak) peak = sig[c];
    this.peak = peak;
    if (bx1 >= bx0) {
      this.bx0 = bx0; this.by0 = by0; this.bz0 = bz0; this.bx1 = bx1; this.by1 = by1; this.bz1 = bz1;
    }
  }

  /**
   * The light through the grid for a sun direction (a unit vector, y up).
   * Per light cell: tau toward the sun and straight up, marched on the
   * half-resolution grid (each light cell the mean of its 2 x 2 x 2 density
   * cells), started half a cell out so a cell does not shadow itself.
   */
  light(sunX: number, sunY: number, sunZ: number): void {
    const { nx, ny, nz, cellM } = this.spec;
    const { lx, ly, lz } = this;
    const co = this.coarse;
    co.fill(0);
    const sig = this.sigma;
    for (let z = 0; z < nz; z += 1) {
      const cz = z >> 1;
      for (let y = 0; y < ny; y += 1) {
        const cy = y >> 1;
        const row = (z * ny + y) * nx;
        const crow = (cz * ly + cy) * lx;
        for (let x = 0; x < nx; x += 1) co[crow + (x >> 1)] += sig[row + x] * 0.125;
      }
    }
    const L = 2 * cellM;
    const sl = Math.hypot(sunX, sunY, sunZ) || 1;
    const sx = sunX / sl; const sy = sunY / sl; const sz = sunZ / sl;
    const maxSteps = lx + ly + lz;
    for (let z = 0; z < lz; z += 1) {
      for (let y = 0; y < ly; y += 1) {
        for (let x = 0; x < lx; x += 1) {
          const c = (z * ly + y) * lx + x;
          // Up: the column above, half this cell plus every cell over it.
          let tauU = co[c] * L * 0.5;
          for (let k = y + 1; k < ly; k += 1) tauU += co[(z * ly + k) * lx + x] * L;
          // Toward the sun, a step of one light cell, nearest cell.
          let tauS = co[c] * L * 0.5;
          let px = x + 0.5 + sx; let py = y + 0.5 + sy; let pz = z + 0.5 + sz;
          for (let k = 0; k < maxSteps; k += 1) {
            const ix = Math.floor(px); const iy = Math.floor(py); const iz = Math.floor(pz);
            if (ix < 0 || iy < 0 || iz < 0 || ix >= lx || iy >= ly || iz >= lz) break;
            tauS += co[(iz * ly + iy) * lx + ix] * L;
            px += sx; py += sy; pz += sz;
          }
          this.sun[c] = SPLASH_VOLUME_SUN_FLOOR + (1 - SPLASH_VOLUME_SUN_FLOOR) * Math.exp(-tauS);
          this.sky[c] = SPLASH_VOLUME_SKY_FLOOR + (1 - SPLASH_VOLUME_SKY_FLOOR) * Math.exp(-0.6 * tauU);
        }
      }
    }
  }

  /**
   * Pack for the GPU: `dens` one byte a cell, sqrt(sigma / SIGMA_MAX) (the
   * thin rim keeps its steps; decode sigma = SIGMA_MAX q^2); `lit` four
   * bytes a light cell: sun, sky, and the local flight axis's x and z
   * (round 4; 0.5 + 0.5 v, its y >= 0 from the unit length).
   */
  pack(dens: Uint8Array, lit: Uint8Array): void {
    const sig = this.sigma;
    for (let c = 0; c < sig.length; c += 1) {
      dens[c] = Math.min(255, Math.round(Math.sqrt(Math.min(sig[c] / SPLASH_VOLUME_SIGMA_MAX, 1)) * 255));
    }
    for (let c = 0; c < this.sun.length; c += 1) {
      lit[c * 4] = Math.round(this.sun[c] * 255);
      lit[c * 4 + 1] = Math.round(this.sky[c] * 255);
      // Round 4: the local flight axis (x, z on 0 to 1; y from the unit length).
      lit[c * 4 + 2] = Math.round((this.flowX[c] * 0.5 + 0.5) * 255);
      lit[c * 4 + 3] = Math.round((this.flowZ[c] * 0.5 + 0.5) * 255);
    }
  }
}

/* ------------------------------------------------------------------ */
/* The sun through the air                                              */
/* ------------------------------------------------------------------ */

/**
 * THE SUN'S COLOR THROUGH THE AIR at elevation `elRad`, relative to its color
 * at 30 degrees (the scene's test sun, where the sky module's sun color
 * (1.0, 0.95, 0.85) is right): exp(-tau_lambda (m(el) - m(30))), with the
 * air mass m of Kasten and Young (1989) and zenith optical depths for red,
 * green and blue of 0.10, 0.16 and 0.30 (Rayleigh plus a clear sky's
 * aerosol; Bird and Riordan 1986). At 6 degrees the sun is (0.50, 0.33,
 * 0.13) of its 30-degree self: the orange low sun of a dusk plume. For a
 * piece that lights its own objects; the sky module's gradient does not
 * follow the sun (the rocks report, item 6).
 */
export function sunThroughAir(elRad: number): [number, number, number] {
  const m = (e: number) => {
    const deg = Math.max((e * 180) / Math.PI, -0.5);
    return 1 / (Math.sin(Math.max(e, -0.009)) + 0.50572 * (deg + 6.07995) ** -1.6364);
  };
  const dm = m(elRad) - m(Math.PI / 6);
  const tau = [0.1, 0.16, 0.3];
  return [Math.exp(-tau[0] * dm), Math.exp(-tau[1] * dm), Math.exp(-tau[2] * dm)];
}
