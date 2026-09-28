/**
 * oceanSkipMath.test.ts — the stone-skipping model against the published
 * experiments, and each preset against the cause it names.
 *
 * The published numbers come from Rosellini, Hersen, Clanet and Bocquet,
 * "Skipping stones", J. Fluid Mech. 543 (2005) [R05], with an aluminum disc
 * of R = 2.5 cm and h = 2.75 mm (their stone 1) at 3.5 m/s. See the file
 * header of oceanSkipMath.ts for the model and its references.
 */
import { describe, expect, it } from 'vitest';
import {
  createSkipSeaWater,
  simulateFromTouch,
  simulateRunFromTouch,
  simulateSkip,
  skipFlatWater,
  skipMinSpeed,
  skipStoneInertia,
  skipStoneMesh,
  sphereRicochetLimitDeg,
  SKIP_PRESETS,
  SKIP_SAMPLE_STRIDE,
  SKIP_STONES,
  type SkipStoneType,
} from '../oceanSkipMath';
import { OCEAN_SEA_STATES } from '../oceanSeaStates';
import { OCEAN_FFT_N } from '../oceanConfig';

/** [R05] stone 1: aluminum, R 2.5 cm, h 2.75 mm. */
const R05_DISC: SkipStoneType = {
  id: 'slate', label: 'R05 stone 1', shape: 'disc', radiusM: 0.025, thicknessM: 0.00275, densityKgM3: 2700, note: '',
};

const throwOf = (p: (typeof SKIP_PRESETS)[number]) => ({
  ...p.throw, headingRad: -Math.PI / 2, originXM: 0, originZM: 0, t0S: 42,
});

describe('the stone meshes', () => {
  it('are closed and hold the volume of the shape', () => {
    for (const st of Object.values(SKIP_STONES)) {
      const m = skipStoneMesh(st);
      const exact = st.shape === 'disc'
        ? Math.PI * st.radiusM ** 2 * st.thicknessM
        : (4 / 3) * Math.PI * st.radiusM ** 2 * (st.thicknessM / 2);
      // A 24-gon disc holds 98.9% of the circle; the 10 x 20 ellipsoid 96-97%.
      expect(m.volumeM3 / exact).toBeGreaterThan(0.95);
      expect(m.volumeM3 / exact).toBeLessThanOrEqual(1);
    }
  });
  it('give the slate the mass of a skipping stone (about 60 g)', () => {
    const st = SKIP_STONES.slate;
    const { massKg } = skipStoneInertia(st, skipStoneMesh(st));
    expect(massKg).toBeGreaterThan(0.055);
    expect(massKg).toBeLessThan(0.065);
  });
});

describe('one touch, against [R05]', () => {
  it('fig. 3: at 65 turns a second, alpha = beta = 20 degrees, it bounces with its tilt held', () => {
    const r = simulateFromTouch(R05_DISC, 3.5, 20, 20, 65);
    expect(r.rebound).toBe(true);
    // They measured a 32 ms contact; their model gave about 36 ms.
    expect(r.contactS).toBeGreaterThan(0.025);
    expect(r.contactS).toBeLessThan(0.045);
    expect(Math.abs(r.touch!.tiltOutDeg - 20)).toBeLessThan(3);
    expect(Math.abs(r.touch!.bankOutDeg)).toBeLessThan(5);
  });
  it('fig. 5: with no spin at alpha 35, beta 20, it tumbles and dives', () => {
    const r = simulateFromTouch(R05_DISC, 3.5, 20, 35, 0);
    expect(r.rebound).toBe(false);
  });
  it('fig. 7: at 10 turns a second the tilt dips and recovers, and it still bounces (the trout)', () => {
    const r = simulateFromTouch(R05_DISC, 3.5, 18, 20, 10);
    expect(r.rebound).toBe(true);
    expect(r.touch!.tiltMinDeg).toBeLessThan(15);
  });
  it('fig. 6a and 7: the spin holds the tilt: steady at 65 turns a second, dipping at 10', () => {
    const hi = simulateFromTouch(R05_DISC, 3.5, 18, 20, 65).touch!;
    const lo = simulateFromTouch(R05_DISC, 3.5, 18, 20, 10).touch!;
    expect(20 - hi.tiltMinDeg).toBeLessThan(3);
    expect(20 - lo.tiltMinDeg).toBeGreaterThan(8);
  });
  it('fig. 6c: no path steeper than 45 degrees bounces', () => {
    expect(simulateFromTouch(R05_DISC, 3.5, 30, 20, 65).rebound).toBe(true);
    expect(simulateFromTouch(R05_DISC, 3.5, 40, 20, 65).rebound).toBe(true);
    for (const b of [46, 55]) expect(simulateFromTouch(R05_DISC, 3.5, b, 20, 65).rebound).toBe(false);
  });
});

describe('the lowest speed that bounces', () => {
  it('is near their measured 2.6 m/s at alpha = beta = 20 degrees (fig. 6b)', () => {
    const u = skipMinSpeed(R05_DISC, 20, 20, 65, {}, 0.5, 6, 0.25);
    expect(u).toBeGreaterThan(1.8);
    expect(u).toBeLessThan(3.2);
  });
  it('is lowest near the magic angle, 15 to 25 degrees of tilt ([C04])', () => {
    const tilts = [5, 10, 15, 20, 25, 30, 40];
    const us = tilts.map((a) => skipMinSpeed(R05_DISC, 20, a, 65, {}, 0.5, 8, 0.25));
    const best = tilts[us.indexOf(Math.min(...us))];
    expect(best).toBeGreaterThanOrEqual(15);
    expect(best).toBeLessThanOrEqual(25);
  }, 60_000);
});

describe('a round pebble', () => {
  it('sinks on a path over Johnson and Reid’s ricochet limit (18 / sqrt(2.65) = 11 degrees)', () => {
    expect(sphereRicochetLimitDeg(2650)).toBeCloseTo(11.06, 1);
    expect(simulateFromTouch('pebble', 12, 16, 20, 30).rebound).toBe(false);
  });
});

describe('the presets', () => {
  const runs = new Map(SKIP_PRESETS.map((p) => [p.id, simulateSkip(throwOf(p), skipFlatWater(0))]));
  for (const p of SKIP_PRESETS) {
    it(`"${p.label}" ends because it ${p.expect}`, () => {
      const r = runs.get(p.id)!;
      expect(r.end.cause).toBe(p.expect);
      expect(r.end.sentence.length).toBeGreaterThan(20);
    });
  }
  it('the best throw skips at least six times, with shortening gaps, and beats every failing preset', () => {
    const best = runs.get('best')!;
    expect(best.skips).toBeGreaterThanOrEqual(6);
    const at = best.touches.map((t) => Math.hypot(t.xM, t.zM));
    const gaps = at.slice(1).map((d, i) => d - at[i]);
    for (let i = 1; i < gaps.length; i += 1) expect(gaps[i]).toBeLessThan(gaps[i - 1]);
    // The failing presets; pumice is a different stone, not a failed throw.
    for (const id of ['steep', 'nospin', 'slow', 'pebble'] as const) expect(runs.get(id)!.skips).toBeLessThan(best.skips);
  });
  it('no spin tips over by the second touch', () => {
    const r = runs.get('nospin')!;
    expect(r.skips).toBeLessThanOrEqual(1);
  });
  it('GG-340: the best throw keeps within 3 skips of the same throw with its tilt held ([R05] section 4)', () => {
    const p = SKIP_PRESETS[0];
    const held = simulateSkip(throwOf(p), skipFlatWater(0), { explain: false, leverScale: 0 });
    expect(runs.get('best')!.skips).toBeGreaterThanOrEqual(held.skips - 3);
  }, 60_000);
  it('pumice floats: it ends at rest on the water, not under it', () => {
    const r = runs.get('pumice')!;
    const n = r.samples.length / SKIP_SAMPLE_STRIDE;
    const y = r.samples[(n - 1) * SKIP_SAMPLE_STRIDE + 2];
    expect(Math.abs(y)).toBeLessThan(SKIP_STONES.pumice.thicknessM);
  });
  it('is deterministic: the same throw gives the same run', () => {
    const p = SKIP_PRESETS[0];
    const a = simulateSkip(throwOf(p), skipFlatWater(0), { explain: false });
    const b = simulateSkip(throwOf(p), skipFlatWater(0), { explain: false });
    expect(b.samples.length).toBe(a.samples.length);
    for (let i = 0; i < a.samples.length; i += 97) expect(b.samples[i]).toBe(a.samples[i]);
  });
});

describe('the tilt sweep', () => {
  it('skips most at a tilt of 5 to 20 degrees at 12 m/s and 35 turns a second (R05 threw its long runs at 7 and 10)', () => {
    const tilts = [0, 10, 20, 30, 40, 50];
    const counts = tilts.map((a) => [6, 10, 14].reduce((s, b) => s + simulateRunFromTouch('slate', 12, b, a, 35).skips, 0));
    const best = tilts[counts.indexOf(Math.max(...counts))];
    expect(best).toBeGreaterThanOrEqual(5);
    expect(best).toBeLessThanOrEqual(20);
    // And a steep tilt loses: at 40 degrees and over, fewer than half the best.
    expect(counts[4]).toBeLessThan(counts[tilts.indexOf(best)] / 2);
  }, 120_000);
});

describe('THE FREE TOP (GG-340)', () => {
  it('between two touches the stone keeps its spin and its wobble (no energy from the step)', () => {
    // The best throw's first flight after its first touch. Round 1's explicit
    // step moved the spin into the wobble here: 188 -> 157 rad/s of spin and
    // 83 -> 206 rad/s of wobble in half a second, with no torque but the air's.
    // The air's pitching moment is off here (`airCenter: false`: its load at
    // the face's middle, round 1), so the only torque left is the air's
    // damping of the wobble: the wobble may fall, never grow.
    const spans: number[][][] = [];
    let wasWet = false;
    simulateSkip(throwOf(SKIP_PRESETS[0]), skipFlatWater(0), {
      explain: false, maxRunS: 1.5, airCenter: false,
      onStep: (_t, _f, _tq, _v, w, wet, q) => {
        if (wet) { wasWet = true; return; }
        if (wasWet) { spans.push([]); wasWet = false; }
        if (!spans.length) return;
        const [x, y, z, qw] = q;
        const n = [2 * (x * y - qw * z), 1 - 2 * (x * x + z * z), 2 * (y * z + qw * x)];
        const wa = w[0] * n[0] + w[1] * n[1] + w[2] * n[2];
        const wp = Math.sqrt(Math.max(0, w[0] * w[0] + w[1] * w[1] + w[2] * w[2] - wa * wa));
        spans[spans.length - 1].push([wa, wp]);
      },
    });
    const flight = spans.find((s) => s.length > 50)!;
    expect(flight).toBeDefined();
    const [a0, p0] = flight[2];
    const [a1, p1] = flight[flight.length - 1];
    expect(Math.abs(a1 - a0)).toBeLessThan(0.01 * Math.abs(a0));
    expect(p1).toBeLessThanOrEqual(p0 * 1.01);
    expect(p1).toBeGreaterThan(p0 * 0.8);
  });
});

describe('the lake', () => {
  const lake = OCEAN_SEA_STATES.lake;
  it('is a calm sea: Hs near the fetch law (3.2 cm) and no fold', () => {
    const w = createSkipSeaWater(lake, 0x0cea9, OCEAN_FFT_N);
    expect(w.varianceKept).toBeGreaterThan(0.96);
    const out = { h: 0, sx: 0, sz: 0 };
    let s2 = 0; let n = 0;
    for (let i = 0; i < 400; i += 1) {
      w.sample((i * 7.31) % 287, (i * 3.17) % 287, 42, out);
      s2 += out.h * out.h; n += 1;
    }
    const hs = 4 * Math.sqrt(s2 / n);
    expect(hs).toBeGreaterThan(0.025);
    expect(hs).toBeLessThan(0.045);
  });
  it('the best throw on the lake skips, and replays exactly', () => {
    const w = createSkipSeaWater(lake, 0x0cea9, OCEAN_FFT_N);
    const t = throwOf(SKIP_PRESETS[0]);
    const a = simulateSkip(t, w, { explain: false });
    const b = simulateSkip(t, w, { explain: false });
    expect(a.skips).toBeGreaterThanOrEqual(4);
    expect(b.samples[b.samples.length - 5]).toBe(a.samples[a.samples.length - 5]);
  }, 60_000);
  it('the end sentence never calls a stone too slow at a speed over the one it names (round 2)', () => {
    // Round 1 said "Sank: too slow. At 5.3 m/s ... it needs about 4.2 m/s"
    // (the window proof p3). The release times hit a ripple end, an end at
    // the edge of the speed that bounces, and a plain slow end (probe33).
    const w = createSkipSeaWater(lake, 0x0cea9, OCEAN_FFT_N);
    const causes: string[] = [];
    for (const t0S of [43.87, 54.83, 45.24]) {
      const r = simulateSkip({ ...throwOf(SKIP_PRESETS[0]), t0S }, w);
      causes.push(r.end.cause);
      const m = /At ([\d.]+) m\/s.*about ([\d.]+) m\/s/.exec(r.end.sentence);
      if (r.end.cause === 'slow') {
        expect(m).not.toBeNull();
        expect(Number(m![2])).toBeGreaterThanOrEqual(Number(m![1]));
      }
    }
    expect(causes).toContain('rippled');
    expect(causes).toContain('slow');
  }, 120_000);
});
