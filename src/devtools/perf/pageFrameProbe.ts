/**
 * @file pageFrameProbe.ts
 * The page meter: fps and freezes for the WHOLE page, with or without 3D.
 *
 * WHY THIS EXISTS (Remy, 2026-11-01): "it's taking a really long time to
 * generate a capital? can you add to the FPS tracker a FPS tracker that also
 * works outside of 3D?" The renderer probe counts a frame only when a three.js
 * renderer draws. A 2D page (the town map SVG, a DOM form, a 2D canvas) never
 * calls a renderer, so the pill said "no 3D" and a 40-second freeze showed
 * nothing at all.
 *
 * WHAT IT MEASURES
 *
 * - One browser frame = one animation-frame callback of this probe. The
 *   browser runs it once per frame it paints, so its interval is the page's
 *   own frame time, whatever draws: DOM, SVG, 2D canvas or 3D.
 * - A gap = one frame interval of at least `FREEZE_MS`.
 * - A gap has one of two causes, and a 100 ms timer (the heartbeat) tells
 *   them apart. A busy main thread stops the timer too: that gap is a FREEZE
 *   (`work`). A browser that only holds frames back, for a pane or tab out of
 *   view, lets the timer run: that gap is HELD (`held`), and the page did not
 *   freeze. The Claude app's browser pane holds frames to one every 2 s while
 *   it is out of view; the first live check called that a 45.8 s freeze.
 * - The cause of a freeze comes from Chrome's Long Animation Frame reports:
 *   the scripts that ran in it, by function and file. Chrome can deliver that
 *   report many seconds late, so the report names the cause but never decides
 *   the kind. (A rule "no report in 10 s = held" mislabeled a 13.9 s
 *   world-generation freeze in headless Chrome.)
 *
 * WHAT IT CANNOT DO
 *
 * - It cannot show anything WHILE the page is frozen. The display runs on the
 *   same main thread. The length of a freeze appears when the freeze ends.
 * - It has no GPU clock and no draw counts. Those belong to the 3D surfaces.
 *
 * It is one more session in the same registry, with id `page`. It adds no
 * second panel and no private counter; the panel, pill, report and
 * `window.__araliaPerf` read it like any other surface. A 3D surface keeps the
 * pill when one draws; the page meter takes it when none does.
 */
import { acquirePerfSession, releasePerfSession } from './perfRegistry';
import { isPerfMeasurementEnabled } from './perfControl';
import { browserParts, type LoafLike } from './diagnose';
import type { PerfSession } from './perfSession';

/** The registry id of the page meter. The overlay ranks it after 3D surfaces. */
export const PAGE_PERF_ID = 'page';
export const PAGE_PERF_LABEL = 'Page (all drawing)';

/** A frame interval at least this long is a gap. 250 ms is a clear stutter. */
export const FREEZE_MS = 250;
/** The heartbeat interval. It must be well under `FREEZE_MS`. */
export const HEARTBEAT_MS = 100;
/** Gaps kept for the panel and the pill. */
const FREEZE_KEEP = 8;

/**
 * What a gap was:
 * - `work`: the main thread was blocked; the heartbeat stopped too. The page froze.
 * - `held`: the heartbeat kept running. The browser held frames back.
 */
export type PageFreezeKind = 'work' | 'held';

export interface PageFreeze {
  kind: PageFreezeKind;
  /** When the gap began (performance.now() ms). */
  startMs: number;
  /** How long no frame went out. */
  ms: number;
  /** The longest time inside the gap when the heartbeat did not run. */
  blockedMs: number;
  /** When the next frame went out, which is when the gap became known. */
  endedAt: number;
  /** The slowest scripts in the browser's report of it, slowest first. */
  causes: { name: string; ms: number }[];
  /** True once a long-task report overlaps the gap. */
  reported: boolean;
}

/* The native requestAnimationFrame, read when this module loads.
 *
 * The renderer probe wraps requestAnimationFrame and files every callback as
 * page work against each 3D surface. The meter's own tick is not page work, so
 * it uses the function from before the wrap where it can. Every page entry
 * imports this module (through PerfOverlayHost) before it installs the probe. */
const nativeRaf: ((cb: FrameRequestCallback) => number) | null =
  typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window)
    : null;
const nativeCancel: ((id: number) => void) | null =
  typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
    ? window.cancelAnimationFrame.bind(window)
    : null;

let refs = 0;
let session: PerfSession | null = null;
let rafId: number | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let observer: PerformanceObserver | null = null;
let previousAt = 0;
let lastBeat = 0;
let maxBeatGap = 0;
const freezes: PageFreeze[] = [];

function stat(name: string, value: string | number): void {
  session?.setStat(name, value);
}

function seconds(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

function causeText(f: PageFreeze): string {
  if (f.kind === 'held') return 'not page work: the heartbeat ran, so the browser held frames (hidden or throttled view)';
  if (f.causes.length) return f.causes.map((c) => `${c.name} ${seconds(c.ms)}`).join('; ');
  return f.reported ? 'long task reported; this browser gives no script names' : 'waiting for the browser report';
}

function publishFreezeStats(): void {
  const last = freezes[0];
  if (!last) return;
  // Freezes are page work. Held gaps are kept apart so they cannot inflate them.
  const real = freezes.filter((f) => f.kind === 'work');
  stat('last gap', `${seconds(last.ms)} (${last.kind === 'work' ? 'freeze' : 'held'})`);
  stat('last gap cause', causeText(last));
  stat('longest freeze', real.length ? seconds(Math.max(...real.map((f) => f.ms))) : 'none');
  stat(`gaps ≥ ${FREEZE_MS} ms (last ${FREEZE_KEEP})`, `${real.length} freeze, ${freezes.length - real.length} held`);
}

/** One heartbeat. The interval timer calls this; tests call it directly. */
export function notePageBeat(nowMs: number): void {
  if (lastBeat > 0) maxBeatGap = Math.max(maxBeatGap, nowMs - lastBeat);
  lastBeat = nowMs;
}

/**
 * Judge one browser frame. The animation-frame loop calls this; tests call it
 * directly with their own clock.
 */
export function notePageFrame(nowMs: number, hidden = typeof document !== 'undefined' && document.hidden): void {
  if (!session || !isPerfMeasurementEnabled()) return;
  session.frame(nowMs, hidden);
  // The longest stretch with no heartbeat since the last frame, including the
  // stretch still open now.
  const blocked = lastBeat > 0 ? Math.max(maxBeatGap, nowMs - lastBeat) : Number.POSITIVE_INFINITY;
  maxBeatGap = 0;
  // A hidden tab stops frames. That gap is not a freeze of the page's work.
  if (hidden) {
    previousAt = 0;
    return;
  }
  const delta = previousAt > 0 ? nowMs - previousAt : 0;
  previousAt = nowMs;
  if (delta < FREEZE_MS) return;
  const blockedMs = Math.min(delta, blocked);
  freezes.unshift({
    kind: blockedMs >= FREEZE_MS ? 'work' : 'held',
    startMs: nowMs - delta, ms: delta, blockedMs, endedAt: nowMs, causes: [], reported: false,
  });
  freezes.length = Math.min(FREEZE_KEEP, freezes.length);
  publishFreezeStats();
}

/**
 * File one Long Animation Frame report: as page work for the matched-frame
 * view, as evidence for a slow frame, and as the cause of any freeze it
 * overlaps. Reports can arrive before or after the frame that ends a freeze.
 */
export function notePageLongFrame(e: LoafLike, longTaskOnly = false): void {
  if (!session || !isPerfMeasurementEnabled()) return;
  const parts = longTaskOnly ? [] : browserParts(e, null);
  if (longTaskOnly) session.recordPageWork('Long main-thread task (source unavailable)', e.startTime, e.startTime + e.duration, 'task');
  else {
    session.recordBrowserWork(e);
    session.recordSevereBrowserFrame(e.startTime, e.duration, parts);
  }
  const end = e.startTime + e.duration;
  let changed = false;
  for (const f of freezes) {
    if (f.kind !== 'work' || f.startMs >= end || f.endedAt <= e.startTime) continue;
    f.reported = true;
    for (const p of parts) {
      const same = f.causes.find((c) => c.name === p.name);
      if (same) same.ms = Math.max(same.ms, p.ms);
      else f.causes.push({ ...p });
    }
    f.causes.sort((a, b) => b.ms - a.ms);
    f.causes.length = Math.min(3, f.causes.length);
    changed = true;
  }
  if (changed) publishFreezeStats();
}

/** The newest gap, or null when the page has had none. */
export function lastPageFreeze(): PageFreeze | null {
  return freezes[0] ?? null;
}

/** Recent gaps, newest first. Copies, so a reader cannot edit the record. */
export function pageFreezes(): PageFreeze[] {
  return freezes.map((f) => ({ ...f, causes: f.causes.map((c) => ({ ...c })) }));
}

function tick(time: number): void {
  rafId = null;
  // performance.now(), not the frame timestamp: the heartbeat uses the same
  // clock, and the two must agree when a gap is judged.
  void time;
  notePageFrame(performance.now());
  if (refs > 0) schedule();
}

function schedule(): void {
  const raf = nativeRaf ?? (typeof window !== 'undefined' ? window.requestAnimationFrame?.bind(window) : null);
  if (raf && rafId === null) rafId = raf(tick);
}

function observeLongFrames(): void {
  if (observer || typeof PerformanceObserver === 'undefined') return;
  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  const type = supported.includes('long-animation-frame') ? 'long-animation-frame' : supported.includes('longtask') ? 'longtask' : null;
  session?.setBrowserCoverage(type ?? 'unavailable');
  if (!type) return;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // A Long Task report has a length but no scripts: the freeze keeps
        // its time and its cause stays honest about being unknown.
        notePageLongFrame(entry as unknown as LoafLike, type === 'longtask');
      }
    });
    observer.observe({ type, buffered: false });
  } catch {
    observer = null;
    session?.setBrowserCoverage('unavailable');
  }
}

/**
 * Start the page meter. Reference counted: the display calls this when it
 * mounts and the returned release when it goes. Safe outside a browser.
 */
export function startPageFrameProbe(): () => void {
  if (typeof window === 'undefined') return () => {};
  refs += 1;
  if (refs === 1) {
    session = acquirePerfSession(PAGE_PERF_ID, PAGE_PERF_LABEL);
    session.setGpuUnavailable('no-context');
    stat('measures', 'every browser frame: DOM, SVG, 2D canvas and 3D');
    observeLongFrames();
    previousAt = 0;
    lastBeat = 0;
    maxBeatGap = 0;
    heartbeat = setInterval(() => notePageBeat(performance.now()), HEARTBEAT_MS);
    schedule();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    refs -= 1;
    if (refs > 0) return;
    if (rafId !== null) (nativeCancel ?? window.cancelAnimationFrame?.bind(window))?.(rafId);
    rafId = null;
    if (heartbeat !== null) clearInterval(heartbeat);
    heartbeat = null;
    observer?.disconnect();
    observer = null;
    releasePerfSession(PAGE_PERF_ID);
    session = null;
    freezes.length = 0;
    previousAt = 0;
    lastBeat = 0;
    maxBeatGap = 0;
  };
}
