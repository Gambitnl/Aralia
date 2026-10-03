/**
 * This file verifies Aralia's shared floating-window geometry contract.
 *
 * The tests exercise responsive sizing, caller-specific minimums, drag bounds,
 * maximize/default restore, reset, and the exact persistence boundary. They use
 * a plain probe instead of WindowFrame so visual chrome cannot hide a behavior
 * regression in the reusable geometry hook.
 *
 * Exercises: useResizableWindow.ts
 * Depends on: React, React Testing Library, Vitest, and browser localStorage
 */
import React, { useRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResizableWindow } from '../useResizableWindow';

// ============================================================================
// Browser And Geometry Test Helpers
// ============================================================================
// JSDOM has no visual viewport or layout engine. These helpers provide the two
// measurements the real hook reads while leaving its clamp math unchanged.
// ============================================================================

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

function setProbeRectangle(
  probe: HTMLElement,
  rectangle: { left: number; top: number; width: number; height: number },
): void {
  vi.spyOn(probe, 'getBoundingClientRect').mockReturnValue({
    ...rectangle,
    x: rectangle.left,
    y: rectangle.top,
    right: rectangle.left + rectangle.width,
    bottom: rectangle.top + rectangle.height,
    toJSON: () => rectangle,
  } as DOMRect);
}

// ============================================================================
// Hook Probe
// ============================================================================
// The probe exposes the neutral state and callbacks that a product-specific
// window shell would connect to its own title bar and resize affordances.
// ============================================================================

const WindowProbe: React.FC<{
  storageKey: string;
  initialMaximized?: boolean;
  minimumSize?: { width: number; height: number };
}> = ({
  storageKey,
  initialMaximized = true,
  minimumSize,
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const {
    size,
    position,
    isMaximized,
    handleDragStart,
    handleResizeStart,
    handleMaximize,
    handleReset,
  } = useResizableWindow(windowRef, storageKey, { initialMaximized, minimumSize });

  return (
    <>
      <div
        ref={windowRef}
        data-testid="window-probe"
        data-width={size.width}
        data-height={size.height}
        data-left={position?.left ?? ''}
        data-top={position?.top ?? ''}
        data-is-maximized={String(isMaximized)}
        onMouseDown={handleDragStart}
      >
        <button type="button">Panel action</button>
      </div>
      <button
        type="button"
        onMouseDown={(event) => handleResizeStart(event, 'bottom-right')}
      >
        Resize bottom-right
      </button>
      <button type="button" onClick={handleMaximize}>Toggle maximize</button>
      <button type="button" onClick={handleReset}>Reset layout</button>
    </>
  );
};

// ============================================================================
// Responsive And Caller Minimums
// ============================================================================
// Desktop minimums protect usable content, but the real viewport always wins so
// a reopened frame cannot strand controls outside a phone-sized workspace.
// ============================================================================

describe('useResizableWindow', () => {
  beforeEach(() => {
    // Run the production frame-cache invalidation immediately. JSDOM does not
    // paint real frames, so leaving its animation callback queued would leak a
    // previous test's measured header offset into the next geometry scenario.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    localStorage.clear();
    setViewport(1280, 768);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shrinks maximized windows to the available viewport width on narrow screens', async () => {
    setViewport(480, 640);

    render(<WindowProbe storageKey="narrow-maximized-window" />);

    const probe = screen.getByTestId('window-probe');
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-width', '440');
      expect(probe).toHaveAttribute('data-left', '20');
    });
  });

  it('clamps saved desktop-sized windows when reopened in a cramped viewport', async () => {
    localStorage.setItem('saved-wide-window', JSON.stringify({ width: 1024, height: 800 }));
    setViewport(480, 640);

    render(<WindowProbe storageKey="saved-wide-window" />);

    const probe = screen.getByTestId('window-probe');
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-width', '440');
      expect(probe).toHaveAttribute('data-left', '20');
    });
  });

  it('raises an undersized saved window to a caller-specific desktop minimum', async () => {
    localStorage.setItem('saved-small-map-window', JSON.stringify({ width: 600, height: 400 }));

    render(
      <WindowProbe
        storageKey="saved-small-map-window"
        minimumSize={{ width: 840, height: 640 }}
      />,
    );

    const probe = screen.getByTestId('window-probe');
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-width', '840');
      expect(probe).toHaveAttribute('data-height', '640');
    });
  });

  it('keeps a caller-specific minimum responsive when the viewport is smaller', async () => {
    setViewport(480, 640);

    render(
      <WindowProbe
        storageKey="responsive-map-window"
        minimumSize={{ width: 840, height: 640 }}
      />,
    );

    const probe = screen.getByTestId('window-probe');
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-width', '440');
      expect(probe).toHaveAttribute('data-height', '600');
    });
  });

  // ========================================================================
  // Maximize, Reset, And Persistence Boundaries
  // ========================================================================
  // Aralia restores to its shared default rather than the previous rectangle.
  // Only a completed pointer resize persists; position and maximized state do not.
  // ========================================================================

  it('maximizes to workspace bounds and restores to the clamped shared default', async () => {
    localStorage.setItem('maximize-window', JSON.stringify({ width: 700, height: 500 }));
    render(<WindowProbe storageKey="maximize-window" initialMaximized={false} />);

    const probe = screen.getByTestId('window-probe');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle maximize' }));

    await waitFor(() => {
      expect(probe).toHaveAttribute('data-width', '1240');
      expect(probe).toHaveAttribute('data-height', '728');
      expect(probe).toHaveAttribute('data-left', '20');
      expect(probe).toHaveAttribute('data-top', '20');
      expect(probe).toHaveAttribute('data-is-maximized', 'true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle maximize' }));

    await waitFor(() => {
      expect(probe).toHaveAttribute('data-width', '1024');
      expect(probe).toHaveAttribute('data-height', '728');
      expect(probe).toHaveAttribute('data-left', '128');
      expect(probe).toHaveAttribute('data-is-maximized', 'false');
    });
  });

  it('reset clears stored size, returns to the default, and leaves maximized mode', async () => {
    render(<WindowProbe storageKey="reset-window" initialMaximized />);
    localStorage.setItem('reset-window', JSON.stringify({ width: 700, height: 500 }));

    fireEvent.click(screen.getByRole('button', { name: 'Reset layout' }));

    const probe = screen.getByTestId('window-probe');
    await waitFor(() => {
      expect(localStorage.getItem('reset-window')).toBeNull();
      expect(probe).toHaveAttribute('data-width', '1024');
      expect(probe).toHaveAttribute('data-height', '728');
      expect(probe).toHaveAttribute('data-left', '128');
      expect(probe).toHaveAttribute('data-is-maximized', 'false');
    });
  });

  it('persists resized dimensions but recenters instead of restoring a dragged position', async () => {
    localStorage.setItem('persistent-size-window', JSON.stringify({ width: 600, height: 400 }));
    const firstMount = render(
      <WindowProbe storageKey="persistent-size-window" initialMaximized={false} />,
    );

    const firstProbe = screen.getByTestId('window-probe');
    await waitFor(() => {
      expect(firstProbe).toHaveAttribute('data-left', '340');
      expect(firstProbe).toHaveAttribute('data-top', '184');
    });
    setProbeRectangle(firstProbe, { left: 340, top: 184, width: 600, height: 400 });

    // Resize through the same bottom-right pointer path used by ResizeHandles,
    // then release the pointer so the hook writes the final dimensions.
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Resize bottom-right' }), {
      button: 0,
      clientX: 940,
      clientY: 584,
    });
    fireEvent.mouseMove(document, { clientX: 1140, clientY: 684 });
    await waitFor(() => {
      expect(firstProbe).toHaveAttribute('data-width', '800');
      expect(firstProbe).toHaveAttribute('data-height', '500');
    });
    fireEvent.mouseUp(document);

    await waitFor(() => {
      expect(localStorage.getItem('persistent-size-window')).toBe(
        JSON.stringify({ width: 800, height: 500 }),
      );
    });

    // Dragging changes live position but deliberately does not write any extra
    // geometry into storage.
    setProbeRectangle(firstProbe, { left: 340, top: 184, width: 800, height: 500 });
    fireEvent.mouseDown(firstProbe, { button: 0, clientX: 340, clientY: 184 });
    fireEvent.mouseMove(document, { clientX: 20, clientY: 20 });
    fireEvent.mouseUp(document);
    await waitFor(() => {
      expect(firstProbe).toHaveAttribute('data-left', '20');
      expect(firstProbe).toHaveAttribute('data-top', '20');
    });

    firstMount.unmount();
    render(<WindowProbe storageKey="persistent-size-window" initialMaximized={false} />);

    // Reopening reads the saved size, then centers it afresh. The prior dragged
    // coordinates, open state, and stack order have no persistence channel here.
    const reopenedProbe = screen.getByTestId('window-probe');
    await waitFor(() => {
      expect(reopenedProbe).toHaveAttribute('data-width', '800');
      expect(reopenedProbe).toHaveAttribute('data-height', '500');
      expect(reopenedProbe).toHaveAttribute('data-left', '240');
      expect(reopenedProbe).toHaveAttribute('data-top', '134');
      expect(reopenedProbe).toHaveAttribute('data-is-maximized', 'false');
    });
  });

  it('clamps pointer resizing between the responsive minimum and workspace maximum', async () => {
    localStorage.setItem('bounded-resize-window', JSON.stringify({ width: 700, height: 500 }));
    render(<WindowProbe storageKey="bounded-resize-window" initialMaximized={false} />);

    const probe = screen.getByTestId('window-probe');
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-left', '290');
      expect(probe).toHaveAttribute('data-top', '134');
    });
    setProbeRectangle(probe, { left: 290, top: 134, width: 700, height: 500 });

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Resize bottom-right' }), {
      button: 0,
      clientX: 990,
      clientY: 634,
    });
    fireEvent.mouseMove(document, { clientX: -1000, clientY: -1000 });
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-width', '600');
      expect(probe).toHaveAttribute('data-height', '400');
    });

    fireEvent.mouseMove(document, { clientX: 3000, clientY: 3000 });
    fireEvent.mouseUp(document);
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-width', '1240');
      expect(probe).toHaveAttribute('data-height', '728');
    });
  });

  // ========================================================================
  // Drag Bounds
  // ========================================================================
  // The title-bar drag boundary keeps the whole frame inside side/bottom margins
  // and below any visible top-page header measured by the hook.
  // ========================================================================

  it('clamps dragging to viewport margins and below visible top-page chrome', async () => {
    const topHeader = document.createElement('header');
    vi.spyOn(topHeader, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1280,
      bottom: 64,
      width: 1280,
      height: 64,
      toJSON: () => ({}),
    } as DOMRect);
    document.body.appendChild(topHeader);

    localStorage.setItem('bounded-drag-window', JSON.stringify({ width: 600, height: 400 }));
    render(<WindowProbe storageKey="bounded-drag-window" initialMaximized={false} />);

    const probe = screen.getByTestId('window-probe');
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-top', '212');
    });
    setProbeRectangle(probe, { left: 340, top: 212, width: 600, height: 400 });

    fireEvent.mouseDown(probe, { button: 0, clientX: 340, clientY: 212 });
    fireEvent.mouseMove(document, { clientX: -1000, clientY: -1000 });
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-left', '20');
      expect(probe).toHaveAttribute('data-top', '76');
    });

    fireEvent.mouseMove(document, { clientX: 2000, clientY: 2000 });
    fireEvent.mouseUp(document);
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-left', '660');
      expect(probe).toHaveAttribute('data-top', '348');
    });

    // This header sits outside React's rendered container, so remove it here
    // instead of relying on Testing Library's component cleanup.
    topHeader.remove();
  });

  it('starts dragging only from a primary-button press outside interactive controls', async () => {
    localStorage.setItem('drag-start-window', JSON.stringify({ width: 600, height: 400 }));
    render(<WindowProbe storageKey="drag-start-window" initialMaximized={false} />);

    const probe = screen.getByTestId('window-probe');
    await waitFor(() => {
      expect(probe).toHaveAttribute('data-left', '340');
      expect(probe).toHaveAttribute('data-top', '184');
    });
    setProbeRectangle(probe, { left: 340, top: 184, width: 600, height: 400 });

    // A title-bar action may live inside the same drag boundary. Its press must
    // remain a button interaction instead of beginning a window move.
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Panel action' }), {
      button: 0,
      clientX: 340,
      clientY: 184,
    });
    fireEvent.mouseMove(document, { clientX: 20, clientY: 20 });

    // Secondary-button presses likewise leave window geometry untouched.
    fireEvent.mouseDown(probe, { button: 2, clientX: 340, clientY: 184 });
    fireEvent.mouseMove(document, { clientX: 20, clientY: 20 });

    expect(probe).toHaveAttribute('data-left', '340');
    expect(probe).toHaveAttribute('data-top', '184');
  });
});
