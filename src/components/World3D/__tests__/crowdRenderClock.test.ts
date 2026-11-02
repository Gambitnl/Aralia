/**
 * The street crowd's drawing clock glides between the game's one-second ticks,
 * never runs past the next tick, never steps back, and snaps on time skips.
 */
import { describe, it, expect } from 'vitest';
import { createCrowdRenderClock, stepCrowdRenderClock } from '../crowdRenderClock';

const S = 1 / 3600;

describe('stepCrowdRenderClock', () => {
  it('starts at the source value', () => {
    const c = createCrowdRenderClock();
    expect(stepCrowdRenderClock(c, 8, 100)).toBe(8);
  });

  it('glides between one-second ticks at the measured rate', () => {
    const c = createCrowdRenderClock();
    stepCrowdRenderClock(c, 8, 100);
    stepCrowdRenderClock(c, 8 + S, 101); // first tick: rate = 1 game s per real s
    const mid = stepCrowdRenderClock(c, 8 + S, 101.5);
    expect(mid).toBeCloseTo(8 + 1.5 * S, 10);
  });

  it('never runs past the next expected tick, and never steps back', () => {
    const c = createCrowdRenderClock();
    stepCrowdRenderClock(c, 8, 100);
    stepCrowdRenderClock(c, 8 + S, 101);
    // The next tick is late (the menu paused the clock): hold one tick ahead.
    expect(stepCrowdRenderClock(c, 8 + S, 103)).toBeCloseTo(8 + 2 * S, 10);
    // When it arrives, the clock continues from there without a step back.
    const resumed = stepCrowdRenderClock(c, 8 + 2 * S, 103.1);
    expect(resumed).toBeGreaterThanOrEqual(8 + 2 * S - 1e-12);
  });

  it('moves less than 0.1 game seconds per 16 ms frame at the normal rate', () => {
    const c = createCrowdRenderClock();
    let prev = stepCrowdRenderClock(c, 12, 0);
    let tick = 0;
    for (let f = 1; f < 600; f++) {
      const now = f / 60;
      if (now >= tick + 1) tick += 1; // the game ticks once a real second
      const r = stepCrowdRenderClock(c, 12 + tick * S, now);
      expect(r - prev).toBeGreaterThanOrEqual(0);
      expect((r - prev) * 3600).toBeLessThan(0.1);
      prev = r;
    }
  });

  it('snaps on a time skip and on a step back', () => {
    const c = createCrowdRenderClock();
    stepCrowdRenderClock(c, 8, 100);
    stepCrowdRenderClock(c, 8 + S, 101);
    expect(stepCrowdRenderClock(c, 11, 101.2)).toBe(11); // a three-hour rest
    expect(stepCrowdRenderClock(c, 10, 101.4)).toBe(10); // a rig rewind
  });

  it('treats midnight as one more tick, not a skip', () => {
    const c = createCrowdRenderClock();
    stepCrowdRenderClock(c, 24 - S, 100);
    stepCrowdRenderClock(c, 24 - S, 100); // no change
    const r = stepCrowdRenderClock(c, 0, 101);
    expect(r).toBeCloseTo(24, 10); // unwrapped: 24.0, not 0
  });
});
