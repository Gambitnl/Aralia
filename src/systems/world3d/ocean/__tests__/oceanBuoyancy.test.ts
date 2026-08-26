/**
 * @file oceanBuoyancy.test.ts — the floating body, the water at depth and the
 * displacement inversion, checked against closed forms rather than against
 * "it bobbed".
 *
 * Every assertion is a property a wrong integrator or a wrong inversion
 * fails: Archimedes on flat water, the analytic heave period with and without
 * added mass, energy that decays rather than grows, a righting moment with
 * the right sign, alignment with a wave's pressure gradient, the parcel
 * limit and the Smith effect of a body in a wave, depth decay that is
 * e^{-k d} for a single wave, Lagrangian differences that recover a known
 * parcel motion, an inversion residual that shrinks per iteration, and
 * bit-identical replay.
 *
 * ROUND 4 (2026-09-24). The step takes the water's pressure gradient per
 * probe (`ProbeWater.acceleration`) instead of a plane fitted through the
 * probe heights plus one mean vertical acceleration, and it solves an added
 * mass. The tests that fed the old form feed the new one with the same
 * physical input: "a surface sloped at s" became "a wave whose slope is s,
 * so the water accelerates at -g s along it", because a static tilted water
 * surface does not exist and a wave's slope always comes with that
 * acceleration. The plane fit moved from the step to `probeWaterAtDepth`,
 * which fits one per FFT band for the horizontal pressure gradient, and its
 * test that collinear probes are rejected moved with it.
 */
import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  bandDepthDecay,
  bodyUp,
  copyFloatingBodyState,
  createBandKinematics,
  createFloatingBodyState,
  depthDecayAt,
  invertDisplacement,
  massForWaterline,
  probeVolume,
  probeWaterAtDepth,
  restFloatingBody,
  stepFloatingBody,
  submergedSphereVolume,
  SEA_WATER_DENSITY_KGM3,
  SPHERE_ADDED_MASS_COEFFICIENT,
  type BuoyancyProbe,
  type FloatingBodySpec,
  type ProbeWater,
} from '../oceanBuoyancy';
import { GRAVITY_MS2, DEFAULT_CASCADES, type CascadeParams } from '../oceanConfig';

const DT = 1 / 60;

/**
 * A test body: a ring of six probes at the waterline, a center probe and a
 * ballast probe below. It is a reduced form of the navigation buoy's layout
 * in `oceanBuoyModel.ts` (which since round 3 of the ocean gauntlet also has
 * a second ring up the hull's flare and a tail probe); the tests here derive
 * every expectation from these probes, so the model's layout can change
 * without touching them. Probes are in the design frame (waterline at y = 0)
 * and shifted to the center of mass here, exactly as the model does.
 */
function makeBody(overrides: Partial<FloatingBodySpec> = {}): FloatingBodySpec {
  const design: BuoyancyProbe[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    design.push({ x: Math.cos(a) * 0.6, y: -0.3, z: Math.sin(a) * 0.6, radiusM: 0.4 });
  }
  design.push({ x: 0, y: -0.3, z: 0, radiusM: 0.45 });
  design.push({ x: 0, y: -1.2, z: 0, radiusM: 0.25 });
  const comY = -0.8;
  const massKg = massForWaterline(design);
  return {
    name: 'test-buoy',
    massKg,
    inertiaKgM2: [massKg * 1.5, massKg * 0.5, massKg * 1.5],
    probes: design.map((p) => ({ ...p, y: p.y - comY })),
    heaveDragNsPerM: 6000,
    surgeDragNsPerM: 1500,
    angularDragNms: 800,
    addedMassCoefficient: SPHERE_ADDED_MASS_COEFFICIENT,
    mooring: null,
    ...overrides,
  };
}

const WATERLINE_BODY_Y = 0.8;

function flat(n: number, y = 0): Float64Array {
  return new Float64Array(n).fill(y);
}

/** Still water: a surface and nothing else. */
function still(surfaceY: ArrayLike<number>): ProbeWater {
  return { surfaceY, velocity: null, acceleration: null };
}

/** The same water motion at every probe, 3 per probe. */
function uniform(n: number, x: number, y: number, z: number): Float64Array {
  const a = new Float64Array(n * 3);
  for (let i = 0; i < n; i += 1) { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; }
  return a;
}

/** Waterplane area the probes present at the design draft: sum of d(V_sub)/d(depth). */
function waterplaneArea(spec: FloatingBodySpec): number {
  let aWp = 0;
  for (const p of spec.probes) {
    const s = Math.min(Math.max(WATERLINE_BODY_Y - p.y + p.radiusM, 0), 2 * p.radiusM);
    aWp += Math.PI * (2 * p.radiusM * s - s * s);
  }
  return aWp;
}

describe('submergedSphereVolume — the spherical cap', () => {
  it('is zero above the water, full below it, half at the center', () => {
    const r = 0.5;
    const full = (4 / 3) * Math.PI * r ** 3;
    expect(submergedSphereVolume(r, -r)).toBe(0);
    expect(submergedSphereVolume(r, -r - 1)).toBe(0);
    expect(submergedSphereVolume(r, r)).toBeCloseTo(full, 12);
    expect(submergedSphereVolume(r, r + 3)).toBeCloseTo(full, 12);
    expect(submergedSphereVolume(r, 0)).toBeCloseTo(full / 2, 12);
  });

  it('is monotonic and smooth in depth: no kink a heave could feel', () => {
    const r = 0.4;
    let prev = 0;
    let prevSlope = 0;
    let maxSlopeJump = 0;
    const h = 1e-3;
    for (let d = -r; d <= r; d += h) {
      const v = submergedSphereVolume(r, d);
      expect(v).toBeGreaterThanOrEqual(prev);
      const slope = (v - prev) / h;
      if (d > -r + 2 * h) maxSlopeJump = Math.max(maxSlopeJump, Math.abs(slope - prevSlope));
      prev = v;
      prevSlope = slope;
    }
    // The derivative (the waterplane area of the slice) changes continuously;
    // its jump per millimeter step must be tiny.
    expect(maxSlopeJump).toBeLessThan(0.01);
  });
});

describe('massForWaterline — Archimedes', () => {
  it('makes the body float with its design waterline on flat water', () => {
    const spec = makeBody();
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    for (let i = 0; i < 60 * 30; i += 1) {
      stepFloatingBody(spec, state, still(flat(spec.probes.length)), DT);
    }
    // Rest height: center of mass at -0.8 puts the waterline at exactly 0.
    expect(Math.abs(state.position.y + WATERLINE_BODY_Y)).toBeLessThan(2e-3);
    expect(state.velocity.length()).toBeLessThan(1e-4);
    expect(state.position.x).toBeCloseTo(0, 6);
    expect(state.position.z).toBeCloseTo(0, 6);
  });

  it('weighs exactly the displaced water at the design draft', () => {
    const spec = makeBody();
    let displaced = 0;
    for (const p of spec.probes) {
      displaced += submergedSphereVolume(p.radiusM, WATERLINE_BODY_Y - p.y);
    }
    expect(spec.massKg).toBeCloseTo(displaced * SEA_WATER_DENSITY_KGM3, 9);
  });
});

describe('stepFloatingBody — heave', () => {
  /** Mean period between upward velocity zero crossings of a free heave. */
  const freeHeavePeriod = (spec: FloatingBodySpec) => {
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    state.position.y += 0.02; // a 2 cm lift, small enough to stay linear
    const water = still(flat(spec.probes.length));
    let lastCross = -1;
    const periods: number[] = [];
    let prevV = 0;
    for (let i = 0; i < 60 * 20; i += 1) {
      stepFloatingBody(spec, state, water, DT);
      const v = state.velocity.y;
      if (prevV < 0 && v >= 0) {
        if (lastCross >= 0) periods.push((i - lastCross) * DT);
        lastCross = i;
      }
      prevV = v;
    }
    expect(periods.length).toBeGreaterThan(3);
    return periods.reduce((s, x) => s + x, 0) / periods.length;
  };

  it('oscillates at the analytic period of a floating body, added mass included', () => {
    // omega_n^2 = rho g A_wp / (m + A), where A_wp is the waterplane area the
    // probes present at the design draft and A = C_a rho V_sub is the added
    // mass. At the design draft rho V_sub = m, so A = C_a m.
    const undamped = { heaveDragNsPerM: 0, surgeDragNsPerM: 0, angularDragNms: 0 };
    for (const ca of [0, SPHERE_ADDED_MASS_COEFFICIENT]) {
      const spec = makeBody({ ...undamped, addedMassCoefficient: ca });
      const k = SEA_WATER_DENSITY_KGM3 * GRAVITY_MS2 * waterplaneArea(spec);
      const expected = 2 * Math.PI * Math.sqrt((spec.massKg * (1 + ca)) / k);
      const mean = freeHeavePeriod(spec);
      // Within one time step's quantization plus the cap's mild nonlinearity.
      expect(Math.abs(mean - expected)).toBeLessThan(expected * 0.05);
    }
  });

  it('never gains energy: the undamped heave amplitude does not grow', () => {
    const spec = makeBody({ heaveDragNsPerM: 0, surgeDragNsPerM: 0, angularDragNms: 0 });
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    state.position.y += 0.05;
    const water = still(flat(spec.probes.length));
    // The cap is a SOFTENING spring (its waterplane shrinks as a probe lifts
    // out), so the swing below equilibrium is larger than the 5 cm lift
    // above it. That is physics, not energy gain. What must not happen is
    // the swing growing from the first seconds to the last.
    let early = 0;
    let late = 0;
    for (let i = 0; i < 60 * 60; i += 1) {
      stepFloatingBody(spec, state, water, DT);
      const a = Math.abs(state.position.y + WATERLINE_BODY_Y);
      if (i < 60 * 5) early = Math.max(early, a);
      if (i > 60 * 50) late = Math.max(late, a);
    }
    expect(early).toBeGreaterThan(0.05);
    // Semi-implicit Euler keeps a bounded energy error that oscillates; it
    // does not accumulate. One percent covers its swing at this omega dt.
    expect(late).toBeLessThan(early * 1.01);
  });

  it('follows a rising surface and settles on it', () => {
    const spec = makeBody();
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    const water = still(flat(spec.probes.length, 1.5));
    for (let i = 0; i < 60 * 30; i += 1) stepFloatingBody(spec, state, water, DT);
    expect(Math.abs(state.position.y + WATERLINE_BODY_Y - 1.5)).toBeLessThan(2e-3);
  });

  it('rides a uniformly rising surface with no offset when the water velocity is given', () => {
    // The surface rises at 0.5 m/s. Against STILL water the heave drag
    // brakes the body by c v, and it settles c v / k below its waterline.
    // Against the water's own velocity there is nothing to brake, and the
    // waterline stays put. This is the difference between a buoy that
    // swamps on every rise and one that rides it.
    const spec = makeBody();
    const rate = 0.5;
    const run = (withWater: boolean) => {
      const state = createFloatingBodyState();
      restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
      const heights = new Float64Array(spec.probes.length);
      const vel = uniform(spec.probes.length, 0, rate, 0);
      // CONVENTION: a step takes the surface at its START time, which is
      // how the viewer's fixed-step runner samples it (step the sea to t,
      // sample, integrate t to t + dt). Filling the heights at the end time
      // instead reads as a one-step lead of exactly rate * dt.
      let t = 0;
      for (let i = 0; i < 60 * 20; i += 1) {
        heights.fill(rate * t);
        stepFloatingBody(spec, state, { surfaceY: heights, velocity: withWater ? vel : null, acceleration: null }, DT);
        t += DT;
      }
      return state.position.y + WATERLINE_BODY_Y - rate * t;
    };
    const stillWater = run(false);
    const riding = run(true);
    expect(stillWater).toBeLessThan(-0.05);
    expect(Math.abs(riding)).toBeLessThan(0.002);
  });

  it('rides a uniformly accelerating surface with no lag when the water acceleration is given', () => {
    // The surface rises as a t^2 / 2. A body riding it must accelerate at
    // a, which without the pressure-gradient term costs (m + A) a / k of
    // extra draft. With it the water's own pressure gradient supplies m a
    // and the added-mass term A a, and the waterline holds. a = 1 m/s^2 is
    // the wind-sea peak's crest acceleration on the shipped sea.
    const spec = makeBody();
    const a = 1.0;
    const n = spec.probes.length;
    const run = (withAccel: boolean) => {
      const state = createFloatingBodyState();
      restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
      const heights = new Float64Array(n);
      let t = 0;
      for (let i = 0; i < 60 * 6; i += 1) {
        heights.fill(0.5 * a * t * t);
        stepFloatingBody(spec, state, {
          surfaceY: heights,
          velocity: uniform(n, 0, a * t, 0),
          acceleration: withAccel ? uniform(n, 0, a, 0) : null,
        }, DT);
        t += DT;
      }
      return state.position.y + WATERLINE_BODY_Y - 0.5 * a * t * t;
    };
    const lagging = run(false);
    const riding = run(true);
    // Without the term: (m + A) a / k for the test body's spring is about
    // 8 cm, and it is DEEPER (negative).
    expect(lagging).toBeLessThan(-0.03);
    expect(Math.abs(riding)).toBeLessThan(0.004);
  });

  it('clamps the water acceleration so a bad sample cannot launch the body', () => {
    const spec = makeBody();
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    const n = spec.probes.length;
    // A wild +100 m/s^2 for one step, then still water.
    stepFloatingBody(spec, state, { surfaceY: flat(n), velocity: null, acceleration: uniform(n, 0, 100, 0) }, DT);
    // At most 0.75 g of water acceleration for one step: a velocity kick
    // under 0.75 g dt = 0.12 m/s, not 10 g dt.
    expect(state.velocity.y).toBeLessThan(0.75 * GRAVITY_MS2 * DT + 1e-9);
    expect(state.velocity.y).toBeGreaterThan(0);
  });

  it('clamps the water velocity so a jumped readback cannot throw the body', () => {
    // A readback that jumps (a sea rebuilt under a running viewer) differences
    // into tens of meters a second. One step against 500 m/s of upward water
    // must move the body no more than 6 m/s of water could.
    const spec = makeBody();
    const n = spec.probes.length;
    const kick = (w: number) => {
      const state = createFloatingBodyState();
      restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
      stepFloatingBody(spec, state, { surfaceY: flat(n), velocity: uniform(n, 0, w, 0), acceleration: null }, DT);
      return state.velocity.y;
    };
    expect(kick(500)).toBeCloseTo(kick(6), 12);
    expect(kick(500)).toBeGreaterThan(0);
  });

  it('rejects a water velocity array shorter than three per probe', () => {
    const spec = makeBody();
    const state = createFloatingBodyState();
    expect(() => stepFloatingBody(spec, state, { surfaceY: flat(spec.probes.length), velocity: flat(4), acceleration: null }, DT))
      .toThrow(/velocity/);
  });

  it('rejects a water acceleration array shorter than three per probe', () => {
    const spec = makeBody();
    const state = createFloatingBodyState();
    expect(() => stepFloatingBody(spec, state, { surfaceY: flat(spec.probes.length), velocity: null, acceleration: flat(4) }, DT))
      .toThrow(/acceleration/);
  });

  it('rejects a heights array shorter than the probe list', () => {
    const spec = makeBody();
    const state = createFloatingBodyState();
    expect(() => stepFloatingBody(spec, state, still(flat(2)), DT)).toThrow(/probes/);
  });
});

describe('stepFloatingBody — pitch and roll', () => {
  it('rights itself from a tilt: the waterplane gives a restoring moment', () => {
    const spec = makeBody();
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    state.orientation.setFromAxisAngle(new Vector3(1, 0, 0), 0.35); // 20 deg roll
    const tilt0 = Math.acos(bodyUp(state).y);
    const water = still(flat(spec.probes.length));
    for (let i = 0; i < 60 * 30; i += 1) stepFloatingBody(spec, state, water, DT);
    const tilt1 = Math.acos(Math.min(1, bodyUp(state).y));
    expect(tilt0).toBeGreaterThan(0.3);
    expect(tilt1).toBeLessThan(0.01);
  });

  it('aligns with a wave\'s pressure gradient: slope s comes with water accelerating at -g s', () => {
    // Under a wave the free surface is a surface of constant pressure, so
    // the pressure gradient stands perpendicular to it: a parcel where the
    // surface rises along +X at slope s accelerates at -g s along X. Given
    // that acceleration at every probe, the body's up axis lies along the
    // surface normal (-s, 1, 0): up.x goes negative. A round-2 draft that
    // applied buoyancy straight up left the body at a fifth of the slope,
    // with the ballast fighting the waterplane.
    const spec = makeBody();
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    const slope = 0.15;
    const n = spec.probes.length;
    const heights = new Float64Array(n);
    const acc = uniform(n, -GRAVITY_MS2 * slope, 0, 0);
    for (let i = 0; i < 60 * 30; i += 1) {
      for (let k = 0; k < n; k += 1) {
        const p = spec.probes[k];
        const wp = new Vector3(p.x, p.y, p.z).applyQuaternion(state.orientation).add(state.position);
        heights[k] = slope * wp.x;
      }
      stepFloatingBody(spec, state, { surfaceY: heights, velocity: null, acceleration: acc }, DT);
      // The water accelerates the whole body along -X; on a real wave it
      // carries the body back within half a period. The test holds the
      // body over one spot, which leaves only the alignment.
      state.position.x = 0;
      state.position.z = 0;
      state.velocity.x = 0;
      state.velocity.z = 0;
    }
    const up = bodyUp(state);
    const tilt = Math.atan2(-up.x, up.y);
    const slopeAngle = Math.atan(slope);
    // The right way, and aligned to within half a degree.
    expect(up.x).toBeLessThan(0);
    expect(Math.abs(up.z)).toBeLessThan(1e-6);
    expect(Math.abs(tilt - slopeAngle)).toBeLessThan(0.009);
  });

  it('solves the added mass as a 6 x 6 mass matrix: the closed form for one offset probe', () => {
    // One fully submerged probe of volume V at r = (0, h, 0) above the
    // center of mass, mass m = rho V, in water accelerating sideways at a.
    // The pressure gradient pushes rho V a at the probe and the added mass
    // A = C_a rho V sits there too. Linear and angular momentum about the
    // center of mass, solved by hand:
    //   (m + A) a_x - A h alpha_z = (m + A) a
    //   -A h a_x + (I + A h^2) alpha_z = -h (m + A) a
    // give alpha_z = -h m a / (I + A h^2 m / (m + A)) and
    //      a_x = a + A h alpha_z / (m + A).
    // A scalar added mass at the center of mass would get both wrong.
    const h = 0.9;
    const a = 1.5;
    const probe = { x: 0, y: h, z: 0, radiusM: 0.3 };
    const m = probeVolume(probe) * SEA_WATER_DENSITY_KGM3;
    const inertia = m * 0.8;
    for (const ca of [0, SPHERE_ADDED_MASS_COEFFICIENT]) {
      const spec = makeBody({
        probes: [probe], massKg: m, inertiaKgM2: [inertia, inertia, inertia],
        addedMassCoefficient: ca, heaveDragNsPerM: 0, surgeDragNsPerM: 0, angularDragNms: 0,
      });
      const state = createFloatingBodyState();
      const water: ProbeWater = { surfaceY: [50], velocity: null, acceleration: uniform(1, a, 0, 0) };
      stepFloatingBody(spec, state, water, DT);
      const A = ca * m;
      const alpha = (-h * m * a) / (inertia + (A * h * h * m) / (m + A));
      const ax = a + (A * h * alpha) / (m + A);
      expect(state.angularVelocity.z / DT).toBeCloseTo(alpha, 9);
      expect(state.velocity.x / DT).toBeCloseTo(ax, 9);
      expect(Math.abs(state.velocity.y)).toBeLessThan(1e-9);
    }
  });

  it('keeps the orientation a unit quaternion over a long run', () => {
    const spec = makeBody();
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    state.angularVelocity.set(0.3, 0.2, -0.4);
    const water = still(flat(spec.probes.length));
    for (let i = 0; i < 60 * 60; i += 1) stepFloatingBody(spec, state, water, DT);
    expect(Math.abs(state.orientation.length() - 1)).toBeLessThan(1e-9);
  });
});

describe('stepFloatingBody — a body in a wave', () => {
  /**
   * A long-crested wave whose crest is far wider than the body, so the
   * surface over the hull rises and falls as one: height a cos(w t). The
   * water at depth d below the surface moves with e^{-k d} of the surface's
   * velocity and acceleration, k = w^2 / g (deep water). `decay` false feeds
   * the SURFACE motion to every probe, the round-3 model.
   *
   * @returns the relative heave amplitude: max |surface - waterline| over
   *          the last half of the run, as a fraction of a.
   */
  const relativeHeave = (periodS: number, decay: boolean) => {
    const spec = makeBody({ heaveDragNsPerM: 3000 });
    const n = spec.probes.length;
    const w = (2 * Math.PI) / periodS;
    const k = (w * w) / GRAVITY_MS2;
    const a = 0.1;
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, a, WATERLINE_BODY_Y);
    const heights = new Float64Array(n);
    const vel = new Float64Array(n * 3);
    const acc = new Float64Array(n * 3);
    let worst = 0;
    const steps = Math.round((20 * periodS) / DT);
    for (let i = 0; i < steps; i += 1) {
      const t = i * DT;
      const eta = a * Math.cos(w * t);
      for (let p = 0; p < n; p += 1) {
        const y = state.position.y + new Vector3(spec.probes[p].x, spec.probes[p].y, spec.probes[p].z)
          .applyQuaternion(state.orientation).y;
        const e = decay ? Math.exp(-k * Math.max(eta - y, 0)) : 1;
        heights[p] = eta;
        vel[p * 3 + 1] = -a * w * Math.sin(w * t) * e;
        acc[p * 3 + 1] = -a * w * w * Math.cos(w * t) * e;
      }
      stepFloatingBody(spec, state, { surfaceY: heights, velocity: vel, acceleration: acc }, DT);
      if (i > steps / 2) {
        const wl = state.position.y + WATERLINE_BODY_Y;
        worst = Math.max(worst, Math.abs(a * Math.cos(w * (t + DT)) - wl));
      }
    }
    return worst / a;
  };

  it('rides the surface exactly when every probe feels the surface\'s motion (the parcel limit)', () => {
    // Surface kinematics at every probe make the body a parcel of surface
    // water: at any period, even at its own heave resonance, it follows.
    for (const T of [1.2, 2.0, 5.0]) expect(relativeHeave(T, false)).toBeLessThan(0.03);
  });

  it('lets short waves run up and down the hull when the motion dies with depth (the Smith effect)', () => {
    // With e^{-k d} the hull feels less of a short wave than its waterline
    // sees, and near the heave resonance the body answers with its own
    // phase: the water climbs and drops on the hull. A long wave barely
    // changes with depth over the hull and is still ridden.
    const long = relativeHeave(8.0, true);
    const short = relativeHeave(1.8, true);
    expect(long).toBeLessThan(0.08);
    expect(short).toBeGreaterThan(0.3);
  });
});

describe('bandDepthDecay — how a band\'s motion dies with depth', () => {
  it('is e^{-k d} for a band that holds one wavelength', () => {
    // A 10 m wave alone: the cutoffs pinch the band to 9.9-10.1 m.
    const c: CascadeParams = { ...DEFAULT_CASCADES[1], name: 'narrow', cutoffLowM: 9.9, cutoffHighM: 10.1 };
    const t = bandDepthDecay(c, 256);
    const k = (2 * Math.PI) / 10;
    for (const d of [0.25, 1, 3]) {
      expect(depthDecayAt(t.velocity, t.stepM, d)).toBeCloseTo(Math.exp(-k * d), 2);
      expect(depthDecayAt(t.acceleration, t.stepM, d)).toBeCloseTo(Math.exp(-k * d), 2);
    }
  });

  it('starts at 1, falls monotonically, and falls faster for acceleration than for velocity', () => {
    for (const c of DEFAULT_CASCADES) {
      const t = bandDepthDecay(c, 256);
      expect(t.velocity[0]).toBeCloseTo(1, 12);
      expect(t.acceleration[0]).toBeCloseTo(1, 12);
      for (let i = 1; i < t.velocity.length; i += 1) {
        expect(t.velocity[i]).toBeLessThanOrEqual(t.velocity[i - 1] + 1e-12);
        // Acceleration weights the short waves by another omega^2, and short
        // waves die first.
        expect(t.acceleration[i]).toBeLessThanOrEqual(t.velocity[i] + 1e-12);
      }
    }
  });

  it('reads 1 at and above the surface and interpolates between entries', () => {
    const table = new Float64Array([1, 0.8, 0.6]);
    expect(depthDecayAt(table, 0.5, -0.3)).toBe(1);
    expect(depthDecayAt(table, 0.5, 0)).toBe(1);
    expect(depthDecayAt(table, 0.5, 0.25)).toBeCloseTo(0.9, 12);
    expect(depthDecayAt(table, 0.5, 9)).toBe(0.6);
  });
});

describe('createBandKinematics — Lagrangian differences', () => {
  /** One parcel of a Gerstner wave: displacement of grid point g at t. */
  const parcel = (g: number, t: number, out: number[], off: number) => {
    const a = 0.4; const k = 0.5; const w = Math.sqrt(GRAVITY_MS2 * k);
    const th = k * g - w * t;
    out[off] = -a * Math.sin(th);
    out[off + 1] = a * Math.cos(th);
    out[off + 2] = 0;
    out[off + 3] = 0;
    return { vx: a * w * Math.cos(th), vy: a * w * Math.sin(th), ax: a * w * w * Math.sin(th), ay: -a * w * w * Math.cos(th) };
  };

  it('recovers a parcel\'s velocity and acceleration from samples at the previous grid points', () => {
    const kin = createBandKinematics(1, 1);
    const now = [0, 0, 0, 0];
    const prev = [0, 0, 0, 0];
    const prev2 = [0, 0, 0, 0];
    // The query drifts 1 cm a step, so the grid point under it changes
    // every sample; the "previous" samples are always taken at the grid
    // points the last two samples found, as the mount does.
    let g = 3.0;
    let g1 = g;
    let g2 = g;
    for (let i = 0; i < 40; i += 1) {
      const t = i * DT;
      parcel(g, t, now, 0);
      parcel(g1, t, prev, 0);
      parcel(g2, t, prev2, 0);
      kin.update(now, 0, prev, 0, prev2, 0, t);
      g2 = g1;
      g1 = g;
      g += 0.01;
    }
    const t = 39 * DT;
    // The velocity is the previous parcel's, centered half a step back; the
    // acceleration the parcel before's, centered a step back. Both exact to
    // second order in dt, with no parcel-drift term.
    const v = parcel(g2, t - DT / 2, [0, 0, 0, 0], 0);
    expect(Math.abs(kin.velocity[0] - v.vx)).toBeLessThan(1e-3);
    expect(Math.abs(kin.velocity[1] - v.vy)).toBeLessThan(1e-3);
    expect(kin.surfaceRateY(0)).toBe(kin.velocity[1]);
    const acc = parcel(g2 - 0.01, t - DT, [0, 0, 0, 0], 0);
    expect(Math.abs(kin.acceleration[0] - acc.ax)).toBeLessThan(2e-3);
    expect(Math.abs(kin.acceleration[1] - acc.ay)).toBeLessThan(2e-3);
  });

  it('keeps its motion through a same-time re-sample and forgets it on reset', () => {
    const kin = createBandKinematics(1, 1);
    const z = [0, 0, 0, 0];
    const up = [0, 0.01, 0, 0];
    kin.update(z, 0, z, 0, z, 0, 0);
    kin.update(up, 0, up, 0, up, 0, DT);
    const v = kin.velocity[1];
    expect(v).toBeCloseTo(0.01 / DT, 9);
    kin.update(up, 0, up, 0, up, 0, DT);
    expect(kin.velocity[1]).toBe(v);
    kin.reset();
    expect(kin.velocity[1]).toBe(0);
    kin.update([0, 0.5, 0, 0], 0, [0, 0.5, 0, 0], 0, [0, 0.5, 0, 0], 0, 5);
    expect(kin.velocity[1]).toBe(0);
  });
});

describe('probeWaterAtDepth', () => {
  const halfPerMeter = (name: string, choppiness: number) => ({
    name, stepM: 0.5, meanK: 0, choppiness,
    velocity: new Float64Array([1, 0.5, 0.25, 0.125]),
    acceleration: new Float64Array([1, 0.5, 0.25, 0.125]),
  });
  const flatTable = (name: string, choppiness: number) => ({
    name, stepM: 0.5, meanK: 0, choppiness,
    velocity: new Float64Array([1, 1, 1, 1]),
    acceleration: new Float64Array([1, 1, 1, 1]),
  });

  it('scales each band by its own decay at each probe\'s depth, and divides out the choppiness', () => {
    const spec = makeBody();
    const n = spec.probes.length;
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    const kin = createBandKinematics(n, 2);
    for (let i = 0; i < n * 2; i += 1) {
      kin.velocity[i * 3] = 1;
      kin.velocity[i * 3 + 1] = 0.5;
      kin.acceleration[i * 3 + 1] = 2;
    }
    const vel = new Float64Array(n * 3);
    const acc = new Float64Array(n * 3);
    probeWaterAtDepth(spec, state, flat(n), kin, [halfPerMeter('a', 1), flatTable('b', 2)], vel, acc);
    // The ballast probe sits 1.2 m under the surface: 0.25 + 0.2 * (0.125 -
    // 0.25) of band a, all of band b. Band b's horizontal velocity is its
    // parcels' divided by its choppiness 2; its vertical velocity is not.
    const deep = n - 1;
    const e = 0.25 + ((1.2 - 1.0) / 0.5) * (0.125 - 0.25);
    expect(vel[deep * 3]).toBeCloseTo(e + 0.5, 12);
    expect(vel[deep * 3 + 1]).toBeCloseTo(0.5 * e + 0.5, 12);
    expect(acc[deep * 3 + 1]).toBeCloseTo(2 * e + 2, 12);
    expect(() => probeWaterAtDepth(spec, state, flat(n), kin, [flatTable('b', 1)], vel, acc)).toThrow(/bands/);
  });

  it('takes the horizontal pressure gradient from each band\'s fitted slope, -g grad eta', () => {
    // Band a rises along +X at 0.1, band b along +Z at 0.05. The parcels'
    // own horizontal acceleration (set here to a wild 50 m/s^2) is not used.
    const spec = makeBody();
    const n = spec.probes.length;
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    const kin = createBandKinematics(n, 2);
    for (let i = 0; i < n; i += 1) {
      const p = spec.probes[i];
      kin.height[i * 2] = 0.1 * p.x;
      kin.height[i * 2 + 1] = 0.05 * p.z + 0.3;
      kin.acceleration[(i * 2) * 3] = 50;
    }
    const vel = new Float64Array(n * 3);
    const acc = new Float64Array(n * 3);
    probeWaterAtDepth(spec, state, flat(n), kin, [halfPerMeter('a', 1.5), flatTable('b', 1)], vel, acc);
    const deep = n - 1;
    const e = 0.25 + ((1.2 - 1.0) / 0.5) * (0.125 - 0.25);
    expect(acc[deep * 3]).toBeCloseTo(-GRAVITY_MS2 * 0.1 * e, 9);
    expect(acc[deep * 3 + 2]).toBeCloseTo(-GRAVITY_MS2 * 0.05, 9);
  });

  it('throws for a body whose probes cannot define a surface slope', () => {
    const spec = makeBody({
      probes: [
        { x: 0, y: 0, z: 0, radiusM: 0.3 },
        { x: 0, y: -0.5, z: 0, radiusM: 0.3 },
      ],
    });
    const state = createFloatingBodyState();
    const kin = createBandKinematics(2, 1);
    expect(() => probeWaterAtDepth(spec, state, flat(2), kin, [flatTable('a', 1)], new Float64Array(6), new Float64Array(6)))
      .toThrow(/collinear/);
  });
});

describe('stepFloatingBody — mooring', () => {
  it('holds the body within the slack radius against a steady push', () => {
    // No added mass: the push is a velocity kick per step, and entrained
    // water would turn the same kick into a larger force on the line.
    const spec = makeBody({
      addedMassCoefficient: 0,
      mooring: {
        anchorX: 0, anchorZ: 0, attachBody: new Vector3(0, -1.5, 0), slackM: 1.0, stiffnessNPerM: 20000,
      },
    });
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    const water = still(flat(spec.probes.length));
    for (let i = 0; i < 60 * 60; i += 1) {
      // A constant 500 N push along +X, applied as a velocity kick per step.
      state.velocity.x += (500 / spec.massKg) * DT;
      stepFloatingBody(spec, state, water, DT);
    }
    // The slack and the spring apply at the ATTACHMENT, 1.5 m under the
    // center of mass; the taut line also leans the body, so the center of
    // mass ends further out than the attachment does.
    const attach = spec.mooring!.attachBody.clone()
      .applyQuaternion(state.orientation).add(state.position);
    const excursion = Math.hypot(attach.x, attach.z);
    expect(excursion).toBeGreaterThan(1.0);
    expect(excursion).toBeLessThan(1.0 + 500 / 20000 + 0.01);
    expect(state.position.x).toBeGreaterThan(attach.x);
  });
});

describe('stepFloatingBody — an external force (round 14)', () => {
  it('is the same step to the bit when the force is absent, null or zero', () => {
    const spec = makeBody();
    const run = (external: ProbeWater['external'] | 'absent') => {
      const state = createFloatingBodyState();
      restFloatingBody(state, 0, 0, 0.1, WATERLINE_BODY_Y);
      const n = spec.probes.length;
      const water: ProbeWater = external === 'absent'
        ? still(flat(n))
        : { ...still(flat(n)), external };
      for (let i = 0; i < 120; i += 1) stepFloatingBody(spec, state, water, DT);
      return [...state.position.toArray(), ...state.orientation.toArray()];
    };
    const base = run('absent');
    expect(run(null)).toEqual(base);
    expect(run({ fx: 0, fy: 0, fz: 0, x: 0, y: 1, z: 0 })).toEqual(base);
  });

  it('pushes the body along the force and tips its top the way the force points when it acts above the center of mass', () => {
    // A breaking crest's push at the waterline: +x, 0.8 m above the center
    // of mass (the waterline's body height). The body drifts along +x and
    // its up vector leans toward +x: the top goes with the crest.
    const spec = makeBody();
    const state = createFloatingBodyState();
    restFloatingBody(state, 0, 0, 0, WATERLINE_BODY_Y);
    const n = spec.probes.length;
    for (let i = 0; i < 30; i += 1) {
      const p = state.position;
      stepFloatingBody(spec, state, {
        ...still(flat(n)),
        external: { fx: 800, fy: 0, fz: 0, x: p.x, y: p.y + WATERLINE_BODY_Y, z: p.z },
      }, DT);
    }
    expect(state.velocity.x).toBeGreaterThan(0.01);
    expect(bodyUp(state).x).toBeGreaterThan(0.005);
    expect(Math.abs(bodyUp(state).z)).toBeLessThan(1e-9);
  });
});

describe('stepFloatingBody — determinism', () => {
  it('replays bit-identically from the same start', () => {
    const spec = makeBody();
    const run = () => {
      const state = createFloatingBodyState();
      restFloatingBody(state, 3, -5, 0.2, WATERLINE_BODY_Y);
      const n = spec.probes.length;
      const heights = new Float64Array(n);
      const acc = new Float64Array(n * 3);
      for (let i = 0; i < 600; i += 1) {
        for (let k = 0; k < n; k += 1) {
          heights[k] = 0.4 * Math.sin(i * 0.05 + k) + 0.1 * Math.cos(i * 0.31 - k * 2);
          acc[k * 3] = 0.3 * Math.cos(i * 0.07 + k);
          acc[k * 3 + 1] = -0.4 * Math.sin(i * 0.05 + k);
        }
        stepFloatingBody(spec, state, { surfaceY: heights, velocity: null, acceleration: acc }, DT);
      }
      return state;
    };
    const a = run();
    const b = run();
    expect(a.position.toArray()).toEqual(b.position.toArray());
    expect(a.orientation.toArray()).toEqual(b.orientation.toArray());
    expect(a.velocity.toArray()).toEqual(b.velocity.toArray());
    expect(a.angularVelocity.toArray()).toEqual(b.angularVelocity.toArray());
  });

  it('copies state exactly', () => {
    const a = createFloatingBodyState();
    a.position.set(1, 2, 3);
    a.orientation.copy(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.7));
    a.velocity.set(-1, 0.5, 2);
    a.angularVelocity.set(0.1, 0.2, 0.3);
    const b = createFloatingBodyState();
    copyFloatingBodyState(b, a);
    expect(b.position.toArray()).toEqual(a.position.toArray());
    expect(b.orientation.toArray()).toEqual(a.orientation.toArray());
  });
});

describe('invertDisplacement — the choppy-surface inversion', () => {
  /**
   * A synthetic Gerstner sea: two crossing waves with a horizontal
   * displacement, the same construction the FFT realizes mode by mode. Its
   * steepness Q k A is set to 0.7, well inside the non-folding range and
   * steeper than the shipped wind sea at the whitecap threshold.
   */
  const waves = [
    { a: 0.6, kx: 0.25, kz: 0.05, q: 0.7 },
    { a: 0.3, kx: -0.1, kz: 0.4, q: 0.7 },
  ];
  const sample = (gx: number, gz: number, out: Float64Array) => {
    let h = 0;
    let dx = 0;
    let dz = 0;
    for (const w of waves) {
      const k = Math.hypot(w.kx, w.kz);
      const phase = w.kx * gx + w.kz * gz;
      h += w.a * Math.cos(phase);
      dx -= ((w.q * w.kx) / k) * w.a * Math.sin(phase);
      dz -= ((w.q * w.kz) / k) * w.a * Math.sin(phase);
    }
    out[0] = dx;
    out[1] = h;
    out[2] = dz;
  };

  it('finds the grid point that lands on the query point', () => {
    for (const [px, pz] of [[0, 0], [3.7, -2.1], [12.5, 8.8], [-40.2, 17.1]]) {
      const r = invertDisplacement(sample, px, pz, 4);
      expect(r.residualM).toBeLessThan(0.01);
      // And the height it reports is the height of THAT grid point.
      const out = new Float64Array(3);
      sample(r.gridX, r.gridZ, out);
      expect(r.heightM).toBe(out[1]);
    }
  });

  it('converges: the residual shrinks with every iteration', () => {
    const px = 5.3;
    const pz = -1.9;
    let prev = Infinity;
    for (let it = 0; it <= 6; it += 1) {
      const r = invertDisplacement(sample, px, pz, it);
      expect(r.residualM).toBeLessThanOrEqual(prev + 1e-12);
      prev = r.residualM;
    }
    expect(prev).toBeLessThan(1e-4);
  });

  it('differs from the naive read where the surface is choppy', () => {
    // The whole reason the inversion exists: the naive height at P is the
    // height of the grid point P, which has moved elsewhere.
    let maxDiff = 0;
    const out = new Float64Array(3);
    for (let px = -20; px <= 20; px += 2.5) {
      for (let pz = -20; pz <= 20; pz += 2.5) {
        sample(px, pz, out);
        const naive = out[1];
        const r = invertDisplacement(sample, px, pz, 4);
        maxDiff = Math.max(maxDiff, Math.abs(naive - r.heightM));
      }
    }
    // The grid point moves by up to Q A = 0.42 m, over which the 0.6 m wave
    // changes height by about A k (Q A) = 0.06 m, plus the second wave.
    expect(maxDiff).toBeGreaterThan(0.05);
  });

  it('is the identity on a sea with no horizontal displacement', () => {
    const flatSample = (gx: number, gz: number, out: Float64Array) => {
      out[0] = 0;
      out[1] = 0.5 * Math.sin(gx * 0.3) * Math.cos(gz * 0.2);
      out[2] = 0;
    };
    const r = invertDisplacement(flatSample, 4, 7, 4);
    expect(r.gridX).toBe(4);
    expect(r.gridZ).toBe(7);
    expect(r.residualM).toBe(0);
  });
});

describe('probeVolume', () => {
  it('is the sphere volume', () => {
    expect(probeVolume({ x: 0, y: 0, z: 0, radiusM: 1 })).toBeCloseTo((4 / 3) * Math.PI, 12);
  });
});
