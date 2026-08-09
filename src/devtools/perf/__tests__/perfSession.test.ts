/**
 * A measured surface.
 *
 * These tests pin the two things that make a home-made fps counter lie: the
 * baseline it measures against, and what it does with a gap that never
 * happened on screen. They also pin the renderer read, because three ships two
 * renderers whose counters do not share field names.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PerfSession, classifyBottleneck } from '../perfSession';
import {
  acquirePerfSession,
  releasePerfSession,
  getPerfSession,
  getPerfSessions,
  subscribePerfSessions,
  clearPerfSessions,
} from '../perfRegistry';

describe('PerfSession frames', () => {
  it('measures nothing from a single frame, instead of inventing a delta', () => {
    const s = new PerfSession('x', 'X');
    s.frame(1000);
    expect(s.snapshot(1000).frame.samples).toBe(0);
  });

  it('measures the gap BETWEEN frames', () => {
    const s = new PerfSession('x', 'X');
    s.frame(0);
    for (let i = 1; i <= 10; i++) s.frame(i * 20);
    expect(s.snapshot(200).frame.fps).toBeCloseTo(50, 3);
  });

  it('DISCARDS a gap no frame could have produced, and starts clean', () => {
    /* A backgrounded tab, a breakpoint, or a blocking dialog all resume with
     * one multi-second "frame". Keeping it would make the worst-frame reading
     * useless for the next full second, reporting a stall that nobody saw. */
    const s = new PerfSession('x', 'X');
    s.frame(0);
    s.frame(16);
    s.frame(9000); // came back from a background tab
    expect(s.snapshot(9000).frame.samples).toBe(0);

    s.frame(9016);
    s.frame(9032);
    expect(s.snapshot(9032).frame.samples).toBe(2);
    expect(s.snapshot(9032).frame.worstMs).toBeCloseTo(16, 3);
  });

  it('KEEPS span attribution when only the frame window is thrown away', () => {
    /* A rebuild is exactly when a surface records what the rebuild cost, and
     * then clears the frames because a two-second rebuild is not a frame.
     * Clearing both in one call deleted the number that explained the gap. */
    const s = new PerfSession('x', 'X');
    s.span('re-mesh', 1238);
    s.frame(0);
    s.frame(16);
    s.resetFrames();
    expect(s.snapshot().frame.samples).toBe(0);
    expect(s.snapshot().spans).toEqual([{ name: 're-mesh', ms: 1238 }]);

    s.reset();
    expect(s.snapshot().spans).toEqual([]);
  });

  it('reports a surface as stopped once it quits drawing', () => {
    const s = new PerfSession('x', 'X');
    s.frame(0);
    s.frame(16);
    expect(s.snapshot(20).live).toBe(true);
    expect(s.snapshot(3000).live).toBe(false);
  });
});

describe('PerfSession renderer read', () => {
  it('reads WebGL counters, including the program list length', () => {
    const s = new PerfSession('x', 'X');
    s.sampleRenderer({
      isWebGLRenderer: true,
      info: {
        render: { calls: 42, triangles: 1234, lines: 2, points: 3 },
        memory: { geometries: 7, textures: 5 },
        programs: [{}, {}, {}],
      },
      domElement: { width: 1600, height: 900 },
      getPixelRatio: () => 2,
    });
    const snap = s.snapshot();
    expect(snap.api).toBe('webgl');
    expect(snap.counters.drawCalls).toBe(42);
    expect(snap.counters.triangles).toBe(1234);
    expect(snap.counters.programs).toBe(3);
    expect(snap.surface).toEqual({ width: 1600, height: 900, dpr: 2 });
  });

  it('reads WebGPU counters, which name draws differently and add compute', () => {
    /* WebGPU's `render.calls` counts render PASSES, not draws, so reading the
     * WebGL field name off a WebGPU renderer silently reports the wrong number
     * rather than failing. */
    const s = new PerfSession('x', 'X');
    s.sampleRenderer({
      isWebGPURenderer: true,
      info: {
        render: { calls: 4, drawCalls: 300, triangles: 90000 },
        compute: { calls: 12 },
        memory: { geometries: 3, textures: 8 },
      },
    });
    const snap = s.snapshot();
    expect(snap.api).toBe('webgpu');
    expect(snap.counters.drawCalls).toBe(300);
    expect(snap.counters.computeCalls).toBe(12);
    expect(snap.counters.programs).toBeNull(); // WebGPU keeps no program list
  });

  it('survives a renderer that reports nothing', () => {
    const s = new PerfSession('x', 'X');
    expect(() => s.sampleRenderer(null)).not.toThrow();
    expect(() => s.sampleRenderer({})).not.toThrow();
    expect(s.snapshot().counters.drawCalls).toBe(0);
  });
});

describe('PerfSession capture', () => {
  it('reports the DISTRIBUTION, not just an average', () => {
    const s = new PerfSession('x', 'Volume');
    s.startRecording();
    s.frame(0);
    for (let i = 1; i <= 100; i++) s.frame(i * 10);
    s.frame(1000 + 200); // one long stall
    const report = s.stopRecording();

    expect(report).toContain('Volume');
    expect(report).toContain('p99');
    expect(report).toMatch(/1 frames over 33 ms/);
  });

  it('returns nothing when no capture was running', () => {
    expect(new PerfSession('x', 'X').stopRecording()).toBeNull();
  });
});

describe('perf registry', () => {
  beforeEach(() => clearPerfSessions());

  it('hands the same session to a second mount, so StrictMode makes only one', () => {
    const a = acquirePerfSession('water', 'Water');
    const b = acquirePerfSession('water', 'Water');
    expect(a).toBe(b);
    expect(getPerfSessions()).toHaveLength(1);
  });

  it('keeps the session until the LAST holder lets go', () => {
    acquirePerfSession('water', 'Water');
    acquirePerfSession('water', 'Water');
    releasePerfSession('water');
    expect(getPerfSession('water')).toBeDefined();
    releasePerfSession('water');
    expect(getPerfSession('water')).toBeUndefined();
  });

  it('tells the display when a surface appears or goes', () => {
    let calls = 0;
    const stop = subscribePerfSessions(() => calls++);
    acquirePerfSession('a', 'A');
    releasePerfSession('a');
    stop();
    acquirePerfSession('b', 'B');
    expect(calls).toBe(2); // and nothing after the unsubscribe
  });
});

describe('classifyBottleneck', () => {
  it('calls a vsync-locked scene with headroom what it is, NOT cpu bound', () => {
    /* The bug this test exists for.
     *
     * A scene locked at 60 fps has a 16.7 ms frame because the display says so.
     * Judged on GPU share alone, 2 ms of GPU work looks like 12% of the frame,
     * and the obvious reading — "the other 88% must be the CPU" — is wrong: the
     * CPU used 3 ms and the machine spent the rest idle. Reporting "CPU bound"
     * sends someone to optimize a CPU that was doing nothing. */
    const v = classifyBottleneck(2, 3, 16.7)!;
    expect(v.kind).toBe('headroom');
    expect(v.label).toContain('headroom');
  });

  it('calls it GPU bound when the GPU fills the frame', () => {
    const v = classifyBottleneck(15, 4, 16.7)!;
    expect(v.kind).toBe('gpu');
  });

  it('calls it CPU bound when the CPU fills the frame', () => {
    const v = classifyBottleneck(3, 28, 33)!;
    expect(v.kind).toBe('cpu');
  });

  it('calls it mixed when both sides are busy and neither clearly wins', () => {
    const v = classifyBottleneck(12, 14, 16.7)!;
    expect(v.kind).toBe('mixed');
  });

  it('still reports headroom when a SLOW frame has both sides idle', () => {
    /* 12 ms of GPU and 14 ms of CPU inside a 30 ms frame leaves half the frame
     * doing nothing. The frame is slow, but neither side is the reason — a
     * 30 Hz display or a throttle is. Blaming a side here would be a guess. */
    expect(classifyBottleneck(12, 14, 30)!.kind).toBe('headroom');
  });

  it('REFUSES to blame the CPU when CPU work was never measured', () => {
    // Without the CPU side there is no evidence for a CPU claim, only for a GPU
    // one. Saying "unknown" is the honest answer, and it is a real state: the
    // reading arrives a frame before the first CPU sample does.
    expect(classifyBottleneck(2, null, 16.7)!.kind).toBe('unknown');
    expect(classifyBottleneck(15, null, 16.7)!.kind).toBe('gpu');
  });

  it('says nothing at all without a GPU reading', () => {
    expect(classifyBottleneck(null, 5, 16.7)).toBeNull();
    expect(classifyBottleneck(5, 5, 0)).toBeNull();
  });
});
