/** Mechanism checks for supported finite liquid geometry. No native-water
 * appearance, freely retracting rims, or globally conserved air claim. */
import { describe, expect, it } from 'vitest';
import { buildFinitePatchLiquidMass, buildFinitePatchOperators, finitePatchConvection, finitePatchSurfaceForce, makeFinitePatchFixture, WaterfallFinitePatch } from '../waterfallFinitePatch';

function transform(p: Float64Array, angle: number, x = 0, y = 0) {
  const result = p.slice(), c = Math.cos(angle), s = Math.sin(angle);
  for (let j = 0; j < p.length; j += 2) { result[j] = c * p[j] - s * p[j + 1] + x; result[j + 1] = s * p[j] + c * p[j + 1] + y; }
  return result;
}
function dot(a: Float64Array, b: Float64Array) { return a.reduce((sum, v, i) => sum + v * b[i], 0); }
function mat(a: Float64Array, rows: number, cols: number, v: Float64Array) {
  return Float64Array.from({ length: rows }, (_, i) => v.reduce((sum, value, j) => sum + a[i * cols + j] * value, 0));
}
function transpose(a: Float64Array, rows: number, cols: number, v: Float64Array) {
  return Float64Array.from({ length: cols }, (_, j) => v.reduce((sum, value, i) => sum + a[i * cols + j] * value, 0));
}
const curved = new Float64Array([-1, 0, -.6, .05, -.2, .15, .2, .08, .6, -.02, 1, 0]);

describe('finite material pressure patch', () => {
  it('has the exact consistent-mass prolongation identity for a split material segment', () => {
    const coarse = buildFinitePatchLiquidMass(new Float64Array([.01, .02, .03]), 1000);
    const fine = buildFinitePatchLiquidMass(new Float64Array([.01, .01, .01, .03]), 1000);
    const prolongation = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, .5, .5, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let projected = 0;
      for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) projected += prolongation[a * 4 + i] * fine[a * 5 + b] * prolongation[b * 4 + j];
      expect(projected).toBeCloseTo(coarse[i * 4 + j], 13);
    }
  });

  it('splits material with exact liquid invariants and preserved labels without a physical pressure impulse', () => {
    const points = Array.from({ length: curved.length / 2 }, (_, j): [number, number] => [curved[2 * j], curved[2 * j + 1]]);
    const velocities = points.map((_, j): [number, number] => [.1 * Math.cos(j), .15 * Math.sin(j)]);
    const s = new WaterfallFinitePatch({ ambient: [.5, .1] }, { points, velocities, thickness: .002 });
    s.advanceTo(.002); const before = s.snapshot();
    const remap = s.refineSegments([1, 3])!; const after = s.snapshot();
    expect(after.time).toBe(before.time); expect(after.receipt.ticks).toBe(before.receipt.ticks);
    expect(after.receipt.liquidImpulse).toEqual(before.receipt.liquidImpulse);
    expect(after.receipt.gasInterfaceImpulse).toEqual(before.receipt.gasInterfaceImpulse);
    expect(after.receipt.supportImpulse).toEqual(before.receipt.supportImpulse);
    expect(remap.volumeError).toBeCloseTo(0, 14); expect(remap.linearMomentumError).toBeLessThan(1e-13);
    expect(Math.abs(remap.angularMomentumError)).toBeLessThan(1e-13);
    expect(Math.abs(remap.liquidKineticEnergyChange)).toBeLessThan(1e-13);
    expect(Math.abs(remap.capillaryEnergyChange)).toBeLessThan(1e-13);
    expect(after.receipt.liquidMomentum[0]).toBeCloseTo(before.receipt.liquidMomentum[0], 13);
    expect(after.receipt.liquidAngularMomentum).toBeCloseTo(before.receipt.liquidAngularMomentum, 13);
    expect(after.receipt.waterKineticEnergy).toBeCloseTo(before.receipt.waterKineticEnergy, 13);
    for (let j = 0; j < before.nodeIds.length; j++) {
      const index = after.nodeIds.indexOf(before.nodeIds[j]); expect(index).toBeGreaterThanOrEqual(0);
      expect(after.materialCoordinates[index]).toBe(before.materialCoordinates[j]);
      expect(after.positions[2 * index]).toBe(before.positions[2 * j]); expect(after.positions[2 * index + 1]).toBe(before.positions[2 * j + 1]);
      expect(after.velocities[2 * index]).toBe(before.velocities[2 * j]); expect(after.velocities[2 * index + 1]).toBe(before.velocities[2 * j + 1]);
      expect(after.remapInterpolatedMu[index]).toBe(before.mu[j]);
      expect(after.pressureMu[index]).toBe(before.pressureMu[j]);
    }
    expect(after.segmentVolumes[1]).toBe(before.segmentVolumes[1] / 2);
    expect(after.segmentVolumes[2]).toBe(before.segmentVolumes[1] / 2);
    expect(after.segmentRootIds[1]).toBe(before.segmentRootIds[1]); expect(after.segmentRootIds[2]).toBe(before.segmentRootIds[1]);
    expect(after.pressureTime).toBeNull(); expect(remap.postProjectionKinematicResidual).toBeLessThan(1e-12);
    expect(remap.maximumMuProjection).toBeGreaterThan(1e-8);
    expect(remap.gasEnergyChange).toBeCloseTo(remap.gasInterpolationEnergyChange + remap.gasProjectionEnergyChange, 13);
    expect(after.receipt.physicalDiagnosticEnergyChange).toBeCloseTo(before.receipt.physicalDiagnosticEnergyChange, 13);
  });

  it('uses split-only stretch and curvature indicators, with a bounded atomic stop', () => {
    const s = new WaterfallFinitePatch({ airDensity: 0, surfaceTension: 0, refinement: { enabled: true, maximumSegmentLength: .51, curvatureTolerance: 1, maximumPoints: 7 } }, {
      points: [[0, 0], [.5, 0], [1, 0], [1.5, 0]], velocities: [[0, 0], [.2, 0], [.2, 0], [0, 0]], thickness: .001,
    });
    s.advanceTo(.08); expect(s.snapshot().receipt.valid).toBe(true);
    expect(s.snapshot().receipt.refinement.addedPoints).toBeGreaterThan(0);
    const limit = new WaterfallFinitePatch({ refinement: { maximumPoints: 4 } }, { points: [[0, 0], [.5, 0], [1, 0], [1.5, 0]], thickness: .001 });
    const before = limit.snapshot(); expect(() => limit.refineSegments([1])).toThrow(/point limit/);
    expect(limit.snapshot().positions).toEqual(before.positions); expect(limit.snapshot().mu).toEqual(before.mu);
    const curvedRun = new WaterfallFinitePatch({ refinement: { enabled: true, maximumSegmentLength: 10, curvatureTolerance: .003, maximumPoints: 65 } }, {
      points: Array.from({ length: curved.length / 2 }, (_, j): [number, number] => [curved[2 * j], curved[2 * j + 1]]), thickness: .0001,
    });
    curvedRun.advanceTo(.002); expect(curvedRun.snapshot().receipt.valid).toBe(true);
    expect(curvedRun.snapshot().receipt.refinement.addedPoints).toBeGreaterThan(0);
    expect(curvedRun.snapshot().receipt.refinement.maximumCurvatureIndicator).toBeLessThanOrEqual(1.01);
  });

  it('compares an adaptive calm trajectory with a fixed finer control at matched material labels', () => {
    const initial = makeFinitePatchFixture({ points: 9, length: 2, thickness: .001, amplitude: .005, wavelength: 1, envelopeWidth: .3 });
    const adaptive = new WaterfallFinitePatch({ airDensity: 0, dt: .002,
      refinement: { enabled: true, maximumSegmentLength: .126, curvatureTolerance: .0005, maximumPoints: 33 } }, initial);
    const fixed = new WaterfallFinitePatch({ airDensity: 0, dt: .002, refinement: { maximumPoints: 33 } }, initial);
    fixed.refineSegments(Array.from({ length: 8 }, (_, j) => j));
    fixed.refineSegments(Array.from({ length: 16 }, (_, j) => j));
    adaptive.advanceTo(.05); fixed.advanceTo(.05);
    const a = adaptive.snapshot(), f = fixed.snapshot(); expect(a.receipt.valid).toBe(true); expect(f.receipt.valid).toBe(true);
    let squareError = 0;
    for (let j = 0; j < f.materialCoordinates.length; j++) {
      const coordinate = f.materialCoordinates[j]; let left = 0;
      while (left < a.materialCoordinates.length - 2 && a.materialCoordinates[left + 1] < coordinate) left++;
      const fraction = (coordinate - a.materialCoordinates[left]) / (a.materialCoordinates[left + 1] - a.materialCoordinates[left]);
      for (let axis = 0; axis < 2; axis++) {
        const value = (1 - fraction) * a.positions[2 * left + axis] + fraction * a.positions[2 * left + 2 + axis];
        squareError += (value - f.positions[2 * j + axis]) ** 2;
      }
    }
    expect(Math.sqrt(squareError / f.materialCoordinates.length)).toBeLessThan(.0002);
    expect(a.receipt.refinement.operations).toBeGreaterThan(0);
    // This short calm control is a regression gate, not acceptance of the
    // stronger moving-air case or proof that adaptive morphology converges.
  });

  it('keeps straight same-thickness material valid under recursive nonuniform subdivision below h', () => {
    const s = new WaterfallFinitePatch({ refinement: { maximumPoints: 129 } }, { points: [[0, 0], [1, 0], [2, 0], [3, 0]], thickness: .1 });
    for (let j = 0; j < 5; j++) s.refineSegments([1]);
    const after = s.snapshot(); expect(after.receipt.valid).toBe(true);
    expect(after.receipt.maximumThicknessRatio).toBeGreaterThan(1); expect(after.receipt.thicknessSpacingWarning).toBe(true);
    expect(after.receipt.maximumCurvatureThickness).toBe(0);
    expect(after.receipt.volume).toBeCloseTo(.3, 14);
  });

  it('retains gentle fixed-curve curvature and contact diagnostics under collinear subdivision', () => {
    const points = Array.from({ length: curved.length / 2 }, (_, j): [number, number] => [curved[2 * j], curved[2 * j + 1]]);
    const s = new WaterfallFinitePatch({ refinement: { maximumPoints: 65 } }, { points, thickness: .0001 });
    const before = s.snapshot();
    for (let j = 0; j < 3; j++) s.refineSegments(Array.from({ length: s.snapshot().lengths.length }, (_, i) => i));
    const after = s.snapshot(); expect(after.receipt.valid).toBe(before.receipt.valid);
    expect(after.receipt.maximumAveragedCurvatureThickness).toBeCloseTo(before.receipt.maximumAveragedCurvatureThickness, 11);
    expect(after.receipt.maximumSharpBendThickness).toBeCloseTo(before.receipt.maximumSharpBendThickness, 11);
  });

  it('keeps a finite-thickness parallel hairpin contact rejected while a separated branch stays valid under splits', () => {
    const make = (gap: number) => new WaterfallFinitePatch({ maximumCurvatureThickness: 100, refinement: { maximumPoints: 65 } }, {
      points: [[0, 0], [1, 0], [1, gap], [0, gap]], thickness: .002,
    });
    const contact = make(.001); expect(contact.snapshot().receipt.failure).toMatch(/self-contact/);
    // A fresh subdivided inventory must expose the same nonlocal parallel
    // minima, even though arbitrary endpoint-only selection could miss them.
    const refinedContact = new WaterfallFinitePatch({ maximumCurvatureThickness: 100 }, {
      points: [[0, 0], [.2, 0], [.7, 0], [1, 0], [1, .001], [.8, .001], [.3, .001], [0, .001]], thickness: .002,
    });
    expect(refinedContact.snapshot().receipt.failure).toMatch(/self-contact/);
    const separated = make(.003); expect(separated.snapshot().receipt.valid).toBe(true);
    separated.refineSegments([0, 1, 2]); expect(separated.snapshot().receipt.valid).toBe(true);
  });

  it('keeps a tight sub-probe bend rejected even when averaged turning looks acceptable', () => {
    const s = new WaterfallFinitePatch({}, { points: [[-1, 0], [.001, 0], [.001, .001], [1, .001]], thickness: .000333 });
    const receipt = s.snapshot().receipt;
    expect(receipt.maximumAveragedCurvatureThickness).toBeLessThan(.2);
    expect(receipt.maximumSharpBendThickness).toBeGreaterThan(.2);
    expect(receipt.failure).toMatch(/sharp-bend/);
  });

  it('preserves the log kernel under rigid translation and rotation and rotates capillary forces', () => {
    const original = buildFinitePatchOperators(curved, 4), changed = buildFinitePatchOperators(transform(curved, .71, 3, -2), 4);
    for (let i = 0; i < original.K.length; i++) expect(changed.K[i]).toBeCloseTo(original.K[i], 11);
    const force = finitePatchSurfaceForce(curved, curved, .072), rotatedForce = finitePatchSurfaceForce(transform(curved, .71, 3, -2), transform(curved, .71, 3, -2), .072);
    const expected = transform(force, .71);
    for (let i = 0; i < force.length; i++) expect(rotatedForce[i]).toBeCloseTo(expected[i], 12);
  });

  it('has symmetric positive gas inertia and exact adjoint pressure work on curved geometry', () => {
    const g = buildFinitePatchOperators(curved, 4), m = g.interior;
    const mu = new Float64Array([.1, -.3, .2, .15]);
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) expect(g.K[i * m + j]).toBeCloseTo(g.K[j * m + i], 14);
    expect(dot(mu, mat(g.K, m, m, mu))).toBeGreaterThan(0);
    const velocity = Float64Array.from({ length: curved.length }, (_, i) => Math.sin(i * 1.3));
    const weakVelocity = mat(g.N, m, curved.length, velocity), pressureForce = transpose(g.N, m, curved.length, mu);
    expect(dot(velocity, pressureForce)).toBeCloseTo(dot(weakVelocity, mu), 14);
    const rotated = buildFinitePatchOperators(transform(curved, -.45), 4);
    const rotatedPressure = transpose(rotated.N, m, curved.length, mu), expected = transform(pressureForce, -.45);
    for (let i = 0; i < expected.length; i++) expect(rotatedPressure[i]).toBeCloseTo(expected[i], 12);
  });

  it('integrates touching collinear panel logarithms against an independent exact formula', () => {
    const p = new Float64Array([0, 0, .3, 0, .8, 0, 1.4, 0]);
    const g = buildFinitePatchOperators(p, 4);
    const primitive = (x: number) => x === 0 ? 0 : .5 * x * x * Math.log(x) - .75 * x * x;
    const expected = -(primitive(.8) - primitive(.3) - primitive(.5)) / (.3 * .5 * 2 * Math.PI);
    expect(g.logKernel[1]).toBeCloseTo(expected, 8);
    expect(g.logKernel[0]).toBeCloseTo((1.5 - Math.log(.3)) / (2 * Math.PI), 14);
  });

  it('recovers the infinite-depth two-face operator in the padded flat interior', () => {
    const n = 65, length = 12, k = Math.PI, p = new Float64Array(2 * n);
    for (let j = 0; j < n; j++) p[2 * j] = length * (j / (n - 1) - .5);
    const g = buildFinitePatchOperators(p, 4), mu = Float64Array.from({ length: n - 2 }, (_, i) => {
      const x = p[2 * (i + 1)]; return Math.exp(-((x / 2) ** 2)) * Math.cos(k * x);
    });
    const response = mat(g.K, n - 2, n - 2, mu);
    // A Gaussian-modulated cosine has exponentially little negative-frequency
    // content here. In its central region |D|mu is k times the cosine plus the
    // envelope-derivative sine term; this comes from the continuum Fourier DN.
    const expected = Float64Array.from({ length: n - 2 }, (_, i) => {
      const x = p[2 * (i + 1)], envelope = Math.exp(-((x / 2) ** 2));
      return .5 * envelope * (k * Math.cos(k * x) - x / 2 * Math.sin(k * x));
    });
    const weakExpected = mat(g.basisMass, n - 2, n - 2, expected);
    let squareError = 0, squareExpected = 0;
    for (let i = 0; i < n - 2; i++) if (Math.abs(p[2 * (i + 1)]) < 1) {
      squareError += (response[i] - weakExpected[i]) ** 2; squareExpected += weakExpected[i] ** 2;
    }
    expect(Math.sqrt(squareError / squareExpected)).toBeLessThan(.06);
  });

  it('retains exact material volume while stretching changes segment thickness', () => {
    const s = new WaterfallFinitePatch({ airDensity: 0, surfaceTension: 0 }, {
      points: [[0, 0], [.5, 0], [1, 0], [1.5, 0]], velocities: [[0, 0], [.1, 0], [.1, 0], [0, 0]],
      segmentVolumes: [.005, .008, .006],
    });
    const before = s.snapshot(); s.advanceTo(.1); const after = s.snapshot();
    expect(after.receipt.failure).toBeNull(); expect(after.receipt.volume).toBe(before.receipt.volume);
    expect(after.lengths[0]).toBeCloseTo(.51, 12); expect(after.thickness[0]).toBeCloseTo(.005 / .51, 12);
    expect(after.thickness[0]).toBeLessThan(before.thickness[0]);
    for (let j = 0; j < after.lengths.length; j++) expect(after.lengths[j] * after.thickness[j]).toBeCloseTo(after.segmentVolumes[j], 14);
  });

  it('has exact capillary work and conserved no-air energy with fixed support accounting', () => {
    const s = new WaterfallFinitePatch({ airDensity: 0 }, makeFinitePatchFixture({ points: 17, amplitude: .03, thickness: .003 }));
    const before = s.snapshot(); s.advanceTo(.1); const after = s.snapshot(), r = after.receipt;
    expect(r.valid).toBe(true); expect(r.capillaryWorkResidual).toBeLessThan(1e-12);
    expect(Math.abs(r.diagnosticEnergyChange)).toBeLessThan(1e-10);
    expect(r.waterKineticEnergy).toBeGreaterThan(0); expect(r.capillaryEnergy).toBeLessThan(before.receipt.capillaryEnergy);
    expect(r.impulseResidual).toBeLessThan(1e-10);
    for (let axis = 0; axis < 2; axis++) expect(r.liquidImpulse[axis] + r.gasInterfaceImpulse[axis] - r.capillaryImpulse[axis] - r.supportImpulse[axis]).toBeCloseTo(0, 11);
    expect(after.positions[0]).toBe(before.positions[0]); expect(after.positions[after.positions.length - 2]).toBe(before.positions[before.positions.length - 2]);
  });

  it('applies a gas-event velocity impulse without rewriting positions or past history', () => {
    const a = new WaterfallFinitePatch(), b = new WaterfallFinitePatch();
    a.advanceTo(.01); b.advanceTo(.01); const before = b.snapshot(); b.recordAmbient(.02, [3, 0]);
    expect(b.snapshot().positions).toEqual(before.positions);
    a.advanceTo(.018); b.advanceTo(.018); expect(b.snapshot().positions).toEqual(a.snapshot().positions);
    a.advanceTo(.02); b.advanceTo(.02);
    expect(b.snapshot().positions).toEqual(a.snapshot().positions);
    expect(b.snapshot().velocities).not.toEqual(a.snapshot().velocities);
    expect(b.snapshot().pressureTime).toBeNull(); expect(b.snapshot().receipt.impulseResidual).toBeLessThan(1e-10);
    a.advanceTo(.04); b.advanceTo(.04); expect(b.snapshot().positions).not.toEqual(a.snapshot().positions);
    expect(() => b.recordAmbient(.01, [0, 0])).toThrow(/past/);
  });

  it('translates a curved sheet with exactly matched uniform air and water without spontaneous motion', () => {
    const velocity: [number, number] = [.7, -.2];
    const s = new WaterfallFinitePatch({ ambient: velocity, surfaceTension: 0 }, makeFinitePatchFixture({ points: 13, amplitude: .1, thickness: .001, velocity }));
    const before = s.snapshot(); s.advanceTo(.02); const after = s.snapshot();
    expect(after.receipt.valid).toBe(true);
    for (let j = 0; j < after.positions.length; j++) {
      expect(after.positions[j]).toBeCloseTo(before.positions[j] + .02 * velocity[j % 2], 12);
      expect(after.velocities[j]).toBeCloseTo(velocity[j % 2], 12);
    }
    expect(Math.max(...after.mu.map(Math.abs))).toBeLessThan(1e-12);
  });

  it('evolves finite curved geometry with positive thickness and converged pressure without clamping', () => {
    const s = new WaterfallFinitePatch({ ambient: [2, 0] }, makeFinitePatchFixture({ points: 17, amplitude: .12, thickness: .002 }));
    const before = s.snapshot(); s.advanceTo(.03); const after = s.snapshot(), r = after.receipt;
    expect(r.valid).toBe(true); expect(after.positions).not.toEqual(before.positions);
    expect(after.positions.every(Number.isFinite)).toBe(true); expect(r.minimumThickness).toBeGreaterThan(0);
    expect(r.nonlinearResidual).toBeLessThan(1e-9); expect(r.pressureResidual).toBeLessThan(1e-9);
    expect(r.kinematicResidual).toBeLessThan(1e-10); expect(r.capillaryWorkResidual).toBeLessThan(1e-12);
    expect(r.gasPerturbationEnergy).toBeGreaterThan(0);
    const convection = finitePatchConvection(after.pressurePositions, after.pressureVelocity, after.pressureMu, after.pressureAmbient);
    for (let j = 0; j < after.mu.length; j++) expect(after.pressure[j]).toBeCloseTo(1.2 * (after.pressureMaterialDerivative[j] + convection[j]), 8);
  });

  it('includes induced curved-air convection and preserves it under a rigid rotation', () => {
    const mu = new Float64Array([0, .1, -.2, .15, .05, 0]);
    const velocity = new Float64Array(curved.length), ambient: [number, number] = [0, 0];
    const conv = finitePatchConvection(curved, velocity, mu, ambient);
    // With zero prescribed air and water velocity, any nonzero term must come
    // from the induced gas motion, which an ambient-only closure would miss.
    expect(Math.max(...conv.map(Math.abs))).toBeGreaterThan(.0001);
    const rotated = finitePatchConvection(transform(curved, .7, 2, -3), velocity, mu, ambient);
    for (let j = 0; j < mu.length; j++) expect(rotated[j]).toBeCloseTo(conv[j], 11);
  });

  it('rotates the complete moving-pressure dynamics, not only the static kernel', () => {
    const points = (p: Float64Array) => Array.from({ length: p.length / 2 }, (_, j): [number, number] => [p[2 * j], p[2 * j + 1]]);
    const angle = .45, ambient: [number, number] = [.5, .2], rotatedAmbient = transform(new Float64Array(ambient), angle);
    const original = new WaterfallFinitePatch({ dt: .001, ambient }, { points: points(curved), thickness: .001 });
    const rotated = new WaterfallFinitePatch({ dt: .001, ambient: [rotatedAmbient[0], rotatedAmbient[1]] }, { points: points(transform(curved, angle, 2, -1)), thickness: .001 });
    original.advanceTo(.01); rotated.advanceTo(.01);
    expect(original.snapshot().receipt.valid).toBe(true); expect(rotated.snapshot().receipt.valid).toBe(true);
    const expected = transform(original.snapshot().positions, angle, 2, -1), actual = rotated.snapshot().positions;
    for (let j = 0; j < expected.length; j++) expect(actual[j]).toBeCloseTo(expected[j], 10);
  });

  it('stops a nonconvergent midpoint solve with the previous material state preserved', () => {
    const s = new WaterfallFinitePatch({ ambient: [3, 0], dt: .01, maximumIterations: 2, solverTolerance: 1e-16 }, makeFinitePatchFixture({ points: 13, amplitude: .1, thickness: .001 }));
    const before = s.snapshot(); s.advanceTo(.01); const after = s.snapshot();
    expect(after.receipt.failure).toMatch(/did not converge/); expect(after.time).toBe(0);
    expect(after.positions).toEqual(before.positions); expect(after.velocities).toEqual(before.velocities);
    expect(after.receipt.iterations).toBe(2); expect(after.receipt.nonlinearResidual).toBeGreaterThan(1e-16);
  });

  it('stops on initial self-contact and leaves unsupported topology intact', () => {
    const s = new WaterfallFinitePatch({}, { points: [[-1, 0], [1, 1], [-1, 1], [1, 0]], thickness: .001 });
    const before = s.snapshot(); expect(before.receipt.failure).toMatch(/self-contact/);
    s.advanceTo(1); expect(s.snapshot().positions).toEqual(before.positions); expect(s.snapshot().time).toBe(0);
  });

  it('rejects adjacent overlapping panels even when small thickness passes the curvature bound', () => {
    const s = new WaterfallFinitePatch({}, { points: [[0, 0], [1, 0], [2, 0], [1.5, 0]], thickness: .001 });
    expect(s.snapshot().receipt.failure).toMatch(/Adjacent.*overlap/);
    const before = s.snapshot(); s.advanceTo(.1);
    expect(s.snapshot().time).toBe(0); expect(s.snapshot().positions).toEqual(before.positions);
  });

  it('rejects an intersecting pressure midpoint even with valid start and end geometries', () => {
    // These two finite polylines do not cross. Their linear midpoint does.
    // This checks one sampled midpoint, not the continuously swept path.
    const points: [number, number][] = [[-1, -.5], [.3, .1], [.9, 1.3], [-1, .8]];
    const end: [number, number][] = [[-1.2, 1.6], [-1.1, -.1], [-1.7, 1.1], [-1, -1.1]];
    const s = new WaterfallFinitePatch({ dt: 1, airDensity: 0, surfaceTension: 0 }, {
      points, velocities: points.map((point, j) => [end[j][0] - point[0], end[j][1] - point[1]]), thickness: .00001,
    });
    const before = s.snapshot(); expect(before.receipt.valid).toBe(true);
    s.advanceTo(1); const after = s.snapshot();
    expect(after.receipt.failure).toMatch(/Pressure midpoint: Liquid self-contact/);
    expect(after.time).toBe(0); expect(after.positions).toEqual(before.positions);
    expect(after.velocities).toEqual(before.velocities);
  });
});
