/** Checks light and event-position limits without a renderer. These references
 * expose energy errors that a white waterfall screenshot could conceal. */
import { describe, expect, it } from 'vitest';
import { waterfallOpticalSegment, waterfallSkyBasis, waterfallSkyIrradiance, waterfallTwoStream } from '@/components/World3D/water/riverWaterfallView';

describe('waterfall homogeneous transport', () => {
  it('preserves transparent, absorption-only, and scattering-only limits', () => {
    expect(waterfallOpticalSegment(0, 0, 2)).toEqual({ transmission: 1, scattered: 0, absorbed: 0, eventMean: 1 });
    const absorption = waterfallOpticalSegment(0, 0.6, 2);
    expect(absorption.transmission).toBeCloseTo(Math.exp(-1.2), 12);
    expect(absorption.scattered).toBe(0);
    expect(absorption.absorbed + absorption.transmission).toBeCloseTo(1, 12);
    const scattering = waterfallOpticalSegment(12, 0, 0.3);
    expect(scattering.absorbed).toBe(0);
    expect(scattering.scattered + scattering.transmission).toBeCloseTo(1, 12);
  });

  it('conserves incident energy with absorption and obeys slab subdivision', () => {
    const whole = waterfallOpticalSegment(150, 0.4, 0.03);
    const half = waterfallOpticalSegment(150, 0.4, 0.015);
    expect(whole.transmission + whole.scattered + whole.absorbed).toBeCloseTo(1, 12);
    expect(whole.transmission).toBeCloseTo(half.transmission ** 2, 12);
    expect(whole.scattered).toBeCloseTo(half.scattered * (1 + half.transmission), 12);
    expect(whole.absorbed).toBeCloseTo(half.absorbed * (1 + half.transmission), 12);
  });

  it('places thick first events near entry and stays finite in thin and empty segments', () => {
    for (const tau of [0, 1e-12, 1e-6, 0.009999, 0.01, 1, 20, 1000, 1e8]) {
      const result = waterfallOpticalSegment(tau, 0, 1);
      expect(Number.isFinite(result.eventMean)).toBe(true);
      expect(result.eventMean).toBeGreaterThanOrEqual(0);
      expect(result.eventMean).toBeLessThanOrEqual(0.5);
    }
    expect(waterfallOpticalSegment(1e-8, 0, 1).eventMean).toBeCloseTo(0.5, 8);
    expect(waterfallOpticalSegment(1500, 0, 2).eventMean).toBeCloseTo(1 / 1500, 12);
    expect(waterfallOpticalSegment(1500, 0, 0)).toEqual({ transmission: 1, scattered: 0, absorbed: 0, eventMean: 0 });
  });

  it('matches numerical first-event moments away from limiting cases', () => {
    for (const sigma of [0.1, 1, 10]) {
      let mass = 0; let moment = 0;
      for (let i = 0; i < 2000; i += 1) {
        const s = (i + 0.5) / 2000; const weight = sigma * Math.exp(-sigma * s) / 2000;
        mass += weight; moment += s * weight;
      }
      expect(waterfallOpticalSegment(sigma, 0, 1).eventMean).toBeCloseTo(moment / mass, 5);
    }
  });
});

describe('phase-integrated waterfall upper sky', () => {
  const mass = (viewY: number) => waterfallSkyBasis(viewY).reduce((sum, cell) => sum + cell.mass, 0);

  it('keeps half the phase mass for horizontal views and the correct vertical limits', () => {
    expect(mass(0)).toBeCloseTo(0.5, 3);
    // Analytic integral of g=.75 HG over the forward hemisphere is 14/15.
    expect(mass(-1)).toBeCloseTo(14 / 15, 2);
    expect(mass(1)).toBeCloseTo(1 / 15, 3);
  });

  it('preserves complementary hemispheres, bounded energy, and continuous table interpolation', () => {
    for (const y of [-1, -0.83, -0.4, 0, 0.27, 0.64, 1]) {
      expect(mass(y)).toBeGreaterThan(0);
      expect(mass(y)).toBeLessThan(1);
      expect(mass(y) + mass(-y)).toBeCloseTo(1, 2);
      for (const cell of waterfallSkyBasis(y)) {
        expect(Math.hypot(...cell.direction)).toBeCloseTo(1, 6);
        expect(cell.direction[1]).toBeGreaterThan(0);
        expect(cell.zenithMix).toBeGreaterThanOrEqual(0);
        expect(cell.zenithMix).toBeLessThanOrEqual(1);
      }
    }
    expect(Math.abs(mass(0.1) - mass(0.10001))).toBeLessThan(0.0001);
  });

  it('removes fixed world-azimuth energy bias while rotating actual ray directions', () => {
    const cells = waterfallSkyBasis(0);
    for (const azimuth of [0, 0.3, 1.1, 2.7, 4.9]) {
      const axis = [Math.cos(azimuth), Math.sin(azimuth)];
      let constantSky = 0;
      for (const cell of cells) {
        const x = axis[0] * cell.direction[0] - axis[1] * cell.direction[2];
        const z = axis[1] * cell.direction[0] + axis[0] * cell.direction[2];
        expect(Math.hypot(x, cell.direction[1], z)).toBeCloseTo(1, 6);
        constantSky += cell.mass;
      }
      expect(constantSky).toBeCloseTo(0.5, 3);
    }
  });
});

describe('conservative local waterfall slab', () => {
  it('has vacuum, pure absorption, and conservative thick limits', () => {
    const vacuum = waterfallTwoStream(0, 0);
    expect(vacuum.reflection).toBe(0);
    expect(vacuum.transmission).toBe(1);
    expect(vacuum.absorption).toBe(0);
    const absorption = waterfallTwoStream(0, 0.7);
    expect(absorption.reflection).toBe(0);
    expect(absorption.transmission).toBeCloseTo(Math.exp(-1.4), 12);
    expect(absorption.conditionalReflection).toBe(0);
    expect(absorption.conditionalTransmission).toBeCloseTo(0, 12);
    expect(absorption.conditionalAbsorption).toBeCloseTo(1, 12);
    const opaque = waterfallTwoStream(1e8, 0);
    expect(opaque.reflection).toBeCloseTo(1, 6);
    expect(opaque.transmission).toBeCloseTo(0, 6);
    expect(opaque.absorption).toBeCloseTo(0, 12);
  });

  it('conserves R+T+A and its conditional collision budget across optical depths', () => {
    for (const s of [0, 1e-10, 0.01, 1, 100, 1e8]) for (const a of [0, 1e-10, 0.01, 10, 1e6]) {
      const slab = waterfallTwoStream(s, a);
      for (const value of Object.values(slab)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1 + 1e-10);
      }
      expect(slab.reflection + slab.transmission + slab.absorption).toBeCloseTo(1, 10);
      if (s + a > 0) expect(slab.conditionalReflection + slab.conditionalTransmission + slab.conditionalAbsorption).toBeCloseTo(1, 10);
    }
  });

  it('matches subdivision of a homogeneous layer, including internal reflections', () => {
    for (const [s, a] of [[1, 0], [3, 0.1], [0.2, 0.7]]) {
      const half = waterfallTwoStream(s / 2, a / 2); const whole = waterfallTwoStream(s, a);
      const denominator = 1 - half.reflection ** 2;
      expect(whole.reflection).toBeCloseTo(half.reflection + half.transmission ** 2 * half.reflection / denominator, 9);
      expect(whole.transmission).toBeCloseTo(half.transmission ** 2 / denominator, 9);
    }
  });

  it('stays finite as g approaches one and reduces to forward transmission without absorption', () => {
    for (const g of [0, 0.75, 0.99999, 1]) {
      const slab = waterfallTwoStream(1000, 0, g);
      expect(slab.reflection + slab.transmission).toBeCloseTo(1, 12);
      expect(slab.absorption).toBeCloseTo(0, 12);
    }
    const forward = waterfallTwoStream(1000, 0, 1);
    expect(forward.reflection).toBe(0);
    expect(forward.transmission).toBe(1);
  });

  it('preserves uniform illumination and full beam extinction without adding source orders', () => {
    const incoming = 3.4;
    for (const s of [0, 1e-8, 0.1, 10, 1e6]) {
      const slab = waterfallTwoStream(s, 0); const beam = Math.exp(-s);
      const redirected = (1 - beam) * (slab.conditionalReflection + slab.conditionalTransmission) * incoming;
      expect(beam * incoming + redirected).toBeCloseTo(incoming, 10);
    }
    // An absorption-only body cannot redirect any boundary illumination.
    const slab = waterfallTwoStream(0, 0.4); const beam = Math.exp(-0.4);
    const redirected = (1 - beam) * (slab.conditionalReflection + slab.conditionalTransmission) * incoming;
    expect(redirected).toBeCloseTo(0, 12);
    expect(beam * incoming + redirected).toBeCloseTo(Math.exp(-0.4) * incoming, 12);
  });

  it('integrates the shared upper-sky gradient into bounded front/back boundary flux', () => {
    const up = waterfallSkyIrradiance(1); const down = waterfallSkyIrradiance(-1); const side = waterfallSkyIrradiance(0);
    expect(up.frontHorizon).toBe(1); expect(up.backHorizon).toBe(0);
    expect(up.frontZenith).toBeCloseTo(4 / 5, 4); expect(up.backZenith).toBe(0);
    expect(down.backHorizon).toBe(1); expect(down.frontHorizon).toBe(0);
    expect(side.frontHorizon).toBe(0.5); expect(side.backHorizon).toBe(0.5);
    expect(side.frontZenith).toBeCloseTo(side.backZenith, 10);
    for (const y of [-1, -0.3, 0, 0.71, 1]) {
      const flux = waterfallSkyIrradiance(y); const opposite = waterfallSkyIrradiance(-y);
      expect(flux.frontHorizon).toBeCloseTo(opposite.backHorizon, 7);
      expect(flux.frontZenith).toBeCloseTo(opposite.backZenith, 7);
      expect(flux.frontZenith).toBeGreaterThanOrEqual(0);
      expect(flux.frontZenith).toBeLessThanOrEqual(flux.frontHorizon);
    }
  });
});
