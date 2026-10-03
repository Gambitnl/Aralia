/**
 * @file refineLoop.test.ts — the three functional gates of the refinement loop.
 *
 * Gate 1: the scorer finds a deliberate floater and a deliberate sunken prop.
 * Gate 2: the corrector fixes the same scene.
 * Gate 3: an unfixable instance terminates at the budget and gets REPORTED.
 */
import { describe, expect, it } from 'vitest';
import {
  makeFieldSurfaceProbe,
  makeFlatSurfaceProbe,
  type SurfaceProbe,
} from '../../terrain/surfaceProbe';
import type { PlacedObject } from '../placedObject';
import { isPass, scorePlacement, scoreScene } from '../scorer';
import { formatFailures, refinePlacements } from '../refineLoop';
import { runPlacementGate } from '../gate';
import { DEFAULT_THRESHOLDS } from '../thresholds';

/** A 5 ft crate: 5 ft wide, 5 ft tall, flat base at local y = 0. */
function crate(id: string, x: number, y: number, z: number, overrides: Partial<PlacedObject> = {}): PlacedObject {
  return {
    id,
    speciesKey: 'prop-M',
    positionFt: { x, y, z },
    rotationRad: 0,
    scale: 1,
    localBounds: { minX: -2.5, minY: 0, minZ: -2.5, maxX: 2.5, maxY: 5, maxZ: 2.5 },
    ...overrides,
  };
}

describe('gate 1 — the scorer finds known-bad placements', () => {
  const ground: SurfaceProbe = makeFlatSurfaceProbe(0);

  it('flags a deliberate floater', () => {
    // 3 ft of air under the base. Nothing subtle.
    const score = scorePlacement(crate('floater', 0, 3, 0), ground);
    expect(score.failures).toContain('floater');
    expect(score.contactRatio).toBe(0);
    expect(score.penetrationFt).toBe(0);
  });

  it('flags a deliberate sunken prop', () => {
    const score = scorePlacement(crate('sunken', 0, -2, 0), ground);
    expect(score.failures).toContain('sunken');
    expect(score.penetrationFt).toBeCloseTo(2, 6);
  });

  it('passes a correctly seated prop', () => {
    const score = scorePlacement(crate('seated', 0, 0, 0), ground);
    expect(score.failures).toEqual([]);
    expect(score.contactRatio).toBe(1);
    expect(isPass(score)).toBe(true);
  });

  it('flags a scale error against the species range', () => {
    // A 40 ft crate. prop-M tops out at 10 ft plus 15% slack.
    const giant = crate('giant', 0, 0, 0, {
      localBounds: { minX: -2.5, minY: 0, minZ: -2.5, maxX: 2.5, maxY: 40, maxZ: 2.5 },
    });
    expect(scorePlacement(giant, ground).failures).toContain('scale-too-large');
  });

  it('never silently passes an unknown species', () => {
    const unknown = crate('mystery', 0, 0, 0, { speciesKey: 'not-in-the-table' });
    expect(scorePlacement(unknown, ground).failures).toContain('scale-unknown-species');
  });

  it('flags ground that cannot hold the object', () => {
    // A step under the footprint: half flat, half a 45 degree ramp.
    const step = makeFieldSurfaceProbe((x) => (x < 0 ? 0 : x), { epsilonXFt: 1, epsilonZFt: 1 });
    const score = scorePlacement(crate('on-step', 0, 0, 0), step);
    expect(score.supportSlopeVarianceRad2).toBeGreaterThan(
      DEFAULT_THRESHOLDS.maxSupportSlopeVarianceRad2,
    );
    expect(score.failures).toContain('unsupported');
  });

  it('scores a whole scene and separates the bad from the good', () => {
    const scene = [crate('a', 0, 3, 0), crate('b', 20, -2, 0), crate('c', 40, 0, 0)];
    const scores = scoreScene(scene, ground);
    expect(scores.map((s) => s.failures.length > 0)).toEqual([true, true, false]);
  });
});

describe('gate 2 — the corrector fixes them', () => {
  it('seats a floater and a sunken prop on flat ground', () => {
    const ground = makeFlatSurfaceProbe(0);
    const scene = [crate('floater', 0, 3, 0), crate('sunken', 20, -2, 0)];
    const before = scoreScene(scene, ground);
    expect(before.every((s) => s.failures.length > 0)).toBe(true);

    const report = refinePlacements(scene, ground);
    expect(report.failures).toEqual([]);
    expect(report.passedCount).toBe(2);
    // A pure vertical error is one transform edit. No ground was touched.
    expect(report.patches).toHaveLength(0);
    for (const o of report.outcomes) {
      expect(o.iterationsUsed).toBeLessThanOrEqual(2);
      expect(o.finalScore.contactRatio).toBe(1);
    }
  });

  it('seats an object on real relief', () => {
    // A gentle hill. The transform alone must find the seating height.
    const hill = makeFieldSurfaceProbe((x, z) => 4 * Math.sin(x / 60) + 3 * Math.cos(z / 80));
    const scene = [crate('on-hill', 30, 25, 40)];
    expect(isPass(scorePlacement(scene[0], hill))).toBe(false);
    const report = refinePlacements(scene, hill);
    expect(formatFailures(report)).toEqual([]);
  });

  it('co-deforms the ground when the transform is pinned', () => {
    // A dock post the town plan pinned 4 ft above the water line. Phase A has
    // no legal edit, so Phase B must lift the ground to it.
    const ground = makeFlatSurfaceProbe(0);
    const pinned = crate('dock-post', 0, 4, 0, { transformMutable: false });
    const report = refinePlacements([pinned], ground);
    expect(report.failures).toEqual([]);
    expect(report.patches.length).toBeGreaterThan(0);
    expect(report.patches[0]?.ownerId).toBe('dock-post');
    // 4 ft of lift at 1 ft per pass = 4 passes, inside the budget of 6.
    expect(report.outcomes[0]?.iterationsUsed).toBe(4);
  });

  it('rescales an object outside its species range', () => {
    const ground = makeFlatSurfaceProbe(0);
    const giant = crate('giant', 0, 0, 0, {
      localBounds: { minX: -2.5, minY: 0, minZ: -2.5, maxX: 2.5, maxY: 40, maxZ: 2.5 },
    });
    const report = refinePlacements([giant], ground);
    expect(report.failures).toEqual([]);
    expect(report.outcomes[0]?.finalScore.heightFt).toBeCloseTo(10, 6);
  });

  it('flattens a support failure the transform cannot cure', () => {
    const step = makeFieldSurfaceProbe((x) => (x < 0 ? 0 : x), { epsilonXFt: 1, epsilonZFt: 1 });
    const report = refinePlacements([crate('on-step', 0, 0, 0)], step);
    expect(formatFailures(report)).toEqual([]);
    expect(report.patches.length).toBeGreaterThan(0);
  });
});

describe('gate 3 — the budget holds and failures are reported', () => {
  it('terminates at the budget on an instance it cannot reach in time', () => {
    // Pinned 30 ft up. The ground may move, but only 1 ft per pass, so a
    // budget of 6 cannot close a 30 ft gap. It must STOP and REPORT.
    const ground = makeFlatSurfaceProbe(0);
    const stranded = crate('stranded', 0, 30, 0, { transformMutable: false });
    const report = refinePlacements([stranded], ground);

    expect(report.outcomes[0]?.iterationsUsed).toBe(DEFAULT_THRESHOLDS.iterationBudget);
    expect(report.outcomes[0]?.stopReason).toBe('budget-exhausted');
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]?.id).toBe('stranded');
    expect(report.failures[0]?.finalScore.failures).toContain('floater');
    expect(formatFailures(report)[0]).toContain('budget-exhausted');
  });

  it('stops at once when no legal correction exists', () => {
    const ground = makeFlatSurfaceProbe(0);
    const locked = crate('locked', 0, 12, 0, {
      transformMutable: false,
      groundMutable: false,
      scaleMutable: false,
    });
    const report = refinePlacements([locked], ground);
    expect(report.outcomes[0]?.stopReason).toBe('no-correction-available');
    // One iteration proves the corrector had nothing. It does not burn six.
    expect(report.outcomes[0]?.iterationsUsed).toBe(1);
    expect(report.failures).toHaveLength(1);
  });

  it('never reports a failing instance as passed', () => {
    const ground = makeFlatSurfaceProbe(0);
    const scene = [
      crate('good', 0, 0, 0),
      crate('stranded', 100, 30, 0, { transformMutable: false }),
    ];
    const report = refinePlacements(scene, ground);
    expect(report.passedCount).toBe(1);
    expect(report.failures.map((f) => f.id)).toEqual(['stranded']);
    expect(report.outcomes).toHaveLength(2);
  });

  it('catches an instance a neighbor un-seated', () => {
    // Two crates 3 ft apart on flat ground. The first is pinned high, so its
    // pad lifts ground the second one stands on.
    const ground = makeFlatSurfaceProbe(0);
    const scene = [
      crate('pinned', 0, 3, 0, { transformMutable: false }),
      crate('victim', 4, 0, 0),
    ];
    const report = refinePlacements(scene, ground);
    // Either the victim survives, or it is REPORTED. It is never hidden.
    for (const o of report.outcomes) {
      if (o.finalScore.failures.length > 0) {
        expect(report.failures.map((f) => f.id)).toContain(o.id);
      }
    }
    expect(report.failures.length).toBe(
      report.outcomes.filter((o) => o.finalScore.failures.length > 0).length,
    );
  });

  it('is bounded on every instance of a large scene', () => {
    const ground = makeFlatSurfaceProbe(0);
    const scene = Array.from({ length: 200 }, (_, i) =>
      crate(`c${i}`, i * 30, (i % 7) - 3, 0),
    );
    const report = refinePlacements(scene, ground);
    for (const o of report.outcomes) {
      expect(o.iterationsUsed).toBeLessThanOrEqual(report.budget);
    }
  });
});

describe('the gate wiring', () => {
  it('runs on all three surfaces with their own thresholds', () => {
    const ground = makeFlatSurfaceProbe(0);
    for (const surface of ['town', 'region', 'battlemap'] as const) {
      const res = runPlacementGate([crate('c', 0, 2, 0)], ground, {
        surface,
        report: () => {},
      });
      expect(res.failureLines).toEqual([]);
      expect(res.objects[0]?.positionFt.y).toBeCloseTo(0, 6);
    }
  });

  it('throws on the battle map when an instance cannot be fixed', () => {
    const ground = makeFlatSurfaceProbe(0);
    const stranded = crate('stranded', 0, 30, 0, {
      transformMutable: false,
      groundMutable: false,
    });
    expect(() =>
      runPlacementGate([stranded], ground, {
        surface: 'battlemap',
        throwOnFailure: true,
        report: () => {},
      }),
    ).toThrow(/unfixable placements/);
  });

  it('reports rather than throws by default', () => {
    const ground = makeFlatSurfaceProbe(0);
    const lines: string[] = [];
    const res = runPlacementGate(
      [crate('stranded', 0, 30, 0, { transformMutable: false, groundMutable: false })],
      ground,
      { surface: 'town', report: (l) => lines.push(l) },
    );
    expect(res.failureLines).toHaveLength(1);
    expect(lines.join('\n')).toContain('stranded');
  });
});
