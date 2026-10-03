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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/09/2026, 19:05:34
 * Dependents: devtools/buildingIdentityLab/BuildingSceneDiagnostics.tsx, devtools/perf/PerfOverlay.tsx, devtools/perf/index.ts, devtools/perf/perfRegistry.ts, devtools/perf/rendererProbe.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { FrameStats, RollingMs, SpanTimer, STALL_MS, type FrameReading } from './frameStats';
import { type FramePassGpu, type GpuResult, type GpuTimerUnavailable } from './gpuTimer';
import { StallLog, describeStall, type StallRecord } from './stallLog';
import {
  analyzeVsync,
  memoryTrend,
  readWork,
  type MemorySample,
  type MemoryTrend,
  type VsyncReading,
} from './diagnose';
import type { SceneInventory } from './sceneInventory';

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
  /**
   * Calls to `renderer.render` in the frame: one for a plain scene, more for
   * a post-processing stack, a mirror, or a shadow pre-pass. Null when the
   * reading came from `sampleRenderer`, which cannot see the calls.
   */
  renderCalls: number | null;
  geometries: number;
  textures: number;
  /** Compiled shader programs. WebGL reports this; WebGPU does not. */
  programs: number | null;
}

/**
 * How a session got its name.
 *
 * `named` sessions come from a `PerfProbe`, `instrumentRenderer`, or
 * `acquirePerfSession` call, and keep the id a capture rig asks for.
 * `auto` sessions come from the renderer probe, which finds a renderer that
 * nobody named and labels it by the window it sits in.
 */
export type SessionOrigin = 'named' | 'auto';

/** One surface-specific reading, such as a solver's step time or a cell count. */
export interface SurfaceStat {
  name: string;
  value: string;
}

/**
 * A finished frame, as the renderer probe counted it.
 *
 * The probe adds up every render and compute call in the frame itself, so it
 * never has to change `renderer.info.autoReset` to get the whole frame.
 */
export interface RendererFrameReading {
  api: GraphicsApi;
  counters: RendererCounters;
  surface: SurfaceSize;
}

/** The drawing buffer being filled, which sets the true pixel cost. */
export interface SurfaceSize {
  width: number;
  height: number;
  dpr: number;
}

/** One named render family from an opt-in scene inventory. */
export interface SceneFamilyDiagnostics {
  family: string;
  meshes: number;
  instances: number;
  triangles: number;
  shadowMeshes: number;
  shadowTriangles: number;
}

/**
 * Static scene composition attached by a surface-specific probe.
 *
 * Renderer counters say how much work the finished frame submitted, including
 * shadow and post-processing passes. This inventory says which mounted scene
 * families created that work, which is the missing bridge from a slow number
 * to an actionable component.
 */
export interface SceneDiagnostics {
  meshes: number;
  instances: number;
  triangles: number;
  shadowMeshes: number;
  shadowTriangles: number;
  geometries: number;
  materials: number;
  families: SceneFamilyDiagnostics[];
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
  /** The slow frames, newest first, each with what made it slow. */
  stallLog: StallRecord[];
  /** Mounted-scene composition, where the surface supplies an inventory. */
  scene: SceneDiagnostics | null;
  /** Whether a surface named this session or the renderer probe found it. */
  origin: SessionOrigin;
  /** Surface-specific readings, in the order the surface first set them. */
  stats: SurfaceStat[];
  /** Each render and compute pass of the frame, in the order they ran. */
  passes: PassReading[];
  /** Why the passes carry no GPU time, or null when they do. */
  passGpuNote: string | null;
  /** Whether the frame time is the display's rhythm rather than the work. */
  vsync: VsyncReading;
  /** Uploads and compiles, summed over the last second and the last ten. */
  costs: { lastSecond: FrameCosts; lastTenSeconds: FrameCosts };
  /** Where the CPU time of a frame went, mean ms per part over the last second. */
  cpuParts: { name: string; ms: number }[];
  /** Memory counts that move, per second. */
  memory: MemoryTrend;
  /** Triangles by group and what the camera sees; null until the first walk. */
  inventory: SceneInventory | null;
}

/** What kind of renderer call a pass was. */
export type PassKind = 'render' | 'compute' | 'shadow';

/** One pass of one frame, as the renderer probe measured it. */
export interface PassSample {
  /** Stable across frames: the same pass keeps the same key. */
  key: string;
  name: string;
  kind: PassKind;
  /** 0 for a call the page made; 1 or more for a pass inside another pass. */
  depth: number;
  /** The probe's id for the scene the pass drew, or null for a compute pass. */
  sceneKey: number | null;
  /** Where it drew: "screen", or a render target described by size. */
  target: string;
  /** CPU time of this pass alone: its children and its uploads taken out. */
  cpuMs: number;
  triangles: number;
  drawCalls: number;
  lines: number;
  points: number;
}

/** One pass over the recent window, for the panel. */
export interface PassReading {
  key: string;
  name: string;
  kind: PassKind;
  depth: number;
  sceneKey: number | null;
  target: string;
  /** Mean CPU ms over the recent window. */
  cpuMs: number;
  /** Mean GPU ms over the recent window; null where the GPU clock cannot time it. */
  gpuMs: number | null;
  triangles: number;
  drawCalls: number;
  lines: number;
  points: number;
  /** The share of recent frames that ran this pass, 0 to 1. */
  runShare: number;
}

/** Uploads and compiles, as the probe's wrappers on the graphics API counted them. */
export interface FrameCosts {
  textureUploadMs: number;
  textureUploads: number;
  textureBytes: number;
  bufferUploadMs: number;
  bufferUploads: number;
  bufferBytes: number;
  /** Shader compile and link on WebGL; shader-module and pipeline creation on WebGPU. */
  compileMs: number;
  compiles: number;
  /** WebGL shader programs added (three's `info.programs`). */
  programsAdded: number;
  /**
   * A synchronous GPU read (`readPixels`, `getBufferSubData`, `finish`,
   * `clientWaitSync`): the CPU stops until the GPU has finished everything
   * before it. On the river this hid inside "page script between draws" as a
   * 13.7 ms stall; its auto-exposure meter reads the frame back.
   */
  readbackMs: number;
  readbacks: number;
}

export const ZERO_COSTS: FrameCosts = {
  textureUploadMs: 0,
  textureUploads: 0,
  textureBytes: 0,
  bufferUploadMs: 0,
  bufferUploads: 0,
  bufferBytes: 0,
  compileMs: 0,
  compiles: 0,
  programsAdded: 0,
  readbackMs: 0,
  readbacks: 0,
};

function addCosts(a: FrameCosts, b: FrameCosts): FrameCosts {
  const out = { ...a };
  for (const k of Object.keys(out) as (keyof FrameCosts)[]) out[k] += b[k];
  return out;
}

const ZERO_COUNTERS: RendererCounters = {
  drawCalls: 0,
  triangles: 0,
  lines: 0,
  points: 0,
  computeCalls: 0,
  renderCalls: null,
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
  private readonly stallLog = new StallLog();
  /** Counts every frame, so a late GPU result can name the frame it measured. */
  private frameIndex = 0;
  private pendingCpuMs: number | null = null;
  private gpuUnavailable: GpuTimerUnavailable | null = null;

  private counters: RendererCounters = { ...ZERO_COUNTERS };
  private surface: SurfaceSize = { width: 0, height: 0, dpr: 1 };
  private api: GraphicsApi = 'unknown';
  private heapMB: number | null = null;
  private lastFrameAt = 0;
  private recording: Recording | null = null;
  private sceneDiagnostics: SceneDiagnostics | null = null;
  private readonly stats = new Map<string, string>();

  // ── Diagnosis state (2026-09-29) ──────────────────────────────────────────
  private readonly passStats = new Map<
    string,
    { sample: PassSample; cpu: RollingMs; gpu: RollingMs; lastAt: number; firstFrame: number; runs: number[] }
  >();
  private passOrder: string[] = [];
  /** Which pass keys ran in each recent frame, so a late GPU result finds its passes. */
  private readonly framePassKeys = new Map<number, string[]>();
  /** The refresh rhythm picked last time, kept while frames stay on it (see `analyzeVsync`). */
  private vsyncIntervalMs: number | null = null;
  private readonly costRing: { at: number; costs: FrameCosts }[] = [];
  private readonly partMeans = new Map<string, { ms: RollingMs; lastAt: number }>();
  private readonly memRing: MemorySample[] = [];
  private inventory: SceneInventory | null = null;
  private pendingParts: { name: string; ms: number }[] = [];
  private pendingNotes: string[] = [];
  private spanFrameMs = 0;

  /** See `SessionOrigin`. The renderer probe sets this to `auto`. */
  origin: SessionOrigin = 'named';

  /**
   * The canvas this session draws into, where the renderer probe knows it.
   *
   * It is on the session, not on the snapshot, because a capture rig reads
   * snapshots through `page.evaluate`, which cannot carry a DOM node. The
   * window badge uses it to find which window a surface sits in.
   */
  element: Element | null = null;

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
  frame(nowMs = performance.now()): StallRecord | null {
    const previous = this.lastFrameAt;
    this.lastFrameAt = nowMs;
    const parts = this.pendingParts;
    const notes = this.pendingNotes;
    this.pendingParts = [];
    this.pendingNotes = [];
    if (previous === 0) return null; // the first frame has nothing to measure against

    const delta = nowMs - previous;
    if (delta > IMPLAUSIBLE_FRAME_MS) {
      this.frames.clear();
      return null;
    }
    this.frames.push(delta);
    if (this.recording) this.recording.frames.push(delta);

    /* Judge the frame that just ENDED, with everything known about it.
     *
     * Called here rather than anywhere else because this is the one moment the
     * evidence agrees: the counters, the spans and this delta all describe the
     * same finished frame. Sampled a step earlier or later they would describe
     * two different ones, and the log would blame the wrong frame's work. */
    this.frameIndex++;
    const rec = this.stallLog.observe(
      {
        frame: this.frameIndex,
        frameMs: delta,
        cpuMs: this.pendingCpuMs,
        drawCalls: this.counters.drawCalls,
        triangles: this.counters.triangles,
        spans: this.spans.lastEntries(),
        measured: parts,
        notes,
      },
      nowMs,
    );

    return rec;
  }

  /**
   * File the probe's measurements of the frame that just ended: the named
   * CPU parts, the uploads and compiles, and causes with no time. They are
   * judged by the next `frame()` call, with that frame's time.
   */
  recordFrameParts(parts: { name: string; ms: number }[], costs: FrameCosts, notes: string[], nowMs = performance.now()): void {
    this.pendingParts = parts;
    this.pendingNotes = notes;
    this.costRing.push({ at: nowMs, costs });
    while (this.costRing.length && nowMs - this.costRing[0].at > 10_000) this.costRing.shift();
    for (const p of parts) {
      let m = this.partMeans.get(p.name);
      if (!m) {
        m = { ms: new RollingMs(60), lastAt: nowMs };
        this.partMeans.set(p.name, m);
      }
      m.ms.push(p.ms);
      m.lastAt = nowMs;
    }
  }

  /** File the passes of one frame. `frame` is the id their GPU segments carry. */
  recordPasses(frame: number, passes: PassSample[], nowMs = performance.now()): void {
    const keys: string[] = [];
    for (const p of passes) {
      keys.push(p.key);
      let st = this.passStats.get(p.key);
      if (!st) {
        st = { sample: p, cpu: new RollingMs(60), gpu: new RollingMs(60), lastAt: nowMs, firstFrame: frame, runs: [] };
        this.passStats.set(p.key, st);
      }
      st.sample = p;
      st.cpu.push(p.cpuMs);
      st.lastAt = nowMs;
      if (st.runs[st.runs.length - 1] !== frame) st.runs.push(frame);
      while (st.runs.length && frame - st.runs[0] >= 60) st.runs.shift();
    }
    this.passOrder = keys;
    this.framePassKeys.set(frame, keys);
    for (const f of this.framePassKeys.keys()) if (frame - f > 16) this.framePassKeys.delete(f);
    // Forget passes that stopped running a while ago.
    for (const [k, st] of this.passStats) if (nowMs - st.lastAt > 5000) this.passStats.delete(k);
  }

  /** File one frame's GPU time, split by pass. Also feeds the frame's GPU total. */
  recordPassGpu(result: FramePassGpu): void {
    const keys = this.framePassKeys.get(result.frame);
    if (keys) {
      for (const [index, ms] of result.passes) {
        const key = keys[index];
        if (key) this.passStats.get(key)?.gpu.push(ms);
      }
    }
    this.recordGpu([{ frame: result.frame, ms: result.totalMs }]);
  }

  /** Attach the latest scene walk. */
  setInventory(inventory: SceneInventory | null): void {
    this.inventory = inventory;
  }

  /** True when the heap reading changes often enough to show a garbage collection. */
  heapIsPrecise(): boolean {
    return !memoryTrend(this.memRing).heapCoarse;
  }

  /** The slow frames whose interval overlaps [startMs, endMs]. */
  stallsOverlapping(startMs: number, endMs: number): StallRecord[] {
    return this.stallLog.records().filter((r) => r.startMs < endMs && r.atMs > startMs);
  }

  /** Hand browser-measured parts to one slow frame (see `StallLog.attachBrowserParts`). */
  attachBrowserParts(rec: StallRecord, parts: { name: string; ms: number }[]): boolean {
    return this.stallLog.attachBrowserParts(rec, parts);
  }

  /** Add a cause with no time to a slow frame. */
  addStallNote(frame: number, note: string): void {
    this.stallLog.addNote(frame, note);
  }

  /** The frame a GPU query opened now belongs to. */
  get currentFrame(): number {
    return this.frameIndex + 1;
  }

  /** Attribute a piece of per-frame work by name. */
  span(name: string, ms: number): void {
    this.spans.record(name, ms);
    this.spanFrameMs += ms;
  }

  /**
   * Span milliseconds recorded since the last call, then zero. The renderer
   * probe takes them out of its own "script before the first draw" part, so a
   * solver step that a surface wrapped in a span is not counted twice.
   */
  takeSpanFrameMs(): number {
    const ms = this.spanFrameMs;
    this.spanFrameMs = 0;
    return ms;
  }

  /**
   * File GPU frame times as they arrive.
   *
   * Results lag the frame that produced them by one to three frames, so a call
   * often brings nothing and occasionally brings several. Both are normal.
   */
  recordGpu(results: GpuResult[]): void {
    for (const r of results) {
      // The baseline is read BEFORE this result joins it, or a spike would be
      // compared against a window it had already inflated.
      const base = this.gpu.read();
      this.stallLog.attachGpu(r.frame, r.ms, base.samples > 0 ? base.meanMs : null);
      this.gpu.push(r.ms);
      if (this.recording) this.recording.gpuFrames.push(r.ms);
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
    // Held for the next `frame` call, which is where the whole frame is judged.
    this.pendingCpuMs = ms;
    if (this.recording) this.recording.cpuFrames.push(ms);
  }

  /** Say why this surface has no GPU number, so the display can explain it. */
  setGpuUnavailable(reason: GpuTimerUnavailable | null): void {
    this.gpuUnavailable = reason;
    if (reason !== null) this.gpu.clear();
  }

  /** Attach or clear the component-level scene inventory for this surface. */
  setSceneDiagnostics(diagnostics: SceneDiagnostics | null): void {
    this.sceneDiagnostics = diagnostics;
  }

  /**
   * Show one surface-specific reading in the panel and in the report.
   *
   * This is where a step puts the numbers that only it knows — a solver's
   * wet-cell count, a segment count — so they appear beside the frame times
   * instead of in a second counter on the step. A time in milliseconds per
   * frame belongs in `span` instead, which also feeds the slow-frame log.
   */
  setStat(name: string, value: string | number): void {
    this.stats.set(name, typeof value === 'number' ? formatStat(value) : value);
  }

  clearStat(name: string): void {
    this.stats.delete(name);
  }

  /**
   * File the counters of one finished frame, as the renderer probe added
   * them up. This is the probe's replacement for `sampleRenderer`: the probe
   * already knows the frame total, so nothing here reads `renderer.info`.
   */
  setRendererReading(reading: RendererFrameReading, nowMs = performance.now()): void {
    this.api = reading.api;
    this.counters = reading.counters;
    this.surface = reading.surface;
    this.heapMB = readHeapMB();
    // One memory sample a second, for "memory that moves".
    const lastMem = this.memRing[this.memRing.length - 1];
    if (!lastMem || nowMs - lastMem.at >= 1000) {
      this.memRing.push({
        at: nowMs,
        geometries: reading.counters.geometries,
        textures: reading.counters.textures,
        programs: reading.counters.programs,
        heapMB: this.heapMB,
      });
      if (this.memRing.length > 40) this.memRing.shift();
    }
    if (this.recording && this.counters.triangles > this.recording.worstCounters.triangles) {
      this.recording.worstCounters = { ...this.counters };
    }
  }

  /** Time `fn` and file it under `name`. Returns whatever `fn` returns. */
  measure<T>(name: string, fn: () => T): T {
    const t0 = performance.now();
    try {
      return fn();
    } finally {
      this.span(name, performance.now() - t0);
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
        renderCalls: null,
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
    this.stallLog.clear();
    this.lastFrameAt = 0;
    // The per-pass and per-part windows describe the same frames; clear them too.
    this.passStats.clear();
    this.partMeans.clear();
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
      stallLog: this.stallLog.records(),
      scene: this.sceneDiagnostics,
      origin: this.origin,
      stats: [...this.stats].map(([name, value]) => ({ name, value })),
      passes: this.readPasses(nowMs),
      passGpuNote: this.gpuUnavailable ? GPU_UNAVAILABLE_TEXT[this.gpuUnavailable] : null,
      vsync: this.readVsync(),
      costs: {
        lastSecond: this.sumCosts(nowMs, 1000),
        lastTenSeconds: this.sumCosts(nowMs, 10_000),
      },
      cpuParts: [...this.partMeans]
        .filter(([, m]) => nowMs - m.lastAt < 2000)
        .map(([name, m]) => ({ name, ms: m.ms.read().meanMs }))
        .filter((p) => p.ms >= 0.005)
        .sort((a, b) => b.ms - a.ms),
      memory: memoryTrend(this.memRing),
      inventory: this.inventory,
    };
  }

  private readVsync(): VsyncReading {
    const v = analyzeVsync(this.frames.recent(GRAPH_SAMPLES), this.vsyncIntervalMs);
    if (v.intervalMs !== null) this.vsyncIntervalMs = v.intervalMs;
    return v;
  }

  private sumCosts(nowMs: number, windowMs: number): FrameCosts {
    let sum = { ...ZERO_COSTS };
    for (const c of this.costRing) if (nowMs - c.at <= windowMs) sum = addCosts(sum, c.costs);
    return sum;
  }

  /** The passes of the latest frame first, in the order they ran, then any that ran recently. */
  private readPasses(nowMs: number): PassReading[] {
    const order = [...this.passOrder];
    for (const [k, st] of this.passStats) if (!order.includes(k) && nowMs - st.lastAt < 2000) order.push(k);
    const latest = this.frameIndex;
    const out: PassReading[] = [];
    for (const key of order) {
      const st = this.passStats.get(key);
      if (!st) continue;
      const g = st.gpu.read();
      const span = Math.max(1, Math.min(60, latest - st.firstFrame + 1));
      out.push({
        key,
        name: st.sample.name,
        kind: st.sample.kind,
        depth: st.sample.depth,
        sceneKey: st.sample.sceneKey,
        target: st.sample.target,
        cpuMs: st.cpu.read().meanMs,
        gpuMs: g.samples > 0 ? g.meanMs : null,
        triangles: st.sample.triangles,
        drawCalls: st.sample.drawCalls,
        lines: st.sample.lines,
        points: st.sample.points,
        runShare: Math.min(1, st.runs.length / span),
      });
    }
    return out;
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
      `${s.label} [${s.api}${s.origin === 'auto' ? ', found by the renderer probe' : ''}] — live window`,
      `  fps      ${s.frame.fps.toFixed(1)} over ${s.frame.samples} frames`,
      `  frame    ${s.frame.meanMs.toFixed(1)} ms mean · ${s.frame.p95Ms.toFixed(1)} p95 · ${s.frame.worstMs.toFixed(1)} worst`,
      `  gpu      ${describeGpu(s.gpu, classifyBottleneck(s.gpu.meanMs, s.cpuMs, s.frame.meanMs))}`,
      `  cpu      ${s.cpuMs === null ? 'not measured' : `${s.cpuMs.toFixed(2)} ms of work per frame`}`,
      `  stalls   ${s.stalls} frames over ${STALL_MS.toFixed(0)} ms`,
      `  draws    ${s.counters.drawCalls} calls · ${s.counters.triangles.toLocaleString()} triangles${
        s.counters.lines > 0 ? ` · ${s.counters.lines.toLocaleString()} lines` : ''
      }${s.counters.points > 0 ? ` · ${s.counters.points.toLocaleString()} points` : ''}${
        s.counters.renderCalls === null ? '' : ` · ${s.counters.renderCalls} render passes`
      }`,
      `  memory   ${s.counters.geometries} geometries · ${s.counters.textures} textures${
        s.counters.programs === null ? '' : ` · ${s.counters.programs} programs`
      }${s.heapMB === null ? '' : ` · heap ${s.heapMB.toFixed(0)} MB`}`,
      `  surface  ${s.surface.width}x${s.surface.height} at dpr ${s.surface.dpr}`,
    ];
    if (s.scene) lines.push(...describeSceneDiagnostics(s.scene, s.counters.triangles));
    // Calls to renderer.compute per frame; one call may dispatch many nodes.
    if (s.counters.computeCalls > 0) lines.push(`  compute  ${s.counters.computeCalls} calls/frame`);
    if (s.spans.length > 0) {
      lines.push(`  spans    ${s.spans.map((sp) => `${sp.name} ${sp.ms.toFixed(2)} ms`).join(' · ')}`);
    }
    if (s.stats.length > 0) {
      lines.push(`  surface  ${s.stats.map((st) => `${st.name} ${st.value}`).join(' · ')}`);
    }
    lines.push('', ...describeDiagnosis(s));
    /* The slow frames go into the pasted report, not only on screen.
     *
     * A performance complaint travels as text. Everything above describes the
     * frames that were FINE; these are the ones being complained about. */
    if (s.stallLog.length > 0) {
      lines.push('', `  slow frames (${s.stallLog.length}, newest first)`);
      for (const rec of s.stallLog.slice(0, 5)) {
        lines.push(...describeStall(rec).split('\n').map((l) => `  ${l}`));
      }
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
      ...(this.sceneDiagnostics
        ? describeSceneDiagnostics(this.sceneDiagnostics, c.triangles)
        : []),
    ].join('\n');
  }
}

const MB = 1024 * 1024;

/** Bytes as a short string: "4.1 MB", "820 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * The diagnosis as plain text: the vsync floor, the passes, the groups, what
 * the camera sees, the uploads and compiles, and the memory that moves. The
 * panel shows the same facts; this is the form that travels in a report.
 */
export function describeDiagnosis(s: PerfSnapshot): string[] {
  const out: string[] = [];
  const v = s.vsync;
  const work = readWork(s.frame.meanMs, s.gpu.meanMs, s.cpuMs, v, v.intervalMs ?? 1000 / 60);
  if (v.locked && v.intervalMs !== null) {
    out.push(
      `  vsync    frame time is the display rhythm: ${v.hz} Hz, ${v.intervalMs.toFixed(1)} ms per refresh, ` +
        `${v.refreshesPerFrame} refresh${v.refreshesPerFrame === 1 ? '' : 'es'} per frame (${Math.round(v.lockedShare * 100)}% of frames on it)`,
    );
  } else {
    out.push('  vsync    not locked to a display rhythm: the frame time is the work itself');
  }
  if (work.busiestMs !== null) {
    out.push(
      `  work     ${work.busiestSide === 'gpu' ? 'GPU' : 'CPU'} ${work.busiestMs.toFixed(2)} ms is the longer side` +
        (work.serialMs !== null ? ` · ${work.serialMs.toFixed(2)} ms if CPU and GPU ran in series` : '') +
        (s.gpu.meanMs === null ? ' · GPU not measured' : ''),
    );
    if (work.waitMs !== null) out.push(`  wait     ${work.waitMs.toFixed(2)} ms per frame waiting for the display`);
    if (work.headroomMs !== null && work.headroomShare !== null) {
      out.push(
        `  headroom ${work.headroomMs.toFixed(2)} ms (${Math.round(work.headroomShare * 100)}%) against ${work.budgetMs.toFixed(1)} ms per frame` +
          (work.gpuMeasured ? '' : ' — CPU side only; the GPU side is not measured and may already fill the frame'),
      );
    }
  }
  if (s.passes.length > 0) {
    out.push(`  passes   (${s.passes.length}, in order; cpu · gpu · tris)`);
    for (const p of s.passes) {
      out.push(
        `    ${'  '.repeat(p.depth)}${p.name.slice(0, 40).padEnd(40 - 2 * p.depth)} ` +
          `${p.cpuMs.toFixed(2)} · ${p.gpuMs === null ? '—' : p.gpuMs.toFixed(2)} · ${p.triangles.toLocaleString()}` +
          (p.runShare < 0.95 ? ` · ran ${Math.round(p.runShare * 100)}% of frames` : ''),
      );
    }
    if (s.passGpuNote) out.push(`    gpu per pass: ${s.passGpuNote}`);
  }
  if (s.cpuParts.length > 0) {
    out.push(`  cpu      ${s.cpuParts.slice(0, 6).map((p) => `${p.name} ${p.ms.toFixed(2)}`).join(' · ')}`);
  }
  const c = s.costs.lastTenSeconds;
  out.push(
    `  uploads  last 10 s: textures ${c.textureUploads} (${formatBytes(c.textureBytes)}, ${c.textureUploadMs.toFixed(1)} ms) · ` +
      `buffers ${c.bufferUploads} (${formatBytes(c.bufferBytes)}, ${c.bufferUploadMs.toFixed(1)} ms) · ` +
      `compiles ${c.compiles} (${c.compileMs.toFixed(1)} ms) · GPU readbacks ${c.readbacks} (${c.readbackMs.toFixed(1)} ms)`,
  );
  const m = s.memory.perSecondOver10s;
  if (m) {
    out.push(
      `  growth   per second over 10 s: ${m.geometries.toFixed(2)} geo · ${m.textures.toFixed(2)} tex` +
        (m.programs !== null ? ` · ${m.programs.toFixed(2)} prog` : '') +
        (m.heapMB !== null ? ` · ${m.heapMB.toFixed(2)} MB heap` : '') +
        (s.memory.growing.length ? ` · GROWING: ${s.memory.growing.join(', ')}` : '') +
        (s.memory.heapCoarse ? ' · heap reading is coarse (no --enable-precise-memory-info)' : ''),
    );
  }
  const inv = s.inventory;
  if (inv) {
    out.push(`  groups   (${inv.groups.length}; tris · in view)`);
    for (const g of inv.groups.slice(0, 8)) {
      out.push(`    ${g.name.slice(0, 28).padEnd(28)} ${g.triangles.toLocaleString()} · ${g.inViewTriangles.toLocaleString()}${g.source === 'unnamed' ? '' : ` (${g.source})`}`);
    }
    for (const sc of inv.scenes) {
      out.push(`  view     ${sc.label} via ${sc.camera}: ${sc.mountedTriangles.toLocaleString()} mounted · ${sc.inViewTriangles.toLocaleString()} in view`);
    }
    out.push(
      inv.nearestWater
        ? `  water    nearest bound ${inv.nearestWater.distanceM.toFixed(1)} m (${inv.nearestWater.group})`
        : `  water    ${inv.waterNamed ? 'no bounds yet' : 'no group is named water (set userData.perfGroup = "water")'}`,
    );
  }
  return out;
}

/** Plain-text scene diagnosis shared by live and recorded reports. */
function describeSceneDiagnostics(scene: SceneDiagnostics, renderedTriangles: number): string[] {
  const amplification = scene.triangles > 0 ? renderedTriangles / scene.triangles : 0;
  const lines = [
    `  scene    ${scene.meshes.toLocaleString()} meshes · ${scene.instances.toLocaleString()} instances · ${scene.triangles.toLocaleString()} main-pass triangles`,
    `  shadows  ${scene.shadowMeshes.toLocaleString()} casters · ${scene.shadowTriangles.toLocaleString()} potential shadow triangles · ${amplification.toFixed(2)}x rendered/main`,
  ];
  for (const family of scene.families.slice(0, 5)) {
    lines.push(
      `    ${family.family.padEnd(18)} ${family.meshes.toLocaleString()} meshes · ${family.instances.toLocaleString()} instances · ${family.triangles.toLocaleString()} tris${
        family.shadowTriangles > 0 ? ` · ${family.shadowTriangles.toLocaleString()} shadow` : ''
      }`,
    );
  }
  return lines;
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
  /* NOT MEASURED ON WEBGPU, and the reason is a defect, not a missing feature.
   *
   * three r172 writes timestamp queries only into the FIRST pass descriptor it
   * builds, then keeps resolving those same two stamps. A number read from
   * `renderer.info.*.timestamp` is therefore constant forever (found on the
   * ocean viewer, 2026-09-25). Showing it would be worse than showing nothing. */
  webgpu: 'no GPU clock (WebGPU: three r172 timestamps record only the first pass, so a per-frame GPU time would be false)',
  'no-context': 'no GPU clock (no renderer context)',
  disabled: 'GPU timing turned off for this surface',
};

/** A number short enough for one panel row: integers stay exact, others keep 2 places. */
function formatStat(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

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
