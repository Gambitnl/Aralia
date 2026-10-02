/**
 * Diagnose, not gauge (2026-09-29).
 *
 * These pin the rules that turn the panel's numbers into a diagnosis: when a
 * frame time is only the display's rhythm, which side of the frame is the
 * work, what each pass cost, what a slow frame spent its time on, and which
 * memory counts move. Each case below is a reading that was wrong on a real
 * page before the rule existed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeVsync, browserParts, memoryTrend, readWork, scriptName, snapToRefresh, type MemorySample } from '../diagnose';
import { PassGpuTimer } from '../gpuTimer';
import { StallLog, type FrameSample } from '../stallLog';
import { instrumentRenderer, rendererProbeInternals } from '../rendererProbe';
import { clearPerfSessions, getPerfSession } from '../perfRegistry';

// ── 1. The vsync floor ────────────────────────────────────────────────────────

describe('analyzeVsync', () => {
  const at = (ms: number, n: number) => Array.from({ length: n }, () => ms);

  it('names a 60 Hz rhythm and says the frame time is the display', () => {
    const v = analyzeVsync([...at(16.67, 110), 16.4, 16.9, 17.0]);
    expect(v.hz).toBe(60);
    expect(v.locked).toBe(true);
    expect(v.refreshesPerFrame).toBe(1);
  });

  it('is NOT moved to 75 Hz by one jittery window', () => {
    /* The first rule took the fastest 10th-percentile frame ever seen, and
     * a few 13 ms catch-up frames after a hitch made the river read 75 Hz. */
    const v = analyzeVsync([...at(16.67, 100), ...at(13.1, 12), 34, 34]);
    expect(v.hz).toBe(60);
  });

  it('keeps the display rhythm when the page drops to 2 refreshes a frame', () => {
    const v = analyzeVsync(at(33.33, 60), 1000 / 60);
    expect(v.hz).toBe(60);
    expect(v.refreshesPerFrame).toBe(2);
    expect(v.locked).toBe(true);
  });

  it('says there is no floor when frames are not on any refresh rhythm', () => {
    // A free-running headless page with vsync off: frames of 5 to 9 ms.
    const free = Array.from({ length: 80 }, (_, i) => 5 + ((i * 7) % 40) / 10);
    const v = analyzeVsync(free);
    expect(v.locked).toBe(false);
  });

  it('snaps only to a known refresh interval', () => {
    expect(snapToRefresh(16.6)?.hz).toBe(60);
    expect(snapToRefresh(6.94)?.hz).toBe(144);
    expect(snapToRefresh(23)).toBeNull(); // 43 Hz: 10% from 48 Hz, far from 30 Hz
  });
});

describe('readWork', () => {
  const locked = analyzeVsync(Array.from({ length: 60 }, () => 16.67));

  it('takes the LONGER side as the work, because CPU and GPU overlap', () => {
    /* The river read CPU 8.4 + GPU 11.3 = 19.7 ms and held 58 fps. A sum
     * cannot explain that; the longer side can. */
    const w = readWork(17.2, 11.27, 8.38, locked, 1000 / 60);
    expect(w.busiestSide).toBe('gpu');
    expect(w.busiestMs).toBeCloseTo(11.27, 2);
    expect(w.serialMs).toBeCloseTo(19.65, 2);
    expect(w.waitMs).toBeCloseTo(5.93, 2);
    expect(w.headroomMs).toBeCloseTo(5.40, 1);
    expect(w.headroomShare).toBeCloseTo(0.324, 2);
    expect(w.gpuMeasured).toBe(true);
  });

  it('says so when only the CPU side was measured (WebGPU)', () => {
    const w = readWork(16.7, null, 1.15, locked, 1000 / 60);
    expect(w.busiestSide).toBe('cpu');
    expect(w.gpuMeasured).toBe(false);
    expect(w.serialMs).toBeNull();
  });

  it('reads a negative headroom as over the budget', () => {
    const w = readWork(33.3, 21, 5, locked, 1000 / 60);
    expect(w.headroomMs).toBeLessThan(0);
  });
});

// ── 7. Memory that moves ──────────────────────────────────────────────────────

describe('memoryTrend', () => {
  const sample = (i: number, over: Partial<MemorySample> = {}): MemorySample => ({
    at: i * 1000,
    geometries: 600,
    textures: 13,
    programs: 14,
    heapMB: 300 + (i % 3),
    ...over,
  });

  it('flags a count that grew in every one of the last ten seconds', () => {
    const s = Array.from({ length: 12 }, (_, i) => sample(i, { geometries: 600 + i * 3 }));
    const t = memoryTrend(s);
    expect(t.growing).toContain('geometries');
    expect(t.perSecondOver10s!.geometries).toBeCloseTo(3, 5);
    expect(t.growing).not.toContain('textures');
  });

  it('calls a heap reading coarse when it never changes', () => {
    const s = Array.from({ length: 10 }, (_, i) => sample(i, { heapMB: 9.5367 }));
    expect(memoryTrend(s).heapCoarse).toBe(true);
    expect(memoryTrend(Array.from({ length: 10 }, (_, i) => sample(i))).heapCoarse).toBe(false);
  });
});

// ── 4. The browser's report of a long frame ───────────────────────────────────

describe('browserParts', () => {
  it('leaves out ONLY the script that lies inside the surface\'s own window', () => {
    /* The first test checked only a script's start, and threw away a 90 ms
     * callback that began 0 ms after the river's own callback ended. */
    const parts = browserParts(
      {
        startTime: 100,
        duration: 106,
        styleAndLayoutStart: 200,
        scripts: [
          { invoker: 'FrameRequestCallback', sourceURL: 'http://x/rendererProbe.ts?t=1', duration: 5.3, executionStart: 110 },
          { invoker: 'FrameRequestCallback', sourceURL: 'http://x/rendererProbe.ts?t=1', duration: 90.1, executionStart: 115.3 },
        ],
      },
      [110, 115.3],
    );
    expect(parts.map((p) => p.name)).toEqual(['another animation-frame callback', 'style and layout']);
    expect(parts[0].ms).toBeCloseTo(90.1, 1);
    expect(parts[1].ms).toBeCloseTo(6, 1);
  });

  it('names React work and timers plainly', () => {
    expect(scriptName({ invoker: 'MessagePort.onmessage', sourceURL: 'http://x/node_modules/.vite/deps/react-dom_client.js', duration: 3 })).toBe('React work');
    expect(scriptName({ invoker: 'TimerHandler:setTimeout', sourceURL: 'http://x/src/useWorld.ts?t=2', sourceFunctionName: 'tick', duration: 3 })).toBe('setTimeout: tick in useWorld.ts');
  });
});

describe('StallLog with measured parts', () => {
  const calm = (frame: number, over: Partial<FrameSample> = {}): FrameSample => ({
    frame,
    frameMs: 16.7,
    cpuMs: 6,
    drawCalls: 300,
    triangles: 4_000_000,
    spans: [],
    measured: [
      { name: 'page script before the first draw', ms: 0.3 },
      { name: 'draw: 862 objects → target A', ms: 2.6 },
      { name: 'texture upload', ms: 0 },
    ],
    ...over,
  });

  it('names a measured cause instead of "unattributed CPU"', () => {
    const log = new StallLog();
    for (let i = 0; i < 30; i++) log.observe(calm(i));
    const rec = log.observe(
      calm(99, {
        frameMs: 40,
        cpuMs: 29,
        measured: [
          { name: 'page script before the first draw', ms: 0.3 },
          { name: 'draw: 862 objects → target A', ms: 2.6 },
          { name: 'texture upload', ms: 23 },
        ],
        notes: ['3 texture uploads, 4.5 MB'],
      }),
    )!;
    expect(rec.contributors[0].name).toBe('texture upload');
    expect(rec.contributors.map((c) => c.name)).not.toContain('unattributed CPU');
    expect(rec.notes).toEqual(['3 texture uploads, 4.5 MB']);
  });

  it('takes browser-measured parts off "outside the measured frame"', () => {
    const log = new StallLog();
    for (let i = 0; i < 30; i++) log.observe(calm(i));
    const rec = log.observe(calm(99, { frameMs: 110 }))!;
    expect(rec.contributors[0].name).toBe('outside the measured frame');
    log.attachBrowserParts(rec, [{ name: 'another animation-frame callback', ms: 90 }]);
    expect(rec.contributors[0].name).toBe('browser: another animation-frame callback');
    expect(rec.contributors.map((c) => c.name)).not.toContain('outside the measured frame');
  });
});

// ── 2. GPU time per pass ──────────────────────────────────────────────────────

const TIME_ELAPSED = 0x88bf;
const GPU_DISJOINT = 0x8fbb;

class TimerGl {
  readonly QUERY_RESULT = 0x8866;
  readonly QUERY_RESULT_AVAILABLE = 0x8867;
  open: number | null = null;
  created = 0;
  order: number[] = [];
  readonly ready = new Map<number, number>();
  getExtension(name: string): unknown {
    return name === 'EXT_disjoint_timer_query_webgl2' ? { TIME_ELAPSED_EXT: TIME_ELAPSED, GPU_DISJOINT_EXT: GPU_DISJOINT } : null;
  }
  getParameter(): unknown {
    return false;
  }
  createQuery(): WebGLQuery {
    return ++this.created as unknown as WebGLQuery;
  }
  deleteQuery(): void {}
  beginQuery(_t: number, q: WebGLQuery): void {
    if (this.open !== null) throw new Error('two queries open');
    this.open = q as unknown as number;
    this.ready.delete(this.open);
  }
  endQuery(): void {
    if (this.open === null) throw new Error('nothing open');
    this.order.push(this.open);
    this.open = null;
  }
  getQueryParameter(q: WebGLQuery, p: number): unknown {
    const id = q as unknown as number;
    return p === this.QUERY_RESULT_AVAILABLE ? this.ready.has(id) : this.ready.get(id) ?? 0;
  }
  /** Finish every ended query with `ns` nanoseconds. */
  finishAll(ns: (id: number) => number): void {
    for (const id of this.order) if (!this.ready.has(id)) this.ready.set(id, ns(id));
  }
}

describe('PassGpuTimer', () => {
  it('times each pass as its own segment and never opens two queries', () => {
    const gl = new TimerGl();
    const timer = PassGpuTimer.forRenderer({ getContext: () => gl }).timer!;
    timer.begin(1, 0); // reflection
    timer.begin(1, 1); // opaque
    timer.begin(1, 2); // shadow map inside the opaque pass
    timer.begin(1, 1); // the opaque pass resumes after its child
    timer.pause();
    timer.closeFrame(1);
    gl.finishAll((id) => id * 1e6); // query n took n ms
    const [f] = timer.collect();
    expect(f.frame).toBe(1);
    expect(f.passes.get(0)).toBeCloseTo(1, 5);
    expect(f.passes.get(1)).toBeCloseTo(2 + 4, 5); // two segments add up
    expect(f.passes.get(2)).toBeCloseTo(3, 5);
    expect(f.totalMs).toBeCloseTo(10, 5);
  });

  it('reports nothing for a frame until every segment has arrived', () => {
    const gl = new TimerGl();
    const timer = PassGpuTimer.forRenderer({ getContext: () => gl }).timer!;
    timer.begin(7, 0);
    timer.begin(7, 1);
    timer.pause();
    timer.closeFrame(7);
    gl.ready.set(1, 1e6); // only the first segment is done
    expect(timer.collect()).toHaveLength(0);
    gl.ready.set(2, 2e6);
    expect(timer.collect()[0].totalMs).toBeCloseTo(3, 5);
  });

  it('says WebGPU cannot be timed', () => {
    expect(PassGpuTimer.forRenderer({ isWebGPURenderer: true }).reason).toBe('webgpu');
  });
});

// ── The probe: passes, uploads, readbacks, browser reports ────────────────────

let clock = 0;
beforeEach(() => {
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});
afterEach(() => {
  rendererProbeInternals.reset();
  clearPerfSessions();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/** A WebGL renderer whose context records uploads and readbacks, each taking fake time. */
function fakeRenderer() {
  const render = { frame: 0, calls: 0, triangles: 0, points: 0, lines: 0 };
  const info = { autoReset: true, render, memory: { geometries: 5, textures: 3 }, programs: [{}], reset() { render.calls = 0; render.triangles = 0; } };
  const gl = {
    texImage2D: (..._a: unknown[]) => { clock += 2; },
    bufferSubData: (..._a: unknown[]) => { clock += 0.5; },
    readPixels: (..._a: unknown[]) => { clock += 7; },
    linkProgram: () => { clock += 3; },
  };
  let target: { width: number; height: number; texture: { name: string } } | null = null;
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const shadowMap = { enabled: true, autoUpdate: true, needsUpdate: false, render(_l: unknown[]) { render.calls += 2; render.triangles += 500; clock += 0.5; } };
  const r = {
    isWebGLRenderer: true,
    info,
    domElement: canvas,
    shadowMap,
    getPixelRatio: () => 1,
    getContext: () => gl,
    getRenderTarget: () => target,
    setTarget(t: typeof target) { target = t; },
    render(scene: { name?: string; children?: unknown[] }, _camera: unknown, opts: { draws?: number; tris?: number; upload?: boolean; shadow?: boolean } = {}) {
      render.frame++;
      if (info.autoReset) info.reset();
      if (opts.shadow) shadowMap.render([{}]);
      if (opts.upload) gl.texImage2D(0, 0, 0, 0, 0, 0, 0, 0, new Uint8Array(4096));
      render.calls += opts.draws ?? 1;
      render.triangles += opts.tris ?? 100;
      clock += 1;
    },
    dispose() {},
  };
  return { r, gl };
}

describe('renderer probe: passes and causes', () => {
  it('lists each pass by name, in order, with a nested shadow map taken out of its parent', () => {
    const { r } = fakeRenderer();
    instrumentRenderer(r, { id: 'river' });
    const scene = { name: '', children: new Array(862).fill({}) };
    const cam = {};
    for (let i = 0; i < 3; i++) {
      clock = i * 16.7;
      rendererProbeInternals.runAsAnimationFrame(clock, () => {
        r.setTarget({ width: 800, height: 450, texture: { name: 'reflection' } });
        r.render(scene, cam, { tris: 2000 });
        r.setTarget(null);
        r.render(scene, cam, { tris: 1800, shadow: true });
      });
    }
    const s = getPerfSession('river')!.snapshot(clock);
    expect(s.passes.map((p) => p.name)).toEqual(['862 objects → reflection', '862 objects → screen', 'shadow map']);
    const shadow = s.passes[2];
    expect(shadow.depth).toBe(1);
    expect(shadow.triangles).toBe(500);
    // The parent's own triangles do not include its child's.
    expect(s.passes[1].triangles).toBe(1800);
  });

  it('names a texture upload and a GPU readback, and takes them out of the CPU parts', () => {
    const { r, gl } = fakeRenderer();
    instrumentRenderer(r, { id: 'up' });
    const scene = { children: [{}] };
    for (let i = 0; i < 3; i++) {
      clock = i * 20;
      rendererProbeInternals.runAsAnimationFrame(clock, () => {
        r.render(scene, {}, { upload: true });
        gl.readPixels(0, 0, 1, 1); // the exposure meter, between draws
        r.render(scene, {});
      });
    }
    const s = getPerfSession('up')!.snapshot(clock);
    expect(s.costs.lastSecond.textureUploads).toBeGreaterThanOrEqual(2);
    expect(s.costs.lastSecond.textureBytes).toBeGreaterThanOrEqual(8192);
    expect(s.costs.lastSecond.readbacks).toBeGreaterThanOrEqual(2);
    const parts = Object.fromEntries(s.cpuParts.map((p) => [p.name, p.ms]));
    expect(parts['GPU readback (the CPU waits)']).toBeCloseTo(7, 3);
    expect(parts['texture upload']).toBeCloseTo(2, 3);
    // The 7 ms readback is NOT also counted as page script between draws.
    expect(parts['page script between draws'] ?? 0).toBeLessThan(0.01);
    // The 2 ms upload is not also in the pass's own draw time: 1 ms of drawing.
    expect(parts['draw: object → screen']).toBeCloseTo(1, 3);
    expect(parts['draw: object → screen (2)']).toBeCloseTo(1, 3);
  });

  it('names an unnamed target by its size against the canvas, which survives a resize', () => {
    const { r } = fakeRenderer();
    instrumentRenderer(r, { id: 'rt' });
    const scene = { children: new Array(4).fill({}) };
    const names: string[][] = [];
    // Frame i's passes are filed when frame i + 1 starts, so run one frame more.
    for (let i = 0; i < 5; i++) {
      clock = i * 16.7;
      // A resize every frame: a new canvas size and new target objects.
      r.domElement.width = 1600 - i * 100;
      const w = r.domElement.width;
      rendererProbeInternals.runAsAnimationFrame(clock, () => {
        // The mirror (half size) is switched off in the last frame.
        if (i < 3) {
          r.setTarget({ width: w / 2, height: 450, texture: { name: '' } });
          r.render(scene, {});
        }
        r.setTarget({ width: w, height: 900, texture: { name: '' } });
        r.render(scene, {});
        r.setTarget(null);
      });
      names.push(getPerfSession('rt')!.snapshot(clock).passes.map((p) => p.name));
    }
    expect(names[2]).toEqual(['4 objects → ½ target', '4 objects → full target']);
    // With the mirror gone, the full-size pass keeps its name and leads the
    // latest frame; the mirror stays listed a while, as a pass that ran recently.
    expect(names[4][0]).toBe('4 objects → full target');
  });

  it('attaches the browser\'s long-frame report to the slow frame it covers', () => {
    const { r } = fakeRenderer();
    instrumentRenderer(r, { id: 'loaf' });
    const scene = { children: [{}] };
    for (let i = 0; i < 40; i++) {
      clock = i * 16.7;
      rendererProbeInternals.runAsAnimationFrame(clock, () => r.render(scene, {}));
    }
    const start = clock;
    clock = start + 110; // a 110 ms gap: something else held the main thread
    rendererProbeInternals.runAsAnimationFrame(clock, () => r.render(scene, {}));
    rendererProbeInternals.feedLongFrame({
      startTime: start + 1,
      duration: 105,
      scripts: [{ invoker: 'TimerHandler:setTimeout', sourceURL: 'http://x/src/streamer.ts', sourceFunctionName: 'flush', duration: 95, executionStart: start + 5 }],
    });
    const rec = getPerfSession('loaf')!.snapshot(clock).stallLog[0];
    expect(rec.contributors[0].name).toBe('browser: setTimeout: flush in streamer.ts');
  });
});
