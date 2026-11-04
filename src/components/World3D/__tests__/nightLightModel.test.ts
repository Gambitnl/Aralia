/**
 * The night light model (GG-594 follow-up, "Adapt a little at night") must
 * stay close to the street levels the meter measured, and must put night far
 * enough under day for the meter to tell them apart.
 */
import { describe, expect, it } from 'vitest';
import { NIGHT_LIGHT_FIT, streetLog2At } from '../nightLightModel';

describe('night light model', () => {
  it('matches the measured street level at every calibration hour within 0.4 stop', () => {
    let sq = 0;
    for (const [hour, measured] of NIGHT_LIGHT_FIT.CALIBRATION) {
      const err = streetLog2At(hour) - measured;
      expect(Math.abs(err)).toBeLessThan(0.4);
      sq += err * err;
    }
    expect(Math.sqrt(sq / NIGHT_LIGHT_FIT.CALIBRATION.length)).toBeLessThan(0.2);
  });

  it('puts the night street about two stops under the noon street', () => {
    const gap = streetLog2At(13) - streetLog2At(23);
    expect(gap).toBeGreaterThan(1.5);
    expect(gap).toBeLessThan(3);
  });

  it('is finite and continuous over the whole day', () => {
    let last = streetLog2At(0);
    for (let h = 0.1; h <= 24; h += 0.1) {
      const v = streetLog2At(h);
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v - last)).toBeLessThan(0.3);
      last = v;
    }
  });
});
