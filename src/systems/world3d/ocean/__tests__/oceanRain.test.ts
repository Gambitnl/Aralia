/**
 * @file oceanRain.test.ts — the CPU arithmetic behind the rain shaders.
 *
 * The GPU side (`oceanRain.ts`) is proved by captures against the reference
 * frames. What is checked here is the pure math that the shaders mirror:
 * the drift heading, the slant, the streak length in pixels, the streak's
 * width, alpha and blend by distance, the murk's path length and
 * transmittance, the exact field wrap, and the splash timing. Each claim in `oceanRainMath.ts` has a test that would fail if the
 * number drifted.
 */
import { describe, expect, it } from 'vitest';
import {
  STORM_RAIN,
  rainBoxFloorM,
  rainCrownProfile,
  rainDriftDirRad,
  rainFieldOffsetM,
  rainMetersPerPixel,
  rainPathLengthM,
  rainRingProfile,
  rainSlantDeg,
  rainSlopeVariance,
  rainSplashAgeS,
  rainStreakAlpha,
  rainStreakLengthM,
  rainStreakOverBackground,
  rainStreakPx,
  rainStreakWidthPx,
  rainTransmittance,
  rainVelocityMs,
} from '../oceanRainMath';
import { OCEAN_SEA_STATES } from '../oceanSeaStates';

describe('rainDriftDirRad', () => {
  it('follows the strongest foam-driving cascade, not the swell', () => {
    const storm = OCEAN_SEA_STATES.storm;
    const windSea = storm.find((c) => c.name === 'wind-sea')!;
    const swell = storm.find((c) => c.name === 'swell')!;
    expect(swell.windDirRad).not.toBe(windSea.windDirRad);
    expect(rainDriftDirRad(storm)).toBe(windSea.windDirRad);
  });

  it('falls back to the strongest wind when nothing drives foam, and to 0 with no cascades', () => {
    expect(rainDriftDirRad([
      { windSpeedMs: 5, windDirRad: 1, drivesFoam: false },
      { windSpeedMs: 9, windDirRad: 2, drivesFoam: false },
    ])).toBe(2);
    expect(rainDriftDirRad([])).toBe(0);
  });
});

describe('the streak geometry', () => {
  it('slants 19 to 22 degrees at the storm drift, as the reference frame measures', () => {
    const s = rainSlantDeg(STORM_RAIN.fallSpeedMs, STORM_RAIN.driftMs);
    expect(s).toBeGreaterThan(19);
    expect(s).toBeLessThan(22);
  });

  it('carries the drift along the heading and the fall straight down', () => {
    const v = rainVelocityMs({ fallSpeedMs: 7, driftMs: 2.5, driftDirRad: Math.PI / 2 });
    expect(v[0]).toBeCloseTo(0, 6);
    expect(v[1]).toBe(-7);
    expect(v[2]).toBeCloseTo(2.5, 6);
  });

  it('makes a 32 cm streak that shrinks with distance: 28 px at 10 m and 9 px at 30 m', () => {
    const v = rainVelocityMs(STORM_RAIN);
    const speed = Math.hypot(...v);
    const len = rainStreakLengthM(speed, STORM_RAIN.exposureS);
    expect(len).toBeGreaterThan(0.31);
    expect(len).toBeLessThan(0.335);
    const at10 = rainStreakPx(len, 10, 55, 900);
    const at30 = rainStreakPx(len, 30, 55, 900);
    expect(at10).toBeGreaterThan(26.5);
    expect(at10).toBeLessThan(29);
    expect(at30).toBeGreaterThan(8.8);
    expect(at30).toBeLessThan(9.7);
  });

  it('a near drop is soft and wide, a mid drop is the brightest line, a far drop is faint', () => {
    const mpp = rainMetersPerPixel(1, 55, 900);
    const a = (d: number) => rainStreakAlpha(d, STORM_RAIN, mpp);
    const w = (d: number) => rainStreakWidthPx(d, STORM_RAIN, mpp);
    // The mid range is the brightest: the lines the eye picks out. The
    // alpha there is the 0.49 the radiance note is written for.
    const ds = [3, 4, 5, 6, 7, 8, 9, 10, 12, 15];
    const peakD = ds.reduce((best, d) => (a(d) > a(best) ? d : best), ds[0]);
    expect(peakD).toBeGreaterThanOrEqual(6);
    expect(peakD).toBeLessThanOrEqual(12);
    expect(a(8)).toBeGreaterThan(0.46);
    expect(a(8)).toBeLessThan(0.52);
    // Past 15 m the line sits on the pixel floor, crisp.
    expect(w(16).blurPx).toBeLessThan(1.4);
    expect(w(16).sharpPx).toBeCloseTo(STORM_RAIN.minWidthPx, 6);
    // Near the lens the blur widens the line past twice the mid width and
    // dims it: soft and faint, never a bold bar (the round-2 depth complaint
    // and a round-4 blind check's "scratches on film").
    expect(w(3).blurPx).toBeGreaterThan(2 * w(8).blurPx);
    expect(a(3)).toBeLessThan(0.75 * a(peakD));
    // Dimmed by less than the widening (blurDimExponent 0.5): a near streak
    // carries more light in total than a mid one, so it still reads.
    expect(a(3) * w(3).blurPx).toBeGreaterThan(a(8) * w(8).blurPx);
    // Past the reference distance the alpha falls, and keeps falling: the
    // far drops are the curtain.
    expect(a(20)).toBeLessThan(a(STORM_RAIN.farRefM));
    expect(a(30)).toBeLessThan(a(20));
    expect(a(30)).toBeGreaterThan(0.23);
    expect(a(30)).toBeLessThan(0.29);
    expect(a(STORM_RAIN.fadeM)).toBeLessThan(0.45 * a(8));
    // Past the window the streak is gone, and inside the near fade too.
    expect(a(STORM_RAIN.fadeM * 1.25)).toBe(0);
    expect(a(STORM_RAIN.nearFadeM * 0.15)).toBe(0);
    // The size spread is narrow: the smallest drop keeps 80% of the largest.
    const big = rainStreakAlpha(8, STORM_RAIN, mpp, 1.25);
    const small = rainStreakAlpha(8, STORM_RAIN, mpp, 0.75);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(0.8 * big);
    // A gust sheet scales the alpha about its mean and never below zero.
    const g = STORM_RAIN.gustDepth;
    expect(rainStreakAlpha(8, STORM_RAIN, mpp, 1, 1)).toBeCloseTo((1 + g) * a(8), 9);
    expect(rainStreakAlpha(8, STORM_RAIN, mpp, 1, -1)).toBeCloseTo(Math.max(1 - g, 0) * a(8), 9);
  });

  it('the streak blend shows on the sky, shows more than twice as much on the sea, and thins into the horizon haze', () => {
    // three.js' ACES filmic fit as the viewer applies it after the linear
    // blend (its input and output matrices keep a gray gray), then sRGB.
    const rrt = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
    const aces = (x: number) => Math.min(Math.max(rrt(x / 0.6), 0), 1);
    const srgb = (y: number) => 255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055);
    const shown = (bg: number) => srgb(aces(bg));
    const mpp = rainMetersPerPixel(1, 55, 900);
    const delta = (bg: number, alpha: number) => srgb(aces(rainStreakOverBackground(bg, alpha, STORM_RAIN))) - shown(bg);
    const mid = rainStreakAlpha(8, STORM_RAIN, mpp);
    const far = rainStreakAlpha(30, STORM_RAIN, mpp);
    // The backgrounds, scene-linear: the 95 sRGB sky, the 109 sRGB band
    // just above the horizon, the 58 sRGB mid water in the judged crop.
    expect(shown(0.114)).toBeGreaterThan(92);
    expect(shown(0.114)).toBeLessThan(98);
    expect(shown(0.140)).toBeGreaterThan(106);
    expect(shown(0.140)).toBeLessThan(112);
    expect(shown(0.060)).toBeGreaterThan(55);
    expect(shown(0.060)).toBeLessThan(61);
    // A mid streak: +9 to +15 on the sky (the reference's brightest sky
    // streaks are +16), more than twice that on the sea, and about a third
    // of it in the bright band at the horizon, so the lines thin into the
    // haze.
    expect(delta(0.114, mid)).toBeGreaterThan(9);
    expect(delta(0.114, mid)).toBeLessThan(15);
    expect(delta(0.060, mid)).toBeGreaterThan(2.4 * delta(0.114, mid));
    expect(delta(0.140, mid)).toBeLessThan(0.5 * delta(0.114, mid));
    // A far streak is the curtain: about half the mid streak's lift.
    expect(delta(0.114, far)).toBeGreaterThan(4);
    expect(delta(0.114, far)).toBeLessThan(0.6 * delta(0.114, mid));
    // Round 1's blend toward 0.62 at alpha 0.35 put a 90-step bar on the sky.
    const white = srgb(aces(0.114 * 0.65 + 0.62 * 0.35)) - shown(0.114);
    expect(white).toBeGreaterThan(60);
  });

  it('meters per pixel is linear in distance and matches the pinhole model', () => {
    // 900 px over 2 tan(27.5 deg) at 1 m: 1.157 mm per pixel.
    expect(rainMetersPerPixel(1, 55, 900)).toBeCloseTo(0.001157, 5);
    expect(rainMetersPerPixel(40, 55, 900)).toBeCloseTo(40 * rainMetersPerPixel(1, 55, 900), 9);
  });
});

describe('the field wrap', () => {
  it('is periodic in the box, so t and t + one period give the same offset', () => {
    const v = rainVelocityMs(STORM_RAIN);
    const box = STORM_RAIN.boxM;
    const a = rainFieldOffsetM(v, box, 42);
    // Vertical period: box.y / fall speed. The other axes wrap on their own
    // periods, so compare each axis at its own period.
    const periodY = box.y / STORM_RAIN.fallSpeedMs;
    const b = rainFieldOffsetM(v, box, 42 + periodY);
    expect(b[1]).toBeCloseTo(a[1], 9);
  });

  it('stays inside [0, box) on every axis, including for negative velocity components', () => {
    const v: [number, number, number] = [-2.5, -7, -1.2];
    const box = { x: 96, y: 28, z: 100 };
    for (const t of [0, 0.5, 42, 1234.5, 86400]) {
      const o = rainFieldOffsetM(v, box, t);
      expect(o[0]).toBeGreaterThanOrEqual(0); expect(o[0]).toBeLessThan(box.x);
      expect(o[1]).toBeGreaterThanOrEqual(0); expect(o[1]).toBeLessThan(box.y);
      expect(o[2]).toBeGreaterThanOrEqual(0); expect(o[2]).toBeLessThan(box.z);
    }
  });

  it('is a pure function of time', () => {
    const v = rainVelocityMs(STORM_RAIN);
    expect(rainFieldOffsetM(v, STORM_RAIN.boxM, 42)).toEqual(rainFieldOffsetM(v, STORM_RAIN.boxM, 42));
  });

  it('the box ends where the window closes: its far face is at the end of the streak range', () => {
    // The box center is a third of the depth ahead of the eye (see `update`
    // in oceanRain.ts), so the far face is at 0.33 + 0.5 = 0.83 of the
    // depth. A drop past the window is transformed for nothing; a window
    // past the box is rain that is cut off before it ends.
    const farFace = STORM_RAIN.boxM.z * 0.83;
    const windowEnd = STORM_RAIN.fadeM * 1.25;
    expect(Math.abs(farFace - windowEnd)).toBeLessThan(1.5);
  });

  it('the box follows a high camera and stops 4 m under the sea for a low one', () => {
    const h = STORM_RAIN.boxM.y;
    // Eye level and deck: the floor sits 4 m under the mean sea.
    expect(rainBoxFloorM(1.6, h)).toBe(-4);
    expect(rainBoxFloorM(10, h)).toBe(-4);
    // Masthead and plan view: the camera is inside the box.
    const f46 = rainBoxFloorM(46, h);
    expect(f46).toBeLessThan(46);
    expect(f46 + h).toBeGreaterThan(46);
    const f140 = rainBoxFloorM(140, h);
    expect(f140).toBeLessThan(140);
    expect(f140 + h).toBeGreaterThan(140);
  });
});

describe('the murk', () => {
  it('reaches the cloud base straight up and the sea straight down', () => {
    expect(rainPathLengthM(1, 10, 400, 4000)).toBe(400);
    expect(rainPathLengthM(-1, 10, 400, 4000)).toBe(10);
  });

  it('grows toward the horizon and is capped there from both sides, so the two arms meet', () => {
    const up = rainPathLengthM(0.001, 10, 400, 4000);
    const down = rainPathLengthM(-0.001, 10, 400, 4000);
    expect(up).toBe(4000);
    expect(down).toBe(4000);
    expect(rainPathLengthM(0, 10, 400, 4000)).toBe(4000);
    expect(rainPathLengthM(0.5, 10, 400, 4000)).toBeCloseTo(800, 9);
  });

  it('keeps the deck legible through the sky-side rain and veils the sea as the reference measures', () => {
    // Sky side: the cloud base straight up is seen at over three quarters,
    // and at the sky cap the deck still shows through at a fifth.
    expect(rainTransmittance(400, STORM_RAIN.hazeExtinctionPerM)).toBeGreaterThan(0.75);
    expect(rainTransmittance(STORM_RAIN.hazeMaxPathM, STORM_RAIN.hazeExtinctionPerM)).toBeGreaterThan(0.18);
    // Sea side, from a 10 m eye: 2.6 degrees below the horizon is 220 m of
    // path and the reference water is about 80% veiled there; 8.7 degrees is
    // 66 m and about 50%.
    const veil = (deg: number) => 1 - rainTransmittance(
      rainPathLengthM(-Math.sin((deg * Math.PI) / 180), 10, 400, STORM_RAIN.hazeSeaMaxPathM),
      STORM_RAIN.hazeSeaExtinctionPerM,
    );
    expect(veil(2.6)).toBeGreaterThan(0.6);
    expect(veil(8.7)).toBeGreaterThan(0.25);
    expect(veil(8.7)).toBeLessThan(0.55);
    // The far water still ghosts through at the horizon line: the veil is
    // capped under 80% there, as the reference keeps its wave texture in
    // the 78 sRGB band at its horizon.
    expect(veil(0.05)).toBeLessThan(0.8);
    expect(veil(0.05)).toBeGreaterThan(0.7);
    expect(rainTransmittance(0, STORM_RAIN.hazeExtinctionPerM)).toBe(1);
  });
});

describe('the marks', () => {
  it('a splash age replays every period with its phase, and never leaves [0, period)', () => {
    const P = 0.45;
    const a = rainSplashAgeS(42, P, 0.3);
    expect(rainSplashAgeS(42 + P, P, 0.3)).toBeCloseTo(a, 9);
    for (const t of [0, 0.1, 42, 999.9]) {
      const age = rainSplashAgeS(t, P, 0.77);
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(P);
    }
  });

  it('the crown rises by 30 ms, holds, and is gone by 90 ms', () => {
    expect(rainCrownProfile(0)).toBe(0);
    expect(rainCrownProfile(0.03)).toBe(1);
    expect(rainCrownProfile(0.045)).toBe(1);
    expect(rainCrownProfile(0.09)).toBeCloseTo(0, 9);
    expect(rainCrownProfile(0.3)).toBe(0);
  });

  it('the ring launches at 20 ms and reaches full radius at the end of life', () => {
    expect(rainRingProfile(0.0, 0.45)).toBe(0);
    expect(rainRingProfile(0.019, 0.45)).toBe(0);
    expect(rainRingProfile(0.02 + 0.43 / 2, 0.45)).toBeCloseTo(0.5, 9);
    expect(rainRingProfile(0.45, 0.45)).toBe(1);
  });

  it('the rain slope variance for the water shader is 0 dry and capped at the measured 0.02', () => {
    expect(rainSlopeVariance(0)).toBe(0);
    expect(rainSlopeVariance(-5)).toBe(0);
    expect(rainSlopeVariance(25)).toBeCloseTo(0.0125, 9);
    expect(rainSlopeVariance(100)).toBe(0.02);
  });
});
