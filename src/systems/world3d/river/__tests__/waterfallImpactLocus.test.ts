/** Native quadratic strike geometry receipts; finite support stays qualified. */
import { expect, it } from 'vitest';
import { getWaterfallContactSurfaces } from '../waterfallContactFlow';
import { waterfallImpactLocus } from '../waterfallImpactLocus';
import { WaterfallContactFilm } from '../waterfallContactFilm';

const native = { q: 1.5, width: 10, depth: .7, speed: 1.5 / 7, top: 78, pool: 18 };
const spatial = { rowCount: 16, spanKnots: Array.from({ length: 7 }, (_, i) => (i / 6 - .5) * 10) };

it('samples the native quadratic strike curve on the actual plane', () => {
  const source = { q: 1.5, width: 10, depth: .7, speed: 1.5 / 7, top: 78, pool: 18 };
  const points = waterfallImpactLocus(source, getWaterfallContactSurfaces()[0], 1 / 60, 20000, spatial);
  expect(points).toHaveLength(13);
  expect(points[0][2]).toBe(-5); expect(points.at(-1)![2]).toBe(5);
  for (const p of points) {
    expect(p[1]).toBeCloseTo(63.675 - .65 * p[0] + .22 * p[2], 10);
    expect(p[1]).toBeCloseTo(77.65 - .5 * 9.81 * (p[0] / source.speed) ** 2, 10);
  }
});

it('fails with an insufficient flight horizon instead of guessing strike geometry', () => {
  expect(() => waterfallImpactLocus(native, getWaterfallContactSurfaces()[0], 1 / 60, 4, spatial)).toThrow('impact-locus-flight-capacity');
});

it('keeps fixed spatial mesh identity independent of temporal partition and source-off history', () => {
  const surface = getWaterfallContactSurfaces()[0];
  const a = waterfallImpactLocus(native, surface, 1 / 60, 20000, spatial);
  const b = waterfallImpactLocus(native, surface, 1 / 120, 40000, spatial);
  expect(a).toEqual(b);
  const film = new WaterfallContactFilm(surface);
  film.configureJunction({ locus: a, spanKnots: spatial.spanKnots });
  const saved = film.saveState(), restored = new WaterfallContactFilm(surface);
  restored.restoreState(saved);
  expect(restored.saveState().junctionGeometry).toEqual(saved.junctionGeometry);
  expect(restored.snapshot().cells).toEqual(film.snapshot().cells);
  expect(film.snapshot().nz).toBe(22);
  const rows = film.snapshot().cells.filter(c => c.id % film.nx === 0);
  expect(Math.min(...rows.map(c => c.corners[3][2] - c.corners[0][2]))).toBeCloseTo(1 / 6, 14);
});

it('bounds spatial chord displacement by the analytic second derivative', () => {
  const surface = getWaterfallContactSurfaces()[0], points = waterfallImpactLocus(native, surface, 1 / 60, 20000, spatial);
  const u = native.speed, g = 9.81, a = -.65, b = .22, yb = 77.65, c = 63.675;
  const xAt = (z: number) => u * (-a * u + Math.sqrt((a * u) ** 2 + 2 * g * (yb - c - b * z))) / g;
  let maximumError = 0;
  for (let k = 1; k < points.length; k++) {
    const p0 = points[k - 1], p1 = points[k], width = p1[2] - p0[2];
    const curvature = u * g * b * b / ((a * u) ** 2 + 2 * g * (yb - c - b * p1[2])) ** 1.5;
    const bound = width * width * curvature / 8;
    for (let i = 1; i < 32; i++) {
      const f = i / 32, z = p0[2] + width * f, error = Math.abs(xAt(z) - (p0[0] + (p1[0] - p0[0]) * f));
      expect(error).toBeLessThanOrEqual(bound);
      maximumError = Math.max(maximumError, error * Math.sqrt(1 + a * a));
    }
  }
  expect(maximumError).toBeCloseTo(7.6518e-6, 9);
});
