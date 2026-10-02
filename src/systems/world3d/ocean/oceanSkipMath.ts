/**
 * @file oceanSkipMath.ts — a stone thrown at calm water: does it skip, how
 * many times, and why does it stop?
 *
 * Remy asked on 2026-09-28: "i also want a modal where i can throw rocks into
 * the water, and see if it will or wont skip based on angle of the throw and
 * the type of rock". This file is the physics. It is pure CPU code with no
 * random numbers, so the same throw on the same sea gives the same run, and a
 * capture at a pinned sea time reproduces. `oceanSkip.ts` draws a run, and
 * `oceanExtras/skip.ts` mounts it in the ocean viewer.
 *
 * THE PUBLISHED EXPERIMENTS THIS MODEL IS BUILT ON
 *
 *   [C04] Clanet, Hersen and Bocquet, "Secrets of successful stone-skipping",
 *         Nature 427, 29 (2004): a spinning aluminum disc thrown at water by
 *         a machine. An angle of about 20 degrees between the stone and the
 *         water (the "magic angle") gives the lowest speed that still
 *         bounces and the widest range of paths that bounce.
 *   [R05] Rosellini, Hersen, Clanet and Bocquet, "Skipping stones", J. Fluid
 *         Mech. 543, 137-146 (2005). The same machine, one skip to many. It
 *         gives the force law this file uses (their eq. 4.2):
 *
 *             F = 1/2 rho_w U^2 S_wet sin(alpha + beta) n
 *
 *         with alpha the stone's tilt to the water (the attack angle), beta
 *         the angle of the path below the horizontal (the impact angle), U the
 *         speed, S_wet the stone's area under the water line and n the
 *         stone's normal. They measured the coefficient (1/2, "C_L = 0.5")
 *         in a water channel (their Appendix). Their measurements used here
 *         as tests: a disc of R = 2.5 cm, h = 2.75 mm at 3.5 m/s and 65
 *         turns per second bounces at alpha = beta = 20 degrees in a contact
 *         of about 32 ms (their fig. 3); at alpha 30, beta 35 it surfs and
 *         never leaves the water (fig. 4); with no spin at alpha 35, beta 20
 *         it tumbles and dives (fig. 5); at 10 turns per second the tilt
 *         dips to about 0 and recovers, and it still bounces (fig. 7, "the
 *         trout regime"); the lowest speed that bounces is 2.6 m/s, at
 *         alpha near 20 degrees (fig. 6b); no path steeper than 45 degrees
 *         bounces (fig. 6c); the stone keeps its horizontal speed but loses
 *         vertical speed at each touch, so the path flattens until the stone
 *         can no longer leave the water (their section 4.4).
 *   [JR75] Johnson and Reid, "Ricochet of spheres off water", J. Mech. Eng.
 *         Sci. 17, 71-81 (1975): a sphere ricochets only below about
 *         18 / sqrt(specific gravity) degrees. The round pebble is checked
 *         against it.
 *   [S64] Savitsky, "Hydrodynamic design of planing hulls", Marine
 *         Technology 1(1), 71-95 (1964): on a plate planing fast, the center
 *         of pressure lies at 0.75 of the wetted length forward of the
 *         trailing edge. [R05] gives the size of the force, not where it
 *         acts; this sets where (see THE CENTER OF PRESSURE).
 *   [W32] Wagner, "Uber Stoss- und Gleitvorgange an der Oberflache von
 *         Flussigkeiten", ZAMM 12, 193-215 (1932): a plate entering water
 *         wets pi/2 times the length its geometry cuts, because the water
 *         rises to meet it (the spray root).
 *   [B03] Bocquet, "The physics of stone skipping", Am. J. Phys. 71, 150
 *         (2003): the same force law with a constant tilt; the lift is lost
 *         when the stone is wholly under; the spin's gyroscopic hold; the
 *         thin-stone estimate of the lowest speed, U_c = sqrt(16 M g /
 *         (C rho_w a^2)), which goes as sqrt(g h rho_s / rho_w).
 *
 * WHAT THIS FILE MODELS
 *
 * - The stone is a RIGID BODY: position, velocity, orientation (a
 *   quaternion) and angular momentum in the world frame, the angular
 *   velocity from the body inertia each step (Euler's equations). The step
 *   is 20 us in the water at 12 m/s (the contact time goes as 1 / U, [R05]
 *   fig. 8b, so the step does too, up to 0.1 ms), 0.5 ms in the air, and
 *   never turns the stone's wobble by more than 0.01 rad (THE TURN PER
 *   STEP). Its surface is a closed triangle mesh in its own frame, and
 *   every force acts on the triangles.
 * - IN THE WATER each triangle under the water line takes two forces: the
 *   dynamic pressure of [R05], per triangle -1/2 rho_w U (v . n_f) A_wet n_f
 *   on a face moving into the water (for a flat face this IS eq. 4.2, U
 *   (v . n_f) = U^2 sin(alpha + beta)), U the stone's speed (THE SPEED IN
 *   THE LAW); and the still-water pressure rho_w g d A_wet at the wet part's
 *   mean depth, which sums to the buoyancy. A face moving out of the water
 *   takes no dynamic pressure: the cavity behind a fast stone is open to
 *   the air ([R05] fig. 3). The skip or the sink FALLS OUT of these forces.
 *   No rule anywhere says "above 45 degrees, sink".
 * - WHERE THE LOAD ACTS decides the torque, and the torque decides whether
 *   the spin can hold the tilt. A flat face's load (its size and direction
 *   exactly [R05]'s) acts at the planing center of pressure [S64] of the
 *   face's part under the raised line of the spray root [W32]. With the
 *   load spread evenly over the geometric wet part instead, a disc at [R05]'s
 *   10 turns a second did not bounce (their fig. 7 bounces); with the
 *   spray root it does, the tilt holds at 65 turns a second (fig. 3), and
 *   the widest window of paths moved from 30 to 42 degrees at a tilt of 20
 *   (fig. 6c: no path over 45 bounces, the widest window at 20).
 * - IN THE AIR the dry triangles take the same law with the air's density:
 *   a flat disc gets a normal-force slope of about 1 per radian, a little
 *   lift and drag, which [R05] found small at 3.5 m/s and which grows at a
 *   person's 10 to 12 m/s.
 * - THE SPIN keeps the tilt. The torque of the water on the trailing edge
 *   changes the angular momentum, and a spinning stone answers by
 *   precession (its lean turns a little sideways) instead of by pitching
 *   over. With no spin the same torque pitches the stone nose down and it
 *   tumbles. Nothing here forbids a tumble; it comes from Euler's equations.
 *
 * WHAT THE TESTS CHECK AGAINST THE PAPERS (oceanSkipMath.test.ts): [R05]
 * figs. 3, 5, 6a, 6b, 6c and 7 at their own disc and speed; the magic angle
 * of [C04] as the tilt of the lowest bouncing speed (2.26 m/s at 15 to 20
 * degrees, their 2.6 measured); Johnson and Reid's limit for the pebble;
 * each preset's cause; determinism.
 *
 * THE TILT AT A PERSON'S SPEED (GG-340, round 2). Round 1's stone drifted
 * 10 to 40 degrees a touch at 12 m/s and ended after 2 to 4 skips. Two
 * causes were found, and neither fix is a rule that holds the tilt:
 *   - THE FREE TOP: the orientation step made energy in flight (spin went
 *     into wobble with no torque on the stone). It is now the exact
 *     torque-free motion of a symmetric top.
 *   - THE AIR'S CENTER OF PRESSURE: the air's load on a flat face acted at
 *     the face's middle, so a flying disc had no pitching moment. It now
 *     acts at thin-plate theory's quarter chord, as the water's does.
 * The best throw (12 m/s, 35 turns a second, a 12 degree path, a tilt of
 * 10) now skips 8 times over 19.7 m on flat water, where the same throw
 * with its tilt held (leverScale 0) skips 10.
 *
 * WHAT IS STILL OPEN. At a tilt of 15 to 25 the water's torque at each
 * touch still turns the lean 5 to 15 degrees, and the same throw skips 4
 * where its held tilt gives 9 (GG-340 stays open for that part). [B03]'s
 * estimate of the drift (g / (R Omega^2) a touch) is smaller than this
 * model's, and no published measurement of the attitude over many touches
 * at 12 m/s settles which is nearer. See
 * docs/architecture/domains/world3d-skip-stones.md.
 *
 * WHAT IT DOES NOT MODEL (and why the effect is small here)
 *
 * - The water's own motion: the orbital speed of a 3.5 cm lake wave is
 *   under 0.1 m/s against a stone at 3 to 12 m/s.
 * - The added mass of the water moved: [R05] leaves it out too, and their
 *   model matched their measurements. (The spray root moves only where the
 *   load acts, not how large it is.)
 * - Friction on the faces: at Re near 1e5 the pressure force is the whole
 *   story ([R05] section 4.1). The spin does not slow in the water.
 * - Surface tension on the stone: it is far above the size where it
 *   matters (Weber number U^2 R rho / sigma near 1e4). The rings it leaves
 *   do carry surface tension (`skipRingTable`).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/09/2026, 09:55:03
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/skip.ts, systems/world3d/ocean/oceanSkip.ts, systems/world3d/ocean/oceanSkipWorker.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CascadeParams } from './oceanConfig';
import { GRAVITY_MS2 } from './oceanConfig';
import { buildCascadeSpectrum } from './oceanSpectrum';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Fresh water (a lake), kg/m^3. */
export const SKIP_WATER_DENSITY = 1000;
/** Air near the water at 20 C, kg/m^3. */
export const SKIP_AIR_DENSITY = 1.2;
/** The force coefficient of [R05] eq. 4.2 (their measured C_L = 0.5). */
export const SKIP_LIFT_COEFF = 0.5;
/** Step in the water or within a few centimeters of it, seconds. The contact
 *  of a stone at 12 m/s lasts about 5 ms; this gives it 250 steps. */
export const SKIP_DT_WATER_S = 2e-5;
/** Step in free flight, seconds. */
export const SKIP_DT_AIR_S = 5e-4;
/** Step while a light stone floats slowly at the water, seconds. */
export const SKIP_DT_FLOAT_S = 5e-4;
/** Step while the stone is under the water and slow (sinking or floating). */
export const SKIP_DT_SLOW_S = 1e-4;
/**
 * THE SPRAY ROOT [W32]. As a plate enters water the surface rises to meet it,
 * and the wetted length at a penetration h is pi/2 times the geometric
 * h / tan(angle) (Wagner, 1932, for a flat section at a small angle). The
 * load reaches that far: the water line under the stone is raised by
 * (pi/2 - 1) h for where the load acts. See THE CENTER OF PRESSURE.
 */
export const SKIP_WAGNER_RISE = Math.PI / 2 - 1;
/** The most a step may turn the stone, radians (see THE TURN PER STEP). */
export const SKIP_MAX_TURN_RAD = 0.01;
/** Seconds between two recorded states of the run (for the drawing). */
export const SKIP_SAMPLE_S = 1e-3;
/** Floats per recorded state: t, x, y, z, qx, qy, qz, qw. */
export const SKIP_SAMPLE_STRIDE = 8;
/** A flight between two contacts shorter than this does not count as a skip
 *  (a stone that planes on a wave can leave the water for a millisecond). */
export const SKIP_MIN_FLIGHT_S = 0.015;
/** The run ends at this many seconds after the release. */
export const SKIP_MAX_RUN_S = 14;
/** A dense stone whose top is this far under the water has sunk. */
export const SKIP_SUNK_DEPTH_M = 0.35;

/* ------------------------------------------------------------------ */
/* The stones                                                          */
/* ------------------------------------------------------------------ */

export type SkipStoneId = 'slate' | 'pebble' | 'chunk' | 'pumice' | 'clay';

export interface SkipStoneType {
  readonly id: SkipStoneId;
  readonly label: string;
  /** 'disc': a flat cylinder. 'ellipsoid': a round or squat lump. */
  readonly shape: 'disc' | 'ellipsoid';
  /** Half the width across the stone's face, meters. */
  readonly radiusM: number;
  /** The full thickness along the stone's axis, meters. */
  readonly thicknessM: number;
  readonly densityKgM3: number;
  /** One line for the panel: what the stone is and why it acts as it does. */
  readonly note: string;
}

/**
 * THE FIVE STONES. Sizes are those of stones a person picks up to skip; the
 * densities are the rocks' own.
 *
 * - SLATE: 6 cm across, 8 mm thick. Slate is 2.7 to 2.8 g/cm^3; 2.7 is also
 *   the aluminum of [C04] and [R05], so this stone has their density ratio.
 *   61 g.
 * - PEBBLE: a round quartz pebble 4 cm across, 2.65 g/cm^3 (quartz). 89 g.
 *   [JR75] says it ricochets only below 18 / sqrt(2.65) = 11 degrees.
 * - CHUNK: a squat block 5 cm across and 3 cm thick, 2.65 g/cm^3. 155 g.
 *   Heavy for its face: it needs more speed to be lifted.
 * - PUMICE: a lump 5 cm across and 3.5 cm thick at 0.65 g/cm^3 (pumice runs
 *   0.25 to 0.9; it floats because its gas bubbles are closed). 30 g. It is
 *   lighter than water, so it floats after it lands.
 * - CLAY: a fired clay disc (a shard of a flowerpot) 6.5 cm across and 5 mm
 *   thick at 1.9 g/cm^3. 32 g: thinner and lighter than the slate.
 */
export const SKIP_STONES: Readonly<Record<SkipStoneId, SkipStoneType>> = {
  slate: {
    id: 'slate', label: 'Flat slate', shape: 'disc', radiusM: 0.03, thicknessM: 0.008, densityKgM3: 2700,
    note: 'The classic skipper: flat, thin, with the density ratio of the published tests.',
  },
  pebble: {
    id: 'pebble', label: 'Round pebble', shape: 'ellipsoid', radiusM: 0.02, thicknessM: 0.04, densityKgM3: 2650,
    note: 'Round: the water meets it on a curved face and pushes back more than up.',
  },
  chunk: {
    id: 'chunk', label: 'Thick chunk', shape: 'disc', radiusM: 0.025, thicknessM: 0.03, densityKgM3: 2650,
    note: 'Heavy for the size of its face, so it needs much more speed to be lifted.',
  },
  pumice: {
    id: 'pumice', label: 'Pumice', shape: 'ellipsoid', radiusM: 0.025, thicknessM: 0.035, densityKgM3: 650,
    note: 'Lighter than water: it floats and bobs after it lands.',
  },
  clay: {
    id: 'clay', label: 'Clay disc', shape: 'disc', radiusM: 0.0325, thicknessM: 0.005, densityKgM3: 1900,
    note: 'A thin, light disc of fired clay: easy to lift, easy to slow.',
  },
};

/** A closed triangle mesh in the stone's own frame (axis along +Y). */
export interface SkipStoneMesh {
  /** xyz per vertex. */
  readonly positions: Float64Array;
  /** Three vertex indices per triangle, wound so the normal points out. */
  readonly triangles: Uint32Array;
  /** Outward unit normal per triangle, xyz. */
  readonly normals: Float64Array;
  /** Area per triangle, m^2. */
  readonly areas: Float64Array;
  readonly volumeM3: number;
  /**
   * The flat face each triangle belongs to: 1 the top, 2 the bottom of a
   * disc; 0 a rim or a curved face. The dynamic load of a flat face is
   * moved to its center of pressure as a whole (THE CENTER OF PRESSURE).
   */
  readonly groups: Uint8Array;
}

/** Segments round a disc's rim. A 24-gon holds 98.9% of the circle's area. */
const DISC_SEGMENTS = 24;
/** Rings and segments of an ellipsoid's mesh. */
const ELLIPSOID_RINGS = 10;
const ELLIPSOID_SEGMENTS = 20;

/** Build the physics mesh of a stone type. */
export function skipStoneMesh(stone: SkipStoneType): SkipStoneMesh {
  const pos: number[] = [];
  const tri: number[] = [];
  const grp: number[] = [];
  if (stone.shape === 'disc') {
    const r = stone.radiusM;
    const hh = stone.thicknessM / 2;
    pos.push(0, hh, 0, 0, -hh, 0);
    for (let i = 0; i < DISC_SEGMENTS; i += 1) {
      const a = (2 * Math.PI * i) / DISC_SEGMENTS;
      pos.push(r * Math.cos(a), hh, r * Math.sin(a));
      pos.push(r * Math.cos(a), -hh, r * Math.sin(a));
    }
    for (let i = 0; i < DISC_SEGMENTS; i += 1) {
      const j = (i + 1) % DISC_SEGMENTS;
      const ti = 2 + 2 * i; const bi = ti + 1;
      const tj = 2 + 2 * j; const bj = tj + 1;
      tri.push(0, tj, ti);
      tri.push(1, bi, bj);
      tri.push(ti, tj, bj, ti, bj, bi);
      grp.push(1, 2, 0, 0);
    }
  } else {
    const a = stone.radiusM;
    const c = stone.thicknessM / 2;
    pos.push(0, c, 0);
    for (let k = 1; k < ELLIPSOID_RINGS; k += 1) {
      const th = (Math.PI * k) / ELLIPSOID_RINGS;
      for (let i = 0; i < ELLIPSOID_SEGMENTS; i += 1) {
        const ph = (2 * Math.PI * i) / ELLIPSOID_SEGMENTS;
        pos.push(a * Math.sin(th) * Math.cos(ph), c * Math.cos(th), a * Math.sin(th) * Math.sin(ph));
      }
    }
    pos.push(0, -c, 0);
    const bottom = pos.length / 3 - 1;
    const ring = (k: number, i: number) => 1 + (k - 1) * ELLIPSOID_SEGMENTS + (i % ELLIPSOID_SEGMENTS);
    for (let i = 0; i < ELLIPSOID_SEGMENTS; i += 1) tri.push(0, ring(1, i + 1), ring(1, i));
    for (let k = 1; k < ELLIPSOID_RINGS - 1; k += 1) {
      for (let i = 0; i < ELLIPSOID_SEGMENTS; i += 1) {
        const a0 = ring(k, i); const a1 = ring(k, i + 1);
        const b0 = ring(k + 1, i); const b1 = ring(k + 1, i + 1);
        tri.push(a0, a1, b1, a0, b1, b0);
      }
    }
    for (let i = 0; i < ELLIPSOID_SEGMENTS; i += 1) {
      tri.push(bottom, ring(ELLIPSOID_RINGS - 1, i), ring(ELLIPSOID_RINGS - 1, i + 1));
    }
  }
  const positions = Float64Array.from(pos);
  const triangles = Uint32Array.from(tri);
  const nt = triangles.length / 3;
  const normals = new Float64Array(nt * 3);
  const areas = new Float64Array(nt);
  let vol = 0;
  for (let t = 0; t < nt; t += 1) {
    const i0 = triangles[3 * t] * 3; const i1 = triangles[3 * t + 1] * 3; const i2 = triangles[3 * t + 2] * 3;
    const ax = positions[i1] - positions[i0]; const ay = positions[i1 + 1] - positions[i0 + 1]; const az = positions[i1 + 2] - positions[i0 + 2];
    const bx = positions[i2] - positions[i0]; const by = positions[i2 + 1] - positions[i0 + 1]; const bz = positions[i2 + 2] - positions[i0 + 2];
    const cx = ay * bz - az * by; const cy = az * bx - ax * bz; const cz = ax * by - ay * bx;
    const len = Math.hypot(cx, cy, cz);
    areas[t] = len / 2;
    normals[3 * t] = cx / len; normals[3 * t + 1] = cy / len; normals[3 * t + 2] = cz / len;
    // Divergence theorem: the signed volume of the tetrahedron to the origin.
    vol += (positions[i0] * cx + positions[i0 + 1] * cy + positions[i0 + 2] * cz) / 6;
  }
  if (!(vol > 0)) throw new Error(`[ocean] The ${stone.id} stone mesh is wound inside out (volume ${vol}).`);
  const groups = new Uint8Array(nt);
  if (grp.length === nt) groups.set(grp);
  return { positions, triangles, normals, areas, volumeM3: vol, groups };
}

/** Mass (from the mesh's own volume, so the buoyancy balances it exactly)
 *  and the principal moments about the axis and across it, kg m^2. */
export function skipStoneInertia(stone: SkipStoneType, mesh: SkipStoneMesh): { massKg: number; iAxis: number; iPerp: number } {
  const m = stone.densityKgM3 * mesh.volumeM3;
  const r = stone.radiusM;
  const h = stone.thicknessM;
  if (stone.shape === 'disc') {
    return { massKg: m, iAxis: 0.5 * m * r * r, iPerp: (m * (3 * r * r + h * h)) / 12 };
  }
  const c = h / 2;
  return { massKg: m, iAxis: 0.4 * m * r * r, iPerp: 0.2 * m * (r * r + c * c) };
}

/* ------------------------------------------------------------------ */
/* The water                                                           */
/* ------------------------------------------------------------------ */

/** The water height and its slope at one point and time. */
export interface SkipWaterSample {
  h: number;
  /** dh/dx and dh/dz. */
  sx: number;
  sz: number;
}

export interface SkipWater {
  /** Where the height comes from, for the readout. */
  readonly label: string;
  sample(xM: number, zM: number, tS: number, out: SkipWaterSample): SkipWaterSample;
}

/** Still water at one level. For the tests and the published setups. */
export function skipFlatWater(levelM = 0): SkipWater {
  return {
    label: `a flat plane at ${levelM} m`,
    sample(_x, _z, _t, out) {
      out.h = levelM; out.sx = 0; out.sz = 0;
      return out;
    },
  };
}

export interface SkipSeaWater extends SkipWater {
  /** Modes kept, of all the modes in all cascades. */
  readonly modes: number;
  readonly modesTotal: number;
  /** Share of the sea's height variance the kept modes carry, 0 to 1. */
  readonly varianceKept: number;
}

/**
 * THE SEA'S OWN HEIGHT, ON THE CPU. The viewer's sea is an FFT on the GPU;
 * its height at world point x and sea time t is
 *
 *   h(x, t) = sum_k Re[ hhat(k, t) e^{i k.x} ],
 *   hhat(k, t) = h0(k) e^{i w t} + conj(h0(-k)) e^{-i w t},
 *
 * over every mode of every cascade (`realizeCascade` in
 * oceanFieldReference.ts is the same sum by FFT). This rebuilds each
 * cascade's spectrum with the viewer's seed (`buildCascadeSpectrum`, the
 * seed stream `seed ^ (ci * 0x9e3779b9)` of `createOceanBuffers`) and sums
 * the modes directly at the one point the stone needs, keeping the modes
 * that carry the most energy until `keepVariance` of the variance is held.
 *
 * WHAT DIFFERS FROM THE DRAWN WATER, measured on the `lake` sea: the kept
 * modes (see `varianceKept`); the drawn mesh reads the grid bilinearly and
 * rolls each cascade off with range (`dispLod`), where this is the sea
 * itself; and the horizontal displacement is left out. That last one moves
 * the height under a point by the slope times the displacement, at most
 * 0.07 x 3 cm, 2 mm, on the lake.
 */
export function createSkipSeaWater(
  cascades: readonly CascadeParams[],
  seed: number,
  n: number,
  opts: { keepVariance?: number; maxModes?: number } = {},
): SkipSeaWater {
  const keep = opts.keepVariance ?? 0.97;
  const maxModes = opts.maxModes ?? 12000;
  type Mode = { e: number; kx: number; kz: number; w: number; ar: number; ai: number; br: number; bi: number };
  const all: Mode[] = [];
  let total = 0;
  let count = 0;
  for (let ci = 0; ci < cascades.length; ci += 1) {
    const spec = buildCascadeSpectrum(cascades[ci], n, (seed ^ (ci * 0x9e3779b9)) >>> 0);
    for (let i = 0; i < n * n; i += 1) {
      const b = i * 4;
      const ar = spec.h0[b]; const ai = spec.h0[b + 1]; const br = spec.h0[b + 2]; const bi = spec.h0[b + 3];
      const e = ar * ar + ai * ai + br * br + bi * bi;
      count += 1;
      if (e === 0) continue;
      total += e;
      all.push({ e, kx: spec.wave[b + 1], kz: spec.wave[b + 2], w: spec.wave[b], ar, ai, br, bi });
    }
  }
  all.sort((p, q) => q.e - p.e);
  let held = 0;
  let m = 0;
  while (m < all.length && m < maxModes && held < keep * total) { held += all[m].e; m += 1; }
  const kx = new Float64Array(m); const kz = new Float64Array(m); const w = new Float64Array(m);
  const ar = new Float64Array(m); const ai = new Float64Array(m); const br = new Float64Array(m); const bi = new Float64Array(m);
  for (let j = 0; j < m; j += 1) {
    const o = all[j];
    kx[j] = o.kx; kz[j] = o.kz; w[j] = o.w; ar[j] = o.ar; ai[j] = o.ai; br[j] = o.br; bi[j] = o.bi;
  }
  // hhat of every mode at the last time asked, kept so points at one time
  // share the time phase.
  const hr = new Float64Array(m); const hi = new Float64Array(m);
  let lastT = NaN;
  return {
    label: `the sea's own height (${m} of ${count} modes, ${(100 * held / total).toFixed(1)}% of the variance)`,
    modes: m,
    modesTotal: count,
    varianceKept: total > 0 ? held / total : 1,
    sample(x, z, t, out) {
      if (t !== lastT) {
        for (let j = 0; j < m; j += 1) {
          const c = Math.cos(w[j] * t); const s = Math.sin(w[j] * t);
          hr[j] = ar[j] * c - ai[j] * s + br[j] * c + bi[j] * s;
          hi[j] = ar[j] * s + ai[j] * c + bi[j] * c - br[j] * s;
        }
        lastT = t;
      }
      let h = 0; let sx = 0; let sz = 0;
      for (let j = 0; j < m; j += 1) {
        const th = kx[j] * x + kz[j] * z;
        const c = Math.cos(th); const s = Math.sin(th);
        const re = hr[j] * c - hi[j] * s;
        const im = hr[j] * s + hi[j] * c;
        h += re;
        sx -= kx[j] * im;
        sz -= kz[j] * im;
      }
      out.h = h; out.sx = sx; out.sz = sz;
      return out;
    },
  };
}

/* ------------------------------------------------------------------ */
/* The throw                                                           */
/* ------------------------------------------------------------------ */

export interface SkipThrow {
  readonly stone: SkipStoneId;
  /** Speed at release, m/s. */
  readonly speedMs: number;
  /**
   * The angle of the path below the horizontal at the FIRST TOUCH (the
   * impact angle beta of [R05]), degrees. The launch angle that gives it is
   * found by shooting (`solveLaunch`). A path flatter than the release
   * height allows is thrown level, and the run says so.
   */
  readonly flightAngleDeg: number;
  /** The stone's tilt to the water, nose up (the attack angle alpha), degrees. */
  readonly tiltDeg: number;
  /**
   * Turns per second about the stone's axis. Positive is counterclockwise
   * seen from above: a right-handed sidearm throw, as a forehand flying disc.
   */
  readonly spinRps: number;
  /** Height of the hand over the mean water level at release, meters. */
  readonly releaseHeightM: number;
  /** Direction of the throw on the water, radians from +X toward +Z. */
  readonly headingRad: number;
  /** Where the hand is, world XZ, meters. */
  readonly originXM: number;
  readonly originZM: number;
  /** Sea time at the release, seconds. */
  readonly t0S: number;
}

/** A stone's state. Y is up (three.js world). */
interface Body {
  p: Float64Array; // 3
  v: Float64Array; // 3
  q: Float64Array; // 4: x, y, z, w
  L: Float64Array; // 3, world
}

/** One touch of the water. Angles in degrees, times in seconds from release. */
export interface SkipTouch {
  readonly index: number;
  readonly tStartS: number;
  readonly tEndS: number;
  /** Where the stone first wet, world meters, and the water height there. */
  readonly xM: number;
  readonly yM: number;
  readonly zM: number;
  readonly speedInMs: number;
  readonly flightInDeg: number;
  readonly tiltInDeg: number;
  readonly bankInDeg: number;
  readonly speedOutMs: number;
  readonly flightOutDeg: number;
  readonly tiltOutDeg: number;
  readonly bankOutDeg: number;
  /** The least tilt during the contact (the "trout" dip of [R05] fig. 7). */
  readonly tiltMinDeg: number;
  /** Deepest the lowest point went under the water line, meters. */
  readonly maxDepthM: number;
  readonly peakWetAreaM2: number;
  /** Water pushed aside: the time integral of (v . n) A over the wet faces, m^3. */
  readonly pushedM3: number;
  /** Direction of travel over the water at the touch, radians from +X toward +Z. */
  readonly headingRad: number;
  /** True when the stone left the water and flew for at least SKIP_MIN_FLIGHT_S. */
  readonly rebound: boolean;
  /** The lowest point's XZ during the contact, every millisecond. */
  readonly path: readonly number[];
}

export type SkipEndCause = 'steep' | 'slow' | 'round' | 'tumbled' | 'planed' | 'floated' | 'rippled' | 'running';

export interface SkipEnd {
  readonly cause: SkipEndCause;
  /** One plain sentence on why the run ended. */
  readonly sentence: string;
  /** Seconds from release when the stone stopped skipping (sank or settled). */
  readonly tS: number;
  readonly xM: number;
  readonly zM: number;
}

export interface SkipRun {
  readonly throw: SkipThrow;
  readonly stone: SkipStoneType;
  readonly massKg: number;
  readonly water: string;
  /** The launch found for the throw's first-touch path. */
  readonly launch: {
    readonly pitchDownDeg: number;
    /** True when the path asked for is flatter than this release height allows. */
    readonly flattest: boolean;
    readonly flightAtTouchDeg: number;
  };
  /** Recorded states, SKIP_SAMPLE_STRIDE floats each: t, x, y, z, qx, qy, qz, qw. */
  readonly samples: Float64Array;
  readonly touches: readonly SkipTouch[];
  readonly skips: number;
  /** Horizontal distance from the hand to where the stone stopped, meters. */
  readonly distanceM: number;
  readonly end: SkipEnd;
  /** Density below water's: the stone floats at the end. */
  readonly floats: boolean;
  /** Physics steps the run took. */
  readonly steps: number;
}

/* ------------------------------------------------------------------ */
/* Small vector helpers (no allocation in the step)                    */
/* ------------------------------------------------------------------ */

const DEG = Math.PI / 180;

function quatRotate(q: Float64Array, x: number, y: number, z: number, out: Float64Array, o: number): void {
  const qx = q[0]; const qy = q[1]; const qz = q[2]; const qw = q[3];
  // t = 2 q.xyz x v; v' = v + w t + q.xyz x t
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  out[o] = x + qw * tx + (qy * tz - qz * ty);
  out[o + 1] = y + qw * ty + (qz * tx - qx * tz);
  out[o + 2] = z + qw * tz + (qx * ty - qy * tx);
}

/** q from a unit axis and an angle. */
function quatAxisAngle(ax: number, ay: number, az: number, a: number, out: Float64Array): void {
  const s = Math.sin(a / 2);
  out[0] = ax * s; out[1] = ay * s; out[2] = az * s; out[3] = Math.cos(a / 2);
}

/** out = a * b (Hamilton product). */
function quatMul(a: Float64Array, b: Float64Array, out: Float64Array): void {
  const ax = a[0]; const ay = a[1]; const az = a[2]; const aw = a[3];
  const bx = b[0]; const by = b[1]; const bz = b[2]; const bw = b[3];
  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
}

/* ------------------------------------------------------------------ */
/* The simulator                                                       */
/* ------------------------------------------------------------------ */

/** Where the force acts on the wet faces. See THE CENTER OF PRESSURE. */
export type SkipPressureModel = 'planing' | 'uniform';

export interface SkipSimOptions {
  /**
   * THE CENTER OF PRESSURE. [R05] gives the size and direction of the
   * water's force, not where on the wet area it acts, and that sets the
   * torque that tips the stone. 'planing' (the default) spreads the dynamic
   * pressure over the wet faces as a flat plate's planing load, the thin
   * plate distribution sqrt((1 - u) / u) with u the depth under the water
   * line over the deepest point's: high at the water line, zero at the
   * trailing edge, its center at a quarter of the wetted length behind the
   * water line, which is [S64]'s 0.75 of the wetted length from the
   * trailing edge. 'uniform' spreads it evenly (the center at the wet
   * area's centroid). The total force is the same either way.
   */
  readonly pressure?: SkipPressureModel;
  /** The power of 1 / u in the planing load (0.5 is the steady plate). Probe only. */
  readonly rootPower?: number;
  /** Scale on the lever of the dynamic water load about the center. Probe only. */
  readonly leverScale?: number;
  /** THE SPRAY ROOT (default on); false loads the geometric wet part only. */
  readonly wagner?: boolean;
  /** THE AIR'S CENTER OF PRESSURE (default on); false spreads the air's load evenly (round 1). */
  readonly airCenter?: boolean;
  /** Stop after this many seconds (default SKIP_MAX_RUN_S). */
  readonly maxRunS?: number;
  /** Stop at the end of the first contact (for the window searches). */
  readonly firstTouchOnly?: boolean;
  /** Record the states for drawing (default true). */
  readonly record?: boolean;
  /** Stop at the first wet face (for the launch solver). */
  readonly untilWet?: boolean;
  /**
   * Find this stone's window for the end sentence (default true). The
   * search runs a few dozen first contacts; a sweep turns it off and gets
   * the cause without the numbers.
   */
  readonly explain?: boolean;
  /**
   * A probe hook: called once a step with the time, the force and torque
   * on the stone (world, N and N m), its velocity and angular velocity, and
   * whether any face is wet. For measurement only; nothing in a run reads it.
   */
  readonly onStep?: (t: number, force: Float64Array, torque: Float64Array, v: Float64Array, w: Float64Array, wet: boolean, q: Float64Array, p: Float64Array) => void;
}

/** Start state of a run: either a release, or a stone placed just over the water. */
interface StartState {
  p: [number, number, number];
  v: [number, number, number];
  q: [number, number, number, number];
  /** Angular velocity, world, rad/s. */
  w: [number, number, number];
}

/** The stone's orientation for a heading, a nose-up tilt and a bank (right edge down). */
export function skipStoneOrientation(headingRad: number, tiltDeg: number, bankDeg = 0): [number, number, number, number] {
  // Body +Y is the stone's axis. Tilt about the throw's right axis r = f x up,
  // so the nose (the +f edge) rises: n = cos(a) up - sin(a) f.
  const f: [number, number, number] = [Math.cos(headingRad), 0, Math.sin(headingRad)];
  const r: [number, number, number] = [-f[2], 0, f[0]];
  const qa = new Float64Array(4); const qb = new Float64Array(4); const qo = new Float64Array(4);
  // A rotation of +a about r takes up toward -f? d(up)/da = r x up = -f... check:
  // r x up = (-f2, 0, f0) x (0, 1, 0) = (0*0 - f0*1, f0*0 - (-f2)*0, -f2*1 - 0) = (-f0, 0, -f2) = -f.
  quatAxisAngle(r[0], r[1], r[2], tiltDeg * DEG, qa);
  // Bank about f: a rotation of -b about f takes up toward +r (right edge down).
  // f x up = r, so d(up)/db about f is r: a positive rotation about f tilts n toward r.
  quatAxisAngle(f[0], f[1], f[2], bankDeg * DEG, qb);
  quatMul(qb, qa, qo);
  return [qo[0], qo[1], qo[2], qo[3]];
}

interface StepScratch {
  wv: Float64Array; // world vertex positions
  d: Float64Array; // depth of each vertex under the water line
  tn: Float64Array; // world triangle normals
  wetA: Float64Array; wetC: Float64Array; dryA: Float64Array; dryC: Float64Array;
  wetD: Float64Array;
  /** The planing load's weight on each wet face (THE CENTER OF PRESSURE). */
  wetW: Float64Array;
  /** The loaded part of each triangle, under the raised line of the spray root. */
  loadA: Float64Array; loadC: Float64Array;
}

/** Run a throw, or a stone placed at the water (`simulateFromTouch`). */
function runSim(
  stone: SkipStoneType,
  start: StartState,
  water: SkipWater,
  t0S: number,
  opts: SkipSimOptions,
): {
  samples: Float64Array; touches: SkipTouch[]; steps: number; endT: number; endP: [number, number, number];
  settled: boolean; sunk: boolean; timedOut: boolean; firstWetFlightDeg: number;
} {
  const mesh = skipStoneMesh(stone);
  const { massKg, iAxis, iPerp } = skipStoneInertia(stone, mesh);
  const nv = mesh.positions.length / 3;
  const nt = mesh.triangles.length / 3;
  const pressure: SkipPressureModel = opts.pressure ?? 'planing';
  const rootPower = opts.rootPower ?? 0.5;
  const leverScale = opts.leverScale ?? 1;
  const wagner = opts.wagner !== false;
  const airCp = opts.airCenter !== false;
  const airAxis = new Float64Array(3);
  const maxRun = opts.maxRunS ?? SKIP_MAX_RUN_S;
  const record = opts.record !== false;

  const b: Body = {
    p: Float64Array.from(start.p),
    v: Float64Array.from(start.v),
    q: Float64Array.from(start.q),
    L: new Float64Array(3),
  };
  // L = R I R^T w.
  const tmp = new Float64Array(3);
  const setLFromOmega = (wx: number, wy: number, wz: number) => {
    const qc = new Float64Array([-b.q[0], -b.q[1], -b.q[2], b.q[3]]);
    quatRotate(qc, wx, wy, wz, tmp, 0);
    const bx = tmp[0] * iPerp; const by = tmp[1] * iAxis; const bz = tmp[2] * iPerp;
    quatRotate(b.q, bx, by, bz, b.L, 0);
  };
  setLFromOmega(...start.w);

  const s: StepScratch = {
    wv: new Float64Array(nv * 3), d: new Float64Array(nv), tn: new Float64Array(nt * 3),
    wetA: new Float64Array(nt), wetC: new Float64Array(nt * 3), dryA: new Float64Array(nt), dryC: new Float64Array(nt * 3),
    wetD: new Float64Array(nt), wetW: new Float64Array(nt),
    loadA: new Float64Array(nt), loadC: new Float64Array(nt * 3),
  };
  const omega = new Float64Array(3);
  const qc = new Float64Array(4);
  const qd = new Float64Array(4);
  const qn = new Float64Array(4);
  const ws: SkipWaterSample = { h: 0, sx: 0, sz: 0 };
  // The local water plane, refreshed as the stone moves and the sea runs.
  let planeT = -Infinity; let planeX = 0; let planeZ = 0; let planeH = 0; let planeSx = 0; let planeSz = 0;
  // THE WATER PLANE. Near the water (within 15 cm) the local plane is
  // sampled again every 2 ms (10 ms for a stone under 1 m/s) or 1.5 cm; high in the air only the
  // clearance is needed, so every 50 ms or half meter, level (the slope
  // over meters would carry the plane far off). A sea sample sums
  // thousands of modes (`createSkipSeaWater`), so this is most of a run's
  // cost on the lake.
  const refreshPlane = (t: number, x: number, z: number, force: boolean, near: boolean) => {
    const dT = Math.abs(t - planeT); const dX = Math.hypot(x - planeX, z - planeZ);
    const slow = Math.hypot(b.v[0], b.v[1], b.v[2]) < 1;
    if (!force && (near ? dT < (slow ? 1e-2 : 2e-3) && dX < 0.015 : dT < 0.05 && dX < 0.5 && planeSx === 0 && planeSz === 0)) return;
    water.sample(x, z, t0S + t, ws);
    planeT = t; planeX = x; planeZ = z; planeH = ws.h;
    planeSx = near ? ws.sx : 0; planeSz = near ? ws.sz : 0;
  };
  const waterAt = (x: number, z: number) => planeH + planeSx * (x - planeX) + planeSz * (z - planeZ);

  const computeOmega = () => {
    qc[0] = -b.q[0]; qc[1] = -b.q[1]; qc[2] = -b.q[2]; qc[3] = b.q[3];
    quatRotate(qc, b.L[0], b.L[1], b.L[2], tmp, 0);
    quatRotate(b.q, tmp[0] / iPerp, tmp[1] / iAxis, tmp[2] / iPerp, omega, 0);
  };

  const force = new Float64Array(3);
  const torque = new Float64Array(3);
  let wetTotal = 0;
  let pushRate = 0;
  let maxDepthNow = 0;

  /**
   * Clip triangle t where the depth plus `offset` is positive: the part
   * under a water line raised by `offset`. Writes that part's area and
   * centroid to (outA, outC), and the rest to (restA, restC) when `rest`.
   * Returns how many of the three vertices are under. Allocates nothing:
   * it runs for every triangle twice a step.
   */
  const clipTri = (
    t: number, offset: number, outA: Float64Array, outC: Float64Array,
    restA: Float64Array, restC: Float64Array, rest: boolean,
  ): number => {
    const t3 = 3 * t;
    const i0 = mesh.triangles[t3]; const i1 = mesh.triangles[t3 + 1]; const i2 = mesh.triangles[t3 + 2];
    const d0 = s.d[i0] + offset; const d1 = s.d[i1] + offset; const d2 = s.d[i2] + offset;
    const A = mesh.areas[t];
    const nIn = (d0 > 0 ? 1 : 0) + (d1 > 0 ? 1 : 0) + (d2 > 0 ? 1 : 0);
    const wv = s.wv;
    const cx = (wv[3 * i0] + wv[3 * i1] + wv[3 * i2]) / 3;
    const cy = (wv[3 * i0 + 1] + wv[3 * i1 + 1] + wv[3 * i2 + 1]) / 3;
    const cz = (wv[3 * i0 + 2] + wv[3 * i1 + 2] + wv[3 * i2 + 2]) / 3;
    if (nIn === 0 || nIn === 3) {
      outA[t] = nIn === 3 ? A : 0; outC[t3] = cx; outC[t3 + 1] = cy; outC[t3 + 2] = cz;
      if (rest) { restA[t] = nIn === 3 ? 0 : A; restC[t3] = cx; restC[t3 + 1] = cy; restC[t3 + 2] = cz; }
      return nIn;
    }
    // The lone vertex: the one on the other side from the two.
    const lone = nIn === 1 ? (d0 > 0 ? 0 : d1 > 0 ? 1 : 2) : (d0 <= 0 ? 0 : d1 <= 0 ? 1 : 2);
    const ia = lone === 0 ? i0 : lone === 1 ? i1 : i2;
    const ib = lone === 0 ? i1 : lone === 1 ? i2 : i0;
    const ic = lone === 0 ? i2 : lone === 1 ? i0 : i1;
    const da = s.d[ia] + offset; const db = s.d[ib] + offset; const dc = s.d[ic] + offset;
    const tab = da / (da - db); const tac = da / (da - dc);
    const ax = wv[3 * ia]; const ay = wv[3 * ia + 1]; const az = wv[3 * ia + 2];
    const qbx = ax + (wv[3 * ib] - ax) * tab; const qby = ay + (wv[3 * ib + 1] - ay) * tab; const qbz = az + (wv[3 * ib + 2] - az) * tab;
    const qcx = ax + (wv[3 * ic] - ax) * tac; const qcy = ay + (wv[3 * ic + 1] - ay) * tac; const qcz = az + (wv[3 * ic + 2] - az) * tac;
    const aLone = A * tab * tac;
    const lx = (ax + qbx + qcx) / 3; const ly = (ay + qby + qcy) / 3; const lz = (az + qbz + qcz) / 3;
    const aRest = Math.max(A - aLone, 1e-14);
    const rx = (A * cx - aLone * lx) / aRest; const ry = (A * cy - aLone * ly) / aRest; const rz = (A * cz - aLone * lz) / aRest;
    if (nIn === 1) {
      outA[t] = aLone; outC[t3] = lx; outC[t3 + 1] = ly; outC[t3 + 2] = lz;
      if (rest) { restA[t] = aRest; restC[t3] = rx; restC[t3 + 1] = ry; restC[t3 + 2] = rz; }
    } else {
      outA[t] = aRest; outC[t3] = rx; outC[t3 + 1] = ry; outC[t3 + 2] = rz;
      if (rest) { restA[t] = aLone; restC[t3] = lx; restC[t3 + 1] = ly; restC[t3 + 2] = lz; }
    }
    return nIn;
  };

  /**
   * The forces at the current state. Returns true when any face is wet.
   * `nearWater` false (the stone is well clear of the water) skips the
   * clipping: every face is dry.
   */
  const forces = (nearWater: boolean): boolean => {
    computeOmega();
    const px = b.p[0]; const py = b.p[1]; const pz = b.p[2];
    const wv = s.wv;
    for (let i = 0; i < nv; i += 1) {
      quatRotate(b.q, mesh.positions[3 * i], mesh.positions[3 * i + 1], mesh.positions[3 * i + 2], wv, 3 * i);
      wv[3 * i] += px; wv[3 * i + 1] += py; wv[3 * i + 2] += pz;
      s.d[i] = waterAt(wv[3 * i], wv[3 * i + 2]) - wv[3 * i + 1];
    }
    for (let t = 0; t < nt; t += 1) {
      quatRotate(b.q, mesh.normals[3 * t], mesh.normals[3 * t + 1], mesh.normals[3 * t + 2], s.tn, 3 * t);
    }
    force[0] = 0; force[1] = -massKg * GRAVITY_MS2; force[2] = 0;
    torque[0] = 0; torque[1] = 0; torque[2] = 0;
    let anyWet = false;
    let dMax = 0;
    for (let i = 0; i < nv; i += 1) if (s.d[i] > dMax) dMax = s.d[i];
    maxDepthNow = dMax;
    wetTotal = 0;
    pushRate = 0;
    const vx = b.v[0]; const vy = b.v[1]; const vz = b.v[2];
    const wx = omega[0]; const wy = omega[1]; const wz = omega[2];
    // THE SPEED IN THE LAW. [R05]'s U is the stone's speed through the
    // water. A face's own velocity also carries the spin's swirl, 10 m/s at
    // the rim of their disc at 65 turns a second; that swirl lies in the
    // face and makes no pressure (it would make friction, left out), and
    // with it in the speed the force grew with the spin, which their
    // collision time, flat above 40 turns a second (fig. 6a), rules out. So
    // the speed is the center's, or the face's own normal speed when a
    // tumbling face slaps the water faster than the stone moves.
    const vCm = Math.hypot(vx, vy, vz);
    // Pass 1: clip every triangle at the water line (the wet part, for the
    // still-water pressure and for the size of the dynamic load), and again
    // at the raised line of THE SPRAY ROOT (the loaded part, for where the
    // dynamic load acts).
    const pile = wagner ? SKIP_WAGNER_RISE * dMax : 0;
    if (nearWater) {
      for (let t = 0; t < nt; t += 1) {
        const nWet = clipTri(t, 0, s.wetA, s.wetC, s.dryA, s.dryC, true);
        if (nWet > 0) {
          anyWet = true;
          s.wetD[t] = Math.max(0, waterAt(s.wetC[3 * t], s.wetC[3 * t + 2]) - s.wetC[3 * t + 1]);
        }
        if (pile > 0) clipTri(t, pile, s.loadA, s.loadC, s.dryA, s.dryC, false);
        else { s.loadA[t] = s.wetA[t]; s.loadC[3 * t] = s.wetC[3 * t]; s.loadC[3 * t + 1] = s.wetC[3 * t + 1]; s.loadC[3 * t + 2] = s.wetC[3 * t + 2]; }
      }
    }
    // Pass 2: the dynamic load of [R05] on every wet face moving into the
    // water (its size and direction from the face's wet part), and, for the
    // two flat faces of a disc, where it acts: the planing weights over the
    // face's LOADED part, under the raised line of THE SPRAY ROOT.
    let fx = 0; let fy = 0; let fz = 0; let tx = 0; let ty = 0; let tz = 0;
    const lDepth = dMax + pile;
    // Per flat face (1 top, 2 bottom): the summed load, and the weighted
    // sums for its center of pressure.
    let g1x = 0; let g1y = 0; let g1z = 0; let g1w = 0; let g1cx = 0; let g1cy = 0; let g1cz = 0;
    let g2x = 0; let g2y = 0; let g2z = 0; let g2w = 0; let g2cx = 0; let g2cy = 0; let g2cz = 0;
    let g1ax = 0; let g1ay = 0; let g1az = 0; let g1a = 0;
    let g2ax = 0; let g2ay = 0; let g2az = 0; let g2a = 0;
    if (anyWet) {
      for (let t = 0; t < nt; t += 1) {
        const t3 = 3 * t;
        const nx = s.tn[t3]; const ny = s.tn[t3 + 1]; const nz = s.tn[t3 + 2];
        const grpT = mesh.groups[t];
        const aw = s.wetA[t];
        if (aw > 0) {
          const cx = s.wetC[t3]; const cy = s.wetC[t3 + 1]; const cz = s.wetC[t3 + 2];
          const rx = cx - px; const ry = cy - py; const rz = cz - pz;
          // Still water: rho g d A on the wet part, inward.
          const ps = SKIP_WATER_DENSITY * GRAVITY_MS2 * s.wetD[t] * aw;
          let gx = -ps * nx; let gy = -ps * ny; let gz = -ps * nz;
          fx += gx; fy += gy; fz += gz;
          tx += ry * gz - rz * gy; ty += rz * gx - rx * gz; tz += rx * gy - ry * gx;
          const un = (vx + (wy * rz - wz * ry)) * nx + (vy + (wz * rx - wx * rz)) * ny + (vz + (wx * ry - wy * rx)) * nz;
          if (un > 0) {
            const pd = SKIP_LIFT_COEFF * SKIP_WATER_DENSITY * Math.max(vCm, un) * un * aw;
            gx = -pd * nx; gy = -pd * ny; gz = -pd * nz;
            fx += gx; fy += gy; fz += gz;
            wetTotal += aw; pushRate += un * aw;
            if (grpT === 1) { g1x += gx; g1y += gy; g1z += gz; g1ax += aw * cx; g1ay += aw * cy; g1az += aw * cz; g1a += aw; }
            else if (grpT === 2) { g2x += gx; g2y += gy; g2z += gz; g2ax += aw * cx; g2ay += aw * cy; g2az += aw * cz; g2a += aw; }
            else {
              const qx = rx * leverScale; const qy = ry * leverScale; const qz = rz * leverScale;
              tx += qy * gz - qz * gy; ty += qz * gx - qx * gz; tz += qx * gy - qy * gx;
            }
          }
        }
        // The planing weights over the loaded part of a flat face.
        const al = s.loadA[t];
        if (grpT !== 0 && al > 0) {
          const cx = s.loadC[t3]; const cy = s.loadC[t3 + 1]; const cz = s.loadC[t3 + 2];
          const rx = cx - px; const ry = cy - py; const rz = cz - pz;
          const un = (vx + (wy * rz - wz * ry)) * nx + (vy + (wz * rx - wx * rz)) * ny + (vz + (wx * ry - wy * rx)) * nz;
          if (un > 0) {
            let wgt = 1;
            if (pressure === 'planing' && lDepth > 0) {
              const dl = waterAt(cx, cz) + pile - cy;
              const u = Math.min(0.97, Math.max(0.03, dl / lDepth));
              wgt = rootPower === 0.5 ? Math.sqrt((1 - u) / u) : Math.sqrt(1 - u) / Math.pow(u, rootPower);
            }
            const wa = wgt * al;
            if (grpT === 1) { g1w += wa; g1cx += wa * cx; g1cy += wa * cy; g1cz += wa * cz; }
            else { g2w += wa; g2cx += wa * cx; g2cy += wa * cy; g2cz += wa * cz; }
          }
        }
      }
      // Each flat face's load acts at its center of pressure; with no loaded
      // weight (a face only just wet), at its wet centroid.
      const applyFace = (gx: number, gy: number, gz: number, w: number, cx: number, cy: number, cz: number, a: number, ax: number, ay: number, az: number) => {
        if (gx === 0 && gy === 0 && gz === 0) return;
        let qx: number; let qy: number; let qz: number;
        if (w > 0) { qx = cx / w - px; qy = cy / w - py; qz = cz / w - pz; }
        else { qx = ax / a - px; qy = ay / a - py; qz = az / a - pz; }
        qx *= leverScale; qy *= leverScale; qz *= leverScale;
        tx += qy * gz - qz * gy; ty += qz * gx - qx * gz; tz += qx * gy - qy * gx;
      };
      if (g1a > 0) applyFace(g1x, g1y, g1z, g1w, g1cx, g1cy, g1cz, g1a, g1ax, g1ay, g1az);
      if (g2a > 0) applyFace(g2x, g2y, g2z, g2w, g2cx, g2cy, g2cz, g2a, g2ax, g2ay, g2az);
    }
    // Pass 3: the air, on the dry part of every face.
    //
    // THE AIR'S CENTER OF PRESSURE (round 2, GG-340). A flat plate's lift
    // does not act at its middle: thin-plate theory puts the load of each
    // chordwise strip at its quarter chord, from a load sqrt((1 - u) / u)
    // along the chord (u from the leading edge) - the same distribution the
    // water's planing load uses (THE CENTER OF PRESSURE), which is the
    // planing form of the same theory. For a disc that is 4R / (3 pi) =
    // 0.42 R ahead of the center, so a stone in flight feels a nose-up
    // moment: the flying disc's pitching moment. Round 1 spread the air's
    // load evenly (at the face's middle) and so had none. The water's load
    // at the trailing edge pitches the stone nose down at every touch, the
    // air nose up through every flight, and a spinning stone turns each
    // into a lean to the side, in opposite senses: over a bounce they
    // largely cancel. Without the air's half, the lean turned 20 to 60
    // degrees a touch at 30 turns a second. The two flat faces take this
    // load; the rim and the round stones keep the even spread.
    let a1x = 0; let a1y = 0; let a1z = 0; let a1w = 0; let a1cx = 0; let a1cy = 0; let a1cz = 0;
    let a2x = 0; let a2y = 0; let a2z = 0; let a2w = 0; let a2cx = 0; let a2cy = 0; let a2cz = 0;
    // The in-plane flow direction of the flat faces (the stone's own axis is
    // their normal), and the across-flow direction.
    quatRotate(b.q, 0, 1, 0, airAxis, 0);
    const an = vx * airAxis[0] + vy * airAxis[1] + vz * airAxis[2];
    let fwx = vx - an * airAxis[0]; let fwy = vy - an * airAxis[1]; let fwz = vz - an * airAxis[2];
    const fwl = Math.hypot(fwx, fwy, fwz);
    const chordwise = airCp && fwl > 0.2;
    if (chordwise) { fwx /= fwl; fwy /= fwl; fwz /= fwl; }
    const acx = airAxis[1] * fwz - airAxis[2] * fwy; const acy = airAxis[2] * fwx - airAxis[0] * fwz; const acz = airAxis[0] * fwy - airAxis[1] * fwx;
    const Rd = stone.radiusM;
    for (let t = 0; t < nt; t += 1) {
      const t3 = 3 * t;
      const nx = s.tn[t3]; const ny = s.tn[t3 + 1]; const nz = s.tn[t3 + 2];
      const ad = nearWater ? s.dryA[t] : mesh.areas[t];
      if (ad > 0) {
        let cx: number; let cy: number; let cz: number;
        if (nearWater) { cx = s.dryC[t3]; cy = s.dryC[t3 + 1]; cz = s.dryC[t3 + 2]; } else {
          const i0 = mesh.triangles[t3]; const i1 = mesh.triangles[t3 + 1]; const i2 = mesh.triangles[t3 + 2];
          cx = (wv[3 * i0] + wv[3 * i1] + wv[3 * i2]) / 3;
          cy = (wv[3 * i0 + 1] + wv[3 * i1 + 1] + wv[3 * i2 + 1]) / 3;
          cz = (wv[3 * i0 + 2] + wv[3 * i1 + 2] + wv[3 * i2 + 2]) / 3;
        }
        const rx = cx - px; const ry = cy - py; const rz = cz - pz;
        const un = (vx + (wy * rz - wz * ry)) * nx + (vy + (wz * rx - wx * rz)) * ny + (vz + (wx * ry - wy * rx)) * nz;
        if (un > 0) {
          const pa = SKIP_LIFT_COEFF * SKIP_AIR_DENSITY * Math.max(vCm, un) * un * ad;
          const gx = -pa * nx; const gy = -pa * ny; const gz = -pa * nz;
          fx += gx; fy += gy; fz += gz;
          const grpT = mesh.groups[t];
          if (chordwise && grpT !== 0) {
            // Chordwise place of this face's centroid: x along the flow from
            // the center (in the face's plane), y across; the strip's chord
            // runs from +q (the leading edge) to -q.
            const xx = rx * fwx + ry * fwy + rz * fwz;
            const yy = rx * acx + ry * acy + rz * acz;
            const q = Math.sqrt(Math.max(Rd * Rd - yy * yy, 1e-8));
            const u = Math.min(0.97, Math.max(0.03, (q - xx) / (2 * q)));
            const wgt = Math.sqrt((1 - u) / u) * pa;
            if (grpT === 1) { a1x += gx; a1y += gy; a1z += gz; a1w += wgt; a1cx += wgt * rx; a1cy += wgt * ry; a1cz += wgt * rz; }
            else { a2x += gx; a2y += gy; a2z += gz; a2w += wgt; a2cx += wgt * rx; a2cy += wgt * ry; a2cz += wgt * rz; }
          } else {
            tx += ry * gz - rz * gy; ty += rz * gx - rx * gz; tz += rx * gy - ry * gx;
          }
        }
      }
    }
    if (a1w > 0) { const qx = a1cx / a1w; const qy = a1cy / a1w; const qz = a1cz / a1w; tx += qy * a1z - qz * a1y; ty += qz * a1x - qx * a1z; tz += qx * a1y - qy * a1x; }
    if (a2w > 0) { const qx = a2cx / a2w; const qy = a2cy / a2w; const qz = a2cz / a2w; tx += qy * a2z - qz * a2y; ty += qz * a2x - qx * a2z; tz += qx * a2y - qy * a2x; }
    force[0] += fx; force[1] += fy; force[2] += fz;
    torque[0] = tx; torque[1] = ty; torque[2] = tz;
    return anyWet;
  };

  /** The stone's axis (body +Y) in the world. */
  const axis = new Float64Array(3);
  const attitude = (): { tilt: number; bank: number; heading: number; flight: number; speed: number } => {
    quatRotate(b.q, 0, 1, 0, axis, 0);
    const vh = Math.hypot(b.v[0], b.v[2]);
    const fx = vh > 1e-6 ? b.v[0] / vh : 1; const fz = vh > 1e-6 ? b.v[2] / vh : 0;
    // n . f = -sin(tilt) for a nose-up stone; n . r = sin(bank), r = f x up.
    const nf = axis[0] * fx + axis[2] * fz;
    const nr = axis[0] * -fz + axis[2] * fx;
    return {
      tilt: Math.asin(Math.max(-1, Math.min(1, -nf))) / DEG,
      bank: Math.asin(Math.max(-1, Math.min(1, nr))) / DEG,
      heading: Math.atan2(fz, fx),
      flight: Math.atan2(-b.v[1], vh) / DEG,
      speed: Math.hypot(b.v[0], b.v[1], b.v[2]),
    };
  };

  const samples: number[] = [];
  const touches: SkipTouch[] = [];
  let t = 0;
  let nextSample = 0;
  let steps = 0;
  let inContact = false;
  let cur: {
    tStart: number; x: number; y: number; z: number; att: ReturnType<typeof attitude>;
    maxDepth: number; peakArea: number; pushed: number; tiltMin: number; path: number[]; nextPathT: number; lastDry: number;
  } | null = null;
  let lastEnd: { tEnd: number; att: ReturnType<typeof attitude> } | null = null;
  let settledFor = 0;
  let sunk = false;
  let settled = false;
  let firstWetFlightDeg = NaN;
  let lastClear = -1;
  const axisNow = new Float64Array(3);

  const lowestXZ = (): [number, number, number] => {
    let bi = 0;
    for (let i = 1; i < nv; i += 1) if (s.d[i] > s.d[bi]) bi = i;
    return [s.wv[3 * bi], s.wv[3 * bi + 1], s.wv[3 * bi + 2]];
  };

  const finishTouch = (reb: boolean) => {
    if (!cur) return;
    const out = lastEnd!.att;
    touches.push({
      index: touches.length,
      tStartS: cur.tStart, tEndS: lastEnd!.tEnd,
      xM: cur.x, yM: cur.y, zM: cur.z,
      speedInMs: cur.att.speed, flightInDeg: cur.att.flight, tiltInDeg: cur.att.tilt, bankInDeg: cur.att.bank,
      speedOutMs: out.speed, flightOutDeg: out.flight, tiltOutDeg: out.tilt, bankOutDeg: out.bank,
      tiltMinDeg: cur.tiltMin,
      maxDepthM: cur.maxDepth, peakWetAreaM2: cur.peakArea, pushedM3: cur.pushed,
      headingRad: cur.att.heading,
      rebound: reb,
      path: cur.path,
    });
    cur = null;
  };

  // The run.
  refreshPlane(0, b.p[0], b.p[2], true, true);
  while (t < maxRun) {
    refreshPlane(t, b.p[0], b.p[2], false, lastClear < 0.15);
    // Height of the stone's lowest point over the water, from the last step's depths.
    const wet = forces(lastClear < 0.05 + Math.abs(b.v[1]) * 0.01);
    let minClear = Infinity;
    for (let i = 0; i < nv; i += 1) if (-s.d[i] < minClear) minClear = -s.d[i];
    lastClear = minClear;
    const near = minClear < 0.02 + Math.abs(b.v[1]) * 0.004;
    const speed = Math.hypot(b.v[0], b.v[1], b.v[2]);
    const submerged = minClear < -stone.thicknessM;
    // The contact lasts about sqrt(h R) / U ([R05] fig. 8b), so the water
    // step shrinks with the speed: SKIP_DT_WATER_S at 12 m/s, and never
    // over SKIP_DT_SLOW_S.
    const dtWater = Math.min(SKIP_DT_SLOW_S, SKIP_DT_WATER_S * 12 / Math.max(speed, 1));
    // A stone that floats, slow at the water, bobs with a period near 0.3 s:
    // SKIP_DT_FLOAT_S resolves it.
    const floating = stone.densityKgM3 < SKIP_WATER_DENSITY && wet && speed < 0.4;
    const dtBase = floating ? SKIP_DT_FLOAT_S
      : near && !(submerged && speed < 1.5) ? dtWater : (near || submerged) ? SKIP_DT_SLOW_S : SKIP_DT_AIR_S;
    // THE TURN PER STEP. The rotation between kicks is exact (THE FREE
    // TOP, below), so the step is set by the forces, not by the spin: in the
    // water the wobble across the axis may turn the stone at most
    // SKIP_MAX_TURN_RAD a step, so the wet part a force sees moves little
    // within one step.
    const wmNow = Math.hypot(omega[0], omega[1], omega[2]);
    quatRotate(b.q, 0, 1, 0, axisNow, 0);
    const wAx = omega[0] * axisNow[0] + omega[1] * axisNow[1] + omega[2] * axisNow[2];
    const wPerp = Math.sqrt(Math.max(0, wmNow * wmNow - wAx * wAx));
    let dt = dtBase;
    if (near && wPerp > 0) dt = Math.min(dt, SKIP_MAX_TURN_RAD / wPerp);

    if (wet && opts.untilWet) { firstWetFlightDeg = attitude().flight; break; }
    // Contact bookkeeping.
    if (wet) {
      if (!inContact) {
        inContact = true;
        if (cur && lastEnd && t - lastEnd.tEnd < SKIP_MIN_FLIGHT_S) {
          // A hop too short to count: the same touch goes on.
        } else {
          if (cur) finishTouch(true);
          const lo = lowestXZ();
          const att = attitude();
          cur = {
            tStart: t, x: lo[0], y: waterAt(lo[0], lo[2]), z: lo[2], att,
            maxDepth: 0, peakArea: 0, pushed: 0, tiltMin: att.tilt, path: [], nextPathT: t, lastDry: t,
          };
        }
      }
      if (cur) {
        cur.maxDepth = Math.max(cur.maxDepth, maxDepthNow);
        cur.peakArea = Math.max(cur.peakArea, wetTotal);
        cur.pushed += pushRate * dt;
        if (t >= cur.nextPathT) {
          cur.tiltMin = Math.min(cur.tiltMin, attitude().tilt);
          const lo = lowestXZ();
          cur.path.push(lo[0], lo[2]);
          cur.nextPathT = t + 1e-3;
        }
      }
    } else if (inContact) {
      inContact = false;
      lastEnd = { tEnd: t, att: attitude() };
    }
    if (!wet && cur && lastEnd && t - lastEnd.tEnd >= SKIP_MIN_FLIGHT_S) {
      finishTouch(true);
      if (opts.firstTouchOnly) break;
    }

    // Record.
    if (record && t >= nextSample) {
      samples.push(t, b.p[0], b.p[1], b.p[2], b.q[0], b.q[1], b.q[2], b.q[3]);
      nextSample = t + SKIP_SAMPLE_S;
    }

    // Ends: a dense stone deep under; a light stone at rest on the water.
    let top = -Infinity;
    for (let i = 0; i < nv; i += 1) if (s.wv[3 * i + 1] > top) top = s.wv[3 * i + 1];
    if (top < waterAt(b.p[0], b.p[2]) - SKIP_SUNK_DEPTH_M) { sunk = true; break; }
    if (wet && speed < 0.05) settledFor += dt; else settledFor = 0;
    if (settledFor > 0.6) { settled = true; break; }
    if (opts.firstTouchOnly && wet && t - (cur?.tStart ?? t) > 0.4) break; // it never left: surfing or sinking
    // Wholly under the water and still going down, a stone takes no lift
    // ([B03]: the lift is lost when the stone is fully immersed): no rebound.
    if (opts.firstTouchOnly && wet && b.v[1] < 0) {
      let highest = -Infinity;
      for (let i = 0; i < nv; i += 1) if (-s.d[i] > highest) highest = -s.d[i];
      if (highest < -0.005) break;
    }

    if (opts.onStep) opts.onStep(t, force, torque, b.v, omega, wet, b.q, b.p);
    // Step: a kick, then a drift (symplectic Euler). The kick adds the
    // step's force and torque; the drift moves the stone with no force on it.
    const im = 1 / massKg;
    b.v[0] += force[0] * im * dt; b.v[1] += force[1] * im * dt; b.v[2] += force[2] * im * dt;
    b.L[0] += torque[0] * dt; b.L[1] += torque[1] * dt; b.L[2] += torque[2] * dt;
    b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
    // THE FREE TOP (round 2, the cause of GG-340). The drift of the
    // orientation is the exact torque-free motion of a symmetric top: with
    // the angular momentum L fixed, omega = L / I_perp + L_n (1 / I_axis -
    // 1 / I_perp) n, which is a rotation of the whole stone about L at
    // |L| / I_perp and a rotation about its own axis n at L_n (1 / I_axis -
    // 1 / I_perp) (Landau and Lifshitz, Mechanics, sec. 33). Round 1 stepped
    // it as one rotation about the instant omega, an explicit first-order
    // step; a stone that left a touch with a 6 degree wobble grew it in its
    // flight with no torque on it (the axis's spin rate fell from 188 to
    // 157 rad/s and the wobble rate rose from 83 to 206 rad/s in half a
    // second, energy the step made), so it came to the next touch leaning
    // 50 to 60 degrees. That, not the water's torque, was most of the drift.
    quatRotate(b.q, 0, 1, 0, axisNow, 0);
    const Lm = Math.hypot(b.L[0], b.L[1], b.L[2]);
    if (Lm > 1e-15) {
      const Ln = b.L[0] * axisNow[0] + b.L[1] * axisNow[1] + b.L[2] * axisNow[2];
      // About the stone's own axis first, then the whole stone about L.
      quatAxisAngle(axisNow[0], axisNow[1], axisNow[2], Ln * (1 / iAxis - 1 / iPerp) * dt, qd);
      quatMul(qd, b.q, qn);
      quatAxisAngle(b.L[0] / Lm, b.L[1] / Lm, b.L[2] / Lm, (Lm / iPerp) * dt, qd);
      quatMul(qd, qn, b.q);
      const ql = Math.hypot(b.q[0], b.q[1], b.q[2], b.q[3]);
      b.q[0] /= ql; b.q[1] /= ql; b.q[2] /= ql; b.q[3] /= ql;
    }
    t += dt;
    steps += 1;
  }
  // A touch still open at the end did not rebound.
  if (cur) {
    if (!lastEnd || lastEnd.tEnd < cur.tStart) lastEnd = { tEnd: t, att: attitude() };
    finishTouch(false);
  }
  if (record) samples.push(t, b.p[0], b.p[1], b.p[2], b.q[0], b.q[1], b.q[2], b.q[3]);
  return {
    samples: Float64Array.from(samples), touches, steps, endT: t, endP: [b.p[0], b.p[1], b.p[2]],
    settled, sunk, timedOut: !sunk && !settled, firstWetFlightDeg,
  };
}

/**
 * Place the stone just over flat water with the given path and attitude
 * and run its first contact only. For the published setups and the window
 * searches: `speedMs` and `flightDeg` are the state at the touch.
 */
export function simulateFromTouch(
  stoneId: SkipStoneId | SkipStoneType,
  speedMs: number,
  flightDeg: number,
  tiltDeg: number,
  spinRps: number,
  opts: SkipSimOptions & { water?: SkipWater; bankDeg?: number } = {},
): { touch: SkipTouch | null; rebound: boolean; contactS: number } {
  const stone = typeof stoneId === 'string' ? SKIP_STONES[stoneId] : stoneId;
  const water = opts.water ?? skipFlatWater(0);
  const heading = 0;
  // A bank at the touch (round 2): the end sentence asks whether a stone
  // that came in banked would have skipped level.
  const q = skipStoneOrientation(heading, tiltDeg, opts.bankDeg ?? 0);
  // The lowest point of the stone 2 mm over the water.
  const mesh = skipStoneMesh(stone);
  const qa = Float64Array.from(q);
  const tmpv = new Float64Array(3);
  let low = Infinity;
  for (let i = 0; i < mesh.positions.length / 3; i += 1) {
    quatRotate(qa, mesh.positions[3 * i], mesh.positions[3 * i + 1], mesh.positions[3 * i + 2], tmpv, 0);
    low = Math.min(low, tmpv[1]);
  }
  const axisW = new Float64Array(3);
  quatRotate(qa, 0, 1, 0, axisW, 0);
  const w = 2 * Math.PI * spinRps;
  const b = flightDeg * DEG;
  const run = runSim(stone, {
    p: [0, 0.002 - low, 0],
    v: [speedMs * Math.cos(b), -speedMs * Math.sin(b), 0],
    q,
    w: [axisW[0] * w, axisW[1] * w, axisW[2] * w],
  }, water, 0, { ...opts, firstTouchOnly: true, record: false, maxRunS: 1.0 });
  const touch = run.touches[0] ?? null;
  return { touch, rebound: !!touch && touch.rebound, contactS: touch ? touch.tEndS - touch.tStartS : 0 };
}

/**
 * The whole run from a stone placed 2 mm over flat water with the given
 * path and attitude, every touch to the end, with no launch and no window
 * search. For the sweeps: the path at the first touch is set exactly, so a
 * flat 0 degrees is as reachable as a steep 60.
 */
export function simulateRunFromTouch(
  stoneId: SkipStoneId | SkipStoneType,
  speedMs: number,
  flightDeg: number,
  tiltDeg: number,
  spinRps: number,
  opts: SkipSimOptions = {},
): { touches: readonly SkipTouch[]; skips: number; distanceM: number } {
  const stone = typeof stoneId === 'string' ? SKIP_STONES[stoneId] : stoneId;
  const q = skipStoneOrientation(0, tiltDeg);
  const mesh = skipStoneMesh(stone);
  const qa = Float64Array.from(q);
  const tmpv = new Float64Array(3);
  let low = Infinity;
  for (let i = 0; i < mesh.positions.length / 3; i += 1) {
    quatRotate(qa, mesh.positions[3 * i], mesh.positions[3 * i + 1], mesh.positions[3 * i + 2], tmpv, 0);
    low = Math.min(low, tmpv[1]);
  }
  const axisW = new Float64Array(3);
  quatRotate(qa, 0, 1, 0, axisW, 0);
  const w = 2 * Math.PI * spinRps;
  const b = flightDeg * DEG;
  const run = runSim(stone, {
    p: [0, 0.002 - low, 0],
    v: [speedMs * Math.cos(b), -speedMs * Math.sin(b), 0],
    q,
    w: [axisW[0] * w, axisW[1] * w, axisW[2] * w],
  }, skipFlatWater(0), 0, { ...opts, record: false });
  const skips = run.touches.filter((t) => t.rebound).length;
  return { touches: run.touches, skips, distanceM: Math.hypot(run.endP[0], run.endP[2]) };
}

/**
 * The lowest speed that bounces, m/s: a scan up from `loMs` in steps of
 * `stepMs`, then a bisection in the last step. A scan, not a bisection
 * over the whole range, because a bounce is not monotone in the speed: a
 * fast stone with little spin wobbles more per touch (the torque grows as
 * U^2 and the spin's hold does not), so it can bounce at 6 m/s and tumble
 * at 20. Infinity when nothing up to `hiMs` bounces.
 */
export function skipMinSpeed(
  stoneId: SkipStoneId | SkipStoneType, flightDeg: number, tiltDeg: number, spinRps: number,
  opts: SkipSimOptions = {}, loMs = 0.5, hiMs = 20, stepMs = 0.5,
): number {
  let prev = loMs;
  for (let u = loMs; u <= hiMs + 1e-9; u += stepMs) {
    if (simulateFromTouch(stoneId, u, flightDeg, tiltDeg, spinRps, opts).rebound) {
      if (u === loMs) return u;
      let lo = prev; let hi = u;
      for (let i = 0; i < 6; i += 1) {
        const mid = 0.5 * (lo + hi);
        if (simulateFromTouch(stoneId, mid, flightDeg, tiltDeg, spinRps, opts).rebound) hi = mid; else lo = mid;
      }
      return hi;
    }
    prev = u;
  }
  return Infinity;
}

/**
 * The steepest path that still bounces at this speed, tilt and spin,
 * degrees, by a scan from flat then bisection. -1 when no path bounces.
 */
export function skipMaxFlight(
  stoneId: SkipStoneId | SkipStoneType, speedMs: number, tiltDeg: number, spinRps: number,
  opts: SkipSimOptions = {},
): number {
  let lastOk = -1;
  let firstBad = -1;
  for (let f = 2; f <= 70; f += 4) {
    if (simulateFromTouch(stoneId, speedMs, f, tiltDeg, spinRps, opts).rebound) lastOk = f;
    else if (lastOk >= 0) { firstBad = f; break; }
  }
  if (lastOk < 0) return -1;
  if (firstBad < 0) return lastOk;
  let lo = lastOk; let hi = firstBad;
  for (let i = 0; i < 8; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (simulateFromTouch(stoneId, speedMs, mid, tiltDeg, spinRps, opts).rebound) lo = mid; else hi = mid;
  }
  return lo;
}

/**
 * THE LAUNCH. A person sets the path at the first touch; the hand sets the
 * angle at release. From height H at speed U the flattest path at the
 * water is atan(sqrt(2 g H) / U) (a level throw), steeper when thrown down.
 * This finds the downward launch angle whose flight (with the air's force)
 * first touches the water at the path asked for, by bisection.
 */
function solveLaunch(
  stone: SkipStoneType, thr: SkipThrow, water: SkipWater,
): { start: StartState; pitchDownDeg: number; flattest: boolean; flightAtTouchDeg: number } {
  const q = skipStoneOrientation(thr.headingRad, thr.tiltDeg);
  const qa = Float64Array.from(q);
  const axisW = new Float64Array(3);
  quatRotate(qa, 0, 1, 0, axisW, 0);
  const w = 2 * Math.PI * thr.spinRps;
  const fx = Math.cos(thr.headingRad); const fz = Math.sin(thr.headingRad);
  const startAt = (downDeg: number): StartState => {
    const g = downDeg * DEG;
    return {
      p: [thr.originXM, thr.releaseHeightM, thr.originZM],
      v: [thr.speedMs * Math.cos(g) * fx, -thr.speedMs * Math.sin(g), thr.speedMs * Math.cos(g) * fz],
      q,
      w: [axisW[0] * w, axisW[1] * w, axisW[2] * w],
    };
  };
  const touchAngle = (downDeg: number): number => {
    const r = runSim(stone, startAt(downDeg), water, thr.t0S, { untilWet: true, record: false, maxRunS: 6 });
    return Number.isFinite(r.firstWetFlightDeg) ? r.firstWetFlightDeg : 90;
  };
  const flat = touchAngle(0);
  if (thr.flightAngleDeg <= flat) {
    return { start: startAt(0), pitchDownDeg: 0, flattest: thr.flightAngleDeg < flat - 0.05, flightAtTouchDeg: flat };
  }
  let lo = 0; let hi = 85;
  for (let i = 0; i < 14; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (touchAngle(mid) < thr.flightAngleDeg) lo = mid; else hi = mid;
  }
  const g = 0.5 * (lo + hi);
  return { start: startAt(g), pitchDownDeg: g, flattest: false, flightAtTouchDeg: touchAngle(g) };
}

/** Johnson and Reid's ricochet limit for a sphere, degrees [JR75]. */
export function sphereRicochetLimitDeg(densityKgM3: number): number {
  return 18 / Math.sqrt(densityKgM3 / SKIP_WATER_DENSITY);
}

const fmt = (x: number, d = 0) => x.toFixed(d);

/**
 * WHY IT ENDED, in one plain sentence. The cause is read off the run: the
 * last touch's path, speed and attitude against this stone's own window,
 * which the same model finds by searching (`skipMaxFlight`,
 * `skipMinSpeed`), and one counterfactual: the same touch run again with
 * the tilt the stone left the hand with, held (no torque on it: the
 * constant-tilt limit that [R05] section 4 models). Nothing here decides the physics;
 * it only names what happened.
 *
 * - floated: the stone is lighter than water.
 * - round: an ellipsoid as thick as it is wide (the pebble).
 * - tumbled: the stone's attitude at the last touch had moved (tilt off by
 *   more than 12 degrees, a bank over 20, or a dip inside the touch over
 *   30), and the same touch with the original tilt skips.
 * - planed: after at least one skip, the path at the last touch was
 *   flatter than 4 degrees: [R05]'s end of a run, where each touch takes
 *   fall speed until the stone cannot leave the water.
 * - steep / slow: the path was past this stone's window at that speed, or
 *   no path skips at that speed.
 * - rippled (round 2): the touch's speed, path and tilt skip on still
 *   water and its bank does not explain the end, but the water under it
 *   sloped half a degree or more along the path. With the water level
 *   there, the stone was still wobbling from the touches before (tumbled).
 */
function explainEnd(run: ReturnType<typeof runSim>, stone: SkipStoneType, thr: SkipThrow, search = true, water: SkipWater = skipFlatWater(0)): SkipEnd {
  const endP = run.endP;
  const last = run.touches[run.touches.length - 1] ?? null;
  const skips = run.touches.filter((t) => t.rebound).length;
  const where = { tS: run.endT, xM: endP[0], zM: endP[2] };
  const nth = (i: number) => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][i] ?? `${i + 1}th`;
  if (stone.densityKgM3 < SKIP_WATER_DENSITY && (run.settled || run.timedOut)) {
    return {
      cause: 'floated', ...where,
      sentence: `Floats: ${stone.label.toLowerCase()} is ${fmt(stone.densityKgM3 / SKIP_WATER_DENSITY, 2)} as dense as water, `
        + `so after ${skips === 0 ? 'landing' : `${skips} skip${skips === 1 ? '' : 's'}`} it bobs on the surface.`,
    };
  }
  if (!last) return { cause: 'running', ...where, sentence: 'The stone never reached the water.' };
  if (last.rebound) return { cause: 'running', ...where, sentence: `Still skipping when the run stopped at ${fmt(run.endT, 1)} s.` };
  const i = last.index;
  if (stone.shape === 'ellipsoid' && stone.thicknessM >= 1.5 * stone.radiusM) {
    return {
      cause: 'round', ...where,
      sentence: `Sank: a round stone meets the water on a curved face, so the water pushes it back more than up. `
        + `Even fast, a sphere ricochets only on a path flatter than about ${fmt(sphereRicochetLimitDeg(stone.densityKgM3))} degrees `
        + `(Johnson and Reid, 1975), and slower it needs flatter still; this one met the water at ${fmt(last.flightInDeg)} degrees and ${fmt(last.speedInMs, 1)} m/s.`,
    };
  }
  const spinWord = Math.abs(thr.spinRps) < 0.5 ? 'no spin' : `only ${fmt(Math.abs(thr.spinRps), 0)} turns a second of spin`;
  // The last touch, if the stone's attitude there had left the throw's (it
  // came in more than 12 degrees off its tilt or banked over 20), or the
  // water tipped it over inside it.
  const off = (t: SkipTouch) => Math.abs(t.tiltInDeg - thr.tiltDeg) > 12 || Math.abs(t.bankInDeg) > 20;
  const dipped = (t: SkipTouch) => t.tiltInDeg - t.tiltMinDeg > 30;
  // A stone that ran out of bounce ([R05]'s end: a path under 4 degrees
  // after a skip) sinks as it planes, and its tilt falls then; that is not
  // a tumble.
  const ranOut = skips > 0 && last.flightInDeg < 4;
  const firstOff = off(last) || (dipped(last) && !ranOut) ? last : null;
  if (firstOff && (!search || Math.abs(thr.spinRps) < 3
    || simulateFromTouch(stone, last.speedInMs, last.flightInDeg, thr.tiltDeg, thr.spinRps, { leverScale: 0 }).rebound)) {
    const k = firstOff.index;
    let how: string;
    if (k === 0 && off(firstOff)) {
      // A flat stone in flight is lifted ahead of its middle (THE AIR'S
      // CENTER OF PRESSURE); with no spin to hold it, it pitches over in the air.
      how = `it pitched over in the air before it reached the water (it met the water at ${fmt(firstOff.tiltInDeg)} degrees of tilt, `
        + `${fmt(Math.abs(firstOff.bankInDeg))} of bank, where it left the hand at ${fmt(thr.tiltDeg)})`;
    } else if (dipped(firstOff) && !off(firstOff)) {
      how = `the water tipped it over during the ${nth(k)} touch (its tilt fell from ${fmt(firstOff.tiltInDeg)} to ${fmt(firstOff.tiltMinDeg)} degrees)`;
    } else {
      how = `the tilt did not hold: at the ${nth(k)} touch it was ${fmt(firstOff.tiltInDeg)} degrees with a ${fmt(Math.abs(firstOff.bankInDeg))} degree bank, `
        + `where it left the hand at ${fmt(thr.tiltDeg)}`;
    }
    return {
      cause: 'tumbled', ...where,
      sentence: `Tumbled after ${skips} skip${skips === 1 ? '' : 's'}: ${spinWord}, so ${how}.`,
    };
  }
  const tilt = Math.max(0, last.tiltInDeg);
  if (!search) {
    const cause: SkipEndCause = skips > 0 && last.flightInDeg < 4 ? 'planed' : last.flightInDeg > 30 ? 'steep' : 'slow';
    return { cause, ...where, sentence: `Sank (${cause}): the window search is off for this run.` };
  }
  if (skips > 0 && last.flightInDeg < 4) {
    const run0 = run.touches[0];
    return {
      cause: 'planed', ...where,
      sentence: `Ran out of bounce: each touch took some of the fall speed (${fmt(run0.flightInDeg)} degrees at the first touch, `
        + `${fmt(last.flightInDeg, 1)} at the ${nth(i)}), so the path grew too flat to leave the water, and it planed and sank.`,
    };
  }
  const maxFlight = skipMaxFlight(stone, last.speedInMs, tilt, thr.spinRps);
  if (maxFlight < 0 || last.flightInDeg <= maxFlight) {
    const vmin = skipMinSpeed(stone, last.flightInDeg, tilt, thr.spinRps);
    // THE SPEED WAS ENOUGH (round 2). A run can end at a touch that flat,
    // still water would bounce at that speed, path and tilt. Round 1 called
    // every such end "too slow" and printed a speed over the one it said was
    // needed (the window proof p3: "At 5.3 m/s ... it needs about 4.2 m/s").
    // So the touch is tried again: with its own bank on flat water (if it
    // sinks there too, the bank took the bounce), then the water's own slope
    // under it is read (a ripple's face steepens the path to the water).
    // The two speeds of a sentence, to 0.1 m/s, or to 0.01 when they round alike.
    const [had, need] = fmt(last.speedInMs, 1) === fmt(vmin, 1) ? [fmt(last.speedInMs, 2), fmt(vmin, 2)] : [fmt(last.speedInMs, 1), fmt(vmin, 1)];
    if (Number.isFinite(vmin) && last.speedInMs >= vmin) {
      const bank = last.bankInDeg;
      if (Math.abs(bank) >= 3 && !simulateFromTouch(stone, last.speedInMs, last.flightInDeg, tilt, thr.spinRps, { bankDeg: bank }).rebound) {
        return {
          cause: 'tumbled', ...where,
          sentence: `Tumbled after ${skips} skip${skips === 1 ? '' : 's'}: at the ${nth(i)} touch it came in banked ${fmt(Math.abs(bank))} degrees `
            + `(it left the hand level), and a banked stone digs its low edge in. Level, that touch skips: it needs about ${need} m/s and had ${had}.`,
        };
      }
      const ws = water.sample(last.xM, last.zM, thr.t0S + last.tStartS, { h: 0, sx: 0, sz: 0 });
      const faceDeg = Math.atan(ws.sx * Math.cos(last.headingRad) + ws.sz * Math.sin(last.headingRad)) / DEG;
      if (Math.abs(faceDeg) >= 0.5) {
        return {
          cause: 'rippled', ...where,
          sentence: `Sank at the ${nth(i)} touch on a ripple: at ${had} m/s on a ${fmt(last.flightInDeg, 1)} degree path it skips on still water `
            + `(it needs about ${need} m/s there), but the water there sloped ${fmt(Math.abs(faceDeg), 1)} degrees ${faceDeg > 0 ? 'up against it, which steepened its path to the water' : 'away from it, which flattened its path to the water'}, and that took the last of its bounce.`,
        };
      }
      return {
        cause: 'tumbled', ...where,
        sentence: `Tumbled after ${skips} skip${skips === 1 ? '' : 's'}: at the ${nth(i)} touch the stone was still wobbling from the touches before it. `
          + `Steady at the same speed, path and tilt, that touch skips (it needs about ${need} m/s and had ${had}).`,
      };
    }
    return {
      cause: 'slow', ...where,
      // At the edge (within the search's 0.02 m/s), the sentence says so.
      sentence: Number.isFinite(vmin) && vmin - last.speedInMs < 0.02
        ? `Sank: just too slow. At ${had} m/s it was at the least speed that bounces on this path and tilt (about ${need} m/s), and this touch took it under.`
        : `Sank: too slow. At ${Number.isFinite(vmin) ? had : fmt(last.speedInMs, 1)} m/s the water could not push it back up`
          + (Number.isFinite(vmin) ? `; on this path and tilt it needs about ${need} m/s.` : ' on any path.'),
    };
  }
  return {
    cause: 'steep', ...where,
    sentence: `Sank: the path was ${fmt(last.flightInDeg)} degrees steep at the ${nth(i)} touch, past this stone's window: `
      + `at ${fmt(last.speedInMs, 1)} m/s and ${fmt(tilt)} degrees of tilt it skips only on paths up to about ${fmt(maxFlight)} degrees.`,
  };
}

/** Throw a stone. Pure: the same throw on the same water gives the same run. */
export function simulateSkip(thr: SkipThrow, water: SkipWater, opts: SkipSimOptions = {}): SkipRun {
  const stone = SKIP_STONES[thr.stone];
  if (!stone) throw new Error(`[ocean] No stone type "${thr.stone}". Types: ${Object.keys(SKIP_STONES).join(', ')}.`);
  if (!(thr.speedMs > 0) || !(thr.releaseHeightM > 0)) {
    throw new Error('[ocean] A throw needs a positive speed and a release height over the water.');
  }
  const mesh = skipStoneMesh(stone);
  const { massKg } = skipStoneInertia(stone, mesh);
  const launch = solveLaunch(stone, thr, water);
  const run = runSim(stone, launch.start, water, thr.t0S, opts);
  const end = explainEnd(run, stone, thr, opts.explain !== false, water);
  const skips = run.touches.filter((t) => t.rebound).length;
  return {
    throw: thr,
    stone,
    massKg,
    water: water.label,
    launch: { pitchDownDeg: launch.pitchDownDeg, flattest: launch.flattest, flightAtTouchDeg: launch.flightAtTouchDeg },
    samples: run.samples,
    touches: run.touches,
    skips,
    distanceM: Math.hypot(end.xM - thr.originXM, end.zM - thr.originZM),
    end,
    floats: stone.densityKgM3 < SKIP_WATER_DENSITY,
    steps: run.steps,
  };
}

/**
 * The stone's recorded state at `tS` seconds after release, interpolated
 * (position linear, orientation normalized linear). Past the end, the last
 * state.
 */
export function skipStateAt(run: SkipRun, tS: number, outPos: Float64Array, outQuat: Float64Array): void {
  const S = SKIP_SAMPLE_STRIDE;
  const n = run.samples.length / S;
  const sm = run.samples;
  if (n === 0) return;
  let i = Math.floor(tS / SKIP_SAMPLE_S);
  i = Math.max(0, Math.min(n - 2, i));
  // The samples are 1 ms apart except the last; walk to the right pair.
  while (i > 0 && sm[i * S] > tS) i -= 1;
  while (i < n - 2 && sm[(i + 1) * S] < tS) i += 1;
  if (n === 1 || tS <= sm[0]) {
    for (let k = 0; k < 3; k += 1) outPos[k] = sm[1 + k];
    for (let k = 0; k < 4; k += 1) outQuat[k] = sm[4 + k];
    return;
  }
  const a = i * S; const b = (i + 1) * S;
  const span = sm[b] - sm[a];
  const f = span > 0 ? Math.min(1, Math.max(0, (tS - sm[a]) / span)) : 1;
  for (let k = 0; k < 3; k += 1) outPos[k] = sm[a + 1 + k] + (sm[b + 1 + k] - sm[a + 1 + k]) * f;
  const dot = sm[a + 4] * sm[b + 4] + sm[a + 5] * sm[b + 5] + sm[a + 6] * sm[b + 6] + sm[a + 7] * sm[b + 7];
  const sg = dot < 0 ? -1 : 1;
  let l = 0;
  for (let k = 0; k < 4; k += 1) {
    outQuat[k] = sm[a + 4 + k] + (sg * sm[b + 4 + k] - sm[a + 4 + k]) * f;
    l += outQuat[k] * outQuat[k];
  }
  l = Math.sqrt(l);
  for (let k = 0; k < 4; k += 1) outQuat[k] /= l;
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export type SkipPresetId = 'best' | 'steep' | 'nospin' | 'slow' | 'pebble' | 'pumice';

export interface SkipPreset {
  readonly id: SkipPresetId;
  readonly label: string;
  /** The cause the run must end with; the tests hold each preset to it. */
  readonly expect: SkipEndCause;
  readonly throw: Omit<SkipThrow, 'headingRad' | 'originXM' | 'originZM' | 't0S'>;
}

/**
 * THE PRESETS. "The best throw" is a person's best: fast (12 m/s, a strong
 * sidearm throw), with strong spin (35 turns a second: a 6 cm stone flicked
 * off the index finger at 6.6 m/s at its rim), released 30 cm over the water
 * and meeting it on a 12 degree path, with the stone's front edge up 10
 * degrees.
 *
 * WHY 10 DEGREES AND NOT THE MAGIC 20. [C04]'s 20 degrees is the tilt of
 * the lowest speed that still skips and of the widest window of paths
 * (this model finds both at 15 to 20; the tests hold it). The longest runs
 * come lower: each touch takes about tan(tilt) of the vertical impulse off
 * the forward speed, and a flatter stone levers less water under its
 * trailing edge. [R05]'s own many-skip runs were thrown at 7 and 10 degrees
 * (their fig. 9). In this model a slate at 12 m/s and 35 turns a second
 * makes 6 to 8 skips at 10 degrees (over +-0.5 m/s and +-1 degree of path)
 * and 3 to 4 at 20 (see GG-340 and the skip-stones domain doc).
 *
 * The others each break one part of the best throw, and the tests hold each
 * to the cause it names.
 */
export const SKIP_PRESETS: readonly SkipPreset[] = [
  { id: 'best', label: 'The best throw', expect: 'planed', throw: { stone: 'slate', speedMs: 12, flightAngleDeg: 12, tiltDeg: 10, spinRps: 35, releaseHeightM: 0.3 } },
  { id: 'steep', label: 'Too steep', expect: 'steep', throw: { stone: 'slate', speedMs: 12, flightAngleDeg: 50, tiltDeg: 10, spinRps: 35, releaseHeightM: 1.0 } },
  { id: 'nospin', label: 'No spin', expect: 'tumbled', throw: { stone: 'slate', speedMs: 12, flightAngleDeg: 12, tiltDeg: 10, spinRps: 0, releaseHeightM: 0.3 } },
  { id: 'slow', label: 'Too slow', expect: 'slow', throw: { stone: 'slate', speedMs: 2, flightAngleDeg: 21, tiltDeg: 10, spinRps: 35, releaseHeightM: 0.03 } },
  { id: 'pebble', label: 'A round pebble', expect: 'round', throw: { stone: 'pebble', speedMs: 12, flightAngleDeg: 15, tiltDeg: 10, spinRps: 35, releaseHeightM: 0.5 } },
  { id: 'pumice', label: 'Pumice (floats)', expect: 'floated', throw: { stone: 'pumice', speedMs: 8, flightAngleDeg: 12, tiltDeg: 20, spinRps: 20, releaseHeightM: 0.2 } },
];

/* ------------------------------------------------------------------ */
/* The rings a touch leaves (Cauchy-Poisson, with surface tension)     */
/* ------------------------------------------------------------------ */

/** Surface tension of clean water at 20 C, N/m. */
export const SKIP_SURFACE_TENSION = 0.0728;
/** Kinematic viscosity of water at 20 C, m^2/s. */
export const SKIP_WATER_NU = 1.0e-6;

/** Capillary-gravity dispersion: omega^2 = g k + (sigma / rho) k^3, deep water. */
export function skipRingOmega(k: number): number {
  return Math.sqrt(GRAVITY_MS2 * k + (SKIP_SURFACE_TENSION / SKIP_WATER_DENSITY) * k * k * k);
}

/** Bessel J1, Abramowitz and Stegun 9.4.4 and 9.4.6 (error under 1e-7). */
export function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3) {
    const y = (x / 3) * (x / 3);
    return x * (0.5 + y * (-0.56249985 + y * (0.21093573 + y * (-0.03954289 + y * (0.00443319 + y * (-0.00031761 + y * 0.00001109))))));
  }
  const y = 3 / ax;
  const f1 = 0.79788456 + y * (0.00000156 + y * (0.01659667 + y * (0.00017105 + y * (-0.00249511 + y * (0.00113653 - y * 0.00020033)))));
  const t1 = ax - 2.35619449 + y * (0.12499612 + y * (0.0000565 + y * (-0.00637879 + y * (0.00074348 + y * (0.00079824 - y * 0.00029166)))));
  const v = (f1 * Math.cos(t1)) / Math.sqrt(ax);
  return x < 0 ? -v : v;
}

export interface SkipRingTable {
  /** Radial slope of the surface per cubic meter of water pushed, row t, column r. */
  readonly slope: Float32Array;
  readonly nr: number;
  readonly nt: number;
  readonly rMaxM: number;
  readonly tMaxS: number;
  /** The largest |slope| in the table, for a normalized texture. */
  readonly maxAbs: number;
  /** The footprint sigma the table was built for, meters. */
  readonly sigmaM: number;
}

/**
 * THE RINGS OF A TOUCH (Cauchy and Poisson; Lamb, Hydrodynamics, sec. 255).
 * A touch leaves a hollow where the stone pushed water aside; let go, the
 * hollow radiates rings. Linear theory for an initial Gaussian hollow of
 * volume V and radius sigma on deep water gives the height
 *
 *   eta(r, t) = -(V / 2 pi) INT e^{-k^2 sigma^2 / 4} J0(k r) cos(w t) e^{-2 nu k^2 t} k dk
 *
 * and its radial slope, which is what the eye reads in a reflection,
 *
 *   d eta / dr = (V / 2 pi) INT e^{-k^2 sigma^2 / 4} k^2 J1(k r) cos(w t) e^{-2 nu k^2 t} dk,
 *
 * with the capillary-gravity dispersion w(k) (`skipRingOmega`) and the
 * viscous decay 2 nu k^2 (Lamb sec. 348). Long waves outrun short ones, so
 * the rings spread with the longest outside; surface tension makes the
 * shortest ripples fast again, so fine capillary rings run ahead of the
 * slowest group, the 17.7 cm/s minimum at 4.4 cm. This builds the slope per
 * cubic meter on an (r, t) grid: the integral is a matrix product, the time
 * factors (nt x nk) against J1 (nk x nr).
 *
 * The step dk resolves J1(k r) to rMaxM (its period in k is 2 pi / r), and
 * the top k is where the footprint factor falls under 1e-4.
 */
export function skipRingTable(opts: { sigmaM?: number; rMaxM?: number; tMaxS?: number; nr?: number; nt?: number } = {}): SkipRingTable {
  const sigma = opts.sigmaM ?? 0.03;
  const rMax = opts.rMaxM ?? 3;
  const tMax = opts.tMaxS ?? 6;
  const nr = opts.nr ?? 384;
  const nt = opts.nt ?? 192;
  const kTop = Math.sqrt(4 * Math.log(1e4)) / sigma;
  const dk = (2 * Math.PI) / rMax / 8;
  const nk = Math.ceil(kTop / dk);
  const ak = new Float64Array(nk);
  const wk = new Float64Array(nk);
  const vk = new Float64Array(nk);
  for (let i = 0; i < nk; i += 1) {
    const k = (i + 0.5) * dk;
    ak[i] = (Math.exp(-(k * k * sigma * sigma) / 4) * k * k * dk) / (2 * Math.PI);
    wk[i] = skipRingOmega(k);
    vk[i] = 2 * SKIP_WATER_NU * k * k;
  }
  const j1 = new Float64Array(nk * nr);
  for (let i = 0; i < nk; i += 1) {
    const k = (i + 0.5) * dk;
    for (let c = 0; c < nr; c += 1) j1[i * nr + c] = besselJ1(k * ((c + 0.5) * rMax) / nr);
  }
  const slope = new Float32Array(nt * nr);
  const row = new Float64Array(nr);
  let maxAbs = 0;
  for (let ti = 0; ti < nt; ti += 1) {
    const t = (ti * tMax) / (nt - 1);
    row.fill(0);
    for (let i = 0; i < nk; i += 1) {
      const a = ak[i] * Math.cos(wk[i] * t) * Math.exp(-vk[i] * t);
      const o = i * nr;
      for (let c = 0; c < nr; c += 1) row[c] += a * j1[o + c];
    }
    for (let c = 0; c < nr; c += 1) {
      slope[ti * nr + c] = row[c];
      if (Math.abs(row[c]) > maxAbs) maxAbs = Math.abs(row[c]);
    }
  }
  return { slope, nr, nt, rMaxM: rMax, tMaxS: tMax, maxAbs, sigmaM: sigma };
}
