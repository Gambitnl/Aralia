/**
 * Surface probe + gate — the stage-2 contract every scatter pass reads.
 */
import {
  aspectRadOf,
  fitToSurface,
  makeFieldSurfaceProbe,
  makeFlatSurfaceProbe,
  makeGridSurfaceProbe,
  makeSurfaceGateTally,
  normalFromGradient,
  rejectReasonFor,
  slopeFromGradient,
  type SurfaceGate,
} from '../surfaceProbe';

const deg = (d: number): number => (d * Math.PI) / 180;

describe('gradient math', () => {
  it('reads flat ground as zero slope with an up normal', () => {
    expect(slopeFromGradient(0, 0)).toBe(0);
    expect(normalFromGradient(0, 0)).toEqual([0, 1, 0]);
  });

  it('reads a 1:1 gradient as 45 degrees', () => {
    expect(slopeFromGradient(1, 0)).toBeCloseTo(Math.PI / 4, 10);
  });

  it('returns a unit normal that leans away from the uphill direction', () => {
    const n = normalFromGradient(1, 0);
    expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 10);
    expect(n[0]).toBeLessThan(0); // ground rises with +x, so the normal tips to -x
    expect(n[1]).toBeGreaterThan(0);
  });
});

describe('makeFieldSurfaceProbe', () => {
  it('recovers the slope of an analytic ramp', () => {
    // 1 ft of rise per 2 ft of run = 26.57 degrees.
    const probe = makeFieldSurfaceProbe((x) => x * 0.5);
    const s = probe.sampleAt(100, 0);
    expect(s.elevationFt).toBeCloseTo(50, 10);
    expect((s.slopeRad * 180) / Math.PI).toBeCloseTo(26.565, 3);
  });

  it('rejects a non-positive finite-difference step', () => {
    expect(() => makeFieldSurfaceProbe(() => 0, { epsilonXFt: 0 })).toThrow(/step must be positive/);
  });
});

describe('makeGridSurfaceProbe', () => {
  const ramp = (slopeDeg: number, cellFt = 10) => {
    const cols = 8, rows = 8;
    const elevationsFt = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) elevationsFt[r * cols + c] = c * cellFt * Math.tan(deg(slopeDeg));
    }
    return makeGridSurfaceProbe({ elevationsFt, cols, rows, cellSizeXFt: cellFt, cellSizeZFt: cellFt });
  };

  it('interpolates elevation between lattice samples', () => {
    const probe = ramp(45, 10); // 10 ft of rise per column
    expect(probe.sampleAt(15, 0).elevationFt).toBeCloseTo(15, 6);
  });

  it('recovers the ramp slope in the middle of the grid', () => {
    expect((ramp(30).sampleAt(35, 35).slopeRad * 180) / Math.PI).toBeCloseTo(30, 4);
  });

  it('keeps the true slope at the grid EDGE (no half-gradient seam rim)', () => {
    // Clamping outside samples would halve the central difference here and let
    // a rim of instances survive along a cliff's own chunk seam.
    expect((ramp(45).sampleAt(0, 30).slopeRad * 180) / Math.PI).toBeCloseTo(45, 4);
  });

  it('refuses a grid too small to hold a gradient', () => {
    expect(() =>
      makeGridSurfaceProbe({
        elevationsFt: new Float32Array(1),
        cols: 1,
        rows: 1,
        cellSizeXFt: 1,
        cellSizeZFt: 1,
      }),
    ).toThrow(/at least 2x2/);
  });

  it('refuses a grid with fewer samples than cols*rows', () => {
    expect(() =>
      makeGridSurfaceProbe({
        elevationsFt: new Float32Array(3),
        cols: 2,
        rows: 2,
        cellSizeXFt: 1,
        cellSizeZFt: 1,
      }),
    ).toThrow(/needs 4/);
  });
});

describe('aspect', () => {
  it('has no aspect on flat ground', () => {
    expect(aspectRadOf(makeFlatSurfaceProbe(12).sampleAt(0, 0))).toBeNull();
  });

  it('faces downhill', () => {
    // Ground rises with +x, so the slope faces -x, which is 3*PI/2.
    const s = makeFieldSurfaceProbe((x) => x).sampleAt(0, 0);
    expect(aspectRadOf(s)).toBeCloseTo((3 * Math.PI) / 2, 6);
  });
});

describe('the gate', () => {
  const tree: SurfaceGate = {
    minElevationFt: 10,
    maxElevationFt: 4000,
    maxSlopeRad: deg(35),
    maxTiltRad: deg(7),
    baseRadiusFt: 3,
  };

  it('keeps a candidate on tolerable ground', () => {
    expect(rejectReasonFor({ elevationFt: 500, slopeRad: deg(20), normal: [0, 1, 0] }, tree)).toBeNull();
  });

  it('rejects a candidate on a cliff', () => {
    expect(rejectReasonFor({ elevationFt: 500, slopeRad: deg(60), normal: [0, 1, 0] }, tree)).toBe('too-steep');
  });

  it('rejects a candidate below and above its elevation band', () => {
    expect(rejectReasonFor({ elevationFt: 2, slopeRad: 0, normal: [0, 1, 0] }, tree)).toBe('too-low');
    expect(rejectReasonFor({ elevationFt: 9000, slopeRad: 0, normal: [0, 1, 0] }, tree)).toBe('too-high');
  });

  it('applies an aspect preference only to sloped ground', () => {
    const gate: SurfaceGate = {
      maxSlopeRad: deg(35),
      maxTiltRad: deg(7),
      baseRadiusFt: 3,
      preferredAspectRad: 0, // likes ground facing +z
      aspectToleranceRad: deg(45),
      aspectOffChance: 0,
    };
    // A flat sample faces nowhere, so an aspect preference cannot reject it.
    expect(rejectReasonFor({ elevationFt: 500, slopeRad: 0, normal: [0, 1, 0] }, gate)).toBeNull();
    // Ground that drops toward +z faces +z — the preferred aspect. Kept.
    expect(rejectReasonFor(makeFieldSurfaceProbe((_x, z) => -z * 0.3).sampleAt(0, 0), gate)).toBeNull();
    // Ground that drops toward -z faces the wrong way. Dropped.
    expect(rejectReasonFor(makeFieldSurfaceProbe((_x, z) => z * 0.3).sampleAt(0, 0), gate)).toBe('wrong-aspect');
  });

  it('lets a wrong-facing candidate through when the roll beats the off-chance', () => {
    const gate: SurfaceGate = { ...tree, preferredAspectRad: 0, aspectToleranceRad: deg(10), aspectOffChance: 0.9 };
    const south = { elevationFt: 500, slopeRad: deg(20), normal: [0, 0.9, -0.4] as [number, number, number] };
    expect(rejectReasonFor(south, gate, 0.0)).toBeNull();      // roll below off-chance = kept
    expect(rejectReasonFor(south, gate, 0.95)).toBe('wrong-aspect'); // roll above = dropped
  });
});

describe('fitToSurface', () => {
  const rock: SurfaceGate = { maxSlopeRad: deg(45), maxTiltRad: deg(45), baseRadiusFt: 4, slopeScaleFloor: 0.8 };
  const tree: SurfaceGate = { maxSlopeRad: deg(35), maxTiltRad: deg(7), baseRadiusFt: 3 };

  it('lays a rock flat on the slope', () => {
    const fit = fitToSurface({ elevationFt: 0, slopeRad: deg(30), normal: normalFromGradient(Math.tan(deg(30)), 0) }, rock);
    expect((fit.tiltRad * 180) / Math.PI).toBeCloseTo(30, 6);
  });

  it('keeps a tree near-vertical on the same slope', () => {
    const fit = fitToSurface({ elevationFt: 0, slopeRad: deg(30), normal: normalFromGradient(Math.tan(deg(30)), 0) }, tree);
    expect((fit.tiltRad * 180) / Math.PI).toBeCloseTo(7, 6);
  });

  it('sinks by the drop the base spans, so nothing hovers', () => {
    const fit = fitToSurface({ elevationFt: 0, slopeRad: deg(30), normal: [0, 1, 0] }, rock);
    expect(fit.sinkFt).toBeCloseTo(0.5 * 4 * Math.tan(deg(30)), 10);
  });

  it('never sinks a point-footed instance', () => {
    const fit = fitToSurface({ elevationFt: 0, slopeRad: deg(30), normal: [0, 1, 0] }, { ...tree, baseRadiusFt: 0 });
    expect(fit.sinkFt).toBe(0);
  });

  it('shrinks toward the floor as the slope reaches the limit', () => {
    const flat = fitToSurface({ elevationFt: 0, slopeRad: 0, normal: [0, 1, 0] }, rock);
    const steep = fitToSurface({ elevationFt: 0, slopeRad: deg(45), normal: [0, 1, 0] }, rock);
    expect(flat.scaleMultiplier).toBeCloseTo(1, 10);
    expect(steep.scaleMultiplier).toBeCloseTo(0.8, 10);
  });

  it('returns a unit tilt axis', () => {
    const fit = fitToSurface({ elevationFt: 0, slopeRad: deg(20), normal: normalFromGradient(0.3, 0.4) }, rock);
    expect(Math.hypot(fit.tiltAxis[0], fit.tiltAxis[1])).toBeCloseTo(1, 10);
  });
});

describe('the tally', () => {
  it('counts every candidate exactly once and splits by reason', () => {
    const tally = makeSurfaceGateTally();
    tally.note(null);
    tally.note('too-steep');
    tally.note('too-steep');
    tally.note('too-high');
    const s = tally.stats();
    expect(s.considered).toBe(4);
    expect(s.kept).toBe(1);
    expect(s.rejected).toBe(3);
    expect(s.byReason['too-steep']).toBe(2);
    expect(s.rejectionRate).toBeCloseTo(0.75, 10);
  });

  it('reports a zero rate when nothing was considered', () => {
    expect(makeSurfaceGateTally().stats().rejectionRate).toBe(0);
  });
});
