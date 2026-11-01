/**
 * @file pageFrameProbe.test.ts
 * The page meter: fps and freezes for pages with no 3D (Remy, 2026-11-01).
 *
 * The frame loop and the heartbeat are driven by hand with `notePageFrame` and
 * `notePageBeat`, so each test owns its clock. Real timers would make the
 * intervals depend on the test runner's speed.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  FREEZE_MS,
  HEARTBEAT_MS,
  PAGE_PERF_ID,
  lastPageFreeze,
  notePageBeat,
  notePageFrame,
  notePageLongFrame,
  pageFreezes,
  startPageFrameProbe,
} from '../pageFrameProbe';
import { clearPerfSessions, getPerfSession } from '../perfRegistry';

let stop: (() => void) | null = null;

afterEach(() => {
  stop?.();
  stop = null;
  clearPerfSessions();
});

/** Frames at a steady step, with the heartbeat running beside them. */
function run(start: number, frames: number, stepMs: number): number {
  let t = start;
  for (let i = 0; i < frames; i++) {
    t += stepMs;
    notePageBeat(t);
    notePageFrame(t, false);
  }
  return t;
}

/** The main thread is blocked: no heartbeat, then the next frame. */
function block(t: number, ms: number): number {
  notePageFrame(t + ms, false);
  return t + ms;
}

/** The browser holds frames, but the heartbeat keeps running. */
function hold(t: number, ms: number): number {
  for (let b = HEARTBEAT_MS; b < ms; b += HEARTBEAT_MS) notePageBeat(t + b);
  notePageFrame(t + ms, false);
  return t + ms;
}

function statValue(name: string): string | undefined {
  const s = getPerfSession(PAGE_PERF_ID)!.snapshot().stats.find((x) => x.name === name);
  return s === undefined ? undefined : String(s.value);
}

describe('page meter', () => {
  it('registers one page session that counts frames with no renderer', () => {
    stop = startPageFrameProbe();
    const session = getPerfSession(PAGE_PERF_ID);
    expect(session).toBeDefined();
    run(1000, 61, 1000 / 60);
    expect(session!.snapshot().frame.fps).toBeCloseTo(60, 0);
    expect(lastPageFreeze()).toBeNull();
  });

  it('is reference counted, so a second start shares the session', () => {
    stop = startPageFrameProbe();
    const second = startPageFrameProbe();
    const session = getPerfSession(PAGE_PERF_ID);
    second();
    expect(getPerfSession(PAGE_PERF_ID)).toBe(session);
    stop();
    stop = null;
    expect(getPerfSession(PAGE_PERF_ID)).toBeUndefined();
  });

  it('records a blocked main thread as a freeze, with its length', () => {
    stop = startPageFrameProbe();
    const t = block(run(1000, 30, 16), 41_200); // the capital case: 41 s, no frame, no timer
    const freeze = lastPageFreeze()!;
    expect(freeze.kind).toBe('work');
    expect(freeze.ms).toBeCloseTo(41_200, 5);
    expect(freeze.endedAt).toBe(t);
    expect(statValue('last gap')).toBe('41.2 s (freeze)');
    expect(statValue('longest freeze')).toBe('41.2 s');
  });

  it('records frames held by the browser as "held", not a freeze', () => {
    stop = startPageFrameProbe();
    hold(run(1000, 5, 16), 45_800); // the in-app pane while it is out of view
    expect(lastPageFreeze()!.kind).toBe('held');
    expect(statValue('longest freeze')).toBe('none');
    expect(statValue(`gaps ≥ ${FREEZE_MS} ms (last 8)`)).toBe('0 freeze, 1 held');
  });

  it('does not count a frame just under the threshold as a gap', () => {
    stop = startPageFrameProbe();
    block(run(1000, 5, 16), FREEZE_MS - 1);
    expect(lastPageFreeze()).toBeNull();
  });

  it('does not count time in a hidden tab as a gap', () => {
    stop = startPageFrameProbe();
    let t = run(1000, 5, 16);
    t += 5_000;
    notePageFrame(t, true); // the tab was hidden
    run(t, 2, 16); // the first visible frames after
    expect(lastPageFreeze()).toBeNull();
  });

  it('names the cause from a browser report that arrives after the freeze', () => {
    stop = startPageFrameProbe();
    const frozenFrom = run(1000, 5, 16);
    block(frozenFrom, 3_000);
    expect(statValue('last gap cause')).toBe('waiting for the browser report');
    notePageLongFrame({
      startTime: frozenFrom + 2,
      duration: 2_990,
      scripts: [
        { invoker: 'TimerHandler:setTimeout', sourceURL: 'http://x/src/town/townEngine.ts', sourceFunctionName: 'generateTownPlan', duration: 2_900 },
      ],
    });
    const freeze = pageFreezes()[0];
    expect(freeze.causes[0].name).toContain('generateTownPlan');
    expect(freeze.causes[0].name).toContain('townEngine.ts');
    expect(statValue('last gap cause')).toContain('generateTownPlan');
  });

  it('ignores a browser report that does not overlap the freeze', () => {
    stop = startPageFrameProbe();
    const t = block(run(1000, 5, 16), 600);
    notePageLongFrame({ startTime: t + 5_000, duration: 80, scripts: [{ invoker: 'click', duration: 70 }] });
    expect(pageFreezes()[0].causes).toEqual([]);
    expect(pageFreezes()[0].reported).toBe(false);
  });

  it('forgets its gaps when the last user releases it', () => {
    stop = startPageFrameProbe();
    block(run(1000, 3, 16), 900);
    expect(lastPageFreeze()).not.toBeNull();
    stop();
    stop = null;
    expect(lastPageFreeze()).toBeNull();
  });
});

describe('pill on a page with no 3D', () => {
  it('shows the page fps and the last freeze', async () => {
    const { render, screen } = await import('@testing-library/react');
    const React = await import('react');
    const { PerfOverlayView } = await import('../PerfOverlay');
    localStorage.clear();
    stop = startPageFrameProbe();
    // A freeze that ended just now, on the test's real clock. The test clock
    // starts near zero, so the freeze is short enough to fit after it.
    const now = performance.now();
    run(now - 1_232, 1, 16);
    block(now - 1_200, 1_200);
    const view = render(React.createElement(PerfOverlayView));
    const pill = await screen.findByTitle('Performance (Alt+P)');
    expect(pill.textContent).toContain('page');
    expect(pill.textContent).not.toContain('no 3D');
    expect((await screen.findByTestId('perf-pill-freeze')).textContent).toContain('froze 1.2 s');
    view.unmount();
  });
});
