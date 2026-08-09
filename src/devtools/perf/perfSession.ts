/**
 * One measured 3D surface.
 *
 * A "session" is whatever draws into a single canvas: the volume ground
 * sandbox, the battle map, the entity debugger. Each one owns a `PerfSession`,
 * pushes frames into it, and the shared overlay reads the result. The scene
 * code never touches the display, and the display never reaches into a scene.
 *
 * The renderer read is deliberately defensive. Three ships two renderers with
 * two different `info` shapes — WebGL counts `render.calls` and keeps a program
 * list, WebGPU counts `render.drawCalls` and also counts compute passes — and
 * every surface in this project uses one or the other.
 */

import { FrameStats, RollingMs, SpanTimer, STALL_MS, type FrameReading } from './frameStats';
import { type GpuTimerUnavailable } from './gpuTimer';

export type GraphicsApi = 'webgl' | 'webgpu' | 'unknown';

/** What the GPU timer is doing, so the display never shows a blank number. */
export interface GpuReading {
  /** Milliseconds the GPU spent on a frame. Null until a result arrives. */
  meanMs: number | null;
  p95Ms: number;
  worstMs: number;
  samples: number;
  /** Null while measuring; otherwise why there is no GPU number. */
  unavailable: GpuTimerUnavailable | null;
}

/** What the renderer itself reports. Zero means "the renderer says zero". */
export interface RendererCounters {
  drawCalls: number;
  triangles: number;
  lines: number;
  points: number;
  /** WebGPU compute passes per frame. Always zero under WebGL. */
  computeCalls: number;
  geometries: number;
  textures: number;
  /** Compiled shader programs. WebGL reports this; WebGPU does not. */
  programs: number | null;
}

/** The drawing buffer being filled, which sets the true pixel cost. */
export interface SurfaceSize {
  width: number;
  height: number;
  dpr: number;
}

export interface PerfSnapshot {
  id: string;
  label: string;
  api: GraphicsApi;
  frame: FrameReading;
  /** GPU time per frame, where the browser exposes a GPU clock. */
  gpu: GpuReading;
  /** CPU work per frame. Null until the first frame completes. */
  cpuMs: number | null;
  /** Frames in the window slower than 33 ms. */
  stalls: number;
  /** Recent frame times, oldest first, for the graph. */
  history: number[];
  counters: RendererCounters;
  surface: SurfaceSize;
  /** JS heap in megabytes, where the browser reports it. */
  heapMB: number | null;
  spans: { name: string; ms: number }[];
  /** False once a surface has stopped drawing — paused, hidden, or unmounted. */
  live: boolean;
  /** Seconds captured so far, or null when no capture is running. */
  recordingSec: number | null;
}

const ZERO_COUNTERS: RendererCounters = {
  drawCalls: 0,
  triangles: 0,
  lines: 0,
  points: 0,
  computeCalls: 0,
  geometries: 0,
  textures: 0,
  programs: null,
};

/**
 * A frame delta larger than this did not happen on screen.
 *
 * A background tab, a breakpoint, or a blocking file dialog all produce one
 * enormous "frame" that would then dominate the worst-frame reading for a full
 * second. The window clears on the way back instead.
 */
const IMPLAUSIBLE_FRAME_MS = 1000;

/** How long without a frame before a surface counts as stopped. */
const LIVE_TIMEOUT_MS = 500;

/** Frame times kept for the graph. Roughly two seconds at 60 Hz. */
const GRAPH_SAMPLES = 120;

interface Recording {
  startedAt: number;
  frames: number[];
  gpuFrames: number[];
  cpuFrames: number[];
  worstCounters: RendererCounters;
}

export class PerfSession {
  readonly frames = new FrameStats();
  readonly spans = new SpanTimer();
  private readonly gpu = new RollingMs();
  private readonly cpu = new RollingMs();
  private gpuUnavailable: GpuTimerUnavailable | null = null;

  private counters: RendererCounters = { ...ZERO_COUNTERS };
  private surface: SurfaceSize = { width: 0, height: 0, dpr: 1 };
  private api: GraphicsApi = 'unknown';
  private heapMB: number | null = null;
  private lastFrameAt = 0;
  private recording: Recording | null = null;

  constructor(
    readonly id: string,
    public label: string,
  ) {}

  /**
   * Record that a frame just went out.
   *
   * Call this once per rendered frame with no argument. The session keeps its
   * own clock so a caller cannot report a delta measured against the wrong
   * baseline, which is the usual way a home-made fps counter goes wrong.
   */
  frame(nowMs = performance.now()): void {
    const previous = this.lastFrameAt;
    this.lastFrameAt = nowMs;
    if (previous === 0) return; // the first frame has nothing to measure against

    const delta = nowMs - previous;
    if (delta > IMPLAUSIBLE_FRAME_MS) {
      this.frames.clear();
      return;
    }
    this.frames.push(delta);
    if (this.recording) this.recording.frames.push(delta);
  }

  /** Attribute a piece of per-frame work by name. */
  span(name: string, ms: number): void {
    this.spans.record(name, ms);
  }

  /**
   * File GPU frame times as they arrive.
   *
   * Results lag the frame that produced them by one to three frames, so a call
   * often brings nothing and occasionally brings several. Both are normal.
   */
  recordGpu(msPerFrame: number[]): void {
    for (const ms of msPerFrame) {
      this.gpu.push(ms);
      if (this.recording) this.recording.gpuFrames.push(ms);
    }
  }

  /**
   * Record the CPU work of one frame: everything the page did to build it.
   *
   * Frame time minus this is time the page spent WAITING — almost always for
   * the display's vertical blank. Without it a scene locked at 60 fps with 2 ms
   * of GPU work reads as "CPU bound", when the truth is that it is idle and has
   * headroom to spare.
   */
  recordCpuFrame(ms: number): void {
    this.cpu.push(ms);
    if (this.recording) this.recording.cpuFrames.push(ms);
  }

  /** Say why this surface has no GPU number, so the display can explain it. */
  setGpuUnavailable(reason: GpuTimerUnavailable | null): void {
    this.gpuUnavailable = reason;
    if (reason !== null) this.gpu.clear();
  }

  /** Time `fn` and file it under `name`. Returns whatever `fn` returns. */
  measure<T>(name: string, fn: () => T): T {
    const t0 = performance.now();
    try {
      return fn();
    } finally {
      this.spans.record(name, performance.now() - t0);
    }
  }

  /**
   * Read the renderer's own counters.
   *
   * Call this BEFORE the frame is drawn. Three resets `info` at the start of
   * each render, so reading first gives the previous frame's totals — complete,
   * and one frame old. Reading after would give a partial frame, and forcing
   * `autoReset` off to avoid that would fight other code that borrows `info`.
   */
  sampleRenderer(renderer: unknown): void {
    const r = renderer as {
      isWebGPURenderer?: boolean;
      isWebGLRenderer?: boolean;
      info?: {
        render?: Record<string, number>;
        compute?: Record<string, number>;
        memory?: Record<string, number>;
        programs?: unknown[] | null;
      };
      domElement?: { width?: number; height?: number };
      getPixelRatio?: () => number;
    } | null;
    if (!r) return;

    if (r.isWebGPURenderer) this.api = 'webgpu';
    else if (r.isWebGLRenderer) this.api = 'webgl';

    const info = r.info;
    if (info) {
      const render = info.render ?? {};
      const memory = info.memory ?? {};
      this.counters = {
        // WebGPU counts draws separately from render passes; WebGL has one number.
        drawCalls: render.drawCalls ?? render.calls ?? 0,
        triangles: render.triangles ?? 0,
        lines: render.lines ?? 0,
        points: render.points ?? 0,
        computeCalls: info.compute?.calls ?? 0,
        geometries: memory.geometries ?? 0,
        textures: memory.textures ?? 0,
        programs: Array.isArray(info.programs) ? info.programs.length : null,
      };
    }

    const el = r.domElement;
    if (el && typeof el.width === 'number' && typeof el.height === 'number') {
      this.surface = {
        width: el.width,
        height: el.height,
        dpr: r.getPixelRatio?.() ?? 1,
      };
    }

    this.heapMB = readHeapMB();
    if (this.recording && this.counters.triangles > this.recording.worstCounters.triangles) {
      this.recording.worstCounters = { ...this.counters };
    }
  }

  /**
   * Throw away the frame window, after a rebuild that would otherwise skew it.
   *
   * Spans survive. A rebuild is exactly when a surface records what the rebuild
   * COST, and clearing both would delete that number in the same breath as the
   * frames it is explaining.
   */
  resetFrames(): void {
    this.frames.clear();
    this.gpu.clear();
    this.cpu.clear();
    this.lastFrameAt = 0;
  }

  /** Throw away everything, including span attribution. */
  reset(): void {
    this.resetFrames();
    this.spans.clear();
  }

  startRecording(): void {
    this.recording = {
      startedAt: performance.now(),
      frames: [],
      gpuFrames: [],
      cpuFrames: [],
      worstCounters: { ...this.counters },
    };
  }

  /** Stop a capture and return its report, or null when none was running. */
  stopRecording(): string | null {
    const rec = this.recording;
    this.recording = null;
    if (!rec) return null;
    return this.reportFor(rec);
  }

  get isRecording(): boolean {
    return this.recording !== null;
  }

  snapshot(nowMs = performance.now()): PerfSnapshot {
    return {
      id: this.id,
      label: this.label,
      api: this.api,
      frame: this.frames.read(),
      gpu: this.readGpu(),
      cpuMs: this.cpu.read().samples > 0 ? this.cpu.read().meanMs : null,
      stalls: this.frames.stalls(),
      history: this.frames.recent(GRAPH_SAMPLES),
      counters: this.counters,
      surface: this.surface,
      heapMB: this.heapMB,
      spans: this.spans.entries(),
      live: this.lastFrameAt > 0 && nowMs - this.lastFrameAt < LIVE_TIMEOUT_MS,
      recordingSec: this.recording ? (nowMs - this.recording.startedAt) / 1000 : null,
    };
  }

  private readGpu(): GpuReading {
    const r = this.gpu.read();
    return {
      meanMs: r.samples > 0 ? r.meanMs : null,
      p95Ms: r.p95Ms,
      worstMs: r.worstMs,
      samples: r.samples,
      unavailable: this.gpuUnavailable,
    };
  }

  /** A plain-text summary of the live window, for pasting into a report. */
  report(): string {
    const s = this.snapshot();
    const lines = [
      `${s.label} [${s.api}] — live window`,
      `  fps      ${s.frame.fps.toFixed(1)} over ${s.frame.samples} frames`,
      `  frame    ${s.frame.meanMs.toFixed(1)} ms mean · ${s.frame.p95Ms.toFixed(1)} p95 · ${s.frame.worstMs.toFixed(1)} worst`,
      `  gpu      ${describeGpu(s.gpu, classifyBottleneck(s.gpu.meanMs, s.cpuMs, s.frame.meanMs))}`,
      `  cpu      ${s.cpuMs === null ? 'not measured' : `${s.cpuMs.toFixed(2)} ms of work per frame`}`,
      `  stalls   ${s.stalls} frames over ${STALL_MS.toFixed(0)} ms`,
      `  draws    ${s.counters.drawCalls} calls · ${s.counters.triangles.toLocaleString()} triangles`,
      `  memory   ${s.counters.geometries} geometries · ${s.counters.textures} textures${
        s.counters.programs === null ? '' : ` · ${s.counters.programs} programs`
      }${s.heapMB === null ? '' : ` · heap ${s.heapMB.toFixed(0)} MB`}`,
      `  surface  ${s.surface.width}x${s.surface.height} at dpr ${s.surface.dpr}`,
    ];
    if (s.counters.computeCalls > 0) lines.push(`  compute  ${s.counters.computeCalls} passes/frame`);
    if (s.spans.length > 0) {
      lines.push(`  spans    ${s.spans.map((sp) => `${sp.name} ${sp.ms.toFixed(2)} ms`).join(' · ')}`);
    }
    return lines.join('\n');
  }

  private reportFor(rec: Recording): string {
    const frames = rec.frames;
    if (frames.length === 0) return `${this.label} — capture ended with no frames.`;

    const sorted = frames.slice().sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    const total = frames.reduce((a, b) => a + b, 0);
    const mean = total / frames.length;
    const stalls = frames.filter((f) => f > STALL_MS).length;
    const c = rec.worstCounters;

    return [
      `${this.label} [${this.api}] — capture of ${(total / 1000).toFixed(1)} s, ${frames.length} frames`,
      `  fps      ${(1000 / mean).toFixed(1)} mean · ${(1000 / at(0.95)).toFixed(1)} at the 5% worst frames`,
      `  frame    ${mean.toFixed(1)} ms mean · ${at(0.5).toFixed(1)} median · ${at(0.95).toFixed(1)} p95 · ${at(0.99).toFixed(1)} p99 · ${sorted[sorted.length - 1].toFixed(1)} worst`,
      `  stalls   ${stalls} frames over ${STALL_MS.toFixed(0)} ms (${((stalls / frames.length) * 100).toFixed(1)}%)`,
      /* The GPU line is the one that says WHICH side is the bottleneck.
       *
       * GPU time close to frame time means the fix is pixels, shaders or draw
       * calls. GPU time far below it means the CPU built the frame and the
       * graphics work was never the problem. */
      `  gpu      ${describeGpuSamples(rec.gpuFrames, rec.cpuFrames, this.gpuUnavailable, mean)}`,
      `  peak     ${c.drawCalls} draw calls · ${c.triangles.toLocaleString()} triangles`,
      `  memory   ${c.geometries} geometries · ${c.textures} textures${
        c.programs === null ? '' : ` · ${c.programs} programs`
      }${this.heapMB === null ? '' : ` · heap ${this.heapMB.toFixed(0)} MB`}`,
      `  surface  ${this.surface.width}x${this.surface.height} at dpr ${this.surface.dpr}`,
    ].join('\n');
  }
}

/**
 * The GPU line for the live panel and the report.
 *
 * Every branch says something true. A browser that withholds the clock is not
 * the same as a GPU that has not answered yet, and neither is the same as zero.
 */
export function describeGpu(gpu: GpuReading, verdict: BottleneckVerdict | null = null): string {
  if (gpu.unavailable) return GPU_UNAVAILABLE_TEXT[gpu.unavailable];
  if (gpu.meanMs === null) return 'waiting for the first result';
  return (
    `${gpu.meanMs.toFixed(2)} ms mean · ${gpu.p95Ms.toFixed(2)} p95 · ` +
    `${gpu.worstMs.toFixed(2)} worst${verdict ? ` — ${verdict.label}` : ''}`
  );
}

function describeGpuSamples(
  samples: number[],
  cpuSamples: number[],
  unavailable: GpuTimerUnavailable | null,
  frameMeanMs: number,
): string {
  if (unavailable) return GPU_UNAVAILABLE_TEXT[unavailable];
  if (samples.length === 0) return 'no results arrived during the capture';
  const sorted = samples.slice().sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  const cpuMean =
    cpuSamples.length > 0 ? cpuSamples.reduce((a, b) => a + b, 0) / cpuSamples.length : null;
  const verdict = classifyBottleneck(mean, cpuMean, frameMeanMs);
  return (
    `${mean.toFixed(2)} ms mean · ${at(0.95).toFixed(2)} p95 · ` +
    `${sorted[sorted.length - 1].toFixed(2)} worst over ${samples.length} frames` +
    (verdict ? ` — ${verdict.label}` : '')
  );
}


export type Bottleneck = 'gpu' | 'cpu' | 'headroom' | 'mixed' | 'unknown';

export interface BottleneckVerdict {
  kind: Bottleneck;
  /** Share of the frame the GPU was busy, 0 to 1. */
  gpuShare: number;
  /** Share of the frame the CPU was busy, or null when it is not measured. */
  cpuShare: number | null;
  label: string;
}

/**
 * Name the bottleneck instead of leaving the reader to divide two numbers.
 *
 * THE CASE THIS EXISTS FOR is a scene locked at 60 fps. Its frame time is 16.7
 * ms because the display says so, not because anything took that long. Judging
 * by GPU share alone, a scene using 2 ms of GPU looks "CPU bound" — and someone
 * then spends a day optimizing a CPU that was idle. So the test is against the
 * BUSIEST side: when neither side fills half the frame, the honest answer is
 * that the scene has headroom and is waiting for the display.
 *
 * The bands are wide on purpose. One side at 1.5x the other is a clear winner;
 * anything closer is genuinely both.
 */
export function classifyBottleneck(
  gpuMeanMs: number | null,
  cpuMs: number | null,
  frameMeanMs: number,
): BottleneckVerdict | null {
  if (frameMeanMs <= 0 || gpuMeanMs === null || gpuMeanMs <= 0) return null;

  const gpuShare = gpuMeanMs / frameMeanMs;
  const cpuShare = cpuMs === null ? null : cpuMs / frameMeanMs;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  if (cpuShare === null) {
    // Without the CPU side, only a GPU that dominates can be claimed.
    if (gpuShare >= 0.7) return { kind: 'gpu', gpuShare, cpuShare, label: `GPU bound · ${pct(gpuShare)}` };
    return { kind: 'unknown', gpuShare, cpuShare, label: `gpu ${pct(gpuShare)} of the frame` };
  }

  if (Math.max(gpuShare, cpuShare) < 0.5) {
    return {
      kind: 'headroom',
      gpuShare,
      cpuShare,
      label: `headroom · gpu ${pct(gpuShare)} · cpu ${pct(cpuShare)}`,
    };
  }
  if (gpuMeanMs >= (cpuMs as number) * 1.5) {
    return { kind: 'gpu', gpuShare, cpuShare, label: `GPU bound · ${pct(gpuShare)} of the frame` };
  }
  if ((cpuMs as number) >= gpuMeanMs * 1.5) {
    return { kind: 'cpu', gpuShare, cpuShare, label: `CPU bound · ${pct(cpuShare)} of the frame` };
  }
  return { kind: 'mixed', gpuShare, cpuShare, label: `mixed · gpu ${pct(gpuShare)} · cpu ${pct(cpuShare)}` };
}

const GPU_UNAVAILABLE_TEXT: Record<GpuTimerUnavailable, string> = {
  'no-extension': 'no GPU clock (browser withholds EXT_disjoint_timer_query_webgl2)',
  'no-webgl2': 'no GPU clock (context is not WebGL2)',
  webgpu: 'no GPU clock (WebGPU; three resolves its timestamps only in renderAsync)',
  'no-context': 'no GPU clock (no renderer context)',
  disabled: 'GPU timing turned off for this surface',
};

/**
 * JS heap in megabytes, where the browser reports it.
 *
 * Only Chromium exposes this, and only for the whole tab rather than for one
 * canvas. It still answers the question that matters most often: whether a
 * sandbox leaks while you drag a slider.
 */
function readHeapMB(): number | null {
  const mem = (performance as { memory?: { usedJSHeapSize?: number } }).memory;
  const bytes = mem?.usedJSHeapSize;
  return typeof bytes === 'number' ? bytes / (1024 * 1024) : null;
}
