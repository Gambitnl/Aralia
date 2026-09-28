/**
 * @file oceanSpray.test.ts — the CPU half of the spray, checked.
 *
 * The particles live on the GPU and vitest has none. What can be proved here
 * is everything that decides WHEN the GPU runs and WHAT it is told: the
 * fixed-step plan that makes a pinned capture reproduce, the wind the spray
 * answers to, and the three constants that come from published measurements.
 */
import { describe, it, expect } from 'vitest';
import {
  planSprayStep,
  spraySeaRestep,
  sprayWindFromCascades,
  sprayWindFactor,
  windProfileFactor,
  sprayDragK,
  sprayViewJumpM,
  sprayFootprintLongM,
  sprayFootprintFit,
  SPRAY_DT_S,
  SPRAY_EMIT_FAR_M,
  SPRAY_WARMUP_S,
  SPRAY_FRAME_STEPS_MAX,
  SPRAY_SEA_RESTEP_EVERY,
  SPRAY_RECENTER_M,
  SPRAY_LIFE_MAX_S,
  SPRAY_DROP_TAU_S,
} from '../oceanSpray';
import { DEFAULT_CASCADES, GRAVITY_MS2, type CascadeParams } from '../oceanConfig';
import { OCEAN_SEA_STATES } from '../oceanSeaStates';
import { jonswapPeakOmega } from '../oceanSpectrum';

const WARMUP_STEPS = Math.round(SPRAY_WARMUP_S / SPRAY_DT_S);

describe('the fixed-step plan', () => {
  it('restarts and integrates the whole warm-up before the first step', () => {
    const plan = planSprayStep(null, 42.0, Infinity);
    expect(plan.restart).toBe(true);
    expect(plan.steps).toBe(WARMUP_STEPS);
    // 42.0 s is exactly step 2520 at 1/60 s; floating point must not lose it.
    expect(plan.firstStep + plan.steps).toBe(2520);
  });

  it('runs zero steps when the cursor is already at the target (a pinned clock)', () => {
    const plan = planSprayStep(2520, 42.0, 0);
    expect(plan.restart).toBe(false);
    expect(plan.steps).toBe(0);
    expect(plan.firstStep).toBe(2520);
  });

  it('advances by whole steps on a live frame and never skips one', () => {
    const plan = planSprayStep(2520, 42.0 + 2.5 * SPRAY_DT_S, 0.4);
    expect(plan.restart).toBe(false);
    expect(plan.steps).toBe(2);
    expect(plan.firstStep).toBe(2520);
  });

  it('restarts when the clock goes backward', () => {
    const plan = planSprayStep(3000, 42.0, 0);
    expect(plan.restart).toBe(true);
    expect(plan.firstStep + plan.steps).toBe(2520);
  });

  it('integrates a hitch whole, up to the warm-up length, and restarts past it', () => {
    const hitch = planSprayStep(2520, 42.0 + 90 * SPRAY_DT_S, 0);
    expect(hitch.restart).toBe(false);
    expect(hitch.steps).toBe(90);
    const edge = planSprayStep(2520, 42.0 + WARMUP_STEPS * SPRAY_DT_S, 0);
    expect(edge.restart).toBe(false);
    expect(edge.steps).toBe(WARMUP_STEPS);
    const past = planSprayStep(2520, 42.0 + (WARMUP_STEPS + 1) * SPRAY_DT_S, 0);
    expect(past.restart).toBe(true);
    expect(past.steps).toBe(WARMUP_STEPS);
    expect(past.firstStep + past.steps).toBe(2520 + WARMUP_STEPS + 1);
  });

  it('closes a catch-up faster than it opens one, so a hitch cannot loop', () => {
    // Wall cost per renderer.compute call, measured: about 0.47 ms (3,420
    // calls took 1.6 s). A second of sea time is 60 spray dispatches plus
    // one 18-dispatch sea step per SPRAY_SEA_RESTEP_EVERY spray steps.
    const callMs = 0.47;
    const callsPerSecond = 60 + (60 / SPRAY_SEA_RESTEP_EVERY) * 18;
    const wallPerSimSecond = (callsPerSecond * callMs) / 1000;
    expect(wallPerSimSecond).toBeLessThan(0.25);
  });

  it('never re-steps the sea inside an ordinary frame', () => {
    for (let steps = 0; steps <= SPRAY_FRAME_STEPS_MAX; steps += 1) {
      for (let k = 0; k < steps; k += 1) {
        expect(spraySeaRestep(2520 + k, k, steps)).toBe(false);
      }
    }
  });

  it('re-steps the sea at the first catch-up step and at every multiple of the interval', () => {
    const first = 2340;
    const steps = 180;
    const moments: number[] = [];
    for (let k = 0; k < steps; k += 1) {
      if (spraySeaRestep(first + k, k, steps)) moments.push(first + k);
    }
    expect(moments[0]).toBe(first);
    for (const s of moments.slice(1)) expect(s % SPRAY_SEA_RESTEP_EVERY).toBe(0);
    // Every spawn reads a sea at most (interval - 1) steps old.
    for (let k = 1; k < steps; k += 1) {
      const s = first + k;
      const last = moments.filter((m) => m <= s).pop() as number;
      expect(s - last).toBeLessThan(SPRAY_SEA_RESTEP_EVERY);
    }
  });

  it('keys the sea re-steps on the absolute step, so two routes to one target agree', () => {
    // A restart from null and a long catch-up from an older cursor must
    // re-step the sea at the same absolute steps over their shared range.
    const a = planSprayStep(null, 42.0, Infinity);
    const b = planSprayStep(2520 - 120, 42.0, 0);
    const momentsA = new Set<number>();
    const momentsB = new Set<number>();
    for (let k = 0; k < a.steps; k += 1) if (spraySeaRestep(a.firstStep + k, k, a.steps)) momentsA.add(a.firstStep + k);
    for (let k = 0; k < b.steps; k += 1) if (spraySeaRestep(b.firstStep + k, k, b.steps)) momentsB.add(b.firstStep + k);
    for (const m of momentsB) {
      if (m > b.firstStep) expect(momentsA.has(m)).toBe(true);
    }
  });

  it('restarts when the emission center jumps, and not when it drifts', () => {
    expect(planSprayStep(2520, 42.02, SPRAY_RECENTER_M + 1).restart).toBe(true);
    expect(planSprayStep(2520, 42.02, SPRAY_RECENTER_M - 1).restart).toBe(false);
  });

  it('restarts when the camera turns in place far enough to swing the wedge', () => {
    // A turn moves no point near the camera, but the wedge's far edge
    // swings by the turn times its reach.
    const turn = (SPRAY_RECENTER_M + 1) / SPRAY_EMIT_FAR_M;
    expect(planSprayStep(2520, 42.02, sprayViewJumpM(0, turn)).restart).toBe(true);
    expect(planSprayStep(2520, 42.02, sprayViewJumpM(0, 0.5 * turn)).restart).toBe(false);
  });

  it('restarts when the camera rises over the same point, since the drawn foam changes with the footprint', () => {
    // storm-eye (5.5 m, 55 deg) to storm-deck (12 m, 50 deg): the same
    // forward point and heading, a footprint scale 0.39 of the old one.
    const scale = (fovDeg: number, h: number) => (2 * Math.tan((fovDeg / 2) * Math.PI / 180)) / 900 / h;
    const ratio = scale(50, 12) / scale(55, 5.5);
    expect(planSprayStep(2520, 42.0, sprayViewJumpM(0, 0, ratio)).restart).toBe(true);
    // A ship heaving a meter at 12 m does not.
    expect(planSprayStep(2520, 42.02, sprayViewJumpM(0, 0, 12 / 13)).restart).toBe(false);
  });

  it('wraps the heading change, so a turn across the +-pi seam is small', () => {
    expect(sprayViewJumpM(0, 2 * Math.PI - 0.01)).toBeCloseTo(0.01 * SPRAY_EMIT_FAR_M, 9);
    expect(sprayViewJumpM(7, 0)).toBe(7);
  });

  it('is a pure function: the same inputs give the same plan', () => {
    const a = planSprayStep(null, 61.3, Infinity);
    const b = planSprayStep(null, 61.3, Infinity);
    expect(a).toEqual(b);
  });

  it('warms up for longer than any particle can live, so the target is steady state', () => {
    expect(SPRAY_WARMUP_S).toBeGreaterThan(SPRAY_LIFE_MAX_S);
  });
});

describe('the wind the spray answers to', () => {
  it('is the wind sea of the shipped sea, not the swell', () => {
    const w = sprayWindFromCascades(DEFAULT_CASCADES);
    const windSea = DEFAULT_CASCADES.find((c) => c.name === 'wind-sea') as CascadeParams;
    expect(w.speedMs).toBe(windSea.windSpeedMs);
    expect(w.dirRad).toBe(windSea.windDirRad);
  });

  it('is the wind sea of the storm', () => {
    const w = sprayWindFromCascades(OCEAN_SEA_STATES.storm);
    expect(w.speedMs).toBe(20);
  });

  it('carries the phase speed of the JONSWAP peak as the crest speed', () => {
    const w = sprayWindFromCascades(OCEAN_SEA_STATES.storm);
    const windSea = OCEAN_SEA_STATES.storm.find((c) => c.name === 'wind-sea') as CascadeParams;
    const expected = GRAVITY_MS2 / jonswapPeakOmega(windSea.windSpeedMs, windSea.fetchM);
    expect(w.crestSpeedMs).toBeCloseTo(expected, 9);
    // A 60 m wave in deep water travels at sqrt(g L / 2 pi) = 9.7 m/s.
    expect(w.crestSpeedMs).toBeGreaterThan(9);
    expect(w.crestSpeedMs).toBeLessThan(10.5);
  });

  it('refuses a sea with no foam-driving cascade', () => {
    const none = DEFAULT_CASCADES.map((c) => ({ ...c, drivesFoam: false }));
    expect(() => sprayWindFromCascades(none)).toThrow(/drives foam/);
  });
});

describe('the Beaufort spray factor', () => {
  it('lists no spray through force 5', () => {
    expect(sprayWindFactor(8)).toBe(0);
    expect(sprayWindFactor(10.5)).toBe(0);
  });

  it('gives the shipped 11.5 m/s sea only a trace', () => {
    const f = sprayWindFactor(11.5);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(0.05);
  });

  it('gives the 20 m/s storm nearly full spray and saturates at force 9', () => {
    expect(sprayWindFactor(20)).toBeGreaterThan(0.95);
    expect(sprayWindFactor(21)).toBe(1);
    expect(sprayWindFactor(30)).toBe(1);
  });

  it('rises monotonically with wind', () => {
    let last = -1;
    for (let u = 0; u <= 30; u += 0.5) {
      const f = sprayWindFactor(u);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
  });
});

describe('the wind profile', () => {
  it('is exactly U10 at 10 m', () => {
    expect(windProfileFactor(10)).toBeCloseTo(1, 12);
  });

  it('gives the published fractions at 0.3, 1 and 3 m', () => {
    expect(windProfileFactor(1)).toBeCloseTo(0.75, 2);
    expect(windProfileFactor(0.3)).toBeCloseTo(0.62, 2);
    expect(windProfileFactor(3)).toBeCloseTo(0.87, 2);
  });

  it('stays finite and positive for a puff on the water', () => {
    expect(windProfileFactor(0)).toBeGreaterThan(0);
    expect(Number.isFinite(windProfileFactor(-1))).toBe(true);
  });
});

describe('the drop drag', () => {
  it('is the exact exponential blend, not dt / tau', () => {
    expect(sprayDragK(SPRAY_DT_S, SPRAY_DROP_TAU_S)).toBeCloseTo(1 - Math.exp(-SPRAY_DT_S / SPRAY_DROP_TAU_S), 12);
    expect(sprayDragK(SPRAY_DROP_TAU_S * 10, SPRAY_DROP_TAU_S)).toBeLessThan(1);
  });

  it('reproduces the terminal fall speed of a 0.7 mm spume drop', () => {
    // A drop under gravity with relaxation time tau settles at v = g tau.
    // Gunn and Kinzer: 2.06 m/s at 0.5 mm, 4.03 m/s at 1.0 mm, so 0.7 mm
    // falls near 2.9 m/s.
    const terminal = GRAVITY_MS2 * SPRAY_DROP_TAU_S;
    expect(terminal).toBeGreaterThan(2.5);
    expect(terminal).toBeLessThan(3.5);
    // Integrate the same per-step rule the kernel uses and check it lands there.
    let v = 0;
    const k = sprayDragK(SPRAY_DT_S, SPRAY_DROP_TAU_S);
    for (let i = 0; i < 600; i += 1) {
      v = v * (1 - k);
      v -= GRAVITY_MS2 * SPRAY_DT_S;
    }
    // The discrete rule v <- v (1 - k) - g dt has the fixed point g dt / k,
    // which is g tau (1 + dt / 2 tau) to first order: at dt = tau / 18 it
    // sits 3% over the continuous terminal speed.
    expect(-v).toBeCloseTo((GRAVITY_MS2 * SPRAY_DT_S) / k, 6);
    expect(-v).toBeGreaterThan(terminal);
    expect(-v).toBeLessThan(1.05 * terminal);
  });
});

describe('the drawn-foam footprint', () => {
  // One framebuffer row from the storm deck: 50 degrees over 900 rows.
  const RAD_PER_PX = (2 * Math.tan((25 * Math.PI) / 180)) / 900;

  it('is the pixel angle times the camera height straight below the camera', () => {
    expect(sprayFootprintLongM(0, 12, RAD_PER_PX)).toBeCloseTo(RAD_PER_PX * 12, 12);
  });

  it('stretches with range as the grazing angle falls', () => {
    // From 12 m: 0.23 m at 50 m, 0.88 m at 100 m, 2.0 m at 150 m.
    expect(sprayFootprintLongM(50, 12, RAD_PER_PX)).toBeCloseTo(0.228, 3);
    expect(sprayFootprintLongM(100, 12, RAD_PER_PX)).toBeCloseTo(0.876, 3);
    expect(sprayFootprintLongM(150, 12, RAD_PER_PX)).toBeCloseTo(1.955, 3);
  });

  it('copies the surface fade: 1 under a 96th of the longest wave, 0 past a quarter', () => {
    expect(sprayFootprintFit(13, 13 / 96)).toBeCloseTo(1, 12);
    expect(sprayFootprintFit(13, 13 / 200)).toBe(1);
    expect(sprayFootprintFit(13, 13 / 4)).toBeCloseTo(0, 12);
    // The middle of the log2 span is the middle of the smoothstep.
    expect(sprayFootprintFit(13, 13 / Math.sqrt(96 * 4))).toBeCloseTo(0.5, 9);
  });

  it('draws the ripple fold at 93% at 50 m, 37% at 100 m and 7% at 150 m from the deck', () => {
    const ripple = DEFAULT_CASCADES.find((c) => c.name === 'ripple') as CascadeParams;
    const at = (r: number) => sprayFootprintFit(ripple.cutoffHighM, sprayFootprintLongM(r, 12, RAD_PER_PX));
    expect(at(50)).toBeCloseTo(0.928, 3);
    expect(at(100)).toBeCloseTo(0.370, 3);
    expect(at(150)).toBeCloseTo(0.069, 3);
  });
});
