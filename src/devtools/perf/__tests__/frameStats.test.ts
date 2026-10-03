/**
 * Frame statistics.
 *
 * The point of these tests is that a display which only reports a mean is
 * worthless. Each case below is a frame pattern where the mean says "fine" and
 * the experience is not.
 */
import { describe, it, expect } from 'vitest';
import { FrameStats, SpanTimer, STALL_MS } from '../frameStats';

describe('FrameStats', () => {
  it('reads nothing before any frame', () => {
    const s = new FrameStats();
    expect(s.read()).toEqual({ fps: 0, meanMs: 0, worstMs: 0, p95Ms: 0, samples: 0 });
  });

  it('reports 60 fps for steady 16.67 ms frames', () => {
    const s = new FrameStats();
    for (let i = 0; i < 60; i++) s.push(1000 / 60);
    const r = s.read();
    expect(r.fps).toBeCloseTo(60, 3);
    expect(r.worstMs).toBeCloseTo(1000 / 60, 3);
  });

  it('EXPOSES a stall the mean hides', () => {
    /* The whole reason worst and p95 exist.
     *
     * Half a second of 120 fps and then a 250 ms freeze averages out to a
     * respectable frame rate. The freeze is the only thing a reader cares
     * about, and a mean-only display erases it. */
    const s = new FrameStats();
    for (let i = 0; i < 60; i++) s.push(1000 / 120);
    s.push(250);
    const r = s.read();
    expect(r.fps).toBeGreaterThan(30); // the mean still looks acceptable
    expect(r.worstMs).toBeCloseTo(250, 3); // and the truth is visible
  });

  it('keeps a WALL-CLOCK window, so slow frames are not forgotten faster', () => {
    /* A frame-count window shrinks in duration exactly when frames get slow,
     * so the display forgets a stall at the moment it happens. This window is
     * one second of simulated time whatever the frame rate. */
    const s = new FrameStats(1000);
    for (let i = 0; i < 200; i++) s.push(4); // 800 ms of very fast frames
    s.push(100);
    expect(s.read().worstMs).toBe(100);

    // Push past a full second of history; the spike must age out.
    for (let i = 0; i < 300; i++) s.push(4);
    expect(s.read().worstMs).toBe(4);
  });

  it('reports p95 above the mean when frames are uneven', () => {
    const s = new FrameStats();
    for (let i = 0; i < 95; i++) s.push(8);
    for (let i = 0; i < 5; i++) s.push(40);
    const r = s.read();
    expect(r.p95Ms).toBeGreaterThan(r.meanMs);
  });

  it('ignores impossible readings rather than poisoning the window', () => {
    // A tab that was backgrounded reports absurd deltas on its first frame back.
    const s = new FrameStats();
    s.push(16);
    s.push(NaN);
    s.push(-5);
    expect(s.read().samples).toBe(1);
  });

  it('clears', () => {
    const s = new FrameStats();
    for (let i = 0; i < 10; i++) s.push(16);
    s.clear();
    expect(s.read().samples).toBe(0);
  });

  describe('stalls', () => {
    it('separates HOW ROUGH from HOW OFTEN', () => {
      /* Two windows can share a p95 and feel nothing alike. One hitch a second
       * is a glitch; ten is a broken scene. The percentile cannot tell them
       * apart once both sit above the 95th, so the count is its own reading. */
      const rare = new FrameStats();
      for (let i = 0; i < 99; i++) rare.push(10);
      rare.push(60);

      const constant = new FrameStats();
      for (let i = 0; i < 90; i++) constant.push(10);
      for (let i = 0; i < 10; i++) constant.push(60);

      expect(rare.stalls()).toBe(1);
      expect(constant.stalls()).toBe(10);
    });

    it('counts nothing when every frame is inside the 30 Hz budget', () => {
      const s = new FrameStats();
      for (let i = 0; i < 60; i++) s.push(STALL_MS - 1);
      expect(s.stalls()).toBe(0);
    });
  });

  describe('recent', () => {
    it('returns frames OLDEST FIRST, so a graph reads left to right', () => {
      const s = new FrameStats();
      s.push(1);
      s.push(2);
      s.push(3);
      expect(s.recent(3)).toEqual([1, 2, 3]);
    });

    it('gives the newest frames when asked for fewer than it holds', () => {
      const s = new FrameStats();
      for (let i = 1; i <= 10; i++) s.push(i);
      expect(s.recent(3)).toEqual([8, 9, 10]);
    });

    it('returns what it has rather than padding', () => {
      const s = new FrameStats();
      s.push(5);
      expect(s.recent(100)).toEqual([5]);
    });
  });
});

describe('SpanTimer', () => {
  it('reports the first reading immediately, not a fraction of it', () => {
    // An exponential average seeded from zero reads near-zero for a second,
    // which looks like the work is free when it is not.
    const t = new SpanTimer();
    t.record('solver', 8);
    expect(t.get('solver')).toBe(8);
  });

  it('smooths toward a new level rather than jumping', () => {
    const t = new SpanTimer();
    t.record('solver', 10);
    for (let i = 0; i < 3; i++) t.record('solver', 20);
    const v = t.get('solver');
    expect(v).toBeGreaterThan(10);
    expect(v).toBeLessThan(20);
  });

  it('reaches the new level given enough samples', () => {
    const t = new SpanTimer();
    t.record('solver', 10);
    for (let i = 0; i < 200; i++) t.record('solver', 20);
    expect(t.get('solver')).toBeCloseTo(20, 1);
  });

  it('returns zero for work that has never run', () => {
    expect(new SpanTimer().get('nothing')).toBe(0);
  });

  it('lists every span it has seen, for a display that cannot know the names', () => {
    const t = new SpanTimer();
    t.record('solver', 4);
    t.record('remesh', 9);
    expect(t.entries().map((e) => e.name).sort()).toEqual(['remesh', 'solver']);
  });
});
