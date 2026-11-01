/**
 * @file diagnose.ts
 * Pure rules that turn the panel's numbers into a diagnosis.
 *
 * Show measured contributors and missing coverage, not just an FPS gauge.
 * Callback and page-work intervals share one clock; rolling CPU/GPU samples
 * remain separate. Unobserved time is never assumed to be spare capacity.
 * Each rule is independent of the DOM and three, so a test can pin it.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/10/2026, 14:31:23
 * Dependents: devtools/perf/PerfOverlay.tsx, devtools/perf/index.ts, devtools/perf/perfSession.ts, devtools/perf/rendererProbe.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { FrameAttributionReading } from './frameAttribution';

// ── 1. The vsync floor ────────────────────────────────────────────────────────

/** Display refresh rates common enough to snap to. */
export const KNOWN_REFRESH_HZ = [360, 240, 165, 144, 120, 100, 90, 75, 60, 50, 48, 30];

/** How close a rhythm must be to a known refresh interval to count as one. */
const SNAP_TOLERANCE = 0.05;

/** How close a frame must be to a whole number of refreshes to count as locked. */
const LOCK_TOLERANCE = 0.08;

/** The share of frames that must sit on the rhythm for the page to count as locked. */
const LOCKED_SHARE = 0.8;

export interface VsyncReading {
  /** One display refresh, ms. Null when no known refresh rhythm was seen. */
  intervalMs: number | null;
  hz: number | null;
  /** True when most frames land on a whole number of refreshes. */
  locked: boolean;
  /** The share of frames on the rhythm, 0 to 1. */
  lockedShare: number;
  /** Refreshes per frame (1 at 60 fps on a 60 Hz display, 2 at 30 fps). */
  refreshesPerFrame: number | null;
}

/** The nearest known refresh interval, or null when none is within 5%. */
export function snapToRefresh(ms: number): { intervalMs: number; hz: number } | null {
  let best: { intervalMs: number; hz: number } | null = null;
  let bestErr = Infinity;
  for (const hz of KNOWN_REFRESH_HZ) {
    const interval = 1000 / hz;
    const err = Math.abs(ms - interval) / interval;
    if (err < bestErr) {
      bestErr = err;
      best = { intervalMs: interval, hz };
    }
  }
  return best && bestErr <= SNAP_TOLERANCE ? best : null;
}

/** The value at quantile `q` of an unsorted list. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

/** The share of `deltas` within the lock tolerance of 1 x `base`, and of any k x `base` (k up to 4). */
function rhythmShares(deltas: number[], base: number): { once: number; any: number } {
  let once = 0;
  let any = 0;
  for (const d of deltas) {
    const k = Math.max(1, Math.round(d / base));
    const on = k <= 4 && Math.abs(d - k * base) <= LOCK_TOLERANCE * base;
    if (on) any++;
    if (on && k === 1) once++;
  }
  return { once: once / deltas.length, any: any / deltas.length };
}

/** A rhythm must hold this share of single-refresh frames to be picked. */
const MIN_ONCE_SHARE = 0.25;

/**
 * Is the page on the vsync floor?
 *
 * The refresh rhythm is the known refresh interval that the MOST frames land
 * on exactly once. A window with one hitch in it does not move it: the first
 * version took the fastest 10th-percentile frame ever seen, and one jittery
 * second made the river read "75 Hz" (13.3 ms) on a 60 Hz display.
 *
 * `previousMs` is the rhythm picked last time. It is kept while the frames
 * still land on its multiples, so a page that drops to 30 fps on a 60 Hz
 * display reads "60 Hz, 2 refreshes a frame", not "30 Hz".
 *
 * One ambiguity cannot be removed: a page that has only ever run at 30 fps on
 * a 60 Hz display looks exactly like a 30 Hz display. The panel therefore
 * names a rhythm, not the monitor.
 */
export function analyzeVsync(deltas: number[], previousMs: number | null = null): VsyncReading {
  const none: VsyncReading = { intervalMs: null, hz: null, locked: false, lockedShare: 0, refreshesPerFrame: null };
  if (deltas.length < 20) return none;
  let pick: { intervalMs: number; hz: number } | null = null;
  if (previousMs !== null) {
    const prev = snapToRefresh(previousMs);
    if (prev && rhythmShares(deltas, prev.intervalMs).any >= LOCKED_SHARE) pick = prev;
  }
  if (!pick) {
    let best = 0;
    for (const hz of KNOWN_REFRESH_HZ) {
      const base = 1000 / hz;
      const { once } = rhythmShares(deltas, base);
      // Ties go to the higher rate, which is the earlier entry in the list.
      if (once > best + 1e-9) {
        best = once;
        pick = { intervalMs: base, hz };
      }
    }
    if (best < MIN_ONCE_SHARE) pick = null;
  }
  if (!pick) return none;
  const lockedShare = rhythmShares(deltas, pick.intervalMs).any;
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return {
    intervalMs: pick.intervalMs,
    hz: pick.hz,
    locked: lockedShare >= LOCKED_SHARE,
    lockedShare,
    refreshesPerFrame: Math.max(1, Math.round(mean / pick.intervalMs)),
  };
}

// ── 1 and 5. Work, wait, headroom, budget ─────────────────────────────────────

export interface WorkReading {
  /** The longer of CPU and GPU, ms: the side that holds the frame back. */
  busiestMs: number | null;
  busiestSide: 'gpu' | 'cpu' | null;
  /** CPU + GPU, ms: the cost if the two sides could not overlap. */
  serialMs: number | null;
  /** Frame time minus the busiest side, ms, on a locked page: time spent waiting for the display. */
  waitMs: number | null;
  /** The budget minus the busiest side, ms. Negative means over the budget. */
  headroomMs: number | null;
  /** Headroom as a share of the budget. */
  headroomShare: number | null;
  budgetMs: number;
  /**
   * False when only the CPU was measured (WebGPU in three r172). The headroom
   * is then the CPU side's alone, and the GPU may already fill the frame.
   */
  gpuMeasured: boolean;
}

/**
 * Split a frame into work and wait.
 *
 * The CPU and the GPU work in parallel: the CPU builds frame N+1 while the
 * GPU draws frame N. So the side that limits the frame is the LONGER one, not
 * the sum. The river on 2026-09-29 read CPU 8.4 + GPU 11.3 = 19.7 ms and
 * still held 58 fps, which a sum could not explain. The sum is shown only as
 * the cost if the two sides were forced into series.
 */
export function readWork(
  frameMeanMs: number,
  gpuMs: number | null,
  cpuMs: number | null,
  vsync: VsyncReading,
  budgetMs: number,
): WorkReading {
  const sides: { side: 'gpu' | 'cpu'; ms: number }[] = [];
  if (gpuMs !== null) sides.push({ side: 'gpu', ms: gpuMs });
  if (cpuMs !== null) sides.push({ side: 'cpu', ms: cpuMs });
  if (sides.length === 0) {
    return { busiestMs: null, busiestSide: null, serialMs: null, waitMs: null, headroomMs: null, headroomShare: null, budgetMs, gpuMeasured: false };
  }
  sides.sort((a, b) => b.ms - a.ms);
  const busiest = sides[0];
  const serial = sides.reduce((a, s) => a + s.ms, 0);
  const headroom = budgetMs - busiest.ms;
  return {
    busiestMs: busiest.ms,
    busiestSide: busiest.side,
    serialMs: sides.length === 2 ? serial : null,
    // A pacing rhythm cannot distinguish display waiting from browser scheduling
    // or GPU back-pressure. Keep the residual unavailable rather than name a cause.
    waitMs: null,
    headroomMs: headroom,
    headroomShare: budgetMs > 0 ? headroom / budgetMs : null,
    budgetMs,
    gpuMeasured: gpuMs !== null,
  };
}

/** Evidence for the summary, kept independent of renderer and browser APIs. */
export interface PerformanceEvidence {
  live: boolean;
  frame: { samples: number; meanMs: number; p95Ms: number };
  cpuMs: number | null;
  gpu: { meanMs: number | null };
  stalls: number;
  passes: { name: string; depth: number; cpuMs: number; gpuMs: number | null }[];
  operations?: { name: string; meanMs: number; p95Ms: number; samples: number; ageMs: number }[];
  cpuParts?: { name: string; ms: number }[];
  spans?: { name: string; ms: number }[];
  attribution?: FrameAttributionReading | null;
}

/** Rank measured costs without treating submission time or triangle counts as GPU proof. */
export function summarizePerformance(s: PerformanceEvidence, budgetMs: number): { headline: string; evidence: string; next: string; costly: string[]; pacingGap?: string; blockers?: string[]; reasons?: string[]; coverage?: string } {
  const costly = s.passes.slice().sort((a, b) => b.cpuMs - a.cpuMs).slice(0, 3)
    .map(p => `${p.name}: ${p.cpuMs.toFixed(2)} ms CPU${p.gpuMs === null ? '' : ` / ${p.gpuMs.toFixed(2)} ms GPU`}`);
  if (!s.live) return { headline: 'Paused or stopped — last reading', evidence: 'Current throughput is unavailable.', next: 'Resume the surface in a visible tab before comparing.', costly };
  if (s.frame.samples < 3) return { headline: 'Collecting evidence · low confidence', evidence: `${s.frame.samples} frame intervals; wait for at least 3.`, next: 'Keep the view and camera steady.', costly };
  const cpu = s.cpuMs;
  const gpu = s.gpu.meanMs;
  const over = cpu !== null && cpu > budgetMs;
  // Worker-prefixed readings time asynchronous execution, not the main-thread
  // reply handler. Keep them visible separately without blaming input stalls.
  const operations = (s.operations ?? []).filter(op => op.ageMs <= 2000 && op.samples > 0 && !op.name.startsWith('worker:')).sort((a,b)=>b.meanMs-a.meanMs);
  const blocking = operations.find(op => op.meanMs > budgetMs);
  // A reply handler can block the browser without being inside the render
  // callback. Its measured cost must not disappear behind a "headroom" label.
  const headline = blocking && blocking.meanMs > (cpu ?? 0) ? `${blocking.name} exceeds budget · measured` : over ? 'CPU callback exceeds budget · measured' : gpu !== null && gpu > budgetMs ? 'GPU passes exceed budget · measured' : s.frame.meanMs > budgetMs ? 'Slow frame pacing · cause unresolved' : 'Within frame budget · observed';
  const gap = Math.max(0, s.frame.meanMs - Math.max(cpu ?? 0, gpu ?? 0));
  const a=s.attribution;
  const rows=a ? [{name:'Render callbacks and submissions',ms:a.callbackMs},...a.sources.map(row=>({name:row.name,ms:row.ms}))]
    .filter(row=>row.ms>0.1).sort((x,y)=>y.ms-x.ms).slice(0,4) : [];
  const reasons=rows.map((row,i)=>(i+1)+'. '+row.name+': '+row.ms.toFixed(1)+' ms/frame');
  const coverage=a ? (a.browserCoverage==='long-animation-frame'
    ? 'Browser coverage: long frames over 50 ms; named scripts over 5 ms. Message handlers, other animation callbacks and instrumented operations are also measured.'
    : a.browserCoverage==='longtask' ? 'Browser coverage: long tasks over 50 ms; script source unavailable. Message handlers, other animation callbacks and instrumented operations are measured.'
    : 'Browser script/rendering reports unavailable. Only render/message/animation callbacks and instrumented operations are covered.') : undefined;
  return {
    headline: a && a.unknownMs > budgetMs && a.unknownMs > Math.max(a.callbackMs,a.outsideScriptMs,a.browserRenderingMs)
      ? 'Slow FPS · largest share still unexplained'
      : a && a.sources[0]?.ms > a.callbackMs && a.sources[0].ms > budgetMs
        ? 'Main cost outside render callback · measured' : headline,
    reasons, coverage,
    evidence: `${cpu === null ? 'CPU unavailable' : `CPU callback ${cpu.toFixed(1)} ms`}; ${gpu === null ? 'GPU duration unavailable' : `GPU passes ${gpu.toFixed(1)} ms`}. ${s.stalls}/${s.frame.samples} intervals >33.3 ms${s.stalls === s.frame.samples ? ' (sustained slow pacing, not isolated stalls)' : ''}.`,
    next: blocking ? 'The named handler blocks input and rendering between frames. Optimize its work; do not add it to overlapping GPU/render clocks. Worker execution is separate.' : over ? 'Inspect top CPU passes and Causes. Renderer CPU includes submission and possible GPU waiting; use a browser trace to separate them.' : 'Inspect Causes and a browser trace for scheduling or main-thread work. Total worker utilization needs its own timer; triangle counts alone do not establish a bottleneck.',
    pacingGap: a ? `Matched ${a.frames} intervals: ${a.meanFrameMs.toFixed(1)} ms/frame = callback ${a.callbackMs.toFixed(1)} + outside script ${a.outsideScriptMs.toFixed(1)} + browser rendering ${a.browserRenderingMs.toFixed(1)} + unexplained ${a.unknownMs.toFixed(1)} ms. GPU overlaps these times; unexplained is not proven idle.` : `Frame interval ${s.frame.meanMs.toFixed(1)} ms; gap beyond the longer measured render clock ≈ ${gap.toFixed(1)} ms. Different sampling windows: this is not measured idle time or spare capacity.`,
    // Named spans explain work inside the callback even when each part is below
    // budget. Together they can exhaust it; these are not independent totals.
    blockers: [...(s.spans ?? []).filter(p => Number.isFinite(p.ms) && p.ms > 0.1).slice().sort((a,b) => b.ms-a.ms).slice(0,3).map(p => p.name + ': ' + p.ms.toFixed(1) + ' ms/frame inside CPU callback'), ...operations.slice(0,3).map(op=>`${op.name}: ${op.meanMs.toFixed(1)} ms/call · p95 ${op.p95Ms.toFixed(1)} · ${op.samples} calls in 2 s`), ...(s.cpuParts ?? []).filter(p=>p.ms>budgetMs).slice(0,2).map(p=>`${p.name}: ${p.ms.toFixed(1)} ms/rendered frame`)],
    costly,
  };
}

/** The budgets a reader can pick. `display` follows the refresh rate the page shows. */
export type BudgetChoice = 'display' | '60' | '30';

export function budgetMsFor(choice: BudgetChoice, vsync: VsyncReading): number {
  if (choice === '60') return 1000 / 60;
  if (choice === '30') return 1000 / 30;
  return vsync.intervalMs ?? 1000 / 60;
}

// ── 7. Memory that moves ──────────────────────────────────────────────────────

export interface MemorySample {
  at: number;
  geometries: number;
  textures: number;
  programs: number | null;
  heapMB: number | null;
}

export interface MemoryRates {
  geometries: number;
  textures: number;
  programs: number | null;
  heapMB: number | null;
}

export interface MemoryTrend {
  /** Change over the last second. Null until two samples a second apart exist. */
  lastSecond: MemoryRates | null;
  /** Mean change per second over the last ten seconds. */
  perSecondOver10s: MemoryRates | null;
  /** What grew in every one of the last ten one-second steps: the sign of a leak. */
  growing: string[];
  /**
   * True when the heap reading cannot show a garbage collection. Chrome
   * rounds `performance.memory` to coarse buckets unless it runs with
   * `--enable-precise-memory-info`; a headless test on 2026-09-29 read the
   * same value for 31 frames in a row while the heap grew.
   */
  heapCoarse: boolean;
}

function rates(a: MemorySample, b: MemorySample): MemoryRates {
  const dt = Math.max(0.001, (b.at - a.at) / 1000);
  return {
    geometries: (b.geometries - a.geometries) / dt,
    textures: (b.textures - a.textures) / dt,
    programs: a.programs !== null && b.programs !== null ? (b.programs - a.programs) / dt : null,
    heapMB: a.heapMB !== null && b.heapMB !== null ? (b.heapMB - a.heapMB) / dt : null,
  };
}

/** Samples are one second apart, oldest first. */
export function memoryTrend(samples: MemorySample[]): MemoryTrend {
  const n = samples.length;
  const last = n >= 2 ? rates(samples[n - 2], samples[n - 1]) : null;
  const tenAgo = n >= 11 ? samples[n - 11] : n >= 2 ? samples[0] : null;
  const over10 = tenAgo && n >= 2 ? rates(tenAgo, samples[n - 1]) : null;
  const growing: string[] = [];
  if (n >= 11) {
    const window = samples.slice(n - 11);
    const grewEveryStep = (pick: (s: MemorySample) => number | null) =>
      window.every((s, i) => {
        if (i === 0) return true;
        const a = pick(window[i - 1]);
        const b = pick(s);
        return a !== null && b !== null && b > a;
      });
    if (grewEveryStep((s) => s.geometries)) growing.push('geometries');
    if (grewEveryStep((s) => s.textures)) growing.push('textures');
    if (grewEveryStep((s) => s.programs)) growing.push('programs');
    if (grewEveryStep((s) => s.heapMB)) growing.push('heap');
  }
  const heaps = samples.slice(-10).map((s) => s.heapMB).filter((h): h is number => h !== null);
  const heapCoarse = heaps.length >= 5 && new Set(heaps.map((h) => h.toFixed(3))).size <= 1;
  return { lastSecond: last, perSecondOver10s: over10, growing, heapCoarse };
}

// ── 4. The browser's own report of a long frame ───────────────────────────────

/** The fields of a Long Animation Frame entry this reads. */
export interface LoafLike {
  startTime: number;
  duration: number;
  renderStart?: number;
  styleAndLayoutStart?: number;
  scripts?: {
    invoker?: string;
    invokerType?: string;
    sourceURL?: string;
    sourceFunctionName?: string;
    duration: number;
    executionStart?: number;
    startTime?: number;
    forcedStyleAndLayoutDuration?: number;
  }[];
}

/**
 * Turn one Long Animation Frame entry into named parts.
 *
 * `ownWindow` is this surface's own measured CPU window, [start, end]. A
 * script that ran inside it is this surface's own frame callback, which the
 * probe already measured part by part, so it is left out here.
 */
export function browserParts(e: LoafLike, ownWindow: [number, number] | null): { name: string; ms: number }[] {
  const parts: { name: string; ms: number }[] = [];
  const end = e.startTime + e.duration;
  if (e.styleAndLayoutStart && e.styleAndLayoutStart > 0 && e.styleAndLayoutStart < end) {
    parts.push({ name: 'style and layout', ms: end - e.styleAndLayoutStart });
  }
  const byName = new Map<string, number>();
  for (const s of e.scripts ?? []) {
    const start = s.executionStart ?? s.startTime ?? 0;
    // This surface's own callback lies WHOLLY inside its measured window. A
    // test that only checked the start threw away the next callback too: on
    // 2026-09-29 a 90 ms busy callback began 0 ms after the river's ended.
    if (ownWindow && start >= ownWindow[0] - 0.5 && start + s.duration <= ownWindow[1] + 0.5) continue;
    const name = scriptName(s);
    byName.set(name, (byName.get(name) ?? 0) + s.duration);
  }
  for (const [name, ms] of byName) parts.push({ name, ms });
  return parts.sort((a, b) => b.ms - a.ms);
}

/** A short, human name for one script entry: "React work", "setTimeout in useWorld.ts". */
export function scriptName(s: NonNullable<LoafLike['scripts']>[number]): string {
  const url = s.sourceURL ?? '';
  const file = url.split(/[?#]/)[0].split('/').pop() || '';
  if (/react-dom|scheduler/i.test(url)) return 'React work';
  // The probe wraps every requestAnimationFrame callback, so Chrome reports
  // each one as coming from rendererProbe.ts. The file says nothing then.
  if (file.startsWith('rendererProbe') && /FrameRequestCallback/.test(s.invoker ?? '')) return 'another animation-frame callback';
  const fn = s.sourceFunctionName ? `${s.sourceFunctionName} ` : '';
  const invoker = (s.invoker ?? s.invokerType ?? 'script').replace(/^TimerHandler:/, '');
  if (file) return `${invoker}: ${fn}in ${file}`.replace(/\s+/g, ' ').trim();
  return `${invoker}${fn ? `: ${fn.trim()}` : ''}`;
}
