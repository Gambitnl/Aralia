/**
 * @file multiLinkLegIk.test.ts — multi-link legs hold their link lengths.
 *
 * A leg of two links goes through `solveKnee`, which is exact. A leg of three
 * or more links used to place its joints along a quadratic bezier by CURVE
 * PARAMETER, not by arc length, so the drawn links never matched the lengths
 * the plan asked for: the limb stretched and squashed as the foot moved.
 *
 * `posePlanChain` now seeds from the same bezier and hands the result to
 * FABRIK, which holds every link at its true length. These tests walk the
 * driver through a stride and check the drawn segments against the plan.
 *
 * No fixture uses a leg past two links, but the plan language allows 1–8, so
 * every generated arthropod lands on this path.
 */

import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { compilePlan } from '../textPlan/compilePlan';
import { PLAN_FIXTURES } from '../textPlan/fixtures';
import { createGaitDriver, type LocomotionState } from '../three/gaits';
import type { BodySegment } from '../types';
import { registerAllParts } from '../parts';

registerAllParts();

const compiled = compilePlan(PLAN_FIXTURES.jointedCrawler);
const planSpec = compiled.planSpec!;

function driver() {
  return createGaitDriver('plan', compiled.frame, planSpec);
}

function collectSegments(d: ReturnType<typeof createGaitDriver>): Map<string, BodySegment> {
  const segs = new Map<string, BodySegment>();
  d.buildBody({
    seg: (id, ax, ay, az, bx, by, bz, r0, r1) => segs.set(id, { id, ax, ay, az, bx, by, bz, r0, r1 }),
    ball: () => {},
    box: () => {},
  });
  return segs;
}

function segmentLength(s: BodySegment): number {
  return new Vector3(s.ax, s.ay, s.az).distanceTo(new Vector3(s.bx, s.by, s.bz));
}

/** Every leg chain in the compiled spec, with its planned link lengths. */
const legChains = planSpec.chains.filter((c) => c.kind === 'leg');

describe('multi-link leg IK', () => {
  it('compiles legs with more than two links', () => {
    expect(legChains.length).toBeGreaterThan(0);
    for (const chain of legChains) expect(chain.links.length).toBe(4);
  });

  it('draws every link at its planned length while walking', () => {
    const d = driver();
    const walk: LocomotionState = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.1 };

    // Step through a full stride; the foot travels its whole arc.
    for (let step = 0; step < 24; step++) {
      d.update(step / 30, 1 / 30, walk);
      const segs = collectSegments(d);

      for (const chain of legChains) {
        for (let j = 0; j < chain.links.length; j++) {
          const seg = segs.get(`${chain.id}.${j}`);
          expect(seg, `missing segment ${chain.id}.${j}`).toBeDefined();
          // 1 mm of slack covers the solver tolerance; the bezier was out by
          // whole centimeters on the same rig.
          expect(segmentLength(seg!)).toBeCloseTo(chain.links[j].lenM, 3);
        }
      }
    }
  });

  it('keeps link lengths at rest too', () => {
    const d = driver();
    d.update(0, 1 / 30, { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 0 });
    const segs = collectSegments(d);

    for (const chain of legChains) {
      for (let j = 0; j < chain.links.length; j++) {
        expect(segmentLength(segs.get(`${chain.id}.${j}`)!)).toBeCloseTo(chain.links[j].lenM, 3);
      }
    }
  });

  it('never folds a joint back through the limb', () => {
    const d = driver();
    const walk: LocomotionState = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 1.6 };

    for (let step = 0; step < 24; step++) {
      d.update(step / 30, 1 / 30, walk);
      const segs = collectSegments(d);

      for (const chain of legChains) {
        for (let j = 1; j < chain.links.length; j++) {
          const prev = segs.get(`${chain.id}.${j - 1}`)!;
          const cur = segs.get(`${chain.id}.${j}`)!;
          const a = new Vector3(prev.bx - prev.ax, prev.by - prev.ay, prev.bz - prev.az).normalize();
          const b = new Vector3(cur.bx - cur.ax, cur.by - cur.ay, cur.bz - cur.az).normalize();
          const bendDeg = (a.angleTo(b) * 180) / Math.PI;
          // The joint cone is 75 degrees; allow a degree of solver slack.
          expect(bendDeg).toBeLessThanOrEqual(76);
        }
      }
    }
  });

  it('produces finite joints throughout the stride', () => {
    const d = driver();
    const walk: LocomotionState = { position: new Vector3(), heading: new Vector3(0, 0, 1), speed: 2.4 };

    for (let step = 0; step < 24; step++) {
      d.update(step / 30, 1 / 30, walk);
      for (const s of collectSegments(d).values()) {
        for (const v of [s.ax, s.ay, s.az, s.bx, s.by, s.bz]) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
