/**
 * What the slow frame was doing.
 *
 * Every other number in this toolkit is an average, a percentile or a count.
 * All three describe a POPULATION of frames, and a stall is not a population —
 * it is one frame that went wrong. Averages actively hide it: the span timer
 * weights a new reading at 0.1, so a single 400 ms rebuild moves its own
 * average by 40 ms and reads as almost normal a second later.
 *
 * So this keeps the frame itself. When a frame runs long, everything known
 * about it is written down before the next frame overwrites it, and each figure
 * is compared against what that figure normally is. The output is not "a stall
 * happened" but "this frame cost 21.6 ms more than usual, and 18.2 ms of that
 * was the water mesh".
 *
 * THE COMPARISON IS THE POINT. A stall frame with 20 ms in the water mesh means
 * nothing on a page where the water mesh always costs 20 ms. The same 20 ms
 * against a normal of 2 ms is the answer. Nothing here reports a raw value
 * without the baseline beside it.
 */

/** A named cost that was higher than usual on the slow frame. */
export interface StallContributor {
  name: string;
  /** Milliseconds above this cost's normal value. Always positive. */
  deltaMs: number;
  /** What it cost on the slow frame. */
  valueMs: number;
  /** What it normally costs. */
  baselineMs: number;
}

export interface StallRecord {
  /** Frame number, so a late GPU result can find its own frame again. */
  frame: number;
  /** `performance.now()` when the frame was recorded. */
  atMs: number;
  frameMs: number;
  /** The normal frame time this is measured against. */
  baselineMs: number;
  cpuMs: number | null;
  /** Null until the GPU result for this frame arrives, a few frames later. */
  gpuMs: number | null;
  drawCalls: number;
  baselineDrawCalls: number;
  triangles: number;
  baselineTriangles: number;
  /** Ranked, largest first. Empty when nothing measured explains the frame. */
  contributors: StallContributor[];
}

/** One frame's worth of evidence, handed in by the session. */
export interface FrameSample {
  frame: number;
  frameMs: number;
  cpuMs: number | null;
  drawCalls: number;
  triangles: number;
  /** Each span's LAST value, never its average. */
  spans: { name: string; ms: number }[];
}

/**
 * A rolling median.
 *
 * The median, not the mean, because the baseline has to survive the very
 * outliers it is used to detect. A mean baseline rises to meet a stall and then
 * reports that the stall was normal.
 */
class Baseline {
  private readonly ring: number[] = [];

  constructor(private readonly capacity = 90) {}

  push(v: number): void {
    this.ring.push(v);
    if (this.ring.length > this.capacity) this.ring.shift();
  }

  /** The median, or null while there is too little history to trust one. */
  get(minSamples = 12): number | null {
    if (this.ring.length < minSamples) return null;
    const sorted = this.ring.slice().sort((a, b) => a - b);
    return sorted[sorted.length >> 1];
  }

  clear(): void {
    this.ring.length = 0;
  }
}

/** How much longer than normal a frame must run before it is worth recording. */
const STALL_RATIO = 1.75;

/** And by at least this much, so a fast scene does not log its own jitter. */
const STALL_FLOOR_MS = 5;

/** A cost has to move by this much to be named at all. */
const CONTRIBUTOR_FLOOR_MS = 0.2;

/**
 * And by this share of the overrun before it may be named.
 *
 * Without it a trivial move headlines a huge frame. A live test caught exactly
 * that: a 122 ms frame, of which the tool could see 1 ms of CPU and 2 ms of
 * GPU, was reported as "GPU +0.9 ms". True, irrelevant, and the reader would
 * have gone hunting through shaders for a hundred milliseconds that were never
 * on the GPU at all.
 */
const CONTRIBUTOR_FLOOR_SHARE = 0.05;

/** What the tool could not see. Named so the list cannot imply it adds up. */
const OUTSIDE = 'outside the measured frame';

/** How many stalls to keep. Enough to see a pattern, few enough to read. */
const KEEP = 12;

export class StallLog {
  private readonly frameBase = new Baseline();
  private readonly cpuBase = new Baseline();
  private readonly drawBase = new Baseline();
  private readonly triBase = new Baseline();
  private readonly spanBase = new Map<string, Baseline>();
  private readonly kept: StallRecord[] = [];

  /**
   * Judge one frame, and record it when it went wrong.
   *
   * The baselines update only on NORMAL frames. Feeding a stall back into its
   * own baseline is how a scene that stutters steadily teaches the tool that
   * stuttering is fine.
   *
   * @returns the record, when this frame stalled.
   */
  observe(s: FrameSample, nowMs = performance.now()): StallRecord | null {
    const baselineMs = this.frameBase.get();
    const isStall =
      baselineMs !== null &&
      s.frameMs > baselineMs * STALL_RATIO &&
      s.frameMs > baselineMs + STALL_FLOOR_MS;

    if (!isStall) {
      this.frameBase.push(s.frameMs);
      if (s.cpuMs !== null) this.cpuBase.push(s.cpuMs);
      this.drawBase.push(s.drawCalls);
      this.triBase.push(s.triangles);
      for (const span of s.spans) this.baseFor(span.name).push(span.ms);
      return null;
    }

    const overrunMs = s.frameMs - baselineMs;
    const floorMs = Math.max(CONTRIBUTOR_FLOOR_MS, overrunMs * CONTRIBUTOR_FLOOR_SHARE);

    const contributors: StallContributor[] = [];
    let namedMs = 0;
    for (const span of s.spans) {
      const base = this.baseFor(span.name).get() ?? 0;
      const deltaMs = span.ms - base;
      if (deltaMs < floorMs) continue;
      contributors.push({ name: span.name, deltaMs, valueMs: span.ms, baselineMs: base });
      namedMs += deltaMs;
    }

    /* Whatever the named costs do not account for.
     *
     * Without this line the list quietly implies the spans add up to the frame,
     * and they never do — nothing measures React, the scene graph walk, garbage
     * collection, or any code nobody thought to wrap in a span. Naming the
     * remainder is what stops the list from lying by omission. */
    const cpuBase = this.cpuBase.get();
    if (s.cpuMs !== null && cpuBase !== null) {
      const unnamed = s.cpuMs - cpuBase - namedMs;
      if (unnamed >= floorMs) {
        contributors.push({
          name: 'unattributed CPU',
          deltaMs: unnamed,
          valueMs: s.cpuMs,
          baselineMs: cpuBase,
        });
      }
      if (unnamed > 0) namedMs += unnamed;
    }

    /* Time the tool never saw at all.
     *
     * The spans and the CPU measurement cover the animation frame this toolkit
     * runs inside. A browser task, garbage collection, another library's own
     * frame callback, a layout — none of it is in there, and on a bad frame it
     * is often ALL of it. Leaving it out let a 0.9 ms move headline a 105 ms
     * frame. Naming it says the honest thing: look outside this scene. */
    const outsideMs = overrunMs - namedMs;
    if (outsideMs >= floorMs) {
      contributors.push({
        name: OUTSIDE,
        deltaMs: outsideMs,
        valueMs: s.frameMs,
        baselineMs,
      });
    }

    contributors.sort((a, b) => b.deltaMs - a.deltaMs);

    const record: StallRecord = {
      frame: s.frame,
      atMs: nowMs,
      frameMs: s.frameMs,
      baselineMs,
      cpuMs: s.cpuMs,
      gpuMs: null,
      drawCalls: s.drawCalls,
      baselineDrawCalls: this.drawBase.get() ?? 0,
      triangles: s.triangles,
      baselineTriangles: this.triBase.get() ?? 0,
      contributors,
    };

    this.kept.unshift(record);
    if (this.kept.length > KEEP) this.kept.length = KEEP;
    return record;
  }

  /**
   * Attach a GPU time to the frame it belongs to.
   *
   * GPU results arrive one to three frames after the frame they measure, so a
   * stall is always written down before its GPU time exists. Matching by frame
   * number is the only way the two ever meet — and without it a GPU spike and
   * the frame it ruined are two unrelated numbers in the same panel.
   */
  attachGpu(frame: number, gpuMs: number, baselineGpuMs: number | null): void {
    const rec = this.kept.find((r) => r.frame === frame);
    if (!rec || rec.gpuMs !== null) return;
    rec.gpuMs = gpuMs;

    if (baselineGpuMs === null) return;
    const deltaMs = gpuMs - baselineGpuMs;
    const floorMs = Math.max(
      CONTRIBUTOR_FLOOR_MS,
      (rec.frameMs - rec.baselineMs) * CONTRIBUTOR_FLOOR_SHARE,
    );
    if (deltaMs < floorMs) return;
    rec.contributors.push({ name: 'GPU', deltaMs, valueMs: gpuMs, baselineMs: baselineGpuMs });

    // The GPU has now explained part of what was unexplained; take it off.
    const outside = rec.contributors.find((c) => c.name === OUTSIDE);
    if (outside) {
      outside.deltaMs -= deltaMs;
      if (outside.deltaMs < floorMs) {
        rec.contributors.splice(rec.contributors.indexOf(outside), 1);
      }
    }
    rec.contributors.sort((a, b) => b.deltaMs - a.deltaMs);
  }

  /** Newest first. */
  records(): StallRecord[] {
    return this.kept;
  }

  clear(): void {
    this.kept.length = 0;
    this.frameBase.clear();
    this.cpuBase.clear();
    this.drawBase.clear();
    this.triBase.clear();
    for (const b of this.spanBase.values()) b.clear();
  }

  private baseFor(name: string): Baseline {
    let b = this.spanBase.get(name);
    if (!b) {
      b = new Baseline();
      this.spanBase.set(name, b);
    }
    return b;
  }
}

/** One stall as a line of text, for the panel and for a pasted report. */
export function describeStall(r: StallRecord): string {
  const over = r.frameMs - r.baselineMs;
  const head = `${r.frameMs.toFixed(1)} ms frame — ${over.toFixed(1)} ms over the usual ${r.baselineMs.toFixed(1)}`;
  if (r.contributors.length === 0) {
    return `${head}\n  nothing measured explains it — no span covers the work that ran`;
  }
  const lines = r.contributors
    .slice(0, 4)
    .map(
      (c) =>
        `  ${c.name.padEnd(18)} +${c.deltaMs.toFixed(1)} ms  (${c.valueMs.toFixed(1)} against ${c.baselineMs.toFixed(1)})`,
    );
  const draws =
    r.drawCalls !== r.baselineDrawCalls
      ? `\n  draws ${r.drawCalls} against ${r.baselineDrawCalls} · tris ${r.triangles.toLocaleString()} against ${r.baselineTriangles.toLocaleString()}`
      : '';
  return `${head}\n${lines.join('\n')}${draws}`;
}
