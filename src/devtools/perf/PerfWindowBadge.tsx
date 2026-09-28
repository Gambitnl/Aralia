/**
 * @file PerfWindowBadge.tsx
 * The frame rate of a window's 3D surface, in that window's title bar.
 *
 * Pass `<PerfWindowBadge />` as a WindowFrame's `headerActions`. It finds the
 * measured canvas that sits inside the same window and shows its fps. A
 * window with no measured canvas shows nothing, so the badge can go on every
 * window without a check at the call site. A click opens the full panel on
 * that surface.
 *
 * WHY IT NEVER CALLS setState. This badge renders inside the PAGE's React
 * root, not in the panel's own root. A timer that called setState there is
 * exactly what once starved the battle map's Suspense retry render forever
 * (see PerfOverlayHost.tsx). So the badge renders one button once and then
 * writes its text straight into the DOM from a timer. React never re-renders
 * it, and the page's render work is never interrupted.
 */
import React, { useEffect, useRef } from 'react';
import { fpsColor } from './PerfOverlay';
import { getPerfSessions, requestPerfPanel, subscribePerfSessions } from './perfRegistry';

/** Twice a second is enough for a number the eye reads in passing. */
const BADGE_POLL_MS = 500;

const badgeStyle: React.CSSProperties = {
  display: 'none',
  alignSelf: 'center',
  padding: '3px 8px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
  background: 'rgba(2,6,23,0.7)',
  border: '1px solid #334155',
  borderRadius: 6,
  cursor: 'pointer',
};

export const PerfWindowBadge: React.FC = () => {
  const ref = useRef<HTMLButtonElement | null>(null);
  const sessionId = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tick = () => {
      const win = el.closest('[role="dialog"]');
      const now = performance.now();
      const inside = win
        ? getPerfSessions()
            .filter((s) => s.element !== null && win.contains(s.element))
            .map((s) => s.snapshot(now))
        : [];
      const shown = inside.find((s) => s.live) ?? inside[0];
      if (!shown) {
        el.style.display = 'none';
        sessionId.current = null;
        return;
      }
      sessionId.current = shown.id;
      el.style.display = '';
      el.style.color = shown.live ? fpsColor(shown.frame.fps) : '#64748b';
      el.textContent = shown.live
        ? `${shown.frame.fps.toFixed(0)} fps${inside.length > 1 ? ` · ${inside.length}` : ''}`
        : 'stopped';
      el.title = shown.live
        ? `${shown.label}: ${shown.frame.meanMs.toFixed(1)} ms mean, ${shown.frame.worstMs.toFixed(1)} ms worst. Click for the full panel (Alt+P).`
        : `${shown.label} stopped drawing. Click for the full panel (Alt+P).`;
    };

    tick();
    const timer = window.setInterval(tick, BADGE_POLL_MS);
    const stop = subscribePerfSessions(tick);
    return () => {
      window.clearInterval(timer);
      stop();
    };
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      data-testid="perf-window-badge"
      aria-label="Frame rate of this window's 3D view. Opens the performance panel."
      style={badgeStyle}
      onClick={() => {
        if (sessionId.current) requestPerfPanel(sessionId.current);
      }}
    />
  );
};

export default PerfWindowBadge;
