/**
 * @file TransitionController.lifecycle.test.tsx
 * RTL proof for W3DUI-3: atlas ↔ 3D mount/unmount and onComplete timing.
 */
import React, { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TransitionController from '../TransitionController';
import {
  ATLAS_FADE_IN_MS,
  ATLAS_FADE_OUT_MS,
  CAMERA_DIVE_MS,
  CAMERA_LERP_UP_MS,
  ENTRY_TRANSITION_BUDGET_MS,
} from '../transitionTiming';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

function Harness({
  initialMode = 'atlas' as 'atlas' | '3d',
  onComplete = vi.fn(),
}: {
  initialMode?: 'atlas' | '3d';
  onComplete?: () => void;
}) {
  const [mode, setMode] = useState<'atlas' | '3d'>(initialMode);
  return (
    <>
      <button type="button" onClick={() => setMode('3d')}>
        go-3d
      </button>
      <button type="button" onClick={() => setMode('atlas')}>
        go-atlas
      </button>
      <TransitionController
        mode={mode}
        onComplete={onComplete}
        atlasContent={<div data-testid="atlas-stub">atlas</div>}
        sceneContent={<div data-testid="scene-stub">scene</div>}
      />
    </>
  );
}

describe('TransitionController lifecycle (W3DUI-3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in atlas mode with atlas visible and scene unmounted', () => {
    render(<Harness />);
    expect(screen.getByTestId('transition-atlas-layer')).toBeInTheDocument();
    expect(screen.queryByTestId('transition-scene-layer')).not.toBeInTheDocument();
    expect(screen.getByTestId('atlas-stub')).toBeInTheDocument();
  });

  it('mounts scene and calls onComplete after entry budget', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    act(() => {
      screen.getByRole('button', { name: 'go-3d' }).click();
    });

    // Atlas layer hides immediately on entry; scene is not mounted until fade-out completes.
    expect(screen.queryByTestId('scene-stub')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(ATLAS_FADE_OUT_MS);
    });
    expect(screen.getByTestId('transition-scene-layer')).toBeInTheDocument();
    expect(screen.getByTestId('scene-stub')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CAMERA_DIVE_MS);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);

    expect(ENTRY_TRANSITION_BUDGET_MS).toBe(ATLAS_FADE_OUT_MS + CAMERA_DIVE_MS + 200);
  });

  it('unmounts scene after exit sequence when returning to atlas', () => {
    render(<Harness initialMode="3d" />);
    expect(screen.getByTestId('transition-scene-layer')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: 'go-atlas' }).click();
    });

    act(() => {
      vi.advanceTimersByTime(CAMERA_LERP_UP_MS + ATLAS_FADE_IN_MS);
    });

    expect(screen.queryByTestId('transition-scene-layer')).not.toBeInTheDocument();
    expect(screen.getByTestId('transition-atlas-layer')).toBeInTheDocument();
  });

  it('clears pending entry timers when unmounted mid-transition', () => {
    const onComplete = vi.fn();
    const { unmount } = render(<Harness onComplete={onComplete} />);

    act(() => {
      screen.getByRole('button', { name: 'go-3d' }).click();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(ENTRY_TRANSITION_BUDGET_MS + 500);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });
});
