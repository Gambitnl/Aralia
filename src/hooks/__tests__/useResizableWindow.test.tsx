/**
 * @file useResizableWindow.test.tsx
 * Regression coverage for the shared draggable/resizable window sizing rules.
 */
import React, { useRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useResizableWindow } from '../useResizableWindow';

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

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
  const { size, position } = useResizableWindow(windowRef, storageKey, { initialMaximized, minimumSize });

  return (
    <div
      ref={windowRef}
      data-testid="window-probe"
      data-width={size.width}
      data-height={size.height}
      data-left={position?.left ?? ''}
      data-top={position?.top ?? ''}
    />
  );
};

describe('useResizableWindow', () => {
  beforeEach(() => {
    localStorage.clear();
    setViewport(1280, 768);
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
});
