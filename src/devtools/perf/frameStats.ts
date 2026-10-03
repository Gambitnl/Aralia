/**
 * Frame timing statistics.
 *
 * A mean frame rate is the least useful number a performance display can show.
 * A scene that runs at a steady 60, and a scene that runs at 120 for half a
 * second then stalls for 250 ms, both report "60 fps" — and only one of them is
 * usable. The stall is the thing worth finding, so this keeps the WORST frame
 * and the 95th percentile alongside the mean, and treats them as first-class.
 *
 * The window is a fixed ring buffer over wall-clock time rather than a frame
 * count. A frame count window shrinks in duration exactly when frames get slow,
 * so the display forgets a stall at the moment it happens.
 *
 * This module is the measurement core. It knows nothing about three.js, React,
 * or the DOM, so it runs in a test with no browser and no renderer.
 */

export interface FrameReading {
  /** Frames per second over the window. */
  fps: number;
  /** Mean frame time in milliseconds. */
  meanMs: number;
  /** The single worst frame in the window. The number that matters. */
  worstMs: number;
  /** 95th percentile frame time — the felt roughness, minus one-off spikes. */
  p95Ms: number;
  /** How many frames the reading covers. Small counts are not trustworthy. */
  samples: number;
}

const EMPTY: FrameReading = { fps: 0, meanMs: 0, worstMs: 0, p95Ms: 0, samples: 0 };

/** A frame slower than this reads as a visible hitch at 60 Hz. */
export const STALL_MS = 1000 / 30;

export class FrameStats {
  private readonly ms: Float32Array;
  private readonly age: Float64Array;
  private head = 0;
  private count = 0;
  private now = 0;

  /**
   * @param windowMs How much history to keep. One second reads as "right now";
   *   shorter windows jitter, longer ones hide a stall behind good frames.
   * @param capacity Ring size. Sized for a fast display, not for the average.
   */
  constructor(
    private readonly windowMs = 1000,
    capacity = 600,
  ) {
    this.ms = new Float32Array(capacity);
    this.age = new Float64Array(capacity);
  }

  /** Record one frame. `ms` is that frame's duration. */
  push(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.now += ms;
    this.ms[this.head] = ms;
    this.age[this.head] = this.now;
    this.head = (this.head + 1) % this.ms.length;
    if (this.count < this.ms.length) this.count++;
  }

  /** Drop everything, for a reset after a rebuild. */
  clear(): void {
    this.count = 0;
    this.head = 0;
  }

  /**
   * The frames still inside the window, newest first.
   *
   * Every other reader is built on this, so the window rule lives in one place.
   */
  private windowNewestFirst(): number[] {
    const out: number[] = [];
    if (this.count === 0) return out;
    const cutoff = this.now - this.windowMs;
    for (let k = 0; k < this.count; k++) {
      const i = (this.head - 1 - k + this.ms.length) % this.ms.length;
      if (this.age[i] <= cutoff) break; // ring is ordered, so we can stop
      out.push(this.ms[i]);
    }
    return out;
  }

  read(): FrameReading {
    const inWindow = this.windowNewestFirst();
    if (inWindow.length === 0) return EMPTY;

    let total = 0;
    let worst = 0;
    for (const v of inWindow) {
      total += v;
      if (v > worst) worst = v;
    }

    /* The percentile is over the window, sorted on read.
     *
     * Sorting up to a few hundred numbers a few times a second is nothing, and
     * a streaming estimator would trade real accuracy for savings nobody needs
     * at this scale. */
    const sorted = inWindow.slice().sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const meanMs = total / inWindow.length;
    return {
      fps: meanMs > 0 ? 1000 / meanMs : 0,
      meanMs,
      worstMs: worst,
      p95Ms: sorted[idx],
      samples: inWindow.length,
    };
  }

  /**
   * How many frames in the window were slower than `thresholdMs`.
   *
   * A percentile answers "how rough", this answers "how often". Three hitches a
   * second and one hitch a second can share a p95 and feel nothing alike.
   */
  stalls(thresholdMs = STALL_MS): number {
    let n = 0;
    for (const v of this.windowNewestFirst()) if (v > thresholdMs) n++;
    return n;
  }

  /** The last `n` frame times, oldest first, for a graph. */
  recent(n: number): number[] {
    const newestFirst = this.windowNewestFirst();
    return newestFirst.slice(0, n).reverse();
  }
}

/**
 * A named stopwatch for work inside a frame.
 *
 * The renderer's own timing says how long a frame took, never where it went.
 * These are the pieces a surface can attribute for itself: the fluid solver,
 * the mesh rebuild, the chunk upload.
 */
export class SpanTimer {
  private readonly spans = new Map<string, { last: number; ema: number }>();

  record(name: string, ms: number): void {
    const s = this.spans.get(name);
    if (!s) {
      this.spans.set(name, { last: ms, ema: ms });
      return;
    }
    s.last = ms;
    // A light exponential average: steady enough to read, quick to react.
    s.ema = s.ema * 0.9 + ms * 0.1;
  }

  /** Smoothed milliseconds for a span, or zero when it has never run. */
  get(name: string): number {
    return this.spans.get(name)?.ema ?? 0;
  }

  names(): string[] {
    return [...this.spans.keys()];
  }

  entries(): { name: string; ms: number }[] {
    return [...this.spans.entries()].map(([name, s]) => ({ name, ms: s.ema }));
  }

  /**
   * The most recent reading for each span, unsmoothed.
   *
   * The average is right for a live display and wrong for a stall. A 400 ms
   * rebuild moves its own average by 40 ms, so a second later the span that
   * ruined the frame reads as almost normal. Whatever inspects one BAD frame
   * has to see what that frame actually cost.
   */
  lastEntries(): { name: string; ms: number }[] {
    return [...this.spans.entries()].map(([name, s]) => ({ name, ms: s.last }));
  }

  clear(): void {
    this.spans.clear();
  }
}

/**
 * A short window of millisecond readings.
 *
 * GPU times and per-frame CPU work both need the same treatment as frame times
 * — a mean alone hides the spike — but they arrive irregularly and, for the
 * GPU, several frames late. The wall-clock window used for frames does not
 * apply to them. A fixed count of recent readings does.
 */
export class RollingMs {
  private readonly ring: number[] = [];

  constructor(private readonly capacity = 120) {}

  push(ms: number): void {
    this.ring.push(ms);
    if (this.ring.length > this.capacity) this.ring.shift();
  }

  clear(): void {
    this.ring.length = 0;
  }

  read(): { meanMs: number; p95Ms: number; worstMs: number; samples: number } {
    const n = this.ring.length;
    if (n === 0) return { meanMs: 0, p95Ms: 0, worstMs: 0, samples: 0 };
    const sorted = this.ring.slice().sort((a, b) => a - b);
    const total = this.ring.reduce((a, b) => a + b, 0);
    return {
      meanMs: total / n,
      p95Ms: sorted[Math.min(n - 1, Math.floor(n * 0.95))],
      worstMs: sorted[n - 1],
      samples: n,
    };
  }
}
