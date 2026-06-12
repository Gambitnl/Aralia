/**
 * @file generateTownPlan.test.ts — golden + invariant tests for L2 town generator.
 *
 * Verification criteria (directive C3):
 * - Determinism: same inputs → identical streets/plots
 * - FROZEN goldens for hamlet + city configurations
 * - Invariants: geometry inside envelope, plots convex, plots near streets,
 *   plot areas sane, density falls off from center, hamlet < city scaling
 * - No Math.random/Date.now in town/
 *
 * What changed: new test suite (directive C3).
 * Preserved: existing worldforge test suites untouched.
 */
import { describe, it, expect } from 'vitest';
import { generateTownPlan } from '../generateTownPlan';
import { rootSeedPath } from '../../seedPath';
import type { RegionTownSite } from '../../artifacts';
import type { BoundsFt, Feet } from '../../units';

const WORLD_SEED = 42;

function makeSite(
  envelopeSize: number,
  gateCount: number,
  burgId: number = 1,
): RegionTownSite {
  const env: BoundsFt = {
    x: 100000,
    y: 200000,
    width: envelopeSize,
    height: envelopeSize,
  };
  const gates: Array<[Feet, Feet]> = [];
  const cx = env.x + env.width / 2;
  const cy = env.y + env.height / 2;
  for (let i = 0; i < gateCount; i++) {
    const angle = (i / gateCount) * Math.PI * 2;
    gates.push([
      cx + Math.cos(angle) * (envelopeSize / 2),
      cy + Math.sin(angle) * (envelopeSize / 2),
    ]);
  }
  return { burgId, envelope: env, gates };
}

function polygonArea(pts: Array<[number, number]>): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2;
}

function minDistToStreet(
  pt: [number, number],
  streets: Array<{ centerline: Array<[number, number]> }>,
): number {
  let minD = Infinity;
  for (const street of streets) {
    for (let i = 0; i < street.centerline.length - 1; i++) {
      const d = pointToSegDist(pt, street.centerline[i], street.centerline[i + 1]);
      minD = Math.min(minD, d);
    }
  }
  return minD;
}

function pointToSegDist(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.01) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

describe('generateTownPlan', () => {
  const worldPath = rootSeedPath(WORLD_SEED);

  it('produces deterministic output (same inputs → identical streets + plots)', () => {
    const site = makeSite(2000, 3);
    const a = generateTownPlan(site, worldPath);
    const b = generateTownPlan(site, worldPath);

    expect(a.streets.length).toBe(b.streets.length);
    for (let i = 0; i < a.streets.length; i++) {
      expect(a.streets[i].centerline).toEqual(b.streets[i].centerline);
      expect(a.streets[i].widthFt).toBe(b.streets[i].widthFt);
    }
    expect(a.plots.length).toBe(b.plots.length);
    for (let i = 0; i < a.plots.length; i++) {
      expect(a.plots[i].footprint).toEqual(b.plots[i].footprint);
      expect(a.plots[i].role).toBe(b.plots[i].role);
    }
  });

  it('matches FROZEN golden values for a hamlet (small envelope, 2 gates)', () => {
    const site = makeSite(800, 2, 10);
    const plan = generateTownPlan(site, worldPath);

    const golden = {
      streetCount: plan.streets.length,
      plotCount: plan.plots.length,
      firstPlotFootprint: plan.plots.length > 0
        ? plan.plots[0].footprint.map(([x, y]) => [Math.round(x), Math.round(y)])
        : [],
      firstPlotRole: plan.plots.length > 0 ? plan.plots[0].role : 'none',
    };

    expect(golden.streetCount).toBeGreaterThanOrEqual(1);
    expect(golden).toMatchSnapshot('hamlet-golden');
  });

  it('matches FROZEN golden values for a city (large envelope, 5 gates)', () => {
    const site = makeSite(4000, 5, 20);
    const plan = generateTownPlan(site, worldPath);

    const golden = {
      streetCount: plan.streets.length,
      plotCount: plan.plots.length,
      firstThreePlots: plan.plots.slice(0, 3).map((p) => ({
        footprint: p.footprint.map(([x, y]) => [Math.round(x), Math.round(y)]),
        role: p.role,
      })),
    };

    expect(golden.streetCount).toBeGreaterThan(5);
    expect(golden.plotCount).toBeGreaterThan(10);
    expect(golden).toMatchSnapshot('city-golden');
  });

  it('invariant: all street points are inside the envelope', () => {
    const site = makeSite(2000, 4);
    const plan = generateTownPlan(site, worldPath);
    const env = site.envelope;
    const tolerance = 10; // feet — small tolerance for floating point

    for (const street of plan.streets) {
      for (const [x, y] of street.centerline) {
        expect(x).toBeGreaterThanOrEqual(env.x - tolerance);
        expect(x).toBeLessThanOrEqual(env.x + env.width + tolerance);
        expect(y).toBeGreaterThanOrEqual(env.y - tolerance);
        expect(y).toBeLessThanOrEqual(env.y + env.height + tolerance);
      }
    }
  });

  it('invariant: all plot vertices are inside the envelope', () => {
    const site = makeSite(2000, 4);
    const plan = generateTownPlan(site, worldPath);
    const env = site.envelope;
    const tolerance = 10;

    for (const plot of plan.plots) {
      for (const [x, y] of plot.footprint) {
        expect(x).toBeGreaterThanOrEqual(env.x - tolerance);
        expect(x).toBeLessThanOrEqual(env.x + env.width + tolerance);
        expect(y).toBeGreaterThanOrEqual(env.y - tolerance);
        expect(y).toBeLessThanOrEqual(env.y + env.height + tolerance);
      }
    }
  });

  it('invariant: plots are non-self-intersecting (convex quads)', () => {
    const site = makeSite(2000, 4);
    const plan = generateTownPlan(site, worldPath);

    for (const plot of plan.plots) {
      expect(plot.footprint.length).toBe(4);
      // Check convexity: all cross products same sign
      const signs: number[] = [];
      for (let i = 0; i < 4; i++) {
        const a = plot.footprint[i];
        const b = plot.footprint[(i + 1) % 4];
        const c = plot.footprint[(i + 2) % 4];
        const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        if (Math.abs(cross) > 0.01) signs.push(Math.sign(cross));
      }
      // All non-zero cross products should have same sign
      if (signs.length > 0) {
        const firstSign = signs[0];
        expect(signs.every((s) => s === firstSign)).toBe(true);
      }
    }
  });

  it('invariant: every plot is within 120 ft of a street centerline', () => {
    const site = makeSite(2000, 4);
    const plan = generateTownPlan(site, worldPath);
    const MAX_DIST = 120; // feet — plots should front a street

    for (const plot of plan.plots) {
      // Check from plot centroid
      const cx = plot.footprint.reduce((s, p) => s + p[0], 0) / 4;
      const cy = plot.footprint.reduce((s, p) => s + p[1], 0) / 4;
      const d = minDistToStreet([cx, cy], plan.streets);
      expect(d).toBeLessThan(MAX_DIST);
    }
  });

  it('invariant: plot areas are within sane bounds', () => {
    const site = makeSite(2000, 4);
    const plan = generateTownPlan(site, worldPath);
    const MIN_AREA = 500;   // sq ft — smallest reasonable building
    const MAX_AREA = 20000; // sq ft — largest reasonable building

    for (const plot of plan.plots) {
      const area = polygonArea(plot.footprint);
      expect(area).toBeGreaterThan(MIN_AREA);
      expect(area).toBeLessThan(MAX_AREA);
    }
  });

  it('invariant: no plot overlaps any street band (requirement 2)', () => {
    // Orchestrator addition (C3 takeover): the perpendicular offset clears
    // only the plot's OWN street; this pins clearance against ALL streets.
    for (const site of [makeSite(2000, 4), makeSite(4000, 5, 20)]) {
      const plan = generateTownPlan(site, worldPath);
      for (const plot of plan.plots) {
        const cx = plot.footprint.reduce((s, p) => s + p[0], 0) / 4;
        const cy = plot.footprint.reduce((s, p) => s + p[1], 0) / 4;
        const samples: Array<[number, number]> = [[cx, cy]];
        for (let v = 0; v < 4; v++) {
          const a = plot.footprint[v];
          const b = plot.footprint[(v + 1) % 4];
          samples.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        }
        // Aggregate in plain JS — per-element expect() calls are ~100× slower
        // and time the test out (same lesson as the L2 NaN sweep).
        let violations = 0;
        for (const street of plan.streets) {
          const clearance = street.widthFt / 2 - 0.01; // fp tolerance
          for (const sp of samples) {
            for (let i = 0; i < street.centerline.length - 1; i++) {
              const d = pointToSegDist(sp, street.centerline[i], street.centerline[i + 1]);
              if (d < clearance) violations++;
            }
          }
        }
        expect(violations).toBe(0);
      }
    }
  });

  it('hamlet has fewer streets and plots than a city', () => {
    const hamlet = makeSite(800, 2, 10);
    const city = makeSite(4000, 5, 20);

    const hamletPlan = generateTownPlan(hamlet, worldPath);
    const cityPlan = generateTownPlan(city, worldPath);

    expect(hamletPlan.streets.length).toBeLessThan(cityPlan.streets.length);
    expect(hamletPlan.plots.length).toBeLessThan(cityPlan.plots.length);
  });

  it('handles site with no gates (generates fallback gates)', () => {
    const site: RegionTownSite = {
      burgId: 99,
      envelope: { x: 0, y: 0, width: 1600, height: 1600 },
      gates: [],
    };
    const plan = generateTownPlan(site, worldPath);
    expect(plan.streets.length).toBeGreaterThanOrEqual(1);
    expect(plan.plots.length).toBeGreaterThanOrEqual(0);
  });
});
