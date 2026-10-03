/**
 * @file PerfFpsText.tsx
 * The shared tool's frame rate for one surface, as inline text.
 *
 * This is how a HUD shows fps WITHOUT a counter of its own. Before
 * 2026-09-29, the game's Debug HUD, three fluid sandboxes, the entity
 * debugger and the WebGPU probe each counted frames their own way (a second
 * requestAnimationFrame loop, an EMA of `1 / delta`, a 500 ms window), so one
 * frame read as several different frame rates. This component reads the one
 * session the renderer probe keeps for the surface.
 *
 * It never calls setState. It renders one span once and writes the number
 * into it from a timer, for the reason PerfWindowBadge.tsx gives: a timer
 * that re-rendered a component in the page's own React root once starved a
 * heavy Suspense render forever.
 */
import React, { useEffect, useRef } from 'react';
import { getPerfSession, getPerfSessions } from './perfRegistry';

interface PerfFpsTextProps {
  /**
   * The session to read, such as 'world3d'. Omit it to read the surface that
   * is drawing in the same window as this text (the window's WindowFrame
   * dialog), or else the first surface drawing anywhere on the page.
   */
  sessionId?: string;
  /** Shown while no session exists or it has stopped. */
  fallback?: string;
  /** Refresh interval in milliseconds. */
  intervalMs?: number;
}

export const PerfFpsText: React.FC<PerfFpsTextProps> = ({
  sessionId,
  fallback = '—',
  intervalMs = 500,
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tick = () => {
      const now = performance.now();
      let session = sessionId ? getPerfSession(sessionId) : undefined;
      if (!sessionId) {
        const live = getPerfSessions().filter((s) => s.snapshot(now).live);
        const win = el.closest('[role="dialog"]');
        session =
          (win ? live.find((s) => s.element !== null && win.contains(s.element)) : undefined) ?? live[0];
      }
      const snap = session?.snapshot(now);
      el.textContent = snap && snap.live ? snap.frame.fps.toFixed(0) : fallback;
    };
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [sessionId, fallback, intervalMs]);

  return <span ref={ref} data-testid="perf-fps-text">{fallback}</span>;
};

export default PerfFpsText;
