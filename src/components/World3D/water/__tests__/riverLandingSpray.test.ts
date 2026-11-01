/** The landing spray law (2026-10-25): puffs follow landing energy, a landing
 * counts once, and fine mist rises to 0.3 of the drop (the headwaters law). */
import { describe, expect, it } from 'vitest';
import { LANDING_SPRAY, LandingSprayField, type SprayLanding } from '../riverLandingSpray';

const landing = (id: number, volumeM3: number, speed: number, dropM: number, time = 0): SprayLanding =>
  ({ id, at: [0, 0, 0], velocity: [1, -speed, 0], volumeM3, dropM, time });

describe('landing spray', () => {
  it('makes one puff per 25 kJ of landing energy and carries the rest', () => {
    const f = new LandingSprayField();
    // 0.1 m^3 at 31.3 m/s (a 50 m free fall): 0.5 * 1000 * 0.1 * (1 + 31.3^2) = 49,035 J.
    const e = 0.5 * 1000 * 0.1 * (1 + 31.3 ** 2);
    expect(f.add([landing(1, .1, 31.3, 50)], 0)).toBe(Math.floor(e / LANDING_SPRAY.joulesPerPuff));
    // The same landing again adds nothing; a second one uses the carried fraction.
    expect(f.add([landing(1, .1, 31.3, 50)], 0)).toBe(0);
    expect(f.add([landing(2, .1, 31.3, 50)], 0)).toBe(Math.floor(2 * e / LANDING_SPRAY.joulesPerPuff) - Math.floor(e / LANDING_SPRAY.joulesPerPuff));
  });
  it('makes almost nothing for a slow, small spill', () => {
    const f = new LandingSprayField();
    expect(f.add([landing(1, .004, 1.5, .5)], 0)).toBe(0);
  });
  it('lifts fine mist to at most 0.3 of the drop and lets splash fall back', () => {
    const f = new LandingSprayField();
    f.add(Array.from({ length: 40 }, (_, i) => landing(i + 1, .2, 31.3, 50)), 0);
    expect(f.count).toBeGreaterThan(30);
    const at: [number, number, number] = [0, 0, 0];
    let topFine = 0, coarseLanded = true;
    for (let k = 0; k < f.count; k++) {
      const coarse = f.motion[k * 8 + 7] > 0;
      for (let t = 0; t < 8; t += .05) {
        const puff = f.puffAt(k, t, at); if (!puff) continue;
        if (!coarse) topFine = Math.max(topFine, at[1]);
        else if (t > f.born[k] + f.life[k] - .06 && at[1] > 3) coarseLanded = false;
      }
    }
    expect(topFine).toBeGreaterThan(5);
    expect(topFine).toBeLessThan(.3 * 50 * 1.35 + .1);
    expect(coarseLanded).toBe(true);
  });
  it('keeps at most the cap alive, replacing the oldest', () => {
    const f = new LandingSprayField();
    f.add(Array.from({ length: 400 }, (_, i) => landing(i + 1, 1, 40, 200)), 0);
    expect(f.count).toBe(LANDING_SPRAY.cap);
  });
});
