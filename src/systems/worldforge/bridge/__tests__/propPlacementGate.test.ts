import { describe, it, expect } from 'vitest';
import {
  makeGroundWorldProbe,
  propLocalBounds,
  runPropPlacementGate,
  tiltedLowerHull,
} from '../propPlacementGate';
import { FEET_PER_METER } from '../../terrain/surfaceProbe';
import { fitToSurface, rejectReasonFor } from '../../terrain/surfaceProbe';
import { surfaceGateFor } from '../../props/catalog';
import { footprintSamples, hullYAt, type PlacedObject } from '../../placement/placedObject';
import { heightToMeters } from '@/systems/world3d/config';
import { GROUND_METERS_PER_CELL } from '../groundWorldAdapter';
import type { PropInstance } from '../../props/propSchema';

/**
 * WorldClaw wave 2 wiring. Two claims that were false before this wave:
 *  1. a GroundWorld yields a real `SurfaceProbe`, and it agrees with the ground
 *     the renderer draws (`heightToMeters` over the same grid);
 *  2. the surface fit a prop carries makes it MEET a slope. The tilt sign is the
 *     whole game here: turned the wrong way it doubles the gap instead of
 *     closing it, and the scene still renders without complaint.
 */

/** A ramp climbing along +X: encoded height grows by `step` per grid column. */
function rampGround(cols: number, rows: number, step: number) {
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights.push(c * step);
  return { heights, cols, rows };
}

describe('ground surface probe', () => {
  it('reads the rendered ground, in feet', () => {
    const g = rampGround(8, 8, 2);
    const probe = makeGroundWorldProbe(g)!;
    expect(probe).not.toBeNull();
    // Column 3 sits at 3 * GROUND_METERS_PER_CELL meters along X.
    const xFt = 3 * GROUND_METERS_PER_CELL * FEET_PER_METER;
    const sample = probe.sampleAt(xFt, 0);
    expect(sample.elevationFt).toBeCloseTo(heightToMeters(6) * FEET_PER_METER, 4);
    expect(sample.slopeRad).toBeGreaterThan(0);
  });

  it('returns null for a grid with no gradient, instead of a probe that passes everything', () => {
    expect(makeGroundWorldProbe({ heights: [0], cols: 1, rows: 1 })).toBeNull();
  });
});

describe('tilted lower hull', () => {
  it('closes the footprint gap on a consistent grade instead of widening it', () => {
    const g = rampGround(16, 16, 0.03);
    const probe = makeGroundWorldProbe(g)!;
    const gate = surfaceGateFor('boulder');
    const xFt = 6 * GROUND_METERS_PER_CELL * FEET_PER_METER;
    const zFt = 6 * GROUND_METERS_PER_CELL * FEET_PER_METER;
    const sample = probe.sampleAt(xFt, zFt);
    expect(rejectReasonFor(sample, gate)).toBeNull();
    const fit = fitToSurface(sample, gate);
    expect(fit.tiltRad).toBeGreaterThan(0);

    const bounds = propLocalBounds('M', gate.baseRadiusFt);
    const base: PlacedObject = {
      id: 'boulder#0',
      speciesKey: 'prop-M',
      positionFt: { x: xFt, y: fit.elevationFt - fit.sinkFt, z: zFt },
      rotationRad: 0.7,
      scale: 1,
      localBounds: bounds,
    };
    const spread = (o: PlacedObject) => {
      const gaps = footprintSamples(o).map(
        (s) => hullYAt(o, s) - probe.sampleAt(s.xFt, s.zFt).elevationFt,
      );
      return Math.max(...gaps) - Math.min(...gaps);
    };
    const hull = tiltedLowerHull(fit.tiltRad, fit.tiltAxis, base.rotationRad, bounds.maxX)!;
    expect(hull).toBeTypeOf('function');
    const tilted = spread({ ...base, lowerHullFt: hull });
    // The lean must REDUCE the gap the base spans. The inverted sign increases
    // it, which is exactly the bug this asserts against.
    expect(tilted).toBeLessThan(spread(base));
  });
});

describe('prop placement gate', () => {
  const prop = (defId: string, xM: number, zM: number): PropInstance => ({
    defId,
    xM,
    zM,
    rotationRad: 0.3,
    variation: { scale: 1, variant: 0 },
  });

  it('seats props on a real grade and reports the count it judged', () => {
    const g = rampGround(24, 24, 0.03);
    const probe = makeGroundWorldProbe(g)!;
    const props = [4, 6, 8, 10].map((c) =>
      prop('boulder', c * GROUND_METERS_PER_CELL, 8 * GROUND_METERS_PER_CELL),
    );
    const lines: string[] = [];
    const out = runPropPlacementGate(props, probe, {
      surface: 'town',
      groundMutable: false,
      report: (l) => lines.push(l),
    });
    expect(out.result).not.toBeNull();
    expect(out.result!.report.outcomes.length).toBe(props.length);
    // Every prop carries a baked base Y afterward, so the renderer never has to
    // re-sample the heightfield.
    for (const p of out.props) {
      expect(p.surface).toBeDefined();
      expect(Number.isFinite(p.surface!.groundYM)).toBe(true);
    }
  });

  it('runs no gate and claims no pass when there is no probe', () => {
    const out = runPropPlacementGate([prop('boulder', 1, 1)], null, {
      surface: 'region',
      groundMutable: false,
    });
    expect(out.result).toBeNull();
    expect(out.props[0].surface).toBeUndefined();
  });
});
