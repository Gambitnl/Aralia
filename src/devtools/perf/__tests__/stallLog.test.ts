/**
 * Pointing at the smoking gun.
 *
 * The bar for this file is not "does it record a stall". It is whether the
 * record NAMES the cause. Every test below is a frame that went wrong for a
 * specific reason, and the assertion is that the reason comes out on top.
 */
import { describe, it, expect } from 'vitest';
import { StallLog, describeStall, type FrameSample } from '../stallLog';

/** A normal frame: 16.7 ms, cheap spans, steady counters. */
const calm = (frame: number, over: Partial<FrameSample> = {}): FrameSample => ({
  frame,
  frameMs: 16.7,
  cpuMs: 6,
  drawCalls: 200,
  triangles: 500_000,
  spans: [
    { name: 'solver', ms: 4 },
    { name: 'water mesh', ms: 2 },
  ],
  ...over,
});

/** Teach the log what normal looks like. */
const settle = (log: StallLog, n = 30) => {
  for (let i = 0; i < n; i++) log.observe(calm(i));
};

describe('StallLog', () => {
  it('says nothing while the frame rate is steady', () => {
    const log = new StallLog();
    settle(log, 60);
    expect(log.records()).toHaveLength(0);
  });

  it('NAMES the span that caused the stall, above the ones that did not', () => {
    /* The whole point. A 38 ms frame is useless information. "The water mesh
     * took 20 ms instead of its usual 2" is the answer. */
    const log = new StallLog();
    settle(log);
    const rec = log.observe(
      calm(99, {
        frameMs: 38.3,
        cpuMs: 25,
        spans: [
          { name: 'solver', ms: 4.2 }, // normal
          { name: 'water mesh', ms: 20.5 }, // the culprit
        ],
      }),
    );

    expect(rec).not.toBeNull();
    expect(rec!.contributors[0].name).toBe('water mesh');
    expect(rec!.contributors[0].deltaMs).toBeCloseTo(18.5, 1);
    expect(rec!.contributors[0].baselineMs).toBeCloseTo(2, 1);
  });

  it('compares against NORMAL, so a cost that is always high is not blamed', () => {
    /* A span that always costs 20 ms did not cause today's stall, however big
     * it looks. Without the baseline it would top every list forever and every
     * stall would get the same wrong answer. */
    const log = new StallLog();
    for (let i = 0; i < 30; i++) {
      log.observe(calm(i, { spans: [{ name: 'always heavy', ms: 20 }, { name: 'quiet', ms: 0.5 }] }));
    }
    // The CPU rises by what the span rose by, so there is no remainder to
    // compete with it. Otherwise this would test the remainder, not the ranking.
    const rec = log.observe(
      calm(99, {
        // The frame overruns by exactly what the span rose by, so there is no
        // unexplained remainder to compete for the headline.
        frameMs: 16.7 + 19.5,
        cpuMs: 6 + 19.5,
        spans: [
          { name: 'always heavy', ms: 20.1 }, // unchanged
          { name: 'quiet', ms: 20 }, // this is what moved
        ],
      }),
    );
    expect(rec!.contributors[0].name).toBe('quiet');
    // And the big-but-steady cost is not named at all.
    expect(rec!.contributors.map((c) => c.name)).not.toContain('always heavy');
  });

  it('names the REMAINDER, so the list cannot lie by omission', () => {
    /* Garbage collection, React, a scene graph walk — none of it is wrapped in
     * a span. A list of spans that quietly implies it adds up to the frame is
     * worse than no list. */
    const log = new StallLog();
    settle(log);
    const rec = log.observe(calm(99, { frameMs: 45, cpuMs: 34 })); // spans unchanged
    expect(rec!.contributors[0].name).toBe('unattributed CPU');
    expect(rec!.contributors[0].deltaMs).toBeCloseTo(28, 0);
  });

  it('NAMES the time it could not see, rather than blaming what it could', () => {
    /* The failure a live test caught. A 122 ms frame where the tool saw 1 ms of
     * CPU and 2 ms of GPU was reported as "GPU +0.9 ms" — true, irrelevant, and
     * it would send a reader into the shaders after a hundred milliseconds that
     * never touched the GPU. The honest headline is that the time went
     * somewhere this tool does not reach. */
    const log = new StallLog();
    settle(log);
    const rec = log.observe(calm(99, { frameMs: 50, cpuMs: 6 })); // CPU idle, spans normal
    expect(rec!.contributors[0].name).toBe('outside the measured frame');
    expect(rec!.contributors[0].deltaMs).toBeCloseTo(33.3, 1);
  });

  it('REFUSES to headline a trivial move on a huge frame', () => {
    const log = new StallLog();
    settle(log);
    const rec = log.observe(calm(99, { frameMs: 122, cpuMs: 6 }))!;
    log.attachGpu(99, 1.8, 0.9); // a 0.9 ms GPU move against a 105 ms overrun
    expect(rec.contributors.map((c) => c.name)).not.toContain('GPU');
    expect(rec.contributors[0].name).toBe('outside the measured frame');
  });

  it('does NOT let a stall raise its own baseline', () => {
    /* A scene that stutters steadily would otherwise teach the tool that
     * stuttering is normal, and the log would go quiet exactly when the problem
     * got worse. */
    const log = new StallLog();
    settle(log);
    for (let i = 0; i < 20; i++) log.observe(calm(100 + i, { frameMs: 40, cpuMs: 30 }));
    const rec = log.observe(calm(200, { frameMs: 40, cpuMs: 30 }));
    expect(rec).not.toBeNull();
    expect(rec!.baselineMs).toBeCloseTo(16.7, 1); // still measured against calm
  });

  it('judges a slow scene by ITS normal, not by a fixed 33 ms', () => {
    // A page that runs at 30 fps is not stalling every frame. A page that runs
    // at 30 and then throws a 90 ms frame is.
    const log = new StallLog();
    for (let i = 0; i < 30; i++) log.observe(calm(i, { frameMs: 33, cpuMs: 20 }));
    expect(log.observe(calm(98, { frameMs: 35, cpuMs: 21 }))).toBeNull();
    expect(log.observe(calm(99, { frameMs: 90, cpuMs: 70 }))).not.toBeNull();
  });

  it('holds its tongue until it has seen enough frames to know normal', () => {
    const log = new StallLog();
    expect(log.observe(calm(0, { frameMs: 200 }))).toBeNull();
  });

  describe('the late GPU result', () => {
    it('finds the frame it belongs to and ranks it', () => {
      /* GPU times arrive one to three frames after the frame they measure, so a
       * stall is always written down before its GPU time exists. Matching by
       * frame number is the only way the spike and the ruined frame ever meet. */
      const log = new StallLog();
      settle(log);
      log.observe(calm(99, { frameMs: 30, cpuMs: 7 })); // CPU was fine
      log.observe(calm(100));
      log.observe(calm(101));

      log.attachGpu(99, 24, 3.5);

      const rec = log.records().find((r) => r.frame === 99)!;
      expect(rec.gpuMs).toBe(24);
      expect(rec.contributors[0].name).toBe('GPU');
      expect(rec.contributors[0].deltaMs).toBeCloseTo(20.5, 1);
    });

    it('ignores a result for a frame it never recorded', () => {
      const log = new StallLog();
      settle(log);
      expect(() => log.attachGpu(12345, 40, 3)).not.toThrow();
    });

    it('does not double-count a result that arrives twice', () => {
      const log = new StallLog();
      settle(log);
      log.observe(calm(99, { frameMs: 30, cpuMs: 7 }));
      log.attachGpu(99, 24, 3.5);
      log.attachGpu(99, 24, 3.5);
      const rec = log.records()[0];
      expect(rec.contributors.filter((c) => c.name === 'GPU')).toHaveLength(1);
    });
  });

  it('keeps a bounded history, newest first', () => {
    const log = new StallLog();
    settle(log);
    for (let i = 0; i < 40; i++) log.observe(calm(1000 + i, { frameMs: 60, cpuMs: 45 }));
    const kept = log.records();
    expect(kept.length).toBeLessThanOrEqual(12);
    expect(kept[0].frame).toBeGreaterThan(kept[kept.length - 1].frame);
  });

  it('reports the counters only when they MOVED', () => {
    const log = new StallLog();
    settle(log);
    const steady = log.observe(calm(99, { frameMs: 40, cpuMs: 30 }))!;
    expect(describeStall(steady)).not.toContain('draws');

    const spiked = log.observe(calm(150, { frameMs: 40, cpuMs: 30, drawCalls: 1800 }))!;
    expect(describeStall(spiked)).toContain('draws 1800');
  });
});
