/**
 * @file oceanBeachMath.ts — the beach on the CPU: the swash sheet that runs up
 * the sand and back, the water it loses into the sand, the sand's wetness and
 * how it dries, the foam the sheet carries, and the shells, sticks and
 * seaweed it pushes about.
 *
 * WHY A SEPARATE FILE. `oceanBeach.ts` builds GPU objects and imports
 * `three/webgpu`. The physics here is plain arithmetic, so a test can run a
 * whole minute of swash without a renderer (as `oceanSeabedMath.ts` does for
 * the sea floor).
 *
 * WHAT THE PIECE IS (Remy, 2026-09-27): waves that run up the sand, water that
 * "seeps into the beach sand" and drains slowly, and waves that push shells,
 * sticks and seaweed. Four parts:
 *
 *   1. SWASH. The shallow water equations (depth and two momenta) on a 2D grid
 *      over the sloped sand, with a real wet and dry front. Each wave that
 *      reaches the grid's sea edge enters as a bore, runs up the slope as a
 *      thin sheet, slows under gravity and friction, stops and slides back.
 *   2. DRAINING. The sheet soaks into the sand as it runs. The sand's
 *      hydraulic conductivity is the registry's (`SUBSTANCES[Material.Sand]`,
 *      1e-4 m/s); its porosity is the registry's bulk density over quartz;
 *      its water retention is the Brooks-Corey fit for sand of Rawls,
 *      Brakensiek and Saxton (1982). Every drop is booked: the water that
 *      crossed the sea edge equals the sheet plus the soaked water, to
 *      rounding.
 *   3. WET SAND. Two stores per cell, a skin (the top centimeter, which the
 *      eye sees) and the sand under it. The skin fills from the sheet, gives
 *      its water to the sand under it by suction and gravity, and dries
 *      slowly; the sand under it drains to the water table. The top of the
 *      beach dries first, because it stands highest over the water table.
 *   4. DEBRIS. Each object is a small rigid body on the bed: gravity along
 *      the slope, buoyancy, drag in the sheet, and Coulomb friction on the
 *      sand. Light things move more than heavy ones because that is what the
 *      forces say.
 *
 * DETERMINISM. The sea is a pure function of (seed, time), and so is the
 * beach: it steps with a fixed dt from a fixed start at t = 0, and the state
 * at step k is the same however the steps were grouped into frames. A
 * capture at 42.0 s is 5040 fixed steps from the start. `BeachClock` owns
 * that plan (with checkpoints, so the clock can go back).
 *
 * THE FORCING IS THE SEA ITSELF. The water level at the grid's sea edge is
 * the FFT sea's own height there (`IncidentWaves`): the same spectra, the
 * same seeds and the same dispersion as the GPU cascades, summed over their
 * strongest modes on the CPU. So the waves that run up the sand are the
 * waves that arrive in the picture.
 *
 * UNITS. Metric, internal only (the unit rule in `oceanConfig.ts`).
 * Heights are meters above the mean sea level y = 0.
 *
 * C5 OWNERSHIP: The intact swash solver, bank soil and flux scratch live in oceanBeachField. Coordinates, forcing, debris and simulation assembly stay here.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 25/10/2026, 02:51:10
 * Dependents: systems/world3d/ocean/oceanBeach.ts, systems/world3d/ocean/oceanBeachWorker.ts, systems/world3d/ocean/oceanMouth.ts, systems/world3d/ocean/oceanMouthCoast.ts, systems/world3d/ocean/oceanMouthConditions.ts, systems/world3d/ocean/oceanMouthField.ts, systems/world3d/ocean/oceanMouthFineChop.ts, systems/world3d/ocean/oceanMouthJet.ts, systems/world3d/ocean/oceanMouthMath.ts, systems/world3d/ocean/oceanMouthSimulation.ts, systems/world3d/ocean/oceanMouthTransport.ts, systems/world3d/ocean/oceanMouthTypes.ts, systems/world3d/ocean/oceanMouthWaveMath.ts, systems/world3d/ocean/oceanMouthYoungSea.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type CascadeParams } from './oceanConfig';
import { buildCascadeSpectrum } from './oceanSpectrum';
import { G, type IncidentFn, SwashField, type SwashState, type SwashGridSpec, bilinear, BEACH_SAND, BEACH_SWASH } from './oceanBeachField';
import { type SeabedIsland, type SeabedParams, LAGOON_CAY_SEABED, seabedPointAt, islandFrameAt, LAGOON_CAY } from './oceanSeabedMath';
import { FOAM_TAU_S, foamValueNoisePeriodic, foamCellEdgePeriodic, foamLaceAlpha } from './oceanFoamMath';

// Compatibility exports preserve existing consumers while each concern has one owner.
export { G, GRAIN_DENSITY_KG_M3, type SandSoil, BEACH_SAND, SKIN_M, DEEP_M, saturation, conductivity, suction, equilibriumSaturation, SoilTables, type SwashGridSpec, type SwashParams, BEACH_SWASH, type SwashLedger, type SwashState, type IncidentFn, SwashField, HLL_OUT, hllFaceInto, bilinear, FOAM_AGE_MAX_S } from './oceanBeachField';

/* ------------------------------------------------------------------ */
/* The grid                                                             */
/* ------------------------------------------------------------------ */

/**
 * Where the swash grid sits in the world. `s` runs ONSHORE (up the beach) and
 * `a` along the shore; both are unit vectors in XZ. A cell's world point is
 * origin + s * sHat + a * aHat.
 */
export interface BeachFrame {
  readonly originX: number;
  readonly originZ: number;
  readonly sX: number;
  readonly sZ: number;
  readonly aX: number;
  readonly aZ: number;
}

/** World XZ of a local (s, a) point. */
export function beachToWorld(f: BeachFrame, s: number, a: number): [number, number] {
  return [f.originX + s * f.sX + a * f.aX, f.originZ + s * f.sZ + a * f.aZ];
}

/** Local (s, a) of a world XZ point. */
export function worldToBeach(f: BeachFrame, x: number, z: number): [number, number] {
  const dx = x - f.originX;
  const dz = z - f.originZ;
  return [dx * f.sX + dz * f.sZ, dx * f.aX + dz * f.aZ];
}

/* ------------------------------------------------------------------ */
/* The sea at the grid's edge                                           */
/* ------------------------------------------------------------------ */

/**
 * THE FFT SEA'S OWN HEIGHT at a set of world points, on the CPU.
 *
 * The GPU realizes each cascade as h(P, t) = Re sum_k hhat(k, t) e^{i k.P},
 * hhat = h0(k) e^{i w t} + conj(h0(-k)) e^{-i w t}, from the spectrum
 * `buildCascadeSpectrum` draws for the cascade's seed. This sums the same
 * series over each cascade's strongest modes. The spatial phase e^{i k.P} of
 * every (mode, point) is computed once; a call costs one cosine and one sine
 * per mode and one complex product per (mode, point).
 *
 * Which modes: the cascades named in `use`, each cut to the fewest modes that
 * hold `share` of its variance. On `shallow` the swell's 59 m peak holds 95%
 * in 267 modes and the chop's broad 2 to 30 m band needs 2661; the chop's
 * short waves break and die in the first meter of the grid, so its forcing
 * takes the strongest modes up to `maxModes`.
 */
export class IncidentWaves {
  readonly modes: number;
  readonly points: number;
  /** Share of each used cascade's variance its kept modes hold. */
  readonly keptShare: number[] = [];
  private readonly h0: Float64Array;
  private readonly omega: Float64Array;
  private readonly cosKP: Float64Array;
  private readonly sinKP: Float64Array;
  /** Round 20: each (mode, point)'s shoaling and refraction gain, or null (the sea as drawn). */
  private readonly gain: Float64Array | null;

  constructor(opts: {
    cascades: readonly CascadeParams[];
    n: number;
    seed: number;
    /** Names of the cascades to sum. */
    use: readonly string[];
    share: number;
    maxModes: number;
    /** World X and Z of each point. */
    px: Float64Array;
    pz: Float64Array;
    /**
     * ROUND 20 (the match): shoal and refract every mode from the FFT sea's
     * own depth (its cascade's `depthM`) to the still-water depth at each
     * point, over a shore whose onshore normal is (normalX, normalZ). See
     * `incidentModeGain`. Absent: the sea's height as the GPU draws it.
     */
    shoal?: { depthM: Float64Array; normalX: number; normalZ: number };
  }) {
    const picked: { h0r: number; h0i: number; hcr: number; hci: number; w: number; kx: number; kz: number; d0: number }[] = [];
    opts.cascades.forEach((c, ci) => {
      if (!opts.use.includes(c.name)) return;
      // The seed of each cascade, as `createOceanBuffers` derives it.
      const spec = buildCascadeSpectrum(c, opts.n, (opts.seed ^ (ci * 0x9e3779b9)) >>> 0);
      const cells = opts.n * opts.n;
      const idx: number[] = [];
      const pow = new Float64Array(cells);
      let tot = 0;
      for (let i = 0; i < cells; i += 1) {
        const b = i * 4;
        pow[i] = spec.h0[b] ** 2 + spec.h0[b + 1] ** 2 + spec.h0[b + 2] ** 2 + spec.h0[b + 3] ** 2;
        tot += pow[i];
        if (pow[i] > 0) idx.push(i);
      }
      idx.sort((a, b) => pow[b] - pow[a]);
      let cum = 0;
      let kept = 0;
      for (const i of idx) {
        if (cum >= opts.share * tot || kept >= opts.maxModes) break;
        cum += pow[i];
        kept += 1;
        const b = i * 4;
        picked.push({
          h0r: spec.h0[b], h0i: spec.h0[b + 1], hcr: spec.h0[b + 2], hci: spec.h0[b + 3],
          w: spec.wave[b], kx: spec.wave[b + 1], kz: spec.wave[b + 2], d0: c.depthM,
        });
      }
      this.keptShare.push(tot > 0 ? cum / tot : 0);
    });
    const m = picked.length;
    const p = opts.px.length;
    this.modes = m;
    this.points = p;
    this.h0 = new Float64Array(m * 4);
    this.omega = new Float64Array(m);
    this.cosKP = new Float64Array(m * p);
    this.sinKP = new Float64Array(m * p);
    const sh = opts.shoal;
    this.gain = sh ? new Float64Array(m * p) : null;
    picked.forEach((q, k) => {
      if (sh && this.gain) {
        for (let j = 0; j < p; j += 1) this.gain[k * p + j] = incidentModeGain(q.w, q.kx, q.kz, q.d0, sh.depthM[j], sh.normalX, sh.normalZ);
      }
      this.h0[k * 4] = q.h0r; this.h0[k * 4 + 1] = q.h0i; this.h0[k * 4 + 2] = q.hcr; this.h0[k * 4 + 3] = q.hci;
      this.omega[k] = q.w;
      for (let j = 0; j < p; j += 1) {
        const ph = q.kx * opts.px[j] + q.kz * opts.pz[j];
        this.cosKP[k * p + j] = Math.cos(ph);
        this.sinKP[k * p + j] = Math.sin(ph);
      }
    });
  }

  /** The sea's height at every point at time t, m, into `out`. */
  heights(t: number, out: Float64Array): void {
    const p = this.points;
    out.fill(0, 0, p);
    const { h0, omega, cosKP, sinKP } = this;
    for (let k = 0; k < this.modes; k += 1) {
      const c = Math.cos(omega[k] * t);
      const s = Math.sin(omega[k] * t);
      const b = k * 4;
      // hhat = h0 e^{i w t} + conj(h0(-k)) e^{-i w t}, as realizeCascade.
      const hr = h0[b] * c - h0[b + 1] * s + (h0[b + 2] * c + h0[b + 3] * s);
      const hi = h0[b] * s + h0[b + 1] * c + (h0[b + 3] * c - h0[b + 2] * s);
      const o = k * p;
      const gn = this.gain;
      if (gn) {
        for (let j = 0; j < p; j += 1) out[j] += gn[o + j] * (hr * cosKP[o + j] - hi * sinKP[o + j]);
      } else {
        for (let j = 0; j < p; j += 1) out[j] += hr * cosKP[o + j] - hi * sinKP[o + j];
      }
    }
  }
}

/**
 * ROUND 20: THE SEA-OWNED REEF MODULE'S LAWS, ON THE CPU. `oceanBathymetry.ts`
 * holds the sea's shoaling gain, breaking share and broken-crest height, with
 * CPU twins; but it imports `three/webgpu` for its GPU half, and this file
 * (and the worker that runs it) must not. These are the same functions and
 * constants, copied; a unit test (`oceanBeachMath.test.ts`) holds them equal
 * to the module's at a sweep of periods, depths and crests, so the two cannot
 * drift. (A pure `oceanBathymetryMath.ts` for both is in the round-20 report.)
 */
export const BATHY_BREAK_START = 0.45;
export const BATHY_BREAK_FULL = 0.75;
export const BATHY_CREST_TO_HEIGHT = 1.8;
export const BATHY_BORE_GAMMA = 0.55;
/** `oceanShoalGain`: Ks from deep water to depth d for period T (linear theory, Fenton and McKee 1990). */
export function bathyShoalGain(periodS: number, depthM: number): number {
  const w = (2 * Math.PI) / Math.max(periodS, 0.1);
  const k0 = (w * w) / 9.81;
  const kh0 = k0 * Math.max(depthM, 0.05);
  const kh = kh0 / Math.tanh(kh0 ** 0.75) ** (2 / 3);
  const k = kh / Math.max(depthM, 0.05);
  const c = w / k;
  const n = 0.5 * (1 + (2 * kh) / Math.sinh(2 * kh));
  return Math.sqrt((0.5 * (9.81 / w)) / Math.max(n * c, 1e-3));
}
/** `oceanBreakShareCpu`: the breaking share of a crest over a depth. */
export function bathyBreakShare(etaM: number, depthM: number): number {
  const x = (BATHY_CREST_TO_HEIGHT * Math.max(etaM, 0)) / Math.max(depthM, 0.05);
  const t = Math.min(Math.max((x - BATHY_BREAK_START) / (BATHY_BREAK_FULL - BATHY_BREAK_START), 0), 1);
  return t * t * (3 - 2 * t);
}
/** `oceanBoreCrestM`: the crest a broken wave keeps over a depth. */
export function bathyBoreCrestM(depthM: number): number {
  return (BATHY_BORE_GAMMA * Math.max(depthM, 0.05)) / BATHY_CREST_TO_HEIGHT;
}

/**
 * Linear theory's wave number at angular frequency `omega` on depth `d`,
 * 1/m: the explicit fit of Fenton and McKee (1990), as `oceanShoalGain`
 * (`oceanBathymetry.ts`) solves it, so the two agree.
 */
export function waveNumberAt(omega: number, depthM: number): number {
  const d = Math.max(depthM, 0.05);
  const kh0 = ((omega * omega) / G) * d;
  return kh0 / Math.tanh(kh0 ** 0.75) ** (2 / 3) / d;
}

/**
 * ROUND 20: ONE MODE'S HEIGHT GAIN from the FFT sea's depth `d0` to the
 * local still-water depth `d` (linear theory, Dean and Dalrymple 1991,
 * sections 4.8 and 4.9):
 *   SHOALING  Ks = sqrt(cg(d0) / cg(d)): the energy flux holds as the wave
 *             slows. The sea-owned reef module's `oceanShoalGain` (here `bathyShoalGain`) gives Ks
 *             from deep water to a depth; the ratio of its values at d and
 *             d0 is Ks from d0 to d.
 *   REFRACTION Kr = sqrt(cos a0 / cos a): Snell's law, sin a / c constant on
 *             a shore of straight, parallel depth contours, turns the crest
 *             toward the shore as it slows, and the rays spread. a is the
 *             angle between the mode's heading and the onshore normal; a
 *             mode heading offshore (cos a0 < 0) is taken by its mirror.
 * The phase is the sea's own (Snell's law keeps the along-shore wave number,
 * so the crests' pattern along the grid's edge is the sea's), so the waves
 * that run up are the waves in the picture, grown or thinned by the floor.
 */
export function incidentModeGain(omega: number, kx: number, kz: number, d0: number, d: number, nx: number, nz: number): number {
  if (!(omega > 0)) return 1;
  const tS = (2 * Math.PI) / omega;
  const ks = bathyShoalGain(tS, d) / bathyShoalGain(tS, d0);
  const km = Math.hypot(kx, kz);
  if (!(km > 0)) return ks;
  const cos0 = Math.min(Math.abs((kx * nx + kz * nz) / km), 1);
  const sin0 = Math.sqrt(Math.max(1 - cos0 * cos0, 0));
  const c0 = omega / waveNumberAt(omega, d0);
  const c1 = omega / waveNumberAt(omega, d);
  const sin1 = Math.min(sin0 * (c1 / c0), 1);
  const cos1 = Math.sqrt(Math.max(1 - sin1 * sin1, 1e-12));
  return ks * Math.sqrt(cos0 / cos1);
}

/**
 * ROUND 20: THE DEPTH-LIMITED CREST at the grid's sea edge. A shoaled crest
 * high for the depth breaks: the sea-owned reef module's breaking share
 * (`oceanBreakShareCpu`, here `bathyBreakShare`; H / d from 0.45 to 0.75, Thornton and Guza 1983,
 * McCowan 1894) takes it toward the crest a broken wave keeps there
 * (`oceanBoreCrestM`, here `bathyBoreCrestM`; H = 0.55 d). Troughs are not held.
 */
export function heldIncidentCrest(etaM: number, depthM: number): number {
  if (!(etaM > 0)) return etaM;
  const b = bathyBreakShare(etaM, depthM);
  if (b <= 0) return etaM;
  const held = Math.min(etaM, bathyBoreCrestM(depthM));
  return etaM + (held - etaM) * b;
}

/**
 * The incident level at the grid's sea edge, sampled every `everyS` seconds
 * and linearly interpolated between samples: the swash steps at 120 Hz and
 * the sea's shortest forcing wave (the chop's 2 s) needs a few dozen samples
 * a period, not 240. The samples are on a fixed time grid anchored at t = 0,
 * so the forcing is a pure function of time.
 */
export function sampledIncident(src: { heights(t: number, out: Float64Array): void; points: number }, everyS: number): IncidentFn {
  const a = new Float64Array(src.points);
  const b = new Float64Array(src.points);
  let ka = -1;
  return (t: number, out: Float64Array) => {
    const k = Math.floor(t / everyS + 1e-9);
    if (k !== ka) {
      src.heights(k * everyS, a);
      src.heights((k + 1) * everyS, b);
      ka = k;
    }
    const f = (t - k * everyS) / everyS;
    for (let j = 0; j < src.points; j += 1) out[j] = a[j] + (b[j] - a[j]) * f;
  };
}

/* ------------------------------------------------------------------ */
/* Run-up, the measurement                                              */
/* ------------------------------------------------------------------ */

/**
 * Stockdon et al. (2006), the 2% exceedance run-up on a natural beach, m of
 * height over the still water level: 1.1 (setup + swash / 2) with setup
 * 0.35 beta sqrt(H0 L0) and swash sqrt(H0 L0 (0.563 beta^2 + 0.004)). H0 is
 * the deep-water significant height, L0 = g T^2 / 2 pi, beta the foreshore
 * slope. Fitted on 10 field experiments; its scatter is about 0.3 of the
 * value. The measurable half compares the swash against it.
 */
export function stockdonRunup2(h0M: number, tpS: number, beta: number): { r2: number; setup: number; swash: number } {
  const l0 = (G * tpS * tpS) / (2 * Math.PI);
  const setup = 0.35 * beta * Math.sqrt(h0M * l0);
  const swash = Math.sqrt(h0M * l0 * (0.563 * beta * beta + 0.004));
  return { r2: 1.1 * (setup + swash / 2), setup, swash };
}

/**
 * The swash front of each alongshore row: the highest s that holds a sheet
 * over `minH`, m. -Infinity when the row has none above the sea edge.
 */
export function swashFront(f: SwashField, s0: number, minH = 0.002): Float64Array {
  const out = new Float64Array(f.na);
  for (let j = 0; j < f.na; j += 1) {
    let best = -Infinity;
    for (let i = f.ns - 1; i >= 0; i -= 1) {
      if (f.h[j * f.ns + i] > minH) {
        best = s0 + (i + 0.5) * f.ds;
        break;
      }
    }
    out[j] = best;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The fixed-step clock                                                 */
/* ------------------------------------------------------------------ */

/**
 * THE PLAN THAT MAKES A PINNED CAPTURE REPRODUCE. The beach's state at time t
 * is the state after floor(t / dt) fixed steps from the fixed start. Forward
 * in time it steps on; back in time it restarts from the latest checkpoint
 * at or before t (one every `checkpointS` of beach time, `keep` of them), or
 * from the start. The result is the same however the steps were grouped.
 */
export class BeachClock {
  private readonly checkpoints = new Map<number, SwashState>();
  constructor(
    readonly field: SwashField,
    private readonly debris: { data: Float64Array; restore(d: Float64Array): void; step(f: SwashField, dt: number): void; reset(): void },
    readonly checkpointS = 5,
    readonly keep = 40,
  ) {}

  /** The step a time falls on. */
  stepFor(t: number): number {
    return Math.max(Math.floor(t / this.field.dt + 1e-6), 0);
  }

  /**
   * Bring the beach to time t. `budget` caps the steps taken now (a live
   * frame passes a small one; a pinned capture passes Infinity). Returns the
   * steps taken and whether the target was reached.
   */
  advanceTo(t: number, budget = Infinity): { steps: number; reached: boolean } {
    const target = this.stepFor(t);
    const f = this.field;
    if (target < f.step) {
      let best: SwashState | null = null;
      for (const s of this.checkpoints.values()) if (s.step <= target && (!best || s.step > best.step)) best = s;
      if (best) {
        f.restore(best);
        this.debris.restore(best.debris);
      } else {
        f.reset();
        this.debris.reset();
      }
    }
    const every = Math.max(Math.round(this.checkpointS / f.dt), 1);
    let steps = 0;
    while (f.step < target && steps < budget) {
      f.advance();
      this.debris.step(f, f.dt);
      steps += 1;
      if (f.step % every === 0 && !this.checkpoints.has(f.step)) {
        this.checkpoints.set(f.step, f.snapshot(this.debris.data));
        if (this.checkpoints.size > this.keep) {
          // Drop the oldest but the first, so a jump far back stays cheap.
          const keys = [...this.checkpoints.keys()].sort((a, b) => a - b);
          this.checkpoints.delete(keys[1] ?? keys[0]);
        }
      }
    }
    return { steps, reached: f.step >= target };
  }
}

/* ------------------------------------------------------------------ */
/* Debris: shells, sticks and seaweed                                   */
/* ------------------------------------------------------------------ */

/** Density of sea water, kg/m^3. */
export const SEA_WATER_KG_M3 = 1025;

export type DebrisKind = 'shell' | 'stick' | 'weed';

/**
 * One kind of object on the beach. Every number is a measured property of
 * the real thing; the motion follows from them.
 *
 *   densityKgM3  what it is made of: shell (aragonite and calcite) 2600 to
 *                2750; beach driftwood 480 to 760 as it takes up water; wrack
 *                (fucoid and sargassum strands) 1010 to 1060, near neutral.
 *   sizeM, heightM  the length, and how far it stands off the sand: a clam
 *                or cockle half-shell 3.5 to 8.5 cm long stands 1.2 to 2.8 cm;
 *                a stick 22 to 70 cm long its diameter, 1.6 to 4.5 cm; a clump
 *                of wrack 30 to 75 cm, 3 to 6 mm (round 2: round 1's smaller
 *                sizes drew as dots and pencils from 5 m).
 *   cd           drag coefficient across the flow: a half shell lies convex
 *                side up, a dome to the flow, 0.45 (a hemisphere's convex
 *                face, Hoerner 1965; at 1.0, a bluff body's, shells ran as far
 *                per swash as weed did); a cylinder across the flow 1.2
 *                (Reynolds number 10^3 to 10^4); a flexible blade 0.3 (it
 *                streams out and folds).
 *   muStatic, muSlide  Coulomb friction on wet sand: a shell 0.7 and 0.5 (it
 *                sits bedded in the grains; loose grains' own angle of repose
 *                is 30 to 35 degrees, tan 0.6 to 0.7, Soulsby 1997); a stick sliding along
 *                its axis 0.5 and 0.45, ROLLING across it 0.12; weed 0.35 and
 *                0.3 (it is slick).
 */
export interface DebrisKindSpec {
  readonly densityKgM3: [number, number];
  readonly sizeM: [number, number];
  readonly heightM: [number, number];
  readonly cd: number;
  readonly muStatic: number;
  readonly muSlide: number;
  /** Friction across a stick's axis when it rolls (sticks only). */
  readonly muRoll?: number;
}

export const DEBRIS_KINDS: Readonly<Record<DebrisKind, DebrisKindSpec>> = {
  shell: { densityKgM3: [2600, 2750], sizeM: [0.035, 0.085], heightM: [0.012, 0.028], cd: 0.45, muStatic: 0.7, muSlide: 0.5 },
  stick: { densityKgM3: [480, 760], sizeM: [0.22, 0.7], heightM: [0.016, 0.045], cd: 1.2, muStatic: 0.5, muSlide: 0.45, muRoll: 0.12 },
  weed: { densityKgM3: [1010, 1060], sizeM: [0.30, 0.75], heightM: [0.003, 0.006], cd: 0.3, muStatic: 0.35, muSlide: 0.3 },
};

/** Floats of state per object in `BeachDebris.data`: see the layout there. */
export const DEBRIS_STRIDE = 24;
/** Nodes of a weed strand's body behind its head. */
export const WEED_NODES = 6;

/** Which kind each object is, and its fixed properties. */
export interface DebrisItem {
  readonly kind: DebrisKind;
  readonly massKg: number;
  readonly volumeM3: number;
  readonly lengthM: number;
  readonly heightM: number;
  /** A weed blade's width, m (0 for the others). */
  readonly widthM: number;
  /** Frontal area when square to the flow and fully under water, m^2. */
  readonly areaM2: number;
  /** A per-object seed in [0, 1) for its look (shape, tint, spin). */
  readonly look: number;
}

/**
 * THE DEBRIS. Each object is a rigid body on the bed with two degrees of
 * freedom in the bed's plane and a heading. Per step:
 *
 *   gravity along the slope  -(m - rho V_sub) g grad(z_b)
 *   drag in the sheet        0.5 rho Cd A_sub |u - v| (u - v)
 *   friction                 Coulomb on the normal load (m - rho V_sub) g;
 *                            static until the push passes mu_s N
 *
 * so a shell (2.7 times as dense as the water, with a small frontal area)
 * moves only under a fast sheet; a stick lighter than the water floats off
 * the sand once the sheet is deeper than its diameter and rides with the
 * water; and a strand of weed, nearly neutral, is carried by the slowest
 * sheet. A stick ROLLS across its axis at a quarter of the friction it
 * slides with along it, so a pushed stick turns broadside and rolls: that is
 * why sticks end in lines along the shore. Drag is solved implicitly against
 * the new velocity, so a thin fast sheet does not ring.
 *
 * Data layout, DEBRIS_STRIDE floats per object:
 *   0 s, 1 a, 2 vs, 3 va, 4 heading (radians, the long axis from +s toward
 *   +a), 5 wet (0 to 1, how submerged it is now), 6 moved (m, total path),
 *   7 afloat (0 or 1), 8 to 19 the weed's nodes 1 to 6 as (s, a) pairs.
 */
export class BeachDebris {
  readonly items: DebrisItem[] = [];
  data: Float64Array;
  private readonly initial: Float64Array;
  private readonly s0: number;
  private readonly a0: number;

  constructor(opts: {
    grid: SwashGridSpec;
    seed: number;
    counts: Readonly<Record<DebrisKind, number>>;
    /** Where they start: s and a ranges (m), and the share placed on the wrack line near `wrackS`. */
    sRange: [number, number];
    aRange: [number, number];
    wrackS: number;
    wrackShare: number;
  }) {
    this.s0 = opts.grid.s0;
    this.a0 = opts.grid.a0;
    let rng = (opts.seed ^ 0xb7e4c11) >>> 0;
    const rand = (): number => {
      // Mulberry32: a deterministic 32-bit generator.
      rng = (rng + 0x6d2b79f5) >>> 0;
      let t = rng;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const kinds: DebrisKind[] = [];
    (Object.keys(opts.counts) as DebrisKind[]).forEach((k) => {
      for (let i = 0; i < opts.counts[k]; i += 1) kinds.push(k);
    });
    this.data = new Float64Array(kinds.length * DEBRIS_STRIDE);
    const lerp = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
    // THE WRACK LIES IN CLUMPS (round 4). Cast weed tangles, and the swash
    // leaves its drift where its tongues stop and at the cusps' horns, so the
    // wrack line is heaps a meter or so long with bare sand between. A judge
    // read round 3's evenly spread weed as "identical decals". An item on the
    // wrack line joins one of WRACK_CLUMPS heaps, within WRACK_CLUMP_M of its
    // center along the shore.
    const clumpA = Array.from({ length: WRACK_CLUMPS }, () => lerp(opts.aRange, rand()));
    kinds.forEach((kind, i) => {
      const spec = DEBRIS_KINDS[kind];
      const len = lerp(spec.sizeM, rand());
      const hgt = lerp(spec.heightM, rand());
      const rho = lerp(spec.densityKgM3, rand());
      let vol: number;
      let area: number;
      let width = 0;
      if (kind === 'shell') {
        // A half-shell: a shallow dome of the given size and height, 0.6 of
        // it shell wall.
        vol = 0.18 * len * len * hgt * 0.6;
        area = 0.75 * len * hgt;
      } else if (kind === 'stick') {
        vol = Math.PI * (hgt / 2) ** 2 * len;
        area = len * hgt;
      } else {
        width = 0.03 + 0.03 * rand();
        vol = len * width * hgt;
        area = len * width * 0.35;
      }
      this.items.push({ kind, massKg: rho * vol, volumeM3: vol, lengthM: len, heightM: hgt, widthM: width, areaM2: area, look: rand() });
      const o = i * DEBRIS_STRIDE;
      const onWrack = rand() < opts.wrackShare;
      const s = onWrack ? opts.wrackS + (rand() - 0.5) * 1.2 : lerp(opts.sRange, rand());
      const a = onWrack
        ? Math.min(Math.max(clumpA[Math.floor(rand() * WRACK_CLUMPS)] + (rand() - 0.5) * WRACK_CLUMP_M, opts.aRange[0]), opts.aRange[1])
        : lerp(opts.aRange, rand());
      // Sticks and weed on the wrack line lie along it, as the last swash left them.
      const heading = onWrack && kind !== 'shell' ? Math.PI / 2 + (rand() - 0.5) * 0.8 : rand() * Math.PI * 2;
      this.data[o] = s;
      this.data[o + 1] = a;
      this.data[o + 4] = heading;
      if (kind === 'weed') {
        // The strand lies bent along its heading, node spacing len / nodes.
        const seg = len / WEED_NODES;
        let ps = s;
        let pa = a;
        let hd = heading;
        for (let k = 0; k < WEED_NODES; k += 1) {
          hd += (rand() - 0.5) * 0.9;
          ps -= Math.cos(hd) * seg;
          pa -= Math.sin(hd) * seg;
          this.data[o + 8 + k * 2] = ps;
          this.data[o + 9 + k * 2] = pa;
        }
      }
    });
    this.initial = this.data.slice();
  }

  reset(): void {
    this.data.set(this.initial);
  }

  restore(d: Float64Array): void {
    this.data.set(d);
  }

  /** One step of every object against the sheet `f`. */
  step(f: SwashField, dt: number): void {
    const { ns, na, ds, da } = f;
    const d = this.data;
    const sMin = this.s0 + ds;
    const sMax = this.s0 + (ns - 1) * ds;
    const aMin = this.a0 + da;
    const aMax = this.a0 + (na - 1) * da;
    for (let i = 0; i < this.items.length; i += 1) {
      const it = this.items[i];
      const spec = DEBRIS_KINDS[it.kind];
      const o = i * DEBRIS_STRIDE;
      const s = d[o];
      const a = d[o + 1];
      let vs = d[o + 2];
      let va = d[o + 3];
      // The cell coordinates of the object's center.
      const x = (s - this.s0) / ds - 0.5;
      const y = (a - this.a0) / da - 0.5;
      const h = bilinear(f.h, ns, na, x, y);
      const sub = Math.min(Math.max(h / it.heightM, 0), 1);
      d[o + 5] = sub;
      if (sub <= 0 && vs === 0 && va === 0) {
        // Dry and at rest: nothing acts on it but gravity, which the static
        // friction holds on these slopes (1:11 is far under 0.45).
        d[o + 7] = 0;
        continue;
      }
      const hu = bilinear(f.hu, ns, na, x, y);
      const hv = bilinear(f.hv, ns, na, x, y);
      const uMean = h > 1e-4 ? hu / h : 0;
      const vMean = h > 1e-4 ? hv / h : 0;
      // The bed slope under it (central differences over a cell).
      const gs = (bilinear(f.bed, ns, na, x + 1, y) - bilinear(f.bed, ns, na, x - 1, y)) / (2 * ds);
      const ga = (bilinear(f.bed, ns, na, x, y + 1) - bilinear(f.bed, ns, na, x, y - 1)) / (2 * da);
      const buoy = SEA_WATER_KG_M3 * it.volumeM3 * sub;
      const load = (it.massKg - buoy) * G;
      const afloat = load <= 0;
      d[o + 7] = afloat ? 1 : 0;
      // Added mass: the water it must push aside to move (half its displaced volume).
      const mEff = it.massKg + 0.5 * SEA_WATER_KG_M3 * it.volumeM3 * sub;
      const hd = d[o + 4];
      const ax = Math.cos(hd);
      const ay = Math.sin(hd);
      // THE FLOW AT ITS OWN HEIGHT. On the bed a body feels the sheet's speed
      // at its mid-height, not the depth mean: the log law over a sand bed
      // (roughness z0 = 2.5 d50 / 30 for 0.2 mm grains) gives u(z) / U =
      // ln(z / z0) / (ln(h / z0) - 1). A floating body, and one the sheet
      // does not cover, feels the whole sheet.
      const z0 = 1.7e-5;
      const zc = Math.max(it.heightM / 2, 2 * z0);
      const logK = afloat || h <= it.heightM ? 1 : Math.min(Math.log(zc / z0) / Math.max(Math.log(h / z0) - 1, 1), 1);
      const uw = uMean * logK;
      const vw = vMean * logK;
      const rs = uw - vs;
      const ra = vw - va;
      const rel = Math.hypot(rs, ra);
      // A stick's frontal area is its length times its diameter across the
      // flow, and its end on along it.
      let area = it.areaM2;
      if (it.kind === 'stick' && rel > 1e-6) {
        const across = Math.abs((rs * ay - ra * ax) / rel);
        area = it.lengthM * it.heightM * across + it.heightM * it.heightM * (1 - across);
      }
      const kDrag = 0.5 * SEA_WATER_KG_M3 * spec.cd * area * sub * rel;
      const N = load > 0 ? load : 0;
      // The push other than drag: gravity along the slope on the net load.
      const gS = -N * gs;
      const gA = -N * ga;
      const speed = Math.hypot(vs, va);
      if (afloat) {
        // Riding the water: drag alone, solved implicitly.
        vs = (mEff * vs + dt * kDrag * uw) / (mEff + dt * kDrag);
        va = (mEff * va + dt * kDrag * vw) / (mEff + dt * kDrag);
      } else {
        // Friction: the stick rolls across its axis and slides along it.
        const pushS = gS + kDrag * rs;
        const pushA = gA + kDrag * ra;
        const push = Math.hypot(pushS, pushA);
        const dirS = speed > 1e-4 ? vs / speed : (push > 0 ? pushS / push : 0);
        const dirA = speed > 1e-4 ? va / speed : (push > 0 ? pushA / push : 0);
        let muS = spec.muSlide;
        let muSt = spec.muStatic;
        if (spec.muRoll !== undefined) {
          const across = Math.abs(dirS * ay - dirA * ax);
          muS += (spec.muRoll - spec.muSlide) * across;
          muSt += (spec.muRoll - spec.muStatic) * across;
        }
        if (speed < 1e-4 && push <= muSt * N) {
          vs = 0;
          va = 0;
        } else {
          let ns2 = (mEff * vs + dt * (gS + kDrag * uw - muS * N * dirS)) / (mEff + dt * kDrag);
          let na2 = (mEff * va + dt * (gA + kDrag * vw - muS * N * dirA)) / (mEff + dt * kDrag);
          // Friction stops a body; it never reverses one.
          if (speed > 1e-4 && ns2 * dirS + na2 * dirA < 0) {
            ns2 = 0;
            na2 = 0;
          }
          vs = ns2;
          va = na2;
        }
      }
      let sN = s + vs * dt;
      let aN = a + va * dt;
      // The grid's edges hold them in.
      if (sN < sMin) { sN = sMin; vs = 0; }
      if (sN > sMax) { sN = sMax; vs = 0; }
      if (aN < aMin) { aN = aMin; va = 0; }
      if (aN > aMax) { aN = aMax; va = 0; }
      const moved = Math.hypot(sN - s, aN - a);
      d[o] = sN;
      d[o + 1] = aN;
      d[o + 2] = vs;
      d[o + 3] = va;
      d[o + 6] += moved;
      // THE HEADING. A rolling stick turns broadside to its motion; a shell
      // spins a little as it slides; a strand trails its body back along
      // its path (the nodes below).
      if (moved > 0) {
        if (it.kind === 'stick') {
          const mv = Math.hypot(vs, va);
          if (mv > 1e-4) {
            const across = (vs * ay - va * ax) / mv;
            const along = (vs * ax + va * ay) / mv;
            // A turn of about a radian per half a length rolled, toward broadside.
            // across = sin(delta), along = cos(delta) for the angle delta from the
            // motion to the axis; d(delta) = +k sin cos grows delta toward 90 degrees.
            d[o + 4] = hd + along * across * Math.min((2 * moved) / it.lengthM, 0.5);
          }
        } else if (it.kind === 'shell') {
          d[o + 4] = hd + (it.look - 0.5) * 6 * moved;
        }
      }
      if (it.kind === 'weed') {
        // Follow the leader: each node keeps its spacing from the one before.
        const seg = it.lengthM / WEED_NODES;
        let px = sN;
        let py = aN;
        for (let k = 0; k < WEED_NODES; k += 1) {
          const q = o + 8 + k * 2;
          const dx = d[q] - px;
          const dy = d[q + 1] - py;
          const l = Math.hypot(dx, dy);
          if (l > seg) {
            d[q] = px + (dx / l) * seg;
            d[q + 1] = py + (dy / l) * seg;
          }
          px = d[q];
          py = d[q + 1];
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* The site: where the grid sits on the cay                             */
/* ------------------------------------------------------------------ */

/**
 * THE GRID. 31 m across the shore at 0.125 m and 48 m along it at 0.5 m:
 * 248 x 96 cells.
 *
 *   s from -7 m (0.6 m of water on the 1:11 face; the sea edge) to +24 m,
 *   past the berm's crest (10.45 m, 0.95 m up) and 13.5 m onto the
 *   backshore (1.27 m up). The largest swashes run 9 m up the face (R2
 *   0.74 m high, measured), so round 1's top at 9.5 m was met by a few of
 *   them as a wall; now the berm stops them, as on a beach. The backshore's
 *   dry sand is in the grid so the look (its grain, its dry skin) runs on
 *   past the wet band as far as a view along the beach sees: round 3's
 *   judged crop reaches 22 m, so that dry sand is half of it, as in the
 *   reference. The dry cells cost little: the step's loops end at each row's
 *   last wet cell, and only the soil's slow update (every third step) visits
 *   them.
 *   The cross-shore cell is the one that matters: a swash tip is a few
 *   centimeters of water thinning over a meter or two, and 12.5 cm puts eight
 *   to sixteen cells on it. Along the shore the sheet varies over the cusps
 *   (12 m) and the chop's crest length (9 m at its 53 degree approach), so
 *   0.5 m holds both.
 *
 * THE STEP, 1/100 s: on the judged sea the bores at the sea edge (0.5 m
 * waves into 0.6 m of water) set the Courant number, 0.52 at most over 150 s;
 * the scheme keeps every depth positive near 0.5, and the ledger's `clipped`
 * term, the water the positivity guard would have made, stayed exactly 0.
 * At 1/80 s it reached 0.62, still with nothing clipped, but with no margin.
 */
export const BEACH_GRID: SwashGridSpec = { s0: -7, ds: 0.125, ns: 248, a0: -24, da: 0.5, na: 96 };
/**
 * ROUND 8: THE BEACH'S LACE MIX, the weights of the wake image's four
 * channels (raft, clumps, streaks, patches) in the beach's coverage noise.
 * With the wake's own mix (WAKE_LACE_WEIGHTS, 0.24 on the clumps) round 7
 * drew the swash's foam as "opaque, clipped pure-white blobs". The beach
 * reads no clumps. The worker builds the coverage table for this mix.
 */
export const BEACH_LACE_WEIGHTS: readonly [number, number, number, number] = [0.62, 0, 0.26, 0.12];

export const BEACH_DT = 1 / 100;

/** Everything the swash needs about where it runs. */
export interface BeachSite {
  readonly frame: BeachFrame;
  readonly grid: SwashGridSpec;
  /** Bed height at each cell center, m (up), row-major j * ns + i. */
  readonly bed: Float64Array;
  /** Meters landward of the still-water shoreline, each cell. */
  readonly shoreDist: Float64Array;
  /** The sea edge's world points, one per row. */
  readonly edgeX: Float64Array;
  readonly edgeZ: Float64Array;
}

/**
 * The beach on the cay's long side that faces the swell: the frame's origin
 * is the shoreline point at the ellipse's -B end (its parametric angle
 * -pi/2), s runs onshore along the minor axis and a along the major one. A
 * camera that looks along +a has the sea on its left and the sand on its
 * right, as the Water Pro shore shot does.
 */
export function beachFrameOf(isl: SeabedIsland): BeachFrame {
  // River mouth round 1: the frame alone, so the mouth's grid (`oceanMouthMath.ts`)
  // lies in the same (s, a) frame as the swash. Unchanged from the site's own.
  const aX = Math.cos(isl.headingRad);
  const aZ = Math.sin(isl.headingRad);
  const sX = -aZ;
  const sZ = aX;
  return {
    originX: isl.centerX - isl.semiMinorM * sX,
    originZ: isl.centerZ - isl.semiMinorM * sZ,
    sX, sZ, aX, aZ,
  };
}

/** The swash's site: the frame, the grid, and the bed, shoreline distance and sea edge of every cell. */
export function buildBeachSite(
  params: SeabedParams = LAGOON_CAY_SEABED,
  grid: SwashGridSpec = BEACH_GRID,
): BeachSite {
  const isl = params.island;
  if (!isl) throw new Error('[ocean] The beach needs a seabed with an island (LAGOON_CAY_SEABED).');
  const frame = beachFrameOf(isl);
  const n = grid.ns * grid.na;
  const bed = new Float64Array(n);
  const shoreDist = new Float64Array(n);
  for (let j = 0; j < grid.na; j += 1) {
    for (let i = 0; i < grid.ns; i += 1) {
      const s = grid.s0 + (i + 0.5) * grid.ds;
      const a = grid.a0 + (j + 0.5) * grid.da;
      const [x, z] = beachToWorld(frame, s, a);
      const c = j * grid.ns + i;
      bed[c] = -seabedPointAt(params, x, z).depthM;
      shoreDist[c] = islandFrameAt(isl, x, z).s;
    }
  }
  const edgeX = new Float64Array(grid.na);
  const edgeZ = new Float64Array(grid.na);
  for (let j = 0; j < grid.na; j += 1) {
    const [x, z] = beachToWorld(frame, grid.s0, grid.a0 + (j + 0.5) * grid.da);
    edgeX[j] = x;
    edgeZ[j] = z;
  }
  return { frame, grid, bed, shoreDist, edgeX, edgeZ };
}

/** Round 20: the still-water depth at each row's sea edge, m, as the swash's own boundary reads it. */
export function edgeDepths(site: BeachSite): Float64Array {
  const g = site.grid;
  const d = new Float64Array(g.na);
  for (let j = 0; j < g.na; j += 1) d[j] = Math.max(-site.bed[j * g.ns], 0.05);
  return d;
}

/**
 * The cascades that force the swash: every one whose patch is 50 m or more.
 * The ripple band (a 13 m patch, waves under 2 m) carries 3% of the
 * `shallow` sea's variance and breaks in the first cell.
 */
export function forcingCascades(cascades: readonly CascadeParams[]): string[] {
  return cascades.filter((c) => c.patchM >= 50).map((c) => c.name);
}

/**
 * THE WHOLE BEACH on the CPU: the site, the sea at its edge, the swash, the
 * debris and the clock. The worker (`oceanBeachWorker.ts`) and the tests
 * build it the same way.
 */
export interface BeachSim {
  readonly site: BeachSite;
  readonly waves: IncidentWaves;
  readonly field: SwashField;
  readonly debris: BeachDebris;
  readonly clock: BeachClock;
}

/**
 * The debris the beach starts with, by kind, over the 48 m by 9 m it is laid
 * on: a shell every three square meters, a stick every eighteen, a strand of
 * weed every twelve, a light strand line after a calm week.
 */
export const BEACH_DEBRIS_COUNTS: Readonly<Record<DebrisKind, number>> = { shell: 150, stick: 24, weed: 36 };
/** The wrack line's heaps (see the wrack in `BeachDebris`): how many, and how long each is along the shore, m. */
export const WRACK_CLUMPS = 14;
export const WRACK_CLUMP_M = 1.4;

/**
 * ROUND 16: THE SWASH OF THE MATCH LOOK. Round 15's motion strips (six frames
 * 1 s apart, `beach/measure-motion.md`) found that Manly's run-ups cover the
 * whole sheet band within 2 s and its edge moves 0.5 to 4.4 m/s both ways,
 * while ours reached only the band's lower half and left a millimeter film on
 * the upper face that drained for tens of seconds (0.04 to 0.1 m/s, always
 * downhill). A still of that reads as standing water. The match (and only the
 * match; the default beach is unchanged) runs the swash with:
 *   waveGain  the sea's height at the grid's edge times this: a larger swash
 *             (Stockdon et al. 2006: R2% grows as sqrt(H L), so the run-up
 *             reach grows with the height);
 *   ksMS      the sand's saturated conductivity: a medium to coarse beach sand
 *             (Freeze and Cherry 1979 give 1e-5 to 1e-3 m/s for clean sand;
 *             the registry's 1e-4 is a fine sand), so a thin film soaks away
 *             in seconds;
 *   manningN  the bed friction (Chow 1959: 0.016 to 0.020 for clean sand);
 *   foamGain, foamThinLifeS  the bore's foam and its life in a thin sheet
 *             (BEACH_SWASH's 5 and 7 s): Manly's run-up carries its lace over
 *             the whole band and leaves it as a broken line at the top; ours
 *             faded out halfway up.
 * Each value is fitted to the motion measure, `beach/measure-swash.md`.
 */
export interface BeachMatchSwash {
  readonly waveGain: number;
  readonly ksMS: number;
  readonly manningN: number;
  readonly foamGain: number;
  readonly foamThinLifeS: number;
  /**
   * ROUND 20 (Remy, 2026-10-09: the water's physics, derived from the sea and
   * the ground, not fitted). Each is optional; round 16's set has none.
   *   shoal       the sea at the grid's edge shoaled and refracted from the
   *               FFT's depth to the edge's depth, mode by mode, and its
   *               crests held to the depth (`incidentModeGain`,
   *               `heldIncidentCrest`); `waveGain` is then 1.
   *   subcellHR   the thin film feels the whole slope (`SwashParams.subcellHR`).
   *   laminarNuM2S  the laminar film's bed stress (`SwashParams.laminarNuM2S`).
   *   boreFoam    foam from the bore's energy loss (`SwashField.boreFoamSource`).
   *   foamLifeS   the foam's fade in the surf (BEACH_SWASH's 4 s); with
   *               `foamThinLifeS` the one foam field's FOAM_TAU_S.
   *   grainD50M   the grain size `ksMS` and `manningN` came from (a record).
   */
  readonly shoal?: boolean;
  readonly subcellHR?: boolean;
  readonly laminarNuM2S?: number;
  readonly boreFoam?: boolean;
  readonly foamLifeS?: number;
  readonly grainD50M?: number;
}

/** Round 16's fitted match swash, kept so a study can run it beside round 20's. */
export const BEACH_MATCH_SWASH_R16: BeachMatchSwash = { waveGain: 1.2, ksMS: 1e-3, manningN: 0.018, foamGain: 6, foamThinLifeS: 14 };

/**
 * Sea water's kinematic viscosity at 20 C and 35 g/kg, m^2/s: 1.08e-3 Pa s
 * over 1025 kg/m^3 (Sharqawy, Lienhard and Zubair 2010).
 */
export const SEA_WATER_NU_M2S = 1.05e-6;

/**
 * ROUND 20: THE SAND'S CONDUCTIVITY FROM ITS GRAIN, Kozeny-Carman (Carman
 * 1937, in the form Bear 1972 gives):
 *   K = (g / nu) d^2 / 180 n^3 / (1 - n)^2
 * with d the grain size (d50 for a well-sorted beach sand) and n the
 * porosity. For the cay's 0.35 mm sand at the beach's own porosity 0.396
 * (the registry's density over quartz) it is 1.08e-3 m/s, inside Freeze and
 * Cherry's (1979) 1e-5 to 1e-3 for clean sand.
 */
export function kozenyCarmanKs(d50M: number, porosity: number, nuM2S = SEA_WATER_NU_M2S): number {
  const n = Math.min(Math.max(porosity, 0.05), 0.95);
  return ((G / nuM2S) * d50M * d50M / 180) * (n * n * n) / ((1 - n) * (1 - n));
}

/**
 * ROUND 20: THE BED'S ROUGHNESS FROM ITS GRAIN, Strickler (1923):
 * n = 0.0417 d50^(1/6), d50 in m (published coefficients run 0.034 to 0.047
 * by the grain size taken; this is the brief's). A plane swash bed is grain
 * roughness alone: the uprush and backwash plane off the ripples. For the
 * cay's 0.35 mm sand, n = 0.0111 s/m^(1/3) (round 16's table value 0.018).
 */
export function stricklerManningN(d50M: number): number {
  return 0.0417 * Math.max(d50M, 1e-6) ** (1 / 6);
}

/**
 * THE MEDIUM QUARTZ SAND the beach takes when its terrain names no grain:
 * d50 0.35 mm, the middle of Wentworth's medium sand (0.25 to 0.5 mm) and of
 * Bascom's (1951) 0.3 to 0.5 mm for the cay's 1:11 face.
 */
export const MEDIUM_SAND_D50_M = 0.35e-3;

/**
 * ROUND 20: THE MATCH'S SWASH, DERIVED. Every value comes from the sea or the
 * ground with a law (see BeachMatchSwash): the grain gives the sand's
 * conductivity (Kozeny-Carman) and the bed's roughness (Strickler); the sea
 * at the edge is shoaled and refracted over the cay's own depth and held to
 * it where it breaks; the foam comes from the bore's energy loss and fades
 * as the sea's foam does; the thin film feels the whole slope and its laminar
 * stress. `foamGain` is not read (boreFoam).
 */
export function deriveMatchSwash(grainD50M: number = LAGOON_CAY.grainD50M ?? MEDIUM_SAND_D50_M): BeachMatchSwash {
  return {
    waveGain: 1,
    ksMS: kozenyCarmanKs(grainD50M, BEACH_SAND.thetaS),
    manningN: stricklerManningN(grainD50M),
    foamGain: 0,
    foamThinLifeS: FOAM_TAU_S,
    foamLifeS: FOAM_TAU_S,
    shoal: true,
    subcellHR: true,
    laminarNuM2S: SEA_WATER_NU_M2S,
    boreFoam: true,
    grainD50M,
  };
}
export const BEACH_MATCH_SWASH: BeachMatchSwash = deriveMatchSwash();

export function createBeachSim(opts: {
  cascades: readonly CascadeParams[];
  n: number;
  seed: number;
  params?: SeabedParams;
  grid?: SwashGridSpec;
  dt?: number;
  /** River mouth round 1: the cells the mouth's grid owns (`SwashField`'s `wall`). Absent: none. */
  wall?: Uint8Array;
  /** Share of each forcing cascade's variance to sum, and the most modes per cascade. */
  share?: number;
  maxModes?: number;
  /** Seconds between two forcing samples (linear between them). */
  forcingEveryS?: number;
  /**
   * ROUND 16 (the beach's match look, `&beachmatch=1`): the swash matched to
   * the Manly frames' motion (see BEACH_MATCH_SWASH). Absent, the beach runs
   * as before, bit for bit.
   */
  match?: BeachMatchSwash;
}): BeachSim {
  const site = buildBeachSite(opts.params, opts.grid);
  const waves = new IncidentWaves({
    cascades: opts.cascades,
    n: opts.n,
    seed: opts.seed,
    use: forcingCascades(opts.cascades),
    share: opts.share ?? 0.95,
    maxModes: opts.maxModes ?? 700,
    px: site.edgeX,
    pz: site.edgeZ,
    // Round 20: the match's sea shoals and refracts to each row's edge depth.
    ...(opts.match?.shoal ? { shoal: { depthM: edgeDepths(site), normalX: site.frame.sX, normalZ: site.frame.sZ } } : {}),
  });
  const inc0 = sampledIncident(waves, opts.forcingEveryS ?? 0.05);
  const m = opts.match;
  // Round 16: the match's forcing is the same sea's height at the edge times
  // `waveGain` (the ledger books what crosses the edge, so it stays exact).
  // Round 20: with `shoal`, the shoaled sea, its crests held to the depth.
  const dEdge = m?.shoal ? edgeDepths(site) : null;
  const incident: IncidentFn = !m ? inc0 : dEdge
    ? (t, out) => { inc0(t, out); for (let j = 0; j < out.length; j += 1) out[j] = heldIncidentCrest(out[j], dEdge[j]) * m.waveGain; }
    : (t, out) => { inc0(t, out); for (let j = 0; j < out.length; j += 1) out[j] *= m.waveGain; };
  const field = new SwashField({
    grid: site.grid,
    bed: site.bed,
    shoreDist: site.shoreDist,
    dt: opts.dt ?? BEACH_DT,
    incident,
    ...(opts.wall ? { wall: opts.wall } : {}),
    ...(m ? {
      soil: { ...BEACH_SAND, ksMS: m.ksMS },
      params: {
        ...BEACH_SWASH,
        manningN: m.manningN,
        foamGain: m.foamGain,
        foamThinLifeS: m.foamThinLifeS,
        ...(m.foamLifeS !== undefined ? { foamLifeS: m.foamLifeS } : {}),
        ...(m.subcellHR ? { subcellHR: true } : {}),
        ...(m.laminarNuM2S !== undefined ? { laminarNuM2S: m.laminarNuM2S } : {}),
        ...(m.boreFoam ? { boreFoam: true } : {}),
      },
    } : {}),
  });
  const g = site.grid;
  const debris = new BeachDebris({
    grid: g,
    seed: opts.seed,
    counts: BEACH_DEBRIS_COUNTS,
    sRange: [-0.5, 8.5],
    aRange: [g.a0 + 2, g.a0 + g.na * g.da - 2],
    // ROUND 6: the wrack line at the upper swash limit (the berm's face, where
    // the largest swashes of the last tides left their drift), and more of
    // the drift on it: at 7.2 m it lay inside the swash of view 1, along its
    // foam front ("ink scratches that clutter the edge").
    wrackS: 10.0,
    wrackShare: 0.55,
  });
  const clock = new BeachClock(field, debris);
  return { site, waves, field, debris, clock };
}

/* ------------------------------------------------------------------ */
/* The state the GPU reads                                              */
/* ------------------------------------------------------------------ */

/**
 * Float to IEEE half float, the bits as a 16-bit integer: round to nearest,
 * subnormals kept, overflow to infinity. The swash's state goes to the GPU as
 * half-float textures, which every WebGPU adapter can filter (a float32
 * texture needs the optional `float32-filterable` feature).
 */
const HALF_F32 = new Float32Array(1);
const HALF_U32 = new Uint32Array(HALF_F32.buffer);
export function toHalf(v: number): number {
  HALF_F32[0] = v;
  const x = HALF_U32[0];
  const sign = (x >>> 16) & 0x8000;
  const e = ((x >>> 23) & 0xff) - 127 + 15;
  let m = x & 0x7fffff;
  if (e >= 31) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    m = (m | 0x800000) >> (1 - e);
    return sign | ((m + 0x1000) >> 13);
  }
  const r = sign | (e << 10) | (m >> 13);
  // Round to nearest: the dropped bits over half carry into the kept ones.
  return (m & 0x1000) !== 0 ? r + 1 : r;
}

/** What the GPU reads of the swash, as two RGBA half-float textures of ns x na texels. */
export interface BeachPack {
  /** h (m), u (along s, m/s), v (along a, m/s), foam (0 to 1). */
  readonly a: Uint16Array;
  /** skin saturation (1 in the saturated band), stranded foam, swash mark, seconds since the sheet left / 60. */
  readonly b: Uint16Array;
  /** suspended sand (kg/m^3), and three spare channels. */
  readonly d: Uint16Array;
  /**
   * RIVER MOUTH ROUND 1c (only when asked, `seaSlope`): the slope of the
   * grid's water seaward of the still-water line, as the sea's surface sums
   * its bands' slopes: (-d eta/ds, -d eta/da), eta = bed + h (h as `a` reads
   * it), two half floats a cell. Only cells that are wet and whose bed stands
   * under the mean sea level have a slope, from central differences between
   * such neighbors (one-sided at the edge of the class), else 0: that is the
   * water the sea's one surface draws over the grid (oceanMouth.ts); the
   * sheet draws the rest.
   */
  readonly e?: Uint16Array;
}

export function packBeachState(f: SwashField, out?: BeachPack, seaSlope = false): BeachPack {
  const { ns, na } = f;
  const n = ns * na;
  const a = out?.a ?? new Uint16Array(n * 4);
  const b = out?.b ?? new Uint16Array(n * 4);
  const d = out?.d ?? new Uint16Array(n * 4);
  // THE LOOK'S READ, SMOOTHED ALONG THE SHORE (round 5). Each value the look
  // reads is the binomial mean of its row and its four nearest rows, weights
  // 1, 4, 6, 4, 1 over 16 (sd one row, 0.5 m). A tongue of the swash one
  // 0.5 m row wide drew its tip as a sharp tent in the front's path (a
  // judge: "a sharp tent-shaped peak"); a real tongue is rounded by the sheet
  // spreading sideways, which the 0.5 m rows under-resolve. Three rows (1, 2,
  // 1) still drew the tent. The physics keeps its own unsmoothed state.
  const at = (arr: ArrayLike<number>, i: number, j: number): number => arr[Math.min(Math.max(j, 0), na - 1) * ns + i];
  const blur = (arr: ArrayLike<number>, i: number, j: number): number => (at(arr, i, j - 2) + 4 * at(arr, i, j - 1) + 6 * at(arr, i, j)
    + 4 * at(arr, i, j + 1) + at(arr, i, j + 2)) / 16;
  const se = new Float64Array(n);
  for (let c = 0; c < n; c += 1) se[c] = f.skinSaturation(c);
  for (let j = 0; j < na; j += 1) {
    for (let i = 0; i < ns; i += 1) {
      const c = j * ns + i;
      const hc = blur(f.h, i, j);
      const wet = hc > 1e-5;
      const o = c * 4;
      a[o] = toHalf(hc);
      a[o + 1] = toHalf(wet ? blur(f.hu, i, j) / hc : 0);
      a[o + 2] = toHalf(wet ? blur(f.hv, i, j) / hc : 0);
      a[o + 3] = toHalf(blur(f.foam, i, j));
      b[o] = toHalf(blur(se, i, j));
      b[o + 1] = toHalf(blur(f.strand, i, j));
      b[o + 2] = toHalf(blur(f.mark, i, j));
      b[o + 3] = toHalf(Math.min(f.wetAge[c] / 60, 1));
      d[o] = toHalf(blur(f.sed, i, j));
      // Round 7: the foam's age, s (the look's foam life).
      d[o + 1] = toHalf(blur(f.foamAge, i, j));
    }
  }
  if (!seaSlope) return { a, b, d };
  const e = out?.e ?? new Uint16Array(n * 2);
  // The sea side's water level (NaN off the class: dry, or the bed over the mean sea level).
  const lv = new Float64Array(n);
  for (let j = 0; j < na; j += 1) {
    for (let i = 0; i < ns; i += 1) {
      const c = j * ns + i;
      const hc = blur(f.h, i, j);
      lv[c] = hc > 1e-3 && f.bed[c] < 0 ? f.bed[c] + hc : Number.NaN;
    }
  }
  const diff = (c: number, cm: number | null, cp: number | null, h: number): number => {
    const m = cm === null ? Number.NaN : lv[cm];
    const p = cp === null ? Number.NaN : lv[cp];
    if (!Number.isNaN(m) && !Number.isNaN(p)) return (p - m) / (2 * h);
    if (!Number.isNaN(p)) return (p - lv[c]) / h;
    if (!Number.isNaN(m)) return (lv[c] - m) / h;
    return 0;
  };
  for (let j = 0; j < na; j += 1) {
    for (let i = 0; i < ns; i += 1) {
      const c = j * ns + i;
      const ok = !Number.isNaN(lv[c]);
      e[c * 2] = toHalf(ok ? -diff(c, i > 0 ? c - 1 : null, i < ns - 1 ? c + 1 : null, f.ds) : 0);
      e[c * 2 + 1] = toHalf(ok ? -diff(c, j > 0 ? c - ns : null, j < na - 1 ? c + ns : null, f.da) : 0);
    }
  }
  return { a, b, d, e };
}

/** Floats per object in `debrisPoses`: see its layout. */
export const POSE_STRIDE = 8 + 3 * WEED_NODES;

/**
 * Where to draw each object, in world meters. Per object, POSE_STRIDE floats:
 *   0 x, 1 y (the underside: the sand, or the water line less the draft when
 *   afloat), 2 z, 3 yaw (radians, the long axis' world heading from +X toward
 *   +Z), 4 wet (0 to 1), 5 afloat, 6 and 7 the bed's slope along world X and
 *   Z (so a body lies on the tilted sand), then the weed's nodes 1 to 6 as
 *   (x, y, z).
 */
export function debrisPoses(sim: BeachSim, out?: Float32Array): Float32Array {
  const { field: f, debris, site } = sim;
  const g = site.grid;
  const fr = site.frame;
  const n = debris.items.length;
  const o = out ?? new Float32Array(n * POSE_STRIDE);
  const bedAt = (s: number, a: number): number => bilinear(f.bed, g.ns, g.na, (s - g.s0) / g.ds - 0.5, (a - g.a0) / g.da - 0.5);
  const hAt = (s: number, a: number): number => bilinear(f.h, g.ns, g.na, (s - g.s0) / g.ds - 0.5, (a - g.a0) / g.da - 0.5);
  for (let i = 0; i < n; i += 1) {
    const it = debris.items[i];
    const d = i * DEBRIS_STRIDE;
    const p = i * POSE_STRIDE;
    const s = debris.data[d];
    const a = debris.data[d + 1];
    const [x, z] = beachToWorld(fr, s, a);
    const afloat = debris.data[d + 7] > 0.5;
    // A floating body rides with its density's share under the water line.
    const draft = it.heightM * Math.min((it.massKg / (SEA_WATER_KG_M3 * it.volumeM3)), 1);
    const b = bedAt(s, a);
    const y = afloat ? Math.max(b, b + hAt(s, a) - draft) : b;
    const hd = debris.data[d + 4];
    const dx = Math.cos(hd) * fr.sX + Math.sin(hd) * fr.aX;
    const dz = Math.cos(hd) * fr.sZ + Math.sin(hd) * fr.aZ;
    // The bed's slope in world X and Z, from its slope along s and a.
    const e = 0.25;
    const gs = (bedAt(s + e, a) - bedAt(s - e, a)) / (2 * e);
    const ga = (bedAt(s, a + e) - bedAt(s, a - e)) / (2 * e);
    o[p] = x;
    o[p + 1] = y;
    o[p + 2] = z;
    o[p + 3] = Math.atan2(dz, dx);
    o[p + 4] = debris.data[d + 5];
    o[p + 5] = afloat ? 1 : 0;
    o[p + 6] = gs * fr.sX + ga * fr.aX;
    o[p + 7] = gs * fr.sZ + ga * fr.aZ;
    if (it.kind === 'weed') {
      for (let k = 0; k < WEED_NODES; k += 1) {
        const ns2 = debris.data[d + 8 + k * 2];
        const na2 = debris.data[d + 9 + k * 2];
        const [wx, wz] = beachToWorld(fr, ns2, na2);
        const q = p + 8 + k * 3;
        o[q] = wx;
        o[q + 1] = bedAt(ns2, na2);
        o[q + 2] = wz;
      }
    }
  }
  return o;
}

/* ------------------------------------------------------------------ */
/* The swash foam's texture (round 2)                                   */
/* ------------------------------------------------------------------ */

/**
 * THE SWASH FOAM TILE. Round 1 drew the foam as gradient noise under a
 * threshold carried with the flow: a judge read the bore's foam as "a solid,
 * bright white smear with vertical streaks, like a brush stroke", and the
 * thin foam the backwash film carries (0.17 to 0.23 of cover at the judged
 * instant) drew as nothing, so the film read as dry sand. Swash foam seen
 * from a few meters is bubbles: a raft of them at a bore's front, and as it
 * drains, a lace of bubble lines round clear holes, in patches with glassy
 * film between them. So the tile is the foam piece's own lace machinery at
 * swash scale (`foamCellEdgePeriodic`, `foamValueNoisePeriodic` and
 * `foamLaceAlpha` in oceanFoamMath.ts):
 *
 *   R  the coarse net: a warped Worley network of 25 cm cells, 0 on a wall;
 *   G  the bubbles: a Worley network of 3.1 cm cells, 0 on a bubble's rim,
 *      1 at its heart (the foam's shading, the lines' beading, the film's
 *      caustic web);
 *   B  the fine net: the warped Worley network of 10 cm cells, 0 on a wall
 *      (round 6: the film's net lace reads it; rounds 2 to 5 stored the
 *      patches here, which the look never read);
 *   A  the threshold texture: 0.3 coarse net + 0.12 fine net (10 cm cells)
 *      + 0.06 rim noise (value noise of 6 cm cells) + 0.52 patches, RANKED
 *      over the tile so it is exactly uniform on 0 to 1. Under
 *      `foamLaceAlpha` the drawn area is then the foam amount the swash
 *      carries: a little foam is the big cells' walls in the thick patches,
 *      with clean film between the patches; more fills in the small cells;
 *      a raft closes all but the holes' hearts.
 *
 * ROUND 3. Round 2 put the bubbles in A (0.15 of it): a hole at the heart of
 * each 3.1 cm bubble cell inside the foam, which a judge read as "stippled
 * dots inside" the lace. The bubbles are out of A now. The rim noise
 * scallops a line's edge as its bubbles do, and adds no dots of its own (it
 * is small against the nets' slopes). The patches lead (0.52 against 0.35),
 * so the lace comes in soft patches of net, not an even crackle.
 *
 * WHAT WAS TRIED (laceProto.ts in the beach scratch). One net of 10 cm cells
 * under the threshold drew a regular crackle over the whole film ("reptile
 * skin", the foam piece's own finding); with the patches at 0.2 the lace
 * still covered everything evenly; two scales with the patches leading
 * (this) draw the hierarchy of a real lace, irregular holes, and bare film.
 * Round 3 (laceProto3.ts): with the coarse net leading (0.45 to 0.5) the lace
 * drew a regular honeycomb; with the patches leading (0.52) and the look's
 * second, turned read (`oceanBeach.ts`, LACE_TURN_RAD) it draws irregular
 * soft patches of net with no repeat.
 *
 * It tiles every SWASH_TILE_M (4 m) in world space; the patches' 0.5 m and
 * the foam amount's own shape (a bore's front, a film's patches) break the
 * repeat at the scale the eye reads.
 */
export const SWASH_TILE_M = 4;
export const SWASH_TILE_N = 512;
export const SWASH_NET_CELLS = 40;
export const SWASH_NET_COARSE_CELLS = 16;
export const SWASH_BUBBLE_CELLS = 128;

/** RGBA8 texels of the swash foam tile, row-major (t, s); A is the ranked threshold. */
export function buildSwashFoamTile(seed: number, n = SWASH_TILE_N): Uint8Array {
  const out = new Uint8Array(n * n * 4);
  const raw = new Float64Array(n * n);
  const salt = (seed ^ 0x51a5) | 0;
  const warp = (s: number, t: number, cells: number, amp: number, sa: number): [number, number] => {
    const wn = Math.max(1, Math.round(cells / 4));
    return [
      amp * foamValueNoisePeriodic(s * wn, t * wn, wn, sa),
      amp * foamValueNoisePeriodic(s * wn + 0.37 * wn, t * wn + 0.71 * wn, wn, sa + 1),
    ];
  };
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const s = (i + 0.5) / n;
      const t = (j + 0.5) / n;
      const [ax, az] = warp(s, t, SWASH_NET_CELLS, 1.2, salt ^ 0x3a1);
      const fine = foamCellEdgePeriodic(s * SWASH_NET_CELLS + ax, t * SWASH_NET_CELLS + az, SWASH_NET_CELLS, salt ^ 0x7c3);
      const [bx, bz] = warp(s, t, SWASH_NET_COARSE_CELLS, 1.0, salt ^ 0x6a1);
      const coarse = foamCellEdgePeriodic(s * SWASH_NET_COARSE_CELLS + bx, t * SWASH_NET_COARSE_CELLS + bz, SWASH_NET_COARSE_CELLS, salt ^ 0x8c3);
      const bub = foamCellEdgePeriodic(s * SWASH_BUBBLE_CELLS, t * SWASH_BUBBLE_CELLS, SWASH_BUBBLE_CELLS, salt ^ 0x1d4);
      const p0 = 0.5 + 0.5 * (0.6 * foamValueNoisePeriodic(s * 8, t * 8, 8, salt ^ 0x2e5)
        + 0.4 * foamValueNoisePeriodic(s * 16, t * 16, 16, salt ^ 0x4f6));
      const patch = Math.min(Math.max((p0 - 0.5) * 1.6 + 0.5, 0), 1);
      const k = j * n + i;
      // The rim noise: 64 value-noise cells over the tile (6 cm).
      const rim = 0.5 + 0.5 * foamValueNoisePeriodic(s * 64, t * 64, 64, salt ^ 0x5b7);
      raw[k] = 0.3 * coarse + 0.12 * fine + 0.06 * rim + 0.52 * patch;
      out[k * 4] = Math.round(Math.min(Math.max(coarse, 0), 1) * 255);
      out[k * 4 + 1] = Math.round(Math.min(Math.max(bub, 0), 1) * 255);
      out[k * 4 + 2] = Math.round(Math.min(Math.max(fine, 0), 1) * 255);
    }
  }
  // Rank: the threshold texture's value is its texel's rank, so it is uniform.
  const order = Array.from({ length: n * n }, (_, k) => k).sort((x, y) => raw[x] - raw[y]);
  for (let r = 0; r < order.length; r += 1) {
    out[order[r] * 4 + 3] = Math.min(255, Math.floor(((r + 0.5) / order.length) * 256));
  }
  return out;
}

/**
 * The drawn foam at a point, the look's formula on the CPU: the coverage of
 * foam amount `amount` against the tile's threshold value `tex` (0 to 1),
 * with a soft edge `w`, through the foam piece's `foamLaceAlpha`. Over a
 * uniform tex its mean is the amount (the test holds that).
 */
export function swashFoamCover(amount: number, tex: number, w: number): number {
  return foamLaceAlpha(Math.min(Math.max(amount, 0), 1), tex, w);
}
