/**
 * @file oceanBuoyancy.ts — a floating rigid body on the FFT sea, on the CPU.
 *
 * WHAT THIS IS
 *
 * The sea in `oceanField.ts` is a pure function of (seed, time). A buoy is
 * not: it carries velocity and orientation from one step to the next. This
 * module is that state, the one function that advances it, and the water
 * kinematics the step needs (the water's velocity and acceleration at each
 * probe's own depth). It has no GPU code and no three.js scene objects, so
 * vitest can prove it.
 *
 * THE MODEL: PROBES, NOT A HULL MESH
 *
 * Exact buoyancy needs the volume of the hull under a curved, moving water
 * surface. Water Pro does what every real-time ocean does instead: it stands
 * a handful of "buoyancy probes" on the hull, each a small sphere, and sums
 * the force on each. A sphere has a closed-form submerged volume, so the
 * force is smooth in the depth, and a dozen spheres placed through the hull
 * volume reproduce the heave, pitch and roll of the whole hull to well within
 * what the eye can judge. The number of probes is the accuracy dial.
 *
 * A probe cloud spread across the waterplane also gives the righting moment
 * for free. Tilt the body and the probes on the low side sink deeper, so the
 * force centroid moves to the low side and the torque rights it. That is the
 * metacentric effect, and it needs no extra term.
 *
 * WHAT MOVES THE BODY (round 4, 2026-09-24)
 *
 *   gravity           m g down, at the center of mass.
 *   pressure          rho V_sub G at each probe, where V_sub is the
 *                     spherical cap under the water surface sampled above
 *                     the probe and G = (a_x, g + a_y, a_z) is the water's
 *                     own pressure gradient per unit mass AT THAT PROBE'S
 *                     DEPTH: a water parcel there accelerates at a because
 *                     -grad p / rho - g = a. This is the Froude-Krylov force.
 *                     On still water G is (0, g, 0) and it is Archimedes.
 *   added mass        C_a rho V_sub (a_w - a_probe) at each probe: the water
 *                     a moving hull must push aside. It adds C_a rho V_sub to
 *                     the body's inertia and C_a rho V_sub a_w to its
 *                     forcing, so the water's acceleration drives the body
 *                     with Morison's inertia coefficient 1 + C_a. The full
 *                     6 x 6 mass matrix is solved every step, because the
 *                     added mass sits in the hull, above the center of mass:
 *                     a push at the waterline tips the body as well as
 *                     moving it.
 *   drag              -c f (v - w) per probe, where f is the probe's share
 *                     of the displaced volume, v its own velocity and w the
 *                     WATER's velocity at the probe's depth. Heave and surge
 *                     have separate coefficients because a wide float resists
 *                     vertical motion far more than horizontal motion. Heave
 *                     also has a FORM drag, -c2 f |v - w| (v - w), Morison's
 *                     quadratic term, which grows with the relative speed.
 *   angular damping   -c_ang omega: what the per-probe drag does not supply.
 *   mooring           a slack line to an anchor: no force inside the slack
 *                     radius, a stiff spring past it.
 *
 * WHY THE DEPTH MATTERS: THE BUOY IS NOT A WATER PARCEL
 *
 * Round 3 applied the SURFACE's acceleration to every probe, along the
 * fitted surface normal. That makes the body a parcel of surface water: with
 * rho V = m, the force at every instant is exactly the force that
 * accelerates it with the surface, at every wavelength. Measured on the
 * choppy sea, the heave followed the surface with a correlation of 0.991 and
 * the waterline stood within 5 cm of the design line on a 37 cm sea. Both
 * round-3 critics saw the result: the same band of hull above the water in
 * every frame, no water climbing the hull, the wash riding along with it.
 *
 * Linear wave theory says the pressure field of a wave of wavenumber k dies
 * as e^{-k d} with depth d. The hull reaches a meter down and the
 * counterweight three and a half. So the deep part of the body feels only
 * part of the wave that drives the waterline, the short waves drive the hull
 * much less than they move the surface, and the body answers them with its
 * own heave resonance. This is the Smith effect of naval architecture, and it
 * is what makes a real buoy's freeboard change as the waves pass. It also
 * holds the counterweight in slower water, so the water streams past the
 * hull instead of carrying it: the relative flow that makes the wash.
 *
 * The step itself does not know about depth: the caller gives it the water's
 * velocity and acceleration at each probe. `probeWaterAtDepth` builds them
 * from the sampled SURFACE kinematics of each FFT band, scaled by that
 * band's measured decay with depth (`bandDepthDecay`). The check that this
 * is right is a test: on a monochromatic wave the body's heave matches the
 * closed-form response of a floating body to e^{-k d} forcing.
 *
 * DETERMINISM AND STABILITY
 *
 * `stepFloatingBody` takes a FIXED dt and the water for that step.
 * Semi-implicit Euler is stable while omega_n * dt < 2; the stiffest body
 * this module drives (a 100 kg sphere buoy, omega_n about 10 rad/s) at
 * dt = 1/60 s sits at 0.17. The added mass is solved implicitly, so a
 * large added mass cannot make the step unstable. The caller owns the fixed
 * clock: it advances the sea to each step's time and samples the water
 * there, so the body's state after N steps from a pinned start is the same
 * on every run.
 *
 * UNITS. Everything in this file is METRIC: meters, kilograms, seconds. It
 * sits inside the ocean module's metric boundary (`oceanUnits.ts`), and its
 * only public output a game system would read — a body's world position —
 * crosses that boundary through the caller, in feet, as the sea's own heights
 * do.
 */
import { Quaternion, Vector3 } from 'three';
import { GRAVITY_MS2, type CascadeParams } from './oceanConfig';
import { directionalSpectrum, dispersionOmega } from './oceanSpectrum';

/** Sea water density, kg/m^3. Salt water; fresh water is 1000. */
export const SEA_WATER_DENSITY_KGM3 = 1025;

/**
 * Potential-flow added-mass coefficient of a sphere: it drags along half the
 * water it displaces. The probes are spheres, so this is their value unless
 * a body states another.
 */
export const SPHERE_ADDED_MASS_COEFFICIENT = 0.5;

/**
 * The largest water acceleration a step accepts, as a fraction of g, on each
 * axis. A sampled sea never reaches it (the choppy sea's surface peaks near
 * 0.4 g in its steepest ripple, and a probe's depth cuts that), so it only
 * stops a bad sample from throwing the body.
 */
const MAX_WATER_ACCEL_G = 0.75;
/**
 * The largest water velocity a step accepts on each axis, m/s. Water
 * parcels move at a fraction of the phase speed; the storm sea's 60 m peak
 * travels at 9.7 m/s and its steepest parcels at about half that. A
 * readback that jumps (a sea rebuilt under a running viewer by a hot
 * module reload, measured once in round 4) differences into tens of meters
 * a second, and the drag against it threw the light buoy 100 m into the
 * air. This bound stops that and never touches a real sea.
 */
const MAX_WATER_SPEED_MS = 6;
const clampSpeed = (v: number) => Math.min(Math.max(v, -MAX_WATER_SPEED_MS), MAX_WATER_SPEED_MS);

/**
 * One buoyancy probe: a sphere fixed in the body frame.
 *
 * The frame's origin is the body's CENTER OF MASS, +Y up, so the physics has
 * no offset to carry. A model designed with its waterline at y = 0 converts
 * its probes by subtracting the center of mass; `oceanBuoyModel.ts` does that.
 */
export interface BuoyancyProbe {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Sphere radius, meters. Its volume is what the probe displaces. */
  readonly radiusM: number;
}

/** A floating body's fixed properties. */
export interface FloatingBodySpec {
  readonly name: string;
  readonly massKg: number;
  /** Principal moments of inertia about the body axes, kg m^2. */
  readonly inertiaKgM2: readonly [number, number, number];
  readonly probes: readonly BuoyancyProbe[];
  /** Total heave drag coefficient at full submersion, N s/m. */
  readonly heaveDragNsPerM: number;
  /**
   * Heave FORM drag at full submersion, N s^2/m^2: 1/2 rho C_d A of the
   * hull's bottom and ballast moving vertically through the water, so the
   * force is this times |v| v of the probe's heave relative to the water.
   * Morison's drag term. It is small at small motions and grows with the
   * square of the speed, so it holds down the large relative heaves of a
   * resonance without damping the ordinary ones. 0 or absent: none.
   */
  readonly heaveFormDragNs2PerM2?: number;
  /** Total surge/sway drag coefficient at full submersion, N s/m. */
  readonly surgeDragNsPerM: number;
  /** Angular damping, N m s. */
  readonly angularDragNms: number;
  /**
   * Added-mass coefficient of each probe, a fraction of the water the probe
   * displaces. `SPHERE_ADDED_MASS_COEFFICIENT` for spheres; 0 gives a body
   * that pushes no water aside, the round-3 model.
   */
  readonly addedMassCoefficient: number;
  /**
   * The mooring, or null for a free body. The line runs from `attachBody`
   * (body frame) to the anchor on the sea floor, of which only the horizontal
   * position matters at this scale.
   */
  readonly mooring: {
    readonly anchorX: number;
    readonly anchorZ: number;
    readonly attachBody: Vector3;
    /** Horizontal excursion the line allows before it pulls, meters. */
    readonly slackM: number;
    readonly stiffnessNPerM: number;
  } | null;
}

/** A floating body's state. Mutated in place by `stepFloatingBody`. */
export interface FloatingBodyState {
  /** Center of mass, world meters. */
  readonly position: Vector3;
  /** Body-to-world rotation. */
  readonly orientation: Quaternion;
  /** Center-of-mass velocity, world m/s. */
  readonly velocity: Vector3;
  /** Angular velocity, WORLD frame, rad/s. */
  readonly angularVelocity: Vector3;
}

/**
 * The water at a body's probes for one step.
 *
 * `velocity` and `acceleration` are the water's AT EACH PROBE'S OWN DEPTH,
 * three per probe (x, y, z) in probe order, world frame. `probeWaterAtDepth`
 * makes them from the sea's surface kinematics. Null means still water: no
 * flow for the drag to act against, and a pressure gradient of plain g.
 */
export interface ProbeWater {
  /** The surface height above each probe's CURRENT world XZ, meters. */
  readonly surfaceY: ArrayLike<number>;
  readonly velocity: ArrayLike<number> | null;
  readonly acceleration: ArrayLike<number> | null;
  /**
   * ROUND 14: one more force on the body this step, world newtons, acting at
   * a world point: what the probe model cannot give (the buoy mount uses it
   * for a breaking crest's push on the up-wave face, which the FFT's linear
   * parcels never carry). It enters the step with the other forces, so the
   * 6 x 6 mass matrix sees it and the torque about the center of mass
   * follows from its point. Absent or null: the step is as before, to the
   * bit.
   */
  readonly external?: ExternalForce | null;
}

/** A force at a world point, for `ProbeWater.external`. */
export interface ExternalForce {
  readonly fx: number;
  readonly fy: number;
  readonly fz: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function createFloatingBodyState(): FloatingBodyState {
  return {
    position: new Vector3(),
    orientation: new Quaternion(),
    velocity: new Vector3(),
    angularVelocity: new Vector3(),
  };
}

/** Copy `from` into `to`. For snapshots and resets. */
export function copyFloatingBodyState(to: FloatingBodyState, from: FloatingBodyState): void {
  to.position.copy(from.position);
  to.orientation.copy(from.orientation);
  to.velocity.copy(from.velocity);
  to.angularVelocity.copy(from.angularVelocity);
}

/**
 * Volume of a sphere of radius r under a plane `depth` meters above its
 * center. Negative depth means the center is above the plane.
 *
 * The spherical cap: with submerged height s in [0, 2r],
 *   V = pi s^2 (3r - s) / 3.
 * Smooth in s, which is what keeps the force smooth as a probe crosses the
 * surface. A linear ramp would put a kink in the heave at every crossing.
 */
export function submergedSphereVolume(radiusM: number, depthM: number): number {
  const s = Math.min(Math.max(depthM + radiusM, 0), 2 * radiusM);
  return (Math.PI * s * s * (3 * radiusM - s)) / 3;
}

/** Full volume of a probe sphere, m^3. */
export function probeVolume(p: BuoyancyProbe): number {
  return (4 / 3) * Math.PI * p.radiusM ** 3;
}

/**
 * The mass that floats a body with its design waterline exactly on flat
 * water. The model chooses probes and a draft; the mass follows, so the
 * painted waterline is the physical one.
 *
 * @param probes in a frame whose y = 0 is the design waterline, level.
 */
export function massForWaterline(
  probes: readonly BuoyancyProbe[],
  densityKgM3 = SEA_WATER_DENSITY_KGM3,
): number {
  let v = 0;
  for (const p of probes) v += submergedSphereVolume(p.radiusM, -p.y);
  return v * densityKgM3;
}

/** A body's hydrostatics at its design draft, from its probes. */
export interface ProbeHydrostatics {
  /** Displaced volume, m^3. */
  readonly volumeM3: number;
  /** Center of buoyancy, design-frame y, meters (the probes' centers, weighted by volume). */
  readonly centerOfBuoyancyY: number;
  /** Waterplane area, m^2: d(V_sub)/d(depth), the heave spring over rho g. */
  readonly waterplaneAreaM2: number;
  /**
   * Waterplane second moment about the body's x axis, m^4: what the probes'
   * waterplane circles add to the pitch spring (rho g I is the metacentric
   * part of it).
   */
  readonly waterplaneIxxM4: number;
}

/**
 * The hydrostatics a probe body presents level at its design draft, the
 * numbers a naval architect would compute first: displaced volume, center
 * of buoyancy, waterplane area and its second moment. For deriving a body's
 * damping as a fraction of its critical value, so the damping follows the
 * hull when the hull changes.
 *
 * @param probes in a frame whose y = 0 is the design waterline, level.
 */
export function probeHydrostatics(probes: readonly BuoyancyProbe[]): ProbeHydrostatics {
  let v = 0;
  let vy = 0;
  let area = 0;
  let ixx = 0;
  for (const p of probes) {
    const sub = submergedSphereVolume(p.radiusM, -p.y);
    v += sub;
    vy += sub * p.y;
    if (Math.abs(p.y) < p.radiusM) {
      // The waterline cuts this sphere in a circle of radius a.
      const a2 = p.radiusM * p.radiusM - p.y * p.y;
      const circle = Math.PI * a2;
      area += circle;
      ixx += circle * p.z * p.z + (Math.PI * a2 * a2) / 4;
    }
  }
  return { volumeM3: v, centerOfBuoyancyY: v > 0 ? vy / v : 0, waterplaneAreaM2: area, waterplaneIxxM4: ixx };
}

/**
 * Where the surface is above a world point, on a CHOPPY sea.
 *
 * The FFT gives the displacement of grid point G: it moves to
 * G + (dispX, dispZ) and rises to `height`. The point on the surface above
 * world XZ = P is therefore the G that satisfies G + D(G).xz = P, and the
 * height there is D(G).y. Choppiness moves crests sideways by up to a meter
 * or two, so reading D(P) directly puts the buoy on the wrong slope and the
 * waterline visibly off the hull.
 *
 * The fixed-point iteration G <- P - D(G).xz converges where the horizontal
 * displacement gradient is under 1, which is exactly the non-folding
 * condition the surface itself needs. On the shipped sea (Jacobian floor
 * about 0.38 at the steepest whitecap) four iterations bring the horizontal
 * residual under a centimeter; the test suite measures that on a synthetic
 * Gerstner sea and the GPU kernel in `oceanBuoyancyProbe.ts` runs the same
 * loop, unrolled, with the same count.
 *
 * @param sample writes (dispX, height, dispZ) of grid point (gx, gz) into
 *               `out`, in that order.
 * @returns the surface height above (px, pz), and the grid point found.
 */
export function invertDisplacement(
  sample: (gx: number, gz: number, out: Float64Array) => void,
  px: number,
  pz: number,
  iterations = 4,
  out: Float64Array = new Float64Array(3),
): { heightM: number; gridX: number; gridZ: number; residualM: number } {
  let gx = px;
  let gz = pz;
  for (let i = 0; i < iterations; i += 1) {
    sample(gx, gz, out);
    gx = px - out[0];
    gz = pz - out[2];
  }
  sample(gx, gz, out);
  const residualM = Math.hypot(gx + out[0] - px, gz + out[2] - pz);
  return { heightM: out[1], gridX: gx, gridZ: gz, residualM };
}

/* ------------------------------------------------------------------ */
/* The water at depth                                                  */
/* ------------------------------------------------------------------ */

/**
 * How one FFT band's water motion dies with depth: the ratio of its RMS
 * velocity (and acceleration) at depth d to its RMS at the surface, on a
 * uniform depth grid.
 *
 * Each wave component of wavenumber k moves the water at depth d with
 * e^{-k d} of its surface motion (deep water, linear theory). A band holds
 * many k, so its RMS at depth is sqrt(sum S_j e^{-2 k_j d} / sum S_j), where
 * S_j is the component's velocity variance (omega^2 Psi) or acceleration
 * variance (omega^4 Psi). That is exact for the variance at every depth, and
 * it is what `probeWaterAtDepth` scales the band's sampled surface motion by.
 * It is not exact for the waveform (at depth the band's short end is gone,
 * so the motion is smoother than a scaled copy of the surface); on the
 * choppy sea's chop band the single-wavenumber decay e^{-k_mean d} with the
 * velocity-weighted mean k sits within 0.03 of this RMS decay down to 1 m,
 * so the two readings agree where the hull is.
 *
 * Measured on the choppy sea (`bandStats.ts` in the gauntlet scratch):
 *   ripple (0.1-6.5 m)  velocity 0.54 at 0.3 m, 0.20 at 1 m, 0.02 at 3 m
 *   chop   (6.5-30 m)   velocity 0.87 at 0.3 m, 0.65 at 1 m, 0.33 at 3 m
 *   sea    (30-421 m)   velocity 0.96 at 0.3 m, 0.87 at 1 m, 0.65 at 3 m
 */
export interface BandDepthDecay {
  readonly name: string;
  /** Depth step of the tables, meters. Index i is depth i * stepM. */
  readonly stepM: number;
  readonly velocity: Float64Array;
  readonly acceleration: Float64Array;
  /** The band's velocity-weighted mean wavenumber, rad/m. For the record. */
  readonly meanK: number;
  /**
   * The band's horizontal choppiness. The FFT moves a parcel sideways by
   * this factor times a linear wave's orbit (1.5 on the choppy sea's chop
   * band); `probeWaterAtDepth` divides it out of the horizontal velocity.
   */
  readonly choppiness: number;
}

/**
 * Build a band's depth-decay tables from its spectrum, by integrating
 * `directionalSpectrum` — the same spectrum the FFT realizes — over the
 * band on a polar grid.
 *
 * @param gridN the FFT grid edge. It sets the shortest wave the band can
 *              hold (two texels), which bounds the integral.
 */
export function bandDepthDecay(
  params: CascadeParams,
  gridN: number,
  maxDepthM = 8,
  stepM = 0.05,
): BandDepthDecay {
  const kMin = Math.max(2 * Math.PI / params.patchM, params.cutoffHighM > 0 ? 2 * Math.PI / params.cutoffHighM : 0);
  const kNyquist = (Math.PI * gridN) / params.patchM;
  const kMax = Math.min(kNyquist, params.cutoffLowM > 0 ? 2 * Math.PI / params.cutoffLowM : kNyquist);
  const depths = Math.floor(maxDepthM / stepM) + 1;
  const velocity = new Float64Array(depths);
  const acceleration = new Float64Array(depths);
  // 240 log-spaced wavenumbers and 72 directions: the tables change by
  // under 1e-3 against 480 x 144.
  const NK = 240;
  const NT = 72;
  const lk0 = Math.log(kMin);
  const dlk = (Math.log(kMax) - lk0) / NK;
  const dTheta = (2 * Math.PI) / NT;
  let sumKv = 0;
  let sumV = 0;
  for (let i = 0; i < NK; i += 1) {
    const k = Math.exp(lk0 + (i + 0.5) * dlk);
    const dk = k * dlk;
    const omega = dispersionOmega(k, params.depthM);
    let psiRing = 0;
    for (let j = 0; j < NT; j += 1) {
      const t = (j + 0.5) * dTheta;
      psiRing += directionalSpectrum(k * Math.cos(t), k * Math.sin(t), params);
    }
    const variance = psiRing * k * dk * dTheta;
    if (!(variance > 0)) continue;
    const wv = omega * omega * variance;
    const wa = wv * omega * omega;
    sumKv += k * wv;
    sumV += wv;
    for (let d = 0; d < depths; d += 1) {
      const e = Math.exp(-2 * k * d * stepM);
      velocity[d] += wv * e;
      acceleration[d] += wa * e;
    }
  }
  if (!(velocity[0] > 0)) {
    throw new Error(
      `[ocean] Band "${params.name}" carries no energy between ${(2 * Math.PI / kMax).toFixed(2)} m `
      + `and ${(2 * Math.PI / kMin).toFixed(1)} m, so its motion at depth is undefined. Check its `
      + 'cutoffs against its patch and spectrum.',
    );
  }
  const v0 = velocity[0];
  const a0 = acceleration[0];
  for (let d = 0; d < depths; d += 1) {
    velocity[d] = Math.sqrt(velocity[d] / v0);
    acceleration[d] = Math.sqrt(acceleration[d] / a0);
  }
  return {
    name: params.name, stepM, velocity, acceleration, meanK: sumKv / sumV,
    // A band with no horizontal displacement has the linear orbit's
    // horizontal motion missing, not scaled; 1 keeps the division harmless.
    choppiness: params.choppiness > 0 ? params.choppiness : 1,
  };
}

/**
 * Read a decay table at a depth: 1 at or above the surface (depth <= 0; the
 * kinematics above the mean level are the surface's, the usual Wheeler
 * stretching), linear between entries, the last entry past the end.
 */
export function depthDecayAt(table: Float64Array, stepM: number, depthM: number): number {
  if (!(depthM > 0)) return 1;
  const x = depthM / stepM;
  const i = Math.floor(x);
  if (i >= table.length - 1) return table[table.length - 1];
  const f = x - i;
  return table[i] * (1 - f) + table[i + 1] * f;
}

/**
 * The water's motion at a body's probes, band by band, estimated from
 * successive surface samples.
 *
 * WHAT A SAMPLE CARRIES. For each probe and band, the band's displacement
 * (dispX, height, dispZ) at THREE grid points: the one under the probe now
 * (the inversion's result), the one the previous sample found, and the one
 * the sample before that found. A grid point is a water parcel, so each
 * parcel is seen at three sea times and its motion is differenced exactly
 * (Lagrangian differences):
 *
 *   velocity      of the previous parcel, (D(t_n) - D(t_n-1)) / dt,
 *                 centered half a step back;
 *   acceleration  of the parcel before, the second difference over its
 *                 last three samples, centered one step back.
 *
 * Differencing at the moving probe instead (round 3) mixed the surface's
 * slope times the body's drift into the velocity, about 0.1 m/s on the
 * choppy sea, the size of the relative flow the wash depends on. Differencing
 * the velocities of two neighboring parcels for the acceleration divides that
 * parcel shift by dt again: a unit test measured 0.07 m/s^2 of error at a
 * 1 cm drift per step, and the ripple band's steep gradients make it several
 * times that. With three samples of one parcel the error is the half- and
 * one-step lag alone, a phase error of omega dt (under 0.1 rad at the ripple
 * band's 1.5 m waves).
 *
 * Layout of `now`, `prev` and `prev2`: index ((probe * bands) + band) * 4 +
 * axis, axis 0..2 = (dispX, height, dispZ). `oceanBuoyancyProbe.ts` writes
 * exactly this layout.
 */
export interface BandKinematics {
  readonly probes: number;
  readonly bands: number;
  /** Surface parcel velocity per (probe, band), 3 per entry, m/s. */
  readonly velocity: Float64Array;
  /** Surface parcel acceleration per (probe, band), 3 per entry, m/s^2. */
  readonly acceleration: Float64Array;
  /** Each band's surface height above the probe at the last sample, per (probe, band), m. */
  readonly height: Float64Array;
  /**
   * Accept one sample taken at `seaTime`: the displacement at the grid
   * point found now, at the previous sample's grid point, and at the one
   * before that.
   *
   * A sample at the same sea time as the last one (a continued pinned run
   * re-samples where it stopped, and a pinned run's start re-samples after
   * setting the bodies down) measures no motion. It keeps the velocity, the
   * acceleration and the older history, and replaces only the newest base
   * with the grid point found now: that is the parcel the caller will name
   * as "previous" next time. The caller must, in the same way, replace its
   * newest grid point and not shift its history. Then a run continued in
   * pieces matches the same run made at once.
   */
  update(
    now: ArrayLike<number>, nowOffset: number,
    prev: ArrayLike<number>, prevOffset: number,
    prev2: ArrayLike<number>, prev2Offset: number,
    seaTime: number,
  ): void;
  /** Forget all motion: the next sample only sets the difference base. */
  reset(): void;
  /** The surface's vertical velocity at a probe: the sum over bands. */
  surfaceRateY(probe: number): number;
}

export function createBandKinematics(probes: number, bands: number): BandKinematics {
  const n = probes * bands;
  const velocity = new Float64Array(n * 3);
  const acceleration = new Float64Array(n * 3);
  const height = new Float64Array(n);
  /** D(G_n-1, t_n-1): the last sample's `now`. */
  const base1 = new Float64Array(n * 3);
  /** D(G_n-2, t_n-2): the `now` of the sample before the last. */
  const base2a = new Float64Array(n * 3);
  /** D(G_n-2, t_n-1): the last sample's `prev`. */
  const base2b = new Float64Array(n * 3);
  let lastTime = Number.NaN;
  /** Sea time between the last two distinct samples. */
  let lastDt = 0;
  /** Distinct-time samples since the reset: 1 allows a velocity, 2 an acceleration. */
  let history = 0;
  return {
    probes,
    bands,
    velocity,
    acceleration,
    height,
    update(now, nowOffset, prev, prevOffset, prev2, prev2Offset, seaTime) {
      for (let e = 0; e < n; e += 1) height[e] = now[nowOffset + e * 4 + 1];
      const dt = seaTime - lastTime;
      if (Number.isFinite(dt) && Math.abs(dt) <= 1e-9) {
        for (let e = 0; e < n; e += 1) {
          for (let k = 0; k < 3; k += 1) base1[e * 3 + k] = now[nowOffset + e * 4 + k];
        }
        return;
      }
      if (!(dt > 1e-9)) {
        // The first sample, or time ran backward: start the history over.
        history = 0;
        velocity.fill(0);
        acceleration.fill(0);
      }
      for (let e = 0; e < n; e += 1) {
        for (let k = 0; k < 3; k += 1) {
          const j = e * 3 + k;
          const src = e * 4 + k;
          const p1 = prev[prevOffset + src];
          const p2 = prev2[prev2Offset + src];
          if (history >= 1) velocity[j] = (p1 - base1[j]) / dt;
          if (history >= 2) {
            const vLate = (p2 - base2b[j]) / dt;
            const vEarly = (base2b[j] - base2a[j]) / lastDt;
            acceleration[j] = (vLate - vEarly) / (0.5 * (dt + lastDt));
          }
          base2a[j] = base1[j];
          base2b[j] = p1;
          base1[j] = now[nowOffset + src];
        }
      }
      if (dt > 1e-9) lastDt = dt;
      history = Math.min(history + 1, 2);
      lastTime = seaTime;
    },
    reset() {
      velocity.fill(0);
      acceleration.fill(0);
      height.fill(0);
      base1.fill(0);
      base2a.fill(0);
      base2b.fill(0);
      lastTime = Number.NaN;
      lastDt = 0;
      history = 0;
    },
    surfaceRateY(probe) {
      let s = 0;
      for (let b = 0; b < bands; b += 1) s += velocity[(probe * bands + b) * 3 + 1];
      return s;
    },
  };
}

const tmpDepthR = new Vector3();

/** Scratch for the per-band plane fits: 2 slopes per band. */
let bandSlopes = new Float64Array(0);

/**
 * The water's velocity and acceleration at each probe's own depth: each
 * band's surface motion at the probe, scaled by that band's decay at the
 * probe's depth below the surface above it, summed over bands.
 *
 * VERTICAL: each band's parcel velocity and acceleration at the probe, as
 * sampled.
 *
 * HORIZONTAL ACCELERATION: -g times the band's surface slope, fitted as a
 * plane through the band's heights over all the body's probes. That is the
 * horizontal pressure gradient of a linear wave, -g grad eta (the free
 * surface is a surface of constant pressure), taken at the hull's scale.
 * The parcels' own horizontal acceleration is NOT used, for two measured
 * reasons. The FFT's choppiness moves parcels sideways 1.5 times a linear
 * orbit on the chop band (`kinematicConsistency` in the mount: regression of
 * parcel acceleration on -g slope = the band's choppiness, correlation
 * 0.9999), so it would lean the body to 1.5 times the slope. And at a
 * sharpened crest the parcels under neighboring probes accelerate in
 * different directions, and a pointwise push at each probe capsized the
 * navigation buoy on the choppy sea within a second of a steep crest
 * (tilt 16 to 55 degrees, pinned run, 41 to 42 s). The plane fit spans the
 * hull, so a ripple shorter than the hull averages out, as its pressure
 * does on a real hull.
 *
 * HORIZONTAL VELOCITY: each band's parcel velocity divided by the band's
 * choppiness, the linear orbit that the pressure field above drives.
 *
 * @param surfaceY the surface height above each probe, meters.
 * @param outVel, outAcc three per probe, written.
 */
export function probeWaterAtDepth(
  spec: FloatingBodySpec,
  state: FloatingBodyState,
  surfaceY: ArrayLike<number>,
  kin: BandKinematics,
  decays: readonly BandDepthDecay[],
  outVel: Float64Array,
  outAcc: Float64Array,
): void {
  const probes = spec.probes;
  const nb = decays.length;
  if (kin.probes !== probes.length || kin.bands !== nb) {
    throw new Error(
      `[ocean] ${spec.name}: kinematics for ${kin.probes} probes x ${kin.bands} bands, `
      + `but the body has ${probes.length} probes and ${nb} band decay tables.`,
    );
  }
  if (bandSlopes.length < nb * 2) bandSlopes = new Float64Array(nb * 2);
  // The plane fits: least squares of h_b = a x + c z + d over the probes'
  // world XZ, in centered coordinates so the normal equations stay well
  // conditioned. One design matrix serves every band.
  let mx = 0;
  let mz = 0;
  for (let i = 0; i < probes.length; i += 1) {
    const p = probes[i];
    tmpDepthR.set(p.x, p.y, p.z).applyQuaternion(state.orientation);
    mx += tmpDepthR.x;
    mz += tmpDepthR.z;
  }
  mx /= probes.length;
  mz /= probes.length;
  let sxx = 0;
  let sxz = 0;
  let szz = 0;
  bandSlopes.fill(0);
  for (let i = 0; i < probes.length; i += 1) {
    const p = probes[i];
    tmpDepthR.set(p.x, p.y, p.z).applyQuaternion(state.orientation);
    const dx = tmpDepthR.x - mx;
    const dz = tmpDepthR.z - mz;
    sxx += dx * dx;
    sxz += dx * dz;
    szz += dz * dz;
    for (let b = 0; b < nb; b += 1) {
      const h = kin.height[i * nb + b];
      bandSlopes[b * 2] += dx * h;
      bandSlopes[b * 2 + 1] += dz * h;
    }
  }
  const det = sxx * szz - sxz * sxz;
  if (!(det > 1e-9)) {
    throw new Error(
      `[ocean] ${spec.name}: its probes lie on one vertical line or plane, so no `
      + 'surface slope can be fitted through them. A body needs three probes '
      + 'that are not collinear in XZ.',
    );
  }
  for (let b = 0; b < nb; b += 1) {
    const sxh = bandSlopes[b * 2];
    const szh = bandSlopes[b * 2 + 1];
    bandSlopes[b * 2] = (sxh * szz - szh * sxz) / det;
    bandSlopes[b * 2 + 1] = (szh * sxx - sxh * sxz) / det;
  }
  for (let i = 0; i < probes.length; i += 1) {
    const p = probes[i];
    tmpDepthR.set(p.x, p.y, p.z).applyQuaternion(state.orientation);
    const depth = surfaceY[i] - (state.position.y + tmpDepthR.y);
    let vx = 0; let vy = 0; let vz = 0;
    let ax = 0; let ay = 0; let az = 0;
    for (let b = 0; b < nb; b += 1) {
      const t = decays[b];
      const dv = depthDecayAt(t.velocity, t.stepM, depth);
      const da = depthDecayAt(t.acceleration, t.stepM, depth);
      const j = (i * nb + b) * 3;
      const hv = dv / t.choppiness;
      vx += kin.velocity[j] * hv;
      vy += kin.velocity[j + 1] * dv;
      vz += kin.velocity[j + 2] * hv;
      ax -= GRAVITY_MS2 * bandSlopes[b * 2] * da;
      ay += kin.acceleration[j + 1] * da;
      az -= GRAVITY_MS2 * bandSlopes[b * 2 + 1] * da;
    }
    outVel[i * 3] = vx; outVel[i * 3 + 1] = vy; outVel[i * 3 + 2] = vz;
    outAcc[i * 3] = ax; outAcc[i * 3 + 1] = ay; outAcc[i * 3 + 2] = az;
  }
}

/* ------------------------------------------------------------------ */
/* The step                                                            */
/* ------------------------------------------------------------------ */

/* Scratch. The step runs many times a frame for several bodies; it
 * allocates nothing. */
const tmpR = new Vector3();
const tmpP = new Vector3();
const tmpV = new Vector3();
const tmpF = new Vector3();
const tmpTau = new Vector3();
const tmpForce = new Vector3();
const tmpW = new Vector3();
const tmpC = new Vector3();
const tmpAw = new Vector3();
const tmpS = new Vector3();
const tmpLinAdd = new Vector3();
const tmpAngAdd = new Vector3();
const tmpQ = new Quaternion();
const tmpUp = new Vector3();
const tmpMoor = new Vector3();
/** Rotation matrix, row-major, of the body's orientation. */
const rot = new Float64Array(9);
/** J = sum A_i (|r|^2 1 - r r^T), row-major. */
const jAdd = new Float64Array(9);
/** The 6 x 6 system and its right side. */
const mat = new Float64Array(36);
const rhs = new Float64Array(6);

const clampAccel = (a: number) => Math.min(Math.max(a, -MAX_WATER_ACCEL_G * GRAVITY_MS2), MAX_WATER_ACCEL_G * GRAVITY_MS2);

/** Solve mat x = rhs in place (x in rhs), Gaussian elimination with partial pivoting. */
function solve6(): void {
  for (let c = 0; c < 6; c += 1) {
    let piv = c;
    let best = Math.abs(mat[c * 6 + c]);
    for (let r = c + 1; r < 6; r += 1) {
      const v = Math.abs(mat[r * 6 + c]);
      if (v > best) { best = v; piv = r; }
    }
    if (!(best > 1e-12)) {
      throw new Error('[ocean] The floating body mass matrix is singular. A body needs positive mass and inertia.');
    }
    if (piv !== c) {
      for (let k = 0; k < 6; k += 1) {
        const t = mat[c * 6 + k]; mat[c * 6 + k] = mat[piv * 6 + k]; mat[piv * 6 + k] = t;
      }
      const t = rhs[c]; rhs[c] = rhs[piv]; rhs[piv] = t;
    }
    const inv = 1 / mat[c * 6 + c];
    for (let r = c + 1; r < 6; r += 1) {
      const f = mat[r * 6 + c] * inv;
      if (f === 0) continue;
      for (let k = c; k < 6; k += 1) mat[r * 6 + k] -= f * mat[c * 6 + k];
      rhs[r] -= f * rhs[c];
    }
  }
  for (let r = 5; r >= 0; r -= 1) {
    let s = rhs[r];
    for (let k = r + 1; k < 6; k += 1) s -= mat[r * 6 + k] * rhs[k];
    rhs[r] = s / mat[r * 6 + r];
  }
}

/**
 * Advance one body by one fixed step.
 *
 * @param spec   the body.
 * @param state  mutated in place.
 * @param water  the surface height above each probe, and the water's
 *               velocity and acceleration at each probe's depth (see
 *               `ProbeWater`).
 * @param dtS    the fixed step, seconds.
 * @returns the fraction of the body's probe volume under water, 0..1. A
 *          caller uses it to know whether the body is afloat at all.
 */
export function stepFloatingBody(
  spec: FloatingBodySpec,
  state: FloatingBodyState,
  water: ProbeWater,
  dtS: number,
  densityKgM3 = SEA_WATER_DENSITY_KGM3,
): number {
  const { position, orientation, velocity, angularVelocity } = state;
  const probes = spec.probes;
  const { surfaceY } = water;
  const wVel = water.velocity;
  const wAcc = water.acceleration;
  if (surfaceY.length < probes.length) {
    throw new Error(
      `[ocean] ${spec.name}: ${probes.length} probes but ${surfaceY.length} surface `
      + 'heights. Every probe needs the surface above it.',
    );
  }
  if (wVel !== null && wVel.length < probes.length * 3) {
    throw new Error(
      `[ocean] ${spec.name}: ${probes.length} probes but ${wVel.length} water `
      + 'velocity components. Every probe needs three, or pass null.',
    );
  }
  if (wAcc !== null && wAcc.length < probes.length * 3) {
    throw new Error(
      `[ocean] ${spec.name}: ${probes.length} probes but ${wAcc.length} water `
      + 'acceleration components. Every probe needs three, or pass null.',
    );
  }

  // The body's rotation as a matrix, for the world inertia tensor.
  {
    const { x, y, z, w } = orientation;
    rot[0] = 1 - 2 * (y * y + z * z); rot[1] = 2 * (x * y - z * w); rot[2] = 2 * (x * z + y * w);
    rot[3] = 2 * (x * y + z * w); rot[4] = 1 - 2 * (x * x + z * z); rot[5] = 2 * (y * z - x * w);
    rot[6] = 2 * (x * z - y * w); rot[7] = 2 * (y * z + x * w); rot[8] = 1 - 2 * (x * x + y * y);
  }

  tmpForce.set(0, -spec.massKg * GRAVITY_MS2, 0);
  tmpTau.set(0, 0, 0);
  let addedMass = 0;
  tmpS.set(0, 0, 0);
  jAdd.fill(0);
  tmpLinAdd.set(0, 0, 0);
  tmpAngAdd.set(0, 0, 0);

  let totalVolume = 0;
  let submergedVolume = 0;
  for (const p of probes) totalVolume += probeVolume(p);
  const ca = spec.addedMassCoefficient;

  for (let i = 0; i < probes.length; i += 1) {
    const p = probes[i];
    // r: lever arm from the center of mass to the probe, world frame.
    tmpR.set(p.x, p.y, p.z).applyQuaternion(orientation);
    tmpP.copy(position).add(tmpR);

    const depth = surfaceY[i] - tmpP.y;
    const vSub = submergedSphereVolume(p.radiusM, depth);
    if (vSub <= 0) continue;
    submergedVolume += vSub;
    // This probe's share of the body's drag: its submerged volume over the
    // total, so a body's coefficient means the same thing whatever its
    // probe count.
    const share = vSub / totalVolume;

    // The water's acceleration at this probe, clamped against a bad sample.
    if (wAcc !== null) {
      tmpAw.set(clampAccel(wAcc[i * 3]), clampAccel(wAcc[i * 3 + 1]), clampAccel(wAcc[i * 3 + 2]));
    } else {
      tmpAw.set(0, 0, 0);
    }

    // Froude-Krylov: rho V_sub (a_w + g up). See the file header.
    tmpF.set(tmpAw.x, GRAVITY_MS2 + tmpAw.y, tmpAw.z).multiplyScalar(densityKgM3 * vSub);

    // Drag against the probe's velocity RELATIVE TO THE WATER at its depth:
    // (v + omega x r) - w.
    tmpV.copy(angularVelocity).cross(tmpR).add(velocity);
    if (wVel !== null) {
      tmpV.x -= clampSpeed(wVel[i * 3]);
      tmpV.y -= clampSpeed(wVel[i * 3 + 1]);
      tmpV.z -= clampSpeed(wVel[i * 3 + 2]);
    }
    tmpF.x -= spec.surgeDragNsPerM * share * tmpV.x;
    tmpF.y -= (spec.heaveDragNsPerM + (spec.heaveFormDragNs2PerM2 ?? 0) * Math.abs(tmpV.y)) * share * tmpV.y;
    tmpF.z -= spec.surgeDragNsPerM * share * tmpV.z;

    tmpForce.add(tmpF);
    tmpTau.add(tmpW.copy(tmpR).cross(tmpF));

    // Added mass: A_i (a_w - a_b - alpha x r - omega x (omega x r)). The
    // a_b and alpha parts go into the mass matrix; the rest is forcing.
    if (ca > 0) {
      const ai = ca * densityKgM3 * vSub;
      addedMass += ai;
      tmpS.addScaledVector(tmpR, ai);
      const rr = tmpR.lengthSq();
      jAdd[0] += ai * (rr - tmpR.x * tmpR.x);
      jAdd[1] -= ai * tmpR.x * tmpR.y;
      jAdd[2] -= ai * tmpR.x * tmpR.z;
      jAdd[4] += ai * (rr - tmpR.y * tmpR.y);
      jAdd[5] -= ai * tmpR.y * tmpR.z;
      jAdd[8] += ai * (rr - tmpR.z * tmpR.z);
      // Centripetal acceleration of the probe, omega x (omega x r).
      tmpC.copy(angularVelocity).cross(tmpR);
      tmpC.crossVectors(angularVelocity, tmpC);
      tmpW.copy(tmpAw).sub(tmpC).multiplyScalar(ai);
      tmpLinAdd.add(tmpW);
      tmpAngAdd.add(tmpC.copy(tmpR).cross(tmpW));
    }
  }
  jAdd[3] = jAdd[1];
  jAdd[6] = jAdd[2];
  jAdd[7] = jAdd[5];

  // The mooring: a slack line, then a spring, applied at its attachment so a
  // taut line also tips the body toward the anchor as a real one does.
  const moor = spec.mooring;
  if (moor) {
    tmpR.copy(moor.attachBody).applyQuaternion(orientation);
    tmpP.copy(position).add(tmpR);
    tmpMoor.set(moor.anchorX - tmpP.x, 0, moor.anchorZ - tmpP.z);
    const dist = tmpMoor.length();
    if (dist > moor.slackM) {
      const pull = moor.stiffnessNPerM * (dist - moor.slackM);
      tmpF.copy(tmpMoor).multiplyScalar(pull / dist);
      tmpForce.add(tmpF);
      tmpTau.add(tmpW.copy(tmpR).cross(tmpF));
    }
  }

  // Round 14: the external force (see `ProbeWater.external`).
  const ext = water.external;
  if (ext) {
    tmpF.set(ext.fx, ext.fy, ext.fz);
    tmpForce.add(tmpF);
    tmpR.set(ext.x - position.x, ext.y - position.y, ext.z - position.z);
    tmpTau.add(tmpW.copy(tmpR).cross(tmpF));
  }

  tmpTau.addScaledVector(angularVelocity, -spec.angularDragNms);

  // The world inertia tensor I_w = R diag(I) R^T, and the gyroscopic term
  // omega x (I_w omega). The term is small for a buoy but costs one cross
  // product, so it is kept rather than argued away.
  const [ix, iy, iz] = spec.inertiaKgM2;
  const iw = (r: number, c: number) => rot[r * 3] * ix * rot[c * 3] + rot[r * 3 + 1] * iy * rot[c * 3 + 1] + rot[r * 3 + 2] * iz * rot[c * 3 + 2];
  const wx = angularVelocity.x;
  const wy = angularVelocity.y;
  const wz = angularVelocity.z;
  const iwx = iw(0, 0) * wx + iw(0, 1) * wy + iw(0, 2) * wz;
  const iwy = iw(1, 0) * wx + iw(1, 1) * wy + iw(1, 2) * wz;
  const iwz = iw(2, 0) * wx + iw(2, 1) * wy + iw(2, 2) * wz;
  const gx = wy * iwz - wz * iwy;
  const gy = wz * iwx - wx * iwz;
  const gz = wx * iwy - wy * iwx;

  // The 6 x 6 mass matrix
  //   [ (m + A) 1     -[S]x   ] [ a     ]   [ F + sum A_i (a_w - c_i)           ]
  //   [  [S]x       I_w + J   ] [ alpha ] = [ tau - gyro + sum r_i x A_i (...)  ]
  // with A = sum A_i and S = sum A_i r_i. Symmetric positive definite.
  const mt = spec.massKg + addedMass;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      mat[r * 6 + c] = r === c ? mt : 0;
      mat[(r + 3) * 6 + (c + 3)] = iw(r, c) + jAdd[r * 3 + c];
    }
  }
  // [S]x = [[0, -Sz, Sy], [Sz, 0, -Sx], [-Sy, Sx, 0]].
  const sx = tmpS.x;
  const sy = tmpS.y;
  const sz = tmpS.z;
  const skew = [0, -sz, sy, sz, 0, -sx, -sy, sx, 0];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      mat[r * 6 + (c + 3)] = -skew[r * 3 + c];
      mat[(r + 3) * 6 + c] = skew[r * 3 + c];
    }
  }
  rhs[0] = tmpForce.x + tmpLinAdd.x;
  rhs[1] = tmpForce.y + tmpLinAdd.y;
  rhs[2] = tmpForce.z + tmpLinAdd.z;
  rhs[3] = tmpTau.x - gx + tmpAngAdd.x;
  rhs[4] = tmpTau.y - gy + tmpAngAdd.y;
  rhs[5] = tmpTau.z - gz + tmpAngAdd.z;
  solve6();

  // Semi-implicit Euler: velocity first, then position with the new
  // velocity, which is what makes the scheme symplectic and the heave not
  // grow.
  velocity.x += rhs[0] * dtS;
  velocity.y += rhs[1] * dtS;
  velocity.z += rhs[2] * dtS;
  position.addScaledVector(velocity, dtS);
  angularVelocity.x += rhs[3] * dtS;
  angularVelocity.y += rhs[4] * dtS;
  angularVelocity.z += rhs[5] * dtS;

  // Orientation: q <- q + 0.5 (w q) dt, then renormalized. The first-order
  // update is exact enough at 1/60 s for the angular rates a buoy reaches
  // (under 1 rad/s); the normalization is what keeps it a rotation.
  tmpQ.set(angularVelocity.x, angularVelocity.y, angularVelocity.z, 0)
    .multiply(orientation);
  orientation.x += 0.5 * tmpQ.x * dtS;
  orientation.y += 0.5 * tmpQ.y * dtS;
  orientation.z += 0.5 * tmpQ.z * dtS;
  orientation.w += 0.5 * tmpQ.w * dtS;
  orientation.normalize();

  return totalVolume > 0 ? submergedVolume / totalVolume : 0;
}

/**
 * The body's up axis in world space. Convenience for readouts: pitch and
 * roll are the tilt of this vector.
 */
export function bodyUp(state: FloatingBodyState, out = tmpUp): Vector3 {
  return out.set(0, 1, 0).applyQuaternion(state.orientation);
}

/**
 * Put a body at rest on the surface: level, its design waterline at
 * `surfaceYM`, no velocity. The known start every fixed-step run begins from.
 *
 * @param waterlineBodyY the design waterline's height in the body (center of
 *                       mass) frame. For a ballasted buoy it is positive: the
 *                       waterline sits above the center of mass.
 */
export function restFloatingBody(
  state: FloatingBodyState,
  xM: number,
  zM: number,
  surfaceYM: number,
  waterlineBodyY: number,
): void {
  state.position.set(xM, surfaceYM - waterlineBodyY, zM);
  state.orientation.identity();
  state.velocity.set(0, 0, 0);
  state.angularVelocity.set(0, 0, 0);
}
