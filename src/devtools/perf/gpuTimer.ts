/**
 * GPU time per frame, measured on the GPU.
 *
 * Every other number in this toolkit is measured on the CPU. A frame that takes
 * 30 ms tells you the frame was slow; it never tells you whether the CPU built
 * the frame slowly or the GPU drew it slowly. Those two have opposite fixes —
 * fewer draw calls against fewer pixels and simpler shaders — and guessing
 * wrong costs a day.
 *
 * `EXT_disjoint_timer_query_webgl2` answers it directly. The GPU writes a
 * timestamp when it starts the work and another when it finishes, so the result
 * excludes everything the CPU did.
 *
 * FOUR RULES THE EXTENSION IMPOSES, each of which this class exists to hold:
 *
 * 1. Only ONE elapsed-time query may be open on a context at a time. So there
 *    is one open query, never a set.
 * 2. The result is not ready in the frame that produced it. It arrives a few
 *    frames later, so finished queries wait in a queue and are polled.
 * 3. `GPU_DISJOINT_EXT` reports that the GPU was interrupted — a mode switch, a
 *    context loss, another process taking the device. Every in-flight result is
 *    then meaningless and gets thrown away rather than reported as a spike.
 * 4. Browsers may withhold the extension entirely, because a precise GPU clock
 *    is a fingerprinting surface. That is a normal outcome, not an error, and
 *    the caller is told which reason applies.
 */

/** Why no timer could be made. Null means one was. */
export type GpuTimerUnavailable =
  | 'no-webgl2'
  | 'no-extension'
  | 'webgpu'
  | 'no-context'
  /** The surface asked not to be timed, because it owns the query slot. */
  | 'disabled';

export interface GpuTimerAttempt {
  timer: GpuFrameTimer | null;
  reason: GpuTimerUnavailable | null;
}

/** The slice of WebGL2 this needs. Narrow so a test can supply a fake. */
interface TimerGl {
  getExtension(name: string): unknown;
  getParameter(pname: number): unknown;
  createQuery(): WebGLQuery | null;
  deleteQuery(query: WebGLQuery): void;
  beginQuery(target: number, query: WebGLQuery): void;
  endQuery(target: number): void;
  getQueryParameter(query: WebGLQuery, pname: number): unknown;
  QUERY_RESULT: number;
  QUERY_RESULT_AVAILABLE: number;
}

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

/**
 * How many finished queries may wait for their result.
 *
 * Results lag by one to three frames. A few spare slots absorb that without
 * ever making the timer the reason a frame stalls: when the pool is full the
 * class simply skips a frame's measurement.
 */
const POOL_SIZE = 8;

/** A GPU time, and the frame it belongs to. */
export interface GpuResult {
  frame: number;
  ms: number;
}

export class GpuFrameTimer {
  private readonly free: WebGLQuery[] = [];
  private readonly inFlight: { query: WebGLQuery; frame: number }[] = [];
  private open: { query: WebGLQuery; frame: number } | null = null;
  private disposed = false;

  private constructor(
    private readonly gl: TimerGl,
    private readonly ext: TimerExt,
  ) {}

  /**
   * Build a timer for a three renderer, or explain why not.
   *
   * WebGPU is called out separately from a missing extension because they are
   * different situations: one is a browser declining to expose a clock, the
   * other is an API whose own timestamp queries three only resolves through
   * `renderAsync`, which the render loop here does not call.
   */
  static forRenderer(renderer: unknown): GpuTimerAttempt {
    const r = renderer as {
      isWebGPURenderer?: boolean;
      getContext?: () => unknown;
    } | null;
    if (!r) return { timer: null, reason: 'no-context' };
    if (r.isWebGPURenderer) return { timer: null, reason: 'webgpu' };

    const ctx = r.getContext?.() as TimerGl | undefined;
    if (!ctx) return { timer: null, reason: 'no-context' };
    // Duck-typed rather than `instanceof WebGL2RenderingContext`, so a fake
    // context in a test works and a WebGL1 context is rejected by the same
    // check that finds the query calls missing.
    if (typeof ctx.createQuery !== 'function') return { timer: null, reason: 'no-webgl2' };

    const ext = ctx.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    if (!ext) return { timer: null, reason: 'no-extension' };

    return { timer: new GpuFrameTimer(ctx, ext), reason: null };
  }

  /**
   * Collect finished results and open a query for the frame about to be drawn.
   *
   * Call this ONCE per frame, before the frame's draw calls, and pair it with
   * `endFrame` at the end of the same frame — see that method for why the pair
   * matters more than it looks.
   *
   * @returns milliseconds for every frame whose result arrived since the last
   *   call. Usually zero or one, occasionally more after a hitch.
   */
  beginFrame(frame = 0): GpuResult[] {
    if (this.disposed) return [];

    const results = this.collect();

    // Skip a frame rather than grow without limit. A timer that allocated a
    // query per frame while results lagged would leak GPU objects steadily.
    const next = this.free.pop() ?? (this.total() < POOL_SIZE ? this.gl.createQuery() : null);
    if (next) {
      this.open = { query: next, frame };
      this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, next);
    }

    return results;
  }

  /**
   * Close the open query, at the END of the frame's work and BEFORE the present.
   *
   * THIS IS THE MEASUREMENT, and getting it wrong produces a number that looks
   * plausible and is worthless.
   *
   * The first version of this class closed the query at the START of the next
   * frame. That interval spans the frame boundary, so it swallows the GPU's
   * idle wait for the display's vertical blank. Every vsync-locked scene then
   * reported GPU time equal to the frame time: a dungeon with 2.4 million
   * triangles and a single toon wizard both read "16 ms, GPU bound", which is
   * true of neither and useless for both.
   *
   * Closing here — after the render calls are queued, before the browser
   * presents — measures the drawing and nothing else.
   */
  endFrame(): void {
    if (this.disposed || !this.open) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.inFlight.push(this.open);
    this.open = null;
  }

  /**
   * Drain finished queries.
   *
   * A disjoint GPU invalidates EVERY in-flight result, not only the newest, so
   * the whole queue is recycled without reporting any of it.
   */
  private collect(): GpuResult[] {
    if (this.gl.getParameter(this.ext.GPU_DISJOINT_EXT) === true) {
      while (this.inFlight.length > 0) this.free.push(this.inFlight.shift()!.query);
      return [];
    }

    const out: GpuResult[] = [];
    while (this.inFlight.length > 0) {
      const { query, frame } = this.inFlight[0];
      if (this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE) !== true) break;
      const ns = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) as number;
      this.inFlight.shift();
      this.free.push(query);
      if (typeof ns === 'number' && Number.isFinite(ns) && ns >= 0) out.push({ frame, ms: ns / 1e6 });
    }
    return out;
  }

  private total(): number {
    return this.free.length + this.inFlight.length + (this.open ? 1 : 0);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.open) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.free.push(this.open.query);
      this.open = null;
    }
    for (const q of this.inFlight) this.gl.deleteQuery(q.query);
    for (const q of this.free) this.gl.deleteQuery(q);
    this.inFlight.length = 0;
    this.free.length = 0;
  }
}
