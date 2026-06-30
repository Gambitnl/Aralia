import { makeWorldFeetNoise } from '../worldFeetNoise';

const SEED = 12345;
const SPAN = 12; // feet per lattice node, mirrors generateLocal's detail-a span

describe('worldFeetNoise (Stage 5 S5.2 — continuous detail across cell boundaries)', () => {
  it('is a PURE function of world position — two independent instances agree everywhere', () => {
    // Simulate two adjacent cells generating terrain independently: each builds its
    // own noise instance. A world-position-indexed lattice must give identical
    // values at the SAME world point from both — this is what kills the seam.
    const cellA = makeWorldFeetNoise(SEED, SPAN);
    const cellB = makeWorldFeetNoise(SEED, SPAN);
    for (const [fx, fy] of [[0, 0], [37.5, 812.25], [-450.1, 1234.9], [9999, -7777]] as const) {
      expect(cellB(fx, fy)).toBe(cellA(fx, fy));
    }
  });

  it('boundary agreement: sampling a shared edge line from both sides is identical (no seam)', () => {
    const noise = makeWorldFeetNoise(SEED, SPAN);
    const boundaryX = 500; // the world-feet x where two cells' Locales would meet
    for (let fy = -200; fy <= 200; fy += 6.25) {
      // The point ON the boundary evaluates to ONE value regardless of which cell asks.
      expect(noise(boundaryX, fy)).toBe(noise(boundaryX, fy));
    }
    // And approaching the boundary from either side converges to the same value.
    const eps = 1e-4;
    expect(Math.abs(noise(boundaryX - eps, 50) - noise(boundaryX + eps, 50))).toBeLessThan(1e-3);
  });

  it('is continuous: nearby points yield nearby values (no cliffs within a cell)', () => {
    const noise = makeWorldFeetNoise(SEED, SPAN);
    let maxJump = 0;
    let prev = noise(0, 0);
    for (let fx = 0.5; fx <= 200; fx += 0.5) {
      const v = noise(fx, 13.7);
      maxJump = Math.max(maxJump, Math.abs(v - prev));
      prev = v;
    }
    // A 0.5-ft step over a 12-ft lattice can't jump more than a fraction of the
    // node-to-node delta; comfortably under 0.1 of the 0..1 range.
    expect(maxJump).toBeLessThan(0.1);
  });

  it('stays in [0,1] and varies with the seed', () => {
    const a = makeWorldFeetNoise(SEED, SPAN);
    const b = makeWorldFeetNoise(SEED + 1, SPAN);
    let differs = false;
    for (let i = 0; i < 50; i++) {
      const fx = i * 7.3;
      const v = a(fx, 100);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      if (b(fx, 100) !== v) differs = true;
    }
    expect(differs).toBe(true); // different world seeds → different field
  });
});
