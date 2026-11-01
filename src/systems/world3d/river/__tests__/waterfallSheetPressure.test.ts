/** Independent continuum dispersion checks assess this linear mechanism only.
 * They do not establish a realistic waterfall, breakup, or gas-wall momentum.
 */
import { describe, expect, it } from 'vitest';
import { WaterfallSheetPressure } from '../waterfallSheetPressure';

const length = 1, mode = 2, amplitude = .0001, k = 2 * Math.PI * mode / length;
const rho = 1.2, mass = 1, sigma = .072, depth = .25;
const continuumC = 1 / (k * Math.tanh(k * depth));
const continuumMass = mass + 2 * rho * continuumC;
const fine = { cells: 128, gasRows: 128, dt: .0005 };
const atMode = (s: WaterfallSheetPressure) => s.snapshot().spectra.find(spectrum => spectrum.mode === mode)!;

describe('linear two-face sheet pressure mechanism', () => {
  it('transmits the independently predicted pressure impulse of a one-sided wind step', () => {
    const s = new WaterfallSheetPressure({ ...fine, dt: .0001 }, [{ mode, amplitude }]);
    s.advanceTo(.01); const before = s.snapshot();
    s.recordAirSpeed(.01, [3, 0]);
    expect(s.snapshot()).toEqual(before);
    s.advanceTo(.010000001); const after = s.snapshot();
    // x=1/8 is a quarter wave: eta_x=-k*A. Integrate unsteady
    // Bernoulli through the step; do not use the solver's modal response.
    const expectedJump = rho * continuumC * 3 * k * before.displacement[0] / continuumMass;
    expect((after.velocity[16] - before.velocity[16]) / expectedJump).toBeCloseTo(1, 2);
    expect(after.displacement[16]).toBeCloseTo(before.displacement[16], 10);
    expect(after.receipt.impulsePairResidual).toBeLessThan(1e-10);
  });

  it('includes the initial gas kinetic energy required by a sheared interface', () => {
    const calm = new WaterfallSheetPressure(fine, [{mode, amplitude}]);
    const moving = new WaterfallSheetPressure({...fine, airSpeed:[3,-3]}, [{mode, amplitude}]);
    const gasEnergy = length / 4 * 2 * rho * continuumC * (3 * k * amplitude) ** 2;
    const difference = moving.snapshot().receipt.energy - calm.snapshot().receipt.energy;
    expect(difference / gasEnergy).toBeCloseTo(1, 2);
  });

  it('matches the finite-depth zero-shear capillary period and conserves perturbation energy', () => {
    const omega = Math.sqrt(2 * sigma * k * k / continuumMass);
    const s = new WaterfallSheetPressure(fine, [{ mode, amplitude }]);
    const energy = s.snapshot().receipt.energy;
    s.advanceTo(Math.PI / omega);
    expect(s.snapshot().displacement[0] / amplitude).toBeCloseTo(-1, 3);
    s.advanceTo(2);
    expect(s.snapshot().receipt.energy / energy).toBeCloseTo(1, 10);
    expect(s.snapshot().receipt.failure).toBeNull();
  });

  it('matches asymmetric two-face dispersion including the convective sign', () => {
    const upper = .4, lower = -.2;
    const convective = rho * continuumC * (upper + lower) * k;
    const stiffness = 2 * sigma * k * k - rho * continuumC * (upper * upper + lower * lower) * k * k;
    const omega = (convective + Math.sqrt(convective * convective + continuumMass * stiffness)) / continuumMass;
    const s = new WaterfallSheetPressure({ ...fine, airSpeed: [upper, lower] }, [
      { mode, amplitude }, { mode, amplitude: 0, velocity: amplitude * omega, phase: -Math.PI / 2 },
    ]);
    s.advanceTo(.15);
    expect(s.snapshot().displacement[0] / amplitude).toBeCloseTo(Math.cos(omega * .15), 2);
    expect(s.snapshot().displacement[16] / amplitude).toBeCloseTo(Math.cos(k * 16 / 128 - omega * .15), 2);
    const receipt = s.snapshot().receipt;
    expect(receipt.laplaceResidual).toBeLessThan(1e-10);
    expect(receipt.interfaceResidual).toBeLessThan(1e-10);
    expect(receipt.dynamicResidual).toBeLessThan(1e-10);
    expect(receipt.impulsePairResidual).toBeLessThan(1e-10);
  });

  it('recovers independently predicted instability for opposing gas streams', () => {
    const u = 3;
    const growth = Math.sqrt((2 * rho * continuumC * u * u * k * k - 2 * sigma * k * k) / continuumMass);
    const s = new WaterfallSheetPressure({ ...fine, airSpeed: [u, -u] }, [{ mode, amplitude }]);
    s.advanceTo(.05);
    expect(atMode(s).amplitude / amplitude).toBeCloseTo(Math.cosh(growth * .05), 2);
    expect(atMode(s).amplitude).toBeGreaterThan(amplitude);
    expect(s.snapshot().receipt.validLinear).toBe(true);
  });

  it('refines sheet spacing, gas spacing, and midpoint timestep toward a continuum prediction', () => {
    const time = .19, omega = Math.sqrt(2 * sigma * k * k / continuumMass);
    const expected = amplitude * Math.cos(omega * time);
    const error = (cells: number, gasRows: number, dt: number) => {
      const s = new WaterfallSheetPressure({ cells, gasRows, dt }, [{ mode, amplitude }]);
      s.advanceTo(time); return Math.abs(s.snapshot().displacement[0] - expected);
    };
    expect(error(128, 128, .0005)).toBeLessThan(error(16, 128, .0005) / 20);
    // Gas discretization converges to the continuum added mass. Compare against
    // a nearly converged gas solve on the same sheet to remove sheet error.
    const value = (gasRows: number, dt: number) => {
      const s = new WaterfallSheetPressure({ cells: 128, gasRows, dt }, [{ mode, amplitude }]);
      s.advanceTo(time); return s.snapshot().displacement[0];
    };
    const reference = value(512, .0001);
    expect(Math.abs(value(64, .0001) - reference)).toBeLessThan(Math.abs(value(8, .0001) - reference) / 20);
    const temporalReference = value(128, .00005);
    expect(Math.abs(value(128, .002) - temporalReference)).toBeLessThan(Math.abs(value(128, .008) - temporalReference) / 8);
  });

  it('keeps past water state intact while future gas events alter causal motion', () => {
    const baseline = new WaterfallSheetPressure(), changed = new WaterfallSheetPressure();
    baseline.advanceTo(.05); changed.advanceTo(.05);
    const before = changed.snapshot(); changed.recordAirSpeed(.0735, [3, -3]);
    expect(changed.snapshot()).toEqual(before);
    baseline.advanceTo(.07); changed.advanceTo(.07);
    expect(changed.snapshot().displacement).toEqual(baseline.snapshot().displacement);
    baseline.advanceTo(.12); changed.advanceTo(.12);
    expect(atMode(changed).amplitude).toBeGreaterThan(atMode(baseline).amplitude);
    expect(() => changed.recordAirSpeed(.1, [0, 0])).toThrow();
  });

  it('reports the opposite pressure impulses after accounting for capillary impulse', () => {
    const s = new WaterfallSheetPressure({ airSpeed: [.4, -.2] }); s.advanceTo(.1);
    const snapshot = s.snapshot(), r = snapshot.receipt;
    expect(Math.max(...snapshot.pressureUpper.map(Math.abs))).toBeGreaterThan(0);
    expect(Math.max(...snapshot.pressureLower.map(Math.abs))).toBeGreaterThan(0);
    for (let j = 0; j < snapshot.x.length; j++) {
      expect(r.waterImpulse[j] + r.gasImpulse[j] - r.capillaryImpulse[j]).toBeCloseTo(0, 12);
      expect(snapshot.thickness[j]).toBe(.001);
    }
  });

  it('matches the physical normal velocity on both faces at the reported midpoint', () => {
    const s = new WaterfallSheetPressure({ airSpeed: [.4, -.2] });
    expect(s.snapshot().midpointTime).toBeNull();
    s.advanceTo(.01); const v = s.snapshot(), n = v.x.length, dx = 1 / n;
    expect(v.midpointTime).toBeCloseTo(.0095, 12);
    for (let j = 0; j < n; j++) {
      const slope = (v.midpointDisplacement[(j + 1) % n] - v.midpointDisplacement[(j + n - 1) % n]) / (2 * dx);
      expect(v.gasNormalUpper[j]).toBeCloseTo(v.midpointVelocity[j] + .4 * slope, 12);
      expect(v.gasNormalLower[j]).toBeCloseTo(v.midpointVelocity[j] - .2 * slope, 12);
    }
  });

  it('rejects long-wave displacement that exceeds the fixed gas-domain approximation', () => {
    const s = new WaterfallSheetPressure({ length: 100 }, [{ mode: 1, amplitude: .03 }]);
    expect(s.snapshot().receipt.maxSlope).toBeLessThan(.1);
    expect(s.snapshot().receipt.relativeDisplacement).toBeCloseTo(.12, 12);
    expect(s.snapshot().receipt.validLinear).toBe(false);
    expect(s.snapshot().receipt.failure).toMatch(/gas depth/);
    s.advanceTo(1); expect(s.snapshot().time).toBe(0);
  });

  it('rejects volume-changing mean modes and stops at the declared linear limit', () => {
    expect(() => new WaterfallSheetPressure({}, [{ mode: 0, amplitude }])).toThrow(/mean/);
    const s = new WaterfallSheetPressure({ airSpeed: [8, -8], maximumSlope: .01 });
    s.advanceTo(1);
    expect(s.snapshot().receipt.validLinear).toBe(false);
    expect(s.snapshot().time).toBeLessThan(1);
    const stopped = s.snapshot(); s.advanceTo(2); expect(s.snapshot()).toEqual(stopped);
  });

  it('preserves an exactly unperturbed sheet without perpetual procedural forcing', () => {
    const s = new WaterfallSheetPressure({ airSpeed: [3, -2] }, []); s.advanceTo(.2);
    expect(Array.from(s.snapshot().displacement)).toEqual(new Array(32).fill(0));
    expect(s.snapshot().receipt.energy).toBe(0);
  });
});
