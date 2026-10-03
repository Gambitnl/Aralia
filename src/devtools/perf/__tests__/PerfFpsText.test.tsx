/**
 * @file PerfFpsText.test.tsx
 * A HUD's fps is the shared tool's fps.
 *
 * Before 2026-09-29 the game's Debug HUD counted frames in a second
 * requestAnimationFrame loop, so the HUD and the Alt+P panel could disagree
 * about the same frame. These tests pin that the HUD now shows the session's
 * own number, and says so plainly when there is none.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PerfFpsText } from '../PerfFpsText';
import { acquirePerfSession, clearPerfSessions } from '../perfRegistry';
import DebugHUD from '../../../components/World3D/DebugHUD';

/** A session that drew 31 frames 16.67 ms apart, ending now. */
function sixtyFpsSession(id: string) {
  const s = acquirePerfSession(id, id);
  const now = performance.now();
  for (let i = 30; i >= 0; i--) s.frame(now - i * (1000 / 60));
  return s;
}

afterEach(() => clearPerfSessions());

describe('PerfFpsText', () => {
  it('shows the named session\'s frame rate', () => {
    sixtyFpsSession('world3d');
    render(<PerfFpsText sessionId="world3d" />);
    expect(screen.getByTestId('perf-fps-text')).toHaveTextContent('60');
  });

  it('shows the fallback, not zero, when the surface is not measured', () => {
    render(<PerfFpsText sessionId="nothing-here" />);
    expect(screen.getByTestId('perf-fps-text')).toHaveTextContent('—');
  });

  it('reads the surface in its own window when no id is given', () => {
    const inside = sixtyFpsSession('in-window');
    acquirePerfSession('elsewhere', 'elsewhere'); // never drew: not live
    const canvas = document.createElement('canvas');
    inside.element = canvas;
    render(
      <div role="dialog" aria-label="Entity Debug">
        {/* the canvas and the text share one window */}
        <div
          ref={(el) => {
            el?.appendChild(canvas);
          }}
        />
        <PerfFpsText />
      </div>,
    );
    expect(screen.getByTestId('perf-fps-text')).toHaveTextContent('60');
  });
});

describe('DebugHUD', () => {
  it('shows the world3d session\'s fps, the same number as the panel', () => {
    sixtyFpsSession('world3d');
    render(<DebugHUD chunkCount={4} playerPos={null} />);
    expect(screen.getByTestId('perf-fps-text')).toHaveTextContent('60');
  });
});
